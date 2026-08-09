// Dream Skin 换肤 tweak —— 把 Codex Dream Skin 的渲染器注入脚本搬进 chatgpt-plusplus。
// 预设目录（theme.json + background.jpg）作为随包资源读取；上传图片可新建并
// 持久化自定义主题（图片 data URL 存 tweak 数据目录，索引文件管理列表）。
// 选中项持久化在 api.storage，切换主题即热更新；tweak 被禁用或卸载时 stop() 清理现场。
"use strict";

const TWEAK_VERSION = "1.1.0";

// 随包预设：目录结构与 Codex-Dream-Skin 仓库的 macos/presets 一致。
const PRESET_IDS = [
  "preset-midnight-aurora",
  "preset-romantic-rose",
  "preset-amber-dusk",
  "preset-cyber-neon",
  "preset-forest-mist",
  "preset-sakura-dawn",
];

const DEFAULT_PRESET = "preset-midnight-aurora";
const MAX_CUSTOM_BG_BYTES = 16 * 1024 * 1024; // 与 Dream-Skin 一致：16 MB 上限
let applySeq = 0; // 连点守卫：只让最后一次 applyTheme 生效

// 自定义主题使用的中性主题模板：只替换背景图，不改变文字/配色体系。
const CUSTOM_THEME = {
  schemaVersion: 1,
  id: "custom",
  name: "自定义主题",
  appearance: "auto",
  art: { focusX: 0.5, focusY: 0.5, safeArea: "center", taskMode: "ambient" },
};

// data: URL（来自主进程 read-tweak-asset）解码为原始文本。
function decodeDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const base64 = dataUrl.slice(comma + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// 缩略图用 blob URL 而非 data URL：Codex 页面 CSP 可能拦截 img-src data:，
// blob: 与注入脚本背景图机制一致，可正常显示。
const objectUrls = new Set();
function dataUrlToObjectUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] || "image/png";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  objectUrls.add(url);
  return url;
}
function revokeObjectUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
}

// 清理当前注入：优先用注入脚本自带的 cleanup，再兜底移除标记与节点。
function teardownSkin() {
  try {
    const state = window.__CODEX_DREAM_SKIN_STATE__;
    if (state && typeof state.cleanup === "function") state.cleanup();
  } catch (e) {
    console.warn("[dream-skin] cleanup failed", e);
  }
  document.documentElement?.classList.remove("codex-dream-skin");
  document.getElementById("codex-dream-skin-style")?.remove();
  document.getElementById("codex-dream-skin-chrome")?.remove();
  delete window.__CODEX_DREAM_SKIN_STATE__;
}

// 用 Dream-Skin 的模板组装 payload 并在 preload 上下文执行。
// preload 沙箱与页面共享 DOM，new Function 与 tweak-host 自身加载 tweak 的方式一致。
async function applyTheme(api, theme, artUrl) {
  const seq = ++applySeq;
  teardownSkin();
  const [cssData, templateData] = await Promise.all([
    api.fs.asset("assets/dream-skin.css"),
    api.fs.asset("assets/renderer-inject.js"),
  ]);
  if (seq !== applySeq) return; // 已有更新的切换请求，丢弃本次
  const css = decodeDataUrl(cssData);
  const template = decodeDataUrl(templateData);
  const styleRevision =
    "codexpp:" + (theme.id || "custom") + ":" + String(artUrl.length);
  const payload = template
    .replace("__DREAM_SKIN_CSS_JSON__", JSON.stringify(css))
    .replace("__DREAM_SKIN_ART_JSON__", JSON.stringify(artUrl))
    .replace("__DREAM_SKIN_THEME_JSON__", JSON.stringify(theme))
    .replace("__DREAM_SKIN_VERSION_JSON__", JSON.stringify(TWEAK_VERSION))
    .replace("__DREAM_SKIN_STYLE_REVISION_JSON__", JSON.stringify(styleRevision));
  // eslint-disable-next-line no-new-func
  new Function(payload)();
}

async function loadPresetTheme(api, presetId) {
  const dataUrl = await api.fs.asset(`presets/${presetId}/theme.json`);
  return JSON.parse(decodeDataUrl(dataUrl));
}

// ── 自定义主题（上传图片新建）持久化 ──────────────────────────────
// api.fs 只提供文本读写且无目录列举，所以用 custom/index.json 存列表，
// 每个主题一个 custom/<id>.json（含 name、artUrl、theme）。

