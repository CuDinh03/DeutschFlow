// Một phiếu đánh giá đã gửi gia đình, phía học viên (R6/PR-R4).
//
// Toàn bộ số liệu đọc từ `payload` — ảnh chụp đóng băng lúc phát hành. KHÔNG tính lại, KHÔNG gọi
// thêm API: tờ phiếu gia đình đang cầm là bản này, nên màn của học viên phải nói đúng bản này.
//
// Mọi nhánh đều phòng thiếu dữ liệu: phiếu cũ có `schemaVersion` thấp hơn, mục tiêu giáo trình có
// thể null (lớp không dùng giáo trình), và điểm kỹ năng chưa nhập là `null` — hiển thị gạch ngang
// chứ KHÔNG phải 0 (0 điểm và "chưa có điểm" là hai chuyện khác nhau).
//
// Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `reports`): thẻ bo lớn, đầu thẻ kỳ + giáo viên, bốn kỹ năng
// thành hàng nhãn viên thuốc, các mục phụ dưới nhãn nhỏ viết hoa.
import { View } from 'react-native'
import { format } from 'date-fns'
import { ThemedText } from '@/components/ui'
import { Badge, Eyebrow } from '@/components/me/MeParts'
import { radius, space, themeShadowStyle, useTheme } from '@/lib/theme'
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

const BADGE_TONE = { ok: 'success', muted: 'neutral', warn: 'danger' } as const

/** Xếp loại tốt (Giỏi, Xuất sắc) tô xanh như mẫu; còn lại nền xám. */
const GOOD_GRADES = new Set(['GOOD', 'EXCELLENT'])

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
  const teacher = payload.class?.primaryTeacherName ?? null
  const hasFooter =
    !!issue.verificationCode ||
    (issue.status === 'ACTIVE' && !!issue.tokenExpiresAt) ||
    (issue.status === 'REVOKED' && !!issue.revokedAt)

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.xl,
        padding: space[4],
        gap: space[4],
        ...themeShadowStyle(theme.shadow.card),
      }}
    >
      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[3] }}>
          <ThemedText variant="bodyStrong" style={{ flex: 1 }} accessibilityRole="header">
            {periodLabel(issue.period)}
          </ThemedText>
          {teacher ? (
            <ThemedText variant="caption" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {teacher}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText variant="caption" color="secondary">
          {[payload.class?.name ?? issue.className, payload.class?.level].filter(Boolean).join(' · ') || '—'}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          Phát hành {fmtDate(issue.issuedAt)}
          {issue.issuedByName ? ` · ${issue.issuedByName}` : ''}
        </ThemedText>
        <View style={{ marginTop: space[1] }}>
          <Badge label={status.label} tone={BADGE_TONE[status.tone]} />
        </View>
      </View>

      {/* Bốn kỹ năng — thang 0–10, cùng thứ tự với bản in và trang web */}
      <View style={{ gap: space[2] }}>
        <Eyebrow>Bốn kỹ năng</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] + 2 }}>
          {skills.map((s) => {
            const grade = gradeLabel(s.grade)
            return (
              <Badge
                key={s.code}
                label={`${skillLabel(s.code)} · ${scoreText(s.score)}${grade ? ` · ${grade}` : ''}`}
                tone={s.grade && GOOD_GRADES.has(s.grade) ? 'success' : 'neutral'}
              />
            )
          })}
        </View>
        {payload.overall ? (
          <ThemedText variant="caption" color="secondary">
            Điểm tổng {scoreText(payload.overall.score)}
            {gradeLabel(payload.overall.grade) ? ` · ${gradeLabel(payload.overall.grade)}` : ''}
          </ThemedText>
        ) : null}
      </View>

      <View style={{ gap: space[1] }}>
        <Eyebrow>Nhận xét của giáo viên</Eyebrow>
        <ThemedText variant="body" color={payload.teacherComment ? 'primary' : 'muted'}>
          {payload.teacherComment ?? 'Giáo viên chưa ghi nhận xét cho kỳ này.'}
        </ThemedText>
      </View>

      {attendance ? (
        <View style={{ gap: space[1] }}>
          <Eyebrow>Chuyên cần</Eyebrow>
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
          <Eyebrow>Bài tập</Eyebrow>
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
          <Eyebrow>Mục tiêu giáo trình</Eyebrow>
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
          <Eyebrow>Tự học ngoài lớp</Eyebrow>
          <ThemedText variant="caption" color="secondary">
            {selfStudy.speakingSessions ?? 0} phiên luyện nói ({selfStudy.speakingMinutes ?? 0} phút) ·{' '}
            {selfStudy.vocabMastered ?? 0} thẻ từ đã thuộc · {selfStudy.lessonsCompleted ?? 0} bài tự học
          </ThemedText>
        </View>
      ) : null}

      {certificate ? (
        <View
          style={{
            gap: space[1],
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: certificate.eligible ? c.successSoft : c.surfaceSunken,
          }}
        >
          <Eyebrow>Điều kiện chứng nhận</Eyebrow>
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

      {hasFooter ? (
      <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[3] }}>
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
      ) : null}
    </View>
  )
}
