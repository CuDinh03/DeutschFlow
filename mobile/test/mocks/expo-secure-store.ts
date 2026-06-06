// Minimal `expo-secure-store` stub for ts-jest. lib/auth.ts reads/writes
// auth tokens through this native module; node-env unit tests stub it out.
export async function getItemAsync(_key: string): Promise<string | null> {
  return null
}
export async function setItemAsync(_key: string, _value: string): Promise<void> {}
export async function deleteItemAsync(_key: string): Promise<void> {}
