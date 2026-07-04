import api from '@/lib/api'

/**
 * Class group channel API client — mirrors backend ClassChannelController
 * (`/api/v2/classes/{classId}/channel`) and ClassChannelDtos exactly.
 *
 * Every member of a class (enrolled students + the class's teachers) may read and post.
 * Membership is re-verified server-side on every call; the caller is always the principal.
 * Paths are relative to the axios baseURL (`<origin>/api`).
 */

/**
 * One channel message as seen by the caller. `body` is null when `deleted` (clients render a
 * "Tin đã xoá" placeholder). `mine` drives bubble alignment; `canDelete` drives the delete
 * affordance (own message, or the caller is a teacher of the class, and it isn't already deleted).
 */
export interface ClassMessage {
  id: number
  senderId: number
  senderName: string
  body: string | null
  createdAt: string
  mine: boolean
  deleted: boolean
  canDelete: boolean
}

/** GET channel history (oldest-first, most recent 200). */
export async function listClassMessages(classId: number): Promise<ClassMessage[]> {
  const res = await api.get<ClassMessage[]>(`/v2/classes/${classId}/channel/messages`)
  return res.data ?? []
}

/** POST a message to the class channel. */
export async function postClassMessage(classId: number, body: string): Promise<ClassMessage> {
  const res = await api.post<ClassMessage>(`/v2/classes/${classId}/channel/messages`, { body })
  return res.data
}

/** DELETE (soft) a message — own message, or any if the caller is a teacher of the class. */
export async function deleteClassMessage(classId: number, messageId: number): Promise<ClassMessage> {
  const res = await api.delete<ClassMessage>(`/v2/classes/${classId}/channel/messages/${messageId}`)
  return res.data
}
