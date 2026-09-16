// Minimal `expo-secure-store` stub for ts-jest. lib/auth.ts reads/writes
// auth tokens through this native module; node-env unit tests stub it out.
//
// The async surface stays stateless (always empty) — existing suites rely on that.
// The SYNC surface (`getItem`/`setItem`, used by lib/secureMmkv.ts because MMKV must be
// constructed before any await) is backed by an in-memory map so key generation can be
// asserted. `__resetSecureStoreMock()` clears it between tests.
const syncStore = new Map<string, string>()

export async function getItemAsync(_key: string): Promise<string | null> {
  return null
}
export async function setItemAsync(_key: string, _value: string): Promise<void> {}
export async function deleteItemAsync(_key: string): Promise<void> {}

export function getItem(key: string): string | null {
  return syncStore.get(key) ?? null
}
export function setItem(key: string, value: string): void {
  syncStore.set(key, value)
}

export function __resetSecureStoreMock(): void {
  syncStore.clear()
}
