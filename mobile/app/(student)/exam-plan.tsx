import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Check, ChevronRight } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { useBackToMainTab } from '@/hooks/useBackTo'
import {
  AppHeader,
  Button,
  Caption,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Pill,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  TextField,
  ThemedText,
} from '@/components/ui'
import { TeilStrategyCard } from '@/components/exam/TeilStrategyCard'
import {
  currentWeekOf,
  displayDate,
  EXAM_PLAN_QUERY_KEY,
  examPlanApi,
  focusLabel,
  parseExamDate,
  PHASE_HINT,
  PHASE_LABEL,
  taskLabel,
  taskMeta,
  taskRoute,
  warningText,
  type ExamPlan,
  type ExamPlanTask,
  type ExamPlanWeek,
} from '@/lib/examPlanApi'

/**
 * Màn lộ trình đếm ngược (LT3) — bản sinh đôi của `/v2/student/exam-plan`. Tiến độ tính từ việc đã
 * làm thật, nên không có nút tick tay. Mọi việc dẫn tới tính năng có sẵn.
 */
export default function ExamPlanScreen() {
  const goBack = useBackToMainTab()
  const { data: plan, isLoading, isError, refetch } = useQuery({
    queryKey: EXAM_PLAN_QUERY_KEY,
    queryFn: examPlanApi.get,
    staleTime: 30_000,
  })
  const pull = usePullRefresh(async () => {
    await refetch()
  })

  return (
    <Screen edges={['top']}>
      <AppHeader title="Lộ trình tới ngày thi" onBack={goBack} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={110} radius="2xl" />
          <Skeleton height={180} radius="2xl" />
        </View>
      ) : isError || !plan ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen
          scroll
          edges={[]}
          contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[6], gap: space[4], paddingTop: space[2] }}
          refreshing={pull.refreshing}
          onRefresh={() => void pull.onRefresh()}
        >
          <PlanBody plan={plan} />
        </Screen>
      )}
    </Screen>
  )
}

function PlanBody({ plan }: { plan: ExamPlan }) {
  if (plan.status === 'UNAVAILABLE') {
    return (
      <EmptyState
        glyph="thithu"
        title="Chưa có lộ trình cho kỳ thi này"
        message="Lộ trình theo tuần hiện có cho telc B1. Nếu đây là kỳ thi của bạn, hãy chọn telc và mục tiêu B1 trong hồ sơ."
      />
    )
  }
  if (plan.status !== 'ACTIVE') {
    const passed = plan.status === 'EXAM_PASSED'
    return (
      <Card style={{ gap: space[3] }}>
        <ThemedText variant="title">{passed ? 'Ngày thi đã qua' : 'Thêm ngày thi để có lộ trình theo tuần'}</ThemedText>
        <ThemedText variant="caption" color="muted">
          {passed
            ? 'Nếu bạn thi lại, nhập ngày thi mới để lập lộ trình mới.'
            : 'Nhập đúng ngày thi để đếm ngược và chia tuần chính xác.'}
        </ThemedText>
        <DateForm />
      </Card>
    )
  }

  const week = currentWeekOf(plan)
  return (
    <>
      <PlanHeader plan={plan} />
      {plan.warnings.map((code) => {
        const text = warningText(code, plan.weeklyMinutes)
        return text ? <WarningRow key={code} text={text} /> : null
      })}
      {week ? <ThisWeek plan={plan} week={week} /> : null}
      <AllWeeks plan={plan} />
      <ThemedText variant="caption" color="muted">
        Lộ trình giúp sắp xếp việc học, không phải cam kết về kết quả thi.
      </ThemedText>
    </>
  )
}

function PlanHeader({ plan }: { plan: ExamPlan }) {
  const [editing, setEditing] = useState(false)
  return (
    <Card style={{ gap: space[2] }}>
      <Caption>
        {plan.provider} {plan.level}
      </Caption>
      <ThemedText variant="title">
        {plan.daysLeft === 0 ? 'Hôm nay là ngày thi' : `Còn ${plan.daysLeft ?? 0} ngày tới kỳ thi`}
      </ThemedText>
      <ThemedText variant="caption" color="muted">
        {displayDate(plan.targetDate)} · Tuần {plan.currentWeek ?? 1}/{plan.totalWeeks ?? 1}
      </ThemedText>
      <Button
        label="Đổi ngày thi"
        variant="ghost"
        fullWidth={false}
        onPress={() => setEditing((v) => !v)}
        style={{ alignSelf: 'flex-start' }}
      />
      {editing ? (
        <View style={{ gap: space[2] }}>
          <ThemedText variant="caption" color="muted">
            Đổi ngày thi sẽ tính lại kế hoạch từ hôm nay.
          </ThemedText>
          <DateForm initial={displayDate(plan.targetDate)} onSaved={() => setEditing(false)} />
        </View>
      ) : null}
    </Card>
  )
}

