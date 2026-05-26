import { describe, it, expect } from "vitest";
import { getErrorSnippet, ALL_ERROR_CODES } from "@/lib/errors/errorTaxonomy";

describe("getErrorSnippet", () => {
  it("returns Vietnamese snippet for vi locale", () => {
    const s = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "vi");
    expect(s.title).toBeTruthy();
    expect(s.rule).toBeTruthy();
    // Vietnamese content should not be identical to English
    const en = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "en");
    expect(s.title).not.toBe(en.title);
  });

  it("returns English snippet for en locale", () => {
    const s = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "en");
    expect(s.title).toContain("V2");
    expect(s.rule).toContain("second position");
  });

  it("returns English snippet for de locale (MVP fallback)", () => {
    const en = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "en");
    const de = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "de");
    expect(de).toEqual(en);
  });

  it("returns code as title for unknown error code", () => {
    const s = getErrorSnippet("COMPLETELY.UNKNOWN", "en");
    expect(s.title).toBe("COMPLETELY.UNKNOWN");
    expect(s.rule).toBe("");
  });

  it("returns code as title for empty string code", () => {
    const s = getErrorSnippet("", "vi");
    expect(s.title).toBe("");
  });

  it("handles CASE.PREP_DAT_MIT in Vietnamese", () => {
    const s = getErrorSnippet("CASE.PREP_DAT_MIT", "vi");
    expect(s.title).toContain("mit");
    expect(s.rule).toContain("Dativ");
  });

  it("ALL_ERROR_CODES is non-empty and contains expected codes", () => {
    expect(ALL_ERROR_CODES.length).toBeGreaterThan(0);
    expect(ALL_ERROR_CODES).toContain("WORD_ORDER.V2_MAIN_CLAUSE");
    expect(ALL_ERROR_CODES).toContain("VERB.SEIN_HABEN_PRESENT");
  });

  it("every code in ALL_ERROR_CODES returns a non-empty title for en locale", () => {
    for (const code of ALL_ERROR_CODES) {
      const s = getErrorSnippet(code, "en");
      expect(s.title.length, `Empty title for ${code}`).toBeGreaterThan(0);
    }
  });
});
