import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useQueries, useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Upload } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import {
  assignmentRowKey, assignmentStatusView, fetchClassAssignments, fetchClassDetail, fetchClassLessons,
  fetchMyAttendance, fetchMySkillReport, isFinalGrade, GRADING_FAILED_LABEL,
  type ClassLesson, type ClassroomDetail, type MySkillReport, type StudentAssignment,
  type StudentAttendance, type TeacherSummary,
} from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, EmptyState, ErrorState, Icon, IconButton, Pill, ProgressBar,
  Screen, SectionHeader, Skeleton, ThemedText, YellowSquare,
GaGlyph } from '@/components/ui'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

type Tab = 'assignments' | 'grades' | 'teachers' | 'progress' | 'evaluation'

export default function StudentClassDetail() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['classes/[id]'])
  const { id } = useLocalSearchParams<{ id: string }>()
  const classId = Number(id)

  const [tab, setTab] = useState<Tab>('assignments')

  const [detailQ, assignmentsQ, lessonsQ] = useQueries({
    queries: [
      { queryKey: ['class-detail', classId], queryFn: () => fetchClassDetail(classId), enabled: Number.isFinite(classId), staleTime: 30_000 },
      { queryKey: ['class-assignments', classId], queryFn: () => fetchClassAssignments(classId), enabled: Number.isFinite(classId), staleTime: 30_000 },
      { queryKey: ['class-lessons', classId], queryFn: () => fetchClassLessons(classId), enabled: Number.isFinite(classId), staleTime: 30_000 },
    ],
  })

  const pull = usePullRefresh(async () => {
    await Promise.all([detailQ.refetch(), assignmentsQ.refetch(), lessonsQ.refetch()])
  })

  if (detailQ.isLoading) {
    return (
      <Screen>
        <AppHeader title="Đang tải lớp…" onBack={goBack} />
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      </Screen>
    )
  }
  if (detailQ.error || !detailQ.data) {
    return (
      <Screen>
        <AppHeader title="Không mở được lớp" onBack={goBack} />
        <ErrorState
          message={detailQ.error ? apiMessage(detailQ.error) : 'Không tìm thấy lớp.'}
          onRetry={() => void detailQ.refetch()}
        />
      </Screen>
    )
  }

  const detail = detailQ.data
  const assignments = assignmentsQ.data ?? []
  const lessons = lessonsQ.data ?? []

  return (
    <Screen>
      <AppHeader
        title={detail.name}
        subtitle={`${detail.studentCount} học viên · ${detail.assignmentCount} bài tập`}
        onBack={goBack}
        right={
          <IconButton
            glyph="hoithoai"
            accessibilityLabel="Chat lớp"
            onPress={() =>
              router.push({
                pathname: '/(student)/class-chat/[classId]',
                params: { classId: String(classId), className: detail.name },
              })
            }
          />
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingBottom: space[8],
          gap: space[4],
        }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
      >
        <HeaderCard detail={detail} />
        <ProgressStrip detail={detail} />
        <Button
          label="Xem lịch buổi học"
          variant="secondary"
          glyph="lich"
          onPress={() =>
            router.push({
              pathname: '/(student)/class-schedule/[classId]',
              params: { classId: String(classId), className: detail.name },
            })
          }
        />
        <TabBar tab={tab} setTab={setTab} />
        {tab === 'assignments' && (
          <AssignmentsTab classId={id}
            assignments={assignments}
            isError={assignmentsQ.isError}
            onRetry={() => void assignmentsQ.refetch()}
          />
        )}
        {tab === 'grades' && (
          <GradesTab
            assignments={assignments}
            isError={assignmentsQ.isError}
            onRetry={() => void assignmentsQ.refetch()}
          />
        )}
        {tab === 'teachers' && <TeachersTab teachers={detail.teachers} />}
        {tab === 'evaluation' && <EvaluationTab classId={classId} />}
        {tab === 'progress' && (
          <ProgressTab
            detail={detail}
            lessons={lessons}
            isError={lessonsQ.isError}
            onRetry={() => void lessonsQ.refetch()}
          />
        )}
      </ScrollView>
    </Screen>
  )
}

