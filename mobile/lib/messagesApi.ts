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

  /** Full thread with another user; the backend also marks incoming messages read. */
  thread: (userId: number) =>
    api.get<Message[]>(`/messages/with/${userId}`).then((r) => r.data ?? []),

  /** Send a message (recipient must share a class with the caller). */
  send: (recipientId: number, body: string) =>
    api.post<Message>('/messages', { recipientId, body }).then((r) => r.data),

  /** Explicitly mark a thread read (e.g. without fetching it). */
  markRead: (userId: number) =>
    api.post(`/messages/with/${userId}/read`).then(() => undefined),
}
