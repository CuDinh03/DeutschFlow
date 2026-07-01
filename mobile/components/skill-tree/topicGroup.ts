// Maps a lesson node to one of the 6 topic groups (limb colours) and a human
// topic label. Pure + unit-tested. The mapping is the spec-M4 default: industry
// wins (vocational satellite content), else phase (core foundation = daily-life),
// else daily. The exact taxonomy is a product-tunable decision (spec §8 Q2) — this
// is a sensible default, not a contract. Enum values verified against the backend
// seed data (phase ∈ FOUNDATION/GRUNDLAGEN/PHONETIK…, industry ∈ Medizin/PFLEGE/
// IT/GASTRONOMIE/TOURISMUS…).

import type { SkillNode } from '@/lib/skillTreeApi'
import type { TopicGroupKey } from './palette'

const INDUSTRY_GROUP: Record<string, TopicGroupKey> = {
  MEDIZIN: 'medical',
  PFLEGE: 'medical',
  IT: 'work',
  GASTRONOMIE: 'work',
  HANDWERK: 'work',
  LOGISTIK: 'work',
  TOURISMUS: 'travel',
}

const PHASE_GROUP: Record<string, TopicGroupKey> = {
  PHONETIK: 'daily',
  GRUNDLAGEN: 'daily',
  FOUNDATION: 'daily',
  AUFBAU: 'work',
  VERTIEFUNG: 'culture',
  PRODUKTION: 'culture',
}

const EXAM_SESSION = /EXAM|TEST|QUIZ|ASSESS|PRUEFUNG/i

export function topicGroupOf(node: Pick<SkillNode, 'industry' | 'phase' | 'sessionType'>): TopicGroupKey {
  if (node.sessionType && EXAM_SESSION.test(node.sessionType)) return 'exam'
  if (node.industry) {
    const g = INDUSTRY_GROUP[node.industry.toUpperCase()]
    if (g) return g
    return 'work' // an unknown industry is still vocational
  }
  if (node.phase) {
    const g = PHASE_GROUP[node.phase.toUpperCase()]
    if (g) return g
  }
  return 'daily'
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// Human label for a branch chip: prefer the curriculum module title, else the
// first core topic (title-cased enum), else the first tag, else a day label.
export function topicLabelOf(node: Pick<SkillNode, 'moduleTitle' | 'coreTopics' | 'tags' | 'dayNumber'>): string {
  if (node.moduleTitle && node.moduleTitle.trim()) return node.moduleTitle.trim()
  if (node.coreTopics.length > 0) return titleCase(node.coreTopics[0])
  if (node.tags.length > 0) return node.tags[0].replace(/^#/, '')
  return `Ngày ${node.dayNumber}`
}
