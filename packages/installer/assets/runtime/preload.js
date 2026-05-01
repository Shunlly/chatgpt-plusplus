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
var state = {
  sections: /* @__PURE__ */ new Map(),
  pages: /* @__PURE__ */ new Map(),
  listedTweaks: [],
  outerWrapper: null,
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
  const header = document.createElement("div");
  header.className = "px-row-x pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-token-description-foreground select-none";
  header.textContent = "Codex Plus Plus";
  group.appendChild(header);
  const configBtn = makeSidebarItem("Config", configIconSvg());
  const tweaksBtn = makeSidebarItem("Tweaks", tweaksIconSvg());
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
  group.appendChild(configBtn);
  group.appendChild(tweaksBtn);
  outer.appendChild(group);
  state.navGroup = group;
  state.navButtons = { config: configBtn, tweaks: tweaksBtn };
  plog("nav group injected", { outerTag: outer.tagName });
  syncPagesGroup();
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
    const header = document.createElement("div");
    header.className = "px-row-x pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-token-description-foreground select-none";
    header.textContent = "Tweaks";
    group.appendChild(header);
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
    const builtin = active?.kind === "config" ? "config" : active?.kind === "tweaks" ? "tweaks" : null;
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
  const title = ap.kind === "tweaks" ? "Tweaks" : "Config";
  const subtitle = ap.kind === "tweaks" ? "Manage your installed Codex++ tweaks." : "Configure Codex++ itself.";
  const root = panelShell(title, subtitle);
  host.appendChild(root.outer);
  if (ap.kind === "tweaks") renderTweaksPage(root.sectionsWrap);
  else renderConfigPage(root.sectionsWrap);
}
function renderConfigPage(sectionsWrap) {
  const section = document.createElement("section");
  section.className = "flex flex-col gap-2";
  section.appendChild(sectionTitle("Codex++ Updates"));
  const card = roundedCard();
  const loading = rowSimple("Loading update settings", "Checking current Codex++ configuration.");
  card.appendChild(loading);
  section.appendChild(card);
  sectionsWrap.appendChild(section);
  void import_electron.ipcRenderer.invoke("codexpp:get-config").then((config) => {
    card.textContent = "";
    renderCodexPlusPlusConfig(card, config);
  }).catch((e) => {
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
  card.appendChild(checkForUpdatesRow(config.updateCheck));
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
  desc.textContent = `Installed version v${config.version}. The watcher can refresh the Codex++ runtime after you rerun the GitHub installer.`;
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
function checkForUpdatesRow(check) {
  const row = document.createElement("div");
  row.className = "flex items-center justify-between gap-4 p-3";
  const left = document.createElement("div");
  left.className = "flex min-w-0 flex-col gap-1";
  const title = document.createElement("div");
  title.className = "min-w-0 text-sm text-token-text-primary";
  title.textContent = check?.updateAvailable ? "Codex++ update available" : "Codex++ is up to date";
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
      void import_electron.ipcRenderer.invoke("codexpp:check-codexpp-update", true).then((next) => {
        const card = row.parentElement;
        if (!card) return;
        card.textContent = "";
        void import_electron.ipcRenderer.invoke("codexpp:get-config").then((config) => {
          renderCodexPlusPlusConfig(card, {
            ...config,
            updateCheck: next
          });
        });
      }).catch((e) => plog("Codex++ update check failed", String(e))).finally(() => {
        row.style.opacity = "";
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
  const wrap = document.createElement("section");
  wrap.className = "flex flex-col gap-2";
  wrap.appendChild(sectionTitle("Installed Tweaks", trailing));
  const card = roundedCard();
  for (const t of state.listedTweaks) {
    card.appendChild(tweakRow(t, sectionsByTweak.get(t.manifest.id) ?? []));
  }
  wrap.appendChild(card);
  sectionsWrap.appendChild(wrap);
}
function tweakRow(t, sections) {
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
function panelShell(title, subtitle) {
  const outer = document.createElement("div");
  outer.className = "main-surface flex h-full min-h-0 flex-col";
  const toolbar = document.createElement("div");
  toolbar.className = "draggable flex items-center px-panel electron:h-toolbar extension:h-toolbar-sm";
  outer.appendChild(toolbar);
  const scroll = document.createElement("div");
  scroll.className = "flex-1 overflow-y-auto p-panel";
  outer.appendChild(scroll);
  const inner = document.createElement("div");
  inner.className = "mx-auto flex w-full flex-col max-w-2xl electron:min-w-[calc(320px*var(--codex-window-zoom))]";
  scroll.appendChild(inner);
  const headerWrap = document.createElement("div");
  headerWrap.className = "flex items-center justify-between gap-3 pb-panel";
  const headerInner = document.createElement("div");
  headerInner.className = "flex min-w-0 flex-1 flex-col gap-1.5 pb-panel";
  const heading = document.createElement("div");
  heading.className = "electron:heading-lg heading-base truncate";
  heading.textContent = title;
  headerInner.appendChild(heading);
  if (subtitle) {
    const sub = document.createElement("div");
    sub.className = "text-token-text-secondary text-sm";
    sub.textContent = subtitle;
    headerInner.appendChild(sub);
  }
  headerWrap.appendChild(headerInner);
  inner.appendChild(headerWrap);
  const sectionsWrap = document.createElement("div");
  sectionsWrap.className = "flex flex-col gap-[var(--padding-panel)]";
  inner.appendChild(sectionsWrap);
  return { outer, sectionsWrap };
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3ByZWxvYWQvaW5kZXgudHMiLCAiLi4vc3JjL3ByZWxvYWQvcmVhY3QtaG9vay50cyIsICIuLi9zcmMvcHJlbG9hZC9zZXR0aW5ncy1pbmplY3Rvci50cyIsICIuLi9zcmMvcHJlbG9hZC90d2Vhay1ob3N0LnRzIiwgIi4uL3NyYy9wcmVsb2FkL21hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogUmVuZGVyZXIgcHJlbG9hZCBlbnRyeS4gUnVucyBpbiBhbiBpc29sYXRlZCB3b3JsZCBiZWZvcmUgQ29kZXgncyBwYWdlIEpTLlxuICogUmVzcG9uc2liaWxpdGllczpcbiAqICAgMS4gSW5zdGFsbCBhIFJlYWN0IERldlRvb2xzLXNoYXBlZCBnbG9iYWwgaG9vayB0byBjYXB0dXJlIHRoZSByZW5kZXJlclxuICogICAgICByZWZlcmVuY2Ugd2hlbiBSZWFjdCBtb3VudHMuIFdlIHVzZSB0aGlzIGZvciBmaWJlciB3YWxraW5nLlxuICogICAyLiBBZnRlciBET01Db250ZW50TG9hZGVkLCBraWNrIG9mZiBzZXR0aW5ncy1pbmplY3Rpb24gbG9naWMuXG4gKiAgIDMuIERpc2NvdmVyIHJlbmRlcmVyLXNjb3BlZCB0d2Vha3MgKHZpYSBJUEMgdG8gbWFpbikgYW5kIHN0YXJ0IHRoZW0uXG4gKiAgIDQuIExpc3RlbiBmb3IgYGNvZGV4cHA6dHdlYWtzLWNoYW5nZWRgIGZyb20gbWFpbiAoZmlsZXN5c3RlbSB3YXRjaGVyKSBhbmRcbiAqICAgICAgaG90LXJlbG9hZCB0d2Vha3Mgd2l0aG91dCBkcm9wcGluZyB0aGUgcGFnZS5cbiAqL1xuXG5pbXBvcnQgeyBpcGNSZW5kZXJlciB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgaW5zdGFsbFJlYWN0SG9vayB9IGZyb20gXCIuL3JlYWN0LWhvb2tcIjtcbmltcG9ydCB7IHN0YXJ0U2V0dGluZ3NJbmplY3RvciB9IGZyb20gXCIuL3NldHRpbmdzLWluamVjdG9yXCI7XG5pbXBvcnQgeyBzdGFydFR3ZWFrSG9zdCwgdGVhcmRvd25Ud2Vha0hvc3QgfSBmcm9tIFwiLi90d2Vhay1ob3N0XCI7XG5pbXBvcnQgeyBtb3VudE1hbmFnZXIgfSBmcm9tIFwiLi9tYW5hZ2VyXCI7XG5cbi8vIEZpbGUtbG9nIHByZWxvYWQgcHJvZ3Jlc3Mgc28gd2UgY2FuIGRpYWdub3NlIHdpdGhvdXQgRGV2VG9vbHMuIEJlc3QtZWZmb3J0OlxuLy8gZmFpbHVyZXMgaGVyZSBtdXN0IG5ldmVyIHRocm93IGJlY2F1c2Ugd2UnZCB0YWtlIHRoZSBwYWdlIGRvd24gd2l0aCB1cy5cbi8vXG4vLyBDb2RleCdzIHJlbmRlcmVyIGlzIHNhbmRib3hlZCAoc2FuZGJveDogdHJ1ZSksIHNvIGByZXF1aXJlKFwibm9kZTpmc1wiKWAgaXNcbi8vIHVuYXZhaWxhYmxlLiBXZSBmb3J3YXJkIGxvZyBsaW5lcyB0byBtYWluIHZpYSBJUEM7IG1haW4gd3JpdGVzIHRoZSBmaWxlLlxuZnVuY3Rpb24gZmlsZUxvZyhzdGFnZTogc3RyaW5nLCBleHRyYT86IHVua25vd24pOiB2b2lkIHtcbiAgY29uc3QgbXNnID0gYFtjb2RleC1wbHVzcGx1cyBwcmVsb2FkXSAke3N0YWdlfSR7XG4gICAgZXh0cmEgPT09IHVuZGVmaW5lZCA/IFwiXCIgOiBcIiBcIiArIHNhZmVTdHJpbmdpZnkoZXh0cmEpXG4gIH1gO1xuICB0cnkge1xuICAgIGNvbnNvbGUuZXJyb3IobXNnKTtcbiAgfSBjYXRjaCB7fVxuICB0cnkge1xuICAgIGlwY1JlbmRlcmVyLnNlbmQoXCJjb2RleHBwOnByZWxvYWQtbG9nXCIsIFwiaW5mb1wiLCBtc2cpO1xuICB9IGNhdGNoIHt9XG59XG5mdW5jdGlvbiBzYWZlU3RyaW5naWZ5KHY6IHVua25vd24pOiBzdHJpbmcge1xuICB0cnkge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IHYgOiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFN0cmluZyh2KTtcbiAgfVxufVxuXG5maWxlTG9nKFwicHJlbG9hZCBlbnRyeVwiLCB7IHVybDogbG9jYXRpb24uaHJlZiB9KTtcblxuLy8gUmVhY3QgaG9vayBtdXN0IGJlIGluc3RhbGxlZCAqYmVmb3JlKiBDb2RleCdzIGJ1bmRsZSBydW5zLlxudHJ5IHtcbiAgaW5zdGFsbFJlYWN0SG9vaygpO1xuICBmaWxlTG9nKFwicmVhY3QgaG9vayBpbnN0YWxsZWRcIik7XG59IGNhdGNoIChlKSB7XG4gIGZpbGVMb2coXCJyZWFjdCBob29rIEZBSUxFRFwiLCBTdHJpbmcoZSkpO1xufVxuXG5xdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIGJvb3QsIHsgb25jZTogdHJ1ZSB9KTtcbiAgfSBlbHNlIHtcbiAgICBib290KCk7XG4gIH1cbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBib290KCkge1xuICBmaWxlTG9nKFwiYm9vdCBzdGFydFwiLCB7IHJlYWR5U3RhdGU6IGRvY3VtZW50LnJlYWR5U3RhdGUgfSk7XG4gIHRyeSB7XG4gICAgc3RhcnRTZXR0aW5nc0luamVjdG9yKCk7XG4gICAgZmlsZUxvZyhcInNldHRpbmdzIGluamVjdG9yIHN0YXJ0ZWRcIik7XG4gICAgYXdhaXQgc3RhcnRUd2Vha0hvc3QoKTtcbiAgICBmaWxlTG9nKFwidHdlYWsgaG9zdCBzdGFydGVkXCIpO1xuICAgIGF3YWl0IG1vdW50TWFuYWdlcigpO1xuICAgIGZpbGVMb2coXCJtYW5hZ2VyIG1vdW50ZWRcIik7XG4gICAgc3Vic2NyaWJlUmVsb2FkKCk7XG4gICAgZmlsZUxvZyhcImJvb3QgY29tcGxldGVcIik7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBmaWxlTG9nKFwiYm9vdCBGQUlMRURcIiwgU3RyaW5nKChlIGFzIEVycm9yKT8uc3RhY2sgPz8gZSkpO1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbY29kZXgtcGx1c3BsdXNdIHByZWxvYWQgYm9vdCBmYWlsZWQ6XCIsIGUpO1xuICB9XG59XG5cbi8vIEhvdCByZWxvYWQ6IGdhdGVkIGJlaGluZCBhIHNtYWxsIGluLWZsaWdodCBsb2NrIHNvIGEgZmx1cnJ5IG9mIGZzIGV2ZW50c1xuLy8gZG9lc24ndCByZWVudHJhbnRseSB0ZWFyIGRvd24gdGhlIGhvc3QgbWlkLWxvYWQuXG5sZXQgcmVsb2FkaW5nOiBQcm9taXNlPHZvaWQ+IHwgbnVsbCA9IG51bGw7XG5mdW5jdGlvbiBzdWJzY3JpYmVSZWxvYWQoKTogdm9pZCB7XG4gIGlwY1JlbmRlcmVyLm9uKFwiY29kZXhwcDp0d2Vha3MtY2hhbmdlZFwiLCAoKSA9PiB7XG4gICAgaWYgKHJlbG9hZGluZykgcmV0dXJuO1xuICAgIHJlbG9hZGluZyA9IChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmluZm8oXCJbY29kZXgtcGx1c3BsdXNdIGhvdC1yZWxvYWRpbmcgdHdlYWtzXCIpO1xuICAgICAgICB0ZWFyZG93blR3ZWFrSG9zdCgpO1xuICAgICAgICBhd2FpdCBzdGFydFR3ZWFrSG9zdCgpO1xuICAgICAgICBhd2FpdCBtb3VudE1hbmFnZXIoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltjb2RleC1wbHVzcGx1c10gaG90IHJlbG9hZCBmYWlsZWQ6XCIsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgcmVsb2FkaW5nID0gbnVsbDtcbiAgICAgIH1cbiAgICB9KSgpO1xuICB9KTtcbn1cbiIsICIvKipcbiAqIEluc3RhbGwgYSBtaW5pbWFsIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy4gUmVhY3QgY2FsbHNcbiAqIGBob29rLmluamVjdChyZW5kZXJlckludGVybmFscylgIGR1cmluZyBgY3JlYXRlUm9vdGAvYGh5ZHJhdGVSb290YC4gVGhlXG4gKiBcImludGVybmFsc1wiIG9iamVjdCBleHBvc2VzIGZpbmRGaWJlckJ5SG9zdEluc3RhbmNlLCB3aGljaCBsZXRzIHVzIHR1cm4gYVxuICogRE9NIG5vZGUgaW50byBhIFJlYWN0IGZpYmVyIFx1MjAxNCBuZWNlc3NhcnkgZm9yIG91ciBTZXR0aW5ncyBpbmplY3Rvci5cbiAqXG4gKiBXZSBkb24ndCB3YW50IHRvIGJyZWFrIHJlYWwgUmVhY3QgRGV2VG9vbHMgaWYgdGhlIHVzZXIgb3BlbnMgaXQ7IHdlIGluc3RhbGxcbiAqIG9ubHkgaWYgbm8gaG9vayBleGlzdHMgeWV0LCBhbmQgd2UgZm9yd2FyZCBjYWxscyB0byBhIGRvd25zdHJlYW0gaG9vayBpZlxuICogb25lIGlzIGxhdGVyIGFzc2lnbmVkLlxuICovXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBXaW5kb3cge1xuICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXz86IFJlYWN0RGV2dG9vbHNIb29rO1xuICAgIF9fY29kZXhwcF9fPzoge1xuICAgICAgaG9vazogUmVhY3REZXZ0b29sc0hvb2s7XG4gICAgICByZW5kZXJlcnM6IE1hcDxudW1iZXIsIFJlbmRlcmVySW50ZXJuYWxzPjtcbiAgICB9O1xuICB9XG59XG5cbmludGVyZmFjZSBSZW5kZXJlckludGVybmFscyB7XG4gIGZpbmRGaWJlckJ5SG9zdEluc3RhbmNlPzogKG46IE5vZGUpID0+IHVua25vd247XG4gIHZlcnNpb24/OiBzdHJpbmc7XG4gIGJ1bmRsZVR5cGU/OiBudW1iZXI7XG4gIHJlbmRlcmVyUGFja2FnZU5hbWU/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBSZWFjdERldnRvb2xzSG9vayB7XG4gIHN1cHBvcnRzRmliZXI6IHRydWU7XG4gIHJlbmRlcmVyczogTWFwPG51bWJlciwgUmVuZGVyZXJJbnRlcm5hbHM+O1xuICBvbihldmVudDogc3RyaW5nLCBmbjogKC4uLmE6IHVua25vd25bXSkgPT4gdm9pZCk6IHZvaWQ7XG4gIG9mZihldmVudDogc3RyaW5nLCBmbjogKC4uLmE6IHVua25vd25bXSkgPT4gdm9pZCk6IHZvaWQ7XG4gIGVtaXQoZXZlbnQ6IHN0cmluZywgLi4uYTogdW5rbm93bltdKTogdm9pZDtcbiAgaW5qZWN0KHJlbmRlcmVyOiBSZW5kZXJlckludGVybmFscyk6IG51bWJlcjtcbiAgb25TY2hlZHVsZUZpYmVyUm9vdD8oKTogdm9pZDtcbiAgb25Db21taXRGaWJlclJvb3Q/KCk6IHZvaWQ7XG4gIG9uQ29tbWl0RmliZXJVbm1vdW50PygpOiB2b2lkO1xuICBjaGVja0RDRT8oKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluc3RhbGxSZWFjdEhvb2soKTogdm9pZCB7XG4gIGlmICh3aW5kb3cuX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fKSByZXR1cm47XG4gIGNvbnN0IHJlbmRlcmVycyA9IG5ldyBNYXA8bnVtYmVyLCBSZW5kZXJlckludGVybmFscz4oKTtcbiAgbGV0IG5leHRJZCA9IDE7XG4gIGNvbnN0IGxpc3RlbmVycyA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8KC4uLmE6IHVua25vd25bXSkgPT4gdm9pZD4+KCk7XG5cbiAgY29uc3QgaG9vazogUmVhY3REZXZ0b29sc0hvb2sgPSB7XG4gICAgc3VwcG9ydHNGaWJlcjogdHJ1ZSxcbiAgICByZW5kZXJlcnMsXG4gICAgaW5qZWN0KHJlbmRlcmVyKSB7XG4gICAgICBjb25zdCBpZCA9IG5leHRJZCsrO1xuICAgICAgcmVuZGVyZXJzLnNldChpZCwgcmVuZGVyZXIpO1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUuZGVidWcoXG4gICAgICAgIFwiW2NvZGV4LXBsdXNwbHVzXSBSZWFjdCByZW5kZXJlciBhdHRhY2hlZDpcIixcbiAgICAgICAgcmVuZGVyZXIucmVuZGVyZXJQYWNrYWdlTmFtZSxcbiAgICAgICAgcmVuZGVyZXIudmVyc2lvbixcbiAgICAgICk7XG4gICAgICByZXR1cm4gaWQ7XG4gICAgfSxcbiAgICBvbihldmVudCwgZm4pIHtcbiAgICAgIGxldCBzID0gbGlzdGVuZXJzLmdldChldmVudCk7XG4gICAgICBpZiAoIXMpIGxpc3RlbmVycy5zZXQoZXZlbnQsIChzID0gbmV3IFNldCgpKSk7XG4gICAgICBzLmFkZChmbik7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIGZuKSB7XG4gICAgICBsaXN0ZW5lcnMuZ2V0KGV2ZW50KT8uZGVsZXRlKGZuKTtcbiAgICB9LFxuICAgIGVtaXQoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGxpc3RlbmVycy5nZXQoZXZlbnQpPy5mb3JFYWNoKChmbikgPT4gZm4oLi4uYXJncykpO1xuICAgIH0sXG4gICAgb25Db21taXRGaWJlclJvb3QoKSB7fSxcbiAgICBvbkNvbW1pdEZpYmVyVW5tb3VudCgpIHt9LFxuICAgIG9uU2NoZWR1bGVGaWJlclJvb3QoKSB7fSxcbiAgICBjaGVja0RDRSgpIHt9LFxuICB9O1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh3aW5kb3csIFwiX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fXCIsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgd3JpdGFibGU6IHRydWUsIC8vIGFsbG93IHJlYWwgRGV2VG9vbHMgdG8gb3ZlcndyaXRlIGlmIHVzZXIgaW5zdGFsbHMgaXRcbiAgICB2YWx1ZTogaG9vayxcbiAgfSk7XG5cbiAgd2luZG93Ll9fY29kZXhwcF9fID0geyBob29rLCByZW5kZXJlcnMgfTtcbn1cblxuLyoqIFJlc29sdmUgdGhlIFJlYWN0IGZpYmVyIGZvciBhIERPTSBub2RlLCBpZiBhbnkgcmVuZGVyZXIgaGFzIG9uZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWJlckZvck5vZGUobm9kZTogTm9kZSk6IHVua25vd24gfCBudWxsIHtcbiAgY29uc3QgcmVuZGVyZXJzID0gd2luZG93Ll9fY29kZXhwcF9fPy5yZW5kZXJlcnM7XG4gIGlmIChyZW5kZXJlcnMpIHtcbiAgICBmb3IgKGNvbnN0IHIgb2YgcmVuZGVyZXJzLnZhbHVlcygpKSB7XG4gICAgICBjb25zdCBmID0gci5maW5kRmliZXJCeUhvc3RJbnN0YW5jZT8uKG5vZGUpO1xuICAgICAgaWYgKGYpIHJldHVybiBmO1xuICAgIH1cbiAgfVxuICAvLyBGYWxsYmFjazogcmVhZCB0aGUgUmVhY3QgaW50ZXJuYWwgcHJvcGVydHkgZGlyZWN0bHkgZnJvbSB0aGUgRE9NIG5vZGUuXG4gIC8vIFJlYWN0IHN0b3JlcyBmaWJlcnMgYXMgYSBwcm9wZXJ0eSB3aG9zZSBrZXkgc3RhcnRzIHdpdGggXCJfX3JlYWN0RmliZXJcIi5cbiAgZm9yIChjb25zdCBrIG9mIE9iamVjdC5rZXlzKG5vZGUpKSB7XG4gICAgaWYgKGsuc3RhcnRzV2l0aChcIl9fcmVhY3RGaWJlclwiKSkgcmV0dXJuIChub2RlIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW2tdO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuIiwgIi8qKlxuICogU2V0dGluZ3MgaW5qZWN0b3IgZm9yIENvZGV4J3MgU2V0dGluZ3MgcGFnZS5cbiAqXG4gKiBDb2RleCdzIHNldHRpbmdzIGlzIGEgcm91dGVkIHBhZ2UgKFVSTCBzdGF5cyBhdCBgL2luZGV4Lmh0bWw/aG9zdElkPWxvY2FsYClcbiAqIE5PVCBhIG1vZGFsIGRpYWxvZy4gVGhlIHNpZGViYXIgbGl2ZXMgaW5zaWRlIGEgYDxkaXYgY2xhc3M9XCJmbGV4IGZsZXgtY29sXG4gKiBnYXAtMSBnYXAtMFwiPmAgd3JhcHBlciB0aGF0IGhvbGRzIG9uZSBvciBtb3JlIGA8ZGl2IGNsYXNzPVwiZmxleCBmbGV4LWNvbFxuICogZ2FwLXB4XCI+YCBncm91cHMgb2YgYnV0dG9ucy4gVGhlcmUgYXJlIG5vIHN0YWJsZSBgcm9sZWAgLyBgYXJpYS1sYWJlbGAgL1xuICogYGRhdGEtdGVzdGlkYCBob29rcyBvbiB0aGUgc2hlbGwgc28gd2UgaWRlbnRpZnkgdGhlIHNpZGViYXIgYnkgdGV4dC1jb250ZW50XG4gKiBtYXRjaCBhZ2FpbnN0IGtub3duIGl0ZW0gbGFiZWxzIChHZW5lcmFsLCBBcHBlYXJhbmNlLCBDb25maWd1cmF0aW9uLCBcdTIwMjYpLlxuICpcbiAqIExheW91dCB3ZSBpbmplY3Q6XG4gKlxuICogICBbQ29kZXgncyBleGlzdGluZyBpdGVtcyBncm91cF1cbiAqICAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIChib3JkZXItdC10b2tlbi1ib3JkZXIpXG4gKiAgIENPREVYIFBMVVMgUExVUyAgICAgICAgICAgICAgICh1cHBlcmNhc2Ugc3VidGl0bGUsIHRleHQtdG9rZW4tdGV4dC10ZXJ0aWFyeSlcbiAqICAgXHUyNEQ4IENvbmZpZ1xuICogICBcdTI2MzAgVHdlYWtzXG4gKlxuICogQ2xpY2tpbmcgQ29uZmlnIC8gVHdlYWtzIGhpZGVzIENvZGV4J3MgY29udGVudCBwYW5lbCBjaGlsZHJlbiBhbmQgcmVuZGVyc1xuICogb3VyIG93biBgbWFpbi1zdXJmYWNlYCBwYW5lbCBpbiB0aGVpciBwbGFjZS4gQ2xpY2tpbmcgYW55IG9mIENvZGV4J3NcbiAqIHNpZGViYXIgaXRlbXMgcmVzdG9yZXMgdGhlIG9yaWdpbmFsIHZpZXcuXG4gKi9cblxuaW1wb3J0IHsgaXBjUmVuZGVyZXIgfSBmcm9tIFwiZWxlY3Ryb25cIjtcbmltcG9ydCB0eXBlIHtcbiAgU2V0dGluZ3NTZWN0aW9uLFxuICBTZXR0aW5nc1BhZ2UsXG4gIFNldHRpbmdzSGFuZGxlLFxuICBUd2Vha01hbmlmZXN0LFxufSBmcm9tIFwiQGNvZGV4LXBsdXNwbHVzL3Nka1wiO1xuXG4vLyBNaXJyb3JzIHRoZSBydW50aW1lJ3MgbWFpbi1zaWRlIExpc3RlZFR3ZWFrIHNoYXBlIChrZXB0IGluIHN5bmMgbWFudWFsbHkpLlxuaW50ZXJmYWNlIExpc3RlZFR3ZWFrIHtcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG4gIGVudHJ5OiBzdHJpbmc7XG4gIGRpcjogc3RyaW5nO1xuICBlbnRyeUV4aXN0czogYm9vbGVhbjtcbiAgZW5hYmxlZDogYm9vbGVhbjtcbiAgdXBkYXRlOiBUd2Vha1VwZGF0ZUNoZWNrIHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIFR3ZWFrVXBkYXRlQ2hlY2sge1xuICBjaGVja2VkQXQ6IHN0cmluZztcbiAgcmVwbzogc3RyaW5nO1xuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uOiBzdHJpbmcgfCBudWxsO1xuICBsYXRlc3RUYWc6IHN0cmluZyB8IG51bGw7XG4gIHJlbGVhc2VVcmw6IHN0cmluZyB8IG51bGw7XG4gIHVwZGF0ZUF2YWlsYWJsZTogYm9vbGVhbjtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBDb2RleFBsdXNQbHVzQ29uZmlnIHtcbiAgdmVyc2lvbjogc3RyaW5nO1xuICBhdXRvVXBkYXRlOiBib29sZWFuO1xuICB1cGRhdGVDaGVjazogQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrIHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIENvZGV4UGx1c1BsdXNVcGRhdGVDaGVjayB7XG4gIGNoZWNrZWRBdDogc3RyaW5nO1xuICBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuICBsYXRlc3RWZXJzaW9uOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlVXJsOiBzdHJpbmcgfCBudWxsO1xuICByZWxlYXNlTm90ZXM6IHN0cmluZyB8IG51bGw7XG4gIHVwZGF0ZUF2YWlsYWJsZTogYm9vbGVhbjtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBXYXRjaGVySGVhbHRoIHtcbiAgY2hlY2tlZEF0OiBzdHJpbmc7XG4gIHN0YXR1czogXCJva1wiIHwgXCJ3YXJuXCIgfCBcImVycm9yXCI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHN1bW1hcnk6IHN0cmluZztcbiAgd2F0Y2hlcjogc3RyaW5nO1xuICBjaGVja3M6IFdhdGNoZXJIZWFsdGhDaGVja1tdO1xufVxuXG5pbnRlcmZhY2UgV2F0Y2hlckhlYWx0aENoZWNrIHtcbiAgbmFtZTogc3RyaW5nO1xuICBzdGF0dXM6IFwib2tcIiB8IFwid2FyblwiIHwgXCJlcnJvclwiO1xuICBkZXRhaWw6IHN0cmluZztcbn1cblxuLyoqXG4gKiBBIHR3ZWFrLXJlZ2lzdGVyZWQgcGFnZS4gV2UgY2FycnkgdGhlIG93bmluZyB0d2VhaydzIG1hbmlmZXN0IHNvIHdlIGNhblxuICogcmVzb2x2ZSByZWxhdGl2ZSBpY29uVXJscyBhbmQgc2hvdyBhdXRob3JzaGlwIGluIHRoZSBwYWdlIGhlYWRlci5cbiAqL1xuaW50ZXJmYWNlIFJlZ2lzdGVyZWRQYWdlIHtcbiAgLyoqIEZ1bGx5LXF1YWxpZmllZCBpZDogYDx0d2Vha0lkPjo8cGFnZUlkPmAuICovXG4gIGlkOiBzdHJpbmc7XG4gIHR3ZWFrSWQ6IHN0cmluZztcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG4gIHBhZ2U6IFNldHRpbmdzUGFnZTtcbiAgLyoqIFBlci1wYWdlIERPTSB0ZWFyZG93biByZXR1cm5lZCBieSBgcGFnZS5yZW5kZXJgLCBpZiBhbnkuICovXG4gIHRlYXJkb3duPzogKCgpID0+IHZvaWQpIHwgbnVsbDtcbiAgLyoqIFRoZSBpbmplY3RlZCBzaWRlYmFyIGJ1dHRvbiAoc28gd2UgY2FuIHVwZGF0ZSBpdHMgYWN0aXZlIHN0YXRlKS4gKi9cbiAgbmF2QnV0dG9uPzogSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xufVxuXG4vKiogV2hhdCBwYWdlIGlzIGN1cnJlbnRseSBzZWxlY3RlZCBpbiBvdXIgaW5qZWN0ZWQgbmF2LiAqL1xudHlwZSBBY3RpdmVQYWdlID1cbiAgfCB7IGtpbmQ6IFwiY29uZmlnXCIgfVxuICB8IHsga2luZDogXCJ0d2Vha3NcIiB9XG4gIHwgeyBraW5kOiBcInJlZ2lzdGVyZWRcIjsgaWQ6IHN0cmluZyB9O1xuXG5pbnRlcmZhY2UgSW5qZWN0b3JTdGF0ZSB7XG4gIHNlY3Rpb25zOiBNYXA8c3RyaW5nLCBTZXR0aW5nc1NlY3Rpb24+O1xuICBwYWdlczogTWFwPHN0cmluZywgUmVnaXN0ZXJlZFBhZ2U+O1xuICBsaXN0ZWRUd2Vha3M6IExpc3RlZFR3ZWFrW107XG4gIC8qKiBPdXRlciB3cmFwcGVyIHRoYXQgaG9sZHMgQ29kZXgncyBpdGVtcyBncm91cCArIG91ciBpbmplY3RlZCBncm91cHMuICovXG4gIG91dGVyV3JhcHBlcjogSFRNTEVsZW1lbnQgfCBudWxsO1xuICAvKiogT3VyIFwiQ29kZXggUGx1cyBQbHVzXCIgbmF2IGdyb3VwIChDb25maWcvVHdlYWtzKS4gKi9cbiAgbmF2R3JvdXA6IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgbmF2QnV0dG9uczogeyBjb25maWc6IEhUTUxCdXR0b25FbGVtZW50OyB0d2Vha3M6IEhUTUxCdXR0b25FbGVtZW50IH0gfCBudWxsO1xuICAvKiogT3VyIFwiVHdlYWtzXCIgbmF2IGdyb3VwIChwZXItdHdlYWsgcGFnZXMpLiBDcmVhdGVkIGxhemlseS4gKi9cbiAgcGFnZXNHcm91cDogSFRNTEVsZW1lbnQgfCBudWxsO1xuICBwYWdlc0dyb3VwS2V5OiBzdHJpbmcgfCBudWxsO1xuICBwYW5lbEhvc3Q6IEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgb2JzZXJ2ZXI6IE11dGF0aW9uT2JzZXJ2ZXIgfCBudWxsO1xuICBmaW5nZXJwcmludDogc3RyaW5nIHwgbnVsbDtcbiAgc2lkZWJhckR1bXBlZDogYm9vbGVhbjtcbiAgYWN0aXZlUGFnZTogQWN0aXZlUGFnZSB8IG51bGw7XG4gIHNpZGViYXJSb290OiBIVE1MRWxlbWVudCB8IG51bGw7XG4gIHNpZGViYXJSZXN0b3JlSGFuZGxlcjogKChlOiBFdmVudCkgPT4gdm9pZCkgfCBudWxsO1xuICBzZXR0aW5nc1N1cmZhY2VWaXNpYmxlOiBib29sZWFuO1xuICBzZXR0aW5nc1N1cmZhY2VIaWRlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbDtcbn1cblxuY29uc3Qgc3RhdGU6IEluamVjdG9yU3RhdGUgPSB7XG4gIHNlY3Rpb25zOiBuZXcgTWFwKCksXG4gIHBhZ2VzOiBuZXcgTWFwKCksXG4gIGxpc3RlZFR3ZWFrczogW10sXG4gIG91dGVyV3JhcHBlcjogbnVsbCxcbiAgbmF2R3JvdXA6IG51bGwsXG4gIG5hdkJ1dHRvbnM6IG51bGwsXG4gIHBhZ2VzR3JvdXA6IG51bGwsXG4gIHBhZ2VzR3JvdXBLZXk6IG51bGwsXG4gIHBhbmVsSG9zdDogbnVsbCxcbiAgb2JzZXJ2ZXI6IG51bGwsXG4gIGZpbmdlcnByaW50OiBudWxsLFxuICBzaWRlYmFyRHVtcGVkOiBmYWxzZSxcbiAgYWN0aXZlUGFnZTogbnVsbCxcbiAgc2lkZWJhclJvb3Q6IG51bGwsXG4gIHNpZGViYXJSZXN0b3JlSGFuZGxlcjogbnVsbCxcbiAgc2V0dGluZ3NTdXJmYWNlVmlzaWJsZTogZmFsc2UsXG4gIHNldHRpbmdzU3VyZmFjZUhpZGVUaW1lcjogbnVsbCxcbn07XG5cbmZ1bmN0aW9uIHBsb2cobXNnOiBzdHJpbmcsIGV4dHJhPzogdW5rbm93bik6IHZvaWQge1xuICBpcGNSZW5kZXJlci5zZW5kKFxuICAgIFwiY29kZXhwcDpwcmVsb2FkLWxvZ1wiLFxuICAgIFwiaW5mb1wiLFxuICAgIGBbc2V0dGluZ3MtaW5qZWN0b3JdICR7bXNnfSR7ZXh0cmEgPT09IHVuZGVmaW5lZCA/IFwiXCIgOiBcIiBcIiArIHNhZmVTdHJpbmdpZnkoZXh0cmEpfWAsXG4gICk7XG59XG5mdW5jdGlvbiBzYWZlU3RyaW5naWZ5KHY6IHVua25vd24pOiBzdHJpbmcge1xuICB0cnkge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IHYgOiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFN0cmluZyh2KTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgcHVibGljIEFQSSBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0U2V0dGluZ3NJbmplY3RvcigpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLm9ic2VydmVyKSByZXR1cm47XG5cbiAgY29uc3Qgb2JzID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgIHRyeUluamVjdCgpO1xuICAgIG1heWJlRHVtcERvbSgpO1xuICB9KTtcbiAgb2JzLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgc3RhdGUub2JzZXJ2ZXIgPSBvYnM7XG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCBvbk5hdik7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiaGFzaGNoYW5nZVwiLCBvbk5hdik7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbkRvY3VtZW50Q2xpY2ssIHRydWUpO1xuICBmb3IgKGNvbnN0IG0gb2YgW1wicHVzaFN0YXRlXCIsIFwicmVwbGFjZVN0YXRlXCJdIGFzIGNvbnN0KSB7XG4gICAgY29uc3Qgb3JpZyA9IGhpc3RvcnlbbV07XG4gICAgaGlzdG9yeVttXSA9IGZ1bmN0aW9uICh0aGlzOiBIaXN0b3J5LCAuLi5hcmdzOiBQYXJhbWV0ZXJzPHR5cGVvZiBvcmlnPikge1xuICAgICAgY29uc3QgciA9IG9yaWcuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoYGNvZGV4cHAtJHttfWApKTtcbiAgICAgIHJldHVybiByO1xuICAgIH0gYXMgdHlwZW9mIG9yaWc7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoYGNvZGV4cHAtJHttfWAsIG9uTmF2KTtcbiAgfVxuXG4gIHRyeUluamVjdCgpO1xuICBtYXliZUR1bXBEb20oKTtcbiAgbGV0IHRpY2tzID0gMDtcbiAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgdGlja3MrKztcbiAgICB0cnlJbmplY3QoKTtcbiAgICBtYXliZUR1bXBEb20oKTtcbiAgICBpZiAodGlja3MgPiA2MCkgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gIH0sIDUwMCk7XG59XG5cbmZ1bmN0aW9uIG9uTmF2KCk6IHZvaWQge1xuICBzdGF0ZS5maW5nZXJwcmludCA9IG51bGw7XG4gIHRyeUluamVjdCgpO1xuICBtYXliZUR1bXBEb20oKTtcbn1cblxuZnVuY3Rpb24gb25Eb2N1bWVudENsaWNrKGU6IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50ID8gZS50YXJnZXQgOiBudWxsO1xuICBjb25zdCBjb250cm9sID0gdGFyZ2V0Py5jbG9zZXN0KFwiW3JvbGU9J2xpbmsnXSxidXR0b24sYVwiKTtcbiAgaWYgKCEoY29udHJvbCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkgcmV0dXJuO1xuICBpZiAoY29tcGFjdFNldHRpbmdzVGV4dChjb250cm9sLnRleHRDb250ZW50IHx8IFwiXCIpICE9PSBcIkJhY2sgdG8gYXBwXCIpIHJldHVybjtcbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgc2V0U2V0dGluZ3NTdXJmYWNlVmlzaWJsZShmYWxzZSwgXCJiYWNrLXRvLWFwcFwiKTtcbiAgfSwgMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclNlY3Rpb24oc2VjdGlvbjogU2V0dGluZ3NTZWN0aW9uKTogU2V0dGluZ3NIYW5kbGUge1xuICBzdGF0ZS5zZWN0aW9ucy5zZXQoc2VjdGlvbi5pZCwgc2VjdGlvbik7XG4gIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSByZXJlbmRlcigpO1xuICByZXR1cm4ge1xuICAgIHVucmVnaXN0ZXI6ICgpID0+IHtcbiAgICAgIHN0YXRlLnNlY3Rpb25zLmRlbGV0ZShzZWN0aW9uLmlkKTtcbiAgICAgIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSByZXJlbmRlcigpO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGVhclNlY3Rpb25zKCk6IHZvaWQge1xuICBzdGF0ZS5zZWN0aW9ucy5jbGVhcigpO1xuICAvLyBEcm9wIHJlZ2lzdGVyZWQgcGFnZXMgdG9vIFx1MjAxNCB0aGV5J3JlIG93bmVkIGJ5IHR3ZWFrcyB0aGF0IGp1c3QgZ290XG4gIC8vIHRvcm4gZG93biBieSB0aGUgaG9zdC4gUnVuIGFueSB0ZWFyZG93bnMgYmVmb3JlIGZvcmdldHRpbmcgdGhlbS5cbiAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSB7XG4gICAgdHJ5IHtcbiAgICAgIHAudGVhcmRvd24/LigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHBsb2coXCJwYWdlIHRlYXJkb3duIGZhaWxlZFwiLCB7IGlkOiBwLmlkLCBlcnI6IFN0cmluZyhlKSB9KTtcbiAgICB9XG4gIH1cbiAgc3RhdGUucGFnZXMuY2xlYXIoKTtcbiAgc3luY1BhZ2VzR3JvdXAoKTtcbiAgLy8gSWYgd2Ugd2VyZSBvbiBhIHJlZ2lzdGVyZWQgcGFnZSB0aGF0IG5vIGxvbmdlciBleGlzdHMsIGZhbGwgYmFjayB0b1xuICAvLyByZXN0b3JpbmcgQ29kZXgncyB2aWV3LlxuICBpZiAoXG4gICAgc3RhdGUuYWN0aXZlUGFnZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiZcbiAgICAhc3RhdGUucGFnZXMuaGFzKHN0YXRlLmFjdGl2ZVBhZ2UuaWQpXG4gICkge1xuICAgIHJlc3RvcmVDb2RleFZpZXcoKTtcbiAgfSBlbHNlIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSB7XG4gICAgcmVyZW5kZXIoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgdHdlYWstb3duZWQgc2V0dGluZ3MgcGFnZS4gVGhlIHJ1bnRpbWUgaW5qZWN0cyBhIHNpZGViYXIgZW50cnlcbiAqIHVuZGVyIGEgXCJUV0VBS1NcIiBncm91cCBoZWFkZXIgKHdoaWNoIGFwcGVhcnMgb25seSB3aGVuIGF0IGxlYXN0IG9uZSBwYWdlXG4gKiBpcyByZWdpc3RlcmVkKSBhbmQgcm91dGVzIGNsaWNrcyB0byB0aGUgcGFnZSdzIGByZW5kZXIocm9vdClgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJQYWdlKFxuICB0d2Vha0lkOiBzdHJpbmcsXG4gIG1hbmlmZXN0OiBUd2Vha01hbmlmZXN0LFxuICBwYWdlOiBTZXR0aW5nc1BhZ2UsXG4pOiBTZXR0aW5nc0hhbmRsZSB7XG4gIGNvbnN0IGlkID0gcGFnZS5pZDsgLy8gYWxyZWFkeSBuYW1lc3BhY2VkIGJ5IHR3ZWFrLWhvc3QgYXMgYCR7dHdlYWtJZH06JHtwYWdlLmlkfWBcbiAgY29uc3QgZW50cnk6IFJlZ2lzdGVyZWRQYWdlID0geyBpZCwgdHdlYWtJZCwgbWFuaWZlc3QsIHBhZ2UgfTtcbiAgc3RhdGUucGFnZXMuc2V0KGlkLCBlbnRyeSk7XG4gIHBsb2coXCJyZWdpc3RlclBhZ2VcIiwgeyBpZCwgdGl0bGU6IHBhZ2UudGl0bGUsIHR3ZWFrSWQgfSk7XG4gIHN5bmNQYWdlc0dyb3VwKCk7XG4gIC8vIElmIHRoZSB1c2VyIHdhcyBhbHJlYWR5IG9uIHRoaXMgcGFnZSAoaG90IHJlbG9hZCksIHJlLW1vdW50IGl0cyBib2R5LlxuICBpZiAoc3RhdGUuYWN0aXZlUGFnZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiYgc3RhdGUuYWN0aXZlUGFnZS5pZCA9PT0gaWQpIHtcbiAgICByZXJlbmRlcigpO1xuICB9XG4gIHJldHVybiB7XG4gICAgdW5yZWdpc3RlcjogKCkgPT4ge1xuICAgICAgY29uc3QgZSA9IHN0YXRlLnBhZ2VzLmdldChpZCk7XG4gICAgICBpZiAoIWUpIHJldHVybjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGUudGVhcmRvd24/LigpO1xuICAgICAgfSBjYXRjaCB7fVxuICAgICAgc3RhdGUucGFnZXMuZGVsZXRlKGlkKTtcbiAgICAgIHN5bmNQYWdlc0dyb3VwKCk7XG4gICAgICBpZiAoc3RhdGUuYWN0aXZlUGFnZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiYgc3RhdGUuYWN0aXZlUGFnZS5pZCA9PT0gaWQpIHtcbiAgICAgICAgcmVzdG9yZUNvZGV4VmlldygpO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG5cbi8qKiBDYWxsZWQgYnkgdGhlIHR3ZWFrIGhvc3QgYWZ0ZXIgZmV0Y2hpbmcgdGhlIHR3ZWFrIGxpc3QgZnJvbSBtYWluLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldExpc3RlZFR3ZWFrcyhsaXN0OiBMaXN0ZWRUd2Vha1tdKTogdm9pZCB7XG4gIHN0YXRlLmxpc3RlZFR3ZWFrcyA9IGxpc3Q7XG4gIGlmIChzdGF0ZS5hY3RpdmVQYWdlPy5raW5kID09PSBcInR3ZWFrc1wiKSByZXJlbmRlcigpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgaW5qZWN0aW9uIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiB0cnlJbmplY3QoKTogdm9pZCB7XG4gIGNvbnN0IGl0ZW1zR3JvdXAgPSBmaW5kU2lkZWJhckl0ZW1zR3JvdXAoKTtcbiAgaWYgKCFpdGVtc0dyb3VwKSB7XG4gICAgc2NoZWR1bGVTZXR0aW5nc1N1cmZhY2VIaWRkZW4oKTtcbiAgICBwbG9nKFwic2lkZWJhciBub3QgZm91bmRcIik7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChzdGF0ZS5zZXR0aW5nc1N1cmZhY2VIaWRlVGltZXIpIHtcbiAgICBjbGVhclRpbWVvdXQoc3RhdGUuc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyKTtcbiAgICBzdGF0ZS5zZXR0aW5nc1N1cmZhY2VIaWRlVGltZXIgPSBudWxsO1xuICB9XG4gIHNldFNldHRpbmdzU3VyZmFjZVZpc2libGUodHJ1ZSwgXCJzaWRlYmFyLWZvdW5kXCIpO1xuICAvLyBDb2RleCdzIGl0ZW1zIGdyb3VwIGxpdmVzIGluc2lkZSBhbiBvdXRlciB3cmFwcGVyIHRoYXQncyBhbHJlYWR5IHN0eWxlZFxuICAvLyB0byBob2xkIG11bHRpcGxlIGdyb3VwcyAoYGZsZXggZmxleC1jb2wgZ2FwLTEgZ2FwLTBgKS4gV2UgaW5qZWN0IG91clxuICAvLyBncm91cCBhcyBhIHNpYmxpbmcgc28gdGhlIG5hdHVyYWwgZ2FwLTEgYWN0cyBhcyBvdXIgdmlzdWFsIHNlcGFyYXRvci5cbiAgY29uc3Qgb3V0ZXIgPSBpdGVtc0dyb3VwLnBhcmVudEVsZW1lbnQgPz8gaXRlbXNHcm91cDtcbiAgc3RhdGUuc2lkZWJhclJvb3QgPSBvdXRlcjtcblxuICBpZiAoc3RhdGUubmF2R3JvdXAgJiYgb3V0ZXIuY29udGFpbnMoc3RhdGUubmF2R3JvdXApKSB7XG4gICAgc3luY1BhZ2VzR3JvdXAoKTtcbiAgICAvLyBDb2RleCByZS1yZW5kZXJzIGl0cyBuYXRpdmUgc2lkZWJhciBidXR0b25zIG9uIGl0cyBvd24gc3RhdGUgY2hhbmdlcy5cbiAgICAvLyBJZiBvbmUgb2Ygb3VyIHBhZ2VzIGlzIGFjdGl2ZSwgcmUtc3RyaXAgQ29kZXgncyBhY3RpdmUgc3R5bGluZyBzb1xuICAgIC8vIEdlbmVyYWwgZG9lc24ndCByZWFwcGVhciBhcyBzZWxlY3RlZC5cbiAgICBpZiAoc3RhdGUuYWN0aXZlUGFnZSAhPT0gbnVsbCkgc3luY0NvZGV4TmF0aXZlTmF2QWN0aXZlKHRydWUpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFNpZGViYXIgd2FzIGVpdGhlciBmcmVzaGx5IG1vdW50ZWQgKFNldHRpbmdzIGp1c3Qgb3BlbmVkKSBvciByZS1tb3VudGVkXG4gIC8vIChjbG9zZWQgYW5kIHJlLW9wZW5lZCwgb3IgbmF2aWdhdGVkIGF3YXkgYW5kIGJhY2spLiBJbiBhbGwgb2YgdGhvc2VcbiAgLy8gY2FzZXMgQ29kZXggcmVzZXRzIHRvIGl0cyBkZWZhdWx0IHBhZ2UgKEdlbmVyYWwpLCBidXQgb3VyIGluLW1lbW9yeVxuICAvLyBgYWN0aXZlUGFnZWAgbWF5IHN0aWxsIHJlZmVyZW5jZSB0aGUgbGFzdCB0d2Vhay9wYWdlIHRoZSB1c2VyIGhhZCBvcGVuXG4gIC8vIFx1MjAxNCB3aGljaCB3b3VsZCBjYXVzZSB0aGF0IG5hdiBidXR0b24gdG8gcmVuZGVyIHdpdGggdGhlIGFjdGl2ZSBzdHlsaW5nXG4gIC8vIGV2ZW4gdGhvdWdoIENvZGV4IGlzIHNob3dpbmcgR2VuZXJhbC4gQ2xlYXIgaXQgc28gYHN5bmNQYWdlc0dyb3VwYCAvXG4gIC8vIGBzZXROYXZBY3RpdmVgIHN0YXJ0IGZyb20gYSBuZXV0cmFsIHN0YXRlLiBUaGUgcGFuZWxIb3N0IHJlZmVyZW5jZSBpc1xuICAvLyBhbHNvIHN0YWxlIChpdHMgRE9NIHdhcyBkaXNjYXJkZWQgd2l0aCB0aGUgcHJldmlvdXMgY29udGVudCBhcmVhKS5cbiAgaWYgKHN0YXRlLmFjdGl2ZVBhZ2UgIT09IG51bGwgfHwgc3RhdGUucGFuZWxIb3N0ICE9PSBudWxsKSB7XG4gICAgcGxvZyhcInNpZGViYXIgcmUtbW91bnQgZGV0ZWN0ZWQ7IGNsZWFyaW5nIHN0YWxlIGFjdGl2ZSBzdGF0ZVwiLCB7XG4gICAgICBwcmV2QWN0aXZlOiBzdGF0ZS5hY3RpdmVQYWdlLFxuICAgIH0pO1xuICAgIHN0YXRlLmFjdGl2ZVBhZ2UgPSBudWxsO1xuICAgIHN0YXRlLnBhbmVsSG9zdCA9IG51bGw7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgR3JvdXAgY29udGFpbmVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBncm91cCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGdyb3VwLmRhdGFzZXQuY29kZXhwcCA9IFwibmF2LWdyb3VwXCI7XG4gIGdyb3VwLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtcHhcIjtcblxuICAvLyBcdTI1MDBcdTI1MDAgU2VjdGlvbiBoZWFkZXIgLyBzdWJ0aXRsZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gQ29kZXggZG9lc24ndCAoY3VycmVudGx5KSBzaGlwIGEgc2lkZWJhciBncm91cCBoZWFkZXIsIHNvIHdlIG1pcnJvciB0aGVcbiAgLy8gdmlzdWFsIHdlaWdodCBvZiBgdGV4dC10b2tlbi1kZXNjcmlwdGlvbi1mb3JlZ3JvdW5kYCB1cHBlcmNhc2UgbGFiZWxzXG4gIC8vIHVzZWQgZWxzZXdoZXJlIGluIHRoZWlyIFVJLiBQYWRkaW5nIG1hdGNoZXMgdGhlIGBweC1yb3cteGAgb2YgaXRlbXMuXG4gIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlci5jbGFzc05hbWUgPVxuICAgIFwicHgtcm93LXggcHQtMiBwYi0xIHRleHQtWzExcHhdIGZvbnQtbWVkaXVtIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmQgc2VsZWN0LW5vbmVcIjtcbiAgaGVhZGVyLnRleHRDb250ZW50ID0gXCJDb2RleCBQbHVzIFBsdXNcIjtcbiAgZ3JvdXAuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblxuICAvLyBcdTI1MDBcdTI1MDAgVHdvIHNpZGViYXIgaXRlbXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IGNvbmZpZ0J0biA9IG1ha2VTaWRlYmFySXRlbShcIkNvbmZpZ1wiLCBjb25maWdJY29uU3ZnKCkpO1xuICBjb25zdCB0d2Vha3NCdG4gPSBtYWtlU2lkZWJhckl0ZW0oXCJUd2Vha3NcIiwgdHdlYWtzSWNvblN2ZygpKTtcblxuICBjb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgYWN0aXZhdGVQYWdlKHsga2luZDogXCJjb25maWdcIiB9KTtcbiAgfSk7XG4gIHR3ZWFrc0J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBhY3RpdmF0ZVBhZ2UoeyBraW5kOiBcInR3ZWFrc1wiIH0pO1xuICB9KTtcblxuICBncm91cC5hcHBlbmRDaGlsZChjb25maWdCdG4pO1xuICBncm91cC5hcHBlbmRDaGlsZCh0d2Vha3NCdG4pO1xuICBvdXRlci5hcHBlbmRDaGlsZChncm91cCk7XG5cbiAgc3RhdGUubmF2R3JvdXAgPSBncm91cDtcbiAgc3RhdGUubmF2QnV0dG9ucyA9IHsgY29uZmlnOiBjb25maWdCdG4sIHR3ZWFrczogdHdlYWtzQnRuIH07XG4gIHBsb2coXCJuYXYgZ3JvdXAgaW5qZWN0ZWRcIiwgeyBvdXRlclRhZzogb3V0ZXIudGFnTmFtZSB9KTtcbiAgc3luY1BhZ2VzR3JvdXAoKTtcbn1cblxuZnVuY3Rpb24gc2NoZWR1bGVTZXR0aW5nc1N1cmZhY2VIaWRkZW4oKTogdm9pZCB7XG4gIGlmICghc3RhdGUuc2V0dGluZ3NTdXJmYWNlVmlzaWJsZSB8fCBzdGF0ZS5zZXR0aW5nc1N1cmZhY2VIaWRlVGltZXIpIHJldHVybjtcbiAgc3RhdGUuc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgc3RhdGUuc2V0dGluZ3NTdXJmYWNlSGlkZVRpbWVyID0gbnVsbDtcbiAgICBpZiAoZmluZFNpZGViYXJJdGVtc0dyb3VwKCkpIHJldHVybjtcbiAgICBpZiAoaXNTZXR0aW5nc1RleHRWaXNpYmxlKCkpIHJldHVybjtcbiAgICBzZXRTZXR0aW5nc1N1cmZhY2VWaXNpYmxlKGZhbHNlLCBcInNpZGViYXItbm90LWZvdW5kXCIpO1xuICB9LCAxNTAwKTtcbn1cblxuZnVuY3Rpb24gaXNTZXR0aW5nc1RleHRWaXNpYmxlKCk6IGJvb2xlYW4ge1xuICBjb25zdCB0ZXh0ID0gY29tcGFjdFNldHRpbmdzVGV4dChkb2N1bWVudC5ib2R5Py50ZXh0Q29udGVudCB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gKFxuICAgIHRleHQuaW5jbHVkZXMoXCJiYWNrIHRvIGFwcFwiKSAmJlxuICAgIHRleHQuaW5jbHVkZXMoXCJnZW5lcmFsXCIpICYmXG4gICAgdGV4dC5pbmNsdWRlcyhcImFwcGVhcmFuY2VcIikgJiZcbiAgICAodGV4dC5pbmNsdWRlcyhcImNvbmZpZ3VyYXRpb25cIikgfHwgdGV4dC5pbmNsdWRlcyhcImRlZmF1bHQgcGVybWlzc2lvbnNcIikpXG4gICk7XG59XG5cbmZ1bmN0aW9uIGNvbXBhY3RTZXR0aW5nc1RleHQodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBTdHJpbmcodmFsdWUgfHwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xufVxuXG5mdW5jdGlvbiBzZXRTZXR0aW5nc1N1cmZhY2VWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4sIHJlYXNvbjogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChzdGF0ZS5zZXR0aW5nc1N1cmZhY2VWaXNpYmxlID09PSB2aXNpYmxlKSByZXR1cm47XG4gIHN0YXRlLnNldHRpbmdzU3VyZmFjZVZpc2libGUgPSB2aXNpYmxlO1xuICB0cnkge1xuICAgICh3aW5kb3cgYXMgV2luZG93ICYgeyBfX2NvZGV4cHBTZXR0aW5nc1N1cmZhY2VWaXNpYmxlPzogYm9vbGVhbiB9KS5fX2NvZGV4cHBTZXR0aW5nc1N1cmZhY2VWaXNpYmxlID0gdmlzaWJsZTtcbiAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGF0YXNldC5jb2RleHBwU2V0dGluZ3NTdXJmYWNlID0gdmlzaWJsZSA/IFwidHJ1ZVwiIDogXCJmYWxzZVwiO1xuICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KFxuICAgICAgbmV3IEN1c3RvbUV2ZW50KFwiY29kZXhwcDpzZXR0aW5ncy1zdXJmYWNlXCIsIHtcbiAgICAgICAgZGV0YWlsOiB7IHZpc2libGUsIHJlYXNvbiB9LFxuICAgICAgfSksXG4gICAgKTtcbiAgfSBjYXRjaCB7fVxuICBwbG9nKFwic2V0dGluZ3Mgc3VyZmFjZVwiLCB7IHZpc2libGUsIHJlYXNvbiwgdXJsOiBsb2NhdGlvbi5ocmVmIH0pO1xufVxuXG4vKipcbiAqIFJlbmRlciAob3IgcmUtcmVuZGVyKSB0aGUgc2Vjb25kIHNpZGViYXIgZ3JvdXAgb2YgcGVyLXR3ZWFrIHBhZ2VzLiBUaGVcbiAqIGdyb3VwIGlzIGNyZWF0ZWQgbGF6aWx5IGFuZCByZW1vdmVkIHdoZW4gdGhlIGxhc3QgcGFnZSB1bnJlZ2lzdGVycywgc29cbiAqIHVzZXJzIHdpdGggbm8gcGFnZS1yZWdpc3RlcmluZyB0d2Vha3MgbmV2ZXIgc2VlIGFuIGVtcHR5IFwiVHdlYWtzXCIgaGVhZGVyLlxuICovXG5mdW5jdGlvbiBzeW5jUGFnZXNHcm91cCgpOiB2b2lkIHtcbiAgY29uc3Qgb3V0ZXIgPSBzdGF0ZS5zaWRlYmFyUm9vdDtcbiAgaWYgKCFvdXRlcikgcmV0dXJuO1xuICBjb25zdCBwYWdlcyA9IFsuLi5zdGF0ZS5wYWdlcy52YWx1ZXMoKV07XG5cbiAgLy8gQnVpbGQgYSBkZXRlcm1pbmlzdGljIGZpbmdlcnByaW50IG9mIHRoZSBkZXNpcmVkIGdyb3VwIHN0YXRlLiBJZiB0aGVcbiAgLy8gY3VycmVudCBET00gZ3JvdXAgYWxyZWFkeSBtYXRjaGVzLCB0aGlzIGlzIGEgbm8tb3AgXHUyMDE0IGNyaXRpY2FsLCBiZWNhdXNlXG4gIC8vIHN5bmNQYWdlc0dyb3VwIGlzIGNhbGxlZCBvbiBldmVyeSBNdXRhdGlvbk9ic2VydmVyIHRpY2sgYW5kIGFueSBET01cbiAgLy8gd3JpdGUgd291bGQgcmUtdHJpZ2dlciB0aGF0IG9ic2VydmVyIChpbmZpbml0ZSBsb29wLCBhcHAgZnJlZXplKS5cbiAgY29uc3QgZGVzaXJlZEtleSA9IHBhZ2VzLmxlbmd0aCA9PT0gMFxuICAgID8gXCJFTVBUWVwiXG4gICAgOiBwYWdlcy5tYXAoKHApID0+IGAke3AuaWR9fCR7cC5wYWdlLnRpdGxlfXwke3AucGFnZS5pY29uU3ZnID8/IFwiXCJ9YCkuam9pbihcIlxcblwiKTtcbiAgY29uc3QgZ3JvdXBBdHRhY2hlZCA9ICEhc3RhdGUucGFnZXNHcm91cCAmJiBvdXRlci5jb250YWlucyhzdGF0ZS5wYWdlc0dyb3VwKTtcbiAgaWYgKHN0YXRlLnBhZ2VzR3JvdXBLZXkgPT09IGRlc2lyZWRLZXkgJiYgKHBhZ2VzLmxlbmd0aCA9PT0gMCA/ICFncm91cEF0dGFjaGVkIDogZ3JvdXBBdHRhY2hlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAocGFnZXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKHN0YXRlLnBhZ2VzR3JvdXApIHtcbiAgICAgIHN0YXRlLnBhZ2VzR3JvdXAucmVtb3ZlKCk7XG4gICAgICBzdGF0ZS5wYWdlc0dyb3VwID0gbnVsbDtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwIG9mIHN0YXRlLnBhZ2VzLnZhbHVlcygpKSBwLm5hdkJ1dHRvbiA9IG51bGw7XG4gICAgc3RhdGUucGFnZXNHcm91cEtleSA9IGRlc2lyZWRLZXk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGdyb3VwID0gc3RhdGUucGFnZXNHcm91cDtcbiAgaWYgKCFncm91cCB8fCAhb3V0ZXIuY29udGFpbnMoZ3JvdXApKSB7XG4gICAgZ3JvdXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGdyb3VwLmRhdGFzZXQuY29kZXhwcCA9IFwicGFnZXMtZ3JvdXBcIjtcbiAgICBncm91cC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLXB4XCI7XG4gICAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBoZWFkZXIuY2xhc3NOYW1lID1cbiAgICAgIFwicHgtcm93LXggcHQtMiBwYi0xIHRleHQtWzExcHhdIGZvbnQtbWVkaXVtIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciB0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmQgc2VsZWN0LW5vbmVcIjtcbiAgICBoZWFkZXIudGV4dENvbnRlbnQgPSBcIlR3ZWFrc1wiO1xuICAgIGdyb3VwLmFwcGVuZENoaWxkKGhlYWRlcik7XG4gICAgb3V0ZXIuYXBwZW5kQ2hpbGQoZ3JvdXApO1xuICAgIHN0YXRlLnBhZ2VzR3JvdXAgPSBncm91cDtcbiAgfSBlbHNlIHtcbiAgICAvLyBTdHJpcCBwcmlvciBidXR0b25zIChrZWVwIHRoZSBoZWFkZXIgYXQgaW5kZXggMCkuXG4gICAgd2hpbGUgKGdyb3VwLmNoaWxkcmVuLmxlbmd0aCA+IDEpIGdyb3VwLnJlbW92ZUNoaWxkKGdyb3VwLmxhc3RDaGlsZCEpO1xuICB9XG5cbiAgZm9yIChjb25zdCBwIG9mIHBhZ2VzKSB7XG4gICAgY29uc3QgaWNvbiA9IHAucGFnZS5pY29uU3ZnID8/IGRlZmF1bHRQYWdlSWNvblN2ZygpO1xuICAgIGNvbnN0IGJ0biA9IG1ha2VTaWRlYmFySXRlbShwLnBhZ2UudGl0bGUsIGljb24pO1xuICAgIGJ0bi5kYXRhc2V0LmNvZGV4cHAgPSBgbmF2LXBhZ2UtJHtwLmlkfWA7XG4gICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGFjdGl2YXRlUGFnZSh7IGtpbmQ6IFwicmVnaXN0ZXJlZFwiLCBpZDogcC5pZCB9KTtcbiAgICB9KTtcbiAgICBwLm5hdkJ1dHRvbiA9IGJ0bjtcbiAgICBncm91cC5hcHBlbmRDaGlsZChidG4pO1xuICB9XG4gIHN0YXRlLnBhZ2VzR3JvdXBLZXkgPSBkZXNpcmVkS2V5O1xuICBwbG9nKFwicGFnZXMgZ3JvdXAgc3luY2VkXCIsIHtcbiAgICBjb3VudDogcGFnZXMubGVuZ3RoLFxuICAgIGlkczogcGFnZXMubWFwKChwKSA9PiBwLmlkKSxcbiAgfSk7XG4gIC8vIFJlZmxlY3QgY3VycmVudCBhY3RpdmUgc3RhdGUgYWNyb3NzIHRoZSByZWJ1aWx0IGJ1dHRvbnMuXG4gIHNldE5hdkFjdGl2ZShzdGF0ZS5hY3RpdmVQYWdlKTtcbn1cblxuZnVuY3Rpb24gbWFrZVNpZGViYXJJdGVtKGxhYmVsOiBzdHJpbmcsIGljb25Tdmc6IHN0cmluZyk6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgLy8gQ2xhc3Mgc3RyaW5nIGNvcGllZCB2ZXJiYXRpbSBmcm9tIENvZGV4J3Mgc2lkZWJhciBidXR0b25zIChHZW5lcmFsIGV0YykuXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmRhdGFzZXQuY29kZXhwcCA9IGBuYXYtJHtsYWJlbC50b0xvd2VyQ2FzZSgpfWA7XG4gIGJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIGxhYmVsKTtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJmb2N1cy12aXNpYmxlOm91dGxpbmUtdG9rZW4tYm9yZGVyIHJlbGF0aXZlIHB4LXJvdy14IHB5LXJvdy15IGN1cnNvci1pbnRlcmFjdGlvbiBzaHJpbmstMCBpdGVtcy1jZW50ZXIgb3ZlcmZsb3ctaGlkZGVuIHJvdW5kZWQtbGcgdGV4dC1sZWZ0IHRleHQtc20gZm9jdXMtdmlzaWJsZTpvdXRsaW5lIGZvY3VzLXZpc2libGU6b3V0bGluZS0yIGZvY3VzLXZpc2libGU6b3V0bGluZS1vZmZzZXQtMiBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCBnYXAtMiBmbGV4IHctZnVsbCBob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgZm9udC1ub3JtYWxcIjtcblxuICBjb25zdCBpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGlubmVyLmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IG1pbi13LTAgaXRlbXMtY2VudGVyIHRleHQtYmFzZSBnYXAtMiBmbGV4LTEgdGV4dC10b2tlbi1mb3JlZ3JvdW5kXCI7XG4gIGlubmVyLmlubmVySFRNTCA9IGAke2ljb25Tdmd9PHNwYW4gY2xhc3M9XCJ0cnVuY2F0ZVwiPiR7bGFiZWx9PC9zcGFuPmA7XG4gIGJ0bi5hcHBlbmRDaGlsZChpbm5lcik7XG4gIHJldHVybiBidG47XG59XG5cbi8qKiBJbnRlcm5hbCBrZXkgZm9yIHRoZSBidWlsdC1pbiBuYXYgYnV0dG9ucy4gKi9cbnR5cGUgQnVpbHRpblBhZ2UgPSBcImNvbmZpZ1wiIHwgXCJ0d2Vha3NcIjtcblxuZnVuY3Rpb24gc2V0TmF2QWN0aXZlKGFjdGl2ZTogQWN0aXZlUGFnZSB8IG51bGwpOiB2b2lkIHtcbiAgLy8gQnVpbHQtaW4gKENvbmZpZy9Ud2Vha3MpIGJ1dHRvbnMuXG4gIGlmIChzdGF0ZS5uYXZCdXR0b25zKSB7XG4gICAgY29uc3QgYnVpbHRpbjogQnVpbHRpblBhZ2UgfCBudWxsID1cbiAgICAgIGFjdGl2ZT8ua2luZCA9PT0gXCJjb25maWdcIiA/IFwiY29uZmlnXCIgOlxuICAgICAgYWN0aXZlPy5raW5kID09PSBcInR3ZWFrc1wiID8gXCJ0d2Vha3NcIiA6IG51bGw7XG4gICAgZm9yIChjb25zdCBba2V5LCBidG5dIG9mIE9iamVjdC5lbnRyaWVzKHN0YXRlLm5hdkJ1dHRvbnMpIGFzIFtCdWlsdGluUGFnZSwgSFRNTEJ1dHRvbkVsZW1lbnRdW10pIHtcbiAgICAgIGFwcGx5TmF2QWN0aXZlKGJ0biwga2V5ID09PSBidWlsdGluKTtcbiAgICB9XG4gIH1cbiAgLy8gUGVyLXBhZ2UgcmVnaXN0ZXJlZCBidXR0b25zLlxuICBmb3IgKGNvbnN0IHAgb2Ygc3RhdGUucGFnZXMudmFsdWVzKCkpIHtcbiAgICBpZiAoIXAubmF2QnV0dG9uKSBjb250aW51ZTtcbiAgICBjb25zdCBpc0FjdGl2ZSA9IGFjdGl2ZT8ua2luZCA9PT0gXCJyZWdpc3RlcmVkXCIgJiYgYWN0aXZlLmlkID09PSBwLmlkO1xuICAgIGFwcGx5TmF2QWN0aXZlKHAubmF2QnV0dG9uLCBpc0FjdGl2ZSk7XG4gIH1cbiAgLy8gQ29kZXgncyBvd24gc2lkZWJhciBidXR0b25zIChHZW5lcmFsLCBBcHBlYXJhbmNlLCBldGMpLiBXaGVuIG9uZSBvZlxuICAvLyBvdXIgcGFnZXMgaXMgYWN0aXZlLCBDb2RleCBzdGlsbCBoYXMgYXJpYS1jdXJyZW50PVwicGFnZVwiIGFuZCB0aGVcbiAgLy8gYWN0aXZlLWJnIGNsYXNzIG9uIHdoaWNoZXZlciBpdGVtIGl0IGNvbnNpZGVyZWQgdGhlIHJvdXRlIFx1MjAxNCB0eXBpY2FsbHlcbiAgLy8gR2VuZXJhbC4gVGhhdCBtYWtlcyBib3RoIGJ1dHRvbnMgbG9vayBzZWxlY3RlZC4gU3RyaXAgQ29kZXgncyBhY3RpdmVcbiAgLy8gc3R5bGluZyB3aGlsZSBvbmUgb2Ygb3VycyBpcyBhY3RpdmU7IHJlc3RvcmUgaXQgd2hlbiBub25lIGlzLlxuICBzeW5jQ29kZXhOYXRpdmVOYXZBY3RpdmUoYWN0aXZlICE9PSBudWxsKTtcbn1cblxuLyoqXG4gKiBNdXRlIENvZGV4J3Mgb3duIGFjdGl2ZS1zdGF0ZSBzdHlsaW5nIG9uIGl0cyBzaWRlYmFyIGJ1dHRvbnMuIFdlIGRvbid0XG4gKiB0b3VjaCBDb2RleCdzIFJlYWN0IHN0YXRlIFx1MjAxNCB3aGVuIHRoZSB1c2VyIGNsaWNrcyBhIG5hdGl2ZSBpdGVtLCBDb2RleFxuICogcmUtcmVuZGVycyB0aGUgYnV0dG9ucyBhbmQgcmUtYXBwbGllcyBpdHMgb3duIGNvcnJlY3Qgc3RhdGUsIHRoZW4gb3VyXG4gKiBzaWRlYmFyLWNsaWNrIGxpc3RlbmVyIGZpcmVzIGByZXN0b3JlQ29kZXhWaWV3YCAod2hpY2ggY2FsbHMgYmFjayBpbnRvXG4gKiBgc2V0TmF2QWN0aXZlKG51bGwpYCBhbmQgbGV0cyBDb2RleCdzIHN0eWxpbmcgc3RhbmQpLlxuICpcbiAqIGBtdXRlPXRydWVgICBcdTIxOTIgc3RyaXAgYXJpYS1jdXJyZW50IGFuZCBzd2FwIGFjdGl2ZSBiZyBcdTIxOTIgaG92ZXIgYmdcbiAqIGBtdXRlPWZhbHNlYCBcdTIxOTIgbm8tb3AgKENvZGV4J3Mgb3duIHJlLXJlbmRlciBhbHJlYWR5IHJlc3RvcmVkIHRoaW5ncylcbiAqL1xuZnVuY3Rpb24gc3luY0NvZGV4TmF0aXZlTmF2QWN0aXZlKG11dGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKCFtdXRlKSByZXR1cm47XG4gIGNvbnN0IHJvb3QgPSBzdGF0ZS5zaWRlYmFyUm9vdDtcbiAgaWYgKCFyb290KSByZXR1cm47XG4gIGNvbnN0IGJ1dHRvbnMgPSBBcnJheS5mcm9tKHJvb3QucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oXCJidXR0b25cIikpO1xuICBmb3IgKGNvbnN0IGJ0biBvZiBidXR0b25zKSB7XG4gICAgLy8gU2tpcCBvdXIgb3duIGJ1dHRvbnMuXG4gICAgaWYgKGJ0bi5kYXRhc2V0LmNvZGV4cHApIGNvbnRpbnVlO1xuICAgIGlmIChidG4uZ2V0QXR0cmlidXRlKFwiYXJpYS1jdXJyZW50XCIpID09PSBcInBhZ2VcIikge1xuICAgICAgYnRuLnJlbW92ZUF0dHJpYnV0ZShcImFyaWEtY3VycmVudFwiKTtcbiAgICB9XG4gICAgaWYgKGJ0bi5jbGFzc0xpc3QuY29udGFpbnMoXCJiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIikpIHtcbiAgICAgIGJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwiYmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIpO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoXCJob3ZlcjpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIik7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5TmF2QWN0aXZlKGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQsIGFjdGl2ZTogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBpbm5lciA9IGJ0bi5maXJzdEVsZW1lbnRDaGlsZCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChhY3RpdmUpIHtcbiAgICAgIGJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwiaG92ZXI6YmctdG9rZW4tbGlzdC1ob3Zlci1iYWNrZ3JvdW5kXCIsIFwiZm9udC1ub3JtYWxcIik7XG4gICAgICBidG4uY2xhc3NMaXN0LmFkZChcImJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZFwiKTtcbiAgICAgIGJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWN1cnJlbnRcIiwgXCJwYWdlXCIpO1xuICAgICAgaWYgKGlubmVyKSB7XG4gICAgICAgIGlubmVyLmNsYXNzTGlzdC5yZW1vdmUoXCJ0ZXh0LXRva2VuLWZvcmVncm91bmRcIik7XG4gICAgICAgIGlubmVyLmNsYXNzTGlzdC5hZGQoXCJ0ZXh0LXRva2VuLWxpc3QtYWN0aXZlLXNlbGVjdGlvbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgICBpbm5lclxuICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKFwic3ZnXCIpXG4gICAgICAgICAgPy5jbGFzc0xpc3QuYWRkKFwidGV4dC10b2tlbi1saXN0LWFjdGl2ZS1zZWxlY3Rpb24taWNvbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBidG4uY2xhc3NMaXN0LmFkZChcImhvdmVyOmJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZFwiLCBcImZvbnQtbm9ybWFsXCIpO1xuICAgICAgYnRuLmNsYXNzTGlzdC5yZW1vdmUoXCJiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmRcIik7XG4gICAgICBidG4ucmVtb3ZlQXR0cmlidXRlKFwiYXJpYS1jdXJyZW50XCIpO1xuICAgICAgaWYgKGlubmVyKSB7XG4gICAgICAgIGlubmVyLmNsYXNzTGlzdC5hZGQoXCJ0ZXh0LXRva2VuLWZvcmVncm91bmRcIik7XG4gICAgICAgIGlubmVyLmNsYXNzTGlzdC5yZW1vdmUoXCJ0ZXh0LXRva2VuLWxpc3QtYWN0aXZlLXNlbGVjdGlvbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgICBpbm5lclxuICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKFwic3ZnXCIpXG4gICAgICAgICAgPy5jbGFzc0xpc3QucmVtb3ZlKFwidGV4dC10b2tlbi1saXN0LWFjdGl2ZS1zZWxlY3Rpb24taWNvbi1mb3JlZ3JvdW5kXCIpO1xuICAgICAgfVxuICAgIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIGFjdGl2YXRpb24gXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGFjdGl2YXRlUGFnZShwYWdlOiBBY3RpdmVQYWdlKTogdm9pZCB7XG4gIGNvbnN0IGNvbnRlbnQgPSBmaW5kQ29udGVudEFyZWEoKTtcbiAgaWYgKCFjb250ZW50KSB7XG4gICAgcGxvZyhcImFjdGl2YXRlOiBjb250ZW50IGFyZWEgbm90IGZvdW5kXCIpO1xuICAgIHJldHVybjtcbiAgfVxuICBzdGF0ZS5hY3RpdmVQYWdlID0gcGFnZTtcbiAgcGxvZyhcImFjdGl2YXRlXCIsIHsgcGFnZSB9KTtcblxuICAvLyBIaWRlIENvZGV4J3MgY29udGVudCBjaGlsZHJlbiwgc2hvdyBvdXJzLlxuICBmb3IgKGNvbnN0IGNoaWxkIG9mIEFycmF5LmZyb20oY29udGVudC5jaGlsZHJlbikgYXMgSFRNTEVsZW1lbnRbXSkge1xuICAgIGlmIChjaGlsZC5kYXRhc2V0LmNvZGV4cHAgPT09IFwidHdlYWtzLXBhbmVsXCIpIGNvbnRpbnVlO1xuICAgIGlmIChjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgY2hpbGQuZGF0YXNldC5jb2RleHBwSGlkZGVuID0gY2hpbGQuc3R5bGUuZGlzcGxheSB8fCBcIlwiO1xuICAgIH1cbiAgICBjaGlsZC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIH1cbiAgbGV0IHBhbmVsID0gY29udGVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignW2RhdGEtY29kZXhwcD1cInR3ZWFrcy1wYW5lbFwiXScpO1xuICBpZiAoIXBhbmVsKSB7XG4gICAgcGFuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHBhbmVsLmRhdGFzZXQuY29kZXhwcCA9IFwidHdlYWtzLXBhbmVsXCI7XG4gICAgcGFuZWwuc3R5bGUuY3NzVGV4dCA9IFwid2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtvdmVyZmxvdzphdXRvO1wiO1xuICAgIGNvbnRlbnQuYXBwZW5kQ2hpbGQocGFuZWwpO1xuICB9XG4gIHBhbmVsLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gIHN0YXRlLnBhbmVsSG9zdCA9IHBhbmVsO1xuICByZXJlbmRlcigpO1xuICBzZXROYXZBY3RpdmUocGFnZSk7XG4gIC8vIHJlc3RvcmUgQ29kZXgncyB2aWV3LiBSZS1yZWdpc3RlciBpZiBuZWVkZWQuXG4gIGNvbnN0IHNpZGViYXIgPSBzdGF0ZS5zaWRlYmFyUm9vdDtcbiAgaWYgKHNpZGViYXIpIHtcbiAgICBpZiAoc3RhdGUuc2lkZWJhclJlc3RvcmVIYW5kbGVyKSB7XG4gICAgICBzaWRlYmFyLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIsIHRydWUpO1xuICAgIH1cbiAgICBjb25zdCBoYW5kbGVyID0gKGU6IEV2ZW50KSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xuICAgICAgaWYgKHN0YXRlLm5hdkdyb3VwPy5jb250YWlucyh0YXJnZXQpKSByZXR1cm47IC8vIG91ciBidXR0b25zXG4gICAgICBpZiAoc3RhdGUucGFnZXNHcm91cD8uY29udGFpbnModGFyZ2V0KSkgcmV0dXJuOyAvLyBvdXIgcGFnZSBidXR0b25zXG4gICAgICByZXN0b3JlQ29kZXhWaWV3KCk7XG4gICAgfTtcbiAgICBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIgPSBoYW5kbGVyO1xuICAgIHNpZGViYXIuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGhhbmRsZXIsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlc3RvcmVDb2RleFZpZXcoKTogdm9pZCB7XG4gIHBsb2coXCJyZXN0b3JlIGNvZGV4IHZpZXdcIik7XG4gIGNvbnN0IGNvbnRlbnQgPSBmaW5kQ29udGVudEFyZWEoKTtcbiAgaWYgKCFjb250ZW50KSByZXR1cm47XG4gIGlmIChzdGF0ZS5wYW5lbEhvc3QpIHN0YXRlLnBhbmVsSG9zdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShjb250ZW50LmNoaWxkcmVuKSBhcyBIVE1MRWxlbWVudFtdKSB7XG4gICAgaWYgKGNoaWxkID09PSBzdGF0ZS5wYW5lbEhvc3QpIGNvbnRpbnVlO1xuICAgIGlmIChjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IGNoaWxkLmRhdGFzZXQuY29kZXhwcEhpZGRlbjtcbiAgICAgIGRlbGV0ZSBjaGlsZC5kYXRhc2V0LmNvZGV4cHBIaWRkZW47XG4gICAgfVxuICB9XG4gIHN0YXRlLmFjdGl2ZVBhZ2UgPSBudWxsO1xuICBzZXROYXZBY3RpdmUobnVsbCk7XG4gIGlmIChzdGF0ZS5zaWRlYmFyUm9vdCAmJiBzdGF0ZS5zaWRlYmFyUmVzdG9yZUhhbmRsZXIpIHtcbiAgICBzdGF0ZS5zaWRlYmFyUm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKFxuICAgICAgXCJjbGlja1wiLFxuICAgICAgc3RhdGUuc2lkZWJhclJlc3RvcmVIYW5kbGVyLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHN0YXRlLnNpZGViYXJSZXN0b3JlSGFuZGxlciA9IG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVyZW5kZXIoKTogdm9pZCB7XG4gIGlmICghc3RhdGUuYWN0aXZlUGFnZSkgcmV0dXJuO1xuICBjb25zdCBob3N0ID0gc3RhdGUucGFuZWxIb3N0O1xuICBpZiAoIWhvc3QpIHJldHVybjtcbiAgaG9zdC5pbm5lckhUTUwgPSBcIlwiO1xuXG4gIGNvbnN0IGFwID0gc3RhdGUuYWN0aXZlUGFnZTtcbiAgaWYgKGFwLmtpbmQgPT09IFwicmVnaXN0ZXJlZFwiKSB7XG4gICAgY29uc3QgZW50cnkgPSBzdGF0ZS5wYWdlcy5nZXQoYXAuaWQpO1xuICAgIGlmICghZW50cnkpIHtcbiAgICAgIHJlc3RvcmVDb2RleFZpZXcoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgcm9vdCA9IHBhbmVsU2hlbGwoZW50cnkucGFnZS50aXRsZSwgZW50cnkucGFnZS5kZXNjcmlwdGlvbik7XG4gICAgaG9zdC5hcHBlbmRDaGlsZChyb290Lm91dGVyKTtcbiAgICB0cnkge1xuICAgICAgLy8gVGVhciBkb3duIGFueSBwcmlvciByZW5kZXIgYmVmb3JlIHJlLXJlbmRlcmluZyAoaG90IHJlbG9hZCkuXG4gICAgICB0cnkgeyBlbnRyeS50ZWFyZG93bj8uKCk7IH0gY2F0Y2gge31cbiAgICAgIGVudHJ5LnRlYXJkb3duID0gbnVsbDtcbiAgICAgIGNvbnN0IHJldCA9IGVudHJ5LnBhZ2UucmVuZGVyKHJvb3Quc2VjdGlvbnNXcmFwKTtcbiAgICAgIGlmICh0eXBlb2YgcmV0ID09PSBcImZ1bmN0aW9uXCIpIGVudHJ5LnRlYXJkb3duID0gcmV0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGVyciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBlcnIuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLWNoYXJ0cy1yZWQgdGV4dC1zbVwiO1xuICAgICAgZXJyLnRleHRDb250ZW50ID0gYEVycm9yIHJlbmRlcmluZyBwYWdlOiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfWA7XG4gICAgICByb290LnNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZChlcnIpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0aXRsZSA9IGFwLmtpbmQgPT09IFwidHdlYWtzXCIgPyBcIlR3ZWFrc1wiIDogXCJDb25maWdcIjtcbiAgY29uc3Qgc3VidGl0bGUgPSBhcC5raW5kID09PSBcInR3ZWFrc1wiXG4gICAgPyBcIk1hbmFnZSB5b3VyIGluc3RhbGxlZCBDb2RleCsrIHR3ZWFrcy5cIlxuICAgIDogXCJDb25maWd1cmUgQ29kZXgrKyBpdHNlbGYuXCI7XG4gIGNvbnN0IHJvb3QgPSBwYW5lbFNoZWxsKHRpdGxlLCBzdWJ0aXRsZSk7XG4gIGhvc3QuYXBwZW5kQ2hpbGQocm9vdC5vdXRlcik7XG4gIGlmIChhcC5raW5kID09PSBcInR3ZWFrc1wiKSByZW5kZXJUd2Vha3NQYWdlKHJvb3Quc2VjdGlvbnNXcmFwKTtcbiAgZWxzZSByZW5kZXJDb25maWdQYWdlKHJvb3Quc2VjdGlvbnNXcmFwKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIHBhZ2VzIFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiByZW5kZXJDb25maWdQYWdlKHNlY3Rpb25zV3JhcDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICBzZWN0aW9uLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICBzZWN0aW9uLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkNvZGV4KysgVXBkYXRlc1wiKSk7XG4gIGNvbnN0IGNhcmQgPSByb3VuZGVkQ2FyZCgpO1xuICBjb25zdCBsb2FkaW5nID0gcm93U2ltcGxlKFwiTG9hZGluZyB1cGRhdGUgc2V0dGluZ3NcIiwgXCJDaGVja2luZyBjdXJyZW50IENvZGV4KysgY29uZmlndXJhdGlvbi5cIik7XG4gIGNhcmQuYXBwZW5kQ2hpbGQobG9hZGluZyk7XG4gIHNlY3Rpb24uYXBwZW5kQ2hpbGQoY2FyZCk7XG4gIHNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZChzZWN0aW9uKTtcblxuICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgLmludm9rZShcImNvZGV4cHA6Z2V0LWNvbmZpZ1wiKVxuICAgIC50aGVuKChjb25maWcpID0+IHtcbiAgICAgIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgcmVuZGVyQ29kZXhQbHVzUGx1c0NvbmZpZyhjYXJkLCBjb25maWcgYXMgQ29kZXhQbHVzUGx1c0NvbmZpZyk7XG4gICAgfSlcbiAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgIGNhcmQudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgY2FyZC5hcHBlbmRDaGlsZChyb3dTaW1wbGUoXCJDb3VsZCBub3QgbG9hZCB1cGRhdGUgc2V0dGluZ3NcIiwgU3RyaW5nKGUpKSk7XG4gICAgfSk7XG5cbiAgY29uc3Qgd2F0Y2hlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICB3YXRjaGVyLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICB3YXRjaGVyLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkF1dG8tUmVwYWlyIFdhdGNoZXJcIikpO1xuICBjb25zdCB3YXRjaGVyQ2FyZCA9IHJvdW5kZWRDYXJkKCk7XG4gIHdhdGNoZXJDYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIkNoZWNraW5nIHdhdGNoZXJcIiwgXCJWZXJpZnlpbmcgdGhlIHVwZGF0ZXIgcmVwYWlyIHNlcnZpY2UuXCIpKTtcbiAgd2F0Y2hlci5hcHBlbmRDaGlsZCh3YXRjaGVyQ2FyZCk7XG4gIHNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZCh3YXRjaGVyKTtcbiAgcmVuZGVyV2F0Y2hlckhlYWx0aENhcmQod2F0Y2hlckNhcmQpO1xuXG4gIGNvbnN0IG1haW50ZW5hbmNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIik7XG4gIG1haW50ZW5hbmNlLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICBtYWludGVuYW5jZS5hcHBlbmRDaGlsZChzZWN0aW9uVGl0bGUoXCJNYWludGVuYW5jZVwiKSk7XG4gIGNvbnN0IG1haW50ZW5hbmNlQ2FyZCA9IHJvdW5kZWRDYXJkKCk7XG4gIG1haW50ZW5hbmNlQ2FyZC5hcHBlbmRDaGlsZCh1bmluc3RhbGxSb3coKSk7XG4gIG1haW50ZW5hbmNlQ2FyZC5hcHBlbmRDaGlsZChyZXBvcnRCdWdSb3coKSk7XG4gIG1haW50ZW5hbmNlLmFwcGVuZENoaWxkKG1haW50ZW5hbmNlQ2FyZCk7XG4gIHNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZChtYWludGVuYW5jZSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvZGV4UGx1c1BsdXNDb25maWcoY2FyZDogSFRNTEVsZW1lbnQsIGNvbmZpZzogQ29kZXhQbHVzUGx1c0NvbmZpZyk6IHZvaWQge1xuICBjYXJkLmFwcGVuZENoaWxkKGF1dG9VcGRhdGVSb3coY29uZmlnKSk7XG4gIGNhcmQuYXBwZW5kQ2hpbGQoY2hlY2tGb3JVcGRhdGVzUm93KGNvbmZpZy51cGRhdGVDaGVjaykpO1xuICBpZiAoY29uZmlnLnVwZGF0ZUNoZWNrKSBjYXJkLmFwcGVuZENoaWxkKHJlbGVhc2VOb3Rlc1Jvdyhjb25maWcudXBkYXRlQ2hlY2spKTtcbn1cblxuZnVuY3Rpb24gYXV0b1VwZGF0ZVJvdyhjb25maWc6IENvZGV4UGx1c1BsdXNDb25maWcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJvdy5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNCBwLTNcIjtcbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC1jb2wgZ2FwLTFcIjtcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZS5jbGFzc05hbWUgPSBcIm1pbi13LTAgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IFwiQXV0b21hdGljYWxseSByZWZyZXNoIENvZGV4KytcIjtcbiAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGRlc2MuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5IG1pbi13LTAgdGV4dC1zbVwiO1xuICBkZXNjLnRleHRDb250ZW50ID0gYEluc3RhbGxlZCB2ZXJzaW9uIHYke2NvbmZpZy52ZXJzaW9ufS4gVGhlIHdhdGNoZXIgY2FuIHJlZnJlc2ggdGhlIENvZGV4KysgcnVudGltZSBhZnRlciB5b3UgcmVydW4gdGhlIEdpdEh1YiBpbnN0YWxsZXIuYDtcbiAgbGVmdC5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIGxlZnQuYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIHJvdy5hcHBlbmRDaGlsZChsZWZ0KTtcbiAgcm93LmFwcGVuZENoaWxkKFxuICAgIHN3aXRjaENvbnRyb2woY29uZmlnLmF1dG9VcGRhdGUsIGFzeW5jIChuZXh0KSA9PiB7XG4gICAgICBhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnNldC1hdXRvLXVwZGF0ZVwiLCBuZXh0KTtcbiAgICB9KSxcbiAgKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gY2hlY2tGb3JVcGRhdGVzUm93KGNoZWNrOiBDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2sgfCBudWxsKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG4gIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBsZWZ0LmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0xXCI7XG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdGl0bGUudGV4dENvbnRlbnQgPSBjaGVjaz8udXBkYXRlQXZhaWxhYmxlID8gXCJDb2RleCsrIHVwZGF0ZSBhdmFpbGFibGVcIiA6IFwiQ29kZXgrKyBpcyB1cCB0byBkYXRlXCI7XG4gIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBkZXNjLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSBtaW4tdy0wIHRleHQtc21cIjtcbiAgZGVzYy50ZXh0Q29udGVudCA9IHVwZGF0ZVN1bW1hcnkoY2hlY2spO1xuICBsZWZ0LmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgbGVmdC5hcHBlbmRDaGlsZChkZXNjKTtcbiAgcm93LmFwcGVuZENoaWxkKGxlZnQpO1xuXG4gIGNvbnN0IGFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBhY3Rpb25zLmNsYXNzTmFtZSA9IFwiZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgaWYgKGNoZWNrPy5yZWxlYXNlVXJsKSB7XG4gICAgYWN0aW9ucy5hcHBlbmRDaGlsZChcbiAgICAgIGNvbXBhY3RCdXR0b24oXCJSZWxlYXNlIE5vdGVzXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgY2hlY2sucmVsZWFzZVVybCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG4gIGFjdGlvbnMuYXBwZW5kQ2hpbGQoXG4gICAgY29tcGFjdEJ1dHRvbihcIkNoZWNrIE5vd1wiLCAoKSA9PiB7XG4gICAgICByb3cuc3R5bGUub3BhY2l0eSA9IFwiMC42NVwiO1xuICAgICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgICAuaW52b2tlKFwiY29kZXhwcDpjaGVjay1jb2RleHBwLXVwZGF0ZVwiLCB0cnVlKVxuICAgICAgICAudGhlbigobmV4dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNhcmQgPSByb3cucGFyZW50RWxlbWVudDtcbiAgICAgICAgICBpZiAoIWNhcmQpIHJldHVybjtcbiAgICAgICAgICBjYXJkLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6Z2V0LWNvbmZpZ1wiKS50aGVuKChjb25maWcpID0+IHtcbiAgICAgICAgICAgIHJlbmRlckNvZGV4UGx1c1BsdXNDb25maWcoY2FyZCwge1xuICAgICAgICAgICAgICAuLi4oY29uZmlnIGFzIENvZGV4UGx1c1BsdXNDb25maWcpLFxuICAgICAgICAgICAgICB1cGRhdGVDaGVjazogbmV4dCBhcyBDb2RleFBsdXNQbHVzVXBkYXRlQ2hlY2ssXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiBwbG9nKFwiQ29kZXgrKyB1cGRhdGUgY2hlY2sgZmFpbGVkXCIsIFN0cmluZyhlKSkpXG4gICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICByb3cuc3R5bGUub3BhY2l0eSA9IFwiXCI7XG4gICAgICAgIH0pO1xuICAgIH0pLFxuICApO1xuICByb3cuYXBwZW5kQ2hpbGQoYWN0aW9ucyk7XG4gIHJldHVybiByb3c7XG59XG5cbmZ1bmN0aW9uIHJlbGVhc2VOb3Rlc1JvdyhjaGVjazogQ29kZXhQbHVzUGx1c1VwZGF0ZUNoZWNrKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICByb3cuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC0yIHAtM1wiO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlLmNsYXNzTmFtZSA9IFwidGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IFwiTGF0ZXN0IHJlbGVhc2Ugbm90ZXNcIjtcbiAgcm93LmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGJvZHkuY2xhc3NOYW1lID1cbiAgICBcIm1heC1oLTYwIG92ZXJmbG93LWF1dG8gcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLXRva2VuLWJvcmRlciBiZy10b2tlbi1mb3JlZ3JvdW5kLzUgcC0zIHRleHQtc20gdGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICBib2R5LmFwcGVuZENoaWxkKHJlbmRlclJlbGVhc2VOb3Rlc01hcmtkb3duKGNoZWNrLnJlbGVhc2VOb3Rlcz8udHJpbSgpIHx8IGNoZWNrLmVycm9yIHx8IFwiTm8gcmVsZWFzZSBub3RlcyBhdmFpbGFibGUuXCIpKTtcbiAgcm93LmFwcGVuZENoaWxkKGJvZHkpO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiByZW5kZXJSZWxlYXNlTm90ZXNNYXJrZG93bihtYXJrZG93bjogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCByb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcm9vdC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTJcIjtcbiAgY29uc3QgbGluZXMgPSBtYXJrZG93bi5yZXBsYWNlKC9cXHJcXG4/L2csIFwiXFxuXCIpLnNwbGl0KFwiXFxuXCIpO1xuICBsZXQgcGFyYWdyYXBoOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgbGlzdDogSFRNTE9MaXN0RWxlbWVudCB8IEhUTUxVTGlzdEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGNvZGVMaW5lczogc3RyaW5nW10gfCBudWxsID0gbnVsbDtcblxuICBjb25zdCBmbHVzaFBhcmFncmFwaCA9ICgpID0+IHtcbiAgICBpZiAocGFyYWdyYXBoLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIGNvbnN0IHAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcbiAgICBwLmNsYXNzTmFtZSA9IFwibS0wIGxlYWRpbmctNVwiO1xuICAgIGFwcGVuZElubGluZU1hcmtkb3duKHAsIHBhcmFncmFwaC5qb2luKFwiIFwiKS50cmltKCkpO1xuICAgIHJvb3QuYXBwZW5kQ2hpbGQocCk7XG4gICAgcGFyYWdyYXBoID0gW107XG4gIH07XG4gIGNvbnN0IGZsdXNoTGlzdCA9ICgpID0+IHtcbiAgICBpZiAoIWxpc3QpIHJldHVybjtcbiAgICByb290LmFwcGVuZENoaWxkKGxpc3QpO1xuICAgIGxpc3QgPSBudWxsO1xuICB9O1xuICBjb25zdCBmbHVzaENvZGUgPSAoKSA9PiB7XG4gICAgaWYgKCFjb2RlTGluZXMpIHJldHVybjtcbiAgICBjb25zdCBwcmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicHJlXCIpO1xuICAgIHByZS5jbGFzc05hbWUgPVxuICAgICAgXCJtLTAgb3ZlcmZsb3ctYXV0byByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLWZvcmVncm91bmQvMTAgcC0yIHRleHQteHMgdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgICBjb25zdCBjb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNvZGVcIik7XG4gICAgY29kZS50ZXh0Q29udGVudCA9IGNvZGVMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgIHByZS5hcHBlbmRDaGlsZChjb2RlKTtcbiAgICByb290LmFwcGVuZENoaWxkKHByZSk7XG4gICAgY29kZUxpbmVzID0gbnVsbDtcbiAgfTtcblxuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICBpZiAobGluZS50cmltKCkuc3RhcnRzV2l0aChcImBgYFwiKSkge1xuICAgICAgaWYgKGNvZGVMaW5lcykgZmx1c2hDb2RlKCk7XG4gICAgICBlbHNlIHtcbiAgICAgICAgZmx1c2hQYXJhZ3JhcGgoKTtcbiAgICAgICAgZmx1c2hMaXN0KCk7XG4gICAgICAgIGNvZGVMaW5lcyA9IFtdO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChjb2RlTGluZXMpIHtcbiAgICAgIGNvZGVMaW5lcy5wdXNoKGxpbmUpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdHJpbW1lZCA9IGxpbmUudHJpbSgpO1xuICAgIGlmICghdHJpbW1lZCkge1xuICAgICAgZmx1c2hQYXJhZ3JhcGgoKTtcbiAgICAgIGZsdXNoTGlzdCgpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZGluZyA9IC9eKCN7MSwzfSlcXHMrKC4rKSQvLmV4ZWModHJpbW1lZCk7XG4gICAgaWYgKGhlYWRpbmcpIHtcbiAgICAgIGZsdXNoUGFyYWdyYXBoKCk7XG4gICAgICBmbHVzaExpc3QoKTtcbiAgICAgIGNvbnN0IGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGhlYWRpbmdbMV0ubGVuZ3RoID09PSAxID8gXCJoM1wiIDogXCJoNFwiKTtcbiAgICAgIGguY2xhc3NOYW1lID0gXCJtLTAgdGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICAgICAgYXBwZW5kSW5saW5lTWFya2Rvd24oaCwgaGVhZGluZ1syXSk7XG4gICAgICByb290LmFwcGVuZENoaWxkKGgpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgdW5vcmRlcmVkID0gL15bLSpdXFxzKyguKykkLy5leGVjKHRyaW1tZWQpO1xuICAgIGNvbnN0IG9yZGVyZWQgPSAvXlxcZCtbLildXFxzKyguKykkLy5leGVjKHRyaW1tZWQpO1xuICAgIGlmICh1bm9yZGVyZWQgfHwgb3JkZXJlZCkge1xuICAgICAgZmx1c2hQYXJhZ3JhcGgoKTtcbiAgICAgIGNvbnN0IHdhbnRPcmRlcmVkID0gQm9vbGVhbihvcmRlcmVkKTtcbiAgICAgIGlmICghbGlzdCB8fCAod2FudE9yZGVyZWQgJiYgbGlzdC50YWdOYW1lICE9PSBcIk9MXCIpIHx8ICghd2FudE9yZGVyZWQgJiYgbGlzdC50YWdOYW1lICE9PSBcIlVMXCIpKSB7XG4gICAgICAgIGZsdXNoTGlzdCgpO1xuICAgICAgICBsaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh3YW50T3JkZXJlZCA/IFwib2xcIiA6IFwidWxcIik7XG4gICAgICAgIGxpc3QuY2xhc3NOYW1lID0gd2FudE9yZGVyZWRcbiAgICAgICAgICA/IFwibS0wIGxpc3QtZGVjaW1hbCBzcGFjZS15LTEgcGwtNSBsZWFkaW5nLTVcIlxuICAgICAgICAgIDogXCJtLTAgbGlzdC1kaXNjIHNwYWNlLXktMSBwbC01IGxlYWRpbmctNVwiO1xuICAgICAgfVxuICAgICAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgICBhcHBlbmRJbmxpbmVNYXJrZG93bihsaSwgKHVub3JkZXJlZCA/PyBvcmRlcmVkKT8uWzFdID8/IFwiXCIpO1xuICAgICAgbGlzdC5hcHBlbmRDaGlsZChsaSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdW90ZSA9IC9ePlxccz8oLispJC8uZXhlYyh0cmltbWVkKTtcbiAgICBpZiAocXVvdGUpIHtcbiAgICAgIGZsdXNoUGFyYWdyYXBoKCk7XG4gICAgICBmbHVzaExpc3QoKTtcbiAgICAgIGNvbnN0IGJsb2NrcXVvdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYmxvY2txdW90ZVwiKTtcbiAgICAgIGJsb2NrcXVvdGUuY2xhc3NOYW1lID0gXCJtLTAgYm9yZGVyLWwtMiBib3JkZXItdG9rZW4tYm9yZGVyIHBsLTMgbGVhZGluZy01XCI7XG4gICAgICBhcHBlbmRJbmxpbmVNYXJrZG93bihibG9ja3F1b3RlLCBxdW90ZVsxXSk7XG4gICAgICByb290LmFwcGVuZENoaWxkKGJsb2NrcXVvdGUpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcGFyYWdyYXBoLnB1c2godHJpbW1lZCk7XG4gIH1cblxuICBmbHVzaFBhcmFncmFwaCgpO1xuICBmbHVzaExpc3QoKTtcbiAgZmx1c2hDb2RlKCk7XG4gIHJldHVybiByb290O1xufVxuXG5mdW5jdGlvbiBhcHBlbmRJbmxpbmVNYXJrZG93bihwYXJlbnQ6IEhUTUxFbGVtZW50LCB0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgcGF0dGVybiA9IC8oYChbXmBdKylgfFxcWyhbXlxcXV0rKVxcXVxcKChodHRwcz86XFwvXFwvW15cXHMpXSspXFwpfFxcKlxcKihbXipdKylcXCpcXCp8XFwqKFteKl0rKVxcKikvZztcbiAgbGV0IGxhc3RJbmRleCA9IDA7XG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgdGV4dC5tYXRjaEFsbChwYXR0ZXJuKSkge1xuICAgIGlmIChtYXRjaC5pbmRleCA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcbiAgICBhcHBlbmRUZXh0KHBhcmVudCwgdGV4dC5zbGljZShsYXN0SW5kZXgsIG1hdGNoLmluZGV4KSk7XG4gICAgaWYgKG1hdGNoWzJdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY29kZVwiKTtcbiAgICAgIGNvZGUuY2xhc3NOYW1lID1cbiAgICAgICAgXCJyb3VuZGVkIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLWZvcmVncm91bmQvMTAgcHgtMSBweS0wLjUgdGV4dC14cyB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICAgICAgY29kZS50ZXh0Q29udGVudCA9IG1hdGNoWzJdO1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGNvZGUpO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hbM10gIT09IHVuZGVmaW5lZCAmJiBtYXRjaFs0XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG4gICAgICBhLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXByaW1hcnkgdW5kZXJsaW5lIHVuZGVybGluZS1vZmZzZXQtMlwiO1xuICAgICAgYS5ocmVmID0gbWF0Y2hbNF07XG4gICAgICBhLnRhcmdldCA9IFwiX2JsYW5rXCI7XG4gICAgICBhLnJlbCA9IFwibm9vcGVuZXIgbm9yZWZlcnJlclwiO1xuICAgICAgYS50ZXh0Q29udGVudCA9IG1hdGNoWzNdO1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGEpO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hbNV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3Qgc3Ryb25nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0cm9uZ1wiKTtcbiAgICAgIHN0cm9uZy5jbGFzc05hbWUgPSBcImZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gICAgICBzdHJvbmcudGV4dENvbnRlbnQgPSBtYXRjaFs1XTtcbiAgICAgIHBhcmVudC5hcHBlbmRDaGlsZChzdHJvbmcpO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hbNl0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZW1cIik7XG4gICAgICBlbS50ZXh0Q29udGVudCA9IG1hdGNoWzZdO1xuICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGVtKTtcbiAgICB9XG4gICAgbGFzdEluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG4gIH1cbiAgYXBwZW5kVGV4dChwYXJlbnQsIHRleHQuc2xpY2UobGFzdEluZGV4KSk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZFRleHQocGFyZW50OiBIVE1MRWxlbWVudCwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICh0ZXh0KSBwYXJlbnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCkpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJXYXRjaGVySGVhbHRoQ2FyZChjYXJkOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICB2b2lkIGlwY1JlbmRlcmVyXG4gICAgLmludm9rZShcImNvZGV4cHA6Z2V0LXdhdGNoZXItaGVhbHRoXCIpXG4gICAgLnRoZW4oKGhlYWx0aCkgPT4ge1xuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICByZW5kZXJXYXRjaGVySGVhbHRoKGNhcmQsIGhlYWx0aCBhcyBXYXRjaGVySGVhbHRoKTtcbiAgICB9KVxuICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICBjYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIkNvdWxkIG5vdCBjaGVjayB3YXRjaGVyXCIsIFN0cmluZyhlKSkpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiByZW5kZXJXYXRjaGVySGVhbHRoKGNhcmQ6IEhUTUxFbGVtZW50LCBoZWFsdGg6IFdhdGNoZXJIZWFsdGgpOiB2b2lkIHtcbiAgY2FyZC5hcHBlbmRDaGlsZCh3YXRjaGVyU3VtbWFyeVJvdyhoZWFsdGgpKTtcbiAgZm9yIChjb25zdCBjaGVjayBvZiBoZWFsdGguY2hlY2tzKSB7XG4gICAgaWYgKGNoZWNrLnN0YXR1cyA9PT0gXCJva1wiKSBjb250aW51ZTtcbiAgICBjYXJkLmFwcGVuZENoaWxkKHdhdGNoZXJDaGVja1JvdyhjaGVjaykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdhdGNoZXJTdW1tYXJ5Um93KGhlYWx0aDogV2F0Y2hlckhlYWx0aCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcm93LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00IHAtM1wiO1xuICBjb25zdCBsZWZ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbGVmdC5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBpdGVtcy1zdGFydCBnYXAtM1wiO1xuICBsZWZ0LmFwcGVuZENoaWxkKHN0YXR1c0JhZGdlKGhlYWx0aC5zdGF0dXMsIGhlYWx0aC53YXRjaGVyKSk7XG4gIGNvbnN0IHN0YWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc3RhY2suY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC1jb2wgZ2FwLTFcIjtcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZS5jbGFzc05hbWUgPSBcIm1pbi13LTAgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IGhlYWx0aC50aXRsZTtcbiAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGRlc2MuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5IG1pbi13LTAgdGV4dC1zbVwiO1xuICBkZXNjLnRleHRDb250ZW50ID0gYCR7aGVhbHRoLnN1bW1hcnl9IENoZWNrZWQgJHtuZXcgRGF0ZShoZWFsdGguY2hlY2tlZEF0KS50b0xvY2FsZVN0cmluZygpfS5gO1xuICBzdGFjay5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gIHN0YWNrLmFwcGVuZENoaWxkKGRlc2MpO1xuICBsZWZ0LmFwcGVuZENoaWxkKHN0YWNrKTtcbiAgcm93LmFwcGVuZENoaWxkKGxlZnQpO1xuXG4gIGNvbnN0IGFjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGFjdGlvbi5jbGFzc05hbWUgPSBcImZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIGFjdGlvbi5hcHBlbmRDaGlsZChcbiAgICBjb21wYWN0QnV0dG9uKFwiQ2hlY2sgTm93XCIsICgpID0+IHtcbiAgICAgIGNvbnN0IGNhcmQgPSByb3cucGFyZW50RWxlbWVudDtcbiAgICAgIGlmICghY2FyZCkgcmV0dXJuO1xuICAgICAgY2FyZC50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICBjYXJkLmFwcGVuZENoaWxkKHJvd1NpbXBsZShcIkNoZWNraW5nIHdhdGNoZXJcIiwgXCJWZXJpZnlpbmcgdGhlIHVwZGF0ZXIgcmVwYWlyIHNlcnZpY2UuXCIpKTtcbiAgICAgIHJlbmRlcldhdGNoZXJIZWFsdGhDYXJkKGNhcmQpO1xuICAgIH0pLFxuICApO1xuICByb3cuYXBwZW5kQ2hpbGQoYWN0aW9uKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gd2F0Y2hlckNoZWNrUm93KGNoZWNrOiBXYXRjaGVySGVhbHRoQ2hlY2spOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IHJvd1NpbXBsZShjaGVjay5uYW1lLCBjaGVjay5kZXRhaWwpO1xuICBjb25zdCBsZWZ0ID0gcm93LmZpcnN0RWxlbWVudENoaWxkIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGxlZnQpIGxlZnQucHJlcGVuZChzdGF0dXNCYWRnZShjaGVjay5zdGF0dXMpKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gc3RhdHVzQmFkZ2Uoc3RhdHVzOiBcIm9rXCIgfCBcIndhcm5cIiB8IFwiZXJyb3JcIiwgbGFiZWw/OiBzdHJpbmcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGNvbnN0IHRvbmUgPVxuICAgIHN0YXR1cyA9PT0gXCJva1wiXG4gICAgICA/IFwiYm9yZGVyLXRva2VuLWNoYXJ0cy1ncmVlbiB0ZXh0LXRva2VuLWNoYXJ0cy1ncmVlblwiXG4gICAgICA6IHN0YXR1cyA9PT0gXCJ3YXJuXCJcbiAgICAgICAgPyBcImJvcmRlci10b2tlbi1jaGFydHMteWVsbG93IHRleHQtdG9rZW4tY2hhcnRzLXllbGxvd1wiXG4gICAgICAgIDogXCJib3JkZXItdG9rZW4tY2hhcnRzLXJlZCB0ZXh0LXRva2VuLWNoYXJ0cy1yZWRcIjtcbiAgYmFkZ2UuY2xhc3NOYW1lID0gYGlubGluZS1mbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciByb3VuZGVkLWZ1bGwgYm9yZGVyIHB4LTIgcHktMC41IHRleHQteHMgZm9udC1tZWRpdW0gJHt0b25lfWA7XG4gIGJhZGdlLnRleHRDb250ZW50ID0gbGFiZWwgfHwgKHN0YXR1cyA9PT0gXCJva1wiID8gXCJPS1wiIDogc3RhdHVzID09PSBcIndhcm5cIiA/IFwiUmV2aWV3XCIgOiBcIkVycm9yXCIpO1xuICByZXR1cm4gYmFkZ2U7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVN1bW1hcnkoY2hlY2s6IENvZGV4UGx1c1BsdXNVcGRhdGVDaGVjayB8IG51bGwpOiBzdHJpbmcge1xuICBpZiAoIWNoZWNrKSByZXR1cm4gXCJObyB1cGRhdGUgY2hlY2sgaGFzIHJ1biB5ZXQuXCI7XG4gIGNvbnN0IGxhdGVzdCA9IGNoZWNrLmxhdGVzdFZlcnNpb24gPyBgTGF0ZXN0IHYke2NoZWNrLmxhdGVzdFZlcnNpb259LiBgIDogXCJcIjtcbiAgY29uc3QgY2hlY2tlZCA9IGBDaGVja2VkICR7bmV3IERhdGUoY2hlY2suY2hlY2tlZEF0KS50b0xvY2FsZVN0cmluZygpfS5gO1xuICBpZiAoY2hlY2suZXJyb3IpIHJldHVybiBgJHtsYXRlc3R9JHtjaGVja2VkfSAke2NoZWNrLmVycm9yfWA7XG4gIHJldHVybiBgJHtsYXRlc3R9JHtjaGVja2VkfWA7XG59XG5cbmZ1bmN0aW9uIHVuaW5zdGFsbFJvdygpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGFjdGlvblJvdyhcbiAgICBcIlVuaW5zdGFsbCBDb2RleCsrXCIsXG4gICAgXCJDb3BpZXMgdGhlIHVuaW5zdGFsbCBjb21tYW5kLiBSdW4gaXQgZnJvbSBhIHRlcm1pbmFsIGFmdGVyIHF1aXR0aW5nIENvZGV4LlwiLFxuICApO1xuICBjb25zdCBhY3Rpb24gPSByb3cucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCJbZGF0YS1jb2RleHBwLXJvdy1hY3Rpb25zXVwiKTtcbiAgYWN0aW9uPy5hcHBlbmRDaGlsZChcbiAgICBjb21wYWN0QnV0dG9uKFwiQ29weSBDb21tYW5kXCIsICgpID0+IHtcbiAgICAgIHZvaWQgaXBjUmVuZGVyZXJcbiAgICAgICAgLmludm9rZShcImNvZGV4cHA6Y29weS10ZXh0XCIsIFwibm9kZSB+Ly5jb2RleC1wbHVzcGx1cy9zb3VyY2UvcGFja2FnZXMvaW5zdGFsbGVyL2Rpc3QvY2xpLmpzIHVuaW5zdGFsbFwiKVxuICAgICAgICAuY2F0Y2goKGUpID0+IHBsb2coXCJjb3B5IHVuaW5zdGFsbCBjb21tYW5kIGZhaWxlZFwiLCBTdHJpbmcoZSkpKTtcbiAgICB9KSxcbiAgKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gcmVwb3J0QnVnUm93KCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gYWN0aW9uUm93KFxuICAgIFwiUmVwb3J0IGEgYnVnXCIsXG4gICAgXCJPcGVuIGEgR2l0SHViIGlzc3VlIHdpdGggcnVudGltZSwgaW5zdGFsbGVyLCBvciB0d2Vhay1tYW5hZ2VyIGRldGFpbHMuXCIsXG4gICk7XG4gIGNvbnN0IGFjdGlvbiA9IHJvdy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIltkYXRhLWNvZGV4cHAtcm93LWFjdGlvbnNdXCIpO1xuICBhY3Rpb24/LmFwcGVuZENoaWxkKFxuICAgIGNvbXBhY3RCdXR0b24oXCJPcGVuIElzc3VlXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRpdGxlID0gZW5jb2RlVVJJQ29tcG9uZW50KFwiW0J1Z106IFwiKTtcbiAgICAgIGNvbnN0IGJvZHkgPSBlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICAgIFtcbiAgICAgICAgICBcIiMjIFdoYXQgaGFwcGVuZWQ/XCIsXG4gICAgICAgICAgXCJcIixcbiAgICAgICAgICBcIiMjIFN0ZXBzIHRvIHJlcHJvZHVjZVwiLFxuICAgICAgICAgIFwiMS4gXCIsXG4gICAgICAgICAgXCJcIixcbiAgICAgICAgICBcIiMjIEVudmlyb25tZW50XCIsXG4gICAgICAgICAgXCItIENvZGV4KysgdmVyc2lvbjogXCIsXG4gICAgICAgICAgXCItIENvZGV4IGFwcCB2ZXJzaW9uOiBcIixcbiAgICAgICAgICBcIi0gT1M6IFwiLFxuICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgXCIjIyBMb2dzXCIsXG4gICAgICAgICAgXCJBdHRhY2ggcmVsZXZhbnQgbGluZXMgZnJvbSB0aGUgQ29kZXgrKyBsb2cgZGlyZWN0b3J5LlwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIiksXG4gICAgICApO1xuICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXG4gICAgICAgIFwiY29kZXhwcDpvcGVuLWV4dGVybmFsXCIsXG4gICAgICAgIGBodHRwczovL2dpdGh1Yi5jb20vYi1ubmV0dC9jb2RleC1wbHVzcGx1cy9pc3N1ZXMvbmV3P3RpdGxlPSR7dGl0bGV9JmJvZHk9JHtib2R5fWAsXG4gICAgICApO1xuICAgIH0pLFxuICApO1xuICByZXR1cm4gcm93O1xufVxuXG5mdW5jdGlvbiBhY3Rpb25Sb3codGl0bGVUZXh0OiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJvdy5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNCBwLTNcIjtcbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC1jb2wgZ2FwLTFcIjtcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0aXRsZS5jbGFzc05hbWUgPSBcIm1pbi13LTAgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICB0aXRsZS50ZXh0Q29udGVudCA9IHRpdGxlVGV4dDtcbiAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGRlc2MuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5IG1pbi13LTAgdGV4dC1zbVwiO1xuICBkZXNjLnRleHRDb250ZW50ID0gZGVzY3JpcHRpb247XG4gIGxlZnQuYXBwZW5kQ2hpbGQodGl0bGUpO1xuICBsZWZ0LmFwcGVuZENoaWxkKGRlc2MpO1xuICByb3cuYXBwZW5kQ2hpbGQobGVmdCk7XG4gIGNvbnN0IGFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBhY3Rpb25zLmRhdGFzZXQuY29kZXhwcFJvd0FjdGlvbnMgPSBcInRydWVcIjtcbiAgYWN0aW9ucy5jbGFzc05hbWUgPSBcImZsZXggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGdhcC0yXCI7XG4gIHJvdy5hcHBlbmRDaGlsZChhY3Rpb25zKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZnVuY3Rpb24gcmVuZGVyVHdlYWtzUGFnZShzZWN0aW9uc1dyYXA6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IG9wZW5CdG4gPSBvcGVuSW5QbGFjZUJ1dHRvbihcIk9wZW4gVHdlYWtzIEZvbGRlclwiLCAoKSA9PiB7XG4gICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCB0d2Vha3NQYXRoKCkpO1xuICB9KTtcbiAgY29uc3QgcmVsb2FkQnRuID0gb3BlbkluUGxhY2VCdXR0b24oXCJGb3JjZSBSZWxvYWRcIiwgKCkgPT4ge1xuICAgIC8vIEZ1bGwgcGFnZSByZWZyZXNoIFx1MjAxNCBzYW1lIGFzIERldlRvb2xzIENtZC1SIC8gb3VyIENEUCBQYWdlLnJlbG9hZC5cbiAgICAvLyBNYWluIHJlLWRpc2NvdmVycyB0d2Vha3MgZmlyc3Qgc28gdGhlIG5ldyByZW5kZXJlciBjb21lcyB1cCB3aXRoIGFcbiAgICAvLyBmcmVzaCB0d2VhayBzZXQ7IHRoZW4gbG9jYXRpb24ucmVsb2FkIHJlc3RhcnRzIHRoZSByZW5kZXJlciBzbyB0aGVcbiAgICAvLyBwcmVsb2FkIHJlLWluaXRpYWxpemVzIGFnYWluc3QgaXQuXG4gICAgdm9pZCBpcGNSZW5kZXJlclxuICAgICAgLmludm9rZShcImNvZGV4cHA6cmVsb2FkLXR3ZWFrc1wiKVxuICAgICAgLmNhdGNoKChlKSA9PiBwbG9nKFwiZm9yY2UgcmVsb2FkIChtYWluKSBmYWlsZWRcIiwgU3RyaW5nKGUpKSlcbiAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICB9KTtcbiAgfSk7XG4gIC8vIERyb3AgdGhlIGRpYWdvbmFsLWFycm93IGljb24gZnJvbSB0aGUgcmVsb2FkIGJ1dHRvbiBcdTIwMTQgaXQgaW1wbGllcyBcIm9wZW5cbiAgLy8gb3V0IG9mIGFwcFwiIHdoaWNoIGRvZXNuJ3QgZml0LiBSZXBsYWNlIGl0cyB0cmFpbGluZyBzdmcgd2l0aCBhIHJlZnJlc2guXG4gIGNvbnN0IHJlbG9hZFN2ZyA9IHJlbG9hZEJ0bi5xdWVyeVNlbGVjdG9yKFwic3ZnXCIpO1xuICBpZiAocmVsb2FkU3ZnKSB7XG4gICAgcmVsb2FkU3ZnLm91dGVySFRNTCA9XG4gICAgICBgPHN2ZyB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgY2xhc3M9XCJpY29uLTJ4c1wiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPmAgK1xuICAgICAgYDxwYXRoIGQ9XCJNNCAxMGE2IDYgMCAwIDEgMTAuMjQtNC4yNEwxNiA3LjVNMTYgNHYzLjVoLTMuNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICAgIGA8cGF0aCBkPVwiTTE2IDEwYTYgNiAwIDAgMS0xMC4yNCA0LjI0TDQgMTIuNU00IDE2di0zLjVoMy41XCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPmAgK1xuICAgICAgYDwvc3ZnPmA7XG4gIH1cblxuICBjb25zdCB0cmFpbGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRyYWlsaW5nLmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgdHJhaWxpbmcuYXBwZW5kQ2hpbGQocmVsb2FkQnRuKTtcbiAgdHJhaWxpbmcuYXBwZW5kQ2hpbGQob3BlbkJ0bik7XG5cbiAgaWYgKHN0YXRlLmxpc3RlZFR3ZWFrcy5sZW5ndGggPT09IDApIHtcbiAgICBjb25zdCBzZWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIik7XG4gICAgc2VjdGlvbi5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2wgZ2FwLTJcIjtcbiAgICBzZWN0aW9uLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkluc3RhbGxlZCBUd2Vha3NcIiwgdHJhaWxpbmcpKTtcbiAgICBjb25zdCBjYXJkID0gcm91bmRlZENhcmQoKTtcbiAgICBjYXJkLmFwcGVuZENoaWxkKFxuICAgICAgcm93U2ltcGxlKFxuICAgICAgICBcIk5vIHR3ZWFrcyBpbnN0YWxsZWRcIixcbiAgICAgICAgYERyb3AgYSB0d2VhayBmb2xkZXIgaW50byAke3R3ZWFrc1BhdGgoKX0gYW5kIHJlbG9hZC5gLFxuICAgICAgKSxcbiAgICApO1xuICAgIHNlY3Rpb24uYXBwZW5kQ2hpbGQoY2FyZCk7XG4gICAgc2VjdGlvbnNXcmFwLmFwcGVuZENoaWxkKHNlY3Rpb24pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEdyb3VwIHJlZ2lzdGVyZWQgU2V0dGluZ3NTZWN0aW9ucyBieSB0d2VhayBpZCAocHJlZml4IHNwbGl0IGF0IFwiOlwiKS5cbiAgY29uc3Qgc2VjdGlvbnNCeVR3ZWFrID0gbmV3IE1hcDxzdHJpbmcsIFNldHRpbmdzU2VjdGlvbltdPigpO1xuICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGUuc2VjdGlvbnMudmFsdWVzKCkpIHtcbiAgICBjb25zdCB0d2Vha0lkID0gcy5pZC5zcGxpdChcIjpcIilbMF07XG4gICAgaWYgKCFzZWN0aW9uc0J5VHdlYWsuaGFzKHR3ZWFrSWQpKSBzZWN0aW9uc0J5VHdlYWsuc2V0KHR3ZWFrSWQsIFtdKTtcbiAgICBzZWN0aW9uc0J5VHdlYWsuZ2V0KHR3ZWFrSWQpIS5wdXNoKHMpO1xuICB9XG5cbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzZWN0aW9uXCIpO1xuICB3cmFwLmNsYXNzTmFtZSA9IFwiZmxleCBmbGV4LWNvbCBnYXAtMlwiO1xuICB3cmFwLmFwcGVuZENoaWxkKHNlY3Rpb25UaXRsZShcIkluc3RhbGxlZCBUd2Vha3NcIiwgdHJhaWxpbmcpKTtcblxuICBjb25zdCBjYXJkID0gcm91bmRlZENhcmQoKTtcbiAgZm9yIChjb25zdCB0IG9mIHN0YXRlLmxpc3RlZFR3ZWFrcykge1xuICAgIGNhcmQuYXBwZW5kQ2hpbGQodHdlYWtSb3codCwgc2VjdGlvbnNCeVR3ZWFrLmdldCh0Lm1hbmlmZXN0LmlkKSA/PyBbXSkpO1xuICB9XG4gIHdyYXAuYXBwZW5kQ2hpbGQoY2FyZCk7XG4gIHNlY3Rpb25zV3JhcC5hcHBlbmRDaGlsZCh3cmFwKTtcbn1cblxuZnVuY3Rpb24gdHdlYWtSb3codDogTGlzdGVkVHdlYWssIHNlY3Rpb25zOiBTZXR0aW5nc1NlY3Rpb25bXSk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgbSA9IHQubWFuaWZlc3Q7XG5cbiAgLy8gT3V0ZXIgY2VsbCB3cmFwcyB0aGUgaGVhZGVyIHJvdyArIChvcHRpb25hbCkgbmVzdGVkIHNlY3Rpb25zIHNvIHRoZVxuICAvLyBwYXJlbnQgY2FyZCdzIGRpdmlkZXIgc3RheXMgYmV0d2VlbiAqdHdlYWtzKiwgbm90IGJldHdlZW4gaGVhZGVyIGFuZFxuICAvLyBib2R5IG9mIHRoZSBzYW1lIHR3ZWFrLlxuICBjb25zdCBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgY2VsbC5jbGFzc05hbWUgPSBcImZsZXggZmxleC1jb2xcIjtcbiAgaWYgKCF0LmVuYWJsZWQpIGNlbGwuc3R5bGUub3BhY2l0eSA9IFwiMC43XCI7XG5cbiAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyLmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgcC0zXCI7XG5cbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC0xIGl0ZW1zLXN0YXJ0IGdhcC0zXCI7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEF2YXRhciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgYXZhdGFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgYXZhdGFyLmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIG92ZXJmbG93LWhpZGRlbiB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gIGF2YXRhci5zdHlsZS53aWR0aCA9IFwiNTZweFwiO1xuICBhdmF0YXIuc3R5bGUuaGVpZ2h0ID0gXCI1NnB4XCI7XG4gIGF2YXRhci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcInZhcigtLWNvbG9yLXRva2VuLWJnLWZvZywgdHJhbnNwYXJlbnQpXCI7XG4gIGlmIChtLmljb25VcmwpIHtcbiAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xuICAgIGltZy5hbHQgPSBcIlwiO1xuICAgIGltZy5jbGFzc05hbWUgPSBcInNpemUtZnVsbCBvYmplY3QtY29udGFpblwiO1xuICAgIC8vIEluaXRpYWw6IHNob3cgZmFsbGJhY2sgaW5pdGlhbCBpbiBjYXNlIHRoZSBpY29uIGZhaWxzIHRvIGxvYWQuXG4gICAgY29uc3QgaW5pdGlhbCA9IChtLm5hbWU/LlswXSA/PyBcIj9cIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBmYWxsYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgIGZhbGxiYWNrLmNsYXNzTmFtZSA9IFwidGV4dC14bCBmb250LW1lZGl1bVwiO1xuICAgIGZhbGxiYWNrLnRleHRDb250ZW50ID0gaW5pdGlhbDtcbiAgICBhdmF0YXIuYXBwZW5kQ2hpbGQoZmFsbGJhY2spO1xuICAgIGltZy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsICgpID0+IHtcbiAgICAgIGZhbGxiYWNrLnJlbW92ZSgpO1xuICAgICAgaW1nLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIH0pO1xuICAgIGltZy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgaW1nLnJlbW92ZSgpO1xuICAgIH0pO1xuICAgIHZvaWQgcmVzb2x2ZUljb25VcmwobS5pY29uVXJsLCB0LmRpcikudGhlbigodXJsKSA9PiB7XG4gICAgICBpZiAodXJsKSBpbWcuc3JjID0gdXJsO1xuICAgICAgZWxzZSBpbWcucmVtb3ZlKCk7XG4gICAgfSk7XG4gICAgYXZhdGFyLmFwcGVuZENoaWxkKGltZyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgaW5pdGlhbCA9IChtLm5hbWU/LlswXSA/PyBcIj9cIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgc3Bhbi5jbGFzc05hbWUgPSBcInRleHQteGwgZm9udC1tZWRpdW1cIjtcbiAgICBzcGFuLnRleHRDb250ZW50ID0gaW5pdGlhbDtcbiAgICBhdmF0YXIuYXBwZW5kQ2hpbGQoc3Bhbik7XG4gIH1cbiAgbGVmdC5hcHBlbmRDaGlsZChhdmF0YXIpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBUZXh0IHN0YWNrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBzdGFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHN0YWNrLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtY29sIGdhcC0wLjVcIjtcblxuICBjb25zdCB0aXRsZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlUm93LmNsYXNzTmFtZSA9IFwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIjtcbiAgY29uc3QgbmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIG5hbWUuY2xhc3NOYW1lID0gXCJtaW4tdy0wIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgbmFtZS50ZXh0Q29udGVudCA9IG0ubmFtZTtcbiAgdGl0bGVSb3cuYXBwZW5kQ2hpbGQobmFtZSk7XG4gIGlmIChtLnZlcnNpb24pIHtcbiAgICBjb25zdCB2ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICB2ZXIuY2xhc3NOYW1lID1cbiAgICAgIFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSB0ZXh0LXhzIGZvbnQtbm9ybWFsIHRhYnVsYXItbnVtc1wiO1xuICAgIHZlci50ZXh0Q29udGVudCA9IGB2JHttLnZlcnNpb259YDtcbiAgICB0aXRsZVJvdy5hcHBlbmRDaGlsZCh2ZXIpO1xuICB9XG4gIGlmICh0LnVwZGF0ZT8udXBkYXRlQXZhaWxhYmxlKSB7XG4gICAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICBiYWRnZS5jbGFzc05hbWUgPVxuICAgICAgXCJyb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci10b2tlbi1ib3JkZXIgYmctdG9rZW4tZm9yZWdyb3VuZC81IHB4LTIgcHktMC41IHRleHQtWzExcHhdIGZvbnQtbWVkaXVtIHRleHQtdG9rZW4tdGV4dC1wcmltYXJ5XCI7XG4gICAgYmFkZ2UudGV4dENvbnRlbnQgPSBcIlVwZGF0ZSBBdmFpbGFibGVcIjtcbiAgICB0aXRsZVJvdy5hcHBlbmRDaGlsZChiYWRnZSk7XG4gIH1cbiAgc3RhY2suYXBwZW5kQ2hpbGQodGl0bGVSb3cpO1xuXG4gIGlmIChtLmRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgZGVzYy5jbGFzc05hbWUgPSBcInRleHQtdG9rZW4tdGV4dC1zZWNvbmRhcnkgbWluLXctMCB0ZXh0LXNtXCI7XG4gICAgZGVzYy50ZXh0Q29udGVudCA9IG0uZGVzY3JpcHRpb247XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQoZGVzYyk7XG4gIH1cblxuICBjb25zdCBtZXRhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgbWV0YS5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQteHMgdGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeVwiO1xuICBjb25zdCBhdXRob3JFbCA9IHJlbmRlckF1dGhvcihtLmF1dGhvcik7XG4gIGlmIChhdXRob3JFbCkgbWV0YS5hcHBlbmRDaGlsZChhdXRob3JFbCk7XG4gIGlmIChtLmdpdGh1YlJlcG8pIHtcbiAgICBpZiAobWV0YS5jaGlsZHJlbi5sZW5ndGggPiAwKSBtZXRhLmFwcGVuZENoaWxkKGRvdCgpKTtcbiAgICBjb25zdCByZXBvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICByZXBvLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgIHJlcG8uY2xhc3NOYW1lID0gXCJpbmxpbmUtZmxleCB0ZXh0LXRva2VuLXRleHQtbGluay1mb3JlZ3JvdW5kIGhvdmVyOnVuZGVybGluZVwiO1xuICAgIHJlcG8udGV4dENvbnRlbnQgPSBtLmdpdGh1YlJlcG87XG4gICAgcmVwby5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB2b2lkIGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6b3Blbi1leHRlcm5hbFwiLCBgaHR0cHM6Ly9naXRodWIuY29tLyR7bS5naXRodWJSZXBvfWApO1xuICAgIH0pO1xuICAgIG1ldGEuYXBwZW5kQ2hpbGQocmVwbyk7XG4gIH1cbiAgaWYgKG0uaG9tZXBhZ2UpIHtcbiAgICBpZiAobWV0YS5jaGlsZHJlbi5sZW5ndGggPiAwKSBtZXRhLmFwcGVuZENoaWxkKGRvdCgpKTtcbiAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG4gICAgbGluay5ocmVmID0gbS5ob21lcGFnZTtcbiAgICBsaW5rLnRhcmdldCA9IFwiX2JsYW5rXCI7XG4gICAgbGluay5yZWwgPSBcIm5vcmVmZXJyZXJcIjtcbiAgICBsaW5rLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggdGV4dC10b2tlbi10ZXh0LWxpbmstZm9yZWdyb3VuZCBob3Zlcjp1bmRlcmxpbmVcIjtcbiAgICBsaW5rLnRleHRDb250ZW50ID0gXCJIb21lcGFnZVwiO1xuICAgIG1ldGEuYXBwZW5kQ2hpbGQobGluayk7XG4gIH1cbiAgaWYgKG1ldGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkgc3RhY2suYXBwZW5kQ2hpbGQobWV0YSk7XG5cbiAgLy8gVGFncyByb3cgKGlmIGFueSkgXHUyMDE0IHNtYWxsIHBpbGwgY2hpcHMgYmVsb3cgdGhlIG1ldGEgbGluZS5cbiAgaWYgKG0udGFncyAmJiBtLnRhZ3MubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHRhZ3NSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRhZ3NSb3cuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtd3JhcCBpdGVtcy1jZW50ZXIgZ2FwLTEgcHQtMC41XCI7XG4gICAgZm9yIChjb25zdCB0YWcgb2YgbS50YWdzKSB7XG4gICAgICBjb25zdCBwaWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgICBwaWxsLmNsYXNzTmFtZSA9XG4gICAgICAgIFwicm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItdG9rZW4tYm9yZGVyIGJnLXRva2VuLWZvcmVncm91bmQvNSBweC0yIHB5LTAuNSB0ZXh0LVsxMXB4XSB0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5XCI7XG4gICAgICBwaWxsLnRleHRDb250ZW50ID0gdGFnO1xuICAgICAgdGFnc1Jvdy5hcHBlbmRDaGlsZChwaWxsKTtcbiAgICB9XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQodGFnc1Jvdyk7XG4gIH1cblxuICBsZWZ0LmFwcGVuZENoaWxkKHN0YWNrKTtcbiAgaGVhZGVyLmFwcGVuZENoaWxkKGxlZnQpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBUb2dnbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHJpZ2h0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgcmlnaHQuY2xhc3NOYW1lID0gXCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMiBwdC0wLjVcIjtcbiAgaWYgKHQudXBkYXRlPy51cGRhdGVBdmFpbGFibGUgJiYgdC51cGRhdGUucmVsZWFzZVVybCkge1xuICAgIHJpZ2h0LmFwcGVuZENoaWxkKFxuICAgICAgY29tcGFjdEJ1dHRvbihcIlJldmlldyBSZWxlYXNlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOm9wZW4tZXh0ZXJuYWxcIiwgdC51cGRhdGUhLnJlbGVhc2VVcmwpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuICByaWdodC5hcHBlbmRDaGlsZChcbiAgICBzd2l0Y2hDb250cm9sKHQuZW5hYmxlZCwgYXN5bmMgKG5leHQpID0+IHtcbiAgICAgIGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6c2V0LXR3ZWFrLWVuYWJsZWRcIiwgbS5pZCwgbmV4dCk7XG4gICAgICAvLyBUaGUgbWFpbiBwcm9jZXNzIGJyb2FkY2FzdHMgYSByZWxvYWQgd2hpY2ggd2lsbCByZS1mZXRjaCB0aGUgbGlzdFxuICAgICAgLy8gYW5kIHJlLXJlbmRlci4gV2UgZG9uJ3Qgb3B0aW1pc3RpY2FsbHkgdG9nZ2xlIHRvIGF2b2lkIGRyaWZ0LlxuICAgIH0pLFxuICApO1xuICBoZWFkZXIuYXBwZW5kQ2hpbGQocmlnaHQpO1xuXG4gIGNlbGwuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblxuICAvLyBJZiB0aGUgdHdlYWsgaXMgZW5hYmxlZCBhbmQgcmVnaXN0ZXJlZCBzZXR0aW5ncyBzZWN0aW9ucywgcmVuZGVyIHRob3NlXG4gIC8vIGJvZGllcyBhcyBuZXN0ZWQgcm93cyBiZW5lYXRoIHRoZSBoZWFkZXIgaW5zaWRlIHRoZSBzYW1lIGNlbGwuXG4gIGlmICh0LmVuYWJsZWQgJiYgc2VjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IG5lc3RlZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgbmVzdGVkLmNsYXNzTmFtZSA9XG4gICAgICBcImZsZXggZmxleC1jb2wgZGl2aWRlLXktWzAuNXB4XSBkaXZpZGUtdG9rZW4tYm9yZGVyIGJvcmRlci10LVswLjVweF0gYm9yZGVyLXRva2VuLWJvcmRlclwiO1xuICAgIGZvciAoY29uc3QgcyBvZiBzZWN0aW9ucykge1xuICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBib2R5LmNsYXNzTmFtZSA9IFwicC0zXCI7XG4gICAgICB0cnkge1xuICAgICAgICBzLnJlbmRlcihib2R5KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgYm9keS50ZXh0Q29udGVudCA9IGBFcnJvciByZW5kZXJpbmcgdHdlYWsgc2VjdGlvbjogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gO1xuICAgICAgfVxuICAgICAgbmVzdGVkLmFwcGVuZENoaWxkKGJvZHkpO1xuICAgIH1cbiAgICBjZWxsLmFwcGVuZENoaWxkKG5lc3RlZCk7XG4gIH1cblxuICByZXR1cm4gY2VsbDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQXV0aG9yKGF1dGhvcjogVHdlYWtNYW5pZmVzdFtcImF1dGhvclwiXSk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGlmICghYXV0aG9yKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICB3cmFwLmNsYXNzTmFtZSA9IFwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI7XG4gIGlmICh0eXBlb2YgYXV0aG9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgd3JhcC50ZXh0Q29udGVudCA9IGBieSAke2F1dGhvcn1gO1xuICAgIHJldHVybiB3cmFwO1xuICB9XG4gIHdyYXAuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJieSBcIikpO1xuICBpZiAoYXV0aG9yLnVybCkge1xuICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcbiAgICBhLmhyZWYgPSBhdXRob3IudXJsO1xuICAgIGEudGFyZ2V0ID0gXCJfYmxhbmtcIjtcbiAgICBhLnJlbCA9IFwibm9yZWZlcnJlclwiO1xuICAgIGEuY2xhc3NOYW1lID0gXCJpbmxpbmUtZmxleCB0ZXh0LXRva2VuLXRleHQtbGluay1mb3JlZ3JvdW5kIGhvdmVyOnVuZGVybGluZVwiO1xuICAgIGEudGV4dENvbnRlbnQgPSBhdXRob3IubmFtZTtcbiAgICB3cmFwLmFwcGVuZENoaWxkKGEpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICBzcGFuLnRleHRDb250ZW50ID0gYXV0aG9yLm5hbWU7XG4gICAgd3JhcC5hcHBlbmRDaGlsZChzcGFuKTtcbiAgfVxuICByZXR1cm4gd3JhcDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwIGNvbXBvbmVudHMgXHUyNTAwXHUyNTAwXG5cbi8qKiBUaGUgZnVsbCBwYW5lbCBzaGVsbCAodG9vbGJhciArIHNjcm9sbCArIGhlYWRpbmcgKyBzZWN0aW9ucyB3cmFwKS4gKi9cbmZ1bmN0aW9uIHBhbmVsU2hlbGwoXG4gIHRpdGxlOiBzdHJpbmcsXG4gIHN1YnRpdGxlPzogc3RyaW5nLFxuKTogeyBvdXRlcjogSFRNTEVsZW1lbnQ7IHNlY3Rpb25zV3JhcDogSFRNTEVsZW1lbnQgfSB7XG4gIGNvbnN0IG91dGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgb3V0ZXIuY2xhc3NOYW1lID0gXCJtYWluLXN1cmZhY2UgZmxleCBoLWZ1bGwgbWluLWgtMCBmbGV4LWNvbFwiO1xuXG4gIGNvbnN0IHRvb2xiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICB0b29sYmFyLmNsYXNzTmFtZSA9XG4gICAgXCJkcmFnZ2FibGUgZmxleCBpdGVtcy1jZW50ZXIgcHgtcGFuZWwgZWxlY3Ryb246aC10b29sYmFyIGV4dGVuc2lvbjpoLXRvb2xiYXItc21cIjtcbiAgb3V0ZXIuYXBwZW5kQ2hpbGQodG9vbGJhcik7XG5cbiAgY29uc3Qgc2Nyb2xsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc2Nyb2xsLmNsYXNzTmFtZSA9IFwiZmxleC0xIG92ZXJmbG93LXktYXV0byBwLXBhbmVsXCI7XG4gIG91dGVyLmFwcGVuZENoaWxkKHNjcm9sbCk7XG5cbiAgY29uc3QgaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBpbm5lci5jbGFzc05hbWUgPVxuICAgIFwibXgtYXV0byBmbGV4IHctZnVsbCBmbGV4LWNvbCBtYXgtdy0yeGwgZWxlY3Ryb246bWluLXctW2NhbGMoMzIwcHgqdmFyKC0tY29kZXgtd2luZG93LXpvb20pKV1cIjtcbiAgc2Nyb2xsLmFwcGVuZENoaWxkKGlubmVyKTtcblxuICBjb25zdCBoZWFkZXJXcmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaGVhZGVyV3JhcC5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMyBwYi1wYW5lbFwiO1xuICBjb25zdCBoZWFkZXJJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGhlYWRlcklubmVyLmNsYXNzTmFtZSA9IFwiZmxleCBtaW4tdy0wIGZsZXgtMSBmbGV4LWNvbCBnYXAtMS41IHBiLXBhbmVsXCI7XG4gIGNvbnN0IGhlYWRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBoZWFkaW5nLmNsYXNzTmFtZSA9IFwiZWxlY3Ryb246aGVhZGluZy1sZyBoZWFkaW5nLWJhc2UgdHJ1bmNhdGVcIjtcbiAgaGVhZGluZy50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBoZWFkZXJJbm5lci5hcHBlbmRDaGlsZChoZWFkaW5nKTtcbiAgaWYgKHN1YnRpdGxlKSB7XG4gICAgY29uc3Qgc3ViID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBzdWIuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLXRleHQtc2Vjb25kYXJ5IHRleHQtc21cIjtcbiAgICBzdWIudGV4dENvbnRlbnQgPSBzdWJ0aXRsZTtcbiAgICBoZWFkZXJJbm5lci5hcHBlbmRDaGlsZChzdWIpO1xuICB9XG4gIGhlYWRlcldyYXAuYXBwZW5kQ2hpbGQoaGVhZGVySW5uZXIpO1xuICBpbm5lci5hcHBlbmRDaGlsZChoZWFkZXJXcmFwKTtcblxuICBjb25zdCBzZWN0aW9uc1dyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBzZWN0aW9uc1dyYXAuY2xhc3NOYW1lID0gXCJmbGV4IGZsZXgtY29sIGdhcC1bdmFyKC0tcGFkZGluZy1wYW5lbCldXCI7XG4gIGlubmVyLmFwcGVuZENoaWxkKHNlY3Rpb25zV3JhcCk7XG5cbiAgcmV0dXJuIHsgb3V0ZXIsIHNlY3Rpb25zV3JhcCB9O1xufVxuXG5mdW5jdGlvbiBzZWN0aW9uVGl0bGUodGV4dDogc3RyaW5nLCB0cmFpbGluZz86IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuICBjb25zdCB0aXRsZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHRpdGxlUm93LmNsYXNzTmFtZSA9XG4gICAgXCJmbGV4IGgtdG9vbGJhciBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC0yIHB4LTAgcHktMFwiO1xuICBjb25zdCB0aXRsZUlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgdGl0bGVJbm5lci5jbGFzc05hbWUgPSBcImZsZXggbWluLXctMCBmbGV4LTEgZmxleC1jb2wgZ2FwLTFcIjtcbiAgY29uc3QgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHQuY2xhc3NOYW1lID0gXCJ0ZXh0LWJhc2UgZm9udC1tZWRpdW0gdGV4dC10b2tlbi10ZXh0LXByaW1hcnlcIjtcbiAgdC50ZXh0Q29udGVudCA9IHRleHQ7XG4gIHRpdGxlSW5uZXIuYXBwZW5kQ2hpbGQodCk7XG4gIHRpdGxlUm93LmFwcGVuZENoaWxkKHRpdGxlSW5uZXIpO1xuICBpZiAodHJhaWxpbmcpIHtcbiAgICBjb25zdCByaWdodCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgcmlnaHQuY2xhc3NOYW1lID0gXCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiO1xuICAgIHJpZ2h0LmFwcGVuZENoaWxkKHRyYWlsaW5nKTtcbiAgICB0aXRsZVJvdy5hcHBlbmRDaGlsZChyaWdodCk7XG4gIH1cbiAgcmV0dXJuIHRpdGxlUm93O1xufVxuXG4vKipcbiAqIENvZGV4J3MgXCJPcGVuIGNvbmZpZy50b21sXCItc3R5bGUgdHJhaWxpbmcgYnV0dG9uOiBnaG9zdCBib3JkZXIsIG11dGVkXG4gKiBsYWJlbCwgdG9wLXJpZ2h0IGRpYWdvbmFsIGFycm93IGljb24uIE1hcmt1cCBtaXJyb3JzIENvbmZpZ3VyYXRpb24gcGFuZWwuXG4gKi9cbmZ1bmN0aW9uIG9wZW5JblBsYWNlQnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gIGJ0bi50eXBlID0gXCJidXR0b25cIjtcbiAgYnRuLmNsYXNzTmFtZSA9XG4gICAgXCJib3JkZXItdG9rZW4tYm9yZGVyIHVzZXItc2VsZWN0LW5vbmUgbm8tZHJhZyBjdXJzb3ItaW50ZXJhY3Rpb24gZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgYm9yZGVyIHdoaXRlc3BhY2Utbm93cmFwIGZvY3VzOm91dGxpbmUtbm9uZSBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS00MCByb3VuZGVkLWxnIHRleHQtdG9rZW4tZGVzY3JpcHRpb24tZm9yZWdyb3VuZCBlbmFibGVkOmhvdmVyOmJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZCBkYXRhLVtzdGF0ZT1vcGVuXTpiZy10b2tlbi1saXN0LWhvdmVyLWJhY2tncm91bmQgYm9yZGVyLXRyYW5zcGFyZW50IGgtdG9rZW4tYnV0dG9uLWNvbXBvc2VyIHB4LTIgcHktMCB0ZXh0LWJhc2UgbGVhZGluZy1bMThweF1cIjtcbiAgYnRuLmlubmVySFRNTCA9XG4gICAgYCR7bGFiZWx9YCArXG4gICAgYDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGNsYXNzPVwiaWNvbi0yeHNcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5gICtcbiAgICBgPHBhdGggZD1cIk0xNC4zMzQ5IDEzLjMzMDFWNi42MDY0NUw1LjQ3MDY1IDE1LjQ3MDdDNS4yMTA5NSAxNS43MzA0IDQuNzg4OTUgMTUuNzMwNCA0LjUyOTI1IDE1LjQ3MDdDNC4yNjk1NSAxNS4yMTEgNC4yNjk1NSAxNC43ODkgNC41MjkyNSAxNC41MjkzTDEzLjM5MzUgNS42NjUwNEg2LjY2MDExQzYuMjkyODQgNS42NjUwNCA1Ljk5NTA3IDUuMzY3MjcgNS45OTUwNyA1QzUuOTk1MDcgNC42MzI3MyA2LjI5Mjg0IDQuMzM0OTYgNi42NjAxMSA0LjMzNDk2SDE0Ljk5OTlMMTUuMTMzNyA0LjM0ODYzQzE1LjQzNjkgNC40MTA1NyAxNS42NjUgNC42Nzg1NyAxNS42NjUgNVYxMy4zMzAxQzE1LjY2NDkgMTMuNjk3MyAxNS4zNjcyIDEzLjk5NTEgMTQuOTk5OSAxMy45OTUxQzE0LjYzMjcgMTMuOTk1MSAxNC4zMzUgMTMuNjk3MyAxNC4zMzQ5IDEzLjMzMDFaXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiPjwvcGF0aD5gICtcbiAgICBgPC9zdmc+YDtcbiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIG9uQ2xpY2soKTtcbiAgfSk7XG4gIHJldHVybiBidG47XG59XG5cbmZ1bmN0aW9uIGNvbXBhY3RCdXR0b24obGFiZWw6IHN0cmluZywgb25DbGljazogKCkgPT4gdm9pZCk6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgYnRuLnR5cGUgPSBcImJ1dHRvblwiO1xuICBidG4uY2xhc3NOYW1lID1cbiAgICBcImJvcmRlci10b2tlbi1ib3JkZXIgdXNlci1zZWxlY3Qtbm9uZSBuby1kcmFnIGN1cnNvci1pbnRlcmFjdGlvbiBpbmxpbmUtZmxleCBoLTggaXRlbXMtY2VudGVyIHdoaXRlc3BhY2Utbm93cmFwIHJvdW5kZWQtbGcgYm9yZGVyIHB4LTIgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeSBlbmFibGVkOmhvdmVyOmJnLXRva2VuLWxpc3QtaG92ZXItYmFja2dyb3VuZCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS00MFwiO1xuICBidG4udGV4dENvbnRlbnQgPSBsYWJlbDtcbiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIG9uQ2xpY2soKTtcbiAgfSk7XG4gIHJldHVybiBidG47XG59XG5cbmZ1bmN0aW9uIHJvdW5kZWRDYXJkKCk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGNhcmQuY2xhc3NOYW1lID1cbiAgICBcImJvcmRlci10b2tlbi1ib3JkZXIgZmxleCBmbGV4LWNvbCBkaXZpZGUteS1bMC41cHhdIGRpdmlkZS10b2tlbi1ib3JkZXIgcm91bmRlZC1sZyBib3JkZXJcIjtcbiAgY2FyZC5zZXRBdHRyaWJ1dGUoXG4gICAgXCJzdHlsZVwiLFxuICAgIFwiYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY29sb3ItYmFja2dyb3VuZC1wYW5lbCwgdmFyKC0tY29sb3ItdG9rZW4tYmctZm9nKSk7XCIsXG4gICk7XG4gIHJldHVybiBjYXJkO1xufVxuXG5mdW5jdGlvbiByb3dTaW1wbGUodGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGVzY3JpcHRpb24/OiBzdHJpbmcpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIHJvdy5jbGFzc05hbWUgPSBcImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNCBwLTNcIjtcbiAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGxlZnQuY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgaXRlbXMtY2VudGVyIGdhcC0zXCI7XG4gIGNvbnN0IHN0YWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgc3RhY2suY2xhc3NOYW1lID0gXCJmbGV4IG1pbi13LTAgZmxleC1jb2wgZ2FwLTFcIjtcbiAgaWYgKHRpdGxlKSB7XG4gICAgY29uc3QgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdC5jbGFzc05hbWUgPSBcIm1pbi13LTAgdGV4dC1zbSB0ZXh0LXRva2VuLXRleHQtcHJpbWFyeVwiO1xuICAgIHQudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgICBzdGFjay5hcHBlbmRDaGlsZCh0KTtcbiAgfVxuICBpZiAoZGVzY3JpcHRpb24pIHtcbiAgICBjb25zdCBkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBkLmNsYXNzTmFtZSA9IFwidGV4dC10b2tlbi10ZXh0LXNlY29uZGFyeSBtaW4tdy0wIHRleHQtc21cIjtcbiAgICBkLnRleHRDb250ZW50ID0gZGVzY3JpcHRpb247XG4gICAgc3RhY2suYXBwZW5kQ2hpbGQoZCk7XG4gIH1cbiAgbGVmdC5hcHBlbmRDaGlsZChzdGFjayk7XG4gIHJvdy5hcHBlbmRDaGlsZChsZWZ0KTtcbiAgcmV0dXJuIHJvdztcbn1cblxuLyoqXG4gKiBDb2RleC1zdHlsZWQgdG9nZ2xlIHN3aXRjaC4gTWFya3VwIG1pcnJvcnMgdGhlIEdlbmVyYWwgPiBQZXJtaXNzaW9ucyByb3dcbiAqIHN3aXRjaCB3ZSBjYXB0dXJlZDogb3V0ZXIgYnV0dG9uIChyb2xlPXN3aXRjaCksIGlubmVyIHBpbGwsIHNsaWRpbmcga25vYi5cbiAqL1xuZnVuY3Rpb24gc3dpdGNoQ29udHJvbChcbiAgaW5pdGlhbDogYm9vbGVhbixcbiAgb25DaGFuZ2U6IChuZXh0OiBib29sZWFuKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPixcbik6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgYnRuLnR5cGUgPSBcImJ1dHRvblwiO1xuICBidG4uc2V0QXR0cmlidXRlKFwicm9sZVwiLCBcInN3aXRjaFwiKTtcblxuICBjb25zdCBwaWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGNvbnN0IGtub2IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAga25vYi5jbGFzc05hbWUgPVxuICAgIFwicm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItW2NvbG9yOnZhcigtLWdyYXktMCldIGJnLVtjb2xvcjp2YXIoLS1ncmF5LTApXSBzaGFkb3ctc20gdHJhbnNpdGlvbi10cmFuc2Zvcm0gZHVyYXRpb24tMjAwIGVhc2Utb3V0IGgtNCB3LTRcIjtcbiAgcGlsbC5hcHBlbmRDaGlsZChrbm9iKTtcblxuICBjb25zdCBhcHBseSA9IChvbjogYm9vbGVhbik6IHZvaWQgPT4ge1xuICAgIGJ0bi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWNoZWNrZWRcIiwgU3RyaW5nKG9uKSk7XG4gICAgYnRuLmRhdGFzZXQuc3RhdGUgPSBvbiA/IFwiY2hlY2tlZFwiIDogXCJ1bmNoZWNrZWRcIjtcbiAgICBidG4uY2xhc3NOYW1lID1cbiAgICAgIFwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIHRleHQtc20gZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTIgZm9jdXMtdmlzaWJsZTpyaW5nLXRva2VuLWZvY3VzLWJvcmRlciBmb2N1cy12aXNpYmxlOnJvdW5kZWQtZnVsbCBjdXJzb3ItaW50ZXJhY3Rpb25cIjtcbiAgICBwaWxsLmNsYXNzTmFtZSA9IGByZWxhdGl2ZSBpbmxpbmUtZmxleCBzaHJpbmstMCBpdGVtcy1jZW50ZXIgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLTIwMCBlYXNlLW91dCBoLTUgdy04ICR7XG4gICAgICBvbiA/IFwiYmctdG9rZW4tY2hhcnRzLWJsdWVcIiA6IFwiYmctdG9rZW4tZm9yZWdyb3VuZC8yMFwiXG4gICAgfWA7XG4gICAgcGlsbC5kYXRhc2V0LnN0YXRlID0gb24gPyBcImNoZWNrZWRcIiA6IFwidW5jaGVja2VkXCI7XG4gICAga25vYi5kYXRhc2V0LnN0YXRlID0gb24gPyBcImNoZWNrZWRcIiA6IFwidW5jaGVja2VkXCI7XG4gICAga25vYi5zdHlsZS50cmFuc2Zvcm0gPSBvbiA/IFwidHJhbnNsYXRlWCgxNHB4KVwiIDogXCJ0cmFuc2xhdGVYKDJweClcIjtcbiAgfTtcbiAgYXBwbHkoaW5pdGlhbCk7XG5cbiAgYnRuLmFwcGVuZENoaWxkKHBpbGwpO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY29uc3QgbmV4dCA9IGJ0bi5nZXRBdHRyaWJ1dGUoXCJhcmlhLWNoZWNrZWRcIikgIT09IFwidHJ1ZVwiO1xuICAgIGFwcGx5KG5leHQpO1xuICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IG9uQ2hhbmdlKG5leHQpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gYnRuO1xufVxuXG5mdW5jdGlvbiBkb3QoKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIHMuY2xhc3NOYW1lID0gXCJ0ZXh0LXRva2VuLWRlc2NyaXB0aW9uLWZvcmVncm91bmRcIjtcbiAgcy50ZXh0Q29udGVudCA9IFwiXHUwMEI3XCI7XG4gIHJldHVybiBzO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgaWNvbnMgXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGNvbmZpZ0ljb25TdmcoKTogc3RyaW5nIHtcbiAgLy8gU2xpZGVycyAvIHNldHRpbmdzIGdseXBoLiAyMHgyMCBjdXJyZW50Q29sb3IuXG4gIHJldHVybiAoXG4gICAgYDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGNsYXNzPVwiaWNvbi1zbSBpbmxpbmUtYmxvY2sgYWxpZ24tbWlkZGxlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNMyA1aDlNMTUgNWgyTTMgMTBoMk04IDEwaDlNMyAxNWgxMU0xNyAxNWgwXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5gICtcbiAgICBgPGNpcmNsZSBjeD1cIjEzXCIgY3k9XCI1XCIgcj1cIjEuNlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCArXG4gICAgYDxjaXJjbGUgY3g9XCI2XCIgY3k9XCIxMFwiIHI9XCIxLjZcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPmAgK1xuICAgIGA8Y2lyY2xlIGN4PVwiMTVcIiBjeT1cIjE1XCIgcj1cIjEuNlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCArXG4gICAgYDwvc3ZnPmBcbiAgKTtcbn1cblxuZnVuY3Rpb24gdHdlYWtzSWNvblN2ZygpOiBzdHJpbmcge1xuICAvLyBTcGFya2xlcyAvIFwiKytcIiBnbHlwaCBmb3IgdHdlYWtzLlxuICByZXR1cm4gKFxuICAgIGA8c3ZnIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBjbGFzcz1cImljb24tc20gaW5saW5lLWJsb2NrIGFsaWduLW1pZGRsZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPmAgK1xuICAgIGA8cGF0aCBkPVwiTTEwIDIuNSBMMTEuNCA4LjYgTDE3LjUgMTAgTDExLjQgMTEuNCBMMTAgMTcuNSBMOC42IDExLjQgTDIuNSAxMCBMOC42IDguNiBaXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5gICtcbiAgICBgPHBhdGggZD1cIk0xNS41IDMgTDE2IDUgTDE4IDUuNSBMMTYgNiBMMTUuNSA4IEwxNSA2IEwxMyA1LjUgTDE1IDUgWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBvcGFjaXR5PVwiMC43XCIvPmAgK1xuICAgIGA8L3N2Zz5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRQYWdlSWNvblN2ZygpOiBzdHJpbmcge1xuICAvLyBEb2N1bWVudC9wYWdlIGdseXBoIGZvciB0d2Vhay1yZWdpc3RlcmVkIHBhZ2VzIHdpdGhvdXQgdGhlaXIgb3duIGljb24uXG4gIHJldHVybiAoXG4gICAgYDxzdmcgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIGNsYXNzPVwiaWNvbi1zbSBpbmxpbmUtYmxvY2sgYWxpZ24tbWlkZGxlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+YCArXG4gICAgYDxwYXRoIGQ9XCJNNSAzaDdsMyAzdjExYTEgMSAwIDAgMS0xIDFINWExIDEgMCAwIDEtMS0xVjRhMSAxIDAgMCAxIDEtMVpcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiLz5gICtcbiAgICBgPHBhdGggZD1cIk0xMiAzdjNhMSAxIDAgMCAwIDEgMWgyXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS41XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCArXG4gICAgYDxwYXRoIGQ9XCJNNyAxMWg2TTcgMTRoNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+YCArXG4gICAgYDwvc3ZnPmBcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUljb25VcmwoXG4gIHVybDogc3RyaW5nLFxuICB0d2Vha0Rpcjogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGlmICgvXihodHRwcz86fGRhdGE6KS8udGVzdCh1cmwpKSByZXR1cm4gdXJsO1xuICAvLyBSZWxhdGl2ZSBwYXRoIFx1MjE5MiBhc2sgbWFpbiB0byByZWFkIHRoZSBmaWxlIGFuZCByZXR1cm4gYSBkYXRhOiBVUkwuXG4gIC8vIFJlbmRlcmVyIGlzIHNhbmRib3hlZCBzbyBmaWxlOi8vIHdvbid0IGxvYWQgZGlyZWN0bHkuXG4gIGNvbnN0IHJlbCA9IHVybC5zdGFydHNXaXRoKFwiLi9cIikgPyB1cmwuc2xpY2UoMikgOiB1cmw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIChhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXG4gICAgICBcImNvZGV4cHA6cmVhZC10d2Vhay1hc3NldFwiLFxuICAgICAgdHdlYWtEaXIsXG4gICAgICByZWwsXG4gICAgKSkgYXMgc3RyaW5nO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcGxvZyhcImljb24gbG9hZCBmYWlsZWRcIiwgeyB1cmwsIHR3ZWFrRGlyLCBlcnI6IFN0cmluZyhlKSB9KTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDAgRE9NIGhldXJpc3RpY3MgXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGZpbmRTaWRlYmFySXRlbXNHcm91cCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAvLyBBbmNob3Igc3RyYXRlZ3kgZmlyc3QgKHdvdWxkIGJlIGlkZWFsIGlmIENvZGV4IHN3aXRjaGVzIHRvIDxhPikuXG4gIGNvbnN0IGxpbmtzID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PihcImFbaHJlZio9Jy9zZXR0aW5ncy8nXVwiKSxcbiAgKTtcbiAgaWYgKGxpbmtzLmxlbmd0aCA+PSAyKSB7XG4gICAgbGV0IG5vZGU6IEhUTUxFbGVtZW50IHwgbnVsbCA9IGxpbmtzWzBdLnBhcmVudEVsZW1lbnQ7XG4gICAgd2hpbGUgKG5vZGUpIHtcbiAgICAgIGNvbnN0IGluc2lkZSA9IG5vZGUucXVlcnlTZWxlY3RvckFsbChcImFbaHJlZio9Jy9zZXR0aW5ncy8nXVwiKTtcbiAgICAgIGlmIChpbnNpZGUubGVuZ3RoID49IE1hdGgubWF4KDIsIGxpbmtzLmxlbmd0aCAtIDEpKSByZXR1cm4gbm9kZTtcbiAgICAgIG5vZGUgPSBub2RlLnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gVGV4dC1jb250ZW50IG1hdGNoIGFnYWluc3QgQ29kZXgncyBrbm93biBzaWRlYmFyIGxhYmVscy5cbiAgY29uc3QgS05PV04gPSBbXG4gICAgXCJHZW5lcmFsXCIsXG4gICAgXCJBcHBlYXJhbmNlXCIsXG4gICAgXCJDb25maWd1cmF0aW9uXCIsXG4gICAgXCJQZXJzb25hbGl6YXRpb25cIixcbiAgICBcIk1DUCBzZXJ2ZXJzXCIsXG4gICAgXCJNQ1AgU2VydmVyc1wiLFxuICAgIFwiR2l0XCIsXG4gICAgXCJFbnZpcm9ubWVudHNcIixcbiAgXTtcbiAgY29uc3QgbWF0Y2hlczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuICBjb25zdCBhbGwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICBcImJ1dHRvbiwgYSwgW3JvbGU9J2J1dHRvbiddLCBsaSwgZGl2XCIsXG4gICk7XG4gIGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShhbGwpKSB7XG4gICAgY29uc3QgdCA9IChlbC50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCk7XG4gICAgaWYgKHQubGVuZ3RoID4gMzApIGNvbnRpbnVlO1xuICAgIGlmIChLTk9XTi5zb21lKChrKSA9PiB0ID09PSBrKSkgbWF0Y2hlcy5wdXNoKGVsKTtcbiAgICBpZiAobWF0Y2hlcy5sZW5ndGggPiA1MCkgYnJlYWs7XG4gIH1cbiAgaWYgKG1hdGNoZXMubGVuZ3RoID49IDIpIHtcbiAgICBsZXQgbm9kZTogSFRNTEVsZW1lbnQgfCBudWxsID0gbWF0Y2hlc1swXS5wYXJlbnRFbGVtZW50O1xuICAgIHdoaWxlIChub2RlKSB7XG4gICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgZm9yIChjb25zdCBtIG9mIG1hdGNoZXMpIGlmIChub2RlLmNvbnRhaW5zKG0pKSBjb3VudCsrO1xuICAgICAgaWYgKGNvdW50ID49IE1hdGgubWluKDMsIG1hdGNoZXMubGVuZ3RoKSkgcmV0dXJuIG5vZGU7XG4gICAgICBub2RlID0gbm9kZS5wYXJlbnRFbGVtZW50O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZENvbnRlbnRBcmVhKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHNpZGViYXIgPSBmaW5kU2lkZWJhckl0ZW1zR3JvdXAoKTtcbiAgaWYgKCFzaWRlYmFyKSByZXR1cm4gbnVsbDtcbiAgbGV0IHBhcmVudCA9IHNpZGViYXIucGFyZW50RWxlbWVudDtcbiAgd2hpbGUgKHBhcmVudCkge1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShwYXJlbnQuY2hpbGRyZW4pIGFzIEhUTUxFbGVtZW50W10pIHtcbiAgICAgIGlmIChjaGlsZCA9PT0gc2lkZWJhciB8fCBjaGlsZC5jb250YWlucyhzaWRlYmFyKSkgY29udGludWU7XG4gICAgICBjb25zdCByID0gY2hpbGQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBpZiAoci53aWR0aCA+IDMwMCAmJiByLmhlaWdodCA+IDIwMCkgcmV0dXJuIGNoaWxkO1xuICAgIH1cbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbWF5YmVEdW1wRG9tKCk6IHZvaWQge1xuICB0cnkge1xuICAgIGNvbnN0IHNpZGViYXIgPSBmaW5kU2lkZWJhckl0ZW1zR3JvdXAoKTtcbiAgICBpZiAoc2lkZWJhciAmJiAhc3RhdGUuc2lkZWJhckR1bXBlZCkge1xuICAgICAgc3RhdGUuc2lkZWJhckR1bXBlZCA9IHRydWU7XG4gICAgICBjb25zdCBzYlJvb3QgPSBzaWRlYmFyLnBhcmVudEVsZW1lbnQgPz8gc2lkZWJhcjtcbiAgICAgIHBsb2coYGNvZGV4IHNpZGViYXIgSFRNTGAsIHNiUm9vdC5vdXRlckhUTUwuc2xpY2UoMCwgMzIwMDApKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGZpbmRDb250ZW50QXJlYSgpO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgaWYgKHN0YXRlLmZpbmdlcnByaW50ICE9PSBsb2NhdGlvbi5ocmVmKSB7XG4gICAgICAgIHN0YXRlLmZpbmdlcnByaW50ID0gbG9jYXRpb24uaHJlZjtcbiAgICAgICAgcGxvZyhcImRvbSBwcm9iZSAobm8gY29udGVudClcIiwge1xuICAgICAgICAgIHVybDogbG9jYXRpb24uaHJlZixcbiAgICAgICAgICBzaWRlYmFyOiBzaWRlYmFyID8gZGVzY3JpYmUoc2lkZWJhcikgOiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHBhbmVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgQXJyYXkuZnJvbShjb250ZW50LmNoaWxkcmVuKSBhcyBIVE1MRWxlbWVudFtdKSB7XG4gICAgICBpZiAoY2hpbGQuZGF0YXNldC5jb2RleHBwID09PSBcInR3ZWFrcy1wYW5lbFwiKSBjb250aW51ZTtcbiAgICAgIGlmIChjaGlsZC5zdHlsZS5kaXNwbGF5ID09PSBcIm5vbmVcIikgY29udGludWU7XG4gICAgICBwYW5lbCA9IGNoaWxkO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGFjdGl2ZU5hdiA9IHNpZGViYXJcbiAgICAgID8gQXJyYXkuZnJvbShzaWRlYmFyLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiYnV0dG9uLCBhXCIpKS5maW5kKFxuICAgICAgICAgIChiKSA9PlxuICAgICAgICAgICAgYi5nZXRBdHRyaWJ1dGUoXCJhcmlhLWN1cnJlbnRcIikgPT09IFwicGFnZVwiIHx8XG4gICAgICAgICAgICBiLmdldEF0dHJpYnV0ZShcImRhdGEtYWN0aXZlXCIpID09PSBcInRydWVcIiB8fFxuICAgICAgICAgICAgYi5nZXRBdHRyaWJ1dGUoXCJhcmlhLXNlbGVjdGVkXCIpID09PSBcInRydWVcIiB8fFxuICAgICAgICAgICAgYi5jbGFzc0xpc3QuY29udGFpbnMoXCJhY3RpdmVcIiksXG4gICAgICAgIClcbiAgICAgIDogbnVsbDtcbiAgICBjb25zdCBoZWFkaW5nID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFxuICAgICAgXCJoMSwgaDIsIGgzLCBbY2xhc3MqPSdoZWFkaW5nJ11cIixcbiAgICApO1xuICAgIGNvbnN0IGZpbmdlcnByaW50ID0gYCR7YWN0aXZlTmF2Py50ZXh0Q29udGVudCA/PyBcIlwifXwke2hlYWRpbmc/LnRleHRDb250ZW50ID8/IFwiXCJ9fCR7cGFuZWw/LmNoaWxkcmVuLmxlbmd0aCA/PyAwfWA7XG4gICAgaWYgKHN0YXRlLmZpbmdlcnByaW50ID09PSBmaW5nZXJwcmludCkgcmV0dXJuO1xuICAgIHN0YXRlLmZpbmdlcnByaW50ID0gZmluZ2VycHJpbnQ7XG4gICAgcGxvZyhcImRvbSBwcm9iZVwiLCB7XG4gICAgICB1cmw6IGxvY2F0aW9uLmhyZWYsXG4gICAgICBhY3RpdmVOYXY6IGFjdGl2ZU5hdj8udGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBudWxsLFxuICAgICAgaGVhZGluZzogaGVhZGluZz8udGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBudWxsLFxuICAgICAgY29udGVudDogZGVzY3JpYmUoY29udGVudCksXG4gICAgfSk7XG4gICAgaWYgKHBhbmVsKSB7XG4gICAgICBjb25zdCBodG1sID0gcGFuZWwub3V0ZXJIVE1MO1xuICAgICAgcGxvZyhcbiAgICAgICAgYGNvZGV4IHBhbmVsIEhUTUwgKCR7YWN0aXZlTmF2Py50ZXh0Q29udGVudD8udHJpbSgpID8/IFwiP1wifSlgLFxuICAgICAgICBodG1sLnNsaWNlKDAsIDMyMDAwKSxcbiAgICAgICk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgcGxvZyhcImRvbSBwcm9iZSBmYWlsZWRcIiwgU3RyaW5nKGUpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZXNjcmliZShlbDogSFRNTEVsZW1lbnQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgdGFnOiBlbC50YWdOYW1lLFxuICAgIGNsczogZWwuY2xhc3NOYW1lLnNsaWNlKDAsIDEyMCksXG4gICAgaWQ6IGVsLmlkIHx8IHVuZGVmaW5lZCxcbiAgICBjaGlsZHJlbjogZWwuY2hpbGRyZW4ubGVuZ3RoLFxuICAgIHJlY3Q6ICgoKSA9PiB7XG4gICAgICBjb25zdCByID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICByZXR1cm4geyB3OiBNYXRoLnJvdW5kKHIud2lkdGgpLCBoOiBNYXRoLnJvdW5kKHIuaGVpZ2h0KSB9O1xuICAgIH0pKCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHR3ZWFrc1BhdGgoKTogc3RyaW5nIHtcbiAgcmV0dXJuIChcbiAgICAod2luZG93IGFzIHVua25vd24gYXMgeyBfX2NvZGV4cHBfdHdlYWtzX2Rpcl9fPzogc3RyaW5nIH0pLl9fY29kZXhwcF90d2Vha3NfZGlyX18gPz9cbiAgICBcIjx1c2VyIGRpcj4vdHdlYWtzXCJcbiAgKTtcbn1cbiIsICIvKipcbiAqIFJlbmRlcmVyLXNpZGUgdHdlYWsgaG9zdC4gV2U6XG4gKiAgIDEuIEFzayBtYWluIGZvciB0aGUgdHdlYWsgbGlzdCAod2l0aCByZXNvbHZlZCBlbnRyeSBwYXRoKS5cbiAqICAgMi4gRm9yIGVhY2ggcmVuZGVyZXItc2NvcGVkIChvciBcImJvdGhcIikgdHdlYWssIGZldGNoIGl0cyBzb3VyY2UgdmlhIElQQ1xuICogICAgICBhbmQgZXhlY3V0ZSBpdCBhcyBhIENvbW1vbkpTLXNoYXBlZCBmdW5jdGlvbi5cbiAqICAgMy4gUHJvdmlkZSBpdCB0aGUgcmVuZGVyZXIgaGFsZiBvZiB0aGUgQVBJLlxuICpcbiAqIENvZGV4IHJ1bnMgdGhlIHJlbmRlcmVyIHdpdGggc2FuZGJveDogdHJ1ZSwgc28gTm9kZSdzIGByZXF1aXJlKClgIGlzXG4gKiByZXN0cmljdGVkIHRvIGEgdGlueSB3aGl0ZWxpc3QgKGVsZWN0cm9uICsgYSBmZXcgcG9seWZpbGxzKS4gVGhhdCBtZWFucyB3ZVxuICogY2Fubm90IGByZXF1aXJlKClgIGFyYml0cmFyeSB0d2VhayBmaWxlcyBmcm9tIGRpc2suIEluc3RlYWQgd2UgcHVsbCB0aGVcbiAqIHNvdXJjZSBzdHJpbmcgZnJvbSBtYWluIGFuZCBldmFsdWF0ZSBpdCB3aXRoIGBuZXcgRnVuY3Rpb25gIGluc2lkZSB0aGVcbiAqIHByZWxvYWQgY29udGV4dC4gVHdlYWsgYXV0aG9ycyB3aG8gbmVlZCBucG0gZGVwcyBtdXN0IGJ1bmRsZSB0aGVtIGluLlxuICovXG5cbmltcG9ydCB7IGlwY1JlbmRlcmVyIH0gZnJvbSBcImVsZWN0cm9uXCI7XG5pbXBvcnQgeyByZWdpc3RlclNlY3Rpb24sIHJlZ2lzdGVyUGFnZSwgY2xlYXJTZWN0aW9ucywgc2V0TGlzdGVkVHdlYWtzIH0gZnJvbSBcIi4vc2V0dGluZ3MtaW5qZWN0b3JcIjtcbmltcG9ydCB7IGZpYmVyRm9yTm9kZSB9IGZyb20gXCIuL3JlYWN0LWhvb2tcIjtcbmltcG9ydCB0eXBlIHtcbiAgVHdlYWtNYW5pZmVzdCxcbiAgVHdlYWtBcGksXG4gIFJlYWN0RmliZXJOb2RlLFxuICBUd2Vhayxcbn0gZnJvbSBcIkBjb2RleC1wbHVzcGx1cy9zZGtcIjtcblxuaW50ZXJmYWNlIExpc3RlZFR3ZWFrIHtcbiAgbWFuaWZlc3Q6IFR3ZWFrTWFuaWZlc3Q7XG4gIGVudHJ5OiBzdHJpbmc7XG4gIGRpcjogc3RyaW5nO1xuICBlbnRyeUV4aXN0czogYm9vbGVhbjtcbiAgZW5hYmxlZDogYm9vbGVhbjtcbiAgdXBkYXRlOiB7XG4gICAgY2hlY2tlZEF0OiBzdHJpbmc7XG4gICAgcmVwbzogc3RyaW5nO1xuICAgIGN1cnJlbnRWZXJzaW9uOiBzdHJpbmc7XG4gICAgbGF0ZXN0VmVyc2lvbjogc3RyaW5nIHwgbnVsbDtcbiAgICBsYXRlc3RUYWc6IHN0cmluZyB8IG51bGw7XG4gICAgcmVsZWFzZVVybDogc3RyaW5nIHwgbnVsbDtcbiAgICB1cGRhdGVBdmFpbGFibGU6IGJvb2xlYW47XG4gICAgZXJyb3I/OiBzdHJpbmc7XG4gIH0gfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVXNlclBhdGhzIHtcbiAgdXNlclJvb3Q6IHN0cmluZztcbiAgcnVudGltZURpcjogc3RyaW5nO1xuICB0d2Vha3NEaXI6IHN0cmluZztcbiAgbG9nRGlyOiBzdHJpbmc7XG59XG5cbmNvbnN0IGxvYWRlZCA9IG5ldyBNYXA8c3RyaW5nLCB7IHN0b3A/OiAoKSA9PiB2b2lkIH0+KCk7XG5sZXQgY2FjaGVkUGF0aHM6IFVzZXJQYXRocyB8IG51bGwgPSBudWxsO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RhcnRUd2Vha0hvc3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHR3ZWFrcyA9IChhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOmxpc3QtdHdlYWtzXCIpKSBhcyBMaXN0ZWRUd2Vha1tdO1xuICBjb25zdCBwYXRocyA9IChhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnVzZXItcGF0aHNcIikpIGFzIFVzZXJQYXRocztcbiAgY2FjaGVkUGF0aHMgPSBwYXRocztcbiAgLy8gUHVzaCB0aGUgbGlzdCB0byB0aGUgc2V0dGluZ3MgaW5qZWN0b3Igc28gdGhlIFR3ZWFrcyBwYWdlIGNhbiByZW5kZXJcbiAgLy8gY2FyZHMgZXZlbiBiZWZvcmUgYW55IHR3ZWFrJ3Mgc3RhcnQoKSBydW5zIChhbmQgZm9yIGRpc2FibGVkIHR3ZWFrc1xuICAvLyB0aGF0IHdlIG5ldmVyIGxvYWQpLlxuICBzZXRMaXN0ZWRUd2Vha3ModHdlYWtzKTtcbiAgLy8gU3Rhc2ggZm9yIHRoZSBzZXR0aW5ncyBpbmplY3RvcidzIGVtcHR5LXN0YXRlIG1lc3NhZ2UuXG4gICh3aW5kb3cgYXMgdW5rbm93biBhcyB7IF9fY29kZXhwcF90d2Vha3NfZGlyX18/OiBzdHJpbmcgfSkuX19jb2RleHBwX3R3ZWFrc19kaXJfXyA9XG4gICAgcGF0aHMudHdlYWtzRGlyO1xuXG4gIGZvciAoY29uc3QgdCBvZiB0d2Vha3MpIHtcbiAgICBpZiAodC5tYW5pZmVzdC5zY29wZSA9PT0gXCJtYWluXCIpIGNvbnRpbnVlO1xuICAgIGlmICghdC5lbnRyeUV4aXN0cykgY29udGludWU7XG4gICAgaWYgKCF0LmVuYWJsZWQpIGNvbnRpbnVlO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBsb2FkVHdlYWsodCwgcGF0aHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbY29kZXgtcGx1c3BsdXNdIHR3ZWFrIGxvYWQgZmFpbGVkOlwiLCB0Lm1hbmlmZXN0LmlkLCBlKTtcbiAgICB9XG4gIH1cblxuICBjb25zb2xlLmluZm8oXG4gICAgYFtjb2RleC1wbHVzcGx1c10gcmVuZGVyZXIgaG9zdCBsb2FkZWQgJHtsb2FkZWQuc2l6ZX0gdHdlYWsocyk6YCxcbiAgICBbLi4ubG9hZGVkLmtleXMoKV0uam9pbihcIiwgXCIpIHx8IFwiKG5vbmUpXCIsXG4gICk7XG4gIGlwY1JlbmRlcmVyLnNlbmQoXG4gICAgXCJjb2RleHBwOnByZWxvYWQtbG9nXCIsXG4gICAgXCJpbmZvXCIsXG4gICAgYHJlbmRlcmVyIGhvc3QgbG9hZGVkICR7bG9hZGVkLnNpemV9IHR3ZWFrKHMpOiAke1suLi5sb2FkZWQua2V5cygpXS5qb2luKFwiLCBcIikgfHwgXCIobm9uZSlcIn1gLFxuICApO1xufVxuXG4vKipcbiAqIFN0b3AgZXZlcnkgcmVuZGVyZXItc2NvcGUgdHdlYWsgc28gYSBzdWJzZXF1ZW50IGBzdGFydFR3ZWFrSG9zdCgpYCB3aWxsXG4gKiByZS1ldmFsdWF0ZSBmcmVzaCBzb3VyY2UuIE1vZHVsZSBjYWNoZSBpc24ndCByZWxldmFudCBzaW5jZSB3ZSBldmFsXG4gKiBzb3VyY2Ugc3RyaW5ncyBkaXJlY3RseSBcdTIwMTQgZWFjaCBsb2FkIGNyZWF0ZXMgYSBmcmVzaCBzY29wZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlYXJkb3duVHdlYWtIb3N0KCk6IHZvaWQge1xuICBmb3IgKGNvbnN0IFtpZCwgdF0gb2YgbG9hZGVkKSB7XG4gICAgdHJ5IHtcbiAgICAgIHQuc3RvcD8uKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS53YXJuKFwiW2NvZGV4LXBsdXNwbHVzXSB0d2VhayBzdG9wIGZhaWxlZDpcIiwgaWQsIGUpO1xuICAgIH1cbiAgfVxuICBsb2FkZWQuY2xlYXIoKTtcbiAgY2xlYXJTZWN0aW9ucygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkVHdlYWsodDogTGlzdGVkVHdlYWssIHBhdGhzOiBVc2VyUGF0aHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc291cmNlID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcbiAgICBcImNvZGV4cHA6cmVhZC10d2Vhay1zb3VyY2VcIixcbiAgICB0LmVudHJ5LFxuICApKSBhcyBzdHJpbmc7XG5cbiAgLy8gRXZhbHVhdGUgYXMgQ0pTLXNoYXBlZDogcHJvdmlkZSBtb2R1bGUvZXhwb3J0cy9hcGkuIFR3ZWFrIGNvZGUgbWF5IHVzZVxuICAvLyBgbW9kdWxlLmV4cG9ydHMgPSB7IHN0YXJ0LCBzdG9wIH1gIG9yIGBleHBvcnRzLnN0YXJ0ID0gLi4uYCBvciBwdXJlIEVTTVxuICAvLyBkZWZhdWx0IGV4cG9ydCBzaGFwZSAod2UgYWNjZXB0IGJvdGgpLlxuICBjb25zdCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IGFzIHsgZGVmYXVsdD86IFR3ZWFrIH0gJiBUd2VhayB9O1xuICBjb25zdCBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8taW1wbGllZC1ldmFsLCBuby1uZXctZnVuY1xuICBjb25zdCBmbiA9IG5ldyBGdW5jdGlvbihcbiAgICBcIm1vZHVsZVwiLFxuICAgIFwiZXhwb3J0c1wiLFxuICAgIFwiY29uc29sZVwiLFxuICAgIGAke3NvdXJjZX1cXG4vLyMgc291cmNlVVJMPWNvZGV4cHAtdHdlYWs6Ly8ke2VuY29kZVVSSUNvbXBvbmVudCh0Lm1hbmlmZXN0LmlkKX0vJHtlbmNvZGVVUklDb21wb25lbnQodC5lbnRyeSl9YCxcbiAgKTtcbiAgZm4obW9kdWxlLCBleHBvcnRzLCBjb25zb2xlKTtcbiAgY29uc3QgbW9kID0gbW9kdWxlLmV4cG9ydHMgYXMgeyBkZWZhdWx0PzogVHdlYWsgfSAmIFR3ZWFrO1xuICBjb25zdCB0d2VhazogVHdlYWsgPSAobW9kIGFzIHsgZGVmYXVsdD86IFR3ZWFrIH0pLmRlZmF1bHQgPz8gKG1vZCBhcyBUd2Vhayk7XG4gIGlmICh0eXBlb2YgdHdlYWs/LnN0YXJ0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHR3ZWFrICR7dC5tYW5pZmVzdC5pZH0gaGFzIG5vIHN0YXJ0KClgKTtcbiAgfVxuICBjb25zdCBhcGkgPSBtYWtlUmVuZGVyZXJBcGkodC5tYW5pZmVzdCwgcGF0aHMpO1xuICBhd2FpdCB0d2Vhay5zdGFydChhcGkpO1xuICBsb2FkZWQuc2V0KHQubWFuaWZlc3QuaWQsIHsgc3RvcDogdHdlYWsuc3RvcD8uYmluZCh0d2VhaykgfSk7XG59XG5cbmZ1bmN0aW9uIG1ha2VSZW5kZXJlckFwaShtYW5pZmVzdDogVHdlYWtNYW5pZmVzdCwgcGF0aHM6IFVzZXJQYXRocyk6IFR3ZWFrQXBpIHtcbiAgY29uc3QgaWQgPSBtYW5pZmVzdC5pZDtcbiAgY29uc3QgbG9nID0gKGxldmVsOiBcImRlYnVnXCIgfCBcImluZm9cIiB8IFwid2FyblwiIHwgXCJlcnJvclwiLCAuLi5hOiB1bmtub3duW10pID0+IHtcbiAgICBjb25zdCBjb25zb2xlRm4gPVxuICAgICAgbGV2ZWwgPT09IFwiZGVidWdcIiA/IGNvbnNvbGUuZGVidWdcbiAgICAgIDogbGV2ZWwgPT09IFwid2FyblwiID8gY29uc29sZS53YXJuXG4gICAgICA6IGxldmVsID09PSBcImVycm9yXCIgPyBjb25zb2xlLmVycm9yXG4gICAgICA6IGNvbnNvbGUubG9nO1xuICAgIGNvbnNvbGVGbihgW2NvZGV4LXBsdXNwbHVzXVske2lkfV1gLCAuLi5hKTtcbiAgICAvLyBBbHNvIG1pcnJvciB0byBtYWluJ3MgbG9nIGZpbGUgc28gd2UgY2FuIGRpYWdub3NlIHR3ZWFrIGJlaGF2aW9yXG4gICAgLy8gd2l0aG91dCBhdHRhY2hpbmcgRGV2VG9vbHMuIFN0cmluZ2lmeSBlYWNoIGFyZyBkZWZlbnNpdmVseS5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFydHMgPSBhLm1hcCgodikgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwic3RyaW5nXCIpIHJldHVybiB2O1xuICAgICAgICBpZiAodiBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gYCR7di5uYW1lfTogJHt2Lm1lc3NhZ2V9YDtcbiAgICAgICAgdHJ5IHsgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpOyB9IGNhdGNoIHsgcmV0dXJuIFN0cmluZyh2KTsgfVxuICAgICAgfSk7XG4gICAgICBpcGNSZW5kZXJlci5zZW5kKFxuICAgICAgICBcImNvZGV4cHA6cHJlbG9hZC1sb2dcIixcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIGBbdHdlYWsgJHtpZH1dICR7cGFydHMuam9pbihcIiBcIil9YCxcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBzd2FsbG93IFx1MjAxNCBuZXZlciBsZXQgbG9nZ2luZyBicmVhayBhIHR3ZWFrICovXG4gICAgfVxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgbWFuaWZlc3QsXG4gICAgcHJvY2VzczogXCJyZW5kZXJlclwiLFxuICAgIGxvZzoge1xuICAgICAgZGVidWc6ICguLi5hKSA9PiBsb2coXCJkZWJ1Z1wiLCAuLi5hKSxcbiAgICAgIGluZm86ICguLi5hKSA9PiBsb2coXCJpbmZvXCIsIC4uLmEpLFxuICAgICAgd2FybjogKC4uLmEpID0+IGxvZyhcIndhcm5cIiwgLi4uYSksXG4gICAgICBlcnJvcjogKC4uLmEpID0+IGxvZyhcImVycm9yXCIsIC4uLmEpLFxuICAgIH0sXG4gICAgc3RvcmFnZTogcmVuZGVyZXJTdG9yYWdlKGlkKSxcbiAgICBzZXR0aW5nczoge1xuICAgICAgcmVnaXN0ZXI6IChzKSA9PiByZWdpc3RlclNlY3Rpb24oeyAuLi5zLCBpZDogYCR7aWR9OiR7cy5pZH1gIH0pLFxuICAgICAgcmVnaXN0ZXJQYWdlOiAocCkgPT5cbiAgICAgICAgcmVnaXN0ZXJQYWdlKGlkLCBtYW5pZmVzdCwgeyAuLi5wLCBpZDogYCR7aWR9OiR7cC5pZH1gIH0pLFxuICAgIH0sXG4gICAgcmVhY3Q6IHtcbiAgICAgIGdldEZpYmVyOiAobikgPT4gZmliZXJGb3JOb2RlKG4pIGFzIFJlYWN0RmliZXJOb2RlIHwgbnVsbCxcbiAgICAgIGZpbmRPd25lckJ5TmFtZTogKG4sIG5hbWUpID0+IHtcbiAgICAgICAgbGV0IGYgPSBmaWJlckZvck5vZGUobikgYXMgUmVhY3RGaWJlck5vZGUgfCBudWxsO1xuICAgICAgICB3aGlsZSAoZikge1xuICAgICAgICAgIGNvbnN0IHQgPSBmLnR5cGUgYXMgeyBkaXNwbGF5TmFtZT86IHN0cmluZzsgbmFtZT86IHN0cmluZyB9IHwgbnVsbDtcbiAgICAgICAgICBpZiAodCAmJiAodC5kaXNwbGF5TmFtZSA9PT0gbmFtZSB8fCB0Lm5hbWUgPT09IG5hbWUpKSByZXR1cm4gZjtcbiAgICAgICAgICBmID0gZi5yZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgICAgd2FpdEZvckVsZW1lbnQ6IChzZWwsIHRpbWVvdXRNcyA9IDUwMDApID0+XG4gICAgICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBleGlzdGluZyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsKTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmcpIHJldHVybiByZXNvbHZlKGV4aXN0aW5nKTtcbiAgICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XG4gICAgICAgICAgY29uc3Qgb2JzID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbCk7XG4gICAgICAgICAgICBpZiAoZWwpIHtcbiAgICAgICAgICAgICAgb2JzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShlbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKERhdGUubm93KCkgPiBkZWFkbGluZSkge1xuICAgICAgICAgICAgICBvYnMuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGB0aW1lb3V0IHdhaXRpbmcgZm9yICR7c2VsfWApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvYnMub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgICB9KSxcbiAgICB9LFxuICAgIGlwYzoge1xuICAgICAgb246IChjLCBoKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyYXBwZWQgPSAoX2U6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gaCguLi5hcmdzKTtcbiAgICAgICAgaXBjUmVuZGVyZXIub24oYGNvZGV4cHA6JHtpZH06JHtjfWAsIHdyYXBwZWQpO1xuICAgICAgICByZXR1cm4gKCkgPT4gaXBjUmVuZGVyZXIucmVtb3ZlTGlzdGVuZXIoYGNvZGV4cHA6JHtpZH06JHtjfWAsIHdyYXBwZWQpO1xuICAgICAgfSxcbiAgICAgIHNlbmQ6IChjLCAuLi5hcmdzKSA9PiBpcGNSZW5kZXJlci5zZW5kKGBjb2RleHBwOiR7aWR9OiR7Y31gLCAuLi5hcmdzKSxcbiAgICAgIGludm9rZTogPFQ+KGM6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoYGNvZGV4cHA6JHtpZH06JHtjfWAsIC4uLmFyZ3MpIGFzIFByb21pc2U8VD4sXG4gICAgfSxcbiAgICBmczogcmVuZGVyZXJGcyhpZCwgcGF0aHMpLFxuICB9O1xufVxuXG5mdW5jdGlvbiByZW5kZXJlclN0b3JhZ2UoaWQ6IHN0cmluZykge1xuICBjb25zdCBrZXkgPSBgY29kZXhwcDpzdG9yYWdlOiR7aWR9YDtcbiAgY29uc3QgcmVhZCA9ICgpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgPz8gXCJ7fVwiKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHdyaXRlID0gKHY6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PlxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkodikpO1xuICByZXR1cm4ge1xuICAgIGdldDogPFQ+KGs6IHN0cmluZywgZD86IFQpID0+IChrIGluIHJlYWQoKSA/IChyZWFkKClba10gYXMgVCkgOiAoZCBhcyBUKSksXG4gICAgc2V0OiAoazogc3RyaW5nLCB2OiB1bmtub3duKSA9PiB7XG4gICAgICBjb25zdCBvID0gcmVhZCgpO1xuICAgICAgb1trXSA9IHY7XG4gICAgICB3cml0ZShvKTtcbiAgICB9LFxuICAgIGRlbGV0ZTogKGs6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbyA9IHJlYWQoKTtcbiAgICAgIGRlbGV0ZSBvW2tdO1xuICAgICAgd3JpdGUobyk7XG4gICAgfSxcbiAgICBhbGw6ICgpID0+IHJlYWQoKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyZXJGcyhpZDogc3RyaW5nLCBfcGF0aHM6IFVzZXJQYXRocykge1xuICAvLyBTYW5kYm94ZWQgcmVuZGVyZXIgY2FuJ3QgdXNlIE5vZGUgZnMgZGlyZWN0bHkgXHUyMDE0IHByb3h5IHRocm91Z2ggbWFpbiBJUEMuXG4gIHJldHVybiB7XG4gICAgZGF0YURpcjogYDxyZW1vdGU+L3R3ZWFrLWRhdGEvJHtpZH1gLFxuICAgIHJlYWQ6IChwOiBzdHJpbmcpID0+XG4gICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnR3ZWFrLWZzXCIsIFwicmVhZFwiLCBpZCwgcCkgYXMgUHJvbWlzZTxzdHJpbmc+LFxuICAgIHdyaXRlOiAocDogc3RyaW5nLCBjOiBzdHJpbmcpID0+XG4gICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnR3ZWFrLWZzXCIsIFwid3JpdGVcIiwgaWQsIHAsIGMpIGFzIFByb21pc2U8dm9pZD4sXG4gICAgZXhpc3RzOiAocDogc3RyaW5nKSA9PlxuICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKFwiY29kZXhwcDp0d2Vhay1mc1wiLCBcImV4aXN0c1wiLCBpZCwgcCkgYXMgUHJvbWlzZTxib29sZWFuPixcbiAgfTtcbn1cbiIsICIvKipcbiAqIEJ1aWx0LWluIFwiVHdlYWsgTWFuYWdlclwiIFx1MjAxNCBhdXRvLWluamVjdGVkIGJ5IHRoZSBydW50aW1lLCBub3QgYSB1c2VyIHR3ZWFrLlxuICogTGlzdHMgZGlzY292ZXJlZCB0d2Vha3Mgd2l0aCBlbmFibGUgdG9nZ2xlcywgb3BlbnMgdGhlIHR3ZWFrcyBkaXIsIGxpbmtzXG4gKiB0byBsb2dzIGFuZCBjb25maWcuIExpdmVzIGluIHRoZSByZW5kZXJlci5cbiAqXG4gKiBUaGlzIGlzIGludm9rZWQgZnJvbSBwcmVsb2FkL2luZGV4LnRzIEFGVEVSIHVzZXIgdHdlYWtzIGFyZSBsb2FkZWQgc28gaXRcbiAqIGNhbiBzaG93IHVwLXRvLWRhdGUgc3RhdHVzLlxuICovXG5pbXBvcnQgeyBpcGNSZW5kZXJlciB9IGZyb20gXCJlbGVjdHJvblwiO1xuaW1wb3J0IHsgcmVnaXN0ZXJTZWN0aW9uIH0gZnJvbSBcIi4vc2V0dGluZ3MtaW5qZWN0b3JcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1vdW50TWFuYWdlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgdHdlYWtzID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6bGlzdC10d2Vha3NcIikpIGFzIEFycmF5PHtcbiAgICBtYW5pZmVzdDogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHZlcnNpb246IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfTtcbiAgICBlbnRyeUV4aXN0czogYm9vbGVhbjtcbiAgfT47XG4gIGNvbnN0IHBhdGhzID0gKGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZShcImNvZGV4cHA6dXNlci1wYXRoc1wiKSkgYXMge1xuICAgIHVzZXJSb290OiBzdHJpbmc7XG4gICAgdHdlYWtzRGlyOiBzdHJpbmc7XG4gICAgbG9nRGlyOiBzdHJpbmc7XG4gIH07XG5cbiAgcmVnaXN0ZXJTZWN0aW9uKHtcbiAgICBpZDogXCJjb2RleC1wbHVzcGx1czptYW5hZ2VyXCIsXG4gICAgdGl0bGU6IFwiVHdlYWsgTWFuYWdlclwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHt0d2Vha3MubGVuZ3RofSB0d2VhayhzKSBpbnN0YWxsZWQuIFVzZXIgZGlyOiAke3BhdGhzLnVzZXJSb290fWAsXG4gICAgcmVuZGVyKHJvb3QpIHtcbiAgICAgIHJvb3Quc3R5bGUuY3NzVGV4dCA9IFwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6OHB4O1wiO1xuXG4gICAgICBjb25zdCBhY3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgIGFjdGlvbnMuc3R5bGUuY3NzVGV4dCA9IFwiZGlzcGxheTpmbGV4O2dhcDo4cHg7ZmxleC13cmFwOndyYXA7XCI7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJPcGVuIHR3ZWFrcyBmb2xkZXJcIiwgKCkgPT5cbiAgICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCBwYXRocy50d2Vha3NEaXIpLmNhdGNoKCgpID0+IHt9KSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJPcGVuIGxvZ3NcIiwgKCkgPT5cbiAgICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoXCJjb2RleHBwOnJldmVhbFwiLCBwYXRocy5sb2dEaXIpLmNhdGNoKCgpID0+IHt9KSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhY3Rpb25zLmFwcGVuZENoaWxkKFxuICAgICAgICBidXR0b24oXCJSZWxvYWQgd2luZG93XCIsICgpID0+IGxvY2F0aW9uLnJlbG9hZCgpKSxcbiAgICAgICk7XG4gICAgICByb290LmFwcGVuZENoaWxkKGFjdGlvbnMpO1xuXG4gICAgICBpZiAodHdlYWtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zdCBlbXB0eSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xuICAgICAgICBlbXB0eS5zdHlsZS5jc3NUZXh0ID0gXCJjb2xvcjojODg4O2ZvbnQ6MTNweCBzeXN0ZW0tdWk7bWFyZ2luOjhweCAwO1wiO1xuICAgICAgICBlbXB0eS50ZXh0Q29udGVudCA9XG4gICAgICAgICAgXCJObyB1c2VyIHR3ZWFrcyB5ZXQuIERyb3AgYSBmb2xkZXIgd2l0aCBtYW5pZmVzdC5qc29uICsgaW5kZXguanMgaW50byB0aGUgdHdlYWtzIGRpciwgdGhlbiByZWxvYWQuXCI7XG4gICAgICAgIHJvb3QuYXBwZW5kQ2hpbGQoZW1wdHkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIik7XG4gICAgICBsaXN0LnN0eWxlLmNzc1RleHQgPSBcImxpc3Qtc3R5bGU6bm9uZTttYXJnaW46MDtwYWRkaW5nOjA7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NnB4O1wiO1xuICAgICAgZm9yIChjb25zdCB0IG9mIHR3ZWFrcykge1xuICAgICAgICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICAgICAgbGkuc3R5bGUuY3NzVGV4dCA9XG4gICAgICAgICAgXCJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6OHB4IDEwcHg7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIsIzJhMmEyYSk7Ym9yZGVyLXJhZGl1czo2cHg7XCI7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICBsZWZ0LmlubmVySFRNTCA9IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udDo2MDAgMTNweCBzeXN0ZW0tdWk7XCI+JHtlc2NhcGUodC5tYW5pZmVzdC5uYW1lKX0gPHNwYW4gc3R5bGU9XCJjb2xvcjojODg4O2ZvbnQtd2VpZ2h0OjQwMDtcIj52JHtlc2NhcGUodC5tYW5pZmVzdC52ZXJzaW9uKX08L3NwYW4+PC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiM4ODg7Zm9udDoxMnB4IHN5c3RlbS11aTtcIj4ke2VzY2FwZSh0Lm1hbmlmZXN0LmRlc2NyaXB0aW9uID8/IHQubWFuaWZlc3QuaWQpfTwvZGl2PlxuICAgICAgICBgO1xuICAgICAgICBjb25zdCByaWdodCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHJpZ2h0LnN0eWxlLmNzc1RleHQgPSBcImNvbG9yOiM4ODg7Zm9udDoxMnB4IHN5c3RlbS11aTtcIjtcbiAgICAgICAgcmlnaHQudGV4dENvbnRlbnQgPSB0LmVudHJ5RXhpc3RzID8gXCJsb2FkZWRcIiA6IFwibWlzc2luZyBlbnRyeVwiO1xuICAgICAgICBsaS5hcHBlbmQobGVmdCwgcmlnaHQpO1xuICAgICAgICBsaXN0LmFwcGVuZChsaSk7XG4gICAgICB9XG4gICAgICByb290LmFwcGVuZChsaXN0KTtcbiAgICB9LFxuICB9KTtcbn1cblxuZnVuY3Rpb24gYnV0dG9uKGxhYmVsOiBzdHJpbmcsIG9uY2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICBiLnR5cGUgPSBcImJ1dHRvblwiO1xuICBiLnRleHRDb250ZW50ID0gbGFiZWw7XG4gIGIuc3R5bGUuY3NzVGV4dCA9XG4gICAgXCJwYWRkaW5nOjZweCAxMHB4O2JvcmRlcjoxcHggc29saWQgdmFyKC0tYm9yZGVyLCMzMzMpO2JvcmRlci1yYWRpdXM6NnB4O2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6aW5oZXJpdDtmb250OjEycHggc3lzdGVtLXVpO2N1cnNvcjpwb2ludGVyO1wiO1xuICBiLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbmNsaWNrKTtcbiAgcmV0dXJuIGI7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9bJjw+XCInXS9nLCAoYykgPT5cbiAgICBjID09PSBcIiZcIlxuICAgICAgPyBcIiZhbXA7XCJcbiAgICAgIDogYyA9PT0gXCI8XCJcbiAgICAgICAgPyBcIiZsdDtcIlxuICAgICAgICA6IGMgPT09IFwiPlwiXG4gICAgICAgICAgPyBcIiZndDtcIlxuICAgICAgICAgIDogYyA9PT0gJ1wiJ1xuICAgICAgICAgICAgPyBcIiZxdW90O1wiXG4gICAgICAgICAgICA6IFwiJiMzOTtcIixcbiAgKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQVdBLElBQUFBLG1CQUE0Qjs7O0FDNkJyQixTQUFTLG1CQUF5QjtBQUN2QyxNQUFJLE9BQU8sK0JBQWdDO0FBQzNDLFFBQU0sWUFBWSxvQkFBSSxJQUErQjtBQUNyRCxNQUFJLFNBQVM7QUFDYixRQUFNLFlBQVksb0JBQUksSUFBNEM7QUFFbEUsUUFBTSxPQUEwQjtBQUFBLElBQzlCLGVBQWU7QUFBQSxJQUNmO0FBQUEsSUFDQSxPQUFPLFVBQVU7QUFDZixZQUFNLEtBQUs7QUFDWCxnQkFBVSxJQUFJLElBQUksUUFBUTtBQUUxQixjQUFRO0FBQUEsUUFDTjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsU0FBUztBQUFBLE1BQ1g7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsR0FBRyxPQUFPLElBQUk7QUFDWixVQUFJLElBQUksVUFBVSxJQUFJLEtBQUs7QUFDM0IsVUFBSSxDQUFDLEVBQUcsV0FBVSxJQUFJLE9BQVEsSUFBSSxvQkFBSSxJQUFJLENBQUU7QUFDNUMsUUFBRSxJQUFJLEVBQUU7QUFBQSxJQUNWO0FBQUEsSUFDQSxJQUFJLE9BQU8sSUFBSTtBQUNiLGdCQUFVLElBQUksS0FBSyxHQUFHLE9BQU8sRUFBRTtBQUFBLElBQ2pDO0FBQUEsSUFDQSxLQUFLLFVBQVUsTUFBTTtBQUNuQixnQkFBVSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQUEsSUFDbkQ7QUFBQSxJQUNBLG9CQUFvQjtBQUFBLElBQUM7QUFBQSxJQUNyQix1QkFBdUI7QUFBQSxJQUFDO0FBQUEsSUFDeEIsc0JBQXNCO0FBQUEsSUFBQztBQUFBLElBQ3ZCLFdBQVc7QUFBQSxJQUFDO0FBQUEsRUFDZDtBQUVBLFNBQU8sZUFBZSxRQUFRLGtDQUFrQztBQUFBLElBQzlELGNBQWM7QUFBQSxJQUNkLFlBQVk7QUFBQSxJQUNaLFVBQVU7QUFBQTtBQUFBLElBQ1YsT0FBTztBQUFBLEVBQ1QsQ0FBQztBQUVELFNBQU8sY0FBYyxFQUFFLE1BQU0sVUFBVTtBQUN6QztBQUdPLFNBQVMsYUFBYSxNQUE0QjtBQUN2RCxRQUFNLFlBQVksT0FBTyxhQUFhO0FBQ3RDLE1BQUksV0FBVztBQUNiLGVBQVcsS0FBSyxVQUFVLE9BQU8sR0FBRztBQUNsQyxZQUFNLElBQUksRUFBRSwwQkFBMEIsSUFBSTtBQUMxQyxVQUFJLEVBQUcsUUFBTztBQUFBLElBQ2hCO0FBQUEsRUFDRjtBQUdBLGFBQVcsS0FBSyxPQUFPLEtBQUssSUFBSSxHQUFHO0FBQ2pDLFFBQUksRUFBRSxXQUFXLGNBQWMsRUFBRyxRQUFRLEtBQTRDLENBQUM7QUFBQSxFQUN6RjtBQUNBLFNBQU87QUFDVDs7O0FDL0VBLHNCQUE0QjtBQXlHNUIsSUFBTSxRQUF1QjtBQUFBLEVBQzNCLFVBQVUsb0JBQUksSUFBSTtBQUFBLEVBQ2xCLE9BQU8sb0JBQUksSUFBSTtBQUFBLEVBQ2YsY0FBYyxDQUFDO0FBQUEsRUFDZixjQUFjO0FBQUEsRUFDZCxVQUFVO0FBQUEsRUFDVixZQUFZO0FBQUEsRUFDWixZQUFZO0FBQUEsRUFDWixlQUFlO0FBQUEsRUFDZixXQUFXO0FBQUEsRUFDWCxVQUFVO0FBQUEsRUFDVixhQUFhO0FBQUEsRUFDYixlQUFlO0FBQUEsRUFDZixZQUFZO0FBQUEsRUFDWixhQUFhO0FBQUEsRUFDYix1QkFBdUI7QUFBQSxFQUN2Qix3QkFBd0I7QUFBQSxFQUN4QiwwQkFBMEI7QUFDNUI7QUFFQSxTQUFTLEtBQUssS0FBYSxPQUF1QjtBQUNoRCw4QkFBWTtBQUFBLElBQ1Y7QUFBQSxJQUNBO0FBQUEsSUFDQSx1QkFBdUIsR0FBRyxHQUFHLFVBQVUsU0FBWSxLQUFLLE1BQU0sY0FBYyxLQUFLLENBQUM7QUFBQSxFQUNwRjtBQUNGO0FBQ0EsU0FBUyxjQUFjLEdBQW9CO0FBQ3pDLE1BQUk7QUFDRixXQUFPLE9BQU8sTUFBTSxXQUFXLElBQUksS0FBSyxVQUFVLENBQUM7QUFBQSxFQUNyRCxRQUFRO0FBQ04sV0FBTyxPQUFPLENBQUM7QUFBQSxFQUNqQjtBQUNGO0FBSU8sU0FBUyx3QkFBOEI7QUFDNUMsTUFBSSxNQUFNLFNBQVU7QUFFcEIsUUFBTSxNQUFNLElBQUksaUJBQWlCLE1BQU07QUFDckMsY0FBVTtBQUNWLGlCQUFhO0FBQUEsRUFDZixDQUFDO0FBQ0QsTUFBSSxRQUFRLFNBQVMsaUJBQWlCLEVBQUUsV0FBVyxNQUFNLFNBQVMsS0FBSyxDQUFDO0FBQ3hFLFFBQU0sV0FBVztBQUVqQixTQUFPLGlCQUFpQixZQUFZLEtBQUs7QUFDekMsU0FBTyxpQkFBaUIsY0FBYyxLQUFLO0FBQzNDLFdBQVMsaUJBQWlCLFNBQVMsaUJBQWlCLElBQUk7QUFDeEQsYUFBVyxLQUFLLENBQUMsYUFBYSxjQUFjLEdBQVk7QUFDdEQsVUFBTSxPQUFPLFFBQVEsQ0FBQztBQUN0QixZQUFRLENBQUMsSUFBSSxZQUE0QixNQUErQjtBQUN0RSxZQUFNLElBQUksS0FBSyxNQUFNLE1BQU0sSUFBSTtBQUMvQixhQUFPLGNBQWMsSUFBSSxNQUFNLFdBQVcsQ0FBQyxFQUFFLENBQUM7QUFDOUMsYUFBTztBQUFBLElBQ1Q7QUFDQSxXQUFPLGlCQUFpQixXQUFXLENBQUMsSUFBSSxLQUFLO0FBQUEsRUFDL0M7QUFFQSxZQUFVO0FBQ1YsZUFBYTtBQUNiLE1BQUksUUFBUTtBQUNaLFFBQU0sV0FBVyxZQUFZLE1BQU07QUFDakM7QUFDQSxjQUFVO0FBQ1YsaUJBQWE7QUFDYixRQUFJLFFBQVEsR0FBSSxlQUFjLFFBQVE7QUFBQSxFQUN4QyxHQUFHLEdBQUc7QUFDUjtBQUVBLFNBQVMsUUFBYztBQUNyQixRQUFNLGNBQWM7QUFDcEIsWUFBVTtBQUNWLGVBQWE7QUFDZjtBQUVBLFNBQVMsZ0JBQWdCLEdBQXFCO0FBQzVDLFFBQU0sU0FBUyxFQUFFLGtCQUFrQixVQUFVLEVBQUUsU0FBUztBQUN4RCxRQUFNLFVBQVUsUUFBUSxRQUFRLHdCQUF3QjtBQUN4RCxNQUFJLEVBQUUsbUJBQW1CLGFBQWM7QUFDdkMsTUFBSSxvQkFBb0IsUUFBUSxlQUFlLEVBQUUsTUFBTSxjQUFlO0FBQ3RFLGFBQVcsTUFBTTtBQUNmLDhCQUEwQixPQUFPLGFBQWE7QUFBQSxFQUNoRCxHQUFHLENBQUM7QUFDTjtBQUVPLFNBQVMsZ0JBQWdCLFNBQTBDO0FBQ3hFLFFBQU0sU0FBUyxJQUFJLFFBQVEsSUFBSSxPQUFPO0FBQ3RDLE1BQUksTUFBTSxZQUFZLFNBQVMsU0FBVSxVQUFTO0FBQ2xELFNBQU87QUFBQSxJQUNMLFlBQVksTUFBTTtBQUNoQixZQUFNLFNBQVMsT0FBTyxRQUFRLEVBQUU7QUFDaEMsVUFBSSxNQUFNLFlBQVksU0FBUyxTQUFVLFVBQVM7QUFBQSxJQUNwRDtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsZ0JBQXNCO0FBQ3BDLFFBQU0sU0FBUyxNQUFNO0FBR3JCLGFBQVcsS0FBSyxNQUFNLE1BQU0sT0FBTyxHQUFHO0FBQ3BDLFFBQUk7QUFDRixRQUFFLFdBQVc7QUFBQSxJQUNmLFNBQVMsR0FBRztBQUNWLFdBQUssd0JBQXdCLEVBQUUsSUFBSSxFQUFFLElBQUksS0FBSyxPQUFPLENBQUMsRUFBRSxDQUFDO0FBQUEsSUFDM0Q7QUFBQSxFQUNGO0FBQ0EsUUFBTSxNQUFNLE1BQU07QUFDbEIsaUJBQWU7QUFHZixNQUNFLE1BQU0sWUFBWSxTQUFTLGdCQUMzQixDQUFDLE1BQU0sTUFBTSxJQUFJLE1BQU0sV0FBVyxFQUFFLEdBQ3BDO0FBQ0EscUJBQWlCO0FBQUEsRUFDbkIsV0FBVyxNQUFNLFlBQVksU0FBUyxVQUFVO0FBQzlDLGFBQVM7QUFBQSxFQUNYO0FBQ0Y7QUFPTyxTQUFTLGFBQ2QsU0FDQSxVQUNBLE1BQ2dCO0FBQ2hCLFFBQU0sS0FBSyxLQUFLO0FBQ2hCLFFBQU0sUUFBd0IsRUFBRSxJQUFJLFNBQVMsVUFBVSxLQUFLO0FBQzVELFFBQU0sTUFBTSxJQUFJLElBQUksS0FBSztBQUN6QixPQUFLLGdCQUFnQixFQUFFLElBQUksT0FBTyxLQUFLLE9BQU8sUUFBUSxDQUFDO0FBQ3ZELGlCQUFlO0FBRWYsTUFBSSxNQUFNLFlBQVksU0FBUyxnQkFBZ0IsTUFBTSxXQUFXLE9BQU8sSUFBSTtBQUN6RSxhQUFTO0FBQUEsRUFDWDtBQUNBLFNBQU87QUFBQSxJQUNMLFlBQVksTUFBTTtBQUNoQixZQUFNLElBQUksTUFBTSxNQUFNLElBQUksRUFBRTtBQUM1QixVQUFJLENBQUMsRUFBRztBQUNSLFVBQUk7QUFDRixVQUFFLFdBQVc7QUFBQSxNQUNmLFFBQVE7QUFBQSxNQUFDO0FBQ1QsWUFBTSxNQUFNLE9BQU8sRUFBRTtBQUNyQixxQkFBZTtBQUNmLFVBQUksTUFBTSxZQUFZLFNBQVMsZ0JBQWdCLE1BQU0sV0FBVyxPQUFPLElBQUk7QUFDekUseUJBQWlCO0FBQUEsTUFDbkI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGO0FBR08sU0FBUyxnQkFBZ0IsTUFBMkI7QUFDekQsUUFBTSxlQUFlO0FBQ3JCLE1BQUksTUFBTSxZQUFZLFNBQVMsU0FBVSxVQUFTO0FBQ3BEO0FBSUEsU0FBUyxZQUFrQjtBQUN6QixRQUFNLGFBQWEsc0JBQXNCO0FBQ3pDLE1BQUksQ0FBQyxZQUFZO0FBQ2Ysa0NBQThCO0FBQzlCLFNBQUssbUJBQW1CO0FBQ3hCO0FBQUEsRUFDRjtBQUNBLE1BQUksTUFBTSwwQkFBMEI7QUFDbEMsaUJBQWEsTUFBTSx3QkFBd0I7QUFDM0MsVUFBTSwyQkFBMkI7QUFBQSxFQUNuQztBQUNBLDRCQUEwQixNQUFNLGVBQWU7QUFJL0MsUUFBTSxRQUFRLFdBQVcsaUJBQWlCO0FBQzFDLFFBQU0sY0FBYztBQUVwQixNQUFJLE1BQU0sWUFBWSxNQUFNLFNBQVMsTUFBTSxRQUFRLEdBQUc7QUFDcEQsbUJBQWU7QUFJZixRQUFJLE1BQU0sZUFBZSxLQUFNLDBCQUF5QixJQUFJO0FBQzVEO0FBQUEsRUFDRjtBQVVBLE1BQUksTUFBTSxlQUFlLFFBQVEsTUFBTSxjQUFjLE1BQU07QUFDekQsU0FBSywwREFBMEQ7QUFBQSxNQUM3RCxZQUFZLE1BQU07QUFBQSxJQUNwQixDQUFDO0FBQ0QsVUFBTSxhQUFhO0FBQ25CLFVBQU0sWUFBWTtBQUFBLEVBQ3BCO0FBR0EsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sUUFBUSxVQUFVO0FBQ3hCLFFBQU0sWUFBWTtBQU1sQixRQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsU0FBTyxZQUNMO0FBQ0YsU0FBTyxjQUFjO0FBQ3JCLFFBQU0sWUFBWSxNQUFNO0FBR3hCLFFBQU0sWUFBWSxnQkFBZ0IsVUFBVSxjQUFjLENBQUM7QUFDM0QsUUFBTSxZQUFZLGdCQUFnQixVQUFVLGNBQWMsQ0FBQztBQUUzRCxZQUFVLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUN6QyxNQUFFLGVBQWU7QUFDakIsTUFBRSxnQkFBZ0I7QUFDbEIsaUJBQWEsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUFBLEVBQ2pDLENBQUM7QUFDRCxZQUFVLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUN6QyxNQUFFLGVBQWU7QUFDakIsTUFBRSxnQkFBZ0I7QUFDbEIsaUJBQWEsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUFBLEVBQ2pDLENBQUM7QUFFRCxRQUFNLFlBQVksU0FBUztBQUMzQixRQUFNLFlBQVksU0FBUztBQUMzQixRQUFNLFlBQVksS0FBSztBQUV2QixRQUFNLFdBQVc7QUFDakIsUUFBTSxhQUFhLEVBQUUsUUFBUSxXQUFXLFFBQVEsVUFBVTtBQUMxRCxPQUFLLHNCQUFzQixFQUFFLFVBQVUsTUFBTSxRQUFRLENBQUM7QUFDdEQsaUJBQWU7QUFDakI7QUFFQSxTQUFTLGdDQUFzQztBQUM3QyxNQUFJLENBQUMsTUFBTSwwQkFBMEIsTUFBTSx5QkFBMEI7QUFDckUsUUFBTSwyQkFBMkIsV0FBVyxNQUFNO0FBQ2hELFVBQU0sMkJBQTJCO0FBQ2pDLFFBQUksc0JBQXNCLEVBQUc7QUFDN0IsUUFBSSxzQkFBc0IsRUFBRztBQUM3Qiw4QkFBMEIsT0FBTyxtQkFBbUI7QUFBQSxFQUN0RCxHQUFHLElBQUk7QUFDVDtBQUVBLFNBQVMsd0JBQWlDO0FBQ3hDLFFBQU0sT0FBTyxvQkFBb0IsU0FBUyxNQUFNLGVBQWUsRUFBRSxFQUFFLFlBQVk7QUFDL0UsU0FDRSxLQUFLLFNBQVMsYUFBYSxLQUMzQixLQUFLLFNBQVMsU0FBUyxLQUN2QixLQUFLLFNBQVMsWUFBWSxNQUN6QixLQUFLLFNBQVMsZUFBZSxLQUFLLEtBQUssU0FBUyxxQkFBcUI7QUFFMUU7QUFFQSxTQUFTLG9CQUFvQixPQUF1QjtBQUNsRCxTQUFPLE9BQU8sU0FBUyxFQUFFLEVBQUUsUUFBUSxRQUFRLEdBQUcsRUFBRSxLQUFLO0FBQ3ZEO0FBRUEsU0FBUywwQkFBMEIsU0FBa0IsUUFBc0I7QUFDekUsTUFBSSxNQUFNLDJCQUEyQixRQUFTO0FBQzlDLFFBQU0seUJBQXlCO0FBQy9CLE1BQUk7QUFDRixJQUFDLE9BQWtFLGtDQUFrQztBQUNyRyxhQUFTLGdCQUFnQixRQUFRLHlCQUF5QixVQUFVLFNBQVM7QUFDN0UsV0FBTztBQUFBLE1BQ0wsSUFBSSxZQUFZLDRCQUE0QjtBQUFBLFFBQzFDLFFBQVEsRUFBRSxTQUFTLE9BQU87QUFBQSxNQUM1QixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0YsUUFBUTtBQUFBLEVBQUM7QUFDVCxPQUFLLG9CQUFvQixFQUFFLFNBQVMsUUFBUSxLQUFLLFNBQVMsS0FBSyxDQUFDO0FBQ2xFO0FBT0EsU0FBUyxpQkFBdUI7QUFDOUIsUUFBTSxRQUFRLE1BQU07QUFDcEIsTUFBSSxDQUFDLE1BQU87QUFDWixRQUFNLFFBQVEsQ0FBQyxHQUFHLE1BQU0sTUFBTSxPQUFPLENBQUM7QUFNdEMsUUFBTSxhQUFhLE1BQU0sV0FBVyxJQUNoQyxVQUNBLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssS0FBSyxJQUFJLEVBQUUsS0FBSyxXQUFXLEVBQUUsRUFBRSxFQUFFLEtBQUssSUFBSTtBQUNqRixRQUFNLGdCQUFnQixDQUFDLENBQUMsTUFBTSxjQUFjLE1BQU0sU0FBUyxNQUFNLFVBQVU7QUFDM0UsTUFBSSxNQUFNLGtCQUFrQixlQUFlLE1BQU0sV0FBVyxJQUFJLENBQUMsZ0JBQWdCLGdCQUFnQjtBQUMvRjtBQUFBLEVBQ0Y7QUFFQSxNQUFJLE1BQU0sV0FBVyxHQUFHO0FBQ3RCLFFBQUksTUFBTSxZQUFZO0FBQ3BCLFlBQU0sV0FBVyxPQUFPO0FBQ3hCLFlBQU0sYUFBYTtBQUFBLElBQ3JCO0FBQ0EsZUFBVyxLQUFLLE1BQU0sTUFBTSxPQUFPLEVBQUcsR0FBRSxZQUFZO0FBQ3BELFVBQU0sZ0JBQWdCO0FBQ3RCO0FBQUEsRUFDRjtBQUVBLE1BQUksUUFBUSxNQUFNO0FBQ2xCLE1BQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxTQUFTLEtBQUssR0FBRztBQUNwQyxZQUFRLFNBQVMsY0FBYyxLQUFLO0FBQ3BDLFVBQU0sUUFBUSxVQUFVO0FBQ3hCLFVBQU0sWUFBWTtBQUNsQixVQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsV0FBTyxZQUNMO0FBQ0YsV0FBTyxjQUFjO0FBQ3JCLFVBQU0sWUFBWSxNQUFNO0FBQ3hCLFVBQU0sWUFBWSxLQUFLO0FBQ3ZCLFVBQU0sYUFBYTtBQUFBLEVBQ3JCLE9BQU87QUFFTCxXQUFPLE1BQU0sU0FBUyxTQUFTLEVBQUcsT0FBTSxZQUFZLE1BQU0sU0FBVTtBQUFBLEVBQ3RFO0FBRUEsYUFBVyxLQUFLLE9BQU87QUFDckIsVUFBTSxPQUFPLEVBQUUsS0FBSyxXQUFXLG1CQUFtQjtBQUNsRCxVQUFNLE1BQU0sZ0JBQWdCLEVBQUUsS0FBSyxPQUFPLElBQUk7QUFDOUMsUUFBSSxRQUFRLFVBQVUsWUFBWSxFQUFFLEVBQUU7QUFDdEMsUUFBSSxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDbkMsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBQ2xCLG1CQUFhLEVBQUUsTUFBTSxjQUFjLElBQUksRUFBRSxHQUFHLENBQUM7QUFBQSxJQUMvQyxDQUFDO0FBQ0QsTUFBRSxZQUFZO0FBQ2QsVUFBTSxZQUFZLEdBQUc7QUFBQSxFQUN2QjtBQUNBLFFBQU0sZ0JBQWdCO0FBQ3RCLE9BQUssc0JBQXNCO0FBQUEsSUFDekIsT0FBTyxNQUFNO0FBQUEsSUFDYixLQUFLLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFO0FBQUEsRUFDNUIsQ0FBQztBQUVELGVBQWEsTUFBTSxVQUFVO0FBQy9CO0FBRUEsU0FBUyxnQkFBZ0IsT0FBZSxTQUFvQztBQUUxRSxRQUFNLE1BQU0sU0FBUyxjQUFjLFFBQVE7QUFDM0MsTUFBSSxPQUFPO0FBQ1gsTUFBSSxRQUFRLFVBQVUsT0FBTyxNQUFNLFlBQVksQ0FBQztBQUNoRCxNQUFJLGFBQWEsY0FBYyxLQUFLO0FBQ3BDLE1BQUksWUFDRjtBQUVGLFFBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxRQUFNLFlBQ0o7QUFDRixRQUFNLFlBQVksR0FBRyxPQUFPLDBCQUEwQixLQUFLO0FBQzNELE1BQUksWUFBWSxLQUFLO0FBQ3JCLFNBQU87QUFDVDtBQUtBLFNBQVMsYUFBYSxRQUFpQztBQUVyRCxNQUFJLE1BQU0sWUFBWTtBQUNwQixVQUFNLFVBQ0osUUFBUSxTQUFTLFdBQVcsV0FDNUIsUUFBUSxTQUFTLFdBQVcsV0FBVztBQUN6QyxlQUFXLENBQUMsS0FBSyxHQUFHLEtBQUssT0FBTyxRQUFRLE1BQU0sVUFBVSxHQUF5QztBQUMvRixxQkFBZSxLQUFLLFFBQVEsT0FBTztBQUFBLElBQ3JDO0FBQUEsRUFDRjtBQUVBLGFBQVcsS0FBSyxNQUFNLE1BQU0sT0FBTyxHQUFHO0FBQ3BDLFFBQUksQ0FBQyxFQUFFLFVBQVc7QUFDbEIsVUFBTSxXQUFXLFFBQVEsU0FBUyxnQkFBZ0IsT0FBTyxPQUFPLEVBQUU7QUFDbEUsbUJBQWUsRUFBRSxXQUFXLFFBQVE7QUFBQSxFQUN0QztBQU1BLDJCQUF5QixXQUFXLElBQUk7QUFDMUM7QUFZQSxTQUFTLHlCQUF5QixNQUFxQjtBQUNyRCxNQUFJLENBQUMsS0FBTTtBQUNYLFFBQU0sT0FBTyxNQUFNO0FBQ25CLE1BQUksQ0FBQyxLQUFNO0FBQ1gsUUFBTSxVQUFVLE1BQU0sS0FBSyxLQUFLLGlCQUFvQyxRQUFRLENBQUM7QUFDN0UsYUFBVyxPQUFPLFNBQVM7QUFFekIsUUFBSSxJQUFJLFFBQVEsUUFBUztBQUN6QixRQUFJLElBQUksYUFBYSxjQUFjLE1BQU0sUUFBUTtBQUMvQyxVQUFJLGdCQUFnQixjQUFjO0FBQUEsSUFDcEM7QUFDQSxRQUFJLElBQUksVUFBVSxTQUFTLGdDQUFnQyxHQUFHO0FBQzVELFVBQUksVUFBVSxPQUFPLGdDQUFnQztBQUNyRCxVQUFJLFVBQVUsSUFBSSxzQ0FBc0M7QUFBQSxJQUMxRDtBQUFBLEVBQ0Y7QUFDRjtBQUVBLFNBQVMsZUFBZSxLQUF3QixRQUF1QjtBQUNyRSxRQUFNLFFBQVEsSUFBSTtBQUNsQixNQUFJLFFBQVE7QUFDUixRQUFJLFVBQVUsT0FBTyx3Q0FBd0MsYUFBYTtBQUMxRSxRQUFJLFVBQVUsSUFBSSxnQ0FBZ0M7QUFDbEQsUUFBSSxhQUFhLGdCQUFnQixNQUFNO0FBQ3ZDLFFBQUksT0FBTztBQUNULFlBQU0sVUFBVSxPQUFPLHVCQUF1QjtBQUM5QyxZQUFNLFVBQVUsSUFBSSw2Q0FBNkM7QUFDakUsWUFDRyxjQUFjLEtBQUssR0FDbEIsVUFBVSxJQUFJLGtEQUFrRDtBQUFBLElBQ3RFO0FBQUEsRUFDRixPQUFPO0FBQ0wsUUFBSSxVQUFVLElBQUksd0NBQXdDLGFBQWE7QUFDdkUsUUFBSSxVQUFVLE9BQU8sZ0NBQWdDO0FBQ3JELFFBQUksZ0JBQWdCLGNBQWM7QUFDbEMsUUFBSSxPQUFPO0FBQ1QsWUFBTSxVQUFVLElBQUksdUJBQXVCO0FBQzNDLFlBQU0sVUFBVSxPQUFPLDZDQUE2QztBQUNwRSxZQUNHLGNBQWMsS0FBSyxHQUNsQixVQUFVLE9BQU8sa0RBQWtEO0FBQUEsSUFDekU7QUFBQSxFQUNGO0FBQ0o7QUFJQSxTQUFTLGFBQWEsTUFBd0I7QUFDNUMsUUFBTSxVQUFVLGdCQUFnQjtBQUNoQyxNQUFJLENBQUMsU0FBUztBQUNaLFNBQUssa0NBQWtDO0FBQ3ZDO0FBQUEsRUFDRjtBQUNBLFFBQU0sYUFBYTtBQUNuQixPQUFLLFlBQVksRUFBRSxLQUFLLENBQUM7QUFHekIsYUFBVyxTQUFTLE1BQU0sS0FBSyxRQUFRLFFBQVEsR0FBb0I7QUFDakUsUUFBSSxNQUFNLFFBQVEsWUFBWSxlQUFnQjtBQUM5QyxRQUFJLE1BQU0sUUFBUSxrQkFBa0IsUUFBVztBQUM3QyxZQUFNLFFBQVEsZ0JBQWdCLE1BQU0sTUFBTSxXQUFXO0FBQUEsSUFDdkQ7QUFDQSxVQUFNLE1BQU0sVUFBVTtBQUFBLEVBQ3hCO0FBQ0EsTUFBSSxRQUFRLFFBQVEsY0FBMkIsK0JBQStCO0FBQzlFLE1BQUksQ0FBQyxPQUFPO0FBQ1YsWUFBUSxTQUFTLGNBQWMsS0FBSztBQUNwQyxVQUFNLFFBQVEsVUFBVTtBQUN4QixVQUFNLE1BQU0sVUFBVTtBQUN0QixZQUFRLFlBQVksS0FBSztBQUFBLEVBQzNCO0FBQ0EsUUFBTSxNQUFNLFVBQVU7QUFDdEIsUUFBTSxZQUFZO0FBQ2xCLFdBQVM7QUFDVCxlQUFhLElBQUk7QUFFakIsUUFBTSxVQUFVLE1BQU07QUFDdEIsTUFBSSxTQUFTO0FBQ1gsUUFBSSxNQUFNLHVCQUF1QjtBQUMvQixjQUFRLG9CQUFvQixTQUFTLE1BQU0sdUJBQXVCLElBQUk7QUFBQSxJQUN4RTtBQUNBLFVBQU0sVUFBVSxDQUFDLE1BQWE7QUFDNUIsWUFBTSxTQUFTLEVBQUU7QUFDakIsVUFBSSxDQUFDLE9BQVE7QUFDYixVQUFJLE1BQU0sVUFBVSxTQUFTLE1BQU0sRUFBRztBQUN0QyxVQUFJLE1BQU0sWUFBWSxTQUFTLE1BQU0sRUFBRztBQUN4Qyx1QkFBaUI7QUFBQSxJQUNuQjtBQUNBLFVBQU0sd0JBQXdCO0FBQzlCLFlBQVEsaUJBQWlCLFNBQVMsU0FBUyxJQUFJO0FBQUEsRUFDakQ7QUFDRjtBQUVBLFNBQVMsbUJBQXlCO0FBQ2hDLE9BQUssb0JBQW9CO0FBQ3pCLFFBQU0sVUFBVSxnQkFBZ0I7QUFDaEMsTUFBSSxDQUFDLFFBQVM7QUFDZCxNQUFJLE1BQU0sVUFBVyxPQUFNLFVBQVUsTUFBTSxVQUFVO0FBQ3JELGFBQVcsU0FBUyxNQUFNLEtBQUssUUFBUSxRQUFRLEdBQW9CO0FBQ2pFLFFBQUksVUFBVSxNQUFNLFVBQVc7QUFDL0IsUUFBSSxNQUFNLFFBQVEsa0JBQWtCLFFBQVc7QUFDN0MsWUFBTSxNQUFNLFVBQVUsTUFBTSxRQUFRO0FBQ3BDLGFBQU8sTUFBTSxRQUFRO0FBQUEsSUFDdkI7QUFBQSxFQUNGO0FBQ0EsUUFBTSxhQUFhO0FBQ25CLGVBQWEsSUFBSTtBQUNqQixNQUFJLE1BQU0sZUFBZSxNQUFNLHVCQUF1QjtBQUNwRCxVQUFNLFlBQVk7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQ0EsVUFBTSx3QkFBd0I7QUFBQSxFQUNoQztBQUNGO0FBRUEsU0FBUyxXQUFpQjtBQUN4QixNQUFJLENBQUMsTUFBTSxXQUFZO0FBQ3ZCLFFBQU0sT0FBTyxNQUFNO0FBQ25CLE1BQUksQ0FBQyxLQUFNO0FBQ1gsT0FBSyxZQUFZO0FBRWpCLFFBQU0sS0FBSyxNQUFNO0FBQ2pCLE1BQUksR0FBRyxTQUFTLGNBQWM7QUFDNUIsVUFBTSxRQUFRLE1BQU0sTUFBTSxJQUFJLEdBQUcsRUFBRTtBQUNuQyxRQUFJLENBQUMsT0FBTztBQUNWLHVCQUFpQjtBQUNqQjtBQUFBLElBQ0Y7QUFDQSxVQUFNQyxRQUFPLFdBQVcsTUFBTSxLQUFLLE9BQU8sTUFBTSxLQUFLLFdBQVc7QUFDaEUsU0FBSyxZQUFZQSxNQUFLLEtBQUs7QUFDM0IsUUFBSTtBQUVGLFVBQUk7QUFBRSxjQUFNLFdBQVc7QUFBQSxNQUFHLFFBQVE7QUFBQSxNQUFDO0FBQ25DLFlBQU0sV0FBVztBQUNqQixZQUFNLE1BQU0sTUFBTSxLQUFLLE9BQU9BLE1BQUssWUFBWTtBQUMvQyxVQUFJLE9BQU8sUUFBUSxXQUFZLE9BQU0sV0FBVztBQUFBLElBQ2xELFNBQVMsR0FBRztBQUNWLFlBQU0sTUFBTSxTQUFTLGNBQWMsS0FBSztBQUN4QyxVQUFJLFlBQVk7QUFDaEIsVUFBSSxjQUFjLHlCQUEwQixFQUFZLE9BQU87QUFDL0QsTUFBQUEsTUFBSyxhQUFhLFlBQVksR0FBRztBQUFBLElBQ25DO0FBQ0E7QUFBQSxFQUNGO0FBRUEsUUFBTSxRQUFRLEdBQUcsU0FBUyxXQUFXLFdBQVc7QUFDaEQsUUFBTSxXQUFXLEdBQUcsU0FBUyxXQUN6QiwwQ0FDQTtBQUNKLFFBQU0sT0FBTyxXQUFXLE9BQU8sUUFBUTtBQUN2QyxPQUFLLFlBQVksS0FBSyxLQUFLO0FBQzNCLE1BQUksR0FBRyxTQUFTLFNBQVUsa0JBQWlCLEtBQUssWUFBWTtBQUFBLE1BQ3ZELGtCQUFpQixLQUFLLFlBQVk7QUFDekM7QUFJQSxTQUFTLGlCQUFpQixjQUFpQztBQUN6RCxRQUFNLFVBQVUsU0FBUyxjQUFjLFNBQVM7QUFDaEQsVUFBUSxZQUFZO0FBQ3BCLFVBQVEsWUFBWSxhQUFhLGlCQUFpQixDQUFDO0FBQ25ELFFBQU0sT0FBTyxZQUFZO0FBQ3pCLFFBQU0sVUFBVSxVQUFVLDJCQUEyQix5Q0FBeUM7QUFDOUYsT0FBSyxZQUFZLE9BQU87QUFDeEIsVUFBUSxZQUFZLElBQUk7QUFDeEIsZUFBYSxZQUFZLE9BQU87QUFFaEMsT0FBSyw0QkFDRixPQUFPLG9CQUFvQixFQUMzQixLQUFLLENBQUMsV0FBVztBQUNoQixTQUFLLGNBQWM7QUFDbkIsOEJBQTBCLE1BQU0sTUFBNkI7QUFBQSxFQUMvRCxDQUFDLEVBQ0EsTUFBTSxDQUFDLE1BQU07QUFDWixTQUFLLGNBQWM7QUFDbkIsU0FBSyxZQUFZLFVBQVUsa0NBQWtDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUN6RSxDQUFDO0FBRUgsUUFBTSxVQUFVLFNBQVMsY0FBYyxTQUFTO0FBQ2hELFVBQVEsWUFBWTtBQUNwQixVQUFRLFlBQVksYUFBYSxxQkFBcUIsQ0FBQztBQUN2RCxRQUFNLGNBQWMsWUFBWTtBQUNoQyxjQUFZLFlBQVksVUFBVSxvQkFBb0IsdUNBQXVDLENBQUM7QUFDOUYsVUFBUSxZQUFZLFdBQVc7QUFDL0IsZUFBYSxZQUFZLE9BQU87QUFDaEMsMEJBQXdCLFdBQVc7QUFFbkMsUUFBTSxjQUFjLFNBQVMsY0FBYyxTQUFTO0FBQ3BELGNBQVksWUFBWTtBQUN4QixjQUFZLFlBQVksYUFBYSxhQUFhLENBQUM7QUFDbkQsUUFBTSxrQkFBa0IsWUFBWTtBQUNwQyxrQkFBZ0IsWUFBWSxhQUFhLENBQUM7QUFDMUMsa0JBQWdCLFlBQVksYUFBYSxDQUFDO0FBQzFDLGNBQVksWUFBWSxlQUFlO0FBQ3ZDLGVBQWEsWUFBWSxXQUFXO0FBQ3RDO0FBRUEsU0FBUywwQkFBMEIsTUFBbUIsUUFBbUM7QUFDdkYsT0FBSyxZQUFZLGNBQWMsTUFBTSxDQUFDO0FBQ3RDLE9BQUssWUFBWSxtQkFBbUIsT0FBTyxXQUFXLENBQUM7QUFDdkQsTUFBSSxPQUFPLFlBQWEsTUFBSyxZQUFZLGdCQUFnQixPQUFPLFdBQVcsQ0FBQztBQUM5RTtBQUVBLFNBQVMsY0FBYyxRQUEwQztBQUMvRCxRQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsTUFBSSxZQUFZO0FBQ2hCLFFBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxPQUFLLFlBQVk7QUFDakIsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sWUFBWTtBQUNsQixRQUFNLGNBQWM7QUFDcEIsUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFBWTtBQUNqQixPQUFLLGNBQWMsc0JBQXNCLE9BQU8sT0FBTztBQUN2RCxPQUFLLFlBQVksS0FBSztBQUN0QixPQUFLLFlBQVksSUFBSTtBQUNyQixNQUFJLFlBQVksSUFBSTtBQUNwQixNQUFJO0FBQUEsSUFDRixjQUFjLE9BQU8sWUFBWSxPQUFPLFNBQVM7QUFDL0MsWUFBTSw0QkFBWSxPQUFPLDJCQUEyQixJQUFJO0FBQUEsSUFDMUQsQ0FBQztBQUFBLEVBQ0g7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLG1CQUFtQixPQUFxRDtBQUMvRSxRQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsTUFBSSxZQUFZO0FBQ2hCLFFBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxPQUFLLFlBQVk7QUFDakIsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sWUFBWTtBQUNsQixRQUFNLGNBQWMsT0FBTyxrQkFBa0IsNkJBQTZCO0FBQzFFLFFBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxPQUFLLFlBQVk7QUFDakIsT0FBSyxjQUFjLGNBQWMsS0FBSztBQUN0QyxPQUFLLFlBQVksS0FBSztBQUN0QixPQUFLLFlBQVksSUFBSTtBQUNyQixNQUFJLFlBQVksSUFBSTtBQUVwQixRQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsVUFBUSxZQUFZO0FBQ3BCLE1BQUksT0FBTyxZQUFZO0FBQ3JCLFlBQVE7QUFBQSxNQUNOLGNBQWMsaUJBQWlCLE1BQU07QUFDbkMsYUFBSyw0QkFBWSxPQUFPLHlCQUF5QixNQUFNLFVBQVU7QUFBQSxNQUNuRSxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDQSxVQUFRO0FBQUEsSUFDTixjQUFjLGFBQWEsTUFBTTtBQUMvQixVQUFJLE1BQU0sVUFBVTtBQUNwQixXQUFLLDRCQUNGLE9BQU8sZ0NBQWdDLElBQUksRUFDM0MsS0FBSyxDQUFDLFNBQVM7QUFDZCxjQUFNLE9BQU8sSUFBSTtBQUNqQixZQUFJLENBQUMsS0FBTTtBQUNYLGFBQUssY0FBYztBQUNuQixhQUFLLDRCQUFZLE9BQU8sb0JBQW9CLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFDN0Qsb0NBQTBCLE1BQU07QUFBQSxZQUM5QixHQUFJO0FBQUEsWUFDSixhQUFhO0FBQUEsVUFDZixDQUFDO0FBQUEsUUFDSCxDQUFDO0FBQUEsTUFDSCxDQUFDLEVBQ0EsTUFBTSxDQUFDLE1BQU0sS0FBSywrQkFBK0IsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUMzRCxRQUFRLE1BQU07QUFDYixZQUFJLE1BQU0sVUFBVTtBQUFBLE1BQ3RCLENBQUM7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxZQUFZLE9BQU87QUFDdkIsU0FBTztBQUNUO0FBRUEsU0FBUyxnQkFBZ0IsT0FBOEM7QUFDckUsUUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLE1BQUksWUFBWTtBQUNoQixRQUFNLFFBQVEsU0FBUyxjQUFjLEtBQUs7QUFDMUMsUUFBTSxZQUFZO0FBQ2xCLFFBQU0sY0FBYztBQUNwQixNQUFJLFlBQVksS0FBSztBQUNyQixRQUFNLE9BQU8sU0FBUyxjQUFjLEtBQUs7QUFDekMsT0FBSyxZQUNIO0FBQ0YsT0FBSyxZQUFZLDJCQUEyQixNQUFNLGNBQWMsS0FBSyxLQUFLLE1BQU0sU0FBUyw2QkFBNkIsQ0FBQztBQUN2SCxNQUFJLFlBQVksSUFBSTtBQUNwQixTQUFPO0FBQ1Q7QUFFQSxTQUFTLDJCQUEyQixVQUErQjtBQUNqRSxRQUFNLE9BQU8sU0FBUyxjQUFjLEtBQUs7QUFDekMsT0FBSyxZQUFZO0FBQ2pCLFFBQU0sUUFBUSxTQUFTLFFBQVEsVUFBVSxJQUFJLEVBQUUsTUFBTSxJQUFJO0FBQ3pELE1BQUksWUFBc0IsQ0FBQztBQUMzQixNQUFJLE9BQW1EO0FBQ3ZELE1BQUksWUFBNkI7QUFFakMsUUFBTSxpQkFBaUIsTUFBTTtBQUMzQixRQUFJLFVBQVUsV0FBVyxFQUFHO0FBQzVCLFVBQU0sSUFBSSxTQUFTLGNBQWMsR0FBRztBQUNwQyxNQUFFLFlBQVk7QUFDZCx5QkFBcUIsR0FBRyxVQUFVLEtBQUssR0FBRyxFQUFFLEtBQUssQ0FBQztBQUNsRCxTQUFLLFlBQVksQ0FBQztBQUNsQixnQkFBWSxDQUFDO0FBQUEsRUFDZjtBQUNBLFFBQU0sWUFBWSxNQUFNO0FBQ3RCLFFBQUksQ0FBQyxLQUFNO0FBQ1gsU0FBSyxZQUFZLElBQUk7QUFDckIsV0FBTztBQUFBLEVBQ1Q7QUFDQSxRQUFNLFlBQVksTUFBTTtBQUN0QixRQUFJLENBQUMsVUFBVztBQUNoQixVQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsUUFBSSxZQUNGO0FBQ0YsVUFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLFNBQUssY0FBYyxVQUFVLEtBQUssSUFBSTtBQUN0QyxRQUFJLFlBQVksSUFBSTtBQUNwQixTQUFLLFlBQVksR0FBRztBQUNwQixnQkFBWTtBQUFBLEVBQ2Q7QUFFQSxhQUFXLFFBQVEsT0FBTztBQUN4QixRQUFJLEtBQUssS0FBSyxFQUFFLFdBQVcsS0FBSyxHQUFHO0FBQ2pDLFVBQUksVUFBVyxXQUFVO0FBQUEsV0FDcEI7QUFDSCx1QkFBZTtBQUNmLGtCQUFVO0FBQ1Ysb0JBQVksQ0FBQztBQUFBLE1BQ2Y7QUFDQTtBQUFBLElBQ0Y7QUFDQSxRQUFJLFdBQVc7QUFDYixnQkFBVSxLQUFLLElBQUk7QUFDbkI7QUFBQSxJQUNGO0FBRUEsVUFBTSxVQUFVLEtBQUssS0FBSztBQUMxQixRQUFJLENBQUMsU0FBUztBQUNaLHFCQUFlO0FBQ2YsZ0JBQVU7QUFDVjtBQUFBLElBQ0Y7QUFFQSxVQUFNLFVBQVUsb0JBQW9CLEtBQUssT0FBTztBQUNoRCxRQUFJLFNBQVM7QUFDWCxxQkFBZTtBQUNmLGdCQUFVO0FBQ1YsWUFBTSxJQUFJLFNBQVMsY0FBYyxRQUFRLENBQUMsRUFBRSxXQUFXLElBQUksT0FBTyxJQUFJO0FBQ3RFLFFBQUUsWUFBWTtBQUNkLDJCQUFxQixHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBQ2xDLFdBQUssWUFBWSxDQUFDO0FBQ2xCO0FBQUEsSUFDRjtBQUVBLFVBQU0sWUFBWSxnQkFBZ0IsS0FBSyxPQUFPO0FBQzlDLFVBQU0sVUFBVSxtQkFBbUIsS0FBSyxPQUFPO0FBQy9DLFFBQUksYUFBYSxTQUFTO0FBQ3hCLHFCQUFlO0FBQ2YsWUFBTSxjQUFjLFFBQVEsT0FBTztBQUNuQyxVQUFJLENBQUMsUUFBUyxlQUFlLEtBQUssWUFBWSxRQUFVLENBQUMsZUFBZSxLQUFLLFlBQVksTUFBTztBQUM5RixrQkFBVTtBQUNWLGVBQU8sU0FBUyxjQUFjLGNBQWMsT0FBTyxJQUFJO0FBQ3ZELGFBQUssWUFBWSxjQUNiLDhDQUNBO0FBQUEsTUFDTjtBQUNBLFlBQU0sS0FBSyxTQUFTLGNBQWMsSUFBSTtBQUN0QywyQkFBcUIsS0FBSyxhQUFhLFdBQVcsQ0FBQyxLQUFLLEVBQUU7QUFDMUQsV0FBSyxZQUFZLEVBQUU7QUFDbkI7QUFBQSxJQUNGO0FBRUEsVUFBTSxRQUFRLGFBQWEsS0FBSyxPQUFPO0FBQ3ZDLFFBQUksT0FBTztBQUNULHFCQUFlO0FBQ2YsZ0JBQVU7QUFDVixZQUFNLGFBQWEsU0FBUyxjQUFjLFlBQVk7QUFDdEQsaUJBQVcsWUFBWTtBQUN2QiwyQkFBcUIsWUFBWSxNQUFNLENBQUMsQ0FBQztBQUN6QyxXQUFLLFlBQVksVUFBVTtBQUMzQjtBQUFBLElBQ0Y7QUFFQSxjQUFVLEtBQUssT0FBTztBQUFBLEVBQ3hCO0FBRUEsaUJBQWU7QUFDZixZQUFVO0FBQ1YsWUFBVTtBQUNWLFNBQU87QUFDVDtBQUVBLFNBQVMscUJBQXFCLFFBQXFCLE1BQW9CO0FBQ3JFLFFBQU0sVUFBVTtBQUNoQixNQUFJLFlBQVk7QUFDaEIsYUFBVyxTQUFTLEtBQUssU0FBUyxPQUFPLEdBQUc7QUFDMUMsUUFBSSxNQUFNLFVBQVUsT0FBVztBQUMvQixlQUFXLFFBQVEsS0FBSyxNQUFNLFdBQVcsTUFBTSxLQUFLLENBQUM7QUFDckQsUUFBSSxNQUFNLENBQUMsTUFBTSxRQUFXO0FBQzFCLFlBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUMxQyxXQUFLLFlBQ0g7QUFDRixXQUFLLGNBQWMsTUFBTSxDQUFDO0FBQzFCLGFBQU8sWUFBWSxJQUFJO0FBQUEsSUFDekIsV0FBVyxNQUFNLENBQUMsTUFBTSxVQUFhLE1BQU0sQ0FBQyxNQUFNLFFBQVc7QUFDM0QsWUFBTSxJQUFJLFNBQVMsY0FBYyxHQUFHO0FBQ3BDLFFBQUUsWUFBWTtBQUNkLFFBQUUsT0FBTyxNQUFNLENBQUM7QUFDaEIsUUFBRSxTQUFTO0FBQ1gsUUFBRSxNQUFNO0FBQ1IsUUFBRSxjQUFjLE1BQU0sQ0FBQztBQUN2QixhQUFPLFlBQVksQ0FBQztBQUFBLElBQ3RCLFdBQVcsTUFBTSxDQUFDLE1BQU0sUUFBVztBQUNqQyxZQUFNLFNBQVMsU0FBUyxjQUFjLFFBQVE7QUFDOUMsYUFBTyxZQUFZO0FBQ25CLGFBQU8sY0FBYyxNQUFNLENBQUM7QUFDNUIsYUFBTyxZQUFZLE1BQU07QUFBQSxJQUMzQixXQUFXLE1BQU0sQ0FBQyxNQUFNLFFBQVc7QUFDakMsWUFBTSxLQUFLLFNBQVMsY0FBYyxJQUFJO0FBQ3RDLFNBQUcsY0FBYyxNQUFNLENBQUM7QUFDeEIsYUFBTyxZQUFZLEVBQUU7QUFBQSxJQUN2QjtBQUNBLGdCQUFZLE1BQU0sUUFBUSxNQUFNLENBQUMsRUFBRTtBQUFBLEVBQ3JDO0FBQ0EsYUFBVyxRQUFRLEtBQUssTUFBTSxTQUFTLENBQUM7QUFDMUM7QUFFQSxTQUFTLFdBQVcsUUFBcUIsTUFBb0I7QUFDM0QsTUFBSSxLQUFNLFFBQU8sWUFBWSxTQUFTLGVBQWUsSUFBSSxDQUFDO0FBQzVEO0FBRUEsU0FBUyx3QkFBd0IsTUFBeUI7QUFDeEQsT0FBSyw0QkFDRixPQUFPLDRCQUE0QixFQUNuQyxLQUFLLENBQUMsV0FBVztBQUNoQixTQUFLLGNBQWM7QUFDbkIsd0JBQW9CLE1BQU0sTUFBdUI7QUFBQSxFQUNuRCxDQUFDLEVBQ0EsTUFBTSxDQUFDLE1BQU07QUFDWixTQUFLLGNBQWM7QUFDbkIsU0FBSyxZQUFZLFVBQVUsMkJBQTJCLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUNsRSxDQUFDO0FBQ0w7QUFFQSxTQUFTLG9CQUFvQixNQUFtQixRQUE2QjtBQUMzRSxPQUFLLFlBQVksa0JBQWtCLE1BQU0sQ0FBQztBQUMxQyxhQUFXLFNBQVMsT0FBTyxRQUFRO0FBQ2pDLFFBQUksTUFBTSxXQUFXLEtBQU07QUFDM0IsU0FBSyxZQUFZLGdCQUFnQixLQUFLLENBQUM7QUFBQSxFQUN6QztBQUNGO0FBRUEsU0FBUyxrQkFBa0IsUUFBb0M7QUFDN0QsUUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLE1BQUksWUFBWTtBQUNoQixRQUFNLE9BQU8sU0FBUyxjQUFjLEtBQUs7QUFDekMsT0FBSyxZQUFZO0FBQ2pCLE9BQUssWUFBWSxZQUFZLE9BQU8sUUFBUSxPQUFPLE9BQU8sQ0FBQztBQUMzRCxRQUFNLFFBQVEsU0FBUyxjQUFjLEtBQUs7QUFDMUMsUUFBTSxZQUFZO0FBQ2xCLFFBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxRQUFNLFlBQVk7QUFDbEIsUUFBTSxjQUFjLE9BQU87QUFDM0IsUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFBWTtBQUNqQixPQUFLLGNBQWMsR0FBRyxPQUFPLE9BQU8sWUFBWSxJQUFJLEtBQUssT0FBTyxTQUFTLEVBQUUsZUFBZSxDQUFDO0FBQzNGLFFBQU0sWUFBWSxLQUFLO0FBQ3ZCLFFBQU0sWUFBWSxJQUFJO0FBQ3RCLE9BQUssWUFBWSxLQUFLO0FBQ3RCLE1BQUksWUFBWSxJQUFJO0FBRXBCLFFBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxTQUFPLFlBQVk7QUFDbkIsU0FBTztBQUFBLElBQ0wsY0FBYyxhQUFhLE1BQU07QUFDL0IsWUFBTSxPQUFPLElBQUk7QUFDakIsVUFBSSxDQUFDLEtBQU07QUFDWCxXQUFLLGNBQWM7QUFDbkIsV0FBSyxZQUFZLFVBQVUsb0JBQW9CLHVDQUF1QyxDQUFDO0FBQ3ZGLDhCQUF3QixJQUFJO0FBQUEsSUFDOUIsQ0FBQztBQUFBLEVBQ0g7QUFDQSxNQUFJLFlBQVksTUFBTTtBQUN0QixTQUFPO0FBQ1Q7QUFFQSxTQUFTLGdCQUFnQixPQUF3QztBQUMvRCxRQUFNLE1BQU0sVUFBVSxNQUFNLE1BQU0sTUFBTSxNQUFNO0FBQzlDLFFBQU0sT0FBTyxJQUFJO0FBQ2pCLE1BQUksS0FBTSxNQUFLLFFBQVEsWUFBWSxNQUFNLE1BQU0sQ0FBQztBQUNoRCxTQUFPO0FBQ1Q7QUFFQSxTQUFTLFlBQVksUUFBaUMsT0FBNkI7QUFDakYsUUFBTSxRQUFRLFNBQVMsY0FBYyxNQUFNO0FBQzNDLFFBQU0sT0FDSixXQUFXLE9BQ1Asc0RBQ0EsV0FBVyxTQUNULHdEQUNBO0FBQ1IsUUFBTSxZQUFZLHlGQUF5RixJQUFJO0FBQy9HLFFBQU0sY0FBYyxVQUFVLFdBQVcsT0FBTyxPQUFPLFdBQVcsU0FBUyxXQUFXO0FBQ3RGLFNBQU87QUFDVDtBQUVBLFNBQVMsY0FBYyxPQUFnRDtBQUNyRSxNQUFJLENBQUMsTUFBTyxRQUFPO0FBQ25CLFFBQU0sU0FBUyxNQUFNLGdCQUFnQixXQUFXLE1BQU0sYUFBYSxPQUFPO0FBQzFFLFFBQU0sVUFBVSxXQUFXLElBQUksS0FBSyxNQUFNLFNBQVMsRUFBRSxlQUFlLENBQUM7QUFDckUsTUFBSSxNQUFNLE1BQU8sUUFBTyxHQUFHLE1BQU0sR0FBRyxPQUFPLElBQUksTUFBTSxLQUFLO0FBQzFELFNBQU8sR0FBRyxNQUFNLEdBQUcsT0FBTztBQUM1QjtBQUVBLFNBQVMsZUFBNEI7QUFDbkMsUUFBTSxNQUFNO0FBQUEsSUFDVjtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQ0EsUUFBTSxTQUFTLElBQUksY0FBMkIsNEJBQTRCO0FBQzFFLFVBQVE7QUFBQSxJQUNOLGNBQWMsZ0JBQWdCLE1BQU07QUFDbEMsV0FBSyw0QkFDRixPQUFPLHFCQUFxQix3RUFBd0UsRUFDcEcsTUFBTSxDQUFDLE1BQU0sS0FBSyxpQ0FBaUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUFBLElBQ2xFLENBQUM7QUFBQSxFQUNIO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxlQUE0QjtBQUNuQyxRQUFNLE1BQU07QUFBQSxJQUNWO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDQSxRQUFNLFNBQVMsSUFBSSxjQUEyQiw0QkFBNEI7QUFDMUUsVUFBUTtBQUFBLElBQ04sY0FBYyxjQUFjLE1BQU07QUFDaEMsWUFBTSxRQUFRLG1CQUFtQixTQUFTO0FBQzFDLFlBQU0sT0FBTztBQUFBLFFBQ1g7QUFBQSxVQUNFO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNGLEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDYjtBQUNBLFdBQUssNEJBQVk7QUFBQSxRQUNmO0FBQUEsUUFDQSw4REFBOEQsS0FBSyxTQUFTLElBQUk7QUFBQSxNQUNsRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLFVBQVUsV0FBbUIsYUFBa0M7QUFDdEUsUUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLE1BQUksWUFBWTtBQUNoQixRQUFNLE9BQU8sU0FBUyxjQUFjLEtBQUs7QUFDekMsT0FBSyxZQUFZO0FBQ2pCLFFBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxRQUFNLFlBQVk7QUFDbEIsUUFBTSxjQUFjO0FBQ3BCLFFBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxPQUFLLFlBQVk7QUFDakIsT0FBSyxjQUFjO0FBQ25CLE9BQUssWUFBWSxLQUFLO0FBQ3RCLE9BQUssWUFBWSxJQUFJO0FBQ3JCLE1BQUksWUFBWSxJQUFJO0FBQ3BCLFFBQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxVQUFRLFFBQVEsb0JBQW9CO0FBQ3BDLFVBQVEsWUFBWTtBQUNwQixNQUFJLFlBQVksT0FBTztBQUN2QixTQUFPO0FBQ1Q7QUFFQSxTQUFTLGlCQUFpQixjQUFpQztBQUN6RCxRQUFNLFVBQVUsa0JBQWtCLHNCQUFzQixNQUFNO0FBQzVELFNBQUssNEJBQVksT0FBTyxrQkFBa0IsV0FBVyxDQUFDO0FBQUEsRUFDeEQsQ0FBQztBQUNELFFBQU0sWUFBWSxrQkFBa0IsZ0JBQWdCLE1BQU07QUFLeEQsU0FBSyw0QkFDRixPQUFPLHVCQUF1QixFQUM5QixNQUFNLENBQUMsTUFBTSxLQUFLLDhCQUE4QixPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQzFELFFBQVEsTUFBTTtBQUNiLGVBQVMsT0FBTztBQUFBLElBQ2xCLENBQUM7QUFBQSxFQUNMLENBQUM7QUFHRCxRQUFNLFlBQVksVUFBVSxjQUFjLEtBQUs7QUFDL0MsTUFBSSxXQUFXO0FBQ2IsY0FBVSxZQUNSO0FBQUEsRUFJSjtBQUVBLFFBQU0sV0FBVyxTQUFTLGNBQWMsS0FBSztBQUM3QyxXQUFTLFlBQVk7QUFDckIsV0FBUyxZQUFZLFNBQVM7QUFDOUIsV0FBUyxZQUFZLE9BQU87QUFFNUIsTUFBSSxNQUFNLGFBQWEsV0FBVyxHQUFHO0FBQ25DLFVBQU0sVUFBVSxTQUFTLGNBQWMsU0FBUztBQUNoRCxZQUFRLFlBQVk7QUFDcEIsWUFBUSxZQUFZLGFBQWEsb0JBQW9CLFFBQVEsQ0FBQztBQUM5RCxVQUFNQyxRQUFPLFlBQVk7QUFDekIsSUFBQUEsTUFBSztBQUFBLE1BQ0g7QUFBQSxRQUNFO0FBQUEsUUFDQSw0QkFBNEIsV0FBVyxDQUFDO0FBQUEsTUFDMUM7QUFBQSxJQUNGO0FBQ0EsWUFBUSxZQUFZQSxLQUFJO0FBQ3hCLGlCQUFhLFlBQVksT0FBTztBQUNoQztBQUFBLEVBQ0Y7QUFHQSxRQUFNLGtCQUFrQixvQkFBSSxJQUErQjtBQUMzRCxhQUFXLEtBQUssTUFBTSxTQUFTLE9BQU8sR0FBRztBQUN2QyxVQUFNLFVBQVUsRUFBRSxHQUFHLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDakMsUUFBSSxDQUFDLGdCQUFnQixJQUFJLE9BQU8sRUFBRyxpQkFBZ0IsSUFBSSxTQUFTLENBQUMsQ0FBQztBQUNsRSxvQkFBZ0IsSUFBSSxPQUFPLEVBQUcsS0FBSyxDQUFDO0FBQUEsRUFDdEM7QUFFQSxRQUFNLE9BQU8sU0FBUyxjQUFjLFNBQVM7QUFDN0MsT0FBSyxZQUFZO0FBQ2pCLE9BQUssWUFBWSxhQUFhLG9CQUFvQixRQUFRLENBQUM7QUFFM0QsUUFBTSxPQUFPLFlBQVk7QUFDekIsYUFBVyxLQUFLLE1BQU0sY0FBYztBQUNsQyxTQUFLLFlBQVksU0FBUyxHQUFHLGdCQUFnQixJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUN4RTtBQUNBLE9BQUssWUFBWSxJQUFJO0FBQ3JCLGVBQWEsWUFBWSxJQUFJO0FBQy9CO0FBRUEsU0FBUyxTQUFTLEdBQWdCLFVBQTBDO0FBQzFFLFFBQU0sSUFBSSxFQUFFO0FBS1osUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFBWTtBQUNqQixNQUFJLENBQUMsRUFBRSxRQUFTLE1BQUssTUFBTSxVQUFVO0FBRXJDLFFBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxTQUFPLFlBQVk7QUFFbkIsUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFBWTtBQUdqQixRQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsU0FBTyxZQUNMO0FBQ0YsU0FBTyxNQUFNLFFBQVE7QUFDckIsU0FBTyxNQUFNLFNBQVM7QUFDdEIsU0FBTyxNQUFNLGtCQUFrQjtBQUMvQixNQUFJLEVBQUUsU0FBUztBQUNiLFVBQU0sTUFBTSxTQUFTLGNBQWMsS0FBSztBQUN4QyxRQUFJLE1BQU07QUFDVixRQUFJLFlBQVk7QUFFaEIsVUFBTSxXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssS0FBSyxZQUFZO0FBQ2pELFVBQU0sV0FBVyxTQUFTLGNBQWMsTUFBTTtBQUM5QyxhQUFTLFlBQVk7QUFDckIsYUFBUyxjQUFjO0FBQ3ZCLFdBQU8sWUFBWSxRQUFRO0FBQzNCLFFBQUksTUFBTSxVQUFVO0FBQ3BCLFFBQUksaUJBQWlCLFFBQVEsTUFBTTtBQUNqQyxlQUFTLE9BQU87QUFDaEIsVUFBSSxNQUFNLFVBQVU7QUFBQSxJQUN0QixDQUFDO0FBQ0QsUUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLFVBQUksT0FBTztBQUFBLElBQ2IsQ0FBQztBQUNELFNBQUssZUFBZSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDbEQsVUFBSSxJQUFLLEtBQUksTUFBTTtBQUFBLFVBQ2QsS0FBSSxPQUFPO0FBQUEsSUFDbEIsQ0FBQztBQUNELFdBQU8sWUFBWSxHQUFHO0FBQUEsRUFDeEIsT0FBTztBQUNMLFVBQU0sV0FBVyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEtBQUssWUFBWTtBQUNqRCxVQUFNLE9BQU8sU0FBUyxjQUFjLE1BQU07QUFDMUMsU0FBSyxZQUFZO0FBQ2pCLFNBQUssY0FBYztBQUNuQixXQUFPLFlBQVksSUFBSTtBQUFBLEVBQ3pCO0FBQ0EsT0FBSyxZQUFZLE1BQU07QUFHdkIsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sWUFBWTtBQUVsQixRQUFNLFdBQVcsU0FBUyxjQUFjLEtBQUs7QUFDN0MsV0FBUyxZQUFZO0FBQ3JCLFFBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxPQUFLLFlBQVk7QUFDakIsT0FBSyxjQUFjLEVBQUU7QUFDckIsV0FBUyxZQUFZLElBQUk7QUFDekIsTUFBSSxFQUFFLFNBQVM7QUFDYixVQUFNLE1BQU0sU0FBUyxjQUFjLE1BQU07QUFDekMsUUFBSSxZQUNGO0FBQ0YsUUFBSSxjQUFjLElBQUksRUFBRSxPQUFPO0FBQy9CLGFBQVMsWUFBWSxHQUFHO0FBQUEsRUFDMUI7QUFDQSxNQUFJLEVBQUUsUUFBUSxpQkFBaUI7QUFDN0IsVUFBTSxRQUFRLFNBQVMsY0FBYyxNQUFNO0FBQzNDLFVBQU0sWUFDSjtBQUNGLFVBQU0sY0FBYztBQUNwQixhQUFTLFlBQVksS0FBSztBQUFBLEVBQzVCO0FBQ0EsUUFBTSxZQUFZLFFBQVE7QUFFMUIsTUFBSSxFQUFFLGFBQWE7QUFDakIsVUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLFNBQUssWUFBWTtBQUNqQixTQUFLLGNBQWMsRUFBRTtBQUNyQixVQUFNLFlBQVksSUFBSTtBQUFBLEVBQ3hCO0FBRUEsUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFBWTtBQUNqQixRQUFNLFdBQVcsYUFBYSxFQUFFLE1BQU07QUFDdEMsTUFBSSxTQUFVLE1BQUssWUFBWSxRQUFRO0FBQ3ZDLE1BQUksRUFBRSxZQUFZO0FBQ2hCLFFBQUksS0FBSyxTQUFTLFNBQVMsRUFBRyxNQUFLLFlBQVksSUFBSSxDQUFDO0FBQ3BELFVBQU0sT0FBTyxTQUFTLGNBQWMsUUFBUTtBQUM1QyxTQUFLLE9BQU87QUFDWixTQUFLLFlBQVk7QUFDakIsU0FBSyxjQUFjLEVBQUU7QUFDckIsU0FBSyxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDcEMsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBQ2xCLFdBQUssNEJBQVksT0FBTyx5QkFBeUIsc0JBQXNCLEVBQUUsVUFBVSxFQUFFO0FBQUEsSUFDdkYsQ0FBQztBQUNELFNBQUssWUFBWSxJQUFJO0FBQUEsRUFDdkI7QUFDQSxNQUFJLEVBQUUsVUFBVTtBQUNkLFFBQUksS0FBSyxTQUFTLFNBQVMsRUFBRyxNQUFLLFlBQVksSUFBSSxDQUFDO0FBQ3BELFVBQU0sT0FBTyxTQUFTLGNBQWMsR0FBRztBQUN2QyxTQUFLLE9BQU8sRUFBRTtBQUNkLFNBQUssU0FBUztBQUNkLFNBQUssTUFBTTtBQUNYLFNBQUssWUFBWTtBQUNqQixTQUFLLGNBQWM7QUFDbkIsU0FBSyxZQUFZLElBQUk7QUFBQSxFQUN2QjtBQUNBLE1BQUksS0FBSyxTQUFTLFNBQVMsRUFBRyxPQUFNLFlBQVksSUFBSTtBQUdwRCxNQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssU0FBUyxHQUFHO0FBQy9CLFVBQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxZQUFRLFlBQVk7QUFDcEIsZUFBVyxPQUFPLEVBQUUsTUFBTTtBQUN4QixZQUFNLE9BQU8sU0FBUyxjQUFjLE1BQU07QUFDMUMsV0FBSyxZQUNIO0FBQ0YsV0FBSyxjQUFjO0FBQ25CLGNBQVEsWUFBWSxJQUFJO0FBQUEsSUFDMUI7QUFDQSxVQUFNLFlBQVksT0FBTztBQUFBLEVBQzNCO0FBRUEsT0FBSyxZQUFZLEtBQUs7QUFDdEIsU0FBTyxZQUFZLElBQUk7QUFHdkIsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sWUFBWTtBQUNsQixNQUFJLEVBQUUsUUFBUSxtQkFBbUIsRUFBRSxPQUFPLFlBQVk7QUFDcEQsVUFBTTtBQUFBLE1BQ0osY0FBYyxrQkFBa0IsTUFBTTtBQUNwQyxhQUFLLDRCQUFZLE9BQU8seUJBQXlCLEVBQUUsT0FBUSxVQUFVO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0EsUUFBTTtBQUFBLElBQ0osY0FBYyxFQUFFLFNBQVMsT0FBTyxTQUFTO0FBQ3ZDLFlBQU0sNEJBQVksT0FBTyw2QkFBNkIsRUFBRSxJQUFJLElBQUk7QUFBQSxJQUdsRSxDQUFDO0FBQUEsRUFDSDtBQUNBLFNBQU8sWUFBWSxLQUFLO0FBRXhCLE9BQUssWUFBWSxNQUFNO0FBSXZCLE1BQUksRUFBRSxXQUFXLFNBQVMsU0FBUyxHQUFHO0FBQ3BDLFVBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxXQUFPLFlBQ0w7QUFDRixlQUFXLEtBQUssVUFBVTtBQUN4QixZQUFNLE9BQU8sU0FBUyxjQUFjLEtBQUs7QUFDekMsV0FBSyxZQUFZO0FBQ2pCLFVBQUk7QUFDRixVQUFFLE9BQU8sSUFBSTtBQUFBLE1BQ2YsU0FBUyxHQUFHO0FBQ1YsYUFBSyxjQUFjLGtDQUFtQyxFQUFZLE9BQU87QUFBQSxNQUMzRTtBQUNBLGFBQU8sWUFBWSxJQUFJO0FBQUEsSUFDekI7QUFDQSxTQUFLLFlBQVksTUFBTTtBQUFBLEVBQ3pCO0FBRUEsU0FBTztBQUNUO0FBRUEsU0FBUyxhQUFhLFFBQXFEO0FBQ3pFLE1BQUksQ0FBQyxPQUFRLFFBQU87QUFDcEIsUUFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLE9BQUssWUFBWTtBQUNqQixNQUFJLE9BQU8sV0FBVyxVQUFVO0FBQzlCLFNBQUssY0FBYyxNQUFNLE1BQU07QUFDL0IsV0FBTztBQUFBLEVBQ1Q7QUFDQSxPQUFLLFlBQVksU0FBUyxlQUFlLEtBQUssQ0FBQztBQUMvQyxNQUFJLE9BQU8sS0FBSztBQUNkLFVBQU0sSUFBSSxTQUFTLGNBQWMsR0FBRztBQUNwQyxNQUFFLE9BQU8sT0FBTztBQUNoQixNQUFFLFNBQVM7QUFDWCxNQUFFLE1BQU07QUFDUixNQUFFLFlBQVk7QUFDZCxNQUFFLGNBQWMsT0FBTztBQUN2QixTQUFLLFlBQVksQ0FBQztBQUFBLEVBQ3BCLE9BQU87QUFDTCxVQUFNLE9BQU8sU0FBUyxjQUFjLE1BQU07QUFDMUMsU0FBSyxjQUFjLE9BQU87QUFDMUIsU0FBSyxZQUFZLElBQUk7QUFBQSxFQUN2QjtBQUNBLFNBQU87QUFDVDtBQUtBLFNBQVMsV0FDUCxPQUNBLFVBQ21EO0FBQ25ELFFBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxRQUFNLFlBQVk7QUFFbEIsUUFBTSxVQUFVLFNBQVMsY0FBYyxLQUFLO0FBQzVDLFVBQVEsWUFDTjtBQUNGLFFBQU0sWUFBWSxPQUFPO0FBRXpCLFFBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxTQUFPLFlBQVk7QUFDbkIsUUFBTSxZQUFZLE1BQU07QUFFeEIsUUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFFBQU0sWUFDSjtBQUNGLFNBQU8sWUFBWSxLQUFLO0FBRXhCLFFBQU0sYUFBYSxTQUFTLGNBQWMsS0FBSztBQUMvQyxhQUFXLFlBQVk7QUFDdkIsUUFBTSxjQUFjLFNBQVMsY0FBYyxLQUFLO0FBQ2hELGNBQVksWUFBWTtBQUN4QixRQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsVUFBUSxZQUFZO0FBQ3BCLFVBQVEsY0FBYztBQUN0QixjQUFZLFlBQVksT0FBTztBQUMvQixNQUFJLFVBQVU7QUFDWixVQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsUUFBSSxZQUFZO0FBQ2hCLFFBQUksY0FBYztBQUNsQixnQkFBWSxZQUFZLEdBQUc7QUFBQSxFQUM3QjtBQUNBLGFBQVcsWUFBWSxXQUFXO0FBQ2xDLFFBQU0sWUFBWSxVQUFVO0FBRTVCLFFBQU0sZUFBZSxTQUFTLGNBQWMsS0FBSztBQUNqRCxlQUFhLFlBQVk7QUFDekIsUUFBTSxZQUFZLFlBQVk7QUFFOUIsU0FBTyxFQUFFLE9BQU8sYUFBYTtBQUMvQjtBQUVBLFNBQVMsYUFBYSxNQUFjLFVBQXFDO0FBQ3ZFLFFBQU0sV0FBVyxTQUFTLGNBQWMsS0FBSztBQUM3QyxXQUFTLFlBQ1A7QUFDRixRQUFNLGFBQWEsU0FBUyxjQUFjLEtBQUs7QUFDL0MsYUFBVyxZQUFZO0FBQ3ZCLFFBQU0sSUFBSSxTQUFTLGNBQWMsS0FBSztBQUN0QyxJQUFFLFlBQVk7QUFDZCxJQUFFLGNBQWM7QUFDaEIsYUFBVyxZQUFZLENBQUM7QUFDeEIsV0FBUyxZQUFZLFVBQVU7QUFDL0IsTUFBSSxVQUFVO0FBQ1osVUFBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLFVBQU0sWUFBWTtBQUNsQixVQUFNLFlBQVksUUFBUTtBQUMxQixhQUFTLFlBQVksS0FBSztBQUFBLEVBQzVCO0FBQ0EsU0FBTztBQUNUO0FBTUEsU0FBUyxrQkFBa0IsT0FBZSxTQUF3QztBQUNoRixRQUFNLE1BQU0sU0FBUyxjQUFjLFFBQVE7QUFDM0MsTUFBSSxPQUFPO0FBQ1gsTUFBSSxZQUNGO0FBQ0YsTUFBSSxZQUNGLEdBQUcsS0FBSztBQUlWLE1BQUksaUJBQWlCLFNBQVMsQ0FBQyxNQUFNO0FBQ25DLE1BQUUsZUFBZTtBQUNqQixNQUFFLGdCQUFnQjtBQUNsQixZQUFRO0FBQUEsRUFDVixDQUFDO0FBQ0QsU0FBTztBQUNUO0FBRUEsU0FBUyxjQUFjLE9BQWUsU0FBd0M7QUFDNUUsUUFBTSxNQUFNLFNBQVMsY0FBYyxRQUFRO0FBQzNDLE1BQUksT0FBTztBQUNYLE1BQUksWUFDRjtBQUNGLE1BQUksY0FBYztBQUNsQixNQUFJLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUNuQyxNQUFFLGVBQWU7QUFDakIsTUFBRSxnQkFBZ0I7QUFDbEIsWUFBUTtBQUFBLEVBQ1YsQ0FBQztBQUNELFNBQU87QUFDVDtBQUVBLFNBQVMsY0FBMkI7QUFDbEMsUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFDSDtBQUNGLE9BQUs7QUFBQSxJQUNIO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLFVBQVUsT0FBMkIsYUFBbUM7QUFDL0UsUUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLE1BQUksWUFBWTtBQUNoQixRQUFNLE9BQU8sU0FBUyxjQUFjLEtBQUs7QUFDekMsT0FBSyxZQUFZO0FBQ2pCLFFBQU0sUUFBUSxTQUFTLGNBQWMsS0FBSztBQUMxQyxRQUFNLFlBQVk7QUFDbEIsTUFBSSxPQUFPO0FBQ1QsVUFBTSxJQUFJLFNBQVMsY0FBYyxLQUFLO0FBQ3RDLE1BQUUsWUFBWTtBQUNkLE1BQUUsY0FBYztBQUNoQixVQUFNLFlBQVksQ0FBQztBQUFBLEVBQ3JCO0FBQ0EsTUFBSSxhQUFhO0FBQ2YsVUFBTSxJQUFJLFNBQVMsY0FBYyxLQUFLO0FBQ3RDLE1BQUUsWUFBWTtBQUNkLE1BQUUsY0FBYztBQUNoQixVQUFNLFlBQVksQ0FBQztBQUFBLEVBQ3JCO0FBQ0EsT0FBSyxZQUFZLEtBQUs7QUFDdEIsTUFBSSxZQUFZLElBQUk7QUFDcEIsU0FBTztBQUNUO0FBTUEsU0FBUyxjQUNQLFNBQ0EsVUFDbUI7QUFDbkIsUUFBTSxNQUFNLFNBQVMsY0FBYyxRQUFRO0FBQzNDLE1BQUksT0FBTztBQUNYLE1BQUksYUFBYSxRQUFRLFFBQVE7QUFFakMsUUFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLFFBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUMxQyxPQUFLLFlBQ0g7QUFDRixPQUFLLFlBQVksSUFBSTtBQUVyQixRQUFNLFFBQVEsQ0FBQyxPQUFzQjtBQUNuQyxRQUFJLGFBQWEsZ0JBQWdCLE9BQU8sRUFBRSxDQUFDO0FBQzNDLFFBQUksUUFBUSxRQUFRLEtBQUssWUFBWTtBQUNyQyxRQUFJLFlBQ0Y7QUFDRixTQUFLLFlBQVksMkdBQ2YsS0FBSyx5QkFBeUIsd0JBQ2hDO0FBQ0EsU0FBSyxRQUFRLFFBQVEsS0FBSyxZQUFZO0FBQ3RDLFNBQUssUUFBUSxRQUFRLEtBQUssWUFBWTtBQUN0QyxTQUFLLE1BQU0sWUFBWSxLQUFLLHFCQUFxQjtBQUFBLEVBQ25EO0FBQ0EsUUFBTSxPQUFPO0FBRWIsTUFBSSxZQUFZLElBQUk7QUFDcEIsTUFBSSxpQkFBaUIsU0FBUyxPQUFPLE1BQU07QUFDekMsTUFBRSxlQUFlO0FBQ2pCLE1BQUUsZ0JBQWdCO0FBQ2xCLFVBQU0sT0FBTyxJQUFJLGFBQWEsY0FBYyxNQUFNO0FBQ2xELFVBQU0sSUFBSTtBQUNWLFFBQUksV0FBVztBQUNmLFFBQUk7QUFDRixZQUFNLFNBQVMsSUFBSTtBQUFBLElBQ3JCLFVBQUU7QUFDQSxVQUFJLFdBQVc7QUFBQSxJQUNqQjtBQUFBLEVBQ0YsQ0FBQztBQUNELFNBQU87QUFDVDtBQUVBLFNBQVMsTUFBbUI7QUFDMUIsUUFBTSxJQUFJLFNBQVMsY0FBYyxNQUFNO0FBQ3ZDLElBQUUsWUFBWTtBQUNkLElBQUUsY0FBYztBQUNoQixTQUFPO0FBQ1Q7QUFJQSxTQUFTLGdCQUF3QjtBQUUvQixTQUNFO0FBT0o7QUFFQSxTQUFTLGdCQUF3QjtBQUUvQixTQUNFO0FBS0o7QUFFQSxTQUFTLHFCQUE2QjtBQUVwQyxTQUNFO0FBTUo7QUFFQSxlQUFlLGVBQ2IsS0FDQSxVQUN3QjtBQUN4QixNQUFJLG1CQUFtQixLQUFLLEdBQUcsRUFBRyxRQUFPO0FBR3pDLFFBQU0sTUFBTSxJQUFJLFdBQVcsSUFBSSxJQUFJLElBQUksTUFBTSxDQUFDLElBQUk7QUFDbEQsTUFBSTtBQUNGLFdBQVEsTUFBTSw0QkFBWTtBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRixTQUFTLEdBQUc7QUFDVixTQUFLLG9CQUFvQixFQUFFLEtBQUssVUFBVSxLQUFLLE9BQU8sQ0FBQyxFQUFFLENBQUM7QUFDMUQsV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUlBLFNBQVMsd0JBQTRDO0FBRW5ELFFBQU0sUUFBUSxNQUFNO0FBQUEsSUFDbEIsU0FBUyxpQkFBb0MsdUJBQXVCO0FBQUEsRUFDdEU7QUFDQSxNQUFJLE1BQU0sVUFBVSxHQUFHO0FBQ3JCLFFBQUksT0FBMkIsTUFBTSxDQUFDLEVBQUU7QUFDeEMsV0FBTyxNQUFNO0FBQ1gsWUFBTSxTQUFTLEtBQUssaUJBQWlCLHVCQUF1QjtBQUM1RCxVQUFJLE9BQU8sVUFBVSxLQUFLLElBQUksR0FBRyxNQUFNLFNBQVMsQ0FBQyxFQUFHLFFBQU87QUFDM0QsYUFBTyxLQUFLO0FBQUEsSUFDZDtBQUFBLEVBQ0Y7QUFHQSxRQUFNLFFBQVE7QUFBQSxJQUNaO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDQSxRQUFNLFVBQXlCLENBQUM7QUFDaEMsUUFBTSxNQUFNLFNBQVM7QUFBQSxJQUNuQjtBQUFBLEVBQ0Y7QUFDQSxhQUFXLE1BQU0sTUFBTSxLQUFLLEdBQUcsR0FBRztBQUNoQyxVQUFNLEtBQUssR0FBRyxlQUFlLElBQUksS0FBSztBQUN0QyxRQUFJLEVBQUUsU0FBUyxHQUFJO0FBQ25CLFFBQUksTUFBTSxLQUFLLENBQUMsTUFBTSxNQUFNLENBQUMsRUFBRyxTQUFRLEtBQUssRUFBRTtBQUMvQyxRQUFJLFFBQVEsU0FBUyxHQUFJO0FBQUEsRUFDM0I7QUFDQSxNQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ3ZCLFFBQUksT0FBMkIsUUFBUSxDQUFDLEVBQUU7QUFDMUMsV0FBTyxNQUFNO0FBQ1gsVUFBSSxRQUFRO0FBQ1osaUJBQVcsS0FBSyxRQUFTLEtBQUksS0FBSyxTQUFTLENBQUMsRUFBRztBQUMvQyxVQUFJLFNBQVMsS0FBSyxJQUFJLEdBQUcsUUFBUSxNQUFNLEVBQUcsUUFBTztBQUNqRCxhQUFPLEtBQUs7QUFBQSxJQUNkO0FBQUEsRUFDRjtBQUNBLFNBQU87QUFDVDtBQUVBLFNBQVMsa0JBQXNDO0FBQzdDLFFBQU0sVUFBVSxzQkFBc0I7QUFDdEMsTUFBSSxDQUFDLFFBQVMsUUFBTztBQUNyQixNQUFJLFNBQVMsUUFBUTtBQUNyQixTQUFPLFFBQVE7QUFDYixlQUFXLFNBQVMsTUFBTSxLQUFLLE9BQU8sUUFBUSxHQUFvQjtBQUNoRSxVQUFJLFVBQVUsV0FBVyxNQUFNLFNBQVMsT0FBTyxFQUFHO0FBQ2xELFlBQU0sSUFBSSxNQUFNLHNCQUFzQjtBQUN0QyxVQUFJLEVBQUUsUUFBUSxPQUFPLEVBQUUsU0FBUyxJQUFLLFFBQU87QUFBQSxJQUM5QztBQUNBLGFBQVMsT0FBTztBQUFBLEVBQ2xCO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxlQUFxQjtBQUM1QixNQUFJO0FBQ0YsVUFBTSxVQUFVLHNCQUFzQjtBQUN0QyxRQUFJLFdBQVcsQ0FBQyxNQUFNLGVBQWU7QUFDbkMsWUFBTSxnQkFBZ0I7QUFDdEIsWUFBTSxTQUFTLFFBQVEsaUJBQWlCO0FBQ3hDLFdBQUssc0JBQXNCLE9BQU8sVUFBVSxNQUFNLEdBQUcsSUFBSyxDQUFDO0FBQUEsSUFDN0Q7QUFDQSxVQUFNLFVBQVUsZ0JBQWdCO0FBQ2hDLFFBQUksQ0FBQyxTQUFTO0FBQ1osVUFBSSxNQUFNLGdCQUFnQixTQUFTLE1BQU07QUFDdkMsY0FBTSxjQUFjLFNBQVM7QUFDN0IsYUFBSywwQkFBMEI7QUFBQSxVQUM3QixLQUFLLFNBQVM7QUFBQSxVQUNkLFNBQVMsVUFBVSxTQUFTLE9BQU8sSUFBSTtBQUFBLFFBQ3pDLENBQUM7QUFBQSxNQUNIO0FBQ0E7QUFBQSxJQUNGO0FBQ0EsUUFBSSxRQUE0QjtBQUNoQyxlQUFXLFNBQVMsTUFBTSxLQUFLLFFBQVEsUUFBUSxHQUFvQjtBQUNqRSxVQUFJLE1BQU0sUUFBUSxZQUFZLGVBQWdCO0FBQzlDLFVBQUksTUFBTSxNQUFNLFlBQVksT0FBUTtBQUNwQyxjQUFRO0FBQ1I7QUFBQSxJQUNGO0FBQ0EsVUFBTSxZQUFZLFVBQ2QsTUFBTSxLQUFLLFFBQVEsaUJBQThCLFdBQVcsQ0FBQyxFQUFFO0FBQUEsTUFDN0QsQ0FBQyxNQUNDLEVBQUUsYUFBYSxjQUFjLE1BQU0sVUFDbkMsRUFBRSxhQUFhLGFBQWEsTUFBTSxVQUNsQyxFQUFFLGFBQWEsZUFBZSxNQUFNLFVBQ3BDLEVBQUUsVUFBVSxTQUFTLFFBQVE7QUFBQSxJQUNqQyxJQUNBO0FBQ0osVUFBTSxVQUFVLE9BQU87QUFBQSxNQUNyQjtBQUFBLElBQ0Y7QUFDQSxVQUFNLGNBQWMsR0FBRyxXQUFXLGVBQWUsRUFBRSxJQUFJLFNBQVMsZUFBZSxFQUFFLElBQUksT0FBTyxTQUFTLFVBQVUsQ0FBQztBQUNoSCxRQUFJLE1BQU0sZ0JBQWdCLFlBQWE7QUFDdkMsVUFBTSxjQUFjO0FBQ3BCLFNBQUssYUFBYTtBQUFBLE1BQ2hCLEtBQUssU0FBUztBQUFBLE1BQ2QsV0FBVyxXQUFXLGFBQWEsS0FBSyxLQUFLO0FBQUEsTUFDN0MsU0FBUyxTQUFTLGFBQWEsS0FBSyxLQUFLO0FBQUEsTUFDekMsU0FBUyxTQUFTLE9BQU87QUFBQSxJQUMzQixDQUFDO0FBQ0QsUUFBSSxPQUFPO0FBQ1QsWUFBTSxPQUFPLE1BQU07QUFDbkI7QUFBQSxRQUNFLHFCQUFxQixXQUFXLGFBQWEsS0FBSyxLQUFLLEdBQUc7QUFBQSxRQUMxRCxLQUFLLE1BQU0sR0FBRyxJQUFLO0FBQUEsTUFDckI7QUFBQSxJQUNGO0FBQUEsRUFDRixTQUFTLEdBQUc7QUFDVixTQUFLLG9CQUFvQixPQUFPLENBQUMsQ0FBQztBQUFBLEVBQ3BDO0FBQ0Y7QUFFQSxTQUFTLFNBQVMsSUFBMEM7QUFDMUQsU0FBTztBQUFBLElBQ0wsS0FBSyxHQUFHO0FBQUEsSUFDUixLQUFLLEdBQUcsVUFBVSxNQUFNLEdBQUcsR0FBRztBQUFBLElBQzlCLElBQUksR0FBRyxNQUFNO0FBQUEsSUFDYixVQUFVLEdBQUcsU0FBUztBQUFBLElBQ3RCLE9BQU8sTUFBTTtBQUNYLFlBQU0sSUFBSSxHQUFHLHNCQUFzQjtBQUNuQyxhQUFPLEVBQUUsR0FBRyxLQUFLLE1BQU0sRUFBRSxLQUFLLEdBQUcsR0FBRyxLQUFLLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFBQSxJQUMzRCxHQUFHO0FBQUEsRUFDTDtBQUNGO0FBRUEsU0FBUyxhQUFxQjtBQUM1QixTQUNHLE9BQTBELDBCQUMzRDtBQUVKOzs7QUMvdURBLElBQUFDLG1CQUE0QjtBQW1DNUIsSUFBTSxTQUFTLG9CQUFJLElBQW1DO0FBQ3RELElBQUksY0FBZ0M7QUFFcEMsZUFBc0IsaUJBQWdDO0FBQ3BELFFBQU0sU0FBVSxNQUFNLDZCQUFZLE9BQU8scUJBQXFCO0FBQzlELFFBQU0sUUFBUyxNQUFNLDZCQUFZLE9BQU8sb0JBQW9CO0FBQzVELGdCQUFjO0FBSWQsa0JBQWdCLE1BQU07QUFFdEIsRUFBQyxPQUEwRCx5QkFDekQsTUFBTTtBQUVSLGFBQVcsS0FBSyxRQUFRO0FBQ3RCLFFBQUksRUFBRSxTQUFTLFVBQVUsT0FBUTtBQUNqQyxRQUFJLENBQUMsRUFBRSxZQUFhO0FBQ3BCLFFBQUksQ0FBQyxFQUFFLFFBQVM7QUFDaEIsUUFBSTtBQUNGLFlBQU0sVUFBVSxHQUFHLEtBQUs7QUFBQSxJQUMxQixTQUFTLEdBQUc7QUFDVixjQUFRLE1BQU0sdUNBQXVDLEVBQUUsU0FBUyxJQUFJLENBQUM7QUFBQSxJQUN2RTtBQUFBLEVBQ0Y7QUFFQSxVQUFRO0FBQUEsSUFDTix5Q0FBeUMsT0FBTyxJQUFJO0FBQUEsSUFDcEQsQ0FBQyxHQUFHLE9BQU8sS0FBSyxDQUFDLEVBQUUsS0FBSyxJQUFJLEtBQUs7QUFBQSxFQUNuQztBQUNBLCtCQUFZO0FBQUEsSUFDVjtBQUFBLElBQ0E7QUFBQSxJQUNBLHdCQUF3QixPQUFPLElBQUksY0FBYyxDQUFDLEdBQUcsT0FBTyxLQUFLLENBQUMsRUFBRSxLQUFLLElBQUksS0FBSyxRQUFRO0FBQUEsRUFDNUY7QUFDRjtBQU9PLFNBQVMsb0JBQTBCO0FBQ3hDLGFBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxRQUFRO0FBQzVCLFFBQUk7QUFDRixRQUFFLE9BQU87QUFBQSxJQUNYLFNBQVMsR0FBRztBQUNWLGNBQVEsS0FBSyx1Q0FBdUMsSUFBSSxDQUFDO0FBQUEsSUFDM0Q7QUFBQSxFQUNGO0FBQ0EsU0FBTyxNQUFNO0FBQ2IsZ0JBQWM7QUFDaEI7QUFFQSxlQUFlLFVBQVUsR0FBZ0IsT0FBaUM7QUFDeEUsUUFBTSxTQUFVLE1BQU0sNkJBQVk7QUFBQSxJQUNoQztBQUFBLElBQ0EsRUFBRTtBQUFBLEVBQ0o7QUFLQSxRQUFNQyxVQUFTLEVBQUUsU0FBUyxDQUFDLEVBQWlDO0FBQzVELFFBQU1DLFdBQVVELFFBQU87QUFFdkIsUUFBTSxLQUFLLElBQUk7QUFBQSxJQUNiO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBLEdBQUcsTUFBTTtBQUFBLGdDQUFtQyxtQkFBbUIsRUFBRSxTQUFTLEVBQUUsQ0FBQyxJQUFJLG1CQUFtQixFQUFFLEtBQUssQ0FBQztBQUFBLEVBQzlHO0FBQ0EsS0FBR0EsU0FBUUMsVUFBUyxPQUFPO0FBQzNCLFFBQU0sTUFBTUQsUUFBTztBQUNuQixRQUFNLFFBQWdCLElBQTRCLFdBQVk7QUFDOUQsTUFBSSxPQUFPLE9BQU8sVUFBVSxZQUFZO0FBQ3RDLFVBQU0sSUFBSSxNQUFNLFNBQVMsRUFBRSxTQUFTLEVBQUUsaUJBQWlCO0FBQUEsRUFDekQ7QUFDQSxRQUFNLE1BQU0sZ0JBQWdCLEVBQUUsVUFBVSxLQUFLO0FBQzdDLFFBQU0sTUFBTSxNQUFNLEdBQUc7QUFDckIsU0FBTyxJQUFJLEVBQUUsU0FBUyxJQUFJLEVBQUUsTUFBTSxNQUFNLE1BQU0sS0FBSyxLQUFLLEVBQUUsQ0FBQztBQUM3RDtBQUVBLFNBQVMsZ0JBQWdCLFVBQXlCLE9BQTRCO0FBQzVFLFFBQU0sS0FBSyxTQUFTO0FBQ3BCLFFBQU0sTUFBTSxDQUFDLFVBQStDLE1BQWlCO0FBQzNFLFVBQU0sWUFDSixVQUFVLFVBQVUsUUFBUSxRQUMxQixVQUFVLFNBQVMsUUFBUSxPQUMzQixVQUFVLFVBQVUsUUFBUSxRQUM1QixRQUFRO0FBQ1osY0FBVSxvQkFBb0IsRUFBRSxLQUFLLEdBQUcsQ0FBQztBQUd6QyxRQUFJO0FBQ0YsWUFBTSxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU07QUFDekIsWUFBSSxPQUFPLE1BQU0sU0FBVSxRQUFPO0FBQ2xDLFlBQUksYUFBYSxNQUFPLFFBQU8sR0FBRyxFQUFFLElBQUksS0FBSyxFQUFFLE9BQU87QUFDdEQsWUFBSTtBQUFFLGlCQUFPLEtBQUssVUFBVSxDQUFDO0FBQUEsUUFBRyxRQUFRO0FBQUUsaUJBQU8sT0FBTyxDQUFDO0FBQUEsUUFBRztBQUFBLE1BQzlELENBQUM7QUFDRCxtQ0FBWTtBQUFBLFFBQ1Y7QUFBQSxRQUNBO0FBQUEsUUFDQSxVQUFVLEVBQUUsS0FBSyxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQUEsTUFDbEM7QUFBQSxJQUNGLFFBQVE7QUFBQSxJQUVSO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQSxTQUFTO0FBQUEsSUFDVCxLQUFLO0FBQUEsTUFDSCxPQUFPLElBQUksTUFBTSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsTUFDbEMsTUFBTSxJQUFJLE1BQU0sSUFBSSxRQUFRLEdBQUcsQ0FBQztBQUFBLE1BQ2hDLE1BQU0sSUFBSSxNQUFNLElBQUksUUFBUSxHQUFHLENBQUM7QUFBQSxNQUNoQyxPQUFPLElBQUksTUFBTSxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsSUFDcEM7QUFBQSxJQUNBLFNBQVMsZ0JBQWdCLEVBQUU7QUFBQSxJQUMzQixVQUFVO0FBQUEsTUFDUixVQUFVLENBQUMsTUFBTSxnQkFBZ0IsRUFBRSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsR0FBRyxDQUFDO0FBQUEsTUFDOUQsY0FBYyxDQUFDLE1BQ2IsYUFBYSxJQUFJLFVBQVUsRUFBRSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsR0FBRyxDQUFDO0FBQUEsSUFDNUQ7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFVBQVUsQ0FBQyxNQUFNLGFBQWEsQ0FBQztBQUFBLE1BQy9CLGlCQUFpQixDQUFDLEdBQUcsU0FBUztBQUM1QixZQUFJLElBQUksYUFBYSxDQUFDO0FBQ3RCLGVBQU8sR0FBRztBQUNSLGdCQUFNLElBQUksRUFBRTtBQUNaLGNBQUksTUFBTSxFQUFFLGdCQUFnQixRQUFRLEVBQUUsU0FBUyxNQUFPLFFBQU87QUFDN0QsY0FBSSxFQUFFO0FBQUEsUUFDUjtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQUEsTUFDQSxnQkFBZ0IsQ0FBQyxLQUFLLFlBQVksUUFDaEMsSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQy9CLGNBQU0sV0FBVyxTQUFTLGNBQWMsR0FBRztBQUMzQyxZQUFJLFNBQVUsUUFBTyxRQUFRLFFBQVE7QUFDckMsY0FBTSxXQUFXLEtBQUssSUFBSSxJQUFJO0FBQzlCLGNBQU0sTUFBTSxJQUFJLGlCQUFpQixNQUFNO0FBQ3JDLGdCQUFNLEtBQUssU0FBUyxjQUFjLEdBQUc7QUFDckMsY0FBSSxJQUFJO0FBQ04sZ0JBQUksV0FBVztBQUNmLG9CQUFRLEVBQUU7QUFBQSxVQUNaLFdBQVcsS0FBSyxJQUFJLElBQUksVUFBVTtBQUNoQyxnQkFBSSxXQUFXO0FBQ2YsbUJBQU8sSUFBSSxNQUFNLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hEO0FBQUEsUUFDRixDQUFDO0FBQ0QsWUFBSSxRQUFRLFNBQVMsaUJBQWlCLEVBQUUsV0FBVyxNQUFNLFNBQVMsS0FBSyxDQUFDO0FBQUEsTUFDMUUsQ0FBQztBQUFBLElBQ0w7QUFBQSxJQUNBLEtBQUs7QUFBQSxNQUNILElBQUksQ0FBQyxHQUFHLE1BQU07QUFDWixjQUFNLFVBQVUsQ0FBQyxPQUFnQixTQUFvQixFQUFFLEdBQUcsSUFBSTtBQUM5RCxxQ0FBWSxHQUFHLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxPQUFPO0FBQzVDLGVBQU8sTUFBTSw2QkFBWSxlQUFlLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxPQUFPO0FBQUEsTUFDdkU7QUFBQSxNQUNBLE1BQU0sQ0FBQyxNQUFNLFNBQVMsNkJBQVksS0FBSyxXQUFXLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO0FBQUEsTUFDcEUsUUFBUSxDQUFJLE1BQWMsU0FDeEIsNkJBQVksT0FBTyxXQUFXLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO0FBQUEsSUFDcEQ7QUFBQSxJQUNBLElBQUksV0FBVyxJQUFJLEtBQUs7QUFBQSxFQUMxQjtBQUNGO0FBRUEsU0FBUyxnQkFBZ0IsSUFBWTtBQUNuQyxRQUFNLE1BQU0sbUJBQW1CLEVBQUU7QUFDakMsUUFBTSxPQUFPLE1BQStCO0FBQzFDLFFBQUk7QUFDRixhQUFPLEtBQUssTUFBTSxhQUFhLFFBQVEsR0FBRyxLQUFLLElBQUk7QUFBQSxJQUNyRCxRQUFRO0FBQ04sYUFBTyxDQUFDO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFDQSxRQUFNLFFBQVEsQ0FBQyxNQUNiLGFBQWEsUUFBUSxLQUFLLEtBQUssVUFBVSxDQUFDLENBQUM7QUFDN0MsU0FBTztBQUFBLElBQ0wsS0FBSyxDQUFJLEdBQVcsTUFBVyxLQUFLLEtBQUssSUFBSyxLQUFLLEVBQUUsQ0FBQyxJQUFXO0FBQUEsSUFDakUsS0FBSyxDQUFDLEdBQVcsTUFBZTtBQUM5QixZQUFNLElBQUksS0FBSztBQUNmLFFBQUUsQ0FBQyxJQUFJO0FBQ1AsWUFBTSxDQUFDO0FBQUEsSUFDVDtBQUFBLElBQ0EsUUFBUSxDQUFDLE1BQWM7QUFDckIsWUFBTSxJQUFJLEtBQUs7QUFDZixhQUFPLEVBQUUsQ0FBQztBQUNWLFlBQU0sQ0FBQztBQUFBLElBQ1Q7QUFBQSxJQUNBLEtBQUssTUFBTSxLQUFLO0FBQUEsRUFDbEI7QUFDRjtBQUVBLFNBQVMsV0FBVyxJQUFZLFFBQW1CO0FBRWpELFNBQU87QUFBQSxJQUNMLFNBQVMsdUJBQXVCLEVBQUU7QUFBQSxJQUNsQyxNQUFNLENBQUMsTUFDTCw2QkFBWSxPQUFPLG9CQUFvQixRQUFRLElBQUksQ0FBQztBQUFBLElBQ3RELE9BQU8sQ0FBQyxHQUFXLE1BQ2pCLDZCQUFZLE9BQU8sb0JBQW9CLFNBQVMsSUFBSSxHQUFHLENBQUM7QUFBQSxJQUMxRCxRQUFRLENBQUMsTUFDUCw2QkFBWSxPQUFPLG9CQUFvQixVQUFVLElBQUksQ0FBQztBQUFBLEVBQzFEO0FBQ0Y7OztBQ3ZQQSxJQUFBRSxtQkFBNEI7QUFHNUIsZUFBc0IsZUFBOEI7QUFDbEQsUUFBTSxTQUFVLE1BQU0sNkJBQVksT0FBTyxxQkFBcUI7QUFJOUQsUUFBTSxRQUFTLE1BQU0sNkJBQVksT0FBTyxvQkFBb0I7QUFNNUQsa0JBQWdCO0FBQUEsSUFDZCxJQUFJO0FBQUEsSUFDSixPQUFPO0FBQUEsSUFDUCxhQUFhLEdBQUcsT0FBTyxNQUFNLGtDQUFrQyxNQUFNLFFBQVE7QUFBQSxJQUM3RSxPQUFPLE1BQU07QUFDWCxXQUFLLE1BQU0sVUFBVTtBQUVyQixZQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsY0FBUSxNQUFNLFVBQVU7QUFDeEIsY0FBUTtBQUFBLFFBQ047QUFBQSxVQUFPO0FBQUEsVUFBc0IsTUFDM0IsNkJBQVksT0FBTyxrQkFBa0IsTUFBTSxTQUFTLEVBQUUsTUFBTSxNQUFNO0FBQUEsVUFBQyxDQUFDO0FBQUEsUUFDdEU7QUFBQSxNQUNGO0FBQ0EsY0FBUTtBQUFBLFFBQ047QUFBQSxVQUFPO0FBQUEsVUFBYSxNQUNsQiw2QkFBWSxPQUFPLGtCQUFrQixNQUFNLE1BQU0sRUFBRSxNQUFNLE1BQU07QUFBQSxVQUFDLENBQUM7QUFBQSxRQUNuRTtBQUFBLE1BQ0Y7QUFDQSxjQUFRO0FBQUEsUUFDTixPQUFPLGlCQUFpQixNQUFNLFNBQVMsT0FBTyxDQUFDO0FBQUEsTUFDakQ7QUFDQSxXQUFLLFlBQVksT0FBTztBQUV4QixVQUFJLE9BQU8sV0FBVyxHQUFHO0FBQ3ZCLGNBQU0sUUFBUSxTQUFTLGNBQWMsR0FBRztBQUN4QyxjQUFNLE1BQU0sVUFBVTtBQUN0QixjQUFNLGNBQ0o7QUFDRixhQUFLLFlBQVksS0FBSztBQUN0QjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLE9BQU8sU0FBUyxjQUFjLElBQUk7QUFDeEMsV0FBSyxNQUFNLFVBQVU7QUFDckIsaUJBQVcsS0FBSyxRQUFRO0FBQ3RCLGNBQU0sS0FBSyxTQUFTLGNBQWMsSUFBSTtBQUN0QyxXQUFHLE1BQU0sVUFDUDtBQUNGLGNBQU0sT0FBTyxTQUFTLGNBQWMsS0FBSztBQUN6QyxhQUFLLFlBQVk7QUFBQSxrREFDeUIsT0FBTyxFQUFFLFNBQVMsSUFBSSxDQUFDLCtDQUErQyxPQUFPLEVBQUUsU0FBUyxPQUFPLENBQUM7QUFBQSx5REFDekYsT0FBTyxFQUFFLFNBQVMsZUFBZSxFQUFFLFNBQVMsRUFBRSxDQUFDO0FBQUE7QUFFaEcsY0FBTSxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQzFDLGNBQU0sTUFBTSxVQUFVO0FBQ3RCLGNBQU0sY0FBYyxFQUFFLGNBQWMsV0FBVztBQUMvQyxXQUFHLE9BQU8sTUFBTSxLQUFLO0FBQ3JCLGFBQUssT0FBTyxFQUFFO0FBQUEsTUFDaEI7QUFDQSxXQUFLLE9BQU8sSUFBSTtBQUFBLElBQ2xCO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFQSxTQUFTLE9BQU8sT0FBZSxTQUF3QztBQUNyRSxRQUFNLElBQUksU0FBUyxjQUFjLFFBQVE7QUFDekMsSUFBRSxPQUFPO0FBQ1QsSUFBRSxjQUFjO0FBQ2hCLElBQUUsTUFBTSxVQUNOO0FBQ0YsSUFBRSxpQkFBaUIsU0FBUyxPQUFPO0FBQ25DLFNBQU87QUFDVDtBQUVBLFNBQVMsT0FBTyxHQUFtQjtBQUNqQyxTQUFPLEVBQUU7QUFBQSxJQUFRO0FBQUEsSUFBWSxDQUFDLE1BQzVCLE1BQU0sTUFDRixVQUNBLE1BQU0sTUFDSixTQUNBLE1BQU0sTUFDSixTQUNBLE1BQU0sTUFDSixXQUNBO0FBQUEsRUFDWjtBQUNGOzs7QUo3RUEsU0FBUyxRQUFRLE9BQWUsT0FBdUI7QUFDckQsUUFBTSxNQUFNLDRCQUE0QixLQUFLLEdBQzNDLFVBQVUsU0FBWSxLQUFLLE1BQU1DLGVBQWMsS0FBSyxDQUN0RDtBQUNBLE1BQUk7QUFDRixZQUFRLE1BQU0sR0FBRztBQUFBLEVBQ25CLFFBQVE7QUFBQSxFQUFDO0FBQ1QsTUFBSTtBQUNGLGlDQUFZLEtBQUssdUJBQXVCLFFBQVEsR0FBRztBQUFBLEVBQ3JELFFBQVE7QUFBQSxFQUFDO0FBQ1g7QUFDQSxTQUFTQSxlQUFjLEdBQW9CO0FBQ3pDLE1BQUk7QUFDRixXQUFPLE9BQU8sTUFBTSxXQUFXLElBQUksS0FBSyxVQUFVLENBQUM7QUFBQSxFQUNyRCxRQUFRO0FBQ04sV0FBTyxPQUFPLENBQUM7QUFBQSxFQUNqQjtBQUNGO0FBRUEsUUFBUSxpQkFBaUIsRUFBRSxLQUFLLFNBQVMsS0FBSyxDQUFDO0FBRy9DLElBQUk7QUFDRixtQkFBaUI7QUFDakIsVUFBUSxzQkFBc0I7QUFDaEMsU0FBUyxHQUFHO0FBQ1YsVUFBUSxxQkFBcUIsT0FBTyxDQUFDLENBQUM7QUFDeEM7QUFFQSxlQUFlLE1BQU07QUFDbkIsTUFBSSxTQUFTLGVBQWUsV0FBVztBQUNyQyxhQUFTLGlCQUFpQixvQkFBb0IsTUFBTSxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQUEsRUFDcEUsT0FBTztBQUNMLFNBQUs7QUFBQSxFQUNQO0FBQ0YsQ0FBQztBQUVELGVBQWUsT0FBTztBQUNwQixVQUFRLGNBQWMsRUFBRSxZQUFZLFNBQVMsV0FBVyxDQUFDO0FBQ3pELE1BQUk7QUFDRiwwQkFBc0I7QUFDdEIsWUFBUSwyQkFBMkI7QUFDbkMsVUFBTSxlQUFlO0FBQ3JCLFlBQVEsb0JBQW9CO0FBQzVCLFVBQU0sYUFBYTtBQUNuQixZQUFRLGlCQUFpQjtBQUN6QixvQkFBZ0I7QUFDaEIsWUFBUSxlQUFlO0FBQUEsRUFDekIsU0FBUyxHQUFHO0FBQ1YsWUFBUSxlQUFlLE9BQVEsR0FBYSxTQUFTLENBQUMsQ0FBQztBQUN2RCxZQUFRLE1BQU0seUNBQXlDLENBQUM7QUFBQSxFQUMxRDtBQUNGO0FBSUEsSUFBSSxZQUFrQztBQUN0QyxTQUFTLGtCQUF3QjtBQUMvQiwrQkFBWSxHQUFHLDBCQUEwQixNQUFNO0FBQzdDLFFBQUksVUFBVztBQUNmLGlCQUFhLFlBQVk7QUFDdkIsVUFBSTtBQUNGLGdCQUFRLEtBQUssdUNBQXVDO0FBQ3BELDBCQUFrQjtBQUNsQixjQUFNLGVBQWU7QUFDckIsY0FBTSxhQUFhO0FBQUEsTUFDckIsU0FBUyxHQUFHO0FBQ1YsZ0JBQVEsTUFBTSx1Q0FBdUMsQ0FBQztBQUFBLE1BQ3hELFVBQUU7QUFDQSxvQkFBWTtBQUFBLE1BQ2Q7QUFBQSxJQUNGLEdBQUc7QUFBQSxFQUNMLENBQUM7QUFDSDsiLAogICJuYW1lcyI6IFsiaW1wb3J0X2VsZWN0cm9uIiwgInJvb3QiLCAiY2FyZCIsICJpbXBvcnRfZWxlY3Ryb24iLCAibW9kdWxlIiwgImV4cG9ydHMiLCAiaW1wb3J0X2VsZWN0cm9uIiwgInNhZmVTdHJpbmdpZnkiXQp9Cg==
