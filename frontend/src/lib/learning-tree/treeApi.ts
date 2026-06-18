// treeApi — client for the learning-tree ("Cây học tập") backend (BE-4).
// Endpoints live under /api/roadmap/tree; the shared axios client prefixes /api.
import api from '@/lib/api'
import type { PathLevel } from '@/lib/learning-tree/core'

/** Learner header for the tree (display only). Mirrors backend TreeDto.TreeUserDto. */
export interface TreeUser {
  id: string
  displayName: string
  track: string | null
  goal: string
  currentLevel: string
  startedAt: string | null
}

/**
 * The full tree response. {@link path} is structurally the engine's `PathInput`, so it feeds
 * `computeTreeLayout(tree.path)` directly.
 */
export interface TreeResponse {
  user: TreeUser
  path: PathLevel[]
}

/** Lesson descriptor returned when a leaf is tapped. Mirrors backend TreeNodeLessonDto. */
export interface TreeNodeLesson {
  id: string
  title: string
  skill: string
  topic: string
  topicLabel: string
  group: string
  contentKey: string | null
}

/** Full tree for the authenticated learner. */
export async function fetchTree(): Promise<TreeResponse> {
  const res = await api.get<TreeResponse>('/roadmap/tree')
  return res.data
}

/** Lesson descriptor for a single leaf. */
export async function fetchNodeLesson(nodeId: string): Promise<TreeNodeLesson> {
  const res = await api.get<TreeNodeLesson>(`/roadmap/tree/node/${encodeURIComponent(nodeId)}`)
  return res.data
}

/** Marks a leaf completed; returns the recomputed tree (the tree "grows"). */
export async function completeNode(nodeId: string): Promise<TreeResponse> {
  const res = await api.post<TreeResponse>(`/roadmap/tree/node/${encodeURIComponent(nodeId)}/complete`)
  return res.data
}

/**
 * Passes the current level's milestone (the level-up ritual). The backend rejects with 400 when the
 * milestone is not yet ready (all four skills matured) or the learner is at the top level. Returns
 * the recomputed (grown) tree, with the next level now current.
 */
export async function levelUp(): Promise<TreeResponse> {
  const res = await api.post<TreeResponse>('/roadmap/tree/level-up')
  return res.data
}
