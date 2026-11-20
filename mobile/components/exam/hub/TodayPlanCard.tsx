// Thẻ "Lịch ôn hôm nay" đứng đầu màn Hôm nay (giao diện v3.4, Đợt 2). Owner chốt 18/11 và giữ lại
// 19/11: lịch ôn telc đứng đầu; người chưa có ngày thi thấy thẻ mời làm bài chẩn đoán. Theo mẫu
// `plans/ios-v3.4-mau` màn `today`: đếm ngược, bảy chấm của tuần, tối đa ba việc xếp sẵn, một nút vàng.
// Dữ liệu dùng chung với tab Luyện thi (`useExamHub`) nên không tải hai lần.

import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, Card, ProgressBar, ThemedText } from '@/components/ui'
import { hubSuggestions, isNewcomer, useExamHub } from '@/hooks/useExamHub'
import { checkedCount, sectionShort, todayCardText } from '@/lib/examHub'
import type { ExamPlanDay } from '@/lib/examPlanApi'
import type { ExamRoute } from '@/lib/examRoutes'
import { DiagnosticCard, go, weekdayShort } from './HubCards'

interface PlanItem {
  key: string
  title: string
  meta: string
  minutes: number | null
  route: ExamRoute | 'srs'
  main: boolean
}

function WeekDots({ days }: { days: ExamPlanDay[] }) {
  const c = useTheme().colors
  const done = days.filter((d) => d.status === 'DONE').length
  const today = days.find((d) => d.status === 'TODAY')
  return (
    <View
      style={{ flexDirection: 'row', gap: 5 }}
      accessible
      accessibilityLabel={`Tuần này: đã ôn ${done} ngày${today ? `, hôm nay ${weekdayShort(today.date)}` : ''}`}
    >
      {days.map((d) => {
        const isToday = d.status === 'TODAY'
        return (
          <View
            key={d.date}
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: d.status === 'DONE' ? c.textPrimary : isToday ? c.accent : c.border,
              borderWidth: isToday ? 1.5 : 0,
              borderColor: c.textPrimary,
            }}
          />
        )
      })}
    </View>
  )
}

export function TodayPlanCard({ dueSrs, style }: { dueSrs: number; style?: object }) {
  const c = useTheme().colors
  const { data, derived } = useExamHub()
  if (!data || !derived || !data.access) return null

  if (isNewcomer(data) || data.diagnostic === 'IN_PROGRESS') {
    return (
      <View style={style}>
        <DiagnosticCard resume={data.diagnostic === 'IN_PROGRESS'} />
      </View>
    )
  }
  const plan = data.plan
  const card = derived.card
  if (!card) return null
  const text = todayCardText(card)

  const review = hubSuggestions(data, derived).find((s) => s.kind === 'review')
  const items: PlanItem[] = []
  if (review && review.kind === 'review') {
    items.push({ key: 'review', title: `Ôn ${review.wrong} câu sai`, meta: `${sectionShort(review.section)} Teil ${review.teil}`, minutes: null, route: review.route, main: false })
  }
  if ('route' in card && card.route) {
    items.push({ key: 'main', title: text.title, meta: text.reason, minutes: 'minutes' in card ? card.minutes : null, route: card.route, main: true })
  }
  if (dueSrs > 0) items.push({ key: 'srs', title: `${dueSrs} thẻ từ đến hạn`, meta: 'Ôn thẻ từ', minutes: Math.max(2, Math.ceil(dueSrs / 3)), route: 'srs', main: false })
  const totalMin = items.reduce((s, x) => s + (x.minutes ?? 0), 0)
  const main = items.find((x) => x.main)

  const current = [...data.overviews].sort((a, b) => checkedCount(b) - checkedCount(a))[0]
  const doneTeile = checkedCount(current)
  const totalTeile = current?.teile.length ?? 0
  const week = derived.week
  const open = (r: PlanItem['route']) => (r === 'srs' ? router.push('/(student)/srs') : go(r))

  return (
    <View style={style}>
      <Card elevation="lifted" style={{ padding: space[5], gap: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <ThemedText variant="label" color="muted" style={{ flex: 1, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            {plan?.status === 'ACTIVE' && week ? `Lịch ôn hôm nay · Tuần ${week.weekNo}/${plan.totalWeeks ?? week.weekNo}` : 'Lịch ôn hôm nay'}
          </ThemedText>
          {plan?.status === 'ACTIVE' && plan.daysLeft != null ? (
            <View style={{ backgroundColor: c.inkSurface, borderRadius: 999, paddingHorizontal: space[3], paddingVertical: 4 }}>
              <ThemedText variant="caption" color="onInk" style={{ fontVariant: ['tabular-nums'] }}>
                {plan.daysLeft === 0 ? 'Hôm nay thi' : `còn ${plan.daysLeft} ngày`}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="caption" color="muted">
              {plan?.status === 'ACTIVE' && plan.targetDate
                ? `telc Deutsch ${plan.level ?? 'B1'} · thi ${weekdayShort(plan.targetDate)} ${plan.targetDate.split('-').reverse().slice(0, 2).join('/')}`
                : `telc Deutsch ${plan?.level ?? 'B1'} · ${text.eyebrow}`}
            </ThemedText>
            <ThemedText variant="titleLg" accessibilityRole="header" accessibilityLanguage={text.german ? 'de-DE' : undefined}>
              {text.title}
            </ThemedText>
          </View>
          {week?.days?.length ? <WeekDots days={week.days} /> : null}
        </View>

        {items.length > 0 ? (
          <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
            {items.map((x, i) => (
              <Pressable
                key={x.key}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${x.title}, ${x.meta}${x.minutes ? `, ${x.minutes} phút` : ''}`}
                onPress={() => open(x.route)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[3],
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                  backgroundColor: pressed ? c.surfaceSunken : x.main ? c.accentSoft : 'transparent',
                })}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: x.main ? c.inkSurface : 'transparent', borderWidth: x.main ? 0 : 1.5, borderColor: c.borderStrong }}>
                  <ThemedText variant="caption" color={x.main ? 'onInk' : 'secondary'}>{i + 1}</ThemedText>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <ThemedText variant="bodyStrong" accessibilityLanguage={x.main && text.german ? 'de-DE' : undefined}>{x.title}</ThemedText>
                  <ThemedText variant="caption" color="muted" numberOfLines={2}>{x.meta}</ThemedText>
                </View>
                {x.minutes ? <ThemedText variant="caption" color="muted">{x.minutes} phút</ThemedText> : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <ThemedText variant="body" color="secondary">{text.reason}</ThemedText>
        )}

        {totalTeile > 0 ? (
          <View style={{ gap: space[2] }}>
            <ThemedText variant="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
              {totalMin > 0 ? `Khoảng ${totalMin} phút · ` : ''}đã làm {doneTeile}/{totalTeile} Teil · {current?.title}
            </ThemedText>
            <ProgressBar value={doneTeile / totalTeile} height={6} fillColor={c.textPrimary} />
          </View>
        ) : null}

        {/* Nút vàng duy nhất trên màn (luật v3.4). */}
        {main && text.action ? <Button label={text.action} variant="yellow" onPress={() => open(main.route)} /> : null}
      </Card>
    </View>
  )
}
