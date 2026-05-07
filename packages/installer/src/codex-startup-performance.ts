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
const RICH_INPUT_EFFECTS =
  "function _I({composerController:e,placeholder:t,ariaLabel:n,minHeight:r,disableAutoFocus:i=!1,isFocusComposerTarget:a=!1,singleLine:o=!1,onSubmit:s,onMentionHandler:c,onSkillMentionHandler:l,className:u}){let d=(0,J.useRef)(null);return(0,J.useEffect)(()=>{let t=d.current;if(t==null)throw Error(`RichTextInput rootRef is not mounted`);let n=e.view.dom;return t.appendChild(n),e.view.dom.dataset.virtualkeyboard=`true`,n.style.fontSize=`var(--codex-chat-font-size)`,n.style.height=`auto`,n.style.resize=`none`,()=>{n.blur(),n.parentElement===t&&t.removeChild(n)}},[e]),(0,J.useEffect)(()=>{if(a){e.view.dom.dataset.codexComposer=`true`;return}delete e.view.dom.dataset.codexComposer},[e,a]),(0,J.useEffect)(()=>{i||requestAnimationFrame(()=>{e.focus()})},[e,i]),";
const RICH_INPUT_LAYOUT_EFFECTS =
  "function _I({composerController:e,placeholder:t,ariaLabel:n,minHeight:r,disableAutoFocus:i=!1,isFocusComposerTarget:a=!1,singleLine:o=!1,onSubmit:s,onMentionHandler:c,onSkillMentionHandler:l,className:u}){let d=(0,J.useRef)(null);return(0,J.useLayoutEffect)(()=>{let t=d.current;if(t==null)throw Error(`RichTextInput rootRef is not mounted`);let n=e.view.dom;return t.appendChild(n),e.view.dom.dataset.virtualkeyboard=`true`,n.style.fontSize=`var(--codex-chat-font-size)`,n.style.height=`auto`,n.style.resize=`none`,()=>{n.blur(),n.parentElement===t&&t.removeChild(n)}},[e]),(0,J.useLayoutEffect)(()=>{if(a){e.view.dom.dataset.codexComposer=`true`;return}delete e.view.dom.dataset.codexComposer},[e,a]),(0,J.useLayoutEffect)(()=>{i||e.focus()},[e,i]),";
const RICH_INPUT_SIZING_EFFECTS =
  "(0,J.useEffect)(()=>{let t=e.view.dom;if(n){t.setAttribute(`aria-label`,n);return}t.removeAttribute(`aria-label`)},[n,e]),(0,J.useEffect)(()=>{e.view.dom.style.minHeight=r??`2.5rem`},[e,r]),(0,J.useEffect)(()=>{e.setPlaceholder(t)},[t,e]),";
const RICH_INPUT_SIZING_LAYOUT_EFFECTS =
  "(0,J.useLayoutEffect)(()=>{let t=e.view.dom;if(n){t.setAttribute(`aria-label`,n);return}t.removeAttribute(`aria-label`)},[n,e]),(0,J.useLayoutEffect)(()=>{e.view.dom.style.minHeight=r??`2.5rem`},[e,r]),(0,J.useLayoutEffect)(()=>{e.setPlaceholder(t)},[t,e]),";
const STARTUP_COMPOSER_INPUT_GATE_HELPER_ANCHOR = "var RU=`new-conversation`;";
const STARTUP_COMPOSER_INPUT_GATE_HELPER =
  "function __codexStartupInputGate({fallback:e,children:t,delayMs:n=6e3}){let[r,i]=(0,Z.useState)(()=>((globalThis.performance?.now?.()??1/0)>=n));return(0,Z.useEffect)(()=>{if(r)return;let e=setTimeout(()=>i(!0),Math.max(0,n-(globalThis.performance?.now?.()??0)));return()=>clearTimeout(e)},[r,n]),r?t:e}";
const STARTUP_COMPOSER_CONTROLS =
  "(0,Q.jsx)(az,{onAddImageDataUrls:ds,onAppendPromptText:e=>{Mn.appendText(e)},getAttachmentGen:()=>va.current,setFileAttachments:si,composerMode:Jn,composerInput:Bs,executionTargetCwd:q.cwd,executionTargetHostId:q.hostId,isSingleLineLayout:as,showHotkeyWindowHomeFooterControls:p,hotkeyWindowHomeOverflowMenu:v,conversationId:G,isAutoContextOn:Ur,setIsAutoContextOn:Br,ideContextStatus:qr,permissionsHostId:lr,permissionsCwdOverride:ur,submitButtonMode:Co,canStopFromEscape:To,isResponseInProgress:u,isQueueingEnabled:Zt,isSubmitting:Nt,onStop:x,submitBlockReason:yo,disabledReason:bo,emptySubmitTooltipNonce:ha,handleSubmit:ns,voiceControls:is})";
const STARTUP_COMPOSER_INPUT_GATE_CONTROLS =
  `(0,Q.jsx)(__codexStartupInputGate,{fallback:Bs,children:${STARTUP_COMPOSER_CONTROLS}})`;
