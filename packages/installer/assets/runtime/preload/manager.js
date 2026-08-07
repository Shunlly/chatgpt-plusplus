"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountManager = mountManager;
/**
 * Built-in "Tweak Manager" — auto-injected by the runtime, not a user tweak.
 * Lists discovered tweaks with enable toggles, opens the tweaks dir, links
 * to logs and config. Lives in the renderer.
 *
 * This is invoked from preload/index.ts AFTER user tweaks are loaded so it
 * can show up-to-date status.
 */
const electron_1 = require("electron");
const settings_injector_1 = require("./settings-injector");
async function mountManager() {
    const tweaks = (await electron_1.ipcRenderer.invoke("codexpp:list-tweaks"));
    const paths = (await electron_1.ipcRenderer.invoke("codexpp:user-paths"));
    (0, settings_injector_1.registerSection)({
        id: "chatgpt-plusplus:manager",
        title: "Tweak Manager",
        description: `${tweaks.length} tweak(s) installed. User dir: ${paths.userRoot}`,
        render(root) {
            root.style.cssText = "display:flex;flex-direction:column;gap:8px;";
            const actions = document.createElement("div");
            actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
            actions.appendChild(button("Open tweaks folder", () => electron_1.ipcRenderer.invoke("codexpp:reveal", paths.tweaksDir).catch(() => { })));
            actions.appendChild(button("Open logs", () => electron_1.ipcRenderer.invoke("codexpp:reveal", paths.logDir).catch(() => { })));
            actions.appendChild(button("Reload window", () => location.reload()));
            root.appendChild(actions);
            if (tweaks.length === 0) {
                const empty = document.createElement("p");
                empty.style.cssText = "color:#888;font:13px system-ui;margin:8px 0;";
                empty.textContent =
                    "No user tweaks yet. Drop a folder with manifest.json + index.js into the tweaks dir, then reload.";
                root.appendChild(empty);
                return;
            }
            const list = document.createElement("ul");
            list.style.cssText = "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;";
            for (const t of tweaks) {
                const li = document.createElement("li");
                li.style.cssText =
                    "display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--border,#2a2a2a);border-radius:6px;";
                const left = document.createElement("div");
                left.innerHTML = `
          <div style="font:600 13px system-ui;">${escape(t.manifest.name)} <span style="color:#888;font-weight:400;">v${escape(t.manifest.version)}</span></div>
          <div style="color:#888;font:12px system-ui;">${escape(t.manifest.description ?? t.manifest.id)}</div>
        `;
                const right = document.createElement("div");
                right.style.cssText = "color:#888;font:12px system-ui;";
                right.textContent = t.entryExists ? "loaded" : "missing entry";
                li.append(left, right);
                list.append(li);
            }
            root.append(list);
        },
    });
}
function button(label, onclick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
        "padding:6px 10px;border:1px solid var(--border,#333);border-radius:6px;background:transparent;color:inherit;font:12px system-ui;cursor:pointer;";
    b.addEventListener("click", onclick);
    return b;
}
function escape(s) {
    return s.replace(/[&<>"']/g, (c) => c === "&"
        ? "&amp;"
        : c === "<"
            ? "&lt;"
            : c === ">"
                ? "&gt;"
                : c === '"'
                    ? "&quot;"
                    : "&#39;");
}
//# sourceMappingURL=manager.js.map