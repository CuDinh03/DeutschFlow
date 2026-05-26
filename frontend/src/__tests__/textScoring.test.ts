import { describe, it, expect } from "vitest";
import {
  normalizeWord,
  normalizeSentence,
  levenshtein,
  isAcceptedHeardForWord,
  checkAnchors,
  checkOrder,
  scoreAttempt,
} from "@/lib/scoring/textScoring";

// ─── normalizeWord ────────────────────────────────────────────────────────────
describe("normalizeWord", () => {
  it("lowercases", () => {
    expect(normalizeWord("Tisch")).toBe("tisch");
  });

  it("strips leading articles (der/die/das/ein/eine)", () => {
    expect(normalizeWord("der Tisch")).toBe("tisch");
    expect(normalizeWord("die Katze")).toBe("katze");
    expect(normalizeWord("das Haus")).toBe("haus");
    expect(normalizeWord("ein Buch")).toBe("buch");
    expect(normalizeWord("eine Frau")).toBe("frau");
  });

  it("strips accusative/dative articles", () => {
    expect(normalizeWord("einen Mann")).toBe("mann");
    expect(normalizeWord("einem Kind")).toBe("kind");
    expect(normalizeWord("einer Frau")).toBe("frau");
    expect(normalizeWord("eines Mannes")).toBe("mannes");
  });

  it("keeps German umlauts", () => {
    expect(normalizeWord("Öl")).toBe("öl");
    expect(normalizeWord("Straße")).toBe("straße");
    expect(normalizeWord("Übung")).toBe("übung");
  });

  it("removes punctuation", () => {
    expect(normalizeWord("gehen!")).toBe("gehen");
    expect(normalizeWord("(ankommen)")).toBe("ankommen");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeWord("  tisch  ")).toBe("tisch");
  });

  it("handles empty string", () => {
    expect(normalizeWord("")).toBe("");
  });
});

// ─── normalizeSentence ───────────────────────────────────────────────────────
describe("normalizeSentence", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeSentence("Ich gehe nach Hause!")).toBe("ich gehe nach hause");
  });

  it("keeps digits", () => {
    expect(normalizeSentence("Ich bin 25 Jahre alt.")).toBe("ich bin 25 jahre alt");
  });

  it("keeps umlauts", () => {
    expect(normalizeSentence("Schöne Grüße")).toBe("schöne grüße");
  });

  it("collapses whitespace", () => {
    expect(normalizeSentence("  Ich  gehe  ")).toBe("ich gehe");
  });

  it("handles empty string", () => {
    expect(normalizeSentence("")).toBe("");
  });
});

