import { describe, it, expect } from 'vitest'
import { resolveNotificationHref } from './notificationDisplay'
import type { NotificationItem } from './notificationApi'

/** Build a minimal notification with the given type + payload. */
function notif(type: string, payload: Record<string, unknown> = {}): NotificationItem {
  return { id: 1, type, payload, read: false, createdAtUtc: '2026-07-04T00:00:00Z' }
}

describe('resolveNotificationHref', () => {
  it('deep-links a new class assignment to the assignment page', () => {
    expect(resolveNotificationHref(notif('NEW_CLASS_ASSIGNMENT', { classId: 12, assignmentId: 88 }), 'student')).toBe(
      '/v2/student/classes/12/assignments/88',
    )
  })

  it('falls back to the class detail when an assignment notification lacks the assignment id', () => {
    expect(resolveNotificationHref(notif('NEW_ASSIGNMENT', { classId: 12 }), 'student')).toBe('/v2/student/classes/12')
  })

  it('sends a graded speaking session to review, other graded work to the class list', () => {
    expect(resolveNotificationHref(notif('ASSIGNMENT_GRADED', { assignmentType: 'SPEAKING', referenceId: 3 }), 'student')).toBe(
      '/v2/student/review',
    )
    expect(resolveNotificationHref(notif('ASSIGNMENT_GRADED', { assignmentType: 'WRITING', referenceId: 3 }), 'student')).toBe(
      '/v2/student/classes',
    )
  })

  it('routes class membership / session / announcement events to the class detail', () => {
    for (const type of ['ADDED_TO_CLASS', 'JOIN_REQUEST_APPROVED', 'TEACHER_ANNOUNCEMENT', 'CLASS_SESSION_SCHEDULED']) {
      expect(resolveNotificationHref(notif(type, { classId: 9 }), 'student')).toBe('/v2/student/classes/9')
    }
  })

  it('deep-links a new message to the sender thread in the viewer’s own area', () => {
    expect(resolveNotificationHref(notif('NEW_MESSAGE', { senderId: 4, senderName: 'Cô Lan' }), 'student')).toBe(
      '/v2/student/messages?to=4&name=C%C3%B4+Lan',
    )
    expect(resolveNotificationHref(notif('NEW_MESSAGE', { senderId: 4 }), 'teacher')).toBe('/v2/teacher/messages?to=4')
  })

  it('falls back to the conversation list when a new message lacks a sender id', () => {
    expect(resolveNotificationHref(notif('NEW_MESSAGE', {}), 'student')).toBe('/v2/student/messages')
  })

  it('routes a class-channel message to its class in the viewer’s own area', () => {
    expect(resolveNotificationHref(notif('CLASS_CHANNEL_MESSAGE', { classId: 9, senderName: 'An' }), 'student')).toBe(
      '/v2/student/classes/9',
    )
    expect(resolveNotificationHref(notif('CLASS_CHANNEL_MESSAGE', { classId: 9 }), 'teacher')).toBe(
      '/v2/teacher/classes/9',
    )
  })

  it('falls back to the class list when a class-channel message lacks a class id', () => {
    expect(resolveNotificationHref(notif('CLASS_CHANNEL_MESSAGE', {}), 'student')).toBe('/v2/student/classes')
  })

  it('routes teacher submission events to the per-student grading page', () => {
    expect(resolveNotificationHref(notif('QUIZ_SUBMISSION_RECEIVED', { classId: 2, studentId: 7 }), 'teacher')).toBe(
      '/v2/teacher/classes/2/students/7',
    )
  })

  it('routes admin learner + org events to their admin pages', () => {
    expect(resolveNotificationHref(notif('USER_REGISTERED', { newStudentId: 3 }), 'admin')).toBe('/v2/admin/users')
    expect(resolveNotificationHref(notif('ADMIN_ORG_CREATED', { orgId: 1 }), 'admin')).toBe('/v2/admin/organizations')
  })

  it('an org viewer’s invoice notification goes to org billing', () => {
    expect(resolveNotificationHref(notif('ADMIN_ORG_INVOICE_PAID', { orgId: 1 }), 'org')).toBe('/v2/org/billing')
  })

  it('returns null when there is no useful destination', () => {
    expect(resolveNotificationHref(notif('ADMIN_BROADCAST', { title: 'x' }), 'student')).toBeNull()
    expect(resolveNotificationHref(notif('SOMETHING_UNKNOWN'), 'student')).toBeNull()
  })
})
