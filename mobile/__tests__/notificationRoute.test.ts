import { resolveNotificationRoute } from '@/lib/notificationRoute'

describe('resolveNotificationRoute', () => {
  it('routes a new class assignment to the assignment screen by assignmentId', () => {
    expect(resolveNotificationRoute('NEW_CLASS_ASSIGNMENT', { classId: 12, assignmentId: 88 })).toEqual({
      pathname: '/(student)/assignments/[id]',
      params: { id: '88' },
    })
  })

  it('falls back to the class screen when a new assignment has no assignmentId', () => {
    expect(resolveNotificationRoute('NEW_ASSIGNMENT', { classId: 12 })).toEqual({
      pathname: '/(student)/classes/[id]',
      params: { id: '12' },
    })
  })

  it('routes a graded class assignment to the assignment via referenceId', () => {
    expect(resolveNotificationRoute('ASSIGNMENT_GRADED', { assignmentType: 'WRITING', referenceId: 55 })).toEqual({
      pathname: '/(student)/assignments/[id]',
      params: { id: '55' },
    })
  })

  it('does not route a graded SPEAKING session (no per-session screen)', () => {
    expect(resolveNotificationRoute('ASSIGNMENT_GRADED', { assignmentType: 'SPEAKING', referenceId: 9 })).toBeNull()
  })

  it('routes class-session events to the class schedule with the class name', () => {
    expect(resolveNotificationRoute('CLASS_SESSION_RESCHEDULED', { classId: 3, className: 'B1.2' })).toEqual({
      pathname: '/(student)/class-schedule/[classId]',
      params: { classId: '3', className: 'B1.2' },
    })
  })

  it('routes a teacher announcement to the class chat', () => {
    expect(resolveNotificationRoute('TEACHER_ANNOUNCEMENT', { classId: 7, className: 'A2' })).toEqual({
      pathname: '/(student)/class-chat/[classId]',
      params: { classId: '7', className: 'A2' },
    })
  })

  it('routes a new message to the sender thread', () => {
    expect(resolveNotificationRoute('NEW_MESSAGE', { senderId: 42, senderName: 'Cô Lan' })).toEqual({
      pathname: '/(student)/messages/[userId]',
      params: { userId: '42', name: 'Cô Lan' },
    })
  })

  it('routes an added-to-class notification to the class detail', () => {
    expect(resolveNotificationRoute('ADDED_TO_CLASS', { classId: 5, className: 'X' })).toEqual({
      pathname: '/(student)/classes/[id]',
      params: { id: '5' },
    })
  })

  it('routes review-due to the SRS screen', () => {
    expect(resolveNotificationRoute('REVIEW_DUE', { dueCount: 4 })).toBe('/(student)/srs')
  })

  it('returns null for a type with no useful destination', () => {
    expect(resolveNotificationRoute('ADMIN_BROADCAST', { title: 'x' })).toBeNull()
    expect(resolveNotificationRoute('UNKNOWN_TYPE', null)).toBeNull()
  })
})
