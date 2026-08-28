# MCP Servers

Tweaks can declare MCP servers in `manifest.json`. ChatGPT++ syncs enabled
tweak-declared servers into Codex's `~/.codex/config.toml`.

## Manifest

```json
{
  "id": "com.you.tools",
  "name": "Tools",
  "version": "0.1.0",
  "githubRepo": "you/tools",
  "scope": "main",
  "mcp": {
    "name": "tools",
    "command": "node",
    "args": ["mcp-server.js"],
    "env": {
      "TOOLS_MODE": "codex"
    }
  }
}
```

## Generated Config

ChatGPT++ writes managed entries between markers:

```toml
# BEGIN CHATGPT++ MANAGED MCP SERVERS
[mcp_servers.tools]
command = "node"
args = ["/absolute/path/to/tweak/mcp-server.js"]
env = { TOOLS_MODE = "codex" }
# END CHATGPT++ MANAGED MCP SERVERS
```

The managed block is rewritten when tweaks reload.

## Server Names

Set `mcp.name` to letters and digits only, for example `"visiontoolkit"`.
Codex turns `-` / `_` in the server name into `.` when listing tools, and then
the configured server no longer matches (`unknown MCP server 'com.chatgpt.plusplus.vision.toolkit'`).

If `mcp.name` is omitted, ChatGPT++ derives a name from the tweak id by
stripping punctuation to dotted segments (`com.chatgpt-plusplus.vision-toolkit`
→ `com.chatgpt.plusplus.vision.toolkit`). Prefer an explicit `mcp.name`.

If a generated name conflicts with another managed name, ChatGPT++ appends
`.2`, `.3`, and so on.

If the user already has a manual `[mcp_servers.<name>]` entry outside the
managed block, ChatGPT++ skips that managed server instead of overwriting it.

## Path Resolution

Rules:

- Absolute `command` values are used as-is.
- Relative/file-looking `command` values such as `./server.js` are resolved
  against the tweak directory.
- Command names such as `node`, `python`, or `uvx` are left as-is.
- `args` that are absolute or start with `-` are left as-is.
- Other `args` are resolved against the tweak directory only when the target
  file exists.

## Enable/Disable

Only enabled tweaks are synced. Disabling a tweak from Settings -> Tweaks
removes its managed MCP entry on the next reload.

## Validation

`manifest.mcp.command` must be a non-empty string. Optional `mcp.name` must
match `^[a-zA-Z][a-zA-Z0-9]{0,63}$`. `args` must be a string array when present.
`env` must be an object of string values.
