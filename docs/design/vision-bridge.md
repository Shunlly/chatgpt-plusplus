# vision-toolkit —— 让纯文本模型「看懂」图片（最终实现记录）

> 状态：**已实现并测试通过**，实现位于 `tweaks/vision-toolkit/`。
> 本文档记录最终架构与关键决策。早期的「fetch 拦截 + 请求改写」方案已被否决（见 §5 历史方案）。

## 1. 目标

在 chatgpt-plusplus 打补丁的桌面端里，让**纯文本模型**（DeepSeek、GLM、Qwen 文本版等）
也能处理图片：模型在对话中主动调用工具，把图片交给云端视觉模型识别，拿回文字描述后继续推理。

## 2. 核心架构：MCP 工具，而非请求拦截

关键事实：这个桌面端的宿主是 **Codex**（编码 agent，具备工具调用能力），
它通过 `~/.codex/config.toml` 的 `[mcp_servers.*]` 支持标准 MCP（JSON-RPC 2.0 over stdio）。
chatgpt-plusplus 的 runtime 会把 tweak `manifest.json` 里声明的 `mcp` 字段
自动同步进 config.toml（`packages/runtime/src/mcp-sync.ts`）。

```
┌────────────────────────────────────────────────────────────┐
│ Codex 桌面端（纯文本模型对话中）                              │
│                                                            │
│  用户: "看看 /tmp/error.png 这个报错是什么原因"               │
│    │                                                       │
│    ▼                                                       │
│  模型调用 MCP 工具 vision_glance(image, question)  ─────────┼──► mcp-server.js
│    │                                              (stdio)  │    │
│    │                                                       │    ├─ 归一化图片(路径/URL/dataURI → base64)
│    │                                                       │    ├─ focus hint: question 一起发给视觉模型
│    ▼                                                       │    ▼
│  工具返回文字描述 → 模型据此继续推理                          │  云端视觉模型
└────────────────────────────────────────────────────────────┘   (Groq qwen/qwen3.6-27b)
```

## 3. 关键设计决策

| 决策 | 选择 | 原因 |
|---|---|---|
| 集成层 | MCP server（tweak 声明，runtime 同步） | 宿主是有工具调用能力的 agent，MCP 是标准通道；无需拦截任何请求 |
| 依赖 | 零第三方依赖，纯 Node 内置模块 | tweak 目录不装 node_modules |
| HTTP 传输 | **spawn `curl` 子进程**，不用 fetch/node:https | Groq 边缘 WAF 按 TLS 指纹拦截 Node 的所有请求（fetch 与 node:https 均 403），系统 curl 正常 |
| 协议适配 | openai / anthropic / dashscope 三套 adapter | 各家图片字段结构不同；`VISION_PROTOCOL` 切换 |
| focus hint | `question` 参数传给视觉模型 | 借鉴 agent-vision-toolkit：针对意图作答，更准更省 token |
| 模型白名单 | `VISION_ENABLED_MODELS`（支持 `*` 通配）+ 运行时拒绝 | 原生多模态模型不该走这层转发；从 `params._meta.model` 等字段提取调用方模型名，取不到时警告放行 |
| 输出清洗 | 剥掉 `<think>...</think>` | Groq 上的 Qwen 会输出推理块，原样返回浪费 token |
| 配置 | 全部走 `manifest.json → mcp.env` | 同步进 config.toml 的 env 表，改配置只需改 manifest |
| 入口文件 | 空壳 `index.js`（`module.exports = {}`） | discovery 要求 tweak 必须有入口文件才会被发现，进而才参与 MCP 同步 |

## 4. 已验证（2026-08）

- MCP 握手 / tools/list / tools/call 全链路（6 用例测试套件全过）
- 真实 Groq 调用：本地图片 → base64 → 返回准确描述，无 think 泄漏
- 白名单：名单内放行、名单外拒绝（带引导语）、无模型信息时警告放行
- 错误路径：缺 image 参数、缺 API key 均返回友好报错（MCP `isError` 约定）

**待真实环境确认**：Codex 调 MCP 工具时是否传调用方模型名（决定白名单是否真能拦截，
server 里有 DEBUG 日志 dump 完整 params 可查证）。

## 5. 历史方案（已否决，仅存档）

最初设计是 renderer tweak 覆写 `window.fetch`，拦下发往后端的带图请求，
把图片换成视觉模型的描述文字再放行。否决原因：

1. 桌面端会话数据走本地 app-server 的 IPC（`thread/list` 等），不是 `/backend-api/*` HTTP 接口，fetch 拦截根本打不到要害；
2. 纯文本模型的输入框本就不允许贴图，「拦截带图请求」的前提不成立；
3. 宿主本身支持 MCP，工具调用是更干净的官方通道。
