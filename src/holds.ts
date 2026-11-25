export interface Hold { userId: string; expiresAt: number }
export interface HoldCache { get(id: string): Hold | undefined; set(id: string, value: Hold): void; delete(id: string): void; entries(): IterableIterator<[string, Hold]> }
class MemoryHoldCache implements HoldCache {
  private holds = new Map<string, Hold>();
  get(id: string) { return this.holds.get(id) }
  set(id: string, value: Hold) { this.holds.set(id, value) }
  delete(id: string) { this.holds.delete(id) }
  entries() { return this.holds.entries() }
}
export const holds: HoldCache = new MemoryHoldCache();
