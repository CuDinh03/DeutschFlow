// "Bốn kỹ năng" và "Tuần này" của tab Luyện thi (giao diện v3.4, Đợt 2, 19/11/2026). Bản sinh đôi của
// `frontend/src/components/exam/today/SkillBars.tsx` và `WeekPlan.tsx`. Trên web đổi chỗ buổi bằng kéo
// thả; trên app chạm một buổi chưa làm để chọn buổi đổi chỗ (danh sách hệ thống của iOS).

import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { radius, space, useTheme } from '@/lib/theme'
import { GaGlyph, Icon, ThemedText } from '@/components/ui'
import { dayLabel, PASS_PCT, sectionShort, STATUS_LABEL, type Skill, type SkillStatus } from '@/lib/examHub'
import type { ExamPlanDay } from '@/lib/examPlanApi'
import type { ExamRoute } from '@/lib/examRoutes'
import { go, weekdayShort } from './HubCards'

/**
 * Chữ "Sát ngưỡng": cam của bảng màu (#C26A1B) chỉ đạt ~3,9:1 trên nền trắng, chưa đủ 4,5:1 cho chữ
 * nhỏ, nên chữ dùng cam đậm hơn; thanh vẫn dùng cam của bảng màu.
 */
export const NEAR_TEXT = '#9A5210'

const SKILL_GLYPH: Record<Skill['id'], GlyphName> = { LESEN: 'doc', HOEREN: 'nghe', SCHREIBEN: 'viet', SPRECHEN: 'noi' }
const SKILL_NAME: Record<Skill['id'], string> = { LESEN: 'Lesen', HOEREN: 'Hören', SCHREIBEN: 'Schreiben', SPRECHEN: 'Sprechen' }

export function dayGlyph(d: Pick<ExamPlanDay, 'kind' | 'section'>): GlyphName {
  switch (d.kind) {
    case 'TEIL':
      return d.section === 'HOEREN' ? 'nghe' : d.section === 'SCHREIBEN' ? 'viet' : d.section === 'SPRACHBAUSTEINE' ? 'nguphap' : 'doc'
    case 'ORAL_DRILL':
    case 'ORAL_MOCK':
      return 'noi'
    case 'FULL_EXAM':
      return 'thithu'
    case 'ROADMAP':
      return 'lernweg'
    case 'REST':
      return 't_cafe'
    case 'EXAM_DAY':
      return 'muctieu'
    default:
      // Máy chủ thêm loại buổi mới mà bản app này chưa biết: vẫn vẽ được, không sập tab.
      return 'lich'
  }
}

function useStatusColors() {
  const c = useTheme().colors
  return (s: SkillStatus) => {
    switch (s) {
      case 'ok':
        return { text: c.success, bar: c.success }
      case 'near':
        return { text: NEAR_TEXT, bar: c.orange }
      case 'below':
        return { text: c.danger, bar: c.danger }
      case 'none':
        return { text: c.textMuted, bar: c.border }
    }
  }
}

