import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useQueries, useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { apiMessage } from '@/lib/api'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import {
  assignmentRowKey, assignmentStatusView, fetchClassAssignments, fetchClassDetail, fetchClassLessons,
  fetchMyAttendance, fetchMySkillReport, isFinalGrade, GRADING_FAILED_LABEL, teacherRoleLabel,
  type ClassLesson, type ClassroomDetail, type MySkillReport, type StudentAssignment,
  type StudentAttendance, type TeacherSummary,
} from '@/lib/studentClassesApi'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import {
  Button, Card, EmptyState, ErrorState, GaGlyph, GaGlyphTile, Screen, Skeleton, ThemedText,
} from '@/components/ui'
import {
  Chip, HeaderGlyphButton, InitialAvatar, ListBlock, StatTriplet, StatusBadge, TopBar, listRowStyle,
  type BadgeTone,
} from '@/components/classroom/ClassroomParts'
import {
  assignmentTypeGlyph, assignmentTypeLabel, formatAvgVi, nameInitial, percentLabel, sessionDayBox, shortDate,
} from '@/lib/classroomUi'
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
        <TopBar title="Đang tải lớp…" onBack={goBack} />
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[4] }}>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={180} radius="lg" />
        </View>
      </Screen>
    )
  }
  if (detailQ.error || !detailQ.data) {
    return (
      <Screen>
        <TopBar title="Không mở được lớp" onBack={goBack} />
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

  // Giao diện v3.4 (Đợt 6B, mẫu `classd`): thanh đầu có nút Chat lớp + Lịch buổi học, tên lớp,
  // dòng "Dạy bởi", bộ ba số liệu, hàng chip chọn mục, rồi nội dung từng mục.
  return (
    <Screen>
      <TopBar
        onBack={goBack}
        right={
          <>
            <HeaderGlyphButton
              glyph="tinnhan"
              accessibilityLabel="Chat lớp"
              onPress={() =>
                router.push({
                  pathname: '/(student)/class-chat/[classId]',
                  params: { classId: String(classId), className: detail.name },
                })
              }
            />
            <HeaderGlyphButton
              glyph="lich"
              accessibilityLabel="Xem lịch buổi học"
              onPress={() =>
                router.push({
                  pathname: '/(student)/class-schedule/[classId]',
                  params: { classId: String(classId), className: detail.name },
                })
              }
            />
          </>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: space[4],
          paddingBottom: space[8],
          gap: space[4],
        }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
      >
        <View style={{ gap: space[1] }}>
          <ThemedText variant="titleLg" accessibilityRole="header">{detail.name}</ThemedText>
          <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>
            {`${detail.studentCount} học viên · ${detail.assignmentCount} bài tập`}
          </ThemedText>
        </View>
        <TaughtBy detail={detail} />
        <ClassStats detail={detail} />
        <TabRail tab={tab} setTab={setTab} />
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

// "Dạy bởi" — ai dạy lớp này, ô tròn chữ cái đầu nền mực. Lớp đúng MỘT giáo viên thì có chip
// "Nhắn tin" mở thẳng hội thoại (cùng đường với tab Giáo viên); nhiều giáo viên thì chọn ở tab đó.
//
// V-04: KHÔNG hiện mã mời lớp và KHÔNG có nút Chia sẻ ở màn HỌC VIÊN. Mã mời là chìa khoá vào một
// GHẾ của trung tâm (mỗi lượt chia sẻ = một ghế người lạ có thể chiếm), mà học viên không phải
// người có quyền mời. Backend cũng đã ngừng trả `inviteCode` cho lớp thuộc trung tâm — đây là lớp
// chặn thứ hai, và đường giáo viên xem/chia sẻ mã lớp của mình không đi qua màn này.
function TaughtBy({ detail }: { detail: ClassroomDetail }) {
  const names = detail.teachers.length > 0
    ? detail.teachers.map((t) => t.displayName).join(', ')
    : 'Chưa có giáo viên'
  const only = detail.teachers.length === 1 ? detail.teachers[0] : null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <InitialAvatar initial={nameInitial(detail.teachers[0]?.displayName)} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText variant="caption" color="muted" style={{ fontSize: 13 }}>Dạy bởi</ThemedText>
        <ThemedText variant="bodyStrong" numberOfLines={2}>{names}</ThemedText>
      </View>
      {only ? (
        <Chip
          label="Nhắn tin"
          accessibilityLabel={`Nhắn tin cho ${only.displayName}`}
          onPress={() =>
            router.push({
              pathname: '/(student)/messages/[userId]',
              params: { userId: String(only.id), name: only.displayName },
            })
          }
        />
      ) : null}
    </View>
  )
}

function ClassStats({ detail }: { detail: ClassroomDetail }) {
  const c = useTheme().colors
  const notes = [
    detail.currentLessonTitle ? `Buổi hiện tại: ${detail.currentLessonTitle}` : null,
    detail.pendingCount > 0 ? `${detail.pendingCount} bài chưa nộp` : null,
  ].filter(Boolean).join(' · ')
  return (
    <View style={{ gap: space[2], borderTopWidth: 1, borderTopColor: c.border }}>
      <StatTriplet
        style={{ paddingTop: space[3] }}
        cells={[
          { value: percentLabel(detail.lessonCompleted, detail.lessonTotal), label: 'Tiến độ lớp' },
          { value: detail.assignmentCount > 0 ? `${detail.gradedCount}/${detail.assignmentCount}` : '–', label: 'Bài đã chấm' },
          { value: formatAvgVi(detail.avgScore), label: 'Điểm TB' },
        ]}
      />
      {notes ? (
        <ThemedText variant="caption" color="muted" numberOfLines={2}>{notes}</ThemedText>
      ) : null}
    </View>
  )
}

// Hàng chip chọn mục (`.rail` + `.chip.on`): cuộn ngang, chip đang chọn nền mực.
function TabRail({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'assignments', label: 'Bài tập' },
    { key: 'grades', label: 'Điểm' },
    { key: 'evaluation', label: 'Đánh giá' },
    { key: 'teachers', label: 'Giáo viên' },
    { key: 'progress', label: 'Tiến độ' },
  ]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ marginHorizontal: -space[5] }}
      contentContainerStyle={{ paddingHorizontal: space[5], gap: space[2], paddingVertical: space[1] }}
    >
      {tabs.map((t) => (
        <Chip key={t.key} label={t.label} selectable on={t.key === tab} onPress={() => setTab(t.key)} />
      ))}
    </ScrollView>
  )
}

