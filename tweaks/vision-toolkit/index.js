/**
 * 视觉工具箱：插件卡片上的「配置」按钮。MCP 实际能力在 mcp-server.mjs。
 * 用户配置写到 tweak-data/config.json（升级不覆盖），不改随包 manifest。
 */
"use strict";

const DEFAULTS = {
  apiKey: "YOUR_VISION_API_KEY",
  baseUrl: "https://api.groq.com/openai/v1",
  model: "qwen/qwen3.6-27b",
  protocol: "openai",
  lang: "zh",
  maxTokens: "1024",
  enabledModels: "deepseek-v4-flash,deepseek-v4-pro,glm-5.2,glm-5.3,qwen3.7-max",
  idleExitMinutes: "30",
};

const STORAGE_KEYS = {
  apiKey: "vision_api_key",
  baseUrl: "vision_base_url",
  model: "vision_model",
  protocol: "vision_protocol",
  lang: "vision_lang",
  maxTokens: "vision_max_tokens",
  enabledModels: "vision_enabled_models",
  idleExitMinutes: "vision_idle_exit_minutes",
};

const BTN =
  "border-token-border user-select-none no-drag cursor-interaction inline-flex h-8 items-center whitespace-nowrap rounded-lg border px-2 text-sm text-token-text-primary enabled:hover:bg-token-list-hover-background disabled:cursor-not-allowed disabled:opacity-40";
const INP =
  "h-8 w-full rounded-lg border border-token-border bg-transparent px-2 font-mono text-sm text-token-text-primary focus:outline-none";
const LAB = "mb-1 block text-sm text-token-text-primary";
const HINT = "mt-1 text-xs text-token-text-secondary";

const I18N = {
  zh: {
    title: "视觉模型配置",
    description: "API Key、接口地址、模型与白名单。保存后重启 ChatGPT 生效。",
    configure: "配置",
    collapse: "收起",
    apiKey: "API Key",
    apiKeyPh: "视觉模型 API Key",
    groqHint: "Groq 密钥：",
    baseUrl: "接口地址",
    model: "模型",
    protocol: "协议",
    descLang: "描述语言",
    advanced: "高级",
    whitelist: "模型白名单",
    whitelistHint: "只有这些模型会调用 vision_glance，逗号分隔",
    maxTokens: "最大 Tokens",
    idleExit: "空闲退出（分钟）",
    save: "保存",
    test: "测试连接",
    testing: "测试中…",
    reset: "重置",
    hint: "保存后重启 ChatGPT 生效。Key 存在本机，升级不覆盖。",
    needKey: "请输入有效的 API Key",
    needUrl: "接口地址和模型不能为空",
    saved: "已保存。请重启 ChatGPT 使 MCP 生效。",
    saveFail: "保存失败",
    testingHint: "正在用当前表单请求视觉模型…",
    ok: "连通",
    fail: "失败",
    unknown: "未知错误",
    resetConfirm: "确定重置为默认配置？",
    resetHint: "已填入默认值，点「保存」生效",
    timeout: "超时（25s）",
    noOutput: "无输出",
  },
  en: {
    title: "Vision model",
    description: "API key, endpoint, model, and allowlist. Restart ChatGPT after save.",
    configure: "Configure",
    collapse: "Close",
    apiKey: "API Key",
    apiKeyPh: "Vision model API key",
    groqHint: "Groq key: ",
    baseUrl: "Base URL",
    model: "Model",
    protocol: "Protocol",
    descLang: "Reply language",
    advanced: "Advanced",
    whitelist: "Model allowlist",
    whitelistHint: "Only these models may call vision_glance (comma-separated)",
    maxTokens: "Max tokens",
    idleExit: "Idle exit (minutes)",
    save: "Save",
    test: "Test",
    testing: "Testing…",
    reset: "Reset",
    hint: "Restart ChatGPT after save. The key stays on this machine.",
    needKey: "Enter a valid API key",
    needUrl: "Base URL and model are required",
    saved: "Saved. Restart ChatGPT for MCP to pick this up.",
    saveFail: "Save failed",
    testingHint: "Calling the vision model with the current form…",
    ok: "Connected",
    fail: "Failed",
    unknown: "Unknown error",
    resetConfirm: "Reset to defaults?",
    resetHint: "Defaults filled in. Click Save to apply.",
    timeout: "Timed out (25s)",
    noOutput: "No output",
  },
};

function detectLang() {
  try {
    if (typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "")) return "zh";
  } catch {
    // main 进程没有 navigator
  }
  return "en";
}

function pack(lang) {
  return I18N[lang === "en" ? "en" : "zh"];
}

module.exports = {
  async start(api) {
    if (api.process === "main") {
      try {
        api.ipc.handle("test-connection", (cfg) => runPing(cfg));
      } catch {
        // 热重载时 channel 可能已注册
      }
      return;
    }
    api.log.info("视觉工具箱 tweak 已启动");
    if (!api.settings) return;
    const ui = pack(detectLang());
    api.settings.register({
      id: "vision-config",
      title: ui.title,
      description: ui.description,
      render: (root) => renderVisionConfigButton(api, root),
    });
  },
  stop() {},
};

