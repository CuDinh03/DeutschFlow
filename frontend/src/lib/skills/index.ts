// Bốn kỹ năng tiếng Đức — kiểu, nhãn, màu và icon dùng chung.
//
// Tách ra từ cụm learning-tree (đã gỡ 2026-08-03 cùng tab "Cây học tập" demo). Runner luyện tập
// (/v2/student/practice/[nodeId] và .../[skill]) là nơi dùng thật: mỗi node lộ trình chứa cả bốn
// kỹ năng, và backend chia bài theo trục này (POST /api/skill-tree/{nodeId}/practice/{skill}/start).

/** Bốn kỹ năng, khớp `skillType` của backend (chữ thường trong URL, viết hoa khi gửi lên). */
export type Skill = 'hoeren' | 'sprechen' | 'lesen' | 'schreiben'

/** Các nét vẽ của một icon trong viewBox 0 0 24 24. */
export type IconPaths = readonly string[]

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

/** Nghe=tai nghe, Nói=micro, Đọc=sách mở, Viết=bút chì. Nét dựng sẵn từ Lucide, nhúng thẳng. */
export const SKILL_ICONS: Record<Skill, IconPaths> = {
  hoeren: [
    'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
  ],
  sprechen: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  lesen: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  schreiben: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z'],
}
