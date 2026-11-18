// Tab Luyện thi telc (giao diện v3.4, Đợt 2, 19/11/2026) — dựng theo mẫu `plans/ios-v3.4-mau` màn
// `exam` và trang /v2/student/exam của web: đếm ngược ngày thi, gợi ý nhanh, bốn kỹ năng (vạch đỗ
// 60%), tuần này (đổi chỗ buổi chưa làm), đề luyện. Owner chốt 18/11: chỉ telc; chưa có ngày thi thì
// mời làm bài chẩn đoán; dưới 50% đỏ "Chưa đạt", 50–59% cam "Sát ngưỡng".
//
// Thay màn thi thử cũ (chọn cấp A1–B2, đề Goethe, khoá PRO): luyện đề telc mở theo quyền
// `/mock-exams/practice/access` như web; thi thử trọn đề mở từ màn Đề.

import { useCallback } from 'react'
import { Alert, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { apiMessage } from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { AvatarButton, EmptyState, ErrorState, ListRow, Screen, SectionHeader, Skeleton, ThemedText, useTabBarClearance } from '@/components/ui'
import { EXAM_HUB_QUERY_KEY, hubSuggestions, isNewcomer, useExamHub, type ExamHubData } from '@/hooks/useExamHub'
import { checkedCount, teilRouteFor, type Skill } from '@/lib/examHub'
import { examPlanApi, swapLocally, type ExamPlan } from '@/lib/examPlanApi'
import { diagnosticRoute, examPlanRoute, oralRoute, type ExamRoute } from '@/lib/examRoutes'
import { CountdownInkCard, DiagnosticCard, ExamSetCard, SuggestionRail, go } from '@/components/exam/hub/HubCards'
import { SkillBars, WeekRail } from '@/components/exam/hub/SkillsAndWeek'

export default function ExamScreen() {
  const tabClearance = useTabBarClearance()
  const c = useTheme().colors
  const queryClient = useQueryClient()
  const { data, derived, isLoading, isError, refetch } = useExamHub()
  const pull = usePullRefresh(async () => {
    await refetch()
  })

  // Tab không unmount: quay về từ một Teil/đề phải thấy điểm mới.
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const level = data?.plan?.level ?? 'B1'

  const onSwap = async (from: string, to: string) => {
    const plan = data?.plan
    const week = derived?.week
    if (!plan || !week) return
    const setPlan = (p: ExamPlan) => queryClient.setQueryData<ExamHubData>(EXAM_HUB_QUERY_KEY, (old) => (old ? { ...old, plan: p } : old))
    setPlan(swapLocally(plan, from, to))
    try {
      setPlan(await examPlanApi.swapDays(week.weekNo, from, to))
    } catch (e) {
      setPlan(plan)
      Alert.alert('Chưa đổi được buổi', apiMessage(e) || 'Thử lại sau ít phút.')
    }
  }

  return (
    <Screen
      scroll
      edges={['top']}
      contentStyle={{ paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: tabClearance, gap: space[4] }}
      refreshing={pull.refreshing}
      onRefresh={() => void pull.onRefresh()}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="label" color="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Luyện thi telc
          </ThemedText>
          <ThemedText variant="displayLg" accessibilityRole="header">
            telc Deutsch{' '}
            <ThemedText variant="displayLg" style={{ backgroundColor: c.accent }}>{` ${level} `}</ThemedText>
          </ThemedText>
        </View>
        <AvatarButton />
      </View>

      {isLoading && !data ? (
        <View style={{ gap: space[3] }}>
          <Skeleton height={150} radius="lg" />
          <Skeleton height={44} radius="full" />
          <Skeleton height={260} radius="md" />
        </View>
      ) : isError || !data || !derived ? (
        <ErrorState title="Chưa tải được Luyện thi" onRetry={() => void refetch()} />
      ) : !data.access ? (
        <EmptyState glyph="khoa" title="Luyện đề chưa mở" message="Luyện đề telc chưa mở cho tài khoản này. Liên hệ trung tâm hoặc thử lại sau." />
      ) : (
        <HubBody data={data} derived={derived} onSwap={onSwap} />
      )}
    </Screen>
  )
}

function HubBody({
  data,
  derived,
  onSwap,
}: {
  data: ExamHubData
  derived: NonNullable<ReturnType<typeof useExamHub>['derived']>
  onSwap: (from: string, to: string) => void
}) {
  const { plan, diagnostic, overviews, rows, attempts, locked } = data
  const newcomer = isNewcomer(data)
  const suggestions = hubSuggestions(data, derived)
  // Đề đang làm cho thẻ đếm ngược: đề có Teil kiểm tra gần nhất, chưa có thì đề đầu tiên.
  const current = [...overviews].sort((a, b) => checkedCount(b) - checkedCount(a))[0]
  const week = derived.week
  const routeFor = (s: Skill): ExamRoute | null =>
    s.id === 'SPRECHEN' ? oralRoute(plan, s.weakest?.teil ?? null) : s.weakest ? teilRouteFor(s.weakest.key, overviews) : null

  return (
    <>
      {diagnostic === 'NONE' || diagnostic === 'IN_PROGRESS' ? <DiagnosticCard resume={diagnostic === 'IN_PROGRESS'} /> : null}

      {plan?.status === 'ACTIVE' ? (
        <CountdownInkCard plan={plan} setTitle={current?.title ?? null} done={checkedCount(current)} total={current?.teile.length ?? 0} />
      ) : null}

      {!newcomer ? <SuggestionRail items={suggestions} /> : null}

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Bốn kỹ năng" />
        <ThemedText variant="caption" color="muted" style={{ marginTop: -space[2] }}>
          Vạch đứng là mức đỗ 60%. Chạm một kỹ năng để luyện Teil yếu nhất.
        </ThemedText>
        <SkillBars skills={derived.skills} routeFor={routeFor} />
      </View>

      {week?.days && week.days.length > 0 ? (
        <View style={{ gap: space[3] }}>
          <SectionHeader
            title={`Tuần này · ${week.weekNo}/${plan?.totalWeeks ?? week.weekNo}`}
            actionLabel="Lịch theo tuần"
            onAction={() => go(examPlanRoute)}
          />
          <WeekRail days={week.days} onSwap={onSwap} />
        </View>
      ) : null}

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Đề luyện" />
        {rows.length === 0 && locked.length === 0 ? (
          <ThemedText variant="body" color="muted">Chưa có đề telc nào mở cho bạn.</ThemedText>
        ) : (
          rows.map((r) => (
            <ExamSetCard
              key={r.exam.id}
              exam={r.exam}
              overview={overviews.find((o) => o.examId === r.exam.id)}
              attempts={attempts.filter((a) => a.exam_id === r.exam.id)}
            />
          ))
        )}
        {locked.map((p) => (
          <ListRow key={p.id} glyph="khoa" title={p.title} subtitle="Bộ đề cần gói trả phí" showChevron={false} />
        ))}
      </View>

      <View style={{ gap: space[2] }}>
        {diagnostic === 'DONE' ? (
          <ListRow glyph="muctieu" title="Bài chẩn đoán" subtitle="Xem lại kết quả từng kỹ năng" onPress={() => go(diagnosticRoute)} />
        ) : null}
        <ListRow
          glyph="lich"
          title="Đổi ngày thi, số phút mỗi ngày"
          subtitle={plan?.status === 'ACTIVE' && plan.targetDate ? `telc ${plan.level ?? 'B1'} · thi ${plan.targetDate.split('-').reverse().join('/')}` : 'Thêm ngày thi để có lịch ôn theo tuần'}
          onPress={() => go(examPlanRoute)}
        />
      </View>
    </>
  )
}
