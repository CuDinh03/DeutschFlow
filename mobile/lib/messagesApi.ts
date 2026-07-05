// Direct student ↔ teacher messaging. Mirrors backend MessageController (/api/messages) and the
// MessagingDtos shapes exactly. Threads are restricted server-side to a counterpart who shares a
// class (teacher↔student); the caller is always the authenticated principal.

import api from './api'

/** A conversation summary — the other party + last-message preview + unread count for the caller. */
export interface Conversation {
  userId: number
  displayName: string
  email: string
  lastMessage: string | null
  lastAt: string | null
  unread: number
}

/** A single message in a thread. `mine` = sent by the caller (drives bubble alignment). */
export interface Message {
  id: number
  senderId: number
  recipientId: number
  body: string
  createdAt: string
  readAt: string | null
  mine: boolean
}

export const messagesApi = {
  /** Conversation summaries (one per counterpart), most-recent first. */
  conversations: () =>
    api.get<Conversation[]>('/messages/conversations').then((r) => r.data ?? []),

  /** Total unread across all threads — for a global badge. */
  unreadCount: () =>
    api.get<{ count: number }>('/messages/unread-count').then((r) => r.data?.count ?? 0),

  /**
   * Thread with another user; the backend also marks incoming messages read. Pass `afterId` to
   * fetch only messages newer than that id (incremental/delta polling — the client merges the
   * delta into its cache); omit it for the full thread (first load / cold cache).
   */
  thread: (userId: number, afterId?: number) =>
    api
      .get<Message[]>(`/messages/with/${userId}`, afterId ? { params: { afterId } } : undefined)
      .then((r) => r.data ?? []),

  /** Send a message (recipient must share a class with the caller). */
  send: (recipientId: number, body: string) =>
    api.post<Message>('/messages', { recipientId, body }).then((r) => r.data),

  /** Explicitly mark a thread read (e.g. without fetching it). */
  markRead: (userId: number) =>
    api.post(`/messages/with/${userId}/read`).then(() => undefined),
}
