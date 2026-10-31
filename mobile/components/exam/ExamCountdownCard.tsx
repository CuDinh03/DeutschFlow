import { useCallback } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, type Href } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { space } from '@/lib/theme'
import { Card, GaGlyph, Icon, ProgressBar, ThemedText } from '@/components/ui'
import { currentWeekOf, EXAM_PLAN_QUERY_KEY, examPlanApi } from '@/lib/examPlanApi'

const PLAN_ROUTE = '/(student)/exam-plan' as Href

/**
 * Thẻ "Còn N ngày tới kỳ thi · tuần X/Y" (LT3) — bản sinh đôi của
 * `frontend/src/components/exam/plan/ExamCountdownCard.tsx`. Tự tải, tự ẩn khi không có kế hoạch.
 * `invite` dùng ở màn thi thử: thêm lời mời nhập ngày thi cho người chưa có ngày.
 */
export function ExamCountdownCard({ invite = false, style }: { invite?: boolean; style?: StyleProp<ViewStyle> }) {
  const { data: plan, refetch } = useQuery({
    queryKey: EXAM_PLAN_QUERY_KEY,
    queryFn: examPlanApi.get,
    staleTime: 60_000,
  })

  // Tab ẩn giữ màn cũ sống: quay lại từ đề thi vẫn phải thấy tiến độ mới.
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  if (!plan) return null

  if (plan.status === 'ACTIVE') {
    const week = currentWeekOf(plan)
    return (
      <View style={style}>
        <Card onPress={() => router.push(PLAN_ROUTE)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <GaGlyph name="thoigian" size={22} ink="muted" />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong">
                {plan.daysLeft === 0 ? 'Hôm nay là ngày thi' : `Còn ${plan.daysLeft ?? 0} ngày tới kỳ thi`}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {plan.provider} {plan.level} · Tuần {plan.currentWeek ?? 1}/{plan.totalWeeks ?? 1}
              </ThemedText>
            </View>
            <Icon icon={ChevronRight} size={16} color="faint" />
          </View>
          {week && week.totalTasks > 0 ? (
            <View style={{ marginTop: space[3], gap: space[1] }}>
              <ThemedText variant="caption" color="muted">
                Xong {week.doneTasks}/{week.totalTasks} việc tuần này
              </ThemedText>
              <ProgressBar value={week.doneTasks / week.totalTasks} height={6} />
            </View>
          ) : null}
        </Card>
      </View>
    )
  }

  if (invite && (plan.status === 'NEEDS_DATE' || plan.status === 'EXAM_PASSED')) {
    return (
      <View style={style}>
        <Card onPress={() => router.push(PLAN_ROUTE)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <GaGlyph name="thoigian" size={22} ink="muted" />
            <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
              Thêm ngày thi để có lộ trình theo tuần
            </ThemedText>
            <Icon icon={ChevronRight} size={16} color="faint" />
          </View>
        </Card>
      </View>
    )
  }

  return null
}
