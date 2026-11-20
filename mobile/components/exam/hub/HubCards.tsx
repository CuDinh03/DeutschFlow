// Các khối đầu tab Luyện thi (giao diện v3.4, Đợt 2, 19/11/2026), theo mẫu `plans/ios-v3.4-mau` màn
// `exam` và trang /v2/student/exam của web: thẻ mực đếm ngược ngày thi, thẻ mời bài chẩn đoán, hàng
// gợi ý nhanh, thẻ một đề luyện.

import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ChevronRight, FileText, Headphones, Mic, RotateCcw, Target, type LucideIcon } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Card, GaGlyph, Icon, Pill, ThemedText } from '@/components/ui'
import { asHref, diagnosticRoute, examSetRoute, type ExamRoute } from '@/lib/examRoutes'
import { sectionShort, type Suggestion } from '@/lib/examHub'
import type { PracticeOverview } from '@/lib/telcPracticeApi'
import type { PackExam } from '@/lib/mockPackApi'
import type { ExamAttempt } from '@/lib/examApi'
import type { ExamPlan } from '@/lib/examPlanApi'

const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const PASS_RATIO = 0.6

const dateOf = (iso: string) => new Date(`${iso}T00:00:00`)

/** `2026-12-11` → `Thứ Sáu, 11/12/2026`. */
export function fullDate(iso: string): string {
  const d = dateOf(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${WEEKDAY[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`
}

export const weekdayShort = (iso: string): string => WEEKDAY_SHORT[dateOf(iso).getDay()]

export function go(route: ExamRoute) {
  void Haptics.selectionAsync()
  router.push(asHref(route))
}

/** Thẻ mực đen đếm ngược ngày thi: ngày thi, số ngày còn lại, tiến độ đề đang làm, tuần của lịch. */
export function CountdownInkCard({ plan, setTitle, done, total }: { plan: ExamPlan; setTitle: string | null; done: number; total: number }) {
  const c = useTheme().colors
  const daysLeft = plan.daysLeft ?? 0
  return (
    <View
      style={{ backgroundColor: c.inkSurface, borderRadius: radius.lg, padding: space[5], gap: space[4] }}
      accessible
      accessibilityLabel={daysLeft === 0 ? 'Hôm nay là ngày thi' : `Ngày thi ${fullDate(plan.targetDate ?? '')}, còn ${daysLeft} ngày`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="label" style={{ color: c.onInkMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Ngày thi của bạn
          </ThemedText>
          <ThemedText variant="title" color="onInk" style={{ marginTop: space[1] }}>
            {plan.targetDate ? fullDate(plan.targetDate) : ''}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {daysLeft === 0 ? (
            <ThemedText variant="titleLg" style={{ color: c.accent }}>Hôm nay</ThemedText>
          ) : (
            <>
              <ThemedText variant="displayLg" style={{ color: c.accent, fontSize: 44, lineHeight: 46, fontVariant: ['tabular-nums'] }}>
                {daysLeft}
              </ThemedText>
              <ThemedText variant="caption" style={{ color: c.onInkMuted }}>ngày nữa</ThemedText>
            </>
          )}
        </View>
      </View>
      {total > 0 ? (
        <View style={{ gap: space[2] }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round((done / total) * 100)}%`, height: 6, backgroundColor: c.accent }} />
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <ThemedText variant="caption" style={{ color: c.onInkMuted, flex: 1 }} numberOfLines={1}>
              {setTitle ? `Đã làm ${done}/${total} Teil · ${setTitle}` : `Đã làm ${done}/${total} Teil`}
            </ThemedText>
            {plan.currentWeek ? (
              <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                Tuần {plan.currentWeek}/{plan.totalWeeks ?? plan.currentWeek}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** Điểm vào lần đầu: bài chẩn đoán rồi mới có lịch ôn; đang dở thì "Làm tiếp". */
export function DiagnosticCard({ resume }: { resume: boolean }) {
  const c = useTheme().colors
  return (
    <Card style={{ borderWidth: 1.5, borderColor: c.textPrimary, gap: space[3] }}>
      <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
        <GaGlyph name="muctieu" size={26} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong">{resume ? 'Làm tiếp bài chẩn đoán' : 'Bắt đầu bằng bài chẩn đoán'}</ThemedText>
          <ThemedText variant="caption" color="muted">
            Đủ mọi Teil như đề thật, khoảng 170 phút, làm từng phần được. Xong là có lịch ôn tới ngày thi.
          </ThemedText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => go(diagnosticRoute)}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: radius.md,
          backgroundColor: c.inkSurface,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <ThemedText variant="bodyStrong" color="onInk">{resume ? 'Làm tiếp' : 'Làm bài chẩn đoán'}</ThemedText>
      </Pressable>
    </Card>
  )
}

const SUGGEST_ICON: Record<Suggestion['kind'], LucideIcon> = { review: RotateCcw, weak: Target, mock: FileText, oral: Mic }

function suggestionText(s: Suggestion): { label: string; meta: string | null } {
  const name = (section: string, teil: number) => `${sectionShort(section)} T${teil}`
  switch (s.kind) {
    case 'review':
      return { label: `Ôn ${s.wrong} câu sai · ${name(s.section, s.teil)}`, meta: null }
    case 'weak':
      return { label: name(s.section, s.teil), meta: `${s.minutes} phút` }
    case 'mock':
      return { label: `Thi thử ${weekdayShort(s.date)}`, meta: null }
    case 'oral':
      return { label: 'Thi nói lần đầu', meta: '15 phút' }
  }
}

/** Hàng gợi ý nhanh (tối đa 3), cuộn ngang. */
export function SuggestionRail({ items }: { items: Suggestion[] }) {
  const c = useTheme().colors
  if (items.length === 0) return null
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space[5] }}
      style={{ marginHorizontal: -space[5] }}
      accessibilityLabel="Gợi ý luyện nhanh"
    >
      {items.map((s) => {
        const { label, meta } = suggestionText(s)
        const icon = s.kind === 'weak' && s.section === 'HOEREN' ? Headphones : SUGGEST_ICON[s.kind]
        return (
          <Pressable
            key={`${s.kind}-${label}`}
            accessibilityRole="button"
            accessibilityLabel={meta ? `${label}, ${meta}` : label}
            onPress={() => go(s.route)}
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              paddingLeft: space[3],
              paddingRight: space[4],
              borderRadius: 999,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Icon icon={icon} size={16} color="info" />
            <ThemedText variant="label" accessibilityLanguage={s.kind === 'weak' ? 'de-DE' : undefined}>{label}</ThemedText>
            {meta ? <ThemedText variant="caption" color="muted">{meta}</ThemedText> : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** Thẻ một đề luyện: thanh Teil đã kiểm tra, kết quả lượt thi thử gần nhất. */
export function ExamSetCard({ exam, overview, attempts }: { exam: PackExam; overview?: PracticeOverview; attempts: ExamAttempt[] }) {
  const c = useTheme().colors
  if (exam.comingSoon) {
    return (
      <View style={{ borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, padding: space[4], gap: space[2] }}>
        <Pill label="Sắp có" />
        <ThemedText variant="bodyStrong" color="muted">{exam.title}</ThemedText>
      </View>
    )
  }
  const teile = overview?.teile ?? []
  const done = teile.filter((x) => x.progress?.checked).length
  const max = teile.reduce((s, x) => s + x.maxPoints, 0)
  const last = attempts
    .filter((a) => a.status === 'COMPLETED')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))[0]
  const running = attempts.some((a) => a.status === 'IN_PROGRESS')
  const passed = last && max > 0 ? (last.total_score ?? 0) >= Math.round(max * PASS_RATIO) : null
  const showNew = exam.isNew === true && attempts.length === 0 && done === 0
  const tag = running
    ? { label: 'Đang thi thử', tone: 'accent' as const }
    : passed === true
      ? { label: 'Đạt', tone: 'success' as const }
      : passed === false
        ? { label: 'Chưa đạt', tone: 'danger' as const }
        : { label: 'Chưa thi thử', tone: 'neutral' as const }
  return (
    <Card onPress={() => go(examSetRoute(exam.id))} accessibilityLabel={`${exam.title}, đã làm ${done} trên ${teile.length} Teil, ${tag.label}`} style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
        <ThemedText variant="title" style={{ flex: 1 }}>{exam.title}</ThemedText>
        {showNew ? <Pill label="Mới" tone="accent" solid /> : null}
        <Icon icon={ChevronRight} size={18} color="faint" />
      </View>
      {teile.length > 0 ? (
        <View style={{ gap: space[1] }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {teile.map((x) => (
              <View key={x.key} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: x.progress?.checked ? c.textPrimary : c.border }} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <ThemedText variant="caption" color="muted" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
          {teile.length > 0 ? `${done}/${teile.length} Teil` : ' '}
          {last && max > 0 ? ` · thi thử ${last.total_score ?? 0}/${max}` : ''}
        </ThemedText>
        <Pill label={tag.label} tone={tag.tone} />
      </View>
    </Card>
  )
}
