/**
 * Vocab practice scoring utilities.
 * Extracted from vocab-practice page for testability.
 */

const GERMAN_ARTICLES = ["der", "die", "das", "ein", "eine", "einen", "dem", "des", "den"];

/**
 * Normalize a German word for comparison:
 * - Lowercase
 * - Remove leading articles
 * - Remove non-letter characters (except umlauts)
 * - Collapse whitespace
 */
export function normalizeGerman(text: string): string {
  if (!text) return "";
  let s = text.toLowerCase().trim();
  // Remove leading article
  for (const art of GERMAN_ARTICLES) {
    if (s.startsWith(art + " ")) {
      s = s.slice(art.length + 1).trim();
      break;
    }
  }
  // Remove punctuation, keep umlauts and letters
  s = s.replace(/[^a-zäöüß\s]/g, "").replace(/\s{2,}/g, " ").trim();
  return s;
}

/**
 * Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Fuzzy threshold based on word length:
 * - Short words (≤4): exact match only
 * - Medium (5-7): 1 typo allowed
 * - Long (≥8): 2 typos allowed
 */
export function levenshteinThreshold(wordLength: number): number {
  if (wordLength <= 4) return 0;
  if (wordLength <= 7) return 1;
  return 2;
}

/**
 * Returns true if transcript matches target (after normalization + fuzzy).
 */
export function isAccepted(transcript: string, target: string): boolean {
  const norm = normalizeGerman(transcript);
  const tgt = normalizeGerman(target);
  if (!norm || !tgt) return false;
  const dist = levenshtein(norm, tgt);
  return dist <= levenshteinThreshold(tgt.length);
}