function DateForm({ initial = '', onSaved }: { initial?: string; onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: examPlanApi.updateTargetDate,
    onSuccess: (plan) => {
      queryClient.setQueryData(EXAM_PLAN_QUERY_KEY, plan)
      onSaved?.()
    },
    onError: (e) => setError(apiMessage(e)),
  })

  function submit() {
    const parsed = parseExamDate(text)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setError(null)
    save.mutate(parsed.iso)
  }

  return (
    <View style={{ gap: space[2] }}>
      <TextField
        label="Ngày thi"
        value={text}
        onChangeText={setText}
        placeholder="dd/mm/yyyy"
        keyboardType="numbers-and-punctuation"
        error={error ?? undefined}
      />
      <Button label="Lưu ngày thi" onPress={submit} loading={save.isPending} disabled={!text.trim()} />
    </View>
  )
}

function WarningRow({ text }: { text: string }) {
  const c = useTheme().colors
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, padding: space[3] }}>
      <ThemedText variant="caption">{text}</ThemedText>
    </View>
  )
}

function ThisWeek({ plan, week }: { plan: ExamPlan; week: ExamPlanWeek }) {
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <ThemedText variant="title">Tuần này</ThemedText>
        <Pill label={PHASE_LABEL[week.phase]} />
      </View>
      <ThemedText variant="caption" color="muted">
        {PHASE_HINT[week.phase]}
      </ThemedText>
      {week.totalTasks > 0 ? (
        <View style={{ gap: space[1] }}>
          <ThemedText variant="caption" color="muted">
            Xong {week.doneTasks}/{week.totalTasks} việc tuần này
          </ThemedText>
          <ProgressBar value={week.doneTasks / week.totalTasks} height={6} />
        </View>
      ) : null}
      {week.tasks.map((task) => (
        <TaskRow key={`${task.type}-${task.teil ?? 'all'}`} task={task} plan={plan} />
      ))}
      {week.focus.length > 0 ? (
        <View style={{ gap: space[2] }}>
          <ThemedText variant="bodyStrong">Trọng tâm tuần này</ThemedText>
          <ThemedText variant="caption" color="muted">
            Đề giấy chưa có bài luyện riêng từng Teil. Đọc chiến thuật rồi để ý Teil này khi làm bài.
          </ThemedText>
          {week.focus.map((f) => (
            <Card key={`${f.section}-${f.teil}`} style={{ gap: space[2] }}>
              <ThemedText variant="bodyStrong">{focusLabel(f)}</ThemedText>
              <TeilStrategyCard provider={plan.provider} level={plan.level} section={f.section} teil={f.teil} />
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function TaskRow({ task, plan }: { task: ExamPlanTask; plan: ExamPlan }) {
  const c = useTheme().colors
  const route = task.done ? null : taskRoute(task, plan)
  return (
    <Card onPress={route ? () => router.push(route) : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: task.done ? c.accent : c.border,
            backgroundColor: task.done ? c.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {task.done ? <Icon icon={Check} size={14} color="onAccent" /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong">{taskLabel(task)}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {taskMeta(task)}
          </ThemedText>
        </View>
        {task.done ? (
          <Pill label="Đã xong" tone="success" />
        ) : task.comingSoon ? (
          <Pill label="Sắp có" />
        ) : task.locked ? (
          <Pill label="Cần gói trả phí" />
        ) : route ? (
          <Icon icon={ChevronRight} size={16} color="faint" />
        ) : null}
      </View>
    </Card>
  )
}

function AllWeeks({ plan }: { plan: ExamPlan }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[2] }}>
      <SectionHeader title="Cả kế hoạch" />
      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm }}>
        {plan.weeks.map((week, index) => {
          const current = week.weekNo === plan.currentWeek
          const reached = week.weekNo <= (plan.currentWeek ?? 1)
          return (
            <View
              key={week.weekNo}
              style={{
                padding: space[3],
                gap: 2,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: c.border,
                backgroundColor: current ? c.accentSoft : 'transparent',
              }}
            >
              <ThemedText variant="bodyStrong">
                Tuần {week.weekNo} · {PHASE_LABEL[week.phase]}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {displayDate(week.startDate).slice(0, 5)} – {displayDate(week.endDate).slice(0, 5)}
                {reached && week.totalTasks > 0 ? ` · ${week.doneTasks}/${week.totalTasks}` : ''}
              </ThemedText>
              {week.focus.length > 0 ? (
                <ThemedText variant="caption" color="muted">
                  {week.focus.map(focusLabel).join(' · ')}
                </ThemedText>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}
