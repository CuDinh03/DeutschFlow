import { describe, it, expect } from "vitest";
import { getDrillRule, DRILL_RULES } from "@/lib/errors/drillRules";

describe("getDrillRule", () => {
  it("returns null for unknown code", () => {
    expect(getDrillRule("UNKNOWN.CODE")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getDrillRule("")).toBeNull();
  });

  it("returns the correct rule for WORD_ORDER.V2_MAIN_CLAUSE", () => {
    const rule = getDrillRule("WORD_ORDER.V2_MAIN_CLAUSE");
    expect(rule).not.toBeNull();
    expect(rule!.rewriteTarget_de).toContain("Heute");
    expect(rule!.scoring.anchors_required).toContain("heute");
    expect(rule!.scoring.order_constraints).toHaveLength(2);
    expect(rule!.scoring.levenshtein_max_ratio).toBe(0.3);
  });

  it("returns the correct rule for WORD_ORDER.NICHT_POSITION", () => {
    const rule = getDrillRule("WORD_ORDER.NICHT_POSITION");
    expect(rule).not.toBeNull();
    expect(rule!.scoring.anchors_required).toContain("nicht");
    expect(rule!.scoring.order_constraints![0]).toMatchObject({
      before: "verstehe",
      after: "nicht",
    });
  });

  it("returns rule without order_constraints for CASE.PREP_DAT_MIT", () => {
    const rule = getDrillRule("CASE.PREP_DAT_MIT");
    expect(rule).not.toBeNull();
    expect(rule!.scoring.anchors_required).toContain("mit");
    expect(rule!.scoring.order_constraints).toBeUndefined();
  });

  it("ARTICLE.GENDER_WRONG_DER_DIE_DAS has article in anchors_required", () => {
    const rule = getDrillRule("ARTICLE.GENDER_WRONG_DER_DIE_DAS");
    expect(rule).not.toBeNull();
    expect(rule!.scoring.anchors_required).toContain("der");
    expect(rule!.scoring.anchors_required).toContain("tisch");
  });

  it("all defined rules have a non-empty rewriteTarget_de", () => {
    for (const [code, rule] of Object.entries(DRILL_RULES)) {
      expect(rule!.rewriteTarget_de.length, `Rule ${code} missing target`).toBeGreaterThan(0);
    }
  });

  it("all defined rules have anchors_required with at least one entry", () => {
    for (const [code, rule] of Object.entries(DRILL_RULES)) {
      expect(
        rule!.scoring.anchors_required?.length,
        `Rule ${code} missing anchors_required`
      ).toBeGreaterThan(0);
    }
  });
});
