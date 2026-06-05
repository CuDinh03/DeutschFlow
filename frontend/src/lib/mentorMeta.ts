// Presentation metadata for fixed-mentor personas (SpeakingPersona codes).
// Shared by onboarding (mentor reveal) and the dashboard MentorChip so the
// emoji/tagline stay consistent. Mirrors SRS §59.3.

export interface MentorMeta {
  emoji: string;
  tagline: string;
}

export const MENTOR_META: Record<string, MentorMeta> = {
  ANNA: { emoji: "🧑‍🏫", tagline: "Cố vấn nghề & luyện thi" },
  LUKAS: { emoji: "💻", tagline: "Tech Lead — CNTT" },
  EMMA: { emoji: "💼", tagline: "Business & văn phòng" },
  KLAUS: { emoji: "👨‍🍳", tagline: "Bếp trưởng — Nhà hàng" },
  WEBER: { emoji: "🩺", tagline: "Bác sĩ da liễu" },
  SARAH: { emoji: "🏥", tagline: "Trợ lý y khoa" },
  SCHNEIDER: { emoji: "👁️", tagline: "Bác sĩ mắt" },
  LENA: { emoji: "🛍️", tagline: "Bán lẻ" },
  THOMAS: { emoji: "🥐", tagline: "Thợ làm bánh" },
  PETRA: { emoji: "🥩", tagline: "Cửa hàng thịt" },
  MAX: { emoji: "⚙️", tagline: "Vận hành máy" },
  OLIVER: { emoji: "🔧", tagline: "Thợ CNC" },
  NIKLAS: { emoji: "🍽️", tagline: "Phục vụ nhà hàng" },
  NINA: { emoji: "🏨", tagline: "Lễ tân khách sạn" },
  HANNIE: { emoji: "🎤", tagline: "MC / Truyền thông" },
};

const FALLBACK: MentorMeta = { emoji: "🧑‍🏫", tagline: "Người đồng hành học tập" };

export function getMentorMeta(code: string | null | undefined): MentorMeta {
  return (code && MENTOR_META[code]) || FALLBACK;
}

/** Capitalize a persona code into a display name (ANNA → Anna). */
export function mentorDisplayName(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}