async function readCustomIndex(api) {
  try {
    const list = JSON.parse(await api.fs.read("custom/index.json"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// 旧版 Codex Dream Skin 最后应用的是「木之本樱 春日祭」；迁移后首次启动
// 恢复该主题，避免新应用停在默认/测试项上。只执行一次。
async function migrateLegacySelection(api, list) {
  if (api.storage.get("selectionMigrated")) return;
  api.storage.set("selectionMigrated", true);
  const target =
    list.find((x) => x.name === "木之本樱 春日祭") || list[list.length - 1];
  if (target) api.storage.set("selection", { type: "custom", id: target.id });
}

// 索引写入串行化，避免快速连续创建/删除时相互覆盖。
let indexChain = Promise.resolve();
function updateCustomIndex(api, mutate) {
  const run = indexChain.then(async () => {
    const list = await readCustomIndex(api);
    const next = await mutate(list);
    await api.fs.write("custom/index.json", JSON.stringify(next));
    return next;
  });
  // 单次写入失败不能卡死后续操作
  indexChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readCustomRecord(api, id) {
  const rec = JSON.parse(await api.fs.read(`custom/${id}.json`));
  if (!rec || typeof rec.artUrl !== "string") throw new Error(`bad custom record: ${id}`);
  return rec;
}

async function createCustomTheme(api, file, dataUrl) {
  const id = `custom-${Date.now()}`;
  const name = String(file.name || "").replace(/\.[^.]+$/, "") || "自定义主题";
  const theme = { ...CUSTOM_THEME, id, name };
  await api.fs.write(
    `custom/${id}.json`,
    JSON.stringify({ name, artUrl: dataUrl, theme }),
  );
  await updateCustomIndex(api, (list) => {
    if (list.some((x) => x.id === id)) return list;
    list.push({ id, name });
    return list;
  });
  return { id, name };
}

async function applyCustomTheme(api, id) {
  const rec = await readCustomRecord(api, id);
  await applyTheme(api, rec.theme, rec.artUrl);
}

// 应用当前选中项；未选中时使用默认预设（与 Dream-Skin 安装行为一致）。
async function applySaved(api) {
  const sel = api.storage.get("selection") || { type: "preset", id: DEFAULT_PRESET };
  try {
    if (sel.type === "none") {
      teardownSkin();
      return;
    }
    if (sel.type === "custom") {
      if (sel.id) {
        await applyCustomTheme(api, sel.id);
      } else {
        // 旧版单槽位 custom-bg.txt 迁移成自定义主题
        const artUrl = await api.fs.read("custom-bg.txt");
        if (!artUrl || !artUrl.startsWith("data:image/")) {
          teardownSkin();
          return;
        }
        const id = "legacy";
        const theme = { ...CUSTOM_THEME, id, name: "迁移的自定义背景" };
        await api.fs.write(
          `custom/${id}.json`,
          JSON.stringify({ name: theme.name, artUrl, theme }),
        );
        await updateCustomIndex(api, (list) => {
          if (list.some((x) => x.id === id)) return list;
          list.push({ id, name: theme.name });
          return list;
        });
        api.storage.set("selection", { type: "custom", id });
        await applyTheme(api, theme, artUrl);
      }
      api.log.info("theme applied:", sel.id || "legacy");
      return;
    }
    const theme = await loadPresetTheme(api, sel.id);
    const artUrl = await api.fs.asset(`presets/${sel.id}/background.jpg`);
    await applyTheme(api, theme, artUrl);
    api.log.info("theme applied:", sel.id);
  } catch (e) {
    api.log.error("theme apply failed:", String((e && e.stack) || e));
    // 自定义主题记录丢失（数据目录被清理等）时，清理界面并重置选择，
    // 避免停在损坏状态；预设资源随包存在，不会出现这种情况。
    if (sel.type === "custom") {
      teardownSkin();
      api.storage.set("selection", { type: "none" });
    }
  }
}

// ── 设置页 UI（沿用 chatgpt-plusplus 文档里的 Codex token 样式）──

let statusEl = null;
let renderSeq = 0; // 渲染代次：重建页面后丢弃过期异步回调（如“我的主题”列表）

function makeTitle(text, description) {
  const wrap = document.createElement("div");
  wrap.className = "flex flex-col gap-1";
  const h = document.createElement("div");
  h.className = "text-base font-medium text-token-text-primary";
  h.textContent = text;
  wrap.append(h);
  if (description) {
    const p = document.createElement("div");
    p.className = "text-sm text-token-text-secondary";
    p.textContent = description;
    wrap.append(p);
  }
  return wrap;
}

function makeCard() {
  const el = document.createElement("div");
  el.className =
    "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border";
  el.style.backgroundColor = "var(--color-background-panel, var(--color-token-bg-fog))";
  return el;
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function renderPage(api, root) {
  const seq = ++renderSeq;
  revokeObjectUrls(); // 释放上一轮缩略图 blob URL
  root.innerHTML = "";
  root.append(
    makeTitle(
      "Dream Skin 换肤",
      "预设一键切换，或用图片新建自定义主题；选择会持久化，重启 Codex 后自动恢复。",
    ),
  );

  const card = makeCard();

  // 当前状态行
  const statusRow = document.createElement("div");
  statusRow.className = "flex items-center justify-between gap-4 p-3";
  const statusLabel = document.createElement("div");
  statusLabel.className = "min-w-0 text-sm text-token-text-primary";
  statusLabel.textContent = "当前状态";
  statusEl = document.createElement("div");
  statusEl.className = "min-w-0 text-sm text-token-text-secondary";
  statusEl.textContent = "读取中…";
  statusRow.append(statusLabel, statusEl);
  card.append(statusRow);
  root.append(card);

  const updateStatus = async () => {
    // 每次读最新 selection，避免页面快照过期导致状态行显示旧主题
    const current = api.storage.get("selection") || { type: "preset", id: DEFAULT_PRESET };
    if (current.type === "none") return setStatus("官方外观（未换肤）");
    if (current.type === "custom") {
      try {
        const rec = await readCustomRecord(api, current.id);
        return setStatus(rec.name || "自定义主题");
      } catch {
        return setStatus("自定义主题");
      }
    }
    try {
      const theme = await loadPresetTheme(api, current.id);
      setStatus(theme.name || current.id);
    } catch {
      setStatus(current.id);
    }
  };
  updateStatus();

  // 预设卡片
  const presetsTitle = document.createElement("div");
  presetsTitle.className = "flex h-toolbar items-center justify-between gap-2 px-0 py-0";
  const presetsTitleText = document.createElement("div");
  presetsTitleText.className = "text-sm font-medium text-token-text-primary";
  presetsTitleText.textContent = "已保存主题";
  presetsTitle.append(presetsTitleText);
  root.append(presetsTitle);

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-2 gap-3 md:grid-cols-3";
  root.append(grid);

  for (const presetId of PRESET_IDS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "border-token-border flex flex-col gap-2 rounded-lg border p-2 text-left cursor-interaction " +
      "hover:border-token-focus-border focus-visible:outline-none focus-visible:ring-2 " +
      "focus-visible:ring-token-focus-border";
    const thumb = document.createElement("div");
    thumb.className =
      "flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-token-foreground/10";
    const img = document.createElement("img");
    img.alt = "";
    img.className = "h-full w-full object-cover";
    thumb.append(img);
    const name = document.createElement("div");
    name.className = "min-w-0 text-sm text-token-text-primary";
    name.textContent = presetId;
    item.append(thumb, name);
    item.onclick = async () => {
      try {
        api.storage.set("selection", { type: "preset", id: presetId });
        const theme = await loadPresetTheme(api, presetId);
        const artUrl = await api.fs.asset(`presets/${presetId}/background.jpg`);
        await applyTheme(api, theme, artUrl);
        updateStatus();
      } catch (e) {
        api.log.error("preset apply failed", presetId, String(e));
        setStatus("应用失败，详见日志");
      }
    };
    grid.append(item);
    api.fs
      .asset(`presets/${presetId}/background.jpg`)
      .then((dataUrl) => {
        img.src = dataUrlToObjectUrl(dataUrl);
      })
      .catch((e) => api.log.warn("preset thumb failed", presetId, String(e)));
    img.onerror = () => api.log.warn("preset thumb render failed", presetId);
    loadPresetTheme(api, presetId)
      .then((theme) => {
        name.textContent = theme.name || presetId;
      })
      .catch(() => {});
  }

  // 上传图片新建自定义主题
  root.append(
    makeTitle("新建主题", "上传一张图片作为背景，创建一个可复用的自定义主题（JPEG/PNG/WebP，≤ 16 MB）"),
  );
  const createCard = makeCard();
  const createRow = document.createElement("div");
  createRow.className = "flex items-center justify-between gap-4 p-3";
  const createLabel = document.createElement("div");
  createLabel.className = "min-w-0 text-sm text-token-text-primary";
  createLabel.textContent = "选择图片新建主题";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/jpeg,image/png,image/webp";
  fileInput.className = "min-w-0 text-sm text-token-text-secondary";
  createRow.append(createLabel, fileInput);
  createCard.append(createRow);
  root.append(createCard);

  fileInput.onchange = () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (file.size > MAX_CUSTOM_BG_BYTES) {
      setStatus("图片超过 16 MB 上限，未创建主题");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) {
        setStatus("无法读取该图片，未创建主题");
        return;
      }
      try {
        const created = await createCustomTheme(api, file, dataUrl);
        api.storage.set("selection", { type: "custom", id: created.id });
        await applyCustomTheme(api, created.id);
        renderPage(api, root); // 重建列表，展示新主题
      } catch (e) {
        api.log.error("custom theme create failed", String(e));
        setStatus("创建失败，详见日志");
      }
    };
    reader.readAsDataURL(file);
  };

  // 我的主题列表
  readCustomIndex(api).then((list) => {
    if (seq !== renderSeq) return; // 页面已重建，丢弃过期渲染
    if (!list.length) return;
    const title = document.createElement("div");
    title.className = "flex h-toolbar items-center justify-between gap-2 px-0 py-0";
    const titleText = document.createElement("div");
    titleText.className = "text-sm font-medium text-token-text-primary";
    titleText.textContent = "我的主题";
    title.append(titleText);
    root.append(title);

    const myGrid = document.createElement("div");
    myGrid.className = "grid grid-cols-2 gap-3 md:grid-cols-3";
    root.append(myGrid);

    for (const entry of list) {
      const item = document.createElement("div");
      item.className =
        "border-token-border flex flex-col gap-2 rounded-lg border p-2";
      const thumb = document.createElement("div");
      thumb.className =
        "flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-token-foreground/10";
      const img = document.createElement("img");
      img.alt = "";
      img.className = "h-full w-full object-cover";
      thumb.append(img);
      const name = document.createElement("div");
      name.className = "min-w-0 text-sm text-token-text-primary";
      name.textContent = entry.name || entry.id;
      const actions = document.createElement("div");
      actions.className = "flex items-center justify-between gap-2";
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className =
        "text-sm text-token-text-link-foreground hover:underline cursor-interaction";
      applyBtn.textContent = "应用";
      applyBtn.onclick = async () => {
        try {
          api.storage.set("selection", { type: "custom", id: entry.id });
          await applyCustomTheme(api, entry.id);
          updateStatus();
        } catch (e) {
          api.log.error("custom apply failed", entry.id, String(e));
          setStatus("应用失败，详见日志");
        }
      };
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className =
        "text-sm text-token-text-secondary hover:text-token-text-primary hover:underline cursor-interaction";
      deleteBtn.textContent = "删除";
      deleteBtn.onclick = async () => {
        // ponytail: api.fs 无 delete，只从索引移除，文件残留在数据目录，
        // 之后给 rendererFs 加 remove 时再清理。
        try {
          await updateCustomIndex(api, (l) => l.filter((x) => x.id !== entry.id));
          const current = api.storage.get("selection");
          if (current && current.type === "custom" && current.id === entry.id) {
            api.storage.set("selection", { type: "none" });
            teardownSkin();
          }
          renderPage(api, root);
        } catch (e) {
          api.log.error("custom delete failed", entry.id, String(e));
          setStatus("删除失败，详见日志");
        }
      };
      actions.append(applyBtn, deleteBtn);
      item.append(thumb, name, actions);
      myGrid.append(item);
      readCustomRecord(api, entry.id)
        .then((rec) => {
          img.src = dataUrlToObjectUrl(rec.artUrl);
        })
        .catch((e) => api.log.warn("custom thumb failed", entry.id, String(e)));
      img.onerror = () => api.log.warn("custom thumb render failed", entry.id);
    }
  });

  // 恢复官方外观
  const restoreCard = makeCard();
  const restoreRow = document.createElement("div");
  restoreRow.className = "flex items-center justify-between gap-4 p-3";
  const restoreLabel = document.createElement("div");
  restoreLabel.className = "min-w-0 text-sm text-token-text-primary";
  restoreLabel.textContent = "恢复官方外观";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className =
    "inline-flex items-center gap-1 text-sm text-token-text-link-foreground hover:underline cursor-interaction";
  restoreBtn.textContent = "恢复";
  restoreBtn.onclick = () => {
    api.storage.set("selection", { type: "none" });
    teardownSkin();
    updateStatus();
  };
  restoreRow.append(restoreLabel, restoreBtn);
  restoreCard.append(restoreRow);
  root.append(restoreCard);
}



// ── 主侧边栏“主题”一级入口：在“插件”后插入按钮，点击后在主内容区渲染同一套主题页 ──
// 主界面 main（_MainContentSurface）即内容区；Codex 导航时 React 复用内容 DIV 而不移除
// 我们的 host，因此点击其它官方侧边栏按钮时必须主动恢复官方视图。
let mainNavObserver = null;
let mainThemeBtn = null;
let mainThemeHost = null;
let mainSidebarGroup = null;
let loggedSidebarOnce = false;

function findMainPluginBtn() {
  // 新版 ChatGPT 把侧边栏项从 button 改成了 div[role="link"]，两种都匹配
  return [...document.querySelectorAll(".sidebar-item")]
    .find((b) => ["插件", "Plugins"].includes((b.textContent || "").trim()));
}

const MAIN_THEME_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>';

function makeMainThemeBtn(plug) {
  // 参照官方 sidebar-item 样式重建：只保留图标 + “主题”文本，
  // clone 官方按钮会残留原按钮多余的文本节点导致换行乱码
  const isLink = plug.tagName !== "BUTTON";
  const btn = document.createElement(isLink ? "div" : "button");
  if (!isLink) btn.type = "button";
  else {
    btn.setAttribute("role", "link");
    btn.setAttribute("tabindex", "0");
  }
  btn.className = plug.className;
  btn.setAttribute("data-codexpp-main-theme", "true");
  btn.classList.remove("bg-token-list-hover-background");
  const isZh = /[\u4e00-\u9fff]/.test(plug.textContent || "");
  const label = isZh ? "主题" : "Theme";
  const inner = document.createElement("div");
  inner.className = "flex min-w-0 items-center text-base gap-2 flex-1 text-token-foreground";
  inner.innerHTML = MAIN_THEME_ICON_SVG + `<span class="truncate">${label}</span>`;
  btn.setAttribute("aria-label", label);
  btn.appendChild(inner);
  return btn;
}

function setMainThemeActive(active) {
  if (!mainThemeBtn) return;
  if (active) mainThemeBtn.classList.add("bg-token-list-hover-background");
  else mainThemeBtn.classList.remove("bg-token-list-hover-background");
}

function restoreMainTheme() {
  if (!mainThemeHost) return;
  const mainEl = document.querySelector("main");
  if (mainEl) {
    for (const child of Array.from(mainEl.children)) {
      if (child === mainThemeHost) continue;
      if (child.dataset && child.dataset.codexppMainHidden !== undefined) {
        child.style.display = child.dataset.codexppMainHidden;
        delete child.dataset.codexppMainHidden;
      }
    }
  }
  mainThemeHost.remove();
  mainThemeHost = null;
  setMainThemeActive(false);
}

function activateMainTheme(api) {
  const mainEl = document.querySelector("main");
  if (!mainEl) return;
  if (mainThemeHost && mainEl.contains(mainThemeHost)) {
    setMainThemeActive(true);
    return;
  }
  const host = document.createElement("div");
  host.dataset.codexppMainThemeHost = "true";
  // 顶部固定标题栏（h-toolbar ≈ 46px）悬于内容区之上，主题页内容从工具栏下方开始
  host.style.cssText = "width:100%;height:calc(100% - 46px);margin-top:46px;overflow:auto;";
  for (const child of Array.from(mainEl.children)) {
    if (child === host) continue;
    const r = child.getBoundingClientRect();
    // 固定标题栏与拖拽辅助节点（宽/高极小）不动，只隐藏实际内容容器
    if (r.width < 50 || r.height < 50) continue;
    if (child.dataset && child.dataset.codexppMainHidden !== undefined) continue;
    child.dataset.codexppMainHidden = child.style.display || "";
    child.style.display = "none";
  }
  mainEl.appendChild(host);
  mainThemeHost = host;
  renderPage(api, host);
  setMainThemeActive(true);
}

function onMainSidebarClick(e) {
  const t = e.target instanceof Element ? e.target.closest("button, [role=\"link\"]") : null;
  if (!t) return;
  if (t === mainThemeBtn || (t.dataset && t.dataset.codexppMainTheme)) return;
  restoreMainTheme();
}

function syncMainNav(api) {
  let plug = findMainPluginBtn();
  // 兜底：新版界面若已无“插件”项，也把“主题”入口挂到侧边栏首项后面，
  // 保证入口始终在首页侧边栏可见；同时记录真实 DOM 结构便于排查。
  if (!plug) {
    plug = document.querySelector(".sidebar-item");
    if (plug && !mainThemeBtn) {
      api.log.info(
        "main nav: 未找到插件入口，兜底挂到首项",
        JSON.stringify({
          items: [...document.querySelectorAll(".sidebar-item")].map((el) => ({
            tag: el.tagName,
            role: el.getAttribute("role"),
            text: (el.textContent || "").trim().slice(0, 30),
          })),
        }),
      );
    }
  }
  if (!plug) {
    if (mainThemeBtn) {
      mainThemeBtn.remove();
      mainThemeBtn = null;
    }
    if (mainSidebarGroup) {
      mainSidebarGroup.removeEventListener("click", onMainSidebarClick, true);
      mainSidebarGroup = null;
    }
    restoreMainTheme();
    return;
  }
  const group = plug.parentElement;
  // fingerprint：按钮已在正确位置时跳过，避免 MutationObserver 死循环
  if (mainThemeBtn && mainThemeBtn.parentElement === group) {
    if (mainSidebarGroup !== group) {
      if (mainSidebarGroup) mainSidebarGroup.removeEventListener("click", onMainSidebarClick, true);
      mainSidebarGroup = group;
      group.addEventListener("click", onMainSidebarClick, true);
    }
    return;
  }
  if (mainThemeBtn) mainThemeBtn.remove();
  mainThemeBtn = makeMainThemeBtn(plug);
  mainThemeBtn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      activateMainTheme(api);
    },
    true,
  );
  plug.insertAdjacentElement("afterend", mainThemeBtn);
  if (!loggedSidebarOnce) {
    loggedSidebarOnce = true;
    api.log.info(
      "main nav: sidebar items",
      JSON.stringify(
        [...document.querySelectorAll(".sidebar-item")].map((el) => ({
          tag: el.tagName,
          role: el.getAttribute("role"),
          text: (el.textContent || "").trim().slice(0, 40),
          ours: !!el.getAttribute("data-codexpp-main-theme"),
        })),
      ),
    );
  }
  if (mainSidebarGroup !== group) {
    if (mainSidebarGroup) mainSidebarGroup.removeEventListener("click", onMainSidebarClick, true);
    mainSidebarGroup = group;
    group.addEventListener("click", onMainSidebarClick, true);
  }
  setMainThemeActive(!!mainThemeHost);
}

function cleanupMainNavResidue() {
  for (const btn of [...document.querySelectorAll("[data-codexpp-main-theme]")]) btn.remove();
  const mainEl = document.querySelector("main");
  if (mainEl) {
    for (const host of [...mainEl.querySelectorAll("[data-codexpp-main-theme-host]")]) host.remove();
    for (const child of [...mainEl.querySelectorAll("[data-codexpp-main-hidden]")]) {
      child.style.display = child.dataset.codexppMainHidden || "";
      delete child.dataset.codexppMainHidden;
    }
  }
}

function startMainNav(api) {
  if (mainNavObserver) return;
  cleanupMainNavResidue();
  syncMainNav(api);
  mainNavObserver = new MutationObserver(() => syncMainNav(api));
  mainNavObserver.observe(document.documentElement, { childList: true, subtree: true });
  api.log.info("main nav ready", JSON.stringify({ href: location.href, plug: !!findMainPluginBtn() }));
}

function stopMainNav() {
  if (mainNavObserver) {
    mainNavObserver.disconnect();
    mainNavObserver = null;
  }
  if (mainSidebarGroup) {
    mainSidebarGroup.removeEventListener("click", onMainSidebarClick, true);
    mainSidebarGroup = null;
  }
  if (mainThemeBtn) {
    mainThemeBtn.remove();
    mainThemeBtn = null;
  }
  restoreMainTheme();
}

module.exports = {
  async start(api) {
    if (api.process !== "renderer") return;
    // 宠物/迷你窗口不换肤：避免 Dream Skin 背景把官方透明背景盖成空白框
    if (document.documentElement?.classList.contains("compact-window")) {
      teardownSkin();
      return;
    }
    const list = await readCustomIndex(api);
    await migrateLegacySelection(api, list);
    const sel = api.storage.get("selection") || { type: "preset", id: DEFAULT_PRESET };
    await applySaved(api);
    startMainNav(api);
  },
  stop() {
    stopMainNav();
    teardownSkin();
  },
};
