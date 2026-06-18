// icons.ts — inline 24×24 SVG icon path-sets for the learning tree (skill badges + topic chips).
// Lucide-derived stroke paths; inline (no runtime dependency, sprite-friendly, snapshot-testable).

import type { Skill, TopicGroup } from '@/lib/learning-tree/core'

/** Stroke paths drawn in a 0 0 24 24 viewBox. */
export type IconPaths = readonly string[]

/** Skill icons: Nghe=headphones, Nói=mic, Đọc=open book, Viết=pencil. */
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

/** Topic icons: Đời sống=house, Công việc=briefcase, Du lịch=plane, Y tế=cross, Văn hóa=landmark, Luyện thi=target. */
export const TOPIC_ICONS: Record<TopicGroup, IconPaths> = {
  daily: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  work: [
    'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z',
    'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  ],
  travel: [
    'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  ],
  medical: [
    'M11 2a1 1 0 0 0-1 1v5H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h5v5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-5h5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-5V3a1 1 0 0 0-1-1z',
  ],
  culture: ['M3 22h18', 'M6 18v-8', 'M10 18v-8', 'M14 18v-8', 'M18 18v-8', 'M4 10h16', 'M12 2 4 7h16z'],
  exam: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  ],
}
