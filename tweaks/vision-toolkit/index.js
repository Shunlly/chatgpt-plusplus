// vision-toolkit 主进程入口。实际功能都在 mcp-server.js 子进程里（由 Codex 按
// ~/.codex/config.toml 的 [mcp_servers.*] 配置拉起）。discovery 要求 tweak
// 必须有入口文件才会被"发现"，进而才会参与 MCP 配置同步——这个空实现就是
// 为了过这道门槛。
"use strict";

module.exports = {
  start(api) {
    api?.log?.info?.("vision-toolkit：MCP 配置由 runtime 同步，视觉服务由 Codex 拉起 mcp-server.js");
  },
  stop() {},
};
