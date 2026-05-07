import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  patchCodexMainStartupResourceSource,
  patchCodexStartupComposerSource,
  patchCodexStartupHtmlSource,
  patchCodexStartupModelSettingsSource,
  patchCodexStartupPerformance,
  patchCodexStartupPerformanceSource,
} from "../src/codex-startup-performance.js";

test("startup source patch makes loading gates optimistic", () => {
  const source =
    "function _w({windowType:e,auth:t,workspaceRootsIsLoading:r}){" +
    "if(e!==`electron`)return`app`;" +
    "if(t.isLoading)return null;" +
    "if(!t.authMethod&&t.requiresAuth)return`login`;" +
    "if(r)return null;" +
    "return`app`}";

  const patched = patchCodexStartupPerformanceSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /if\(t\.isLoading\)return`app`;/);
  assert.match(patched.source, /if\(r\)return`app`;/);
  assert.doesNotMatch(patched.source, /return null/);
});

test("startup source patch does not block metadata provider on current account loading", () => {
  const source =
    "function FE(){let r,a,s,h,_,p,m;" +
    "if(r.isLoading||a||s||h&&_||h&&p&&!m){return logo}" +
    "return app}";

  const patched = patchCodexStartupPerformanceSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /if\(r\.isLoading\|\|a\|\|s\|\|h&&_\)\{/);
  assert.doesNotMatch(patched.source, /h&&p&&!m/);
});

test("startup source patch keeps statsig provider tree mounted when client exists", () => {
  const source =
    "function IE(){let F,N,L,R,I;" +
    "if(t[40]!==F||t[41]!==N?(L=()=>{if(F!=null)try{let e=F.getContext().user;(0,vE.default)(e,N)||F.updateUserAsync(N)}catch(e){let t=e;q.error(`Statsig: error while checking/updating user`,{safe:{},sensitive:{error:t}})}},R=[F,N],t[40]=F,t[41]=N,t[42]=L,t[43]=R):(L=t[42],R=t[43]),(0,Q.useEffect)(L,R),I){" +
    "return logo}return provider}";

  const patched = patchCodexStartupPerformanceSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /\(0,Q\.useEffect\)\(L,R\),I&&!F\)\{/);
});

