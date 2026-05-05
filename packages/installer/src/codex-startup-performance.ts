import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface StartupPerformancePatchResult {
  patchedFiles: string[];
}

const AUTH_LOADING_GATE = "if(t.isLoading)return null;";
const AUTH_LOADING_REPLACEMENT = "if(t.isLoading)return`app`;";
const WORKSPACE_ROOTS_LOADING_GATE = "if(r)return null;";
const WORKSPACE_ROOTS_LOADING_REPLACEMENT = "if(r)return`app`;";
const FRONTEND_METADATA_ACCOUNT_LOADING_GATE = "if(r.isLoading||a||s||h&&_||h&&p&&!m){";
const FRONTEND_METADATA_ACCOUNT_LOADING_REPLACEMENT = "if(r.isLoading||a||s||h&&_){";
const STATSIG_LOADING_GATE =
  "if(t[40]!==F||t[41]!==N?(L=()=>{if(F!=null)try{let e=F.getContext().user;(0,vE.default)(e,N)||F.updateUserAsync(N)}catch(e){let t=e;q.error(`Statsig: error while checking/updating user`,{safe:{},sensitive:{error:t}})}},R=[F,N],t[40]=F,t[41]=N,t[42]=L,t[43]=R):(L=t[42],R=t[43]),(0,Q.useEffect)(L,R),I){";
const STATSIG_LOADING_REPLACEMENT =
  "if(t[40]!==F||t[41]!==N?(L=()=>{if(F!=null)try{let e=F.getContext().user;(0,vE.default)(e,N)||F.updateUserAsync(N)}catch(e){let t=e;q.error(`Statsig: error while checking/updating user`,{safe:{},sensitive:{error:t}})}},R=[F,N],t[40]=F,t[41]=N,t[42]=L,t[43]=R):(L=t[42],R=t[43]),(0,Q.useEffect)(L,R),I&&!F){";
const RECOMMENDED_SKILLS_WARMER =
  "t.F({refresh:!1,preferWsl:rv,bundledRepoRoot:this.bundledSkillsRoot,appServerClient:this.appServerClient}).catch(e=>{J().warning(`Failed to warm recommended skills cache`,{safe:{},sensitive:{error:e}})})";
const RECOMMENDED_SKILLS_WARMER_DEFERRED =
  "setTimeout(()=>{t.F({refresh:!1,preferWsl:rv,bundledRepoRoot:this.bundledSkillsRoot,appServerClient:this.appServerClient}).catch(e=>{J().warning(`Failed to warm recommended skills cache`,{safe:{},sensitive:{error:e}})})},5e3).unref?.()";
const PRIMARY_RUNTIME_POLLING_START = "this.disposables.add(this.fetchHandler.startPrimaryRuntimeUpdatePolling());";
const PRIMARY_RUNTIME_POLLING_DEFERRED =
  "setTimeout(()=>{this.disposables.add(this.fetchHandler.startPrimaryRuntimeUpdatePolling())},1e4).unref?.();";
const BUNDLED_PLUGINS_RECONCILE =
  "await ue.waitForPendingReconcile(),w(`bundled plugins reconcile checked`,A,{isMacOS:T}),A=Date.now();let be=await M.ensureHostWindow(B);";
const BUNDLED_PLUGINS_RECONCILE_DEFERRED =
  "ue.waitForPendingReconcile().then(()=>w(`bundled plugins reconcile checked`,A,{isMacOS:T})).catch(e=>{t.Mr().warning(`Bundled plugins reconcile failed`,{safe:{},sensitive:{error:e}})}),A=Date.now();let be=await M.ensureHostWindow(B);";
const SHELL_ENV_HYDRATION =
  "A=Date.now(),await Hl(),w(`shell environment hydrated`,A);let j=JD({moduleDir:__dirname});";
const SHELL_ENV_HYDRATION_DEFERRED =
  "A=Date.now(),E||Hl().then(()=>w(`shell environment hydrated`,A)).catch(e=>{t.Mr().warning(`Shell environment hydration failed`,{safe:{},sensitive:{error:e}})});let j=JD({moduleDir:__dirname});";
const WINDOWS_BACKGROUND_MATERIAL =
  "...process.platform===`win32`?{autoHideMenuBar:!0}:{},...A==null?{}:{backgroundMaterial:A},...v,";
const WINDOWS_BACKGROUND_MATERIAL_OPAQUE =
  "...process.platform===`win32`?{autoHideMenuBar:!0}:{},...process.platform===`win32`?{}:A==null?{}:{backgroundMaterial:A},...v,";
