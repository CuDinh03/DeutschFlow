import api from '@/lib/api'

/**
 * Direct student ↔ teacher messaging API client.
 * Paths are relative to the axios baseURL (`<origin>/api`). Backend restricts each thread to a
 * counterpart who shares a class; the caller is always the authenticated principal.
 */

/** A conversation summary (the other party + last message + unread count for the caller). */
export interface Conversation {
  userId: number
  displayName: string | null
  email: string | null
  lastMessage: string | null
  lastAt: string | null
  unread: number
}

/** A single message in a thread. `mine` = sent by the caller (drives bubble alignment). */
export interface ChatMessage {
  id: number
  senderId: number
  recipientId: number
  body: string
  createdAt: string | null
  readAt: string | null
  mine: boolean
}

/** GET /messages/conversations — most-recent first. */
export async function listConversations(): Promise<Conversation[]> {
  const res = await api.get<Conversation[]>('/messages/conversations')
  return res.data ?? []
}

/** GET /messages/with/{userId} — full thread (oldest → newest); marks incoming read. */
export async function getThread(userId: number): Promise<ChatMessage[]> {
  const res = await api.get<ChatMessage[]>(`/messages/with/${userId}`)
  return res.data ?? []
}

/** POST /messages — send to a counterpart who shares a class with the caller. */
export async function sendMessage(recipientId: number, body: string): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>('/messages', { recipientId, body })
  return res.data
}

/** POST /messages/with/{userId}/read — mark a thread read without fetching it. */
export async function markThreadRead(userId: number): Promise<void> {
  await api.post(`/messages/with/${userId}/read`)
}

/** GET /messages/unread-count — total unread across all threads. */
export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ count: number }>('/messages/unread-count')
  return res.data?.count ?? 0
}

/**
 * So hai mảng tin nhắn theo (độ dài, id đầu, id cuối) — đủ cho luồng chat append-only có xoá
 * (id tăng dần, tin mới luôn nằm cuối). Dùng để các vòng poll (W5) giữ nguyên reference mảng cũ
 * khi không có gì mới: setState với mảng mới mỗi tick là mỗi 5–12s re-render toàn bộ thread
 * dù chẳng ai nhắn gì.
 */
export function sameMessageIds(a: ReadonlyArray<{ id: number }>, b: ReadonlyArray<{ id: number }>): boolean {
  if (a.length !== b.length) return false
  if (a.length === 0) return true
  return a[0].id === b[0].id && a[a.length - 1].id === b[b.length - 1].id
}
