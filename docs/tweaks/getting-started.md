# Getting Started

A tweak is a JavaScript package loaded from the ChatGPT++ tweaks directory. Tweaks
can add settings UI, adjust Codex's renderer DOM, run Electron main-process
code, communicate between renderer and main, store data, expose MCP servers, and
open Codex-native windows.

## Tweaks Directory

| Platform | Directory |
|---|---|
| macOS | `~/Library/Application Support/chatgpt-plusplus/tweaks/` |
| Linux | `~/.local/share/codex-plusplus/tweaks/` |
| Windows | `%APPDATA%/chatgpt-plusplus/tweaks/` |

ChatGPT++ watches this directory and hot-reloads when files change. You can also
reload from Settings -> Tweaks or restart Codex.

## Create a Tweak

```sh
chatgptplusplus create-tweak ./my-tweak \
  --id com.you.my-tweak \
  --name "My Tweak" \
  --repo you/my-tweak
```

This creates:

```text
my-tweak/
  manifest.json
  index.js
  package.json
  README.md
```

Validate it:

```sh
chatgptplusplus validate-tweak ./my-tweak
```

Link it into your live tweaks directory:

```sh
chatgptplusplus dev ./my-tweak
```

`chatgptplusplus dev` validates the manifest, creates a symlink, touches a reload
marker, and watches for local changes. Pass `--replace` if a symlink with that
name already points somewhere else.

## Entry File Resolution

ChatGPT++ resolves the entry file in this order:

1. `manifest.main`, if present
2. `index.js`
3. `index.cjs`
4. `index.mjs`

Renderer entries are evaluated as a CommonJS-shaped function. Do not ship raw
TypeScript or ESM `import` / `export` syntax unless you bundle it first to
runtime-loadable JavaScript. `module.exports`, `exports.foo`, and
`module.exports.default` are supported.

## Minimal Renderer Tweak

`manifest.json`:

```json
{
  "id": "com.you.hello",
  "name": "Hello",
  "version": "0.1.0",
  "githubRepo": "you/hello",
  "scope": "renderer",
  "main": "index.js"
}
```

`index.js`:

```js
module.exports = {
  start(api) {
    api.settings.registerPage({
      id: "main",
      title: api.manifest.name,
      description: "A dedicated settings page.",
      render(root) {
        root.innerHTML = "";
        const p = document.createElement("p");
        p.className = "text-sm text-token-text-secondary";
        p.textContent = "Hello from ChatGPT++.";
        root.append(p);
      },
    });
  },
};
```

## Minimal Main Tweak

```json
{
  "id": "com.you.main-only",
  "name": "Main Only",
  "version": "0.1.0",
  "githubRepo": "you/main-only",
  "scope": "main",
  "main": "index.js"
}
```

```js
module.exports = {
  start(api) {
    api.log.info("main tweak started");
    api.ipc.handle("ping", () => "pong from main");
  },
};
```

## Minimal Both-Process Tweak

```json
{
  "id": "com.you.both",
  "name": "Both",
  "version": "0.1.0",
  "githubRepo": "you/both",
  "scope": "both",
  "main": "index.js"
}
```

```js
module.exports = {
  start(api) {
    if (api.process === "main") {
      api.ipc.handle("ping", () => "pong");
      return;
    }

    api.settings.registerPage({
      id: "main",
      title: "Ping",
      render(root) {
        root.innerHTML = "";
        const button = document.createElement("button");
        button.textContent = "Ping main";
        button.onclick = async () => {
          button.textContent = await api.ipc.invoke("ping");
        };
        root.append(button);
      },
    });
  },
};
```

## Next Steps

- Add metadata and permissions in [Manifest reference](./manifest.md).
- Use [SDK and API reference](./api-reference.md) while implementing.
- Use [UI and DOM patterns](./ui-and-dom.md) for Codex-looking settings UI and
  safe renderer adjustments.