function AssignmentsTab({
  assignments, isError, onRetry, classId,
}: { assignments: StudentAssignment[]; isError: boolean; onRetry: () => void; classId: string }) {
  const c = useTheme().colors
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
    <ListBlock>
      {assignments.map((a, i) => {
        const due = shortDate(a.dueDate)
        const badge = statusBadge(a.status, a.teacherScore)
        const title = a.topic || 'Bài tập'
        return (
          <Pressable
            // V-12c: KHÔNG dùng a.id — backend trả id = null cho bài chưa bắt đầu (xem assignmentRowKey).
            key={assignmentRowKey(a)}
            onPress={() => router.push({ pathname: '/(student)/assignments/[id]', params: { id: String(a.assignmentId), classId } })}
            accessibilityRole="button"
            accessibilityLabel={`Mở bài tập ${title}, ${badge.a11y}`}
            style={({ pressed }) => listRowStyle(c.border, i === 0, { backgroundColor: pressed ? c.surfaceSunken : 'transparent' })}
          >
            <GaGlyphTile name={assignmentTypeGlyph(a.assignmentType)} tone="neutral" size={36} glyphSize={20} radius={radius.sm} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText variant="bodyStrong" numberOfLines={1}>{title}</ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                {`${assignmentTypeLabel(a.assignmentType)}${due ? ` · hạn ${due}` : ''}`}
              </ThemedText>
            </View>
            <StatusBadge label={badge.label} tone={badge.tone} />
          </Pressable>
        )
      })}
    </ListBlock>
  )
}