const LOCAL_PRIMARY_WINDOW_HIDDEN_UNTIL_READY = "P({hostId:e,show:e!==B})";
const LOCAL_PRIMARY_WINDOW_SHOWN_IMMEDIATELY = "P({hostId:e,show:!0})";
const LOCAL_CONTEXT_INIT =
  "DD({isWindows:E,disableQuitConfirmationPrompt:process.env.CODEX_ELECTRON_DISABLE_QUIT_CONFIRMATION===`1`,quitState:F,windows:M,applicationMenuManager:z.applicationMenuManager,ensureHostWindow:M.ensureHostWindow,hotkeyWindowLifecycleManager:M.hotkeyWindowLifecycleManager,globalDictationLifecycleManager:M.globalDictationLifecycleManager,globalStatesByHostId:j.globalStatesByHostId,flushAndDisposeContexts:R.flushAndDisposeContexts,disposables:k,appEvent:L.appEvent,errorReporter:g}),A=Date.now(),wN(j.globalState);let he=R.getOrCreateContext(R.localHost);";
const LOCAL_CONTEXT_INIT_WITH_EARLY_WINDOW =
  "DD({isWindows:E,disableQuitConfirmationPrompt:process.env.CODEX_ELECTRON_DISABLE_QUIT_CONFIRMATION===`1`,quitState:F,windows:M,applicationMenuManager:z.applicationMenuManager,ensureHostWindow:M.ensureHostWindow,hotkeyWindowLifecycleManager:M.hotkeyWindowLifecycleManager,globalDictationLifecycleManager:M.globalDictationLifecycleManager,globalStatesByHostId:j.globalStatesByHostId,flushAndDisposeContexts:R.flushAndDisposeContexts,disposables:k,appEvent:L.appEvent,errorReporter:g}),A=Date.now(),wN(j.globalState);let he=R.getOrCreateContext(R.localHost);M.ensureHostWindow(B).catch(e=>{t.Mr().warning(`Early host window creation failed`,{safe:{},sensitive:{error:e}})});";
const STRICT_MODE_RENDER =
  "async function Zj(){await Qj(),Xj.render((0,$.jsx)(Q.StrictMode,{children:(0,$.jsx)(Ij,{})}))}async function Qj(){}";
const DIRECT_RENDER = "function Zj(){Xj.render((0,$.jsx)(Ij,{}))}function Qj(){}";
const OPTIMISTIC_STARTUP_MARKER = "codex-optimistic-startup";
const OPTIMISTIC_COMPOSER_MARKER = 'id="codex-optimistic-composer"';
const OPTIMISTIC_STARTUP_SCRIPT = `(() => {
  const composerSelector = "[data-codex-composer]";
  let draft = "";
  let movedDraft = false;

  function editableInside(node) {
    if (!(node instanceof HTMLElement)) return null;
    if (node.isContentEditable || node.getAttribute("contenteditable") === "true") return node;
    return node.querySelector('textarea,input,[contenteditable="true"],[contenteditable=true]');
  }

  function optimisticComposer() {
    return document.getElementById("codex-optimistic-composer");
  }

  function focusOptimisticComposer() {
    const composer = optimisticComposer();
    if (composer) composer.focus({ preventScroll: true });
  }

  function transferDraftToRealComposer() {
    if (movedDraft) return true;
    const realComposer = Array.from(document.querySelectorAll(composerSelector)).find(
      (node) => node.id !== "codex-optimistic-composer",
    );
    const editable = editableInside(realComposer);
    if (!editable) return false;
    movedDraft = true;
    if (draft && !editable.textContent) editable.textContent = draft;
    editable.focus({ preventScroll: true });
    return true;
  }

  window.addEventListener("DOMContentLoaded", () => {
    const composer = optimisticComposer();
    if (composer) {
      composer.addEventListener("input", () => {
        draft = composer.innerText || composer.textContent || "";
      });
    }
    focusOptimisticComposer();
    window.setTimeout(focusOptimisticComposer, 50);
    window.setTimeout(focusOptimisticComposer, 250);
    if (transferDraftToRealComposer()) return;
    const observer = new MutationObserver(() => {
      if (transferDraftToRealComposer()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
})();`;
const OPTIMISTIC_STARTUP_CSS = `
      .codex-optimistic-startup {
        box-sizing: border-box;
        display: grid;
        min-height: 100%;
        grid-template-rows: 48px 1fr;
        background: #f7f7f4;
        color: #1f1f1f;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .codex-optimistic-startup *,
      .codex-optimistic-startup *::before,
      .codex-optimistic-startup *::after {
        box-sizing: border-box;
      }

      .codex-optimistic-titlebar {
        display: flex;
        align-items: center;
        padding: 0 18px;
        border-bottom: 1px solid rgb(0 0 0 / 0.08);
        color: #454541;
        font-size: 13px;
        font-weight: 500;
        -webkit-app-region: drag;
      }

      .codex-optimistic-stage {
        display: grid;
        align-content: end;
        padding: 24px;
      }

      .codex-optimistic-composer-shell {
        width: min(860px, 100%);
        margin: 0 auto;
        border: 1px solid rgb(0 0 0 / 0.12);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 8px 28px rgb(0 0 0 / 0.08);
      }

      #codex-optimistic-composer {
        min-height: 72px;
        padding: 16px 18px;
        color: #1f1f1f;
        font-size: 15px;
        line-height: 1.45;
        outline: none;
        white-space: pre-wrap;
        word-break: break-word;
        -webkit-app-region: no-drag;
      }

      #codex-optimistic-composer:empty::before {
        color: #8a8a84;
        content: attr(data-placeholder);
      }

      @media (prefers-color-scheme: dark) {
        .codex-optimistic-startup {
          background: #171717;
          color: #f4f4f0;
        }

        .codex-optimistic-titlebar {
          border-bottom-color: rgb(255 255 255 / 0.1);
          color: #c8c8c2;
        }

        .codex-optimistic-composer-shell {
          border-color: rgb(255 255 255 / 0.14);
          background: #242424;
          box-shadow: 0 8px 28px rgb(0 0 0 / 0.32);
        }

        #codex-optimistic-composer {
          color: #f4f4f0;
        }

        #codex-optimistic-composer:empty::before {
          color: #9d9d96;
        }
      }
`;
const OPTIMISTIC_STARTUP_BODY = `    <div id="root">
      <div id="codex-optimistic-shell" class="codex-optimistic-startup">
        <div class="codex-optimistic-titlebar">Codex</div>
        <main class="codex-optimistic-stage">
          <div class="codex-optimistic-composer-shell">
            <div
              id="codex-optimistic-composer"
              data-codex-composer
              data-placeholder="Ask Codex"
              contenteditable="true"
              role="textbox"
              spellcheck="true"
              tabindex="0"
            ></div>
          </div>
        </main>
      </div>
    </div>`;

