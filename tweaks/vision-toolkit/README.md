# 视觉工具箱

让 Codex 里的**纯文本模型**也能看图。模型调用 MCP 工具 `vision_glance`，插件把图片发到你配置的多模态接口，把文字结果交回当前模型。

## 使用（ChatGPT++ 用户）

1. 打开侧边栏 **插件**，启用 **视觉工具箱**。
2. 点卡片上的 **配置**（不要去改 `manifest.json` 里的 Key）。
3. 填写 API Key / 接口地址 / 模型，点 **测试连接**，再 **保存**。
4. **完全退出并重新打开 ChatGPT++**。Force Reload 不会重拉 MCP 进程。
5. 选白名单里的模型（默认：`deepseek-v4-flash`、`deepseek-v4-pro`、`glm-5.2`、`glm-5.3`、`qwen3.7-max`），发图提问。

配置写在本机：

```text
~/Library/Application Support/chatgpt-plusplus/tweak-data/com.chatgpt-plusplus.vision-toolkit/config.json
```

升级 ChatGPT++ 不会覆盖这份文件。

MCP 服务名必须是字母数字：`visiontoolkit`。名字里带 `-` 时，Codex 会报 `unknown MCP server 'com.chatgpt.plusplus.vision.toolkit'`。

## 白名单

`VISION_ENABLED_MODELS` 只放**看不见图的纯文本模型**。

- 名单内：必须调 `vision_glance`。
- 名单外：原生多模态 / 全模态，图直接给模型（`input_image` / `view_image`），不要加进来。
- 改白名单后同样要重启 ChatGPT++。

## 默认接口

表单默认 Groq OpenAI 兼容：

| 项 | 默认 |
|---|---|
| Base URL | `https://api.groq.com/openai/v1` |
| Model | `qwen/qwen3.6-27b` |
| Protocol | `openai` |

也支持 Anthropic、DashScope。Key 过期就在卡片里改，不要把密钥提交到 git。

## 开发者

`manifest.json` 的 `mcp.env` 只是缺省值。用户配置优先。改 MCP 脚本后要退出 ChatGPT++ 再开，让它重新 spawn `mcp-server.mjs`。

CLI 自检：

```sh
node tweaks/vision-toolkit/mcp-server.mjs --ping
node tweaks/vision-toolkit/mcp-server.mjs --glance /path/to.png "图里有什么"
```