function statusBadge(status: string, score: number | null): { label: string; tone: BadgeTone; a11y: string } {
  // Phân loại dùng CHUNG với màn chi tiết bài (assignmentStatusView) — cùng một bài không được
  // hiện hai câu chữ ở hai màn (V-12c).
  switch (assignmentStatusView(status)) {
    case 'graded':
      return score != null
        ? { label: String(score), tone: 'success', a11y: `đã chấm, điểm ${score}` }
        : { label: 'Đã chấm', tone: 'success', a11y: 'đã chấm' }
    case 'gradingFailed':
      // Đã nộp NHƯNG khâu chấm chết — học viên có quyền biết bài mình chưa được chấm. Vẫn thuộc
      // nhóm isAwaitingTeacher nên quyền "Nộp bản khác" không đổi.
      return { label: GRADING_FAILED_LABEL, tone: 'danger', a11y: GRADING_FAILED_LABEL }
    case 'awaitingTeacher':
      // AI_GRADED = bài ĐÃ nộp, đang chờ giáo viên (F-14 soát 02/09) — trước đây rơi nhánh else và
      // hiện "Chưa nộp" đỏ cho bài học viên vừa nộp xong.
      return { label: 'Đã nộp', tone: 'info', a11y: 'đã nộp' }
    default:
      return { label: 'Chưa nộp', tone: 'danger', a11y: 'chưa nộp' }
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
    <ListBlock>
      {graded.map((a, i) => {
        const figColor = a.teacherScore == null
          ? c.textPrimary
          : a.teacherScore >= 8 ? c.success : a.teacherScore >= 5 ? c.accentText : c.danger
        return (
          <View key={a.id} style={listRowStyle(c.border, i === 0, { alignItems: 'flex-start', paddingVertical: space[3] })}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <ThemedText variant="bodyStrong" numberOfLines={2}>{a.topic || 'Bài tập'}</ThemedText>
              {a.teacherFeedback ? (
                <ThemedText variant="caption" color="muted">{`Nhận xét: ${a.teacherFeedback}`}</ThemedText>
              ) : null}
            </View>
            {a.teacherScore != null ? (
              <ThemedText variant="titleLg" style={{ color: figColor, fontVariant: ['tabular-nums'] }} accessibilityLabel={`Điểm ${a.teacherScore}`}>
                {String(a.teacherScore)}
              </ThemedText>
            ) : null}
          </View>
        )
      })}
    </ListBlock>
  )
}

// P4: the student's own evaluation — 4-skill report + attendance history (own data only).
// v3.4 (mẫu `classd`, mục Đánh giá): một thẻ gồm bảng điểm 4 kỹ năng dạng thanh, nhận xét của giáo
// viên và tóm tắt điểm danh; danh sách từng buổi điểm danh nằm dưới thẻ.
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
        <Skeleton height={168} radius="lg" />
        <Skeleton height={120} radius="lg" />
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
    <View style={{ gap: space[4] }}>
      <Card style={{ gap: space[3] }}>
        <ThemedText variant="bodyStrong" accessibilityRole="header">Bảng điểm 4 kỹ năng</ThemedText>
        {reportQ.isError ? (
          <ErrorState title="Không tải được bảng điểm" onRetry={() => void reportQ.refetch()} />
        ) : report && hasAnySkill(report) ? (
          <SkillBars report={report} />
        ) : (
          <EmptyState
            glyph="thongke"
            title="Chưa có điểm kỹ năng"
            message="Giáo viên chưa chấm điểm 4 kỹ năng cho bạn."
          />
        )}

        <ThemedText variant="bodyStrong" accessibilityRole="header" style={{ marginTop: space[2] }}>
          Nhận xét của giáo viên
        </ThemedText>
        {report?.teacherComment ? (
          <View style={{ gap: space[1] }}>
            {/* Trước đây `teacher_comment` chỉ đi ra DTO phía giáo viên: thầy cô viết trong sổ điểm
                và không đường nào trả nó về cho chính học viên được nhận xét. */}
            <ThemedText variant="body" style={{ lineHeight: 22 }}>{report.teacherComment}</ThemedText>
            {report.evaluatedAt ? (
              <ThemedText variant="caption" color="muted">
                {`Nhận xét ngày ${new Date(report.evaluatedAt).toLocaleDateString('vi-VN')}`}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <ThemedText variant="body" color="muted">
            Giáo viên chưa viết nhận xét cho bạn. Nhận xét sẽ hiện ở đây khi có.
          </ThemedText>
        )}

        {!attendanceQ.isError && attendance.length > 0 ? <AttendanceSummary rows={attendance} /> : null}
      </Card>

      <View>
        <ThemedText variant="title" accessibilityRole="header" style={{ marginBottom: space[3] }}>Điểm danh</ThemedText>
        {attendanceQ.isError ? (
          <ErrorState title="Không tải được điểm danh" onRetry={() => void attendanceQ.refetch()} />
        ) : attendance.length === 0 ? (
          <EmptyState
            glyph="lich"
            title="Chưa có buổi học"
            message="Lớp chưa có buổi học nào được ghi nhận."
          />
        ) : (
          <ListBlock>
            {attendance.map((a, i) => (
              <AttendanceRow key={a.lessonLogId} row={a} first={i === 0} />
            ))}
          </ListBlock>
        )}
      </View>
    </View>
  )
}

