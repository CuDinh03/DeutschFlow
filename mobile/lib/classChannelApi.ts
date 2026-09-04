// Class group channel (P6). Every class member (students + teachers) posts and reads all
// messages. Deletion is a soft-delete: `deleted` messages arrive with a null body (show a
// "[Tin đã xoá]" placeholder). `canDelete` drives the delete affordance (own message, or the
// caller is a teacher of the class). Mirrors backend ClassChannelDtos exactly.

import api from './api'

export interface ClassMessage {
  id: number
  senderId: number
  senderName: string
  body: string | null // null when deleted
  createdAt: string
  mine: boolean
  deleted: boolean
  canDelete: boolean
}

export const classChannelApi = {
  /** Channel history (oldest-first), most recent 200. */
  list: (classId: number) =>
    api.get<ClassMessage[]>(`/v2/classes/${classId}/channel/messages`).then((r) => r.data ?? []),

  /**
   * Post a message to the class channel. `clientTempId` (tuỳ chọn) là idempotency key — outbox
   * truyền tempId của item, server thấy key đã dùng thì trả lại đúng bản ghi cũ thay vì tạo tin
   * trùng (F-13). Bỏ trống thì JSON.stringify tự lược field — hợp đồng với backend cũ không đổi.
   */
  post: (classId: number, body: string, clientTempId?: string) =>
    api
      .post<ClassMessage>(`/v2/classes/${classId}/channel/messages`, { body, clientTempId })
      .then((r) => r.data),

  /** Soft-delete a message (own, or any if the caller is a teacher). */
  remove: (classId: number, messageId: number) =>
    api
      .delete<ClassMessage>(`/v2/classes/${classId}/channel/messages/${messageId}`)
      .then((r) => r.data),
}
