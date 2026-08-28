// Presentation metadata for fixed-mentor personas (SpeakingPersona codes).
// Shared by onboarding (mentor reveal) and the dashboard MentorChip so the
// emoji/tagline stay consistent.
//
// Nguồn chuẩn của danh sách mã: backend FixedMentorResolver.CATALOG (21 mã).
// Thêm mentor ở backend thì phải thêm ở đây VÀ ở mobile/lib/onboardingMentor.ts —
// bỏ sót đúng bước này là lý do 6 mentor nhập môn của F-15 trôi mất trên web.

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
  // Mentor nhập môn (F-15) — mỗi lĩnh vực có một người bậc BEGINNER để tài khoản
  // FREE không rơi hết về Anna. Tagline nói rõ "nhập môn" để người học biết vì sao
  // mentor này nói tiếng Đức đơn giản.
  JONAS: { emoji: "🖥️", tagline: "Hỗ trợ IT — nhập môn" },
  MARIE: { emoji: "🧑‍⚕️", tagline: "Phụ tá điều dưỡng — nhập môn" },
  TIM: { emoji: "🥗", tagline: "Phụ bếp — nhập môn" },
  JULIA: { emoji: "📦", tagline: "Phụ việc sản xuất — nhập môn" },
  FELIX: { emoji: "🗂️", tagline: "Văn phòng — học việc" },
  MIA: { emoji: "📱", tagline: "Trợ lý mạng xã hội — nhập môn" },
};

const FALLBACK: MentorMeta = { emoji: "🧑‍🏫", tagline: "Người đồng hành học tập" };

export function getMentorMeta(code: string | null | undefined): MentorMeta {
  return (code && MENTOR_META[code]) || FALLBACK;
}

/** Capitalize a persona code into a display name (ANNA → Anna). */
export function mentorDisplayName(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}
