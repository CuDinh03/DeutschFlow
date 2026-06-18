// ============================================================================
// hash.ts — deterministic, dependency-free string hash for the learning tree.
//
// FNV-1a (32-bit) + xmur3 finalizer, all ops forced to uint32 via Math.imul /
// `>>> 0` so the result is IDENTICAL across V8 / JSC / Hermes / SpiderMonkey.
// This is what makes "cùng chủ đề ⇒ cùng hướng" hold on every platform.
//
// FROZEN CONSTANTS — changing any of these is a breaking layout-version bump:
//   FNV offset basis  0x811c9dc5
//   FNV prime         0x01000193
//   xmur3 mixers      0x7feb352d, 0x846ca68b
// ============================================================================

const U32 = 4294967296; // 2^32

/** Pure uint32 hash of a string. Deterministic across JS engines. */
export function hash32(str: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // xmur3 finalizer — improves avalanche so similar topicIds diverge.
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash mapped to the half-open unit interval [0, 1). */
export function hashUnit(str: string): number {
  return hash32(str) / U32;
}
