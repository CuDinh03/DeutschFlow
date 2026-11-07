// Bốn kỹ năng tiếng Đức — kiểu, nhãn, màu và icon dùng chung.
//
// Tách ra từ cụm learning-tree (đã gỡ 2026-08-03 cùng tab "Cây học tập" demo). Runner luyện tập
// (/v2/student/practice/[nodeId] và .../[skill]) là nơi dùng thật: mỗi node lộ trình chứa cả bốn
// kỹ năng, và backend chia bài theo trục này (POST /api/skill-tree/{nodeId}/practice/{skill}/start).

import { BookOpen, Headphones, Mic, PenLine, type LucideIcon } from 'lucide-react'

/** Bốn kỹ năng, khớp `skillType` của backend (chữ thường trong URL, viết hoa khi gửi lên). */
export type Skill = 'hoeren' | 'sprechen' | 'lesen' | 'schreiben'

export const SKILL_LABELS: Record<Skill, string> = {
  hoeren: 'Nghe',
  sprechen: 'Nói',
  lesen: 'Đọc',
  schreiben: 'Viết',
}

/** Màu nhận diện của từng kỹ năng — tín hiệu duy nhất trên huy hiệu chỉ-có-icon. */
export const SKILL_COLORS: Record<Skill, string> = {
  hoeren: '#4F86E0', // Nghe
  sprechen: '#E8853A', // Nói
  lesen: '#5E9150', // Đọc
  schreiben: '#8257D8', // Viết
}

/**
 * Icon kỹ năng (Lucide, đặt trong ô `GaGlyph`). Nghe = tai nghe, Nói = micro, Đọc = sách mở, Viết = bút trên
 * dòng. Trước 07/11/2026 là nét vẽ nhúng (`SKILL_ICONS` + `SkillIcon`) nét 2 trong vòng tròn màu hex.
 */
export const SKILL_ICON: Record<Skill, LucideIcon> = {
  hoeren: Headphones,
  sprechen: Mic,
  lesen: BookOpen,
  schreiben: PenLine,
}
