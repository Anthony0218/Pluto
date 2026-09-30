// Small sliding-window limiter (per key, e.g. client address). Lightweight spam protection only.
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  // Plain fields, not parameter properties: Node's type stripping runs this file directly.
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  // Records an attempt; false when the key is over its limit (the attempt is not recorded then).
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
  prune(now = Date.now()) {
    for (const [key, times] of this.hits)
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
  }
}