async function loadConfig(api) {
  const cfg = { ...DEFAULTS, lang: detectLang() };
  for (const [k, sk] of Object.entries(STORAGE_KEYS)) {
    const v = api.storage.get(sk);
    if (v != null && String(v).trim() !== "") cfg[k] = String(v);
  }
  try {
    Object.assign(cfg, JSON.parse(await api.fs.read("config.json")));
  } catch {
    // 首次使用或尚未保存过
  }
  if (cfg.lang !== "en" && cfg.lang !== "zh") cfg.lang = detectLang();
  return cfg;
}

function applyI18n(root, lang, extra) {
  const t = pack(lang);
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (key && t[key]) node.textContent = t[key];
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (key && t[key]) node.setAttribute("placeholder", t[key]);
  });
  extra?.(t);
}

function renderVisionConfigButton(api, root) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN;
  const panel = document.createElement("div");
  panel.hidden = true;
  panel.className = "mt-3";
  const setBtn = (open, lang) => {
    btn.textContent = pack(lang)[open ? "collapse" : "configure"];
  };
  setBtn(false, detectLang());
  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    const lang = panel.querySelector("#vision-lang")?.value || detectLang();
    setBtn(open, lang);
    if (open && !panel.dataset.ready) {
      renderVisionConfig(api, panel, (next) => setBtn(true, next));
      panel.dataset.ready = "1";
    }
  });
  root.append(btn, panel);
}

