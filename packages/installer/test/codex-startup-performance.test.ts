import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  patchCodexMainStartupResourceSource,
  patchCodexStartupHtmlSource,
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

test("startup html patch installs an optimistic focused composer shell", () => {
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
  assert.match(patched.source, /codex-optimistic-startup/);
  assert.match(patched.source, /id="codex-optimistic-composer"/);
  assert.match(patched.source, /data-codex-composer/);
  assert.match(patched.source, /contenteditable="true"/);
  assert.doesNotMatch(patched.source, /class="startup-loader"/);
  assert.doesNotMatch(patched.source, /data-codex-defer-css/);
  assert.match(patched.source, /<link rel="stylesheet" crossorigin href="\.\/assets\/app\.css">/);
  assert.match(patched.source, /script-src[^"]*'sha256-[^']+' 'sha256-existing'/);
  assert.ok(
    patched.source.indexOf('id="codex-optimistic-composer"') <
      patched.source.indexOf('<script type="module" crossorigin src="./assets/index.js"></script>'),
  );
  assert.ok(
    patched.source.indexOf('id="codex-optimistic-composer"') <
      patched.source.indexOf('<link rel="stylesheet" crossorigin href="./assets/app.css">'),
  );

  const secondPass = patchCodexStartupHtmlSource(patched.source);
  assert.equal(secondPass.changed, false);
});

test("startup html patch handles encoded CSP quotes and repairs bad prior hash insertion", () => {
  const source = `<!doctype html>
<html lang="en">
  <head>
    <style></style>
  <meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;self&#39; &#39;sha256-existing&#39; &#39;wasm-unsafe-eval&#39;; style-src &#39;self&#39; &#39;unsafe-inline&#39;;">
</head>
  <body>
    <div id="root"><div class="startup-loader"></div></div>
  </body>
</html>`;

  const patched = patchCodexStartupHtmlSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /script-src &#39;self&#39; &#39;sha256-/);
  assert.doesNotMatch(patched.source, /script-src &#39 'sha256-/);

  const broken = patched.source.replace(
    /script-src &#39;self&#39; (&#39;sha256-[^&]+&#39;)/,
    "script-src &#39 $1;self&#39;",
  );
  const repaired = patchCodexStartupHtmlSource(broken);

  assert.equal(repaired.changed, true);
  assert.match(repaired.source, /script-src &#39;self&#39; &#39;sha256-/);
  assert.doesNotMatch(repaired.source, /script-src &#39 'sha256-/);
});

test("startup html patch repairs partial installs that only have optimistic css", () => {
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
  assert.match(patched.source, /id="codex-optimistic-composer"/);
  assert.doesNotMatch(patched.source, /class="startup-loader"/);
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

test("startup source patch removes strict mode renderer wrapper", () => {
  const source =
    "var Jj=document.getElementById(`root`);if(!Jj)throw Error(`Root container not found`);" +
    "async function Zj(){await Qj(),Xj.render((0,$.jsx)(Q.StrictMode,{children:(0,$.jsx)(Ij,{})}))}async function Qj(){}";

  const patched = patchCodexStartupPerformanceSource(source);

  assert.equal(patched.changed, true);
  assert.match(patched.source, /function Zj\(\)\{Xj\.render\(\(0,\$\.jsx\)\(Ij,\{\}\)\)\}/);
  assert.doesNotMatch(patched.source, /StrictMode/);
});