export function patchCodexStartupPerformance(appDir: string): StartupPerformancePatchResult {
  const patchedFiles: string[] = [];

  const assetsDir = join(appDir, "webview", "assets");
  if (existsSync(assetsDir)) {
    for (const name of readdirSync(assetsDir)) {
      if (!/^index-[\w-]+\.js$/.test(name)) continue;
      const path = join(assetsDir, name);
      const source = readFileSync(path, "utf8");
      const patched = patchCodexStartupPerformanceSource(source);
      if (!patched.changed) continue;
      writeFileSync(path, patched.source);
      patchedFiles.push(`webview/assets/${name}`);
    }
  }

  const indexHtmlPath = join(appDir, "webview", "index.html");
  if (existsSync(indexHtmlPath)) {
    const source = readFileSync(indexHtmlPath, "utf8");
    const patched = patchCodexStartupHtmlSource(source);
    if (patched.changed) {
      writeFileSync(indexHtmlPath, patched.source);
      patchedFiles.push("webview/index.html");
    }
  }

  const buildDir = join(appDir, ".vite", "build");
  if (existsSync(buildDir)) {
    for (const name of readdirSync(buildDir)) {
      if (!/^main-[\w-]+\.js$/.test(name)) continue;
      const path = join(buildDir, name);
      const source = readFileSync(path, "utf8");
      const patched = patchCodexMainStartupResourceSource(source);
      if (!patched.changed) continue;
      writeFileSync(path, patched.source);
      patchedFiles.push(`.vite/build/${name}`);
    }
  }

  return { patchedFiles };
}

export function patchCodexStartupPerformanceSource(source: string): {
  changed: boolean;
  source: string;
} {
  const patched = source
    .replace(AUTH_LOADING_GATE, AUTH_LOADING_REPLACEMENT)
    .replace(WORKSPACE_ROOTS_LOADING_GATE, WORKSPACE_ROOTS_LOADING_REPLACEMENT)
    .replace(FRONTEND_METADATA_ACCOUNT_LOADING_GATE, FRONTEND_METADATA_ACCOUNT_LOADING_REPLACEMENT)
    .replace(STATSIG_LOADING_GATE, STATSIG_LOADING_REPLACEMENT)
    .replace(STRICT_MODE_RENDER, DIRECT_RENDER);

  return {
    changed: patched !== source,
    source: patched,
  };
}