const SKILLS: { key: 'horen' | 'lesen' | 'schreiben' | 'sprechen'; label: string }[] = [
  { key: 'lesen', label: 'Đọc' },
  { key: 'horen', label: 'Nghe' },
  { key: 'schreiben', label: 'Viết' },
  { key: 'sprechen', label: 'Nói' },
]

/** Vạch đạt trên thanh kỹ năng (`.sbar > s` của mẫu): 6/10. */
const PASS_MARK = 0.6

function hasAnySkill(r: MySkillReport): boolean {
  return r.horen != null || r.lesen != null || r.schreiben != null || r.sprechen != null
}

function gradeTone(total: number | null): BadgeTone {
  if (total == null) return 'neutral'
  if (total >= 8) return 'success'
  if (total >= 5) return 'accent'
  return 'danger'
}

function SkillBars({ report }: { report: MySkillReport }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <ThemedText variant="caption" color="muted" style={{ flex: 1 }}>
          {`Tổng kết ${report.total != null ? formatAvgVi(report.total) : '—'}`}
        </ThemedText>
        <StatusBadge label={report.grade} tone={gradeTone(report.total)} />
      </View>
      {SKILLS.map((s) => {
        const v = report[s.key]
        const ratio = v != null ? Math.max(0, Math.min(1, v / 10)) : 0
        const low = v != null && ratio < PASS_MARK
        return (
          <View
            key={s.key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] + 2, paddingVertical: 7 }}
            accessible
            accessibilityLabel={`${s.label}: ${v != null ? formatAvgVi(v) : 'chưa có'}`}
          >
            <ThemedText variant="body" style={{ width: 64, fontSize: 14 }}>{s.label}</ThemedText>
            <View style={{ flex: 1, height: 5, borderRadius: radius.full, backgroundColor: c.surfaceSunken }}>
              <View
                style={{
                  width: `${ratio * 100}%`,
                  height: '100%',
                  borderRadius: radius.full,
                  backgroundColor: low ? c.borderStrong : c.info,
                }}
              />
              <View
                style={{ position: 'absolute', left: `${PASS_MARK * 100}%`, top: -5, width: 2, height: 15, borderRadius: 1, backgroundColor: c.textPrimary }}
              />
            </View>
            <ThemedText
              variant="bodyStrong"
              color={v != null ? 'primary' : 'faint'}
              style={{ width: 52, textAlign: 'right', fontFamily: fonts.displayBold, fontVariant: ['tabular-nums'] }}
            >
              {v != null ? formatAvgVi(v) : 'Chưa có'}
            </ThemedText>
          </View>
        )
      })}
    </View>
  )
}

function AttendanceSummary({ rows }: { rows: StudentAttendance[] }) {
  const present = rows.filter((r) => r.status === 'PRESENT').length
  const late = rows.filter((r) => r.status === 'LATE').length
  const absent = rows.filter((r) => r.status === 'ABSENT').length
  const marked = present + late + absent
  const rate = marked > 0 ? Math.round(((present + late) / marked) * 100) : null
  return (
    <ThemedText variant="caption" color="muted" style={{ fontSize: 13, marginTop: space[1] }}>
      {`Điểm danh: ${present + late}/${marked} buổi · ${present} có mặt · ${late} muộn · ${absent} vắng${rate != null ? ` · chuyên cần ${rate}%` : ''}`}
    </ThemedText>
  )
}

function attendanceStatus(status: StudentAttendance['status']) {
  switch (status) {
    case 'PRESENT':
      return { label: 'Có mặt', tone: 'success' as const }
    case 'LATE':
      return { label: 'Muộn', tone: 'accent' as const }
    case 'ABSENT':
      return { label: 'Vắng', tone: 'danger' as const }
    default:
      return { label: 'Chưa điểm danh', tone: 'neutral' as const }
  }
}

