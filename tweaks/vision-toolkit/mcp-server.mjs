#!/usr/bin/env node
/**
 * vision-toolkit MCP server
 * ---------------------------------------------------------------------------
 * 一个零依赖的 MCP (Model Context Protocol) stdio server，为 Codex 里的纯文本
 * 模型接入云端视觉能力。模型在对话中主动调用 `vision_glance` 工具，本进程把
 * 图片 + 意图转发给云端多模态模型（默认 Groq 上的 qwen/qwen3.6-27b），把识别
 * 结果作为工具输出返回给模型。
 *
 * 协议：JSON-RPC 2.0 over stdio（每行一个 JSON 消息，见 MCP 规范）。
 * 视觉后端：通过 env 配置，默认走 OpenAI 兼容格式（Groq / Gemini / OpenRouter）。
 *   VISION_BASE_URL   例：https://api.groq.com/openai/v1
 *   VISION_MODEL      例：qwen/qwen3.6-27b
 *   VISION_API_KEY    你的 key（留空则工具会返回友好报错）
 *   VISION_PROTOCOL   openai | anthropic | dashscope（默认 openai）
 *   VISION_LANG       zh | en（描述语言，默认 zh）
 *   VISION_MAX_TOKENS 描述长度上限（默认 1024）
 *
 * 依赖：仅 Node 内置模块（fetch 发 HTTP；macOS 大图用 sips 压缩）。不引任何第三方包。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const TWEAK_ID = "com.chatgpt-plusplus.vision-toolkit";

function userRoot() {
  if (process.env.CHATGPT_PLUSPLUS_HOME) return process.env.CHATGPT_PLUSPLUS_HOME;
  if (process.env.CODEX_PLUSPLUS_HOME) return process.env.CODEX_PLUSPLUS_HOME;
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "chatgpt-plusplus");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "chatgpt-plusplus");
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), "chatgpt-plusplus");
}

function loadOverlay() {
  try {
    return JSON.parse(fs.readFileSync(path.join(userRoot(), "tweak-data", TWEAK_ID, "config.json"), "utf8"));
  } catch {
    return {};
  }
}

function pick(overlay, env, overlayKey, envKey, fallback) {
  const o = overlay?.[overlayKey];
  if (o != null && String(o).trim() !== "") return String(o);
  let e = env[envKey];
  if (e === "YOUR_VISION_API_KEY") e = "";
  if (e != null && String(e).trim() !== "") return String(e);
  return fallback;
}

function resolveConfig(env, overlay) {
  return {
    baseUrl: pick(overlay, env, "baseUrl", "VISION_BASE_URL", "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    model: pick(overlay, env, "model", "VISION_MODEL", "qwen/qwen3.6-27b"),
    apiKey: pick(overlay, env, "apiKey", "VISION_API_KEY", ""),
    protocol: pick(overlay, env, "protocol", "VISION_PROTOCOL", "openai").toLowerCase(),
    lang: pick(overlay, env, "lang", "VISION_LANG", "zh").toLowerCase(),
    maxTokens: Number.parseInt(pick(overlay, env, "maxTokens", "VISION_MAX_TOKENS", "1024"), 10) || 1024,
    enabledModels: pick(overlay, env, "enabledModels", "VISION_ENABLED_MODELS", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    // 空闲多少分钟后自动退出（0 = 永不退出）。Codex 会给每个加载中的会话拉起
    // 一个本进程且长期不回收，多会话并发时进程线性堆积；空闲自退能把闲置
    // 会话占用的进程释放掉。
    idleExitMinutes: Number.parseFloat(pick(overlay, env, "idleExitMinutes", "VISION_IDLE_EXIT_MINUTES", "30")) || 0,
  };
}

const CONFIG = resolveConfig(process.env, process.argv.includes("--ping") ? {} : loadOverlay());

// Groq 限制：单请求图片 ≤ 20MB、最多 5 张。留一点余量给 base64 膨胀（约 4/3）。
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 5;

const SERVER_INFO = { name: "vision-toolkit", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

// ---------------------------------------------------------------------------
// 日志（只能写 stderr —— stdout 是 JSON-RPC 通道，绝不能污染）
// ---------------------------------------------------------------------------

function log(...args) {
  try {
    process.stderr.write(`[vision-toolkit] ${args.join(" ")}\n`);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// 模型白名单检查（支持通配符）
// ---------------------------------------------------------------------------

function isModelEnabled(modelName) {
  // 没配置白名单 → 默认全部允许（向后兼容）
  if (!CONFIG.enabledModels.length) return true;

  const name = (modelName || "").toLowerCase();
  return CONFIG.enabledModels.some((pattern) => {
    const pat = pattern.toLowerCase();
    // 支持简单通配符：deepseek-* 匹配 deepseek-chat / deepseek-coder
    if (pat.endsWith("*")) {
      return name.startsWith(pat.slice(0, -1));
    }
    return name === pat;
  });
}

// ---------------------------------------------------------------------------
// 图片读取与归一化 —— 统一转成 { dataUri, mimeType, base64, bytes }
// ---------------------------------------------------------------------------

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

/** 从字节流嗅探 MIME（覆盖常见格式），拿不准回退到扩展名/png。 */
function sniffMime(buf, fallbackExt) {
  if (buf.length >= 8) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
    if (buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
    // WEBP: "RIFF"...."WEBP"
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return "image/webp";
    }
  }
  return MIME_BY_EXT[(fallbackExt || "").toLowerCase()] || "image/png";
}

