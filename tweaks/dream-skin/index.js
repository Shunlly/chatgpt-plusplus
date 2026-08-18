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
// 独立 GUI（packages/gui）通过该文件切换主题：tweak 定期轮询并双向同步。
const SELECTION_FILE = "selection.json";
let selectionPoll = null;
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
// 优化方案 4.3：引用计数 + LRU 缓存，防止内存泄漏（简化版，完整版在 GUI art-store.ts）
const objectUrlCache = new Map(); // dataUrl -> { blobUrl, refs, lastUsed }
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB 上限（tweaks 运行在页面上下文，比 GUI 更保守）

function dataUrlToObjectUrl(dataUrl) {
  // 从缓存中复用
  const cached = objectUrlCache.get(dataUrl);
  if (cached) {
    cached.refs += 1;
    cached.lastUsed = Date.now();
    return cached.blobUrl;
  }

  // 创建新的 Blob URL
  const comma = dataUrl.indexOf(",");
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] || "image/png";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));

  objectUrlCache.set(dataUrl, {
    blobUrl: url,
    refs: 1,
    lastUsed: Date.now(),
    sizeBytes: Math.ceil((bin.length * 3) / 4)
  });

  // 淘汰超限条目
  evictBlobUrlCache();
  return url;
}

function releaseBlobUrl(dataUrl) {
  const cached = objectUrlCache.get(dataUrl);
  if (cached) {
    cached.refs = Math.max(0, cached.refs - 1);
    cached.lastUsed = Date.now();
  }
}

function evictBlobUrlCache() {
  let totalBytes = 0;
  for (const entry of objectUrlCache.values()) {
    totalBytes += entry.sizeBytes;
  }

  if (totalBytes <= MAX_CACHE_SIZE) return;

  // LRU 淘汰：优先踢出无引用且最久未用的
  const entries = Array.from(objectUrlCache.entries())
    .filter(([_, e]) => e.refs === 0)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  for (const [dataUrl, entry] of entries) {
    if (totalBytes <= MAX_CACHE_SIZE * 0.8) break; // 淘汰到 80%
    objectUrlCache.delete(dataUrl);
    URL.revokeObjectURL(entry.blobUrl);
    totalBytes -= entry.sizeBytes;
  }
}

function revokeObjectUrls() {
  for (const entry of objectUrlCache.values()) {
    URL.revokeObjectURL(entry.blobUrl);
  }
  objectUrlCache.clear();
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
// 把当前选择写盘，供独立 GUI（packages/gui）读取；应用内切换与 GUI 切换双向可见。
async function persistSelection(api) {
  try {
    await api.fs.write(SELECTION_FILE, JSON.stringify(api.storage.get("selection") || { type: "none" }));
  } catch (e) {
    api.log.warn("selection persist failed", String(e));
  }
}

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
  await persistSelection(api);
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
  } finally {
    await persistSelection(api);
  }
}

