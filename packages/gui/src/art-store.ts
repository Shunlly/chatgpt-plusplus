/**
 * Dream Skin 预览图 Blob URL 管理（渲染进程）。
 *
 * 目标（优化方案 4.3 / 4.4）：
 *  1. 同一张主题图只创建一次 Blob URL，多张卡片/多次进入视口复用同一 URL；
 *  2. 引用计数归零不立即释放，而是进入 LRU 缓存供快速复用；
 *  3. 总字节数超上限时按 LRU 淘汰并 revoke，防止长期使用累积内存泄漏；
 *  4. 页面重建（beforeunload / 全量刷新）时一次性释放全部 URL。
 *
 * 纯逻辑模块，不依赖 DOM，便于单元测试（dream-skin-memory.test.ts）。
 */

export interface ArtStoreEntry {
  /** 复用的 Blob URL（background-image 使用）。 */
  blobUrl: string;
  /** 原始 data URL（同一 dataUrl 去重键）。 */
  dataUrl: string;
  /** 当前持有引用数（视口内卡片数）。 */
  refs: number;
  /** 最后使用时间戳（LRU 淘汰依据）。 */
  lastUsed: number;
  /** 估算内存占用（data URL base64 字符数）。 */
  sizeBytes: number;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("invalid data URL");
  const meta = dataUrl.slice(5, comma); // 去掉 "data:"
  const mime = meta.split(";")[0] || "image/png";
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function estimateBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // base64 → 原始字节 ≈ 字符数 * 3/4
  return Math.ceil((b64.length * 3) / 4);
}

export interface ArtStoreOptions {
  /** 缓存总字节上限，超出后按 LRU 淘汰（默认 200MB）。 */
  maxBytes?: number;
  /** 便于测试注入的 URL 工厂；默认使用全局 URL。 */
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  now?: () => number;
}

export class ArtStore {
  private entries = new Map<string, ArtStoreEntry>();
  private totalBytes = 0;
  private readonly maxBytes: number;
  private readonly createObjectURL: (blob: Blob) => string;
  private readonly revokeObjectURL: (url: string) => void;
  private readonly now: () => number;
  /** 内存检查阈值（4.4 防护）：缓存占用超限时告警并触发强制清理。 */
  readonly warnBytes: number;

  constructor(options: ArtStoreOptions = {}) {
    this.maxBytes = options.maxBytes ?? 200 * 1024 * 1024;
    this.warnBytes = Math.floor(this.maxBytes * 0.8);
    this.createObjectURL = options.createObjectURL ?? ((blob) => URL.createObjectURL(blob));
    this.revokeObjectURL = options.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
    this.now = options.now ?? (() => Date.now());
  }

  /** 当前缓存占用（字节）。 */
  get totalBytesUsed(): number {
    return this.totalBytes;
  }

  /** 当前缓存条目数。 */
  get entryCount(): number {
    return this.entries.size;
  }

  /**
   * 获取主题图的 Blob URL。同一 dataUrl 复用同一条目并 +1 引用；
   * 新条目创建 Blob URL 后立即做容量淘汰。
   */
  acquire(dataUrl: string): string {
    if (!dataUrl) throw new Error("empty data url");
    const existing = this.entries.get(dataUrl);
    if (existing) {
      existing.refs += 1;
      existing.lastUsed = this.now();
      return existing.blobUrl;
    }
    const blob = dataUrlToBlob(dataUrl);
    const blobUrl = this.createObjectURL(blob);
    this.entries.set(dataUrl, {
      blobUrl,
      dataUrl,
      refs: 1,
      lastUsed: this.now(),
      sizeBytes: estimateBytes(dataUrl),
    });
    this.totalBytes += estimateBytes(dataUrl);
    this.evictIfNeeded();
    return blobUrl;
  }

  /** 释放一个引用。归零后条目保留在缓存中（可复用），仅在被淘汰时 revoke。 */
  release(dataUrl: string): void {
    const entry = this.entries.get(dataUrl);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsed = this.now();
  }

  /** 淘汰超限部分：优先踢出无引用且最久未用的条目，并 revoke 其 Blob URL。 */
  evictIfNeeded(): void {
    let guard = this.entries.size + 1;
    while (this.totalBytes > this.maxBytes && this.entries.size > 1 && guard-- > 0) {
      let lru: { key: string; entry: ArtStoreEntry } | null = null;
      for (const [key, entry] of this.entries) {
        if (entry.refs > 0) continue;
        if (!lru || entry.lastUsed < lru.entry.lastUsed) lru = { key, entry };
      }
      if (!lru) break; // 全部被引用：无法安全淘汰，交给调用方
      this.entries.delete(lru.key);
      this.totalBytes -= lru.entry.sizeBytes;
      this.revokeObjectURL(lru.entry.blobUrl);
    }
  }

  /** 强制清空缓存（页面重建/退出前调用），revoke 全部 Blob URL。 */
  dispose(): void {
    for (const entry of this.entries.values()) {
      this.revokeObjectURL(entry.blobUrl);
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  /** 是否超限（供内存防护告警使用）。 */
  get isOverWarnThreshold(): boolean {
    return this.totalBytes > this.warnBytes;
  }
}
