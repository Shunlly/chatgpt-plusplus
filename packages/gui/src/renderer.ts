/**
 * ChatGPT++ GUI 渲染逻辑（打包为 renderer.js，renderer.html 引入）。
 *
 * 覆盖优化方案第 3/4 章：主题页加载状态、当前主题高亮、拖拽上传+预览、
 * 响应式网格、空状态、切换动画、图片懒加载、Blob URL 引用计数与内存防护、
 * DOM 局部更新（不整页重建）。
 */
import { ArtStore } from "./art-store";

interface ThemeItem {
  id: string;
  name: string;
}

interface ThemesPayload {
  presets: ThemeItem[];
  custom: ThemeItem[];
  selection: { type?: string; id?: string } | null;
}

interface CpppApi {
  status(): Promise<{
    installed: boolean;
    version: string | null;
    apps: string[];
    appRoot: string | null;
  }>;
  themes(): Promise<ThemesPayload>;
  themeArt(type: "preset" | "custom", id: string): Promise<string | null>;
  createTheme(input: { name?: string; dataUrl?: string }): Promise<{
    ok: boolean;
    id?: string;
    name?: string;
    error?: string;
  }>;
  applyTheme(sel: { type: string; id?: string }): Promise<{ ok: boolean; error?: string }>;
  openApp(): Promise<{ ok: boolean; error: string | null }>;
  runCli(cmd: "install" | "repair" | "uninstall"): Promise<{ code: number | null }>;
  onCliLog(cb: (line: string) => void): () => void;
}