export function patchCodexStartupHtmlSource(source: string): {
  changed: boolean;
  source: string;
} {
  if (source.includes(OPTIMISTIC_COMPOSER_MARKER)) {
    const patched = moveRendererAssetsAfterOptimisticBody(
      addCspScriptHash(restoreStartupStyles(repairOptimisticStartupCsp(source)), OPTIMISTIC_STARTUP_SCRIPT),
    );
    return { changed: patched !== source, source: patched };
  }

  let patched = restoreStartupStyles(repairOptimisticStartupCsp(source));
  if (!patched.includes(OPTIMISTIC_STARTUP_MARKER)) {
    patched = patched.replace("</style>", `${OPTIMISTIC_STARTUP_CSS}\n    </style>`);
  }
  if (!patched.includes(OPTIMISTIC_STARTUP_SCRIPT)) {
    patched = patched.replace("</head>", `    <script>${OPTIMISTIC_STARTUP_SCRIPT}</script>\n</head>`);
  }
  patched = patched.replace(/\s*<div id="root">[\s\S]*<\/div>\s*<\/body>/, `\n${OPTIMISTIC_STARTUP_BODY}\n  </body>`);
  patched = addCspScriptHash(patched, OPTIMISTIC_STARTUP_SCRIPT);
  patched = moveRendererAssetsAfterOptimisticBody(patched);

  return {
    changed: patched !== source,
    source: patched,
  };
}

export function patchCodexMainStartupResourceSource(source: string): {
  changed: boolean;
  source: string;
} {
  let patched = source;
  if (!patched.includes(RECOMMENDED_SKILLS_WARMER_DEFERRED)) {
    patched = patched.replace(RECOMMENDED_SKILLS_WARMER, RECOMMENDED_SKILLS_WARMER_DEFERRED);
  }
  if (!patched.includes(PRIMARY_RUNTIME_POLLING_DEFERRED)) {
    patched = patched.replace(PRIMARY_RUNTIME_POLLING_START, PRIMARY_RUNTIME_POLLING_DEFERRED);
  }
  if (!patched.includes(BUNDLED_PLUGINS_RECONCILE_DEFERRED)) {
    patched = patched.replace(BUNDLED_PLUGINS_RECONCILE, BUNDLED_PLUGINS_RECONCILE_DEFERRED);
  }
  if (!patched.includes(SHELL_ENV_HYDRATION_DEFERRED)) {
    patched = patched.replace(SHELL_ENV_HYDRATION, SHELL_ENV_HYDRATION_DEFERRED);
  }
  if (!patched.includes(WINDOWS_BACKGROUND_MATERIAL_OPAQUE)) {
    patched = patched.replace(WINDOWS_BACKGROUND_MATERIAL, WINDOWS_BACKGROUND_MATERIAL_OPAQUE);
  }
  if (!patched.includes(LOCAL_PRIMARY_WINDOW_SHOWN_IMMEDIATELY)) {
    patched = patched.replace(LOCAL_PRIMARY_WINDOW_HIDDEN_UNTIL_READY, LOCAL_PRIMARY_WINDOW_SHOWN_IMMEDIATELY);
  }
  if (!patched.includes("Early host window creation failed")) {
    patched = patched.replace(LOCAL_CONTEXT_INIT, LOCAL_CONTEXT_INIT_WITH_EARLY_WINDOW);
  }

  return {
    changed: patched !== source,
    source: patched,
  };
}

function addCspScriptHash(source: string, script: string): string {
  const hashValue = `sha256-${createHash("sha256").update(script).digest("base64")}`;
  const rawHash = `'${hashValue}'`;
  const encodedHash = `&#39;${hashValue}&#39;`;
  if (source.includes(rawHash) || source.includes(encodedHash)) return source;
  if (source.includes("script-src &#39;self&#39;")) {
    return source.replace("script-src &#39;self&#39;", `script-src &#39;self&#39; ${encodedHash}`);
  }
  if (source.includes("script-src 'self'")) {
    return source.replace("script-src 'self'", `script-src 'self' ${rawHash}`);
  }
  return source.replace(/(script-src[^;"]*)/, `$1 ${rawHash}`);
}

function repairOptimisticStartupCsp(source: string): string {
  const hashValue = `sha256-${createHash("sha256").update(OPTIMISTIC_STARTUP_SCRIPT).digest("base64")}`;
  const malformed = new RegExp(`script-src &#39 (?:&#39;|')${escapeRegExp(hashValue)}(?:&#39;|');self&#39;`, "g");
  return source.replace(malformed, "script-src &#39;self&#39;");
}

function restoreStartupStyles(source: string): string {
  return source.replace(
    /<link rel="stylesheet" crossorigin href="([^"]+)" media="print" data-codex-defer-css>/g,
    '<link rel="stylesheet" crossorigin href="$1">',
  );
}

function moveRendererAssetsAfterOptimisticBody(source: string): string {
  const rendererAssets: string[] = [];
  const withoutRendererAssets = source.replace(
    /\n\s*(<link rel="modulepreload" crossorigin href="[^"]+">|<script type="module" crossorigin src="[^"]+"><\/script>|<link rel="stylesheet" crossorigin href="[^"]+">)/g,
    (_match, tag: string) => {
      rendererAssets.push(tag);
      return "";
    },
  );
  if (rendererAssets.length === 0) return source;
  return withoutRendererAssets.replace(
    "\n  </body>",
    `\n    ${rendererAssets.join("\n    ")}\n  </body>`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
