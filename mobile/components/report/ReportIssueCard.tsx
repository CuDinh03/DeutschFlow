// Một phiếu đánh giá đã gửi gia đình, phía học viên (R6/PR-R4).
//
// Toàn bộ số liệu đọc từ `payload` — ảnh chụp đóng băng lúc phát hành. KHÔNG tính lại, KHÔNG gọi
// thêm API: tờ phiếu gia đình đang cầm là bản này, nên màn của học viên phải nói đúng bản này.
//
// Mọi nhánh đều phòng thiếu dữ liệu: phiếu cũ có `schemaVersion` thấp hơn, mục tiêu giáo trình có
// thể null (lớp không dùng giáo trình), và điểm kỹ năng chưa nhập là `null` — hiển thị gạch ngang
// chứ KHÔNG phải 0 (0 điểm và "chưa có điểm" là hai chuyện khác nhau).
import { View } from 'react-native'
import { format } from 'date-fns'
import { Card, Caption, Pill, ThemedText } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import {
  attendanceRateText,
  gradeLabel,
  periodLabel,
  scoreText,
  skillLabel,
  statusText,
  type ReportIssueEntry,
} from '@/lib/reportIssuesApi'

const fmtDate = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'dd/MM/yyyy') : '—')

const PILL_TONE = { ok: 'success', muted: 'neutral', warn: 'danger' } as const

