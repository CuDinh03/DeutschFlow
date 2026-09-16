// In-memory MMKV stand-in for jest (the real module is a native TurboModule). Covers the tiny
// string get/set/delete surface the app uses. Each `new MMKV({ id })` gets its own map.
export class MMKV {
  private store = new Map<string, string>()

  getString(key: string): string | undefined {
    return this.store.get(key)
  }

  set(key: string, value: string): void {
    this.store.set(key, value)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clearAll(): void {
    this.store.clear()
  }

  /** Mã hoá không có ý nghĩa trong bộ nhớ — stub giữ nguyên dữ liệu để store dùng được. */
  recrypt(_key: string | undefined): void {}
}
