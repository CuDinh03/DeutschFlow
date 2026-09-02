// Lernweg v2 — gương backend RoadmapTreeController (/api/roadmap/tree): cây
// level → branch[skill] → shoot[topic] → leaf[bài học], TRẠNG THÁI do server
// suy ra (client chỉ render). Khác hẳn hệ skill-tree cũ (/skill-tree/me) mà
// màn roadmap hiện tại đang dùng — đây là hợp nhất mental model với web.

import api from './api'

export interface TreeUser {
  id: string
  displayName: string
  track: string | null
  goal: string | null
  currentLevel: string
  startedAt: string | null
}

export type TreeLeafState = 'completed' | 'in_progress' | 'available' | 'locked'

export interface TreeLeaf {
  id: string
  title: string
  state: TreeLeafState | (string & {})
}

export interface TreeShoot {
  topicId: string
  topicLabel: string
  topicGroup: string | null
  unlockOrder: number
  chosenByUser: boolean
  nodes: TreeLeaf[]
}

export interface TreeBranch {
  skill: string
  label: string
  status: 'matured' | 'growing' | 'locked' | (string & {})
  nodeCap: number
  shoots: TreeShoot[]
}

export interface TreeMilestone {
  id: string
  title: string
  state: 'passed' | 'ready' | 'in_progress' | 'locked' | (string & {})
  passedAt: string | null
  unlocksWhen: string | null
}

export interface TreeLevel {
  level: string
  status: 'completed' | 'current' | 'locked' | (string & {})
  milestone: TreeMilestone | null
  branches: TreeBranch[]
}

export interface TreeDto {
  user: TreeUser
  path: TreeLevel[]
}

export interface TreeNodeLesson {
  id: string
  title: string
  skill: string
  topic: string
  topicLabel: string
  group: string | null
  contentKey: string | null
}

export const lernwegApi = {
  tree: () => api.get<TreeDto>('/roadmap/tree').then((r) => r.data),
  node: (id: string) =>
    api.get<TreeNodeLesson>(`/roadmap/tree/node/${encodeURIComponent(id)}`).then((r) => r.data),
}
