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
    "",
    "## Screenshots",
    "Screenshots must be committed in the repo at the reviewed commit.",
    "Expected location: `.codexpp-store/screenshots/`",
    "Required: 1-3 images, each exactly 1920x1080.",
    "",
    "## Admin checklist",
    "- [ ] manifest.json is valid",
    "- [ ] screenshots exist at the reviewed commit and are exactly 1920x1080",
    "- [ ] source was reviewed at the exact commit above",
    "- [ ] `store/index.json` entry pins `approvedCommitSha` to the exact commit above",
    "- [ ] screenshot URLs in `store/index.json` point at immutable raw URLs for the exact commit above"
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
  settingsSurfaceHideTimer: null
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
  const group = document.createElement("div");
  group.dataset.codexpp = "nav-group";
  group.className = "flex flex-col gap-px";
  group.appendChild(sidebarGroupHeader("Codex++", "pt-3"));
  const configBtn = makeSidebarItem("Config", configIconSvg());
  const tweaksBtn = makeSidebarItem("Tweaks", tweaksIconSvg());
  const storeBtn = makeSidebarItem("Tweak Store", storeIconSvg());
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
function sidebarGroupHeader(text, topPadding = "pt-2") {
  const header = document.createElement("div");
  header.className = `px-row-x ${topPadding} pb-1 text-[11px] font-medium uppercase tracking-wider text-token-description-foreground select-none`;
  header.textContent = text;
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
  const text = compactSettingsText(document.body?.textContent || "").toLowerCase();
  return text.includes("back to app") && text.includes("general") && text.includes("appearance") && (text.includes("configuration") || text.includes("default permissions"));
}
function compactSettingsText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function setSettingsSurfaceVisible(visible, reason) {
  if (state.settingsSurfaceVisible === visible) return;
  state.settingsSurfaceVisible = visible;
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
  const title = ap.kind === "tweaks" ? "Tweaks" : ap.kind === "store" ? "Tweak Store" : "Config";
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
    grid.textContent = "";
    grid.appendChild(storeMessageCard("Refreshing tweak store", "Fetching the latest reviewed registry from GitHub."));
    refreshTweakStoreGrid(grid, source, refreshBtn);
  });
  actions.appendChild(refreshBtn);
  actions.appendChild(storeToolbarButton("Publish Tweak", openPublishTweakDialog, "primary"));
  if (headerActions) {
    headerActions.replaceChildren(actions);
  }
  const grid = document.createElement("div");
  grid.dataset.codexppStoreGrid = "true";
  grid.className = "grid gap-4";
  grid.appendChild(storeMessageCard("Loading tweak store", "Fetching reviewed tweaks from the Codex++ registry."));
  section.appendChild(grid);
  sectionsWrap.appendChild(section);
  refreshTweakStoreGrid(grid, source, refreshBtn);
}
function refreshTweakStoreGrid(grid, source, refreshBtn) {
  void import_electron.ipcRenderer.invoke("codexpp:get-tweak-store").then((store) => {
    grid.dataset.codexppStore = JSON.stringify(store);
    renderTweakStoreGrid(grid, source);
  }).catch((e) => {
    grid.dataset.codexppStore = "";
    source.textContent = "Live registry unavailable";
    grid.textContent = "";
    grid.appendChild(storeMessageCard("Could not load tweak store", String(e)));
  }).finally(() => {
    if (refreshBtn) refreshBtn.disabled = false;
  });
}
function renderTweakStoreGrid(grid, source) {
  const store = parseStoreDataset(grid);
  if (!store) return;
  const entries = store.entries;
  source.textContent = `Refreshed ${new Date(store.fetchedAt).toLocaleString()}`;
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
  const card = document.createElement("div");
  card.className = "border-token-border/40 flex min-h-[190px] flex-col justify-between gap-4 rounded-2xl border p-4 transition-colors hover:bg-token-foreground/5";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-1 items-start gap-3";
  left.appendChild(storeAvatar(entry));
  const stack = document.createElement("div");
  stack.className = "flex min-w-0 flex-1 flex-col gap-2";
  const titleRow = document.createElement("div");
  titleRow.className = "flex min-w-0 items-start justify-between gap-3";
  const title = document.createElement("div");
  title.className = "min-w-0 text-base font-medium leading-6 text-token-foreground";
  title.textContent = entry.manifest.name;
  titleRow.appendChild(title);
  const version = document.createElement("span");
  version.className = "shrink-0 text-xs tabular-nums text-token-description-foreground";
  version.textContent = `v${entry.manifest.version}`;
  titleRow.appendChild(version);
  stack.appendChild(titleRow);
  if (entry.manifest.description) {
    const desc = document.createElement("div");
    desc.className = "line-clamp-3 min-w-0 text-sm leading-5 text-token-text-secondary";
    desc.textContent = entry.manifest.description;
    stack.appendChild(desc);
  }
  const badgeRow = document.createElement("div");
  badgeRow.className = "flex min-w-0 flex-wrap items-center gap-2";
  badgeRow.appendChild(verifiedSafeBadge());
  stack.appendChild(badgeRow);
  left.appendChild(stack);
  card.appendChild(left);
  const actions = document.createElement("div");
  actions.className = "mt-auto flex shrink-0 items-center justify-end gap-2";
  if (entry.releaseUrl) {
    actions.appendChild(
      compactButton("Release", () => {
        void import_electron.ipcRenderer.invoke("codexpp:open-external", entry.releaseUrl);
      })
    );
  }
  if (entry.installed && entry.installed.version === entry.manifest.version) {
    actions.appendChild(storeStatusPill("Installed"));
  } else {
    const installLabel = entry.installed ? "Update" : "Install";
    actions.appendChild(
      storeInstallButton(installLabel, () => {
        const grid = card.closest("[data-codexpp-store-grid]");
        const source = grid?.parentElement?.querySelector("[data-codexpp-store-source]");
        card.style.opacity = "0.65";
        actions.querySelectorAll("button").forEach((button2) => button2.disabled = true);
        void import_electron.ipcRenderer.invoke("codexpp:install-store-tweak", entry.id).then(() => {
          if (grid && source) {
            grid.textContent = "";
            grid.appendChild(storeMessageCard("Installed tweak", `${entry.manifest.name} was installed from the approved commit.`));
            refreshTweakStoreGrid(grid, source);
          }
          location.reload();
        }).catch((e) => {
          card.style.opacity = "";
          actions.querySelectorAll("button").forEach((button2) => button2.disabled = false);
          window.alert(`Could not install ${entry.manifest.name}: ${String(e.message ?? e)}`);
        });
      })
    );
  }
  card.appendChild(actions);
  return card;
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
  badge.className = "inline-flex h-7 items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 text-xs font-medium text-blue-500";
  badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.75 13.25 3.8v3.72c0 3.28-2.12 5.36-5.25 6.73-3.13-1.37-5.25-3.45-5.25-6.73V3.8L8 1.75Z" fill="currentColor" opacity=".16"/><path d="M5.25 8.15 7.05 9.9l3.7-4.05" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Verified as safe</span>`;
  return badge;
}
function storeStatusPill(label) {
  const pill = document.createElement("span");
  pill.className = "inline-flex h-8 items-center justify-center rounded-lg bg-token-foreground/5 px-3 text-sm font-medium text-token-description-foreground";
  pill.textContent = label;
  return pill;
}
function storeInstallButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "border-token-border user-select-none no-drag cursor-interaction flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-blue-500/40 bg-blue-500 px-3 py-0 text-sm font-medium text-white shadow-sm enabled:hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40";
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
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
  status.textContent = "Screenshots must be committed in .codexpp-store/screenshots at the submitted commit.";
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
  const heading = document.createElement("div");
  heading.className = "electron:heading-lg heading-base truncate";
  heading.textContent = title;
  headerInner.appendChild(heading);
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
  return { outer, sectionsWrap, subtitle: subtitleElement, headerActions };
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
  const links = Array.from(
    document.querySelectorAll("a[href*='/settings/']")
  );
  if (links.length >= 2) {
    let node = links[0].parentElement;
    while (node) {
      const inside = node.querySelectorAll("a[href*='/settings/']");
      if (inside.length >= Math.max(2, links.length - 1)) return node;
      node = node.parentElement;
    }
  }
  const KNOWN = [
    "General",
    "Appearance",
    "Configuration",
    "Personalization",
    "MCP servers",
    "MCP Servers",
    "Git",
    "Environments"
  ];
  const matches = [];
  const all = document.querySelectorAll(
    "button, a, [role='button'], li, div"
  );
  for (const el of Array.from(all)) {
    const t = (el.textContent ?? "").trim();
    if (t.length > 30) continue;
    if (KNOWN.some((k) => t === k)) matches.push(el);
    if (matches.length > 50) break;
  }
  if (matches.length >= 2) {
    let node = matches[0].parentElement;
    while (node) {
      let count = 0;
      for (const m of matches) if (node.contains(m)) count++;
      if (count >= Math.min(3, matches.length)) return node;
      node = node.parentElement;
    }
  }
  return null;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3ByZWxvYWQvaW5kZXgudHMiLCAiLi4vc3JjL3ByZWxvYWQvcmVhY3QtaG9vay50cyIsICIuLi9zcmMvcHJlbG9hZC9zZXR0aW5ncy1pbmplY3Rvci50cyIsICIuLi9zcmMvdHdlYWstc3RvcmUudHMiLCAiLi4vc3JjL3ByZWxvYWQvdHdlYWstaG9zdC50cyIsICIuLi9zcmMvcHJlbG9hZC9tYW5hZ2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIFJlbmRlcmVyIHByZWxvYWQgZW50cnkuIFJ1bnMgaW4gYW4gaXNvbGF0ZWQgd29ybGQgYmVmb3JlIENvZGV4J3MgcGFnZSBKUy5cbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAgIDEuIEluc3RhbGwgYSBSZWFjdCBEZXZUb29scy1zaGFwZWQgZ2xvYmFsIGhvb2sgdG8gY2FwdHVyZSB0aGUgcmVuZGVyZXJcbiAqICAgICAgcmVmZXJlbmNlIHdoZW4gUmVhY3QgbW91bnRzLiBXZSB1c2UgdGhpcyBmb3IgZmliZXIgd2Fsa2luZy5cbiAqICAgMi4gQWZ0ZXIgRE9NQ29udGVudExvYWRlZCwga2ljayBvZmYgc2V0dGluZ3MtaW5qZWN0aW9uIGxvZ2ljLlxuICogICAzLiBEaXNjb3ZlciByZW5kZXJlci1zY29wZWQgdHdlYWtzICh2aWEgSVBDIHRvIG1haW4pIGFuZCBzdGFydCB0aGVtLlxuICogICA0LiBMaXN0ZW4gZm9yIGBjb2RleHBwOnR3ZWFrcy1jaGFuZ2VkYCBmcm9tIG1haW4gKGZpbGVzeXN0ZW0gd2F0Y2hlcikgYW5kXG4gKiAgICAgIGhvdC1yZWxvYWQgdHdlYWtzIHdpdGhvdXQgZHJvcHBpbmcgdGhlIHBhZ2UuXG4gKi9cblxuaW1wb3J0IHsgaXBjUmVuZGVyZXIgfSBmcm9tIFwiZWxlY3Ryb25cIjtcbmltcG9ydCB7IGluc3RhbGxSZWFjdEhvb2sgfSBmcm9tIFwiLi9yZWFjdC1ob29rXCI7XG5pbXBvcnQgeyBzdGFydFNldHRpbmdzSW5qZWN0b3IgfSBmcm9tIFwiLi9zZXR0aW5ncy1pbmplY3RvclwiO1xuaW1wb3J0IHsgc3RhcnRUd2Vha0hvc3QsIHRlYXJkb3duVHdlYWtIb3N0IH0gZnJvbSBcIi4vdHdlYWstaG9zdFwiO1xuaW1wb3J0IHsgbW91bnRNYW5hZ2VyIH0gZnJvbSBcIi4vbWFuYWdlclwiO1xuXG4vLyBGaWxlLWxvZyBwcmVsb2FkIHByb2dyZXNzIHNvIHdlIGNhbiBkaWFnbm9zZSB3aXRob3V0IERldlRvb2xzLiBCZXN0LWVmZm9ydDpcbi8vIGZhaWx1cmVzIGhlcmUgbXVzdCBuZXZlciB0aHJvdyBiZWNhdXNlIHdlJ2QgdGFrZSB0aGUgcGFnZSBkb3duIHdpdGggdXMuXG4vL1xuLy8gQ29kZXgncyByZW5kZXJlciBpcyBzYW5kYm94ZWQgKHNhbmRib3g6IHRydWUpLCBzbyBgcmVxdWlyZShcIm5vZGU6ZnNcIilgIGlzXG4vLyB1bmF2YWlsYWJsZS4gV2UgZm9yd2FyZCBsb2cgbGluZXMgdG8gbWFpbiB2aWEgSVBDOyBtYWluIHdyaXRlcyB0aGUgZmlsZS5cbmZ1bmN0aW9uIGZpbGVMb2coc3RhZ2U6IHN0cmluZywgZXh0cmE/OiB1bmtub3duKTogdm9pZCB7XG4gIGNvbnN0IG1zZyA9IGBbY29kZXgtcGx1c3BsdXMgcHJlbG9hZF0gJHtzdGFnZX0ke1xuICAgIGV4dHJhID09PSB1bmRlZmluZWQgPyBcIlwiIDogXCIgXCIgKyBzYWZlU3RyaW5naWZ5KGV4dHJhKVxuICB9YDtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gIH0gY2F0Y2gge31cbiAgdHJ5IHtcbiAgICBpcGNSZW5kZXJlci5zZW5kKFwiY29kZXhwcDpwcmVsb2FkLWxvZ1wiLCBcImluZm9cIiwgbXNnKTtcbiAgfSBjYXRjaCB7fVxufVxuZnVuY3Rpb24gc2FmZVN0cmluZ2lmeSh2OiB1bmtub3duKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyB2IDogSlNPTi5zdHJpbmdpZnkodik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBTdHJpbmcodik7XG4gIH1cbn1cblxuZmlsZUxvZyhcInByZWxvYWQgZW50cnlcIiwgeyB1cmw6IGxvY2F0aW9uLmhyZWYgfSk7XG5cbi8vIFJlYWN0IGhvb2sgbXVzdCBiZSBpbnN0YWxsZWQgKmJlZm9yZSogQ29kZXgncyBidW5kbGUgcnVucy5cbnRyeSB7XG4gIGluc3RhbGxSZWFjdEhvb2soKTtcbiAgZmlsZUxvZyhcInJlYWN0IGhvb2sgaW5zdGFsbGVkXCIpO1xufSBjYXRjaCAoZSkge1xuICBmaWxlTG9nKFwicmVhY3QgaG9vayBGQUlMRURcIiwgU3RyaW5nKGUpKTtcbn1cblxucXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBib290LCB7IG9uY2U6IHRydWUgfSk7XG4gIH0gZWxzZSB7XG4gICAgYm9vdCgpO1xuICB9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gYm9vdCgpIHtcbiAgZmlsZUxvZyhcImJvb3Qgc3RhcnRcIiwgeyByZWFkeVN0YXRlOiBkb2N1bWVudC5yZWFkeVN0YXRlIH0pO1xuICB0cnkge1xuICAgIHN0YXJ0U2V0dGluZ3NJbmplY3RvcigpO1xuICAgIGZpbGVMb2coXCJzZXR0aW5ncyBpbmplY3RvciBzdGFydGVkXCIpO1xuICAgIGF3YWl0IHN0YXJ0VHdlYWtIb3N0KCk7XG4gICAgZmlsZUxvZyhcInR3ZWFrIGhvc3Qgc3RhcnRlZFwiKTtcbiAgICBhd2FpdCBtb3VudE1hbmFnZXIoKTtcbiAgICBmaWxlTG9nKFwibWFuYWdlciBtb3VudGVkXCIpO1xuICAgIHN1YnNjcmliZVJlbG9hZCgpO1xuICAgIGZpbGVMb2coXCJib290IGNvbXBsZXRlXCIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZmlsZUxvZyhcImJvb3QgRkFJTEVEXCIsIFN0cmluZygoZSBhcyBFcnJvcik/LnN0YWNrID8/IGUpKTtcbiAgICBjb25zb2xlLmVycm9yKFwiW2NvZGV4LXBsdXNwbHVzXSBwcmVsb2FkIGJvb3QgZmFpbGVkOlwiLCBlKTtcbiAgfVxufVxuXG4vLyBIb3QgcmVsb2FkOiBnYXRlZCBiZWhpbmQgYSBzbWFsbCBpbi1mbGlnaHQgbG9jayBzbyBhIGZsdXJyeSBvZiBmcyBldmVudHNcbi8vIGRvZXNuJ3QgcmVlbnRyYW50bHkgdGVhciBkb3duIHRoZSBob3N0IG1pZC1sb2FkLlxubGV0IHJlbG9hZGluZzogUHJvbWlzZTx2b2lkPiB8IG51bGwgPSBudWxsO1xuZnVuY3Rpb24gc3Vic2NyaWJlUmVsb2FkKCk6IHZvaWQge1xuICBpcGNSZW5kZXJlci5vbihcImNvZGV4cHA6dHdlYWtzLWNoYW5nZWRcIiwgKCkgPT4ge1xuICAgIGlmIChyZWxvYWRpbmcpIHJldHVybjtcbiAgICByZWxvYWRpbmcgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc29sZS5pbmZvKFwiW2NvZGV4LXBsdXNwbHVzXSBob3QtcmVsb2FkaW5nIHR3ZWFrc1wiKTtcbiAgICAgICAgdGVhcmRvd25Ud2Vha0hvc3QoKTtcbiAgICAgICAgYXdhaXQgc3RhcnRUd2Vha0hvc3QoKTtcbiAgICAgICAgYXdhaXQgbW91bnRNYW5hZ2VyKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbY29kZXgtcGx1c3BsdXNdIGhvdCByZWxvYWQgZmFpbGVkOlwiLCBlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHJlbG9hZGluZyA9IG51bGw7XG4gICAgICB9XG4gICAgfSkoKTtcbiAgfSk7XG59XG4iLCAiLyoqXG4gKiBJbnN0YWxsIGEgbWluaW1hbCBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18uIFJlYWN0IGNhbGxzXG4gKiBgaG9vay5pbmplY3QocmVuZGVyZXJJbnRlcm5hbHMpYCBkdXJpbmcgYGNyZWF0ZVJvb3RgL2BoeWRyYXRlUm9vdGAuIFRoZVxuICogXCJpbnRlcm5hbHNcIiBvYmplY3QgZXhwb3NlcyBmaW5kRmliZXJCeUhvc3RJbnN0YW5jZSwgd2hpY2ggbGV0cyB1cyB0dXJuIGFcbiAqIERPTSBub2RlIGludG8gYSBSZWFjdCBmaWJlciBcdTIwMTQgbmVjZXNzYXJ5IGZvciBvdXIgU2V0dGluZ3MgaW5qZWN0b3IuXG4gKlxuICogV2UgZG9uJ3Qgd2FudCB0byBicmVhayByZWFsIFJlYWN0IERldlRvb2xzIGlmIHRoZSB1c2VyIG9wZW5zIGl0OyB3ZSBpbnN0YWxsXG4gKiBvbmx5IGlmIG5vIGhvb2sgZXhpc3RzIHlldCwgYW5kIHdlIGZvcndhcmQgY2FsbHMgdG8gYSBkb3duc3RyZWFtIGhvb2sgaWZcbiAqIG9uZSBpcyBsYXRlciBhc3NpZ25lZC5cbiAqL1xuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18/OiBSZWFjdERldnRvb2xzSG9vaztcbiAgICBfX2NvZGV4cHBfXz86IHtcbiAgICAgIGhvb2s6IFJlYWN0RGV2dG9vbHNIb29rO1xuICAgICAgcmVuZGVyZXJzOiBNYXA8bnVtYmVyLCBSZW5kZXJlckludGVybmFscz47XG4gICAgfTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgUmVuZGVyZXJJbnRlcm5hbHMge1xuICBmaW5kRmliZXJCeUhvc3RJbnN0YW5jZT86IChuOiBOb2RlKSA9PiB1bmtub3duO1xuICB2ZXJzaW9uPzogc3RyaW5nO1xuICBidW5kbGVUeXBlPzogbnVtYmVyO1xuICByZW5kZXJlclBhY2thZ2VOYW1lPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUmVhY3REZXZ0b29sc0hvb2sge1xuICBzdXBwb3J0c0ZpYmVyOiB0cnVlO1xuICByZW5kZXJlcnM6IE1hcDxudW1iZXIsIFJlbmRlcmVySW50ZXJuYWxzPjtcbiAgb24oZXZlbnQ6IHN0cmluZywgZm46ICguLi5hOiB1bmtub3duW10pID0+IHZvaWQpOiB2b2lkO1xuICBvZmYoZXZlbnQ6IHN0cmluZywgZm46ICguLi5hOiB1bmtub3duW10pID0+IHZvaWQpOiB2b2lkO1xuICBlbWl0KGV2ZW50OiBzdHJpbmcsIC4uLmE6IHVua25vd25bXSk6IHZvaWQ7XG4gIGluamVjdChyZW5kZXJlcjogUmVuZGVyZXJJbnRlcm5hbHMpOiBudW1iZXI7XG4gIG9uU2NoZWR1bGVGaWJlclJvb3Q/KCk6IHZvaWQ7XG4gIG9uQ29tbWl0RmliZXJSb290PygpOiB2b2lkO1xuICBvbkNvbW1pdEZpYmVyVW5tb3VudD8oKTogdm9pZDtcbiAgY2hlY2tEQ0U/KCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnN0YWxsUmVhY3RIb29rKCk6IHZvaWQge1xuICBpZiAod2luZG93Ll9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXykgcmV0dXJuO1xuICBjb25zdCByZW5kZXJlcnMgPSBuZXcgTWFwPG51bWJlciwgUmVuZGVyZXJJbnRlcm5hbHM+KCk7XG4gIGxldCBuZXh0SWQgPSAxO1xuICBjb25zdCBsaXN0ZW5lcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PCguLi5hOiB1bmtub3duW10pID0+IHZvaWQ+PigpO1xuXG4gIGNvbnN0IGhvb2s6IFJlYWN0RGV2dG9vbHNIb29rID0ge1xuICAgIHN1cHBvcnRzRmliZXI6IHRydWUsXG4gICAgcmVuZGVyZXJzLFxuICAgIGluamVjdChyZW5kZXJlcikge1xuICAgICAgY29uc3QgaWQgPSBuZXh0SWQrKztcbiAgICAgIHJlbmRlcmVycy5zZXQoaWQsIHJlbmRlcmVyKTtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLmRlYnVnKFxuICAgICAgICBcIltjb2RleC1wbHVzcGx1c10gUmVhY3QgcmVuZGVyZXIgYXR0YWNoZWQ6XCIsXG4gICAgICAgIHJlbmRlcmVyLnJlbmRlcmVyUGFja2FnZU5hbWUsXG4gICAgICAgIHJlbmRlcmVyLnZlcnNpb24sXG4gICAgICApO1xuICAgICAgcmV0dXJuIGlkO1xuICAgIH0sXG4gICAgb24oZXZlbnQsIGZuKSB7XG4gICAgICBsZXQgcyA9IGxpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgaWYgKCFzKSBsaXN0ZW5lcnMuc2V0KGV2ZW50LCAocyA9IG5ldyBTZXQoKSkpO1xuICAgICAgcy5hZGQoZm4pO1xuICAgIH0sXG4gICAgb2ZmKGV2ZW50LCBmbikge1xuICAgICAgbGlzdGVuZXJzLmdldChldmVudCk/LmRlbGV0ZShmbik7XG4gICAgfSxcbiAgICBlbWl0KGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBsaXN0ZW5lcnMuZ2V0KGV2ZW50KT8uZm9yRWFjaCgoZm4pID0+IGZuKC4uLmFyZ3MpKTtcbiAgICB9LFxuICAgIG9uQ29tbWl0RmliZXJSb290KCkge30sXG4gICAgb25Db21taXRGaWJlclVubW91bnQoKSB7fSxcbiAgICBvblNjaGVkdWxlRmliZXJSb290KCkge30sXG4gICAgY2hlY2tEQ0UoKSB7fSxcbiAgfTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCBcIl9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfX1wiLCB7XG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIHdyaXRhYmxlOiB0cnVlLCAvLyBhbGxvdyByZWFsIERldlRvb2xzIHRvIG92ZXJ3cml0ZSBpZiB1c2VyIGluc3RhbGxzIGl0XG4gICAgdmFsdWU6IGhvb2ssXG4gIH0pO1xuXG4gIHdpbmRvdy5fX2NvZGV4cHBfXyA9IHsgaG9vaywgcmVuZGVyZXJzIH07XG59XG5cbi8qKiBSZXNvbHZlIHRoZSBSZWFjdCBmaWJlciBmb3IgYSBET00gbm9kZSwgaWYgYW55IHJlbmRlcmVyIGhhcyBvbmUuICovXG5leHBvcnQgZnVuY3Rpb24gZmliZXJGb3JOb2RlKG5vZGU6IE5vZGUpOiB1bmtub3duIHwgbnVsbCB7XG4gIGNvbnN0IHJlbmRlcmVycyA9IHdpbmRvdy5fX2NvZGV4cHBfXz8ucmVuZGVyZXJzO1xuICBpZiAocmVuZGVyZXJzKSB7XG4gICAgZm9yIChjb25zdCByIG9mIHJlbmRlcmVycy52YWx1ZXMoKSkge1xuICAgICAgY29uc3QgZiA9IHIuZmluZEZpYmVyQnlIb3N0SW5zdGFuY2U/Lihub2RlKTtcbiAgICAgIGlmIChmKSByZXR1cm4gZjtcbiAgICB9XG4gIH1cbiAgLy8gRmFsbGJhY2s6IHJlYWQgdGhlIFJlYWN0IGludGVybmFsIHByb3BlcnR5IGRpcmVjdGx5IGZyb20gdGhlIERPTSBub2RlLlxuICAvLyBSZWFjdCBzdG9yZXMgZmliZXJzIGFzIGEgcHJvcGVydHkgd2hvc2Uga2V5IHN0YXJ0cyB3aXRoIFwiX19yZWFjdEZpYmVyXCIuXG4gIGZvciAoY29uc3QgayBvZiBPYmplY3Qua2V5cyhub2RlKSkge1xuICAgIGlmIChrLnN0YXJ0c1dpdGgoXCJfX3JlYWN0RmliZXJcIikpIHJldHVybiAobm9kZSBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrXTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbiIsICIvKipcbiAqIFNldHRpbmdzIGluamVjdG9yIGZvciBDb2RleCdzIFNldHRpbmdzIHBhZ2UuXG4gKlxuICogQ29kZXgncyBzZXR0aW5ncyBpcyBhIHJvdXRlZCBwYWdlIChVUkwgc3RheXMgYXQgYC9pbmRleC5odG1sP2hvc3RJZD1sb2NhbGApXG4gKiBOT1QgYSBtb2RhbCBkaWFsb2cuIFRoZSBzaWRlYmFyIGxpdmVzIGluc2lkZSBhIGA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbFxuICogZ2FwLTEgZ2FwLTBcIj5gIHdyYXBwZXIgdGhhdCBob2xkcyBvbmUgb3IgbW9yZSBgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2xcbiAqIGdhcC1weFwiPmAgZ3JvdXBzIG9mIGJ1dHRvbnMuIFRoZXJlIGFyZSBubyBzdGFibGUgYHJvbGVgIC8gYGFyaWEtbGFiZWxgIC9cbiAqIGBkYXRhLXRlc3RpZGAgaG9va3Mgb24gdGhlIHNoZWxsIHNvIHdlIGlkZW50aWZ5IHRoZSBzaWRlYmFyIGJ5IHRleHQtY29udGVudFxuICogbWF0Y2ggYWdhaW5zdCBrbm93biBpdGVtIGxhYmVscyAoR2VuZXJhbCwgQXBwZWFyYW5jZSwgQ29uZmlndXJhdGlvbiwgXHUyMDI2KS5cbiAqXG4gKiBMYXlvdXQgd2UgaW5qZWN0OlxuICpcbiAqICAgR0VORVJBTCAgICAgICAgICAgICAgICAgICAgICAgKHVwcGVyY2FzZSBncm91cCBsYWJlbClcbiAqICAgW0NvZGV4J3MgZXhpc3RpbmcgaXRlbXMgZ3JvdXBdXG4gKiAgIENPREVYKysgICAgICAgICAgICAgICAgICAgICAgICh1cHBlcmNhc2UgZ3JvdXAgbGFiZWwpXG4gKiAgIFx1MjREOCBDb25maWdcbiAqICAgXHUyNjMwIFR3ZWFrc1xuICogICBcdTI1QzcgVHdlYWsgU3RvcmVcbiAqXG4gKiBDbGlja2luZyBDb25maWcgLyBUd2Vha3MgLyBUd2VhayBTdG9yZSBoaWRlcyBDb2RleCdzIGNvbnRlbnQgcGFuZWwgY2hpbGRyZW4gYW5kIHJlbmRlcnNcbiAqIG91ciBvd24gYG1haW4tc3VyZmFjZWAgcGFuZWwgaW4gdGhlaXIgcGxhY2UuIENsaWNraW5nIGFueSBvZiBDb2RleCdzXG4gKiBzaWRlYmFyIGl0ZW1zIHJlc3RvcmVzIHRoZSBvcmlnaW5hbCB2aWV3LlxuICovXG5cbmltcG9ydCB7IGlwY1JlbmRlcmVyIH0gZnJvbSBcImVsZWN0cm9uXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFNldHRpbmdzU2VjdGlvbixcbiAgU2V0dGluZ3NQYWdlLFxuICBTZXR0aW5nc0hhbmRsZSxcbiAgVHdlYWtNYW5pZmVzdCxcbn0gZnJvbSBcIkBjb2RleC1wbHVzcGx1cy9zZGtcIjtcbmltcG9ydCB7XG4gIGJ1aWxkVHdlYWtQdWJsaXNoSXNzdWVVcmwsXG4gIHR5cGUgVHdlYWtTdG9yZUVudHJ5LFxuICB0eXBlIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbixcbn0gZnJvbSBcIi4uL3R3ZWFrLXN0b3JlXCI7XG5cbi8vIE1pcnJvcnMgdGhlIHJ1bnRpbWUncyBtYWluLXNpZGUgTGlzdGVkVHdlYWsgc2hhcGUgKGtlcHQgaW4gc3luYyBtYW51YWxseSkuXG5pbnRlcmZhY2UgTGlzdGVkVHdlYWsge1xuICBtYW5pZmVzdDogVHdlYWtNYW5pZmVzdDtcbiAgZW50cnk6IHN0cmluZztcbiAgZGlyOiBzdHJpbmc7XG4gIGVudHJ5RXhpc3RzOiBib29sZWFuO1xuICBlbmFibGVkOiBib29sZWFuO1xuICB1cGRhdGU6IFR3ZWFrVXBkYXRlQ2hlY2sgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVHdlYWtVcGRhdGVDaGVjayB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICByZXBvOiBzdHJpbmc7XG4gIGN1cnJlbnRWZXJzaW9uOiBzdHJpbmc7XG4gIGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gIGxhdGVzdFRhZzogc3RyaW5nIHwgbnVsbDtcbiAgcmVsZWFzZVVybDogc3RyaW5nIHwgbnVsbDtcbiAgdXBkYXRlQXZhaWxhYmxlOiBib29sZWFuO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIENvZGV4UGx1c1BsdXNDb25maWcge1xuICB2ZXJzaW9uOiBzdHJpbmc7XG4gIGF1dG9VcGRhdGU6IGJvb2xlYW47XG4gIHVwZGF0ZUNoYW5uZWw6IFNlbGZVcGRhdGVDaGFubmVsO1xuICB1cGRhdGVSZXBvOiBzdHJpbmc7XG4gIHVwZGF0ZVJlZjogc3RyaW5nO1xuICB1cGRhdGVDaGVjazogQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrIHwgbnVsbDtcbiAgc2VsZlVwZGF0ZTogU2VsZlVwZGF0ZVN0YXRlIHwgbnVsbDtcbiAgaW5zdGFsbGF0aW9uU291cmNlOiBJbnN0YWxsYXRpb25Tb3VyY2U7XG59XG5cbmludGVyZmFjZSBDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2sge1xuICBjaGVja2VkQXQ6IHN0cmluZztcbiAgY3VycmVudFZlcnNpb246IHN0cmluZztcbiAgbGF0ZXN0VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgcmVsZWFzZVVybDogc3RyaW5nIHwgbnVsbDtcbiAgcmVsZWFzZU5vdGVzOiBzdHJpbmcgfCBudWxsO1xuICB1cGRhdGVBdmFpbGFibGU6IGJvb2xlYW47XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG50eXBlIFNlbGZVcGRhdGVDaGFubmVsID0gXCJzdGFibGVcIiB8IFwicHJlcmVsZWFzZVwiIHwgXCJjdXN0b21cIjtcbnR5cGUgU2VsZlVwZGF0ZVN0YXR1cyA9IFwiY2hlY2tpbmdcIiB8IFwidXAtdG8tZGF0ZVwiIHwgXCJ1cGRhdGVkXCIgfCBcImZhaWxlZFwiIHwgXCJkaXNhYmxlZFwiO1xuXG5pbnRlcmZhY2UgU2VsZlVwZGF0ZVN0YXRlIHtcbiAgY2hlY2tlZEF0OiBzdHJpbmc7XG4gIGNvbXBsZXRlZEF0Pzogc3RyaW5nO1xuICBzdGF0dXM6IFNlbGZVcGRhdGVTdGF0dXM7XG4gIGN1cnJlbnRWZXJzaW9uOiBzdHJpbmc7XG4gIGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gIHRhcmdldFJlZjogc3RyaW5nIHwgbnVsbDtcbiAgcmVsZWFzZVVybDogc3RyaW5nIHwgbnVsbDtcbiAgcmVwbzogc3RyaW5nO1xuICBjaGFubmVsOiBTZWxmVXBkYXRlQ2hhbm5lbDtcbiAgc291cmNlUm9vdDogc3RyaW5nO1xuICBpbnN0YWxsYXRpb25Tb3VyY2U/OiBJbnN0YWxsYXRpb25Tb3VyY2U7XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSW5zdGFsbGF0aW9uU291cmNlIHtcbiAga2luZDogXCJnaXRodWItc291cmNlXCIgfCBcImhvbWVicmV3XCIgfCBcImxvY2FsLWRldlwiIHwgXCJzb3VyY2UtYXJjaGl2ZVwiIHwgXCJ1bmtub3duXCI7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGRldGFpbDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgV2F0Y2hlckhlYWx0aCB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBzdGF0dXM6IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiO1xuICB0aXRsZTogc3RyaW5nO1xuICBzdW1tYXJ5OiBzdHJpbmc7XG4gIHdhdGNoZXI6IHN0cmluZztcbiAgY2hlY2tzOiBXYXRjaGVySGVhbHRoQ2hlY2tbXTtcbn1cblxuaW50ZXJmYWNlIFdhdGNoZXJIZWFsdGhDaGVjayB7XG4gIG5hbWU6IHN0cmluZztcbiAgc3RhdHVzOiBcIm9rXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIjtcbiAgZGV0YWlsOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBUd2Vha1N0b3JlUmVnaXN0cnlWaWV3IHtcbiAgc2NoZW1hVmVyc2lvbjogMTtcbiAgZ2VuZXJhdGVkQXQ/OiBzdHJpbmc7XG4gIHNvdXJjZVVybDogc3RyaW5nO1xuICBmZXRjaGVkQXQ6IHN0cmluZztcbiAgZW50cmllczogVHdlYWtTdG9yZUVudHJ5Vmlld1tdO1xufVxuXG5pbnRlcmZhY2UgVHdlYWtTdG9yZUVudHJ5VmlldyBleHRlbmRzIFR3ZWFrU3RvcmVFbnRyeSB7XG4gIGluc3RhbGxlZDoge1xuICAgIHZlcnNpb246IHN0cmluZztcbiAgICBlbmFibGVkOiBib29sZWFuO1xuICB9IHwgbnVsbDtcbn1cblxuLyoqXG4gKiBBIHR3ZWFrLXJlZ2lzdGVyZWQgcGFnZS4gV2UgY2FycnkgdGhlIG93bmluZyB0d2VhaydzIG1hbmlmZXN0IHNvIHdlIGNhblxuICogcmVzb2x2ZSByZWxhdGl2ZSBpY29uVXJscyBhbmQgc2hvdyBhdXRob3JzaGlwIGluIHRoZSBwYWdlIGhlYWRlci5cbiAqL1xuaW50ZXJmYWNlIFJlZ2lzdGVyZWRQYWdlIHtcbiAgLyoqIEZ1bGx5LXF1YWxpZmllZCBpZDogYDx0d2Vha0lkPjo8cGFnZUlkPmAuICovXG4gIGlkOiBzdHJpbmc7XG4gIHR3ZWFrSWQ6IHN0cmluZztcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG4gIHBhZ2U6IFNldHRpbmdzUGFnZTtcbiAgLyoqIFBlci1wYWdlIERPTSB0ZWFyZG93biByZXR1cm5lZCBieSBgcGFnZS5yZW5kZXJgLCBpZiBhbnkuICovXG4gIHRlYXJkb3duPzogKCgpID0+IHZvaWQpIHwgbnVsbDtcbiAgLyoqIFRoZSBpbmplY3RlZCBzaWRlYmFyIGJ1dHRvbiAoc28gd2UgY2FuIHVwZGF0ZSBpdHMgYWN0aXZlIHN0YXRlKS4gKi9cbiAgbmF2QnV0dG9uPzogSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xufVxuXG4vKiogV2hhdCBwYWdlIGlzIGN1cnJlbnRseSBzZWxlY3RlZCBpbiBvdXIgaW5qZWN0ZWQgbmF2LiAqL1xudHlwZSBBY3RpdmVQYWdlID1cbiAgfCB7IGtpbmQ6IFwiY29uZmlnXCIgfVxuICB8IHsga2luZDogXCJzdG9yZVwiIH1cbiAgfCB7IGtpbmQ6IFwidHdlYWtzXCIgfVxuICB8IHsga2luZDogXCJyZWdpc3RlcmVkXCI7IGlkOiBzdHJpbmcgfTtcblxuaW50ZXJmYWNlIEluamVjdG9yU3RhdGUge1xuICBzZWN0aW9uczogTWFwPHN0cmluZywgU2V0dGluZ3NTZWN0aW9uPjtcbiAgcGFnZXM6IE1hcDxzdHJpbmcsIFJlZ2lzdGVyZWRQYWdlPjtcbiAgbGlzdGVkVHdlYWtzOiBMaXN0ZWRUd2Vha1tdO1xuICAvKiogT3V0ZXIgd3JhcHBlciB0aGF0IGhvbGRzIENvZGV4J3MgaXRlbXMgZ3JvdXAgKyBvdXIgaW5qZWN0ZWQgZ3JvdXBzLiAqL1xuICBvdXRlcldyYXBwZXI6IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgLyoqIE91ciBcIkdlbmVyYWxcIiBsYWJlbCBmb3IgQ29kZXgncyBuYXRpdmUgc2V0dGluZ3MgZ3JvdXAuICovXG4gIG5hdGl2ZU5hdkhlYWRlcjogSFRNTEVsZW1lbnQgfCBudWxsO1xuICAvKiogT3VyIFwiQ29kZXgrK1wiIG5hdiBncm91cCAoQ29uZmlnL1R3ZWFrcykuICovXG4gIG5hdkdyb3VwOiBIVE1MRWxlbWVudCB8IG51bGw7XG4gIG5hdkJ1dHRvbnM6IHsgY29uZmlnOiBIVE1MQnV0dG9uRWxlbWVudDsgdHdlYWtzOiBIVE1MQnV0dG9uRWxlbWVudDsgc3RvcmU6IEhUTUxCdXR0b25FbGVtZW50IH0gfCBudWxsO1xuICAvKiogT3VyIFwiVHdlYWtzXCIgbmF2IGdyb3VwIChwZXItdHdlYWsgcGFnZXMpLiBDcmVhdGVkIGxhemlseS4gKi9cbiAgcGFnZXNHcm91cDogSFRNTEVsZW1lbnQgfCBudWxsO1xuICBwYWdlc0dyb3VwS2V5OiBzdHJpbmcgfCBudWxsO1xuICBwYW5lbEhvc3Q6IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgb2JzZXJ2ZXI6IE11dGF0aW9uT2JzZXJ2ZXIgfCBudWxsO1xuICBmaW5nZXJwcmludDogc3RyaW5nIHwgbnVsbDtcbiAgc2lkZWJhckR1bXBlZDogYm9vbGVhbjtcbiAgYWN0aXZlUGFnZTogQWN0aXZlUGFnZSB8IG51bGw7XG4gIHNpZGViYXJSb290OiBIVE1MRWxlbWVudCB8IG51bGw7XG4gIHNpZGViYXJSZXN0b3JlSGFuZGxlcjogKChlOiBFdmVudCkgPT4gdm9pZCkgfCBudWxsO1xuICBzZXR0aW5nc1N1cmZhY2VWaXNpYmxlOiBib29sZWFuO1xuICBzZXR0aW5nc1N1cmZhY2VIaWRlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbDtcbn1cblxuY29uc3Qgc3RhdGU6IEluamVjdG9yU3RhdGUgPSB7XG4gIHNlY3Rpb25zOiBuZXcgTWFwKCksXG4gIHBhZ2VzOiBuZXcgTWFwKCksXG4gIGxpc3RlZFR3ZWFrczogW10sXG4gIG91dGVyV3JhcHBlcjogbnVsbCxcbiAgbmF0aXZlTmF2SGVhZGVyOiBudWxsLFxuICBuYXZHcm91cDogbnVsbCxcbiAgbmF2QnV0dG9uczogbnVsbCxcbiAgcGFnZXNHcm91cDogbnVsbCxcbiAgcGFnZXNHcm91cEtleTogbnVsbCxcbiAgcGFuZWxIb3N0OiBudWxsLFxuICBvYnNlcnZlcjogbnVsbCxcbiAgZmluZ2VycHJpbnQ6IG51bGwsXG4gIHNpZGViYXJEdW1wZWQ6IGZhbHNlLFxuICBhY3RpdmVQYWdlOiBudWxsLFxuICBzaWRlYmFyUm9vdDogbnVsbCxcbiAgc2lkZWJhclJlc3RvcmVIYW5kbGVyOiBudWxsLFxuICBzZXR0aW5nc1N1cmZhY2VWaXNpYmxlOiBmYWxzZSxcbiAgc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyOiBudWxsLFxufTtcblxuZnVuY3Rpb24gcGxvZyhtc2c6IHN0cmluZywgZXh0cmE/OiB1bmtub3duKTogdm9pZCB7XG4gIGlwY1JlbmRlcmVyLnNlbmQoXG4gICAgXCJjb2RleHBwOnByZWxvYWQtbG9nXCIsXG4gICAgXCJpbmZvXCIsXG4gICAgYFtzZXR0aW5ncy1pbmplY3Rvcl0gJHttc2d9JHtleHRyYSA9PT0gdW5kZWZpbmVkID8gXCJcIiA6IFwiIFwiICsgc2FmZVN0cmluZ2lmeShleHRyYSl9YCxcbiAgKTtcbn1cbmZ1bmN0aW9uIHNhZmVTdHJpbmdpZnkodjogdW5rbm93bik6IHN0cmluZyB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gdiA6IEpTT04uc3RyaW5naWZ5KHYpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gU3RyaW5nKHYpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCBwdWJsaWMgQVBJIFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gc3RhcnRTZXR0aW5nc0luamVjdG9yKCk6IHZvaWQge1xuICBpZiAoc3RhdGUub2JzZXJ2ZXIpIHJldHVybjtcblxuICBjb25zdCBvYnMgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgdHJ5SW5qZWN0KCk7XG4gICAgbWF5YmVEdW1wRG9tKCk7XG4gIH0pO1xuICBvYnMub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICBzdGF0ZS5vYnNlcnZlciA9IG9icztcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInBvcHN0YXRlXCIsIG9uTmF2KTtcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJoYXNoY2hhbmdlXCIsIG9uTmF2KTtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIG9uRG9jdW1lbnRDbGljaywgdHJ1ZSk7XG4gIGZvciAoY29uc3QgbSBvZiBbXCJwdXNoU3RhdGVcIiwgXCJyZXBsYWNlU3RhdGVcIl0gYXMgY29uc3QpIHtcbiAgICBjb25zdCBvcmlnID0gaGlzdG9yeVttXTtcbiAgICBoaXN0b3J5W21dID0gZnVuY3Rpb24gKHRoaXM6IEhpc3RvcnksIC4uLmFyZ3M6IFBhcmFtZXRlcnM8dHlwZW9mIG9yaWc+KSB7XG4gICAgICBjb25zdCByID0gb3JpZy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudChgY29kZXhwcC0ke219YCkpO1xuICAgICAgcmV0dXJuIHI7XG4gICAgfSBhcyB0eXBlb2Ygb3JpZztcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihgY29kZXhwcC0ke219YCwgb25OYXYpO1xuICB9XG5cbiAgdHJ5SW5qZWN0KCk7XG4gIG1heWJlRHVtcERvbSgpO1xuICBsZXQgdGlja3MgPSAwO1xuICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICB0aWNrcysrO1xuICAgIHRyeUluamVjdCgpO1xuICAgIG1heWJlRHVtcERvbSgpO1xuICAgIGlmICh0aWNrcyA+IDYwKSBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgfSwgNTAwKTtcbn1cblxuZnVuY3Rpb24gb25OYXYoKTogdm9pZCB7XG4gIHN0YXRlLmZpbmdlcnByaW50ID0gbnVsbDtcbiAgdHJ5SW5qZWN0KCk7XG4gIG1heWJlRHVtcERvbSgpO1xufVxuXG5mdW5jdGlvbiBvbkRvY3VtZW50Q2xpY2soZTogTW91c2VFdmVudCk6IHZvaWQge1xuICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQgPyBlLnRhcmdldCA6IG51bGw7XG4gIGNvbnN0IGNvbnRyb2wgPSB0YXJnZXQ/LmNsb3Nlc3QoXCJbcm9sZT0nbGluayddLGJ1dHRvbixhXCIpO1xuICBpZiAoIShjb250cm9sIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSByZXR1cm47XG4gIGlmIChjb21wYWN0U2V0dGluZ3NUZXh0KGNvbnRyb2wudGV4dENvbnRlbnQgfHwgXCJcIikgIT09IFwiQmFjayB0byBhcHBcIikgcmV0dXJuO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBzZXRTZXR0aW5nc1N1cmZhY2VWaXNpYmxlKGZhbHNlLCBcImJhY2stdG8tYXBwXCIpO1xuICB9LCAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyU2VjdGlvbihzZWN0aW9uOiBTZXR0aW5nc1NlY3Rpb24pOiBTZXR0aW5nc0hhbmRsZSB7XG4gIHN0YXRlLnNlY3Rpb25zLnNldChzZWN0aW9uLmlkLCBzZWN0aW9uKTtcbiAgaWYgKHN0YXRlLmFjdGl2ZVBhZ2U/LmtpbmQgPT09IFwidHdlYWtzXCIpIHJlcmVuZGVyKCk7XG4gIHJldHVybiB7XG4gICAgdW5yZWdpc3RlcjogKCkgPT4ge1xuICAgICAgc3RhdGUuc2VjdGlvbnMuZGVsZXRlKHNlY3Rpb24uaWQpO1xuICAgICAgaWYgKHN0YXRlLmFjdGl2ZVBhZ2U/LmtpbmQgPT09IFwidHdlYWtzXCIpIHJlcmVuZGVyKCk7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyU2VjdGlvbnMoKTogdm9pZCB7XG4gIHN0YXRlLnNlY3Rpb25zLmNsZWFyKCk7XG4gIC8vIERyb3AgcmVnaXN0ZXJlZCBwYWdlcyB0b28gXHUyMDE0IHRoZXkncmUgb3duZWQgYnkgdHdlYWtzIHRoYXQganVzdCBnb3RcbiAgLy8gdG9ybiBkb3duIGJ5IHRoZSBob3N0LiBSdW4gYW55IHRlYXJkb3ducyBiZWZvcmUgZm9yZ2V0dGluZyB0aGVtLlxuICBmb3IgKGNvbnN0IHAgb2Ygc3RhdGUucGFnZXMudmFsdWVzKCkpIHtcbiAgICB0cnkge1xuICAgICAgcC50ZWFyZG93bj8uKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcGxvZyhcInBhZ2UgdGVhcmRvd24gZmFpbGVkXCIsIHsgaWQ6IHAuaWQsIGVycjogU3RyaW5nKGUpIH0pO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5wYWdlcy5jbGVhcigpO1xuICBzeW5jUGFnZXNHcm91cCgpO1xuICAvLyBJZiB3ZSB3ZXJlIG9uIGEgcmVnaXN0ZXJlZCBwYWdlIHRoYXQgbm8gbG9uZ2VyIGV4aXN0cywgZmFsbCBiYWNrIHRvXG4gIC8vIHJlc3RvcmluZyBDb2RleCdzIHZpZXcuXG4gIGlmIChcbiAgICBzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInJlZ2lzdGVyZWRcIiAmJlxuICAgICFzdGF0ZS5wYWdlcy5oYXMoc3RhdGUuYWN0aXZlUGFnZS5pZClcbiAgKSB7XG4gICAgcmVzdG9yZUNvZGV4VmlldygpO1xuICB9IGVsc2UgaWYgKHN0YXRlLmFjdGl2ZVBhZ2U/LmtpbmQgPT09IFwidHdlYWtzXCIpIHtcbiAgICByZXJlbmRlcigpO1xuICB9XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSB0d2Vhay1vd25lZCBzZXR0aW5ncyBwYWdlLiBUaGUgcnVudGltZSBpbmplY3RzIGEgc2lkZWJhciBlbnRyeVxuICogdW5kZXIgYSBcIlRXRUFLU1wiIGdyb3VwIGhlYWRlciAod2hpY2ggYXBwZWFycyBvbmx5IHdoZW4gYXQgbGVhc3Qgb25lIHBhZ2VcbiAqIGlzIHJlZ2lzdGVyZWQpIGFuZCByb3V0ZXMgY2xpY2tzIHRvIHRoZSBwYWdlJ3MgYHJlbmRlcihyb290KWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclBhZ2UoXG4gIHR3ZWFrSWQ6IHN0cmluZyxcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3QsXG4gIHBhZ2U6IFNldHRpbmdzUGFnZSxcbik6IFNldHRpbmdzSGFuZGxlIHtcbiAgY29uc3QgaWQgPSBwYWdlLmlkOyAvLyBhbHJlYWR5IG5hbWVzcGFjZWQgYnkgdHdlYWstaG9zdCBhcyBgJHt0d2Vha0lkfToke3BhZ2UuaWR9YFxuICBjb25zdCBlbnRyeTogUmVnaXN0ZXJlZFBhZ2UgPSB7IGlkLCB0d2Vha0lkLCBtYW5pZmVzdCwgcGFnZSB9O1xuICBzdGF0ZS5wYWdlcy5zZXQoaWQsIGVudHJ5KTtcbiAgcGxvZyhcInJlZ2lzdGVyUGFnZVwiLCB7IGlkLCB0aXRsZTogcGFnZS50aXRsZSwgdHdlYWtJZCB9KTtcbiAgc3luY1BhZ2VzR3JvdXAoKTtcbiAgLy8gSWYgdGhlIHVzZXIgd2FzIGFscmVhZHkgb24gdGhpcyBwYWdlIChob3QgcmVsb2FkKSwgcmUtbW91bnQgaXRzIGJvZHkuXG4gIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInJlZ2lzdGVyZWRcIiAmJiBzdGF0ZS5hY3RpdmVQYWdlLmlkID09PSBpZCkge1xuICAgIHJlcmVuZGVyKCk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB1bnJlZ2lzdGVyOiAoKSA9PiB7XG4gICAgICBjb25zdCBlID0gc3RhdGUucGFnZXMuZ2V0KGlkKTtcbiAgICAgIGlmICghZSkgcmV0dXJuO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZS50ZWFyZG93bj8uKCk7XG4gICAgICB9IGNhdGNoIHt9XG4gICAgICBzdGF0ZS5wYWdlcy5kZWxldGUoaWQpO1xuICAgICAgc3luY1BhZ2VzR3JvdXAoKTtcbiAgICAgIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInJlZ2lzdGVyZWRcIiAmJiBzdGF0ZS5hY3RpdmVQYWdlLmlkID09PSBpZCkge1xuICAgICAgICByZXN0b3JlQ29kZXhWaWV3KCk7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cblxuLyoqIENhbGxlZCBieSB0aGUgdHdlYWsgaG9zdCBhZnRlciBmZXRjaGluZyB0aGUgdHdlYWsgbGlzdCBmcm9tIG1haW4uICovXG5leHBvcnQgZnVuY3Rpb24gc2V0TGlzdGVkVHdlYWtzKGxpc3Q6IExpc3RlZFR3ZWFrW10pOiB2b2lkIHtcbiAgc3RhdGUubGlzdGVkVHdlYWtzID0gbGlzdDtcbiAgaWYgKHN0YXRlLmFjdGl2ZVBhZ2U/LmtpbmQgPT09IFwidHdlYWtzXCIpIHJlcmVuZGVyKCk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCBpbmplY3Rpb24gXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHRyeUluamVjdCgpOiB2b2lkIHtcbiAgY29uc3QgaXRlbXNHcm91cCA9IGZpbmRTaWRlYmFySXRlbXNHcm91cCgpO1xuICBpZiAoIWl0ZW1zR3JvdXApIHtcbiAgICBzY2hlZHVsZVNldHRpbmdzU3VyZmFjZUhpZGRlbigpO1xuICAgIHBsb2coXCJzaWRlYmFyIG5vdCBmb3VuZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHN0YXRlLnNldHRpbmdzU3VyZmFjZUhpZGVUaW1lcikge1xuICAgIGNsZWFyVGltZW91dChzdGF0ZS5zZXR0aW5nc1N1cmZhY2VIaWRlVGltZXIpO1xuICAgIHN0YXRlLnNldHRpbmdzU3VyZmFjZUhpZGVUaW1lciA9IG51bGw7XG4gIH1cbiAgc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZSh0cnVlLCBcInNpZGViYXItZm91bmRcIik7XG4gIC8vIENvZGV4J3MgaXRlbXMgZ3JvdXAgbGl2ZXMgaW5zaWRlIGFuIG91dGVyIHdyYXBwZXIgdGhhdCdzIGFscmVhZHkgc3R5bGVkXG4gIC8vIHRvIGhvbGQgbXVsdGlwbGUgZ3JvdXBzIChgZmxleCBmbGV4LWNvbCBnYXAtMSBnYXAtMGApLiBXZSBpbmplY3Qgb3VyXG4gIC8vIGdyb3VwIGFzIGEgc2libGluZyBzbyB0aGUgbmF0dXJhbCBnYXAtMSBhY3RzIGFzIG91ciB2aXN1YWwgc2VwYXJhdG9yLlxuICBjb25zdCBvdXRlciA9IGl0ZW1zR3JvdXAucGFyZW50RWxlbWVudCA/PyBpdGVtc0dyb3VwO1xuICBzdGF0ZS5zaWRlYmFyUm9vdCA9IG91dGVyO1xuICBzeW5jTmF0aXZlU2V0dGluZ3NIZWFkZXIoaXRlbXNHcm91cCwgb3V0ZXIpO1xuXG4gIGlmIChzdGF0ZS5uYXZHcm91cCAmJiBvdXRlci5jb250YWlucyhzdGF0ZS5uYXZHcm91cCkpIHtcbiAgICBzeW5jUGFnZXNHcm91cCgpO1xuICAgIC8vIENvZGV4IHJlLXJlbmRlcnMgaXRzIG5hdGl2ZSBzaWRlYmFyIGJ1dHRvbnMgb24gaXRzIG93biBzdGF0ZSBjaGFuZ2VzLlxuICAgIC8vIElmIG9uZSBvZiBvdXIgcGFnZXMgaXMgYWN0aXZlLCByZS1zdHJpcCBDb2RleCdzIGFjdGl2ZSBzdHlsaW5nIHNvXG4gICAgLy8gR2VuZXJhbCBkb2Vzbid0IHJlYXBwZWFyIGFzIHNlbGVjdGVkLlxuICAgIGlmIChzdGF0ZS5hY3RpdmVQYWdlICE9PSBudWxsKSBzeW5jQ29kZXhOYXRpdmVOYXZBY3RpdmUodHJ1ZSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gU2lkZWJhciB3YXMgZWl0aGVyIGZyZXNobHkgbW91bnRlZCAoU2V0dGluZ3MganVzdCBvcGVuZWQpIG9yIHJlLW1vdW50ZWRcbiAgLy8gKGNsb3NlZCBhbmQgcmUtb3BlbmVkLCBvciBuYXZpZ2F0ZWQgYXdheSBhbmQgYmFjaykuIEluIGFsbCBvZiB0aG9zZVxuICAvLyBjYXNlcyBDb2RleCByZXNldHMgdG8gaXRzIGRlZmF1bHQgcGFnZSAoR2VuZXJhbCksIGJ1dCBvdXIgaW4tbWVtb3J5XG4gIC8vIGBhY3RpdmVQYWdlYCBtYXkgc3RpbGwgcmVmZXJlbmNlIHRoZSBsYXN0IHR3ZWFrL3BhZ2UgdGhlIHVzZXIgaGFkIG9wZW5cbiAgLy8gXHUyMDE0IHdoaWNoIHdvdWxkIGNhdXNlIHRoYXQgbmF2IGJ1dHRvbiB0byByZW5kZXIgd2l0aCB0aGUgYWN0aXZlIHN0eWxpbmdcbiAgLy8gZXZlbiB0aG91Z2ggQ29kZXggaXMgc2hvd2luZyBHZW5lcmFsLiBDbGVhciBpdCBzbyBgc3luY1BhZ2VzR3JvdXBgIC9cbiAgLy8gYHNldE5hdkFjdGl2ZWAgc3RhcnQgZnJvbSBhIG5ldXRyYWwgc3RhdGUuIFRoZSBwYW5lbEhvc3QgcmVmZXJlbmNlIGlzXG4gIC8vIGFsc28gc3RhbGUgKGl0cyBET00gd2FzIGRpc2NhcmRlZCB3aXRoIHRoZSBwcmV2aW91cyBjb250ZW50IGFyZWEpLlxuICBpZiAoc3RhdGUuYWN0aXZlUGFnZSAhPT0gbnVsbCB8fCBzdGF0ZS5wYW5lbEhvc3QgIT09IG51bGwpIHtcbiAgICBwbG9nKFwic2lkZWJhciByZS1tb3VudCBkZXRlY3RlZDsgY2xlYXJpbmcgc3RhbGUgYWN0aXZlIHN0YXRlXCIsIHtcbiAgICAgIHByZXZBY3RpdmU6IHN0YXRlLmFjdGl2ZVBhZ2UsXG4gICAgfSk7XG4gICAgc3RhdGUuYWN0aXZlUGFnZSA9IG51bGw7XG4gICAgc3RhdGUucGFuZWxIb3N0ID0gbnVsbDtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBHcm91cCBjb250YWluZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IGdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZ3JvdXAuZGF0YXNldC5jb2RleHBwID0gXCJuYXYtZ3JvdXBcIjtcbiAgZ3JvdXAuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC1weFwiO1xuXG4gIGdyb3VwLmFwcGVuZENoaWxkKHNpZGViYXJHcm91cEhlYWRlcihcIkNvZGV4KytcIiwgXCJwdC0zXCIpKTtcblxuICAvLyBcdTI1MDBcdTI1MDAgU2lkZWJhciBpdGVtcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgY29uZmlnQnRuID0gbWFrZVNpZGViYXJJdGVtKFwiQ29uZmlnXCIsIGNvbmZpZ0ljb25TdmcoKSk7XG4gIGNvbnN0IHR3ZWFrc0J0biA9IG1ha2VTaWRlYmFySXRlbShcIlR3ZWFrc1wiLCB0d2Vha3NJY29uU3ZnKCkpO1xuICBjb25zdCBzdG9yZUJ0biA9IG1ha2VTaWRlYmFySXRlbShcIlR3ZWFrIFN0b3JlXCIsIHN0b3JlSWNvblN2ZygpKTtcblxuICBjb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgYWN0aXZhdGVQYWdlKHsga2luZDogXCJjb25maWdcIiB9KTtcbiAgfSk7XG4gIHR3ZWFrc0J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBhY3RpdmF0ZVBhZ2UoeyBraW5kOiBcInR3ZWFrc1wiIH0pO1xuICB9KTtcbiAgc3RvcmVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgYWN0aXZhdGVQYWdlKHsga2luZDogXCJzdG9yZVwiIH0pO1xuICB9KTtcblxuICBncm91cC5hcHBlbmRDaGlsZChjb25maWdCdG4pO1xuICBncm91cC5hcHBlbmRDaGlsZCh0d2Vha3NCdG4pO1xuICBncm91cC5hcHBlbmRDaGlsZChzdG9yZUJ0bik7XG4gIG91dGVyLmFwcGVuZENoaWxkKGdyb3VwKTtcblxuICBzdGF0ZS5uYXZHcm91cCA9IGdyb3VwO1xuICBzdGF0ZS5uYXZCdXR0b25zID0geyBjb25maWc6IGNvbmZpZ0J0biwgdHdlYWtzOiB0d2Vha3NCdG4sIHN0b3JlOiBzdG9yZUJ0biB9O1xuICBwbG9nKFwibmF2IGdyb3VwIGluamVjdGVkXCIsIHsgb3V0ZXJUYWc6IG91dGVyLnRhZ05hbWUgfSk7XG4gIHN5bmNQYWdlc0dyb3VwKCk7XG59XG5cbmZ1bmN0aW9uIHN5bmNOYXRpdmVTZXR0aW5nc0hlYWRlcihpdGVtc0dyb3VwOiBIVE1MRWxlbWVudCwgb3V0ZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGlmIChzdGF0ZS5uYXRpdmVOYXZIZWFkZXIgJiYgb3V0ZXIuY29udGFpbnMoc3RhdGUubmF0aXZlTmF2SGVhZGVyKSkgcmV0dXJuO1xuICBpZiAob3V0ZXIgPT09IGl0ZW1zR3JvdXApIHJldHVybjtcblxuICBjb25zdCBoZWFkZXIgPSBzaWRlYmFyR3JvdXBIZWFkZXIoXCJHZW5lcmFsXCIpO1xuICBoZWFkZXIuZGF0YXNldC5jb2RleHBwID0gXCJuYXRpdmUtbmF2LWhlYWRlclwiO1xuICBvdXRlci5pbnNlcnRCZWZvcmUoaGVhZGVyLCBpdGVtc0dyb3VwKTtcbiAgc3RhdGUubmF0aXZlTmF2SGVhZGVyID0gaGVhZGVyO1xufVxuXG5mdW5jdGlvbiBzaWRlYmFyR3JvdXBIZWFkZXIodGV4dDogc3RyaW5nLCB0b3BQYWRkaW5nID0gXCJwdC0yXCIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlci5jbGFzc05hbWUgPVxuICAgIGBweC1yb3cteCAke3RvcFBhZGRpbmd9IHBiLTEgdGV4dC1bMTFweF0gZm9udC1tZWRpdW0gdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHRleHQtdG9rZW4tZGVzY3JpcHRpb24tZm9yZWdyb3VuZCBzZWxlY3Qtbm9uZWA7XG4gIGhlYWRlci50ZXh0Q29udGVudCA9IHRleHQ7XG4gIHJldHVybiBoZWFkZXI7XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlU2V0dGluZ3NTdXJmYWNlSGlkZGVuKCk6IHZvaWQge1xuICBpZiAoIXN0YXRlLnNldHRpbmdzU3VyZmFjZVZpc2libGUgfHwgc3RhdGUuc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyKSByZXR1cm47XG4gIHN0YXRlLnNldHRpbmdzU3VyZmFjZUhpZGVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIHN0YXRlLnNldHRpbmdzU3VyZmFjZUhpZGVUaW1lciA9IG51bGw7XG4gICAgaWYgKGZpbmRTaWRlYmFySXRlbXNHcm91cCgpKSByZXR1cm47XG4gICAgaWYgKGlzU2V0dGluZ3NUZXh0VmlzaWJsZSgpKSByZXR1cm47XG4gICAgc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZShmYWxzZSwgXCJzaWRlYmFyLW5vdC1mb3VuZFwiKTtcbiAgfSwgMTUwMCk7XG59XG5cbmZ1bmN0aW9uIGlzU2V0dGluZ3NUZXh0VmlzaWJsZSgpOiBib29sZWFuIHtcbiAgY29uc3QgdGV4dCA9IGNvbXBhY3RTZXR0aW5nc1RleHQoZG9jdW1lbnQuYm9keT8udGV4dENvbnRlbnQgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIChcbiAgICB0ZXh0LmluY2x1ZGVzKFwiYmFjayB0byBhcHBcIikgJiZcbiAgICB0ZXh0LmluY2x1ZGVzKFwiZ2VuZXJhbFwiKSAmJlxuICAgIHRleHQuaW5jbHVkZXMoXCJhcHBlYXJhbmNlXCIpICYmXG4gICAgKHRleHQuaW5jbHVkZXMoXCJjb25maWd1cmF0aW9uXCIpIHx8IHRleHQuaW5jbHVkZXMoXCJkZWZhdWx0IHBlcm1pc3Npb25zXCIpKVxuICApO1xufVxuXG5mdW5jdGlvbiBjb21wYWN0U2V0dGluZ3NUZXh0KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlIHx8IFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZSh2aXNpYmxlOiBib29sZWFuLCByZWFzb246IHN0cmluZyk6IHZvaWQge1xuICBpZiAoc3RhdGUuc2V0dGluZ3NTdXJmYWNlVmlzaWJsZSA9PT0gdmlzaWJsZSkgcmV0dXJuO1xuICBzdGF0ZS5zZXR0aW5nc1N1cmZhY2VWaXNpYmxlID0gdmlzaWJsZTtcbiAgdHJ5IHtcbiAgICAod2luZG93IGFzIFdpbmRvdyAmIHsgX19jb2RleHBwU2V0dGluZ3NTdXJmYWNlVmlzaWJsZT86IGJvb2xlYW4gfSkuX19jb2RleHBwU2V0dGluZ3NTdXJmYWNlVmlzaWJsZSA9IHZpc2libGU7XG4gICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQuY29kZXhwcFNldHRpbmdzU3VyZmFjZSA9IHZpc2libGUgPyBcInRydWVcIiA6IFwiZmFsc2VcIjtcbiAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChcbiAgICAgIG5ldyBDdXN0b21FdmVudChcImNvZGV4cHA6c2V0dGluZ3Mtc3VyZmFjZVwiLCB7XG4gICAgICAgIGRldGFpbDogeyB2aXNpYmxlLCByZWFzb24gfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH0gY2F0Y2gge31cbiAgcGxvZyhcInNldHRpbmdzIHN1cmZhY2VcIiwgeyB2aXNpYmxlLCByZWFzb24sIHVybDogbG9jYXRpb24uaHJlZiB9KTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgKG9yIHJlLXJlbmRlcikgdGhlIHNlY29uZCBzaWRlYmFyIGdyb3VwIG9mIHBlci10d2VhayBwYWdlcy4gVGhlXG4gKiBncm91cCBpcyBjcmVhdGVkIGxhemlseSBhbmQgcmVtb3ZlZCB3aGVuIHRoZSBsYXN0IHBhZ2UgdW5yZWdpc3RlcnMsIHNvXG4gKiB1c2VycyB3aXRoIG5vIHBhZ2UtcmVnaXN0ZXJpbmcgdHdlYWtzIG5ldmVyIHNlZSBhbiBlbXB0eSBcIlR3ZWFrc1wiIGhlYWRlci5cbiAqL1xuZnVuY3Rpb24gc3luY1BhZ2VzR3JvdXAoKTogdm9pZCB7XG4gIGNvbnN0IG91dGVyID0gc3RhdGUuc2lkZWJhclJvb3Q7XG4gIGlmICghb3V0ZXIpIHJldHVybjtcbiAgY29uc3QgcGFnZXMgPSBbLi4uc3RhdGUucGFnZXMudmFsdWVzKCldO1xuXG4gIC8vIEJ1aWxkIGEgZGV0ZXJtaW5pc3RpYyBmaW5nZXJwcmludCBvZiB0aGUgZGVzaXJlZCBncm91cCBzdGF0ZS4gSWYgdGhlXG4gIC8vIGN1cnJlbnQgRE9NIGdyb3VwIGFscmVhZHkgbWF0Y2hlcywgdGhpcyBpcyBhIG5vLW9wIFx1MjAxNCBjcml0aWNhbCwgYmVjYXVzZVxuICAvLyBzeW5jUGFnZXNHcm91cCBpcyBjYWxsZWQgb24gZXZlcnkgTXV0YXRpb25PYnNlcnZlciB0aWNrIGFuZCBhbnkgRE9NXG4gIC8vIHdyaXRlIHdvdWxkIHJlLXRyaWdnZXIgdGhhdCBvYnNlcnZlciAoaW5maW5pdGUgbG9vcCwgYXBwIGZyZWV6ZSkuXG4gIGNvbnN0IGRlc2lyZWRLZXkgPSBwYWdlcy5sZW5ndGggPT09IDBcbiAgICA/IFwiRU1QVFlcIlxuICAgIDogcGFnZXMubWFwKChwKSA9PiBgJHtwLmlkfXwke3AucGFnZS50aXRsZX18JHtwLnBhZ2UuaWNvblN2ZyA/PyBcIlwifWApLmpvaW4oXCJcXG5cIik7XG4gIGNvbnN0IGdyb3VwQXR0YWNoZWQgPSAhIXN0YXRlLnBhZ2VzR3JvdXAgJiYgb3V0ZXIuY29udGFpbnMoc3RhdGUucGFnZXNHcm91cCk7XG4gIGlmIChzdGF0ZS5wYWdlc0dyb3VwS2V5ID09PSBkZXNpcmVkS2V5ICYmIChwYWdlcy5sZW5ndGggPT09IDAgPyAhZ3JvdXBBdHRhY2hlZCA6IGdyb3VwQXR0YWNoZWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHBhZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChzdGF0ZS5wYWdlc0dyb3VwKSB7XG4gICAgICBzdGF0ZS5wYWdlc0dyb3VwLnJlbW92ZSgpO1xuICAgICAgc3RhdGUucGFnZXNHcm91cCA9IG51bGw7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcCBvZiBzdGF0ZS5wYWdlcy52YWx1ZXMoKSkgcC5uYXZCdXR0b24gPSBudWxsO1xuICAgIHN0YXRlLnBhZ2VzR3JvdXBLZXkgPSBkZXNpcmVkS2V5O1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBncm91cCA9IHN0YXRlLnBhZ2VzR3JvdXA7XG4gIGlmICghZ3JvdXAgfHwgIW91dGVyLmNvbnRhaW5zKGdyb3VwKSkge1xuICAgIGdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBncm91cC5kYXRhc2V0LmNvZGV4cHAgPSBcInBhZ2VzLWdyb3VwXCI7XG4gICAgZ3JvdXAuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC1weFwiO1xuICAgIGdyb3VwLmFwcGVuZENoaWxkKHNpZGViYXJHcm91cEhlYWRlcihcIlR3ZWFrc1wiLCBcInB0LTNcIikpO1xuICAgIG91dGVyLmFwcGVuZENoaWxkKGdyb3VwKTtcbiAgICBzdGF0ZS5wYWdlc0dyb3VwID0gZ3JvdXA7XG4gIH0gZWxzZSB7XG4gICAgLy8gU3RyaXAgcHJpb3IgYnV0dG9ucyAoa2VlcCB0aGUgaGVhZGVyIGF0IGluZGV4IDApLlxuICAgIHdoaWxlIChncm91cC5jaGlsZHJlbi5sZW5ndGggPiAxKSBncm91cC5yZW1vdmVDaGlsZChncm91cC5sYXN0Q2hpbGQhKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgcCBvZiBwYWdlcykge1xuICAgIGNvbnN0IGljb24gPSBwLnBhZ2UuaWNvblN2ZyA/PyBkZWZhdWx0UGFnZUljb25TdmcoKTtcbiAgICBjb25zdCBidG4gPSBtYWtlU2lkZWJhckl0ZW0ocC5wYWdlLnRpdGxlLCBpY29uKTtcbiAgICBidG4uZGF0YXNldC5jb2RleHBwID0gYG5hdi1wYWdlLSR7cC5pZH1gO1xuICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBhY3RpdmF0ZVBhZ2UoeyBraW5kOiBcInJlZ2lzdGVyZWRcIiwgaWQ6IHAuaWQgfSk7XG4gICAgfSk7XG4gICAgcC5uYXZCdXR0b24gPSBidG47XG4gICAgZ3JvdXAuYXBwZW5kQ2hpbGQoYnRuKTtcbiAgfVxuICBzdGF0ZS5wYWdlc0dyb3VwS2V5ID0gZGVzaXJlZEtleTtcbiAgcGxvZyhcInBhZ2VzIGdyb3VwIHN5bmNlZFwiLCB7XG4gICAgY291bnQ6IHBhZ2VzLmxlbmd0aCxcbiAgICBpZHM6IHBhZ2VzLm1hcCgocCkgPT4gcC5pZCksXG4gIH0pO1xuICAvLyBSZWZsZWN0IGN1cnJlbnQgYWN0aXZlIHN0YXRlIGFjcm9zcyB0aGUgcmVidWlsdCBidXR0b25zLlxuICBzZXROYXZBY3RpdmUoc3RhdGUuYWN0aXZlUGFnZSk7XG59XG5cbmZ1bmN0aW9uIG1ha2VTaWRlYmFySXRlbShsYWJlbDogc3RyaW5nLCBpY29uU3ZnOiBzdHJpbmcpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIC8vIENsYXNzIHN0cmluZyBjb3BpZWQgdmVyYmF0aW0gZnJvbSBDb2RleCdzIHNpZGViYXIgYnV0dG9ucyAoR2VuZXJhbCBldGMpLlxuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICBidG4udHlwZSA9IFwiYnV0dG9uXCI7XG4gIGJ0bi5kYXRhc2V0LmNvZGV4cHAgPSBgbmF2LSR7bGFiZWwudG9Mb3dlckNhc2UoKX1gO1xuICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBsYWJlbCk7XG4gIGJ0bi5jbGFzc05hbWUgPVxuICAgIFwiZm9jdXMtdmlzaWJsZTpvdXRsaW5lLXRva2VuLWJvcmRlciByZWxhdGl2ZSBweC1yb3cteCBweS1yb3cteSBjdXJzb3ItaW50ZXJhY3Rpb24gc2hyaW5rLTAgaXRlbXMtY2VudGVyIG92ZXJmbG93LWhpZGRlbiByb3VuZGVkLWxnIHRleHQtbGVmdCB0ZXh0LXNtIGZvY3VzLXZpc2libGU6b3V0bGluZSBmb2N1cy12aXNpYmxlOm91dGxpbmUtMiBmb2N1cy12aXNpYmxlOm91dGxpbmUtb2Zmc2V0LTIgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNTAgZ2FwLTIgZmxleCB3LWZ1bGwgaG92ZXI6YmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kIGZvbnQtbm9ybWFsXCI7XG5cbiAgY29uc3QgaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBpbm5lci5jbGFzc05hbWUgPVxuICAgIFwiZmxleCBtaW4tdy0wIGl0ZW1zLWNlbnRlciB0ZXh0LWJhc2UgZ2FwLTIgZmxleC0xIHRleHQtdG9rZW4tZm9yZWdyb3VuZFwiO1xuICBpbm5lci5pbm5lckhUTUwgPSBgJHtpY29uU3ZnfTxzcGFuIGNsYXNzPVwidHJ1bmNhdGVcIj4ke2xhYmVsfTwvc3Bhbj5gO1xuICBidG4uYXBwZW5kQ2hpbGQoaW5uZXIpO1xuICByZXR1cm4gYnRuO1xufVxuXG4vKiogSW50ZXJuYWwga2V5IGZvciB0aGUgYnVpbHQtaW4gbmF2IGJ1dHRvbnMuICovXG50eXBlIEJ1aWx0aW5QYWdlID0gXCJjb25maWdcIiB8IFwidHdlYWtzXCIgfCBcInN0b3JlXCI7XG5cbmZ1bmN0aW9uIHNldE5hdkFjdGl2ZShhY3RpdmU6IEFjdGl2ZVBhZ2UgfCBudWxsKTogdm9pZCB7XG4gIC8vIEJ1aWx0LWluIChDb25maWcvVHdlYWtzKSBidXR0b25zLlxuICBpZiAoc3RhdGUubmF2QnV0dG9ucykge1xuICAgIGNvbnN0IGJ1aWx0aW46IEJ1aWx0aW5QYWdlIHwgbnVsbCA9XG4gICAgICBhY3RpdmU/LmtpbmQgPT09IFwiY29uZmlnXCIgPyBcImNvbmZpZ1wiIDpcbiAgICAgIGFjdGl2ZT8ua2luZCA9PT0gXCJ0d2Vha3NcIiA/IFwidHdlYWtzXCIgOlxuICAgICAgYWN0aXZlPy5raW5kID09PSBcInN0b3JlXCIgPyBcInN0b3JlXCIgOiBudWxsO1xuICAgIGZvciAoY29uc3QgW2tleSwgYnRuXSBvZiBPYmplY3QuZW50cmllcyhzdGF0ZS5uYXZCdXR0b25zKSBhcyBbQnVpbHRpblBhZ2UsIEhUTUxCdXR0b25FbGVtZW50XVtdKSB7XG4gICAgICBhcHBseU5hdkFjdGl2ZShidG4sIGtleSA9PT0gYnVpbHRpbik7XG4gICAgfVxuICB9XG4gIC8vIFBlci1wYWdlIHJlZ2lzdGVyZWQgYnV0dG9ucy5cbiAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSB7XG4gICAgaWYgKCFwLm5hdkJ1dHRvbikgY29udGludWU7XG4gICAgY29uc3QgaXNBY3RpdmUgPSBhY3RpdmU/LmtpbmQgPT09IFwicmVnaXN0ZXJlZFwiICYmIGFjdGl2ZS5pZCA9PT0gcC5pZDtcbiAgICBhcHBseU5hdkFjdGl2ZShwLm5hdkJ1dHRvbiwgaXNBY3RpdmUpO1xuICB9XG4gIC8vIENvZGV4J3Mgb3duIHNpZGViYXIgYnV0dG9ucyAoR2VuZXJhbCwgQXBwZWFyYW5jZSwgZXRjKS4gV2hlbiBvbmUgb2ZcbiAgLy8gb3VyIHBhZ2VzIGlzIGFjdGl2ZSwgQ29kZXggc3RpbGwgaGFzIGFyaWEtY3VycmVudD1cInBhZ2VcIiBhbmQgdGhlXG4gIC8vIGFjdGl2ZS1iZyBjbGFzcyBvbiB3aGljaGV2ZXIgaXRlbSBpdCBjb25zaWRlcmVkIHRoZSByb3V0ZSBcdTIwMTQgdHlwaWNhbGx5XG4gIC8vIEdlbmVyYWwuIFRoYXQgbWFrZXMgYm90aCBidXR0b25zIGxvb2sgc2VsZWN0ZWQuIFN0cmlwIENvZGV4J3MgYWN0aXZlXG4gIC8vIHN0eWxpbmcgd2hpbGUgb25lIG9mIG91cnMgaXMgYWN0aXZlOyByZXN0b3JlIGl0IHdoZW4gbm9uZSBpcy5cbiAgc3luY0NvZGV4TmF0aXZlTmF2QWN0aXZlKGFjdGl2ZSAhPT0gbnVsbCk7XG59XG5cbi8qKlxuICogTXV0ZSBDb2RleCdzIG93biBhY3RpdmUtc3RhdGUgc3R5bGluZyBvbiBpdHMgc2lkZWJhciBidXR0b25zLiBXZSBkb24ndFxuICogdG91Y2ggQ29kZXgncyBSZWFjdCBzdGF0ZSBcdTIwMTQgd2hlbiB0aGUgdXNlciBjbGlja3MgYSBuYXRpdmUgaXRlbSwgQ29kZXhcbiAqIHJlLXJlbmRlcnMgdGhlIGJ1dHRvbnMgYW5kIHJlLWFwcGxpZXMgaXRzIG93biBjb3JyZWN0IHN0YXRlLCB0aGVuIG91clxuICogc2lkZWJhci1jbGljayBsaXN0ZW5lciBmaXJlcyBgcmVzdG9yZUNvZGV4Vmlld2AgKHdoaWNoIGNhbGxzIGJhY2sgaW50b1xuICogYHNldE5hdkFjdGl2ZShudWxsKWAgYW5kIGxldHMgQ29kZXgncyBzdHlsaW5nIHN0YW5kKS5cbiAqXG4gKiBgbXV0ZT10cnVlYCAgXHUyMTkyIHN0cmlwIGFyaWEtY3VycmVudCBhbmQgc3dhcCBhY3RpdmUgYmcgXHUyMTkyIGhvdmVyIGJnXG4gKiBgbXV0ZT1mYWxzZWAgXHUyMTkyIG5vLW9wIChDb2RleCdzIG93biByZS1yZW5kZXIgYWxyZWFkeSByZXN0b3JlZCB0aGluZ3MpXG4gKi9cbmZ1bmN0aW9uIHN5bmNDb2RleE5hdGl2ZU5hdkFjdGl2ZShtdXRlOiBib29sZWFuKTogdm9pZCB7XG4gIGlmICghbXV0ZSkgcmV0dXJuO1xuICBjb25zdCByb290ID0gc3RhdGUuc2lkZWJhclJvb3Q7XG4gIGlmICghcm9vdCkgcmV0dXJuO1xuICBjb25zdCBidXR0b25zID0gQXJyYXkuZnJvbShyb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KFwiYnV0dG9uXCIpKTtcbiAgZm9yIChjb25zdCBidG4gb2YgYnV0dG9ucykge1xuICAgIC8vIFNraXAgb3VyIG93biBidXR0b25zLlxuICAgIGlmIChidG4uZGF0YXNldC5jb2RleHBwKSBjb250aW51ZTtcbiAgICBpZiAoYnRuLmdldEF0dHJpYnV0ZShcImFyaWEtY3VycmVudFwiKSA9PT0gXCJwYWdlXCIpIHtcbiAgICAgIGJ0bi5yZW1vdmVBdHRyaWJ1dGUoXCJhcmlhLWN1cnJlbnRcIik7XG4gICAgfVxuICAgIGlmIChidG4uY2xhc3NMaXN0LmNvbnRhaW5zKFwiYmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpKSB7XG4gICAgICBidG4uY2xhc3NMaXN0LnJlbW92ZShcImJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZFwiKTtcbiAgICAgIGJ0bi5jbGFzc0xpc3QuYWRkKFwiaG92ZXI6YmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseU5hdkFjdGl2ZShidG46IEhUTUxCdXR0b25FbGVtZW50LCBhY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgaW5uZXIgPSBidG4uZmlyc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoYWN0aXZlKSB7XG4gICAgICBidG4uY2xhc3NMaXN0LnJlbW92ZShcImhvdmVyOmJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZFwiLCBcImZvbnQtbm9ybWFsXCIpO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoXCJiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIik7XG4gICAgICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1jdXJyZW50XCIsIFwicGFnZVwiKTtcbiAgICAgIGlmIChpbm5lcikge1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QucmVtb3ZlKFwidGV4dC10b2tlbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QuYWRkKFwidGV4dC10b2tlbi1saXN0LWFjdGl2ZS1zZWxlY3Rpb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgICAgaW5uZXJcbiAgICAgICAgICAucXVlcnlTZWxlY3RvcihcInN2Z1wiKVxuICAgICAgICAgID8uY2xhc3NMaXN0LmFkZChcInRleHQtdG9rZW4tbGlzdC1hY3RpdmUtc2VsZWN0aW9uLWljb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoXCJob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIiwgXCJmb250LW5vcm1hbFwiKTtcbiAgICAgIGJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwiYmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpO1xuICAgICAgYnRuLnJlbW92ZUF0dHJpYnV0ZShcImFyaWEtY3VycmVudFwiKTtcbiAgICAgIGlmIChpbm5lcikge1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QuYWRkKFwidGV4dC10b2tlbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgICBpbm5lci5jbGFzc0xpc3QucmVtb3ZlKFwidGV4dC10b2tlbi1saXN0LWFjdGl2ZS1zZWxlY3Rpb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgICAgaW5uZXJcbiAgICAgICAgICAucXVlcnlTZWxlY3RvcihcInN2Z1wiKVxuICAgICAgICAgID8uY2xhc3NMaXN0LnJlbW92ZShcInRleHQtdG9rZW4tbGlzdC1hY3RpdmUtc2VsZWN0aW9uLWljb24tZm9yZWdyb3VuZFwiKTtcbiAgICAgIH1cbiAgICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBhY3RpdmF0ZVBhZ2UocGFnZTogQWN0aXZlUGFnZSk6IHZvaWQge1xuICBjb25zdCBjb250ZW50ID0gZmluZENvbnRlbnRBcmVhKCk7XG4gIGlmICghY29udGVudCkge1xuICAgIHBsb2coXCJhY3RpdmF0ZTogY29udGVudCBhcmVhIG5vdCBmb3VuZFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgc3RhdGUuYWN0aXZlUGFnZSA9IHBhZ2U7XG4gIHBsb2coXCJhY3RpdmF0ZVwiLCB7IHBhZ2UgfSk7XG5cbiAgLy8gSGlkZSBDb2RleCdzIGNvbnRlbnQgY2hpbGRyZW4sIHNob3cgb3Vycy5cbiAgZm9yIChjb25zdCBjaGlsZCBvZiBBcnJheS5mcm9tKGNvbnRlbnQuY2hpbGRyZW4pIGFzIEhUTUxFbGVtZW50W10pIHtcbiAgICBpZiAoY2hpbGQuZGF0YXNldC5jb2RleHBwID09PSBcInR3ZWFrcy1wYW5lbFwiKSBjb250aW51ZTtcbiAgICBpZiAoY2hpbGQuZGF0YXNldC5jb2RleHBwSGlkZGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNoaWxkLmRhdGFzZXQuY29kZXhwcEhpZGRlbiA9IGNoaWxkLnN0eWxlLmRpc3BsYXkgfHwgXCJcIjtcbiAgICB9XG4gICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICB9XG4gIGxldCBwYW5lbCA9IGNvbnRlbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tkYXRhLWNvZGV4cHA9XCJ0d2Vha3MtcGFuZWxcIl0nKTtcbiAgaWYgKCFwYW5lbCkge1xuICAgIHBhbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBwYW5lbC5kYXRhc2V0LmNvZGV4cHAgPSBcInR3ZWFrcy1wYW5lbFwiO1xuICAgIHBhbmVsLnN0eWxlLmNzc1RleHQgPSBcIndpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7b3ZlcmZsb3c6YXV0bztcIjtcbiAgICBjb250ZW50LmFwcGVuZENoaWxkKHBhbmVsKTtcbiAgfVxuICBwYW5lbC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICBzdGF0ZS5wYW5lbEhvc3QgPSBwYW5lbDtcbiAgcmVyZW5kZXIoKTtcbiAgc2V0TmF2QWN0aXZlKHBhZ2UpO1xuICAvLyByZXN0b3JlIENvZGV4J3Mgdmlldy4gUmUtcmVnaXN0ZXIgaWYgbmVlZGVkLlxuICBjb25zdCBzaWRlYmFyID0gc3RhdGUuc2lkZWJhclJvb3Q7XG4gIGlmIChzaWRlYmFyKSB7XG4gICAgaWYgKHN0YXRlLnNpZGViYXJSZXN0b3JlSGFuZGxlcikge1xuICAgICAgc2lkZWJhci5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgc3RhdGUuc2lkZWJhclJlc3RvcmVIYW5kbGVyLCB0cnVlKTtcbiAgICB9XG4gICAgY29uc3QgaGFuZGxlciA9IChlOiBFdmVudCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgaWYgKCF0YXJnZXQpIHJldHVybjtcbiAgICAgIGlmIChzdGF0ZS5uYXZHcm91cD8uY29udGFpbnModGFyZ2V0KSkgcmV0dXJuOyAvLyBvdXIgYnV0dG9uc1xuICAgICAgaWYgKHN0YXRlLnBhZ2VzR3JvdXA/LmNvbnRhaW5zKHRhcmdldCkpIHJldHVybjsgLy8gb3VyIHBhZ2UgYnV0dG9uc1xuICAgICAgaWYgKHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtY29kZXhwcC1zZXR0aW5ncy1zZWFyY2hdXCIpKSByZXR1cm47XG4gICAgICByZXN0b3JlQ29kZXhWaWV3KCk7XG4gICAgfTtcbiAgICBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIgPSBoYW5kbGVyO1xuICAgIHNpZGViYXIuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGhhbmRsZXIsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlc3RvcmVDb2RleFZpZXcoKTogdm9pZCB7XG4gIHBsb2coXCJyZXN0b3JlIGNvZGV4IHZpZXdcIik7XG4gIGNvbnN0IGNvbnRlbnQgPSBmaW5kQ29udGVudEFyZWEoKTtcbiAgaWYgKCFjb250ZW50KSByZXR1cm47XG4gIGlmIChzdGF0ZS5wYW5lbEhvc3QpIHN0YXRlLnBhbmVsSG9zdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShjb250ZW50LmNoaWxkcmVuKSBhcyBIVE1MRWxlbWVudFtdKSB7XG4gICAgaWYgKGNoaWxkID09PSBzdGF0ZS5wYW5lbEhvc3QpIGNvbnRpbnVlO1xuICAgIGlmIChjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IGNoaWxkLmRhdGFzZXQuY29kZXhwcEhpZGRlbjtcbiAgICAgIGRlbGV0ZSBjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW47XG4gICAgfVxuICB9XG4gIHN0YXRlLmFjdGl2ZVBhZ2UgPSBudWxsO1xuICBzZXROYXZBY3RpdmUobnVsbCk7XG4gIGlmIChzdGF0ZS5zaWRlYmFyUm9vdCAmJiBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIpIHtcbiAgICBzdGF0ZS5zaWRlYmFyUm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgXCJjbGlja1wiLFxuICAgICAgc3RhdGUuc2lkZWJhclJlc3RvcmVIYW5kbGVyLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHN0YXRlLnNpZGViYXJSZXN0b3JlSGFuZGxlciA9IG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVyZW5kZXIoKTogdm9pZCB7XG4gIGlmICghc3RhdGUuYWN0aXZlUGFnZSkgcmV0dXJuO1xuICBjb25zdCBob3N0ID0gc3RhdGUucGFuZWxIb3N0O1xuICBpZiAoIWhvc3QpIHJldHVybjtcbiAgaG9zdC5pbm5lckhUTUwgPSBcIlwiO1xuXG4gIGNvbnN0IGFwID0gc3RhdGUuYWN0aXZlUGFnZTtcbiAgaWYgKGFwLmtpbmQgPT09IFwicmVnaXN0ZXJlZFwiKSB7XG4gICAgY29uc3QgZW50cnkgPSBzdGF0ZS5wYWdlcy5nZXQoYXAuaWQpO1xuICAgIGlmICghZW50cnkpIHtcbiAgICAgIHJlc3RvcmVDb2RleFZpZXcoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgcm9vdCA9IHBhbmVsU2hlbGwoZW50cnkucGFnZS50aXRsZSwgZW50cnkucGFnZS5kZXNjcmlwdGlvbik7XG4gICAgaG9zdC5hcHBlbmRDaGlsZChyb290Lm91dGVyKTtcbiAgICB0cnkge1xuICAgICAgLy8gVGVhciBkb3duIGFueSBwcmlvciByZW5kZXIgYmVmb3JlIHJlLXJlbmRlcmluZyAoaG90IHJlbG9hZCkuXG4gICAgICB0cnkgeyBlbnRyeS50ZWFyZG93bj8uKCk7IH0gY2F0Y2gge31cbiAgICAgIGVudHJ5LnRlYXJkb3duID0gbnVsbDtcbiAgICAgIGNvbnN0IHJldCA9IGVudHJ5LnBhZ2UucmVuZGVyKHJvb3Quc2VjdGlvbnNXcmFwKTtcbiAgICAgIGlmICh0eXBlb2YgcmV0ID09PSBcImZ1bmN0aW9uXCIpIGVudHJ5LnRlYXJkb3duID0gcmV0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGVyciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBlcnIuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLWNoYXJ0cy1yZWQgdGV4dC1zbVwiO1xuICAgICAgZXJyLnRleHRDb250ZW50ID0gYEVycm9yIHJlbmRlcmluZyBwYWdlOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWA7XG4gICAgICByb290LnNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZChlcnIpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0aXRsZSA9XG4gICAgYXAua2luZCA9PT0gXCJ0d2Vha3NcIiA/IFwiVHdlYWtzXCIgOlxuICAgIGFwLmtpbmQgPT09IFwic3RvcmVcIiA/IFwiVHdlYWsgU3RvcmVcIiA6IFwiQ29uZmlnXCI7XG4gIGNvbnN0IHN1YnRpdGxlID1cbiAgICBhcC5raW5kID09PSBcInR3ZWFrc1wiXG4gICAgICA/IFwiTWFuYWdlIHlvdXIgaW5zdGFsbGVkIENvZGV4KysgdHdlYWtzLlwiXG4gICAgICA6IGFwLmtpbmQgPT09IFwic3RvcmVcIlxuICAgICAgICA/IFwiSW5zdGFsbCByZXZpZXdlZCB0d2Vha3MgcGlubmVkIHRvIGFwcHJvdmVkIEdpdEh1YiBjb21taXRzLlwiXG4gICAgICAgIDogXCJDaGVja2luZyBpbnN0YWxsZWQgQ29kZXgrKyB2ZXJzaW9uLlwiO1xuICBjb25zdCByb290ID0gcGFuZWxTaGVsbCh0aXRsZSwgc3VidGl0bGUpO1xuICBob3N0LmFwcGVuZENoaWxkKHJvb3Qub3V0ZXIpO1xuICBpZiAoYXAua2luZCA9PT0gXCJ0d2Vha3NcIikgcmVuZGVyVHdlYWtzUGFnZShyb290LnNlY3Rpb25zV3JhcCk7XG4gIGVsc2UgaWYgKGFwLmtpbmQgPT09IFwic3RvcmVcIikgcmVuZGVyVHdlYWtTdG9yZVBhZ2Uocm9vdC5zZWN0aW9uc1dyYXAsIHJvb3QuaGVhZGVyQWN0aW9ucyk7XG4gIGVsc2UgcmVuZGVyQ29uZmlnUGFnZShyb290LnNlY3Rpb25zV3JhcCwgcm9vdC5zdWJ0aXRsZSk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCBwYWdlcyBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcmVuZGVyQ29uZmlnUGFnZShzZWN0aW9uc1dyYXA6IEhUTUxFbGVtZW50LCBzdWJ0aXRsZT86IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IHNlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiKTtcbiAgc2VjdGlvbi5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTJcIjtcbiAgc2VjdGlvbi5hcHBlbmRDaGlsZChzZWN0aW9uVGl0bGUoXCJDb2RleCsrIFVwZGF0ZXNcIikpO1xuICBjb25zdCBjYXJkID0gcm91bmRlZENhcmQoKTtcbiAgY2FyZC5kYXRhc2V0LmNvZGV4cHBDb25maWdDYXJkID0gXCJ0cnVlXCI7XG4gIGNvbnN0IGxvYWRpbmcgPSByb3dTaW1wbGUoXCJMb2FkaW5nIHVwZGF0ZSBzZXR0aW5nc1wiLCBcIkNoZWNraW5nIGN1cnJlbnQgQ29kZXgrKyBjb25maWd1cmF0aW9uLlwiKTtcbiAgY2FyZC5hcHBlbmRDaGlsZChsb2FkaW5nKTtcbiAgc2VjdGlvbi5hcHBlbmRDaGlsZChjYXJkKTtcbiAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHNlY3Rpb24pO1xuXG4gIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAuaW52b2tlKFwiY29kZXhwcDpnZXQtY29uZmlnXCIpXG4gICAgLnRoZW4oKGNvbmZpZykgPT4ge1xuICAgICAgaWYgKHN1YnRpdGxlKSB7XG4gICAgICAgIHN1YnRpdGxlLnRleHRDb250ZW50ID0gYFlvdSBoYXZlIENvZGV4KysgJHsoY29uZmlnIGFzIENvZGV4UGx1c1BsdXNDb25maWcpLnZlcnNpb259IGluc3RhbGxlZC5gO1xuICAgICAgfVxuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICByZW5kZXJDb2RleFBsdXNQbHVzQ29uZmlnKGNhcmQsIGNvbmZpZyBhcyBDb2RleFBsdXNQbHVzQ29uZmlnKTtcbiAgICB9KVxuICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgaWYgKHN1YnRpdGxlKSBzdWJ0aXRsZS50ZXh0Q29udGVudCA9IFwiQ291bGQgbm90IGxvYWQgaW5zdGFsbGVkIENvZGV4KysgdmVyc2lvbi5cIjtcbiAgICAgIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgY2FyZC5hcHBlbmRDaGlsZChyb3dTaW1wbGUoXCJDb3VsZCBub3QgbG9hZCB1cGRhdGUgc2V0dGluZ3NcIiwgU3RyaW5nKGUpKSk7XG4gICAgfSk7XG5cbiAgY29uc3Qgd2F0Y2hlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICB3YXRjaGVyLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICB3YXRjaGVyLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkF1dG8tUmVwYWlyIFdhdGNoZXJcIikpO1xuICBjb25zdCB3YXRjaGVyQ2FyZCA9IHJvdW5kZWRDYXJkKCk7XG4gIHdhdGNoZXJDYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIkNoZWNraW5nIHdhdGNoZXJcIiwgXCJWZXJpZnlpbmcgdGhlIHVwZGF0ZXIgcmVwYWlyIHNlcnZpY2UuXCIpKTtcbiAgd2F0Y2hlci5hcHBlbmRDaGlsZCh3YXRjaGVyQ2FyZCk7XG4gIHNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZCh3YXRjaGVyKTtcbiAgcmVuZGVyV2F0Y2hlckhlYWx0aENhcmQod2F0Y2hlckNhcmQpO1xuXG4gIGNvbnN0IG1haW50ZW5hbmNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIik7XG4gIG1haW50ZW5hbmNlLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICBtYWludGVuYW5jZS5hcHBlbmRDaGlsZChzZWN0aW9uVGl0bGUoXCJNYWludGVuYW5jZVwiKSk7XG4gIGNvbnN0IG1haW50ZW5hbmNlQ2FyZCA9IHJvdW5kZWRDYXJkKCk7XG4gIG1haW50ZW5hbmNlQ2FyZC5hcHBlbmRDaGlsZCh1bmluc3RhbGxSb3coKSk7XG4gIG1haW50ZW5hbmNlQ2FyZC5hcHBlbmRDaGlsZChyZXBvcnRCdWdSb3coKSk7XG4gIG1haW50ZW5hbmNlLmFwcGVuZENoaWxkKG1haW50ZW5hbmNlQ2FyZCk7XG4gIHNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZChtYWludGVuYW5jZSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvZGV4UGx1c1BsdXNDb25maWcoY2FyZDogSFRNTEVsZW1lbnQsIGNvbmZpZzogQ29kZXhQbHVzUGx1c0NvbmZpZyk6IHZvaWQge1xuICBjYXJkLmFwcGVuZENoaWxkKGF1dG9VcGRhdGVSb3coY29uZmlnKSk7XG4gIGNhcmQuYXBwZW5kQ2hpbGQodXBkYXRlQ2hhbm5lbFJvdyhjb25maWcpKTtcbiAgY2FyZC5hcHBlbmRDaGlsZChpbnN0YWxsYXRpb25Tb3VyY2VSb3coY29uZmlnLmluc3RhbGxhdGlvblNvdXJjZSkpO1xuICBjYXJkLmFwcGVuZENoaWxkKHNlbGZVcGRhdGVTdGF0dXNSb3coY29uZmlnLnNlbGZVcGRhdGUpKTtcbiAgY2FyZC5hcHBlbmRDaGlsZChjaGVja0ZvclVwZGF0ZXNSb3coY29uZmlnKSk7XG4gIGlmIChjb25maWcudXBkYXRlQ2hlY2spIGNhcmQuYXBwZW5kQ2hpbGQocmVsZWFzZU5vdGVzUm93KGNvbmZpZy51cGRhdGVDaGVjaykpO1xufVxuXG5mdW5jdGlvbiBhdXRvVXBkYXRlUm93KGNvbmZpZzogQ29kZXhQbHVzUGx1c0NvbmZpZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcm93LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00IHAtM1wiO1xuICBjb25zdCBsZWZ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbGVmdC5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LWNvbCBnYXAtMVwiO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHRpdGxlLnRleHRDb250ZW50ID0gXCJBdXRvbWF0aWNhbGx5IHJlZnJlc2ggQ29kZXgrK1wiO1xuICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZGVzYy5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gIGRlc2MudGV4dENvbnRlbnQgPSBgSW5zdGFsbGVkIHZlcnNpb24gdiR7Y29uZmlnLnZlcnNpb259LiBUaGUgd2F0Y2hlciBjaGVja3MgaG91cmx5IGFuZCBjYW4gcmVmcmVzaCB0aGUgQ29kZXgrKyBydW50aW1lIGF1dG9tYXRpY2FsbHkuYDtcbiAgbGVmdC5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIHJvdy5hcHBlbmRDaGlsZChsZWZ0KTtcbiAgcm93LmFwcGVuZENoaWxkKFxuICAgIHN3aXRjaENvbnRyb2woY29uZmlnLmF1dG9VcGRhdGUsIGFzeW5jIChuZXh0KSA9PiB7XG4gICAgICBhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnNldC1hdXRvLXVwZGF0ZVwiLCBuZXh0KTtcbiAgICB9KSxcbiAgKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ2hhbm5lbFJvdyhjb25maWc6IENvZGV4UGx1c1BsdXNDb25maWcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGFjdGlvblJvdyhcIlJlbGVhc2UgY2hhbm5lbFwiLCB1cGRhdGVDaGFubmVsU3VtbWFyeShjb25maWcpKTtcbiAgY29uc3QgYWN0aW9uID0gcm93LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiW2RhdGEtY29kZXhwcC1yb3ctYWN0aW9uc11cIik7XG4gIGNvbnN0IHNlbGVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWxlY3RcIik7XG4gIHNlbGVjdC5jbGFzc05hbWUgPVxuICAgIFwiaC04IHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdHJhbnNwYXJlbnQgcHgtMiB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5IGZvY3VzOm91dGxpbmUtbm9uZVwiO1xuICBmb3IgKGNvbnN0IFt2YWx1ZSwgbGFiZWxdIG9mIFtcbiAgICBbXCJzdGFibGVcIiwgXCJTdGFibGVcIl0sXG4gICAgW1wicHJlcmVsZWFzZVwiLCBcIlByZXJlbGVhc2VcIl0sXG4gICAgW1wiY3VzdG9tXCIsIFwiQ3VzdG9tXCJdLFxuICBdIGFzIGNvbnN0KSB7XG4gICAgY29uc3Qgb3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIm9wdGlvblwiKTtcbiAgICBvcHRpb24udmFsdWUgPSB2YWx1ZTtcbiAgICBvcHRpb24udGV4dENvbnRlbnQgPSBsYWJlbDtcbiAgICBvcHRpb24uc2VsZWN0ZWQgPSBjb25maWcudXBkYXRlQ2hhbm5lbCA9PT0gdmFsdWU7XG4gICAgc2VsZWN0LmFwcGVuZENoaWxkKG9wdGlvbik7XG4gIH1cbiAgc2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAgIC5pbnZva2UoXCJjb2RleHBwOnNldC11cGRhdGUtY29uZmlnXCIsIHsgdXBkYXRlQ2hhbm5lbDogc2VsZWN0LnZhbHVlIH0pXG4gICAgICAudGhlbigoKSA9PiByZWZyZXNoQ29uZmlnQ2FyZChyb3cpKVxuICAgICAgLmNhdGNoKChlKSA9PiBwbG9nKFwic2V0IHVwZGF0ZSBjaGFubmVsIGZhaWxlZFwiLCBTdHJpbmcoZSkpKTtcbiAgfSk7XG4gIGFjdGlvbj8uYXBwZW5kQ2hpbGQoc2VsZWN0KTtcbiAgaWYgKGNvbmZpZy51cGRhdGVDaGFubmVsID09PSBcImN1c3RvbVwiKSB7XG4gICAgYWN0aW9uPy5hcHBlbmRDaGlsZChcbiAgICAgIGNvbXBhY3RCdXR0b24oXCJFZGl0XCIsICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVwbyA9IHdpbmRvdy5wcm9tcHQoXCJHaXRIdWIgcmVwb1wiLCBjb25maWcudXBkYXRlUmVwbyB8fCBcImItbm5ldHQvY29kZXgtcGx1c3BsdXNcIik7XG4gICAgICAgIGlmIChyZXBvID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHJlZiA9IHdpbmRvdy5wcm9tcHQoXCJHaXQgcmVmXCIsIGNvbmZpZy51cGRhdGVSZWYgfHwgXCJtYWluXCIpO1xuICAgICAgICBpZiAocmVmID09PSBudWxsKSByZXR1cm47XG4gICAgICAgIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAgICAgICAuaW52b2tlKFwiY29kZXhwcDpzZXQtdXBkYXRlLWNvbmZpZ1wiLCB7XG4gICAgICAgICAgICB1cGRhdGVDaGFubmVsOiBcImN1c3RvbVwiLFxuICAgICAgICAgICAgdXBkYXRlUmVwbzogcmVwbyxcbiAgICAgICAgICAgIHVwZGF0ZVJlZjogcmVmLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4oKCkgPT4gcmVmcmVzaENvbmZpZ0NhcmQocm93KSlcbiAgICAgICAgICAuY2F0Y2goKGUpID0+IHBsb2coXCJzZXQgY3VzdG9tIHVwZGF0ZSBzb3VyY2UgZmFpbGVkXCIsIFN0cmluZyhlKSkpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiBpbnN0YWxsYXRpb25Tb3VyY2VSb3coc291cmNlOiBJbnN0YWxsYXRpb25Tb3VyY2UpOiBIVE1MRWxlbWVudCB7XG4gIHJldHVybiByb3dTaW1wbGUoXCJJbnN0YWxsYXRpb24gc291cmNlXCIsIGAke3NvdXJjZS5sYWJlbH06ICR7c291cmNlLmRldGFpbH1gKTtcbn1cblxuZnVuY3Rpb24gc2VsZlVwZGF0ZVN0YXR1c1JvdyhzdGF0ZTogU2VsZlVwZGF0ZVN0YXRlIHwgbnVsbCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gcm93U2ltcGxlKFwiTGFzdCBDb2RleCsrIHVwZGF0ZVwiLCBzZWxmVXBkYXRlU3VtbWFyeShzdGF0ZSkpO1xuICBjb25zdCBsZWZ0ID0gcm93LmZpcnN0RWxlbWVudENoaWxkIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGxlZnQgJiYgc3RhdGUpIGxlZnQucHJlcGVuZChzdGF0dXNCYWRnZShzZWxmVXBkYXRlU3RhdHVzVG9uZShzdGF0ZS5zdGF0dXMpLCBzZWxmVXBkYXRlU3RhdHVzTGFiZWwoc3RhdGUuc3RhdHVzKSkpO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiBjaGVja0ZvclVwZGF0ZXNSb3coY29uZmlnOiBDb2RleFBsdXNQbHVzQ29uZmlnKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBjaGVjayA9IGNvbmZpZy51cGRhdGVDaGVjaztcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcm93LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00IHAtM1wiO1xuICBjb25zdCBsZWZ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbGVmdC5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LWNvbCBnYXAtMVwiO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHRpdGxlLnRleHRDb250ZW50ID0gY2hlY2s/LnVwZGF0ZUF2YWlsYWJsZSA/IFwiQ29kZXgrKyB1cGRhdGUgYXZhaWxhYmxlXCIgOiBcIkNoZWNrIGZvciBDb2RleCsrIHVwZGF0ZXNcIjtcbiAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGRlc2MuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5IG1pbi13LTAgdGV4dC1zbVwiO1xuICBkZXNjLnRleHRDb250ZW50ID0gdXBkYXRlU3VtbWFyeShjaGVjayk7XG4gIGxlZnQuYXBwZW5kQ2hpbGQodGl0bGUpO1xuICBsZWZ0LmFwcGVuZENoaWxkKGRlc2MpO1xuICByb3cuYXBwZW5kQ2hpbGQobGVmdCk7XG5cbiAgY29uc3QgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbnMuY2xhc3NOYW1lID0gXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMlwiO1xuICBpZiAoY2hlY2s/LnJlbGVhc2VVcmwpIHtcbiAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgY29tcGFjdEJ1dHRvbihcIlJlbGVhc2UgTm90ZXNcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLCBjaGVjay5yZWxlYXNlVXJsKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbiAgYWN0aW9ucy5hcHBlbmRDaGlsZChcbiAgICBjb21wYWN0QnV0dG9uKFwiQ2hlY2sgTm93XCIsICgpID0+IHtcbiAgICAgIHJvdy5zdHlsZS5vcGFjaXR5ID0gXCIwLjY1XCI7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgICAgIC5pbnZva2UoXCJjb2RleHBwOmNoZWNrLWNvZGV4cHAtdXBkYXRlXCIsIHRydWUpXG4gICAgICAgIC50aGVuKCgpID0+IHJlZnJlc2hDb25maWdDYXJkKHJvdykpXG4gICAgICAgIC5jYXRjaCgoZSkgPT4gcGxvZyhcIkNvZGV4KysgcmVsZWFzZSBjaGVjayBmYWlsZWRcIiwgU3RyaW5nKGUpKSlcbiAgICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgIHJvdy5zdHlsZS5vcGFjaXR5ID0gXCJcIjtcbiAgICAgICAgfSk7XG4gICAgfSksXG4gICk7XG4gIGFjdGlvbnMuYXBwZW5kQ2hpbGQoXG4gICAgY29tcGFjdEJ1dHRvbihcIkRvd25sb2FkIFVwZGF0ZVwiLCAoKSA9PiB7XG4gICAgICByb3cuc3R5bGUub3BhY2l0eSA9IFwiMC42NVwiO1xuICAgICAgY29uc3QgYnV0dG9ucyA9IGFjdGlvbnMucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKTtcbiAgICAgIGJ1dHRvbnMuZm9yRWFjaCgoYnV0dG9uKSA9PiAoYnV0dG9uLmRpc2FibGVkID0gdHJ1ZSkpO1xuICAgICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgICAuaW52b2tlKFwiY29kZXhwcDpydW4tY29kZXhwcC11cGRhdGVcIilcbiAgICAgICAgLnRoZW4oKCkgPT4gcmVmcmVzaENvbmZpZ0NhcmQocm93KSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgcGxvZyhcIkNvZGV4Kysgc2VsZi11cGRhdGUgZmFpbGVkXCIsIFN0cmluZyhlKSk7XG4gICAgICAgICAgdm9pZCByZWZyZXNoQ29uZmlnQ2FyZChyb3cpO1xuICAgICAgICB9KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgcm93LnN0eWxlLm9wYWNpdHkgPSBcIlwiO1xuICAgICAgICAgIGJ1dHRvbnMuZm9yRWFjaCgoYnV0dG9uKSA9PiAoYnV0dG9uLmRpc2FibGVkID0gZmFsc2UpKTtcbiAgICAgICAgfSk7XG4gICAgfSksXG4gICk7XG4gIHJvdy5hcHBlbmRDaGlsZChhY3Rpb25zKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gcmVsZWFzZU5vdGVzUm93KGNoZWNrOiBDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2spOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJvdy5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTIgcC0zXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJ0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHRpdGxlLnRleHRDb250ZW50ID0gXCJMYXRlc3QgcmVsZWFzZSBub3Rlc1wiO1xuICByb3cuYXBwZW5kQ2hpbGQodGl0bGUpO1xuICBjb25zdCBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYm9keS5jbGFzc05hbWUgPVxuICAgIFwibWF4LWgtNjAgb3ZlcmZsb3ctYXV0byByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLWZvcmVncm91bmQvNSBwLTMgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIGJvZHkuYXBwZW5kQ2hpbGQocmVuZGVyUmVsZWFzZU5vdGVzTWFya2Rvd24oY2hlY2sucmVsZWFzZU5vdGVzPy50cmltKCkgfHwgY2hlY2suZXJyb3IgfHwgXCJObyByZWxlYXNlIG5vdGVzIGF2YWlsYWJsZS5cIikpO1xuICByb3cuYXBwZW5kQ2hpbGQoYm9keSk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclJlbGVhc2VOb3Rlc01hcmtkb3duKG1hcmtkb3duOiBzdHJpbmcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb290LmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICBjb25zdCBsaW5lcyA9IG1hcmtkb3duLnJlcGxhY2UoL1xcclxcbj8vZywgXCJcXG5cIikuc3BsaXQoXCJcXG5cIik7XG4gIGxldCBwYXJhZ3JhcGg6IHN0cmluZ1tdID0gW107XG4gIGxldCBsaXN0OiBIVE1MT0xpc3RFbGVtZW50IHwgSFRNTFVMaXN0RWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBsZXQgY29kZUxpbmVzOiBzdHJpbmdbXSB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0IGZsdXNoUGFyYWdyYXBoID0gKCkgPT4ge1xuICAgIGlmIChwYXJhZ3JhcGgubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgY29uc3QgcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xuICAgIHAuY2xhc3NOYW1lID0gXCJtLTAgbGVhZGluZy01XCI7XG4gICAgYXBwZW5kSW5saW5lTWFya2Rvd24ocCwgcGFyYWdyYXBoLmpvaW4oXCIgXCIpLnRyaW0oKSk7XG4gICAgcm9vdC5hcHBlbmRDaGlsZChwKTtcbiAgICBwYXJhZ3JhcGggPSBbXTtcbiAgfTtcbiAgY29uc3QgZmx1c2hMaXN0ID0gKCkgPT4ge1xuICAgIGlmICghbGlzdCkgcmV0dXJuO1xuICAgIHJvb3QuYXBwZW5kQ2hpbGQobGlzdCk7XG4gICAgbGlzdCA9IG51bGw7XG4gIH07XG4gIGNvbnN0IGZsdXNoQ29kZSA9ICgpID0+IHtcbiAgICBpZiAoIWNvZGVMaW5lcykgcmV0dXJuO1xuICAgIGNvbnN0IHByZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwcmVcIik7XG4gICAgcHJlLmNsYXNzTmFtZSA9XG4gICAgICBcIm0tMCBvdmVyZmxvdy1hdXRvIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tZm9yZWdyb3VuZC8xMCBwLTIgdGV4dC14cyB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICAgIGNvbnN0IGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY29kZVwiKTtcbiAgICBjb2RlLnRleHRDb250ZW50ID0gY29kZUxpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgcHJlLmFwcGVuZENoaWxkKGNvZGUpO1xuICAgIHJvb3QuYXBwZW5kQ2hpbGQocHJlKTtcbiAgICBjb2RlTGluZXMgPSBudWxsO1xuICB9O1xuXG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgIGlmIChsaW5lLnRyaW0oKS5zdGFydHNXaXRoKFwiYGBgXCIpKSB7XG4gICAgICBpZiAoY29kZUxpbmVzKSBmbHVzaENvZGUoKTtcbiAgICAgIGVsc2Uge1xuICAgICAgICBmbHVzaFBhcmFncmFwaCgpO1xuICAgICAgICBmbHVzaExpc3QoKTtcbiAgICAgICAgY29kZUxpbmVzID0gW107XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGNvZGVMaW5lcykge1xuICAgICAgY29kZUxpbmVzLnB1c2gobGluZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XG4gICAgaWYgKCF0cmltbWVkKSB7XG4gICAgICBmbHVzaFBhcmFncmFwaCgpO1xuICAgICAgZmx1c2hMaXN0KCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkaW5nID0gL14oI3sxLDN9KVxccysoLispJC8uZXhlYyh0cmltbWVkKTtcbiAgICBpZiAoaGVhZGluZykge1xuICAgICAgZmx1c2hQYXJhZ3JhcGgoKTtcbiAgICAgIGZsdXNoTGlzdCgpO1xuICAgICAgY29uc3QgaCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoaGVhZGluZ1sxXS5sZW5ndGggPT09IDEgPyBcImgzXCIgOiBcImg0XCIpO1xuICAgICAgaC5jbGFzc05hbWUgPSBcIm0tMCB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gICAgICBhcHBlbmRJbmxpbmVNYXJrZG93bihoLCBoZWFkaW5nWzJdKTtcbiAgICAgIHJvb3QuYXBwZW5kQ2hpbGQoaCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB1bm9yZGVyZWQgPSAvXlstKl1cXHMrKC4rKSQvLmV4ZWModHJpbW1lZCk7XG4gICAgY29uc3Qgb3JkZXJlZCA9IC9eXFxkK1suKV1cXHMrKC4rKSQvLmV4ZWModHJpbW1lZCk7XG4gICAgaWYgKHVub3JkZXJlZCB8fCBvcmRlcmVkKSB7XG4gICAgICBmbHVzaFBhcmFncmFwaCgpO1xuICAgICAgY29uc3Qgd2FudE9yZGVyZWQgPSBCb29sZWFuKG9yZGVyZWQpO1xuICAgICAgaWYgKCFsaXN0IHx8ICh3YW50T3JkZXJlZCAmJiBsaXN0LnRhZ05hbWUgIT09IFwiT0xcIikgfHwgKCF3YW50T3JkZXJlZCAmJiBsaXN0LnRhZ05hbWUgIT09IFwiVUxcIikpIHtcbiAgICAgICAgZmx1c2hMaXN0KCk7XG4gICAgICAgIGxpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHdhbnRPcmRlcmVkID8gXCJvbFwiIDogXCJ1bFwiKTtcbiAgICAgICAgbGlzdC5jbGFzc05hbWUgPSB3YW50T3JkZXJlZFxuICAgICAgICAgID8gXCJtLTAgbGlzdC1kZWNpbWFsIHNwYWNlLXktMSBwbC01IGxlYWRpbmctNVwiXG4gICAgICAgICAgOiBcIm0tMCBsaXN0LWRpc2Mgc3BhY2UteS0xIHBsLTUgbGVhZGluZy01XCI7XG4gICAgICB9XG4gICAgICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICAgIGFwcGVuZElubGluZU1hcmtkb3duKGxpLCAodW5vcmRlcmVkID8/IG9yZGVyZWQpPy5bMV0gPz8gXCJcIik7XG4gICAgICBsaXN0LmFwcGVuZENoaWxkKGxpKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHF1b3RlID0gL14+XFxzPyguKykkLy5leGVjKHRyaW1tZWQpO1xuICAgIGlmIChxdW90ZSkge1xuICAgICAgZmx1c2hQYXJhZ3JhcGgoKTtcbiAgICAgIGZsdXNoTGlzdCgpO1xuICAgICAgY29uc3QgYmxvY2txdW90ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJibG9ja3F1b3RlXCIpO1xuICAgICAgYmxvY2txdW90ZS5jbGFzc05hbWUgPSBcIm0tMCBib3JkZXItbC0yIGJvcmRlci10b2tlbi1ib3JkZXIgcGwtMyBsZWFkaW5nLTVcIjtcbiAgICAgIGFwcGVuZElubGluZU1hcmtkb3duKGJsb2NrcXVvdGUsIHF1b3RlWzFdKTtcbiAgICAgIHJvb3QuYXBwZW5kQ2hpbGQoYmxvY2txdW90ZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwYXJhZ3JhcGgucHVzaCh0cmltbWVkKTtcbiAgfVxuXG4gIGZsdXNoUGFyYWdyYXBoKCk7XG4gIGZsdXNoTGlzdCgpO1xuICBmbHVzaENvZGUoKTtcbiAgcmV0dXJuIHJvb3Q7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZElubGluZU1hcmtkb3duKHBhcmVudDogSFRNTEVsZW1lbnQsIHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBwYXR0ZXJuID0gLyhgKFteYF0rKWB8XFxbKFteXFxdXSspXFxdXFwoKGh0dHBzPzpcXC9cXC9bXlxccyldKylcXCl8XFwqXFwqKFteKl0rKVxcKlxcKnxcXCooW14qXSspXFwqKS9nO1xuICBsZXQgbGFzdEluZGV4ID0gMDtcbiAgZm9yIChjb25zdCBtYXRjaCBvZiB0ZXh0Lm1hdGNoQWxsKHBhdHRlcm4pKSB7XG4gICAgaWYgKG1hdGNoLmluZGV4ID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuICAgIGFwcGVuZFRleHQocGFyZW50LCB0ZXh0LnNsaWNlKGxhc3RJbmRleCwgbWF0Y2guaW5kZXgpKTtcbiAgICBpZiAobWF0Y2hbMl0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgY29kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjb2RlXCIpO1xuICAgICAgY29kZS5jbGFzc05hbWUgPVxuICAgICAgICBcInJvdW5kZWQgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tZm9yZWdyb3VuZC8xMCBweC0xIHB5LTAuNSB0ZXh0LXhzIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gICAgICBjb2RlLnRleHRDb250ZW50ID0gbWF0Y2hbMl07XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoY29kZSk7XG4gICAgfSBlbHNlIGlmIChtYXRjaFszXSAhPT0gdW5kZWZpbmVkICYmIG1hdGNoWzRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcbiAgICAgIGEuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtcHJpbWFyeSB1bmRlcmxpbmUgdW5kZXJsaW5lLW9mZnNldC0yXCI7XG4gICAgICBhLmhyZWYgPSBtYXRjaFs0XTtcbiAgICAgIGEudGFyZ2V0ID0gXCJfYmxhbmtcIjtcbiAgICAgIGEucmVsID0gXCJub29wZW5lciBub3JlZmVycmVyXCI7XG4gICAgICBhLnRleHRDb250ZW50ID0gbWF0Y2hbM107XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoYSk7XG4gICAgfSBlbHNlIGlmIChtYXRjaFs1XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBzdHJvbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3Ryb25nXCIpO1xuICAgICAgc3Ryb25nLmNsYXNzTmFtZSA9IFwiZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgICAgIHN0cm9uZy50ZXh0Q29udGVudCA9IG1hdGNoWzVdO1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKHN0cm9uZyk7XG4gICAgfSBlbHNlIGlmIChtYXRjaFs2XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJlbVwiKTtcbiAgICAgIGVtLnRleHRDb250ZW50ID0gbWF0Y2hbNl07XG4gICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoZW0pO1xuICAgIH1cbiAgICBsYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgfVxuICBhcHBlbmRUZXh0KHBhcmVudCwgdGV4dC5zbGljZShsYXN0SW5kZXgpKTtcbn1cblxuZnVuY3Rpb24gYXBwZW5kVGV4dChwYXJlbnQ6IEhUTUxFbGVtZW50LCB0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKHRleHQpIHBhcmVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlcldhdGNoZXJIZWFsdGhDYXJkKGNhcmQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAuaW52b2tlKFwiY29kZXhwcDpnZXQtd2F0Y2hlci1oZWFsdGhcIilcbiAgICAudGhlbigoaGVhbHRoKSA9PiB7XG4gICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgIHJlbmRlcldhdGNoZXJIZWFsdGgoY2FyZCwgaGVhbHRoIGFzIFdhdGNoZXJIZWFsdGgpO1xuICAgIH0pXG4gICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgIGNhcmQuYXBwZW5kQ2hpbGQocm93U2ltcGxlKFwiQ291bGQgbm90IGNoZWNrIHdhdGNoZXJcIiwgU3RyaW5nKGUpKSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlcldhdGNoZXJIZWFsdGgoY2FyZDogSFRNTEVsZW1lbnQsIGhlYWx0aDogV2F0Y2hlckhlYWx0aCk6IHZvaWQge1xuICBjYXJkLmFwcGVuZENoaWxkKHdhdGNoZXJTdW1tYXJ5Um93KGhlYWx0aCkpO1xuICBmb3IgKGNvbnN0IGNoZWNrIG9mIGhlYWx0aC5jaGVja3MpIHtcbiAgICBpZiAoY2hlY2suc3RhdHVzID09PSBcIm9rXCIpIGNvbnRpbnVlO1xuICAgIGNhcmQuYXBwZW5kQ2hpbGQod2F0Y2hlckNoZWNrUm93KGNoZWNrKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gd2F0Y2hlclN1bW1hcnlSb3coaGVhbHRoOiBXYXRjaGVySGVhbHRoKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGl0ZW1zLXN0YXJ0IGdhcC0zXCI7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoc3RhdHVzQmFkZ2UoaGVhbHRoLnN0YXR1cywgaGVhbHRoLndhdGNoZXIpKTtcbiAgY29uc3Qgc3RhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBzdGFjay5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LWNvbCBnYXAtMVwiO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHRpdGxlLnRleHRDb250ZW50ID0gaGVhbHRoLnRpdGxlO1xuICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZGVzYy5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gIGRlc2MudGV4dENvbnRlbnQgPSBgJHtoZWFsdGguc3VtbWFyeX0gQ2hlY2tlZCAke25ldyBEYXRlKGhlYWx0aC5jaGVja2VkQXQpLnRvTG9jYWxlU3RyaW5nKCl9LmA7XG4gIHN0YWNrLmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgc3RhY2suYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoc3RhY2spO1xuICByb3cuYXBwZW5kQ2hpbGQobGVmdCk7XG5cbiAgY29uc3QgYWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYWN0aW9uLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgYWN0aW9uLmFwcGVuZENoaWxkKFxuICAgIGNvbXBhY3RCdXR0b24oXCJDaGVjayBOb3dcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgY2FyZCA9IHJvdy5wYXJlbnRFbGVtZW50O1xuICAgICAgaWYgKCFjYXJkKSByZXR1cm47XG4gICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgIGNhcmQuYXBwZW5kQ2hpbGQocm93U2ltcGxlKFwiQ2hlY2tpbmcgd2F0Y2hlclwiLCBcIlZlcmlmeWluZyB0aGUgdXBkYXRlciByZXBhaXIgc2VydmljZS5cIikpO1xuICAgICAgcmVuZGVyV2F0Y2hlckhlYWx0aENhcmQoY2FyZCk7XG4gICAgfSksXG4gICk7XG4gIHJvdy5hcHBlbmRDaGlsZChhY3Rpb24pO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiB3YXRjaGVyQ2hlY2tSb3coY2hlY2s6IFdhdGNoZXJIZWFsdGhDaGVjayk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gcm93U2ltcGxlKGNoZWNrLm5hbWUsIGNoZWNrLmRldGFpbCk7XG4gIGNvbnN0IGxlZnQgPSByb3cuZmlyc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAobGVmdCkgbGVmdC5wcmVwZW5kKHN0YXR1c0JhZGdlKGNoZWNrLnN0YXR1cykpO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiBzdGF0dXNCYWRnZShzdGF0dXM6IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiLCBsYWJlbD86IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgY29uc3QgdG9uZSA9XG4gICAgc3RhdHVzID09PSBcIm9rXCJcbiAgICAgID8gXCJib3JkZXItdG9rZW4tY2hhcnRzLWdyZWVuIHRleHQtdG9rZW4tY2hhcnRzLWdyZWVuXCJcbiAgICAgIDogc3RhdHVzID09PSBcIndhcm5cIlxuICAgICAgICA/IFwiYm9yZGVyLXRva2VuLWNoYXJ0cy15ZWxsb3cgdGV4dC10b2tlbi1jaGFydHMteWVsbG93XCJcbiAgICAgICAgOiBcImJvcmRlci10b2tlbi1jaGFydHMtcmVkIHRleHQtdG9rZW4tY2hhcnRzLXJlZFwiO1xuICBiYWRnZS5jbGFzc05hbWUgPSBgaW5saW5lLWZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIHJvdW5kZWQtZnVsbCBib3JkZXIgcHgtMiBweS0wLjUgdGV4dC14cyBmb250LW1lZGl1bSAke3RvbmV9YDtcbiAgYmFkZ2UudGV4dENvbnRlbnQgPSBsYWJlbCB8fCAoc3RhdHVzID09PSBcIm9rXCIgPyBcIk9LXCIgOiBzdGF0dXMgPT09IFwid2FyblwiID8gXCJSZXZpZXdcIiA6IFwiRXJyb3JcIik7XG4gIHJldHVybiBiYWRnZTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlU3VtbWFyeShjaGVjazogQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrIHwgbnVsbCk6IHN0cmluZyB7XG4gIGlmICghY2hlY2spIHJldHVybiBcIk5vIHVwZGF0ZSBjaGVjayBoYXMgcnVuIHlldC5cIjtcbiAgY29uc3QgbGF0ZXN0ID0gY2hlY2subGF0ZXN0VmVyc2lvbiA/IGBMYXRlc3QgdiR7Y2hlY2subGF0ZXN0VmVyc2lvbn0uIGAgOiBcIlwiO1xuICBjb25zdCBjaGVja2VkID0gYENoZWNrZWQgJHtuZXcgRGF0ZShjaGVjay5jaGVja2VkQXQpLnRvTG9jYWxlU3RyaW5nKCl9LmA7XG4gIGlmIChjaGVjay5lcnJvcikgcmV0dXJuIGAke2xhdGVzdH0ke2NoZWNrZWR9ICR7Y2hlY2suZXJyb3J9YDtcbiAgcmV0dXJuIGAke2xhdGVzdH0ke2NoZWNrZWR9YDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ2hhbm5lbFN1bW1hcnkoY29uZmlnOiBDb2RleFBsdXNQbHVzQ29uZmlnKTogc3RyaW5nIHtcbiAgaWYgKGNvbmZpZy51cGRhdGVDaGFubmVsID09PSBcImN1c3RvbVwiKSB7XG4gICAgcmV0dXJuIGAke2NvbmZpZy51cGRhdGVSZXBvIHx8IFwiYi1ubmV0dC9jb2RleC1wbHVzcGx1c1wifSAke2NvbmZpZy51cGRhdGVSZWYgfHwgXCIobm8gcmVmIHNldClcIn1gO1xuICB9XG4gIGlmIChjb25maWcudXBkYXRlQ2hhbm5lbCA9PT0gXCJwcmVyZWxlYXNlXCIpIHtcbiAgICByZXR1cm4gXCJVc2UgdGhlIG5ld2VzdCBwdWJsaXNoZWQgR2l0SHViIHJlbGVhc2UsIGluY2x1ZGluZyBwcmVyZWxlYXNlcy5cIjtcbiAgfVxuICByZXR1cm4gXCJVc2UgdGhlIGxhdGVzdCBzdGFibGUgR2l0SHViIHJlbGVhc2UuXCI7XG59XG5cbmZ1bmN0aW9uIHNlbGZVcGRhdGVTdW1tYXJ5KHN0YXRlOiBTZWxmVXBkYXRlU3RhdGUgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFzdGF0ZSkgcmV0dXJuIFwiTm8gYXV0b21hdGljIENvZGV4KysgdXBkYXRlIGhhcyBydW4geWV0LlwiO1xuICBjb25zdCBjaGVja2VkID0gbmV3IERhdGUoc3RhdGUuY29tcGxldGVkQXQgPz8gc3RhdGUuY2hlY2tlZEF0KS50b0xvY2FsZVN0cmluZygpO1xuICBjb25zdCB0YXJnZXQgPSBzdGF0ZS5sYXRlc3RWZXJzaW9uID8gYCBUYXJnZXQgdiR7c3RhdGUubGF0ZXN0VmVyc2lvbn0uYCA6IHN0YXRlLnRhcmdldFJlZiA/IGAgVGFyZ2V0ICR7c3RhdGUudGFyZ2V0UmVmfS5gIDogXCJcIjtcbiAgY29uc3Qgc291cmNlID0gc3RhdGUuaW5zdGFsbGF0aW9uU291cmNlPy5sYWJlbCA/PyBcInVua25vd24gc291cmNlXCI7XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwiZmFpbGVkXCIpIHJldHVybiBgRmFpbGVkICR7Y2hlY2tlZH0uJHt0YXJnZXR9ICR7c3RhdGUuZXJyb3IgPz8gXCJVbmtub3duIGVycm9yXCJ9YDtcbiAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gXCJ1cGRhdGVkXCIpIHJldHVybiBgVXBkYXRlZCAke2NoZWNrZWR9LiR7dGFyZ2V0fSBTb3VyY2U6ICR7c291cmNlfS5gO1xuICBpZiAoc3RhdGUuc3RhdHVzID09PSBcInVwLXRvLWRhdGVcIikgcmV0dXJuIGBVcCB0byBkYXRlICR7Y2hlY2tlZH0uJHt0YXJnZXR9IFNvdXJjZTogJHtzb3VyY2V9LmA7XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwiZGlzYWJsZWRcIikgcmV0dXJuIGBTa2lwcGVkICR7Y2hlY2tlZH07IGF1dG9tYXRpYyByZWZyZXNoIGlzIGRpc2FibGVkLmA7XG4gIHJldHVybiBgQ2hlY2tpbmcgZm9yIHVwZGF0ZXMuIFNvdXJjZTogJHtzb3VyY2V9LmA7XG59XG5cbmZ1bmN0aW9uIHNlbGZVcGRhdGVTdGF0dXNUb25lKHN0YXR1czogU2VsZlVwZGF0ZVN0YXR1cyk6IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiIHtcbiAgaWYgKHN0YXR1cyA9PT0gXCJmYWlsZWRcIikgcmV0dXJuIFwiZXJyb3JcIjtcbiAgaWYgKHN0YXR1cyA9PT0gXCJkaXNhYmxlZFwiIHx8IHN0YXR1cyA9PT0gXCJjaGVja2luZ1wiKSByZXR1cm4gXCJ3YXJuXCI7XG4gIHJldHVybiBcIm9rXCI7XG59XG5cbmZ1bmN0aW9uIHNlbGZVcGRhdGVTdGF0dXNMYWJlbChzdGF0dXM6IFNlbGZVcGRhdGVTdGF0dXMpOiBzdHJpbmcge1xuICBpZiAoc3RhdHVzID09PSBcInVwLXRvLWRhdGVcIikgcmV0dXJuIFwiVXAgdG8gZGF0ZVwiO1xuICBpZiAoc3RhdHVzID09PSBcInVwZGF0ZWRcIikgcmV0dXJuIFwiVXBkYXRlZFwiO1xuICBpZiAoc3RhdHVzID09PSBcImZhaWxlZFwiKSByZXR1cm4gXCJGYWlsZWRcIjtcbiAgaWYgKHN0YXR1cyA9PT0gXCJkaXNhYmxlZFwiKSByZXR1cm4gXCJEaXNhYmxlZFwiO1xuICByZXR1cm4gXCJDaGVja2luZ1wiO1xufVxuXG5mdW5jdGlvbiByZWZyZXNoQ29uZmlnQ2FyZChyb3c6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IGNhcmQgPSByb3cuY2xvc2VzdChcIltkYXRhLWNvZGV4cHAtY29uZmlnLWNhcmRdXCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFjYXJkKSByZXR1cm47XG4gIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICBjYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIlJlZnJlc2hpbmdcIiwgXCJMb2FkaW5nIGN1cnJlbnQgQ29kZXgrKyB1cGRhdGUgc3RhdHVzLlwiKSk7XG4gIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAuaW52b2tlKFwiY29kZXhwcDpnZXQtY29uZmlnXCIpXG4gICAgLnRoZW4oKGNvbmZpZykgPT4ge1xuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICByZW5kZXJDb2RleFBsdXNQbHVzQ29uZmlnKGNhcmQsIGNvbmZpZyBhcyBDb2RleFBsdXNQbHVzQ29uZmlnKTtcbiAgICB9KVxuICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICBjYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIkNvdWxkIG5vdCByZWZyZXNoIHVwZGF0ZSBzZXR0aW5nc1wiLCBTdHJpbmcoZSkpKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gdW5pbnN0YWxsUm93KCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gYWN0aW9uUm93KFxuICAgIFwiVW5pbnN0YWxsIENvZGV4KytcIixcbiAgICBcIkNvcGllcyB0aGUgdW5pbnN0YWxsIGNvbW1hbmQuIFJ1biBpdCBmcm9tIGEgdGVybWluYWwgYWZ0ZXIgcXVpdHRpbmcgQ29kZXguXCIsXG4gICk7XG4gIGNvbnN0IGFjdGlvbiA9IHJvdy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIltkYXRhLWNvZGV4cHAtcm93LWFjdGlvbnNdXCIpO1xuICBhY3Rpb24/LmFwcGVuZENoaWxkKFxuICAgIGNvbXBhY3RCdXR0b24oXCJDb3B5IENvbW1hbmRcIiwgKCkgPT4ge1xuICAgICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgICAuaW52b2tlKFwiY29kZXhwcDpjb3B5LXRleHRcIiwgXCJub2RlIH4vLmNvZGV4LXBsdXNwbHVzL3NvdXJjZS9wYWNrYWdlcy9pbnN0YWxsZXIvZGlzdC9jbGkuanMgdW5pbnN0YWxsXCIpXG4gICAgICAgIC5jYXRjaCgoZSkgPT4gcGxvZyhcImNvcHkgdW5pbnN0YWxsIGNvbW1hbmQgZmFpbGVkXCIsIFN0cmluZyhlKSkpO1xuICAgIH0pLFxuICApO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiByZXBvcnRCdWdSb3coKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBhY3Rpb25Sb3coXG4gICAgXCJSZXBvcnQgYSBidWdcIixcbiAgICBcIk9wZW4gYSBHaXRIdWIgaXNzdWUgd2l0aCBydW50aW1lLCBpbnN0YWxsZXIsIG9yIHR3ZWFrLW1hbmFnZXIgZGV0YWlscy5cIixcbiAgKTtcbiAgY29uc3QgYWN0aW9uID0gcm93LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiW2RhdGEtY29kZXhwcC1yb3ctYWN0aW9uc11cIik7XG4gIGFjdGlvbj8uYXBwZW5kQ2hpbGQoXG4gICAgY29tcGFjdEJ1dHRvbihcIk9wZW4gSXNzdWVcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGl0bGUgPSBlbmNvZGVVUklDb21wb25lbnQoXCJbQnVnXTogXCIpO1xuICAgICAgY29uc3QgYm9keSA9IGVuY29kZVVSSUNvbXBvbmVudChcbiAgICAgICAgW1xuICAgICAgICAgIFwiIyMgV2hhdCBoYXBwZW5lZD9cIixcbiAgICAgICAgICBcIlwiLFxuICAgICAgICAgIFwiIyMgU3RlcHMgdG8gcmVwcm9kdWNlXCIsXG4gICAgICAgICAgXCIxLiBcIixcbiAgICAgICAgICBcIlwiLFxuICAgICAgICAgIFwiIyMgRW52aXJvbm1lbnRcIixcbiAgICAgICAgICBcIi0gQ29kZXgrKyB2ZXJzaW9uOiBcIixcbiAgICAgICAgICBcIi0gQ29kZXggYXBwIHZlcnNpb246IFwiLFxuICAgICAgICAgIFwiLSBPUzogXCIsXG4gICAgICAgICAgXCJcIixcbiAgICAgICAgICBcIiMjIExvZ3NcIixcbiAgICAgICAgICBcIkF0dGFjaCByZWxldmFudCBsaW5lcyBmcm9tIHRoZSBDb2RleCsrIGxvZyBkaXJlY3RvcnkuXCIsXG4gICAgICAgIF0uam9pbihcIlxcblwiKSxcbiAgICAgICk7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcbiAgICAgICAgXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIixcbiAgICAgICAgYGh0dHBzOi8vZ2l0aHViLmNvbS9iLW5uZXR0L2NvZGV4LXBsdXNwbHVzL2lzc3Vlcy9uZXc/dGl0bGU9JHt0aXRsZX0mYm9keT0ke2JvZHl9YCxcbiAgICAgICk7XG4gICAgfSksXG4gICk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIGFjdGlvblJvdyh0aXRsZVRleHQ6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcm93LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00IHAtM1wiO1xuICBjb25zdCBsZWZ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbGVmdC5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LWNvbCBnYXAtMVwiO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHRpdGxlLnRleHRDb250ZW50ID0gdGl0bGVUZXh0O1xuICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgZGVzYy5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gIGRlc2MudGV4dENvbnRlbnQgPSBkZXNjcmlwdGlvbjtcbiAgbGVmdC5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIHJvdy5hcHBlbmRDaGlsZChsZWZ0KTtcbiAgY29uc3QgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbnMuZGF0YXNldC5jb2RleHBwUm93QWN0aW9ucyA9IFwidHJ1ZVwiO1xuICBhY3Rpb25zLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgcm93LmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiByZW5kZXJUd2Vha1N0b3JlUGFnZShcbiAgc2VjdGlvbnNXcmFwOiBIVE1MRWxlbWVudCxcbiAgaGVhZGVyQWN0aW9ucz86IEhUTUxFbGVtZW50LFxuKTogdm9pZCB7XG4gIGNvbnN0IHNlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiKTtcbiAgc2VjdGlvbi5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTRcIjtcblxuICBjb25zdCBzb3VyY2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgc291cmNlLmhpZGRlbiA9IHRydWU7XG4gIHNvdXJjZS5kYXRhc2V0LmNvZGV4cHBTdG9yZVNvdXJjZSA9IFwidHJ1ZVwiO1xuICBzb3VyY2UudGV4dENvbnRlbnQgPSBcIkxvYWRpbmcgbGl2ZSByZWdpc3RyeVwiO1xuXG4gIGNvbnN0IGFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBhY3Rpb25zLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgY29uc3QgcmVmcmVzaEJ0biA9IHN0b3JlSWNvbkJ1dHRvbihyZWZyZXNoSWNvblN2ZygpLCBcIlJlZnJlc2ggdHdlYWsgc3RvcmVcIiwgKCkgPT4ge1xuICAgIHJlZnJlc2hCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgIGdyaWQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgIGdyaWQuYXBwZW5kQ2hpbGQoc3RvcmVNZXNzYWdlQ2FyZChcIlJlZnJlc2hpbmcgdHdlYWsgc3RvcmVcIiwgXCJGZXRjaGluZyB0aGUgbGF0ZXN0IHJldmlld2VkIHJlZ2lzdHJ5IGZyb20gR2l0SHViLlwiKSk7XG4gICAgcmVmcmVzaFR3ZWFrU3RvcmVHcmlkKGdyaWQsIHNvdXJjZSwgcmVmcmVzaEJ0bik7XG4gIH0pO1xuICBhY3Rpb25zLmFwcGVuZENoaWxkKHJlZnJlc2hCdG4pO1xuICBhY3Rpb25zLmFwcGVuZENoaWxkKHN0b3JlVG9vbGJhckJ1dHRvbihcIlB1Ymxpc2ggVHdlYWtcIiwgb3BlblB1Ymxpc2hUd2Vha0RpYWxvZywgXCJwcmltYXJ5XCIpKTtcbiAgaWYgKGhlYWRlckFjdGlvbnMpIHtcbiAgICBoZWFkZXJBY3Rpb25zLnJlcGxhY2VDaGlsZHJlbihhY3Rpb25zKTtcbiAgfVxuXG4gIGNvbnN0IGdyaWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBncmlkLmRhdGFzZXQuY29kZXhwcFN0b3JlR3JpZCA9IFwidHJ1ZVwiO1xuICBncmlkLmNsYXNzTmFtZSA9IFwiZ3JpZCBnYXAtNFwiO1xuICBncmlkLmFwcGVuZENoaWxkKHN0b3JlTWVzc2FnZUNhcmQoXCJMb2FkaW5nIHR3ZWFrIHN0b3JlXCIsIFwiRmV0Y2hpbmcgcmV2aWV3ZWQgdHdlYWtzIGZyb20gdGhlIENvZGV4KysgcmVnaXN0cnkuXCIpKTtcbiAgc2VjdGlvbi5hcHBlbmRDaGlsZChncmlkKTtcbiAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHNlY3Rpb24pO1xuICByZWZyZXNoVHdlYWtTdG9yZUdyaWQoZ3JpZCwgc291cmNlLCByZWZyZXNoQnRuKTtcbn1cblxuZnVuY3Rpb24gcmVmcmVzaFR3ZWFrU3RvcmVHcmlkKFxuICBncmlkOiBIVE1MRWxlbWVudCxcbiAgc291cmNlOiBIVE1MRWxlbWVudCxcbiAgcmVmcmVzaEJ0bj86IEhUTUxCdXR0b25FbGVtZW50LFxuKTogdm9pZCB7XG4gIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAuaW52b2tlKFwiY29kZXhwcDpnZXQtdHdlYWstc3RvcmVcIilcbiAgICAudGhlbigoc3RvcmUpID0+IHtcbiAgICAgIGdyaWQuZGF0YXNldC5jb2RleHBwU3RvcmUgPSBKU09OLnN0cmluZ2lmeShzdG9yZSk7XG4gICAgICByZW5kZXJUd2Vha1N0b3JlR3JpZChncmlkLCBzb3VyY2UpO1xuICAgIH0pXG4gICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICBncmlkLmRhdGFzZXQuY29kZXhwcFN0b3JlID0gXCJcIjtcbiAgICAgIHNvdXJjZS50ZXh0Q29udGVudCA9IFwiTGl2ZSByZWdpc3RyeSB1bmF2YWlsYWJsZVwiO1xuICAgICAgZ3JpZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICBncmlkLmFwcGVuZENoaWxkKHN0b3JlTWVzc2FnZUNhcmQoXCJDb3VsZCBub3QgbG9hZCB0d2VhayBzdG9yZVwiLCBTdHJpbmcoZSkpKTtcbiAgICB9KVxuICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgIGlmIChyZWZyZXNoQnRuKSByZWZyZXNoQnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclR3ZWFrU3RvcmVHcmlkKGdyaWQ6IEhUTUxFbGVtZW50LCBzb3VyY2U6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IHN0b3JlID0gcGFyc2VTdG9yZURhdGFzZXQoZ3JpZCk7XG4gIGlmICghc3RvcmUpIHJldHVybjtcbiAgY29uc3QgZW50cmllcyA9IHN0b3JlLmVudHJpZXM7XG4gIHNvdXJjZS50ZXh0Q29udGVudCA9IGBSZWZyZXNoZWQgJHtuZXcgRGF0ZShzdG9yZS5mZXRjaGVkQXQpLnRvTG9jYWxlU3RyaW5nKCl9YDtcbiAgZ3JpZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gIGlmIChzdG9yZS5lbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIGdyaWQuYXBwZW5kQ2hpbGQoc3RvcmVNZXNzYWdlQ2FyZChcIk5vIHR3ZWFrcyB5ZXRcIiwgXCJVc2UgUHVibGlzaCBUd2VhayB0byBzdWJtaXQgdGhlIGZpcnN0IG9uZS5cIikpO1xuICAgIHJldHVybjtcbiAgfVxuICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIGdyaWQuYXBwZW5kQ2hpbGQodHdlYWtTdG9yZUNhcmQoZW50cnkpKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VTdG9yZURhdGFzZXQoZ3JpZDogSFRNTEVsZW1lbnQpOiBUd2Vha1N0b3JlUmVnaXN0cnlWaWV3IHwgbnVsbCB7XG4gIGNvbnN0IHJhdyA9IGdyaWQuZGF0YXNldC5jb2RleHBwU3RvcmU7XG4gIGlmICghcmF3KSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShyYXcpIGFzIFR3ZWFrU3RvcmVSZWdpc3RyeVZpZXc7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIHR3ZWFrU3RvcmVDYXJkKGVudHJ5OiBUd2Vha1N0b3JlRW50cnlWaWV3KTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBjYXJkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgY2FyZC5jbGFzc05hbWUgPVxuICAgIFwiYm9yZGVyLXRva2VuLWJvcmRlci80MCBmbGV4IG1pbi1oLVsxOTBweF0gZmxleC1jb2wganVzdGlmeS1iZXR3ZWVuIGdhcC00IHJvdW5kZWQtMnhsIGJvcmRlciBwLTQgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6YmctdG9rZW4tZm9yZWdyb3VuZC81XCI7XG5cbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC0xIGl0ZW1zLXN0YXJ0IGdhcC0zXCI7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoc3RvcmVBdmF0YXIoZW50cnkpKTtcblxuICBjb25zdCBzdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtMSBmbGV4LWNvbCBnYXAtMlwiO1xuICBjb25zdCB0aXRsZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlUm93LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBnYXAtM1wiO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwibWluLXctMCB0ZXh0LWJhc2UgZm9udC1tZWRpdW0gbGVhZGluZy02IHRleHQtdG9rZW4tZm9yZWdyb3VuZFwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IGVudHJ5Lm1hbmlmZXN0Lm5hbWU7XG4gIHRpdGxlUm93LmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgY29uc3QgdmVyc2lvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICB2ZXJzaW9uLmNsYXNzTmFtZSA9IFwic2hyaW5rLTAgdGV4dC14cyB0YWJ1bGFyLW51bXMgdGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kXCI7XG4gIHZlcnNpb24udGV4dENvbnRlbnQgPSBgdiR7ZW50cnkubWFuaWZlc3QudmVyc2lvbn1gO1xuICB0aXRsZVJvdy5hcHBlbmRDaGlsZCh2ZXJzaW9uKTtcbiAgc3RhY2suYXBwZW5kQ2hpbGQodGl0bGVSb3cpO1xuXG4gIGlmIChlbnRyeS5tYW5pZmVzdC5kZXNjcmlwdGlvbikge1xuICAgIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGRlc2MuY2xhc3NOYW1lID0gXCJsaW5lLWNsYW1wLTMgbWluLXctMCB0ZXh0LXNtIGxlYWRpbmctNSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gICAgZGVzYy50ZXh0Q29udGVudCA9IGVudHJ5Lm1hbmlmZXN0LmRlc2NyaXB0aW9uO1xuICAgIHN0YWNrLmFwcGVuZENoaWxkKGRlc2MpO1xuICB9XG5cbiAgY29uc3QgYmFkZ2VSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBiYWRnZVJvdy5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIGJhZGdlUm93LmFwcGVuZENoaWxkKHZlcmlmaWVkU2FmZUJhZGdlKCkpO1xuICBzdGFjay5hcHBlbmRDaGlsZChiYWRnZVJvdyk7XG5cbiAgbGVmdC5hcHBlbmRDaGlsZChzdGFjayk7XG4gIGNhcmQuYXBwZW5kQ2hpbGQobGVmdCk7XG5cbiAgY29uc3QgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbnMuY2xhc3NOYW1lID0gXCJtdC1hdXRvIGZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktZW5kIGdhcC0yXCI7XG4gIGlmIChlbnRyeS5yZWxlYXNlVXJsKSB7XG4gICAgYWN0aW9ucy5hcHBlbmRDaGlsZChcbiAgICAgIGNvbXBhY3RCdXR0b24oXCJSZWxlYXNlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgZW50cnkucmVsZWFzZVVybCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG4gIGlmIChlbnRyeS5pbnN0YWxsZWQgJiYgZW50cnkuaW5zdGFsbGVkLnZlcnNpb24gPT09IGVudHJ5Lm1hbmlmZXN0LnZlcnNpb24pIHtcbiAgICBhY3Rpb25zLmFwcGVuZENoaWxkKHN0b3JlU3RhdHVzUGlsbChcIkluc3RhbGxlZFwiKSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgaW5zdGFsbExhYmVsID0gZW50cnkuaW5zdGFsbGVkID8gXCJVcGRhdGVcIiA6IFwiSW5zdGFsbFwiO1xuICAgIGFjdGlvbnMuYXBwZW5kQ2hpbGQoXG4gICAgICBzdG9yZUluc3RhbGxCdXR0b24oaW5zdGFsbExhYmVsLCAoKSA9PiB7XG4gICAgICBjb25zdCBncmlkID0gY2FyZC5jbG9zZXN0KFwiW2RhdGEtY29kZXhwcC1zdG9yZS1ncmlkXVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICBjb25zdCBzb3VyY2UgPSBncmlkPy5wYXJlbnRFbGVtZW50Py5xdWVyeVNlbGVjdG9yKFwiW2RhdGEtY29kZXhwcC1zdG9yZS1zb3VyY2VdXCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgIGNhcmQuc3R5bGUub3BhY2l0eSA9IFwiMC42NVwiO1xuICAgICAgYWN0aW9ucy5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpLmZvckVhY2goKGJ1dHRvbikgPT4gKGJ1dHRvbi5kaXNhYmxlZCA9IHRydWUpKTtcbiAgICAgIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAgICAgLmludm9rZShcImNvZGV4cHA6aW5zdGFsbC1zdG9yZS10d2Vha1wiLCBlbnRyeS5pZClcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIGlmIChncmlkICYmIHNvdXJjZSkge1xuICAgICAgICAgICAgZ3JpZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgICAgICBncmlkLmFwcGVuZENoaWxkKHN0b3JlTWVzc2FnZUNhcmQoXCJJbnN0YWxsZWQgdHdlYWtcIiwgYCR7ZW50cnkubWFuaWZlc3QubmFtZX0gd2FzIGluc3RhbGxlZCBmcm9tIHRoZSBhcHByb3ZlZCBjb21taXQuYCkpO1xuICAgICAgICAgICAgcmVmcmVzaFR3ZWFrU3RvcmVHcmlkKGdyaWQsIHNvdXJjZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBjYXJkLnN0eWxlLm9wYWNpdHkgPSBcIlwiO1xuICAgICAgICAgIGFjdGlvbnMucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKS5mb3JFYWNoKChidXR0b24pID0+IChidXR0b24uZGlzYWJsZWQgPSBmYWxzZSkpO1xuICAgICAgICAgIHdpbmRvdy5hbGVydChgQ291bGQgbm90IGluc3RhbGwgJHtlbnRyeS5tYW5pZmVzdC5uYW1lfTogJHtTdHJpbmcoKGUgYXMgRXJyb3IpLm1lc3NhZ2UgPz8gZSl9YCk7XG4gICAgICAgIH0pO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuICBjYXJkLmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuICByZXR1cm4gY2FyZDtcbn1cblxuZnVuY3Rpb24gc3RvcmVBdmF0YXIoZW50cnk6IFR3ZWFrU3RvcmVFbnRyeVZpZXcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGF2YXRhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGF2YXRhci5jbGFzc05hbWUgPVxuICAgIFwiZmxleCBoLTEwIHctMTAgc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG92ZXJmbG93LWhpZGRlbiByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyLWRlZmF1bHQgYmctdHJhbnNwYXJlbnQgdGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kXCI7XG4gIGNvbnN0IGluaXRpYWwgPSAoZW50cnkubWFuaWZlc3QubmFtZT8uWzBdID8/IFwiP1wiKS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBmYWxsYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBmYWxsYmFjay50ZXh0Q29udGVudCA9IGluaXRpYWw7XG4gIGF2YXRhci5hcHBlbmRDaGlsZChmYWxsYmFjayk7XG4gIGNvbnN0IGljb25VcmwgPSBzdG9yZUVudHJ5SWNvblVybChlbnRyeSk7XG4gIGlmIChpY29uVXJsKSB7XG4gICAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcbiAgICBpbWcuYWx0ID0gXCJcIjtcbiAgICBpbWcuY2xhc3NOYW1lID0gXCJoLWZ1bGwgdy1mdWxsIG9iamVjdC1jb3ZlclwiO1xuICAgIGltZy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsICgpID0+IHtcbiAgICAgIGZhbGxiYWNrLnJlbW92ZSgpO1xuICAgICAgaW1nLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIH0pO1xuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgaW1nLnJlbW92ZSgpO1xuICAgIH0pO1xuICAgIGltZy5zcmMgPSBpY29uVXJsO1xuICAgIGF2YXRhci5hcHBlbmRDaGlsZChpbWcpO1xuICB9XG4gIHJldHVybiBhdmF0YXI7XG59XG5cbmZ1bmN0aW9uIHN0b3JlRW50cnlJY29uVXJsKGVudHJ5OiBUd2Vha1N0b3JlRW50cnlWaWV3KTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IGljb25VcmwgPSBlbnRyeS5tYW5pZmVzdC5pY29uVXJsPy50cmltKCk7XG4gIGlmICghaWNvblVybCkgcmV0dXJuIG51bGw7XG4gIGlmICgvXihodHRwcz86fGRhdGE6KS9pLnRlc3QoaWNvblVybCkpIHJldHVybiBpY29uVXJsO1xuICBjb25zdCByZWwgPSBpY29uVXJsLnJlcGxhY2UoL15cXC4/XFwvLywgXCJcIik7XG4gIGlmICghcmVsIHx8IHJlbC5zdGFydHNXaXRoKFwiLi4vXCIpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vJHtlbnRyeS5yZXBvfS8ke2VudHJ5LmFwcHJvdmVkQ29tbWl0U2hhfS8ke3JlbH1gO1xufVxuXG5mdW5jdGlvbiBzdG9yZVRvb2xiYXJCdXR0b24oXG4gIGxhYmVsOiBzdHJpbmcsXG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQsXG4gIHZhcmlhbnQ6IFwicHJpbWFyeVwiIHwgXCJzZWNvbmRhcnlcIiA9IFwic2Vjb25kYXJ5XCIsXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgdmFyaWFudCA9PT0gXCJwcmltYXJ5XCJcbiAgICAgID8gXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gZmxleCBoLTggaXRlbXMtY2VudGVyIGdhcC0xIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tYmctZm9nIHB4LTIgcHktMCB0ZXh0LXNtIHRleHQtdG9rZW4tYnV0dG9uLXRlcnRpYXJ5LWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDBcIlxuICAgICAgOiBcImJvcmRlci10b2tlbi1ib3JkZXIgdXNlci1zZWxlY3Qtbm9uZSBuby1kcmFnIGN1cnNvci1pbnRlcmFjdGlvbiBmbGV4IGgtOCBpdGVtcy1jZW50ZXIgZ2FwLTEgd2hpdGVzcGFjZS1ub3dyYXAgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXRyYW5zcGFyZW50IGJnLXRva2VuLWZvcmVncm91bmQvNSBweC0yIHB5LTAgdGV4dC1zbSB0ZXh0LXRva2VuLWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1mb3JlZ3JvdW5kLzEwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTQwXCI7XG4gIGJ0bi50ZXh0Q29udGVudCA9IGxhYmVsO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgb25DbGljaygpO1xuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gc3RvcmVJY29uQnV0dG9uKFxuICBpY29uU3ZnOiBzdHJpbmcsXG4gIGxhYmVsOiBzdHJpbmcsXG4gIG9uQ2xpY2s6ICgpID0+IHZvaWQsXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gZmxleCBoLTggdy04IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItdHJhbnNwYXJlbnQgYmctdG9rZW4tZm9yZWdyb3VuZC81IHAtMCB0ZXh0LXRva2VuLWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1mb3JlZ3JvdW5kLzEwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTQwXCI7XG4gIGJ0bi5pbm5lckhUTUwgPSBpY29uU3ZnO1xuICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBsYWJlbCk7XG4gIGJ0bi50aXRsZSA9IGxhYmVsO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgb25DbGljaygpO1xuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gcmVmcmVzaEljb25TdmcoKTogc3RyaW5nIHtcbiAgcmV0dXJuIChcbiAgICBgPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiBjbGFzcz1cImljb24teHNcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk00LjQgOS4zNUE1LjY1IDUuNjUgMCAwIDEgMTQgNS4zTDE1Ljc1IDdNMTUuNzUgMy43NVY3aC0zLjI1XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgIGA8cGF0aCBkPVwiTTE1LjYgMTAuNjVBNS42NSA1LjY1IDAgMCAxIDYgMTQuN0w0LjI1IDEzTTQuMjUgMTYuMjVWMTNINy41XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIHZlcmlmaWVkU2FmZUJhZGdlKCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgYmFkZ2UuY2xhc3NOYW1lID1cbiAgICBcImlubGluZS1mbGV4IGgtNyBpdGVtcy1jZW50ZXIgZ2FwLTEuNSByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1ibHVlLTUwMC8yNSBiZy1ibHVlLTUwMC8xMCBweC0yLjUgdGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LWJsdWUtNTAwXCI7XG4gIGJhZGdlLmlubmVySFRNTCA9XG4gICAgYDxzdmcgd2lkdGg9XCIxNFwiIGhlaWdodD1cIjE0XCIgdmlld0JveD1cIjAgMCAxNiAxNlwiIGZpbGw9XCJub25lXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNOCAxLjc1IDEzLjI1IDMuOHYzLjcyYzAgMy4yOC0yLjEyIDUuMzYtNS4yNSA2LjczLTMuMTMtMS4zNy01LjI1LTMuNDUtNS4yNS02LjczVjMuOEw4IDEuNzVaXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIG9wYWNpdHk9XCIuMTZcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNS4yNSA4LjE1IDcuMDUgOS45bDMuNy00LjA1XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41NVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICBgPC9zdmc+YCArXG4gICAgYDxzcGFuPlZlcmlmaWVkIGFzIHNhZmU8L3NwYW4+YDtcbiAgcmV0dXJuIGJhZGdlO1xufVxuXG5mdW5jdGlvbiBzdG9yZVN0YXR1c1BpbGwobGFiZWw6IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgcGlsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBwaWxsLmNsYXNzTmFtZSA9XG4gICAgXCJpbmxpbmUtZmxleCBoLTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgYmctdG9rZW4tZm9yZWdyb3VuZC81IHB4LTMgdGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmRcIjtcbiAgcGlsbC50ZXh0Q29udGVudCA9IGxhYmVsO1xuICByZXR1cm4gcGlsbDtcbn1cblxuZnVuY3Rpb24gc3RvcmVJbnN0YWxsQnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gZmxleCBoLTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1ibHVlLTUwMC80MCBiZy1ibHVlLTUwMCBweC0zIHB5LTAgdGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LXdoaXRlIHNoYWRvdy1zbSBlbmFibGVkOmhvdmVyOmJnLWJsdWUtNjAwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBkaXNhYmxlZDpvcGFjaXR5LTQwXCI7XG4gIGJ0bi50ZXh0Q29udGVudCA9IGxhYmVsO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgb25DbGljaygpO1xuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gc3RvcmVNZXNzYWdlQ2FyZCh0aXRsZTogc3RyaW5nLCBkZXNjcmlwdGlvbj86IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGNhcmQuY2xhc3NOYW1lID1cbiAgICBcImJvcmRlci10b2tlbi1ib3JkZXIvNDAgZmxleCBtaW4taC1bODRweF0gZmxleC1jb2wganVzdGlmeS1jZW50ZXIgZ2FwLTEgcm91bmRlZC0yeGwgYm9yZGVyIHAtNCB0ZXh0LXNtXCI7XG4gIGNvbnN0IHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0LmNsYXNzTmFtZSA9IFwiZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdC50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBjYXJkLmFwcGVuZENoaWxkKHQpO1xuICBpZiAoZGVzY3JpcHRpb24pIHtcbiAgICBjb25zdCBkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBkLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICAgIGQudGV4dENvbnRlbnQgPSBkZXNjcmlwdGlvbjtcbiAgICBjYXJkLmFwcGVuZENoaWxkKGQpO1xuICB9XG4gIHJldHVybiBjYXJkO1xufVxuXG5mdW5jdGlvbiBzaG9ydFNoYSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlLnNsaWNlKDAsIDcpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJUd2Vha3NQYWdlKHNlY3Rpb25zV3JhcDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3Qgb3BlbkJ0biA9IG9wZW5JblBsYWNlQnV0dG9uKFwiT3BlbiBUd2Vha3MgRm9sZGVyXCIsICgpID0+IHtcbiAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6cmV2ZWFsXCIsIHR3ZWFrc1BhdGgoKSk7XG4gIH0pO1xuICBjb25zdCByZWxvYWRCdG4gPSBvcGVuSW5QbGFjZUJ1dHRvbihcIkZvcmNlIFJlbG9hZFwiLCAoKSA9PiB7XG4gICAgLy8gRnVsbCBwYWdlIHJlZnJlc2ggXHUyMDE0IHNhbWUgYXMgRGV2VG9vbHMgQ21kLVIgLyBvdXIgQ0RQIFBhZ2UucmVsb2FkLlxuICAgIC8vIE1haW4gcmUtZGlzY292ZXJzIHR3ZWFrcyBmaXJzdCBzbyB0aGUgbmV3IHJlbmRlcmVyIGNvbWVzIHVwIHdpdGggYVxuICAgIC8vIGZyZXNoIHR3ZWFrIHNldDsgdGhlbiBsb2NhdGlvbi5yZWxvYWQgcmVzdGFydHMgdGhlIHJlbmRlcmVyIHNvIHRoZVxuICAgIC8vIHByZWxvYWQgcmUtaW5pdGlhbGl6ZXMgYWdhaW5zdCBpdC5cbiAgICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgICAuaW52b2tlKFwiY29kZXhwcDpyZWxvYWQtdHdlYWtzXCIpXG4gICAgICAuY2F0Y2goKGUpID0+IHBsb2coXCJmb3JjZSByZWxvYWQgKG1haW4pIGZhaWxlZFwiLCBTdHJpbmcoZSkpKVxuICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgIH0pO1xuICB9KTtcbiAgLy8gRHJvcCB0aGUgZGlhZ29uYWwtYXJyb3cgaWNvbiBmcm9tIHRoZSByZWxvYWQgYnV0dG9uIFx1MjAxNCBpdCBpbXBsaWVzIFwib3BlblxuICAvLyBvdXQgb2YgYXBwXCIgd2hpY2ggZG9lc24ndCBmaXQuIFJlcGxhY2UgaXRzIHRyYWlsaW5nIHN2ZyB3aXRoIGEgcmVmcmVzaC5cbiAgY29uc3QgcmVsb2FkU3ZnID0gcmVsb2FkQnRuLnF1ZXJ5U2VsZWN0b3IoXCJzdmdcIik7XG4gIGlmIChyZWxvYWRTdmcpIHtcbiAgICByZWxvYWRTdmcub3V0ZXJIVE1MID1cbiAgICAgIGA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cImljb24tMnhzXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgICBgPHBhdGggZD1cIk00IDEwYTYgNiAwIDAgMSAxMC4yNC00LjI0TDE2IDcuNU0xNiA0djMuNWgtMy41XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgICAgYDxwYXRoIGQ9XCJNMTYgMTBhNiA2IDAgMCAxLTEwLjI0IDQuMjRMNCAxMi41TTQgMTZ2LTMuNWgzLjVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgICBgPC9zdmc+YDtcbiAgfVxuXG4gIGNvbnN0IHRyYWlsaW5nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdHJhaWxpbmcuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiO1xuICB0cmFpbGluZy5hcHBlbmRDaGlsZChyZWxvYWRCdG4pO1xuICB0cmFpbGluZy5hcHBlbmRDaGlsZChvcGVuQnRuKTtcblxuICBpZiAoc3RhdGUubGlzdGVkVHdlYWtzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnN0IHNlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiKTtcbiAgICBzZWN0aW9uLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICAgIHNlY3Rpb24uYXBwZW5kQ2hpbGQoc2VjdGlvblRpdGxlKFwiSW5zdGFsbGVkIFR3ZWFrc1wiLCB0cmFpbGluZykpO1xuICAgIGNvbnN0IGNhcmQgPSByb3VuZGVkQ2FyZCgpO1xuICAgIGNhcmQuYXBwZW5kQ2hpbGQoXG4gICAgICByb3dTaW1wbGUoXG4gICAgICAgIFwiTm8gdHdlYWtzIGluc3RhbGxlZFwiLFxuICAgICAgICBgRHJvcCBhIHR3ZWFrIGZvbGRlciBpbnRvICR7dHdlYWtzUGF0aCgpfSBhbmQgcmVsb2FkLmAsXG4gICAgICApLFxuICAgICk7XG4gICAgc2VjdGlvbi5hcHBlbmRDaGlsZChjYXJkKTtcbiAgICBzZWN0aW9uc1dyYXAuYXBwZW5kQ2hpbGQoc2VjdGlvbik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gR3JvdXAgcmVnaXN0ZXJlZCBTZXR0aW5nc1NlY3Rpb25zIGJ5IHR3ZWFrIGlkIChwcmVmaXggc3BsaXQgYXQgXCI6XCIpLlxuICBjb25zdCBzZWN0aW9uc0J5VHdlYWsgPSBuZXcgTWFwPHN0cmluZywgU2V0dGluZ3NTZWN0aW9uW10+KCk7XG4gIGZvciAoY29uc3QgcyBvZiBzdGF0ZS5zZWN0aW9ucy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IHR3ZWFrSWQgPSBzLmlkLnNwbGl0KFwiOlwiKVswXTtcbiAgICBpZiAoIXNlY3Rpb25zQnlUd2Vhay5oYXModHdlYWtJZCkpIHNlY3Rpb25zQnlUd2Vhay5zZXQodHdlYWtJZCwgW10pO1xuICAgIHNlY3Rpb25zQnlUd2Vhay5nZXQodHdlYWtJZCkhLnB1c2gocyk7XG4gIH1cblxuICBjb25zdCBwYWdlc0J5VHdlYWsgPSBuZXcgTWFwPHN0cmluZywgUmVnaXN0ZXJlZFBhZ2VbXT4oKTtcbiAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSB7XG4gICAgaWYgKCFwYWdlc0J5VHdlYWsuaGFzKHAudHdlYWtJZCkpIHBhZ2VzQnlUd2Vhay5zZXQocC50d2Vha0lkLCBbXSk7XG4gICAgcGFnZXNCeVR3ZWFrLmdldChwLnR3ZWFrSWQpIS5wdXNoKHApO1xuICB9XG5cbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICB3cmFwLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICB3cmFwLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkluc3RhbGxlZCBUd2Vha3NcIiwgdHJhaWxpbmcpKTtcblxuICBjb25zdCBjYXJkID0gcm91bmRlZENhcmQoKTtcbiAgZm9yIChjb25zdCB0IG9mIHN0YXRlLmxpc3RlZFR3ZWFrcykge1xuICAgIGNhcmQuYXBwZW5kQ2hpbGQoXG4gICAgICB0d2Vha1JvdyhcbiAgICAgICAgdCxcbiAgICAgICAgc2VjdGlvbnNCeVR3ZWFrLmdldCh0Lm1hbmlmZXN0LmlkKSA/PyBbXSxcbiAgICAgICAgcGFnZXNCeVR3ZWFrLmdldCh0Lm1hbmlmZXN0LmlkKSA/PyBbXSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuICB3cmFwLmFwcGVuZENoaWxkKGNhcmQpO1xuICBzZWN0aW9uc1dyYXAuYXBwZW5kQ2hpbGQod3JhcCk7XG59XG5cbmZ1bmN0aW9uIHR3ZWFrUm93KFxuICB0OiBMaXN0ZWRUd2VhayxcbiAgc2VjdGlvbnM6IFNldHRpbmdzU2VjdGlvbltdLFxuICBwYWdlczogUmVnaXN0ZXJlZFBhZ2VbXSxcbik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgbSA9IHQubWFuaWZlc3Q7XG5cbiAgLy8gT3V0ZXIgY2VsbCB3cmFwcyB0aGUgaGVhZGVyIHJvdyArIChvcHRpb25hbCkgbmVzdGVkIHNlY3Rpb25zIHNvIHRoZVxuICAvLyBwYXJlbnQgY2FyZCdzIGRpdmlkZXIgc3RheXMgYmV0d2VlbiAqdHdlYWtzKiwgbm90IGJldHdlZW4gaGVhZGVyIGFuZFxuICAvLyBib2R5IG9mIHRoZSBzYW1lIHR3ZWFrLlxuICBjb25zdCBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgY2VsbC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2xcIjtcbiAgaWYgKCF0LmVuYWJsZWQpIGNlbGwuc3R5bGUub3BhY2l0eSA9IFwiMC43XCI7XG5cbiAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyLmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG5cbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC0xIGl0ZW1zLXN0YXJ0IGdhcC0zXCI7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEF2YXRhciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgYXZhdGFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYXZhdGFyLmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIG92ZXJmbG93LWhpZGRlbiB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIGF2YXRhci5zdHlsZS53aWR0aCA9IFwiNTZweFwiO1xuICBhdmF0YXIuc3R5bGUuaGVpZ2h0ID0gXCI1NnB4XCI7XG4gIGF2YXRhci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcInZhcigtLWNvbG9yLXRva2VuLWJnLWZvZywgdHJhbnNwYXJlbnQpXCI7XG4gIGlmIChtLmljb25VcmwpIHtcbiAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xuICAgIGltZy5hbHQgPSBcIlwiO1xuICAgIGltZy5jbGFzc05hbWUgPSBcInNpemUtZnVsbCBvYmplY3QtY29udGFpblwiO1xuICAgIC8vIEluaXRpYWw6IHNob3cgZmFsbGJhY2sgaW5pdGlhbCBpbiBjYXNlIHRoZSBpY29uIGZhaWxzIHRvIGxvYWQuXG4gICAgY29uc3QgaW5pdGlhbCA9IChtLm5hbWU/LlswXSA/PyBcIj9cIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBmYWxsYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgIGZhbGxiYWNrLmNsYXNzTmFtZSA9IFwidGV4dC14bCBmb250LW1lZGl1bVwiO1xuICAgIGZhbGxiYWNrLnRleHRDb250ZW50ID0gaW5pdGlhbDtcbiAgICBhdmF0YXIuYXBwZW5kQ2hpbGQoZmFsbGJhY2spO1xuICAgIGltZy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsICgpID0+IHtcbiAgICAgIGZhbGxiYWNrLnJlbW92ZSgpO1xuICAgICAgaW1nLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIH0pO1xuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgaW1nLnJlbW92ZSgpO1xuICAgIH0pO1xuICAgIHZvaWQgcmVzb2x2ZUljb25VcmwobS5pY29uVXJsLCB0LmRpcikudGhlbigodXJsKSA9PiB7XG4gICAgICBpZiAodXJsKSBpbWcuc3JjID0gdXJsO1xuICAgICAgZWxzZSBpbWcucmVtb3ZlKCk7XG4gICAgfSk7XG4gICAgYXZhdGFyLmFwcGVuZENoaWxkKGltZyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgaW5pdGlhbCA9IChtLm5hbWU/LlswXSA/PyBcIj9cIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgc3Bhbi5jbGFzc05hbWUgPSBcInRleHQteGwgZm9udC1tZWRpdW1cIjtcbiAgICBzcGFuLnRleHRDb250ZW50ID0gaW5pdGlhbDtcbiAgICBhdmF0YXIuYXBwZW5kQ2hpbGQoc3Bhbik7XG4gIH1cbiAgbGVmdC5hcHBlbmRDaGlsZChhdmF0YXIpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBUZXh0IHN0YWNrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBzdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0wLjVcIjtcblxuICBjb25zdCB0aXRsZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlUm93LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgY29uc3QgbmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIG5hbWUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgbmFtZS50ZXh0Q29udGVudCA9IG0ubmFtZTtcbiAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQobmFtZSk7XG4gIGlmIChtLnZlcnNpb24pIHtcbiAgICBjb25zdCB2ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICB2ZXIuY2xhc3NOYW1lID1cbiAgICAgIFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSB0ZXh0LXhzIGZvbnQtbm9ybWFsIHRhYnVsYXItbnVtc1wiO1xuICAgIHZlci50ZXh0Q29udGVudCA9IGB2JHttLnZlcnNpb259YDtcbiAgICB0aXRsZVJvdy5hcHBlbmRDaGlsZCh2ZXIpO1xuICB9XG4gIGlmICh0LnVwZGF0ZT8udXBkYXRlQXZhaWxhYmxlKSB7XG4gICAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICBiYWRnZS5jbGFzc05hbWUgPVxuICAgICAgXCJyb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tZm9yZWdyb3VuZC81IHB4LTIgcHktMC41IHRleHQtWzExcHhdIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gICAgYmFkZ2UudGV4dENvbnRlbnQgPSBcIlVwZGF0ZSBBdmFpbGFibGVcIjtcbiAgICB0aXRsZVJvdy5hcHBlbmRDaGlsZChiYWRnZSk7XG4gIH1cbiAgc3RhY2suYXBwZW5kQ2hpbGQodGl0bGVSb3cpO1xuXG4gIGlmIChtLmRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgZGVzYy5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gICAgZGVzYy50ZXh0Q29udGVudCA9IG0uZGVzY3JpcHRpb247XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIH1cblxuICBjb25zdCBtZXRhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbWV0YS5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQteHMgdGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICBjb25zdCBhdXRob3JFbCA9IHJlbmRlckF1dGhvcihtLmF1dGhvcik7XG4gIGlmIChhdXRob3JFbCkgbWV0YS5hcHBlbmRDaGlsZChhdXRob3JFbCk7XG4gIGlmIChtLmdpdGh1YlJlcG8pIHtcbiAgICBpZiAobWV0YS5jaGlsZHJlbi5sZW5ndGggPiAwKSBtZXRhLmFwcGVuZENoaWxkKGRvdCgpKTtcbiAgICBjb25zdCByZXBvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICByZXBvLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgIHJlcG8uY2xhc3NOYW1lID0gXCJpbmxpbmUtZmxleCB0ZXh0LXRva2VuLXRleHQtbGluay1mb3JlZ3JvdW5kIGhvdmVyOnVuZGVybGluZVwiO1xuICAgIHJlcG8udGV4dENvbnRlbnQgPSBtLmdpdGh1YlJlcG87XG4gICAgcmVwby5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLCBgaHR0cHM6Ly9naXRodWIuY29tLyR7bS5naXRodWJSZXBvfWApO1xuICAgIH0pO1xuICAgIG1ldGEuYXBwZW5kQ2hpbGQocmVwbyk7XG4gIH1cbiAgaWYgKG0uaG9tZXBhZ2UpIHtcbiAgICBpZiAobWV0YS5jaGlsZHJlbi5sZW5ndGggPiAwKSBtZXRhLmFwcGVuZENoaWxkKGRvdCgpKTtcbiAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG4gICAgbGluay5ocmVmID0gbS5ob21lcGFnZTtcbiAgICBsaW5rLnRhcmdldCA9IFwiX2JsYW5rXCI7XG4gICAgbGluay5yZWwgPSBcIm5vcmVmZXJyZXJcIjtcbiAgICBsaW5rLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggdGV4dC10b2tlbi10ZXh0LWxpbmstZm9yZWdyb3VuZCBob3Zlcjp1bmRlcmxpbmVcIjtcbiAgICBsaW5rLnRleHRDb250ZW50ID0gXCJIb21lcGFnZVwiO1xuICAgIG1ldGEuYXBwZW5kQ2hpbGQobGluayk7XG4gIH1cbiAgaWYgKG1ldGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkgc3RhY2suYXBwZW5kQ2hpbGQobWV0YSk7XG5cbiAgLy8gVGFncyByb3cgKGlmIGFueSkgXHUyMDE0IHNtYWxsIHBpbGwgY2hpcHMgYmVsb3cgdGhlIG1ldGEgbGluZS5cbiAgaWYgKG0udGFncyAmJiBtLnRhZ3MubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHRhZ3NSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRhZ3NSb3cuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtd3JhcCBpdGVtcy1jZW50ZXIgZ2FwLTEgcHQtMC41XCI7XG4gICAgZm9yIChjb25zdCB0YWcgb2YgbS50YWdzKSB7XG4gICAgICBjb25zdCBwaWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgICBwaWxsLmNsYXNzTmFtZSA9XG4gICAgICAgIFwicm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLWZvcmVncm91bmQvNSBweC0yIHB5LTAuNSB0ZXh0LVsxMXB4XSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gICAgICBwaWxsLnRleHRDb250ZW50ID0gdGFnO1xuICAgICAgdGFnc1Jvdy5hcHBlbmRDaGlsZChwaWxsKTtcbiAgICB9XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQodGFnc1Jvdyk7XG4gIH1cblxuICBsZWZ0LmFwcGVuZENoaWxkKHN0YWNrKTtcbiAgaGVhZGVyLmFwcGVuZENoaWxkKGxlZnQpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBUb2dnbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHJpZ2h0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcmlnaHQuY2xhc3NOYW1lID0gXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMiBwdC0wLjVcIjtcbiAgaWYgKHQuZW5hYmxlZCAmJiBwYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgY29uZmlndXJlQnRuID0gY29tcGFjdEJ1dHRvbihcIkNvbmZpZ3VyZVwiLCAoKSA9PiB7XG4gICAgICBhY3RpdmF0ZVBhZ2UoeyBraW5kOiBcInJlZ2lzdGVyZWRcIiwgaWQ6IHBhZ2VzWzBdIS5pZCB9KTtcbiAgICB9KTtcbiAgICBjb25maWd1cmVCdG4udGl0bGUgPSBwYWdlcy5sZW5ndGggPT09IDFcbiAgICAgID8gYE9wZW4gJHtwYWdlc1swXSEucGFnZS50aXRsZX1gXG4gICAgICA6IGBPcGVuICR7cGFnZXMubWFwKChwKSA9PiBwLnBhZ2UudGl0bGUpLmpvaW4oXCIsIFwiKX1gO1xuICAgIHJpZ2h0LmFwcGVuZENoaWxkKGNvbmZpZ3VyZUJ0bik7XG4gIH1cbiAgaWYgKHQudXBkYXRlPy51cGRhdGVBdmFpbGFibGUgJiYgdC51cGRhdGUucmVsZWFzZVVybCkge1xuICAgIHJpZ2h0LmFwcGVuZENoaWxkKFxuICAgICAgY29tcGFjdEJ1dHRvbihcIlJldmlldyBSZWxlYXNlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgdC51cGRhdGUhLnJlbGVhc2VVcmwpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuICByaWdodC5hcHBlbmRDaGlsZChcbiAgICBzd2l0Y2hDb250cm9sKHQuZW5hYmxlZCwgYXN5bmMgKG5leHQpID0+IHtcbiAgICAgIGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6c2V0LXR3ZWFrLWVuYWJsZWRcIiwgbS5pZCwgbmV4dCk7XG4gICAgICAvLyBUaGUgbWFpbiBwcm9jZXNzIGJyb2FkY2FzdHMgYSByZWxvYWQgd2hpY2ggd2lsbCByZS1mZXRjaCB0aGUgbGlzdFxuICAgICAgLy8gYW5kIHJlLXJlbmRlci4gV2UgZG9uJ3Qgb3B0aW1pc3RpY2FsbHkgdG9nZ2xlIHRvIGF2b2lkIGRyaWZ0LlxuICAgIH0pLFxuICApO1xuICBoZWFkZXIuYXBwZW5kQ2hpbGQocmlnaHQpO1xuXG4gIGNlbGwuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblxuICAvLyBJZiB0aGUgdHdlYWsgaXMgZW5hYmxlZCBhbmQgcmVnaXN0ZXJlZCBzZXR0aW5ncyBzZWN0aW9ucywgcmVuZGVyIHRob3NlXG4gIC8vIGJvZGllcyBhcyBuZXN0ZWQgcm93cyBiZW5lYXRoIHRoZSBoZWFkZXIgaW5zaWRlIHRoZSBzYW1lIGNlbGwuXG4gIGlmICh0LmVuYWJsZWQgJiYgc2VjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IG5lc3RlZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgbmVzdGVkLmNsYXNzTmFtZSA9XG4gICAgICBcImZsZXggZmxleC1jb2wgZGl2aWRlLXktWzAuNXB4XSBkaXZpZGUtdG9rZW4tYm9yZGVyIGJvcmRlci10LVswLjVweF0gYm9yZGVyLXRva2VuLWJvcmRlclwiO1xuICAgIGZvciAoY29uc3QgcyBvZiBzZWN0aW9ucykge1xuICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBib2R5LmNsYXNzTmFtZSA9IFwicC0zXCI7XG4gICAgICB0cnkge1xuICAgICAgICBzLnJlbmRlcihib2R5KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgYm9keS50ZXh0Q29udGVudCA9IGBFcnJvciByZW5kZXJpbmcgdHdlYWsgc2VjdGlvbjogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gO1xuICAgICAgfVxuICAgICAgbmVzdGVkLmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIH1cbiAgICBjZWxsLmFwcGVuZENoaWxkKG5lc3RlZCk7XG4gIH1cblxuICByZXR1cm4gY2VsbDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQXV0aG9yKGF1dGhvcjogVHdlYWtNYW5pZmVzdFtcImF1dGhvclwiXSk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGlmICghYXV0aG9yKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICB3cmFwLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI7XG4gIGlmICh0eXBlb2YgYXV0aG9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgd3JhcC50ZXh0Q29udGVudCA9IGBieSAke2F1dGhvcn1gO1xuICAgIHJldHVybiB3cmFwO1xuICB9XG4gIHdyYXAuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJieSBcIikpO1xuICBpZiAoYXV0aG9yLnVybCkge1xuICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcbiAgICBhLmhyZWYgPSBhdXRob3IudXJsO1xuICAgIGEudGFyZ2V0ID0gXCJfYmxhbmtcIjtcbiAgICBhLnJlbCA9IFwibm9yZWZlcnJlclwiO1xuICAgIGEuY2xhc3NOYW1lID0gXCJpbmxpbmUtZmxleCB0ZXh0LXRva2VuLXRleHQtbGluay1mb3JlZ3JvdW5kIGhvdmVyOnVuZGVybGluZVwiO1xuICAgIGEudGV4dENvbnRlbnQgPSBhdXRob3IubmFtZTtcbiAgICB3cmFwLmFwcGVuZENoaWxkKGEpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICBzcGFuLnRleHRDb250ZW50ID0gYXV0aG9yLm5hbWU7XG4gICAgd3JhcC5hcHBlbmRDaGlsZChzcGFuKTtcbiAgfVxuICByZXR1cm4gd3JhcDtcbn1cblxuZnVuY3Rpb24gb3BlblB1Ymxpc2hUd2Vha0RpYWxvZygpOiB2b2lkIHtcbiAgY29uc3QgZXhpc3RpbmcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIltkYXRhLWNvZGV4cHAtcHVibGlzaC1kaWFsb2ddXCIpO1xuICBleGlzdGluZz8ucmVtb3ZlKCk7XG5cbiAgY29uc3Qgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIG92ZXJsYXkuZGF0YXNldC5jb2RleHBwUHVibGlzaERpYWxvZyA9IFwidHJ1ZVwiO1xuICBvdmVybGF5LmNsYXNzTmFtZSA9IFwiZml4ZWQgaW5zZXQtMCB6LVs5OTk5XSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBiZy1ibGFjay80MCBwLTRcIjtcblxuICBjb25zdCBkaWFsb2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBkaWFsb2cuY2xhc3NOYW1lID1cbiAgICBcImZsZXggdy1mdWxsIG1heC13LXhsIGZsZXgtY29sIGdhcC00IHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tbWFpbi1zdXJmYWNlLXByaW1hcnkgcC00IHNoYWRvdy14bFwiO1xuICBvdmVybGF5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyLmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gZ2FwLTNcIjtcbiAgY29uc3QgdGl0bGVTdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlU3RhY2suY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC1jb2wgZ2FwLTFcIjtcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZS5jbGFzc05hbWUgPSBcInRleHQtYmFzZSBmb250LW1lZGl1bSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IFwiUHVibGlzaCBUd2Vha1wiO1xuICBjb25zdCBzdWJ0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN1YnRpdGxlLmNsYXNzTmFtZSA9IFwidGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIHN1YnRpdGxlLnRleHRDb250ZW50ID0gXCJTdWJtaXQgYSBHaXRIdWIgcmVwbyBmb3IgYWRtaW4gcmV2aWV3LiBDb2RleCsrIHJlY29yZHMgdGhlIGV4YWN0IGNvbW1pdCBhZG1pbnMgbXVzdCByZXZpZXcgYW5kIHBpbi5cIjtcbiAgdGl0bGVTdGFjay5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIHRpdGxlU3RhY2suYXBwZW5kQ2hpbGQoc3VidGl0bGUpO1xuICBoZWFkZXIuYXBwZW5kQ2hpbGQodGl0bGVTdGFjayk7XG4gIGhlYWRlci5hcHBlbmRDaGlsZChjb21wYWN0QnV0dG9uKFwiRGlzbWlzc1wiLCAoKSA9PiBvdmVybGF5LnJlbW92ZSgpKSk7XG4gIGRpYWxvZy5hcHBlbmRDaGlsZChoZWFkZXIpO1xuXG4gIGNvbnN0IHJlcG9JbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcbiAgcmVwb0lucHV0LnR5cGUgPSBcInRleHRcIjtcbiAgcmVwb0lucHV0LnBsYWNlaG9sZGVyID0gXCJvd25lci9yZXBvIG9yIGh0dHBzOi8vZ2l0aHViLmNvbS9vd25lci9yZXBvXCI7XG4gIHJlcG9JbnB1dC5jbGFzc05hbWUgPVxuICAgIFwiaC0xMCByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRyYW5zcGFyZW50IHB4LTMgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeSBmb2N1czpvdXRsaW5lLW5vbmVcIjtcbiAgZGlhbG9nLmFwcGVuZENoaWxkKHJlcG9JbnB1dCk7XG5cbiAgY29uc3Qgc3RhdHVzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc3RhdHVzLmNsYXNzTmFtZSA9IFwibWluLWgtNSB0ZXh0LXNtIHRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnlcIjtcbiAgc3RhdHVzLnRleHRDb250ZW50ID0gXCJTY3JlZW5zaG90cyBtdXN0IGJlIGNvbW1pdHRlZCBpbiAuY29kZXhwcC1zdG9yZS9zY3JlZW5zaG90cyBhdCB0aGUgc3VibWl0dGVkIGNvbW1pdC5cIjtcbiAgZGlhbG9nLmFwcGVuZENoaWxkKHN0YXR1cyk7XG5cbiAgY29uc3QgYWN0aW9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbnMuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBnYXAtMlwiO1xuICBjb25zdCBzdWJtaXQgPSBjb21wYWN0QnV0dG9uKFwiT3BlbiBSZXZpZXcgSXNzdWVcIiwgKCkgPT4ge1xuICAgIHZvaWQgc3VibWl0UHVibGlzaFR3ZWFrKHJlcG9JbnB1dCwgc3RhdHVzKTtcbiAgfSk7XG4gIGFjdGlvbnMuYXBwZW5kQ2hpbGQoc3VibWl0KTtcbiAgZGlhbG9nLmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuXG4gIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgaWYgKGUudGFyZ2V0ID09PSBvdmVybGF5KSBvdmVybGF5LnJlbW92ZSgpO1xuICB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5KTtcbiAgcmVwb0lucHV0LmZvY3VzKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHN1Ym1pdFB1Ymxpc2hUd2VhayhcbiAgcmVwb0lucHV0OiBIVE1MSW5wdXRFbGVtZW50LFxuICBzdGF0dXM6IEhUTUxFbGVtZW50LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHN0YXR1cy5jbGFzc05hbWUgPSBcIm1pbi1oLTUgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIHN0YXR1cy50ZXh0Q29udGVudCA9IFwiUmVzb2x2aW5nIHRoZSByZXBvIGNvbW1pdCB0byByZXZpZXcuXCI7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3VibWlzc2lvbiA9IGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcbiAgICAgIFwiY29kZXhwcDpwcmVwYXJlLXR3ZWFrLXN0b3JlLXN1Ym1pc3Npb25cIixcbiAgICAgIHJlcG9JbnB1dC52YWx1ZSxcbiAgICApIGFzIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbjtcbiAgICBjb25zdCB1cmwgPSBidWlsZFR3ZWFrUHVibGlzaElzc3VlVXJsKHN1Ym1pc3Npb24pO1xuICAgIGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLCB1cmwpO1xuICAgIHN0YXR1cy50ZXh0Q29udGVudCA9IGBHaXRIdWIgcmV2aWV3IGlzc3VlIG9wZW5lZCBmb3IgJHtzdWJtaXNzaW9uLmNvbW1pdFNoYS5zbGljZSgwLCA3KX0uYDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHN0YXR1cy5jbGFzc05hbWUgPSBcIm1pbi1oLTUgdGV4dC1zbSB0ZXh0LXRva2VuLWNoYXJ0cy1yZWRcIjtcbiAgICBzdGF0dXMudGV4dENvbnRlbnQgPSBTdHJpbmcoKGUgYXMgRXJyb3IpLm1lc3NhZ2UgPz8gZSk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIGNvbXBvbmVudHMgXHUyNTAwXHUyNTAwXG5cbi8qKiBUaGUgZnVsbCBwYW5lbCBzaGVsbCAodG9vbGJhciArIHNjcm9sbCArIGhlYWRpbmcgKyBzZWN0aW9ucyB3cmFwKS4gKi9cbmZ1bmN0aW9uIHBhbmVsU2hlbGwoXG4gIHRpdGxlOiBzdHJpbmcsXG4gIHN1YnRpdGxlPzogc3RyaW5nLFxuICBvcHRpb25zPzogeyB3aWRlPzogYm9vbGVhbiB9LFxuKToge1xuICBvdXRlcjogSFRNTEVsZW1lbnQ7XG4gIHNlY3Rpb25zV3JhcDogSFRNTEVsZW1lbnQ7XG4gIHN1YnRpdGxlPzogSFRNTEVsZW1lbnQ7XG4gIGhlYWRlckFjdGlvbnM6IEhUTUxFbGVtZW50O1xufSB7XG4gIGNvbnN0IG91dGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgb3V0ZXIuY2xhc3NOYW1lID0gXCJtYWluLXN1cmZhY2UgZmxleCBoLWZ1bGwgbWluLWgtMCBmbGV4LWNvbFwiO1xuXG4gIGNvbnN0IHRvb2xiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0b29sYmFyLmNsYXNzTmFtZSA9XG4gICAgXCJkcmFnZ2FibGUgZmxleCBpdGVtcy1jZW50ZXIgcHgtcGFuZWwgZWxlY3Ryb246aC10b29sYmFyIGV4dGVuc2lvbjpoLXRvb2xiYXItc21cIjtcbiAgb3V0ZXIuYXBwZW5kQ2hpbGQodG9vbGJhcik7XG5cbiAgY29uc3Qgc2Nyb2xsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc2Nyb2xsLmNsYXNzTmFtZSA9IFwiZmxleC0xIG92ZXJmbG93LXktYXV0byBwLXBhbmVsXCI7XG4gIG91dGVyLmFwcGVuZENoaWxkKHNjcm9sbCk7XG5cbiAgY29uc3QgaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBpbm5lci5jbGFzc05hbWUgPVxuICAgIG9wdGlvbnM/LndpZGVcbiAgICAgID8gXCJteC1hdXRvIGZsZXggdy1mdWxsIG1heC13LTV4bCBmbGV4LWNvbCBlbGVjdHJvbjptaW4tdy1bY2FsYygzMjBweCp2YXIoLS1jb2RleC13aW5kb3ctem9vbSkpXVwiXG4gICAgICA6IFwibXgtYXV0byBmbGV4IHctZnVsbCBmbGV4LWNvbCBtYXgtdy0yeGwgZWxlY3Ryb246bWluLXctW2NhbGMoMzIwcHgqdmFyKC0tY29kZXgtd2luZG93LXpvb20pKV1cIjtcbiAgc2Nyb2xsLmFwcGVuZENoaWxkKGlubmVyKTtcblxuICBjb25zdCBoZWFkZXJXcmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyV3JhcC5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMyBwYi1wYW5lbFwiO1xuICBjb25zdCBoZWFkZXJJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlcklubmVyLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtMSBmbGV4LWNvbCBnYXAtMS41IHBiLXBhbmVsXCI7XG4gIGNvbnN0IGhlYWRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBoZWFkaW5nLmNsYXNzTmFtZSA9IFwiZWxlY3Ryb246aGVhZGluZy1sZyBoZWFkaW5nLWJhc2UgdHJ1bmNhdGVcIjtcbiAgaGVhZGluZy50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBoZWFkZXJJbm5lci5hcHBlbmRDaGlsZChoZWFkaW5nKTtcbiAgbGV0IHN1YnRpdGxlRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG4gIGlmIChzdWJ0aXRsZSkge1xuICAgIGNvbnN0IHN1YiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgc3ViLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSB0ZXh0LXNtXCI7XG4gICAgc3ViLnRleHRDb250ZW50ID0gc3VidGl0bGU7XG4gICAgaGVhZGVySW5uZXIuYXBwZW5kQ2hpbGQoc3ViKTtcbiAgICBzdWJ0aXRsZUVsZW1lbnQgPSBzdWI7XG4gIH1cbiAgaGVhZGVyV3JhcC5hcHBlbmRDaGlsZChoZWFkZXJJbm5lcik7XG4gIGNvbnN0IGhlYWRlckFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBoZWFkZXJBY3Rpb25zLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgaGVhZGVyV3JhcC5hcHBlbmRDaGlsZChoZWFkZXJBY3Rpb25zKTtcbiAgaW5uZXIuYXBwZW5kQ2hpbGQoaGVhZGVyV3JhcCk7XG5cbiAgY29uc3Qgc2VjdGlvbnNXcmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc2VjdGlvbnNXcmFwLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtW3ZhcigtLXBhZGRpbmctcGFuZWwpXVwiO1xuICBpbm5lci5hcHBlbmRDaGlsZChzZWN0aW9uc1dyYXApO1xuXG4gIHJldHVybiB7IG91dGVyLCBzZWN0aW9uc1dyYXAsIHN1YnRpdGxlOiBzdWJ0aXRsZUVsZW1lbnQsIGhlYWRlckFjdGlvbnMgfTtcbn1cblxuZnVuY3Rpb24gc2VjdGlvblRpdGxlKHRleHQ6IHN0cmluZywgdHJhaWxpbmc/OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgdGl0bGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZVJvdy5jbGFzc05hbWUgPVxuICAgIFwiZmxleCBoLXRvb2xiYXIgaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMiBweC0wIHB5LTBcIjtcbiAgY29uc3QgdGl0bGVJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlSW5uZXIuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC0xIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0LmNsYXNzTmFtZSA9IFwidGV4dC1iYXNlIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gIHQudGV4dENvbnRlbnQgPSB0ZXh0O1xuICB0aXRsZUlubmVyLmFwcGVuZENoaWxkKHQpO1xuICB0aXRsZVJvdy5hcHBlbmRDaGlsZCh0aXRsZUlubmVyKTtcbiAgaWYgKHRyYWlsaW5nKSB7XG4gICAgY29uc3QgcmlnaHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHJpZ2h0LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgICByaWdodC5hcHBlbmRDaGlsZCh0cmFpbGluZyk7XG4gICAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQocmlnaHQpO1xuICB9XG4gIHJldHVybiB0aXRsZVJvdztcbn1cblxuLyoqXG4gKiBDb2RleCdzIFwiT3BlbiBjb25maWcudG9tbFwiLXN0eWxlIHRyYWlsaW5nIGJ1dHRvbjogZ2hvc3QgYm9yZGVyLCBtdXRlZFxuICogbGFiZWwsIHRvcC1yaWdodCBkaWFnb25hbCBhcnJvdyBpY29uLiBNYXJrdXAgbWlycm9ycyBDb25maWd1cmF0aW9uIHBhbmVsLlxuICovXG5mdW5jdGlvbiBvcGVuSW5QbGFjZUJ1dHRvbihsYWJlbDogc3RyaW5nLCBvbkNsaWNrOiAoKSA9PiB2b2lkKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICBidG4udHlwZSA9IFwiYnV0dG9uXCI7XG4gIGJ0bi5jbGFzc05hbWUgPVxuICAgIFwiYm9yZGVyLXRva2VuLWJvcmRlciB1c2VyLXNlbGVjdC1ub25lIG5vLWRyYWcgY3Vyc29yLWludGVyYWN0aW9uIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xIGJvcmRlciB3aGl0ZXNwYWNlLW5vd3JhcCBmb2N1czpvdXRsaW5lLW5vbmUgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDAgcm91bmRlZC1sZyB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmQgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZGF0YS1bc3RhdGU9b3Blbl06YmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kIGJvcmRlci10cmFuc3BhcmVudCBoLXRva2VuLWJ1dHRvbi1jb21wb3NlciBweC0yIHB5LTAgdGV4dC1iYXNlIGxlYWRpbmctWzE4cHhdXCI7XG4gIGJ0bi5pbm5lckhUTUwgPVxuICAgIGAke2xhYmVsfWAgK1xuICAgIGA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cImljb24tMnhzXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNMTQuMzM0OSAxMy4zMzAxVjYuNjA2NDVMNS40NzA2NSAxNS40NzA3QzUuMjEwOTUgMTUuNzMwNCA0Ljc4ODk1IDE1LjczMDQgNC41MjkyNSAxNS40NzA3QzQuMjY5NTUgMTUuMjExIDQuMjY5NTUgMTQuNzg5IDQuNTI5MjUgMTQuNTI5M0wxMy4zOTM1IDUuNjY1MDRINi42NjAxMUM2LjI5Mjg0IDUuNjY1MDQgNS45OTUwNyA1LjM2NzI3IDUuOTk1MDcgNUM1Ljk5NTA3IDQuNjMyNzMgNi4yOTI4NCA0LjMzNDk2IDYuNjYwMTEgNC4zMzQ5NkgxNC45OTk5TDE1LjEzMzcgNC4zNDg2M0MxNS40MzY5IDQuNDEwNTcgMTUuNjY1IDQuNjc4NTcgMTUuNjY1IDVWMTMuMzMwMUMxNS42NjQ5IDEzLjY5NzMgMTUuMzY3MiAxMy45OTUxIDE0Ljk5OTkgMTMuOTk1MUMxNC42MzI3IDEzLjk5NTEgMTQuMzM1IDEzLjY5NzMgMTQuMzM0OSAxMy4zMzAxWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIj48L3BhdGg+YCArXG4gICAgYDwvc3ZnPmA7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBvbkNsaWNrKCk7XG4gIH0pO1xuICByZXR1cm4gYnRuO1xufVxuXG5mdW5jdGlvbiBjb21wYWN0QnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gaW5saW5lLWZsZXggaC04IGl0ZW1zLWNlbnRlciB3aGl0ZXNwYWNlLW5vd3JhcCByb3VuZGVkLWxnIGJvcmRlciBweC0yIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnkgZW5hYmxlZDpob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDBcIjtcbiAgYnRuLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBvbkNsaWNrKCk7XG4gIH0pO1xuICByZXR1cm4gYnRuO1xufVxuXG5mdW5jdGlvbiByb3VuZGVkQ2FyZCgpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBjYXJkLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIGZsZXggZmxleC1jb2wgZGl2aWRlLXktWzAuNXB4XSBkaXZpZGUtdG9rZW4tYm9yZGVyIHJvdW5kZWQtbGcgYm9yZGVyXCI7XG4gIGNhcmQuc2V0QXR0cmlidXRlKFxuICAgIFwic3R5bGVcIixcbiAgICBcImJhY2tncm91bmQtY29sb3I6IHZhcigtLWNvbG9yLWJhY2tncm91bmQtcGFuZWwsIHZhcigtLWNvbG9yLXRva2VuLWJnLWZvZykpO1wiLFxuICApO1xuICByZXR1cm4gY2FyZDtcbn1cblxuZnVuY3Rpb24gcm93U2ltcGxlKHRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGRlc2NyaXB0aW9uPzogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGl0ZW1zLWNlbnRlciBnYXAtM1wiO1xuICBjb25zdCBzdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGlmICh0aXRsZSkge1xuICAgIGNvbnN0IHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHQuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgICB0LnRleHRDb250ZW50ID0gdGl0bGU7XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQodCk7XG4gIH1cbiAgaWYgKGRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgZC5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gICAgZC50ZXh0Q29udGVudCA9IGRlc2NyaXB0aW9uO1xuICAgIHN0YWNrLmFwcGVuZENoaWxkKGQpO1xuICB9XG4gIGxlZnQuYXBwZW5kQ2hpbGQoc3RhY2spO1xuICByb3cuYXBwZW5kQ2hpbGQobGVmdCk7XG4gIHJldHVybiByb3c7XG59XG5cbi8qKlxuICogQ29kZXgtc3R5bGVkIHRvZ2dsZSBzd2l0Y2guIE1hcmt1cCBtaXJyb3JzIHRoZSBHZW5lcmFsID4gUGVybWlzc2lvbnMgcm93XG4gKiBzd2l0Y2ggd2UgY2FwdHVyZWQ6IG91dGVyIGJ1dHRvbiAocm9sZT1zd2l0Y2gpLCBpbm5lciBwaWxsLCBzbGlkaW5nIGtub2IuXG4gKi9cbmZ1bmN0aW9uIHN3aXRjaENvbnRyb2woXG4gIGluaXRpYWw6IGJvb2xlYW4sXG4gIG9uQ2hhbmdlOiAobmV4dDogYm9vbGVhbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4sXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLnNldEF0dHJpYnV0ZShcInJvbGVcIiwgXCJzd2l0Y2hcIik7XG5cbiAgY29uc3QgcGlsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBjb25zdCBrbm9iID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGtub2IuY2xhc3NOYW1lID1cbiAgICBcInJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLVtjb2xvcjp2YXIoLS1ncmF5LTApXSBiZy1bY29sb3I6dmFyKC0tZ3JheS0wKV0gc2hhZG93LXNtIHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTIwMCBlYXNlLW91dCBoLTQgdy00XCI7XG4gIHBpbGwuYXBwZW5kQ2hpbGQoa25vYik7XG5cbiAgY29uc3QgYXBwbHkgPSAob246IGJvb2xlYW4pOiB2b2lkID0+IHtcbiAgICBidG4uc2V0QXR0cmlidXRlKFwiYXJpYS1jaGVja2VkXCIsIFN0cmluZyhvbikpO1xuICAgIGJ0bi5kYXRhc2V0LnN0YXRlID0gb24gPyBcImNoZWNrZWRcIiA6IFwidW5jaGVja2VkXCI7XG4gICAgYnRuLmNsYXNzTmFtZSA9XG4gICAgICBcImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciB0ZXh0LXNtIGZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0yIGZvY3VzLXZpc2libGU6cmluZy10b2tlbi1mb2N1cy1ib3JkZXIgZm9jdXMtdmlzaWJsZTpyb3VuZGVkLWZ1bGwgY3Vyc29yLWludGVyYWN0aW9uXCI7XG4gICAgcGlsbC5jbGFzc05hbWUgPSBgcmVsYXRpdmUgaW5saW5lLWZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWNvbG9ycyBkdXJhdGlvbi0yMDAgZWFzZS1vdXQgaC01IHctOCAke1xuICAgICAgb24gPyBcImJnLXRva2VuLWNoYXJ0cy1ibHVlXCIgOiBcImJnLXRva2VuLWZvcmVncm91bmQvMjBcIlxuICAgIH1gO1xuICAgIHBpbGwuZGF0YXNldC5zdGF0ZSA9IG9uID8gXCJjaGVja2VkXCIgOiBcInVuY2hlY2tlZFwiO1xuICAgIGtub2IuZGF0YXNldC5zdGF0ZSA9IG9uID8gXCJjaGVja2VkXCIgOiBcInVuY2hlY2tlZFwiO1xuICAgIGtub2Iuc3R5bGUudHJhbnNmb3JtID0gb24gPyBcInRyYW5zbGF0ZVgoMTRweClcIiA6IFwidHJhbnNsYXRlWCgycHgpXCI7XG4gIH07XG4gIGFwcGx5KGluaXRpYWwpO1xuXG4gIGJ0bi5hcHBlbmRDaGlsZChwaWxsKTtcbiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0IG5leHQgPSBidG4uZ2V0QXR0cmlidXRlKFwiYXJpYS1jaGVja2VkXCIpICE9PSBcInRydWVcIjtcbiAgICBhcHBseShuZXh0KTtcbiAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBvbkNoYW5nZShuZXh0KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGJ0bjtcbn1cblxuZnVuY3Rpb24gZG90KCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBzLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kXCI7XG4gIHMudGV4dENvbnRlbnQgPSBcIlx1MDBCN1wiO1xuICByZXR1cm4gcztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIGljb25zIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjb25maWdJY29uU3ZnKCk6IHN0cmluZyB7XG4gIC8vIFNsaWRlcnMgLyBzZXR0aW5ncyBnbHlwaC4gMjB4MjAgY3VycmVudENvbG9yLlxuICByZXR1cm4gKFxuICAgIGA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cImljb24tc20gaW5saW5lLWJsb2NrIGFsaWduLW1pZGRsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPmAgK1xuICAgIGA8cGF0aCBkPVwiTTMgNWg5TTE1IDVoMk0zIDEwaDJNOCAxMGg5TTMgMTVoMTFNMTcgMTVoMFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+YCArXG4gICAgYDxjaXJjbGUgY3g9XCIxM1wiIGN5PVwiNVwiIHI9XCIxLjZcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPmAgK1xuICAgIGA8Y2lyY2xlIGN4PVwiNlwiIGN5PVwiMTBcIiByPVwiMS42XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5gICtcbiAgICBgPGNpcmNsZSBjeD1cIjE1XCIgY3k9XCIxNVwiIHI9XCIxLjZcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIHR3ZWFrc0ljb25TdmcoKTogc3RyaW5nIHtcbiAgLy8gU3BhcmtsZXMgLyBcIisrXCIgZ2x5cGggZm9yIHR3ZWFrcy5cbiAgcmV0dXJuIChcbiAgICBgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3M9XCJpY29uLXNtIGlubGluZS1ibG9jayBhbGlnbi1taWRkbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk0xMCAyLjUgTDExLjQgOC42IEwxNy41IDEwIEwxMS40IDExLjQgTDEwIDE3LjUgTDguNiAxMS40IEwyLjUgMTAgTDguNiA4LjYgWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNMTUuNSAzIEwxNiA1IEwxOCA1LjUgTDE2IDYgTDE1LjUgOCBMMTUgNiBMMTMgNS41IEwxNSA1IFpcIiBmaWxsPVwiY3VycmVudENvbG9yXCIgb3BhY2l0eT1cIjAuN1wiLz5gICtcbiAgICBgPC9zdmc+YFxuICApO1xufVxuXG5mdW5jdGlvbiBzdG9yZUljb25TdmcoKTogc3RyaW5nIHtcbiAgcmV0dXJuIChcbiAgICBgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3M9XCJpY29uLXNtIGlubGluZS1ibG9jayBhbGlnbi1taWRkbGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk00IDguMiA1LjEgNC41QTEuNSAxLjUgMCAwIDEgNi41NSAzLjRoNi45YTEuNSAxLjUgMCAwIDEgMS40NSAxLjFMMTYgOC4yXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNC41IDhoMTF2Ny41QTEuNSAxLjUgMCAwIDEgMTQgMTdINmExLjUgMS41IDAgMCAxLTEuNS0xLjVWOFpcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICBgPHBhdGggZD1cIk03LjUgOHYxYTIuNSAyLjUgMCAwIDAgNSAwVjhcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRQYWdlSWNvblN2ZygpOiBzdHJpbmcge1xuICAvLyBEb2N1bWVudC9wYWdlIGdseXBoIGZvciB0d2Vhay1yZWdpc3RlcmVkIHBhZ2VzIHdpdGhvdXQgdGhlaXIgb3duIGljb24uXG4gIHJldHVybiAoXG4gICAgYDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGNsYXNzPVwiaWNvbi1zbSBpbmxpbmUtYmxvY2sgYWxpZ24tbWlkZGxlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNNSAzaDdsMyAzdjExYTEgMSAwIDAgMS0xIDFINWExIDEgMCAwIDEtMS0xVjRhMSAxIDAgMCAxIDEtMVpcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICBgPHBhdGggZD1cIk0xMiAzdjNhMSAxIDAgMCAwIDEgMWgyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNyAxMWg2TTcgMTRoNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+YCArXG4gICAgYDwvc3ZnPmBcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUljb25VcmwoXG4gIHVybDogc3RyaW5nLFxuICB0d2Vha0Rpcjogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGlmICgvXihodHRwcz86fGRhdGE6KS8udGVzdCh1cmwpKSByZXR1cm4gdXJsO1xuICAvLyBSZWxhdGl2ZSBwYXRoIFx1MjE5MiBhc2sgbWFpbiB0byByZWFkIHRoZSBmaWxlIGFuZCByZXR1cm4gYSBkYXRhOiBVUkwuXG4gIC8vIFJlbmRlcmVyIGlzIHNhbmRib3hlZCBzbyBmaWxlOi8vIHdvbid0IGxvYWQgZGlyZWN0bHkuXG4gIGNvbnN0IHJlbCA9IHVybC5zdGFydHNXaXRoKFwiLi9cIikgPyB1cmwuc2xpY2UoMikgOiB1cmw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIChhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXG4gICAgICBcImNvZGV4cHA6cmVhZC10d2Vhay1hc3NldFwiLFxuICAgICAgdHdlYWtEaXIsXG4gICAgICByZWwsXG4gICAgKSkgYXMgc3RyaW5nO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcGxvZyhcImljb24gbG9hZCBmYWlsZWRcIiwgeyB1cmwsIHR3ZWFrRGlyLCBlcnI6IFN0cmluZyhlKSB9KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgRE9NIGhldXJpc3RpY3MgXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGZpbmRTaWRlYmFySXRlbXNHcm91cCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAvLyBBbmNob3Igc3RyYXRlZ3kgZmlyc3QgKHdvdWxkIGJlIGlkZWFsIGlmIENvZGV4IHN3aXRjaGVzIHRvIDxhPikuXG4gIGNvbnN0IGxpbmtzID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PihcImFbaHJlZio9Jy9zZXR0aW5ncy8nXVwiKSxcbiAgKTtcbiAgaWYgKGxpbmtzLmxlbmd0aCA+PSAyKSB7XG4gICAgbGV0IG5vZGU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IGxpbmtzWzBdLnBhcmVudEVsZW1lbnQ7XG4gICAgd2hpbGUgKG5vZGUpIHtcbiAgICAgIGNvbnN0IGluc2lkZSA9IG5vZGUucXVlcnlTZWxlY3RvckFsbChcImFbaHJlZio9Jy9zZXR0aW5ncy8nXVwiKTtcbiAgICAgIGlmIChpbnNpZGUubGVuZ3RoID49IE1hdGgubWF4KDIsIGxpbmtzLmxlbmd0aCAtIDEpKSByZXR1cm4gbm9kZTtcbiAgICAgIG5vZGUgPSBub2RlLnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gVGV4dC1jb250ZW50IG1hdGNoIGFnYWluc3QgQ29kZXgncyBrbm93biBzaWRlYmFyIGxhYmVscy5cbiAgY29uc3QgS05PV04gPSBbXG4gICAgXCJHZW5lcmFsXCIsXG4gICAgXCJBcHBlYXJhbmNlXCIsXG4gICAgXCJDb25maWd1cmF0aW9uXCIsXG4gICAgXCJQZXJzb25hbGl6YXRpb25cIixcbiAgICBcIk1DUCBzZXJ2ZXJzXCIsXG4gICAgXCJNQ1AgU2VydmVyc1wiLFxuICAgIFwiR2l0XCIsXG4gICAgXCJFbnZpcm9ubWVudHNcIixcbiAgXTtcbiAgY29uc3QgbWF0Y2hlczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuICBjb25zdCBhbGwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcImJ1dHRvbiwgYSwgW3JvbGU9J2J1dHRvbiddLCBsaSwgZGl2XCIsXG4gICk7XG4gIGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShhbGwpKSB7XG4gICAgY29uc3QgdCA9IChlbC50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHQubGVuZ3RoID4gMzApIGNvbnRpbnVlO1xuICAgIGlmIChLTk9XTi5zb21lKChrKSA9PiB0ID09PSBrKSkgbWF0Y2hlcy5wdXNoKGVsKTtcbiAgICBpZiAobWF0Y2hlcy5sZW5ndGggPiA1MCkgYnJlYWs7XG4gIH1cbiAgaWYgKG1hdGNoZXMubGVuZ3RoID49IDIpIHtcbiAgICBsZXQgbm9kZTogSFRNTEVsZW1lbnQgfCBudWxsID0gbWF0Y2hlc1swXS5wYXJlbnRFbGVtZW50O1xuICAgIHdoaWxlIChub2RlKSB7XG4gICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgZm9yIChjb25zdCBtIG9mIG1hdGNoZXMpIGlmIChub2RlLmNvbnRhaW5zKG0pKSBjb3VudCsrO1xuICAgICAgaWYgKGNvdW50ID49IE1hdGgubWluKDMsIG1hdGNoZXMubGVuZ3RoKSkgcmV0dXJuIG5vZGU7XG4gICAgICBub2RlID0gbm9kZS5wYXJlbnRFbGVtZW50O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZENvbnRlbnRBcmVhKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHNpZGViYXIgPSBmaW5kU2lkZWJhckl0ZW1zR3JvdXAoKTtcbiAgaWYgKCFzaWRlYmFyKSByZXR1cm4gbnVsbDtcbiAgbGV0IHBhcmVudCA9IHNpZGViYXIucGFyZW50RWxlbWVudDtcbiAgd2hpbGUgKHBhcmVudCkge1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShwYXJlbnQuY2hpbGRyZW4pIGFzIEhUTUxFbGVtZW50W10pIHtcbiAgICAgIGlmIChjaGlsZCA9PT0gc2lkZWJhciB8fCBjaGlsZC5jb250YWlucyhzaWRlYmFyKSkgY29udGludWU7XG4gICAgICBjb25zdCByID0gY2hpbGQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBpZiAoci53aWR0aCA+IDMwMCAmJiByLmhlaWdodCA+IDIwMCkgcmV0dXJuIGNoaWxkO1xuICAgIH1cbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbWF5YmVEdW1wRG9tKCk6IHZvaWQge1xuICB0cnkge1xuICAgIGNvbnN0IHNpZGViYXIgPSBmaW5kU2lkZWJhckl0ZW1zR3JvdXAoKTtcbiAgICBpZiAoc2lkZWJhciAmJiAhc3RhdGUuc2lkZWJhckR1bXBlZCkge1xuICAgICAgc3RhdGUuc2lkZWJhckR1bXBlZCA9IHRydWU7XG4gICAgICBjb25zdCBzYlJvb3QgPSBzaWRlYmFyLnBhcmVudEVsZW1lbnQgPz8gc2lkZWJhcjtcbiAgICAgIHBsb2coYGNvZGV4IHNpZGViYXIgSFRNTGAsIHNiUm9vdC5vdXRlckhUTUwuc2xpY2UoMCwgMzIwMDApKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGZpbmRDb250ZW50QXJlYSgpO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgaWYgKHN0YXRlLmZpbmdlcnByaW50ICE9PSBsb2NhdGlvbi5ocmVmKSB7XG4gICAgICAgIHN0YXRlLmZpbmdlcnByaW50ID0gbG9jYXRpb24uaHJlZjtcbiAgICAgICAgcGxvZyhcImRvbSBwcm9iZSAobm8gY29udGVudClcIiwge1xuICAgICAgICAgIHVybDogbG9jYXRpb24uaHJlZixcbiAgICAgICAgICBzaWRlYmFyOiBzaWRlYmFyID8gZGVzY3JpYmUoc2lkZWJhcikgOiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHBhbmVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShjb250ZW50LmNoaWxkcmVuKSBhcyBIVE1MRWxlbWVudFtdKSB7XG4gICAgICBpZiAoY2hpbGQuZGF0YXNldC5jb2RleHBwID09PSBcInR3ZWFrcy1wYW5lbFwiKSBjb250aW51ZTtcbiAgICAgIGlmIChjaGlsZC5zdHlsZS5kaXNwbGF5ID09PSBcIm5vbmVcIikgY29udGludWU7XG4gICAgICBwYW5lbCA9IGNoaWxkO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGFjdGl2ZU5hdiA9IHNpZGViYXJcbiAgICAgID8gQXJyYXkuZnJvbShzaWRlYmFyLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiYnV0dG9uLCBhXCIpKS5maW5kKFxuICAgICAgICAgIChiKSA9PlxuICAgICAgICAgICAgYi5nZXRBdHRyaWJ1dGUoXCJhcmlhLWN1cnJlbnRcIikgPT09IFwicGFnZVwiIHx8XG4gICAgICAgICAgICBiLmdldEF0dHJpYnV0ZShcImRhdGEtYWN0aXZlXCIpID09PSBcInRydWVcIiB8fFxuICAgICAgICAgICAgYi5nZXRBdHRyaWJ1dGUoXCJhcmlhLXNlbGVjdGVkXCIpID09PSBcInRydWVcIiB8fFxuICAgICAgICAgICAgYi5jbGFzc0xpc3QuY29udGFpbnMoXCJhY3RpdmVcIiksXG4gICAgICAgIClcbiAgICAgIDogbnVsbDtcbiAgICBjb25zdCBoZWFkaW5nID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFxuICAgICAgXCJoMSwgaDIsIGgzLCBbY2xhc3MqPSdoZWFkaW5nJ11cIixcbiAgICApO1xuICAgIGNvbnN0IGZpbmdlcnByaW50ID0gYCR7YWN0aXZlTmF2Py50ZXh0Q29udGVudCA/PyBcIlwifXwke2hlYWRpbmc/LnRleHRDb250ZW50ID8/IFwiXCJ9fCR7cGFuZWw/LmNoaWxkcmVuLmxlbmd0aCA/PyAwfWA7XG4gICAgaWYgKHN0YXRlLmZpbmdlcnByaW50ID09PSBmaW5nZXJwcmludCkgcmV0dXJuO1xuICAgIHN0YXRlLmZpbmdlcnByaW50ID0gZmluZ2VycHJpbnQ7XG4gICAgcGxvZyhcImRvbSBwcm9iZVwiLCB7XG4gICAgICB1cmw6IGxvY2F0aW9uLmhyZWYsXG4gICAgICBhY3RpdmVOYXY6IGFjdGl2ZU5hdj8udGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBudWxsLFxuICAgICAgaGVhZGluZzogaGVhZGluZz8udGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBudWxsLFxuICAgICAgY29udGVudDogZGVzY3JpYmUoY29udGVudCksXG4gICAgfSk7XG4gICAgaWYgKHBhbmVsKSB7XG4gICAgICBjb25zdCBodG1sID0gcGFuZWwub3V0ZXJIVE1MO1xuICAgICAgcGxvZyhcbiAgICAgICAgYGNvZGV4IHBhbmVsIEhUTUwgKCR7YWN0aXZlTmF2Py50ZXh0Q29udGVudD8udHJpbSgpID8/IFwiP1wifSlgLFxuICAgICAgICBodG1sLnNsaWNlKDAsIDMyMDAwKSxcbiAgICAgICk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgcGxvZyhcImRvbSBwcm9iZSBmYWlsZWRcIiwgU3RyaW5nKGUpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZXNjcmliZShlbDogSFRNTEVsZW1lbnQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgdGFnOiBlbC50YWdOYW1lLFxuICAgIGNsczogZWwuY2xhc3NOYW1lLnNsaWNlKDAsIDEyMCksXG4gICAgaWQ6IGVsLmlkIHx8IHVuZGVmaW5lZCxcbiAgICBjaGlsZHJlbjogZWwuY2hpbGRyZW4ubGVuZ3RoLFxuICAgIHJlY3Q6ICgoKSA9PiB7XG4gICAgICBjb25zdCByID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICByZXR1cm4geyB3OiBNYXRoLnJvdW5kKHIud2lkdGgpLCBoOiBNYXRoLnJvdW5kKHIuaGVpZ2h0KSB9O1xuICAgIH0pKCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHR3ZWFrc1BhdGgoKTogc3RyaW5nIHtcbiAgcmV0dXJuIChcbiAgICAod2luZG93IGFzIHVua25vd24gYXMgeyBfX2NvZGV4cHBfdHdlYWtzX2Rpcl9fPzogc3RyaW5nIH0pLl9fY29kZXhwcF90d2Vha3NfZGlyX18gPz9cbiAgICBcIjx1c2VyIGRpcj4vdHdlYWtzXCJcbiAgKTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IFR3ZWFrTWFuaWZlc3QgfSBmcm9tIFwiQGNvZGV4LXBsdXNwbHVzL3Nka1wiO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9UV0VBS19TVE9SRV9JTkRFWF9VUkwgPVxuICBcImh0dHBzOi8vYi1ubmV0dC5naXRodWIuaW8vY29kZXgtcGx1c3BsdXMvc3RvcmUvaW5kZXguanNvblwiO1xuZXhwb3J0IGNvbnN0IFRXRUFLX1NUT1JFX1JFVklFV19JU1NVRV9VUkwgPVxuICBcImh0dHBzOi8vZ2l0aHViLmNvbS9iLW5uZXR0L2NvZGV4LXBsdXNwbHVzL2lzc3Vlcy9uZXdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBUd2Vha1N0b3JlUmVnaXN0cnkge1xuICBzY2hlbWFWZXJzaW9uOiAxO1xuICBnZW5lcmF0ZWRBdD86IHN0cmluZztcbiAgZW50cmllczogVHdlYWtTdG9yZUVudHJ5W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHdlYWtTdG9yZUVudHJ5IHtcbiAgaWQ6IHN0cmluZztcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG4gIHJlcG86IHN0cmluZztcbiAgYXBwcm92ZWRDb21taXRTaGE6IHN0cmluZztcbiAgYXBwcm92ZWRBdDogc3RyaW5nO1xuICBhcHByb3ZlZEJ5OiBzdHJpbmc7XG4gIHNjcmVlbnNob3RzOiBUd2Vha1N0b3JlU2NyZWVuc2hvdFtdO1xuICByZWxlYXNlVXJsPzogc3RyaW5nO1xuICByZXZpZXdVcmw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHdlYWtTdG9yZVNjcmVlbnNob3Qge1xuICB1cmw6IHN0cmluZztcbiAgd2lkdGg6IDE5MjA7XG4gIGhlaWdodDogMTA4MDtcbiAgYWx0Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbiB7XG4gIHJlcG86IHN0cmluZztcbiAgZGVmYXVsdEJyYW5jaDogc3RyaW5nO1xuICBjb21taXRTaGE6IHN0cmluZztcbiAgY29tbWl0VXJsOiBzdHJpbmc7XG4gIG1hbmlmZXN0Pzoge1xuICAgIGlkPzogc3RyaW5nO1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgfTtcbn1cblxuY29uc3QgR0lUSFVCX1JFUE9fUkUgPSAvXltBLVphLXowLTlfLi1dK1xcL1tBLVphLXowLTlfLi1dKyQvO1xuY29uc3QgRlVMTF9TSEFfUkUgPSAvXlthLWYwLTldezQwfSQvaTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUdpdEh1YlJlcG8oaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHJhdyA9IGlucHV0LnRyaW0oKTtcbiAgaWYgKCFyYXcpIHRocm93IG5ldyBFcnJvcihcIkdpdEh1YiByZXBvIGlzIHJlcXVpcmVkXCIpO1xuXG4gIGNvbnN0IHNzaCA9IC9eZ2l0QGdpdGh1YlxcLmNvbTooW14vXStcXC9bXi9dKz8pKD86XFwuZ2l0KT8kL2kuZXhlYyhyYXcpO1xuICBpZiAoc3NoKSByZXR1cm4gbm9ybWFsaXplUmVwb1BhcnQoc3NoWzFdKTtcblxuICBpZiAoL15odHRwcz86XFwvXFwvL2kudGVzdChyYXcpKSB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChyYXcpO1xuICAgIGlmICh1cmwuaG9zdG5hbWUgIT09IFwiZ2l0aHViLmNvbVwiKSB0aHJvdyBuZXcgRXJyb3IoXCJPbmx5IGdpdGh1Yi5jb20gcmVwb3NpdG9yaWVzIGFyZSBzdXBwb3J0ZWRcIik7XG4gICAgY29uc3QgcGFydHMgPSB1cmwucGF0aG5hbWUucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgXCJcIikuc3BsaXQoXCIvXCIpO1xuICAgIGlmIChwYXJ0cy5sZW5ndGggPCAyKSB0aHJvdyBuZXcgRXJyb3IoXCJHaXRIdWIgcmVwbyBVUkwgbXVzdCBpbmNsdWRlIG93bmVyIGFuZCByZXBvc2l0b3J5XCIpO1xuICAgIHJldHVybiBub3JtYWxpemVSZXBvUGFydChgJHtwYXJ0c1swXX0vJHtwYXJ0c1sxXX1gKTtcbiAgfVxuXG4gIHJldHVybiBub3JtYWxpemVSZXBvUGFydChyYXcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU3RvcmVSZWdpc3RyeShpbnB1dDogdW5rbm93bik6IFR3ZWFrU3RvcmVSZWdpc3RyeSB7XG4gIGNvbnN0IHJlZ2lzdHJ5ID0gaW5wdXQgYXMgUGFydGlhbDxUd2Vha1N0b3JlUmVnaXN0cnk+IHwgbnVsbDtcbiAgaWYgKCFyZWdpc3RyeSB8fCByZWdpc3RyeS5zY2hlbWFWZXJzaW9uICE9PSAxIHx8ICFBcnJheS5pc0FycmF5KHJlZ2lzdHJ5LmVudHJpZXMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5zdXBwb3J0ZWQgdHdlYWsgc3RvcmUgcmVnaXN0cnlcIik7XG4gIH1cbiAgY29uc3QgZW50cmllcyA9IHJlZ2lzdHJ5LmVudHJpZXMubWFwKG5vcm1hbGl6ZVN0b3JlRW50cnkpO1xuICBlbnRyaWVzLnNvcnQoKGEsIGIpID0+IGEubWFuaWZlc3QubmFtZS5sb2NhbGVDb21wYXJlKGIubWFuaWZlc3QubmFtZSkpO1xuICByZXR1cm4ge1xuICAgIHNjaGVtYVZlcnNpb246IDEsXG4gICAgZ2VuZXJhdGVkQXQ6IHR5cGVvZiByZWdpc3RyeS5nZW5lcmF0ZWRBdCA9PT0gXCJzdHJpbmdcIiA/IHJlZ2lzdHJ5LmdlbmVyYXRlZEF0IDogdW5kZWZpbmVkLFxuICAgIGVudHJpZXMsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTdG9yZUVudHJ5KGlucHV0OiB1bmtub3duKTogVHdlYWtTdG9yZUVudHJ5IHtcbiAgY29uc3QgZW50cnkgPSBpbnB1dCBhcyBQYXJ0aWFsPFR3ZWFrU3RvcmVFbnRyeT4gfCBudWxsO1xuICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB0d2VhayBzdG9yZSBlbnRyeVwiKTtcbiAgY29uc3QgcmVwbyA9IG5vcm1hbGl6ZUdpdEh1YlJlcG8oU3RyaW5nKGVudHJ5LnJlcG8gPz8gZW50cnkubWFuaWZlc3Q/LmdpdGh1YlJlcG8gPz8gXCJcIikpO1xuICBjb25zdCBtYW5pZmVzdCA9IGVudHJ5Lm1hbmlmZXN0IGFzIFR3ZWFrTWFuaWZlc3QgfCB1bmRlZmluZWQ7XG4gIGlmICghbWFuaWZlc3Q/LmlkIHx8ICFtYW5pZmVzdC5uYW1lIHx8ICFtYW5pZmVzdC52ZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSBmb3IgJHtyZXBvfSBpcyBtaXNzaW5nIG1hbmlmZXN0IGZpZWxkc2ApO1xuICB9XG4gIGlmIChub3JtYWxpemVHaXRIdWJSZXBvKG1hbmlmZXN0LmdpdGh1YlJlcG8pICE9PSByZXBvKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSAke21hbmlmZXN0LmlkfSByZXBvIGRvZXMgbm90IG1hdGNoIG1hbmlmZXN0IGdpdGh1YlJlcG9gKTtcbiAgfVxuICBpZiAoIWlzRnVsbENvbW1pdFNoYShTdHJpbmcoZW50cnkuYXBwcm92ZWRDb21taXRTaGEgPz8gXCJcIikpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBTdG9yZSBlbnRyeSAke21hbmlmZXN0LmlkfSBtdXN0IHBpbiBhIGZ1bGwgYXBwcm92ZWQgY29tbWl0IFNIQWApO1xuICB9XG4gIGNvbnN0IHNjcmVlbnNob3RzID0gQXJyYXkuaXNBcnJheShlbnRyeS5zY3JlZW5zaG90cylcbiAgICA/IGVudHJ5LnNjcmVlbnNob3RzLm1hcChub3JtYWxpemVTdG9yZVNjcmVlbnNob3QpXG4gICAgOiBbXTtcbiAgcmV0dXJuIHtcbiAgICBpZDogbWFuaWZlc3QuaWQsXG4gICAgbWFuaWZlc3QsXG4gICAgcmVwbyxcbiAgICBhcHByb3ZlZENvbW1pdFNoYTogU3RyaW5nKGVudHJ5LmFwcHJvdmVkQ29tbWl0U2hhKSxcbiAgICBhcHByb3ZlZEF0OiB0eXBlb2YgZW50cnkuYXBwcm92ZWRBdCA9PT0gXCJzdHJpbmdcIiA/IGVudHJ5LmFwcHJvdmVkQXQgOiBcIlwiLFxuICAgIGFwcHJvdmVkQnk6IHR5cGVvZiBlbnRyeS5hcHByb3ZlZEJ5ID09PSBcInN0cmluZ1wiID8gZW50cnkuYXBwcm92ZWRCeSA6IFwiXCIsXG4gICAgc2NyZWVuc2hvdHMsXG4gICAgcmVsZWFzZVVybDogb3B0aW9uYWxHaXRodWJVcmwoZW50cnkucmVsZWFzZVVybCksXG4gICAgcmV2aWV3VXJsOiBvcHRpb25hbEdpdGh1YlVybChlbnRyeS5yZXZpZXdVcmwpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RvcmVBcmNoaXZlVXJsKGVudHJ5OiBUd2Vha1N0b3JlRW50cnkpOiBzdHJpbmcge1xuICBpZiAoIWlzRnVsbENvbW1pdFNoYShlbnRyeS5hcHByb3ZlZENvbW1pdFNoYSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFN0b3JlIGVudHJ5ICR7ZW50cnkuaWR9IGlzIG5vdCBwaW5uZWQgdG8gYSBmdWxsIGNvbW1pdCBTSEFgKTtcbiAgfVxuICByZXR1cm4gYGh0dHBzOi8vY29kZWxvYWQuZ2l0aHViLmNvbS8ke2VudHJ5LnJlcG99L3Rhci5nei8ke2VudHJ5LmFwcHJvdmVkQ29tbWl0U2hhfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFR3ZWFrUHVibGlzaElzc3VlVXJsKHN1Ym1pc3Npb246IFR3ZWFrU3RvcmVQdWJsaXNoU3VibWlzc2lvbik6IHN0cmluZyB7XG4gIGNvbnN0IHJlcG8gPSBub3JtYWxpemVHaXRIdWJSZXBvKHN1Ym1pc3Npb24ucmVwbyk7XG4gIGlmICghaXNGdWxsQ29tbWl0U2hhKHN1Ym1pc3Npb24uY29tbWl0U2hhKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlN1Ym1pc3Npb24gbXVzdCBpbmNsdWRlIHRoZSBmdWxsIGNvbW1pdCBTSEEgdG8gcmV2aWV3XCIpO1xuICB9XG4gIGNvbnN0IHRpdGxlID0gYFR3ZWFrIHN0b3JlIHJldmlldzogJHtyZXBvfWA7XG4gIGNvbnN0IGJvZHkgPSBbXG4gICAgXCIjIyBUd2VhayByZXBvXCIsXG4gICAgYGh0dHBzOi8vZ2l0aHViLmNvbS8ke3JlcG99YCxcbiAgICBcIlwiLFxuICAgIFwiIyMgQ29tbWl0IHRvIHJldmlld1wiLFxuICAgIHN1Ym1pc3Npb24uY29tbWl0U2hhLFxuICAgIHN1Ym1pc3Npb24uY29tbWl0VXJsLFxuICAgIFwiXCIsXG4gICAgXCJEbyBub3QgYXBwcm92ZSBhIGRpZmZlcmVudCBjb21taXQuIElmIHRoZSBhdXRob3IgcHVzaGVzIGNoYW5nZXMsIGFzayB0aGVtIHRvIHJlc3VibWl0LlwiLFxuICAgIFwiXCIsXG4gICAgXCIjIyBNYW5pZmVzdFwiLFxuICAgIGAtIGlkOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LmlkID8/IFwiKG5vdCBkZXRlY3RlZClcIn1gLFxuICAgIGAtIG5hbWU6ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8ubmFtZSA/PyBcIihub3QgZGV0ZWN0ZWQpXCJ9YCxcbiAgICBgLSB2ZXJzaW9uOiAke3N1Ym1pc3Npb24ubWFuaWZlc3Q/LnZlcnNpb24gPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgYC0gZGVzY3JpcHRpb246ICR7c3VibWlzc2lvbi5tYW5pZmVzdD8uZGVzY3JpcHRpb24gPz8gXCIobm90IGRldGVjdGVkKVwifWAsXG4gICAgXCJcIixcbiAgICBcIiMjIFNjcmVlbnNob3RzXCIsXG4gICAgXCJTY3JlZW5zaG90cyBtdXN0IGJlIGNvbW1pdHRlZCBpbiB0aGUgcmVwbyBhdCB0aGUgcmV2aWV3ZWQgY29tbWl0LlwiLFxuICAgIFwiRXhwZWN0ZWQgbG9jYXRpb246IGAuY29kZXhwcC1zdG9yZS9zY3JlZW5zaG90cy9gXCIsXG4gICAgXCJSZXF1aXJlZDogMS0zIGltYWdlcywgZWFjaCBleGFjdGx5IDE5MjB4MTA4MC5cIixcbiAgICBcIlwiLFxuICAgIFwiIyMgQWRtaW4gY2hlY2tsaXN0XCIsXG4gICAgXCItIFsgXSBtYW5pZmVzdC5qc29uIGlzIHZhbGlkXCIsXG4gICAgXCItIFsgXSBzY3JlZW5zaG90cyBleGlzdCBhdCB0aGUgcmV2aWV3ZWQgY29tbWl0IGFuZCBhcmUgZXhhY3RseSAxOTIweDEwODBcIixcbiAgICBcIi0gWyBdIHNvdXJjZSB3YXMgcmV2aWV3ZWQgYXQgdGhlIGV4YWN0IGNvbW1pdCBhYm92ZVwiLFxuICAgIFwiLSBbIF0gYHN0b3JlL2luZGV4Lmpzb25gIGVudHJ5IHBpbnMgYGFwcHJvdmVkQ29tbWl0U2hhYCB0byB0aGUgZXhhY3QgY29tbWl0IGFib3ZlXCIsXG4gICAgXCItIFsgXSBzY3JlZW5zaG90IFVSTHMgaW4gYHN0b3JlL2luZGV4Lmpzb25gIHBvaW50IGF0IGltbXV0YWJsZSByYXcgVVJMcyBmb3IgdGhlIGV4YWN0IGNvbW1pdCBhYm92ZVwiLFxuICBdLmpvaW4oXCJcXG5cIik7XG4gIGNvbnN0IHVybCA9IG5ldyBVUkwoVFdFQUtfU1RPUkVfUkVWSUVXX0lTU1VFX1VSTCk7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwidGVtcGxhdGVcIiwgXCJ0d2Vhay1zdG9yZS1yZXZpZXcubWRcIik7XG4gIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwidGl0bGVcIiwgdGl0bGUpO1xuICB1cmwuc2VhcmNoUGFyYW1zLnNldChcImJvZHlcIiwgYm9keSk7XG4gIHJldHVybiB1cmwudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRnVsbENvbW1pdFNoYSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBGVUxMX1NIQV9SRS50ZXN0KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUmVwb1BhcnQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHJlcG8gPSB2YWx1ZS50cmltKCkucmVwbGFjZSgvXFwuZ2l0JC9pLCBcIlwiKS5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKTtcbiAgaWYgKCFHSVRIVUJfUkVQT19SRS50ZXN0KHJlcG8pKSB0aHJvdyBuZXcgRXJyb3IoXCJHaXRIdWIgcmVwbyBtdXN0IGJlIGluIG93bmVyL3JlcG8gZm9ybVwiKTtcbiAgcmV0dXJuIHJlcG87XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0b3JlU2NyZWVuc2hvdChpbnB1dDogdW5rbm93bik6IFR3ZWFrU3RvcmVTY3JlZW5zaG90IHtcbiAgY29uc3Qgc2hvdCA9IGlucHV0IGFzIFBhcnRpYWw8VHdlYWtTdG9yZVNjcmVlbnNob3Q+IHwgbnVsbDtcbiAgaWYgKCFzaG90IHx8IHNob3Qud2lkdGggIT09IDE5MjAgfHwgc2hvdC5oZWlnaHQgIT09IDEwODAgfHwgdHlwZW9mIHNob3QudXJsICE9PSBcInN0cmluZ1wiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiU3RvcmUgc2NyZWVuc2hvdHMgbXVzdCBiZSBleGFjdGx5IDE5MjB4MTA4MFwiKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHVybDogc2hvdC51cmwsXG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGFsdDogdHlwZW9mIHNob3QuYWx0ID09PSBcInN0cmluZ1wiID8gc2hvdC5hbHQgOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIG9wdGlvbmFsR2l0aHViVXJsKHZhbHVlOiB1bmtub3duKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIiB8fCAhdmFsdWUudHJpbSgpKSByZXR1cm4gdW5kZWZpbmVkO1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKHZhbHVlKTtcbiAgaWYgKHVybC5wcm90b2NvbCAhPT0gXCJodHRwczpcIiB8fCB1cmwuaG9zdG5hbWUgIT09IFwiZ2l0aHViLmNvbVwiKSByZXR1cm4gdW5kZWZpbmVkO1xuICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG59XG4iLCAiLyoqXG4gKiBSZW5kZXJlci1zaWRlIHR3ZWFrIGhvc3QuIFdlOlxuICogICAxLiBBc2sgbWFpbiBmb3IgdGhlIHR3ZWFrIGxpc3QgKHdpdGggcmVzb2x2ZWQgZW50cnkgcGF0aCkuXG4gKiAgIDIuIEZvciBlYWNoIHJlbmRlcmVyLXNjb3BlZCAob3IgXCJib3RoXCIpIHR3ZWFrLCBmZXRjaCBpdHMgc291cmNlIHZpYSBJUENcbiAqICAgICAgYW5kIGV4ZWN1dGUgaXQgYXMgYSBDb21tb25KUy1zaGFwZWQgZnVuY3Rpb24uXG4gKiAgIDMuIFByb3ZpZGUgaXQgdGhlIHJlbmRlcmVyIGhhbGYgb2YgdGhlIEFQSS5cbiAqXG4gKiBDb2RleCBydW5zIHRoZSByZW5kZXJlciB3aXRoIHNhbmRib3g6IHRydWUsIHNvIE5vZGUncyBgcmVxdWlyZSgpYCBpc1xuICogcmVzdHJpY3RlZCB0byBhIHRpbnkgd2hpdGVsaXN0IChlbGVjdHJvbiArIGEgZmV3IHBvbHlmaWxscykuIFRoYXQgbWVhbnMgd2VcbiAqIGNhbm5vdCBgcmVxdWlyZSgpYCBhcmJpdHJhcnkgdHdlYWsgZmlsZXMgZnJvbSBkaXNrLiBJbnN0ZWFkIHdlIHB1bGwgdGhlXG4gKiBzb3VyY2Ugc3RyaW5nIGZyb20gbWFpbiBhbmQgZXZhbHVhdGUgaXQgd2l0aCBgbmV3IEZ1bmN0aW9uYCBpbnNpZGUgdGhlXG4gKiBwcmVsb2FkIGNvbnRleHQuIFR3ZWFrIGF1dGhvcnMgd2hvIG5lZWQgbnBtIGRlcHMgbXVzdCBidW5kbGUgdGhlbSBpbi5cbiAqL1xuXG5pbXBvcnQgeyBpcGNSZW5kZXJlciB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgcmVnaXN0ZXJTZWN0aW9uLCByZWdpc3RlclBhZ2UsIGNsZWFyU2VjdGlvbnMsIHNldExpc3RlZFR3ZWFrcyB9IGZyb20gXCIuL3NldHRpbmdzLWluamVjdG9yXCI7XG5pbXBvcnQgeyBmaWJlckZvck5vZGUgfSBmcm9tIFwiLi9yZWFjdC1ob29rXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFR3ZWFrTWFuaWZlc3QsXG4gIFR3ZWFrQXBpLFxuICBSZWFjdEZpYmVyTm9kZSxcbiAgVHdlYWssXG59IGZyb20gXCJAY29kZXgtcGx1c3BsdXMvc2RrXCI7XG5cbmludGVyZmFjZSBMaXN0ZWRUd2VhayB7XG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0O1xuICBlbnRyeTogc3RyaW5nO1xuICBkaXI6IHN0cmluZztcbiAgZW50cnlFeGlzdHM6IGJvb2xlYW47XG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIHVwZGF0ZToge1xuICAgIGNoZWNrZWRBdDogc3RyaW5nO1xuICAgIHJlcG86IHN0cmluZztcbiAgICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICAgIGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGw7XG4gICAgbGF0ZXN0VGFnOiBzdHJpbmcgfCBudWxsO1xuICAgIHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7XG4gICAgdXBkYXRlQXZhaWxhYmxlOiBib29sZWFuO1xuICAgIGVycm9yPzogc3RyaW5nO1xuICB9IHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIFVzZXJQYXRocyB7XG4gIHVzZXJSb290OiBzdHJpbmc7XG4gIHJ1bnRpbWVEaXI6IHN0cmluZztcbiAgdHdlYWtzRGlyOiBzdHJpbmc7XG4gIGxvZ0Rpcjogc3RyaW5nO1xufVxuXG5jb25zdCBsb2FkZWQgPSBuZXcgTWFwPHN0cmluZywgeyBzdG9wPzogKCkgPT4gdm9pZCB9PigpO1xubGV0IGNhY2hlZFBhdGhzOiBVc2VyUGF0aHMgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0YXJ0VHdlYWtIb3N0KCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB0d2Vha3MgPSAoYXdhaXQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDpsaXN0LXR3ZWFrc1wiKSkgYXMgTGlzdGVkVHdlYWtbXTtcbiAgY29uc3QgcGF0aHMgPSAoYXdhaXQgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDp1c2VyLXBhdGhzXCIpKSBhcyBVc2VyUGF0aHM7XG4gIGNhY2hlZFBhdGhzID0gcGF0aHM7XG4gIC8vIFB1c2ggdGhlIGxpc3QgdG8gdGhlIHNldHRpbmdzIGluamVjdG9yIHNvIHRoZSBUd2Vha3MgcGFnZSBjYW4gcmVuZGVyXG4gIC8vIGNhcmRzIGV2ZW4gYmVmb3JlIGFueSB0d2VhaydzIHN0YXJ0KCkgcnVucyAoYW5kIGZvciBkaXNhYmxlZCB0d2Vha3NcbiAgLy8gdGhhdCB3ZSBuZXZlciBsb2FkKS5cbiAgc2V0TGlzdGVkVHdlYWtzKHR3ZWFrcyk7XG4gIC8vIFN0YXNoIGZvciB0aGUgc2V0dGluZ3MgaW5qZWN0b3IncyBlbXB0eS1zdGF0ZSBtZXNzYWdlLlxuICAod2luZG93IGFzIHVua25vd24gYXMgeyBfX2NvZGV4cHBfdHdlYWtzX2Rpcl9fPzogc3RyaW5nIH0pLl9fY29kZXhwcF90d2Vha3NfZGlyX18gPVxuICAgIHBhdGhzLnR3ZWFrc0RpcjtcblxuICBmb3IgKGNvbnN0IHQgb2YgdHdlYWtzKSB7XG4gICAgaWYgKHQubWFuaWZlc3Quc2NvcGUgPT09IFwibWFpblwiKSBjb250aW51ZTtcbiAgICBpZiAoIXQuZW50cnlFeGlzdHMpIGNvbnRpbnVlO1xuICAgIGlmICghdC5lbmFibGVkKSBjb250aW51ZTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgbG9hZFR3ZWFrKHQsIHBhdGhzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiW2NvZGV4LXBsdXNwbHVzXSB0d2VhayBsb2FkIGZhaWxlZDpcIiwgdC5tYW5pZmVzdC5pZCwgZSk7XG4gICAgICB0cnkge1xuICAgICAgICBpcGNSZW5kZXJlci5zZW5kKFxuICAgICAgICAgIFwiY29kZXhwcDpwcmVsb2FkLWxvZ1wiLFxuICAgICAgICAgIFwiZXJyb3JcIixcbiAgICAgICAgICBcInR3ZWFrIGxvYWQgZmFpbGVkOiBcIiArIHQubWFuaWZlc3QuaWQgKyBcIjogXCIgKyBTdHJpbmcoKGUgYXMgRXJyb3IpPy5zdGFjayA/PyBlKSxcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gIH1cblxuICBjb25zb2xlLmluZm8oXG4gICAgYFtjb2RleC1wbHVzcGx1c10gcmVuZGVyZXIgaG9zdCBsb2FkZWQgJHtsb2FkZWQuc2l6ZX0gdHdlYWsocyk6YCxcbiAgICBbLi4ubG9hZGVkLmtleXMoKV0uam9pbihcIiwgXCIpIHx8IFwiKG5vbmUpXCIsXG4gICk7XG4gIGlwY1JlbmRlcmVyLnNlbmQoXG4gICAgXCJjb2RleHBwOnByZWxvYWQtbG9nXCIsXG4gICAgXCJpbmZvXCIsXG4gICAgYHJlbmRlcmVyIGhvc3QgbG9hZGVkICR7bG9hZGVkLnNpemV9IHR3ZWFrKHMpOiAke1suLi5sb2FkZWQua2V5cygpXS5qb2luKFwiLCBcIikgfHwgXCIobm9uZSlcIn1gLFxuICApO1xufVxuXG4vKipcbiAqIFN0b3AgZXZlcnkgcmVuZGVyZXItc2NvcGUgdHdlYWsgc28gYSBzdWJzZXF1ZW50IGBzdGFydFR3ZWFrSG9zdCgpYCB3aWxsXG4gKiByZS1ldmFsdWF0ZSBmcmVzaCBzb3VyY2UuIE1vZHVsZSBjYWNoZSBpc24ndCByZWxldmFudCBzaW5jZSB3ZSBldmFsXG4gKiBzb3VyY2Ugc3RyaW5ncyBkaXJlY3RseSBcdTIwMTQgZWFjaCBsb2FkIGNyZWF0ZXMgYSBmcmVzaCBzY29wZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlYXJkb3duVHdlYWtIb3N0KCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtpZCwgdF0gb2YgbG9hZGVkKSB7XG4gICAgdHJ5IHtcbiAgICAgIHQuc3RvcD8uKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS53YXJuKFwiW2NvZGV4LXBsdXNwbHVzXSB0d2VhayBzdG9wIGZhaWxlZDpcIiwgaWQsIGUpO1xuICAgIH1cbiAgfVxuICBsb2FkZWQuY2xlYXIoKTtcbiAgY2xlYXJTZWN0aW9ucygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkVHdlYWsodDogTGlzdGVkVHdlYWssIHBhdGhzOiBVc2VyUGF0aHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc291cmNlID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcbiAgICBcImNvZGV4cHA6cmVhZC10d2Vhay1zb3VyY2VcIixcbiAgICB0LmVudHJ5LFxuICApKSBhcyBzdHJpbmc7XG5cbiAgLy8gRXZhbHVhdGUgYXMgQ0pTLXNoYXBlZDogcHJvdmlkZSBtb2R1bGUvZXhwb3J0cy9hcGkuIFR3ZWFrIGNvZGUgbWF5IHVzZVxuICAvLyBgbW9kdWxlLmV4cG9ydHMgPSB7IHN0YXJ0LCBzdG9wIH1gIG9yIGBleHBvcnRzLnN0YXJ0ID0gLi4uYCBvciBwdXJlIEVTTVxuICAvLyBkZWZhdWx0IGV4cG9ydCBzaGFwZSAod2UgYWNjZXB0IGJvdGgpLlxuICBjb25zdCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IGFzIHsgZGVmYXVsdD86IFR3ZWFrIH0gJiBUd2VhayB9O1xuICBjb25zdCBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8taW1wbGllZC1ldmFsLCBuby1uZXctZnVuY1xuICBjb25zdCBmbiA9IG5ldyBGdW5jdGlvbihcbiAgICBcIm1vZHVsZVwiLFxuICAgIFwiZXhwb3J0c1wiLFxuICAgIFwiY29uc29sZVwiLFxuICAgIGAke3NvdXJjZX1cXG4vLyMgc291cmNlVVJMPWNvZGV4cHAtdHdlYWs6Ly8ke2VuY29kZVVSSUNvbXBvbmVudCh0Lm1hbmlmZXN0LmlkKX0vJHtlbmNvZGVVUklDb21wb25lbnQodC5lbnRyeSl9YCxcbiAgKTtcbiAgZm4obW9kdWxlLCBleHBvcnRzLCBjb25zb2xlKTtcbiAgY29uc3QgbW9kID0gbW9kdWxlLmV4cG9ydHMgYXMgeyBkZWZhdWx0PzogVHdlYWsgfSAmIFR3ZWFrO1xuICBjb25zdCB0d2VhazogVHdlYWsgPSAobW9kIGFzIHsgZGVmYXVsdD86IFR3ZWFrIH0pLmRlZmF1bHQgPz8gKG1vZCBhcyBUd2Vhayk7XG4gIGlmICh0eXBlb2YgdHdlYWs/LnN0YXJ0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHR3ZWFrICR7dC5tYW5pZmVzdC5pZH0gaGFzIG5vIHN0YXJ0KClgKTtcbiAgfVxuICBjb25zdCBhcGkgPSBtYWtlUmVuZGVyZXJBcGkodC5tYW5pZmVzdCwgcGF0aHMpO1xuICBhd2FpdCB0d2Vhay5zdGFydChhcGkpO1xuICBsb2FkZWQuc2V0KHQubWFuaWZlc3QuaWQsIHsgc3RvcDogdHdlYWsuc3RvcD8uYmluZCh0d2VhaykgfSk7XG59XG5cbmZ1bmN0aW9uIG1ha2VSZW5kZXJlckFwaShtYW5pZmVzdDogVHdlYWtNYW5pZmVzdCwgcGF0aHM6IFVzZXJQYXRocyk6IFR3ZWFrQXBpIHtcbiAgY29uc3QgaWQgPSBtYW5pZmVzdC5pZDtcbiAgY29uc3QgbG9nID0gKGxldmVsOiBcImRlYnVnXCIgfCBcImluZm9cIiB8IFwid2FyblwiIHwgXCJlcnJvclwiLCAuLi5hOiB1bmtub3duW10pID0+IHtcbiAgICBjb25zdCBjb25zb2xlRm4gPVxuICAgICAgbGV2ZWwgPT09IFwiZGVidWdcIiA/IGNvbnNvbGUuZGVidWdcbiAgICAgIDogbGV2ZWwgPT09IFwid2FyblwiID8gY29uc29sZS53YXJuXG4gICAgICA6IGxldmVsID09PSBcImVycm9yXCIgPyBjb25zb2xlLmVycm9yXG4gICAgICA6IGNvbnNvbGUubG9nO1xuICAgIGNvbnNvbGVGbihgW2NvZGV4LXBsdXNwbHVzXVske2lkfV1gLCAuLi5hKTtcbiAgICAvLyBBbHNvIG1pcnJvciB0byBtYWluJ3MgbG9nIGZpbGUgc28gd2UgY2FuIGRpYWdub3NlIHR3ZWFrIGJlaGF2aW9yXG4gICAgLy8gd2l0aG91dCBhdHRhY2hpbmcgRGV2VG9vbHMuIFN0cmluZ2lmeSBlYWNoIGFyZyBkZWZlbnNpdmVseS5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFydHMgPSBhLm1hcCgodikgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIHJldHVybiB2O1xuICAgICAgICBpZiAodiBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gYCR7di5uYW1lfTogJHt2Lm1lc3NhZ2V9YDtcbiAgICAgICAgdHJ5IHsgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpOyB9IGNhdGNoIHsgcmV0dXJuIFN0cmluZyh2KTsgfVxuICAgICAgfSk7XG4gICAgICBpcGNSZW5kZXJlci5zZW5kKFxuICAgICAgICBcImNvZGV4cHA6cHJlbG9hZC1sb2dcIixcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGBbdHdlYWsgJHtpZH1dICR7cGFydHMuam9pbihcIiBcIil9YCxcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBzd2FsbG93IFx1MjAxNCBuZXZlciBsZXQgbG9nZ2luZyBicmVhayBhIHR3ZWFrICovXG4gICAgfVxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgbWFuaWZlc3QsXG4gICAgcHJvY2VzczogXCJyZW5kZXJlclwiLFxuICAgIGxvZzoge1xuICAgICAgZGVidWc6ICguLi5hKSA9PiBsb2coXCJkZWJ1Z1wiLCAuLi5hKSxcbiAgICAgIGluZm86ICguLi5hKSA9PiBsb2coXCJpbmZvXCIsIC4uLmEpLFxuICAgICAgd2FybjogKC4uLmEpID0+IGxvZyhcIndhcm5cIiwgLi4uYSksXG4gICAgICBlcnJvcjogKC4uLmEpID0+IGxvZyhcImVycm9yXCIsIC4uLmEpLFxuICAgIH0sXG4gICAgc3RvcmFnZTogcmVuZGVyZXJTdG9yYWdlKGlkKSxcbiAgICBzZXR0aW5nczoge1xuICAgICAgcmVnaXN0ZXI6IChzKSA9PiByZWdpc3RlclNlY3Rpb24oeyAuLi5zLCBpZDogYCR7aWR9OiR7cy5pZH1gIH0pLFxuICAgICAgcmVnaXN0ZXJQYWdlOiAocCkgPT5cbiAgICAgICAgcmVnaXN0ZXJQYWdlKGlkLCBtYW5pZmVzdCwgeyAuLi5wLCBpZDogYCR7aWR9OiR7cC5pZH1gIH0pLFxuICAgIH0sXG4gICAgcmVhY3Q6IHtcbiAgICAgIGdldEZpYmVyOiAobikgPT4gZmliZXJGb3JOb2RlKG4pIGFzIFJlYWN0RmliZXJOb2RlIHwgbnVsbCxcbiAgICAgIGZpbmRPd25lckJ5TmFtZTogKG4sIG5hbWUpID0+IHtcbiAgICAgICAgbGV0IGYgPSBmaWJlckZvck5vZGUobikgYXMgUmVhY3RGaWJlck5vZGUgfCBudWxsO1xuICAgICAgICB3aGlsZSAoZikge1xuICAgICAgICAgIGNvbnN0IHQgPSBmLnR5cGUgYXMgeyBkaXNwbGF5TmFtZT86IHN0cmluZzsgbmFtZT86IHN0cmluZyB9IHwgbnVsbDtcbiAgICAgICAgICBpZiAodCAmJiAodC5kaXNwbGF5TmFtZSA9PT0gbmFtZSB8fCB0Lm5hbWUgPT09IG5hbWUpKSByZXR1cm4gZjtcbiAgICAgICAgICBmID0gZi5yZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgd2FpdEZvckVsZW1lbnQ6IChzZWwsIHRpbWVvdXRNcyA9IDUwMDApID0+XG4gICAgICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBleGlzdGluZyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsKTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmcpIHJldHVybiByZXNvbHZlKGV4aXN0aW5nKTtcbiAgICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XG4gICAgICAgICAgY29uc3Qgb2JzID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbCk7XG4gICAgICAgICAgICBpZiAoZWwpIHtcbiAgICAgICAgICAgICAgb2JzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShlbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKERhdGUubm93KCkgPiBkZWFkbGluZSkge1xuICAgICAgICAgICAgICBvYnMuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGB0aW1lb3V0IHdhaXRpbmcgZm9yICR7c2VsfWApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvYnMub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgICB9KSxcbiAgICB9LFxuICAgIGlwYzoge1xuICAgICAgb246IChjLCBoKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyYXBwZWQgPSAoX2U6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gaCguLi5hcmdzKTtcbiAgICAgICAgaXBjUmVuZGVyZXIub24oYGNvZGV4cHA6JHtpZH06JHtjfWAsIHdyYXBwZWQpO1xuICAgICAgICByZXR1cm4gKCkgPT4gaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoYGNvZGV4cHA6JHtpZH06JHtjfWAsIHdyYXBwZWQpO1xuICAgICAgfSxcbiAgICAgIHNlbmQ6IChjLCAuLi5hcmdzKSA9PiBpcGNSZW5kZXJlci5zZW5kKGBjb2RleHBwOiR7aWR9OiR7Y31gLCAuLi5hcmdzKSxcbiAgICAgIGludm9rZTogPFQ+KGM6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoYGNvZGV4cHA6JHtpZH06JHtjfWAsIC4uLmFyZ3MpIGFzIFByb21pc2U8VD4sXG4gICAgfSxcbiAgICBmczogcmVuZGVyZXJGcyhpZCwgcGF0aHMpLFxuICB9O1xufVxuXG5mdW5jdGlvbiByZW5kZXJlclN0b3JhZ2UoaWQ6IHN0cmluZykge1xuICBjb25zdCBrZXkgPSBgY29kZXhwcDpzdG9yYWdlOiR7aWR9YDtcbiAgY29uc3QgcmVhZCA9ICgpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgPz8gXCJ7fVwiKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHdyaXRlID0gKHY6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PlxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkodikpO1xuICByZXR1cm4ge1xuICAgIGdldDogPFQ+KGs6IHN0cmluZywgZD86IFQpID0+IChrIGluIHJlYWQoKSA/IChyZWFkKClba10gYXMgVCkgOiAoZCBhcyBUKSksXG4gICAgc2V0OiAoazogc3RyaW5nLCB2OiB1bmtub3duKSA9PiB7XG4gICAgICBjb25zdCBvID0gcmVhZCgpO1xuICAgICAgb1trXSA9IHY7XG4gICAgICB3cml0ZShvKTtcbiAgICB9LFxuICAgIGRlbGV0ZTogKGs6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbyA9IHJlYWQoKTtcbiAgICAgIGRlbGV0ZSBvW2tdO1xuICAgICAgd3JpdGUobyk7XG4gICAgfSxcbiAgICBhbGw6ICgpID0+IHJlYWQoKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyZXJGcyhpZDogc3RyaW5nLCBfcGF0aHM6IFVzZXJQYXRocykge1xuICAvLyBTYW5kYm94ZWQgcmVuZGVyZXIgY2FuJ3QgdXNlIE5vZGUgZnMgZGlyZWN0bHkgXHUyMDE0IHByb3h5IHRocm91Z2ggbWFpbiBJUEMuXG4gIHJldHVybiB7XG4gICAgZGF0YURpcjogYDxyZW1vdGU+L3R3ZWFrLWRhdGEvJHtpZH1gLFxuICAgIHJlYWQ6IChwOiBzdHJpbmcpID0+XG4gICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnR3ZWFrLWZzXCIsIFwicmVhZFwiLCBpZCwgcCkgYXMgUHJvbWlzZTxzdHJpbmc+LFxuICAgIHdyaXRlOiAocDogc3RyaW5nLCBjOiBzdHJpbmcpID0+XG4gICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnR3ZWFrLWZzXCIsIFwid3JpdGVcIiwgaWQsIHAsIGMpIGFzIFByb21pc2U8dm9pZD4sXG4gICAgZXhpc3RzOiAocDogc3RyaW5nKSA9PlxuICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDp0d2Vhay1mc1wiLCBcImV4aXN0c1wiLCBpZCwgcCkgYXMgUHJvbWlzZTxib29sZWFuPixcbiAgfTtcbn1cbiIsICIvKipcbiAqIEJ1aWx0LWluIFwiVHdlYWsgTWFuYWdlclwiIFx1MjAxNCBhdXRvLWluamVjdGVkIGJ5IHRoZSBydW50aW1lLCBub3QgYSB1c2VyIHR3ZWFrLlxuICogTGlzdHMgZGlzY292ZXJlZCB0d2Vha3Mgd2l0aCBlbmFibGUgdG9nZ2xlcywgb3BlbnMgdGhlIHR3ZWFrcyBkaXIsIGxpbmtzXG4gKiB0byBsb2dzIGFuZCBjb25maWcuIExpdmVzIGluIHRoZSByZW5kZXJlci5cbiAqXG4gKiBUaGlzIGlzIGludm9rZWQgZnJvbSBwcmVsb2FkL2luZGV4LnRzIEFGVEVSIHVzZXIgdHdlYWtzIGFyZSBsb2FkZWQgc28gaXRcbiAqIGNhbiBzaG93IHVwLXRvLWRhdGUgc3RhdHVzLlxuICovXG5pbXBvcnQgeyBpcGNSZW5kZXJlciB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgcmVnaXN0ZXJTZWN0aW9uIH0gZnJvbSBcIi4vc2V0dGluZ3MtaW5qZWN0b3JcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1vdW50TWFuYWdlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgdHdlYWtzID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6bGlzdC10d2Vha3NcIikpIGFzIEFycmF5PHtcbiAgICBtYW5pZmVzdDogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHZlcnNpb246IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfTtcbiAgICBlbnRyeUV4aXN0czogYm9vbGVhbjtcbiAgfT47XG4gIGNvbnN0IHBhdGhzID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6dXNlci1wYXRoc1wiKSkgYXMge1xuICAgIHVzZXJSb290OiBzdHJpbmc7XG4gICAgdHdlYWtzRGlyOiBzdHJpbmc7XG4gICAgbG9nRGlyOiBzdHJpbmc7XG4gIH07XG5cbiAgcmVnaXN0ZXJTZWN0aW9uKHtcbiAgICBpZDogXCJjb2RleC1wbHVzcGx1czptYW5hZ2VyXCIsXG4gICAgdGl0bGU6IFwiVHdlYWsgTWFuYWdlclwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHt0d2Vha3MubGVuZ3RofSB0d2VhayhzKSBpbnN0YWxsZWQuIFVzZXIgZGlyOiAke3BhdGhzLnVzZXJSb290fWAsXG4gICAgcmVuZGVyKHJvb3QpIHtcbiAgICAgIHJvb3Quc3R5bGUuY3NzVGV4dCA9IFwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6OHB4O1wiO1xuXG4gICAgICBjb25zdCBhY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIGFjdGlvbnMuc3R5bGUuY3NzVGV4dCA9IFwiZGlzcGxheTpmbGV4O2dhcDo4cHg7ZmxleC13cmFwOndyYXA7XCI7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJPcGVuIHR3ZWFrcyBmb2xkZXJcIiwgKCkgPT5cbiAgICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCBwYXRocy50d2Vha3NEaXIpLmNhdGNoKCgpID0+IHt9KSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJPcGVuIGxvZ3NcIiwgKCkgPT5cbiAgICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCBwYXRocy5sb2dEaXIpLmNhdGNoKCgpID0+IHt9KSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJSZWxvYWQgd2luZG93XCIsICgpID0+IGxvY2F0aW9uLnJlbG9hZCgpKSxcbiAgICAgICk7XG4gICAgICByb290LmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuXG4gICAgICBpZiAodHdlYWtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zdCBlbXB0eSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xuICAgICAgICBlbXB0eS5zdHlsZS5jc3NUZXh0ID0gXCJjb2xvcjojODg4O2ZvbnQ6MTNweCBzeXN0ZW0tdWk7bWFyZ2luOjhweCAwO1wiO1xuICAgICAgICBlbXB0eS50ZXh0Q29udGVudCA9XG4gICAgICAgICAgXCJObyB1c2VyIHR3ZWFrcyB5ZXQuIERyb3AgYSBmb2xkZXIgd2l0aCBtYW5pZmVzdC5qc29uICsgaW5kZXguanMgaW50byB0aGUgdHdlYWtzIGRpciwgdGhlbiByZWxvYWQuXCI7XG4gICAgICAgIHJvb3QuYXBwZW5kQ2hpbGQoZW1wdHkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIik7XG4gICAgICBsaXN0LnN0eWxlLmNzc1RleHQgPSBcImxpc3Qtc3R5bGU6bm9uZTttYXJnaW46MDtwYWRkaW5nOjA7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NnB4O1wiO1xuICAgICAgZm9yIChjb25zdCB0IG9mIHR3ZWFrcykge1xuICAgICAgICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICAgICAgbGkuc3R5bGUuY3NzVGV4dCA9XG4gICAgICAgICAgXCJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6OHB4IDEwcHg7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIsIzJhMmEyYSk7Ym9yZGVyLXJhZGl1czo2cHg7XCI7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICBsZWZ0LmlubmVySFRNTCA9IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udDo2MDAgMTNweCBzeXN0ZW0tdWk7XCI+JHtlc2NhcGUodC5tYW5pZmVzdC5uYW1lKX0gPHNwYW4gc3R5bGU9XCJjb2xvcjojODg4O2ZvbnQtd2VpZ2h0OjQwMDtcIj52JHtlc2NhcGUodC5tYW5pZmVzdC52ZXJzaW9uKX08L3NwYW4+PC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiM4ODg7Zm9udDoxMnB4IHN5c3RlbS11aTtcIj4ke2VzY2FwZSh0Lm1hbmlmZXN0LmRlc2NyaXB0aW9uID8/IHQubWFuaWZlc3QuaWQpfTwvZGl2PlxuICAgICAgICBgO1xuICAgICAgICBjb25zdCByaWdodCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHJpZ2h0LnN0eWxlLmNzc1RleHQgPSBcImNvbG9yOiM4ODg7Zm9udDoxMnB4IHN5c3RlbS11aTtcIjtcbiAgICAgICAgcmlnaHQudGV4dENvbnRlbnQgPSB0LmVudHJ5RXhpc3RzID8gXCJsb2FkZWRcIiA6IFwibWlzc2luZyBlbnRyeVwiO1xuICAgICAgICBsaS5hcHBlbmQobGVmdCwgcmlnaHQpO1xuICAgICAgICBsaXN0LmFwcGVuZChsaSk7XG4gICAgICB9XG4gICAgICByb290LmFwcGVuZChsaXN0KTtcbiAgICB9LFxuICB9KTtcbn1cblxuZnVuY3Rpb24gYnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uY2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICBiLnR5cGUgPSBcImJ1dHRvblwiO1xuICBiLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIGIuc3R5bGUuY3NzVGV4dCA9XG4gICAgXCJwYWRkaW5nOjZweCAxMHB4O2JvcmRlcjoxcHggc29saWQgdmFyKC0tYm9yZGVyLCMzMzMpO2JvcmRlci1yYWRpdXM6NnB4O2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6aW5oZXJpdDtmb250OjEycHggc3lzdGVtLXVpO2N1cnNvcjpwb2ludGVyO1wiO1xuICBiLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbmNsaWNrKTtcbiAgcmV0dXJuIGI7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9bJjw+XCInXS9nLCAoYykgPT5cbiAgICBjID09PSBcIiZcIlxuICAgICAgPyBcIiZhbXA7XCJcbiAgICAgIDogYyA9PT0gXCI8XCJcbiAgICAgICAgPyBcIiZsdDtcIlxuICAgICAgICA6IGMgPT09IFwiPlwiXG4gICAgICAgICAgPyBcIiZndDtcIlxuICAgICAgICAgIDogYyA9PT0gJ1wiJ1xuICAgICAgICAgICAgPyBcIiZxdW90O1wiXG4gICAgICAgICAgICA6IFwiJiMzOTtcIixcbiAgKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQVdBLElBQUFBLG1CQUE0Qjs7O0FDNkJyQixTQUFTLG1CQUF5QjtBQUN2QyxNQUFJLE9BQU8sK0JBQWdDO0FBQzNDLFFBQU0sWUFBWSxvQkFBSSxJQUErQjtBQUNyRCxNQUFJLFNBQVM7QUFDYixRQUFNLFlBQVksb0JBQUksSUFBNEM7QUFFbEUsUUFBTSxPQUEwQjtBQUFBLElBQzlCLGVBQWU7QUFBQSxJQUNmO0FBQUEsSUFDQSxPQUFPLFVBQVU7QUFDZixZQUFNLEtBQUs7QUFDWCxnQkFBVSxJQUFJLElBQUksUUFBUTtBQUUxQixjQUFRO0FBQUEsUUFDTjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsU0FBUztBQUFBLE1BQ1g7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsR0FBRyxPQUFPLElBQUk7QUFDWixVQUFJLElBQUksVUFBVSxJQUFJLEtBQUs7QUFDM0IsVUFBSSxDQUFDLEVBQUcsV0FBVSxJQUFJLE9BQVEsSUFBSSxvQkFBSSxJQUFJLENBQUU7QUFDNUMsUUFBRSxJQUFJLEVBQUU7QUFBQSxJQUNWO0FBQUEsSUFDQSxJQUFJLE9BQU8sSUFBSTtBQUNiLGdCQUFVLElBQUksS0FBSyxHQUFHLE9BQU8sRUFBRTtBQUFBLElBQ2pDO0FBQUEsSUFDQSxLQUFLLFVBQVUsTUFBTTtBQUNuQixnQkFBVSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQUEsSUFDbkQ7QUFB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QUFzQjtBQUNoQyxTQUFTLEdBQUc7QUFDVixVQUFRLHFCQUFxQixPQUFPLENBQUMsQ0FBQztBQUN4QztBQUVBLGVBQWUsTUFBTTtBQUNuQixNQUFJLFNBQVMsZUFBZSxXQUFXO0FBQ3JDLGFBQVMsaUJBQWlCLG9CQUFvQixNQUFNLEVBQUUsTUFBTSxLQUFLLENBQUM7QUFBQSxFQUNwRSxPQUFPO0FBQ0wsU0FBSztBQUFBLEVBQ1A7QUFDRixDQUFDO0FBRUQsZUFBZSxPQUFPO0FBQ3BCLFVBQVEsY0FBYyxFQUFFLFlBQVksU0FBUyxXQUFXLENBQUM7QUFDekQsTUFBSTtBQUNGLDBCQUFzQjtBQUN0QixZQUFRLDJCQUEyQjtBQUNuQyxVQUFNLGVBQWU7QUFDckIsWUFBUSxvQkFBb0I7QUFDNUIsVUFBTSxhQUFhO0FBQ25CLFlBQVEsaUJBQWlCO0FBQ3pCLG9CQUFnQjtBQUNoQixZQUFRLGVBQWU7QUFBQSxFQUN6QixTQUFTLEdBQUc7QUFDVixZQUFRLGVBQWUsT0FBUSxHQUFhLFNBQVMsQ0FBQyxDQUFDO0FBQ3ZELFlBQVEsTUFBTSx5Q0FBeUMsQ0FBQztBQUFBLEVBQzFEO0FBQ0Y7QUFJQSxJQUFJLFlBQWtDO0FBQ3RDLFNBQVMsa0JBQXdCO0FBQy9CLCtCQUFZLEdBQUcsMEJBQTBCLE1BQU07QUFDN0MsUUFBSSxVQUFXO0FBQ2YsaUJBQWEsWUFBWTtBQUN2QixVQUFJO0FBQ0YsZ0JBQVEsS0FBSyx1Q0FBdUM7QUFDcEQsMEJBQWtCO0FBQ2xCLGNBQU0sZUFBZTtBQUNyQixjQUFNLGFBQWE7QUFBQSxNQUNyQixTQUFTLEdBQUc7QUFDVixnQkFBUSxNQUFNLHVDQUF1QyxDQUFDO0FBQUEsTUFDeEQsVUFBRTtBQUNBLG9CQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0YsR0FBRztBQUFBLEVBQ0wsQ0FBQztBQUNIOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfZWxlY3Ryb24iLCAicm9vdCIsICJzdGF0ZSIsICJidXR0b24iLCAiY2FyZCIsICJpbXBvcnRfZWxlY3Ryb24iLCAibW9kdWxlIiwgImV4cG9ydHMiLCAiaW1wb3J0X2VsZWN0cm9uIiwgInNhZmVTdHJpbmdpZnkiXQp9Cg==
