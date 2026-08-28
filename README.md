# ChatGPT++

**English** | [简体中文](./README.zh-CN.md)

Local tweaks for the OpenAI ChatGPT / Codex desktop app: themes, vision for text-only models, conversation import/export. The runtime lives in your user data directory, not inside the app bundle.
[Discord](https://discord.gg/6bY6gGX36H)

<img width="1400" alt="ChatGPT++ sidebar with Plugins and Theme" src="docs/screenshots/main-nav.png" />

> Unofficial. Not affiliated with OpenAI. Use at your own risk.

## Install

Grab a package from [GitHub Releases](https://github.com/Shunlly/chatgpt-plusplus/releases) (no Node.js required):

| OS | File |
|---|---|
| macOS Apple Silicon | `ChatGPT++-<version>-macos-arm64.dmg` |
| Windows x64 | `ChatGPT++-<version>-win-x64-setup.exe` |

- macOS: open the dmg, drag `ChatGPT++.app` into Applications. If macOS says it is damaged: `xattr -dr com.apple.quarantine "/Applications/ChatGPT++.app"`, then right-click Open.
- Windows: run the setup. It patches ChatGPT/Codex on finish. Start Menu has “Install & Repair”.

Installer installs update from Releases, not from `chatgptplusplus update`.

Other options:

```sh
brew install Shunlly/chatgpt-plusplus/chatgptplusplus
chatgptplusplus install
```

```sh
curl -fsSL https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/Shunlly/chatgpt-plusplus/main/install.ps1 | iex
```

Launch **ChatGPT++**. The sidebar should show **Plugins** and **Theme**. Settings has ChatGPT++ pages: Config / Plugins / Store.

## Built-in plugins

Open sidebar **Plugins**, or Settings → ChatGPT++ → **Plugins**. Each card has an on/off switch; cards with a GitHub repo also have **Update**.

<img width="1400" alt="Plugins page with Vision Toolkit, Dream Skin, import/export, delete" src="docs/screenshots/plugins.png" />

| Plugin | What it does |
|---|---|
| **Vision Toolkit** | Lets text-only models (DeepSeek, etc.) look at images |
| **Dream Skin** | Themes; upload a photo to pull colors |
| **Conversation export/import** | Markdown / JSON / HTML |
| **Conversation delete** | Delete button on the thread list |

### Vision Toolkit

Text-only models cannot see pixels. This plugin adds MCP tool `vision_glance`: it sends the image to your configured vision API and returns text to the current model.

**Configure it first or sending a picture will do nothing.**

1. Open **Plugins**, find **Vision Toolkit**, make sure it is on.
2. Click **Configure** on the card.
3. Fill API key, base URL, and model. Default is Groq’s OpenAI-compatible API; keys: [console.groq.com](https://console.groq.com/keys).
4. Click **Test connection**. Save when it says connected.
5. **Fully quit and reopen ChatGPT++** (Force Reload is not enough; the MCP process must restart).
6. Pick a model on the allowlist (e.g. `deepseek-v4-pro`), attach an image, ask what is in it.

<img width="1100" alt="Vision Toolkit config: API key, endpoint, model, allowlist, test" src="docs/screenshots/vision-config.png" />

Notes:

- Config is stored at `tweak-data/com.chatgpt-plusplus.vision-toolkit/config.json` and survives upgrades.
- Only **allowlisted** text-only models call `vision_glance`. Do not add native vision models (GPT-4o, Gemini, …).
- MCP server name is `visiontoolkit` (letters/digits only). Restart after every config change.
- Details: [tweaks/vision-toolkit/README.md](./tweaks/vision-toolkit/README.md).

### Dream Skin

Sidebar **Theme**: presets plus custom themes from an uploaded image.

![Dream Skin theme page](docs/screenshots/theme-page.png)

### Interrupted chats on the pet

If you quit ChatGPT++ while a turn is still running, the pet window lists **Interrupted** chats after relaunch. Click the title to open it in the main window; × dismisses it.

## Commands

| Command | What it does |
|---|---|
| `chatgptplusplus install` | Patch the app and install the runtime |
| `chatgptplusplus status` | Version and patch state |
| `chatgptplusplus repair` | Re-patch after an official app update |
| `chatgptplusplus update` | Update from GitHub (installer builds point you at Releases) |
| `chatgptplusplus doctor` | Signatures, permissions, common failures |
| `chatgptplusplus safe-mode` | Disable all tweaks |
| `chatgptplusplus uninstall` | Uninstall; `--purge` also deletes config/logs |

Tweak dev: `create-tweak` / `validate-tweak` / `dev`.

## Where files live

| Item | Location |
|---|---|
| Runtime | `<user-data>/runtime/` |
| Tweaks | `<user-data>/tweaks/` |
| Tweak data (incl. vision config) | `<user-data>/tweak-data/` |
| Config / logs / backups | `<user-data>/config.json` `log/` `backup/` |

macOS: `~/Library/Application Support/chatgpt-plusplus/`  
Windows: `%APPDATA%/chatgpt-plusplus/`

## Writing tweaks

A folder with `manifest.json` + `index.js`. Full guide: [Writing Tweaks](./docs/WRITING-TWEAKS.md).

MCP tweaks declare `mcp` in the manifest. Server names must be letters/digits only (`"name": "visiontoolkit"`). See [MCP](./docs/tweaks/mcp.md).

```sh
chatgptplusplus create-tweak ./my-tweak --id com.you.my-tweak --name "My Tweak"
chatgptplusplus validate-tweak ./my-tweak
chatgptplusplus dev ./my-tweak
```

## Owl / native bridge

macOS ChatGPT uses Owl. Probe with `chatgptplusplus debug`. Native APIs: [native bridge](./docs/tweaks/native-bridge.md).

## Browser host (experimental)

```sh
chatgptplusplus browser --port 8765
```

Then open `http://127.0.0.1:8765/`.

## Updates and recovery

```sh
chatgptplusplus repair --force
chatgptplusplus safe-mode
chatgptplusplus uninstall --purge
```

Official ChatGPT updates often strip the patch; the watcher tries to restore it. If not, `repair`.

## Security

Tweaks run local code inside ChatGPT. Install only what you trust. ChatGPT++ does not silently overwrite tweak files. See [SECURITY.md](./SECURITY.md).

## Requirements

macOS 14+ / Windows 10 1809+ / Linux (systemd). 8GB RAM recommended. [Performance](./docs/PERFORMANCE.md), [troubleshooting](./docs/TROUBLESHOOTING.md).

## More docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Writing tweaks](./docs/WRITING-TWEAKS.md)
- [Tweak API](./docs/tweaks/api-reference.md)
- [Manifest](./docs/tweaks/manifest.md)
- [MCP](./docs/tweaks/mcp.md)

## License

MIT. Upstream copyright (c) 2026 Bennett.