function renderVisionConfig(api, root, onLang) {
  void (async () => {
    const config = await loadConfig(api);
    root.innerHTML = `
      <div class="flex flex-col gap-3">
        <div>
          <label class="${LAB}" for="vision-api-key" data-i18n="apiKey"></label>
          <input id="vision-api-key" type="password" class="${INP}" data-i18n-placeholder="apiKeyPh">
          <p class="${HINT}"><span data-i18n="groqHint"></span><a class="text-token-text-link-foreground hover:underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a></p>
        </div>
        <div>
          <label class="${LAB}" for="vision-base-url" data-i18n="baseUrl"></label>
          <input id="vision-base-url" type="text" class="${INP}">
        </div>
        <div>
          <label class="${LAB}" for="vision-model" data-i18n="model"></label>
          <input id="vision-model" type="text" class="${INP}" placeholder="qwen/qwen3.6-27b">
        </div>
        <div class="flex gap-3">
          <div class="min-w-0 flex-1">
            <label class="${LAB}" for="vision-protocol" data-i18n="protocol"></label>
            <select id="vision-protocol" class="${INP}">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="dashscope">DashScope</option>
            </select>
          </div>
          <div class="min-w-0 flex-1">
            <label class="${LAB}" for="vision-lang" data-i18n="descLang"></label>
            <select id="vision-lang" class="${INP}">
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <details class="text-sm">
          <summary class="cursor-pointer select-none text-token-text-secondary" data-i18n="advanced"></summary>
          <div class="mt-3 flex flex-col gap-3">
            <div>
              <label class="${LAB}" for="vision-enabled-models" data-i18n="whitelist"></label>
              <textarea id="vision-enabled-models" rows="2" class="min-h-[3.5rem] w-full rounded-lg border border-token-border bg-transparent px-2 py-1.5 font-mono text-sm text-token-text-primary focus:outline-none"></textarea>
              <p class="${HINT}" data-i18n="whitelistHint"></p>
            </div>
            <div class="flex gap-3">
              <div class="min-w-0 flex-1">
                <label class="${LAB}" for="vision-max-tokens" data-i18n="maxTokens"></label>
                <input id="vision-max-tokens" type="number" min="1" class="${INP}">
              </div>
              <div class="min-w-0 flex-1">
                <label class="${LAB}" for="vision-idle-exit" data-i18n="idleExit"></label>
                <input id="vision-idle-exit" type="number" min="5" max="120" class="${INP}">
              </div>
            </div>
          </div>
        </details>
        <div class="flex items-center gap-2">
          <button id="vision-save-btn" type="button" class="${BTN}" data-i18n="save"></button>
          <button id="vision-test-btn" type="button" class="${BTN}" data-i18n="test"></button>
          <button id="vision-reset-btn" type="button" class="${BTN}" data-i18n="reset"></button>
        </div>
        <p id="vision-status" class="text-xs text-token-text-secondary" hidden></p>
        <p class="${HINT}" data-i18n="hint"></p>
      </div>`;

    const el = (id) => root.querySelector(id);
    const formLang = () => (el("#vision-lang").value === "en" ? "en" : "zh");
    const t = () => pack(formLang());

    applyI18n(root, config.lang === "en" ? "en" : "zh");
    onLang?.(config.lang === "en" ? "en" : "zh");

    el("#vision-api-key").value = config.apiKey ?? "";
    el("#vision-base-url").value = config.baseUrl ?? "";
    el("#vision-model").value = config.model ?? "";
    el("#vision-protocol").value = config.protocol ?? "openai";
    el("#vision-lang").value = config.lang === "en" ? "en" : "zh";
    el("#vision-max-tokens").value = config.maxTokens ?? "1024";
    el("#vision-enabled-models").value = config.enabledModels ?? "";
    el("#vision-idle-exit").value = config.idleExitMinutes ?? "30";

    el("#vision-lang").addEventListener("change", () => {
      const lang = formLang();
      applyI18n(root, lang);
      onLang?.(lang);
    });

    const status = el("#vision-status");
    const showStatus = (message, isError = false) => {
      status.hidden = false;
      status.textContent = message;
      status.className = isError ? "text-xs text-token-charts-red" : "text-xs text-token-text-secondary";
    };

    const readForm = () => ({
      apiKey: el("#vision-api-key").value.trim(),
      baseUrl: el("#vision-base-url").value.trim(),
      model: el("#vision-model").value.trim(),
      protocol: el("#vision-protocol").value,
      lang: formLang(),
      maxTokens: el("#vision-max-tokens").value,
      enabledModels: el("#vision-enabled-models").value.trim(),
      idleExitMinutes: el("#vision-idle-exit").value,
    });

    el("#vision-save-btn").addEventListener("click", async () => {
      const copy = t();
      try {
        const newConfig = readForm();
        if (!newConfig.apiKey || newConfig.apiKey === "YOUR_VISION_API_KEY") {
          showStatus(copy.needKey, true);
          return;
        }
        if (!newConfig.baseUrl || !newConfig.model) {
          showStatus(copy.needUrl, true);
          return;
        }
        for (const [k, sk] of Object.entries(STORAGE_KEYS)) {
          api.storage.set(sk, newConfig[k]);
        }
        await api.fs.write("config.json", JSON.stringify(newConfig, null, 2));
        showStatus(copy.saved);
        api.log.info("视觉工具箱配置已写入 tweak-data/config.json");
      } catch (error) {
        showStatus(`${copy.saveFail}: ${error.message}`, true);
        api.log.error("保存配置失败:", error);
      }
    });

    el("#vision-test-btn").addEventListener("click", async () => {
      const copy = t();
      const cfg = readForm();
      if (!cfg.apiKey || cfg.apiKey === "YOUR_VISION_API_KEY") {
        showStatus(copy.needKey, true);
        return;
      }
      if (!cfg.baseUrl || !cfg.model) {
        showStatus(copy.needUrl, true);
        return;
      }
      const btn = el("#vision-test-btn");
      btn.disabled = true;
      btn.textContent = copy.testing;
      showStatus(copy.testingHint);
      try {
        const result = await api.ipc.invoke("test-connection", cfg);
        if (result && result.ok) {
          showStatus(`${copy.ok} (${result.model || cfg.model}): ${result.text || "ok"}`);
        } else {
          showStatus(`${copy.fail}：${(result && result.error) || copy.unknown}`, true);
        }
      } catch (error) {
        showStatus(`${copy.fail}：${error.message}`, true);
      } finally {
        btn.disabled = false;
        btn.textContent = t().test;
      }
    });

    el("#vision-reset-btn").addEventListener("click", () => {
      if (!confirm(t().resetConfirm)) return;
      el("#vision-api-key").value = DEFAULTS.apiKey;
      el("#vision-base-url").value = DEFAULTS.baseUrl;
      el("#vision-model").value = DEFAULTS.model;
      el("#vision-protocol").value = DEFAULTS.protocol;
      el("#vision-lang").value = detectLang();
      el("#vision-max-tokens").value = DEFAULTS.maxTokens;
      el("#vision-enabled-models").value = DEFAULTS.enabledModels;
      el("#vision-idle-exit").value = DEFAULTS.idleExitMinutes;
      applyI18n(root, formLang());
      onLang?.(formLang());
      showStatus(t().resetHint);
    });
  })();
}

function runPing(cfg) {
  const { spawn } = require("node:child_process");
  const { join } = require("node:path");
  const en = String(cfg?.lang || "").toLowerCase() === "en";
  const script = join(__dirname, "mcp-server.mjs");
  const env = {
    ...process.env,
    VISION_API_KEY: String(cfg?.apiKey || ""),
    VISION_BASE_URL: String(cfg?.baseUrl || ""),
    VISION_MODEL: String(cfg?.model || ""),
    VISION_PROTOCOL: String(cfg?.protocol || "openai"),
    VISION_LANG: en ? "en" : "zh",
    VISION_MAX_TOKENS: "64",
  };
  return new Promise((resolve) => {
    const child = spawn("node", ["--max-old-space-size=128", script, "--ping"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: pack(en ? "en" : "zh").timeout });
    }, 25000);
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { err += c; });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    });
    child.on("close", () => {
      clearTimeout(timer);
      const line = out.trim().split("\n").filter(Boolean).pop() || "";
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ ok: false, error: (line || err || pack(en ? "en" : "zh").noOutput).slice(0, 300) });
      }
    });
  });
}
