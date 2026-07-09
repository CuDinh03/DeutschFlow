// Maps a notification (type + payload) to the in-app screen it should open when tapped — used by
// both the notifications inbox and the push-tap handler. Mobile is student-only, so every route is
// under the (student) group. Returns null when there is no useful destination (the row then just
// marks itself read). Payload keys are verbatim from the backend producers (UserNotificationService
// / MessageService / StudentAssignmentController).
import type { Href } from 'expo-router'

/** First non-empty payload value among `keys`, as a string (ids arrive as numbers over JSON). */
function payloadId(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k]
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v)
  }
  return null
}

export function resolveNotificationRoute(
  type: string,
  payload: Record<string, unknown> | null | undefined,
): Href | null {
  const p = payload ?? {}
  const classId = payloadId(p, 'classId')
  const className = payloadId(p, 'className') ?? ''
  const assignmentId = payloadId(p, 'assignmentId')
  const referenceId = payloadId(p, 'referenceId')
  const senderId = payloadId(p, 'senderId')
  const senderName = payloadId(p, 'senderName') ?? ''

  switch (type) {
    case 'NEW_ASSIGNMENT':
    case 'NEW_CLASS_ASSIGNMENT':
      if (assignmentId || referenceId)
        return { pathname: '/(student)/assignments/[id]', params: { id: (assignmentId ?? referenceId) as string } }
      if (classId) return { pathname: '/(student)/classes/[id]', params: { id: classId } }
      return null

    case 'ASSIGNMENT_GRADED':
      // A graded class assignment carries its id in referenceId; speaking sessions have no
      // per-session screen, so those just open the inbox (null).
      if (String(p.assignmentType) !== 'SPEAKING' && referenceId)
        return { pathname: '/(student)/assignments/[id]', params: { id: referenceId } }
      return null

    case 'ADDED_TO_CLASS':
    case 'JOIN_REQUEST_APPROVED':
      return classId ? { pathname: '/(student)/classes/[id]', params: { id: classId } } : '/(student)/classes'

    case 'JOIN_REQUEST_REJECTED':
      return '/(student)/classes'

    case 'CLASS_SESSION_SCHEDULED':
    case 'CLASS_SESSION_CANCELLED':
    case 'CLASS_SESSION_RESCHEDULED':
      return classId ? { pathname: '/(student)/class-schedule/[classId]', params: { classId, className } } : null

    case 'TEACHER_ANNOUNCEMENT':
    case 'CLASS_CHANNEL_MESSAGE':
      return classId ? { pathname: '/(student)/class-chat/[classId]', params: { classId, className } } : null

    case 'NEW_MESSAGE':
      return senderId
        ? { pathname: '/(student)/messages/[userId]', params: { userId: senderId, name: senderName } }
        : '/(student)/messages'

    case 'REVIEW_DUE':
      return '/(student)/srs'

    case 'STREAK_REMINDER':
      return '/(student)'

    case 'ACHIEVEMENT_UNLOCKED':
    case 'LEVEL_UP':
      return '/(student)/profile'

    default:
      return null
  }
}