/**
 * 把用户给的一个 image 输入归一化。支持三种形态：
 *  - 本地文件路径：读文件 → base64
 *  - data URI：直接拆解
 *  - http(s) URL：保持为 URL（交给视觉模型去拉，省流量；base64 仅用于本地图）
 */
async function normalizeImage(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("image 参数必须是非空字符串（文件路径 / URL / data URI）");
  }
  const value = input.trim();

  // data URI
  const dataUriMatch = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (dataUriMatch) {
    const mimeType = dataUriMatch[1] || "image/png";
    const isBase64 = Boolean(dataUriMatch[2]);
    const raw = dataUriMatch[3] || "";
    const buf = isBase64 ? Buffer.from(raw, "base64") : Buffer.from(decodeURIComponent(raw), "utf8");
    return { kind: "data", mimeType, base64: buf.toString("base64"), bytes: buf.length, dataUri: value, url: value };
  }

  // 远程 URL —— 保持为 URL 交给视觉模型（不下载，除非协议要求 base64）
  if (/^https?:\/\//i.test(value)) {
    return { kind: "url", mimeType: null, base64: null, bytes: 0, dataUri: null, url: value };
  }

  // 本地文件路径
  const filePath = path.resolve(value);
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到图片文件：${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`不是文件：${filePath}`);
  }
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `图片过大：${(stat.size / 1024 / 1024).toFixed(1)}MB，超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 限制`,
    );
  }
  const buf = fs.readFileSync(filePath);
  const mimeType = sniffMime(buf, path.extname(filePath));
  const base64 = buf.toString("base64");
  return {
    kind: "file",
    mimeType,
    base64,
    bytes: buf.length,
    dataUri: `data:${mimeType};base64,${base64}`,
    url: `data:${mimeType};base64,${base64}`,
  };
}

const SHRINK_MIN_BYTES = 200 * 1024;
const SHRINK_EDGE = 1280;

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (c) => { err += c; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `${cmd} exit ${code}`));
    });
  });
}