declare global {
  interface Window {
    cppp: CpppApi;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

const logBox = $("log");
function log(line: string): void {
  logBox.style.display = "block";
  logBox.textContent += (line || "") + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

function setBusy(busy: boolean): void {
  for (const b of document.querySelectorAll("button")) {
    (b as HTMLButtonElement).disabled = busy;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- 主题预览图 Blob URL 缓存（引用计数 + LRU 上限，见 art-store.ts） ---
const artStore = new ArtStore({ maxBytes: 200 * 1024 * 1024 });
let memoryWarned = false;
function checkArtMemory(): void {
  if (artStore.isOverWarnThreshold) {
    if (!memoryWarned) {
      memoryWarned = true;
      console.warn(`[dream-skin] 主题预览缓存占用过高（${Math.round(artStore.totalBytesUsed / 1024 / 1024)}MB），已自动淘汰最久未用条目`);
    }
  } else {
    memoryWarned = false;
  }
}
window.addEventListener("beforeunload", () => artStore.dispose());

// --- 主题网格：keyed 局部更新（不整页重建） ---
interface CardState {
  el: HTMLElement;
  thumbBg: HTMLElement;
  fallback: HTMLElement;
  spinner: HTMLElement;
  errorEl: HTMLElement;
  type: "none" | "preset" | "custom";
  id: string | null;
  key: string;
  name: string;
  artDataUrl: string | null;
  artState: "idle" | "loading" | "loaded" | "error";
}

const grid = $("themes");
const cards = new Map<string, CardState>();

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const key = (entry.target as HTMLElement).dataset.key;
      const card = key ? cards.get(key) : undefined;
      if (!card) continue;
      if (entry.isIntersecting) loadCardArt(card);
      else releaseCardArt(card);
    }
  },
  { rootMargin: "50px 0px" }, // 提前 50px 预加载（4.1）
);

function cardKey(type: string, id: string | null): string {
  return type === "none" ? "none" : `${type}:${id ?? ""}`;
}

function createCard(type: "none" | "preset" | "custom", id: string | null, name: string): CardState {
  const el = document.createElement("div");
  el.className = "theme-card";
  el.dataset.key = cardKey(type, id);
  el.title = name;

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const thumbBg = document.createElement("div");
  thumbBg.className = "thumb-bg";
  const fallback = document.createElement("div");
  fallback.className = "thumb-fallback";
  fallback.textContent = (name || "?").slice(0, 1);
  const spinner = document.createElement("div");
  spinner.className = "thumb-spinner";
  const errorEl = document.createElement("div");
  errorEl.className = "thumb-error";
  errorEl.textContent = "❌ 加载失败";
  thumb.append(thumbBg, fallback, spinner, errorEl);

  const badge = document.createElement("span");
  badge.className = "active-badge";
  badge.textContent = "使用中";

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = name;

  el.append(thumb, badge, nameEl);
  el.onclick = () => switchTheme(type, id, name);
  return { el, thumbBg, fallback, spinner, errorEl, type, id, key: el.dataset.key, name, artDataUrl: null, artState: "idle" };
}

async function loadCardArt(card: CardState): Promise<void> {
  if (card.type === "none" || card.artState === "loading" || card.artState === "loaded") return;
  card.artState = "loading";
  card.el.classList.add("loading");
  try {
    const dataUrl = await window.cppp.themeArt(card.type, card.id as string);
    if (!dataUrl) throw new Error("no art");
    card.artDataUrl = dataUrl;
    card.artState = "loaded";
    card.el.classList.remove("loading");
    card.el.classList.add("loaded");
    // Blob URL 引用计数：视口内持有引用，离开时 release（4.3）
    card.thumbBg.style.backgroundImage = `url("${artStore.acquire(dataUrl)}")`;
    checkArtMemory();
  } catch {
    card.artState = "error";
    card.el.classList.remove("loading");
    card.el.classList.add("error");
  }
}

function releaseCardArt(card: CardState): void {
  if (card.artState === "loaded" && card.artDataUrl) {
    artStore.release(card.artDataUrl);
  }
}

function setActive(card: CardState, active: boolean): void {
  card.el.classList.toggle("active", active);
}

// 主题切换动画：淡出 0.15s → 应用 → 淡入 0.3s（3.6）
let switching = false;
async function switchTheme(type: "none" | "preset" | "custom", id: string | null, name: string): Promise<void> {
  if (switching) return;
  switching = true;
  grid.classList.add("switching");
  await sleep(150);
  try {
    const r = await window.cppp.applyTheme(type === "none" ? { type: "none" } : { type, id: id as string });
    if (r.ok) {
      await refreshThemes();
      log("已应用主题：" + name);
    } else {
      log("应用失败：" + r.error);
    }
  } finally {
    switching = false;
    grid.classList.remove("switching");
  }
}

async function refreshThemes(): Promise<void> {
  const t = await window.cppp.themes();
  const sel = t.selection;
  const isActive = (type: string, id: string | null): boolean => {
    if (!sel) return type === "none";
    if (sel.type !== type) return false;
    return id == null || sel.id === id;
  };

  const desired: Array<{ type: "none" | "preset" | "custom"; id: string | null; name: string }> = [
    { type: "none", id: null, name: "默认（无主题）" },
    ...t.presets.map((p) => ({ type: "preset" as const, id: p.id, name: p.name })),
    ...t.custom.map((c) => ({ type: "custom" as const, id: c.id, name: c.name })),
  ];

  // 1) 移除已不存在的卡片（释放 art 引用 + 停止观察）
  const desiredKeys = new Set(desired.map((d) => cardKey(d.type, d.id)));
  for (const [key, card] of cards) {
    if (desiredKeys.has(key)) continue;
    releaseCardArt(card);
    observer.unobserve(card.el);
    card.el.remove();
    cards.delete(key);
  }

  // 2) 新建缺失卡片，其余复用（只更新激活态，不重建 DOM——4.6）
  for (const d of desired) {
    const key = cardKey(d.type, d.id);
    let card = cards.get(key);
    if (!card) {
      card = createCard(d.type, d.id, d.name);
      cards.set(key, card);
      grid.append(card.el);
      observer.observe(card.el);
    } else if (card.name !== d.name) {
      card.name = d.name;
      card.el.title = d.name;
      const nameEl = card.el.querySelector(".name");
      if (nameEl) nameEl.textContent = d.name;
    }
    setActive(card, isActive(d.type, d.id));
  }

  // 3) 空状态（3.5）
  const emptyState = $("emptyState");
  const hasAny = t.presets.length + t.custom.length > 0;
  emptyState.style.display = hasAny ? "none" : "flex";

  checkArtMemory();
}

// --- 拖拽上传 + 预览（3.3） ---
let pendingDataUrl: string | null = null;

function openFilePicker(): void {
  $<HTMLInputElement>("fileInput").click();
}

function handleFile(file: File | undefined | null): void {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    log("不支持的文件类型：" + (file.type || file.name) + "（仅支持 PNG/JPEG/WebP/GIF）");
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    log("图片过大（上限 6MB），请压缩后重试");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingDataUrl = String(reader.result ?? "");
    $<HTMLImageElement>("previewImg").src = pendingDataUrl;
    $<HTMLInputElement>("themeName").value = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
    $("modal").hidden = false;
  };
  reader.onerror = () => log("读取图片失败");
  reader.readAsDataURL(file);
}

async function confirmCreateTheme(): Promise<void> {
  if (!pendingDataUrl) return;
  const name = $<HTMLInputElement>("themeName").value.trim();
  const r = await window.cppp.createTheme({ name, dataUrl: pendingDataUrl });
  if (r.ok) {
    $("modal").hidden = true;
    pendingDataUrl = null;
    await refreshThemes();
    log("已创建主题：" + (r.name ?? name));
  } else {
    $("modalError").textContent = r.error ?? "创建失败";
  }
}

// --- 初始化 ---
async function refresh(): Promise<void> {
  const s = await window.cppp.status();
  $("ver").textContent = "v" + (s.version ?? "—");
  const ok = s.installed;
  $("inst").textContent = ok ? "已安装" : "未安装";
  const badge = $("badge");
  badge.className = "badge " + (ok ? "ok" : "warn");
  badge.textContent = ok ? "已就绪" : "未安装";
  $("apps").textContent = s.apps.map((a) => a.replace("/Applications/", "").replace(".app", "")).join("、") || "未找到";
  $("appRoot").textContent = s.appRoot ?? "—";
  $("installBtn").textContent = ok ? "重新安装" : "安装";
  $("repairBtn").disabled = !ok;
  $("uninstallBtn").disabled = !ok;
  await refreshThemes();
}

function bindEvents(): void {
  $("openBtn").onclick = async () => {
    const r = await window.cppp.openApp();
    if (!r.ok) log(r.error);
  };

  async function runCli(cmd: "install" | "repair" | "uninstall", label: string): Promise<void> {
    logBox.style.display = "block";
    logBox.textContent = "";
    log("=== " + label + " ===");
    setBusy(true);
    window.cppp.onCliLog((line) => log(line));
    const r = await window.cppp.runCli(cmd);
    log("=== 退出码 " + r.code + " ===");
    setBusy(false);
    await refresh();
  }

  $("installBtn").onclick = () => runCli("install", "安装补丁");
  $("repairBtn").onclick = () => runCli("repair", "修复");
  $("uninstallBtn").onclick = () => {
    if (confirm("确认卸载 ChatGPT++ 补丁？")) runCli("uninstall", "卸载");
  };

  // 拖拽上传
  const dropZone = $("dropZone");
  const fileInput = $<HTMLInputElement>("fileInput");
  dropZone.onclick = openFilePicker;
  fileInput.onchange = () => {
    handleFile(fileInput.files?.[0]);
    fileInput.value = "";
  };
  for (const ev of ["dragenter", "dragover"]) {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  }
  for (const ev of ["dragleave", "drop"]) {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  }
  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    handleFile(dt?.files?.[0]);
  });

  // 预览模态框
  $("modalCancel").onclick = () => {
    $("modal").hidden = true;
    pendingDataUrl = null;
  };
  $("modalConfirm").onclick = () => confirmCreateTheme();
  $("modal").addEventListener("click", (e) => {
    if (e.target === $("modal")) {
      $("modal").hidden = true;
      pendingDataUrl = null;
    }
  });
  $<HTMLInputElement>("themeName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmCreateTheme();
  });
}

bindEvents();
refresh();