// 磁盘选择同步：独立 GUI 写入 selection.json 后，这里轮询应用（5 秒内生效）。
// 优化方案 4.2：从 2 秒提升到 5 秒，降低 CPU 占用 60%。
async function pollDiskSelection(api) {
  if (document.hidden) return;
  try {
    const text = await api.fs.read(SELECTION_FILE);
    if (!text) return;
    const disk = JSON.parse(text);
    if (!disk || typeof disk.type !== "string") return;
    const cur = api.storage.get("selection") || {};
    if (disk.type === cur.type && disk.id === cur.id) return;
    api.storage.set("selection", disk);
    await applySaved(api);
    api.log.info("selection from disk", JSON.stringify(disk));
  } catch (e) {
    // 文件不存在或写入中（半截 JSON），下轮再试
    if (String(e && e.message).includes("ENOENT")) return;
    api.log.warn("selection poll skipped", String(e));
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

  // 优化：使用 Intersection Observer 实现缩略图懒加载，减少初始加载开销
  const lazyObserver = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const presetId = img.dataset.presetId;
            if (presetId && !img.src) {
              api.fs
                .asset(`presets/${presetId}/background.jpg`)
                .then((dataUrl) => {
                  img.src = dataUrlToObjectUrl(dataUrl);
                })
                .catch((e) => api.log.warn("preset thumb failed", presetId, String(e)));
            }
            lazyObserver.unobserve(img);
          }
        });
      }, { rootMargin: "50px" })
    : null;

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
    img.dataset.presetId = presetId; // 存储 ID 用于懒加载
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

    // 使用懒加载或立即加载
    if (lazyObserver) {
      lazyObserver.observe(img);
    } else {
      // 降级：浏览器不支持 IntersectionObserver 时立即加载
      api.fs
        .asset(`presets/${presetId}/background.jpg`)
        .then((dataUrl) => {
          img.src = dataUrlToObjectUrl(dataUrl);
        })
        .catch((e) => api.log.warn("preset thumb failed", presetId, String(e)));
    }

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

  // 自定义主题并入上方“已保存主题”网格（预设之后追加），统一管理。
  readCustomIndex(api).then((list) => {
    if (seq !== renderSeq) return; // 页面已重建，丢弃过期渲染
    if (!list.length) return;
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
            await persistSelection(api);
          }
          renderPage(api, root);
        } catch (e) {
          api.log.error("custom delete failed", entry.id, String(e));
          setStatus("删除失败，详见日志");
        }
      };
      actions.append(applyBtn, deleteBtn);
      item.append(thumb, name, actions);
      grid.append(item);
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
  restoreBtn.onclick = async () => {
    api.storage.set("selection", { type: "none" });
    teardownSkin();
    await persistSelection(api);
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
// 观察器高频触发时合并到 200ms 内执行一次，避免聊天/流式输出时每次 DOM 变化都全量扫侧边栏。
let mainNavTimer = null;
let mainThemeBtn = null;
let mainThemeHost = null;
let mainSidebarGroup = null;
// 后台窗口暂停轮询，回前台立即同步，避免多会话时 N 个窗口同时空转。
let visibilityHandler = null;
let loggedSidebarOnce = false;

// ── 界面语言：默认随系统（中文系统→中文），侧边栏可手动切换并持久化 ──
// 只翻译固定菜单（New chat/Pull requests/Scheduled/Plugins/Settings），不动会话标题。
// 翻译用定时扫描而非在 MutationObserver 里改写 textContent：观察器触发改写会与
// React 渲染互相触发（v1.1.4 曾因此主线程 100% 卡死），定时扫描有去重守卫，安全。
let lang = null;
let langBtn = null;
let langTimer = null;
const SIDEBAR_LABELS = {
  "New chat": "新对话",
  "Pull requests": "拉取请求",
  "Scheduled": "定时任务",
  "Plugins": "插件",
  "Settings": "设置",
};
const LANG_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

function resolveLang(api) {
  const saved = api.storage.get("lang");
  if (saved === "zh" || saved === "en") return saved;
  return /^zh/i.test(navigator.language || "") ? "zh" : "en";
}

// 官方按钮含可见文本 + 无障碍文本等多个文本节点/span，全部替换避免拼接残留。
function replaceBtnLabel(el, text) {
  let replaced = false;
  for (const node of el.childNodes) {
    if (node.nodeType === 3 && (node.textContent || "").trim()) {
      node.textContent = text;
      replaced = true;
    }
  }
  for (const span of el.querySelectorAll("span")) {
    if (span.textContent && span.textContent.trim()) {
      span.textContent = text;
      replaced = true;
    }
  }
  return replaced;
}

// 定时扫描翻译固定菜单；已翻译的跳过（去重守卫，避免与 React 互相触发）。
function translateSidebar() {
  if (!lang || document.hidden) return;
  for (const el of [...document.querySelectorAll("button.sidebar-item")]) {
    const text = (el.textContent || "").trim();
    const zh = SIDEBAR_LABELS[text];
    if (!zh) continue;
    if (el.dataset.codexppLangOriginal === text && (el.textContent || "").trim() === zh) continue;
    if (replaceBtnLabel(el, zh)) {
      el.dataset.codexppLangOriginal = text;
      el.dataset.codexppLangZh = zh;
    }
  }
}

// 恢复英文：只还原我们翻译过的按钮。
function untranslateSidebar() {
  for (const el of [...document.querySelectorAll("button.sidebar-item[data-codexpp-lang-original]")]) {
    replaceBtnLabel(el, el.dataset.codexppLangOriginal || "");
    delete el.dataset.codexppLangOriginal;
    delete el.dataset.codexppLangZh;
  }
}

function makeLangBtn(api) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = mainThemeBtn ? mainThemeBtn.className : "sidebar-item";
  btn.setAttribute("data-codexpp-lang-toggle", "true");
  btn.classList.remove("bg-token-list-hover-background");
  const inner = document.createElement("div");
  inner.className = "flex min-w-0 items-center text-base gap-2 flex-1 text-token-foreground";
  inner.innerHTML = LANG_ICON_SVG + '<span class="truncate"></span>';
  btn.appendChild(inner);
  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      lang = lang === "zh" ? "en" : "zh";
      api.storage.set("lang", lang);
      updateLangUI();
      api.log.info("lang switched", JSON.stringify({ lang }));
    },
    true,
  );
  return btn;
}

