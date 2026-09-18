// Deterministic `expo-crypto` stub for ts-jest — the real module is native.
// Only `getRandomBytes` is used (lib/secureMmkv.ts, device encryption key).
let counter = 0

export function getRandomBytes(byteCount: number): Uint8Array {
  const out = new Uint8Array(byteCount)
  for (let i = 0; i < byteCount; i++) out[i] = (counter * 31 + i * 7 + 1) % 256
  counter++
  return out
}

export function __resetCryptoMock(): void {
  counter = 0
}