/** 大图压成 JPEG 再上传。macOS 用自带 sips，别的平台原样发送。 */
async function shrinkIfNeeded(img) {
  if (!img?.base64 || (img.bytes || 0) < SHRINK_MIN_BYTES) return img;
  if (process.platform !== "darwin") return img;
  const raw = Buffer.from(img.base64, "base64");
  const inFile = path.join(os.tmpdir(), `vt-${process.pid}-${Date.now()}`);
  const outFile = `${inFile}.jpg`;
  fs.writeFileSync(inFile, raw);
  try {
    await runCmd("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", String(SHRINK_EDGE), inFile, "--out", outFile]);
    const out = fs.readFileSync(outFile);
    if (out.length >= raw.length * 0.9) return img;
    const base64 = out.toString("base64");
    log(`图片压缩 ${raw.length} → ${out.length} bytes`);
    return {
      ...img,
      mimeType: "image/jpeg",
      base64,
      bytes: out.length,
      dataUri: `data:image/jpeg;base64,${base64}`,
      url: `data:image/jpeg;base64,${base64}`,
    };
  } catch (e) {
    log(`图片压缩跳过：${e instanceof Error ? e.message : String(e)}`);
    return img;
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Prompt 构造 —— focus hint 机制（把「为什么要看这张图」传给视觉模型）
// ---------------------------------------------------------------------------

function buildVisionPrompt(question) {
  const q = (question || "").trim();
  if (CONFIG.lang === "en") {
    return q
      ? `Answer using only what is needed: ${q}`
      : "Briefly describe the image: key text, layout, notable UI. Short sentences.";
  }
  return q
    ? `只回答相关内容：${q}`
    : "简要描述图片：关键文字、布局、明显 UI。短句即可。";
}

// ---------------------------------------------------------------------------
// 多协议适配层 —— 不同视觉模型请求/响应格式不同
// ---------------------------------------------------------------------------

const ADAPTERS = {
  // OpenAI Chat Completions 兼容（Groq / Gemini OpenAI 端点 / OpenRouter / GPT-4o）
  openai: {
    endpoint: (base) => `${base}/chat/completions`,
    headers: () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    }),
    buildBody: (images, prompt) => ({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img) => ({ type: "image_url", image_url: { url: img.url } })),
          ],
        },
      ],
    }),
    parseText: (json) => json?.choices?.[0]?.message?.content ?? "",
  },

  // Anthropic Messages（Claude 系）—— 图片必须 base64 + 显式 media_type
  anthropic: {
    endpoint: (base) => `${base}/v1/messages`,
    headers: () => ({
      "Content-Type": "application/json",
      "x-api-key": CONFIG.apiKey,
      "anthropic-version": "2023-06-01",
    }),
    buildBody: (images, prompt) => ({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img) => {
              if (!img.base64) {
                throw new Error("Anthropic 协议需要图片的 base64，请传本地文件或 data URI，而非远程 URL");
              }
              return {
                type: "image",
                source: { type: "base64", media_type: img.mimeType || "image/png", data: img.base64 },
              };
            }),
          ],
        },
      ],
    }),
    parseText: (json) =>
      (json?.content ?? [])
        .filter((b) => b?.type === "text")
        .map((b) => b.text)
        .join("\n"),
  },

  // DashScope 原生（Qwen-VL 阿里云原生端点）
  dashscope: {
    endpoint: (base) => `${base}/services/aigc/multimodal-generation/generation`,
    headers: () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    }),
    buildBody: (images, prompt) => ({
      model: CONFIG.model,
      input: {
        messages: [
          {
            role: "user",
            content: [...images.map((img) => ({ image: img.url })), { text: prompt }],
          },
        ],
      },
    }),
    parseText: (json) =>
      json?.output?.choices?.[0]?.message?.content?.[0]?.text ?? json?.output?.text ?? "",
  },
};

function getAdapter() {
  return ADAPTERS[CONFIG.protocol] || ADAPTERS.openai;
}

// ---------------------------------------------------------------------------
// 调用云端视觉模型
// ---------------------------------------------------------------------------