// 只在实际文本变化时才写 DOM：textContent 赋值即使内容相同也会替换文本节点，
// 会触发全局 MutationObserver（syncMainNav）→ 再写 → 无限循环（渲染进程 100% CPU）。
function setTextOnce(el, text) {
  if (!el) return;
  if (el.textContent === text) return;
  el.textContent = text;
}
function updateLangUI() {
  if (mainThemeBtn) {
    setTextOnce(mainThemeBtn.querySelector("span.truncate"), lang === "zh" ? "主题" : "Theme");
    const label = lang === "zh" ? "主题" : "Theme";
    if (mainThemeBtn.getAttribute("aria-label") !== label) mainThemeBtn.setAttribute("aria-label", label);
  }
  if (langBtn) {
    setTextOnce(langBtn.querySelector("span.truncate"), lang === "zh" ? "English" : "中文");
    if (langBtn.getAttribute("aria-label") !== "切换语言") langBtn.setAttribute("aria-label", "切换语言");
  }
  if (lang === "zh") translateSidebar();
  else untranslateSidebar();
}

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
  const label = lang === "zh" ? "主题" : "Theme";
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

// 主题页改为浮层覆盖内容区：官方视图从不隐藏，React 导航不受干扰，
// 点击任意官方入口时移除浮层即可，修复“从主题页切回会话无反应”的问题。
function restoreMainTheme() {
  if (!mainThemeHost) return;
  mainThemeHost.remove();
  mainThemeHost = null;
  const mainEl = document.querySelector("main");
  if (mainEl && mainEl.dataset.codexppMainPos !== undefined) {
    mainEl.style.position = mainEl.dataset.codexppMainPos;
    delete mainEl.dataset.codexppMainPos;
  }
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
  // 顶部固定标题栏（h-toolbar ≈ 46px）保持可点，浮层从工具栏下方开始覆盖内容区
  // 背景沿用皮肤挂在 body 上的背景图/色，保证主题页与聊天区一致（而不是显示
  // 官方新会话的白色页面）
  const bodyStyle = getComputedStyle(document.body);
  const bgImage =
    bodyStyle.backgroundImage && bodyStyle.backgroundImage !== "none"
      ? bodyStyle.backgroundImage
      : "";
  const bgColor =
    bodyStyle.backgroundColor && bodyStyle.backgroundColor !== "transparent"
      ? bodyStyle.backgroundColor
      : "";
  host.style.cssText =
    "position:absolute;top:46px;left:0;right:0;bottom:0;overflow:auto;z-index:50;" +
    (bgImage
      ? `background-image:${bgImage};background-size:cover;background-position:center;`
      : "") +
    (bgColor ? `background-color:${bgColor};` : "");
  if (mainEl.dataset.codexppMainPos === undefined) {
    mainEl.dataset.codexppMainPos = mainEl.style.position || "";
    mainEl.style.position = "relative";
  }
  mainEl.appendChild(host);
  mainThemeHost = host;
  renderPage(api, host);
  setMainThemeActive(true);
}

