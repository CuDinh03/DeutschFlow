import type { SpeakingPersonaId } from "@/lib/aiSpeakingApi";

/**
 * Gợi ý persona khớp chuyên ngành của chủ đề (phương án B —
 * BAO_CAO_KIEM_TRA_PERSONA_2026-08-06.md mục 6.2): khi học viên chọn chủ đề
 * chuyên ngành lệch persona đang chọn, hiện chip gợi ý mềm — KHÔNG chặn.
 * Nhóm ngành khớp `group` của SPEAKING_PERSONAS + industry seed V163 backend.
 */

export type TopicDomain =
  | "medizin"
  | "gastro"
  | "hotel"
  | "verkauf"
  | "technik"
  | "it"
  | "medien";

const DOMAIN_PERSONAS: Record<TopicDomain, SpeakingPersonaId[]> = {
  medizin: ["SARAH", "SCHNEIDER", "WEBER"],
  gastro: ["KLAUS", "NIKLAS"],
  hotel: ["NINA"],
  verkauf: ["LENA", "THOMAS", "PETRA"],
  technik: ["MAX", "OLIVER"],
  it: ["LUKAS"],
  medien: ["HANNIE"],
};

/** Persona → ngành "nhà" của nó; persona đa năng (DEFAULT/EMMA/ANNA) không có ngành. */
const PERSONA_DOMAIN: Partial<Record<SpeakingPersonaId, TopicDomain>> = {
  SARAH: "medizin",
  SCHNEIDER: "medizin",
  WEBER: "medizin",
  KLAUS: "gastro",
  NIKLAS: "gastro",
  NINA: "hotel",
  LENA: "verkauf",
  THOMAS: "verkauf",
  PETRA: "verkauf",
  MAX: "technik",
  OLIVER: "technik",
  LUKAS: "it",
  HANNIE: "medien",
};

/** Từ khóa nhận diện ngành trong chủ đề — tiếng Đức, Việt và Anh thông dụng. */
const DOMAIN_KEYWORDS: Record<TopicDomain, RegExp> = {
  medizin:
    /arzt|praxis|gesundheit|krank|apotheke|medizin|khám|bệnh|sức khỏe|y khoa|bác sĩ|thuốc|doctor|health/i,
  gastro:
    /essen|restaurant|koch|küche|speisekarte|bestell|gastronomie|ẩm thực|nấu ăn|món ăn|nhà hàng|gọi món|food|cooking/i,
  hotel: /hotel|rezeption|check-?in|übernacht|khách sạn|đặt phòng|lễ tân/i,
  verkauf:
    /einkauf|supermarkt|bäcker|metzger|laden|verkauf|kasse|mua sắm|siêu thị|bán hàng|shopping/i,
  technik:
    /maschine|werkstatt|technik|cnc|fräs|reparatur|wartung|máy móc|cơ khí|kỹ thuật|xưởng/i,
  it: /computer|software|programmier|entwickl|coding|lập trình|phần mềm|\bit\b/i,
  medien:
    /moderation|bühne|medien|kamera|podcast|show|truyền thông|sân khấu|dẫn chương trình|\bmc\b/i,
};

/** Bộ ba gia sư Việt là chế độ học riêng (tiếng Việt) — không gợi ý đổi khỏi họ. */
const NEVER_SUGGEST_AWAY: ReadonlySet<SpeakingPersonaId> = new Set<SpeakingPersonaId>([
  "TUAN",
  "LAN",
  "MINH",
]);

export interface PersonaTopicSuggestion {
  domain: TopicDomain;
  personas: SpeakingPersonaId[];
}

/**
 * Trả về gợi ý persona khớp ngành của chủ đề, hoặc null khi: chủ đề trống/không
 * thuộc ngành nào, persona hiện tại đã đúng ngành, hoặc là gia sư Việt.
 */
export function suggestPersonasForTopic(
  topic: string | null | undefined,
  currentPersona: SpeakingPersonaId,
): PersonaTopicSuggestion | null {
  const trimmed = (topic ?? "").trim();
  if (!trimmed || NEVER_SUGGEST_AWAY.has(currentPersona)) return null;

  const match = (Object.keys(DOMAIN_KEYWORDS) as TopicDomain[]).find((d) =>
    DOMAIN_KEYWORDS[d].test(trimmed),
  );
  if (!match) return null;
  if (PERSONA_DOMAIN[currentPersona] === match) return null;

  const personas = DOMAIN_PERSONAS[match].filter((p) => p !== currentPersona);
  return personas.length > 0 ? { domain: match, personas } : null;
}