async function describeImages(images, question) {
  if (!CONFIG.apiKey) {
    throw new Error(
      "未配置视觉模型 API Key。请在该 tweak 的 MCP 配置（~/.codex/config.toml 的 [mcp_servers.*] env）里设置 VISION_API_KEY。",
    );
  }
  const adapter = getAdapter();
  const prompt = buildVisionPrompt(question);
  const body = adapter.buildBody(images, prompt);
  const url = adapter.endpoint(CONFIG.baseUrl);

  const t0 = Date.now();
  log(`调用视觉模型 ${CONFIG.model} @ ${url}（${images.length} 张图，协议 ${CONFIG.protocol}，${images.reduce((n, i) => n + (i.bytes || 0), 0)} bytes）`);

  const res = await fetch(url, { method: "POST", headers: adapter.headers(), body: JSON.stringify(body) });
  const rawText = await res.text();
  log(`HTTP ${res.status} ${Date.now() - t0}ms body=${rawText.length}`);
  if (!res.ok) {
    throw new Error(`视觉模型 HTTP ${res.status}：${rawText.slice(0, 300)}`);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`视觉模型返回非 JSON：${rawText.slice(0, 500)}`);
  }
  if (json.error) {
    throw new Error(`视觉模型报错：${JSON.stringify(json.error).slice(0, 300)}`);
  }

  const text = stripThinkBlocks(adapter.parseText(json));
  if (!text || !text.trim()) {
    throw new Error(`视觉模型未返回可用文本。原始响应：${rawText.slice(0, 500)}`);
  }
  return text.trim();
}

/**
 * 剥离推理模型（qwen3、deepseek-r 系）输出里的 <think>...</think> 推理块：
 * 这段是视觉模型的内心独白，塞给调用方的文本模型纯属浪费 token。
 * 若剥离后为空（个别模型把答案也写在 think 里），保留原文兜底。
 */
function stripThinkBlocks(text) {
  if (typeof text !== "string") return text;
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return stripped || text;
}

// ---------------------------------------------------------------------------
// 工具实现：vision_glance
// ---------------------------------------------------------------------------

async function runVisionGlance(args) {
  const rawImages = args && args.image !== undefined ? args.image : args && args.images;
  const list = Array.isArray(rawImages) ? rawImages : rawImages != null ? [rawImages] : [];
  if (list.length === 0) {
    throw new Error("必须提供 image 参数（图片文件路径 / URL / data URI，或它们的数组）");
  }
  if (list.length > MAX_IMAGES) {
    throw new Error(`一次最多处理 ${MAX_IMAGES} 张图片，收到 ${list.length} 张`);
  }

  const images = [];
  for (const item of list) {
    images.push(await shrinkIfNeeded(await normalizeImage(item)));
  }

  // 累计体积校验（针对 base64 图；远程 URL 不计入）
  const totalBytes = images.reduce((sum, img) => sum + (img.bytes || 0), 0);
  if (totalBytes > MAX_IMAGE_BYTES) {
    throw new Error(
      `图片总体积 ${(totalBytes / 1024 / 1024).toFixed(1)}MB 超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 限制`,
    );
  }

  const question = typeof args.question === "string" ? args.question : "";
  const text = await describeImages(images, question);
  return text;
}

function buildToolInstructions(enabledModels, selfPath) {
  const who = enabledModels.length
    ? `白名单模型（${enabledModels.join(" / ")}）`
    : "看不见像素的纯文本模型";
  const glanceCmd = `node --max-old-space-size=128 ${JSON.stringify(selfPath)} --glance`;
  return (
    `${who}看图必须调用 vision_glance（MCP 工具 mcp__visiontoolkit__vision_glance）。` +
    "即使用户消息里已经有 <image> 或 input_image，你也看不见像素。" +
    "不要用 view_image（只会把图再塞一遍），不要用 tesseract。" +
    "把本地绝对路径、http(s) URL 或 data URI 传给 image，question 写你想问的。" +
    (enabledModels.length ? "不在白名单里的原生多模态模型不要调用本工具。" : "") +
    `若调用返回 unsupported call，立刻用 exec_command 执行：${glanceCmd} <图片绝对路径> [问题]，把 stdout 当作看图结果。`
  );
}

const SELF_PATH = process.argv[1] || "mcp-server.mjs";
const TOOL_INSTRUCTIONS = buildToolInstructions(CONFIG.enabledModels, SELF_PATH);