// Editorial ink hero — the "who teaches this class" primary fact.
//
// V-04: KHÔNG hiện mã mời lớp và KHÔNG có nút Chia sẻ ở màn HỌC VIÊN. Mã mời là chìa khoá vào một
// GHẾ của trung tâm (mỗi lượt chia sẻ = một ghế người lạ có thể chiếm), mà học viên không phải
// người có quyền mời. Backend cũng đã ngừng trả `inviteCode` cho lớp thuộc trung tâm — đây là lớp
// chặn thứ hai, và đường giáo viên xem/chia sẻ mã lớp của mình không đi qua màn này.
function HeaderCard({ detail }: { detail: ClassroomDetail }) {
  const theme = useTheme()
  const c = theme.colors
  return (
    <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <YellowSquare size={8} />
          <Caption color={c.accent}>Dạy bởi</Caption>
        </View>
        <ThemedText variant="titleLg" style={{ color: c.onInk }}>
          {detail.teachers.length > 0
            ? detail.teachers.map((t) => t.displayName).join(', ')
            : 'Chưa có giáo viên'}
        </ThemedText>
      </View>
    </Card>
  )
}

function ProgressStrip({ detail }: { detail: ClassroomDetail }) {
  const lessonPercent = detail.lessonTotal > 0
    ? detail.lessonCompleted / detail.lessonTotal : 0
  const assignPercent = detail.assignmentCount > 0
    ? detail.gradedCount / detail.assignmentCount : 0
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      <ProgressCard
        label="Tiến độ lớp"
        value={detail.lessonTotal > 0 ? `${detail.lessonCompleted}/${detail.lessonTotal}` : '–'}
        sub={detail.currentLessonTitle ?? 'Chưa có buổi học'}
        percent={lessonPercent}
        accent="accent"
      />
      <ProgressCard
        label="Bài tập"
        value={detail.assignmentCount > 0 ? `${detail.gradedCount}/${detail.assignmentCount}` : '–'}
        sub={`${detail.pendingCount} chưa nộp`}
        percent={assignPercent}
        accent="success"
      />
      <ProgressCard
        label="Điểm TB"
        value={detail.avgScore != null ? detail.avgScore.toFixed(1) : '–'}
        sub={detail.avgScore != null ? 'Đã chấm' : 'Chưa có điểm'}
        accent="info"
      />
    </View>
  )
}

function ProgressCard({
  label, value, sub, percent, accent,
}: {
  label: string; value: string; sub: string; percent?: number
  accent: 'accent' | 'success' | 'info'
}) {
  const theme = useTheme()
  const c = theme.colors
  const fill = accent === 'success' ? c.success : accent === 'info' ? c.info : c.accent
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ gap: space[1] }}>
        <Caption>{label}</Caption>
        <ThemedText variant="title">{value}</ThemedText>
        <ThemedText variant="caption" color="muted" numberOfLines={1}>
          {sub}
        </ThemedText>
        {typeof percent === 'number' && (
          <View style={{ marginTop: space[1] }}>
            <ProgressBar value={percent} height={4} fillColor={fill} />
          </View>
        )}
      </View>
    </Card>
  )
}

