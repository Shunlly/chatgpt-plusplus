# Changelog

All notable changes to codex-plusplus are documented here.

This project uses semver for the installer, runtime, SDK, and published CLI package. Tweak authors should also use semver release tags so the manager can compare installed and available versions.

## 0.1.1

### Added

- Added a native Codex window bridge for main-scope tweaks.
- Tweaks can now create Codex-registered chat windows for routes such as `/local/<conversation-id>`, which enables split-screen chat tweaks to render the real Codex chat UI instead of transcript clones or unregistered BrowserViews.
- The installer now exposes Codex's internal window services to the Codex++ runtime during asar patching.
- Added `codexplusplus` as the preferred CLI command, while keeping `codex-plusplus` as an alias.
- Added `codexplusplus update` / `codexplusplus self-update` to refresh Codex++ from GitHub source, rebuild it, and run `repair`.
- Added `codexplusplus update-codex` for macOS Sparkle updates. It restores a signed Codex.app before the official updater runs, then lets the watcher reapply Codex++ after Codex restarts.
- Added a native Windows PowerShell bootstrap script, `install.ps1`.
- Added `update.sh` and `update.ps1` helper scripts for users whose shell does not yet have `codexplusplus` on PATH.
- Added Homebrew formula scaffolding and Bun/global-install metadata so `codexplusplus` can be installed as a normal command.

### Fixed

- Fixed the GitHub source installer failing on clean machines when `npm ci` rejects an out-of-sync workspace lockfile.
- The source installer now installs dependencies with `npm ci --workspaces --include-workspace-root --ignore-scripts`.
- If the downloaded lockfile is stale, the installer now removes only that temporary lockfile and falls back to `npm install --workspaces --include-workspace-root --ignore-scripts`.
- Fixed fallback installs missing workspace dependencies such as `electron`, `chokidar`, or `@codex-plusplus/sdk`.
- Fixed Windows install preflight using the macOS-only `Contents` bundle path.
- Expanded Windows app discovery to cover common Squirrel and Electron install locations.
- Hardened Windows scheduled-task repair command quoting.
- Improved installer prerequisite and failure messages with human-readable `[!]` errors.

### Changed

- Source bootstrap installs local CLI shims into a writable PATH directory when possible, so users can run `codexplusplus repair`, `codexplusplus status`, and `codexplusplus update` after the first install.
- macOS installs now preserve a signed Codex.app backup when available, which supports safer official Codex updates.
- Settings injection now hides Codex++ settings surfaces more cleanly when leaving settings.

## 0.1.0

- Initial alpha release.
- One-command GitHub installer via `install.sh`; no npm package or `npx` dependency.
- Runtime-loaded local tweaks with Settings integration.
- App-update repair watcher for re-patching Codex after app updates, using the locally installed CLI.
- Codex++ release checks through GitHub Releases.
- Default tweak seeding from Bennett UI Improvements and Custom Keyboard Shortcuts GitHub release channels, with `--no-default-tweaks`.
- Review-only tweak update checks via required `githubRepo` manifest metadata.
- In-app tweak manager with enable/disable, config, release links, and maintenance actions.