export function SkillBars({
  skills,
  routeFor,
}: {
  skills: Skill[]
  /** Màn mở khi chạm một kỹ năng (Teil yếu nhất, hoặc phòng thi nói). `null` = chưa có gì để mở. */
  routeFor: (skill: Skill) => ExamRoute | null
}) {
  const c = useTheme().colors
  const colorOf = useStatusColors()
  return (
    <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
      {skills.map((s, i) => {
        const route = routeFor(s)
        const tone = colorOf(s.status)
        const weak = s.weakest ? `${sectionShort(s.weakest.section)} T${s.weakest.teil}` : null
        const label = `${SKILL_NAME[s.id]}, ${s.pct == null ? STATUS_LABEL.none : `${s.pct} phần trăm, ${STATUS_LABEL[s.status]}`}${weak ? `, nên luyện ${weak}` : ''}`
        return (
          <Pressable
            key={s.id}
            accessibilityRole={route ? 'button' : undefined}
            accessibilityLabel={label}
            disabled={!route}
            onPress={() => route && go(route)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              padding: space[4],
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.border,
              backgroundColor: pressed ? c.surfaceSunken : 'transparent',
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <GaGlyph name={SKILL_GLYPH[s.id]} size={22} />
            </View>
            <View style={{ flex: 1, gap: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                <ThemedText variant="title" style={{ flex: 1 }} accessibilityLanguage="de-DE">{SKILL_NAME[s.id]}</ThemedText>
                <ThemedText variant="label" style={{ color: tone.text, fontVariant: ['tabular-nums'] }}>
                  {s.pct == null ? STATUS_LABEL.none : `${s.pct}% · ${STATUS_LABEL[s.status]}`}
                </ThemedText>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceSunken }}>
                <View style={{ width: `${Math.min(100, s.pct ?? 0)}%`, height: 6, borderRadius: 3, backgroundColor: tone.bar }} />
                {/* Vạch đứng = mức đỗ 60%. */}
                <View style={{ position: 'absolute', left: `${PASS_PCT}%`, top: -3, width: 2, height: 12, borderRadius: 1, backgroundColor: c.textPrimary }} />
              </View>
            </View>
            {route ? <Icon icon={ChevronRight} size={16} color="faint" /> : <View style={{ width: 16 }} />}
          </Pressable>
        )
      })}
    </View>
  )
}

function askSwap(day: ExamPlanDay, days: ExamPlanDay[], onSwap: (from: string, to: string) => void) {
  const targets = days.filter((d) => d.movable && d.date !== day.date)
  if (targets.length === 0) return
  const names = targets.map((d) => `${weekdayShort(d.date)} · ${dayLabel(d)}`)
  const title = `Đổi buổi ${weekdayShort(day.date)} (${dayLabel(day)}) với`
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...names, 'Huỷ'], cancelButtonIndex: names.length },
      (i) => {
        if (i < names.length) onSwap(day.date, targets[i].date)
      },
    )
    return
  }
  Alert.alert(title, undefined, [
    ...targets.slice(0, 2).map((d, i) => ({ text: names[i], onPress: () => onSwap(day.date, d.date) })),
    { text: 'Huỷ', style: 'cancel' as const },
  ])
}

/** Bảy buổi của tuần này; hôm nay viền đậm; buổi chưa làm chạm để đổi chỗ. */
export function WeekRail({ days, onSwap, disabled = false }: { days: ExamPlanDay[]; onSwap: (from: string, to: string) => void; disabled?: boolean }) {
  const c = useTheme().colors
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space[5] }}
      style={{ marginHorizontal: -space[5] }}
    >
      {days.map((d) => {
        const past = d.status === 'DONE' || d.status === 'MISSED'
        const now = d.status === 'TODAY'
        const status = d.status === 'DONE' ? 'đã làm' : d.status === 'MISSED' ? 'bỏ lỡ' : now ? 'hôm nay' : d.kind === 'REST' ? 'nghỉ' : 'sắp tới'
        return (
          <Pressable
            key={d.date}
            accessibilityRole={d.movable ? 'button' : undefined}
            accessibilityLabel={`${weekdayShort(d.date)}, ${dayLabel(d)}, ${status}`}
            accessibilityHint={d.movable ? 'Chạm để đổi chỗ với buổi khác' : undefined}
            disabled={!d.movable || disabled}
            onPress={() => askSwap(d, days, onSwap)}
            style={({ pressed }) => ({
              width: 88,
              minHeight: 84,
              padding: space[3],
              gap: space[2],
              borderRadius: radius.md,
              borderWidth: now ? 2 : 1,
              borderColor: now ? c.textPrimary : c.border,
              backgroundColor: now ? c.accentSoft : past ? c.surfaceSunken : c.surface,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <ThemedText variant="label" color={past ? 'muted' : 'primary'}>{weekdayShort(d.date)}</ThemedText>
            <GaGlyph name={d.status === 'DONE' ? 'hoanthanh' : dayGlyph(d)} size={18} ink={past ? 'muted' : undefined} />
            <ThemedText variant="caption" color={past ? 'muted' : 'secondary'} numberOfLines={2} accessibilityLanguage="de-DE">
              {dayLabel(d)}
            </ThemedText>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
