/**
 * Tests cho tab "Đánh giá" phía học viên (web).
 *
 * Điểm được canh giữ: nhận xét bằng lời của giáo viên PHẢI hiện ra. Trước bản vá này `teacherComment`
 * chỉ tồn tại trên DTO phía giáo viên — thầy cô viết trong sổ điểm, học viên không có màn nào đọc được.
 * Hai test còn lại canh phần dễ vỡ âm thầm: mẫu số chuyên cần chỉ đếm buổi CÓ ghi nhận cho chính học
 * viên, và một endpoint hỏng không được kéo theo endpoint kia.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EvaluationTab } from '@/app/v2/student/classes/[id]/EvaluationTab'
import type { MySkillReport, StudentAttendance } from '@/lib/studentClassesApi'

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) =>
    v ? `${k}:${Object.values(v).join(',')}` : k,
}))

const fetchMySkillReport = vi.fn()
const fetchMyAttendance = vi.fn()
vi.mock('@/lib/studentClassesApi', () => ({
  fetchMySkillReport: (id: number) => fetchMySkillReport(id),
  fetchMyAttendance: (id: number) => fetchMyAttendance(id),
}))

const report = (over: Partial<MySkillReport> = {}): MySkillReport => ({
  horen: 8, lesen: 7, schreiben: null, sprechen: null, total: 7.5, grade: 'Khá',
  teacherComment: null, evaluatedAt: null, ...over,
})

const att = (over: Partial<StudentAttendance> = {}): StudentAttendance => ({
  lessonLogId: 1, sessionDate: '2026-08-01', sessionNumber: 1, topic: 'Perfekt',
  status: 'PRESENT', note: null, ...over,
})

describe('EvaluationTab (học viên)', () => {
  beforeEach(() => {
    fetchMySkillReport.mockReset()
    fetchMyAttendance.mockReset()
  })

  it("hiện nhận xét bằng lời của giáo viên cùng ngày viết", async () => {
    fetchMySkillReport.mockResolvedValue(
      report({ teacherComment: 'Phát âm tiến bộ, cần luyện Perfekt.', evaluatedAt: '2026-08-20T09:30:00' }),
    )
    fetchMyAttendance.mockResolvedValue([])

    render(<EvaluationTab classId={7} />)

    expect(await screen.findByText('Phát âm tiến bộ, cần luyện Perfekt.')).toBeInTheDocument()
    expect(screen.getByText('evaluatedAt:20/08/2026')).toBeInTheDocument()
  })

  it('báo "chưa có nhận xét" thay vì để trống khi giáo viên chưa viết', async () => {
    fetchMySkillReport.mockResolvedValue(report())
    fetchMyAttendance.mockResolvedValue([])

    render(<EvaluationTab classId={7} />)

    expect(await screen.findByText('noCommentTitle')).toBeInTheDocument()
  })

  it('tính chuyên cần trên số buổi CÓ ghi nhận, bỏ qua buổi chưa điểm danh', async () => {
    fetchMySkillReport.mockResolvedValue(report())
    fetchMyAttendance.mockResolvedValue([
      att({ lessonLogId: 1, status: 'PRESENT' }),
      att({ lessonLogId: 2, status: 'ABSENT' }),
      att({ lessonLogId: 3, status: null }),   // chưa điểm danh — KHÔNG được tính là vắng
    ])

    render(<EvaluationTab classId={7} />)

    // 1 có mặt / 2 buổi có ghi nhận = 50%, chứ không phải 1/3 = 33%.
    expect(await screen.findByText('rate:50')).toBeInTheDocument()
    expect(screen.getByText('absentCount:1')).toBeInTheDocument()
  })

  it('điểm danh hỏng không xoá mất bảng điểm (hai lời gọi độc lập)', async () => {
    fetchMySkillReport.mockResolvedValue(report({ total: 9.2, grade: 'Xuất sắc' }))
    fetchMyAttendance.mockRejectedValue(new Error('500'))

    render(<EvaluationTab classId={7} />)

    expect(await screen.findByText('Xuất sắc')).toBeInTheDocument()
    expect(screen.getByText('noAttendanceTitle')).toBeInTheDocument()
  })
})
