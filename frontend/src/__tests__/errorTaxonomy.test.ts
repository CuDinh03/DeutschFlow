import { describe, it, expect } from "vitest";
import {
  ALL_ERROR_CODES,
  categoryLabel,
  genericErrorTitle,
  getErrorSnippet,
  labelForCode,
} from "@/lib/errors/errorTaxonomy";

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
    expect(s.title.toLowerCase()).toContain("verb");
    expect(s.rule).toContain("second position");
  });

  it("returns a German snippet for de locale", () => {
    const en = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "en");
    const de = getErrorSnippet("WORD_ORDER.V2_MAIN_CLAUSE", "de");
    expect(de.title).toBeTruthy();
    expect(de.rule).toBeTruthy();
    // German is now translated — must differ from the English fallback
    expect(de.title).not.toBe(en.title);
    expect(de.rule).toContain("zweiter Stelle");
  });

  it("every code in ALL_ERROR_CODES returns a non-empty German title", () => {
    for (const code of ALL_ERROR_CODES) {
      const s = getErrorSnippet(code, "de");
      expect(s.title.length, `Empty de title for ${code}`).toBeGreaterThan(0);
      expect(s.title, `de title leaks raw code for ${code}`).not.toBe(code);
    }
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

// Owner 11/09: học viên không được thấy mã máy ("WORD_ORDER.V2_MAIN_CLAUSE") ở bất kỳ màn nào —
// chỉ tên lỗi đọc được. Mọi nhánh của getErrorSnippet phải trả nhãn người, kể cả khi mã lạ.
describe("không lộ mã máy ra giao diện", () => {
  it("mã ngoài taxonomy rơi về nhãn chung, không phải mã thô", () => {
    for (const locale of ["vi", "en", "de"]) {
      const s = getErrorSnippet("COMPLETELY.UNKNOWN", locale);
      expect(s.title).toBe(genericErrorTitle(locale));
      expect(s.title).not.toContain("COMPLETELY");
      expect(s.title).not.toContain("_");
      expect(s.rule).toBe("");
    }
  });

  it("mã rỗng cũng ra nhãn chung", () => {
    expect(getErrorSnippet("", "vi").title).toBe(genericErrorTitle("vi"));
  });

  it("không nhãn nào chứa dấu hiệu mã máy (DẤU_GẠCH_DƯỚI hoặc CHẤM)", () => {
    for (const code of ALL_ERROR_CODES) {
      for (const locale of ["vi", "en", "de"]) {
        const { title } = getErrorSnippet(code, locale);
        expect(title, `${code}/${locale} lộ mã máy`).not.toMatch(/[A-Z]{2,}_[A-Z]/);
        expect(title, `${code}/${locale} lộ mã máy`).not.toBe(code);
      }
    }
  });

  it("labelForCode vẫn trả null cho mã lạ để caller tự chọn nhãn riêng", () => {
    expect(labelForCode("COMPLETELY.UNKNOWN", "vi")).toBeNull();
    expect(labelForCode(null, "vi")).toBeNull();
    expect(labelForCode("VERB.CONJ_PERSON_ENDING", "vi")).toBe(
      getErrorSnippet("VERB.CONJ_PERSON_ENDING", "vi").title,
    );
  });
});

describe("categoryLabel", () => {
  it("dịch nhóm lỗi theo ngôn ngữ đang xem", () => {
    expect(categoryLabel("WORD_ORDER.V2_MAIN_CLAUSE", "vi")).toBe("Trật tự từ");
    expect(categoryLabel("WORD_ORDER.V2_MAIN_CLAUSE", "en")).toBe("Word order");
    expect(categoryLabel("WORD_ORDER.V2_MAIN_CLAUSE", "de")).toBe("Wortstellung");
  });

  it("mọi mã trong taxonomy đều có nhãn nhóm", () => {
    for (const code of ALL_ERROR_CODES) {
      expect(categoryLabel(code, "vi"), `thiếu nhóm cho ${code}`).toBeTruthy();
    }
  });

  it("nhóm lạ trả null để caller dùng nhãn Khác", () => {
    expect(categoryLabel("NEUGRUPPE.SOMETHING", "vi")).toBeNull();
    expect(categoryLabel(undefined, "vi")).toBeNull();
  });
});