// Sharp editorial segmented control — UPPERCASE labels, active segment lifts to
// the surface layer with a yellow underline mark.
function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const theme = useTheme()
  const c = theme.colors
  const tabs: { key: Tab; label: string }[] = [
    { key: 'assignments', label: 'Bài tập' },
    { key: 'grades', label: 'Điểm' },
    { key: 'evaluation', label: 'Đánh giá' },
    { key: 'teachers', label: 'Giáo viên' },
    { key: 'progress', label: 'Tiến độ' },
  ]
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surfaceSunken,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c.border,
        padding: 4,
        gap: 4,
      }}
    >
      {tabs.map((t) => {
        const active = t.key === tab
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => setTab(t.key)}
            style={{
              flex: 1,
              paddingVertical: space[2],
              backgroundColor: active ? c.surface : 'transparent',
              borderRadius: radius.sm,
              borderWidth: active ? 1 : 0,
              borderColor: c.border,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Caption color={active ? c.textPrimary : c.textMuted}>{t.label}</Caption>
            {active ? <YellowSquare size={5} /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

function AssignmentsTab({
  assignments, isError, onRetry, classId,
}: { assignments: StudentAssignment[]; isError: boolean; onRetry: () => void; classId: string }) {
  if (assignments.length === 0 && isError) {
    return (
      <ErrorState
        title="Không tải được bài tập"
        message="Không thể tải danh sách bài tập của lớp. Vui lòng thử lại."
        onRetry={onRetry}
      />
    )
  }
  if (assignments.length === 0) {
    return (
      <EmptyState glyph="baigiao" title="Chưa có bài tập" message="Lớp này chưa có bài tập nào." />
    )
  }
  return (
    <View style={{ gap: space[4] }}>
      <SectionHeader title="Bài tập của lớp" />
      <View style={{ gap: space[2] }}>
        {assignments.map((a) => (
          <Card
            // V-12c: KHÔNG dùng a.id — backend trả id = null cho bài chưa bắt đầu (xem assignmentRowKey).
            key={assignmentRowKey(a)}
            onPress={() => router.push({ pathname: '/(student)/assignments/[id]', params: { id: String(a.assignmentId), classId } })}
            accessibilityLabel={`Mở bài tập ${a.topic || 'bài tập'}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <View style={{ flex: 1, gap: space[1] }}>
                <Caption>Bài tập</Caption>
                <ThemedText variant="title" numberOfLines={1}>
                  {a.topic || 'Bài tập'}
                </ThemedText>
                {a.dueDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[1] }}>
                    <GaGlyph name="thoigian" size={11} ink="muted" />
                    <ThemedText variant="caption" color="muted">
                      Hạn {new Date(a.dueDate).toLocaleString('vi-VN')}
                    </ThemedText>
                  </View>
                )}
              </View>
              <StatusPill status={a.status} score={a.teacherScore} />
            </View>
          </Card>
        ))}
      </View>
    </View>
  )
}

function StatusPill({ status, score }: { status: string; score: number | null }) {
  // Phân loại dùng CHUNG với màn chi tiết bài (assignmentStatusView) — cùng một bài không được
  // hiện hai câu chữ ở hai màn (V-12c).
  switch (assignmentStatusView(status)) {
    case 'graded':
      return <Pill tone="success" glyph="hoanthanh" label={`Đã chấm${score != null ? ` · ${score}` : ''}`} />
    case 'gradingFailed':
      // Đã nộp NHƯNG khâu chấm chết — học viên có quyền biết bài mình chưa được chấm. Vẫn thuộc
      // nhóm isAwaitingTeacher nên quyền "Nộp bản khác" không đổi.
      return <Pill tone="danger" glyph="canhbao" label={GRADING_FAILED_LABEL} />
    case 'awaitingTeacher':
      // AI_GRADED = bài ĐÃ nộp, đang chờ giáo viên (F-14 soát 02/09) — trước đây rơi nhánh else và
      // hiện "Chưa nộp" đỏ cho bài học viên vừa nộp xong.
      return <Pill tone="info" icon={Upload} label="Đã nộp" />
    default:
      return <Pill tone="danger" glyph="canhbao" label="Chưa nộp" />
  }
}

function GradesTab({
  assignments, isError, onRetry,
}: { assignments: StudentAssignment[]; isError: boolean; onRetry: () => void }) {
  const theme = useTheme()
  const c = theme.colors
  const graded = useMemo(
    () => assignments.filter((a) => isFinalGrade(a.status)),
    [assignments],
  )
  if (assignments.length === 0 && isError) {
    return (
      <ErrorState
        title="Không tải được điểm"
        message="Không thể tải danh sách bài tập của lớp. Vui lòng thử lại."
        onRetry={onRetry}
      />
    )
  }
  if (graded.length === 0) {
    return <EmptyState glyph="dulieuai" title="Chưa có điểm" message="Chưa có bài nào được chấm." />
  }
  return (
    <View style={{ gap: space[4] }}>
      <SectionHeader title="Điểm đã chấm" />
      <View style={{ gap: space[2] }}>
        {graded.map((a) => {
          const tone = a.teacherScore == null
            ? 'accent'
            : a.teacherScore >= 8 ? 'success' : a.teacherScore >= 5 ? 'accent' : 'danger'
          const figColor = a.teacherScore == null
            ? c.textPrimary
            : a.teacherScore >= 8 ? c.success : a.teacherScore >= 5 ? c.accentText : c.danger
          return (
            <Card key={a.id}>
              <View style={{ gap: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] }}>
                  <View style={{ flex: 1, gap: space[1] }}>
                    <Caption>Bài tập</Caption>
                    <ThemedText variant="title" numberOfLines={1}>
                      {a.topic || 'Bài tập'}
                    </ThemedText>
                  </View>
                  {a.teacherScore != null && (
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <ThemedText variant="displayLg" style={{ color: figColor }}>
                        {String(a.teacherScore)}
                      </ThemedText>
                      <Pill tone={tone} label="Điểm" />
                    </View>
                  )}
                </View>
                {a.teacherFeedback && (
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                      paddingTop: space[2],
                    }}
                  >
                    <Caption>Nhận xét</Caption>
                    <ThemedText variant="caption" color="secondary" style={{ marginTop: space[1] }}>
                      {a.teacherFeedback}
                    </ThemedText>
                  </View>
                )}
              </View>
            </Card>
          )
        })}
      </View>
    </View>
  )
}

// P4: the student's own evaluation — 4-skill report + attendance history (own data only).
function EvaluationTab({ classId }: { classId: number }) {
  const reportQ = useQuery({
    queryKey: ['my-skill-report', classId],
    queryFn: () => fetchMySkillReport(classId),
    enabled: Number.isFinite(classId),
    staleTime: 30_000,
  })
  const attendanceQ = useQuery({
    queryKey: ['my-attendance', classId],
    queryFn: () => fetchMyAttendance(classId),
    enabled: Number.isFinite(classId),
    staleTime: 30_000,
  })

  if (reportQ.isLoading && attendanceQ.isLoading) {
    return (
      <View style={{ gap: space[3] }}>
        <Skeleton height={168} />
        <Skeleton height={120} />
      </View>
    )
  }
  if (reportQ.isError && attendanceQ.isError) {
    return (
      <ErrorState
        title="Không tải được đánh giá"
        message="Không thể tải bảng điểm và điểm danh. Vui lòng thử lại."
        onRetry={() => {
          void reportQ.refetch()
          void attendanceQ.refetch()
        }}
      />
    )
  }

  const report = reportQ.data
  const attendance = attendanceQ.data ?? []

  return (
    <View style={{ gap: space[5] }}>
      <View style={{ gap: space[3] }}>
        <SectionHeader title="Bảng điểm 4 kỹ năng" />
        {reportQ.isError ? (
          <ErrorState title="Không tải được bảng điểm" onRetry={() => void reportQ.refetch()} />
        ) : report && hasAnySkill(report) ? (
          <SkillReportCard report={report} />
        ) : (
          <EmptyState
            glyph="thongke"
            title="Chưa có điểm kỹ năng"
            message="Giáo viên chưa chấm điểm 4 kỹ năng cho bạn."
          />
        )}
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Nhận xét của giáo viên" />
        {report?.teacherComment ? (
          <TeacherCommentCard comment={report.teacherComment} evaluatedAt={report.evaluatedAt} />
        ) : (
          <EmptyState
            glyph="hoithoai"
            title="Chưa có nhận xét"
            message="Giáo viên chưa viết nhận xét cho bạn. Nhận xét sẽ hiện ở đây khi có."
          />
        )}
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Điểm danh" />
        {attendanceQ.isError ? (
          <ErrorState title="Không tải được điểm danh" onRetry={() => void attendanceQ.refetch()} />
        ) : attendance.length === 0 ? (
          <EmptyState
            glyph="lich"
            title="Chưa có buổi học"
            message="Lớp chưa có buổi học nào được ghi nhận."
          />
        ) : (
          <>
            <AttendanceSummary rows={attendance} />
            <View style={{ gap: space[2] }}>
              {attendance.map((a) => (
                <AttendanceRow key={a.lessonLogId} row={a} />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const SKILLS: { key: 'horen' | 'lesen' | 'schreiben' | 'sprechen'; label: string }[] = [
  { key: 'horen', label: 'Nghe' },
  { key: 'lesen', label: 'Đọc' },
  { key: 'schreiben', label: 'Viết' },
  { key: 'sprechen', label: 'Nói' },
]

function hasAnySkill(r: MySkillReport): boolean {
  return r.horen != null || r.lesen != null || r.schreiben != null || r.sprechen != null
}

function gradeTone(total: number | null): 'success' | 'accent' | 'danger' | 'neutral' {
  if (total == null) return 'neutral'
  if (total >= 8) return 'success'
  if (total >= 5) return 'accent'
  return 'danger'
}

function SkillReportCard({ report }: { report: MySkillReport }) {
  return (
    <Card style={{ gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Caption>Tổng kết</Caption>
          <ThemedText variant="displayLg">
            {report.total != null ? report.total.toFixed(1) : '—'}
          </ThemedText>
        </View>
        <Pill tone={gradeTone(report.total)} label={report.grade} solid />
      </View>
      <View style={{ gap: space[3] }}>
        {SKILLS.map((s) => {
          const v = report[s.key]
          return (
            <View key={s.key} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText variant="caption" color="muted">{s.label}</ThemedText>
                <ThemedText variant="caption" color={v != null ? 'primary' : 'faint'}>
                  {v != null ? v.toFixed(1) : 'Chưa có'}
                </ThemedText>
              </View>
              <ProgressBar value={v != null ? Math.min(1, v / 10) : 0} height={5} />
            </View>
          )
        })}
      </View>
    </Card>
  )
}

/**
 * Nhận xét bằng lời của giáo viên. Trước đây `teacher_comment` chỉ đi ra DTO phía giáo viên: thầy cô
 * viết trong sổ điểm và không đường nào trả nó về cho chính học viên được nhận xét.
 */
function TeacherCommentCard({ comment, evaluatedAt }: { comment: string; evaluatedAt: string | null }) {
  const c = useTheme().colors
  return (
    <Card style={{ gap: space[2], borderLeftWidth: 3, borderLeftColor: c.accentText }}>
      <ThemedText variant="body" style={{ lineHeight: 22 }}>{comment}</ThemedText>
      {evaluatedAt ? (
        <Caption>Nhận xét ngày {new Date(evaluatedAt).toLocaleDateString('vi-VN')}</Caption>
      ) : null}
    </Card>
  )
}

function AttendanceSummary({ rows }: { rows: StudentAttendance[] }) {
  const present = rows.filter((r) => r.status === 'PRESENT').length
  const late = rows.filter((r) => r.status === 'LATE').length
  const absent = rows.filter((r) => r.status === 'ABSENT').length
  const marked = present + late + absent
  const rate = marked > 0 ? Math.round(((present + late) / marked) * 100) : null
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: space[5] }}>
          <SummaryStat label="Có mặt" value={present} tone="success" />
          <SummaryStat label="Muộn" value={late} tone="accent" />
          <SummaryStat label="Vắng" value={absent} tone="danger" />
        </View>
        {rate != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Caption>Chuyên cần</Caption>
            <ThemedText variant="title">{rate}%</ThemedText>
          </View>
        ) : null}
      </View>
    </Card>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'accent' | 'danger' }) {
  const c = useTheme().colors
  const col = tone === 'success' ? c.success : tone === 'danger' ? c.danger : c.accentText
  return (
    <View style={{ alignItems: 'center' }}>
      <ThemedText variant="title" style={{ color: col }}>{String(value)}</ThemedText>
      <Caption>{label}</Caption>
    </View>
  )
}

function attendanceStatus(status: StudentAttendance['status']) {
  switch (status) {
    case 'PRESENT':
      return { label: 'Có mặt', tone: 'success' as const, color: 'success' as const, glyph: 'hoanthanh' as const }
    case 'LATE':
      return { label: 'Muộn', tone: 'accent' as const, color: 'accent' as const, glyph: 'thoigian' as const }
    case 'ABSENT':
      return { label: 'Vắng', tone: 'danger' as const, color: 'danger' as const, glyph: 'canhbao' as const }
    default:
      return { label: 'Chưa điểm danh', tone: 'neutral' as const, color: 'muted' as const, glyph: 'danghoc' as const }
  }
}

function AttendanceRow({ row }: { row: StudentAttendance }) {
  const s = attendanceStatus(row.status)
  const date = new Date(row.sessionDate)
  const dateLabel = Number.isNaN(date.getTime()) ? row.sessionDate : date.toLocaleDateString('vi-VN')
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <GaGlyph name={s.glyph} size={18} ink={s.color} gold={s.color === 'muted' ? 'accent' : s.color} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {row.topic || (row.sessionNumber != null ? `Buổi ${row.sessionNumber}` : 'Buổi học')}
          </ThemedText>
          <ThemedText variant="caption" color="muted" numberOfLines={1}>
            {dateLabel}
            {row.note ? ` · ${row.note}` : ''}
          </ThemedText>
        </View>
        <Pill tone={s.tone} label={s.label} />
      </View>
    </Card>
  )
}

function TeachersTab({ teachers }: { teachers: TeacherSummary[] }) {
  const theme = useTheme()
  if (teachers.length === 0) {
    return <EmptyState glyph="lophoc" title="Chưa có giáo viên" message="Lớp này chưa có giáo viên nào." />
  }
  return (
    <View style={{ gap: space[4] }}>
      <SectionHeader title="Giáo viên phụ trách" />
      <View style={{ gap: space[2] }}>
        {teachers.map((t) => (
          <Card key={t.id}>
            <View style={{ gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.sm,
                    backgroundColor: theme.colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GaGlyph name="t_exam" size={20} ink="primary" />
                </View>
                <View style={{ flex: 1, gap: space[1] }}>
                  <ThemedText variant="bodyStrong" numberOfLines={1}>
                    {t.displayName}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted" numberOfLines={1}>
                    {t.email}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', marginTop: space[1] }}>
                    <Pill tone="accent" label={t.role} />
                  </View>
                </View>
              </View>
              <Button
                label="Nhắn tin"
                glyph="hoithoai"
                variant="secondary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: '/(student)/messages/[userId]',
                    params: { userId: String(t.id), name: t.displayName },
                  })
                }
              />
            </View>
          </Card>
        ))}
      </View>
    </View>
  )
}

function ProgressTab({
  detail, lessons, isError, onRetry,
}: { detail: ClassroomDetail; lessons: ClassLesson[]; isError: boolean; onRetry: () => void }) {
  const theme = useTheme()
  const c = theme.colors
  return (
    <View style={{ gap: space[4] }}>
      {lessons.length === 0 && isError ? (
        <ErrorState
          title="Không tải được tiến độ"
          message="Không thể tải danh sách buổi học của lớp. Vui lòng thử lại."
          onRetry={onRetry}
        />
      ) : lessons.length === 0 ? (
        <EmptyState
          glyph="baigiao"
          title="Chưa có checklist"
          message="Giáo viên chưa tạo danh sách buổi học. Tiến độ lớp sẽ hiển thị tại đây khi có."
        />
      ) : (
        <>
          {detail.currentLessonTitle && (
            <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
              <View style={{ gap: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <YellowSquare size={8} />
                  <Caption color={c.accent}>Buổi hiện tại của lớp</Caption>
                </View>
                <ThemedText variant="title" style={{ color: c.onInk }}>
                  {detail.currentLessonTitle}
                </ThemedText>
              </View>
            </Card>
          )}
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Lộ trình buổi học" />
            <View style={{ gap: space[2] }}>
              {lessons.map((l, idx) => (
                <LessonRow key={l.id} lesson={l} index={idx} />
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  )
}

function LessonRow({ lesson, index }: { lesson: ClassLesson; index: number }) {
  return (
    <Card tone={lesson.completed ? 'sunken' : 'surface'}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <GaGlyph
          name={lesson.completed ? 'hoanthanh' : 'danghoc'}
          size={20}
          ink={lesson.completed ? 'onAccent' : 'muted'}
          gold={lesson.completed ? 'success' : 'accent'}
        />
        <View style={{ flex: 1, gap: space[1] }}>
          <Caption>Buổi {index + 1}</Caption>
          <ThemedText variant="bodyStrong" numberOfLines={2}>
            {lesson.title}
          </ThemedText>
          {lesson.description ? (
            <ThemedText variant="caption" color="muted">
              {lesson.description}
            </ThemedText>
          ) : null}
          {lesson.completed && lesson.completedAt ? (
            <ThemedText variant="caption" color="success">
              Đã hoàn thành {new Date(lesson.completedAt).toLocaleString('vi-VN')}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Card>
  )
}