export function ReportIssueCard({ entry }: { entry: ReportIssueEntry }) {
  const theme = useTheme()
  const c = theme.colors
  const { issue, payload } = entry
  const status = statusText(issue.status)
  const skills = payload.skills ?? []
  const attendance = payload.attendance ?? null
  const assignments = payload.assignments ?? null
  const objectives = payload.objectives ?? null
  const selfStudy = payload.selfStudy ?? null
  const certificate = payload.certificate ?? null
  const rate = attendanceRateText(attendance)

  return (
    <Card padded bordered style={{ gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="titleLg">{periodLabel(issue.period)}</ThemedText>
          <ThemedText variant="caption" color="secondary">
            {[payload.class?.name ?? issue.className, payload.class?.level].filter(Boolean).join(' · ') || '—'}
          </ThemedText>
        </View>
        <Pill label={status.label} tone={PILL_TONE[status.tone]} />
      </View>

      <View style={{ gap: 2 }}>
        <ThemedText variant="caption" color="muted">
          Phát hành {fmtDate(issue.issuedAt)}
          {issue.issuedByName ? ` · ${issue.issuedByName}` : ''}
        </ThemedText>
        {payload.class?.primaryTeacherName ? (
          <ThemedText variant="caption" color="muted">
            Giáo viên phụ trách: {payload.class.primaryTeacherName}
          </ThemedText>
        ) : null}
      </View>

      {/* Bốn kỹ năng — thang 0–10, cùng thứ tự với bản in và trang web */}
      <View style={{ gap: space[2] }}>
        <Caption>Bốn kỹ năng</Caption>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {skills.map((s) => (
            <View
              key={s.code}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: space[3],
                borderRadius: radius.lg,
                backgroundColor: c.surfaceSunken,
              }}
            >
              <ThemedText variant="title">{scoreText(s.score)}</ThemedText>
              <ThemedText variant="caption" color="secondary">
                {skillLabel(s.code)}
              </ThemedText>
            </View>
          ))}
        </View>
        {payload.overall ? (
          <ThemedText variant="caption" color="secondary">
            Điểm tổng {scoreText(payload.overall.score)}
            {gradeLabel(payload.overall.grade) ? ` · ${gradeLabel(payload.overall.grade)}` : ''}
          </ThemedText>
        ) : null}
      </View>

      {attendance ? (
        <View style={{ gap: space[1] }}>
          <Caption>Chuyên cần</Caption>
          <ThemedText variant="body">
            Có mặt {attendance.present ?? 0} · Vắng {attendance.absent ?? 0} · Đi muộn {attendance.late ?? 0}
            {rate ? ` · Tỉ lệ ${rate}` : ''}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            Tính trên {attendance.recorded ?? 0} buổi đã ghi nhận. Buổi chưa điểm danh không tính là vắng.
          </ThemedText>
        </View>
      ) : null}

      {assignments ? (
        <View style={{ gap: space[1] }}>
          <Caption>Bài tập</Caption>
          <ThemedText variant="body">
            {assignments.avgScore === null || assignments.avgScore === undefined
              ? 'Chưa có bài nào được giáo viên chốt điểm'
              : `Điểm trung bình các bài đã chốt: ${assignments.avgScore}`}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            Đã chốt {assignments.confirmed ?? 0} bài · đang chờ chấm {assignments.awaitingTeacher ?? 0} bài
          </ThemedText>
        </View>
      ) : null}

      {objectives ? (
        <View style={{ gap: space[1] }}>
          <Caption>Mục tiêu giáo trình</Caption>
          <ThemedText variant="body">
            Đã đạt {objectives.achieved ?? 0}/{objectives.total ?? 0} · cần luyện thêm{' '}
            {objectives.needsPractice ?? 0} · chưa đánh giá {objectives.notAssessed ?? 0}
          </ThemedText>
          {objectives.needsPracticeItems?.length ? (
            <ThemedText variant="caption" color="secondary">
              Cần luyện thêm: {objectives.needsPracticeItems.join(' · ')}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {selfStudy ? (
        <View style={{ gap: space[1] }}>
          <Caption>Tự học ngoài lớp</Caption>
          <ThemedText variant="caption" color="secondary">
            {selfStudy.speakingSessions ?? 0} phiên luyện nói ({selfStudy.speakingMinutes ?? 0} phút) ·{' '}
            {selfStudy.vocabMastered ?? 0} thẻ từ đã thuộc · {selfStudy.lessonsCompleted ?? 0} bài tự học
          </ThemedText>
        </View>
      ) : null}

      <View style={{ gap: space[1] }}>
        <Caption>Nhận xét của giáo viên</Caption>
        <ThemedText variant="body" color={payload.teacherComment ? 'primary' : 'muted'}>
          {payload.teacherComment ?? 'Giáo viên chưa ghi nhận xét cho kỳ này.'}
        </ThemedText>
      </View>

      {certificate ? (
        <View
          style={{
            gap: space[1],
            padding: space[3],
            borderRadius: radius.lg,
            backgroundColor: certificate.eligible ? c.successSoft : c.surfaceSunken,
          }}
        >
          <Caption>Điều kiện chứng nhận</Caption>
          <ThemedText variant="bodyStrong" color={certificate.eligible ? 'success' : 'secondary'}>
            {certificate.eligible
              ? 'Đã đạt điều kiện xét cấp chứng nhận hoàn thành.'
              : 'Chưa đạt điều kiện xét cấp chứng nhận hoàn thành.'}
          </ThemedText>
          <ThemedText variant="caption" color="muted">
            Điều kiện của trung tâm: điểm trung bình từ {certificate.minAvgScore ?? '—'} và chuyên cần từ{' '}
            {certificate.minAttendancePct ?? '—'}%.
          </ThemedText>
        </View>
      ) : null}

      <View style={{ gap: 2 }}>
        {issue.verificationCode ? (
          <ThemedText variant="caption" color="muted">
            Mã phiếu {issue.verificationCode}
          </ThemedText>
        ) : null}
        {issue.status === 'ACTIVE' && issue.tokenExpiresAt ? (
          <ThemedText variant="caption" color="muted">
            Link gia đình xem được đến {fmtDate(issue.tokenExpiresAt)}
          </ThemedText>
        ) : null}
        {issue.status === 'REVOKED' && issue.revokedAt ? (
          <ThemedText variant="caption" color="muted">
            Thu hồi ngày {fmtDate(issue.revokedAt)} — link không còn mở được.
          </ThemedText>
        ) : null}
      </View>
    </Card>
  )
}