const TOOLS = [
  {
    name: "vision_glance",
    description:
      TOOL_INSTRUCTIONS +
      " 看图问答、OCR、UI/截图理解、内容描述。返回文本供你继续推理。",
    inputSchema: {
      type: "object",
      properties: {
        image: {
          description:
            "图片来源：本地文件绝对路径、http(s) URL 或 data URI。也可传字符串数组一次看多张图（最多 5 张）。",
          anyOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
        },
        question: {
          type: "string",
          description:
            "（可选）你想从图片里了解什么。例如「这个报错是什么原因」「把图中的表格转成 markdown」「登录按钮在什么坐标」。不填则返回全面描述。",
        },
      },
      required: ["image"],
    },
  },
];

async function dispatchTool(name, args) {
  switch (name) {
    case "vision_glance":
      return runVisionGlance(args || {});
    default:
      throw new Error(`未知工具：${name}`);
  }
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC over stdio
// ---------------------------------------------------------------------------

// 空闲自退出：任何 stdin 消息（含 ping）都会重置计时；有视觉调用在途时顺延。
// 注意：进程退出后，宿主对该会话再调 vision_glance 会得到一次错误，需要
// 宿主重新拉起 server——这是「闲置会话不占内存」换来的代价，阈值可调。
let idleTimer = null;
let inFlightCalls = 0;

function armIdleExit() {
  const minutes = CONFIG.idleExitMinutes;
  if (!(minutes > 0)) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inFlightCalls > 0) {
      armIdleExit();
      return;
    }
    log(`空闲超过 ${minutes} 分钟，自动退出释放资源`);
    process.exit(0);
  }, minutes * 60 * 1000);
}

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  // 通知（无 id）：initialized、cancelled 等，忽略即可
  if (id === undefined || id === null) {
    return;
  }

  try {
    switch (method) {
      case "initialize":
        sendResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: { tools: {} },
          instructions: TOOL_INSTRUCTIONS,
        });
        return;

      case "ping":
        sendResult(id, {});
        return;

      case "tools/list":
        sendResult(id, { tools: TOOLS });
        return;

      case "resources/list":
        sendResult(id, { resources: [] });
        return;

      case "resources/templates/list":
        sendResult(id, { resourceTemplates: [] });
        return;

      case "prompts/list":
        sendResult(id, { prompts: [] });
        return;

      case "tools/call": {
        const toolName = params && params.name;
        const toolArgs = (params && params.arguments) || {};

        // DEBUG：dump 完整 params，看 Codex 是否传了模型信息
        log(`[DEBUG] tools/call params: ${JSON.stringify(params).slice(0, 500)}`);

        // 提取模型名（尝试几种可能的字段）
        const callerModel = params?._meta?.model || params?._model || params?.model || toolArgs?._model || "";

        // 白名单检查（如果配置了 VISION_ENABLED_MODELS）
        if (CONFIG.enabledModels.length > 0) {
          if (!callerModel) {
            log(`警告：未检测到调用模型信息，无法验证白名单。建议在工具描述里说明适用范围。`);
          } else if (!isModelEnabled(callerModel)) {
            const errMsg = `此工具仅供纯文本模型使用（已配置白名单：${CONFIG.enabledModels.join(", ")}）。当前模型「${callerModel}」原生支持视觉，请直接处理图片，勿调用此工具。`;
            log(`拒绝调用：${errMsg}`);
            sendResult(id, {
              content: [{ type: "text", text: errMsg }],
              isError: true,
            });
            return;
          } else {
            log(`白名单验证通过：${callerModel}`);
          }
        }

        inFlightCalls += 1;
        try {
          const text = await dispatchTool(toolName, toolArgs);
          sendResult(id, {
            content: [{ type: "text", text }],
            isError: false,
          });
        } catch (toolErr) {
          // 工具级错误：按 MCP 约定用 isError 返回，让模型能看到并自行处理
          const message = toolErr && toolErr.message ? toolErr.message : String(toolErr);
          log(`工具执行出错：${message}`);
          sendResult(id, {
            content: [{ type: "text", text: `视觉工具执行失败：${message}` }],
            isError: true,
          });
        } finally {
          inFlightCalls -= 1;
          armIdleExit();
        }
        return;
      }

      default:
        // 未实现的方法
        sendError(id, -32601, `Method not found: ${method}`);
        return;
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    sendError(id, -32603, `Internal error: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 按行读取 stdin，逐条解析 JSON-RPC 消息
// ---------------------------------------------------------------------------

function main() {
  log(`启动：model=${CONFIG.model} protocol=${CONFIG.protocol} baseUrl=${CONFIG.baseUrl} key=${CONFIG.apiKey ? "已配置" : "未配置"}`);

  armIdleExit();

  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    armIdleExit();
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        log(`收到无法解析的行：${line.slice(0, 200)}`);
        continue;
      }
      // 不 await：允许并发处理多个请求
      handleMessage(msg).catch((err) => {
        log(`handleMessage 异常：${err && err.message ? err.message : String(err)}`);
      });
    }
  });
  process.stdin.on("end", () => {
    log("stdin 关闭，退出");
    process.exit(0);
  });
}

const PING_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function ping() {
  if (!CONFIG.apiKey) {
    throw new Error(CONFIG.lang === "en" ? "API key is not set" : "未配置 API Key");
  }
  const images = [await normalizeImage(PING_PIXEL)];
  const question = CONFIG.lang === "en" ? "Reply with the single word ok." : "只回复一个词：ok";
  const text = await describeImages(images, question);
  process.stdout.write(JSON.stringify({ ok: true, model: CONFIG.model, text: text.slice(0, 240) }) + "\n");
}

if (process.argv.includes("--self-check")) {
  const c = resolveConfig(
    { VISION_MODEL: "from-env", VISION_API_KEY: "YOUR_VISION_API_KEY", VISION_BASE_URL: "https://env.example" },
    { apiKey: "overlay-key", model: "", baseUrl: "https://overlay.example/" },
  );
  if (c.apiKey !== "overlay-key") throw new Error("overlay apiKey 应覆盖占位 env");
  if (c.model !== "from-env") throw new Error("空 overlay 应回退 env");
  if (c.baseUrl !== "https://overlay.example") throw new Error("overlay baseUrl 应去掉尾斜杠");
  const d = resolveConfig({ VISION_API_KEY: "YOUR_VISION_API_KEY" }, {});
  if (d.apiKey !== "") throw new Error("占位 key 应视为未配置");
  const ins = buildToolInstructions(["foo", "bar-*"], "/tmp/mcp-server.mjs");
  if (!ins.includes("foo / bar-*")) throw new Error("说明应带上当前白名单");
  if (!ins.includes("--glance")) throw new Error("说明应带上 --glance 回退");
  if (buildToolInstructions([], "/tmp/x").includes("白名单模型（")) throw new Error("空白名单不应列出具体模型");
  process.stderr.write("self-check ok\n");
  process.exit(0);
}

async function glance(image, question) {
  if (!CONFIG.apiKey) throw new Error("未配置 API Key");
  const images = [await shrinkIfNeeded(await normalizeImage(image))];
  return describeImages(images, question || "");
}

if (process.argv.includes("--ping")) {
  ping().then(() => process.exit(0)).catch((e) => {
    const error = e instanceof Error ? e.message : String(e);
    process.stdout.write(JSON.stringify({ ok: false, error: error.slice(0, 300) }) + "\n");
    process.exit(1);
  });
} else if (process.argv.includes("--glance")) {
  const rest = process.argv.slice(process.argv.indexOf("--glance") + 1);
  const image = rest[0];
  const question = rest.slice(1).join(" ");
  if (!image) {
    process.stderr.write("usage: mcp-server.mjs --glance <image> [question]\n");
    process.exit(2);
  }
  glance(image, question).then((text) => {
    process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
    process.exit(0);
  }).catch((e) => {
    const error = e instanceof Error ? e.message : String(e);
    process.stderr.write(error + "\n");
    process.exit(1);
  });
} else {
  main();
}
