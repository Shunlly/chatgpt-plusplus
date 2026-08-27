# vision-toolkit

为 **Codex** 里的纯文本模型接入云端视觉能力。模型在对话中主动调用 `vision_glance` 工具,本插件把图片+意图转发给云端多模态模型(默认 Groq 上的 `qwen/qwen3.6-27b`),把识别结果作为工具输出返回给模型——让 DeepSeek 之类的纯文本模型也能"看图"。

## 工作原理

1. **MCP 工具注入** — 本 tweak 在 `manifest.json` 声明了一个 MCP server,codex-plusplus 启动时自动同步到 `~/.codex/config.toml` 的 `[mcp_servers.com-chatgpt-plusplus-vision-toolkit]` 块。
2. **Codex 加载工具** — Codex 桌面端启动时读取 config.toml,把 `vision_glance` 工具暴露给模型。
3. **模型主动调用** — 对话中模型遇到图片意图(用户发图、问"这是什么")时,自动调用 `vision_glance(image, question)`。
4. **云端视觉推理** — MCP server 收到调用,把图片(本地文件路径 / data URI / URL)+ 用户问题转给 Groq 的多模态模型,返回文本描述。
5. **模型继续推理** — 描述文本作为工具输出返给模型,模型基于描述继续回答。

## 快速开始

### 1. 启用 tweak

在 codex-plusplus 管理界面启用 **视觉工具箱**,或者:

```bash
# 手动同步 MCP 配置
cd /path/to/codex-plusplus
npm run build
```

启用后 `~/.codex/config.toml` 会出现:

```toml
[mcp_servers.com-chatgpt-plusplus-vision-toolkit]
command = "node"
args = ["/path/to/codex-plusplus/tweaks/vision-toolkit/mcp-server.mjs"]
env = { VISION_BASE_URL = "https://api.groq.com/openai/v1", VISION_MODEL = "qwen/qwen3.6-27b", ... }
```

### 2. 重启 Codex

关闭并重新打开 **ChatGPT++(Codex)** 桌面应用,让 MCP 配置生效。

### 3. 试用

对话中发送图片 + 提问:

> 用户: [上传截图] 这张图里有什么?主色调是什么?
>
> 模型: *[自动调用 vision_glance]* 这是一个蓝黄配色的 UI 布局,主色调是蓝色和黄色,有白色文字"HELLO"...

## 配置

优先在 ChatGPT++ 侧边栏打开 **视觉工具箱** 填写 API Key。保存后写入本机 `tweak-data/config.json`（升级不覆盖），重启后 MCP 会读到新配置。

仍可通过 `manifest.json` 的 `mcp.env` 作为默认值（同步到 `~/.codex/config.toml`）。设置页覆盖优先于环境变量：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `VISION_BASE_URL` | `https://api.groq.com/openai/v1` | 视觉模型 API 端点 |
| `VISION_MODEL` | `qwen/qwen3.6-27b` | 模型名(Groq 上的多模态模型) |
| `VISION_API_KEY` | *(内置)* | API key,**有时效性**,过期需更新 |
| `VISION_PROTOCOL` | `openai` | 协议格式: `openai` / `anthropic` / `dashscope` |
| `VISION_LANG` | `zh` | 描述语言: `zh`(中文) / `en`(英文) |
| `VISION_MAX_TOKENS` | `1024` | 单次描述最大 token 数 |
| `VISION_IDLE_EXIT_MINUTES` | `30` | 空闲自退出阈值(分钟)；0 禁用 |
| `VISION_ENABLED_MODELS` | *(见下)* | **白名单**：哪些模型可用此工具(逗号分隔,支持通配符) |

**资源保护**：MCP server 启动参数 `--max-old-space-size=128` 限制单进程最大堆内存 128MB，配合空闲自退出(默认 30 分钟无调用自动释放)防止多会话长期开启时内存线性堆积。

### 模型白名单 (重要)

`VISION_ENABLED_MODELS` 控制**哪些模型可以调用 `vision_glance` 工具**。

**为什么需要白名单？**
- 原生多模态模型(GPT-4V / Claude 3.5 / Gemini)本身能直接处理图片,不需要此工具
- 如果它们错误调用,会浪费一层转发、增加延迟、可能描述质量不如原生
- 白名单确保**只有纯文本模型**(如 DeepSeek)才会用这个工具

**默认白名单**(与模型目录里 `input_modalities` 仅含 text 的模型对齐):
```
deepseek-v4-flash,deepseek-v4-pro,glm-5.2,glm-5.3,qwen3.7-max
```

> 注意:白名单里的名字必须和你模型目录(如 `sub2api-model-catalog.json`)里的
> **slug 一致**。原生带视觉的模型(如 `deepseek-v4-flash-vision-exp`、gpt/gemini/grok 系)
> 不要加进来。

**自定义白名单:**

修改 `manifest.json`:
```json
{
  "mcp": {
    "env": {
      "VISION_ENABLED_MODELS": "deepseek-*,glm-5.*,my-custom-model"
    }
  }
}
```

