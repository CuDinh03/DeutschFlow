// Skill-tree node session (lesson content). Mirrors the backend getNodeSession
// shape. Only the learning-content fields the app renders are typed; the
// interactive exercise loop (heterogeneous) is intentionally not modelled here.

import api from './api'

export interface TheoryCard {
  type?: string
  title?: { vi?: string; de?: string }
  content?: { vi?: string; de?: string }
  tags?: string[]
}

export interface NodeVocabItem {
  id: string
  german: string
  meaning: string
  gender?: string | null
  gender_label?: string | null
  example_de?: string
  example_vi?: string
  tags?: string[]
}

export interface NodePhrase {
  german: string
  meaning: string
}

export interface NodeContent {
  title?: { de?: string; vi?: string }
  overview?: { de?: string; vi?: string }
  theory_cards?: TheoryCard[]
  vocabulary?: NodeVocabItem[]
  phrases?: NodePhrase[]
}

export interface NodeSession {
  nodeId: number
  titleDe: string
  titleVi: string
  descriptionVi: string | null
  emoji: string | null
  cefrLevel: string | null
  xpReward: number | null
  sessionType: string | null
  content: NodeContent | null
  hasContent: boolean
  dependenciesMet: boolean
  userStatus: string // LOCKED | AVAILABLE | IN_PROGRESS | COMPLETED
}

export const skillTreeApi = {
  getNodeSession: (nodeId: number | string) =>
    api.get<NodeSession>(`/skill-tree/node/${nodeId}/session`).then((r) => r.data),
}