function onMainSidebarClick(e) {
  const t = e.target instanceof Element ? e.target.closest("button, [role=\"link\"], [role=\"button\"]") : null;
  if (!t) return;
  if (t === mainThemeBtn || t === langBtn || (t.dataset && (t.dataset.codexppMainTheme || t.dataset.codexppLangToggle))) return;
  // 主题页内部的按钮（应用/删除/上传等）不关闭浮层
  if (mainThemeHost && mainThemeHost.contains(t)) return;
  // 点击会话列表、官方导航等任意入口时关闭主题浮层，避免“从主题页切不回去”
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
    if (langBtn) {
      langBtn.remove();
      langBtn = null;
    }
    if (mainSidebarGroup) {
      mainSidebarGroup.removeEventListener("click", onMainSidebarClick, true);
      mainSidebarGroup = null;
    }
    document.addEventListener("click", onMainSidebarClick, true);
    mainSidebarGroup = document;
    restoreMainTheme();
    return;
  }
  const group = plug.parentElement;
  // fingerprint：按钮已在正确位置时跳过，避免 MutationObserver 死循环
  if (mainThemeBtn && mainThemeBtn.parentElement === group) {
    if (langBtn && langBtn.previousElementSibling !== mainThemeBtn) {
      langBtn.remove();
      langBtn = null;
    }
    if (!langBtn) {
      langBtn = makeLangBtn(api);
      mainThemeBtn.insertAdjacentElement("afterend", langBtn);
    }
    updateLangUI();
    if (!mainSidebarGroup) {
      document.addEventListener("click", onMainSidebarClick, true);
      mainSidebarGroup = document;
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
  if (langBtn) langBtn.remove();
  langBtn = makeLangBtn(api);
  mainThemeBtn.insertAdjacentElement("afterend", langBtn);
  updateLangUI();
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
  if (!mainSidebarGroup) {
    document.addEventListener("click", onMainSidebarClick, true);
    mainSidebarGroup = document;
  }
  setMainThemeActive(!!mainThemeHost);
}

function cleanupMainNavResidue() {
  for (const btn of [...document.querySelectorAll("[data-codexpp-main-theme]")]) btn.remove();
  for (const btn of [...document.querySelectorAll("[data-codexpp-lang-toggle]")]) btn.remove();
  for (const el of [...document.querySelectorAll("button.sidebar-item[data-codexpp-lang-original]")]) {
    replaceBtnLabel(el, el.dataset.codexppLangOriginal || "");
    delete el.dataset.codexppLangOriginal;
    delete el.dataset.codexppLangZh;
  }
  const mainEl = document.querySelector("main");
  if (mainEl) {
    for (const host of [...mainEl.querySelectorAll("[data-codexpp-main-theme-host]")]) host.remove();
    if (mainEl.dataset.codexppMainPos !== undefined) {
      mainEl.style.position = mainEl.dataset.codexppMainPos;
      delete mainEl.dataset.codexppMainPos;
    }
  }
}

// 隐藏窗口不扫侧边栏；可见窗口把高频 DOM 变化合并到 200ms 内跑一次。
function scheduleMainNav(api) {
  if (document.hidden) return;
  if (mainNavTimer) return;
  mainNavTimer = setTimeout(() => {
    mainNavTimer = null;
    syncMainNav(api);
  }, 200);
}

function startMainNav(api) {
  if (mainNavObserver) return;
  cleanupMainNavResidue();
  lang = resolveLang(api);
  syncMainNav(api);
  mainNavObserver = new MutationObserver(() => scheduleMainNav(api));
  mainNavObserver.observe(document.documentElement, { childList: true, subtree: true });
  // 优化方案 4.2：语言切换检测从 2 秒提升到 5 秒，降低 CPU 占用
  if (!langTimer) langTimer = setInterval(() => translateSidebar(), 5000);
  api.log.info("main nav ready", JSON.stringify({ href: location.href, plug: !!findMainPluginBtn() }));
}

function stopMainNav() {
  if (mainNavObserver) {
    mainNavObserver.disconnect();
    mainNavObserver = null;
  }
  if (mainNavTimer) {
    clearTimeout(mainNavTimer);
    mainNavTimer = null;
  }
  if (langTimer) {
    clearInterval(langTimer);
    langTimer = null;
  }
  if (mainSidebarGroup) {
    mainSidebarGroup.removeEventListener("click", onMainSidebarClick, true);
    mainSidebarGroup = null;
  }
  if (mainThemeBtn) {
    mainThemeBtn.remove();
    mainThemeBtn = null;
  }
  if (langBtn) {
    langBtn.remove();
    langBtn = null;
  }
  restoreMainTheme();
}

module.exports = {
  async start(api) {
    if (api.process !== "renderer") return;
    // 浮层/迷你窗口不换肤：只服务首页主窗口。浮层 URL 带 initialRoute 参数，
    // compact-window 类在 preload 之后才加上，只查类会在浮层页误启动注入脚本空转。
    if (location.search || document.documentElement?.classList.contains("compact-window")) {
      teardownSkin();
      return;
    }
    const list = await readCustomIndex(api);
    await migrateLegacySelection(api, list);
    // 磁盘选择优先：独立 GUI 的切换在 ChatGPT 重启后依然生效
    try {
      const disk = JSON.parse(await api.fs.read(SELECTION_FILE));
      if (disk && disk.type) api.storage.set("selection", disk);
    } catch {
      // 文件不存在时忽略，沿用 localStorage
    }
    await applySaved(api);
    startMainNav(api);
    if (selectionPoll) clearInterval(selectionPoll);
    // 优化方案 4.2：从 2 秒提升到 5 秒，降低 CPU 占用 60%
    selectionPoll = setInterval(() => pollDiskSelection(api), 5000);
    if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = () => {
      if (!document.hidden) {
        translateSidebar();
        pollDiskSelection(api);
        if (mainNavObserver) syncMainNav(api);
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  },
  stop() {
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
    if (selectionPoll) {
      clearInterval(selectionPoll);
      selectionPoll = null;
    }
    stopMainNav();
    teardownSkin();
  },
};
