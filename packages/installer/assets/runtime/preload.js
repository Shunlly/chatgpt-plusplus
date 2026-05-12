"use strict";

// src/preload/index.ts
var import_electron4 = require("electron");

// src/preload/react-hook.ts
function installReactHook() {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
  const renderers = /* @__PURE__ */ new Map();
  let nextId = 1;
  const listeners = /* @__PURE__ */ new Map();
  const hook = {
    supportsFiber: true,
    renderers,
    inject(renderer) {
      const id = nextId++;
      renderers.set(id, renderer);
      console.debug(
        "[codex-plusplus] React renderer attached:",
        renderer.rendererPackageName,
        renderer.version
      );
      return id;
    },
    on(event, fn) {
      let s = listeners.get(event);
      if (!s) listeners.set(event, s = /* @__PURE__ */ new Set());
      s.add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, ...args) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    onCommitFiberRoot() {
    },
    onCommitFiberUnmount() {
    },
    onScheduleFiberRoot() {
    },
    checkDCE() {
    }
  };
  Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
    configurable: true,
    enumerable: false,
    writable: true,
    // allow real DevTools to overwrite if user installs it
    value: hook
  });
  window.__codexpp__ = { hook, renderers };
}
function fiberForNode(node) {
  const renderers = window.__codexpp__?.renderers;
  if (renderers) {
    for (const r of renderers.values()) {
      const f = r.findFiberByHostInstance?.(node);
      if (f) return f;
    }
  }
  for (const k of Object.keys(node)) {
    if (k.startsWith("__reactFiber")) return node[k];
  }
  return null;
}

// src/preload/settings-injector.ts
var import_electron = require("electron");

// src/tweak-store.ts
var TWEAK_STORE_REVIEW_ISSUE_URL = "https://github.com/b-nnett/codex-plusplus/issues/new";
var GITHUB_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
var FULL_SHA_RE = /^[a-f0-9]{40}$/i;
function normalizeGitHubRepo(input) {
  const raw = input.trim();
  if (!raw) throw new Error("GitHub repo is required");
  const ssh = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i.exec(raw);
  if (ssh) return normalizeRepoPart(ssh[1]);
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    if (url.hostname !== "github.com") throw new Error("Only github.com repositories are supported");
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) throw new Error("GitHub repo URL must include owner and repository");
    return normalizeRepoPart(`${parts[0]}/${parts[1]}`);
  }
  return normalizeRepoPart(raw);
}
function buildTweakPublishIssueUrl(submission) {
  const repo = normalizeGitHubRepo(submission.repo);
  if (!isFullCommitSha(submission.commitSha)) {
    throw new Error("Submission must include the full commit SHA to review");
  }
  const title = `Tweak store review: ${repo}`;
  const body = [
    "## Tweak repo",
    `https://github.com/${repo}`,
    "",
    "## Commit to review",
    submission.commitSha,
    submission.commitUrl,
    "",
    "Do not approve a different commit. If the author pushes changes, ask them to resubmit.",
    "",
    "## Manifest",
    `- id: ${submission.manifest?.id ?? "(not detected)"}`,
    `- name: ${submission.manifest?.name ?? "(not detected)"}`,
    `- version: ${submission.manifest?.version ?? "(not detected)"}`,
    `- description: ${submission.manifest?.description ?? "(not detected)"}`,
    `- iconUrl: ${submission.manifest?.iconUrl ?? "(not detected)"}`,
    "",
    "## Admin checklist",
    "- [ ] manifest.json is valid",
    "- [ ] manifest.iconUrl is usable as the store icon",
    "- [ ] source was reviewed at the exact commit above",
    "- [ ] `store/index.json` entry pins `approvedCommitSha` to the exact commit above"
  ].join("\n");
  const url = new URL(TWEAK_STORE_REVIEW_ISSUE_URL);
  url.searchParams.set("template", "tweak-store-review.md");
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  return url.toString();
}
function isFullCommitSha(value) {
  return FULL_SHA_RE.test(value);
}
function normalizeRepoPart(value) {
  const repo = value.trim().replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  if (!GITHUB_REPO_RE.test(repo)) throw new Error("GitHub repo must be in owner/repo form");
  return repo;
}

// src/preload/settings-injector.ts
var CODEX_PLUSPLUS_RELEASES_URL = "https://github.com/b-nnett/codex-plusplus/releases";
var state = {
  sections: /* @__PURE__ */ new Map(),
  pages: /* @__PURE__ */ new Map(),
  listedTweaks: [],
  outerWrapper: null,
  nativeNavHeader: null,
  navGroup: null,
  navButtons: null,
  pagesGroup: null,
  pagesGroupKey: null,
  panelHost: null,
  observer: null,
  fingerprint: null,
  sidebarDumped: false,
  activePage: null,
  sidebarRoot: null,
  sidebarRestoreHandler: null,
  settingsSurfaceVisible: false,
  settingsSurfaceHideTimer: null,
  tweakStore: null,
  tweakStorePromise: null,
  tweakStoreError: null
};
function plog(msg, extra) {
  import_electron.ipcRenderer.send(
    "codexpp:preload-log",
    "info",
    `[settings-injector] ${msg}${extra === void 0 ? "" : " " + safeStringify(extra)}`
  );
}
function safeStringify(v) {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
function startSettingsInjector() {
  if (state.observer) return;
  const obs = new MutationObserver(() => {
    tryInject();
    maybeDumpDom();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  state.observer = obs;
  window.addEventListener("popstate", onNav);
  window.addEventListener("hashchange", onNav);
  document.addEventListener("click", onDocumentClick, true);
  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function(...args) {
      const r = orig.apply(this, args);
      window.dispatchEvent(new Event(`codexpp-${m}`));
      return r;
    };
    window.addEventListener(`codexpp-${m}`, onNav);
  }
  tryInject();
  maybeDumpDom();
  let ticks = 0;
  const interval = setInterval(() => {
    ticks++;
    tryInject();
    maybeDumpDom();
    if (ticks > 60) clearInterval(interval);
  }, 500);
}
function onNav() {
  state.fingerprint = null;
  tryInject();
  maybeDumpDom();
}
function onDocumentClick(e) {
  const target = e.target instanceof Element ? e.target : null;
  const control = target?.closest("[role='link'],button,a");
  if (!(control instanceof HTMLElement)) return;
  if (compactSettingsText(control.textContent || "") !== "Back to app") return;
  setTimeout(() => {
    setSettingsSurfaceVisible(false, "back-to-app");
  }, 0);
}
function registerSection(section) {
  state.sections.set(section.id, section);
  if (state.activePage?.kind === "tweaks") rerender();
  return {
    unregister: () => {
      state.sections.delete(section.id);
      if (state.activePage?.kind === "tweaks") rerender();
    }
  };
}
function clearSections() {
  state.sections.clear();
  for (const p of state.pages.values()) {
    try {
      p.teardown?.();
    } catch (e) {
      plog("page teardown failed", { id: p.id, err: String(e) });
    }
  }
  state.pages.clear();
  syncPagesGroup();
  if (state.activePage?.kind === "registered" && !state.pages.has(state.activePage.id)) {
    restoreCodexView();
  } else if (state.activePage?.kind === "tweaks") {
    rerender();
  }
}
function registerPage(tweakId, manifest, page) {
  const id = page.id;
  const entry = { id, tweakId, manifest, page };
  state.pages.set(id, entry);
  plog("registerPage", { id, title: page.title, tweakId });
  syncPagesGroup();
  if (state.activePage?.kind === "registered" && state.activePage.id === id) {
    rerender();
  }
  return {
    unregister: () => {
      const e = state.pages.get(id);
      if (!e) return;
      try {
        e.teardown?.();
      } catch {
      }
      state.pages.delete(id);
      syncPagesGroup();
      if (state.activePage?.kind === "registered" && state.activePage.id === id) {
        restoreCodexView();
      }
    }
  };
}
function setListedTweaks(list) {
  state.listedTweaks = list;
  if (state.activePage?.kind === "tweaks") rerender();
}
function tryInject() {
  removeMisplacedSettingsGroups();
  const itemsGroup = findSidebarItemsGroup();
  if (!itemsGroup) {
    scheduleSettingsSurfaceHidden();
    plog("sidebar not found");
    return;
  }
  if (state.settingsSurfaceHideTimer) {
    clearTimeout(state.settingsSurfaceHideTimer);
    state.settingsSurfaceHideTimer = null;
  }
  setSettingsSurfaceVisible(true, "sidebar-found");
  const outer = itemsGroup.parentElement ?? itemsGroup;
  if (!isSettingsSidebarCandidate(itemsGroup) || !isSettingsSidebarCandidate(outer)) {
    scheduleSettingsSurfaceHidden();
    plog("rejected non-settings sidebar candidate", {
      itemsGroup: describe(itemsGroup),
      outer: describe(outer)
    });
    return;
  }
  state.sidebarRoot = outer;
  syncNativeSettingsHeader(itemsGroup, outer);
  if (state.navGroup && outer.contains(state.navGroup)) {
    syncPagesGroup();
    if (state.activePage !== null) syncCodexNativeNavActive(true);
    return;
  }
  if (state.activePage !== null || state.panelHost !== null) {
    plog("sidebar re-mount detected; clearing stale active state", {
      prevActive: state.activePage
    });
    state.activePage = null;
    state.panelHost = null;
  }
  const existingCodexPpNavGroup = outer.querySelector(':scope > [data-codexpp="nav-group"]') ?? outer.querySelector('[data-codexpp="nav-group"]');
  if (existingCodexPpNavGroup) {
    state.navGroup = existingCodexPpNavGroup;
    state.sidebarRoot = outer;
    syncPagesGroup();
    if (state.activePage !== null) syncCodexNativeNavActive(true);
    return;
  }
  const group = document.createElement("div");
  group.dataset.codexpp = "nav-group";
  group.className = "flex flex-col gap-px";
  group.appendChild(sidebarGroupHeader("Codex++", "pt-3", sidebarReleasesPillButton()));
  const configBtn = makeSidebarItem("Config", configIconSvg());
  const tweaksBtn = makeSidebarItem("Tweaks", tweaksIconSvg());
  const storeBtn = makeSidebarItem("Tweak Store", storeIconSvg());
  appendSidebarStoreUpdateBadge(storeBtn);
  configBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activatePage({ kind: "config" });
  });
  tweaksBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activatePage({ kind: "tweaks" });
  });
  storeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activatePage({ kind: "store" });
  });
  group.appendChild(configBtn);
  group.appendChild(tweaksBtn);
  group.appendChild(storeBtn);
  outer.appendChild(group);
  state.navGroup = group;
  state.navButtons = { config: configBtn, tweaks: tweaksBtn, store: storeBtn };
  plog("nav group injected", { outerTag: outer.tagName });
  syncPagesGroup();
}
function syncNativeSettingsHeader(itemsGroup, outer) {
  if (state.nativeNavHeader && outer.contains(state.nativeNavHeader)) return;
  if (outer === itemsGroup) return;
  const header = sidebarGroupHeader("General");
  header.dataset.codexpp = "native-nav-header";
  outer.insertBefore(header, itemsGroup);
  state.nativeNavHeader = header;
}
function sidebarGroupHeader(text, topPadding = "pt-2", trailing) {
  const header = document.createElement("div");
  header.className = `px-row-x ${topPadding} pb-1 flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-token-description-foreground select-none`;
  const label = document.createElement("span");
  label.className = "truncate";
  label.textContent = text;
  header.appendChild(label);
  if (trailing) header.appendChild(trailing);
  return header;
}
function scheduleSettingsSurfaceHidden() {
  if (!state.settingsSurfaceVisible || state.settingsSurfaceHideTimer) return;
  state.settingsSurfaceHideTimer = setTimeout(() => {
    state.settingsSurfaceHideTimer = null;
    if (findSidebarItemsGroup()) return;
    if (isSettingsTextVisible()) return;
    setSettingsSurfaceVisible(false, "sidebar-not-found");
  }, 1500);
}
function isSettingsTextVisible() {
  return isCodexPpSettingsLabelSet(codexPpSettingsLabelsFrom(document));
}
function compactSettingsText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
var CODEXPP_CORE_SETTINGS_LABELS = [
  "General",
  "\u5E38\u89C4",
  "\u901A\u7528",
  "Appearance",
  "\u5916\u89C2",
  "Configuration",
  "\u914D\u7F6E",
  "\u9ED8\u8BA4\u6743\u9650",
  "Personalization",
  "\u4E2A\u6027\u5316"
].map(normalizeCodexPpSettingsLabel);
var CODEXPP_EXTENDED_SETTINGS_LABELS = [
  "Account",
  "\u8D26\u6237",
  "\u8D26\u53F7",
  "General",
  "\u5E38\u89C4",
  "\u901A\u7528",
  "Appearance",
  "\u5916\u89C2",
  "Configuration",
  "\u914D\u7F6E",
  "\u9ED8\u8BA4\u6743\u9650",
  "Personalization",
  "\u4E2A\u6027\u5316",
  "Keyboard shortcuts",
  "Archived chats",
  "Usage",
  "Computer use",
  "Browser use",
  "MCP servers",
  "MCP Servers",
  "MCP \u670D\u52A1\u5668",
  "Git",
  "Environments",
  "\u73AF\u5883",
  "Cloud Environments",
  "Worktrees",
  "Connections",
  "Plugins",
  "Skills"
].map(normalizeCodexPpSettingsLabel);
function normalizeCodexPpSettingsLabel(value) {
  return compactSettingsText(value).toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();
}
function codexPpControlLabel(el) {
  return normalizeCodexPpSettingsLabel(
    el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || ""
  );
}
function codexPpSettingsLabelsFrom(root) {
  const controls = Array.from(
    root.querySelectorAll("button,a,[role='button'],[role='link']")
  );
  return [
    ...new Set(
      controls.map(codexPpControlLabel).filter(Boolean)
    )
  ];
}
function codexPpSettingsLabelScore(labels) {
  const core = /* @__PURE__ */ new Set();
  const total = /* @__PURE__ */ new Set();
  for (const label of labels) {
    for (const marker of CODEXPP_CORE_SETTINGS_LABELS) {
      if (label === marker || label.includes(marker)) core.add(marker);
    }
    for (const marker of CODEXPP_EXTENDED_SETTINGS_LABELS) {
      if (label === marker || label.includes(marker)) total.add(marker);
    }
  }
  return { core: core.size, total: total.size };
}
function isCodexPpSettingsLabelSet(labels) {
  const score = codexPpSettingsLabelScore(labels);
  return score.core >= 2 && score.total >= 3;
}
function codexPpVisibleBox(el) {
  if (!el.isConnected) return null;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}
function setSettingsSurfaceVisible(visible, reason) {
  if (state.settingsSurfaceVisible === visible) return;
  state.settingsSurfaceVisible = visible;
  if (visible) warmTweakStore();
  try {
    window.__codexppSettingsSurfaceVisible = visible;
    document.documentElement.dataset.codexppSettingsSurface = visible ? "true" : "false";
    window.dispatchEvent(
      new CustomEvent("codexpp:settings-surface", {
        detail: { visible, reason }
      })
    );
  } catch {
  }
  plog("settings surface", { visible, reason, url: location.href });
}
function syncPagesGroup() {
  const outer = state.sidebarRoot;
  if (!outer) return;
  if (!isSettingsSidebarCandidate(outer)) {
    state.sidebarRoot = null;
    state.pagesGroup = null;
    state.pagesGroupKey = null;
    for (const p of state.pages.values()) p.navButton = null;
    return;
  }
  const pages = [...state.pages.values()];
  const desiredKey = pages.length === 0 ? "EMPTY" : pages.map((p) => `${p.id}|${p.page.title}|${p.page.iconSvg ?? ""}`).join("\n");
  const groupAttached = !!state.pagesGroup && outer.contains(state.pagesGroup);
  if (state.pagesGroupKey === desiredKey && (pages.length === 0 ? !groupAttached : groupAttached)) {
    return;
  }
  if (pages.length === 0) {
    if (state.pagesGroup) {
      state.pagesGroup.remove();
      state.pagesGroup = null;
    }
    for (const p of state.pages.values()) p.navButton = null;
    state.pagesGroupKey = desiredKey;
    return;
  }
  let group = state.pagesGroup;
  if (!group || !outer.contains(group)) {
    group = document.createElement("div");
    group.dataset.codexpp = "pages-group";
    group.className = "flex flex-col gap-px";
    group.appendChild(sidebarGroupHeader("Tweaks", "pt-3"));
    outer.appendChild(group);
    state.pagesGroup = group;
  } else {
    while (group.children.length > 1) group.removeChild(group.lastChild);
  }
  for (const p of pages) {
    const icon = p.page.iconSvg ?? defaultPageIconSvg();
    const btn = makeSidebarItem(p.page.title, icon);
    btn.dataset.codexpp = `nav-page-${p.id}`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      activatePage({ kind: "registered", id: p.id });
    });
    p.navButton = btn;
    group.appendChild(btn);
  }
  state.pagesGroupKey = desiredKey;
  plog("pages group synced", {
    count: pages.length,
    ids: pages.map((p) => p.id)
  });
  setNavActive(state.activePage);
}
function makeSidebarItem(label, iconSvg) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.codexpp = `nav-${label.toLowerCase()}`;
  btn.setAttribute("aria-label", label);
  btn.className = "focus-visible:outline-token-border relative px-row-x py-row-y cursor-interaction shrink-0 items-center overflow-hidden rounded-lg text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 gap-2 flex w-full hover:bg-token-list-hover-background font-normal";
  const inner = document.createElement("div");
  inner.className = "flex min-w-0 items-center text-base gap-2 flex-1 text-token-foreground";
  inner.innerHTML = `${iconSvg}<span class="truncate">${label}</span>`;
  btn.appendChild(inner);
  return btn;
}
function appendSidebarStoreUpdateBadge(btn) {
  const inner = btn.firstElementChild;
  if (!inner) return;
  const badge = document.createElement("span");
  badge.dataset.codexppStoreUpdateBadge = "true";
  badge.hidden = true;
  badge.title = "Installed tweaks with approved updates";
  badge.className = "inline-flex shrink-0 items-center justify-center";
  Object.assign(badge.style, {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: "1"
  });
  applyStoreUpdateBadgeStyle(badge, null);
  btn.appendChild(badge);
}
function setNavActive(active) {
  if (state.navButtons) {
    const builtin = active?.kind === "config" ? "config" : active?.kind === "tweaks" ? "tweaks" : active?.kind === "store" ? "store" : null;
    for (const [key, btn] of Object.entries(state.navButtons)) {
      applyNavActive(btn, key === builtin);
    }
  }
  for (const p of state.pages.values()) {
    if (!p.navButton) continue;
    const isActive = active?.kind === "registered" && active.id === p.id;
    applyNavActive(p.navButton, isActive);
  }
  syncCodexNativeNavActive(active !== null);
}
function syncCodexNativeNavActive(mute) {
  if (!mute) return;
  const root = state.sidebarRoot;
  if (!root) return;
  const buttons = Array.from(root.querySelectorAll("button"));
  for (const btn of buttons) {
    if (btn.dataset.codexpp) continue;
    if (btn.getAttribute("aria-current") === "page") {
      btn.removeAttribute("aria-current");
    }
    if (btn.classList.contains("bg-token-list-hover-background")) {
      btn.classList.remove("bg-token-list-hover-background");
      btn.classList.add("hover:bg-token-list-hover-background");
    }
  }
}
function applyNavActive(btn, active) {
  const inner = btn.firstElementChild;
  if (active) {
    btn.classList.remove("hover:bg-token-list-hover-background", "font-normal");
    btn.classList.add("bg-token-list-hover-background");
    btn.setAttribute("aria-current", "page");
    if (inner) {
      inner.classList.remove("text-token-foreground");
      inner.classList.add("text-token-list-active-selection-foreground");
      inner.querySelector("svg")?.classList.add("text-token-list-active-selection-icon-foreground");
    }
  } else {
    btn.classList.add("hover:bg-token-list-hover-background", "font-normal");
    btn.classList.remove("bg-token-list-hover-background");
    btn.removeAttribute("aria-current");
    if (inner) {
      inner.classList.add("text-token-foreground");
      inner.classList.remove("text-token-list-active-selection-foreground");
      inner.querySelector("svg")?.classList.remove("text-token-list-active-selection-icon-foreground");
    }
  }
}
function activatePage(page) {
  const content = findContentArea();
  if (!content) {
    plog("activate: content area not found");
    return;
  }
  state.activePage = page;
  plog("activate", { page });
  for (const child of Array.from(content.children)) {
    if (child.dataset.codexpp === "tweaks-panel") continue;
    if (child.dataset.codexppHidden === void 0) {
      child.dataset.codexppHidden = child.style.display || "";
    }
    child.style.display = "none";
  }
  let panel = content.querySelector('[data-codexpp="tweaks-panel"]');
  if (!panel) {
    panel = document.createElement("div");
    panel.dataset.codexpp = "tweaks-panel";
    panel.style.cssText = "width:100%;height:100%;overflow:auto;";
    content.appendChild(panel);
  }
  panel.style.display = "block";
  state.panelHost = panel;
  rerender();
  setNavActive(page);
  const sidebar = state.sidebarRoot;
  if (sidebar) {
    if (state.sidebarRestoreHandler) {
      sidebar.removeEventListener("click", state.sidebarRestoreHandler, true);
    }
    const handler = (e) => {
      const target = e.target;
      if (!target) return;
      if (state.navGroup?.contains(target)) return;
      if (state.pagesGroup?.contains(target)) return;
      if (target.closest("[data-codexpp-settings-search]")) return;
      restoreCodexView();
    };
    state.sidebarRestoreHandler = handler;
    sidebar.addEventListener("click", handler, true);
  }
}
function restoreCodexView() {
  plog("restore codex view");
  const content = findContentArea();
  if (!content) return;
  if (state.panelHost) state.panelHost.style.display = "none";
  for (const child of Array.from(content.children)) {
    if (child === state.panelHost) continue;
    if (child.dataset.codexppHidden !== void 0) {
      child.style.display = child.dataset.codexppHidden;
      delete child.dataset.codexppHidden;
    }
  }
  state.activePage = null;
  setNavActive(null);
  if (state.sidebarRoot && state.sidebarRestoreHandler) {
    state.sidebarRoot.removeEventListener(
      "click",
      state.sidebarRestoreHandler,
      true
    );
    state.sidebarRestoreHandler = null;
  }
}
function rerender() {
  if (!state.activePage) return;
  const host = state.panelHost;
  if (!host) return;
  host.innerHTML = "";
  const ap = state.activePage;
  if (ap.kind === "registered") {
    const entry = state.pages.get(ap.id);
    if (!entry) {
      restoreCodexView();
      return;
    }
    const root2 = panelShell(entry.page.title, entry.page.description);
    host.appendChild(root2.outer);
    try {
      try {
        entry.teardown?.();
      } catch {
      }
      entry.teardown = null;
      const ret = entry.page.render(root2.sectionsWrap);
      if (typeof ret === "function") entry.teardown = ret;
    } catch (e) {
      const err = document.createElement("div");
      err.className = "text-token-charts-red text-sm";
      err.textContent = `Error rendering page: ${e.message}`;
      root2.sectionsWrap.appendChild(err);
    }
    return;
  }
  const title = ap.kind === "tweaks" ? "Tweaks" : ap.kind === "store" ? "Tweak Store" : "Codex++";
  const subtitle = ap.kind === "tweaks" ? "Manage your installed Codex++ tweaks." : ap.kind === "store" ? "Install reviewed tweaks pinned to approved GitHub commits." : "Checking installed Codex++ version.";
  const root = panelShell(title, subtitle);
  host.appendChild(root.outer);
  if (ap.kind === "tweaks") renderTweaksPage(root.sectionsWrap);
  else if (ap.kind === "store") renderTweakStorePage(root.sectionsWrap, root.headerActions);
  else renderConfigPage(root.sectionsWrap, root.subtitle);
}
function renderConfigPage(sectionsWrap, subtitle) {
  const section = document.createElement("section");
  section.className = "flex flex-col gap-2";
  section.appendChild(sectionTitle("Codex++ Updates"));
  const card = roundedCard();
  card.dataset.codexppConfigCard = "true";
  const loading = rowSimple("Loading update settings", "Checking current Codex++ configuration.");
  card.appendChild(loading);
  section.appendChild(card);
  sectionsWrap.appendChild(section);
  void import_electron.ipcRenderer.invoke("codexpp:get-config").then((config) => {
    if (subtitle) {
      subtitle.textContent = `You have Codex++ ${config.version} installed.`;
    }
    card.textContent = "";
    renderCodexPlusPlusConfig(card, config);
  }).catch((e) => {
    if (subtitle) subtitle.textContent = "Could not load installed Codex++ version.";
    card.textContent = "";
    card.appendChild(rowSimple("Could not load update settings", String(e)));
  });
  const watcher = document.createElement("section");
  watcher.className = "flex flex-col gap-2";
  watcher.appendChild(sectionTitle("Auto-Repair Watcher"));
  const watcherCard = roundedCard();
  watcherCard.appendChild(rowSimple("Checking watcher", "Verifying the updater repair service."));
  watcher.appendChild(watcherCard);
  sectionsWrap.appendChild(watcher);
  renderWatcherHealthCard(watcherCard);
  const maintenance = document.createElement("section");
  maintenance.className = "flex flex-col gap-2";
  maintenance.appendChild(sectionTitle("Maintenance"));
  const maintenanceCard = roundedCard();
  maintenanceCard.appendChild(uninstallRow());
  maintenanceCard.appendChild(reportBugRow());
  maintenance.appendChild(maintenanceCard);
  sectionsWrap.appendChild(maintenance);
}
function renderCodexPlusPlusConfig(card, config) {
  card.appendChild(autoUpdateRow(config));
  card.appendChild(updateChannelRow(config));
  card.appendChild(installationSourceRow(config.installationSource));
  card.appendChild(selfUpdateStatusRow(config.selfUpdate));
  card.appendChild(checkForUpdatesRow(config));
  if (config.updateCheck) card.appendChild(releaseNotesRow(config.updateCheck));
}
function autoUpdateRow(config) {
  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-col gap-1";
  const title = document.createElement("div");
  title.className = "min-w-0 text-sm text-token-text-primary";
  title.textContent = "Automatically refresh Codex++";
  const desc = document.createElement("div");
  desc.className = "text-token-text-secondary min-w-0 text-sm";
  desc.textContent = `Installed version v${config.version}. The watcher checks hourly and can refresh the Codex++ runtime automatically.`;
  left.appendChild(title);
  left.appendChild(desc);
  row.appendChild(left);
  row.appendChild(
    switchControl(config.autoUpdate, async (next) => {
      await import_electron.ipcRenderer.invoke("codexpp:set-auto-update", next);
    })
  );
  return row;
}
function updateChannelRow(config) {
  const row = actionRow("Release channel", updateChannelSummary(config));
  const action = row.querySelector("[data-codexpp-row-actions]");
  const select = document.createElement("select");
  select.className = "h-8 rounded-lg border border-token-border bg-transparent px-2 text-sm text-token-text-primary focus:outline-none";
  for (const [value, label] of [
    ["stable", "Stable"],
    ["prerelease", "Prerelease"],
    ["custom", "Custom"]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = config.updateChannel === value;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    void import_electron.ipcRenderer.invoke("codexpp:set-update-config", { updateChannel: select.value }).then(() => refreshConfigCard(row)).catch((e) => plog("set update channel failed", String(e)));
  });
  action?.appendChild(select);
  if (config.updateChannel === "custom") {
    action?.appendChild(
      compactButton("Edit", () => {
        const repo = window.prompt("GitHub repo", config.updateRepo || "b-nnett/codex-plusplus");
        if (repo === null) return;
        const ref = window.prompt("Git ref", config.updateRef || "main");
        if (ref === null) return;
        void import_electron.ipcRenderer.invoke("codexpp:set-update-config", {
          updateChannel: "custom",
          updateRepo: repo,
          updateRef: ref
        }).then(() => refreshConfigCard(row)).catch((e) => plog("set custom update source failed", String(e)));
      })
    );
  }
  return row;
}
function installationSourceRow(source) {
  return rowSimple("Installation source", `${source.label}: ${source.detail}`);
}
function selfUpdateStatusRow(state2) {
  const row = rowSimple("Last Codex++ update", selfUpdateSummary(state2));
  const left = row.firstElementChild;
  if (left && state2) left.prepend(statusBadge(selfUpdateStatusTone(state2.status), selfUpdateStatusLabel(state2.status)));
  return row;
}
function checkForUpdatesRow(config) {
  const check = config.updateCheck;
  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-col gap-1";
  const title = document.createElement("div");
  title.className = "min-w-0 text-sm text-token-text-primary";
  title.textContent = check?.updateAvailable ? "Codex++ update available" : "Check for Codex++ updates";
  const desc = document.createElement("div");
  desc.className = "text-token-text-secondary min-w-0 text-sm";
  desc.textContent = updateSummary(check);
  left.appendChild(title);
  left.appendChild(desc);
  row.appendChild(left);
  const actions = document.createElement("div");
  actions.className = "flex shrink-0 items-center gap-2";
  if (check?.releaseUrl) {
    actions.appendChild(
      compactButton("Release Notes", () => {
        void import_electron.ipcRenderer.invoke("codexpp:open-external", check.releaseUrl);
      })
    );
  }
  actions.appendChild(
    compactButton("Check Now", () => {
      row.style.opacity = "0.65";
      void import_electron.ipcRenderer.invoke("codexpp:check-codexpp-update", true).then(() => refreshConfigCard(row)).catch((e) => plog("Codex++ release check failed", String(e))).finally(() => {
        row.style.opacity = "";
      });
    })
  );
  actions.appendChild(
    compactButton("Download Update", () => {
      row.style.opacity = "0.65";
      const buttons = actions.querySelectorAll("button");
      buttons.forEach((button2) => button2.disabled = true);
      void import_electron.ipcRenderer.invoke("codexpp:run-codexpp-update").then(() => refreshConfigCard(row)).catch((e) => {
        plog("Codex++ self-update failed", String(e));
        void refreshConfigCard(row);
      }).finally(() => {
        row.style.opacity = "";
        buttons.forEach((button2) => button2.disabled = false);
      });
    })
  );
  row.appendChild(actions);
  return row;
}
function releaseNotesRow(check) {
  const row = document.createElement("div");
  row.className = "flex flex-col gap-2 p-3";
  const title = document.createElement("div");
  title.className = "text-sm text-token-text-primary";
  title.textContent = "Latest release notes";
  row.appendChild(title);
  const body = document.createElement("div");
  body.className = "max-h-60 overflow-auto rounded-md border border-token-border bg-token-foreground/5 p-3 text-sm text-token-text-secondary";
  body.appendChild(renderReleaseNotesMarkdown(check.releaseNotes?.trim() || check.error || "No release notes available."));
  row.appendChild(body);
  return row;
}
function renderReleaseNotesMarkdown(markdown) {
  const root = document.createElement("div");
  root.className = "flex flex-col gap-2";
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  let list = null;
  let codeLines = null;
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const p = document.createElement("p");
    p.className = "m-0 leading-5";
    appendInlineMarkdown(p, paragraph.join(" ").trim());
    root.appendChild(p);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    root.appendChild(list);
    list = null;
  };
  const flushCode = () => {
    if (!codeLines) return;
    const pre = document.createElement("pre");
    pre.className = "m-0 overflow-auto rounded-md border border-token-border bg-token-foreground/10 p-2 text-xs text-token-text-primary";
    const code = document.createElement("code");
    code.textContent = codeLines.join("\n");
    pre.appendChild(code);
    root.appendChild(pre);
    codeLines = null;
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (codeLines) flushCode();
      else {
        flushParagraph();
        flushList();
        codeLines = [];
      }
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const h = document.createElement(heading[1].length === 1 ? "h3" : "h4");
      h.className = "m-0 text-sm font-medium text-token-text-primary";
      appendInlineMarkdown(h, heading[2]);
      root.appendChild(h);
      continue;
    }
    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (unordered || ordered) {
      flushParagraph();
      const wantOrdered = Boolean(ordered);
      if (!list || wantOrdered && list.tagName !== "OL" || !wantOrdered && list.tagName !== "UL") {
        flushList();
        list = document.createElement(wantOrdered ? "ol" : "ul");
        list.className = wantOrdered ? "m-0 list-decimal space-y-1 pl-5 leading-5" : "m-0 list-disc space-y-1 pl-5 leading-5";
      }
      const li = document.createElement("li");
      appendInlineMarkdown(li, (unordered ?? ordered)?.[1] ?? "");
      list.appendChild(li);
      continue;
    }
    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushList();
      const blockquote = document.createElement("blockquote");
      blockquote.className = "m-0 border-l-2 border-token-border pl-3 leading-5";
      appendInlineMarkdown(blockquote, quote[1]);
      root.appendChild(blockquote);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  flushCode();
  return root;
}
function appendInlineMarkdown(parent, text) {
  const pattern = /(`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === void 0) continue;
    appendText(parent, text.slice(lastIndex, match.index));
    if (match[2] !== void 0) {
      const code = document.createElement("code");
      code.className = "rounded border border-token-border bg-token-foreground/10 px-1 py-0.5 text-xs text-token-text-primary";
      code.textContent = match[2];
      parent.appendChild(code);
    } else if (match[3] !== void 0 && match[4] !== void 0) {
      const a = document.createElement("a");
      a.className = "text-token-text-primary underline underline-offset-2";
      a.href = match[4];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = match[3];
      parent.appendChild(a);
    } else if (match[5] !== void 0) {
      const strong = document.createElement("strong");
      strong.className = "font-medium text-token-text-primary";
      strong.textContent = match[5];
      parent.appendChild(strong);
    } else if (match[6] !== void 0) {
      const em = document.createElement("em");
      em.textContent = match[6];
      parent.appendChild(em);
    }
    lastIndex = match.index + match[0].length;
  }
  appendText(parent, text.slice(lastIndex));
}
function appendText(parent, text) {
  if (text) parent.appendChild(document.createTextNode(text));
}
function renderWatcherHealthCard(card) {
  void import_electron.ipcRenderer.invoke("codexpp:get-watcher-health").then((health) => {
    card.textContent = "";
    renderWatcherHealth(card, health);
  }).catch((e) => {
    card.textContent = "";
    card.appendChild(rowSimple("Could not check watcher", String(e)));
  });
}
function renderWatcherHealth(card, health) {
  card.appendChild(watcherSummaryRow(health));
  for (const check of health.checks) {
    if (check.status === "ok") continue;
    card.appendChild(watcherCheckRow(check));
  }
}
function watcherSummaryRow(health) {
  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 items-start gap-3";
  left.appendChild(statusBadge(health.status, health.watcher));
  const stack = document.createElement("div");
  stack.className = "flex min-w-0 flex-col gap-1";
  const title = document.createElement("div");
  title.className = "min-w-0 text-sm text-token-text-primary";
  title.textContent = health.title;
  const desc = document.createElement("div");
  desc.className = "text-token-text-secondary min-w-0 text-sm";
  desc.textContent = `${health.summary} Checked ${new Date(health.checkedAt).toLocaleString()}.`;
  stack.appendChild(title);
  stack.appendChild(desc);
  left.appendChild(stack);
  row.appendChild(left);
  const action = document.createElement("div");
  action.className = "flex shrink-0 items-center gap-2";
  action.appendChild(
    compactButton("Check Now", () => {
      const card = row.parentElement;
      if (!card) return;
      card.textContent = "";
      card.appendChild(rowSimple("Checking watcher", "Verifying the updater repair service."));
      renderWatcherHealthCard(card);
    })
  );
  row.appendChild(action);
  return row;
}
function watcherCheckRow(check) {
  const row = rowSimple(check.name, check.detail);
  const left = row.firstElementChild;
  if (left) left.prepend(statusBadge(check.status));
  return row;
}
function statusBadge(status, label) {
  const badge = document.createElement("span");
  const tone = status === "ok" ? "border-token-charts-green text-token-charts-green" : status === "warn" ? "border-token-charts-yellow text-token-charts-yellow" : "border-token-charts-red text-token-charts-red";
  badge.className = `inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`;
  badge.textContent = label || (status === "ok" ? "OK" : status === "warn" ? "Review" : "Error");
  return badge;
}
function updateSummary(check) {
  if (!check) return "No update check has run yet.";
  const latest = check.latestVersion ? `Latest v${check.latestVersion}. ` : "";
  const checked = `Checked ${new Date(check.checkedAt).toLocaleString()}.`;
  if (check.error) return `${latest}${checked} ${check.error}`;
  return `${latest}${checked}`;
}
function updateChannelSummary(config) {
  if (config.updateChannel === "custom") {
    return `${config.updateRepo || "b-nnett/codex-plusplus"} ${config.updateRef || "(no ref set)"}`;
  }
  if (config.updateChannel === "prerelease") {
    return "Use the newest published GitHub release, including prereleases.";
  }
  return "Use the latest stable GitHub release.";
}
function selfUpdateSummary(state2) {
  if (!state2) return "No automatic Codex++ update has run yet.";
  const checked = new Date(state2.completedAt ?? state2.checkedAt).toLocaleString();
  const target = state2.latestVersion ? ` Target v${state2.latestVersion}.` : state2.targetRef ? ` Target ${state2.targetRef}.` : "";
  const source = state2.installationSource?.label ?? "unknown source";
  if (state2.status === "failed") return `Failed ${checked}.${target} ${state2.error ?? "Unknown error"}`;
  if (state2.status === "updated") return `Updated ${checked}.${target} Source: ${source}.`;
  if (state2.status === "up-to-date") return `Up to date ${checked}.${target} Source: ${source}.`;
  if (state2.status === "disabled") return `Skipped ${checked}; automatic refresh is disabled.`;
  return `Checking for updates. Source: ${source}.`;
}
function selfUpdateStatusTone(status) {
  if (status === "failed") return "error";
  if (status === "disabled" || status === "checking") return "warn";
  return "ok";
}
function selfUpdateStatusLabel(status) {
  if (status === "up-to-date") return "Up to date";
  if (status === "updated") return "Updated";
  if (status === "failed") return "Failed";
  if (status === "disabled") return "Disabled";
  return "Checking";
}
function refreshConfigCard(row) {
  const card = row.closest("[data-codexpp-config-card]");
  if (!card) return;
  card.textContent = "";
  card.appendChild(rowSimple("Refreshing", "Loading current Codex++ update status."));
  void import_electron.ipcRenderer.invoke("codexpp:get-config").then((config) => {
    card.textContent = "";
    renderCodexPlusPlusConfig(card, config);
  }).catch((e) => {
    card.textContent = "";
    card.appendChild(rowSimple("Could not refresh update settings", String(e)));
  });
}
function uninstallRow() {
  const row = actionRow(
    "Uninstall Codex++",
    "Copies the uninstall command. Run it from a terminal after quitting Codex."
  );
  const action = row.querySelector("[data-codexpp-row-actions]");
  action?.appendChild(
    compactButton("Copy Command", () => {
      void import_electron.ipcRenderer.invoke("codexpp:copy-text", "node ~/.codex-plusplus/source/packages/installer/dist/cli.js uninstall").catch((e) => plog("copy uninstall command failed", String(e)));
    })
  );
  return row;
}
function reportBugRow() {
  const row = actionRow(
    "Report a bug",
    "Open a GitHub issue with runtime, installer, or tweak-manager details."
  );
  const action = row.querySelector("[data-codexpp-row-actions]");
  action?.appendChild(
    compactButton("Open Issue", () => {
      const title = encodeURIComponent("[Bug]: ");
      const body = encodeURIComponent(
        [
          "## What happened?",
          "",
          "## Steps to reproduce",
          "1. ",
          "",
          "## Environment",
          "- Codex++ version: ",
          "- Codex app version: ",
          "- OS: ",
          "",
          "## Logs",
          "Attach relevant lines from the Codex++ log directory."
        ].join("\n")
      );
      void import_electron.ipcRenderer.invoke(
        "codexpp:open-external",
        `https://github.com/b-nnett/codex-plusplus/issues/new?title=${title}&body=${body}`
      );
    })
  );
  return row;
}
function actionRow(titleText, description) {
  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-col gap-1";
  const title = document.createElement("div");
  title.className = "min-w-0 text-sm text-token-text-primary";
  title.textContent = titleText;
  const desc = document.createElement("div");
  desc.className = "text-token-text-secondary min-w-0 text-sm";
  desc.textContent = description;
  left.appendChild(title);
  left.appendChild(desc);
  row.appendChild(left);
  const actions = document.createElement("div");
  actions.dataset.codexppRowActions = "true";
  actions.className = "flex shrink-0 items-center gap-2";
  row.appendChild(actions);
  return row;
}
function renderTweakStorePage(sectionsWrap, headerActions) {
  const section = document.createElement("section");
  section.className = "flex flex-col gap-4";
  const source = document.createElement("span");
  source.hidden = true;
  source.dataset.codexppStoreSource = "true";
  source.textContent = "Loading live registry";
  const actions = document.createElement("div");
  actions.className = "flex shrink-0 items-center gap-2";
  const refreshBtn = storeIconButton(refreshIconSvg(), "Refresh tweak store", () => {
    refreshBtn.disabled = true;
    updateStoreUpdateBadge(null);
    grid.textContent = "";
    renderTweakStoreGhostGrid(grid);
    refreshTweakStoreGrid(grid, source, refreshBtn, true);
  });
  actions.appendChild(refreshBtn);
  actions.appendChild(storeToolbarButton("Publish Tweak", openPublishTweakDialog, "primary"));
  if (headerActions) {
    headerActions.replaceChildren(actions);
  }
  const grid = document.createElement("div");
  grid.dataset.codexppStoreGrid = "true";
  grid.className = "grid gap-4";
  if (state.tweakStore) {
    grid.dataset.codexppStore = JSON.stringify(state.tweakStore);
    renderTweakStoreGrid(grid, source);
  } else {
    renderTweakStoreGhostGrid(grid);
  }
  section.appendChild(source);
  section.appendChild(grid);
  sectionsWrap.appendChild(section);
  refreshTweakStoreGrid(grid, source, refreshBtn);
}
function refreshTweakStoreGrid(grid, source, refreshBtn, force = false) {
  void getTweakStore(force).then((store) => {
    grid.dataset.codexppStore = JSON.stringify(store);
    renderTweakStoreGrid(grid, source);
  }).catch((e) => {
    grid.dataset.codexppStore = "";
    grid.removeAttribute("aria-busy");
    source.textContent = "Live registry unavailable";
    updateStoreUpdateBadge(null);
    grid.textContent = "";
    grid.appendChild(storeMessageCard("Could not load tweak store", String(e)));
  }).finally(() => {
    if (refreshBtn) refreshBtn.disabled = false;
  });
}
function warmTweakStore() {
  if (state.tweakStore || state.tweakStorePromise) return;
  void getTweakStore().then((store) => {
    updateStoreUpdateBadge(outdatedInstalledStoreCount(store.entries));
  });
}
function getTweakStore(force = false) {
  if (!force) {
    if (state.tweakStore) return Promise.resolve(state.tweakStore);
    if (state.tweakStorePromise) return state.tweakStorePromise;
  }
  state.tweakStoreError = null;
  const promise = import_electron.ipcRenderer.invoke("codexpp:get-tweak-store").then((store) => {
    state.tweakStore = store;
    return state.tweakStore;
  }).catch((e) => {
    state.tweakStoreError = e;
    throw e;
  }).finally(() => {
    if (state.tweakStorePromise === promise) state.tweakStorePromise = null;
  });
  state.tweakStorePromise = promise;
  return promise;
}
function renderTweakStoreGrid(grid, source) {
  const store = parseStoreDataset(grid);
  if (!store) return;
  const entries = store.entries;
  grid.removeAttribute("aria-busy");
  source.textContent = `Refreshed ${new Date(store.fetchedAt).toLocaleString()}`;
  updateStoreUpdateBadge(outdatedInstalledStoreCount(entries));
  grid.textContent = "";
  if (store.entries.length === 0) {
    grid.appendChild(storeMessageCard("No tweaks yet", "Use Publish Tweak to submit the first one."));
    return;
  }
  for (const entry of entries) grid.appendChild(tweakStoreCard(entry));
}
function parseStoreDataset(grid) {
  const raw = grid.dataset.codexppStore;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function tweakStoreCard(entry) {
  const shell = tweakStoreCardShell();
  const { card, left, stack, versions, actions } = shell;
  left.insertBefore(storeAvatar(entry), stack);
  const titleRow = tweakStoreTitleRow();
  const title = document.createElement("div");
  title.className = "min-w-0 text-lg font-semibold leading-7 text-token-foreground";
  title.textContent = entry.manifest.name;
  titleRow.appendChild(title);
  titleRow.appendChild(verifiedSafeBadge());
  stack.appendChild(titleRow);
  if (entry.manifest.description) {
    const desc = tweakStoreDescription();
    desc.textContent = entry.manifest.description;
    stack.appendChild(desc);
  }
  stack.appendChild(tweakStoreReadMoreButton(entry.repo));
  versions.appendChild(tweakStoreVersionBadge(entry));
  if (entry.releaseUrl) {
    actions.appendChild(
      compactButton("Release", () => {
        void import_electron.ipcRenderer.invoke("codexpp:open-external", entry.releaseUrl);
      })
    );
  }
  const hasUpdate = !!entry.installed && entry.installed.version !== entry.manifest.version;
  if (entry.installed && !hasUpdate) {
    actions.appendChild(storeStatusPill("Installed"));
  } else if (entry.platform && !entry.platform.compatible) {
    card.classList.add("opacity-70");
    actions.appendChild(storeStatusPill(platformLockedLabel(entry.platform)));
  } else if (entry.runtime && !entry.runtime.compatible) {
    card.classList.add("opacity-70");
    actions.appendChild(storeStatusPill(runtimeLockedLabel(entry.runtime)));
  } else {
    const installLabel = entry.installed ? "Update" : "Install";
    if (hasUpdate) actions.appendChild(storeStatusPill("Update available", "info"));
    const installButton = storeInstallButton(installLabel, (button2) => {
      const grid = card.closest("[data-codexpp-store-grid]");
      const source = grid?.parentElement?.querySelector("[data-codexpp-store-source]");
      showStoreButtonLoading(button2, entry.installed ? "Updating" : "Installing");
      actions.querySelectorAll("button").forEach((button3) => button3.disabled = true);
      void import_electron.ipcRenderer.invoke("codexpp:install-store-tweak", entry.id).then(() => {
        showStoreToast(`${entry.manifest.name} installed.`);
        showStoreButtonInstalled(button2);
        versions.replaceChildren(tweakStoreVersionBadge(entry, entry.manifest.version));
        updateStoreUpdateBadge(Math.max(0, currentStoreUpdateBadgeCount() - 1));
        setTimeout(() => {
          actions.replaceChildren(storeStatusPill("Installed"));
          if (grid && source) refreshTweakStoreGrid(grid, source, void 0, true);
        }, 900);
      }).catch((e) => {
        resetStoreInstallButton(button2, installLabel);
        actions.querySelectorAll("button").forEach((button3) => button3.disabled = false);
        showStoreCardMessage(card, String(e.message ?? e));
      });
    });
    actions.appendChild(installButton);
  }
  return card;
}
function platformLockedLabel(platform) {
  const supported = platform.supported ?? [];
  if (supported.includes("win32")) return "Windows only";
  if (supported.includes("darwin")) return "macOS only";
  if (supported.includes("linux")) return "Linux only";
  return "Unavailable";
}
function runtimeLockedLabel(runtime) {
  return runtime.required ? `Requires Codex++ ${runtime.required}` : "Requires newer Codex++";
}
function showStoreCardMessage(card, message) {
  card.querySelector("[data-codexpp-store-card-message]")?.remove();
  const notice = document.createElement("div");
  notice.dataset.codexppStoreCardMessage = "true";
  notice.className = "rounded-lg border border-token-border/50 bg-token-foreground/5 px-3 py-2 text-sm leading-5 text-token-description-foreground";
  notice.textContent = message;
  const actions = card.lastElementChild;
  if (actions) card.insertBefore(notice, actions);
  else card.appendChild(notice);
}
function tweakStoreCardShell() {
  const card = document.createElement("div");
  card.className = "border-token-border/40 flex min-h-[190px] flex-col justify-between gap-4 rounded-2xl border p-4 transition-colors hover:bg-token-foreground/5";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-1 items-start gap-3";
  const stack = document.createElement("div");
  stack.className = "flex min-w-0 flex-1 flex-col gap-2";
  left.appendChild(stack);
  card.appendChild(left);
  const footer = document.createElement("div");
  footer.className = "mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2";
  const versions = document.createElement("div");
  versions.className = "flex min-w-0 flex-1 items-center gap-2";
  footer.appendChild(versions);
  const actions = document.createElement("div");
  actions.className = "flex shrink-0 items-center justify-end gap-2";
  footer.appendChild(actions);
  card.appendChild(footer);
  return { card, left, stack, versions, actions };
}
function tweakStoreTitleRow() {
  const titleRow = document.createElement("div");
  titleRow.className = "flex min-w-0 items-start justify-between gap-3";
  return titleRow;
}
function tweakStoreDescription() {
  const desc = document.createElement("div");
  desc.className = "line-clamp-3 min-w-0 text-sm leading-5 text-token-text-secondary";
  return desc;
}
function tweakStoreReadMoreButton(repo) {
  const readMore = document.createElement("button");
  readMore.type = "button";
  readMore.className = "inline-flex w-fit items-center gap-1 text-sm font-medium text-token-text-link-foreground hover:underline";
  readMore.innerHTML = `Read More<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5h6.5V10M12.25 3.75 4 12" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  readMore.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void import_electron.ipcRenderer.invoke("codexpp:open-external", `https://github.com/${repo}`);
  });
  return readMore;
}
function renderTweakStoreGhostGrid(grid) {
  grid.setAttribute("aria-busy", "true");
  grid.textContent = "";
  grid.appendChild(tweakStoreGhostCard());
}
function tweakStoreGhostCard() {
  const { card, left, stack, versions, actions } = tweakStoreCardShell();
  card.classList.add("pointer-events-none");
  card.setAttribute("aria-hidden", "true");
  left.insertBefore(storeAvatarGhost(), stack);
  const titleRow = tweakStoreTitleRow();
  const title = document.createElement("div");
  title.className = "min-w-0 text-lg font-semibold leading-7 text-token-foreground";
  title.appendChild(ghostBlock("my-1 h-5 w-44 rounded-md"));
  titleRow.appendChild(title);
  titleRow.appendChild(verifiedSafeGhostBadge());
  stack.appendChild(titleRow);
  const desc = tweakStoreDescription();
  desc.appendChild(ghostBlock("mt-1 h-3 w-full rounded"));
  desc.appendChild(ghostBlock("mt-2 h-3 w-11/12 rounded"));
  desc.appendChild(ghostBlock("mt-2 h-3 w-7/12 rounded"));
  stack.appendChild(desc);
  const readMore = tweakStoreReadMoreButton("");
  readMore.replaceChildren(ghostBlock("h-5 w-24 rounded"));
  stack.appendChild(readMore);
  versions.appendChild(storeVersionGhostBadge());
  actions.appendChild(storeStatusGhostPill());
  return card;
}
function storeAvatarGhost() {
  const avatar = document.createElement("div");
  avatar.className = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-token-border-default bg-transparent text-token-description-foreground";
  avatar.appendChild(ghostBlock("h-full w-full"));
  return avatar;
}
function verifiedSafeGhostBadge() {
  const badge = verifiedSafeBadge();
  badge.replaceChildren(ghostBlock("h-[13px] w-[13px] rounded-sm"), ghostBlock("h-3 w-20 rounded"));
  return badge;
}
function storeStatusGhostPill() {
  const pill = storeStatusPill("Installed");
  pill.classList.add("animate-pulse");
  pill.style.color = "transparent";
  return pill;
}
function storeVersionGhostBadge() {
  const badge = storeVersionBadgeShell(false);
  badge.appendChild(ghostBlock("h-3 w-36 rounded"));
  return badge;
}
function ghostBlock(className) {
  const block = document.createElement("div");
  block.className = `animate-pulse bg-token-foreground/10 ${className}`;
  block.setAttribute("aria-hidden", "true");
  return block;
}
function storeAvatar(entry) {
  const avatar = document.createElement("div");
  avatar.className = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-token-border-default bg-transparent text-token-description-foreground";
  const initial = (entry.manifest.name?.[0] ?? "?").toUpperCase();
  const fallback = document.createElement("span");
  fallback.textContent = initial;
  avatar.appendChild(fallback);
  const iconUrl = storeEntryIconUrl(entry);
  if (iconUrl) {
    const img = document.createElement("img");
    img.alt = "";
    img.className = "h-full w-full object-cover";
    img.style.display = "none";
    img.addEventListener("load", () => {
      fallback.remove();
      img.style.display = "";
    });
    img.addEventListener("error", () => {
      img.remove();
    });
    img.src = iconUrl;
    avatar.appendChild(img);
  }
  return avatar;
}
function storeEntryIconUrl(entry) {
  const iconUrl = entry.manifest.iconUrl?.trim();
  if (!iconUrl) return null;
  if (/^(https?:|data:)/i.test(iconUrl)) return iconUrl;
  const rel = iconUrl.replace(/^\.?\//, "");
  if (!rel || rel.startsWith("../")) return null;
  return `https://raw.githubusercontent.com/${entry.repo}/${entry.approvedCommitSha}/${rel}`;
}
function sidebarReleasesPillButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "user-select-none no-drag cursor-interaction inline-flex shrink-0 items-center justify-center whitespace-nowrap";
  Object.assign(btn.style, {
    height: "20px",
    borderRadius: "9999px",
    border: "0",
    background: "#0A84FF",
    color: "#FFFFFF",
    padding: "0 8px",
    fontSize: "10px",
    fontWeight: "700",
    lineHeight: "20px",
    letterSpacing: "0",
    textTransform: "none",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.18)"
  });
  btn.textContent = "Update";
  btn.title = "Open Codex++ releases";
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#0071E3";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#0A84FF";
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void import_electron.ipcRenderer.invoke("codexpp:open-external", CODEX_PLUSPLUS_RELEASES_URL);
  });
  return btn;
}
function updateStoreUpdateBadge(count) {
  const badge = document.querySelector("[data-codexpp-store-update-badge]");
  if (!badge) return;
  badge.dataset.codexppStoreUpdateCount = count === null ? "" : String(count);
  applyStoreUpdateBadgeStyle(badge, count);
  badge.hidden = count === null || count <= 0;
  badge.textContent = count && count > 0 ? String(count) : "";
  badge.title = count && count > 0 ? `${count} installed tweak${count === 1 ? "" : "s"} can be updated` : "Installed tweaks are up to date";
}
function applyStoreUpdateBadgeStyle(badge, count) {
  const hasUpdates = !!count && count > 0;
  Object.assign(badge.style, {
    minWidth: "24px",
    height: "20px",
    borderRadius: "9999px",
    border: "0",
    background: hasUpdates ? "#0A84FF" : "transparent",
    color: "#FFFFFF",
    padding: "0 7px",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: "20px",
    letterSpacing: "0",
    boxShadow: hasUpdates ? "0 1px 2px rgba(0, 0, 0, 0.22)" : "none"
  });
}
function currentStoreUpdateBadgeCount() {
  const badge = document.querySelector("[data-codexpp-store-update-badge]");
  const raw = badge?.dataset.codexppStoreUpdateCount;
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
function outdatedInstalledStoreCount(entries) {
  return entries.filter((entry) => !!entry.installed && entry.installed.version !== entry.manifest.version).length;
}
function storeToolbarButton(label, onClick, variant = "secondary") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = variant === "primary" ? "border-token-border user-select-none no-drag cursor-interaction flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-token-border bg-token-bg-fog px-2 py-0 text-sm text-token-button-tertiary-foreground enabled:hover:bg-token-list-hover-background disabled:cursor-not-allowed disabled:opacity-40" : "border-token-border user-select-none no-drag cursor-interaction flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-transparent bg-token-foreground/5 px-2 py-0 text-sm text-token-foreground enabled:hover:bg-token-foreground/10 disabled:cursor-not-allowed disabled:opacity-40";
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}
function storeIconButton(iconSvg, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "border-token-border user-select-none no-drag cursor-interaction flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-token-foreground/5 p-0 text-token-foreground enabled:hover:bg-token-foreground/10 disabled:cursor-not-allowed disabled:opacity-40";
  btn.innerHTML = iconSvg;
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}
function refreshIconSvg() {
  return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" class="icon-xs" aria-hidden="true"><path d="M4.4 9.35A5.65 5.65 0 0 1 14 5.3L15.75 7M15.75 3.75V7h-3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.6 10.65A5.65 5.65 0 0 1 6 14.7L4.25 13M4.25 16.25V13H7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function verifiedSafeBadge() {
  const badge = document.createElement("span");
  badge.className = "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-token-border/30 bg-transparent px-2 text-xs font-medium text-token-description-foreground";
  badge.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" class="text-blue-500" aria-hidden="true"><path d="M7 1.75 11.25 3.4v3.2c0 2.6-1.65 4.25-4.25 5.4-2.6-1.15-4.25-2.8-4.25-5.4V3.4L7 1.75Z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M4.85 7.05 6.3 8.45l2.85-3.05" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Verified as safe</span>`;
  return badge;
}
function tweakStoreVersionBadge(entry, installedOverride) {
  const installed = installedOverride ?? entry.installed?.version ?? null;
  const latest = entry.manifest.version;
  const hasUpdate = !!installed && installed !== latest;
  const badge = storeVersionBadgeShell(hasUpdate);
  const label = document.createElement("span");
  label.className = "truncate";
  label.textContent = installed ? `Installed v${installed} \xB7 Latest v${latest}` : `Latest v${latest}`;
  badge.title = installed ? `Installed version ${installed}. Latest approved version ${latest}.` : `Latest approved version ${latest}.`;
  badge.appendChild(label);
  return badge;
}
function storeVersionBadgeShell(hasUpdate) {
  const badge = document.createElement("span");
  badge.className = [
    "inline-flex h-8 min-w-0 max-w-full items-center rounded-lg border px-2.5 text-xs font-medium",
    hasUpdate ? "border-blue-500/30 bg-blue-500/10 text-token-foreground" : "border-token-border/40 bg-token-foreground/5 text-token-description-foreground"
  ].join(" ");
  return badge;
}
function storeStatusPill(label, tone = "neutral") {
  const pill = document.createElement("span");
  pill.className = [
    "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium",
    tone === "info" ? "border border-blue-500/30 bg-blue-500/10 text-token-foreground" : "bg-token-foreground/5 text-token-description-foreground"
  ].join(" ");
  pill.textContent = label;
  return pill;
}
function storeInstallButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = storeInstallButtonClass();
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(btn);
  });
  return btn;
}
function storeInstallButtonClass(extra = "") {
  return [
    "border-token-border user-select-none no-drag cursor-interaction flex h-8 min-w-[82px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-500/40 bg-blue-500 px-3 py-0 text-sm font-medium text-token-foreground shadow-sm transition-colors enabled:hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-80",
    extra
  ].filter(Boolean).join(" ");
}
function showStoreButtonLoading(button2, label) {
  button2.className = storeInstallButtonClass();
  button2.disabled = true;
  button2.setAttribute("aria-busy", "true");
  button2.innerHTML = `<svg class="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="2" opacity=".25"/><path d="M13.5 8A5.5 5.5 0 0 0 8 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${label}</span>`;
}
function showStoreButtonInstalled(button2) {
  button2.className = storeInstallButtonClass("border-blue-500 bg-blue-500");
  button2.disabled = true;
  button2.removeAttribute("aria-busy");
  button2.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.75 8.15 6.65 11 12.25 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Installed</span>`;
}
function resetStoreInstallButton(button2, label) {
  button2.className = storeInstallButtonClass();
  button2.disabled = false;
  button2.removeAttribute("aria-busy");
  button2.textContent = label;
}
function showStoreToast(message) {
  let host = document.querySelector("[data-codexpp-store-toast-host]");
  if (!host) {
    host = document.createElement("div");
    host.dataset.codexppStoreToastHost = "true";
    host.className = "pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = "translate-y-2 rounded-xl border border-token-border/50 bg-token-main-surface-primary px-3 py-2 text-sm font-medium text-token-foreground opacity-0 shadow-lg transition-all duration-200";
  toast.textContent = message;
  host.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });
  setTimeout(() => {
    toast.classList.add("translate-y-2", "opacity-0");
    setTimeout(() => {
      toast.remove();
      if (host && host.childElementCount === 0) host.remove();
    }, 220);
  }, 2600);
}
function storeMessageCard(title, description) {
  const card = document.createElement("div");
  card.className = "border-token-border/40 flex min-h-[84px] flex-col justify-center gap-1 rounded-2xl border p-4 text-sm";
  const t = document.createElement("div");
  t.className = "font-medium text-token-text-primary";
  t.textContent = title;
  card.appendChild(t);
  if (description) {
    const d = document.createElement("div");
    d.className = "text-token-text-secondary";
    d.textContent = description;
    card.appendChild(d);
  }
  return card;
}
function renderTweaksPage(sectionsWrap) {
  const openBtn = openInPlaceButton("Open Tweaks Folder", () => {
    void import_electron.ipcRenderer.invoke("codexpp:reveal", tweaksPath());
  });
  const reloadBtn = openInPlaceButton("Force Reload", () => {
    void import_electron.ipcRenderer.invoke("codexpp:reload-tweaks").catch((e) => plog("force reload (main) failed", String(e))).finally(() => {
      location.reload();
    });
  });
  const reloadSvg = reloadBtn.querySelector("svg");
  if (reloadSvg) {
    reloadSvg.outerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-2xs" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.24-4.24L16 7.5M16 4v3.5h-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10a6 6 0 0 1-10.24 4.24L4 12.5M4 16v-3.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const trailing = document.createElement("div");
  trailing.className = "flex items-center gap-2";
  trailing.appendChild(reloadBtn);
  trailing.appendChild(openBtn);
  if (state.listedTweaks.length === 0) {
    const section = document.createElement("section");
    section.className = "flex flex-col gap-2";
    section.appendChild(sectionTitle("Installed Tweaks", trailing));
    const card2 = roundedCard();
    card2.appendChild(
      rowSimple(
        "No tweaks installed",
        `Drop a tweak folder into ${tweaksPath()} and reload.`
      )
    );
    section.appendChild(card2);
    sectionsWrap.appendChild(section);
    return;
  }
  const sectionsByTweak = /* @__PURE__ */ new Map();
  for (const s of state.sections.values()) {
    const tweakId = s.id.split(":")[0];
    if (!sectionsByTweak.has(tweakId)) sectionsByTweak.set(tweakId, []);
    sectionsByTweak.get(tweakId).push(s);
  }
  const pagesByTweak = /* @__PURE__ */ new Map();
  for (const p of state.pages.values()) {
    if (!pagesByTweak.has(p.tweakId)) pagesByTweak.set(p.tweakId, []);
    pagesByTweak.get(p.tweakId).push(p);
  }
  const wrap = document.createElement("section");
  wrap.className = "flex flex-col gap-2";
  wrap.appendChild(sectionTitle("Installed Tweaks", trailing));
  const card = roundedCard();
  for (const t of state.listedTweaks) {
    card.appendChild(
      tweakRow(
        t,
        sectionsByTweak.get(t.manifest.id) ?? [],
        pagesByTweak.get(t.manifest.id) ?? []
      )
    );
  }
  wrap.appendChild(card);
  sectionsWrap.appendChild(wrap);
}
function tweakRow(t, sections, pages) {
  const m = t.manifest;
  const cell = document.createElement("div");
  cell.className = "flex flex-col";
  if (!t.enabled) cell.style.opacity = "0.7";
  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-1 items-start gap-3";
  const avatar = document.createElement("div");
  avatar.className = "flex shrink-0 items-center justify-center rounded-md border border-token-border overflow-hidden text-token-text-secondary";
  avatar.style.width = "56px";
  avatar.style.height = "56px";
  avatar.style.backgroundColor = "var(--color-token-bg-fog, transparent)";
  if (m.iconUrl) {
    const img = document.createElement("img");
    img.alt = "";
    img.className = "size-full object-contain";
    const initial = (m.name?.[0] ?? "?").toUpperCase();
    const fallback = document.createElement("span");
    fallback.className = "text-xl font-medium";
    fallback.textContent = initial;
    avatar.appendChild(fallback);
    img.style.display = "none";
    img.addEventListener("load", () => {
      fallback.remove();
      img.style.display = "";
    });
    img.addEventListener("error", () => {
      img.remove();
    });
    void resolveIconUrl(m.iconUrl, t.dir).then((url) => {
      if (url) img.src = url;
      else img.remove();
    });
    avatar.appendChild(img);
  } else {
    const initial = (m.name?.[0] ?? "?").toUpperCase();
    const span = document.createElement("span");
    span.className = "text-xl font-medium";
    span.textContent = initial;
    avatar.appendChild(span);
  }
  left.appendChild(avatar);
  const stack = document.createElement("div");
  stack.className = "flex min-w-0 flex-col gap-0.5";
  const titleRow = document.createElement("div");
  titleRow.className = "flex items-center gap-2";
  const name = document.createElement("div");
  name.className = "min-w-0 text-sm font-medium text-token-text-primary";
  name.textContent = m.name;
  titleRow.appendChild(name);
  if (m.version) {
    const ver = document.createElement("span");
    ver.className = "text-token-text-secondary text-xs font-normal tabular-nums";
    ver.textContent = `v${m.version}`;
    titleRow.appendChild(ver);
  }
  if (t.update?.updateAvailable) {
    const badge = document.createElement("span");
    badge.className = "rounded-full border border-token-border bg-token-foreground/5 px-2 py-0.5 text-[11px] font-medium text-token-text-primary";
    badge.textContent = "Update Available";
    titleRow.appendChild(badge);
  }
  stack.appendChild(titleRow);
  if (m.description) {
    const desc = document.createElement("div");
    desc.className = "text-token-text-secondary min-w-0 text-sm";
    desc.textContent = m.description;
    stack.appendChild(desc);
  }
  const meta = document.createElement("div");
  meta.className = "flex items-center gap-2 text-xs text-token-text-secondary";
  const authorEl = renderAuthor(m.author);
  if (authorEl) meta.appendChild(authorEl);
  if (m.githubRepo) {
    if (meta.children.length > 0) meta.appendChild(dot());
    const repo = document.createElement("button");
    repo.type = "button";
    repo.className = "inline-flex text-token-text-link-foreground hover:underline";
    repo.textContent = m.githubRepo;
    repo.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void import_electron.ipcRenderer.invoke("codexpp:open-external", `https://github.com/${m.githubRepo}`);
    });
    meta.appendChild(repo);
  }
  if (m.homepage) {
    if (meta.children.length > 0) meta.appendChild(dot());
    const link = document.createElement("a");
    link.href = m.homepage;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "inline-flex text-token-text-link-foreground hover:underline";
    link.textContent = "Homepage";
    meta.appendChild(link);
  }
  if (meta.children.length > 0) stack.appendChild(meta);
  if (m.tags && m.tags.length > 0) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "flex flex-wrap items-center gap-1 pt-0.5";
    for (const tag of m.tags) {
      const pill = document.createElement("span");
      pill.className = "rounded-full border border-token-border bg-token-foreground/5 px-2 py-0.5 text-[11px] text-token-text-secondary";
      pill.textContent = tag;
      tagsRow.appendChild(pill);
    }
    stack.appendChild(tagsRow);
  }
  left.appendChild(stack);
  header.appendChild(left);
  const right = document.createElement("div");
  right.className = "flex shrink-0 items-center gap-2 pt-0.5";
  if (t.enabled && pages.length > 0) {
    const configureBtn = compactButton("Configure", () => {
      activatePage({ kind: "registered", id: pages[0].id });
    });
    configureBtn.title = pages.length === 1 ? `Open ${pages[0].page.title}` : `Open ${pages.map((p) => p.page.title).join(", ")}`;
    right.appendChild(configureBtn);
  }
  if (t.update?.updateAvailable && t.update.releaseUrl) {
    right.appendChild(
      compactButton("Review Release", () => {
        void import_electron.ipcRenderer.invoke("codexpp:open-external", t.update.releaseUrl);
      })
    );
  }
  right.appendChild(
    switchControl(t.enabled, async (next) => {
      await import_electron.ipcRenderer.invoke("codexpp:set-tweak-enabled", m.id, next);
    })
  );
  header.appendChild(right);
  cell.appendChild(header);
  if (t.enabled && sections.length > 0) {
    const nested = document.createElement("div");
    nested.className = "flex flex-col divide-y-[0.5px] divide-token-border border-t-[0.5px] border-token-border";
    for (const s of sections) {
      const body = document.createElement("div");
      body.className = "p-3";
      try {
        s.render(body);
      } catch (e) {
        body.textContent = `Error rendering tweak section: ${e.message}`;
      }
      nested.appendChild(body);
    }
    cell.appendChild(nested);
  }
  return cell;
}
function renderAuthor(author) {
  if (!author) return null;
  const wrap = document.createElement("span");
  wrap.className = "inline-flex items-center gap-1";
  if (typeof author === "string") {
    wrap.textContent = `by ${author}`;
    return wrap;
  }
  wrap.appendChild(document.createTextNode("by "));
  if (author.url) {
    const a = document.createElement("a");
    a.href = author.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.className = "inline-flex text-token-text-link-foreground hover:underline";
    a.textContent = author.name;
    wrap.appendChild(a);
  } else {
    const span = document.createElement("span");
    span.textContent = author.name;
    wrap.appendChild(span);
  }
  return wrap;
}
function openPublishTweakDialog() {
  const existing = document.querySelector("[data-codexpp-publish-dialog]");
  existing?.remove();
  const overlay = document.createElement("div");
  overlay.dataset.codexppPublishDialog = "true";
  overlay.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4";
  const dialog = document.createElement("div");
  dialog.className = "flex w-full max-w-xl flex-col gap-4 rounded-lg border border-token-border bg-token-main-surface-primary p-4 shadow-xl";
  overlay.appendChild(dialog);
  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-3";
  const titleStack = document.createElement("div");
  titleStack.className = "flex min-w-0 flex-col gap-1";
  const title = document.createElement("div");
  title.className = "text-base font-medium text-token-text-primary";
  title.textContent = "Publish Tweak";
  const subtitle = document.createElement("div");
  subtitle.className = "text-sm text-token-text-secondary";
  subtitle.textContent = "Submit a GitHub repo for admin review. Codex++ records the exact commit admins must review and pin.";
  titleStack.appendChild(title);
  titleStack.appendChild(subtitle);
  header.appendChild(titleStack);
  header.appendChild(compactButton("Dismiss", () => overlay.remove()));
  dialog.appendChild(header);
  const repoInput = document.createElement("input");
  repoInput.type = "text";
  repoInput.placeholder = "owner/repo or https://github.com/owner/repo";
  repoInput.className = "h-10 rounded-lg border border-token-border bg-transparent px-3 text-sm text-token-text-primary focus:outline-none";
  dialog.appendChild(repoInput);
  const status = document.createElement("div");
  status.className = "min-h-5 text-sm text-token-text-secondary";
  status.textContent = "The manifest should include an iconUrl suitable for the store.";
  dialog.appendChild(status);
  const actions = document.createElement("div");
  actions.className = "flex items-center justify-end gap-2";
  const submit = compactButton("Open Review Issue", () => {
    void submitPublishTweak(repoInput, status);
  });
  actions.appendChild(submit);
  dialog.appendChild(actions);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  repoInput.focus();
}
async function submitPublishTweak(repoInput, status) {
  status.className = "min-h-5 text-sm text-token-text-secondary";
  status.textContent = "Resolving the repo commit to review.";
  try {
    const submission = await import_electron.ipcRenderer.invoke(
      "codexpp:prepare-tweak-store-submission",
      repoInput.value
    );
    const url = buildTweakPublishIssueUrl(submission);
    await import_electron.ipcRenderer.invoke("codexpp:open-external", url);
    status.textContent = `GitHub review issue opened for ${submission.commitSha.slice(0, 7)}.`;
  } catch (e) {
    status.className = "min-h-5 text-sm text-token-charts-red";
    status.textContent = String(e.message ?? e);
  }
}
function panelShell(title, subtitle, options) {
  const outer = document.createElement("div");
  outer.className = "main-surface flex h-full min-h-0 flex-col";
  const toolbar = document.createElement("div");
  toolbar.className = "draggable flex items-center px-panel electron:h-toolbar extension:h-toolbar-sm";
  outer.appendChild(toolbar);
  const scroll = document.createElement("div");
  scroll.className = "flex-1 overflow-y-auto p-panel";
  outer.appendChild(scroll);
  const inner = document.createElement("div");
  inner.className = options?.wide ? "mx-auto flex w-full max-w-5xl flex-col electron:min-w-[calc(320px*var(--codex-window-zoom))]" : "mx-auto flex w-full flex-col max-w-2xl electron:min-w-[calc(320px*var(--codex-window-zoom))]";
  scroll.appendChild(inner);
  const headerWrap = document.createElement("div");
  headerWrap.className = "flex items-center justify-between gap-3 pb-panel";
  const headerInner = document.createElement("div");
  headerInner.className = "flex min-w-0 flex-1 flex-col gap-1.5 pb-panel";
  const titleLine = document.createElement("div");
  titleLine.className = "flex min-w-0 items-center gap-2";
  const heading = document.createElement("div");
  heading.className = "electron:heading-lg heading-base truncate";
  heading.textContent = title;
  titleLine.appendChild(heading);
  const headerTitleActions = document.createElement("div");
  headerTitleActions.className = "flex shrink-0 items-center gap-2";
  titleLine.appendChild(headerTitleActions);
  headerInner.appendChild(titleLine);
  let subtitleElement;
  if (subtitle) {
    const sub = document.createElement("div");
    sub.className = "text-token-text-secondary text-sm";
    sub.textContent = subtitle;
    headerInner.appendChild(sub);
    subtitleElement = sub;
  }
  headerWrap.appendChild(headerInner);
  const headerActions = document.createElement("div");
  headerActions.className = "flex shrink-0 items-center gap-2";
  headerWrap.appendChild(headerActions);
  inner.appendChild(headerWrap);
  const sectionsWrap = document.createElement("div");
  sectionsWrap.className = "flex flex-col gap-[var(--padding-panel)]";
  inner.appendChild(sectionsWrap);
  return { outer, sectionsWrap, subtitle: subtitleElement, headerActions, headerTitleActions };
}
function sectionTitle(text, trailing) {
  const titleRow = document.createElement("div");
  titleRow.className = "flex h-toolbar items-center justify-between gap-2 px-0 py-0";
  const titleInner = document.createElement("div");
  titleInner.className = "flex min-w-0 flex-1 flex-col gap-1";
  const t = document.createElement("div");
  t.className = "text-base font-medium text-token-text-primary";
  t.textContent = text;
  titleInner.appendChild(t);
  titleRow.appendChild(titleInner);
  if (trailing) {
    const right = document.createElement("div");
    right.className = "flex items-center gap-2";
    right.appendChild(trailing);
    titleRow.appendChild(right);
  }
  return titleRow;
}
function openInPlaceButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "border-token-border user-select-none no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-lg text-token-description-foreground enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer px-2 py-0 text-base leading-[18px]";
  btn.innerHTML = `${label}<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-2xs" aria-hidden="true"><path d="M14.3349 13.3301V6.60645L5.47065 15.4707C5.21095 15.7304 4.78895 15.7304 4.52925 15.4707C4.26955 15.211 4.26955 14.789 4.52925 14.5293L13.3935 5.66504H6.66011C6.29284 5.66504 5.99507 5.36727 5.99507 5C5.99507 4.63273 6.29284 4.33496 6.66011 4.33496H14.9999L15.1337 4.34863C15.4369 4.41057 15.665 4.67857 15.665 5V13.3301C15.6649 13.6973 15.3672 13.9951 14.9999 13.9951C14.6327 13.9951 14.335 13.6973 14.3349 13.3301Z" fill="currentColor"></path></svg>`;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}
function compactButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "border-token-border user-select-none no-drag cursor-interaction inline-flex h-8 items-center whitespace-nowrap rounded-lg border px-2 text-sm text-token-text-primary enabled:hover:bg-token-list-hover-background disabled:cursor-not-allowed disabled:opacity-40";
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}
function roundedCard() {
  const card = document.createElement("div");
  card.className = "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border";
  card.setAttribute(
    "style",
    "background-color: var(--color-background-panel, var(--color-token-bg-fog));"
  );
  return card;
}
function rowSimple(title, description) {
  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 items-center gap-3";
  const stack = document.createElement("div");
  stack.className = "flex min-w-0 flex-col gap-1";
  if (title) {
    const t = document.createElement("div");
    t.className = "min-w-0 text-sm text-token-text-primary";
    t.textContent = title;
    stack.appendChild(t);
  }
  if (description) {
    const d = document.createElement("div");
    d.className = "text-token-text-secondary min-w-0 text-sm";
    d.textContent = description;
    stack.appendChild(d);
  }
  left.appendChild(stack);
  row.appendChild(left);
  return row;
}
function switchControl(initial, onChange) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("role", "switch");
  const pill = document.createElement("span");
  const knob = document.createElement("span");
  knob.className = "rounded-full border border-[color:var(--gray-0)] bg-[color:var(--gray-0)] shadow-sm transition-transform duration-200 ease-out h-4 w-4";
  pill.appendChild(knob);
  const apply = (on) => {
    btn.setAttribute("aria-checked", String(on));
    btn.dataset.state = on ? "checked" : "unchecked";
    btn.className = "inline-flex items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:rounded-full cursor-interaction";
    pill.className = `relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-out h-5 w-8 ${on ? "bg-token-charts-blue" : "bg-token-foreground/20"}`;
    pill.dataset.state = on ? "checked" : "unchecked";
    knob.dataset.state = on ? "checked" : "unchecked";
    knob.style.transform = on ? "translateX(14px)" : "translateX(2px)";
  };
  apply(initial);
  btn.appendChild(pill);
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = btn.getAttribute("aria-checked") !== "true";
    apply(next);
    btn.disabled = true;
    try {
      await onChange(next);
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}
function dot() {
  const s = document.createElement("span");
  s.className = "text-token-description-foreground";
  s.textContent = "\xB7";
  return s;
}
function configIconSvg() {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true"><path d="M3 5h9M15 5h2M3 10h2M8 10h9M3 15h11M17 15h0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="13" cy="5" r="1.6" fill="currentColor"/><circle cx="6" cy="10" r="1.6" fill="currentColor"/><circle cx="15" cy="15" r="1.6" fill="currentColor"/></svg>`;
}
function tweaksIconSvg() {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true"><path d="M10 2.5 L11.4 8.6 L17.5 10 L11.4 11.4 L10 17.5 L8.6 11.4 L2.5 10 L8.6 8.6 Z" fill="currentColor"/><path d="M15.5 3 L16 5 L18 5.5 L16 6 L15.5 8 L15 6 L13 5.5 L15 5 Z" fill="currentColor" opacity="0.7"/></svg>`;
}
function storeIconSvg() {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true"><path d="M4 8.2 5.1 4.5A1.5 1.5 0 0 1 6.55 3.4h6.9a1.5 1.5 0 0 1 1.45 1.1L16 8.2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4.5 8h11v7.5A1.5 1.5 0 0 1 14 17H6a1.5 1.5 0 0 1-1.5-1.5V8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.5 8v1a2.5 2.5 0 0 0 5 0V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}
function defaultPageIconSvg() {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true"><path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 3v3a1 1 0 0 0 1 1h2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 11h6M7 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}
async function resolveIconUrl(url, tweakDir) {
  if (/^(https?:|data:)/.test(url)) return url;
  const rel = url.startsWith("./") ? url.slice(2) : url;
  try {
    return await import_electron.ipcRenderer.invoke(
      "codexpp:read-tweak-asset",
      tweakDir,
      rel
    );
  } catch (e) {
    plog("icon load failed", { url, tweakDir, err: String(e) });
    return null;
  }
}
function findSidebarItemsGroup() {
  const candidates = Array.from(
    document.querySelectorAll("aside,nav,[role='navigation'],div")
  );
  let best = null;
  let bestScore = -1;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.dataset.codexpp) continue;
    if (!isSettingsSidebarCandidate(candidate)) continue;
    const labels = codexPpSettingsLabelsFrom(candidate);
    const score = codexPpSettingsLabelScore(labels);
    const rect = candidate.getBoundingClientRect();
    const area = rect.width * rect.height;
    const weighted = score.core * 100 + score.total;
    if (weighted > bestScore || weighted === bestScore && area < bestArea) {
      best = candidate;
      bestScore = weighted;
      bestArea = area;
    }
  }
  return best;
}
var FORBIDDEN_SETTINGS_SIDEBAR_SELECTOR = [
  "[data-composer-overlay-floating-ui='true']",
  "[data-codexpp-slash-menu='true']",
  "[data-codexpp-overlay-noise='true']",
  ".composer-home-top-menu",
  ".vertical-scroll-fade-mask",
  "[class*='[container-name:home-main-content]']"
].join(",");
function isForbiddenSettingsSidebarSurface(node) {
  if (!node) return false;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el) return false;
  if (el.closest(FORBIDDEN_SETTINGS_SIDEBAR_SELECTOR)) return true;
  if (el.querySelector("[data-list-navigation-item='true'], [cmdk-item]")) return true;
  return false;
}
function isSettingsSidebarCandidate(el) {
  const rect = codexPpVisibleBox(el);
  if (!rect) return false;
  if (rect.width < 120 || rect.width > 620) return false;
  if (rect.height < 80) return false;
  if (rect.left > window.innerWidth * 0.65) return false;
  return isCodexPpSettingsLabelSet(codexPpSettingsLabelsFrom(el));
}
function removeMisplacedSettingsGroups() {
  const groups = document.querySelectorAll(
    "[data-codexpp='nav-group'], [data-codexpp='pages-group'], [data-codexpp='native-nav-header']"
  );
  for (const group of Array.from(groups)) {
    if (!isForbiddenSettingsSidebarSurface(group)) continue;
    if (state.navGroup === group) state.navGroup = null;
    if (state.pagesGroup === group) {
      state.pagesGroup = null;
      state.pagesGroupKey = null;
    }
    if (state.nativeNavHeader === group) state.nativeNavHeader = null;
    group.remove();
  }
}
function findContentArea() {
  const sidebar = findSidebarItemsGroup();
  if (!sidebar) return null;
  let parent = sidebar.parentElement;
  while (parent) {
    for (const child of Array.from(parent.children)) {
      if (child === sidebar || child.contains(sidebar)) continue;
      const r = child.getBoundingClientRect();
      if (r.width > 300 && r.height > 200) return child;
    }
    parent = parent.parentElement;
  }
  return null;
}
function maybeDumpDom() {
  try {
    const sidebar = findSidebarItemsGroup();
    if (sidebar && !state.sidebarDumped) {
      state.sidebarDumped = true;
      const sbRoot = sidebar.parentElement ?? sidebar;
      plog(`codex sidebar HTML`, sbRoot.outerHTML.slice(0, 32e3));
    }
    const content = findContentArea();
    if (!content) {
      if (state.fingerprint !== location.href) {
        state.fingerprint = location.href;
        plog("dom probe (no content)", {
          url: location.href,
          sidebar: sidebar ? describe(sidebar) : null
        });
      }
      return;
    }
    let panel = null;
    for (const child of Array.from(content.children)) {
      if (child.dataset.codexpp === "tweaks-panel") continue;
      if (child.style.display === "none") continue;
      panel = child;
      break;
    }
    const activeNav = sidebar ? Array.from(sidebar.querySelectorAll("button, a")).find(
      (b) => b.getAttribute("aria-current") === "page" || b.getAttribute("data-active") === "true" || b.getAttribute("aria-selected") === "true" || b.classList.contains("active")
    ) : null;
    const heading = panel?.querySelector(
      "h1, h2, h3, [class*='heading']"
    );
    const fingerprint = `${activeNav?.textContent ?? ""}|${heading?.textContent ?? ""}|${panel?.children.length ?? 0}`;
    if (state.fingerprint === fingerprint) return;
    state.fingerprint = fingerprint;
    plog("dom probe", {
      url: location.href,
      activeNav: activeNav?.textContent?.trim() ?? null,
      heading: heading?.textContent?.trim() ?? null,
      content: describe(content)
    });
    if (panel) {
      const html = panel.outerHTML;
      plog(
        `codex panel HTML (${activeNav?.textContent?.trim() ?? "?"})`,
        html.slice(0, 32e3)
      );
    }
  } catch (e) {
    plog("dom probe failed", String(e));
  }
}
function describe(el) {
  return {
    tag: el.tagName,
    cls: el.className.slice(0, 120),
    id: el.id || void 0,
    children: el.children.length,
    rect: (() => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })()
  };
}
function tweaksPath() {
  return window.__codexpp_tweaks_dir__ ?? "<user dir>/tweaks";
}

// src/preload/tweak-host.ts
var import_electron2 = require("electron");
var loaded = /* @__PURE__ */ new Map();
var cachedPaths = null;
async function startTweakHost() {
  const tweaks = await import_electron2.ipcRenderer.invoke("codexpp:list-tweaks");
  const paths = await import_electron2.ipcRenderer.invoke("codexpp:user-paths");
  cachedPaths = paths;
  setListedTweaks(tweaks);
  window.__codexpp_tweaks_dir__ = paths.tweaksDir;
  for (const t of tweaks) {
    if (t.manifest.scope === "main") continue;
    if (!t.entryExists) continue;
    if (!t.enabled) continue;
    try {
      await loadTweak(t, paths);
    } catch (e) {
      console.error("[codex-plusplus] tweak load failed:", t.manifest.id, e);
      try {
        import_electron2.ipcRenderer.send(
          "codexpp:preload-log",
          "error",
          "tweak load failed: " + t.manifest.id + ": " + String(e?.stack ?? e)
        );
      } catch {
      }
    }
  }
  console.info(
    `[codex-plusplus] renderer host loaded ${loaded.size} tweak(s):`,
    [...loaded.keys()].join(", ") || "(none)"
  );
  import_electron2.ipcRenderer.send(
    "codexpp:preload-log",
    "info",
    `renderer host loaded ${loaded.size} tweak(s): ${[...loaded.keys()].join(", ") || "(none)"}`
  );
}
function teardownTweakHost() {
  for (const [id, t] of loaded) {
    try {
      t.stop?.();
    } catch (e) {
      console.warn("[codex-plusplus] tweak stop failed:", id, e);
    }
  }
  loaded.clear();
  clearSections();
}
async function loadTweak(t, paths) {
  const source = await import_electron2.ipcRenderer.invoke(
    "codexpp:read-tweak-source",
    t.entry
  );
  const module2 = { exports: {} };
  const exports2 = module2.exports;
  const fn = new Function(
    "module",
    "exports",
    "console",
    `${source}
//# sourceURL=codexpp-tweak://${encodeURIComponent(t.manifest.id)}/${encodeURIComponent(t.entry)}`
  );
  fn(module2, exports2, console);
  const mod = module2.exports;
  const tweak = mod.default ?? mod;
  if (typeof tweak?.start !== "function") {
    throw new Error(`tweak ${t.manifest.id} has no start()`);
  }
  const api = makeRendererApi(t.manifest, paths);
  await tweak.start(api);
  loaded.set(t.manifest.id, { stop: tweak.stop?.bind(tweak) });
}
function makeRendererApi(manifest, paths) {
  const id = manifest.id;
  const log = (level, ...a) => {
    const consoleFn = level === "debug" ? console.debug : level === "warn" ? console.warn : level === "error" ? console.error : console.log;
    consoleFn(`[codex-plusplus][${id}]`, ...a);
    try {
      const parts = a.map((v) => {
        if (typeof v === "string") return v;
        if (v instanceof Error) return `${v.name}: ${v.message}`;
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      });
      import_electron2.ipcRenderer.send(
        "codexpp:preload-log",
        level,
        `[tweak ${id}] ${parts.join(" ")}`
      );
    } catch {
    }
  };
  return {
    manifest,
    process: "renderer",
    log: {
      debug: (...a) => log("debug", ...a),
      info: (...a) => log("info", ...a),
      warn: (...a) => log("warn", ...a),
      error: (...a) => log("error", ...a)
    },
    storage: rendererStorage(id),
    settings: {
      register: (s) => registerSection({ ...s, id: `${id}:${s.id}` }),
      registerPage: (p) => registerPage(id, manifest, { ...p, id: `${id}:${p.id}` })
    },
    react: {
      getFiber: (n) => fiberForNode(n),
      findOwnerByName: (n, name) => {
        let f = fiberForNode(n);
        while (f) {
          const t = f.type;
          if (t && (t.displayName === name || t.name === name)) return f;
          f = f.return;
        }
        return null;
      },
      waitForElement: (sel, timeoutMs = 5e3) => new Promise((resolve, reject) => {
        const existing = document.querySelector(sel);
        if (existing) return resolve(existing);
        const deadline = Date.now() + timeoutMs;
        const obs = new MutationObserver(() => {
          const el = document.querySelector(sel);
          if (el) {
            obs.disconnect();
            resolve(el);
          } else if (Date.now() > deadline) {
            obs.disconnect();
            reject(new Error(`timeout waiting for ${sel}`));
          }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
      })
    },
    ipc: {
      on: (c, h) => {
        const wrapped = (_e, ...args) => h(...args);
        import_electron2.ipcRenderer.on(`codexpp:${id}:${c}`, wrapped);
        return () => import_electron2.ipcRenderer.removeListener(`codexpp:${id}:${c}`, wrapped);
      },
      send: (c, ...args) => import_electron2.ipcRenderer.send(`codexpp:${id}:${c}`, ...args),
      invoke: (c, ...args) => import_electron2.ipcRenderer.invoke(`codexpp:${id}:${c}`, ...args)
    },
    fs: rendererFs(id, paths)
  };
}
function rendererStorage(id) {
  const key = `codexpp:storage:${id}`;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  };
  const write = (v) => localStorage.setItem(key, JSON.stringify(v));
  return {
    get: (k, d) => k in read() ? read()[k] : d,
    set: (k, v) => {
      const o = read();
      o[k] = v;
      write(o);
    },
    delete: (k) => {
      const o = read();
      delete o[k];
      write(o);
    },
    all: () => read()
  };
}
function rendererFs(id, _paths) {
  return {
    dataDir: `<remote>/tweak-data/${id}`,
    read: (p) => import_electron2.ipcRenderer.invoke("codexpp:tweak-fs", "read", id, p),
    write: (p, c) => import_electron2.ipcRenderer.invoke("codexpp:tweak-fs", "write", id, p, c),
    exists: (p) => import_electron2.ipcRenderer.invoke("codexpp:tweak-fs", "exists", id, p)
  };
}

// src/preload/manager.ts
var import_electron3 = require("electron");
async function mountManager() {
  const tweaks = await import_electron3.ipcRenderer.invoke("codexpp:list-tweaks");
  const paths = await import_electron3.ipcRenderer.invoke("codexpp:user-paths");
  registerSection({
    id: "codex-plusplus:manager",
    title: "Tweak Manager",
    description: `${tweaks.length} tweak(s) installed. User dir: ${paths.userRoot}`,
    render(root) {
      root.style.cssText = "display:flex;flex-direction:column;gap:8px;";
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
      actions.appendChild(
        button(
          "Open tweaks folder",
          () => import_electron3.ipcRenderer.invoke("codexpp:reveal", paths.tweaksDir).catch(() => {
          })
        )
      );
      actions.appendChild(
        button(
          "Open logs",
          () => import_electron3.ipcRenderer.invoke("codexpp:reveal", paths.logDir).catch(() => {
          })
        )
      );
      actions.appendChild(
        button("Reload window", () => location.reload())
      );
      root.appendChild(actions);
      if (tweaks.length === 0) {
        const empty = document.createElement("p");
        empty.style.cssText = "color:#888;font:13px system-ui;margin:8px 0;";
        empty.textContent = "No user tweaks yet. Drop a folder with manifest.json + index.js into the tweaks dir, then reload.";
        root.appendChild(empty);
        return;
      }
      const list = document.createElement("ul");
      list.style.cssText = "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;";
      for (const t of tweaks) {
        const li = document.createElement("li");
        li.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--border,#2a2a2a);border-radius:6px;";
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
    }
  });
}
function button(label, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = "padding:6px 10px;border:1px solid var(--border,#333);border-radius:6px;background:transparent;color:inherit;font:12px system-ui;cursor:pointer;";
  b.addEventListener("click", onclick);
  return b;
}
function escape(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

// src/preload/index.ts
function fileLog(stage, extra) {
  const msg = `[codex-plusplus preload] ${stage}${extra === void 0 ? "" : " " + safeStringify2(extra)}`;
  try {
    console.error(msg);
  } catch {
  }
  try {
    import_electron4.ipcRenderer.send("codexpp:preload-log", "info", msg);
  } catch {
  }
}
function safeStringify2(v) {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
fileLog("preload entry", { url: location.href });
try {
  installReactHook();
  fileLog("react hook installed");
} catch (e) {
  fileLog("react hook FAILED", String(e));
}
queueMicrotask(() => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
});
async function boot() {
  fileLog("boot start", { readyState: document.readyState });
  try {
    startSettingsInjector();
    fileLog("settings injector started");
    await startTweakHost();
    fileLog("tweak host started");
    await mountManager();
    fileLog("manager mounted");
    subscribeReload();
    fileLog("boot complete");
  } catch (e) {
    fileLog("boot FAILED", String(e?.stack ?? e));
    console.error("[codex-plusplus] preload boot failed:", e);
  }
}
var reloading = null;
function subscribeReload() {
  import_electron4.ipcRenderer.on("codexpp:tweaks-changed", () => {
    if (reloading) return;
    reloading = (async () => {
      try {
        console.info("[codex-plusplus] hot-reloading tweaks");
        teardownTweakHost();
        await startTweakHost();
        await mountManager();
      } catch (e) {
        console.error("[codex-plusplus] hot reload failed:", e);
      } finally {
        reloading = null;
      }
    })();
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3ByZWxvYWQvaW5kZXgudHMiLCAiLi4vc3JjL3ByZWxvYWQvcmVhY3QtaG9vay50cyIsICIuLi9zcmMvcHJlbG9hZC9zZXR0aW5ncy1pbmplY3Rvci50cyIsICIuLi9zcmMvdHdlYWstc3RvcmUudHMiLCAiLi4vc3JjL3ByZWxvYWQvdHdlYWstaG9zdC50cyIsICIuLi9zcmMvcHJlbG9hZC9tYW5hZ2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIFJlbmRlcmVyIHByZWxvYWQgZW50cnkuIFJ1bnMgaW4gYW4gaXNvbGF0ZWQgd29ybGQgYmVmb3JlIENvZGV4J3MgcGFnZSBKUy5cbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAgIDEuIEluc3RhbGwgYSBSZWFjdCBEZXZUb29scy1zaGFwZWQgZ2xvYmFsIGhvb2sgdG8gY2FwdHVyZSB0aGUgcmVuZGVyZXJcbiAqICAgICAgcmVmZXJlbmNlIHdoZW4gUmVhY3QgbW91bnRzLiBXZSB1c2UgdGhpcyBmb3IgZmliZXIgd2Fsa2luZy5cbiAqICAgMi4gQWZ0ZXIgRE9NQ29udGVudExvYWRlZCwga2ljayBvZmYgc2V0dGluZ3MtaW5qZWN0aW9uIGxvZ2ljLlxuICogICAzLiBEaXNjb3ZlciByZW5kZXJlci1zY29wZWQgdHdlYWtzICh2aWEgSVBDIHRvIG1haW4pIGFuZCBzdGFydCB0aGVtLlxuICogICA0LiBMaXN0ZW4gZm9yIGBjb2RleHBwOnR3ZWFrcy1jaGFuZ2VkYCBmcm9tIG1haW4gKGZpbGVzeXN0ZW0gd2F0Y2hlcikgYW5kXG4gKiAgICAgIGhvdC1yZWxvYWQgdHdlYWtzIHdpdGhvdXQgZHJvcHBpbmcgdGhlIHBhZ2UuXG4gKi9cblxuaW1wb3J0IHsgaXBjUmVuZGVyZXIgfSBmcm9tIFwiZWxlY3Ryb25cIjtcbmltcG9ydCB7IGluc3RhbGxSZWFjdEhvb2sgfSBmcm9tIFwiLi9yZWFjdC1ob29rXCI7XG5pbXBvcnQgeyBzdGFydFNldHRpbmdzSW5qZWN0b3IgfSBmcm9tIFwiLi9zZXR0aW5ncy1pbmplY3RvclwiO1xuaW1wb3J0IHsgc3RhcnRUd2Vha0hvc3QsIHRlYXJkb3duVHdlYWtIb3N0IH0gZnJvbSBcIi4vdHdlYWstaG9zdFwiO1xuaW1wb3J0IHsgbW91bnRNYW5hZ2VyIH0gZnJvbSBcIi4vbWFuYWdlclwiO1xuXG4vLyBGaWxlLWxvZyBwcmVsb2FkIHByb2dyZXNzIHNvIHdlIGNhbiBkaWFnbm9zZSB3aXRob3V0IERldlRvb2xzLiBCZXN0LWVmZm9ydDpcbi8vIGZhaWx1cmVzIGhlcmUgbXVzdCBuZXZlciB0aHJvdyBiZWNhdXNlIHdlJ2QgdGFrZSB0aGUgcGFnZSBkb3duIHdpdGggdXMuXG4vL1xuLy8gQ29kZXgncyByZW5kZXJlciBpcyBzYW5kYm94ZWQgKHNhbmRib3g6IHRydWUpLCBzbyBgcmVxdWlyZShcIm5vZGU6ZnNcIilgIGlzXG4vLyB1bmF2YWlsYWJsZS4gV2UgZm9yd2FyZCBsb2cgbGluZXMgdG8gbWFpbiB2aWEgSVBDOyBtYWluIHdyaXRlcyB0aGUgZmlsZS5cbmZ1bmN0aW9uIGZpbGVMb2coc3RhZ2U6IHN0cmluZywgZXh0cmE/OiB1bmtub3duKTogdm9pZCB7XG4gIGNvbnN0IG1zZyA9IGBbY29kZXgtcGx1c3BsdXMgcHJlbG9hZF0gJHtzdGFnZX0ke1xuICAgIGV4dHJhID09PSB1bmRlZmluZWQgPyBcIlwiIDogXCIgXCIgKyBzYWZlU3RyaW5naWZ5KGV4dHJhKVxuICB9YDtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gIH0gY2F0Y2gge31cbiAgdHJ5IHtcbiAgICBpcGNSZW5kZXJlci5zZW5kKFwiY29kZXhwcDpwcmVsb2FkLWxvZ1wiLCBcImluZm9cIiwgbXNnKTtcbiAgfSBjYXRjaCB7fVxufVxuZnVuY3Rpb24gc2FmZVN0cmluZ2lmeSh2OiB1bmtub3duKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyB2IDogSlNPTi5zdHJpbmdpZnkodik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBTdHJpbmcodik7XG4gIH1cbn1cblxuZmlsZUxvZyhcInByZWxvYWQgZW50cnlcIiwgeyB1cmw6IGxvY2F0aW9uLmhyZWYgfSk7XG5cbi8vIFJlYWN0IGhvb2sgbXVzdCBiZSBpbnN0YWxsZWQgKmJlZm9yZSogQ29kZXgncyBidW5kbGUgcnVucy5cbnRyeSB7XG4gIGluc3RhbGxSZWFjdEhvb2soKTtcbiAgZmlsZUxvZyhcInJlYWN0IGhvb2sgaW5zdGFsbGVkXCIpO1xufSBjYXRjaCAoZSkge1xuICBmaWxlTG9nKFwicmVhY3QgaG9vayBGQUlMRURcIiwgU3RyaW5nKGUpKTtcbn1cblxucXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBib290LCB7IG9uY2U6IHRydWUgfSk7XG4gIH0gZWxzZSB7XG4gICAgYm9vdCgpO1xuICB9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gYm9vdCgpIHtcbiAgZmlsZUxvZyhcImJvb3Qgc3RhcnRcIiwgeyByZWFkeVN0YXRlOiBkb2N1bWVudC5yZWFkeVN0YXRlIH0pO1xuICB0cnkge1xuICAgIHN0YXJ0U2V0dGluZ3NJbmplY3RvcigpO1xuICAgIGZpbGVMb2coXCJzZXR0aW5ncyBpbmplY3RvciBzdGFydGVkXCIpO1xuICAgIGF3YWl0IHN0YXJ0VHdlYWtIb3N0KCk7XG4gICAgZmlsZUxvZyhcInR3ZWFrIGhvc3Qgc3RhcnRlZFwiKTtcbiAgICBhd2FpdCBtb3VudE1hbmFnZXIoKTtcbiAgICBmaWxlTG9nKFwibWFuYWdlciBtb3VudGVkXCIpO1xuICAgIHN1YnNjcmliZVJlbG9hZCgpO1xuICAgIGZpbGVMb2coXCJib290IGNvbXBsZXRlXCIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZmlsZUxvZyhcImJvb3QgRkFJTEVEXCIsIFN0cmluZygoZSBhcyBFcnJvcik/LnN0YWNrID8/IGUpKTtcbiAgICBjb25zb2xlLmVycm9yKFwiW2NvZGV4LXBsdXNwbHVzXSBwcmVsb2FkIGJvb3QgZmFpbGVkOlwiLCBlKTtcbiAgfVxufVxuXG4vLyBIb3QgcmVsb2FkOiBnYXRlZCBiZWhpbmQgYSBzbWFsbCBpbi1mbGlnaHQgbG9jayBzbyBhIGZsdXJyeSBvZiBmcyBldmVudHNcbi8vIGRvZXNuJ3QgcmVlbnRyYW50bHkgdGVhciBkb3duIHRoZSBob3N0IG1pZC1sb2FkLlxubGV0IHJlbG9hZGluZzogUHJvbWlzZTx2b2lkPiB8IG51bGwgPSBudWxsO1xuZnVuY3Rpb24gc3Vic2NyaWJlUmVsb2FkKCk6IHZvaWQge1xuICBpcGNSZW5kZXJlci5vbihcImNvZGV4cHA6dHdlYWtzLWNoYW5nZWRcIiwgKCkgPT4ge1xuICAgIGlmIChyZWxvYWRpbmcpIHJldHVybjtcbiAgICByZWxvYWRpbmcgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc29sZS5pbmZvKFwiW2NvZGV4LXBsdXNwbHVzXSBob3QtcmVsb2FkaW5nIHR3ZWFrc1wiKTtcbiAgICAgICAgdGVhcmRvd25Ud2Vha0hvc3QoKTtcbiAgICAgICAgYXdhaXQgc3RhcnRUd2Vha0hvc3QoKTtcbiAgICAgICAgYXdhaXQgbW91bnRNYW5hZ2VyKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbY29kZXgtcGx1c3BsdXNdIGhvdCByZWxvYWQgZmFpbGVkOlwiLCBlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHJlbG9hZGluZyA9IG51bGw7XG4gICAgICB9XG4gICAgfSkoKTtcbiAgfSk7XG59XG4iLCAiLyoqXG4gKiBJbnN0YWxsIGEgbWluaW1hbCBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18uIFJlYWN0IGNhbGxzXG4gKiBgaG9vay5pbmplY3QocmVuZGVyZXJJbnRlcm5hbHMpYCBkdXJpbmcgYGNyZWF0ZVJvb3RgL2BoeWRyYXRlUm9vdGAuIFRoZVxuICogXCJpbnRlcm5hbHNcIiBvYmplY3QgZXhwb3NlcyBmaW5kRmliZXJCeUhvc3RJbnN0YW5jZSwgd2hpY2ggbGV0cyB1cyB0dXJuIGFcbiAqIERPTSBub2RlIGludG8gYSBSZWFjdCBmaWJlciBcdTIwMTQgbmVjZXNzYXJ5IGZvciBvdXIgU2V0dGluZ3MgaW5qZWN0b3IuXG4gKlxuICogV2UgZG9uJ3Qgd2FudCB0byBicmVhayByZWFsIFJlYWN0IERldlRvb2xzIGlmIHRoZSB1c2VyIG9wZW5zIGl0OyB3ZSBpbnN0YWxsXG4gKiBvbmx5IGlmIG5vIGhvb2sgZXhpc3RzIHlldCwgYW5kIHdlIGZvcndhcmQgY2FsbHMgdG8gYSBkb3duc3RyZWFtIGhvb2sgaWZcbiAqIG9uZSBpcyBsYXRlciBhc3NpZ25lZC5cbiAqL1xuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18/OiBSZWFjdERldnRvb2xzSG9vaztcbiAgICBfX2NvZGV4cHBfXz86IHtcbiAgICAgIGhvb2s6IFJlYWN0RGV2dG9vbHNIb29rO1xuICAgICAgcmVuZGVyZXJzOiBNYXA8bnVtYmVyLCBSZW5kZXJlckludGVybmFscz47XG4gICAgfTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgUmVuZGVyZXJJbnRlcm5hbHMge1xuICBmaW5kRmliZXJCeUhvc3RJbnN0YW5jZT86IChuOiBOb2RlKSA9PiB1bmtub3duO1xuICB2ZXJzaW9uPzogc3RyaW5nO1xuICBidW5kbGVUeXBlPzogbnVtYmVyO1xuICByZW5kZXJlclBhY2thZ2VOYW1lPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUmVhY3REZXZ0b29sc0hvb2sge1xuICBzdXBwb3J0c0ZpYmVyOiB0cnVlO1xuICByZW5kZXJlcnM6IE1hcDxudW1iZXIsIFJlbmRlcmVySW50ZXJuYWxzPjtcbiAgb24oZXZlbnQ6IHN0cmluZywgZm46ICguLi5hOiB1bmtub3duW10pID0+IHZvaWQpOiB2b2lkO1xuICBvZmYoZXZlbnQ6IHN0cmluZywgZm46ICguLi5hOiB1bmtub3duW10pID0+IHZvaWQpOiB2b2lkO1xuICBlbWl0KGV2ZW50OiBzdHJpbmcsIC4uLmE6IHVua25vd25bXSk6IHZvaWQ7XG4gIGluamVjdChyZW5kZXJlcjogUmVuZGVyZXJJbnRlcm5hbHMpOiBudW1iZXI7XG4gIG9uU2NoZWR1bGVGaWJlclJvb3Q/KCk6IHZvaWQ7XG4gIG9uQ29tbWl0RmliZXJSb290PygpOiB2b2lkO1xuICBvbkNvbW1pdEZpYmVyVW5tb3VudD8oKTogdm9pZDtcbiAgY2hlY2tEQ0U/KCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnN0YWxsUmVhY3RIb29rKCk6IHZvaWQge1xuICBpZiAod2luZG93Ll9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXykgcmV0dXJuO1xuICBjb25zdCByZW5kZXJlcnMgPSBuZXcgTWFwPG51bWJlciwgUmVuZGVyZXJJbnRlcm5hbHM+KCk7XG4gIGxldCBuZXh0SWQgPSAxO1xuICBjb25zdCBsaXN0ZW5lcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PCguLi5hOiB1bmtub3duW10pID0+IHZvaWQ+PigpO1xuXG4gIGNvbnN0IGhvb2s6IFJlYWN0RGV2dG9vbHNIb29rID0ge1xuICAgIHN1cHBvcnRzRmliZXI6IHRydWUsXG4gICAgcmVuZGVyZXJzLFxuICAgIGluamVjdChyZW5kZXJlcikge1xuICAgICAgY29uc3QgaWQgPSBuZXh0SWQrKztcbiAgICAgIHJlbmRlcmVycy5zZXQoaWQsIHJlbmRlcmVyKTtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLmRlYnVnKFxuICAgICAgICBcIltjb2RleC1wbHVzcGx1c10gUmVhY3QgcmVuZGVyZXIgYXR0YWNoZWQ6XCIsXG4gICAgICAgIHJlbmRlcmVyLnJlbmRlcmVyUGFja2FnZU5hbWUsXG4gICAgICAgIHJlbmRlcmVyLnZlcnNpb24sXG4gICAgICApO1xuICAgICAgcmV0dXJuIGlkO1xuICAgIH0sXG4gICAgb24oZXZlbnQsIGZuKSB7XG4gICAgICBsZXQgcyA9IGxpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgaWYgKCFzKSBsaXN0ZW5lcnMuc2V0KGV2ZW50LCAocyA9IG5ldyBTZXQoKSkpO1xuICAgICAgcy5hZGQoZm4pO1xuICAgIH0sXG4gICAgb2ZmKGV2ZW50LCBmbikge1xuICAgICAgbGlzdGVuZXJzLmdldChldmVudCk/LmRlbGV0ZShmbik7XG4gICAgfSxcbiAgICBlbWl0KGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBsaXN0ZW5lcnMuZ2V0KGV2ZW50KT8uZm9yRWFjaCgoZm4pID0+IGZuKC4uLmFyZ3MpKTtcbiAgICB9LFxuICAgIG9uQ29tbWl0RmliZXJSb290KCkge30sXG4gICAgb25Db21taXRGaWJlclVubW91bnQoKSB7fSxcbiAgICBvblNjaGVkdWxlRmliZXJSb290KCkge30sXG4gICAgY2hlY2tEQ0UoKSB7fSxcbiAgfTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCBcIl9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfX1wiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIHdyaXRhYmxlOiB0cnVlLCAvLyBhbGxvdyByZWFsIERldlRvb2xzIHRvIG92ZXJ3cml0ZSBpZiB1c2VyIGluc3RhbGxzIGl0XG4gICAgdmFsdWU6IGhvb2ssXG4gIH0pO1xuXG4gIHdpbmRvdy5fX2NvZGV4cHBfXyA9IHsgaG9vaywgcmVuZGVyZXJzIH07XG59XG5cbi8qKiBSZXNvbHZlIHRoZSBSZWFjdCBmaWJlciBmb3IgYSBET00gbm9kZSwgaWYgYW55IHJlbmRlcmVyIGhhcyBvbmUuICovXG5leHBvcnQgZnVuY3Rpb24gZmliZXJGb3JOb2RlKG5vZGU6IE5vZGUpOiB1bmtub3duIHwgbnVsbCB7XG4gIGNvbnN0IHJlbmRlcmVycyA9IHdpbmRvdy5fX2NvZGV4cHBfXz8ucmVuZGVyZXJzO1xuICBpZiAocmVuZGVyZXJzKSB7XG4gICAgZm9yIChjb25zdCByIG9mIHJlbmRlcmVycy52YWx1ZXMoKSkge1xuICAgICAgY29uc3QgZiA9IHIuZmluZEZpYmVyQnlIb3N0SW5zdGFuY2U/Lihub2RlKTtcbiAgICAgIGlmIChmKSByZXR1cm4gZjtcbiAgICB9XG4gIH1cbiAgLy8gRmFsbGJhY2s6IHJlYWQgdGhlIFJlYWN0IGludGVybmFsIHByb3BlcnR5IGRpcmVjdGx5IGZyb20gdGhlIERPTSBub2RlLlxuICAvLyBSZWFjdCBzdG9yZXMgZmliZXJzIGFzIGEgcHJvcGVydHkgd2hvc2Uga2V5IHN0YXJ0cyB3aXRoIFwiX19yZWFjdEZpYmVyXCIuXG4gIGZvciAoY29uc3QgayBvZiBPYmplY3Qua2V5cyhub2RlKSkge1xuICAgIGlmIChrLnN0YXJ0c1dpdGgoXCJfX3JlYWN0RmliZXJcIikpIHJldHVybiAobm9kZSBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrXTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbiIsICIvKipcbiAqIFNldHRpbmdzIGluamVjdG9yIGZvciBDb2RleCdzIFNldHRpbmdzIHBhZ2UuXG4gKlxuICogQ29kZXgncyBzZXR0aW5ncyBpcyBhIHJvdXRlZCBwYWdlIChVUkwgc3RheXMgYXQgYC9pbmRleC5odG1sP2hvc3RJZD1sb2NhbGApXG4gKiBOT1QgYSBtb2RhbCBkaWFsb2cuIFRoZSBzaWRlYmFyIGxpdmVzIGluc2lkZSBhIGA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbFxuICogZ2FwLTEgZ2FwLTBcIj5gIHdyYXBwZXIgdGhhdCBob2xkcyBvbmUgb3IgbW9yZSBgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2xcbiAqIGdhcC1weFwiPmAgZ3JvdXBzIG9mIGJ1dHRvbnMuIFRoZXJlIGFyZSBubyBzdGFibGUgYHJvbGVgIC8gYGFyaWEtbGFiZWxgIC9cbiAqIGBkYXRhLXRlc3RpZGAgaG9va3Mgb24gdGhlIHNoZWxsIHNvIHdlIGlkZW50aWZ5IHRoZSBzaWRlYmFyIGJ5IHRleHQtY29udGVudFxuICogbWF0Y2ggYWdhaW5zdCBrbm93biBpdGVtIGxhYmVscyAoR2VuZXJhbCwgQXBwZWFyYW5jZSwgQ29uZmlndXJhdGlvbiwgXHUyMDI2KS5cbiAqXG4gKiBMYXlvdXQgd2UgaW5qZWN0OlxuICpcbiAqICAgR0VORVJBTCAgICAgICAgICAgICAgICAgICAgICAgKHVwcGVyY2FzZSBncm91cCBsYWJlbClcbiAqICAgW0NvZGV4J3MgZXhpc3RpbmcgaXRlbXMgZ3JvdXBdXG4gKiAgIENPREVYKysgICAgICAgICAgICAgICAgICAgICAgICh1cHBlcmNhc2UgZ3JvdXAgbGFiZWwpXG4gKiAgIFx1MjREOCBDb25maWdcbiAqICAgXHUyNjMwIFR3ZWFrc1xuICogICBcdTI1QzcgVHdlYWsgU3RvcmVcbiAqXG4gKiBDbGlja2luZyBDb25maWcgLyBUd2Vha3MgLyBUd2VhayBTdG9yZSBoaWRlcyBDb2RleCdzIGNvbnRlbnQgcGFuZWwgY2hpbGRyZW4gYW5kIHJlbmRlcnNcbiAqIG91ciBvd24gYG1haW4tc3VyZmFjZWAgcGFuZWwgaW4gdGhlaXIgcGxhY2UuIENsaWNraW5nIGFueSBvZiBDb2RleCdzXG4gKiBzaWRlYmFyIGl0ZW1zIHJlc3RvcmVzIHRoZSBvcmlnaW5hbCB2aWV3LlxuICovXG5cbmltcG9ydCB7IGlwY1JlbmRlcmVyIH0gZnJvbSBcImVsZWN0cm9uXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFNldHRpbmdzU2VjdGlvbixcbiAgU2V0dGluZ3NQYWdlLFxuICBTZXR0aW5nc0hhbmRsZSxcbiAgVHdlYWtNYW5pZmVzdCxcbn0gZnJvbSBcIkBjb2RleC1wbHVzcGx1cy9zZGtcIjtcbmltcG9ydCB7XG4gIGJ1aWxkVHdlYWtQdWJsaXNoSXNzdWVVcmwsXG4gIHR5cGUgVHdlYWtTdG9yZUVudHJ5LFxuICB0eXBlIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbixcbn0gZnJvbSBcIi4uL3R3ZWFrLXN0b3JlXCI7XG5cbmNvbnN0IENPREVYX1BMVVNQTFVTX1JFTEVBU0VTX1VSTCA9IFwiaHR0cHM6Ly9naXRodWIuY29tL2Itbm5ldHQvY29kZXgtcGx1c3BsdXMvcmVsZWFzZXNcIjtcblxuLy8gTWlycm9ycyB0aGUgcnVudGltZSdzIG1haW4tc2lkZSBMaXN0ZWRUd2VhayBzaGFwZSAoa2VwdCBpbiBzeW5jIG1hbnVhbGx5KS5cbmludGVyZmFjZSBMaXN0ZWRUd2VhayB7XG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xuICBlbnRyeTogc3RyaW5nO1xuICBkaXI6IHN0cmluZztcbiAgZW50cnlFeGlzdHM6IGJvb2xlYW47XG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIHVwZGF0ZTogVHdlYWtVcGRhdGVDaGVjayB8IG51bGw7XG59XG5cbmludGVyZmFjZSBUd2Vha1VwZGF0ZUNoZWNrIHtcbiAgY2hlY2tlZEF0OiBzdHJpbmc7XG4gIHJlcG86IHN0cmluZztcbiAgY3VycmVudFZlcnNpb246IHN0cmluZztcbiAgbGF0ZXN0VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgbGF0ZXN0VGFnOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlVXJsOiBzdHJpbmcgfCBudWxsO1xuICB1cGRhdGVBdmFpbGFibGU6IGJvb2xlYW47XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgQ29kZXhQbHVzUGx1c0NvbmZpZyB7XG4gIHZlcnNpb246IHN0cmluZztcbiAgYXV0b1VwZGF0ZTogYm9vbGVhbjtcbiAgdXBkYXRlQ2hhbm5lbDogU2VsZlVwZGF0ZUNoYW5uZWw7XG4gIHVwZGF0ZVJlcG86IHN0cmluZztcbiAgdXBkYXRlUmVmOiBzdHJpbmc7XG4gIHVwZGF0ZUNoZWNrOiBDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2sgfCBudWxsO1xuICBzZWxmVXBkYXRlOiBTZWxmVXBkYXRlU3RhdGUgfCBudWxsO1xuICBpbnN0YWxsYXRpb25Tb3VyY2U6IEluc3RhbGxhdGlvblNvdXJjZTtcbn1cblxuaW50ZXJmYWNlIENvZGV4UGx1c1BsdXNVcGRhdGVDaGVjayB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlVXJsOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlTm90ZXM6IHN0cmluZyB8IG51bGw7XG4gIHVwZGF0ZUF2YWlsYWJsZTogYm9vbGVhbjtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbnR5cGUgU2VsZlVwZGF0ZUNoYW5uZWwgPSBcInN0YWJsZVwiIHwgXCJwcmVyZWxlYXNlXCIgfCBcImN1c3RvbVwiO1xudHlwZSBTZWxmVXBkYXRlU3RhdHVzID0gXCJjaGVja2luZ1wiIHwgXCJ1cC10by1kYXRlXCIgfCBcInVwZGF0ZWRcIiB8IFwiZmFpbGVkXCIgfCBcImRpc2FibGVkXCI7XG5cbmludGVyZmFjZSBTZWxmVXBkYXRlU3RhdGUge1xuICBjaGVja2VkQXQ6IHN0cmluZztcbiAgY29tcGxldGVkQXQ/OiBzdHJpbmc7XG4gIHN0YXR1czogU2VsZlVwZGF0ZVN0YXR1cztcbiAgY3VycmVudFZlcnNpb246IHN0cmluZztcbiAgbGF0ZXN0VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgdGFyZ2V0UmVmOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlVXJsOiBzdHJpbmcgfCBudWxsO1xuICByZXBvOiBzdHJpbmc7XG4gIGNoYW5uZWw6IFNlbGZVcGRhdGVDaGFubmVsO1xuICBzb3VyY2VSb290OiBzdHJpbmc7XG4gIGluc3RhbGxhdGlvblNvdXJjZT86IEluc3RhbGxhdGlvblNvdXJjZTtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJbnN0YWxsYXRpb25Tb3VyY2Uge1xuICBraW5kOiBcImdpdGh1Yi1zb3VyY2VcIiB8IFwiaG9tZWJyZXdcIiB8IFwibG9jYWwtZGV2XCIgfCBcInNvdXJjZS1hcmNoaXZlXCIgfCBcInVua25vd25cIjtcbiAgbGFiZWw6IHN0cmluZztcbiAgZGV0YWlsOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBXYXRjaGVySGVhbHRoIHtcbiAgY2hlY2tlZEF0OiBzdHJpbmc7XG4gIHN0YXR1czogXCJva1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHN1bW1hcnk6IHN0cmluZztcbiAgd2F0Y2hlcjogc3RyaW5nO1xuICBjaGVja3M6IFdhdGNoZXJIZWFsdGhDaGVja1tdO1xufVxuXG5pbnRlcmZhY2UgV2F0Y2hlckhlYWx0aENoZWNrIHtcbiAgbmFtZTogc3RyaW5nO1xuICBzdGF0dXM6IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiO1xuICBkZXRhaWw6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFR3ZWFrU3RvcmVSZWdpc3RyeVZpZXcge1xuICBzY2hlbWFWZXJzaW9uOiAxO1xuICBnZW5lcmF0ZWRBdD86IHN0cmluZztcbiAgc291cmNlVXJsOiBzdHJpbmc7XG4gIGZldGNoZWRBdDogc3RyaW5nO1xuICBlbnRyaWVzOiBUd2Vha1N0b3JlRW50cnlWaWV3W107XG59XG5cbmludGVyZmFjZSBUd2Vha1N0b3JlRW50cnlWaWV3IGV4dGVuZHMgVHdlYWtTdG9yZUVudHJ5IHtcbiAgaW5zdGFsbGVkOiB7XG4gICAgdmVyc2lvbjogc3RyaW5nO1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47XG4gIH0gfCBudWxsO1xuICBwbGF0Zm9ybT86IHtcbiAgICBjdXJyZW50OiBzdHJpbmc7XG4gICAgc3VwcG9ydGVkOiBzdHJpbmdbXSB8IG51bGw7XG4gICAgY29tcGF0aWJsZTogYm9vbGVhbjtcbiAgICByZWFzb246IHN0cmluZyB8IG51bGw7XG4gIH07XG4gIHJ1bnRpbWU/OiB7XG4gICAgY3VycmVudDogc3RyaW5nO1xuICAgIHJlcXVpcmVkOiBzdHJpbmcgfCBudWxsO1xuICAgIGNvbXBhdGlibGU6IGJvb2xlYW47XG4gICAgcmVhc29uOiBzdHJpbmcgfCBudWxsO1xuICB9O1xufVxuXG4vKipcbiAqIEEgdHdlYWstcmVnaXN0ZXJlZCBwYWdlLiBXZSBjYXJyeSB0aGUgb3duaW5nIHR3ZWFrJ3MgbWFuaWZlc3Qgc28gd2UgY2FuXG4gKiByZXNvbHZlIHJlbGF0aXZlIGljb25VcmxzIGFuZCBzaG93IGF1dGhvcnNoaXAgaW4gdGhlIHBhZ2UgaGVhZGVyLlxuICovXG5pbnRlcmZhY2UgUmVnaXN0ZXJlZFBhZ2Uge1xuICAvKiogRnVsbHktcXVhbGlmaWVkIGlkOiBgPHR3ZWFrSWQ+OjxwYWdlSWQ+YC4gKi9cbiAgaWQ6IHN0cmluZztcbiAgdHdlYWtJZDogc3RyaW5nO1xuICBtYW5pZmVzdDogVHdlYWtNYW5pZmVzdDtcbiAgcGFnZTogU2V0dGluZ3NQYWdlO1xuICAvKiogUGVyLXBhZ2UgRE9NIHRlYXJkb3duIHJldHVybmVkIGJ5IGBwYWdlLnJlbmRlcmAsIGlmIGFueS4gKi9cbiAgdGVhcmRvd24/OiAoKCkgPT4gdm9pZCkgfCBudWxsO1xuICAvKiogVGhlIGluamVjdGVkIHNpZGViYXIgYnV0dG9uIChzbyB3ZSBjYW4gdXBkYXRlIGl0cyBhY3RpdmUgc3RhdGUpLiAqL1xuICBuYXZCdXR0b24/OiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG59XG5cbi8qKiBXaGF0IHBhZ2UgaXMgY3VycmVudGx5IHNlbGVjdGVkIGluIG91ciBpbmplY3RlZCBuYXYuICovXG50eXBlIEFjdGl2ZVBhZ2UgPVxuICB8IHsga2luZDogXCJjb25maWdcIiB9XG4gIHwgeyBraW5kOiBcInN0b3JlXCIgfVxuICB8IHsga2luZDogXCJ0d2Vha3NcIiB9XG4gIHwgeyBraW5kOiBcInJlZ2lzdGVyZWRcIjsgaWQ6IHN0cmluZyB9O1xuXG5pbnRlcmZhY2UgSW5qZWN0b3JTdGF0ZSB7XG4gIHNlY3Rpb25zOiBNYXA8c3RyaW5nLCBTZXR0aW5nc1NlY3Rpb24+O1xuICBwYWdlczogTWFwPHN0cmluZywgUmVnaXN0ZXJlZFBhZ2U+O1xuICBsaXN0ZWRUd2Vha3M6IExpc3RlZFR3ZWFrW107XG4gIC8qKiBPdXRlciB3cmFwcGVyIHRoYXQgaG9sZHMgQ29kZXgncyBpdGVtcyBncm91cCArIG91ciBpbmplY3RlZCBncm91cHMuICovXG4gIG91dGVyV3JhcHBlcjogSFRNTEVsZW1lbnQgfCBudWxsO1xuICAvKiogT3VyIFwiR2VuZXJhbFwiIGxhYmVsIGZvciBDb2RleCdzIG5hdGl2ZSBzZXR0aW5ncyBncm91cC4gKi9cbiAgbmF0aXZlTmF2SGVhZGVyOiBIVE1MRWxlbWVudCB8IG51bGw7XG4gIC8qKiBPdXIgXCJDb2RleCsrXCIgbmF2IGdyb3VwIChDb25maWcvVHdlYWtzKS4gKi9cbiAgbmF2R3JvdXA6IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgbmF2QnV0dG9uczogeyBjb25maWc6IEhUTUxCdXR0b25FbGVtZW50OyB0d2Vha3M6IEhUTUxCdXR0b25FbGVtZW50OyBzdG9yZTogSFRNTEJ1dHRvbkVsZW1lbnQgfSB8IG51bGw7XG4gIC8qKiBPdXIgXCJUd2Vha3NcIiBuYXYgZ3JvdXAgKHBlci10d2VhayBwYWdlcykuIENyZWF0ZWQgbGF6aWx5LiAqL1xuICBwYWdlc0dyb3VwOiBIVE1MRWxlbWVudCB8IG51bGw7XG4gIHBhZ2VzR3JvdXBLZXk6IHN0cmluZyB8IG51bGw7XG4gIHBhbmVsSG9zdDogSFRNTEVsZW1lbnQgfCBudWxsO1xuICBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGw7XG4gIGZpbmdlcnByaW50OiBzdHJpbmcgfCBudWxsO1xuICBzaWRlYmFyRHVtcGVkOiBib29sZWFuO1xuICBhY3RpdmVQYWdlOiBBY3RpdmVQYWdlIHwgbnVsbDtcbiAgc2lkZWJhclJvb3Q6IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgc2lkZWJhclJlc3RvcmVIYW5kbGVyOiAoKGU6IEV2ZW50KSA9PiB2b2lkKSB8IG51bGw7XG4gIHNldHRpbmdzU3VyZmFjZVZpc2libGU6IGJvb2xlYW47XG4gIHNldHRpbmdzU3VyZmFjZUhpZGVUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsO1xuICB0d2Vha1N0b3JlOiBUd2Vha1N0b3JlUmVnaXN0cnlWaWV3IHwgbnVsbDtcbiAgdHdlYWtTdG9yZVByb21pc2U6IFByb21pc2U8VHdlYWtTdG9yZVJlZ2lzdHJ5Vmlldz4gfCBudWxsO1xuICB0d2Vha1N0b3JlRXJyb3I6IHVua25vd247XG59XG5cbmNvbnN0IHN0YXRlOiBJbmplY3RvclN0YXRlID0ge1xuICBzZWN0aW9uczogbmV3IE1hcCgpLFxuICBwYWdlczogbmV3IE1hcCgpLFxuICBsaXN0ZWRUd2Vha3M6IFtdLFxuICBvdXRlcldyYXBwZXI6IG51bGwsXG4gIG5hdGl2ZU5hdkhlYWRlcjogbnVsbCxcbiAgbmF2R3JvdXA6IG51bGwsXG4gIG5hdkJ1dHRvbnM6IG51bGwsXG4gIHBhZ2VzR3JvdXA6IG51bGwsXG4gIHBhZ2VzR3JvdXBLZXk6IG51bGwsXG4gIHBhbmVsSG9zdDogbnVsbCxcbiAgb2JzZXJ2ZXI6IG51bGwsXG4gIGZpbmdlcnByaW50OiBudWxsLFxuICBzaWRlYmFyRHVtcGVkOiBmYWxzZSxcbiAgYWN0aXZlUGFnZTogbnVsbCxcbiAgc2lkZWJhclJvb3Q6IG51bGwsXG4gIHNpZGViYXJSZXN0b3JlSGFuZGxlcjogbnVsbCxcbiAgc2V0dGluZ3NTdXJmYWNlVmlzaWJsZTogZmFsc2UsXG4gIHNldHRpbmdzU3VyZmFjZUhpZGVUaW1lcjogbnVsbCxcbiAgdHdlYWtTdG9yZTogbnVsbCxcbiAgdHdlYWtTdG9yZVByb21pc2U6IG51bGwsXG4gIHR3ZWFrU3RvcmVFcnJvcjogbnVsbCxcbn07XG5cbmZ1bmN0aW9uIHBsb2cobXNnOiBzdHJpbmcsIGV4dHJhPzogdW5rbm93bik6IHZvaWQge1xuICBpcGNSZW5kZXJlci5zZW5kKFxuICAgIFwiY29kZXhwcDpwcmVsb2FkLWxvZ1wiLFxuICAgIFwiaW5mb1wiLFxuICAgIGBbc2V0dGluZ3MtaW5qZWN0b3JdICR7bXNnfSR7ZXh0cmEgPT09IHVuZGVmaW5lZCA/IFwiXCIgOiBcIiBcIiArIHNhZmVTdHJpbmdpZnkoZXh0cmEpfWAsXG4gICk7XG59XG5mdW5jdGlvbiBzYWZlU3RyaW5naWZ5KHY6IHVua25vd24pOiBzdHJpbmcge1xuICB0cnkge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IHYgOiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFN0cmluZyh2KTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgcHVibGljIEFQSSBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0U2V0dGluZ3NJbmplY3RvcigpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLm9ic2VydmVyKSByZXR1cm47XG5cbiAgY29uc3Qgb2JzID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgIHRyeUluamVjdCgpO1xuICAgIG1heWJlRHVtcERvbSgpO1xuICB9KTtcbiAgb2JzLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgc3RhdGUub2JzZXJ2ZXIgPSBvYnM7XG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCBvbk5hdik7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiaGFzaGNoYW5nZVwiLCBvbk5hdik7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbkRvY3VtZW50Q2xpY2ssIHRydWUpO1xuICBmb3IgKGNvbnN0IG0gb2YgW1wicHVzaFN0YXRlXCIsIFwicmVwbGFjZVN0YXRlXCJdIGFzIGNvbnN0KSB7XG4gICAgY29uc3Qgb3JpZyA9IGhpc3RvcnlbbV07XG4gICAgaGlzdG9yeVttXSA9IGZ1bmN0aW9uICh0aGlzOiBIaXN0b3J5LCAuLi5hcmdzOiBQYXJhbWV0ZXJzPHR5cGVvZiBvcmlnPikge1xuICAgICAgY29uc3QgciA9IG9yaWcuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoYGNvZGV4cHAtJHttfWApKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0gYXMgdHlwZW9mIG9yaWc7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoYGNvZGV4cHAtJHttfWAsIG9uTmF2KTtcbiAgfVxuXG4gIHRyeUluamVjdCgpO1xuICBtYXliZUR1bXBEb20oKTtcbiAgbGV0IHRpY2tzID0gMDtcbiAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgdGlja3MrKztcbiAgICB0cnlJbmplY3QoKTtcbiAgICBtYXliZUR1bXBEb20oKTtcbiAgICBpZiAodGlja3MgPiA2MCkgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gIH0sIDUwMCk7XG59XG5cbmZ1bmN0aW9uIG9uTmF2KCk6IHZvaWQge1xuICBzdGF0ZS5maW5nZXJwcmludCA9IG51bGw7XG4gIHRyeUluamVjdCgpO1xuICBtYXliZUR1bXBEb20oKTtcbn1cblxuZnVuY3Rpb24gb25Eb2N1bWVudENsaWNrKGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50ID8gZS50YXJnZXQgOiBudWxsO1xuICBjb25zdCBjb250cm9sID0gdGFyZ2V0Py5jbG9zZXN0KFwiW3JvbGU9J2xpbmsnXSxidXR0b24sYVwiKTtcbiAgaWYgKCEoY29udHJvbCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkgcmV0dXJuO1xuICBpZiAoY29tcGFjdFNldHRpbmdzVGV4dChjb250cm9sLnRleHRDb250ZW50IHx8IFwiXCIpICE9PSBcIkJhY2sgdG8gYXBwXCIpIHJldHVybjtcbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZShmYWxzZSwgXCJiYWNrLXRvLWFwcFwiKTtcbiAgfSwgMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclNlY3Rpb24oc2VjdGlvbjogU2V0dGluZ3NTZWN0aW9uKTogU2V0dGluZ3NIYW5kbGUge1xuICBzdGF0ZS5zZWN0aW9ucy5zZXQoc2VjdGlvbi5pZCwgc2VjdGlvbik7XG4gIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSByZXJlbmRlcigpO1xuICByZXR1cm4ge1xuICAgIHVucmVnaXN0ZXI6ICgpID0+IHtcbiAgICAgIHN0YXRlLnNlY3Rpb25zLmRlbGV0ZShzZWN0aW9uLmlkKTtcbiAgICAgIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSByZXJlbmRlcigpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGVhclNlY3Rpb25zKCk6IHZvaWQge1xuICBzdGF0ZS5zZWN0aW9ucy5jbGVhcigpO1xuICAvLyBEcm9wIHJlZ2lzdGVyZWQgcGFnZXMgdG9vIFx1MjAxNCB0aGV5J3JlIG93bmVkIGJ5IHR3ZWFrcyB0aGF0IGp1c3QgZ290XG4gIC8vIHRvcm4gZG93biBieSB0aGUgaG9zdC4gUnVuIGFueSB0ZWFyZG93bnMgYmVmb3JlIGZvcmdldHRpbmcgdGhlbS5cbiAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSB7XG4gICAgdHJ5IHtcbiAgICAgIHAudGVhcmRvd24/LigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHBsb2coXCJwYWdlIHRlYXJkb3duIGZhaWxlZFwiLCB7IGlkOiBwLmlkLCBlcnI6IFN0cmluZyhlKSB9KTtcbiAgICB9XG4gIH1cbiAgc3RhdGUucGFnZXMuY2xlYXIoKTtcbiAgc3luY1BhZ2VzR3JvdXAoKTtcbiAgLy8gSWYgd2Ugd2VyZSBvbiBhIHJlZ2lzdGVyZWQgcGFnZSB0aGF0IG5vIGxvbmdlciBleGlzdHMsIGZhbGwgYmFjayB0b1xuICAvLyByZXN0b3JpbmcgQ29kZXgncyB2aWV3LlxuICBpZiAoXG4gICAgc3RhdGUuYWN0aXZlUGFnZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiZcbiAgICAhc3RhdGUucGFnZXMuaGFzKHN0YXRlLmFjdGl2ZVBhZ2UuaWQpXG4gICkge1xuICAgIHJlc3RvcmVDb2RleFZpZXcoKTtcbiAgfSBlbHNlIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSB7XG4gICAgcmVyZW5kZXIoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgdHdlYWstb3duZWQgc2V0dGluZ3MgcGFnZS4gVGhlIHJ1bnRpbWUgaW5qZWN0cyBhIHNpZGViYXIgZW50cnlcbiAqIHVuZGVyIGEgXCJUV0VBS1NcIiBncm91cCBoZWFkZXIgKHdoaWNoIGFwcGVhcnMgb25seSB3aGVuIGF0IGxlYXN0IG9uZSBwYWdlXG4gKiBpcyByZWdpc3RlcmVkKSBhbmQgcm91dGVzIGNsaWNrcyB0byB0aGUgcGFnZSdzIGByZW5kZXIocm9vdClgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJQYWdlKFxuICB0d2Vha0lkOiBzdHJpbmcsXG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0LFxuICBwYWdlOiBTZXR0aW5nc1BhZ2UsXG4pOiBTZXR0aW5nc0hhbmRsZSB7XG4gIGNvbnN0IGlkID0gcGFnZS5pZDsgLy8gYWxyZWFkeSBuYW1lc3BhY2VkIGJ5IHR3ZWFrLWhvc3QgYXMgYCR7dHdlYWtJZH06JHtwYWdlLmlkfWBcbiAgY29uc3QgZW50cnk6IFJlZ2lzdGVyZWRQYWdlID0geyBpZCwgdHdlYWtJZCwgbWFuaWZlc3QsIHBhZ2UgfTtcbiAgc3RhdGUucGFnZXMuc2V0KGlkLCBlbnRyeSk7XG4gIHBsb2coXCJyZWdpc3RlclBhZ2VcIiwgeyBpZCwgdGl0bGU6IHBhZ2UudGl0bGUsIHR3ZWFrSWQgfSk7XG4gIHN5bmNQYWdlc0dyb3VwKCk7XG4gIC8vIElmIHRoZSB1c2VyIHdhcyBhbHJlYWR5IG9uIHRoaXMgcGFnZSAoaG90IHJlbG9hZCksIHJlLW1vdW50IGl0cyBib2R5LlxuICBpZiAoc3RhdGUuYWN0aXZlUGFnZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiYgc3RhdGUuYWN0aXZlUGFnZS5pZCA9PT0gaWQpIHtcbiAgICByZXJlbmRlcigpO1xuICB9XG4gIHJldHVybiB7XG4gICAgdW5yZWdpc3RlcjogKCkgPT4ge1xuICAgICAgY29uc3QgZSA9IHN0YXRlLnBhZ2VzLmdldChpZCk7XG4gICAgICBpZiAoIWUpIHJldHVybjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGUudGVhcmRvd24/LigpO1xuICAgICAgfSBjYXRjaCB7fVxuICAgICAgc3RhdGUucGFnZXMuZGVsZXRlKGlkKTtcbiAgICAgIHN5bmNQYWdlc0dyb3VwKCk7XG4gICAgICBpZiAoc3RhdGUuYWN0aXZlUGFnZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiYgc3RhdGUuYWN0aXZlUGFnZS5pZCA9PT0gaWQpIHtcbiAgICAgICAgcmVzdG9yZUNvZGV4VmlldygpO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG5cbi8qKiBDYWxsZWQgYnkgdGhlIHR3ZWFrIGhvc3QgYWZ0ZXIgZmV0Y2hpbmcgdGhlIHR3ZWFrIGxpc3QgZnJvbSBtYWluLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldExpc3RlZFR3ZWFrcyhsaXN0OiBMaXN0ZWRUd2Vha1tdKTogdm9pZCB7XG4gIHN0YXRlLmxpc3RlZFR3ZWFrcyA9IGxpc3Q7XG4gIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSByZXJlbmRlcigpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgaW5qZWN0aW9uIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiB0cnlJbmplY3QoKTogdm9pZCB7XG4gIHJlbW92ZU1pc3BsYWNlZFNldHRpbmdzR3JvdXBzKCk7XG5cbiAgY29uc3QgaXRlbXNHcm91cCA9IGZpbmRTaWRlYmFySXRlbXNHcm91cCgpO1xuICBpZiAoIWl0ZW1zR3JvdXApIHtcbiAgICBzY2hlZHVsZVNldHRpbmdzU3VyZmFjZUhpZGRlbigpO1xuICAgIHBsb2coXCJzaWRlYmFyIG5vdCBmb3VuZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHN0YXRlLnNldHRpbmdzU3VyZmFjZUhpZGVUaW1lcikge1xuICAgIGNsZWFyVGltZW91dChzdGF0ZS5zZXR0aW5nc1N1cmZhY2VIaWRlVGltZXIpO1xuICAgIHN0YXRlLnNldHRpbmdzU3VyZmFjZUhpZGVUaW1lciA9IG51bGw7XG4gIH1cbiAgc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZSh0cnVlLCBcInNpZGViYXItZm91bmRcIik7XG4gIC8vIENvZGV4J3MgaXRlbXMgZ3JvdXAgbGl2ZXMgaW5zaWRlIGFuIG91dGVyIHdyYXBwZXIgdGhhdCdzIGFscmVhZHkgc3R5bGVkXG4gIC8vIHRvIGhvbGQgbXVsdGlwbGUgZ3JvdXBzIChgZmxleCBmbGV4LWNvbCBnYXAtMSBnYXAtMGApLiBXZSBpbmplY3Qgb3VyXG4gIC8vIGdyb3VwIGFzIGEgc2libGluZyBzbyB0aGUgbmF0dXJhbCBnYXAtMSBhY3RzIGFzIG91ciB2aXN1YWwgc2VwYXJhdG9yLlxuICBjb25zdCBvdXRlciA9IGl0ZW1zR3JvdXAucGFyZW50RWxlbWVudCA/PyBpdGVtc0dyb3VwO1xuICBpZiAoIWlzU2V0dGluZ3NTaWRlYmFyQ2FuZGlkYXRlKGl0ZW1zR3JvdXApIHx8ICFpc1NldHRpbmdzU2lkZWJhckNhbmRpZGF0ZShvdXRlcikpIHtcbiAgICBzY2hlZHVsZVNldHRpbmdzU3VyZmFjZUhpZGRlbigpO1xuICAgIHBsb2coXCJyZWplY3RlZCBub24tc2V0dGluZ3Mgc2lkZWJhciBjYW5kaWRhdGVcIiwge1xuICAgICAgaXRlbXNHcm91cDogZGVzY3JpYmUoaXRlbXNHcm91cCksXG4gICAgICBvdXRlcjogZGVzY3JpYmUob3V0ZXIpLFxuICAgIH0pO1xuICAgIHJldHVybjtcbiAgfVxuICBzdGF0ZS5zaWRlYmFyUm9vdCA9IG91dGVyO1xuICBzeW5jTmF0aXZlU2V0dGluZ3NIZWFkZXIoaXRlbXNHcm91cCwgb3V0ZXIpO1xuXG4gIGlmIChzdGF0ZS5uYXZHcm91cCAmJiBvdXRlci5jb250YWlucyhzdGF0ZS5uYXZHcm91cCkpIHtcbiAgICBzeW5jUGFnZXNHcm91cCgpO1xuICAgIC8vIENvZGV4IHJlLXJlbmRlcnMgaXRzIG5hdGl2ZSBzaWRlYmFyIGJ1dHRvbnMgb24gaXRzIG93biBzdGF0ZSBjaGFuZ2VzLlxuICAgIC8vIElmIG9uZSBvZiBvdXIgcGFnZXMgaXMgYWN0aXZlLCByZS1zdHJpcCBDb2RleCdzIGFjdGl2ZSBzdHlsaW5nIHNvXG4gICAgLy8gR2VuZXJhbCBkb2Vzbid0IHJlYXBwZWFyIGFzIHNlbGVjdGVkLlxuICAgIGlmIChzdGF0ZS5hY3RpdmVQYWdlICE9PSBudWxsKSBzeW5jQ29kZXhOYXRpdmVOYXZBY3RpdmUodHJ1ZSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gU2lkZWJhciB3YXMgZWl0aGVyIGZyZXNobHkgbW91bnRlZCAoU2V0dGluZ3MganVzdCBvcGVuZWQpIG9yIHJlLW1vdW50ZWRcbiAgLy8gKGNsb3NlZCBhbmQgcmUtb3BlbmVkLCBvciBuYXZpZ2F0ZWQgYXdheSBhbmQgYmFjaykuIEluIGFsbCBvZiB0aG9zZVxuICAvLyBjYXNlcyBDb2RleCByZXNldHMgdG8gaXRzIGRlZmF1bHQgcGFnZSAoR2VuZXJhbCksIGJ1dCBvdXIgaW4tbWVtb3J5XG4gIC8vIGBhY3RpdmVQYWdlYCBtYXkgc3RpbGwgcmVmZXJlbmNlIHRoZSBsYXN0IHR3ZWFrL3BhZ2UgdGhlIHVzZXIgaGFkIG9wZW5cbiAgLy8gXHUyMDE0IHdoaWNoIHdvdWxkIGNhdXNlIHRoYXQgbmF2IGJ1dHRvbiB0byByZW5kZXIgd2l0aCB0aGUgYWN0aXZlIHN0eWxpbmdcbiAgLy8gZXZlbiB0aG91Z2ggQ29kZXggaXMgc2hvd2luZyBHZW5lcmFsLiBDbGVhciBpdCBzbyBgc3luY1BhZ2VzR3JvdXBgIC9cbiAgLy8gYHNldE5hdkFjdGl2ZWAgc3RhcnQgZnJvbSBhIG5ldXRyYWwgc3RhdGUuIFRoZSBwYW5lbEhvc3QgcmVmZXJlbmNlIGlzXG4gIC8vIGFsc28gc3RhbGUgKGl0cyBET00gd2FzIGRpc2NhcmRlZCB3aXRoIHRoZSBwcmV2aW91cyBjb250ZW50IGFyZWEpLlxuICBpZiAoc3RhdGUuYWN0aXZlUGFnZSAhPT0gbnVsbCB8fCBzdGF0ZS5wYW5lbEhvc3QgIT09IG51bGwpIHtcbiAgICBwbG9nKFwic2lkZWJhciByZS1tb3VudCBkZXRlY3RlZDsgY2xlYXJpbmcgc3RhbGUgYWN0aXZlIHN0YXRlXCIsIHtcbiAgICAgIHByZXZBY3RpdmU6IHN0YXRlLmFjdGl2ZVBhZ2UsXG4gICAgfSk7XG4gICAgc3RhdGUuYWN0aXZlUGFnZSA9IG51bGw7XG4gICAgc3RhdGUucGFuZWxIb3N0ID0gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nQ29kZXhQcE5hdkdyb3VwID1cbiAgICBvdXRlci5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignOnNjb3BlID4gW2RhdGEtY29kZXhwcD1cIm5hdi1ncm91cFwiXScpID8/XG4gICAgb3V0ZXIucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tkYXRhLWNvZGV4cHA9XCJuYXYtZ3JvdXBcIl0nKTtcblxuICBpZiAoZXhpc3RpbmdDb2RleFBwTmF2R3JvdXApIHtcbiAgICBzdGF0ZS5uYXZHcm91cCA9IGV4aXN0aW5nQ29kZXhQcE5hdkdyb3VwO1xuICAgIHN0YXRlLnNpZGViYXJSb290ID0gb3V0ZXI7XG4gICAgc3luY1BhZ2VzR3JvdXAoKTtcbiAgICBpZiAoc3RhdGUuYWN0aXZlUGFnZSAhPT0gbnVsbCkgc3luY0NvZGV4TmF0aXZlTmF2QWN0aXZlKHRydWUpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBHcm91cCBjb250YWluZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IGdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZ3JvdXAuZGF0YXNldC5jb2RleHBwID0gXCJuYXYtZ3JvdXBcIjtcbiAgZ3JvdXAuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC1weFwiO1xuXG4gIGdyb3VwLmFwcGVuZENoaWxkKHNpZGViYXJHcm91cEhlYWRlcihcIkNvZGV4KytcIiwgXCJwdC0zXCIsIHNpZGViYXJSZWxlYXNlc1BpbGxCdXR0b24oKSkpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBTaWRlYmFyIGl0ZW1zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBjb25maWdCdG4gPSBtYWtlU2lkZWJhckl0ZW0oXCJDb25maWdcIiwgY29uZmlnSWNvblN2ZygpKTtcbiAgY29uc3QgdHdlYWtzQnRuID0gbWFrZVNpZGViYXJJdGVtKFwiVHdlYWtzXCIsIHR3ZWFrc0ljb25TdmcoKSk7XG4gIGNvbnN0IHN0b3JlQnRuID0gbWFrZVNpZGViYXJJdGVtKFwiVHdlYWsgU3RvcmVcIiwgc3RvcmVJY29uU3ZnKCkpO1xuICBhcHBlbmRTaWRlYmFyU3RvcmVVcGRhdGVCYWRnZShzdG9yZUJ0bik7XG5cbiAgY29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGFjdGl2YXRlUGFnZSh7IGtpbmQ6IFwiY29uZmlnXCIgfSk7XG4gIH0pO1xuICB0d2Vha3NCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgYWN0aXZhdGVQYWdlKHsga2luZDogXCJ0d2Vha3NcIiB9KTtcbiAgfSk7XG4gIHN0b3JlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGFjdGl2YXRlUGFnZSh7IGtpbmQ6IFwic3RvcmVcIiB9KTtcbiAgfSk7XG5cbiAgZ3JvdXAuYXBwZW5kQ2hpbGQoY29uZmlnQnRuKTtcbiAgZ3JvdXAuYXBwZW5kQ2hpbGQodHdlYWtzQnRuKTtcbiAgZ3JvdXAuYXBwZW5kQ2hpbGQoc3RvcmVCdG4pO1xuICBvdXRlci5hcHBlbmRDaGlsZChncm91cCk7XG5cbiAgc3RhdGUubmF2R3JvdXAgPSBncm91cDtcbiAgc3RhdGUubmF2QnV0dG9ucyA9IHsgY29uZmlnOiBjb25maWdCdG4sIHR3ZWFrczogdHdlYWtzQnRuLCBzdG9yZTogc3RvcmVCdG4gfTtcbiAgcGxvZyhcIm5hdiBncm91cCBpbmplY3RlZFwiLCB7IG91dGVyVGFnOiBvdXRlci50YWdOYW1lIH0pO1xuICBzeW5jUGFnZXNHcm91cCgpO1xufVxuXG5mdW5jdGlvbiBzeW5jTmF0aXZlU2V0dGluZ3NIZWFkZXIoaXRlbXNHcm91cDogSFRNTEVsZW1lbnQsIG91dGVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBpZiAoc3RhdGUubmF0aXZlTmF2SGVhZGVyICYmIG91dGVyLmNvbnRhaW5zKHN0YXRlLm5hdGl2ZU5hdkhlYWRlcikpIHJldHVybjtcbiAgaWYgKG91dGVyID09PSBpdGVtc0dyb3VwKSByZXR1cm47XG5cbiAgY29uc3QgaGVhZGVyID0gc2lkZWJhckdyb3VwSGVhZGVyKFwiR2VuZXJhbFwiKTtcbiAgaGVhZGVyLmRhdGFzZXQuY29kZXhwcCA9IFwibmF0aXZlLW5hdi1oZWFkZXJcIjtcbiAgb3V0ZXIuaW5zZXJ0QmVmb3JlKGhlYWRlciwgaXRlbXNHcm91cCk7XG4gIHN0YXRlLm5hdGl2ZU5hdkhlYWRlciA9IGhlYWRlcjtcbn1cblxuZnVuY3Rpb24gc2lkZWJhckdyb3VwSGVhZGVyKHRleHQ6IHN0cmluZywgdG9wUGFkZGluZyA9IFwicHQtMlwiLCB0cmFpbGluZz86IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBoZWFkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBoZWFkZXIuY2xhc3NOYW1lID1cbiAgICBgcHgtcm93LXggJHt0b3BQYWRkaW5nfSBwYi0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMiB0ZXh0LVsxMXB4XSBmb250LW1lZGl1bSB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgdGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kIHNlbGVjdC1ub25lYDtcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgbGFiZWwuY2xhc3NOYW1lID0gXCJ0cnVuY2F0ZVwiO1xuICBsYWJlbC50ZXh0Q29udGVudCA9IHRleHQ7XG4gIGhlYWRlci5hcHBlbmRDaGlsZChsYWJlbCk7XG4gIGlmICh0cmFpbGluZykgaGVhZGVyLmFwcGVuZENoaWxkKHRyYWlsaW5nKTtcbiAgcmV0dXJuIGhlYWRlcjtcbn1cblxuZnVuY3Rpb24gc2NoZWR1bGVTZXR0aW5nc1N1cmZhY2VIaWRkZW4oKTogdm9pZCB7XG4gIGlmICghc3RhdGUuc2V0dGluZ3NTdXJmYWNlVmlzaWJsZSB8fCBzdGF0ZS5zZXR0aW5nc1N1cmZhY2VIaWRlVGltZXIpIHJldHVybjtcbiAgc3RhdGUuc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgc3RhdGUuc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyID0gbnVsbDtcbiAgICBpZiAoZmluZFNpZGViYXJJdGVtc0dyb3VwKCkpIHJldHVybjtcbiAgICBpZiAoaXNTZXR0aW5nc1RleHRWaXNpYmxlKCkpIHJldHVybjtcbiAgICBzZXRTZXR0aW5nc1N1cmZhY2VWaXNpYmxlKGZhbHNlLCBcInNpZGViYXItbm90LWZvdW5kXCIpO1xuICB9LCAxNTAwKTtcbn1cblxuZnVuY3Rpb24gaXNTZXR0aW5nc1RleHRWaXNpYmxlKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gaXNDb2RleFBwU2V0dGluZ3NMYWJlbFNldChjb2RleFBwU2V0dGluZ3NMYWJlbHNGcm9tKGRvY3VtZW50KSk7XG59XG5cbmZ1bmN0aW9uIGNvbXBhY3RTZXR0aW5nc1RleHQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBTdHJpbmcodmFsdWUgfHwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xufVxuXG5jb25zdCBDT0RFWFBQX0NPUkVfU0VUVElOR1NfTEFCRUxTID0gW1xuICBcIkdlbmVyYWxcIixcbiAgXCJcdTVFMzhcdTg5QzRcIixcbiAgXCJcdTkwMUFcdTc1MjhcIixcbiAgXCJBcHBlYXJhbmNlXCIsXG4gIFwiXHU1OTE2XHU4OUMyXCIsXG4gIFwiQ29uZmlndXJhdGlvblwiLFxuICBcIlx1OTE0RFx1N0Y2RVwiLFxuICBcIlx1OUVEOFx1OEJBNFx1Njc0M1x1OTY1MFwiLFxuICBcIlBlcnNvbmFsaXphdGlvblwiLFxuICBcIlx1NEUyQVx1NjAyN1x1NTMxNlwiLFxuXS5tYXAobm9ybWFsaXplQ29kZXhQcFNldHRpbmdzTGFiZWwpO1xuXG5jb25zdCBDT0RFWFBQX0VYVEVOREVEX1NFVFRJTkdTX0xBQkVMUyA9IFtcbiAgXCJBY2NvdW50XCIsXG4gIFwiXHU4RDI2XHU2MjM3XCIsXG4gIFwiXHU4RDI2XHU1M0Y3XCIsXG4gIFwiR2VuZXJhbFwiLFxuICBcIlx1NUUzOFx1ODlDNFwiLFxuICBcIlx1OTAxQVx1NzUyOFwiLFxuICBcIkFwcGVhcmFuY2VcIixcbiAgXCJcdTU5MTZcdTg5QzJcIixcbiAgXCJDb25maWd1cmF0aW9uXCIsXG4gIFwiXHU5MTREXHU3RjZFXCIsXG4gIFwiXHU5RUQ4XHU4QkE0XHU2NzQzXHU5NjUwXCIsXG4gIFwiUGVyc29uYWxpemF0aW9uXCIsXG4gIFwiXHU0RTJBXHU2MDI3XHU1MzE2XCIsXG4gIFwiS2V5Ym9hcmQgc2hvcnRjdXRzXCIsXG4gIFwiQXJjaGl2ZWQgY2hhdHNcIixcbiAgXCJVc2FnZVwiLFxuICBcIkNvbXB1dGVyIHVzZVwiLFxuICBcIkJyb3dzZXIgdXNlXCIsXG4gIFwiTUNQIHNlcnZlcnNcIixcbiAgXCJNQ1AgU2VydmVyc1wiLFxuICBcIk1DUCBcdTY3MERcdTUyQTFcdTU2NjhcIixcbiAgXCJHaXRcIixcbiAgXCJFbnZpcm9ubWVudHNcIixcbiAgXCJcdTczQUZcdTU4ODNcIixcbiAgXCJDbG91ZCBFbnZpcm9ubWVudHNcIixcbiAgXCJXb3JrdHJlZXNcIixcbiAgXCJDb25uZWN0aW9uc1wiLFxuICBcIlBsdWdpbnNcIixcbiAgXCJTa2lsbHNcIixcbl0ubWFwKG5vcm1hbGl6ZUNvZGV4UHBTZXR0aW5nc0xhYmVsKTtcblxuZnVuY3Rpb24gbm9ybWFsaXplQ29kZXhQcFNldHRpbmdzTGFiZWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBjb21wYWN0U2V0dGluZ3NUZXh0KHZhbHVlKVxuICAgIC50b0xvY2FsZUxvd2VyQ2FzZSgpXG4gICAgLm5vcm1hbGl6ZShcIk5GRFwiKVxuICAgIC5yZXBsYWNlKC9bXFx1MDMwMC1cXHUwMzZmXS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9bXHUyMDE5XHUyMDE4YFx1MDBCNF0vZywgXCInXCIpXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXG4gICAgLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gY29kZXhQcENvbnRyb2xMYWJlbChlbDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICByZXR1cm4gbm9ybWFsaXplQ29kZXhQcFNldHRpbmdzTGFiZWwoXG4gICAgZWwuZ2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiKSB8fFxuICAgICAgZWwuZ2V0QXR0cmlidXRlKFwidGl0bGVcIikgfHxcbiAgICAgIGVsLnRleHRDb250ZW50IHx8XG4gICAgICBcIlwiLFxuICApO1xufVxuXG5mdW5jdGlvbiBjb2RleFBwU2V0dGluZ3NMYWJlbHNGcm9tKHJvb3Q6IFBhcmVudE5vZGUpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGNvbnRyb2xzID0gQXJyYXkuZnJvbShcbiAgICByb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiYnV0dG9uLGEsW3JvbGU9J2J1dHRvbiddLFtyb2xlPSdsaW5rJ11cIiksXG4gICk7XG5cbiAgcmV0dXJuIFtcbiAgICAuLi5uZXcgU2V0KFxuICAgICAgY29udHJvbHNcbiAgICAgICAgLm1hcChjb2RleFBwQ29udHJvbExhYmVsKVxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pLFxuICAgICksXG4gIF07XG59XG5cbmZ1bmN0aW9uIGNvZGV4UHBTZXR0aW5nc0xhYmVsU2NvcmUobGFiZWxzOiBzdHJpbmdbXSk6IHsgY29yZTogbnVtYmVyOyB0b3RhbDogbnVtYmVyIH0ge1xuICBjb25zdCBjb3JlID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IHRvdGFsID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBsYWJlbCBvZiBsYWJlbHMpIHtcbiAgICBmb3IgKGNvbnN0IG1hcmtlciBvZiBDT0RFWFBQX0NPUkVfU0VUVElOR1NfTEFCRUxTKSB7XG4gICAgICBpZiAobGFiZWwgPT09IG1hcmtlciB8fCBsYWJlbC5pbmNsdWRlcyhtYXJrZXIpKSBjb3JlLmFkZChtYXJrZXIpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbWFya2VyIG9mIENPREVYUFBfRVhURU5ERURfU0VUVElOR1NfTEFCRUxTKSB7XG4gICAgICBpZiAobGFiZWwgPT09IG1hcmtlciB8fCBsYWJlbC5pbmNsdWRlcyhtYXJrZXIpKSB0b3RhbC5hZGQobWFya2VyKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBjb3JlOiBjb3JlLnNpemUsIHRvdGFsOiB0b3RhbC5zaXplIH07XG59XG5cbmZ1bmN0aW9uIGlzQ29kZXhQcFNldHRpbmdzTGFiZWxTZXQobGFiZWxzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICBjb25zdCBzY29yZSA9IGNvZGV4UHBTZXR0aW5nc0xhYmVsU2NvcmUobGFiZWxzKTtcbiAgcmV0dXJuIHNjb3JlLmNvcmUgPj0gMiAmJiBzY29yZS50b3RhbCA+PSAzO1xufVxuXG5mdW5jdGlvbiBjb2RleFBwVmlzaWJsZUJveChlbDogSFRNTEVsZW1lbnQpOiBET01SZWN0IHwgbnVsbCB7XG4gIGlmICghZWwuaXNDb25uZWN0ZWQpIHJldHVybiBudWxsO1xuICBjb25zdCBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWwpO1xuICBpZiAoc3R5bGUuZGlzcGxheSA9PT0gXCJub25lXCIgfHwgc3R5bGUudmlzaWJpbGl0eSA9PT0gXCJoaWRkZW5cIikgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBpZiAocmVjdC53aWR0aCA8PSAwIHx8IHJlY3QuaGVpZ2h0IDw9IDApIHJldHVybiBudWxsO1xuICByZXR1cm4gcmVjdDtcbn1cblxuZnVuY3Rpb24gc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZSh2aXNpYmxlOiBib29sZWFuLCByZWFzb246IHN0cmluZyk6IHZvaWQge1xuICBpZiAoc3RhdGUuc2V0dGluZ3NTdXJmYWNlVmlzaWJsZSA9PT0gdmlzaWJsZSkgcmV0dXJuO1xuICBzdGF0ZS5zZXR0aW5nc1N1cmZhY2VWaXNpYmxlID0gdmlzaWJsZTtcbiAgaWYgKHZpc2libGUpIHdhcm1Ud2Vha1N0b3JlKCk7XG4gIHRyeSB7XG4gICAgKHdpbmRvdyBhcyBXaW5kb3cgJiB7IF9fY29kZXhwcFNldHRpbmdzU3VyZmFjZVZpc2libGU/OiBib29sZWFuIH0pLl9fY29kZXhwcFNldHRpbmdzU3VyZmFjZVZpc2libGUgPSB2aXNpYmxlO1xuICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kYXRhc2V0LmNvZGV4cHBTZXR0aW5nc1N1cmZhY2UgPSB2aXNpYmxlID8gXCJ0cnVlXCIgOiBcImZhbHNlXCI7XG4gICAgd2luZG93LmRpc3BhdGNoRXZlbnQoXG4gICAgICBuZXcgQ3VzdG9tRXZlbnQoXCJjb2RleHBwOnNldHRpbmdzLXN1cmZhY2VcIiwge1xuICAgICAgICBkZXRhaWw6IHsgdmlzaWJsZSwgcmVhc29uIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9IGNhdGNoIHt9XG4gIHBsb2coXCJzZXR0aW5ncyBzdXJmYWNlXCIsIHsgdmlzaWJsZSwgcmVhc29uLCB1cmw6IGxvY2F0aW9uLmhyZWYgfSk7XG59XG5cbi8qKlxuICogUmVuZGVyIChvciByZS1yZW5kZXIpIHRoZSBzZWNvbmQgc2lkZWJhciBncm91cCBvZiBwZXItdHdlYWsgcGFnZXMuIFRoZVxuICogZ3JvdXAgaXMgY3JlYXRlZCBsYXppbHkgYW5kIHJlbW92ZWQgd2hlbiB0aGUgbGFzdCBwYWdlIHVucmVnaXN0ZXJzLCBzb1xuICogdXNlcnMgd2l0aCBubyBwYWdlLXJlZ2lzdGVyaW5nIHR3ZWFrcyBuZXZlciBzZWUgYW4gZW1wdHkgXCJUd2Vha3NcIiBoZWFkZXIuXG4gKi9cbmZ1bmN0aW9uIHN5bmNQYWdlc0dyb3VwKCk6IHZvaWQge1xuICBjb25zdCBvdXRlciA9IHN0YXRlLnNpZGViYXJSb290O1xuICBpZiAoIW91dGVyKSByZXR1cm47XG4gIGlmICghaXNTZXR0aW5nc1NpZGViYXJDYW5kaWRhdGUob3V0ZXIpKSB7XG4gICAgc3RhdGUuc2lkZWJhclJvb3QgPSBudWxsO1xuICAgIHN0YXRlLnBhZ2VzR3JvdXAgPSBudWxsO1xuICAgIHN0YXRlLnBhZ2VzR3JvdXBLZXkgPSBudWxsO1xuICAgIGZvciAoY29uc3QgcCBvZiBzdGF0ZS5wYWdlcy52YWx1ZXMoKSkgcC5uYXZCdXR0b24gPSBudWxsO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBwYWdlcyA9IFsuLi5zdGF0ZS5wYWdlcy52YWx1ZXMoKV07XG5cbiAgLy8gQnVpbGQgYSBkZXRlcm1pbmlzdGljIGZpbmdlcnByaW50IG9mIHRoZSBkZXNpcmVkIGdyb3VwIHN0YXRlLiBJZiB0aGVcbiAgLy8gY3VycmVudCBET00gZ3JvdXAgYWxyZWFkeSBtYXRjaGVzLCB0aGlzIGlzIGEgbm8tb3AgXHUyMDE0IGNyaXRpY2FsLCBiZWNhdXNlXG4gIC8vIHN5bmNQYWdlc0dyb3VwIGlzIGNhbGxlZCBvbiBldmVyeSBNdXRhdGlvbk9ic2VydmVyIHRpY2sgYW5kIGFueSBET01cbiAgLy8gd3JpdGUgd291bGQgcmUtdHJpZ2dlciB0aGF0IG9ic2VydmVyIChpbmZpbml0ZSBsb29wLCBhcHAgZnJlZXplKS5cbiAgY29uc3QgZGVzaXJlZEtleSA9IHBhZ2VzLmxlbmd0aCA9PT0gMFxuICAgID8gXCJFTVBUWVwiXG4gICAgOiBwYWdlcy5tYXAoKHApID0+IGAke3AuaWR9fCR7cC5wYWdlLnRpdGxlfXwke3AucGFnZS5pY29uU3ZnID8/IFwiXCJ9YCkuam9pbihcIlxcblwiKTtcbiAgY29uc3QgZ3JvdXBBdHRhY2hlZCA9ICEhc3RhdGUucGFnZXNHcm91cCAmJiBvdXRlci5jb250YWlucyhzdGF0ZS5wYWdlc0dyb3VwKTtcbiAgaWYgKHN0YXRlLnBhZ2VzR3JvdXBLZXkgPT09IGRlc2lyZWRLZXkgJiYgKHBhZ2VzLmxlbmd0aCA9PT0gMCA/ICFncm91cEF0dGFjaGVkIDogZ3JvdXBBdHRhY2hlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAocGFnZXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKHN0YXRlLnBhZ2VzR3JvdXApIHtcbiAgICAgIHN0YXRlLnBhZ2VzR3JvdXAucmVtb3ZlKCk7XG4gICAgICBzdGF0ZS5wYWdlc0dyb3VwID0gbnVsbDtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSBwLm5hdkJ1dHRvbiA9IG51bGw7XG4gICAgc3RhdGUucGFnZXNHcm91cEtleSA9IGRlc2lyZWRLZXk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGdyb3VwID0gc3RhdGUucGFnZXNHcm91cDtcbiAgaWYgKCFncm91cCB8fCAhb3V0ZXIuY29udGFpbnMoZ3JvdXApKSB7XG4gICAgZ3JvdXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGdyb3VwLmRhdGFzZXQuY29kZXhwcCA9IFwicGFnZXMtZ3JvdXBcIjtcbiAgICBncm91cC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLXB4XCI7XG4gICAgZ3JvdXAuYXBwZW5kQ2hpbGQoc2lkZWJhckdyb3VwSGVhZGVyKFwiVHdlYWtzXCIsIFwicHQtM1wiKSk7XG4gICAgb3V0ZXIuYXBwZW5kQ2hpbGQoZ3JvdXApO1xuICAgIHN0YXRlLnBhZ2VzR3JvdXAgPSBncm91cDtcbiAgfSBlbHNlIHtcbiAgICAvLyBTdHJpcCBwcmlvciBidXR0b25zIChrZWVwIHRoZSBoZWFkZXIgYXQgaW5kZXggMCkuXG4gICAgd2hpbGUgKGdyb3VwLmNoaWxkcmVuLmxlbmd0aCA+IDEpIGdyb3VwLnJlbW92ZUNoaWxkKGdyb3VwLmxhc3RDaGlsZCEpO1xuICB9XG5cbiAgZm9yIChjb25zdCBwIG9mIHBhZ2VzKSB7XG4gICAgY29uc3QgaWNvbiA9IHAucGFnZS5pY29uU3ZnID8/IGRlZmF1bHRQYWdlSWNvblN2ZygpO1xuICAgIGNvbnN0IGJ0biA9IG1ha2VTaWRlYmFySXRlbShwLnBhZ2UudGl0bGUsIGljb24pO1xuICAgIGJ0bi5kYXRhc2V0LmNvZGV4cHAgPSBgbmF2LXBhZ2UtJHtwLmlkfWA7XG4gICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGFjdGl2YXRlUGFnZSh7IGtpbmQ6IFwicmVnaXN0ZXJlZFwiLCBpZDogcC5pZCB9KTtcbiAgICB9KTtcbiAgICBwLm5hdkJ1dHRvbiA9IGJ0bjtcbiAgICBncm91cC5hcHBlbmRDaGlsZChidG4pO1xuICB9XG4gIHN0YXRlLnBhZ2VzR3JvdXBLZXkgPSBkZXNpcmVkS2V5O1xuICBwbG9nKFwicGFnZXMgZ3JvdXAgc3luY2VkXCIsIHtcbiAgICBjb3VudDogcGFnZXMubGVuZ3RoLFxuICAgIGlkczogcGFnZXMubWFwKChwKSA9PiBwLmlkKSxcbiAgfSk7XG4gIC8vIFJlZmxlY3QgY3VycmVudCBhY3RpdmUgc3RhdGUgYWNyb3NzIHRoZSByZWJ1aWx0IGJ1dHRvbnMuXG4gIHNldE5hdkFjdGl2ZShzdGF0ZS5hY3RpdmVQYWdlKTtcbn1cblxuZnVuY3Rpb24gbWFrZVNpZGViYXJJdGVtKGxhYmVsOiBzdHJpbmcsIGljb25Tdmc6IHN0cmluZyk6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgLy8gQ2xhc3Mgc3RyaW5nIGNvcGllZCB2ZXJiYXRpbSBmcm9tIENvZGV4J3Mgc2lkZWJhciBidXR0b25zIChHZW5lcmFsIGV0YykuXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmRhdGFzZXQuY29kZXhwcCA9IGBuYXYtJHtsYWJlbC50b0xvd2VyQ2FzZSgpfWA7XG4gIGJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIGxhYmVsKTtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJmb2N1cy12aXNpYmxlOm91dGxpbmUtdG9rZW4tYm9yZGVyIHJlbGF0aXZlIHB4LXJvdy14IHB5LXJvdy15IGN1cnNvci1pbnRlcmFjdGlvbiBzaHJpbmstMCBpdGVtcy1jZW50ZXIgb3ZlcmZsb3ctaGlkZGVuIHJvdW5kZWQtbGcgdGV4dC1sZWZ0IHRleHQtc20gZm9jdXMtdmlzaWJsZTpvdXRsaW5lIGZvY3VzLXZpc2libGU6b3V0bGluZS0yIGZvY3VzLXZpc2libGU6b3V0bGluZS1vZmZzZXQtMiBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCBnYXAtMiBmbGV4IHctZnVsbCBob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZm9udC1ub3JtYWxcIjtcblxuICBjb25zdCBpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGlubmVyLmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IG1pbi13LTAgaXRlbXMtY2VudGVyIHRleHQtYmFzZSBnYXAtMiBmbGV4LTEgdGV4dC10b2tlbi1mb3JlZ3JvdW5kXCI7XG4gIGlubmVyLmlubmVySFRNTCA9IGAke2ljb25Tdmd9PHNwYW4gY2xhc3M9XCJ0cnVuY2F0ZVwiPiR7bGFiZWx9PC9zcGFuPmA7XG4gIGJ0bi5hcHBlbmRDaGlsZChpbm5lcik7XG4gIHJldHVybiBidG47XG59XG5cbmZ1bmN0aW9uIGFwcGVuZFNpZGViYXJTdG9yZVVwZGF0ZUJhZGdlKGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgaW5uZXIgPSBidG4uZmlyc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIWlubmVyKSByZXR1cm47XG4gIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGJhZGdlLmRhdGFzZXQuY29kZXhwcFN0b3JlVXBkYXRlQmFkZ2UgPSBcInRydWVcIjtcbiAgYmFkZ2UuaGlkZGVuID0gdHJ1ZTtcbiAgYmFkZ2UudGl0bGUgPSBcIkluc3RhbGxlZCB0d2Vha3Mgd2l0aCBhcHByb3ZlZCB1cGRhdGVzXCI7XG4gIGJhZGdlLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCI7XG4gIE9iamVjdC5hc3NpZ24oYmFkZ2Uuc3R5bGUsIHtcbiAgICBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLFxuICAgIHJpZ2h0OiBcIjEycHhcIixcbiAgICB0b3A6IFwiNTAlXCIsXG4gICAgdHJhbnNmb3JtOiBcInRyYW5zbGF0ZVkoLTUwJSlcIixcbiAgICB6SW5kZXg6IFwiMVwiLFxuICB9KTtcbiAgYXBwbHlTdG9yZVVwZGF0ZUJhZGdlU3R5bGUoYmFkZ2UsIG51bGwpO1xuICBidG4uYXBwZW5kQ2hpbGQoYmFkZ2UpO1xufVxuXG4vKiogSW50ZXJuYWwga2V5IGZvciB0aGUgYnVpbHQtaW4gbmF2IGJ1dHRvbnMuICovXG50eXBlIEJ1aWx0aW5QYWdlID0gXCJjb25maWdcIiB8IFwidHdlYWtzXCIgfCBcInN0b3JlXCI7XG5cbmZ1bmN0aW9uIHNldE5hdkFjdGl2ZShhY3RpdmU6IEFjdGl2ZVBhZ2UgfCBudWxsKTogdm9pZCB7XG4gIC8vIEJ1aWx0LWluIChDb25maWcvVHdlYWtzKSBidXR0b25zLlxuICBpZiAoc3RhdGUubmF2QnV0dG9ucykge1xuICAgIGNvbnN0IGJ1aWx0aW46IEJ1aWx0aW5QYWdlIHwgbnVsbCA9XG4gICAgICBhY3RpdmU/LmtpbmQgPT09IFwiY29uZmlnXCIgPyBcImNvbmZpZ1wiIDpcbiAgICAgIGFjdGl2ZT8ua2luZCA9PT0gXCJ0d2Vha3NcIiA/IFwidHdlYWtzXCIgOlxuICAgICAgYWN0aXZlPy5raW5kID09PSBcInN0b3JlXCIgPyBcInN0b3JlXCIgOiBudWxsO1xuICAgIGZvciAoY29uc3QgW2tleSwgYnRuXSBvZiBPYmplY3QuZW50cmllcyhzdGF0ZS5uYXZCdXR0b25zKSBhcyBbQnVpbHRpblBhZ2UsIEhUTUxCdXR0b25FbGVtZW50XVtdKSB7XG4gICAgICBhcHBseU5hdkFjdGl2ZShidG4sIGtleSA9PT0gYnVpbHRpbik7XG4gICAgfVxuICB9XG4gIC8vIFBlci1wYWdlIHJlZ2lzdGVyZWQgYnV0dG9ucy5cbiAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSB7XG4gICAgaWYgKCFwLm5hdkJ1dHRvbikgY29udGludWU7XG4gICAgY29uc3QgaXNBY3RpdmUgPSBhY3RpdmU/LmtpbmQgPT09IFwicmVnaXN0ZXJlZFwiICYmIGFjdGl2ZS5pZCA9PT0gcC5pZDtcbiAgICBhcHBseU5hdkFjdGl2ZShwLm5hdkJ1dHRvbiwgaXNBY3RpdmUpO1xuICB9XG4gIC8vIENvZGV4J3Mgb3duIHNpZGViYXIgYnV0dG9ucyAoR2VuZXJhbCwgQXBwZWFyYW5jZSwgZXRjKS4gV2hlbiBvbmUgb2ZcbiAgLy8gb3VyIHBhZ2VzIGlzIGFjdGl2ZSwgQ29kZXggc3RpbGwgaGFzIGFyaWEtY3VycmVudD1cInBhZ2VcIiBhbmQgdGhlXG4gIC8vIGFjdGl2ZS1iZyBjbGFzcyBvbiB3aGljaGV2ZXIgaXRlbSBpdCBjb25zaWRlcmVkIHRoZSByb3V0ZSBcdTIwMTQgdHlwaWNhbGx5XG4gIC8vIEdlbmVyYWwuIFRoYXQgbWFrZXMgYm90aCBidXR0b25zIGxvb2sgc2VsZWN0ZWQuIFN0cmlwIENvZGV4J3MgYWN0aXZlXG4gIC8vIHN0eWxpbmcgd2hpbGUgb25lIG9mIG91cnMgaXMgYWN0aXZlOyByZXN0b3JlIGl0IHdoZW4gbm9uZSBpcy5cbiAgc3luY0NvZGV4TmF0aXZlTmF2QWN0aXZlKGFjdGl2ZSAhPT0gbnVsbCk7XG59XG5cbi8qKlxuICogTXV0ZSBDb2RleCdzIG93biBhY3RpdmUtc3RhdGUgc3R5bGluZyBvbiBpdHMgc2lkZWJhciBidXR0b25zLiBXZSBkb24ndFxuICogdG91Y2ggQ29kZXgncyBSZWFjdCBzdGF0ZSBcdTIwMTQgd2hlbiB0aGUgdXNlciBjbGlja3MgYSBuYXRpdmUgaXRlbSwgQ29kZXhcbiAqIHJlLXJlbmRlcnMgdGhlIGJ1dHRvbnMgYW5kIHJlLWFwcGxpZXMgaXRzIG93biBjb3JyZWN0IHN0YXRlLCB0aGVuIG91clxuICogc2lkZWJhci1jbGljayBsaXN0ZW5lciBmaXJlcyBgcmVzdG9yZUNvZGV4Vmlld2AgKHdoaWNoIGNhbGxzIGJhY2sgaW50b1xuICogYHNldE5hdkFjdGl2ZShudWxsKWAgYW5kIGxldHMgQ29kZXgncyBzdHlsaW5nIHN0YW5kKS5cbiAqXG4gKiBgbXV0ZT10cnVlYCAgXHUyMTkyIHN0cmlwIGFyaWEtY3VycmVudCBhbmQgc3dhcCBhY3RpdmUgYmcgXHUyMTkyIGhvdmVyIGJnXG4gKiBgbXV0ZT1mYWxzZWAgXHUyMTkyIG5vLW9wIChDb2RleCdzIG93biByZS1yZW5kZXIgYWxyZWFkeSByZXN0b3JlZCB0aGluZ3MpXG4gKi9cbmZ1bmN0aW9uIHN5bmNDb2RleE5hdGl2ZU5hdkFjdGl2ZShtdXRlOiBib29sZWFuKTogdm9pZCB7XG4gIGlmICghbXV0ZSkgcmV0dXJuO1xuICBjb25zdCByb290ID0gc3RhdGUuc2lkZWJhclJvb3Q7XG4gIGlmICghcm9vdCkgcmV0dXJuO1xuICBjb25zdCBidXR0b25zID0gQXJyYXkuZnJvbShyb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KFwiYnV0dG9uXCIpKTtcbiAgZm9yIChjb25zdCBidG4gb2YgYnV0dG9ucykge1xuICAgIC8vIFNraXAgb3VyIG93biBidXR0b25zLlxuICAgIGlmIChidG4uZGF0YXNldC5jb2RleHBwKSBjb250aW51ZTtcbiAgICBpZiAoYnRuLmdldEF0dHJpYnV0ZShcImFyaWEtY3VycmVudFwiKSA9PT0gXCJwYWdlXCIpIHtcbiAgICAgIGJ0bi5yZW1vdmVBdHRyaWJ1dGUoXCJhcmlhLWN1cnJlbnRcIik7XG4gICAgfVxuICAgIGlmIChidG4uY2xhc3NMaXN0LmNvbnRhaW5zKFwiYmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpKSB7XG4gICAgICBidG4uY2xhc3NMaXN0LnJlbW92ZShcImJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZFwiKTtcbiAgICAgIGJ0bi5jbGFzc0xpc3QuYWRkKFwiaG92ZXI6YmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseU5hdkFjdGl2ZShidG46IEhUTUxCdXR0b25FbGVtZW50LCBhY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgaW5uZXIgPSBidG4uZmlyc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoYWN0aXZlKSB7XG4gICAgICBidG4uY2xhc3NMaXN0LnJlbW92ZShcImhvdmVyOmJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZFwiLCBcImZvbnQtbm9ybWFsXCIpO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoXCJiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIik7XG4gICAgICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1jdXJyZW50XCIsIFwicGFnZVwiKTtcbiAgICAgIGlmIChpbm5lcikge1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QucmVtb3ZlKFwidGV4dC10b2tlbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QuYWRkKFwidGV4dC10b2tlbi1saXN0LWFjdGl2ZS1zZWxlY3Rpb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgICAgaW5uZXJcbiAgICAgICAgICAucXVlcnlTZWxlY3RvcihcInN2Z1wiKVxuICAgICAgICAgID8uY2xhc3NMaXN0LmFkZChcInRleHQtdG9rZW4tbGlzdC1hY3RpdmUtc2VsZWN0aW9uLWljb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoXCJob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIiwgXCJmb250LW5vcm1hbFwiKTtcbiAgICAgIGJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwiYmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpO1xuICAgICAgYnRuLnJlbW92ZUF0dHJpYnV0ZShcImFyaWEtY3VycmVudFwiKTtcbiAgICAgIGlmIChpbm5lcikge1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QuYWRkKFwidGV4dC10b2tlbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QucmVtb3ZlKFwidGV4dC10b2tlbi1saXN0LWFjdGl2ZS1zZWxlY3Rpb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgICAgaW5uZXJcbiAgICAgICAgICAucXVlcnlTZWxlY3RvcihcInN2Z1wiKVxuICAgICAgICAgID8uY2xhc3NMaXN0LnJlbW92ZShcInRleHQtdG9rZW4tbGlzdC1hY3RpdmUtc2VsZWN0aW9uLWljb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgIH1cbiAgICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBhY3RpdmF0ZVBhZ2UocGFnZTogQWN0aXZlUGFnZSk6IHZvaWQge1xuICBjb25zdCBjb250ZW50ID0gZmluZENvbnRlbnRBcmVhKCk7XG4gIGlmICghY29udGVudCkge1xuICAgIHBsb2coXCJhY3RpdmF0ZTogY29udGVudCBhcmVhIG5vdCBmb3VuZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgc3RhdGUuYWN0aXZlUGFnZSA9IHBhZ2U7XG4gIHBsb2coXCJhY3RpdmF0ZVwiLCB7IHBhZ2UgfSk7XG5cbiAgLy8gSGlkZSBDb2RleCdzIGNvbnRlbnQgY2hpbGRyZW4sIHNob3cgb3Vycy5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBBcnJheS5mcm9tKGNvbnRlbnQuY2hpbGRyZW4pIGFzIEhUTUxFbGVtZW50W10pIHtcbiAgICBpZiAoY2hpbGQuZGF0YXNldC5jb2RleHBwID09PSBcInR3ZWFrcy1wYW5lbFwiKSBjb250aW51ZTtcbiAgICBpZiAoY2hpbGQuZGF0YXNldC5jb2RleHBwSGlkZGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNoaWxkLmRhdGFzZXQuY29kZXhwcEhpZGRlbiA9IGNoaWxkLnN0eWxlLmRpc3BsYXkgfHwgXCJcIjtcbiAgICB9XG4gICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICB9XG4gIGxldCBwYW5lbCA9IGNvbnRlbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tkYXRhLWNvZGV4cHA9XCJ0d2Vha3MtcGFuZWxcIl0nKTtcbiAgaWYgKCFwYW5lbCkge1xuICAgIHBhbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBwYW5lbC5kYXRhc2V0LmNvZGV4cHAgPSBcInR3ZWFrcy1wYW5lbFwiO1xuICAgIHBhbmVsLnN0eWxlLmNzc1RleHQgPSBcIndpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7b3ZlcmZsb3c6YXV0bztcIjtcbiAgICBjb250ZW50LmFwcGVuZENoaWxkKHBhbmVsKTtcbiAgfVxuICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBzdGF0ZS5wYW5lbEhvc3QgPSBwYW5lbDtcbiAgcmVyZW5kZXIoKTtcbiAgc2V0TmF2QWN0aXZlKHBhZ2UpO1xuICAvLyByZXN0b3JlIENvZGV4J3Mgdmlldy4gUmUtcmVnaXN0ZXIgaWYgbmVlZGVkLlxuICBjb25zdCBzaWRlYmFyID0gc3RhdGUuc2lkZWJhclJvb3Q7XG4gIGlmIChzaWRlYmFyKSB7XG4gICAgaWYgKHN0YXRlLnNpZGViYXJSZXN0b3JlSGFuZGxlcikge1xuICAgICAgc2lkZWJhci5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgc3RhdGUuc2lkZWJhclJlc3RvcmVIYW5kbGVyLCB0cnVlKTtcbiAgICB9XG4gICAgY29uc3QgaGFuZGxlciA9IChlOiBFdmVudCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgaWYgKCF0YXJnZXQpIHJldHVybjtcbiAgICAgIGlmIChzdGF0ZS5uYXZHcm91cD8uY29udGFpbnModGFyZ2V0KSkgcmV0dXJuOyAvLyBvdXIgYnV0dG9uc1xuICAgICAgaWYgKHN0YXRlLnBhZ2VzR3JvdXA/LmNvbnRhaW5zKHRhcmdldCkpIHJldHVybjsgLy8gb3VyIHBhZ2UgYnV0dG9uc1xuICAgICAgaWYgKHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtY29kZXhwcC1zZXR0aW5ncy1zZWFyY2hdXCIpKSByZXR1cm47XG4gICAgICByZXN0b3JlQ29kZXhWaWV3KCk7XG4gICAgfTtcbiAgICBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIgPSBoYW5kbGVyO1xuICAgIHNpZGViYXIuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGhhbmRsZXIsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlc3RvcmVDb2RleFZpZXcoKTogdm9pZCB7XG4gIHBsb2coXCJyZXN0b3JlIGNvZGV4IHZpZXdcIik7XG4gIGNvbnN0IGNvbnRlbnQgPSBmaW5kQ29udGVudEFyZWEoKTtcbiAgaWYgKCFjb250ZW50KSByZXR1cm47XG4gIGlmIChzdGF0ZS5wYW5lbEhvc3QpIHN0YXRlLnBhbmVsSG9zdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShjb250ZW50LmNoaWxkcmVuKSBhcyBIVE1MRWxlbWVudFtdKSB7XG4gICAgaWYgKGNoaWxkID09PSBzdGF0ZS5wYW5lbEhvc3QpIGNvbnRpbnVlO1xuICAgIGlmIChjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IGNoaWxkLmRhdGFzZXQuY29kZXhwcEhpZGRlbjtcbiAgICAgIGRlbGV0ZSBjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW47XG4gICAgfVxuICB9XG4gIHN0YXRlLmFjdGl2ZVBhZ2UgPSBudWxsO1xuICBzZXROYXZBY3RpdmUobnVsbCk7XG4gIGlmIChzdGF0ZS5zaWRlYmFyUm9vdCAmJiBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIpIHtcbiAgICBzdGF0ZS5zaWRlYmFyUm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgXCJjbGlja1wiLFxuICAgICAgc3RhdGUuc2lkZWJhclJlc3RvcmVIYW5kbGVyLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHN0YXRlLnNpZGViYXJSZXN0b3JlSGFuZGxlciA9IG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVyZW5kZXIoKTogdm9pZCB7XG4gIGlmICghc3RhdGUuYWN0aXZlUGFnZSkgcmV0dXJuO1xuICBjb25zdCBob3N0ID0gc3RhdGUucGFuZWxIb3N0O1xuICBpZiAoIWhvc3QpIHJldHVybjtcbiAgaG9zdC5pbm5lckhUTUwgPSBcIlwiO1xuXG4gIGNvbnN0IGFwID0gc3RhdGUuYWN0aXZlUGFnZTtcbiAgaWYgKGFwLmtpbmQgPT09IFwicmVnaXN0ZXJlZFwiKSB7XG4gICAgY29uc3QgZW50cnkgPSBzdGF0ZS5wYWdlcy5nZXQoYXAuaWQpO1xuICAgIGlmICghZW50cnkpIHtcbiAgICAgIHJlc3RvcmVDb2RleFZpZXcoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgcm9vdCA9IHBhbmVsU2hlbGwoZW50cnkucGFnZS50aXRsZSwgZW50cnkucGFnZS5kZXNjcmlwdGlvbik7XG4gICAgaG9zdC5hcHBlbmRDaGlsZChyb290Lm91dGVyKTtcbiAgICB0cnkge1xuICAgICAgLy8gVGVhciBkb3duIGFueSBwcmlvciByZW5kZXIgYmVmb3JlIHJlLXJlbmRlcmluZyAoaG90IHJlbG9hZCkuXG4gICAgICB0cnkgeyBlbnRyeS50ZWFyZG93bj8uKCk7IH0gY2F0Y2gge31cbiAgICAgIGVudHJ5LnRlYXJkb3duID0gbnVsbDtcbiAgICAgIGNvbnN0IHJldCA9IGVudHJ5LnBhZ2UucmVuZGVyKHJvb3Quc2VjdGlvbnNXcmFwKTtcbiAgICAgIGlmICh0eXBlb2YgcmV0ID09PSBcImZ1bmN0aW9uXCIpIGVudHJ5LnRlYXJkb3duID0gcmV0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGVyciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBlcnIuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLWNoYXJ0cy1yZWQgdGV4dC1zbVwiO1xuICAgICAgZXJyLnRleHRDb250ZW50ID0gYEVycm9yIHJlbmRlcmluZyBwYWdlOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWA7XG4gICAgICByb290LnNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZChlcnIpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0aXRsZSA9XG4gICAgYXAua2luZCA9PT0gXCJ0d2Vha3NcIiA/IFwiVHdlYWtzXCIgOlxuICAgIGFwLmtpbmQgPT09IFwic3RvcmVcIiA/IFwiVHdlYWsgU3RvcmVcIiA6IFwiQ29kZXgrK1wiO1xuICBjb25zdCBzdWJ0aXRsZSA9XG4gICAgYXAua2luZCA9PT0gXCJ0d2Vha3NcIlxuICAgICAgPyBcIk1hbmFnZSB5b3VyIGluc3RhbGxlZCBDb2RleCsrIHR3ZWFrcy5cIlxuICAgICAgOiBhcC5raW5kID09PSBcInN0b3JlXCJcbiAgICAgICAgPyBcIkluc3RhbGwgcmV2aWV3ZWQgdHdlYWtzIHBpbm5lZCB0byBhcHByb3ZlZCBHaXRIdWIgY29tbWl0cy5cIlxuICAgICAgICA6IFwiQ2hlY2tpbmcgaW5zdGFsbGVkIENvZGV4KysgdmVyc2lvbi5cIjtcbiAgY29uc3Qgcm9vdCA9IHBhbmVsU2hlbGwodGl0bGUsIHN1YnRpdGxlKTtcbiAgaG9zdC5hcHBlbmRDaGlsZChyb290Lm91dGVyKTtcbiAgaWYgKGFwLmtpbmQgPT09IFwidHdlYWtzXCIpIHJlbmRlclR3ZWFrc1BhZ2Uocm9vdC5zZWN0aW9uc1dyYXApO1xuICBlbHNlIGlmIChhcC5raW5kID09PSBcInN0b3JlXCIpIHJlbmRlclR3ZWFrU3RvcmVQYWdlKHJvb3Quc2VjdGlvbnNXcmFwLCByb290LmhlYWRlckFjdGlvbnMpO1xuICBlbHNlIHJlbmRlckNvbmZpZ1BhZ2Uocm9vdC5zZWN0aW9uc1dyYXAsIHJvb3Quc3VidGl0bGUpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgcGFnZXMgXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlbmRlckNvbmZpZ1BhZ2UoXG4gIHNlY3Rpb25zV3JhcDogSFRNTEVsZW1lbnQsXG4gIHN1YnRpdGxlPzogSFRNTEVsZW1lbnQsXG4pOiB2b2lkIHtcbiAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICBzZWN0aW9uLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICBzZWN0aW9uLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkNvZGV4KysgVXBkYXRlc1wiKSk7XG4gIGNvbnN0IGNhcmQgPSByb3VuZGVkQ2FyZCgpO1xuICBjYXJkLmRhdGFzZXQuY29kZXhwcENvbmZpZ0NhcmQgPSBcInRydWVcIjtcbiAgY29uc3QgbG9hZGluZyA9IHJvd1NpbXBsZShcIkxvYWRpbmcgdXBkYXRlIHNldHRpbmdzXCIsIFwiQ2hlY2tpbmcgY3VycmVudCBDb2RleCsrIGNvbmZpZ3VyYXRpb24uXCIpO1xuICBjYXJkLmFwcGVuZENoaWxkKGxvYWRpbmcpO1xuICBzZWN0aW9uLmFwcGVuZENoaWxkKGNhcmQpO1xuICBzZWN0aW9uc1dyYXAuYXBwZW5kQ2hpbGQoc2VjdGlvbik7XG5cbiAgdm9pZCBpcGNSZW5kZXJlclxuICAgIC5pbnZva2UoXCJjb2RleHBwOmdldC1jb25maWdcIilcbiAgICAudGhlbigoY29uZmlnKSA9PiB7XG4gICAgICBpZiAoc3VidGl0bGUpIHtcbiAgICAgICAgc3VidGl0bGUudGV4dENvbnRlbnQgPSBgWW91IGhhdmUgQ29kZXgrKyAkeyhjb25maWcgYXMgQ29kZXhQbHVzUGx1c0NvbmZpZykudmVyc2lvbn0gaW5zdGFsbGVkLmA7XG4gICAgICB9XG4gICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgIHJlbmRlckNvZGV4UGx1c1BsdXNDb25maWcoY2FyZCwgY29uZmlnIGFzIENvZGV4UGx1c1BsdXNDb25maWcpO1xuICAgIH0pXG4gICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICBpZiAoc3VidGl0bGUpIHN1YnRpdGxlLnRleHRDb250ZW50ID0gXCJDb3VsZCBub3QgbG9hZCBpbnN0YWxsZWQgQ29kZXgrKyB2ZXJzaW9uLlwiO1xuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICBjYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIkNvdWxkIG5vdCBsb2FkIHVwZGF0ZSBzZXR0aW5nc1wiLCBTdHJpbmcoZSkpKTtcbiAgICB9KTtcblxuICBjb25zdCB3YXRjaGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIik7XG4gIHdhdGNoZXIuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC0yXCI7XG4gIHdhdGNoZXIuYXBwZW5kQ2hpbGQoc2VjdGlvblRpdGxlKFwiQXV0by1SZXBhaXIgV2F0Y2hlclwiKSk7XG4gIGNvbnN0IHdhdGNoZXJDYXJkID0gcm91bmRlZENhcmQoKTtcbiAgd2F0Y2hlckNhcmQuYXBwZW5kQ2hpbGQocm93U2ltcGxlKFwiQ2hlY2tpbmcgd2F0Y2hlclwiLCBcIlZlcmlmeWluZyB0aGUgdXBkYXRlciByZXBhaXIgc2VydmljZS5cIikpO1xuICB3YXRjaGVyLmFwcGVuZENoaWxkKHdhdGNoZXJDYXJkKTtcbiAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHdhdGNoZXIpO1xuICByZW5kZXJXYXRjaGVySGVhbHRoQ2FyZCh3YXRjaGVyQ2FyZCk7XG5cbiAgY29uc3QgbWFpbnRlbmFuY2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiKTtcbiAgbWFpbnRlbmFuY2UuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC0yXCI7XG4gIG1haW50ZW5hbmNlLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIk1haW50ZW5hbmNlXCIpKTtcbiAgY29uc3QgbWFpbnRlbmFuY2VDYXJkID0gcm91bmRlZENhcmQoKTtcbiAgbWFpbnRlbmFuY2VDYXJkLmFwcGVuZENoaWxkKHVuaW5zdGFsbFJvdygpKTtcbiAgbWFpbnRlbmFuY2VDYXJkLmFwcGVuZENoaWxkKHJlcG9ydEJ1Z1JvdygpKTtcbiAgbWFpbnRlbmFuY2UuYXBwZW5kQ2hpbGQobWFpbnRlbmFuY2VDYXJkKTtcbiAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKG1haW50ZW5hbmNlKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQ29kZXhQbHVzUGx1c0NvbmZpZyhjYXJkOiBIVE1MRWxlbWVudCwgY29uZmlnOiBDb2RleFBsdXNQbHVzQ29uZmlnKTogdm9pZCB7XG4gIGNhcmQuYXBwZW5kQ2hpbGQoYXV0b1VwZGF0ZVJvdyhjb25maWcpKTtcbiAgY2FyZC5hcHBlbmRDaGlsZCh1cGRhdGVDaGFubmVsUm93KGNvbmZpZykpO1xuICBjYXJkLmFwcGVuZENoaWxkKGluc3RhbGxhdGlvblNvdXJjZVJvdyhjb25maWcuaW5zdGFsbGF0aW9uU291cmNlKSk7XG4gIGNhcmQuYXBwZW5kQ2hpbGQoc2VsZlVwZGF0ZVN0YXR1c1Jvdyhjb25maWcuc2VsZlVwZGF0ZSkpO1xuICBjYXJkLmFwcGVuZENoaWxkKGNoZWNrRm9yVXBkYXRlc1Jvdyhjb25maWcpKTtcbiAgaWYgKGNvbmZpZy51cGRhdGVDaGVjaykgY2FyZC5hcHBlbmRDaGlsZChyZWxlYXNlTm90ZXNSb3coY29uZmlnLnVwZGF0ZUNoZWNrKSk7XG59XG5cbmZ1bmN0aW9uIGF1dG9VcGRhdGVSb3coY29uZmlnOiBDb2RleFBsdXNQbHVzQ29uZmlnKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSBcIkF1dG9tYXRpY2FsbHkgcmVmcmVzaCBDb2RleCsrXCI7XG4gIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBkZXNjLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSBtaW4tdy0wIHRleHQtc21cIjtcbiAgZGVzYy50ZXh0Q29udGVudCA9IGBJbnN0YWxsZWQgdmVyc2lvbiB2JHtjb25maWcudmVyc2lvbn0uIFRoZSB3YXRjaGVyIGNoZWNrcyBob3VybHkgYW5kIGNhbiByZWZyZXNoIHRoZSBDb2RleCsrIHJ1bnRpbWUgYXV0b21hdGljYWxseS5gO1xuICBsZWZ0LmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgbGVmdC5hcHBlbmRDaGlsZChkZXNjKTtcbiAgcm93LmFwcGVuZENoaWxkKGxlZnQpO1xuICByb3cuYXBwZW5kQ2hpbGQoXG4gICAgc3dpdGNoQ29udHJvbChjb25maWcuYXV0b1VwZGF0ZSwgYXN5bmMgKG5leHQpID0+IHtcbiAgICAgIGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6c2V0LWF1dG8tdXBkYXRlXCIsIG5leHQpO1xuICAgIH0pLFxuICApO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDaGFubmVsUm93KGNvbmZpZzogQ29kZXhQbHVzUGx1c0NvbmZpZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gYWN0aW9uUm93KFwiUmVsZWFzZSBjaGFubmVsXCIsIHVwZGF0ZUNoYW5uZWxTdW1tYXJ5KGNvbmZpZykpO1xuICBjb25zdCBhY3Rpb24gPSByb3cucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCJbZGF0YS1jb2RleHBwLXJvdy1hY3Rpb25zXVwiKTtcbiAgY29uc3Qgc2VsZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNlbGVjdFwiKTtcbiAgc2VsZWN0LmNsYXNzTmFtZSA9XG4gICAgXCJoLTggcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBiZy10cmFuc3BhcmVudCBweC0yIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnkgZm9jdXM6b3V0bGluZS1ub25lXCI7XG4gIGZvciAoY29uc3QgW3ZhbHVlLCBsYWJlbF0gb2YgW1xuICAgIFtcInN0YWJsZVwiLCBcIlN0YWJsZVwiXSxcbiAgICBbXCJwcmVyZWxlYXNlXCIsIFwiUHJlcmVsZWFzZVwiXSxcbiAgICBbXCJjdXN0b21cIiwgXCJDdXN0b21cIl0sXG4gIF0gYXMgY29uc3QpIHtcbiAgICBjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib3B0aW9uXCIpO1xuICAgIG9wdGlvbi52YWx1ZSA9IHZhbHVlO1xuICAgIG9wdGlvbi50ZXh0Q29udGVudCA9IGxhYmVsO1xuICAgIG9wdGlvbi5zZWxlY3RlZCA9IGNvbmZpZy51cGRhdGVDaGFubmVsID09PSB2YWx1ZTtcbiAgICBzZWxlY3QuYXBwZW5kQ2hpbGQob3B0aW9uKTtcbiAgfVxuICBzZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgLmludm9rZShcImNvZGV4cHA6c2V0LXVwZGF0ZS1jb25maWdcIiwgeyB1cGRhdGVDaGFubmVsOiBzZWxlY3QudmFsdWUgfSlcbiAgICAgIC50aGVuKCgpID0+IHJlZnJlc2hDb25maWdDYXJkKHJvdykpXG4gICAgICAuY2F0Y2goKGUpID0+IHBsb2coXCJzZXQgdXBkYXRlIGNoYW5uZWwgZmFpbGVkXCIsIFN0cmluZyhlKSkpO1xuICB9KTtcbiAgYWN0aW9uPy5hcHBlbmRDaGlsZChzZWxlY3QpO1xuICBpZiAoY29uZmlnLnVwZGF0ZUNoYW5uZWwgPT09IFwiY3VzdG9tXCIpIHtcbiAgICBhY3Rpb24/LmFwcGVuZENoaWxkKFxuICAgICAgY29tcGFjdEJ1dHRvbihcIkVkaXRcIiwgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXBvID0gd2luZG93LnByb21wdChcIkdpdEh1YiByZXBvXCIsIGNvbmZpZy51cGRhdGVSZXBvIHx8IFwiYi1ubmV0dC9jb2RleC1wbHVzcGx1c1wiKTtcbiAgICAgICAgaWYgKHJlcG8gPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgY29uc3QgcmVmID0gd2luZG93LnByb21wdChcIkdpdCByZWZcIiwgY29uZmlnLnVwZGF0ZVJlZiB8fCBcIm1haW5cIik7XG4gICAgICAgIGlmIChyZWYgPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgICAgIC5pbnZva2UoXCJjb2RleHBwOnNldC11cGRhdGUtY29uZmlnXCIsIHtcbiAgICAgICAgICAgIHVwZGF0ZUNoYW5uZWw6IFwiY3VzdG9tXCIsXG4gICAgICAgICAgICB1cGRhdGVSZXBvOiByZXBvLFxuICAgICAgICAgICAgdXBkYXRlUmVmOiByZWYsXG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiByZWZyZXNoQ29uZmlnQ2FyZChyb3cpKVxuICAgICAgICAgIC5jYXRjaCgoZSkgPT4gcGxvZyhcInNldCBjdXN0b20gdXBkYXRlIHNvdXJjZSBmYWlsZWRcIiwgU3RyaW5nKGUpKSk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIGluc3RhbGxhdGlvblNvdXJjZVJvdyhzb3VyY2U6IEluc3RhbGxhdGlvblNvdXJjZSk6IEhUTUxFbGVtZW50IHtcbiAgcmV0dXJuIHJvd1NpbXBsZShcIkluc3RhbGxhdGlvbiBzb3VyY2VcIiwgYCR7c291cmNlLmxhYmVsfTogJHtzb3VyY2UuZGV0YWlsfWApO1xufVxuXG5mdW5jdGlvbiBzZWxmVXBkYXRlU3RhdHVzUm93KHN0YXRlOiBTZWxmVXBkYXRlU3RhdGUgfCBudWxsKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSByb3dTaW1wbGUoXCJMYXN0IENvZGV4KysgdXBkYXRlXCIsIHNlbGZVcGRhdGVTdW1tYXJ5KHN0YXRlKSk7XG4gIGNvbnN0IGxlZnQgPSByb3cuZmlyc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAobGVmdCAmJiBzdGF0ZSkgbGVmdC5wcmVwZW5kKHN0YXR1c0JhZGdlKHNlbGZVcGRhdGVTdGF0dXNUb25lKHN0YXRlLnN0YXR1cyksIHNlbGZVcGRhdGVTdGF0dXNMYWJlbChzdGF0ZS5zdGF0dXMpKSk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIGNoZWNrRm9yVXBkYXRlc1Jvdyhjb25maWc6IENvZGV4UGx1c1BsdXNDb25maWcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNoZWNrID0gY29uZmlnLnVwZGF0ZUNoZWNrO1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSBjaGVjaz8udXBkYXRlQXZhaWxhYmxlID8gXCJDb2RleCsrIHVwZGF0ZSBhdmFpbGFibGVcIiA6IFwiQ2hlY2sgZm9yIENvZGV4KysgdXBkYXRlc1wiO1xuICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZGVzYy5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gIGRlc2MudGV4dENvbnRlbnQgPSB1cGRhdGVTdW1tYXJ5KGNoZWNrKTtcbiAgbGVmdC5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIHJvdy5hcHBlbmRDaGlsZChsZWZ0KTtcblxuICBjb25zdCBhY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYWN0aW9ucy5jbGFzc05hbWUgPSBcImZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIGlmIChjaGVjaz8ucmVsZWFzZVVybCkge1xuICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQoXG4gICAgICBjb21wYWN0QnV0dG9uKFwiUmVsZWFzZSBOb3Rlc1wiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDpvcGVuLWV4dGVybmFsXCIsIGNoZWNrLnJlbGVhc2VVcmwpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgIGNvbXBhY3RCdXR0b24oXCJDaGVjayBOb3dcIiwgKCkgPT4ge1xuICAgICAgcm93LnN0eWxlLm9wYWNpdHkgPSBcIjAuNjVcIjtcbiAgICAgIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAgICAgLmludm9rZShcImNvZGV4cHA6Y2hlY2stY29kZXhwcC11cGRhdGVcIiwgdHJ1ZSlcbiAgICAgICAgLnRoZW4oKCkgPT4gcmVmcmVzaENvbmZpZ0NhcmQocm93KSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiBwbG9nKFwiQ29kZXgrKyByZWxlYXNlIGNoZWNrIGZhaWxlZFwiLCBTdHJpbmcoZSkpKVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgcm93LnN0eWxlLm9wYWNpdHkgPSBcIlwiO1xuICAgICAgICB9KTtcbiAgICB9KSxcbiAgKTtcbiAgYWN0aW9ucy5hcHBlbmRDaGlsZChcbiAgICBjb21wYWN0QnV0dG9uKFwiRG93bmxvYWQgVXBkYXRlXCIsICgpID0+IHtcbiAgICAgIHJvdy5zdHlsZS5vcGFjaXR5ID0gXCIwLjY1XCI7XG4gICAgICBjb25zdCBidXR0b25zID0gYWN0aW9ucy5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpO1xuICAgICAgYnV0dG9ucy5mb3JFYWNoKChidXR0b24pID0+IChidXR0b24uZGlzYWJsZWQgPSB0cnVlKSk7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgICAgIC5pbnZva2UoXCJjb2RleHBwOnJ1bi1jb2RleHBwLXVwZGF0ZVwiKVxuICAgICAgICAudGhlbigoKSA9PiByZWZyZXNoQ29uZmlnQ2FyZChyb3cpKVxuICAgICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBwbG9nKFwiQ29kZXgrKyBzZWxmLXVwZGF0ZSBmYWlsZWRcIiwgU3RyaW5nKGUpKTtcbiAgICAgICAgICB2b2lkIHJlZnJlc2hDb25maWdDYXJkKHJvdyk7XG4gICAgICAgIH0pXG4gICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICByb3cuc3R5bGUub3BhY2l0eSA9IFwiXCI7XG4gICAgICAgICAgYnV0dG9ucy5mb3JFYWNoKChidXR0b24pID0+IChidXR0b24uZGlzYWJsZWQgPSBmYWxzZSkpO1xuICAgICAgICB9KTtcbiAgICB9KSxcbiAgKTtcbiAgcm93LmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiByZWxlYXNlTm90ZXNSb3coY2hlY2s6IENvZGV4UGx1c1BsdXNVcGRhdGVDaGVjayk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcm93LmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMiBwLTNcIjtcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZS5jbGFzc05hbWUgPSBcInRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSBcIkxhdGVzdCByZWxlYXNlIG5vdGVzXCI7XG4gIHJvdy5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBib2R5LmNsYXNzTmFtZSA9XG4gICAgXCJtYXgtaC02MCBvdmVyZmxvdy1hdXRvIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tZm9yZWdyb3VuZC81IHAtMyB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnlcIjtcbiAgYm9keS5hcHBlbmRDaGlsZChyZW5kZXJSZWxlYXNlTm90ZXNNYXJrZG93bihjaGVjay5yZWxlYXNlTm90ZXM/LnRyaW0oKSB8fCBjaGVjay5lcnJvciB8fCBcIk5vIHJlbGVhc2Ugbm90ZXMgYXZhaWxhYmxlLlwiKSk7XG4gIHJvdy5hcHBlbmRDaGlsZChib2R5KTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gcmVuZGVyUmVsZWFzZU5vdGVzTWFya2Rvd24obWFya2Rvd246IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJvb3QuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC0yXCI7XG4gIGNvbnN0IGxpbmVzID0gbWFya2Rvd24ucmVwbGFjZSgvXFxyXFxuPy9nLCBcIlxcblwiKS5zcGxpdChcIlxcblwiKTtcbiAgbGV0IHBhcmFncmFwaDogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGxpc3Q6IEhUTUxPTGlzdEVsZW1lbnQgfCBIVE1MVUxpc3RFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIGxldCBjb2RlTGluZXM6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3QgZmx1c2hQYXJhZ3JhcGggPSAoKSA9PiB7XG4gICAgaWYgKHBhcmFncmFwaC5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICBjb25zdCBwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInBcIik7XG4gICAgcC5jbGFzc05hbWUgPSBcIm0tMCBsZWFkaW5nLTVcIjtcbiAgICBhcHBlbmRJbmxpbmVNYXJrZG93bihwLCBwYXJhZ3JhcGguam9pbihcIiBcIikudHJpbSgpKTtcbiAgICByb290LmFwcGVuZENoaWxkKHApO1xuICAgIHBhcmFncmFwaCA9IFtdO1xuICB9O1xuICBjb25zdCBmbHVzaExpc3QgPSAoKSA9PiB7XG4gICAgaWYgKCFsaXN0KSByZXR1cm47XG4gICAgcm9vdC5hcHBlbmRDaGlsZChsaXN0KTtcbiAgICBsaXN0ID0gbnVsbDtcbiAgfTtcbiAgY29uc3QgZmx1c2hDb2RlID0gKCkgPT4ge1xuICAgIGlmICghY29kZUxpbmVzKSByZXR1cm47XG4gICAgY29uc3QgcHJlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInByZVwiKTtcbiAgICBwcmUuY2xhc3NOYW1lID1cbiAgICAgIFwibS0wIG92ZXJmbG93LWF1dG8gcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBiZy10b2tlbi1mb3JlZ3JvdW5kLzEwIHAtMiB0ZXh0LXhzIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gICAgY29uc3QgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjb2RlXCIpO1xuICAgIGNvZGUudGV4dENvbnRlbnQgPSBjb2RlTGluZXMuam9pbihcIlxcblwiKTtcbiAgICBwcmUuYXBwZW5kQ2hpbGQoY29kZSk7XG4gICAgcm9vdC5hcHBlbmRDaGlsZChwcmUpO1xuICAgIGNvZGVMaW5lcyA9IG51bGw7XG4gIH07XG5cbiAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgaWYgKGxpbmUudHJpbSgpLnN0YXJ0c1dpdGgoXCJgYGBcIikpIHtcbiAgICAgIGlmIChjb2RlTGluZXMpIGZsdXNoQ29kZSgpO1xuICAgICAgZWxzZSB7XG4gICAgICAgIGZsdXNoUGFyYWdyYXBoKCk7XG4gICAgICAgIGZsdXNoTGlzdCgpO1xuICAgICAgICBjb2RlTGluZXMgPSBbXTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY29kZUxpbmVzKSB7XG4gICAgICBjb2RlTGluZXMucHVzaChsaW5lKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHRyaW1tZWQgPSBsaW5lLnRyaW0oKTtcbiAgICBpZiAoIXRyaW1tZWQpIHtcbiAgICAgIGZsdXNoUGFyYWdyYXBoKCk7XG4gICAgICBmbHVzaExpc3QoKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGhlYWRpbmcgPSAvXigjezEsM30pXFxzKyguKykkLy5leGVjKHRyaW1tZWQpO1xuICAgIGlmIChoZWFkaW5nKSB7XG4gICAgICBmbHVzaFBhcmFncmFwaCgpO1xuICAgICAgZmx1c2hMaXN0KCk7XG4gICAgICBjb25zdCBoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChoZWFkaW5nWzFdLmxlbmd0aCA9PT0gMSA/IFwiaDNcIiA6IFwiaDRcIik7XG4gICAgICBoLmNsYXNzTmFtZSA9IFwibS0wIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgICAgIGFwcGVuZElubGluZU1hcmtkb3duKGgsIGhlYWRpbmdbMl0pO1xuICAgICAgcm9vdC5hcHBlbmRDaGlsZChoKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHVub3JkZXJlZCA9IC9eWy0qXVxccysoLispJC8uZXhlYyh0cmltbWVkKTtcbiAgICBjb25zdCBvcmRlcmVkID0gL15cXGQrWy4pXVxccysoLispJC8uZXhlYyh0cmltbWVkKTtcbiAgICBpZiAodW5vcmRlcmVkIHx8IG9yZGVyZWQpIHtcbiAgICAgIGZsdXNoUGFyYWdyYXBoKCk7XG4gICAgICBjb25zdCB3YW50T3JkZXJlZCA9IEJvb2xlYW4ob3JkZXJlZCk7XG4gICAgICBpZiAoIWxpc3QgfHwgKHdhbnRPcmRlcmVkICYmIGxpc3QudGFnTmFtZSAhPT0gXCJPTFwiKSB8fCAoIXdhbnRPcmRlcmVkICYmIGxpc3QudGFnTmFtZSAhPT0gXCJVTFwiKSkge1xuICAgICAgICBmbHVzaExpc3QoKTtcbiAgICAgICAgbGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQod2FudE9yZGVyZWQgPyBcIm9sXCIgOiBcInVsXCIpO1xuICAgICAgICBsaXN0LmNsYXNzTmFtZSA9IHdhbnRPcmRlcmVkXG4gICAgICAgICAgPyBcIm0tMCBsaXN0LWRlY2ltYWwgc3BhY2UteS0xIHBsLTUgbGVhZGluZy01XCJcbiAgICAgICAgICA6IFwibS0wIGxpc3QtZGlzYyBzcGFjZS15LTEgcGwtNSBsZWFkaW5nLTVcIjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuICAgICAgYXBwZW5kSW5saW5lTWFya2Rvd24obGksICh1bm9yZGVyZWQgPz8gb3JkZXJlZCk/LlsxXSA/PyBcIlwiKTtcbiAgICAgIGxpc3QuYXBwZW5kQ2hpbGQobGkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcXVvdGUgPSAvXj5cXHM/KC4rKSQvLmV4ZWModHJpbW1lZCk7XG4gICAgaWYgKHF1b3RlKSB7XG4gICAgICBmbHVzaFBhcmFncmFwaCgpO1xuICAgICAgZmx1c2hMaXN0KCk7XG4gICAgICBjb25zdCBibG9ja3F1b3RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJsb2NrcXVvdGVcIik7XG4gICAgICBibG9ja3F1b3RlLmNsYXNzTmFtZSA9IFwibS0wIGJvcmRlci1sLTIgYm9yZGVyLXRva2VuLWJvcmRlciBwbC0zIGxlYWRpbmctNVwiO1xuICAgICAgYXBwZW5kSW5saW5lTWFya2Rvd24oYmxvY2txdW90ZSwgcXVvdGVbMV0pO1xuICAgICAgcm9vdC5hcHBlbmRDaGlsZChibG9ja3F1b3RlKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHBhcmFncmFwaC5wdXNoKHRyaW1tZWQpO1xuICB9XG5cbiAgZmx1c2hQYXJhZ3JhcGgoKTtcbiAgZmx1c2hMaXN0KCk7XG4gIGZsdXNoQ29kZSgpO1xuICByZXR1cm4gcm9vdDtcbn1cblxuZnVuY3Rpb24gYXBwZW5kSW5saW5lTWFya2Rvd24ocGFyZW50OiBIVE1MRWxlbWVudCwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHBhdHRlcm4gPSAvKGAoW15gXSspYHxcXFsoW15cXF1dKylcXF1cXCgoaHR0cHM/OlxcL1xcL1teXFxzKV0rKVxcKXxcXCpcXCooW14qXSspXFwqXFwqfFxcKihbXipdKylcXCopL2c7XG4gIGxldCBsYXN0SW5kZXggPSAwO1xuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHRleHQubWF0Y2hBbGwocGF0dGVybikpIHtcbiAgICBpZiAobWF0Y2guaW5kZXggPT09IHVuZGVmaW5lZCkgY29udGludWU7XG4gICAgYXBwZW5kVGV4dChwYXJlbnQsIHRleHQuc2xpY2UobGFzdEluZGV4LCBtYXRjaC5pbmRleCkpO1xuICAgIGlmIChtYXRjaFsyXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBjb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNvZGVcIik7XG4gICAgICBjb2RlLmNsYXNzTmFtZSA9XG4gICAgICAgIFwicm91bmRlZCBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBiZy10b2tlbi1mb3JlZ3JvdW5kLzEwIHB4LTEgcHktMC41IHRleHQteHMgdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgICAgIGNvZGUudGV4dENvbnRlbnQgPSBtYXRjaFsyXTtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZChjb2RlKTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoWzNdICE9PSB1bmRlZmluZWQgJiYgbWF0Y2hbNF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuICAgICAgYS5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1wcmltYXJ5IHVuZGVybGluZSB1bmRlcmxpbmUtb2Zmc2V0LTJcIjtcbiAgICAgIGEuaHJlZiA9IG1hdGNoWzRdO1xuICAgICAgYS50YXJnZXQgPSBcIl9ibGFua1wiO1xuICAgICAgYS5yZWwgPSBcIm5vb3BlbmVyIG5vcmVmZXJyZXJcIjtcbiAgICAgIGEudGV4dENvbnRlbnQgPSBtYXRjaFszXTtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZChhKTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoWzVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IHN0cm9uZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHJvbmdcIik7XG4gICAgICBzdHJvbmcuY2xhc3NOYW1lID0gXCJmb250LW1lZGl1bSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICAgICAgc3Ryb25nLnRleHRDb250ZW50ID0gbWF0Y2hbNV07XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoc3Ryb25nKTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoWzZdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImVtXCIpO1xuICAgICAgZW0udGV4dENvbnRlbnQgPSBtYXRjaFs2XTtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZChlbSk7XG4gICAgfVxuICAgIGxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuICB9XG4gIGFwcGVuZFRleHQocGFyZW50LCB0ZXh0LnNsaWNlKGxhc3RJbmRleCkpO1xufVxuXG5mdW5jdGlvbiBhcHBlbmRUZXh0KHBhcmVudDogSFRNTEVsZW1lbnQsIHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICBpZiAodGV4dCkgcGFyZW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyV2F0Y2hlckhlYWx0aENhcmQoY2FyZDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgdm9pZCBpcGNSZW5kZXJlclxuICAgIC5pbnZva2UoXCJjb2RleHBwOmdldC13YXRjaGVyLWhlYWx0aFwiKVxuICAgIC50aGVuKChoZWFsdGgpID0+IHtcbiAgICAgIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgcmVuZGVyV2F0Y2hlckhlYWx0aChjYXJkLCBoZWFsdGggYXMgV2F0Y2hlckhlYWx0aCk7XG4gICAgfSlcbiAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgY2FyZC5hcHBlbmRDaGlsZChyb3dTaW1wbGUoXCJDb3VsZCBub3QgY2hlY2sgd2F0Y2hlclwiLCBTdHJpbmcoZSkpKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyV2F0Y2hlckhlYWx0aChjYXJkOiBIVE1MRWxlbWVudCwgaGVhbHRoOiBXYXRjaGVySGVhbHRoKTogdm9pZCB7XG4gIGNhcmQuYXBwZW5kQ2hpbGQod2F0Y2hlclN1bW1hcnlSb3coaGVhbHRoKSk7XG4gIGZvciAoY29uc3QgY2hlY2sgb2YgaGVhbHRoLmNoZWNrcykge1xuICAgIGlmIChjaGVjay5zdGF0dXMgPT09IFwib2tcIikgY29udGludWU7XG4gICAgY2FyZC5hcHBlbmRDaGlsZCh3YXRjaGVyQ2hlY2tSb3coY2hlY2spKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3YXRjaGVyU3VtbWFyeVJvdyhoZWFsdGg6IFdhdGNoZXJIZWFsdGgpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJvdy5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNCBwLTNcIjtcbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgaXRlbXMtc3RhcnQgZ2FwLTNcIjtcbiAgbGVmdC5hcHBlbmRDaGlsZChzdGF0dXNCYWRnZShoZWFsdGguc3RhdHVzLCBoZWFsdGgud2F0Y2hlcikpO1xuICBjb25zdCBzdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSBoZWFsdGgudGl0bGU7XG4gIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBkZXNjLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSBtaW4tdy0wIHRleHQtc21cIjtcbiAgZGVzYy50ZXh0Q29udGVudCA9IGAke2hlYWx0aC5zdW1tYXJ5fSBDaGVja2VkICR7bmV3IERhdGUoaGVhbHRoLmNoZWNrZWRBdCkudG9Mb2NhbGVTdHJpbmcoKX0uYDtcbiAgc3RhY2suYXBwZW5kQ2hpbGQodGl0bGUpO1xuICBzdGFjay5hcHBlbmRDaGlsZChkZXNjKTtcbiAgbGVmdC5hcHBlbmRDaGlsZChzdGFjayk7XG4gIHJvdy5hcHBlbmRDaGlsZChsZWZ0KTtcblxuICBjb25zdCBhY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBhY3Rpb24uY2xhc3NOYW1lID0gXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMlwiO1xuICBhY3Rpb24uYXBwZW5kQ2hpbGQoXG4gICAgY29tcGFjdEJ1dHRvbihcIkNoZWNrIE5vd1wiLCAoKSA9PiB7XG4gICAgICBjb25zdCBjYXJkID0gcm93LnBhcmVudEVsZW1lbnQ7XG4gICAgICBpZiAoIWNhcmQpIHJldHVybjtcbiAgICAgIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgY2FyZC5hcHBlbmRDaGlsZChyb3dTaW1wbGUoXCJDaGVja2luZyB3YXRjaGVyXCIsIFwiVmVyaWZ5aW5nIHRoZSB1cGRhdGVyIHJlcGFpciBzZXJ2aWNlLlwiKSk7XG4gICAgICByZW5kZXJXYXRjaGVySGVhbHRoQ2FyZChjYXJkKTtcbiAgICB9KSxcbiAgKTtcbiAgcm93LmFwcGVuZENoaWxkKGFjdGlvbik7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIHdhdGNoZXJDaGVja1JvdyhjaGVjazogV2F0Y2hlckhlYWx0aENoZWNrKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSByb3dTaW1wbGUoY2hlY2submFtZSwgY2hlY2suZGV0YWlsKTtcbiAgY29uc3QgbGVmdCA9IHJvdy5maXJzdEVsZW1lbnRDaGlsZCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChsZWZ0KSBsZWZ0LnByZXBlbmQoc3RhdHVzQmFkZ2UoY2hlY2suc3RhdHVzKSk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIHN0YXR1c0JhZGdlKHN0YXR1czogXCJva1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCIsIGxhYmVsPzogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBjb25zdCB0b25lID1cbiAgICBzdGF0dXMgPT09IFwib2tcIlxuICAgICAgPyBcImJvcmRlci10b2tlbi1jaGFydHMtZ3JlZW4gdGV4dC10b2tlbi1jaGFydHMtZ3JlZW5cIlxuICAgICAgOiBzdGF0dXMgPT09IFwid2FyblwiXG4gICAgICAgID8gXCJib3JkZXItdG9rZW4tY2hhcnRzLXllbGxvdyB0ZXh0LXRva2VuLWNoYXJ0cy15ZWxsb3dcIlxuICAgICAgICA6IFwiYm9yZGVyLXRva2VuLWNoYXJ0cy1yZWQgdGV4dC10b2tlbi1jaGFydHMtcmVkXCI7XG4gIGJhZGdlLmNsYXNzTmFtZSA9IGBpbmxpbmUtZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgcm91bmRlZC1mdWxsIGJvcmRlciBweC0yIHB5LTAuNSB0ZXh0LXhzIGZvbnQtbWVkaXVtICR7dG9uZX1gO1xuICBiYWRnZS50ZXh0Q29udGVudCA9IGxhYmVsIHx8IChzdGF0dXMgPT09IFwib2tcIiA/IFwiT0tcIiA6IHN0YXR1cyA9PT0gXCJ3YXJuXCIgPyBcIlJldmlld1wiIDogXCJFcnJvclwiKTtcbiAgcmV0dXJuIGJhZGdlO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTdW1tYXJ5KGNoZWNrOiBDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2sgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFjaGVjaykgcmV0dXJuIFwiTm8gdXBkYXRlIGNoZWNrIGhhcyBydW4geWV0LlwiO1xuICBjb25zdCBsYXRlc3QgPSBjaGVjay5sYXRlc3RWZXJzaW9uID8gYExhdGVzdCB2JHtjaGVjay5sYXRlc3RWZXJzaW9ufS4gYCA6IFwiXCI7XG4gIGNvbnN0IGNoZWNrZWQgPSBgQ2hlY2tlZCAke25ldyBEYXRlKGNoZWNrLmNoZWNrZWRBdCkudG9Mb2NhbGVTdHJpbmcoKX0uYDtcbiAgaWYgKGNoZWNrLmVycm9yKSByZXR1cm4gYCR7bGF0ZXN0fSR7Y2hlY2tlZH0gJHtjaGVjay5lcnJvcn1gO1xuICByZXR1cm4gYCR7bGF0ZXN0fSR7Y2hlY2tlZH1gO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDaGFubmVsU3VtbWFyeShjb25maWc6IENvZGV4UGx1c1BsdXNDb25maWcpOiBzdHJpbmcge1xuICBpZiAoY29uZmlnLnVwZGF0ZUNoYW5uZWwgPT09IFwiY3VzdG9tXCIpIHtcbiAgICByZXR1cm4gYCR7Y29uZmlnLnVwZGF0ZVJlcG8gfHwgXCJiLW5uZXR0L2NvZGV4LXBsdXNwbHVzXCJ9ICR7Y29uZmlnLnVwZGF0ZVJlZiB8fCBcIihubyByZWYgc2V0KVwifWA7XG4gIH1cbiAgaWYgKGNvbmZpZy51cGRhdGVDaGFubmVsID09PSBcInByZXJlbGVhc2VcIikge1xuICAgIHJldHVybiBcIlVzZSB0aGUgbmV3ZXN0IHB1Ymxpc2hlZCBHaXRIdWIgcmVsZWFzZSwgaW5jbHVkaW5nIHByZXJlbGVhc2VzLlwiO1xuICB9XG4gIHJldHVybiBcIlVzZSB0aGUgbGF0ZXN0IHN0YWJsZSBHaXRIdWIgcmVsZWFzZS5cIjtcbn1cblxuZnVuY3Rpb24gc2VsZlVwZGF0ZVN1bW1hcnkoc3RhdGU6IFNlbGZVcGRhdGVTdGF0ZSB8IG51bGwpOiBzdHJpbmcge1xuICBpZiAoIXN0YXRlKSByZXR1cm4gXCJObyBhdXRvbWF0aWMgQ29kZXgrKyB1cGRhdGUgaGFzIHJ1biB5ZXQuXCI7XG4gIGNvbnN0IGNoZWNrZWQgPSBuZXcgRGF0ZShzdGF0ZS5jb21wbGV0ZWRBdCA/PyBzdGF0ZS5jaGVja2VkQXQpLnRvTG9jYWxlU3RyaW5nKCk7XG4gIGNvbnN0IHRhcmdldCA9IHN0YXRlLmxhdGVzdFZlcnNpb24gPyBgIFRhcmdldCB2JHtzdGF0ZS5sYXRlc3RWZXJzaW9ufS5gIDogc3RhdGUudGFyZ2V0UmVmID8gYCBUYXJnZXQgJHtzdGF0ZS50YXJnZXRSZWZ9LmAgOiBcIlwiO1xuICBjb25zdCBzb3VyY2UgPSBzdGF0ZS5pbnN0YWxsYXRpb25Tb3VyY2U/LmxhYmVsID8/IFwidW5rbm93biBzb3VyY2VcIjtcbiAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gXCJmYWlsZWRcIikgcmV0dXJuIGBGYWlsZWQgJHtjaGVja2VkfS4ke3RhcmdldH0gJHtzdGF0ZS5lcnJvciA/PyBcIlVua25vd24gZXJyb3JcIn1gO1xuICBpZiAoc3RhdGUuc3RhdHVzID09PSBcInVwZGF0ZWRcIikgcmV0dXJuIGBVcGRhdGVkICR7Y2hlY2tlZH0uJHt0YXJnZXR9IFNvdXJjZTogJHtzb3VyY2V9LmA7XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwidXAtdG8tZGF0ZVwiKSByZXR1cm4gYFVwIHRvIGRhdGUgJHtjaGVja2VkfS4ke3RhcmdldH0gU291cmNlOiAke3NvdXJjZX0uYDtcbiAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gXCJkaXNhYmxlZFwiKSByZXR1cm4gYFNraXBwZWQgJHtjaGVja2VkfTsgYXV0b21hdGljIHJlZnJlc2ggaXMgZGlzYWJsZWQuYDtcbiAgcmV0dXJuIGBDaGVja2luZyBmb3IgdXBkYXRlcy4gU291cmNlOiAke3NvdXJjZX0uYDtcbn1cblxuZnVuY3Rpb24gc2VsZlVwZGF0ZVN0YXR1c1RvbmUoc3RhdHVzOiBTZWxmVXBkYXRlU3RhdHVzKTogXCJva1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCIge1xuICBpZiAoc3RhdHVzID09PSBcImZhaWxlZFwiKSByZXR1cm4gXCJlcnJvclwiO1xuICBpZiAoc3RhdHVzID09PSBcImRpc2FibGVkXCIgfHwgc3RhdHVzID09PSBcImNoZWNraW5nXCIpIHJldHVybiBcIndhcm5cIjtcbiAgcmV0dXJuIFwib2tcIjtcbn1cblxuZnVuY3Rpb24gc2VsZlVwZGF0ZVN0YXR1c0xhYmVsKHN0YXR1czogU2VsZlVwZGF0ZVN0YXR1cyk6IHN0cmluZyB7XG4gIGlmIChzdGF0dXMgPT09IFwidXAtdG8tZGF0ZVwiKSByZXR1cm4gXCJVcCB0byBkYXRlXCI7XG4gIGlmIChzdGF0dXMgPT09IFwidXBkYXRlZFwiKSByZXR1cm4gXCJVcGRhdGVkXCI7XG4gIGlmIChzdGF0dXMgPT09IFwiZmFpbGVkXCIpIHJldHVybiBcIkZhaWxlZFwiO1xuICBpZiAoc3RhdHVzID09PSBcImRpc2FibGVkXCIpIHJldHVybiBcIkRpc2FibGVkXCI7XG4gIHJldHVybiBcIkNoZWNraW5nXCI7XG59XG5cbmZ1bmN0aW9uIHJlZnJlc2hDb25maWdDYXJkKHJvdzogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgY2FyZCA9IHJvdy5jbG9zZXN0KFwiW2RhdGEtY29kZXhwcC1jb25maWctY2FyZF1cIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIWNhcmQpIHJldHVybjtcbiAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIGNhcmQuYXBwZW5kQ2hpbGQocm93U2ltcGxlKFwiUmVmcmVzaGluZ1wiLCBcIkxvYWRpbmcgY3VycmVudCBDb2RleCsrIHVwZGF0ZSBzdGF0dXMuXCIpKTtcbiAgdm9pZCBpcGNSZW5kZXJlclxuICAgIC5pbnZva2UoXCJjb2RleHBwOmdldC1jb25maWdcIilcbiAgICAudGhlbigoY29uZmlnKSA9PiB7XG4gICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgIHJlbmRlckNvZGV4UGx1c1BsdXNDb25maWcoY2FyZCwgY29uZmlnIGFzIENvZGV4UGx1c1BsdXNDb25maWcpO1xuICAgIH0pXG4gICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgIGNhcmQuYXBwZW5kQ2hpbGQocm93U2ltcGxlKFwiQ291bGQgbm90IHJlZnJlc2ggdXBkYXRlIHNldHRpbmdzXCIsIFN0cmluZyhlKSkpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiB1bmluc3RhbGxSb3coKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBhY3Rpb25Sb3coXG4gICAgXCJVbmluc3RhbGwgQ29kZXgrK1wiLFxuICAgIFwiQ29waWVzIHRoZSB1bmluc3RhbGwgY29tbWFuZC4gUnVuIGl0IGZyb20gYSB0ZXJtaW5hbCBhZnRlciBxdWl0dGluZyBDb2RleC5cIixcbiAgKTtcbiAgY29uc3QgYWN0aW9uID0gcm93LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiW2RhdGEtY29kZXhwcC1yb3ctYWN0aW9uc11cIik7XG4gIGFjdGlvbj8uYXBwZW5kQ2hpbGQoXG4gICAgY29tcGFjdEJ1dHRvbihcIkNvcHkgQ29tbWFuZFwiLCAoKSA9PiB7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgICAgIC5pbnZva2UoXCJjb2RleHBwOmNvcHktdGV4dFwiLCBcIm5vZGUgfi8uY29kZXgtcGx1c3BsdXMvc291cmNlL3BhY2thZ2VzL2luc3RhbGxlci9kaXN0L2NsaS5qcyB1bmluc3RhbGxcIilcbiAgICAgICAgLmNhdGNoKChlKSA9PiBwbG9nKFwiY29weSB1bmluc3RhbGwgY29tbWFuZCBmYWlsZWRcIiwgU3RyaW5nKGUpKSk7XG4gICAgfSksXG4gICk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIHJlcG9ydEJ1Z1JvdygpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGFjdGlvblJvdyhcbiAgICBcIlJlcG9ydCBhIGJ1Z1wiLFxuICAgIFwiT3BlbiBhIEdpdEh1YiBpc3N1ZSB3aXRoIHJ1bnRpbWUsIGluc3RhbGxlciwgb3IgdHdlYWstbWFuYWdlciBkZXRhaWxzLlwiLFxuICApO1xuICBjb25zdCBhY3Rpb24gPSByb3cucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCJbZGF0YS1jb2RleHBwLXJvdy1hY3Rpb25zXVwiKTtcbiAgYWN0aW9uPy5hcHBlbmRDaGlsZChcbiAgICBjb21wYWN0QnV0dG9uKFwiT3BlbiBJc3N1ZVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0aXRsZSA9IGVuY29kZVVSSUNvbXBvbmVudChcIltCdWddOiBcIik7XG4gICAgICBjb25zdCBib2R5ID0gZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICBbXG4gICAgICAgICAgXCIjIyBXaGF0IGhhcHBlbmVkP1wiLFxuICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgXCIjIyBTdGVwcyB0byByZXByb2R1Y2VcIixcbiAgICAgICAgICBcIjEuIFwiLFxuICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgXCIjIyBFbnZpcm9ubWVudFwiLFxuICAgICAgICAgIFwiLSBDb2RleCsrIHZlcnNpb246IFwiLFxuICAgICAgICAgIFwiLSBDb2RleCBhcHAgdmVyc2lvbjogXCIsXG4gICAgICAgICAgXCItIE9TOiBcIixcbiAgICAgICAgICBcIlwiLFxuICAgICAgICAgIFwiIyMgTG9nc1wiLFxuICAgICAgICAgIFwiQXR0YWNoIHJlbGV2YW50IGxpbmVzIGZyb20gdGhlIENvZGV4KysgbG9nIGRpcmVjdG9yeS5cIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpLFxuICAgICAgKTtcbiAgICAgIHZvaWQgaXBjUmVuZGVyZXIuaW52b2tlKFxuICAgICAgICBcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLFxuICAgICAgICBgaHR0cHM6Ly9naXRodWIuY29tL2Itbm5ldHQvY29kZXgtcGx1c3BsdXMvaXNzdWVzL25ldz90aXRsZT0ke3RpdGxlfSZib2R5PSR7Ym9keX1gLFxuICAgICAgKTtcbiAgICB9KSxcbiAgKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gYWN0aW9uUm93KHRpdGxlVGV4dDogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSB0aXRsZVRleHQ7XG4gIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBkZXNjLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSBtaW4tdy0wIHRleHQtc21cIjtcbiAgZGVzYy50ZXh0Q29udGVudCA9IGRlc2NyaXB0aW9uO1xuICBsZWZ0LmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgbGVmdC5hcHBlbmRDaGlsZChkZXNjKTtcbiAgcm93LmFwcGVuZENoaWxkKGxlZnQpO1xuICBjb25zdCBhY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYWN0aW9ucy5kYXRhc2V0LmNvZGV4cHBSb3dBY3Rpb25zID0gXCJ0cnVlXCI7XG4gIGFjdGlvbnMuY2xhc3NOYW1lID0gXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMlwiO1xuICByb3cuYXBwZW5kQ2hpbGQoYWN0aW9ucyk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclR3ZWFrU3RvcmVQYWdlKFxuICBzZWN0aW9uc1dyYXA6IEhUTUxFbGVtZW50LFxuICBoZWFkZXJBY3Rpb25zPzogSFRNTEVsZW1lbnQsXG4pOiB2b2lkIHtcbiAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICBzZWN0aW9uLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtNFwiO1xuXG4gIGNvbnN0IHNvdXJjZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBzb3VyY2UuaGlkZGVuID0gdHJ1ZTtcbiAgc291cmNlLmRhdGFzZXQuY29kZXhwcFN0b3JlU291cmNlID0gXCJ0cnVlXCI7XG4gIHNvdXJjZS50ZXh0Q29udGVudCA9IFwiTG9hZGluZyBsaXZlIHJlZ2lzdHJ5XCI7XG5cbiAgY29uc3QgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbnMuY2xhc3NOYW1lID0gXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMlwiO1xuICBjb25zdCByZWZyZXNoQnRuID0gc3RvcmVJY29uQnV0dG9uKHJlZnJlc2hJY29uU3ZnKCksIFwiUmVmcmVzaCB0d2VhayBzdG9yZVwiLCAoKSA9PiB7XG4gICAgcmVmcmVzaEJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgdXBkYXRlU3RvcmVVcGRhdGVCYWRnZShudWxsKTtcbiAgICBncmlkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICByZW5kZXJUd2Vha1N0b3JlR2hvc3RHcmlkKGdyaWQpO1xuICAgIHJlZnJlc2hUd2Vha1N0b3JlR3JpZChncmlkLCBzb3VyY2UsIHJlZnJlc2hCdG4sIHRydWUpO1xuICB9KTtcbiAgYWN0aW9ucy5hcHBlbmRDaGlsZChyZWZyZXNoQnRuKTtcbiAgYWN0aW9ucy5hcHBlbmRDaGlsZChzdG9yZVRvb2xiYXJCdXR0b24oXCJQdWJsaXNoIFR3ZWFrXCIsIG9wZW5QdWJsaXNoVHdlYWtEaWFsb2csIFwicHJpbWFyeVwiKSk7XG4gIGlmIChoZWFkZXJBY3Rpb25zKSB7XG4gICAgaGVhZGVyQWN0aW9ucy5yZXBsYWNlQ2hpbGRyZW4oYWN0aW9ucyk7XG4gIH1cblxuICBjb25zdCBncmlkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZ3JpZC5kYXRhc2V0LmNvZGV4cHBTdG9yZUdyaWQgPSBcInRydWVcIjtcbiAgZ3JpZC5jbGFzc05hbWUgPSBcImdyaWQgZ2FwLTRcIjtcbiAgaWYgKHN0YXRlLnR3ZWFrU3RvcmUpIHtcbiAgICBncmlkLmRhdGFzZXQuY29kZXhwcFN0b3JlID0gSlNPTi5zdHJpbmdpZnkoc3RhdGUudHdlYWtTdG9yZSk7XG4gICAgcmVuZGVyVHdlYWtTdG9yZUdyaWQoZ3JpZCwgc291cmNlKTtcbiAgfSBlbHNlIHtcbiAgICByZW5kZXJUd2Vha1N0b3JlR2hvc3RHcmlkKGdyaWQpO1xuICB9XG4gIHNlY3Rpb24uYXBwZW5kQ2hpbGQoc291cmNlKTtcbiAgc2VjdGlvbi5hcHBlbmRDaGlsZChncmlkKTtcbiAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHNlY3Rpb24pO1xuICByZWZyZXNoVHdlYWtTdG9yZUdyaWQoZ3JpZCwgc291cmNlLCByZWZyZXNoQnRuKTtcbn1cblxuZnVuY3Rpb24gcmVmcmVzaFR3ZWFrU3RvcmVHcmlkKFxuICBncmlkOiBIVE1MRWxlbWVudCxcbiAgc291cmNlOiBIVE1MRWxlbWVudCxcbiAgcmVmcmVzaEJ0bj86IEhUTUxCdXR0b25FbGVtZW50LFxuICBmb3JjZSA9IGZhbHNlLFxuKTogdm9pZCB7XG4gIHZvaWQgZ2V0VHdlYWtTdG9yZShmb3JjZSlcbiAgICAudGhlbigoc3RvcmUpID0+IHtcbiAgICAgIGdyaWQuZGF0YXNldC5jb2RleHBwU3RvcmUgPSBKU09OLnN0cmluZ2lmeShzdG9yZSk7XG4gICAgICByZW5kZXJUd2Vha1N0b3JlR3JpZChncmlkLCBzb3VyY2UpO1xuICAgIH0pXG4gICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICBncmlkLmRhdGFzZXQuY29kZXhwcFN0b3JlID0gXCJcIjtcbiAgICAgIGdyaWQucmVtb3ZlQXR0cmlidXRlKFwiYXJpYS1idXN5XCIpO1xuICAgICAgc291cmNlLnRleHRDb250ZW50ID0gXCJMaXZlIHJlZ2lzdHJ5IHVuYXZhaWxhYmxlXCI7XG4gICAgICB1cGRhdGVTdG9yZVVwZGF0ZUJhZGdlKG51bGwpO1xuICAgICAgZ3JpZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICBncmlkLmFwcGVuZENoaWxkKHN0b3JlTWVzc2FnZUNhcmQoXCJDb3VsZCBub3QgbG9hZCB0d2VhayBzdG9yZVwiLCBTdHJpbmcoZSkpKTtcbiAgICB9KVxuICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgIGlmIChyZWZyZXNoQnRuKSByZWZyZXNoQnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHdhcm1Ud2Vha1N0b3JlKCk6IHZvaWQge1xuICBpZiAoc3RhdGUudHdlYWtTdG9yZSB8fCBzdGF0ZS50d2Vha1N0b3JlUHJvbWlzZSkgcmV0dXJuO1xuICB2b2lkIGdldFR3ZWFrU3RvcmUoKS50aGVuKChzdG9yZSkgPT4ge1xuICAgIHVwZGF0ZVN0b3JlVXBkYXRlQmFkZ2Uob3V0ZGF0ZWRJbnN0YWxsZWRTdG9yZUNvdW50KHN0b3JlLmVudHJpZXMpKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldFR3ZWFrU3RvcmUoZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8VHdlYWtTdG9yZVJlZ2lzdHJ5Vmlldz4ge1xuICBpZiAoIWZvcmNlKSB7XG4gICAgaWYgKHN0YXRlLnR3ZWFrU3RvcmUpIHJldHVybiBQcm9taXNlLnJlc29sdmUoc3RhdGUudHdlYWtTdG9yZSk7XG4gICAgaWYgKHN0YXRlLnR3ZWFrU3RvcmVQcm9taXNlKSByZXR1cm4gc3RhdGUudHdlYWtTdG9yZVByb21pc2U7XG4gIH1cbiAgc3RhdGUudHdlYWtTdG9yZUVycm9yID0gbnVsbDtcbiAgY29uc3QgcHJvbWlzZSA9IGlwY1JlbmRlcmVyXG4gICAgLmludm9rZShcImNvZGV4cHA6Z2V0LXR3ZWFrLXN0b3JlXCIpXG4gICAgLnRoZW4oKHN0b3JlKSA9PiB7XG4gICAgICBzdGF0ZS50d2Vha1N0b3JlID0gc3RvcmUgYXMgVHdlYWtTdG9yZVJlZ2lzdHJ5VmlldztcbiAgICAgIHJldHVybiBzdGF0ZS50d2Vha1N0b3JlO1xuICAgIH0pXG4gICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICBzdGF0ZS50d2Vha1N0b3JlRXJyb3IgPSBlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9KVxuICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgIGlmIChzdGF0ZS50d2Vha1N0b3JlUHJvbWlzZSA9PT0gcHJvbWlzZSkgc3RhdGUudHdlYWtTdG9yZVByb21pc2UgPSBudWxsO1xuICAgIH0pO1xuICBzdGF0ZS50d2Vha1N0b3JlUHJvbWlzZSA9IHByb21pc2U7XG4gIHJldHVybiBwcm9taXNlO1xufVxuXG5mdW5jdGlvbiByZW5kZXJUd2Vha1N0b3JlR3JpZChncmlkOiBIVE1MRWxlbWVudCwgc291cmNlOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBzdG9yZSA9IHBhcnNlU3RvcmVEYXRhc2V0KGdyaWQpO1xuICBpZiAoIXN0b3JlKSByZXR1cm47XG4gIGNvbnN0IGVudHJpZXMgPSBzdG9yZS5lbnRyaWVzO1xuICBncmlkLnJlbW92ZUF0dHJpYnV0ZShcImFyaWEtYnVzeVwiKTtcbiAgc291cmNlLnRleHRDb250ZW50ID0gYFJlZnJlc2hlZCAke25ldyBEYXRlKHN0b3JlLmZldGNoZWRBdCkudG9Mb2NhbGVTdHJpbmcoKX1gO1xuICB1cGRhdGVTdG9yZVVwZGF0ZUJhZGdlKG91dGRhdGVkSW5zdGFsbGVkU3RvcmVDb3VudChlbnRyaWVzKSk7XG4gIGdyaWQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBpZiAoc3RvcmUuZW50cmllcy5sZW5ndGggPT09IDApIHtcbiAgICBncmlkLmFwcGVuZENoaWxkKHN0b3JlTWVzc2FnZUNhcmQoXCJObyB0d2Vha3MgeWV0XCIsIFwiVXNlIFB1Ymxpc2ggVHdlYWsgdG8gc3VibWl0IHRoZSBmaXJzdCBvbmUuXCIpKTtcbiAgICByZXR1cm47XG4gIH1cbiAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSBncmlkLmFwcGVuZENoaWxkKHR3ZWFrU3RvcmVDYXJkKGVudHJ5KSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlU3RvcmVEYXRhc2V0KGdyaWQ6IEhUTUxFbGVtZW50KTogVHdlYWtTdG9yZVJlZ2lzdHJ5VmlldyB8IG51bGwge1xuICBjb25zdCByYXcgPSBncmlkLmRhdGFzZXQuY29kZXhwcFN0b3JlO1xuICBpZiAoIXJhdykgcmV0dXJuIG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmF3KSBhcyBUd2Vha1N0b3JlUmVnaXN0cnlWaWV3O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiB0d2Vha1N0b3JlQ2FyZChlbnRyeTogVHdlYWtTdG9yZUVudHJ5Vmlldyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgc2hlbGwgPSB0d2Vha1N0b3JlQ2FyZFNoZWxsKCk7XG4gIGNvbnN0IHsgY2FyZCwgbGVmdCwgc3RhY2ssIHZlcnNpb25zLCBhY3Rpb25zIH0gPSBzaGVsbDtcblxuICBsZWZ0Lmluc2VydEJlZm9yZShzdG9yZUF2YXRhcihlbnRyeSksIHN0YWNrKTtcblxuICBjb25zdCB0aXRsZVJvdyA9IHR3ZWFrU3RvcmVUaXRsZVJvdygpO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgbGVhZGluZy03IHRleHQtdG9rZW4tZm9yZWdyb3VuZFwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IGVudHJ5Lm1hbmlmZXN0Lm5hbWU7XG4gIHRpdGxlUm93LmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQodmVyaWZpZWRTYWZlQmFkZ2UoKSk7XG4gIHN0YWNrLmFwcGVuZENoaWxkKHRpdGxlUm93KTtcblxuICBpZiAoZW50cnkubWFuaWZlc3QuZGVzY3JpcHRpb24pIHtcbiAgICBjb25zdCBkZXNjID0gdHdlYWtTdG9yZURlc2NyaXB0aW9uKCk7XG4gICAgZGVzYy50ZXh0Q29udGVudCA9IGVudHJ5Lm1hbmlmZXN0LmRlc2NyaXB0aW9uO1xuICAgIHN0YWNrLmFwcGVuZENoaWxkKGRlc2MpO1xuICB9XG5cbiAgc3RhY2suYXBwZW5kQ2hpbGQodHdlYWtTdG9yZVJlYWRNb3JlQnV0dG9uKGVudHJ5LnJlcG8pKTtcbiAgdmVyc2lvbnMuYXBwZW5kQ2hpbGQodHdlYWtTdG9yZVZlcnNpb25CYWRnZShlbnRyeSkpO1xuXG4gIGlmIChlbnRyeS5yZWxlYXNlVXJsKSB7XG4gICAgYWN0aW9ucy5hcHBlbmRDaGlsZChcbiAgICAgIGNvbXBhY3RCdXR0b24oXCJSZWxlYXNlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgZW50cnkucmVsZWFzZVVybCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG4gIGNvbnN0IGhhc1VwZGF0ZSA9ICEhZW50cnkuaW5zdGFsbGVkICYmIGVudHJ5Lmluc3RhbGxlZC52ZXJzaW9uICE9PSBlbnRyeS5tYW5pZmVzdC52ZXJzaW9uO1xuICBpZiAoZW50cnkuaW5zdGFsbGVkICYmICFoYXNVcGRhdGUpIHtcbiAgICBhY3Rpb25zLmFwcGVuZENoaWxkKHN0b3JlU3RhdHVzUGlsbChcIkluc3RhbGxlZFwiKSk7XG4gIH0gZWxzZSBpZiAoZW50cnkucGxhdGZvcm0gJiYgIWVudHJ5LnBsYXRmb3JtLmNvbXBhdGlibGUpIHtcbiAgICBjYXJkLmNsYXNzTGlzdC5hZGQoXCJvcGFjaXR5LTcwXCIpO1xuICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQoc3RvcmVTdGF0dXNQaWxsKHBsYXRmb3JtTG9ja2VkTGFiZWwoZW50cnkucGxhdGZvcm0pKSk7XG4gIH0gZWxzZSBpZiAoZW50cnkucnVudGltZSAmJiAhZW50cnkucnVudGltZS5jb21wYXRpYmxlKSB7XG4gICAgY2FyZC5jbGFzc0xpc3QuYWRkKFwib3BhY2l0eS03MFwiKTtcbiAgICBhY3Rpb25zLmFwcGVuZENoaWxkKHN0b3JlU3RhdHVzUGlsbChydW50aW1lTG9ja2VkTGFiZWwoZW50cnkucnVudGltZSkpKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpbnN0YWxsTGFiZWwgPSBlbnRyeS5pbnN0YWxsZWQgPyBcIlVwZGF0ZVwiIDogXCJJbnN0YWxsXCI7XG4gICAgaWYgKGhhc1VwZGF0ZSkgYWN0aW9ucy5hcHBlbmRDaGlsZChzdG9yZVN0YXR1c1BpbGwoXCJVcGRhdGUgYXZhaWxhYmxlXCIsIFwiaW5mb1wiKSk7XG4gICAgY29uc3QgaW5zdGFsbEJ1dHRvbiA9IHN0b3JlSW5zdGFsbEJ1dHRvbihpbnN0YWxsTGFiZWwsIChidXR0b24pID0+IHtcbiAgICAgIGNvbnN0IGdyaWQgPSBjYXJkLmNsb3Nlc3QoXCJbZGF0YS1jb2RleHBwLXN0b3JlLWdyaWRdXCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IGdyaWQ/LnBhcmVudEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3IoXCJbZGF0YS1jb2RleHBwLXN0b3JlLXNvdXJjZV1cIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgc2hvd1N0b3JlQnV0dG9uTG9hZGluZyhidXR0b24sIGVudHJ5Lmluc3RhbGxlZCA/IFwiVXBkYXRpbmdcIiA6IFwiSW5zdGFsbGluZ1wiKTtcbiAgICAgIGFjdGlvbnMucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKS5mb3JFYWNoKChidXR0b24pID0+IChidXR0b24uZGlzYWJsZWQgPSB0cnVlKSk7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgICAgIC5pbnZva2UoXCJjb2RleHBwOmluc3RhbGwtc3RvcmUtdHdlYWtcIiwgZW50cnkuaWQpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICBzaG93U3RvcmVUb2FzdChgJHtlbnRyeS5tYW5pZmVzdC5uYW1lfSBpbnN0YWxsZWQuYCk7XG4gICAgICAgICAgc2hvd1N0b3JlQnV0dG9uSW5zdGFsbGVkKGJ1dHRvbik7XG4gICAgICAgICAgdmVyc2lvbnMucmVwbGFjZUNoaWxkcmVuKHR3ZWFrU3RvcmVWZXJzaW9uQmFkZ2UoZW50cnksIGVudHJ5Lm1hbmlmZXN0LnZlcnNpb24pKTtcbiAgICAgICAgICB1cGRhdGVTdG9yZVVwZGF0ZUJhZGdlKE1hdGgubWF4KDAsIGN1cnJlbnRTdG9yZVVwZGF0ZUJhZGdlQ291bnQoKSAtIDEpKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGFjdGlvbnMucmVwbGFjZUNoaWxkcmVuKHN0b3JlU3RhdHVzUGlsbChcIkluc3RhbGxlZFwiKSk7XG4gICAgICAgICAgICBpZiAoZ3JpZCAmJiBzb3VyY2UpIHJlZnJlc2hUd2Vha1N0b3JlR3JpZChncmlkLCBzb3VyY2UsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICAgICAgfSwgOTAwKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgcmVzZXRTdG9yZUluc3RhbGxCdXR0b24oYnV0dG9uLCBpbnN0YWxsTGFiZWwpO1xuICAgICAgICAgIGFjdGlvbnMucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKS5mb3JFYWNoKChidXR0b24pID0+IChidXR0b24uZGlzYWJsZWQgPSBmYWxzZSkpO1xuICAgICAgICAgIHNob3dTdG9yZUNhcmRNZXNzYWdlKGNhcmQsIFN0cmluZygoZSBhcyBFcnJvcikubWVzc2FnZSA/PyBlKSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQoaW5zdGFsbEJ1dHRvbik7XG4gIH1cbiAgcmV0dXJuIGNhcmQ7XG59XG5cbmZ1bmN0aW9uIHBsYXRmb3JtTG9ja2VkTGFiZWwocGxhdGZvcm06IE5vbk51bGxhYmxlPFR3ZWFrU3RvcmVFbnRyeVZpZXdbXCJwbGF0Zm9ybVwiXT4pOiBzdHJpbmcge1xuICBjb25zdCBzdXBwb3J0ZWQgPSBwbGF0Zm9ybS5zdXBwb3J0ZWQgPz8gW107XG4gIGlmIChzdXBwb3J0ZWQuaW5jbHVkZXMoXCJ3aW4zMlwiKSkgcmV0dXJuIFwiV2luZG93cyBvbmx5XCI7XG4gIGlmIChzdXBwb3J0ZWQuaW5jbHVkZXMoXCJkYXJ3aW5cIikpIHJldHVybiBcIm1hY09TIG9ubHlcIjtcbiAgaWYgKHN1cHBvcnRlZC5pbmNsdWRlcyhcImxpbnV4XCIpKSByZXR1cm4gXCJMaW51eCBvbmx5XCI7XG4gIHJldHVybiBcIlVuYXZhaWxhYmxlXCI7XG59XG5cbmZ1bmN0aW9uIHJ1bnRpbWVMb2NrZWRMYWJlbChydW50aW1lOiBOb25OdWxsYWJsZTxUd2Vha1N0b3JlRW50cnlWaWV3W1wicnVudGltZVwiXT4pOiBzdHJpbmcge1xuICByZXR1cm4gcnVudGltZS5yZXF1aXJlZCA/IGBSZXF1aXJlcyBDb2RleCsrICR7cnVudGltZS5yZXF1aXJlZH1gIDogXCJSZXF1aXJlcyBuZXdlciBDb2RleCsrXCI7XG59XG5cbmZ1bmN0aW9uIHNob3dTdG9yZUNhcmRNZXNzYWdlKGNhcmQ6IEhUTUxFbGVtZW50LCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgY2FyZC5xdWVyeVNlbGVjdG9yKFwiW2RhdGEtY29kZXhwcC1zdG9yZS1jYXJkLW1lc3NhZ2VdXCIpPy5yZW1vdmUoKTtcbiAgY29uc3Qgbm90aWNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbm90aWNlLmRhdGFzZXQuY29kZXhwcFN0b3JlQ2FyZE1lc3NhZ2UgPSBcInRydWVcIjtcbiAgbm90aWNlLmNsYXNzTmFtZSA9XG4gICAgXCJyb3VuZGVkLWxnIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyLzUwIGJnLXRva2VuLWZvcmVncm91bmQvNSBweC0zIHB5LTIgdGV4dC1zbSBsZWFkaW5nLTUgdGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kXCI7XG4gIG5vdGljZS50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gIGNvbnN0IGFjdGlvbnMgPSBjYXJkLmxhc3RFbGVtZW50Q2hpbGQ7XG4gIGlmIChhY3Rpb25zKSBjYXJkLmluc2VydEJlZm9yZShub3RpY2UsIGFjdGlvbnMpO1xuICBlbHNlIGNhcmQuYXBwZW5kQ2hpbGQobm90aWNlKTtcbn1cblxuZnVuY3Rpb24gdHdlYWtTdG9yZUNhcmRTaGVsbCgpOiB7XG4gIGNhcmQ6IEhUTUxFbGVtZW50O1xuICBsZWZ0OiBIVE1MRWxlbWVudDtcbiAgc3RhY2s6IEhUTUxFbGVtZW50O1xuICB2ZXJzaW9uczogSFRNTEVsZW1lbnQ7XG4gIGFjdGlvbnM6IEhUTUxFbGVtZW50O1xufSB7XG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBjYXJkLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyLzQwIGZsZXggbWluLWgtWzE5MHB4XSBmbGV4LWNvbCBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcm91bmRlZC0yeGwgYm9yZGVyIHAtNCB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy10b2tlbi1mb3JlZ3JvdW5kLzVcIjtcblxuICBjb25zdCBsZWZ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbGVmdC5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LTEgaXRlbXMtc3RhcnQgZ2FwLTNcIjtcbiAgY29uc3Qgc3RhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBzdGFjay5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LTEgZmxleC1jb2wgZ2FwLTJcIjtcbiAgbGVmdC5hcHBlbmRDaGlsZChzdGFjayk7XG4gIGNhcmQuYXBwZW5kQ2hpbGQobGVmdCk7XG5cbiAgY29uc3QgZm9vdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZm9vdGVyLmNsYXNzTmFtZSA9IFwibXQtYXV0byBmbGV4IG1pbi13LTAgZmxleC13cmFwIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTJcIjtcbiAgY29uc3QgdmVyc2lvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB2ZXJzaW9ucy5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LTEgaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIGZvb3Rlci5hcHBlbmRDaGlsZCh2ZXJzaW9ucyk7XG4gIGNvbnN0IGFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBhY3Rpb25zLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1lbmQgZ2FwLTJcIjtcbiAgZm9vdGVyLmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuICBjYXJkLmFwcGVuZENoaWxkKGZvb3Rlcik7XG5cbiAgcmV0dXJuIHsgY2FyZCwgbGVmdCwgc3RhY2ssIHZlcnNpb25zLCBhY3Rpb25zIH07XG59XG5cbmZ1bmN0aW9uIHR3ZWFrU3RvcmVUaXRsZVJvdygpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHRpdGxlUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGVSb3cuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIGdhcC0zXCI7XG4gIHJldHVybiB0aXRsZVJvdztcbn1cblxuZnVuY3Rpb24gdHdlYWtTdG9yZURlc2NyaXB0aW9uKCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGRlc2MuY2xhc3NOYW1lID0gXCJsaW5lLWNsYW1wLTMgbWluLXctMCB0ZXh0LXNtIGxlYWRpbmctNSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIHJldHVybiBkZXNjO1xufVxuXG5mdW5jdGlvbiB0d2Vha1N0b3JlUmVhZE1vcmVCdXR0b24ocmVwbzogc3RyaW5nKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCByZWFkTW9yZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIHJlYWRNb3JlLnR5cGUgPSBcImJ1dHRvblwiO1xuICByZWFkTW9yZS5jbGFzc05hbWUgPVxuICAgIFwiaW5saW5lLWZsZXggdy1maXQgaXRlbXMtY2VudGVyIGdhcC0xIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LWxpbmstZm9yZWdyb3VuZCBob3Zlcjp1bmRlcmxpbmVcIjtcbiAgcmVhZE1vcmUuaW5uZXJIVE1MID1cbiAgICBgUmVhZCBNb3JlYCArXG4gICAgYDxzdmcgd2lkdGg9XCIxNFwiIGhlaWdodD1cIjE0XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiIGZpbGw9XCJub25lXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNNiAzLjVoNi41VjEwTTEyLjI1IDMuNzUgNCAxMlwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNDVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDwvc3ZnPmA7XG4gIHJlYWRNb3JlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHZvaWQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDpvcGVuLWV4dGVybmFsXCIsIGBodHRwczovL2dpdGh1Yi5jb20vJHtyZXBvfWApO1xuICB9KTtcbiAgcmV0dXJuIHJlYWRNb3JlO1xufVxuXG5mdW5jdGlvbiByZW5kZXJUd2Vha1N0b3JlR2hvc3RHcmlkKGdyaWQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGdyaWQuc2V0QXR0cmlidXRlKFwiYXJpYS1idXN5XCIsIFwidHJ1ZVwiKTtcbiAgZ3JpZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIGdyaWQuYXBwZW5kQ2hpbGQodHdlYWtTdG9yZUdob3N0Q2FyZCgpKTtcbn1cblxuZnVuY3Rpb24gdHdlYWtTdG9yZUdob3N0Q2FyZCgpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHsgY2FyZCwgbGVmdCwgc3RhY2ssIHZlcnNpb25zLCBhY3Rpb25zIH0gPSB0d2Vha1N0b3JlQ2FyZFNoZWxsKCk7XG4gIGNhcmQuY2xhc3NMaXN0LmFkZChcInBvaW50ZXItZXZlbnRzLW5vbmVcIik7XG4gIGNhcmQuc2V0QXR0cmlidXRlKFwiYXJpYS1oaWRkZW5cIiwgXCJ0cnVlXCIpO1xuXG4gIGxlZnQuaW5zZXJ0QmVmb3JlKHN0b3JlQXZhdGFyR2hvc3QoKSwgc3RhY2spO1xuXG4gIGNvbnN0IHRpdGxlUm93ID0gdHdlYWtTdG9yZVRpdGxlUm93KCk7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtbGcgZm9udC1zZW1pYm9sZCBsZWFkaW5nLTcgdGV4dC10b2tlbi1mb3JlZ3JvdW5kXCI7XG4gIHRpdGxlLmFwcGVuZENoaWxkKGdob3N0QmxvY2soXCJteS0xIGgtNSB3LTQ0IHJvdW5kZWQtbWRcIikpO1xuICB0aXRsZVJvdy5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIHRpdGxlUm93LmFwcGVuZENoaWxkKHZlcmlmaWVkU2FmZUdob3N0QmFkZ2UoKSk7XG4gIHN0YWNrLmFwcGVuZENoaWxkKHRpdGxlUm93KTtcblxuICBjb25zdCBkZXNjID0gdHdlYWtTdG9yZURlc2NyaXB0aW9uKCk7XG4gIGRlc2MuYXBwZW5kQ2hpbGQoZ2hvc3RCbG9jayhcIm10LTEgaC0zIHctZnVsbCByb3VuZGVkXCIpKTtcbiAgZGVzYy5hcHBlbmRDaGlsZChnaG9zdEJsb2NrKFwibXQtMiBoLTMgdy0xMS8xMiByb3VuZGVkXCIpKTtcbiAgZGVzYy5hcHBlbmRDaGlsZChnaG9zdEJsb2NrKFwibXQtMiBoLTMgdy03LzEyIHJvdW5kZWRcIikpO1xuICBzdGFjay5hcHBlbmRDaGlsZChkZXNjKTtcblxuICBjb25zdCByZWFkTW9yZSA9IHR3ZWFrU3RvcmVSZWFkTW9yZUJ1dHRvbihcIlwiKTtcbiAgcmVhZE1vcmUucmVwbGFjZUNoaWxkcmVuKGdob3N0QmxvY2soXCJoLTUgdy0yNCByb3VuZGVkXCIpKTtcbiAgc3RhY2suYXBwZW5kQ2hpbGQocmVhZE1vcmUpO1xuXG4gIHZlcnNpb25zLmFwcGVuZENoaWxkKHN0b3JlVmVyc2lvbkdob3N0QmFkZ2UoKSk7XG4gIGFjdGlvbnMuYXBwZW5kQ2hpbGQoc3RvcmVTdGF0dXNHaG9zdFBpbGwoKSk7XG4gIHJldHVybiBjYXJkO1xufVxuXG5mdW5jdGlvbiBzdG9yZUF2YXRhckdob3N0KCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgYXZhdGFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYXZhdGFyLmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IGgtMTAgdy0xMCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgb3ZlcmZsb3ctaGlkZGVuIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXItZGVmYXVsdCBiZy10cmFuc3BhcmVudCB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmRcIjtcbiAgYXZhdGFyLmFwcGVuZENoaWxkKGdob3N0QmxvY2soXCJoLWZ1bGwgdy1mdWxsXCIpKTtcbiAgcmV0dXJuIGF2YXRhcjtcbn1cblxuZnVuY3Rpb24gdmVyaWZpZWRTYWZlR2hvc3RCYWRnZSgpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGJhZGdlID0gdmVyaWZpZWRTYWZlQmFkZ2UoKTtcbiAgYmFkZ2UucmVwbGFjZUNoaWxkcmVuKGdob3N0QmxvY2soXCJoLVsxM3B4XSB3LVsxM3B4XSByb3VuZGVkLXNtXCIpLCBnaG9zdEJsb2NrKFwiaC0zIHctMjAgcm91bmRlZFwiKSk7XG4gIHJldHVybiBiYWRnZTtcbn1cblxuZnVuY3Rpb24gc3RvcmVTdGF0dXNHaG9zdFBpbGwoKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBwaWxsID0gc3RvcmVTdGF0dXNQaWxsKFwiSW5zdGFsbGVkXCIpO1xuICBwaWxsLmNsYXNzTGlzdC5hZGQoXCJhbmltYXRlLXB1bHNlXCIpO1xuICBwaWxsLnN0eWxlLmNvbG9yID0gXCJ0cmFuc3BhcmVudFwiO1xuICByZXR1cm4gcGlsbDtcbn1cblxuZnVuY3Rpb24gc3RvcmVWZXJzaW9uR2hvc3RCYWRnZSgpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGJhZGdlID0gc3RvcmVWZXJzaW9uQmFkZ2VTaGVsbChmYWxzZSk7XG4gIGJhZGdlLmFwcGVuZENoaWxkKGdob3N0QmxvY2soXCJoLTMgdy0zNiByb3VuZGVkXCIpKTtcbiAgcmV0dXJuIGJhZGdlO1xufVxuXG5mdW5jdGlvbiBnaG9zdEJsb2NrKGNsYXNzTmFtZTogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBibG9jayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGJsb2NrLmNsYXNzTmFtZSA9IGBhbmltYXRlLXB1bHNlIGJnLXRva2VuLWZvcmVncm91bmQvMTAgJHtjbGFzc05hbWV9YDtcbiAgYmxvY2suc2V0QXR0cmlidXRlKFwiYXJpYS1oaWRkZW5cIiwgXCJ0cnVlXCIpO1xuICByZXR1cm4gYmxvY2s7XG59XG5cbmZ1bmN0aW9uIHN0b3JlQXZhdGFyKGVudHJ5OiBUd2Vha1N0b3JlRW50cnlWaWV3KTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBhdmF0YXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBhdmF0YXIuY2xhc3NOYW1lID1cbiAgICBcImZsZXggaC0xMCB3LTEwIHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlci1kZWZhdWx0IGJnLXRyYW5zcGFyZW50IHRleHQtdG9rZW4tZGVzY3JpcHRpb24tZm9yZWdyb3VuZFwiO1xuICBjb25zdCBpbml0aWFsID0gKGVudHJ5Lm1hbmlmZXN0Lm5hbWU/LlswXSA/PyBcIj9cIikudG9VcHBlckNhc2UoKTtcbiAgY29uc3QgZmFsbGJhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgZmFsbGJhY2sudGV4dENvbnRlbnQgPSBpbml0aWFsO1xuICBhdmF0YXIuYXBwZW5kQ2hpbGQoZmFsbGJhY2spO1xuICBjb25zdCBpY29uVXJsID0gc3RvcmVFbnRyeUljb25VcmwoZW50cnkpO1xuICBpZiAoaWNvblVybCkge1xuICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbWdcIik7XG4gICAgaW1nLmFsdCA9IFwiXCI7XG4gICAgaW1nLmNsYXNzTmFtZSA9IFwiaC1mdWxsIHctZnVsbCBvYmplY3QtY292ZXJcIjtcbiAgICBpbWcuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCAoKSA9PiB7XG4gICAgICBmYWxsYmFjay5yZW1vdmUoKTtcbiAgICAgIGltZy5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICB9KTtcbiAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IHtcbiAgICAgIGltZy5yZW1vdmUoKTtcbiAgICB9KTtcbiAgICBpbWcuc3JjID0gaWNvblVybDtcbiAgICBhdmF0YXIuYXBwZW5kQ2hpbGQoaW1nKTtcbiAgfVxuICByZXR1cm4gYXZhdGFyO1xufVxuXG5mdW5jdGlvbiBzdG9yZUVudHJ5SWNvblVybChlbnRyeTogVHdlYWtTdG9yZUVudHJ5Vmlldyk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBpY29uVXJsID0gZW50cnkubWFuaWZlc3QuaWNvblVybD8udHJpbSgpO1xuICBpZiAoIWljb25VcmwpIHJldHVybiBudWxsO1xuICBpZiAoL14oaHR0cHM/OnxkYXRhOikvaS50ZXN0KGljb25VcmwpKSByZXR1cm4gaWNvblVybDtcbiAgY29uc3QgcmVsID0gaWNvblVybC5yZXBsYWNlKC9eXFwuP1xcLy8sIFwiXCIpO1xuICBpZiAoIXJlbCB8fCByZWwuc3RhcnRzV2l0aChcIi4uL1wiKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tLyR7ZW50cnkucmVwb30vJHtlbnRyeS5hcHByb3ZlZENvbW1pdFNoYX0vJHtyZWx9YDtcbn1cblxuZnVuY3Rpb24gc2lkZWJhclJlbGVhc2VzUGlsbEJ1dHRvbigpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJ1c2VyLXNlbGVjdC1ub25lIG5vLWRyYWcgY3Vyc29yLWludGVyYWN0aW9uIGlubGluZS1mbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcFwiO1xuICBPYmplY3QuYXNzaWduKGJ0bi5zdHlsZSwge1xuICAgIGhlaWdodDogXCIyMHB4XCIsXG4gICAgYm9yZGVyUmFkaXVzOiBcIjk5OTlweFwiLFxuICAgIGJvcmRlcjogXCIwXCIsXG4gICAgYmFja2dyb3VuZDogXCIjMEE4NEZGXCIsXG4gICAgY29sb3I6IFwiI0ZGRkZGRlwiLFxuICAgIHBhZGRpbmc6IFwiMCA4cHhcIixcbiAgICBmb250U2l6ZTogXCIxMHB4XCIsXG4gICAgZm9udFdlaWdodDogXCI3MDBcIixcbiAgICBsaW5lSGVpZ2h0OiBcIjIwcHhcIixcbiAgICBsZXR0ZXJTcGFjaW5nOiBcIjBcIixcbiAgICB0ZXh0VHJhbnNmb3JtOiBcIm5vbmVcIixcbiAgICBib3hTaGFkb3c6IFwiMCAxcHggMnB4IHJnYmEoMCwgMCwgMCwgMC4xOClcIixcbiAgfSk7XG4gIGJ0bi50ZXh0Q29udGVudCA9IFwiVXBkYXRlXCI7XG4gIGJ0bi50aXRsZSA9IFwiT3BlbiBDb2RleCsrIHJlbGVhc2VzXCI7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB7XG4gICAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSBcIiMwMDcxRTNcIjtcbiAgfSk7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwibW91c2VsZWF2ZVwiLCAoKSA9PiB7XG4gICAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSBcIiMwQTg0RkZcIjtcbiAgfSk7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLCBDT0RFWF9QTFVTUExVU19SRUxFQVNFU19VUkwpO1xuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gdXBkYXRlU3RvcmVVcGRhdGVCYWRnZShjb3VudDogbnVtYmVyIHwgbnVsbCk6IHZvaWQge1xuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiW2RhdGEtY29kZXhwcC1zdG9yZS11cGRhdGUtYmFkZ2VdXCIpO1xuICBpZiAoIWJhZGdlKSByZXR1cm47XG4gIGJhZGdlLmRhdGFzZXQuY29kZXhwcFN0b3JlVXBkYXRlQ291bnQgPSBjb3VudCA9PT0gbnVsbCA/IFwiXCIgOiBTdHJpbmcoY291bnQpO1xuICBhcHBseVN0b3JlVXBkYXRlQmFkZ2VTdHlsZShiYWRnZSwgY291bnQpO1xuICBiYWRnZS5oaWRkZW4gPSBjb3VudCA9PT0gbnVsbCB8fCBjb3VudCA8PSAwO1xuICBiYWRnZS50ZXh0Q29udGVudCA9IGNvdW50ICYmIGNvdW50ID4gMCA/IFN0cmluZyhjb3VudCkgOiBcIlwiO1xuICBiYWRnZS50aXRsZSA9XG4gICAgY291bnQgJiYgY291bnQgPiAwXG4gICAgICA/IGAke2NvdW50fSBpbnN0YWxsZWQgdHdlYWske2NvdW50ID09PSAxID8gXCJcIiA6IFwic1wifSBjYW4gYmUgdXBkYXRlZGBcbiAgICAgIDogXCJJbnN0YWxsZWQgdHdlYWtzIGFyZSB1cCB0byBkYXRlXCI7XG59XG5cbmZ1bmN0aW9uIGFwcGx5U3RvcmVVcGRhdGVCYWRnZVN0eWxlKGJhZGdlOiBIVE1MRWxlbWVudCwgY291bnQ6IG51bWJlciB8IG51bGwpOiB2b2lkIHtcbiAgY29uc3QgaGFzVXBkYXRlcyA9ICEhY291bnQgJiYgY291bnQgPiAwO1xuICBPYmplY3QuYXNzaWduKGJhZGdlLnN0eWxlLCB7XG4gICAgbWluV2lkdGg6IFwiMjRweFwiLFxuICAgIGhlaWdodDogXCIyMHB4XCIsXG4gICAgYm9yZGVyUmFkaXVzOiBcIjk5OTlweFwiLFxuICAgIGJvcmRlcjogXCIwXCIsXG4gICAgYmFja2dyb3VuZDogaGFzVXBkYXRlcyA/IFwiIzBBODRGRlwiIDogXCJ0cmFuc3BhcmVudFwiLFxuICAgIGNvbG9yOiBcIiNGRkZGRkZcIixcbiAgICBwYWRkaW5nOiBcIjAgN3B4XCIsXG4gICAgZm9udFNpemU6IFwiMTJweFwiLFxuICAgIGZvbnRXZWlnaHQ6IFwiNzAwXCIsXG4gICAgbGluZUhlaWdodDogXCIyMHB4XCIsXG4gICAgbGV0dGVyU3BhY2luZzogXCIwXCIsXG4gICAgYm94U2hhZG93OiBoYXNVcGRhdGVzID8gXCIwIDFweCAycHggcmdiYSgwLCAwLCAwLCAwLjIyKVwiIDogXCJub25lXCIsXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50U3RvcmVVcGRhdGVCYWRnZUNvdW50KCk6IG51bWJlciB7XG4gIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCJbZGF0YS1jb2RleHBwLXN0b3JlLXVwZGF0ZS1iYWRnZV1cIik7XG4gIGNvbnN0IHJhdyA9IGJhZGdlPy5kYXRhc2V0LmNvZGV4cHBTdG9yZVVwZGF0ZUNvdW50O1xuICBjb25zdCBwYXJzZWQgPSByYXcgPyBOdW1iZXIocmF3KSA6IDA7XG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUocGFyc2VkKSA/IHBhcnNlZCA6IDA7XG59XG5cbmZ1bmN0aW9uIG91dGRhdGVkSW5zdGFsbGVkU3RvcmVDb3VudChlbnRyaWVzOiBUd2Vha1N0b3JlRW50cnlWaWV3W10pOiBudW1iZXIge1xuICByZXR1cm4gZW50cmllcy5maWx0ZXIoKGVudHJ5KSA9PiAhIWVudHJ5Lmluc3RhbGxlZCAmJiBlbnRyeS5pbnN0YWxsZWQudmVyc2lvbiAhPT0gZW50cnkubWFuaWZlc3QudmVyc2lvbikubGVuZ3RoO1xufVxuXG5mdW5jdGlvbiBzdG9yZVRvb2xiYXJCdXR0b24oXG4gIGxhYmVsOiBzdHJpbmcsXG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQsXG4gIHZhcmlhbnQ6IFwicHJpbWFyeVwiIHwgXCJzZWNvbmRhcnlcIiA9IFwic2Vjb25kYXJ5XCIsXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgdmFyaWFudCA9PT0gXCJwcmltYXJ5XCJcbiAgICAgID8gXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gZmxleCBoLTggaXRlbXMtY2VudGVyIGdhcC0xIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tYmctZm9nIHB4LTIgcHktMCB0ZXh0LXNtIHRleHQtdG9rZW4tYnV0dG9uLXRlcnRpYXJ5LWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDBcIlxuICAgICAgOiBcImJvcmRlci10b2tlbi1ib3JkZXIgdXNlci1zZWxlY3Qtbm9uZSBuby1kcmFnIGN1cnNvci1pbnRlcmFjdGlvbiBmbGV4IGgtOCBpdGVtcy1jZW50ZXIgZ2FwLTEgd2hpdGVzcGFjZS1ub3dyYXAgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXRyYW5zcGFyZW50IGJnLXRva2VuLWZvcmVncm91bmQvNSBweC0yIHB5LTAgdGV4dC1zbSB0ZXh0LXRva2VuLWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1mb3JlZ3JvdW5kLzEwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTQwXCI7XG4gIGJ0bi50ZXh0Q29udGVudCA9IGxhYmVsO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgb25DbGljaygpO1xuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gc3RvcmVJY29uQnV0dG9uKFxuICBpY29uU3ZnOiBzdHJpbmcsXG4gIGxhYmVsOiBzdHJpbmcsXG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQsXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gZmxleCBoLTggdy04IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItdHJhbnNwYXJlbnQgYmctdG9rZW4tZm9yZWdyb3VuZC81IHAtMCB0ZXh0LXRva2VuLWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1mb3JlZ3JvdW5kLzEwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTQwXCI7XG4gIGJ0bi5pbm5lckhUTUwgPSBpY29uU3ZnO1xuICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBsYWJlbCk7XG4gIGJ0bi50aXRsZSA9IGxhYmVsO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgb25DbGljaygpO1xuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gcmVmcmVzaEljb25TdmcoKTogc3RyaW5nIHtcbiAgcmV0dXJuIChcbiAgICBgPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiBjbGFzcz1cImljb24teHNcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk00LjQgOS4zNUE1LjY1IDUuNjUgMCAwIDEgMTQgNS4zTDE1Ljc1IDdNMTUuNzUgMy43NVY3aC0zLjI1XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgIGA8cGF0aCBkPVwiTTE1LjYgMTAuNjVBNS42NSA1LjY1IDAgMCAxIDYgMTQuN0w0LjI1IDEzTTQuMjUgMTYuMjVWMTNINy41XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIHZlcmlmaWVkU2FmZUJhZGdlKCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgYmFkZ2UuY2xhc3NOYW1lID1cbiAgICBcImlubGluZS1mbGV4IGgtNiBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyLzMwIGJnLXRyYW5zcGFyZW50IHB4LTIgdGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmRcIjtcbiAgYmFkZ2UuaW5uZXJIVE1MID1cbiAgICBgPHN2ZyB3aWR0aD1cIjEzXCIgaGVpZ2h0PVwiMTNcIiB2aWV3Qm94PVwiMCAwIDE0IDE0XCIgZmlsbD1cIm5vbmVcIiBjbGFzcz1cInRleHQtYmx1ZS01MDBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk03IDEuNzUgMTEuMjUgMy40djMuMmMwIDIuNi0xLjY1IDQuMjUtNC4yNSA1LjQtMi42LTEuMTUtNC4yNS0yLjgtNC4yNS01LjRWMy40TDcgMS43NVpcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjE1XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNC44NSA3LjA1IDYuMyA4LjQ1bDIuODUtMy4wNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuMjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDwvc3ZnPmAgK1xuICAgIGA8c3Bhbj5WZXJpZmllZCBhcyBzYWZlPC9zcGFuPmA7XG4gIHJldHVybiBiYWRnZTtcbn1cblxuZnVuY3Rpb24gdHdlYWtTdG9yZVZlcnNpb25CYWRnZShlbnRyeTogVHdlYWtTdG9yZUVudHJ5VmlldywgaW5zdGFsbGVkT3ZlcnJpZGU/OiBzdHJpbmcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGluc3RhbGxlZCA9IGluc3RhbGxlZE92ZXJyaWRlID8/IGVudHJ5Lmluc3RhbGxlZD8udmVyc2lvbiA/PyBudWxsO1xuICBjb25zdCBsYXRlc3QgPSBlbnRyeS5tYW5pZmVzdC52ZXJzaW9uO1xuICBjb25zdCBoYXNVcGRhdGUgPSAhIWluc3RhbGxlZCAmJiBpbnN0YWxsZWQgIT09IGxhdGVzdDtcbiAgY29uc3QgYmFkZ2UgPSBzdG9yZVZlcnNpb25CYWRnZVNoZWxsKGhhc1VwZGF0ZSk7XG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGxhYmVsLmNsYXNzTmFtZSA9IFwidHJ1bmNhdGVcIjtcbiAgbGFiZWwudGV4dENvbnRlbnQgPSBpbnN0YWxsZWRcbiAgICA/IGBJbnN0YWxsZWQgdiR7aW5zdGFsbGVkfSBcdTAwQjcgTGF0ZXN0IHYke2xhdGVzdH1gXG4gICAgOiBgTGF0ZXN0IHYke2xhdGVzdH1gO1xuICBiYWRnZS50aXRsZSA9IGluc3RhbGxlZFxuICAgID8gYEluc3RhbGxlZCB2ZXJzaW9uICR7aW5zdGFsbGVkfS4gTGF0ZXN0IGFwcHJvdmVkIHZlcnNpb24gJHtsYXRlc3R9LmBcbiAgICA6IGBMYXRlc3QgYXBwcm92ZWQgdmVyc2lvbiAke2xhdGVzdH0uYDtcbiAgYmFkZ2UuYXBwZW5kQ2hpbGQobGFiZWwpO1xuICByZXR1cm4gYmFkZ2U7XG59XG5cbmZ1bmN0aW9uIHN0b3JlVmVyc2lvbkJhZGdlU2hlbGwoaGFzVXBkYXRlOiBib29sZWFuKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBiYWRnZS5jbGFzc05hbWUgPSBbXG4gICAgXCJpbmxpbmUtZmxleCBoLTggbWluLXctMCBtYXgtdy1mdWxsIGl0ZW1zLWNlbnRlciByb3VuZGVkLWxnIGJvcmRlciBweC0yLjUgdGV4dC14cyBmb250LW1lZGl1bVwiLFxuICAgIGhhc1VwZGF0ZVxuICAgICAgPyBcImJvcmRlci1ibHVlLTUwMC8zMCBiZy1ibHVlLTUwMC8xMCB0ZXh0LXRva2VuLWZvcmVncm91bmRcIlxuICAgICAgOiBcImJvcmRlci10b2tlbi1ib3JkZXIvNDAgYmctdG9rZW4tZm9yZWdyb3VuZC81IHRleHQtdG9rZW4tZGVzY3JpcHRpb24tZm9yZWdyb3VuZFwiLFxuICBdLmpvaW4oXCIgXCIpO1xuICByZXR1cm4gYmFkZ2U7XG59XG5cbmZ1bmN0aW9uIHN0b3JlU3RhdHVzUGlsbChsYWJlbDogc3RyaW5nLCB0b25lOiBcIm5ldXRyYWxcIiB8IFwiaW5mb1wiID0gXCJuZXV0cmFsXCIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHBpbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgcGlsbC5jbGFzc05hbWUgPSBbXG4gICAgXCJpbmxpbmUtZmxleCBoLTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtbGcgcHgtMyB0ZXh0LXNtIGZvbnQtbWVkaXVtXCIsXG4gICAgdG9uZSA9PT0gXCJpbmZvXCJcbiAgICAgID8gXCJib3JkZXIgYm9yZGVyLWJsdWUtNTAwLzMwIGJnLWJsdWUtNTAwLzEwIHRleHQtdG9rZW4tZm9yZWdyb3VuZFwiXG4gICAgICA6IFwiYmctdG9rZW4tZm9yZWdyb3VuZC81IHRleHQtdG9rZW4tZGVzY3JpcHRpb24tZm9yZWdyb3VuZFwiLFxuICBdLmpvaW4oXCIgXCIpO1xuICBwaWxsLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIHJldHVybiBwaWxsO1xufVxuXG5mdW5jdGlvbiBzdG9yZUluc3RhbGxCdXR0b24obGFiZWw6IHN0cmluZywgb25DbGljazogKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgc3RvcmVJbnN0YWxsQnV0dG9uQ2xhc3MoKTtcbiAgYnRuLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBvbkNsaWNrKGJ0bik7XG4gIH0pO1xuICByZXR1cm4gYnRuO1xufVxuXG5mdW5jdGlvbiBzdG9yZUluc3RhbGxCdXR0b25DbGFzcyhleHRyYSA9IFwiXCIpOiBzdHJpbmcge1xuICByZXR1cm4gW1xuICAgIFwiYm9yZGVyLXRva2VuLWJvcmRlciB1c2VyLXNlbGVjdC1ub25lIG5vLWRyYWcgY3Vyc29yLWludGVyYWN0aW9uIGZsZXggaC04IG1pbi13LVs4MnB4XSBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTEuNSB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItYmx1ZS01MDAvNDAgYmctYmx1ZS01MDAgcHgtMyBweS0wIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC10b2tlbi1mb3JlZ3JvdW5kIHNoYWRvdy1zbSB0cmFuc2l0aW9uLWNvbG9ycyBlbmFibGVkOmhvdmVyOmJnLWJsdWUtNjAwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTgwXCIsXG4gICAgZXh0cmEsXG4gIF0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oXCIgXCIpO1xufVxuXG5mdW5jdGlvbiBzaG93U3RvcmVCdXR0b25Mb2FkaW5nKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsIGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcbiAgYnV0dG9uLmNsYXNzTmFtZSA9IHN0b3JlSW5zdGFsbEJ1dHRvbkNsYXNzKCk7XG4gIGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWJ1c3lcIiwgXCJ0cnVlXCIpO1xuICBidXR0b24uaW5uZXJIVE1MID1cbiAgICBgPHN2ZyBjbGFzcz1cImFuaW1hdGUtc3BpblwiIHdpZHRoPVwiMTRcIiBoZWlnaHQ9XCIxNFwiIHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPmAgK1xuICAgIGA8Y2lyY2xlIGN4PVwiOFwiIGN5PVwiOFwiIHI9XCI1LjVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgb3BhY2l0eT1cIi4yNVwiLz5gICtcbiAgICBgPHBhdGggZD1cIk0xMy41IDhBNS41IDUuNSAwIDAgMCA4IDIuNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPmAgK1xuICAgIGA8L3N2Zz5gICtcbiAgICBgPHNwYW4+JHtsYWJlbH08L3NwYW4+YDtcbn1cblxuZnVuY3Rpb24gc2hvd1N0b3JlQnV0dG9uSW5zdGFsbGVkKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQpOiB2b2lkIHtcbiAgYnV0dG9uLmNsYXNzTmFtZSA9IHN0b3JlSW5zdGFsbEJ1dHRvbkNsYXNzKFwiYm9yZGVyLWJsdWUtNTAwIGJnLWJsdWUtNTAwXCIpO1xuICBidXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICBidXR0b24ucmVtb3ZlQXR0cmlidXRlKFwiYXJpYS1idXN5XCIpO1xuICBidXR0b24uaW5uZXJIVE1MID1cbiAgICBgPHN2ZyB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTRcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCIgZmlsbD1cIm5vbmVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk0zLjc1IDguMTUgNi42NSAxMSAxMi4yNSA1XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS44XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgIGA8L3N2Zz5gICtcbiAgICBgPHNwYW4+SW5zdGFsbGVkPC9zcGFuPmA7XG59XG5cbmZ1bmN0aW9uIHJlc2V0U3RvcmVJbnN0YWxsQnV0dG9uKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsIGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcbiAgYnV0dG9uLmNsYXNzTmFtZSA9IHN0b3JlSW5zdGFsbEJ1dHRvbkNsYXNzKCk7XG4gIGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICBidXR0b24ucmVtb3ZlQXR0cmlidXRlKFwiYXJpYS1idXN5XCIpO1xuICBidXR0b24udGV4dENvbnRlbnQgPSBsYWJlbDtcbn1cblxuZnVuY3Rpb24gc2hvd1N0b3JlVG9hc3QobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gIGxldCBob3N0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCJbZGF0YS1jb2RleHBwLXN0b3JlLXRvYXN0LWhvc3RdXCIpO1xuICBpZiAoIWhvc3QpIHtcbiAgICBob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBob3N0LmRhdGFzZXQuY29kZXhwcFN0b3JlVG9hc3RIb3N0ID0gXCJ0cnVlXCI7XG4gICAgaG9zdC5jbGFzc05hbWUgPSBcInBvaW50ZXItZXZlbnRzLW5vbmUgZml4ZWQgYm90dG9tLTUgcmlnaHQtNSB6LVs5OTk5XSBmbGV4IGZsZXgtY29sIGl0ZW1zLWVuZCBnYXAtMlwiO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaG9zdCk7XG4gIH1cbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0b2FzdC5jbGFzc05hbWUgPVxuICAgIFwidHJhbnNsYXRlLXktMiByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyLzUwIGJnLXRva2VuLW1haW4tc3VyZmFjZS1wcmltYXJ5IHB4LTMgcHktMiB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tZm9yZWdyb3VuZCBvcGFjaXR5LTAgc2hhZG93LWxnIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMFwiO1xuICB0b2FzdC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gIGhvc3QuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgIHRvYXN0LmNsYXNzTGlzdC5yZW1vdmUoXCJ0cmFuc2xhdGUteS0yXCIsIFwib3BhY2l0eS0wXCIpO1xuICB9KTtcbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgdG9hc3QuY2xhc3NMaXN0LmFkZChcInRyYW5zbGF0ZS15LTJcIiwgXCJvcGFjaXR5LTBcIik7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0b2FzdC5yZW1vdmUoKTtcbiAgICAgIGlmIChob3N0ICYmIGhvc3QuY2hpbGRFbGVtZW50Q291bnQgPT09IDApIGhvc3QucmVtb3ZlKCk7XG4gICAgfSwgMjIwKTtcbiAgfSwgMjYwMCk7XG59XG5cbmZ1bmN0aW9uIHN0b3JlTWVzc2FnZUNhcmQodGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb24/OiBzdHJpbmcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBjYXJkLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyLzQwIGZsZXggbWluLWgtWzg0cHhdIGZsZXgtY29sIGp1c3RpZnktY2VudGVyIGdhcC0xIHJvdW5kZWQtMnhsIGJvcmRlciBwLTQgdGV4dC1zbVwiO1xuICBjb25zdCB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdC5jbGFzc05hbWUgPSBcImZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHQudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgY2FyZC5hcHBlbmRDaGlsZCh0KTtcbiAgaWYgKGRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgZC5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnlcIjtcbiAgICBkLnRleHRDb250ZW50ID0gZGVzY3JpcHRpb247XG4gICAgY2FyZC5hcHBlbmRDaGlsZChkKTtcbiAgfVxuICByZXR1cm4gY2FyZDtcbn1cblxuZnVuY3Rpb24gc2hvcnRTaGEodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS5zbGljZSgwLCA3KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyVHdlYWtzUGFnZShzZWN0aW9uc1dyYXA6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IG9wZW5CdG4gPSBvcGVuSW5QbGFjZUJ1dHRvbihcIk9wZW4gVHdlYWtzIEZvbGRlclwiLCAoKSA9PiB7XG4gICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCB0d2Vha3NQYXRoKCkpO1xuICB9KTtcbiAgY29uc3QgcmVsb2FkQnRuID0gb3BlbkluUGxhY2VCdXR0b24oXCJGb3JjZSBSZWxvYWRcIiwgKCkgPT4ge1xuICAgIC8vIEZ1bGwgcGFnZSByZWZyZXNoIFx1MjAxNCBzYW1lIGFzIERldlRvb2xzIENtZC1SIC8gb3VyIENEUCBQYWdlLnJlbG9hZC5cbiAgICAvLyBNYWluIHJlLWRpc2NvdmVycyB0d2Vha3MgZmlyc3Qgc28gdGhlIG5ldyByZW5kZXJlciBjb21lcyB1cCB3aXRoIGFcbiAgICAvLyBmcmVzaCB0d2VhayBzZXQ7IHRoZW4gbG9jYXRpb24ucmVsb2FkIHJlc3RhcnRzIHRoZSByZW5kZXJlciBzbyB0aGVcbiAgICAvLyBwcmVsb2FkIHJlLWluaXRpYWxpemVzIGFnYWluc3QgaXQuXG4gICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgLmludm9rZShcImNvZGV4cHA6cmVsb2FkLXR3ZWFrc1wiKVxuICAgICAgLmNhdGNoKChlKSA9PiBwbG9nKFwiZm9yY2UgcmVsb2FkIChtYWluKSBmYWlsZWRcIiwgU3RyaW5nKGUpKSlcbiAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICB9KTtcbiAgfSk7XG4gIC8vIERyb3AgdGhlIGRpYWdvbmFsLWFycm93IGljb24gZnJvbSB0aGUgcmVsb2FkIGJ1dHRvbiBcdTIwMTQgaXQgaW1wbGllcyBcIm9wZW5cbiAgLy8gb3V0IG9mIGFwcFwiIHdoaWNoIGRvZXNuJ3QgZml0LiBSZXBsYWNlIGl0cyB0cmFpbGluZyBzdmcgd2l0aCBhIHJlZnJlc2guXG4gIGNvbnN0IHJlbG9hZFN2ZyA9IHJlbG9hZEJ0bi5xdWVyeVNlbGVjdG9yKFwic3ZnXCIpO1xuICBpZiAocmVsb2FkU3ZnKSB7XG4gICAgcmVsb2FkU3ZnLm91dGVySFRNTCA9XG4gICAgICBgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3M9XCJpY29uLTJ4c1wiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPmAgK1xuICAgICAgYDxwYXRoIGQ9XCJNNCAxMGE2IDYgMCAwIDEgMTAuMjQtNC4yNEwxNiA3LjVNMTYgNHYzLjVoLTMuNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICAgIGA8cGF0aCBkPVwiTTE2IDEwYTYgNiAwIDAgMS0xMC4yNCA0LjI0TDQgMTIuNU00IDE2di0zLjVoMy41XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgICAgYDwvc3ZnPmA7XG4gIH1cblxuICBjb25zdCB0cmFpbGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRyYWlsaW5nLmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgdHJhaWxpbmcuYXBwZW5kQ2hpbGQocmVsb2FkQnRuKTtcbiAgdHJhaWxpbmcuYXBwZW5kQ2hpbGQob3BlbkJ0bik7XG5cbiAgaWYgKHN0YXRlLmxpc3RlZFR3ZWFrcy5sZW5ndGggPT09IDApIHtcbiAgICBjb25zdCBzZWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIik7XG4gICAgc2VjdGlvbi5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTJcIjtcbiAgICBzZWN0aW9uLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkluc3RhbGxlZCBUd2Vha3NcIiwgdHJhaWxpbmcpKTtcbiAgICBjb25zdCBjYXJkID0gcm91bmRlZENhcmQoKTtcbiAgICBjYXJkLmFwcGVuZENoaWxkKFxuICAgICAgcm93U2ltcGxlKFxuICAgICAgICBcIk5vIHR3ZWFrcyBpbnN0YWxsZWRcIixcbiAgICAgICAgYERyb3AgYSB0d2VhayBmb2xkZXIgaW50byAke3R3ZWFrc1BhdGgoKX0gYW5kIHJlbG9hZC5gLFxuICAgICAgKSxcbiAgICApO1xuICAgIHNlY3Rpb24uYXBwZW5kQ2hpbGQoY2FyZCk7XG4gICAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHNlY3Rpb24pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEdyb3VwIHJlZ2lzdGVyZWQgU2V0dGluZ3NTZWN0aW9ucyBieSB0d2VhayBpZCAocHJlZml4IHNwbGl0IGF0IFwiOlwiKS5cbiAgY29uc3Qgc2VjdGlvbnNCeVR3ZWFrID0gbmV3IE1hcDxzdHJpbmcsIFNldHRpbmdzU2VjdGlvbltdPigpO1xuICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGUuc2VjdGlvbnMudmFsdWVzKCkpIHtcbiAgICBjb25zdCB0d2Vha0lkID0gcy5pZC5zcGxpdChcIjpcIilbMF07XG4gICAgaWYgKCFzZWN0aW9uc0J5VHdlYWsuaGFzKHR3ZWFrSWQpKSBzZWN0aW9uc0J5VHdlYWsuc2V0KHR3ZWFrSWQsIFtdKTtcbiAgICBzZWN0aW9uc0J5VHdlYWsuZ2V0KHR3ZWFrSWQpIS5wdXNoKHMpO1xuICB9XG5cbiAgY29uc3QgcGFnZXNCeVR3ZWFrID0gbmV3IE1hcDxzdHJpbmcsIFJlZ2lzdGVyZWRQYWdlW10+KCk7XG4gIGZvciAoY29uc3QgcCBvZiBzdGF0ZS5wYWdlcy52YWx1ZXMoKSkge1xuICAgIGlmICghcGFnZXNCeVR3ZWFrLmhhcyhwLnR3ZWFrSWQpKSBwYWdlc0J5VHdlYWsuc2V0KHAudHdlYWtJZCwgW10pO1xuICAgIHBhZ2VzQnlUd2Vhay5nZXQocC50d2Vha0lkKSEucHVzaChwKTtcbiAgfVxuXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiKTtcbiAgd3JhcC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTJcIjtcbiAgd3JhcC5hcHBlbmRDaGlsZChzZWN0aW9uVGl0bGUoXCJJbnN0YWxsZWQgVHdlYWtzXCIsIHRyYWlsaW5nKSk7XG5cbiAgY29uc3QgY2FyZCA9IHJvdW5kZWRDYXJkKCk7XG4gIGZvciAoY29uc3QgdCBvZiBzdGF0ZS5saXN0ZWRUd2Vha3MpIHtcbiAgICBjYXJkLmFwcGVuZENoaWxkKFxuICAgICAgdHdlYWtSb3coXG4gICAgICAgIHQsXG4gICAgICAgIHNlY3Rpb25zQnlUd2Vhay5nZXQodC5tYW5pZmVzdC5pZCkgPz8gW10sXG4gICAgICAgIHBhZ2VzQnlUd2Vhay5nZXQodC5tYW5pZmVzdC5pZCkgPz8gW10sXG4gICAgICApLFxuICAgICk7XG4gIH1cbiAgd3JhcC5hcHBlbmRDaGlsZChjYXJkKTtcbiAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHdyYXApO1xufVxuXG5mdW5jdGlvbiB0d2Vha1JvdyhcbiAgdDogTGlzdGVkVHdlYWssXG4gIHNlY3Rpb25zOiBTZXR0aW5nc1NlY3Rpb25bXSxcbiAgcGFnZXM6IFJlZ2lzdGVyZWRQYWdlW10sXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IG0gPSB0Lm1hbmlmZXN0O1xuXG4gIC8vIE91dGVyIGNlbGwgd3JhcHMgdGhlIGhlYWRlciByb3cgKyAob3B0aW9uYWwpIG5lc3RlZCBzZWN0aW9ucyBzbyB0aGVcbiAgLy8gcGFyZW50IGNhcmQncyBkaXZpZGVyIHN0YXlzIGJldHdlZW4gKnR3ZWFrcyosIG5vdCBiZXR3ZWVuIGhlYWRlciBhbmRcbiAgLy8gYm9keSBvZiB0aGUgc2FtZSB0d2Vhay5cbiAgY29uc3QgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGNlbGwuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sXCI7XG4gIGlmICghdC5lbmFibGVkKSBjZWxsLnN0eWxlLm9wYWNpdHkgPSBcIjAuN1wiO1xuXG4gIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlci5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIGdhcC00IHAtM1wiO1xuXG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtMSBpdGVtcy1zdGFydCBnYXAtM1wiO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBBdmF0YXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IGF2YXRhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGF2YXRhci5jbGFzc05hbWUgPVxuICAgIFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBvdmVyZmxvdy1oaWRkZW4gdGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICBhdmF0YXIuc3R5bGUud2lkdGggPSBcIjU2cHhcIjtcbiAgYXZhdGFyLnN0eWxlLmhlaWdodCA9IFwiNTZweFwiO1xuICBhdmF0YXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCJ2YXIoLS1jb2xvci10b2tlbi1iZy1mb2csIHRyYW5zcGFyZW50KVwiO1xuICBpZiAobS5pY29uVXJsKSB7XG4gICAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcbiAgICBpbWcuYWx0ID0gXCJcIjtcbiAgICBpbWcuY2xhc3NOYW1lID0gXCJzaXplLWZ1bGwgb2JqZWN0LWNvbnRhaW5cIjtcbiAgICAvLyBJbml0aWFsOiBzaG93IGZhbGxiYWNrIGluaXRpYWwgaW4gY2FzZSB0aGUgaWNvbiBmYWlscyB0byBsb2FkLlxuICAgIGNvbnN0IGluaXRpYWwgPSAobS5uYW1lPy5bMF0gPz8gXCI/XCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3QgZmFsbGJhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICBmYWxsYmFjay5jbGFzc05hbWUgPSBcInRleHQteGwgZm9udC1tZWRpdW1cIjtcbiAgICBmYWxsYmFjay50ZXh0Q29udGVudCA9IGluaXRpYWw7XG4gICAgYXZhdGFyLmFwcGVuZENoaWxkKGZhbGxiYWNrKTtcbiAgICBpbWcuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCAoKSA9PiB7XG4gICAgICBmYWxsYmFjay5yZW1vdmUoKTtcbiAgICAgIGltZy5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICB9KTtcbiAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsICgpID0+IHtcbiAgICAgIGltZy5yZW1vdmUoKTtcbiAgICB9KTtcbiAgICB2b2lkIHJlc29sdmVJY29uVXJsKG0uaWNvblVybCwgdC5kaXIpLnRoZW4oKHVybCkgPT4ge1xuICAgICAgaWYgKHVybCkgaW1nLnNyYyA9IHVybDtcbiAgICAgIGVsc2UgaW1nLnJlbW92ZSgpO1xuICAgIH0pO1xuICAgIGF2YXRhci5hcHBlbmRDaGlsZChpbWcpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGluaXRpYWwgPSAobS5uYW1lPy5bMF0gPz8gXCI/XCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgIHNwYW4uY2xhc3NOYW1lID0gXCJ0ZXh0LXhsIGZvbnQtbWVkaXVtXCI7XG4gICAgc3Bhbi50ZXh0Q29udGVudCA9IGluaXRpYWw7XG4gICAgYXZhdGFyLmFwcGVuZENoaWxkKHNwYW4pO1xuICB9XG4gIGxlZnQuYXBwZW5kQ2hpbGQoYXZhdGFyKTtcblxuICAvLyBcdTI1MDBcdTI1MDAgVGV4dCBzdGFjayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3Qgc3RhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBzdGFjay5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LWNvbCBnYXAtMC41XCI7XG5cbiAgY29uc3QgdGl0bGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZVJvdy5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIGNvbnN0IG5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBuYW1lLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIG5hbWUudGV4dENvbnRlbnQgPSBtLm5hbWU7XG4gIHRpdGxlUm93LmFwcGVuZENoaWxkKG5hbWUpO1xuICBpZiAobS52ZXJzaW9uKSB7XG4gICAgY29uc3QgdmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgdmVyLmNsYXNzTmFtZSA9XG4gICAgICBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgdGV4dC14cyBmb250LW5vcm1hbCB0YWJ1bGFyLW51bXNcIjtcbiAgICB2ZXIudGV4dENvbnRlbnQgPSBgdiR7bS52ZXJzaW9ufWA7XG4gICAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQodmVyKTtcbiAgfVxuICBpZiAodC51cGRhdGU/LnVwZGF0ZUF2YWlsYWJsZSkge1xuICAgIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgYmFkZ2UuY2xhc3NOYW1lID1cbiAgICAgIFwicm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLWZvcmVncm91bmQvNSBweC0yIHB5LTAuNSB0ZXh0LVsxMXB4XSBmb250LW1lZGl1bSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICAgIGJhZGdlLnRleHRDb250ZW50ID0gXCJVcGRhdGUgQXZhaWxhYmxlXCI7XG4gICAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQoYmFkZ2UpO1xuICB9XG4gIHN0YWNrLmFwcGVuZENoaWxkKHRpdGxlUm93KTtcblxuICBpZiAobS5kZXNjcmlwdGlvbikge1xuICAgIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGRlc2MuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5IG1pbi13LTAgdGV4dC1zbVwiO1xuICAgIGRlc2MudGV4dENvbnRlbnQgPSBtLmRlc2NyaXB0aW9uO1xuICAgIHN0YWNrLmFwcGVuZENoaWxkKGRlc2MpO1xuICB9XG5cbiAgY29uc3QgbWV0YSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIG1ldGEuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXhzIHRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnlcIjtcbiAgY29uc3QgYXV0aG9yRWwgPSByZW5kZXJBdXRob3IobS5hdXRob3IpO1xuICBpZiAoYXV0aG9yRWwpIG1ldGEuYXBwZW5kQ2hpbGQoYXV0aG9yRWwpO1xuICBpZiAobS5naXRodWJSZXBvKSB7XG4gICAgaWYgKG1ldGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkgbWV0YS5hcHBlbmRDaGlsZChkb3QoKSk7XG4gICAgY29uc3QgcmVwbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgcmVwby50eXBlID0gXCJidXR0b25cIjtcbiAgICByZXBvLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggdGV4dC10b2tlbi10ZXh0LWxpbmstZm9yZWdyb3VuZCBob3Zlcjp1bmRlcmxpbmVcIjtcbiAgICByZXBvLnRleHRDb250ZW50ID0gbS5naXRodWJSZXBvO1xuICAgIHJlcG8uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgYGh0dHBzOi8vZ2l0aHViLmNvbS8ke20uZ2l0aHViUmVwb31gKTtcbiAgICB9KTtcbiAgICBtZXRhLmFwcGVuZENoaWxkKHJlcG8pO1xuICB9XG4gIGlmIChtLmhvbWVwYWdlKSB7XG4gICAgaWYgKG1ldGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkgbWV0YS5hcHBlbmRDaGlsZChkb3QoKSk7XG4gICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuICAgIGxpbmsuaHJlZiA9IG0uaG9tZXBhZ2U7XG4gICAgbGluay50YXJnZXQgPSBcIl9ibGFua1wiO1xuICAgIGxpbmsucmVsID0gXCJub3JlZmVycmVyXCI7XG4gICAgbGluay5jbGFzc05hbWUgPSBcImlubGluZS1mbGV4IHRleHQtdG9rZW4tdGV4dC1saW5rLWZvcmVncm91bmQgaG92ZXI6dW5kZXJsaW5lXCI7XG4gICAgbGluay50ZXh0Q29udGVudCA9IFwiSG9tZXBhZ2VcIjtcbiAgICBtZXRhLmFwcGVuZENoaWxkKGxpbmspO1xuICB9XG4gIGlmIChtZXRhLmNoaWxkcmVuLmxlbmd0aCA+IDApIHN0YWNrLmFwcGVuZENoaWxkKG1ldGEpO1xuXG4gIC8vIFRhZ3Mgcm93IChpZiBhbnkpIFx1MjAxNCBzbWFsbCBwaWxsIGNoaXBzIGJlbG93IHRoZSBtZXRhIGxpbmUuXG4gIGlmIChtLnRhZ3MgJiYgbS50YWdzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCB0YWdzUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0YWdzUm93LmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGdhcC0xIHB0LTAuNVwiO1xuICAgIGZvciAoY29uc3QgdGFnIG9mIG0udGFncykge1xuICAgICAgY29uc3QgcGlsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgcGlsbC5jbGFzc05hbWUgPVxuICAgICAgICBcInJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBiZy10b2tlbi1mb3JlZ3JvdW5kLzUgcHgtMiBweS0wLjUgdGV4dC1bMTFweF0gdGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICAgICAgcGlsbC50ZXh0Q29udGVudCA9IHRhZztcbiAgICAgIHRhZ3NSb3cuYXBwZW5kQ2hpbGQocGlsbCk7XG4gICAgfVxuICAgIHN0YWNrLmFwcGVuZENoaWxkKHRhZ3NSb3cpO1xuICB9XG5cbiAgbGVmdC5hcHBlbmRDaGlsZChzdGFjayk7XG4gIGhlYWRlci5hcHBlbmRDaGlsZChsZWZ0KTtcblxuICAvLyBcdTI1MDBcdTI1MDAgVG9nZ2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCByaWdodCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJpZ2h0LmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHQtMC41XCI7XG4gIGlmICh0LmVuYWJsZWQgJiYgcGFnZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGNvbmZpZ3VyZUJ0biA9IGNvbXBhY3RCdXR0b24oXCJDb25maWd1cmVcIiwgKCkgPT4ge1xuICAgICAgYWN0aXZhdGVQYWdlKHsga2luZDogXCJyZWdpc3RlcmVkXCIsIGlkOiBwYWdlc1swXSEuaWQgfSk7XG4gICAgfSk7XG4gICAgY29uZmlndXJlQnRuLnRpdGxlID0gcGFnZXMubGVuZ3RoID09PSAxXG4gICAgICA/IGBPcGVuICR7cGFnZXNbMF0hLnBhZ2UudGl0bGV9YFxuICAgICAgOiBgT3BlbiAke3BhZ2VzLm1hcCgocCkgPT4gcC5wYWdlLnRpdGxlKS5qb2luKFwiLCBcIil9YDtcbiAgICByaWdodC5hcHBlbmRDaGlsZChjb25maWd1cmVCdG4pO1xuICB9XG4gIGlmICh0LnVwZGF0ZT8udXBkYXRlQXZhaWxhYmxlICYmIHQudXBkYXRlLnJlbGVhc2VVcmwpIHtcbiAgICByaWdodC5hcHBlbmRDaGlsZChcbiAgICAgIGNvbXBhY3RCdXR0b24oXCJSZXZpZXcgUmVsZWFzZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDpvcGVuLWV4dGVybmFsXCIsIHQudXBkYXRlIS5yZWxlYXNlVXJsKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbiAgcmlnaHQuYXBwZW5kQ2hpbGQoXG4gICAgc3dpdGNoQ29udHJvbCh0LmVuYWJsZWQsIGFzeW5jIChuZXh0KSA9PiB7XG4gICAgICBhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnNldC10d2Vhay1lbmFibGVkXCIsIG0uaWQsIG5leHQpO1xuICAgICAgLy8gVGhlIG1haW4gcHJvY2VzcyBicm9hZGNhc3RzIGEgcmVsb2FkIHdoaWNoIHdpbGwgcmUtZmV0Y2ggdGhlIGxpc3RcbiAgICAgIC8vIGFuZCByZS1yZW5kZXIuIFdlIGRvbid0IG9wdGltaXN0aWNhbGx5IHRvZ2dsZSB0byBhdm9pZCBkcmlmdC5cbiAgICB9KSxcbiAgKTtcbiAgaGVhZGVyLmFwcGVuZENoaWxkKHJpZ2h0KTtcblxuICBjZWxsLmFwcGVuZENoaWxkKGhlYWRlcik7XG5cbiAgLy8gSWYgdGhlIHR3ZWFrIGlzIGVuYWJsZWQgYW5kIHJlZ2lzdGVyZWQgc2V0dGluZ3Mgc2VjdGlvbnMsIHJlbmRlciB0aG9zZVxuICAvLyBib2RpZXMgYXMgbmVzdGVkIHJvd3MgYmVuZWF0aCB0aGUgaGVhZGVyIGluc2lkZSB0aGUgc2FtZSBjZWxsLlxuICBpZiAodC5lbmFibGVkICYmIHNlY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBuZXN0ZWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIG5lc3RlZC5jbGFzc05hbWUgPVxuICAgICAgXCJmbGV4IGZsZXgtY29sIGRpdmlkZS15LVswLjVweF0gZGl2aWRlLXRva2VuLWJvcmRlciBib3JkZXItdC1bMC41cHhdIGJvcmRlci10b2tlbi1ib3JkZXJcIjtcbiAgICBmb3IgKGNvbnN0IHMgb2Ygc2VjdGlvbnMpIHtcbiAgICAgIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgYm9keS5jbGFzc05hbWUgPSBcInAtM1wiO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcy5yZW5kZXIoYm9keSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGJvZHkudGV4dENvbnRlbnQgPSBgRXJyb3IgcmVuZGVyaW5nIHR3ZWFrIHNlY3Rpb246ICR7KGUgYXMgRXJyb3IpLm1lc3NhZ2V9YDtcbiAgICAgIH1cbiAgICAgIG5lc3RlZC5hcHBlbmRDaGlsZChib2R5KTtcbiAgICB9XG4gICAgY2VsbC5hcHBlbmRDaGlsZChuZXN0ZWQpO1xuICB9XG5cbiAgcmV0dXJuIGNlbGw7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckF1dGhvcihhdXRob3I6IFR3ZWFrTWFuaWZlc3RbXCJhdXRob3JcIl0pOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBpZiAoIWF1dGhvcikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgd3JhcC5jbGFzc05hbWUgPSBcImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMVwiO1xuICBpZiAodHlwZW9mIGF1dGhvciA9PT0gXCJzdHJpbmdcIikge1xuICAgIHdyYXAudGV4dENvbnRlbnQgPSBgYnkgJHthdXRob3J9YDtcbiAgICByZXR1cm4gd3JhcDtcbiAgfVxuICB3cmFwLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiYnkgXCIpKTtcbiAgaWYgKGF1dGhvci51cmwpIHtcbiAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG4gICAgYS5ocmVmID0gYXV0aG9yLnVybDtcbiAgICBhLnRhcmdldCA9IFwiX2JsYW5rXCI7XG4gICAgYS5yZWwgPSBcIm5vcmVmZXJyZXJcIjtcbiAgICBhLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggdGV4dC10b2tlbi10ZXh0LWxpbmstZm9yZWdyb3VuZCBob3Zlcjp1bmRlcmxpbmVcIjtcbiAgICBhLnRleHRDb250ZW50ID0gYXV0aG9yLm5hbWU7XG4gICAgd3JhcC5hcHBlbmRDaGlsZChhKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgc3Bhbi50ZXh0Q29udGVudCA9IGF1dGhvci5uYW1lO1xuICAgIHdyYXAuYXBwZW5kQ2hpbGQoc3Bhbik7XG4gIH1cbiAgcmV0dXJuIHdyYXA7XG59XG5cbmZ1bmN0aW9uIG9wZW5QdWJsaXNoVHdlYWtEaWFsb2coKTogdm9pZCB7XG4gIGNvbnN0IGV4aXN0aW5nID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCJbZGF0YS1jb2RleHBwLXB1Ymxpc2gtZGlhbG9nXVwiKTtcbiAgZXhpc3Rpbmc/LnJlbW92ZSgpO1xuXG4gIGNvbnN0IG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBvdmVybGF5LmRhdGFzZXQuY29kZXhwcFB1Ymxpc2hEaWFsb2cgPSBcInRydWVcIjtcbiAgb3ZlcmxheS5jbGFzc05hbWUgPSBcImZpeGVkIGluc2V0LTAgei1bOTk5OV0gZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctYmxhY2svNDAgcC00XCI7XG5cbiAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZGlhbG9nLmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IHctZnVsbCBtYXgtdy14bCBmbGV4LWNvbCBnYXAtNCByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLW1haW4tc3VyZmFjZS1wcmltYXJ5IHAtNCBzaGFkb3cteGxcIjtcbiAgb3ZlcmxheS5hcHBlbmRDaGlsZChkaWFsb2cpO1xuXG4gIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlci5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIGdhcC0zXCI7XG4gIGNvbnN0IHRpdGxlU3RhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZVN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJ0ZXh0LWJhc2UgZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSBcIlB1Ymxpc2ggVHdlYWtcIjtcbiAgY29uc3Qgc3VidGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBzdWJ0aXRsZS5jbGFzc05hbWUgPSBcInRleHQtc20gdGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICBzdWJ0aXRsZS50ZXh0Q29udGVudCA9IFwiU3VibWl0IGEgR2l0SHViIHJlcG8gZm9yIGFkbWluIHJldmlldy4gQ29kZXgrKyByZWNvcmRzIHRoZSBleGFjdCBjb21taXQgYWRtaW5zIG11c3QgcmV2aWV3IGFuZCBwaW4uXCI7XG4gIHRpdGxlU3RhY2suYXBwZW5kQ2hpbGQodGl0bGUpO1xuICB0aXRsZVN0YWNrLmFwcGVuZENoaWxkKHN1YnRpdGxlKTtcbiAgaGVhZGVyLmFwcGVuZENoaWxkKHRpdGxlU3RhY2spO1xuICBoZWFkZXIuYXBwZW5kQ2hpbGQoY29tcGFjdEJ1dHRvbihcIkRpc21pc3NcIiwgKCkgPT4gb3ZlcmxheS5yZW1vdmUoKSkpO1xuICBkaWFsb2cuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblxuICBjb25zdCByZXBvSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIik7XG4gIHJlcG9JbnB1dC50eXBlID0gXCJ0ZXh0XCI7XG4gIHJlcG9JbnB1dC5wbGFjZWhvbGRlciA9IFwib3duZXIvcmVwbyBvciBodHRwczovL2dpdGh1Yi5jb20vb3duZXIvcmVwb1wiO1xuICByZXBvSW5wdXQuY2xhc3NOYW1lID1cbiAgICBcImgtMTAgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBiZy10cmFuc3BhcmVudCBweC0zIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnkgZm9jdXM6b3V0bGluZS1ub25lXCI7XG4gIGRpYWxvZy5hcHBlbmRDaGlsZChyZXBvSW5wdXQpO1xuXG4gIGNvbnN0IHN0YXR1cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YXR1cy5jbGFzc05hbWUgPSBcIm1pbi1oLTUgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIHN0YXR1cy50ZXh0Q29udGVudCA9IFwiVGhlIG1hbmlmZXN0IHNob3VsZCBpbmNsdWRlIGFuIGljb25Vcmwgc3VpdGFibGUgZm9yIHRoZSBzdG9yZS5cIjtcbiAgZGlhbG9nLmFwcGVuZENoaWxkKHN0YXR1cyk7XG5cbiAgY29uc3QgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbnMuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBnYXAtMlwiO1xuICBjb25zdCBzdWJtaXQgPSBjb21wYWN0QnV0dG9uKFwiT3BlbiBSZXZpZXcgSXNzdWVcIiwgKCkgPT4ge1xuICAgIHZvaWQgc3VibWl0UHVibGlzaFR3ZWFrKHJlcG9JbnB1dCwgc3RhdHVzKTtcbiAgfSk7XG4gIGFjdGlvbnMuYXBwZW5kQ2hpbGQoc3VibWl0KTtcbiAgZGlhbG9nLmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuXG4gIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgaWYgKGUudGFyZ2V0ID09PSBvdmVybGF5KSBvdmVybGF5LnJlbW92ZSgpO1xuICB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5KTtcbiAgcmVwb0lucHV0LmZvY3VzKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHN1Ym1pdFB1Ymxpc2hUd2VhayhcbiAgcmVwb0lucHV0OiBIVE1MSW5wdXRFbGVtZW50LFxuICBzdGF0dXM6IEhUTUxFbGVtZW50LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHN0YXR1cy5jbGFzc05hbWUgPSBcIm1pbi1oLTUgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIHN0YXR1cy50ZXh0Q29udGVudCA9IFwiUmVzb2x2aW5nIHRoZSByZXBvIGNvbW1pdCB0byByZXZpZXcuXCI7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3VibWlzc2lvbiA9IGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcbiAgICAgIFwiY29kZXhwcDpwcmVwYXJlLXR3ZWFrLXN0b3JlLXN1Ym1pc3Npb25cIixcbiAgICAgIHJlcG9JbnB1dC52YWx1ZSxcbiAgICApIGFzIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbjtcbiAgICBjb25zdCB1cmwgPSBidWlsZFR3ZWFrUHVibGlzaElzc3VlVXJsKHN1Ym1pc3Npb24pO1xuICAgIGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLCB1cmwpO1xuICAgIHN0YXR1cy50ZXh0Q29udGVudCA9IGBHaXRIdWIgcmV2aWV3IGlzc3VlIG9wZW5lZCBmb3IgJHtzdWJtaXNzaW9uLmNvbW1pdFNoYS5zbGljZSgwLCA3KX0uYDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHN0YXR1cy5jbGFzc05hbWUgPSBcIm1pbi1oLTUgdGV4dC1zbSB0ZXh0LXRva2VuLWNoYXJ0cy1yZWRcIjtcbiAgICBzdGF0dXMudGV4dENvbnRlbnQgPSBTdHJpbmcoKGUgYXMgRXJyb3IpLm1lc3NhZ2UgPz8gZSk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIGNvbXBvbmVudHMgXHUyNTAwXHUyNTAwXG5cbi8qKiBUaGUgZnVsbCBwYW5lbCBzaGVsbCAodG9vbGJhciArIHNjcm9sbCArIGhlYWRpbmcgKyBzZWN0aW9ucyB3cmFwKS4gKi9cbmZ1bmN0aW9uIHBhbmVsU2hlbGwoXG4gIHRpdGxlOiBzdHJpbmcsXG4gIHN1YnRpdGxlPzogc3RyaW5nLFxuICBvcHRpb25zPzogeyB3aWRlPzogYm9vbGVhbiB9LFxuKToge1xuICBvdXRlcjogSFRNTEVsZW1lbnQ7XG4gIHNlY3Rpb25zV3JhcDogSFRNTEVsZW1lbnQ7XG4gIHN1YnRpdGxlPzogSFRNTEVsZW1lbnQ7XG4gIGhlYWRlckFjdGlvbnM6IEhUTUxFbGVtZW50O1xuICBoZWFkZXJUaXRsZUFjdGlvbnM6IEhUTUxFbGVtZW50O1xufSB7XG4gIGNvbnN0IG91dGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgb3V0ZXIuY2xhc3NOYW1lID0gXCJtYWluLXN1cmZhY2UgZmxleCBoLWZ1bGwgbWluLWgtMCBmbGV4LWNvbFwiO1xuXG4gIGNvbnN0IHRvb2xiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0b29sYmFyLmNsYXNzTmFtZSA9XG4gICAgXCJkcmFnZ2FibGUgZmxleCBpdGVtcy1jZW50ZXIgcHgtcGFuZWwgZWxlY3Ryb246aC10b29sYmFyIGV4dGVuc2lvbjpoLXRvb2xiYXItc21cIjtcbiAgb3V0ZXIuYXBwZW5kQ2hpbGQodG9vbGJhcik7XG5cbiAgY29uc3Qgc2Nyb2xsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc2Nyb2xsLmNsYXNzTmFtZSA9IFwiZmxleC0xIG92ZXJmbG93LXktYXV0byBwLXBhbmVsXCI7XG4gIG91dGVyLmFwcGVuZENoaWxkKHNjcm9sbCk7XG5cbiAgY29uc3QgaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBpbm5lci5jbGFzc05hbWUgPVxuICAgIG9wdGlvbnM/LndpZGVcbiAgICAgID8gXCJteC1hdXRvIGZsZXggdy1mdWxsIG1heC13LTV4bCBmbGV4LWNvbCBlbGVjdHJvbjptaW4tdy1bY2FsYygzMjBweCp2YXIoLS1jb2RleC13aW5kb3ctem9vbSkpXVwiXG4gICAgICA6IFwibXgtYXV0byBmbGV4IHctZnVsbCBmbGV4LWNvbCBtYXgtdy0yeGwgZWxlY3Ryb246bWluLXctW2NhbGMoMzIwcHgqdmFyKC0tY29kZXgtd2luZG93LXpvb20pKV1cIjtcbiAgc2Nyb2xsLmFwcGVuZENoaWxkKGlubmVyKTtcblxuICBjb25zdCBoZWFkZXJXcmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyV3JhcC5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMyBwYi1wYW5lbFwiO1xuICBjb25zdCBoZWFkZXJJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlcklubmVyLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtMSBmbGV4LWNvbCBnYXAtMS41IHBiLXBhbmVsXCI7XG4gIGNvbnN0IHRpdGxlTGluZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlTGluZS5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgY29uc3QgaGVhZGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRpbmcuY2xhc3NOYW1lID0gXCJlbGVjdHJvbjpoZWFkaW5nLWxnIGhlYWRpbmctYmFzZSB0cnVuY2F0ZVwiO1xuICBoZWFkaW5nLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIHRpdGxlTGluZS5hcHBlbmRDaGlsZChoZWFkaW5nKTtcbiAgY29uc3QgaGVhZGVyVGl0bGVBY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyVGl0bGVBY3Rpb25zLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgdGl0bGVMaW5lLmFwcGVuZENoaWxkKGhlYWRlclRpdGxlQWN0aW9ucyk7XG4gIGhlYWRlcklubmVyLmFwcGVuZENoaWxkKHRpdGxlTGluZSk7XG4gIGxldCBzdWJ0aXRsZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuICBpZiAoc3VidGl0bGUpIHtcbiAgICBjb25zdCBzdWIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHN1Yi5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgdGV4dC1zbVwiO1xuICAgIHN1Yi50ZXh0Q29udGVudCA9IHN1YnRpdGxlO1xuICAgIGhlYWRlcklubmVyLmFwcGVuZENoaWxkKHN1Yik7XG4gICAgc3VidGl0bGVFbGVtZW50ID0gc3ViO1xuICB9XG4gIGhlYWRlcldyYXAuYXBwZW5kQ2hpbGQoaGVhZGVySW5uZXIpO1xuICBjb25zdCBoZWFkZXJBY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyQWN0aW9ucy5jbGFzc05hbWUgPSBcImZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIGhlYWRlcldyYXAuYXBwZW5kQ2hpbGQoaGVhZGVyQWN0aW9ucyk7XG4gIGlubmVyLmFwcGVuZENoaWxkKGhlYWRlcldyYXApO1xuXG4gIGNvbnN0IHNlY3Rpb25zV3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHNlY3Rpb25zV3JhcC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLVt2YXIoLS1wYWRkaW5nLXBhbmVsKV1cIjtcbiAgaW5uZXIuYXBwZW5kQ2hpbGQoc2VjdGlvbnNXcmFwKTtcblxuICByZXR1cm4geyBvdXRlciwgc2VjdGlvbnNXcmFwLCBzdWJ0aXRsZTogc3VidGl0bGVFbGVtZW50LCBoZWFkZXJBY3Rpb25zLCBoZWFkZXJUaXRsZUFjdGlvbnMgfTtcbn1cblxuZnVuY3Rpb24gc2VjdGlvblRpdGxlKHRleHQ6IHN0cmluZywgdHJhaWxpbmc/OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgdGl0bGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZVJvdy5jbGFzc05hbWUgPVxuICAgIFwiZmxleCBoLXRvb2xiYXIgaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMiBweC0wIHB5LTBcIjtcbiAgY29uc3QgdGl0bGVJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlSW5uZXIuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC0xIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0LmNsYXNzTmFtZSA9IFwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHQudGV4dENvbnRlbnQgPSB0ZXh0O1xuICB0aXRsZUlubmVyLmFwcGVuZENoaWxkKHQpO1xuICB0aXRsZVJvdy5hcHBlbmRDaGlsZCh0aXRsZUlubmVyKTtcbiAgaWYgKHRyYWlsaW5nKSB7XG4gICAgY29uc3QgcmlnaHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHJpZ2h0LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgICByaWdodC5hcHBlbmRDaGlsZCh0cmFpbGluZyk7XG4gICAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQocmlnaHQpO1xuICB9XG4gIHJldHVybiB0aXRsZVJvdztcbn1cblxuLyoqXG4gKiBDb2RleCdzIFwiT3BlbiBjb25maWcudG9tbFwiLXN0eWxlIHRyYWlsaW5nIGJ1dHRvbjogZ2hvc3QgYm9yZGVyLCBtdXRlZFxuICogbGFiZWwsIHRvcC1yaWdodCBkaWFnb25hbCBhcnJvdyBpY29uLiBNYXJrdXAgbWlycm9ycyBDb25maWd1cmF0aW9uIHBhbmVsLlxuICovXG5mdW5jdGlvbiBvcGVuSW5QbGFjZUJ1dHRvbihsYWJlbDogc3RyaW5nLCBvbkNsaWNrOiAoKSA9PiB2b2lkKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICBidG4udHlwZSA9IFwiYnV0dG9uXCI7XG4gIGJ0bi5jbGFzc05hbWUgPVxuICAgIFwiYm9yZGVyLXRva2VuLWJvcmRlciB1c2VyLXNlbGVjdC1ub25lIG5vLWRyYWcgY3Vyc29yLWludGVyYWN0aW9uIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xIGJvcmRlciB3aGl0ZXNwYWNlLW5vd3JhcCBmb2N1czpvdXRsaW5lLW5vbmUgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDAgcm91bmRlZC1sZyB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZGF0YS1bc3RhdGU9b3Blbl06YmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kIGJvcmRlci10cmFuc3BhcmVudCBoLXRva2VuLWJ1dHRvbi1jb21wb3NlciBweC0yIHB5LTAgdGV4dC1iYXNlIGxlYWRpbmctWzE4cHhdXCI7XG4gIGJ0bi5pbm5lckhUTUwgPVxuICAgIGAke2xhYmVsfWAgK1xuICAgIGA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cImljb24tMnhzXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNMTQuMzM0OSAxMy4zMzAxVjYuNjA2NDVMNS40NzA2NSAxNS40NzA3QzUuMjEwOTUgMTUuNzMwNCA0Ljc4ODk1IDE1LjczMDQgNC41MjkyNSAxNS40NzA3QzQuMjY5NTUgMTUuMjExIDQuMjY5NTUgMTQuNzg5IDQuNTI5MjUgMTQuNTI5M0wxMy4zOTM1IDUuNjY1MDRINi42NjAxMUM2LjI5Mjg0IDUuNjY1MDQgNS45OTUwNyA1LjM2NzI3IDUuOTk1MDcgNUM1Ljk5NTA3IDQuNjMyNzMgNi4yOTI4NCA0LjMzNDk2IDYuNjYwMTEgNC4zMzQ5NkgxNC45OTk5TDE1LjEzMzcgNC4zNDg2M0MxNS40MzY5IDQuNDEwNTcgMTUuNjY1IDQuNjc4NTcgMTUuNjY1IDVWMTMuMzMwMUMxNS42NjQ5IDEzLjY5NzMgMTUuMzY3MiAxMy45OTUxIDE0Ljk5OTkgMTMuOTk1MUMxNC42MzI3IDEzLjk5NTEgMTQuMzM1IDEzLjY5NzMgMTQuMzM0OSAxMy4zMzAxWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIj48L3BhdGg+YCArXG4gICAgYDwvc3ZnPmA7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBvbkNsaWNrKCk7XG4gIH0pO1xuICByZXR1cm4gYnRuO1xufVxuXG5mdW5jdGlvbiBjb21wYWN0QnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gaW5saW5lLWZsZXggaC04IGl0ZW1zLWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLWxnIGJvcmRlciBweC0yIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnkgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDBcIjtcbiAgYnRuLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBvbkNsaWNrKCk7XG4gIH0pO1xuICByZXR1cm4gYnRuO1xufVxuXG5mdW5jdGlvbiByb3VuZGVkQ2FyZCgpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBjYXJkLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIGZsZXggZmxleC1jb2wgZGl2aWRlLXktWzAuNXB4XSBkaXZpZGUtdG9rZW4tYm9yZGVyIHJvdW5kZWQtbGcgYm9yZGVyXCI7XG4gIGNhcmQuc2V0QXR0cmlidXRlKFxuICAgIFwic3R5bGVcIixcbiAgICBcImJhY2tncm91bmQtY29sb3I6IHZhcigtLWNvbG9yLWJhY2tncm91bmQtcGFuZWwsIHZhcigtLWNvbG9yLXRva2VuLWJnLWZvZykpO1wiLFxuICApO1xuICByZXR1cm4gY2FyZDtcbn1cblxuZnVuY3Rpb24gcm93U2ltcGxlKHRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGRlc2NyaXB0aW9uPzogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGl0ZW1zLWNlbnRlciBnYXAtM1wiO1xuICBjb25zdCBzdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGlmICh0aXRsZSkge1xuICAgIGNvbnN0IHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHQuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgICB0LnRleHRDb250ZW50ID0gdGl0bGU7XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQodCk7XG4gIH1cbiAgaWYgKGRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgZC5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gICAgZC50ZXh0Q29udGVudCA9IGRlc2NyaXB0aW9uO1xuICAgIHN0YWNrLmFwcGVuZENoaWxkKGQpO1xuICB9XG4gIGxlZnQuYXBwZW5kQ2hpbGQoc3RhY2spO1xuICByb3cuYXBwZW5kQ2hpbGQobGVmdCk7XG4gIHJldHVybiByb3c7XG59XG5cbi8qKlxuICogQ29kZXgtc3R5bGVkIHRvZ2dsZSBzd2l0Y2guIE1hcmt1cCBtaXJyb3JzIHRoZSBHZW5lcmFsID4gUGVybWlzc2lvbnMgcm93XG4gKiBzd2l0Y2ggd2UgY2FwdHVyZWQ6IG91dGVyIGJ1dHRvbiAocm9sZT1zd2l0Y2gpLCBpbm5lciBwaWxsLCBzbGlkaW5nIGtub2IuXG4gKi9cbmZ1bmN0aW9uIHN3aXRjaENvbnRyb2woXG4gIGluaXRpYWw6IGJvb2xlYW4sXG4gIG9uQ2hhbmdlOiAobmV4dDogYm9vbGVhbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4sXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLnNldEF0dHJpYnV0ZShcInJvbGVcIiwgXCJzd2l0Y2hcIik7XG5cbiAgY29uc3QgcGlsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBjb25zdCBrbm9iID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGtub2IuY2xhc3NOYW1lID1cbiAgICBcInJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLVtjb2xvcjp2YXIoLS1ncmF5LTApXSBiZy1bY29sb3I6dmFyKC0tZ3JheS0wKV0gc2hhZG93LXNtIHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTIwMCBlYXNlLW91dCBoLTQgdy00XCI7XG4gIHBpbGwuYXBwZW5kQ2hpbGQoa25vYik7XG5cbiAgY29uc3QgYXBwbHkgPSAob246IGJvb2xlYW4pOiB2b2lkID0+IHtcbiAgICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1jaGVja2VkXCIsIFN0cmluZyhvbikpO1xuICAgIGJ0bi5kYXRhc2V0LnN0YXRlID0gb24gPyBcImNoZWNrZWRcIiA6IFwidW5jaGVja2VkXCI7XG4gICAgYnRuLmNsYXNzTmFtZSA9XG4gICAgICBcImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciB0ZXh0LXNtIGZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy10b2tlbi1mb2N1cy1ib3JkZXIgZm9jdXMtdmlzaWJsZTpyb3VuZGVkLWZ1bGwgY3Vyc29yLWludGVyYWN0aW9uXCI7XG4gICAgcGlsbC5jbGFzc05hbWUgPSBgcmVsYXRpdmUgaW5saW5lLWZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWNvbG9ycyBkdXJhdGlvbi0yMDAgZWFzZS1vdXQgaC01IHctOCAke1xuICAgICAgb24gPyBcImJnLXRva2VuLWNoYXJ0cy1ibHVlXCIgOiBcImJnLXRva2VuLWZvcmVncm91bmQvMjBcIlxuICAgIH1gO1xuICAgIHBpbGwuZGF0YXNldC5zdGF0ZSA9IG9uID8gXCJjaGVja2VkXCIgOiBcInVuY2hlY2tlZFwiO1xuICAgIGtub2IuZGF0YXNldC5zdGF0ZSA9IG9uID8gXCJjaGVja2VkXCIgOiBcInVuY2hlY2tlZFwiO1xuICAgIGtub2Iuc3R5bGUudHJhbnNmb3JtID0gb24gPyBcInRyYW5zbGF0ZVgoMTRweClcIiA6IFwidHJhbnNsYXRlWCgycHgpXCI7XG4gIH07XG4gIGFwcGx5KGluaXRpYWwpO1xuXG4gIGJ0bi5hcHBlbmRDaGlsZChwaWxsKTtcbiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0IG5leHQgPSBidG4uZ2V0QXR0cmlidXRlKFwiYXJpYS1jaGVja2VkXCIpICE9PSBcInRydWVcIjtcbiAgICBhcHBseShuZXh0KTtcbiAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBvbkNoYW5nZShuZXh0KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gZG90KCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBzLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kXCI7XG4gIHMudGV4dENvbnRlbnQgPSBcIlx1MDBCN1wiO1xuICByZXR1cm4gcztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIGljb25zIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjb25maWdJY29uU3ZnKCk6IHN0cmluZyB7XG4gIC8vIFNsaWRlcnMgLyBzZXR0aW5ncyBnbHlwaC4gMjB4MjAgY3VycmVudENvbG9yLlxuICByZXR1cm4gKFxuICAgIGA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cImljb24tc20gaW5saW5lLWJsb2NrIGFsaWduLW1pZGRsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPmAgK1xuICAgIGA8cGF0aCBkPVwiTTMgNWg5TTE1IDVoMk0zIDEwaDJNOCAxMGg5TTMgMTVoMTFNMTcgMTVoMFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+YCArXG4gICAgYDxjaXJjbGUgY3g9XCIxM1wiIGN5PVwiNVwiIHI9XCIxLjZcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPmAgK1xuICAgIGA8Y2lyY2xlIGN4PVwiNlwiIGN5PVwiMTBcIiByPVwiMS42XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5gICtcbiAgICBgPGNpcmNsZSBjeD1cIjE1XCIgY3k9XCIxNVwiIHI9XCIxLjZcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIHR3ZWFrc0ljb25TdmcoKTogc3RyaW5nIHtcbiAgLy8gU3BhcmtsZXMgLyBcIisrXCIgZ2x5cGggZm9yIHR3ZWFrcy5cbiAgcmV0dXJuIChcbiAgICBgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3M9XCJpY29uLXNtIGlubGluZS1ibG9jayBhbGlnbi1taWRkbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk0xMCAyLjUgTDExLjQgOC42IEwxNy41IDEwIEwxMS40IDExLjQgTDEwIDE3LjUgTDguNiAxMS40IEwyLjUgMTAgTDguNiA4LjYgWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNMTUuNSAzIEwxNiA1IEwxOCA1LjUgTDE2IDYgTDE1LjUgOCBMMTUgNiBMMTMgNS41IEwxNSA1IFpcIiBmaWxsPVwiY3VycmVudENvbG9yXCIgb3BhY2l0eT1cIjAuN1wiLz5gICtcbiAgICBgPC9zdmc+YFxuICApO1xufVxuXG5mdW5jdGlvbiBzdG9yZUljb25TdmcoKTogc3RyaW5nIHtcbiAgcmV0dXJuIChcbiAgICBgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3M9XCJpY29uLXNtIGlubGluZS1ibG9jayBhbGlnbi1taWRkbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk00IDguMiA1LjEgNC41QTEuNSAxLjUgMCAwIDEgNi41NSAzLjRoNi45YTEuNSAxLjUgMCAwIDEgMS40NSAxLjFMMTYgOC4yXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNC41IDhoMTF2Ny41QTEuNSAxLjUgMCAwIDEgMTQgMTdINmExLjUgMS41IDAgMCAxLTEuNS0xLjVWOFpcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICBgPHBhdGggZD1cIk03LjUgOHYxYTIuNSAyLjUgMCAwIDAgNSAwVjhcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRQYWdlSWNvblN2ZygpOiBzdHJpbmcge1xuICAvLyBEb2N1bWVudC9wYWdlIGdseXBoIGZvciB0d2Vhay1yZWdpc3RlcmVkIHBhZ2VzIHdpdGhvdXQgdGhlaXIgb3duIGljb24uXG4gIHJldHVybiAoXG4gICAgYDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGNsYXNzPVwiaWNvbi1zbSBpbmxpbmUtYmxvY2sgYWxpZ24tbWlkZGxlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNNSAzaDdsMyAzdjExYTEgMSAwIDAgMS0xIDFINWExIDEgMCAwIDEtMS0xVjRhMSAxIDAgMCAxIDEtMVpcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICBgPHBhdGggZD1cIk0xMiAzdjNhMSAxIDAgMCAwIDEgMWgyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNyAxMWg2TTcgMTRoNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+YCArXG4gICAgYDwvc3ZnPmBcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUljb25VcmwoXG4gIHVybDogc3RyaW5nLFxuICB0d2Vha0Rpcjogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGlmICgvXihodHRwcz86fGRhdGE6KS8udGVzdCh1cmwpKSByZXR1cm4gdXJsO1xuICAvLyBSZWxhdGl2ZSBwYXRoIFx1MjE5MiBhc2sgbWFpbiB0byByZWFkIHRoZSBmaWxlIGFuZCByZXR1cm4gYSBkYXRhOiBVUkwuXG4gIC8vIFJlbmRlcmVyIGlzIHNhbmRib3hlZCBzbyBmaWxlOi8vIHdvbid0IGxvYWQgZGlyZWN0bHkuXG4gIGNvbnN0IHJlbCA9IHVybC5zdGFydHNXaXRoKFwiLi9cIikgPyB1cmwuc2xpY2UoMikgOiB1cmw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIChhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXG4gICAgICBcImNvZGV4cHA6cmVhZC10d2Vhay1hc3NldFwiLFxuICAgICAgdHdlYWtEaXIsXG4gICAgICByZWwsXG4gICAgKSkgYXMgc3RyaW5nO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcGxvZyhcImljb24gbG9hZCBmYWlsZWRcIiwgeyB1cmwsIHR3ZWFrRGlyLCBlcnI6IFN0cmluZyhlKSB9KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgRE9NIGhldXJpc3RpY3MgXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGZpbmRTaWRlYmFySXRlbXNHcm91cCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBjb25zdCBjYW5kaWRhdGVzID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcImFzaWRlLG5hdixbcm9sZT0nbmF2aWdhdGlvbiddLGRpdlwiKSxcbiAgKTtcblxuICBsZXQgYmVzdDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGJlc3RTY29yZSA9IC0xO1xuICBsZXQgYmVzdEFyZWEgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgY2FuZGlkYXRlcykge1xuICAgIGlmIChjYW5kaWRhdGUuZGF0YXNldC5jb2RleHBwKSBjb250aW51ZTtcbiAgICBpZiAoIWlzU2V0dGluZ3NTaWRlYmFyQ2FuZGlkYXRlKGNhbmRpZGF0ZSkpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgbGFiZWxzID0gY29kZXhQcFNldHRpbmdzTGFiZWxzRnJvbShjYW5kaWRhdGUpO1xuICAgIGNvbnN0IHNjb3JlID0gY29kZXhQcFNldHRpbmdzTGFiZWxTY29yZShsYWJlbHMpO1xuICAgIGNvbnN0IHJlY3QgPSBjYW5kaWRhdGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgYXJlYSA9IHJlY3Qud2lkdGggKiByZWN0LmhlaWdodDtcbiAgICBjb25zdCB3ZWlnaHRlZCA9IHNjb3JlLmNvcmUgKiAxMDAgKyBzY29yZS50b3RhbDtcblxuICAgIGlmICh3ZWlnaHRlZCA+IGJlc3RTY29yZSB8fCAod2VpZ2h0ZWQgPT09IGJlc3RTY29yZSAmJiBhcmVhIDwgYmVzdEFyZWEpKSB7XG4gICAgICBiZXN0ID0gY2FuZGlkYXRlO1xuICAgICAgYmVzdFNjb3JlID0gd2VpZ2h0ZWQ7XG4gICAgICBiZXN0QXJlYSA9IGFyZWE7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJlc3Q7XG59XG5cbmNvbnN0IEZPUkJJRERFTl9TRVRUSU5HU19TSURFQkFSX1NFTEVDVE9SID0gW1xuICBcIltkYXRhLWNvbXBvc2VyLW92ZXJsYXktZmxvYXRpbmctdWk9J3RydWUnXVwiLFxuICBcIltkYXRhLWNvZGV4cHAtc2xhc2gtbWVudT0ndHJ1ZSddXCIsXG4gIFwiW2RhdGEtY29kZXhwcC1vdmVybGF5LW5vaXNlPSd0cnVlJ11cIixcbiAgXCIuY29tcG9zZXItaG9tZS10b3AtbWVudVwiLFxuICBcIi52ZXJ0aWNhbC1zY3JvbGwtZmFkZS1tYXNrXCIsXG4gIFwiW2NsYXNzKj0nW2NvbnRhaW5lci1uYW1lOmhvbWUtbWFpbi1jb250ZW50XSddXCIsXG5dLmpvaW4oXCIsXCIpO1xuXG5mdW5jdGlvbiBpc0ZvcmJpZGRlblNldHRpbmdzU2lkZWJhclN1cmZhY2Uobm9kZTogRWxlbWVudCB8IG51bGwpOiBib29sZWFuIHtcbiAgaWYgKCFub2RlKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGVsID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ID8gbm9kZSA6IG5vZGUucGFyZW50RWxlbWVudDtcbiAgaWYgKCFlbCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoZWwuY2xvc2VzdChGT1JCSURERU5fU0VUVElOR1NfU0lERUJBUl9TRUxFQ1RPUikpIHJldHVybiB0cnVlO1xuICBpZiAoZWwucXVlcnlTZWxlY3RvcihcIltkYXRhLWxpc3QtbmF2aWdhdGlvbi1pdGVtPSd0cnVlJ10sIFtjbWRrLWl0ZW1dXCIpKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBpc1NldHRpbmdzU2lkZWJhckNhbmRpZGF0ZShlbDogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcbiAgY29uc3QgcmVjdCA9IGNvZGV4UHBWaXNpYmxlQm94KGVsKTtcbiAgaWYgKCFyZWN0KSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gQ3VycmVudCBDb2RleCBTZXR0aW5ncyBzaWRlYmFyOiBsZWZ0IGNvbHVtbiwgbm90IHRoZSBtYWluIGNvbnRlbnQgcGFuZWwuXG4gIGlmIChyZWN0LndpZHRoIDwgMTIwIHx8IHJlY3Qud2lkdGggPiA2MjApIHJldHVybiBmYWxzZTtcbiAgaWYgKHJlY3QuaGVpZ2h0IDwgODApIHJldHVybiBmYWxzZTtcbiAgaWYgKHJlY3QubGVmdCA+IHdpbmRvdy5pbm5lcldpZHRoICogMC42NSkgcmV0dXJuIGZhbHNlO1xuXG4gIHJldHVybiBpc0NvZGV4UHBTZXR0aW5nc0xhYmVsU2V0KGNvZGV4UHBTZXR0aW5nc0xhYmVsc0Zyb20oZWwpKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlTWlzcGxhY2VkU2V0dGluZ3NHcm91cHMoKTogdm9pZCB7XG4gIGNvbnN0IGdyb3VwcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgIFwiW2RhdGEtY29kZXhwcD0nbmF2LWdyb3VwJ10sIFtkYXRhLWNvZGV4cHA9J3BhZ2VzLWdyb3VwJ10sIFtkYXRhLWNvZGV4cHA9J25hdGl2ZS1uYXYtaGVhZGVyJ11cIixcbiAgKTtcbiAgZm9yIChjb25zdCBncm91cCBvZiBBcnJheS5mcm9tKGdyb3VwcykpIHtcbiAgICBpZiAoIWlzRm9yYmlkZGVuU2V0dGluZ3NTaWRlYmFyU3VyZmFjZShncm91cCkpIGNvbnRpbnVlO1xuICAgIGlmIChzdGF0ZS5uYXZHcm91cCA9PT0gZ3JvdXApIHN0YXRlLm5hdkdyb3VwID0gbnVsbDtcbiAgICBpZiAoc3RhdGUucGFnZXNHcm91cCA9PT0gZ3JvdXApIHtcbiAgICAgIHN0YXRlLnBhZ2VzR3JvdXAgPSBudWxsO1xuICAgICAgc3RhdGUucGFnZXNHcm91cEtleSA9IG51bGw7XG4gICAgfVxuICAgIGlmIChzdGF0ZS5uYXRpdmVOYXZIZWFkZXIgPT09IGdyb3VwKSBzdGF0ZS5uYXRpdmVOYXZIZWFkZXIgPSBudWxsO1xuICAgIGdyb3VwLnJlbW92ZSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRDb250ZW50QXJlYSgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBjb25zdCBzaWRlYmFyID0gZmluZFNpZGViYXJJdGVtc0dyb3VwKCk7XG4gIGlmICghc2lkZWJhcikgcmV0dXJuIG51bGw7XG4gIGxldCBwYXJlbnQgPSBzaWRlYmFyLnBhcmVudEVsZW1lbnQ7XG4gIHdoaWxlIChwYXJlbnQpIHtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIEFycmF5LmZyb20ocGFyZW50LmNoaWxkcmVuKSBhcyBIVE1MRWxlbWVudFtdKSB7XG4gICAgICBpZiAoY2hpbGQgPT09IHNpZGViYXIgfHwgY2hpbGQuY29udGFpbnMoc2lkZWJhcikpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgciA9IGNoaWxkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHIud2lkdGggPiAzMDAgJiYgci5oZWlnaHQgPiAyMDApIHJldHVybiBjaGlsZDtcbiAgICB9XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIG1heWJlRHVtcERvbSgpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzaWRlYmFyID0gZmluZFNpZGViYXJJdGVtc0dyb3VwKCk7XG4gICAgaWYgKHNpZGViYXIgJiYgIXN0YXRlLnNpZGViYXJEdW1wZWQpIHtcbiAgICAgIHN0YXRlLnNpZGViYXJEdW1wZWQgPSB0cnVlO1xuICAgICAgY29uc3Qgc2JSb290ID0gc2lkZWJhci5wYXJlbnRFbGVtZW50ID8/IHNpZGViYXI7XG4gICAgICBwbG9nKGBjb2RleCBzaWRlYmFyIEhUTUxgLCBzYlJvb3Qub3V0ZXJIVE1MLnNsaWNlKDAsIDMyMDAwKSk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBmaW5kQ29udGVudEFyZWEoKTtcbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIGlmIChzdGF0ZS5maW5nZXJwcmludCAhPT0gbG9jYXRpb24uaHJlZikge1xuICAgICAgICBzdGF0ZS5maW5nZXJwcmludCA9IGxvY2F0aW9uLmhyZWY7XG4gICAgICAgIHBsb2coXCJkb20gcHJvYmUgKG5vIGNvbnRlbnQpXCIsIHtcbiAgICAgICAgICB1cmw6IGxvY2F0aW9uLmhyZWYsXG4gICAgICAgICAgc2lkZWJhcjogc2lkZWJhciA/IGRlc2NyaWJlKHNpZGViYXIpIDogbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBwYW5lbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIEFycmF5LmZyb20oY29udGVudC5jaGlsZHJlbikgYXMgSFRNTEVsZW1lbnRbXSkge1xuICAgICAgaWYgKGNoaWxkLmRhdGFzZXQuY29kZXhwcCA9PT0gXCJ0d2Vha3MtcGFuZWxcIikgY29udGludWU7XG4gICAgICBpZiAoY2hpbGQuc3R5bGUuZGlzcGxheSA9PT0gXCJub25lXCIpIGNvbnRpbnVlO1xuICAgICAgcGFuZWwgPSBjaGlsZDtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBhY3RpdmVOYXYgPSBzaWRlYmFyXG4gICAgICA/IEFycmF5LmZyb20oc2lkZWJhci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcImJ1dHRvbiwgYVwiKSkuZmluZChcbiAgICAgICAgICAoYikgPT5cbiAgICAgICAgICAgIGIuZ2V0QXR0cmlidXRlKFwiYXJpYS1jdXJyZW50XCIpID09PSBcInBhZ2VcIiB8fFxuICAgICAgICAgICAgYi5nZXRBdHRyaWJ1dGUoXCJkYXRhLWFjdGl2ZVwiKSA9PT0gXCJ0cnVlXCIgfHxcbiAgICAgICAgICAgIGIuZ2V0QXR0cmlidXRlKFwiYXJpYS1zZWxlY3RlZFwiKSA9PT0gXCJ0cnVlXCIgfHxcbiAgICAgICAgICAgIGIuY2xhc3NMaXN0LmNvbnRhaW5zKFwiYWN0aXZlXCIpLFxuICAgICAgICApXG4gICAgICA6IG51bGw7XG4gICAgY29uc3QgaGVhZGluZyA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcbiAgICAgIFwiaDEsIGgyLCBoMywgW2NsYXNzKj0naGVhZGluZyddXCIsXG4gICAgKTtcbiAgICBjb25zdCBmaW5nZXJwcmludCA9IGAke2FjdGl2ZU5hdj8udGV4dENvbnRlbnQgPz8gXCJcIn18JHtoZWFkaW5nPy50ZXh0Q29udGVudCA/PyBcIlwifXwke3BhbmVsPy5jaGlsZHJlbi5sZW5ndGggPz8gMH1gO1xuICAgIGlmIChzdGF0ZS5maW5nZXJwcmludCA9PT0gZmluZ2VycHJpbnQpIHJldHVybjtcbiAgICBzdGF0ZS5maW5nZXJwcmludCA9IGZpbmdlcnByaW50O1xuICAgIHBsb2coXCJkb20gcHJvYmVcIiwge1xuICAgICAgdXJsOiBsb2NhdGlvbi5ocmVmLFxuICAgICAgYWN0aXZlTmF2OiBhY3RpdmVOYXY/LnRleHRDb250ZW50Py50cmltKCkgPz8gbnVsbCxcbiAgICAgIGhlYWRpbmc6IGhlYWRpbmc/LnRleHRDb250ZW50Py50cmltKCkgPz8gbnVsbCxcbiAgICAgIGNvbnRlbnQ6IGRlc2NyaWJlKGNvbnRlbnQpLFxuICAgIH0pO1xuICAgIGlmIChwYW5lbCkge1xuICAgICAgY29uc3QgaHRtbCA9IHBhbmVsLm91dGVySFRNTDtcbiAgICAgIHBsb2coXG4gICAgICAgIGBjb2RleCBwYW5lbCBIVE1MICgke2FjdGl2ZU5hdj8udGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBcIj9cIn0pYCxcbiAgICAgICAgaHRtbC5zbGljZSgwLCAzMjAwMCksXG4gICAgICApO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIHBsb2coXCJkb20gcHJvYmUgZmFpbGVkXCIsIFN0cmluZyhlKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVzY3JpYmUoZWw6IEhUTUxFbGVtZW50KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIHRhZzogZWwudGFnTmFtZSxcbiAgICBjbHM6IGVsLmNsYXNzTmFtZS5zbGljZSgwLCAxMjApLFxuICAgIGlkOiBlbC5pZCB8fCB1bmRlZmluZWQsXG4gICAgY2hpbGRyZW46IGVsLmNoaWxkcmVuLmxlbmd0aCxcbiAgICByZWN0OiAoKCkgPT4ge1xuICAgICAgY29uc3QgciA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgcmV0dXJuIHsgdzogTWF0aC5yb3VuZChyLndpZHRoKSwgaDogTWF0aC5yb3VuZChyLmhlaWdodCkgfTtcbiAgICB9KSgpLFxuICB9O1xufVxuXG5mdW5jdGlvbiB0d2Vha3NQYXRoKCk6IHN0cmluZyB7XG4gIHJldHVybiAoXG4gICAgKHdpbmRvdyBhcyB1bmtub3duIGFzIHsgX19jb2RleHBwX3R3ZWFrc19kaXJfXz86IHN0cmluZyB9KS5fX2NvZGV4cHBfdHdlYWtzX2Rpcl9fID8/XG4gICAgXCI8dXNlciBkaXI+L3R3ZWFrc1wiXG4gICk7XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBUd2Vha01hbmlmZXN0IH0gZnJvbSBcIkBjb2RleC1wbHVzcGx1cy9zZGtcIjtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfVFdFQUtfU1RPUkVfSU5ERVhfVVJMID1cbiAgXCJodHRwczovL2Itbm5ldHQuZ2l0aHViLmlvL2NvZGV4LXBsdXNwbHVzL3N0b3JlL2luZGV4Lmpzb25cIjtcbmV4cG9ydCBjb25zdCBUV0VBS19TVE9SRV9SRVZJRVdfSVNTVUVfVVJMID1cbiAgXCJodHRwczovL2dpdGh1Yi5jb20vYi1ubmV0dC9jb2RleC1wbHVzcGx1cy9pc3N1ZXMvbmV3XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHdlYWtTdG9yZVJlZ2lzdHJ5IHtcbiAgc2NoZW1hVmVyc2lvbjogMTtcbiAgZ2VuZXJhdGVkQXQ/OiBzdHJpbmc7XG4gIGVudHJpZXM6IFR3ZWFrU3RvcmVFbnRyeVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR3ZWFrU3RvcmVFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xuICByZXBvOiBzdHJpbmc7XG4gIGFwcHJvdmVkQ29tbWl0U2hhOiBzdHJpbmc7XG4gIGFwcHJvdmVkQXQ6IHN0cmluZztcbiAgYXBwcm92ZWRCeTogc3RyaW5nO1xuICBwbGF0Zm9ybXM/OiBUd2Vha1N0b3JlUGxhdGZvcm1bXTtcbiAgcmVsZWFzZVVybD86IHN0cmluZztcbiAgcmV2aWV3VXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBUd2Vha1N0b3JlUGxhdGZvcm0gPSBcImRhcndpblwiIHwgXCJ3aW4zMlwiIHwgXCJsaW51eFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbiB7XG4gIHJlcG86IHN0cmluZztcbiAgZGVmYXVsdEJyYW5jaDogc3RyaW5nO1xuICBjb21taXRTaGE6IHN0cmluZztcbiAgY29tbWl0VXJsOiBzdHJpbmc7XG4gIG1hbmlmZXN0Pzoge1xuICAgIGlkPzogc3RyaW5nO1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgICBpY29uVXJsPzogc3RyaW5nO1xuICB9O1xufVxuXG5jb25zdCBHSVRIVUJfUkVQT19SRSA9IC9eW0EtWmEtejAtOV8uLV0rXFwvW0EtWmEtejAtOV8uLV0rJC87XG5jb25zdCBGVUxMX1NIQV9SRSA9IC9eW2EtZjAtOV17NDB9JC9pO1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplR2l0SHViUmVwbyhpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcmF3ID0gaW5wdXQudHJpbSgpO1xuICBpZiAoIXJhdykgdGhyb3cgbmV3IEVycm9yKFwiR2l0SHViIHJlcG8gaXMgcmVxdWlyZWRcIik7XG5cbiAgY29uc3Qgc3NoID0gL15naXRAZ2l0aHViXFwuY29tOihbXi9dK1xcL1teL10rPykoPzpcXC5naXQpPyQvaS5leGVjKHJhdyk7XG4gIGlmIChzc2gpIHJldHVybiBub3JtYWxpemVSZXBvUGFydChzc2hbMV0pO1xuXG4gIGlmICgvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KHJhdykpIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJhdyk7XG4gICAgaWYgKHVybC5ob3N0bmFtZSAhPT0gXCJnaXRodWIuY29tXCIpIHRocm93IG5ldyBFcnJvcihcIk9ubHkgZ2l0aHViLmNvbSByZXBvc2l0b3JpZXMgYXJlIHN1cHBvcnRlZFwiKTtcbiAgICBjb25zdCBwYXJ0cyA9IHVybC5wYXRobmFtZS5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKS5zcGxpdChcIi9cIik7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHRocm93IG5ldyBFcnJvcihcIkdpdEh1YiByZXBvIFVSTCBtdXN0IGluY2x1ZGUgb3duZXIgYW5kIHJlcG9zaXRvcnlcIik7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZVJlcG9QYXJ0KGAke3BhcnRzWzBdfS8ke3BhcnRzWzFdfWApO1xuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZVJlcG9QYXJ0KHJhdyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTdG9yZVJlZ2lzdHJ5KGlucHV0OiB1bmtub3duKTogVHdlYWtTdG9yZVJlZ2lzdHJ5IHtcbiAgY29uc3QgcmVnaXN0cnkgPSBpbnB1dCBhcyBQYXJ0aWFsPFR3ZWFrU3RvcmVSZWdpc3RyeT4gfCBudWxsO1xuICBpZiAoIXJlZ2lzdHJ5IHx8IHJlZ2lzdHJ5LnNjaGVtYVZlcnNpb24gIT09IDEgfHwgIUFycmF5LmlzQXJyYXkocmVnaXN0cnkuZW50cmllcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCB0d2VhayBzdG9yZSByZWdpc3RyeVwiKTtcbiAgfVxuICBjb25zdCBlbnRyaWVzID0gcmVnaXN0cnkuZW50cmllcy5tYXAobm9ybWFsaXplU3RvcmVFbnRyeSk7XG4gIGVudHJpZXMuc29ydCgoYSwgYikgPT4gYS5tYW5pZmVzdC5uYW1lLmxvY2FsZUNvbXBhcmUoYi5tYW5pZmVzdC5uYW1lKSk7XG4gIHJldHVybiB7XG4gICAgc2NoZW1hVmVyc2lvbjogMSxcbiAgICBnZW5lcmF0ZWRBdDogdHlwZW9mIHJlZ2lzdHJ5LmdlbmVyYXRlZEF0ID09PSBcInN0cmluZ1wiID8gcmVnaXN0cnkuZ2VuZXJhdGVkQXQgOiB1bmRlZmluZWQsXG4gICAgZW50cmllcyxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNodWZmbGVTdG9yZUVudHJpZXM8VD4oXG4gIGVudHJpZXM6IHJlYWRvbmx5IFRbXSxcbiAgcmFuZG9tSW5kZXg6IChleGNsdXNpdmVNYXg6IG51bWJlcikgPT4gbnVtYmVyID0gKGV4Y2x1c2l2ZU1heCkgPT4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZXhjbHVzaXZlTWF4KSxcbik6IFRbXSB7XG4gIGNvbnN0IHNodWZmbGVkID0gWy4uLmVudHJpZXNdO1xuICBmb3IgKGxldCBpID0gc2h1ZmZsZWQubGVuZ3RoIC0gMTsgaSA+IDA7IGkgLT0gMSkge1xuICAgIGNvbnN0IGogPSByYW5kb21JbmRleChpICsgMSk7XG4gICAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKGopIHx8IGogPCAwIHx8IGogPiBpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHNodWZmbGUgcmFuZG9tSW5kZXggcmV0dXJuZWQgJHtqfTsgZXhwZWN0ZWQgYW4gaW50ZWdlciBmcm9tIDAgdG8gJHtpfWApO1xuICAgIH1cbiAgICBbc2h1ZmZsZWRbaV0sIHNodWZmbGVkW2pdXSA9IFtzaHVmZmxlZFtqXSwgc2h1ZmZsZWRbaV1dO1xuICB9XG4gIHJldHVybiBzaHVmZmxlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVN0b3JlRW50cnkoaW5wdXQ6IHVua25vd24pOiBUd2Vha1N0b3JlRW50cnkge1xuICBjb25zdCBlbnRyeSA9IGlucHV0IGFzIFBhcnRpYWw8VHdlYWtTdG9yZUVudHJ5PiB8IG51bGw7XG4gIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHR3ZWFrIHN0b3JlIGVudHJ5XCIpO1xuICBjb25zdCByZXBvID0gbm9ybWFsaXplR2l0SHViUmVwbyhTdHJpbmcoZW50cnkucmVwbyA/PyBlbnRyeS5tYW5pZmVzdD8uZ2l0aHViUmVwbyA/PyBcIlwiKSk7XG4gIGNvbnN0IG1hbmlmZXN0ID0gZW50cnkubWFuaWZlc3QgYXMgVHdlYWtNYW5pZmVzdCB8IHVuZGVmaW5lZDtcbiAgaWYgKCFtYW5pZmVzdD8uaWQgfHwgIW1hbmlmZXN0Lm5hbWUgfHwgIW1hbmlmZXN0LnZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5IGZvciAke3JlcG99IGlzIG1pc3NpbmcgbWFuaWZlc3QgZmllbGRzYCk7XG4gIH1cbiAgaWYgKG5vcm1hbGl6ZUdpdEh1YlJlcG8obWFuaWZlc3QuZ2l0aHViUmVwbykgIT09IHJlcG8pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7bWFuaWZlc3QuaWR9IHJlcG8gZG9lcyBub3QgbWF0Y2ggbWFuaWZlc3QgZ2l0aHViUmVwb2ApO1xuICB9XG4gIGlmICghaXNGdWxsQ29tbWl0U2hhKFN0cmluZyhlbnRyeS5hcHByb3ZlZENvbW1pdFNoYSA/PyBcIlwiKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7bWFuaWZlc3QuaWR9IG11c3QgcGluIGEgZnVsbCBhcHByb3ZlZCBjb21taXQgU0hBYCk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBpZDogbWFuaWZlc3QuaWQsXG4gICAgbWFuaWZlc3QsXG4gICAgcmVwbyxcbiAgICBhcHByb3ZlZENvbW1pdFNoYTogU3RyaW5nKGVudHJ5LmFwcHJvdmVkQ29tbWl0U2hhKSxcbiAgICBhcHByb3ZlZEF0OiB0eXBlb2YgZW50cnkuYXBwcm92ZWRBdCA9PT0gXCJzdHJpbmdcIiA/IGVudHJ5LmFwcHJvdmVkQXQgOiBcIlwiLFxuICAgIGFwcHJvdmVkQnk6IHR5cGVvZiBlbnRyeS5hcHByb3ZlZEJ5ID09PSBcInN0cmluZ1wiID8gZW50cnkuYXBwcm92ZWRCeSA6IFwiXCIsXG4gICAgcGxhdGZvcm1zOiBub3JtYWxpemVTdG9yZVBsYXRmb3JtcygoZW50cnkgYXMgeyBwbGF0Zm9ybXM/OiB1bmtub3duIH0pLnBsYXRmb3JtcyksXG4gICAgcmVsZWFzZVVybDogb3B0aW9uYWxHaXRodWJVcmwoZW50cnkucmVsZWFzZVVybCksXG4gICAgcmV2aWV3VXJsOiBvcHRpb25hbEdpdGh1YlVybChlbnRyeS5yZXZpZXdVcmwpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RvcmVBcmNoaXZlVXJsKGVudHJ5OiBUd2Vha1N0b3JlRW50cnkpOiBzdHJpbmcge1xuICBpZiAoIWlzRnVsbENvbW1pdFNoYShlbnRyeS5hcHByb3ZlZENvbW1pdFNoYSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7ZW50cnkuaWR9IGlzIG5vdCBwaW5uZWQgdG8gYSBmdWxsIGNvbW1pdCBTSEFgKTtcbiAgfVxuICByZXR1cm4gYGh0dHBzOi8vY29kZWxvYWQuZ2l0aHViLmNvbS8ke2VudHJ5LnJlcG99L3Rhci5nei8ke2VudHJ5LmFwcHJvdmVkQ29tbWl0U2hhfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFR3ZWFrUHVibGlzaElzc3VlVXJsKHN1Ym1pc3Npb246IFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbik6IHN0cmluZyB7XG4gIGNvbnN0IHJlcG8gPSBub3JtYWxpemVHaXRIdWJSZXBvKHN1Ym1pc3Npb24ucmVwbyk7XG4gIGlmICghaXNGdWxsQ29tbWl0U2hhKHN1Ym1pc3Npb24uY29tbWl0U2hhKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlN1Ym1pc3Npb24gbXVzdCBpbmNsdWRlIHRoZSBmdWxsIGNvbW1pdCBTSEEgdG8gcmV2aWV3XCIpO1xuICB9XG4gIGNvbnN0IHRpdGxlID0gYFR3ZWFrIHN0b3JlIHJldmlldzogJHtyZXBvfWA7XG4gIGNvbnN0IGJvZHkgPSBbXG4gICAgXCIjIyBUd2VhayByZXBvXCIsXG4gICAgYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3JlcG99YCxcbiAgICBcIlwiLFxuICAgIFwiIyMgQ29tbWl0IHRvIHJldmlld1wiLFxuICAgIHN1Ym1pc3Npb24uY29tbWl0U2hhLFxuICAgIHN1Ym1pc3Npb24uY29tbWl0VXJsLFxuICAgIFwiXCIsXG4gICAgXCJEbyBub3QgYXBwcm92ZSBhIGRpZmZlcmVudCBjb21taXQuIElmIHRoZSBhdXRob3IgcHVzaGVzIGNoYW5nZXMsIGFzayB0aGVtIHRvIHJlc3VibWl0LlwiLFxuICAgIFwiXCIsXG4gICAgXCIjIyBNYW5pZmVzdFwiLFxuICAgIGAtIGlkOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LmlkID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIGAtIG5hbWU6ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8ubmFtZSA/PyBcIihub3QgZGV0ZWN0ZWQpXCJ9YCxcbiAgICBgLSB2ZXJzaW9uOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LnZlcnNpb24gPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgYC0gZGVzY3JpcHRpb246ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8uZGVzY3JpcHRpb24gPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgYC0gaWNvblVybDogJHtzdWJtaXNzaW9uLm1hbmlmZXN0Py5pY29uVXJsID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIFwiXCIsXG4gICAgXCIjIyBBZG1pbiBjaGVja2xpc3RcIixcbiAgICBcIi0gWyBdIG1hbmlmZXN0Lmpzb24gaXMgdmFsaWRcIixcbiAgICBcIi0gWyBdIG1hbmlmZXN0Lmljb25VcmwgaXMgdXNhYmxlIGFzIHRoZSBzdG9yZSBpY29uXCIsXG4gICAgXCItIFsgXSBzb3VyY2Ugd2FzIHJldmlld2VkIGF0IHRoZSBleGFjdCBjb21taXQgYWJvdmVcIixcbiAgICBcIi0gWyBdIGBzdG9yZS9pbmRleC5qc29uYCBlbnRyeSBwaW5zIGBhcHByb3ZlZENvbW1pdFNoYWAgdG8gdGhlIGV4YWN0IGNvbW1pdCBhYm92ZVwiLFxuICBdLmpvaW4oXCJcXG5cIik7XG4gIGNvbnN0IHVybCA9IG5ldyBVUkwoVFdFQUtfU1RPUkVfUkVWSUVXX0lTU1VFX1VSTCk7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwidGVtcGxhdGVcIiwgXCJ0d2Vhay1zdG9yZS1yZXZpZXcubWRcIik7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwidGl0bGVcIiwgdGl0bGUpO1xuICB1cmwuc2VhcmNoUGFyYW1zLnNldChcImJvZHlcIiwgYm9keSk7XG4gIHJldHVybiB1cmwudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRnVsbENvbW1pdFNoYSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBGVUxMX1NIQV9SRS50ZXN0KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUmVwb1BhcnQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHJlcG8gPSB2YWx1ZS50cmltKCkucmVwbGFjZSgvXFwuZ2l0JC9pLCBcIlwiKS5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKTtcbiAgaWYgKCFHSVRIVUJfUkVQT19SRS50ZXN0KHJlcG8pKSB0aHJvdyBuZXcgRXJyb3IoXCJHaXRIdWIgcmVwbyBtdXN0IGJlIGluIG93bmVyL3JlcG8gZm9ybVwiKTtcbiAgcmV0dXJuIHJlcG87XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0b3JlUGxhdGZvcm1zKGlucHV0OiB1bmtub3duKTogVHdlYWtTdG9yZVBsYXRmb3JtW10gfCB1bmRlZmluZWQge1xuICBpZiAoaW5wdXQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGlucHV0KSkgdGhyb3cgbmV3IEVycm9yKFwiU3RvcmUgZW50cnkgcGxhdGZvcm1zIG11c3QgYmUgYW4gYXJyYXlcIik7XG4gIGNvbnN0IGFsbG93ZWQgPSBuZXcgU2V0PFR3ZWFrU3RvcmVQbGF0Zm9ybT4oW1wiZGFyd2luXCIsIFwid2luMzJcIiwgXCJsaW51eFwiXSk7XG4gIGNvbnN0IHBsYXRmb3JtcyA9IEFycmF5LmZyb20obmV3IFNldChpbnB1dC5tYXAoKHZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIiB8fCAhYWxsb3dlZC5oYXModmFsdWUgYXMgVHdlYWtTdG9yZVBsYXRmb3JtKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBzdG9yZSBwbGF0Zm9ybTogJHtTdHJpbmcodmFsdWUpfWApO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWUgYXMgVHdlYWtTdG9yZVBsYXRmb3JtO1xuICB9KSkpO1xuICByZXR1cm4gcGxhdGZvcm1zLmxlbmd0aCA+IDAgPyBwbGF0Zm9ybXMgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIG9wdGlvbmFsR2l0aHViVXJsKHZhbHVlOiB1bmtub3duKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIiB8fCAhdmFsdWUudHJpbSgpKSByZXR1cm4gdW5kZWZpbmVkO1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKHZhbHVlKTtcbiAgaWYgKHVybC5wcm90b2NvbCAhPT0gXCJodHRwczpcIiB8fCB1cmwuaG9zdG5hbWUgIT09IFwiZ2l0aHViLmNvbVwiKSByZXR1cm4gdW5kZWZpbmVkO1xuICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG59XG4iLCAiLyoqXG4gKiBSZW5kZXJlci1zaWRlIHR3ZWFrIGhvc3QuIFdlOlxuICogICAxLiBBc2sgbWFpbiBmb3IgdGhlIHR3ZWFrIGxpc3QgKHdpdGggcmVzb2x2ZWQgZW50cnkgcGF0aCkuXG4gKiAgIDIuIEZvciBlYWNoIHJlbmRlcmVyLXNjb3BlZCAob3IgXCJib3RoXCIpIHR3ZWFrLCBmZXRjaCBpdHMgc291cmNlIHZpYSBJUENcbiAqICAgICAgYW5kIGV4ZWN1dGUgaXQgYXMgYSBDb21tb25KUy1zaGFwZWQgZnVuY3Rpb24uXG4gKiAgIDMuIFByb3ZpZGUgaXQgdGhlIHJlbmRlcmVyIGhhbGYgb2YgdGhlIEFQSS5cbiAqXG4gKiBDb2RleCBydW5zIHRoZSByZW5kZXJlciB3aXRoIHNhbmRib3g6IHRydWUsIHNvIE5vZGUncyBgcmVxdWlyZSgpYCBpc1xuICogcmVzdHJpY3RlZCB0byBhIHRpbnkgd2hpdGVsaXN0IChlbGVjdHJvbiArIGEgZmV3IHBvbHlmaWxscykuIFRoYXQgbWVhbnMgd2VcbiAqIGNhbm5vdCBgcmVxdWlyZSgpYCBhcmJpdHJhcnkgdHdlYWsgZmlsZXMgZnJvbSBkaXNrLiBJbnN0ZWFkIHdlIHB1bGwgdGhlXG4gKiBzb3VyY2Ugc3RyaW5nIGZyb20gbWFpbiBhbmQgZXZhbHVhdGUgaXQgd2l0aCBgbmV3IEZ1bmN0aW9uYCBpbnNpZGUgdGhlXG4gKiBwcmVsb2FkIGNvbnRleHQuIFR3ZWFrIGF1dGhvcnMgd2hvIG5lZWQgbnBtIGRlcHMgbXVzdCBidW5kbGUgdGhlbSBpbi5cbiAqL1xuXG5pbXBvcnQgeyBpcGNSZW5kZXJlciB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgcmVnaXN0ZXJTZWN0aW9uLCByZWdpc3RlclBhZ2UsIGNsZWFyU2VjdGlvbnMsIHNldExpc3RlZFR3ZWFrcyB9IGZyb20gXCIuL3NldHRpbmdzLWluamVjdG9yXCI7XG5pbXBvcnQgeyBmaWJlckZvck5vZGUgfSBmcm9tIFwiLi9yZWFjdC1ob29rXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFR3ZWFrTWFuaWZlc3QsXG4gIFR3ZWFrQXBpLFxuICBSZWFjdEZpYmVyTm9kZSxcbiAgVHdlYWssXG59IGZyb20gXCJAY29kZXgtcGx1c3BsdXMvc2RrXCI7XG5cbmludGVyZmFjZSBMaXN0ZWRUd2VhayB7XG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xuICBlbnRyeTogc3RyaW5nO1xuICBkaXI6IHN0cmluZztcbiAgZW50cnlFeGlzdHM6IGJvb2xlYW47XG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIHVwZGF0ZToge1xuICAgIGNoZWNrZWRBdDogc3RyaW5nO1xuICAgIHJlcG86IHN0cmluZztcbiAgICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICAgIGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gICAgbGF0ZXN0VGFnOiBzdHJpbmcgfCBudWxsO1xuICAgIHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7XG4gICAgdXBkYXRlQXZhaWxhYmxlOiBib29sZWFuO1xuICAgIGVycm9yPzogc3RyaW5nO1xuICB9IHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIFVzZXJQYXRocyB7XG4gIHVzZXJSb290OiBzdHJpbmc7XG4gIHJ1bnRpbWVEaXI6IHN0cmluZztcbiAgdHdlYWtzRGlyOiBzdHJpbmc7XG4gIGxvZ0Rpcjogc3RyaW5nO1xufVxuXG5jb25zdCBsb2FkZWQgPSBuZXcgTWFwPHN0cmluZywgeyBzdG9wPzogKCkgPT4gdm9pZCB9PigpO1xubGV0IGNhY2hlZFBhdGhzOiBVc2VyUGF0aHMgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0YXJ0VHdlYWtIb3N0KCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB0d2Vha3MgPSAoYXdhaXQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDpsaXN0LXR3ZWFrc1wiKSkgYXMgTGlzdGVkVHdlYWtbXTtcbiAgY29uc3QgcGF0aHMgPSAoYXdhaXQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDp1c2VyLXBhdGhzXCIpKSBhcyBVc2VyUGF0aHM7XG4gIGNhY2hlZFBhdGhzID0gcGF0aHM7XG4gIC8vIFB1c2ggdGhlIGxpc3QgdG8gdGhlIHNldHRpbmdzIGluamVjdG9yIHNvIHRoZSBUd2Vha3MgcGFnZSBjYW4gcmVuZGVyXG4gIC8vIGNhcmRzIGV2ZW4gYmVmb3JlIGFueSB0d2VhaydzIHN0YXJ0KCkgcnVucyAoYW5kIGZvciBkaXNhYmxlZCB0d2Vha3NcbiAgLy8gdGhhdCB3ZSBuZXZlciBsb2FkKS5cbiAgc2V0TGlzdGVkVHdlYWtzKHR3ZWFrcyk7XG4gIC8vIFN0YXNoIGZvciB0aGUgc2V0dGluZ3MgaW5qZWN0b3IncyBlbXB0eS1zdGF0ZSBtZXNzYWdlLlxuICAod2luZG93IGFzIHVua25vd24gYXMgeyBfX2NvZGV4cHBfdHdlYWtzX2Rpcl9fPzogc3RyaW5nIH0pLl9fY29kZXhwcF90d2Vha3NfZGlyX18gPVxuICAgIHBhdGhzLnR3ZWFrc0RpcjtcblxuICBmb3IgKGNvbnN0IHQgb2YgdHdlYWtzKSB7XG4gICAgaWYgKHQubWFuaWZlc3Quc2NvcGUgPT09IFwibWFpblwiKSBjb250aW51ZTtcbiAgICBpZiAoIXQuZW50cnlFeGlzdHMpIGNvbnRpbnVlO1xuICAgIGlmICghdC5lbmFibGVkKSBjb250aW51ZTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgbG9hZFR3ZWFrKHQsIHBhdGhzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiW2NvZGV4LXBsdXNwbHVzXSB0d2VhayBsb2FkIGZhaWxlZDpcIiwgdC5tYW5pZmVzdC5pZCwgZSk7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5zZW5kKFxuICAgICAgICAgIFwiY29kZXhwcDpwcmVsb2FkLWxvZ1wiLFxuICAgICAgICAgIFwiZXJyb3JcIixcbiAgICAgICAgICBcInR3ZWFrIGxvYWQgZmFpbGVkOiBcIiArIHQubWFuaWZlc3QuaWQgKyBcIjogXCIgKyBTdHJpbmcoKGUgYXMgRXJyb3IpPy5zdGFjayA/PyBlKSxcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gIH1cblxuICBjb25zb2xlLmluZm8oXG4gICAgYFtjb2RleC1wbHVzcGx1c10gcmVuZGVyZXIgaG9zdCBsb2FkZWQgJHtsb2FkZWQuc2l6ZX0gdHdlYWsocyk6YCxcbiAgICBbLi4ubG9hZGVkLmtleXMoKV0uam9pbihcIiwgXCIpIHx8IFwiKG5vbmUpXCIsXG4gICk7XG4gIGlwY1JlbmRlcmVyLnNlbmQoXG4gICAgXCJjb2RleHBwOnByZWxvYWQtbG9nXCIsXG4gICAgXCJpbmZvXCIsXG4gICAgYHJlbmRlcmVyIGhvc3QgbG9hZGVkICR7bG9hZGVkLnNpemV9IHR3ZWFrKHMpOiAke1suLi5sb2FkZWQua2V5cygpXS5qb2luKFwiLCBcIikgfHwgXCIobm9uZSlcIn1gLFxuICApO1xufVxuXG4vKipcbiAqIFN0b3AgZXZlcnkgcmVuZGVyZXItc2NvcGUgdHdlYWsgc28gYSBzdWJzZXF1ZW50IGBzdGFydFR3ZWFrSG9zdCgpYCB3aWxsXG4gKiByZS1ldmFsdWF0ZSBmcmVzaCBzb3VyY2UuIE1vZHVsZSBjYWNoZSBpc24ndCByZWxldmFudCBzaW5jZSB3ZSBldmFsXG4gKiBzb3VyY2Ugc3RyaW5ncyBkaXJlY3RseSBcdTIwMTQgZWFjaCBsb2FkIGNyZWF0ZXMgYSBmcmVzaCBzY29wZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlYXJkb3duVHdlYWtIb3N0KCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtpZCwgdF0gb2YgbG9hZGVkKSB7XG4gICAgdHJ5IHtcbiAgICAgIHQuc3RvcD8uKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS53YXJuKFwiW2NvZGV4LXBsdXNwbHVzXSB0d2VhayBzdG9wIGZhaWxlZDpcIiwgaWQsIGUpO1xuICAgIH1cbiAgfVxuICBsb2FkZWQuY2xlYXIoKTtcbiAgY2xlYXJTZWN0aW9ucygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkVHdlYWsodDogTGlzdGVkVHdlYWssIHBhdGhzOiBVc2VyUGF0aHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc291cmNlID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcbiAgICBcImNvZGV4cHA6cmVhZC10d2Vhay1zb3VyY2VcIixcbiAgICB0LmVudHJ5LFxuICApKSBhcyBzdHJpbmc7XG5cbiAgLy8gRXZhbHVhdGUgYXMgQ0pTLXNoYXBlZDogcHJvdmlkZSBtb2R1bGUvZXhwb3J0cy9hcGkuIFR3ZWFrIGNvZGUgbWF5IHVzZVxuICAvLyBgbW9kdWxlLmV4cG9ydHMgPSB7IHN0YXJ0LCBzdG9wIH1gIG9yIGBleHBvcnRzLnN0YXJ0ID0gLi4uYCBvciBwdXJlIEVTTVxuICAvLyBkZWZhdWx0IGV4cG9ydCBzaGFwZSAod2UgYWNjZXB0IGJvdGgpLlxuICBjb25zdCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IGFzIHsgZGVmYXVsdD86IFR3ZWFrIH0gJiBUd2VhayB9O1xuICBjb25zdCBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8taW1wbGllZC1ldmFsLCBuby1uZXctZnVuY1xuICBjb25zdCBmbiA9IG5ldyBGdW5jdGlvbihcbiAgICBcIm1vZHVsZVwiLFxuICAgIFwiZXhwb3J0c1wiLFxuICAgIFwiY29uc29sZVwiLFxuICAgIGAke3NvdXJjZX1cXG4vLyMgc291cmNlVVJMPWNvZGV4cHAtdHdlYWs6Ly8ke2VuY29kZVVSSUNvbXBvbmVudCh0Lm1hbmlmZXN0LmlkKX0vJHtlbmNvZGVVUklDb21wb25lbnQodC5lbnRyeSl9YCxcbiAgKTtcbiAgZm4obW9kdWxlLCBleHBvcnRzLCBjb25zb2xlKTtcbiAgY29uc3QgbW9kID0gbW9kdWxlLmV4cG9ydHMgYXMgeyBkZWZhdWx0PzogVHdlYWsgfSAmIFR3ZWFrO1xuICBjb25zdCB0d2VhazogVHdlYWsgPSAobW9kIGFzIHsgZGVmYXVsdD86IFR3ZWFrIH0pLmRlZmF1bHQgPz8gKG1vZCBhcyBUd2Vhayk7XG4gIGlmICh0eXBlb2YgdHdlYWs/LnN0YXJ0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHR3ZWFrICR7dC5tYW5pZmVzdC5pZH0gaGFzIG5vIHN0YXJ0KClgKTtcbiAgfVxuICBjb25zdCBhcGkgPSBtYWtlUmVuZGVyZXJBcGkodC5tYW5pZmVzdCwgcGF0aHMpO1xuICBhd2FpdCB0d2Vhay5zdGFydChhcGkpO1xuICBsb2FkZWQuc2V0KHQubWFuaWZlc3QuaWQsIHsgc3RvcDogdHdlYWsuc3RvcD8uYmluZCh0d2VhaykgfSk7XG59XG5cbmZ1bmN0aW9uIG1ha2VSZW5kZXJlckFwaShtYW5pZmVzdDogVHdlYWtNYW5pZmVzdCwgcGF0aHM6IFVzZXJQYXRocyk6IFR3ZWFrQXBpIHtcbiAgY29uc3QgaWQgPSBtYW5pZmVzdC5pZDtcbiAgY29uc3QgbG9nID0gKGxldmVsOiBcImRlYnVnXCIgfCBcImluZm9cIiB8IFwid2FyblwiIHwgXCJlcnJvclwiLCAuLi5hOiB1bmtub3duW10pID0+IHtcbiAgICBjb25zdCBjb25zb2xlRm4gPVxuICAgICAgbGV2ZWwgPT09IFwiZGVidWdcIiA/IGNvbnNvbGUuZGVidWdcbiAgICAgIDogbGV2ZWwgPT09IFwid2FyblwiID8gY29uc29sZS53YXJuXG4gICAgICA6IGxldmVsID09PSBcImVycm9yXCIgPyBjb25zb2xlLmVycm9yXG4gICAgICA6IGNvbnNvbGUubG9nO1xuICAgIGNvbnNvbGVGbihgW2NvZGV4LXBsdXNwbHVzXVske2lkfV1gLCAuLi5hKTtcbiAgICAvLyBBbHNvIG1pcnJvciB0byBtYWluJ3MgbG9nIGZpbGUgc28gd2UgY2FuIGRpYWdub3NlIHR3ZWFrIGJlaGF2aW9yXG4gICAgLy8gd2l0aG91dCBhdHRhY2hpbmcgRGV2VG9vbHMuIFN0cmluZ2lmeSBlYWNoIGFyZyBkZWZlbnNpdmVseS5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFydHMgPSBhLm1hcCgodikgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIHJldHVybiB2O1xuICAgICAgICBpZiAodiBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gYCR7di5uYW1lfTogJHt2Lm1lc3NhZ2V9YDtcbiAgICAgICAgdHJ5IHsgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpOyB9IGNhdGNoIHsgcmV0dXJuIFN0cmluZyh2KTsgfVxuICAgICAgfSk7XG4gICAgICBpcGNSZW5kZXJlci5zZW5kKFxuICAgICAgICBcImNvZGV4cHA6cHJlbG9hZC1sb2dcIixcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGBbdHdlYWsgJHtpZH1dICR7cGFydHMuam9pbihcIiBcIil9YCxcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBzd2FsbG93IFx1MjAxNCBuZXZlciBsZXQgbG9nZ2luZyBicmVhayBhIHR3ZWFrICovXG4gICAgfVxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgbWFuaWZlc3QsXG4gICAgcHJvY2VzczogXCJyZW5kZXJlclwiLFxuICAgIGxvZzoge1xuICAgICAgZGVidWc6ICguLi5hKSA9PiBsb2coXCJkZWJ1Z1wiLCAuLi5hKSxcbiAgICAgIGluZm86ICguLi5hKSA9PiBsb2coXCJpbmZvXCIsIC4uLmEpLFxuICAgICAgd2FybjogKC4uLmEpID0+IGxvZyhcIndhcm5cIiwgLi4uYSksXG4gICAgICBlcnJvcjogKC4uLmEpID0+IGxvZyhcImVycm9yXCIsIC4uLmEpLFxuICAgIH0sXG4gICAgc3RvcmFnZTogcmVuZGVyZXJTdG9yYWdlKGlkKSxcbiAgICBzZXR0aW5nczoge1xuICAgICAgcmVnaXN0ZXI6IChzKSA9PiByZWdpc3RlclNlY3Rpb24oeyAuLi5zLCBpZDogYCR7aWR9OiR7cy5pZH1gIH0pLFxuICAgICAgcmVnaXN0ZXJQYWdlOiAocCkgPT5cbiAgICAgICAgcmVnaXN0ZXJQYWdlKGlkLCBtYW5pZmVzdCwgeyAuLi5wLCBpZDogYCR7aWR9OiR7cC5pZH1gIH0pLFxuICAgIH0sXG4gICAgcmVhY3Q6IHtcbiAgICAgIGdldEZpYmVyOiAobikgPT4gZmliZXJGb3JOb2RlKG4pIGFzIFJlYWN0RmliZXJOb2RlIHwgbnVsbCxcbiAgICAgIGZpbmRPd25lckJ5TmFtZTogKG4sIG5hbWUpID0+IHtcbiAgICAgICAgbGV0IGYgPSBmaWJlckZvck5vZGUobikgYXMgUmVhY3RGaWJlck5vZGUgfCBudWxsO1xuICAgICAgICB3aGlsZSAoZikge1xuICAgICAgICAgIGNvbnN0IHQgPSBmLnR5cGUgYXMgeyBkaXNwbGF5TmFtZT86IHN0cmluZzsgbmFtZT86IHN0cmluZyB9IHwgbnVsbDtcbiAgICAgICAgICBpZiAodCAmJiAodC5kaXNwbGF5TmFtZSA9PT0gbmFtZSB8fCB0Lm5hbWUgPT09IG5hbWUpKSByZXR1cm4gZjtcbiAgICAgICAgICBmID0gZi5yZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgd2FpdEZvckVsZW1lbnQ6IChzZWwsIHRpbWVvdXRNcyA9IDUwMDApID0+XG4gICAgICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBleGlzdGluZyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsKTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmcpIHJldHVybiByZXNvbHZlKGV4aXN0aW5nKTtcbiAgICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XG4gICAgICAgICAgY29uc3Qgb2JzID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbCk7XG4gICAgICAgICAgICBpZiAoZWwpIHtcbiAgICAgICAgICAgICAgb2JzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShlbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKERhdGUubm93KCkgPiBkZWFkbGluZSkge1xuICAgICAgICAgICAgICBvYnMuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGB0aW1lb3V0IHdhaXRpbmcgZm9yICR7c2VsfWApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvYnMub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgICB9KSxcbiAgICB9LFxuICAgIGlwYzoge1xuICAgICAgb246IChjLCBoKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyYXBwZWQgPSAoX2U6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gaCguLi5hcmdzKTtcbiAgICAgICAgaXBjUmVuZGVyZXIub24oYGNvZGV4cHA6JHtpZH06JHtjfWAsIHdyYXBwZWQpO1xuICAgICAgICByZXR1cm4gKCkgPT4gaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoYGNvZGV4cHA6JHtpZH06JHtjfWAsIHdyYXBwZWQpO1xuICAgICAgfSxcbiAgICAgIHNlbmQ6IChjLCAuLi5hcmdzKSA9PiBpcGNSZW5kZXJlci5zZW5kKGBjb2RleHBwOiR7aWR9OiR7Y31gLCAuLi5hcmdzKSxcbiAgICAgIGludm9rZTogPFQ+KGM6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoYGNvZGV4cHA6JHtpZH06JHtjfWAsIC4uLmFyZ3MpIGFzIFByb21pc2U8VD4sXG4gICAgfSxcbiAgICBmczogcmVuZGVyZXJGcyhpZCwgcGF0aHMpLFxuICB9O1xufVxuXG5mdW5jdGlvbiByZW5kZXJlclN0b3JhZ2UoaWQ6IHN0cmluZykge1xuICBjb25zdCBrZXkgPSBgY29kZXhwcDpzdG9yYWdlOiR7aWR9YDtcbiAgY29uc3QgcmVhZCA9ICgpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgPz8gXCJ7fVwiKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHdyaXRlID0gKHY6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PlxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkodikpO1xuICByZXR1cm4ge1xuICAgIGdldDogPFQ+KGs6IHN0cmluZywgZD86IFQpID0+IChrIGluIHJlYWQoKSA/IChyZWFkKClba10gYXMgVCkgOiAoZCBhcyBUKSksXG4gICAgc2V0OiAoazogc3RyaW5nLCB2OiB1bmtub3duKSA9PiB7XG4gICAgICBjb25zdCBvID0gcmVhZCgpO1xuICAgICAgb1trXSA9IHY7XG4gICAgICB3cml0ZShvKTtcbiAgICB9LFxuICAgIGRlbGV0ZTogKGs6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbyA9IHJlYWQoKTtcbiAgICAgIGRlbGV0ZSBvW2tdO1xuICAgICAgd3JpdGUobyk7XG4gICAgfSxcbiAgICBhbGw6ICgpID0+IHJlYWQoKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyZXJGcyhpZDogc3RyaW5nLCBfcGF0aHM6IFVzZXJQYXRocykge1xuICAvLyBTYW5kYm94ZWQgcmVuZGVyZXIgY2FuJ3QgdXNlIE5vZGUgZnMgZGlyZWN0bHkgXHUyMDE0IHByb3h5IHRocm91Z2ggbWFpbiBJUEMuXG4gIHJldHVybiB7XG4gICAgZGF0YURpcjogYDxyZW1vdGU+L3R3ZWFrLWRhdGEvJHtpZH1gLFxuICAgIHJlYWQ6IChwOiBzdHJpbmcpID0+XG4gICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnR3ZWFrLWZzXCIsIFwicmVhZFwiLCBpZCwgcCkgYXMgUHJvbWlzZTxzdHJpbmc+LFxuICAgIHdyaXRlOiAocDogc3RyaW5nLCBjOiBzdHJpbmcpID0+XG4gICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnR3ZWFrLWZzXCIsIFwid3JpdGVcIiwgaWQsIHAsIGMpIGFzIFByb21pc2U8dm9pZD4sXG4gICAgZXhpc3RzOiAocDogc3RyaW5nKSA9PlxuICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDp0d2Vhay1mc1wiLCBcImV4aXN0c1wiLCBpZCwgcCkgYXMgUHJvbWlzZTxib29sZWFuPixcbiAgfTtcbn1cbiIsICIvKipcbiAqIEJ1aWx0LWluIFwiVHdlYWsgTWFuYWdlclwiIFx1MjAxNCBhdXRvLWluamVjdGVkIGJ5IHRoZSBydW50aW1lLCBub3QgYSB1c2VyIHR3ZWFrLlxuICogTGlzdHMgZGlzY292ZXJlZCB0d2Vha3Mgd2l0aCBlbmFibGUgdG9nZ2xlcywgb3BlbnMgdGhlIHR3ZWFrcyBkaXIsIGxpbmtzXG4gKiB0byBsb2dzIGFuZCBjb25maWcuIExpdmVzIGluIHRoZSByZW5kZXJlci5cbiAqXG4gKiBUaGlzIGlzIGludm9rZWQgZnJvbSBwcmVsb2FkL2luZGV4LnRzIEFGVEVSIHVzZXIgdHdlYWtzIGFyZSBsb2FkZWQgc28gaXRcbiAqIGNhbiBzaG93IHVwLXRvLWRhdGUgc3RhdHVzLlxuICovXG5pbXBvcnQgeyBpcGNSZW5kZXJlciB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgcmVnaXN0ZXJTZWN0aW9uIH0gZnJvbSBcIi4vc2V0dGluZ3MtaW5qZWN0b3JcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1vdW50TWFuYWdlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgdHdlYWtzID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6bGlzdC10d2Vha3NcIikpIGFzIEFycmF5PHtcbiAgICBtYW5pZmVzdDogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHZlcnNpb246IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfTtcbiAgICBlbnRyeUV4aXN0czogYm9vbGVhbjtcbiAgfT47XG4gIGNvbnN0IHBhdGhzID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6dXNlci1wYXRoc1wiKSkgYXMge1xuICAgIHVzZXJSb290OiBzdHJpbmc7XG4gICAgdHdlYWtzRGlyOiBzdHJpbmc7XG4gICAgbG9nRGlyOiBzdHJpbmc7XG4gIH07XG5cbiAgcmVnaXN0ZXJTZWN0aW9uKHtcbiAgICBpZDogXCJjb2RleC1wbHVzcGx1czptYW5hZ2VyXCIsXG4gICAgdGl0bGU6IFwiVHdlYWsgTWFuYWdlclwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHt0d2Vha3MubGVuZ3RofSB0d2VhayhzKSBpbnN0YWxsZWQuIFVzZXIgZGlyOiAke3BhdGhzLnVzZXJSb290fWAsXG4gICAgcmVuZGVyKHJvb3QpIHtcbiAgICAgIHJvb3Quc3R5bGUuY3NzVGV4dCA9IFwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6OHB4O1wiO1xuXG4gICAgICBjb25zdCBhY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIGFjdGlvbnMuc3R5bGUuY3NzVGV4dCA9IFwiZGlzcGxheTpmbGV4O2dhcDo4cHg7ZmxleC13cmFwOndyYXA7XCI7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJPcGVuIHR3ZWFrcyBmb2xkZXJcIiwgKCkgPT5cbiAgICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCBwYXRocy50d2Vha3NEaXIpLmNhdGNoKCgpID0+IHt9KSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJPcGVuIGxvZ3NcIiwgKCkgPT5cbiAgICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCBwYXRocy5sb2dEaXIpLmNhdGNoKCgpID0+IHt9KSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJSZWxvYWQgd2luZG93XCIsICgpID0+IGxvY2F0aW9uLnJlbG9hZCgpKSxcbiAgICAgICk7XG4gICAgICByb290LmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuXG4gICAgICBpZiAodHdlYWtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zdCBlbXB0eSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xuICAgICAgICBlbXB0eS5zdHlsZS5jc3NUZXh0ID0gXCJjb2xvcjojODg4O2ZvbnQ6MTNweCBzeXN0ZW0tdWk7bWFyZ2luOjhweCAwO1wiO1xuICAgICAgICBlbXB0eS50ZXh0Q29udGVudCA9XG4gICAgICAgICAgXCJObyB1c2VyIHR3ZWFrcyB5ZXQuIERyb3AgYSBmb2xkZXIgd2l0aCBtYW5pZmVzdC5qc29uICsgaW5kZXguanMgaW50byB0aGUgdHdlYWtzIGRpciwgdGhlbiByZWxvYWQuXCI7XG4gICAgICAgIHJvb3QuYXBwZW5kQ2hpbGQoZW1wdHkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIik7XG4gICAgICBsaXN0LnN0eWxlLmNzc1RleHQgPSBcImxpc3Qtc3R5bGU6bm9uZTttYXJnaW46MDtwYWRkaW5nOjA7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NnB4O1wiO1xuICAgICAgZm9yIChjb25zdCB0IG9mIHR3ZWFrcykge1xuICAgICAgICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICAgICAgbGkuc3R5bGUuY3NzVGV4dCA9XG4gICAgICAgICAgXCJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6OHB4IDEwcHg7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIsIzJhMmEyYSk7Ym9yZGVyLXJhZGl1czo2cHg7XCI7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICBsZWZ0LmlubmVySFRNTCA9IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udDo2MDAgMTNweCBzeXN0ZW0tdWk7XCI+JHtlc2NhcGUodC5tYW5pZmVzdC5uYW1lKX0gPHNwYW4gc3R5bGU9XCJjb2xvcjojODg4O2ZvbnQtd2VpZ2h0OjQwMDtcIj52JHtlc2NhcGUodC5tYW5pZmVzdC52ZXJzaW9uKX08L3NwYW4+PC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiM4ODg7Zm9udDoxMnB4IHN5c3RlbS11aTtcIj4ke2VzY2FwZSh0Lm1hbmlmZXN0LmRlc2NyaXB0aW9uID8/IHQubWFuaWZlc3QuaWQpfTwvZGl2PlxuICAgICAgICBgO1xuICAgICAgICBjb25zdCByaWdodCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHJpZ2h0LnN0eWxlLmNzc1RleHQgPSBcImNvbG9yOiM4ODg7Zm9udDoxMnB4IHN5c3RlbS11aTtcIjtcbiAgICAgICAgcmlnaHQudGV4dENvbnRlbnQgPSB0LmVudHJ5RXhpc3RzID8gXCJsb2FkZWRcIiA6IFwibWlzc2luZyBlbnRyeVwiO1xuICAgICAgICBsaS5hcHBlbmQobGVmdCwgcmlnaHQpO1xuICAgICAgICBsaXN0LmFwcGVuZChsaSk7XG4gICAgICB9XG4gICAgICByb290LmFwcGVuZChsaXN0KTtcbiAgICB9LFxuICB9KTtcbn1cblxuZnVuY3Rpb24gYnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uY2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICBiLnR5cGUgPSBcImJ1dHRvblwiO1xuICBiLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIGIuc3R5bGUuY3NzVGV4dCA9XG4gICAgXCJwYWRkaW5nOjZweCAxMHB4O2JvcmRlcjoxcHggc29saWQgdmFyKC0tYm9yZGVyLCMzMzMpO2JvcmRlci1yYWRpdXM6NnB4O2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6aW5oZXJpdDtmb250OjEycHggc3lzdGVtLXVpO2N1cnNvcjpwb2ludGVyO1wiO1xuICBiLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbmNsaWNrKTtcbiAgcmV0dXJuIGI7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9bJjw+XCInXS9nLCAoYykgPT5cbiAgICBjID09PSBcIiZcIlxuICAgICAgPyBcIiZhbXA7XCJcbiAgICAgIDogYyA9PT0gXCI8XCJcbiAgICAgICAgPyBcIiZsdDtcIlxuICAgICAgICA6IGMgPT09IFwiPlwiXG4gICAgICAgICAgPyBcIiZndDtcIlxuICAgICAgICAgIDogYyA9PT0gJ1wiJ1xuICAgICAgICAgICAgPyBcIiZxdW90O1wiXG4gICAgICAgICAgICA6IFwiJiMzOTtcIixcbiAgKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQVdBLElBQUFBLG1CQUE0Qjs7O0FDNkJyQixTQUFTLG1CQUF5QjtBQUN2QyxNQUFJLE9BQU8sK0JBQWdDO0FBQzNDLFFBQU0sWUFBWSxvQkFBSSxJQUErQjtBQUNyRCxNQUFJLFNBQVM7QUFDYixRQUFNLFlBQVksb0JBQUksSUFBNEM7QUFFbEUsUUFBTSxPQUEwQjtBQUFBLElBQzlCLGVBQWU7QUFBQSxJQUNmO0FBQUEsSUFDQSxPQUFPLFVBQVU7QUFDZixZQUFNLEtBQUs7QUFDWCxnQkFBVSxJQUFJLElBQUksUUFBUTtBQUUxQixjQUFR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QUFJLEtBQUssVUFBVSxDQUFDO0FBQUEsRUFDckQsUUFBUTtBQUNOLFdBQU8sT0FBTyxDQUFDO0FBQUEsRUFDakI7QUFDRjtBQUVBLFFBQVEsaUJBQWlCLEVBQUUsS0FBSyxTQUFTLEtBQUssQ0FBQztBQUcvQyxJQUFJO0FBQ0YsbUJBQWlCO0FBQ2pCLFVBQVEsc0JBQXNCO0FBQ2hDLFNBQVMsR0FBRztBQUNWLFVBQVEscUJBQXFCLE9BQU8sQ0FBQyxDQUFDO0FBQ3hDO0FBRUEsZUFBZSxNQUFNO0FBQ25CLE1BQUksU0FBUyxlQUFlLFdBQVc7QUFDckMsYUFBUyxpQkFBaUIsb0JBQW9CLE1BQU0sRUFBRSxNQUFNLEtBQUssQ0FBQztBQUFBLEVBQ3BFLE9BQU87QUFDTCxTQUFLO0FBQUEsRUFDUDtBQUNGLENBQUM7QUFFRCxlQUFlLE9BQU87QUFDcEIsVUFBUSxjQUFjLEVBQUUsWUFBWSxTQUFTLFdBQVcsQ0FBQztBQUN6RCxNQUFJO0FBQ0YsMEJBQXNCO0FBQ3RCLFlBQVEsMkJBQTJCO0FBQ25DLFVBQU0sZUFBZTtBQUNyQixZQUFRLG9CQUFvQjtBQUM1QixVQUFNLGFBQWE7QUFDbkIsWUFBUSxpQkFBaUI7QUFDekIsb0JBQWdCO0FBQ2hCLFlBQVEsZUFBZTtBQUFBLEVBQ3pCLFNBQVMsR0FBRztBQUNWLFlBQVEsZUFBZSxPQUFRLEdBQWEsU0FBUyxDQUFDLENBQUM7QUFDdkQsWUFBUSxNQUFNLHlDQUF5QyxDQUFDO0FBQUEsRUFDMUQ7QUFDRjtBQUlBLElBQUksWUFBa0M7QUFDdEMsU0FBUyxrQkFBd0I7QUFDL0IsK0JBQVksR0FBRywwQkFBMEIsTUFBTTtBQUM3QyxRQUFJLFVBQVc7QUFDZixpQkFBYSxZQUFZO0FBQ3ZCLFVBQUk7QUFDRixnQkFBUSxLQUFLLHVDQUF1QztBQUNwRCwwQkFBa0I7QUFDbEIsY0FBTSxlQUFlO0FBQ3JCLGNBQU0sYUFBYTtBQUFBLE1BQ3JCLFNBQVMsR0FBRztBQUNWLGdCQUFRLE1BQU0sdUNBQXVDLENBQUM7QUFBQSxNQUN4RCxVQUFFO0FBQ0Esb0JBQVk7QUFBQSxNQUNkO0FBQUEsSUFDRixHQUFHO0FBQUEsRUFDTCxDQUFDO0FBQ0g7IiwKICAibmFtZXMiOiBbImltcG9ydF9lbGVjdHJvbiIsICJyb290IiwgInN0YXRlIiwgImJ1dHRvbiIsICJjYXJkIiwgImltcG9ydF9lbGVjdHJvbiIsICJtb2R1bGUiLCAiZXhwb3J0cyIsICJpbXBvcnRfZWxlY3Ryb24iLCAic2FmZVN0cmluZ2lmeSJdCn0K