支持通配符:
- `deepseek-*` → 匹配 `deepseek-v4-flash` / `deepseek-v4-pro` 等
- `qwen3.7-max` → 精确匹配

**留空 = 全部允许**(不推荐,除非你确定所有模型都需要):
```json
"VISION_ENABLED_MODELS": ""
```

**运行时行为:**
- 白名单内的模型调用 → 正常执行
- 白名单外的模型调用 → 返回错误:"此模型原生支持视觉,请直接处理图片"
- 如果 Codex 调用时**没传模型信息**(标准 MCP 协议不强制传),会打印警告但仍执行(此时靠工具描述引导模型不调用)

修改后需重新构建 + 重启 Codex:
```bash
npm run build
# 关闭并重开 ChatGPT++ 桌面端
```

### 更换模型

修改 `manifest.json` 的 `mcp.env`:

```json
{
  "VISION_BASE_URL": "https://api.openai.com/v1",
  "VISION_MODEL": "gpt-4o",
  "VISION_PROTOCOL": "openai",
  "VISION_API_KEY": "sk-..."
}
```

支持的协议:
- **OpenAI** — GPT-4V / Groq / Gemini(OpenRouter) / OpenRouter 通用
- **Anthropic** — Claude 3.5 Sonnet(需 base64,不支持 URL)
- **DashScope** — 阿里云 Qwen-VL 原生端点

### 更新 API Key

**当前 key 有时效性**,过期后:

1. 打开 `tweaks/vision-toolkit/manifest.json`
2. 修改 `mcp.env.VISION_API_KEY`
3. 重新构建 + 重启 Codex:
   ```bash
   npm run build
   # 关闭并重开 ChatGPT++ 桌面端
   ```

## 工具说明

### `vision_glance`

**描述图片内容、回答视觉问题。**

**参数:**

- `image` *(string | array, 必需)* — 图片来源,支持:
  - **本地文件路径** — `/Users/.../screenshot.png`(绝对/相对路径,自动读取+base64 编码)
  - **data URI** — `data:image/png;base64,...`(已编码的图片)
  - **远程 URL** — `https://...` *(部分服务商支持,Groq 需注意防爬)*
  - **数组** — `["/path/a.png", "data:image/...", ...]` 一次传多张(最多 5 张,总计 ≤20MB)

- `question` *(string, 可选)* — 用户的具体问题或意图,例如:
  - `"这张图里有什么?主色调是什么?"`
  - `"识别图中的文字"`
  - `"这是什么动物?"`
  
  如不提供,模型会做通用描述。提供 question 会让视觉模型的描述更聚焦、更准确(focus hint 模式)。

**返回:** 文本描述(中文或英文,取决于 `VISION_LANG`)。

**限制:**
- 单张图片 ≤ 20MB(Groq 限制)
- 单次最多 5 张图
- 支持格式: PNG / JPEG / GIF / WEBP / BMP

## 技术细节

- **零第三方依赖** — 仅用 Node 内置模块(`fs`, `path`, `child_process`),通过 `curl` 子进程发送 HTTPS 请求(绕过 Node fetch 的 TLS 指纹检测)。
- **多协议适配** — 内置 OpenAI / Anthropic / DashScope 三种协议的请求/响应转换层,兼容不同服务商的图片字段格式。
- **Focus hint** — 借鉴 [agent-vision-toolkit](https://github.com/modelcontextprotocol/agent-vision-toolkit) 设计,把用户问题作为 system prompt 传给视觉模型,让描述更贴合任务。
- **MCP 2024-11-05** — 遵循 Model Context Protocol 规范,JSON-RPC 2.0 over stdio。

## 故障排查

### 1. 工具未出现在模型可用工具列表

- 检查 `~/.codex/config.toml` 是否有 `[mcp_servers.com-chatgpt-plusplus-vision-toolkit]` 块
- 确认 Codex 已重启
- 查看 Codex 日志(`~/Library/Logs/ChatGPT++/main.log`)是否有 MCP 加载错误

### 2. 调用失败: "未配置 API Key"

- 打开 `manifest.json`,检查 `mcp.env.VISION_API_KEY` 是否填写
- Key 可能已过期,联系管理员更新

### 3. 调用失败: "403 Forbidden"(远程 URL)

- Groq 拉取部分图片 URL 时会被对方防爬拦截
- **解决:** 改用本地文件路径或 data URI(用户上传的截图会自动走此路径,无此问题)

### 4. 描述不准确

- 尝试在 `question` 参数里加更具体的提示,例如 `"识别图中所有文字"` 而非 `"看图"`
- 考虑更换更强的视觉模型(如 `gpt-4o` / `claude-3-5-sonnet-20241022`)

## 许可

本 tweak 遵循 codex-plusplus 项目的许可证。视觉推理由第三方 API 提供(Groq / OpenAI / Anthropic 等),使用需遵守各服务商条款。

---

**注意:** 当前内置的 Groq API key 有时效性,过期后需手动更新 `manifest.json`。后续版本会支持通过设置页面配置 key。