function AttendanceRow({ row, first }: { row: StudentAttendance; first: boolean }) {
  const c = useTheme().colors
  const s = attendanceStatus(row.status)
  const box = sessionDayBox(row.sessionDate)
  const date = new Date(row.sessionDate)
  const dateLabel = Number.isNaN(date.getTime()) ? row.sessionDate : date.toLocaleDateString('vi-VN')
  return (
    <View style={listRowStyle(c.border, first)}>
      <DayBox day={box?.day ?? '—'} sub={box?.weekday ?? ''} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {row.topic || (row.sessionNumber != null ? `Buổi ${row.sessionNumber}` : 'Buổi học')}
        </ThemedText>
        <ThemedText variant="caption" color="muted" numberOfLines={1}>
          {dateLabel}
          {row.note ? ` · ${row.note}` : ''}
        </ThemedText>
      </View>
      <StatusBadge tone={s.tone} label={s.label} />
    </View>
  )
}

function TeachersTab({ teachers }: { teachers: TeacherSummary[] }) {
  if (teachers.length === 0) {
    return <EmptyState glyph="lophoc" title="Chưa có giáo viên" message="Lớp này chưa có giáo viên nào." />
  }
  return (
    <View style={{ gap: space[3] }}>
      {teachers.map((t) => (
        <Card key={t.id} style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <InitialAvatar initial={nameInitial(t.displayName)} size={44} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <ThemedText variant="bodyStrong" numberOfLines={1}>
                {t.displayName}
              </ThemedText>
              <ThemedText variant="caption" color="muted" numberOfLines={1} style={{ fontSize: 13 }}>
                {`${teacherRoleLabel(t.role)}${t.email ? ` · ${t.email}` : ''}`}
              </ThemedText>
            </View>
          </View>
          <Button
            label="Nhắn tin"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: '/(student)/messages/[userId]',
                params: { userId: String(t.id), name: t.displayName },
              })
            }
          />
        </Card>
      ))}
    </View>
  )
}

function ProgressTab({
  detail, lessons, isError, onRetry,
}: { detail: ClassroomDetail; lessons: ClassLesson[]; isError: boolean; onRetry: () => void }) {
  const theme = useTheme()
  const c = theme.colors
  if (lessons.length === 0 && isError) {
    return (
      <ErrorState
        title="Không tải được tiến độ"
        message="Không thể tải danh sách buổi học của lớp. Vui lòng thử lại."
        onRetry={onRetry}
      />
    )
  }
  if (lessons.length === 0) {
    return (
      <EmptyState
        glyph="baigiao"
        title="Chưa có checklist"
        message="Giáo viên chưa tạo danh sách buổi học. Tiến độ lớp sẽ hiển thị tại đây khi có."
      />
    )
  }
  return (
    <View style={{ gap: space[4] }}>
      {detail.currentLessonTitle && (
        <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[1] }}>
          <ThemedText variant="label" style={{ color: c.onInkMuted, letterSpacing: 1, textTransform: 'uppercase', fontSize: 11.5 }}>
            Buổi hiện tại của lớp
          </ThemedText>
          <ThemedText variant="title" style={{ color: c.onInk }}>
            {detail.currentLessonTitle}
          </ThemedText>
        </Card>
      )}
      <View>
        <ThemedText variant="title" accessibilityRole="header" style={{ marginBottom: space[3] }}>Lộ trình buổi học</ThemedText>
        <ListBlock>
          {lessons.map((l, idx) => (
            <LessonRow key={l.id} lesson={l} index={idx} />
          ))}
        </ListBlock>
      </View>
    </View>
  )
}

function LessonRow({ lesson, index }: { lesson: ClassLesson; index: number }) {
  const c = useTheme().colors
  return (
    <View style={listRowStyle(c.border, index === 0, { alignItems: 'flex-start', paddingVertical: space[3] })}>
      <DayBox day={String(index + 1)} sub="Buổi" done={lesson.completed} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
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
      {lesson.completed ? <GaGlyph name="hoanthanh" size={20} ink="onAccent" gold="success" accessibilityLabel="Đã hoàn thành" /> : null}
    </View>
  )
}

/** Ô ngày/số buổi `.dbox` (46×50, nền chìm): số lớn serif + dòng phụ nhỏ. */
function DayBox({ day, sub, done }: { day: string; sub: string; done?: boolean }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        width: 46,
        height: 50,
        borderRadius: radius.md,
        backgroundColor: done ? c.successSoft : c.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <ThemedText variant="title" style={{ lineHeight: 22, fontVariant: ['tabular-nums'] }}>{day}</ThemedText>
      <ThemedText variant="caption" color="muted" style={{ fontSize: 11, lineHeight: 13 }}>{sub}</ThemedText>
    </View>
  )
}
