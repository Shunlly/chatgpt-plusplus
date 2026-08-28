/**
 * 强退 ChatGPT++ 后 crashpad / 修饰键监听 / 视觉 MCP 会残留。
 * crashpad 自己会挂到 pid 1，不能靠 ppid 判断；比当前主进程更早启动的才杀。
 */

export interface ProcRow {
  pid: number;
  ppid: number;
  command: string;
  startMs?: number;
}

const MAX_KILL = 80;
const CRASHPAD_GRACE_MS = 5000;

export function isHelperCommand(command: string): boolean {
  const c = command.toLowerCase();
  if (c.includes("browser_crashpad_handler") || c.includes("crashpad_handler.exe")) {
    return c.includes("chatgpt++") || c.includes("chatgptplusplus");
  }
  if (c.includes("bare-modifier-monitor")) return c.includes("chatgpt++");
  if (c.includes("vision-toolkit") && c.includes("mcp-server")) return true;
  if (c.includes("cua_node") && c.includes("node_repl") && c.includes("chatgpt++")) return true;
  return false;
}

export function isCrashpadCommand(command: string): boolean {
  const c = command.toLowerCase();
  return c.includes("browser_crashpad_handler") || c.includes("crashpad_handler.exe");
}

export function isLiveMainCommand(command: string): boolean {
  const c = command.toLowerCase();
  if (c.includes("crashpad") || c.includes("bare-modifier-monitor")) return false;
  if (c.includes("codex (renderer)") || c.includes("codex (service)")) return false;
  if (c.includes("chatgpt++.app/contents/macos/chatgpt")) return true;
  if (/(^|[\\/])chatgpt\+\+\.exe(\s|$)/i.test(command)) return true;
  return false;
}

export function parseProcessTable(output: string): ProcRow[] {
  const rows: ProcRow[] = [];
  for (const line of output.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    rows.push({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3] });
  }
  return rows;
}

export function parsePsLstart(output: string): ProcRow[] {
  const rows: ProcRow[] = [];
  for (const line of output.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/.exec(line);
    if (!m) continue;
    const startMs = Date.parse(m[3].trim());
    rows.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      command: m[4],
      startMs: Number.isFinite(startMs) ? startMs : undefined,
    });
  }
  return rows;
}

export function pidsToKill(rows: ProcRow[], selfPid: number): number[] {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const liveMains = new Set<number>([selfPid]);
  let mainStart = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (!isLiveMainCommand(r.command)) continue;
    liveMains.add(r.pid);
    if (r.startMs != null) mainStart = Math.min(mainStart, r.startMs);
  }
  const selfRow = byPid.get(selfPid);
  if (selfRow?.startMs != null) mainStart = Math.min(mainStart, selfRow.startMs);

  const belongsToLiveMain = (pid: number): boolean => {
    const seen = new Set<number>();
    let cur = pid;
    while (cur && !seen.has(cur)) {
      if (liveMains.has(cur)) return true;
      seen.add(cur);
      const row = byPid.get(cur);
      if (!row || row.ppid <= 1) return false;
      cur = row.ppid;
    }
    return false;
  };

  const out: number[] = [];
  for (const r of rows) {
    if (r.pid === selfPid) continue;
    if (!isHelperCommand(r.command)) continue;
    if (isCrashpadCommand(r.command) && r.ppid <= 1) {
      if (r.startMs == null || !Number.isFinite(mainStart)) continue;
      if (r.startMs + CRASHPAD_GRACE_MS >= mainStart) continue;
    } else if (belongsToLiveMain(r.pid)) {
      continue;
    }
    out.push(r.pid);
    if (out.length >= MAX_KILL) break;
  }
  return out;
}

export function sweepOrphanHelpers(opts: {
  selfPid: number;
  rows: ProcRow[];
  kill: (pid: number) => void;
}): number[] {
  const killed: number[] = [];
  for (const pid of pidsToKill(opts.rows, opts.selfPid)) {
    try {
      opts.kill(pid);
      killed.push(pid);
    } catch {}
  }
  return killed;
}
