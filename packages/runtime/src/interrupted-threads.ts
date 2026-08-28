/**
 * 关掉 ChatGPT++ 时仍在跑的会话：进程活着时记下 running，下次启动升成 interrupted。
 * 纯函数，preload / 主进程都能用（不要引 node:fs，沙箱 preload 打不了）。
 */

export interface ThreadRef {
  id: string;
  title: string;
  path: string;
  at: number;
}

export interface InterruptedState {
  running: ThreadRef[];
  interrupted: ThreadRef[];
}

export const MAX_INTERRUPTED = 8;

const THREAD_PATH = /^\/(local|remote)\/[A-Za-z0-9._:-]+$/;

export function emptyState(): InterruptedState {
  return { running: [], interrupted: [] };
}

export function normalizeThread(item: unknown, now: number): ThreadRef | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  const path = typeof rec.path === "string" ? rec.path.trim() : "";
  if (!THREAD_PATH.test(path)) return null;
  const id = path.slice(path.lastIndexOf("/") + 1);
  if (!id) return null;
  const title = typeof rec.title === "string" ? rec.title.trim().slice(0, 80) : "";
  return { id, title, path, at: now };
}

/** 不是托盘消息返回 null，别把无关 IPC 当成 running=[]。 */
export function parseTrayRunning(message: unknown, now = Date.now()): ThreadRef[] | null {
  if (!message || typeof message !== "object") return null;
  const rec = message as Record<string, unknown>;
  if (rec.type !== "tray-menu-threads-changed") return null;
  const tray = rec.trayMenuThreads;
  if (!tray || typeof tray !== "object") return [];
  const running = (tray as { runningThreads?: unknown }).runningThreads;
  if (!Array.isArray(running)) return [];
  const out: ThreadRef[] = [];
  const seen = new Set<string>();
  for (const item of running) {
    const thread = normalizeThread(item, now);
    if (!thread || seen.has(thread.id)) continue;
    seen.add(thread.id);
    out.push(thread);
  }
  return out;
}

/** 宠物窗也会发空 running，不能覆盖主窗刚记下的心跳。 */
export function shouldApplyRunning(running: ThreadRef[], fromCompact: boolean): boolean {
  return !fromCompact || running.length > 0;
}

export function applyRunning(state: InterruptedState, running: ThreadRef[]): InterruptedState {
  const live = new Set(running.map((t) => t.id));
  return {
    running,
    interrupted: cap(state.interrupted.filter((t) => !live.has(t.id))),
  };
}

export function promoteCrashed(state: InterruptedState, now: number): InterruptedState {
  if (state.running.length === 0) return { running: [], interrupted: cap(state.interrupted) };
  const map = new Map(state.interrupted.map((t) => [t.id, t]));
  for (const t of state.running) map.set(t.id, { ...t, at: t.at || now });
  return { running: [], interrupted: cap([...map.values()]) };
}

export function dismissThread(state: InterruptedState, id: string): InterruptedState {
  if (!id) return state;
  return {
    running: state.running.filter((t) => t.id !== id),
    interrupted: state.interrupted.filter((t) => t.id !== id),
  };
}

export function parseState(raw: unknown): InterruptedState {
  if (!raw || typeof raw !== "object") return emptyState();
  const rec = raw as Record<string, unknown>;
  return {
    running: parseList(rec.running),
    interrupted: cap(parseList(rec.interrupted)),
  };
}

function parseList(value: unknown): ThreadRef[] {
  if (!Array.isArray(value)) return [];
  const out: ThreadRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const at = item && typeof item === "object" && typeof (item as { at?: unknown }).at === "number"
      ? (item as { at: number }).at
      : 0;
    const thread = normalizeThread(item, at);
    if (!thread || seen.has(thread.id)) continue;
    seen.add(thread.id);
    out.push(thread);
  }
  return out;
}

function cap(list: ThreadRef[]): ThreadRef[] {
  return [...list].sort((a, b) => b.at - a.at).slice(0, MAX_INTERRUPTED);
}
