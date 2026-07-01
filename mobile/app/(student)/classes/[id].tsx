import { useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native'
import { useQueries } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import {
  AlertCircle, BookOpen, CheckCircle2, Circle, Clock, Copy,
  GraduationCap, MessagesSquare, Sparkles, Upload, Users,
} from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import {
  fetchClassAssignments, fetchClassDetail, fetchClassLessons,
  type ClassLesson, type ClassroomDetail, type StudentAssignment, type TeacherSummary,
} from '@/lib/studentClassesApi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Icon, IconButton, Pill, ProgressBar,
  Screen, SectionHeader, Skeleton, ThemedText, YellowSquare,
} from '@/components/ui'

type Tab = 'assignments' | 'grades' | 'teachers' | 'progress'

export default function StudentClassDetail() {
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

  const refetch = () => {
    void detailQ.refetch()
    void assignmentsQ.refetch()
    void lessonsQ.refetch()
  }
  const isRefetching = detailQ.isRefetching || assignmentsQ.isRefetching || lessonsQ.isRefetching

  if (detailQ.isLoading) {
    return (
      <Screen>
        <AppHeader title="Đang tải lớp…" onBack={() => router.back()} />
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
        <AppHeader title="Không mở được lớp" onBack={() => router.back()} />
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
        onBack={() => router.back()}
        right={
          <IconButton
            icon={MessagesSquare}
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <HeaderCard detail={detail} />
        <ProgressStrip detail={detail} />
        <TabBar tab={tab} setTab={setTab} />
        {tab === 'assignments' && (
          <AssignmentsTab
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

// Editorial ink hero — the "who teaches this class" primary fact, with the
// invite-code as a hairline chip beneath it.
function HeaderCard({ detail }: { detail: ClassroomDetail }) {
  const theme = useTheme()
  const c = theme.colors
  const onShareCode = async () => {
    try {
      await Share.share({ message: `Mã mời lớp ${detail.name}: ${detail.inviteCode}` })
    } catch {
      Alert.alert('Không mở được hộp thoại chia sẻ')
    }
  }
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chia sẻ mã mời ${detail.inviteCode}`}
          onPress={onShareCode}
          style={({ pressed }) => ({
            marginTop: space[1],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            borderWidth: 1,
            borderColor: c.onInkMuted,
            borderRadius: radius.sm,
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            alignSelf: 'flex-start',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Copy size={12} color={c.onInkMuted} strokeWidth={2} />
          <ThemedText variant="caption" style={{ color: c.onInk, letterSpacing: 1 }}>
            {detail.inviteCode}
          </ThemedText>
        </Pressable>
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
  assignments, isError, onRetry,
}: { assignments: StudentAssignment[]; isError: boolean; onRetry: () => void }) {
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
      <EmptyState icon={BookOpen} title="Chưa có bài tập" message="Lớp này chưa có bài tập nào." />
    )
  }
  return (
    <View style={{ gap: space[4] }}>
      <SectionHeader title="Bài tập của lớp" />
      <View style={{ gap: space[2] }}>
        {assignments.map((a) => (
          <Card
            key={a.id}
            onPress={() => router.push(`/(student)/assignments/${a.assignmentId}` as never)}
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
                    <Icon icon={Clock} size={11} color="muted" />
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
  if (status === 'GRADED' || status === 'EVALUATED') {
    return <Pill tone="success" icon={CheckCircle2} label={`Đã chấm${score != null ? ` · ${score}` : ''}`} />
  }
  if (status === 'SUBMITTED') {
    return <Pill tone="info" icon={Upload} label="Đã nộp" />
  }
  return <Pill tone="danger" icon={AlertCircle} label="Chưa nộp" />
}

function GradesTab({
  assignments, isError, onRetry,
}: { assignments: StudentAssignment[]; isError: boolean; onRetry: () => void }) {
  const theme = useTheme()
  const c = theme.colors
  const graded = useMemo(
    () => assignments.filter((a) => a.status === 'GRADED' || a.status === 'EVALUATED'),
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
    return <EmptyState icon={Sparkles} title="Chưa có điểm" message="Chưa có bài nào được chấm." />
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

function TeachersTab({ teachers }: { teachers: TeacherSummary[] }) {
  const theme = useTheme()
  if (teachers.length === 0) {
    return <EmptyState icon={Users} title="Chưa có giáo viên" message="Lớp này chưa có giáo viên nào." />
  }
  return (
    <View style={{ gap: space[4] }}>
      <SectionHeader title="Giáo viên phụ trách" />
      <View style={{ gap: space[2] }}>
        {teachers.map((t) => (
          <Card key={t.id}>
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
                <Icon icon={GraduationCap} size={20} color="accent" />
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
        icon={BookOpen}
        title="Chưa có checklist"
        message="Giáo viên chưa tạo danh sách buổi học. Tiến độ lớp sẽ hiển thị tại đây khi có."
      />
    )
  }
  return (
    <View style={{ gap: space[4] }}>
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
    </View>
  )
}

function LessonRow({ lesson, index }: { lesson: ClassLesson; index: number }) {
  return (
    <Card tone={lesson.completed ? 'sunken' : 'surface'}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <Icon
          icon={lesson.completed ? CheckCircle2 : Circle}
          size={20}
          color={lesson.completed ? 'success' : 'muted'}
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
