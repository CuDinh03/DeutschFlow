import { describe, it, expect } from "vitest";
import { normalizeGerman, levenshtein, levenshteinThreshold, isAccepted } from "@/lib/vocabScoring";

describe("normalizeGerman", () => {
  it("lowercases and strips leading articles", () => {
    expect(normalizeGerman("Der Tisch")).toBe("tisch");
    expect(normalizeGerman("die Katze")).toBe("katze");
    expect(normalizeGerman("Das Haus")).toBe("haus");
    expect(normalizeGerman("ein Buch")).toBe("buch");
  });

  it("preserves German umlauts", () => {
    expect(normalizeGerman("Öl")).toBe("öl");
    expect(normalizeGerman("Straße")).toBe("straße");
    expect(normalizeGerman("Übung")).toBe("übung");
  });

  it("removes punctuation", () => {
    expect(normalizeGerman("gehen!")).toBe("gehen");
    expect(normalizeGerman("(ankommen)")).toBe("ankommen");
  });

  it("handles empty / whitespace", () => {
    expect(normalizeGerman("")).toBe("");
    expect(normalizeGerman("   ")).toBe("");
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("haus", "haus")).toBe(0);
  });

  it("counts single insertion", () => {
    expect(levenshtein("haus", "hauss")).toBe(1);
  });

  it("counts single deletion", () => {
    expect(levenshtein("haus", "hau")).toBe(1);
  });

  it("counts single substitution", () => {
    expect(levenshtein("haus", "maus")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("levenshteinThreshold", () => {
  it("requires exact match for short words (≤4)", () => {
    expect(levenshteinThreshold(3)).toBe(0);
    expect(levenshteinThreshold(4)).toBe(0);
  });

  it("allows 1 typo for medium words (5-7)", () => {
    expect(levenshteinThreshold(5)).toBe(1);
    expect(levenshteinThreshold(7)).toBe(1);
  });

  it("allows 2 typos for long words (≥8)", () => {
    expect(levenshteinThreshold(8)).toBe(2);
    expect(levenshteinThreshold(15)).toBe(2);
  });
});

describe("isAccepted", () => {
  it("accepts exact match", () => {
    expect(isAccepted("Tisch", "Tisch")).toBe(true);
    expect(isAccepted("der Tisch", "Tisch")).toBe(true);
  });

  it("accepts with one typo in long word", () => {
    expect(isAccepted("Fenster", "Fenster")).toBe(true);   // exact
    expect(isAccepted("Fensted", "Fenster")).toBe(true);   // 1 typo in 7-char word
  });

  it("rejects wrong short word", () => {
    expect(isAccepted("Maus", "Haus")).toBe(false); // 4-char → 0 tolerance
  });

  it("handles empty transcript", () => {
    expect(isAccepted("", "Tisch")).toBe(false);
  });

  it("is case-insensitive via normalization", () => {
    expect(isAccepted("TISCH", "tisch")).toBe(true);
  });
});