test("startup patch updates index asset in extracted app", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-startup-patch-"));
  try {
    const assets = join(root, "webview", "assets");
    mkdirSync(assets, { recursive: true });
    const asset = join(assets, "index-abc123.js");
    writeFileSync(
      asset,
      "if(t.isLoading)return null;if(r)return null;if(r.isLoading||a||s||h&&_||h&&p&&!m){return logo}" +
        "if(t[40]!==F||t[41]!==N?(L=()=>{if(F!=null)try{let e=F.getContext().user;(0,vE.default)(e,N)||F.updateUserAsync(N)}catch(e){let t=e;q.error(`Statsig: error while checking/updating user`,{safe:{},sensitive:{error:t}})}},R=[F,N],t[40]=F,t[41]=N,t[42]=L,t[43]=R):(L=t[42],R=t[43]),(0,Q.useEffect)(L,R),I){return logo}",
    );
    const result = patchCodexStartupPerformance(root);

    assert.deepEqual(result.patchedFiles, ["webview/assets/index-abc123.js"]);
    const patchedAsset = readFileSync(asset, "utf8");
    assert.match(patchedAsset, /if\(t\.isLoading\)return`app`;/);
    assert.match(patchedAsset, /if\(r\)return`app`;/);
    assert.match(patchedAsset, /if\(r\.isLoading\|\|a\|\|s\|\|h&&_\)\{/);
    assert.match(patchedAsset, /\(0,Q\.useEffect\)\(L,R\),I&&!F\)\{/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("startup patch updates model settings asset for synchronous composer mount", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-startup-model-patch-"));
  try {
    const assets = join(root, "webview", "assets");
    mkdirSync(assets, { recursive: true });
    const asset = join(assets, "use-model-settings-abc123.js");
    writeFileSync(
      asset,
      "function _I({composerController:e,placeholder:t,ariaLabel:n,minHeight:r,disableAutoFocus:i=!1,isFocusComposerTarget:a=!1,singleLine:o=!1,onSubmit:s,onMentionHandler:c,onSkillMentionHandler:l,className:u}){let d=(0,J.useRef)(null);return(0,J.useEffect)(()=>{let t=d.current;if(t==null)throw Error(`RichTextInput rootRef is not mounted`);let n=e.view.dom;return t.appendChild(n),e.view.dom.dataset.virtualkeyboard=`true`,n.style.fontSize=`var(--codex-chat-font-size)`,n.style.height=`auto`,n.style.resize=`none`,()=>{n.blur(),n.parentElement===t&&t.removeChild(n)}},[e]),(0,J.useEffect)(()=>{if(a){e.view.dom.dataset.codexComposer=`true`;return}delete e.view.dom.dataset.codexComposer},[e,a]),(0,J.useEffect)(()=>{i||requestAnimationFrame(()=>{e.focus()})},[e,i])," +
        "(0,J.useEffect)(()=>{let t=e.view.dom;if(n){t.setAttribute(`aria-label`,n);return}t.removeAttribute(`aria-label`)},[n,e]),(0,J.useEffect)(()=>{e.view.dom.style.minHeight=r??`2.5rem`},[e,r]),(0,J.useEffect)(()=>{e.setPlaceholder(t)},[t,e]),",
    );

    const result = patchCodexStartupPerformance(root);

    assert.deepEqual(result.patchedFiles, ["webview/assets/use-model-settings-abc123.js"]);
    const patchedAsset = readFileSync(asset, "utf8");
    assert.match(patchedAsset, /useLayoutEffect/);
    assert.match(patchedAsset, /i\|\|e\.focus\(\)/);
    assert.doesNotMatch(patchedAsset, /requestAnimationFrame\(\(\)=>\{e\.focus\(\)\}\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("startup composer patch gates heavy controls behind the real input", () => {
  const controls =
    "(0,Q.jsx)(az,{onAddImageDataUrls:ds,onAppendPromptText:e=>{Mn.appendText(e)},getAttachmentGen:()=>va.current,setFileAttachments:si,composerMode:Jn,composerInput:Bs,executionTargetCwd:q.cwd,executionTargetHostId:q.hostId,isSingleLineLayout:as,showHotkeyWindowHomeFooterControls:p,hotkeyWindowHomeOverflowMenu:v,conversationId:G,isAutoContextOn:Ur,setIsAutoContextOn:Br,ideContextStatus:qr,permissionsHostId:lr,permissionsCwdOverride:ur,submitButtonMode:Co,canStopFromEscape:To,isResponseInProgress:u,isQueueingEnabled:Zt,isSubmitting:Nt,onStop:x,submitBlockReason:yo,disabledReason:bo,emptySubmitTooltipNonce:ha,handleSubmit:ns,voiceControls:is})";
  const source = `function before(){}var RU=\`new-conversation\`;function render(){return ${controls}}`;

  const patched = patchCodexStartupComposerSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /function __codexStartupInputGate/);
  assert.match(patched.source, /fallback:Bs,children:\(0,Q\.jsx\)\(az,\{/);
  assert.match(patched.source, /var RU=`new-conversation`;/);

  const secondPass = patchCodexStartupComposerSource(patched.source);
  assert.equal(secondPass.changed, false);
});

test("startup composer patch defers the status menu sibling", () => {
  const statusMenu =
    "(0,Q.jsx)(nV,{composerMode:Jn,currentLocalExecutionCwd:hr,currentLocalExecutionHostId:or,effectiveIdeContextStatus:qr,effectiveIsAutoContextOn:Ur,resolvedCwd:Cn,setIsAutoContextOn:Br,setIsStatusMenuOpen:at,skillLookupRoots:Wi})";
  const source = `function render(){return (0,Q.jsxs)(Q.Fragment,{children:[${statusMenu},(0,Q.jsx)("div",{})]})}`;

  const patched = patchCodexStartupComposerSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /\(globalThis\.performance\?\.now\?\.\(\)\?\?1\/0\)<6e3\?null:/);
  assert.match(patched.source, /children:\[\(\(globalThis\.performance/);

  const secondPass = patchCodexStartupComposerSource(patched.source);
  assert.equal(secondPass.changed, false);
});

test("startup patch updates composer asset for minimal real input commit", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-startup-composer-patch-"));
  try {
    const assets = join(root, "webview", "assets");
    mkdirSync(assets, { recursive: true });
    const asset = join(assets, "composer-abc123.js");
    writeFileSync(
      asset,
      "var RU=`new-conversation`;function render(){return (0,Q.jsx)(az,{onAddImageDataUrls:ds,onAppendPromptText:e=>{Mn.appendText(e)},getAttachmentGen:()=>va.current,setFileAttachments:si,composerMode:Jn,composerInput:Bs,executionTargetCwd:q.cwd,executionTargetHostId:q.hostId,isSingleLineLayout:as,showHotkeyWindowHomeFooterControls:p,hotkeyWindowHomeOverflowMenu:v,conversationId:G,isAutoContextOn:Ur,setIsAutoContextOn:Br,ideContextStatus:qr,permissionsHostId:lr,permissionsCwdOverride:ur,submitButtonMode:Co,canStopFromEscape:To,isResponseInProgress:u,isQueueingEnabled:Zt,isSubmitting:Nt,onStop:x,submitBlockReason:yo,disabledReason:bo,emptySubmitTooltipNonce:ha,handleSubmit:ns,voiceControls:is})}",
    );

    const result = patchCodexStartupPerformance(root);

    assert.deepEqual(result.patchedFiles, ["webview/assets/composer-abc123.js"]);
    const patchedAsset = readFileSync(asset, "utf8");
    assert.match(patchedAsset, /function __codexStartupInputGate/);
    assert.match(patchedAsset, /fallback:Bs,children:\(0,Q\.jsx\)\(az,\{/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("startup html patch does not install a fake composer shell", () => {
  const source = `<!doctype html>
<html lang="en">
  <head>
    <style>
      #root { width: 100%; }
    </style>
    <link rel="modulepreload" crossorigin href="./assets/index.js">
    <link rel="stylesheet" crossorigin href="./assets/app.css">
    <script type="module" crossorigin src="./assets/index.js"></script>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'sha256-existing'; style-src 'self' 'unsafe-inline';">
</head>
  <body tabindex="0" style="outline: none">
    <div id="root">
      <div class="startup-loader" aria-hidden="true"></div>
    </div>
  </body>
</html>`;

  const patched = patchCodexStartupHtmlSource(source);

  assert.equal(patched.changed, true);
  assert.doesNotMatch(patched.source, /codex-optimistic-startup/);
  assert.doesNotMatch(patched.source, /id="codex-optimistic-composer"/);
  assert.doesNotMatch(patched.source, /data-codex-composer/);
  assert.doesNotMatch(patched.source, /contenteditable="true"/);
  assert.match(patched.source, /class="startup-loader"/);
  assert.doesNotMatch(patched.source, /data-codex-defer-css/);
  assert.doesNotMatch(patched.source, /rel="modulepreload"/);
  assert.match(patched.source, /<link rel="stylesheet" crossorigin href="\.\/assets\/app\.css">/);

  const secondPass = patchCodexStartupHtmlSource(patched.source);
  assert.equal(secondPass.changed, false);
});

test("startup html patch removes prior optimistic composer shell", () => {
  const source = `<!doctype html>
<html lang="en">
  <head>
    <style>.codex-optimistic-startup { color: #111; }</style>
  <meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;self&#39;; style-src &#39;self&#39; &#39;unsafe-inline&#39;;">
    <script>(() => {
  const composerSelector = "[data-codex-composer]";
})();</script>
</head>
  <body>
    <div id="root">
      <div id="codex-optimistic-shell" class="codex-optimistic-startup">
        <div id="codex-optimistic-composer" data-codex-composer contenteditable="true"></div>
      </div>
    </div>
  </body>
</html>`;

  const patched = patchCodexStartupHtmlSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /class="startup-loader"/);
  assert.doesNotMatch(patched.source, /id="codex-optimistic-composer"/);
  assert.doesNotMatch(patched.source, /data-codex-composer/);
  assert.doesNotMatch(patched.source, /contenteditable="true"/);
});

test("startup html patch cleans partial optimistic installs", () => {
  const partial = `<!doctype html>
<html lang="en">
  <head>
    <style>.codex-optimistic-startup { color: #111; }</style>
  <meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;self&#39;; style-src &#39;self&#39; &#39;unsafe-inline&#39;;">
    <script>(() => {
  const composerSelector = "[data-codex-composer]";
})();</script>
</head>
  <body>
    <div id="root">
      <div class="startup-loader" aria-hidden="true"></div>
    </div>
  </body>
</html>`;

  const patched = patchCodexStartupHtmlSource(partial);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /class="startup-loader"/);
  assert.doesNotMatch(patched.source, /id="codex-optimistic-composer"/);
  assert.doesNotMatch(patched.source, /data-codex-composer/);
});

test("startup html patch restores stylesheets from the old deferred-css patch", () => {
  const source = `<!doctype html>
<html lang="en">
  <head>
    <style>.codex-optimistic-startup { color: #111; }</style>
    <link rel="stylesheet" crossorigin href="./assets/app.css" media="print" data-codex-defer-css>
  <meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;self&#39;; style-src &#39;self&#39; &#39;unsafe-inline&#39;;">
    <script>(() => {
  const composerSelector = "[data-codex-composer]";
})();</script>
</head>
  <body>
    <div id="root">
      <div id="codex-optimistic-shell" class="codex-optimistic-startup">
        <div id="codex-optimistic-composer" data-codex-composer contenteditable="true"></div>
      </div>
    </div>
  </body>
</html>`;

  const patched = patchCodexStartupHtmlSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /<link rel="stylesheet" crossorigin href="\.\/assets\/app\.css">/);
  assert.doesNotMatch(patched.source, /data-codex-defer-css/);
  assert.doesNotMatch(patched.source, /id="codex-optimistic-composer"/);
});

test("startup source patch defers main-process warmers", () => {
  const source =
    "class C{constructor(){this.bundledSkillsRoot=yv();" +
    "t.F({refresh:!1,preferWsl:rv,bundledRepoRoot:this.bundledSkillsRoot,appServerClient:this.appServerClient}).catch(e=>{J().warning(`Failed to warm recommended skills cache`,{safe:{},sensitive:{error:e}})})" +
    "this.disposables.add(this.fetchHandler.startPrimaryRuntimeUpdatePolling());}}" +
    "function createWindow(){let j=new n.BrowserWindow({...process.platform===`win32`?{autoHideMenuBar:!0}:{},...A==null?{}:{backgroundMaterial:A},...v,webPreferences:O})}" +
    "function services(){return{ensureHostWindow:async e=>{let t=C.getPrimaryWindow(e);if(t)return t;return P({hostId:e,show:e!==B})}}}" +
    "function startup(){DD({isWindows:E,disableQuitConfirmationPrompt:process.env.CODEX_ELECTRON_DISABLE_QUIT_CONFIRMATION===`1`,quitState:F,windows:M,applicationMenuManager:z.applicationMenuManager,ensureHostWindow:M.ensureHostWindow,hotkeyWindowLifecycleManager:M.hotkeyWindowLifecycleManager,globalDictationLifecycleManager:M.globalDictationLifecycleManager,globalStatesByHostId:j.globalStatesByHostId,flushAndDisposeContexts:R.flushAndDisposeContexts,disposables:k,appEvent:L.appEvent,errorReporter:g}),A=Date.now(),wN(j.globalState);let he=R.getOrCreateContext(R.localHost);}" +
    "async function EN(){A=Date.now(),await Hl(),w(`shell environment hydrated`,A);let j=JD({moduleDir:__dirname});" +
    "await ue.waitForPendingReconcile(),w(`bundled plugins reconcile checked`,A,{isMacOS:T}),A=Date.now();let be=await M.ensureHostWindow(B);}";

  const patched = patchCodexMainStartupResourceSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /setTimeout\(\(\)=>\{t\.F\(/);
  assert.match(patched.source, /setTimeout\(\(\)=>\{this\.disposables\.add\(this\.fetchHandler\.startPrimaryRuntimeUpdatePolling\(\)\)\},1e4\)/);
  assert.match(patched.source, /ue\.waitForPendingReconcile\(\)\.then/);
  assert.doesNotMatch(patched.source, /await ue\.waitForPendingReconcile/);
  assert.match(patched.source, /E\|\|Hl\(\)\.then\(\(\)=>w\(`shell environment hydrated`,A\)\)/);
  assert.doesNotMatch(patched.source, /await Hl\(\)/);
  assert.match(patched.source, /\.\.\.process\.platform===`win32`\?\{\}:A==null\?\{\}:\{backgroundMaterial:A\}/);
  assert.match(patched.source, /P\(\{hostId:e,show:!0\}\)/);
  assert.doesNotMatch(patched.source, /show:e!==B/);
  assert.match(patched.source, /M\.ensureHostWindow\(B\)\.catch/);
  assert.match(patched.source, /Early host window creation failed/);
});

test("startup source patch leaves strict mode renderer wrapper unchanged", () => {
  const source =
    "var Jj=document.getElementById(`root`);if(!Jj)throw Error(`Root container not found`);" +
    "async function Zj(){await Qj(),Xj.render((0,$.jsx)(Q.StrictMode,{children:(0,$.jsx)(Ij,{})}))}async function Qj(){}";

  const patched = patchCodexStartupPerformanceSource(source);

  assert.equal(patched.changed, false);
  assert.match(patched.source, /StrictMode/);
});