// ─── levenshtein ─────────────────────────────────────────────────────────────
describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("haus", "haus")).toBe(0);
  });

  it("counts insertions", () => {
    expect(levenshtein("haus", "hauss")).toBe(1);
  });

  it("counts deletions", () => {
    expect(levenshtein("haus", "hau")).toBe(1);
  });

  it("counts substitutions", () => {
    expect(levenshtein("haus", "maus")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });

  it("handles multi-char difference", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

// ─── isAcceptedHeardForWord ───────────────────────────────────────────────────
describe("isAcceptedHeardForWord", () => {
  it("accepts exact match", () => {
    expect(isAcceptedHeardForWord("Tisch", "Tisch")).toBe(true);
  });

  it("accepts with article in heard", () => {
    expect(isAcceptedHeardForWord("der Tisch", "Tisch")).toBe(true);
  });

  it("accepts 1 typo in word longer than 5 chars", () => {
    expect(isAcceptedHeardForWord("Fenstre", "Fenster")).toBe(true); // swap
  });

  it("rejects 2 typos in short word (≤5)", () => {
    expect(isAcceptedHeardForWord("Tabl", "Tisch")).toBe(false);
  });

  it("accepts 2 typos in long word (>5 chars)", () => {
    expect(isAcceptedHeardForWord("Schreibtich", "Schreibtisch")).toBe(true); // 1 missing char
  });

  it("rejects empty heard", () => {
    expect(isAcceptedHeardForWord("", "Tisch")).toBe(false);
  });

  it("rejects empty target", () => {
    expect(isAcceptedHeardForWord("Tisch", "")).toBe(false);
  });
});

// ─── checkAnchors ────────────────────────────────────────────────────────────
describe("checkAnchors", () => {
  it("returns empty arrays when all required anchors present", () => {
    const result = checkAnchors("ich gehe nach hause", ["gehe", "hause"], []);
    expect(result.missing).toEqual([]);
    expect(result.forbiddenHit).toEqual([]);
  });

  it("reports missing required anchor", () => {
    const result = checkAnchors("ich laufe", ["laufe", "hause"], []);
    expect(result.missing).toContain("hause");
    expect(result.missing).not.toContain("laufe");
  });

  it("reports forbidden anchor hit", () => {
    const result = checkAnchors("ich gehe nie nach hause", [], ["nie"]);
    expect(result.forbiddenHit).toContain("nie");
  });

  it("handles empty required and forbidden", () => {
    const result = checkAnchors("beliebig", [], []);
    expect(result.missing).toEqual([]);
    expect(result.forbiddenHit).toEqual([]);
  });

  it("strips articles from anchors for comparison", () => {
    const result = checkAnchors("ich nehme den Zug", ["Zug"], []);
    expect(result.missing).toEqual([]);
  });
});

// ─── checkOrder ──────────────────────────────────────────────────────────────
describe("checkOrder", () => {
  it("returns no violations when order is correct", () => {
    const violations = checkOrder("ich gehe dann nach hause", [
      { before: "gehe", after: "hause" },
    ]);
    expect(violations).toEqual([]);
  });

  it("reports violation when order is reversed", () => {
    const violations = checkOrder("ich hause dann gehe", [
      { before: "gehe", after: "hause" },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("gehe");
  });

  it("ignores constraint when one token is absent", () => {
    const violations = checkOrder("ich gehe", [
      { before: "gehe", after: "hause" },
    ]);
    expect(violations).toEqual([]);
  });

  it("handles empty constraints", () => {
    const violations = checkOrder("anything", []);
    expect(violations).toEqual([]);
  });
});

// ─── scoreAttempt ─────────────────────────────────────────────────────────────
describe("scoreAttempt", () => {
  describe("without rule (ratio-based fallback)", () => {
    it("passes exact match", () => {
      const r = scoreAttempt("ich gehe nach hause", "ich gehe nach hause", undefined);
      expect(r.pass).toBe(true);
      expect(r.ratio).toBe(0);
    });

    it("passes near-match within 25% ratio", () => {
      const r = scoreAttempt("ich gehe nach haus", "ich gehe nach hause", undefined);
      expect(r.pass).toBe(true);
    });

    it("fails completely different attempt", () => {
      const r = scoreAttempt("hallo welt", "ich gehe nach hause", undefined);
      expect(r.pass).toBe(false);
    });

    it("fails empty attempt", () => {
      const r = scoreAttempt("", "ich gehe nach hause", undefined);
      expect(r.pass).toBe(false);
    });
  });

  describe("with anchors_required rule", () => {
    it("passes when all required anchors present", () => {
      const r = scoreAttempt("ich fahre mit dem Zug nach Berlin", undefined, {
        anchors_required: ["fahre", "Zug", "Berlin"],
      });
      expect(r.pass).toBe(true);
      expect(r.missingAnchors).toEqual([]);
    });

    it("fails when required anchor missing", () => {
      const r = scoreAttempt("ich fahre nach Berlin", undefined, {
        anchors_required: ["fahre", "Zug", "Berlin"],
      });
      expect(r.pass).toBe(false);
      expect(r.missingAnchors).toContain("Zug");
    });
  });

  describe("with anchors_forbidden rule", () => {
    it("fails when forbidden word present", () => {
      const r = scoreAttempt("ich gehe nie nach hause", undefined, {
        anchors_forbidden: ["nie"],
      });
      expect(r.pass).toBe(false);
    });

    it("passes when forbidden word absent", () => {
      const r = scoreAttempt("ich gehe nach hause", undefined, {
        anchors_forbidden: ["nie"],
      });
      expect(r.pass).toBe(true);
    });
  });

  describe("with order_constraints rule", () => {
    it("fails when order violated", () => {
      const r = scoreAttempt("hause gehe ich", undefined, {
        order_constraints: [{ before: "gehe", after: "hause" }],
      });
      expect(r.pass).toBe(false);
      expect(r.orderViolations).toHaveLength(1);
    });

    it("passes when order correct", () => {
      const r = scoreAttempt("ich gehe nach hause", undefined, {
        order_constraints: [{ before: "gehe", after: "hause" }],
      });
      expect(r.pass).toBe(true);
    });
  });

  describe("with levenshtein_max_ratio rule", () => {
    it("passes within custom ratio", () => {
      const target = "ich gehe nach hause";
      const r = scoreAttempt("ich gehe nach haus", target, {
        levenshtein_max_ratio: 0.1,
      });
      expect(r.pass).toBe(true);
    });

    it("fails beyond custom ratio", () => {
      const r = scoreAttempt("xyz", "ich gehe nach hause", {
        levenshtein_max_ratio: 0.1,
      });
      expect(r.pass).toBe(false);
    });
  });

  it("exposes normalizedAttempt in result", () => {
    const r = scoreAttempt("Ich GEHE nach Hause!", "ich gehe nach hause", undefined);
    expect(r.normalizedAttempt).toBe("ich gehe nach hause");
  });
});