const STARTUP_COMPOSER_STATUS_MENU =
  "(0,Q.jsx)(nV,{composerMode:Jn,currentLocalExecutionCwd:hr,currentLocalExecutionHostId:or,effectiveIdeContextStatus:qr,effectiveIsAutoContextOn:Ur,resolvedCwd:Cn,setIsAutoContextOn:Br,setIsStatusMenuOpen:at,skillLookupRoots:Wi})";
const STARTUP_COMPOSER_STATUS_MENU_DEFERRED =
  `((globalThis.performance?.now?.()??1/0)<6e3?null:${STARTUP_COMPOSER_STATUS_MENU})`;
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
const OPTIMISTIC_STARTUP_MARKER = "codex-optimistic-startup";
const OPTIMISTIC_COMPOSER_MARKER = 'id="codex-optimistic-composer"';
const STARTUP_LOADER_BODY = `    <div id="root">
      <div class="startup-loader" aria-hidden="true"></div>
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

    for (const name of readdirSync(assetsDir)) {
      if (!/^use-model-settings-[\w-]+\.js$/.test(name)) continue;
      const path = join(assetsDir, name);
      const source = readFileSync(path, "utf8");
      const patched = patchCodexStartupModelSettingsSource(source);
      if (!patched.changed) continue;
      writeFileSync(path, patched.source);
      patchedFiles.push(`webview/assets/${name}`);
    }

    for (const name of readdirSync(assetsDir)) {
      if (!/^composer-[\w-]+\.js$/.test(name)) continue;
      const path = join(assetsDir, name);
      const source = readFileSync(path, "utf8");
      const patched = patchCodexStartupComposerSource(source);
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
    .replace(STATSIG_LOADING_GATE, STATSIG_LOADING_REPLACEMENT);

  return {
    changed: patched !== source,
    source: patched,
  };
}

export function patchCodexStartupModelSettingsSource(source: string): {
  changed: boolean;
  source: string;
} {
  const patched = source
    .replace(RICH_INPUT_EFFECTS, RICH_INPUT_LAYOUT_EFFECTS)
    .replace(RICH_INPUT_SIZING_EFFECTS, RICH_INPUT_SIZING_LAYOUT_EFFECTS);

  return {
    changed: patched !== source,
    source: patched,
  };
}

export function patchCodexStartupComposerSource(source: string): {
  changed: boolean;
  source: string;
} {
  let patched = source;
  const needsInputGate = !patched.includes(STARTUP_COMPOSER_INPUT_GATE_CONTROLS) && patched.includes(STARTUP_COMPOSER_CONTROLS);

  if (needsInputGate && !patched.includes(STARTUP_COMPOSER_INPUT_GATE_HELPER)) {
    patched = patched.replace(
      STARTUP_COMPOSER_INPUT_GATE_HELPER_ANCHOR,
      `${STARTUP_COMPOSER_INPUT_GATE_HELPER}${STARTUP_COMPOSER_INPUT_GATE_HELPER_ANCHOR}`,
    );
  }
  if (needsInputGate && patched.includes(STARTUP_COMPOSER_INPUT_GATE_HELPER)) {
    patched = patched.replace(STARTUP_COMPOSER_CONTROLS, STARTUP_COMPOSER_INPUT_GATE_CONTROLS);
  }
  if (!patched.includes(STARTUP_COMPOSER_STATUS_MENU_DEFERRED)) {
    patched = patched.replace(STARTUP_COMPOSER_STATUS_MENU, STARTUP_COMPOSER_STATUS_MENU_DEFERRED);
  }

  return {
    changed: patched !== source,
    source: patched,
  };
}

export function patchCodexStartupHtmlSource(source: string): {
  changed: boolean;
  source: string;
} {
  let patched = restoreStartupStyles(source);
  if (patched.includes(OPTIMISTIC_STARTUP_MARKER) || patched.includes(OPTIMISTIC_COMPOSER_MARKER)) {
    patched = removeOptimisticStartupArtifacts(patched);
  }

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

function restoreStartupStyles(source: string): string {
  return source
    .replace(
      /<link rel="stylesheet" crossorigin href="([^"]+)" media="print" data-codex-defer-css>/g,
      '<link rel="stylesheet" crossorigin href="$1">',
    )
    .replace(/\s*<link rel="modulepreload" crossorigin href="\.\/assets\/[^"]+">/g, "")
    .replace(/\s*<link rel="preload" as="style" crossorigin href="\.\/assets\/[^"]+">/g, "");
}

function removeOptimisticStartupArtifacts(source: string): string {
  return source
    .replace(
      /\n\s*<script>\(\(\) => \{\n\s*const composerSelector = "\[data-codex-composer\]";[\s\S]*?<\/script>/,
      "",
    )
    .replace(/\s*<div id="root">\s*<div id="codex-optimistic-shell"[\s\S]*?<\/div>\s*<\/div>\s*<\/body>/, `\n${STARTUP_LOADER_BODY}\n  </body>`)
    .replace(/codex-optimistic-startup/g, "codex-removed-optimistic-startup");
}
