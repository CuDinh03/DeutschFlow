// Màn một đề telc (giao diện v3.4, Đợt 4, 19/11/2026) — bản app của /v2/student/mock-exam/practice
// và màn `set` trong mẫu iOS: các Teil theo phần như đề thật, trạng thái từng Teil, "Làm tiếp", thi
// thử trọn đề, phần nói, lịch sử thi thử.

import { useCallback } from 'react'
import { Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import api from '@/lib/api'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { AppHeader, Button, Card, ErrorState, GaGlyph, Icon, Pill, Screen, SectionHeader, Skeleton, ThemedText } from '@/components/ui'
import { getPracticeOverview, type PracticeTeil } from '@/lib/telcPracticeApi'
import type { ExamAttempt } from '@/lib/examApi'
import { CHART_PASS_PCT, scoreBars, type ScoreBar } from '@/lib/examScoreChart'
import { continueTeil, practiceOverviewKey, teilStatus } from '@/lib/practiceTeil'
import { checkedCount, sectionShort } from '@/lib/examHub'
import { fullExamRoute, oralRoute, teilRoute } from '@/lib/examRoutes'
import { go } from '@/components/exam/hub/HubCards'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

const SECTION_ORDER = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'] as const
const SECTION_GLYPH: Record<string, GlyphName> = { LESEN: 'doc', SPRACHBAUSTEINE: 'nguphap', HOEREN: 'nghe', SCHREIBEN: 'viet' }
/** Dạng bài người học nhận ra (như mẫu iOS). */
const TYPE_HINT: Record<string, string> = {
  'LESEN-1': 'Nối tiêu đề với bài',
  'LESEN-2': 'Đọc bài báo, chọn a, b, c',
  'LESEN-3': 'Ghép tình huống với rao vặt',
  'SPRACHBAUSTEINE-1': 'Điền ô trống a, b, c',
  'SPRACHBAUSTEINE-2': 'Điền từ trong hộp',
  'HOEREN-1': 'Mẩu tin, đúng hay sai',
  'HOEREN-2': 'Phỏng vấn, đúng hay sai',
  'HOEREN-3': 'Hội thoại ngắn, đúng hay sai',
  'SCHREIBEN-1': 'Viết thư trả lời',
}

export default function ExamSetScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>()
  return <ExamSet key={examId ?? 'none'} examId={Number(examId)} />
}

function ExamSet({ examId }: { examId: number }) {
  const c = useTheme().colors
  const goBack = useBackTo(PARENT_OF['exam-set'])
  const { data: overview, isLoading, isError, refetch } = useQuery({
    queryKey: practiceOverviewKey(examId),
    queryFn: () => getPracticeOverview(examId),
    enabled: Number.isFinite(examId),
  })
  const { data: attempts = [], refetch: refetchAttempts } = useQuery({
    queryKey: ['exam-attempts-me'],
    queryFn: () =>
      api.get<ExamAttempt[]>('/mock-exams/attempts/me', { params: { includePartial: true } }).then((r) => r.data ?? []),
    staleTime: 30_000,
  })
  // Quay về từ một Teil: điểm và trạng thái phải mới.
  useFocusEffect(
    useCallback(() => {
      void refetch()
      void refetchAttempts()
    }, [refetch, refetchAttempts]),
  )

  const mine = attempts.filter((a) => a.exam_id === examId)
  const running = mine.find((a) => a.status === 'IN_PROGRESS')
  const finished = mine
    .filter((a) => a.status === 'COMPLETED' || a.status === 'PARTIAL')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    .slice(0, 6)
  const resume = overview ? continueTeil(overview) : null
  const max = overview?.teile.reduce((s, t) => s + t.maxPoints, 0) ?? 0

  return (
    <Screen edges={['top']}>
      <AppHeader title={overview?.title ?? 'Đề luyện'} subtitle={overview ? `telc Deutsch ${overview.level}` : undefined} onBack={goBack} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={90} radius="lg" />
          <Skeleton height={300} radius="lg" />
        </View>
      ) : isError || !overview ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[12], gap: space[5] }}>
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
            <Pill label={`Đã làm ${checkedCount(overview)}/${overview.teile.length} Teil`} />
            {finished[0]?.total_score != null && max > 0 ? <Pill label={`Thi thử gần nhất ${finished[0].total_score}/${max}`} tone="info" /> : null}
          </View>

          {resume ? (
            <Card onPress={() => go(teilRoute(examId, resume.key))} style={{ borderWidth: 1.5, borderColor: c.textPrimary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <GaGlyph name="danghoc" size={24} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="bodyStrong">Làm tiếp {sectionShort(resume.section)} · Teil {resume.teil}</ThemedText>
                  <ThemedText variant="caption" color="muted">{teilStatus(resume).text}</ThemedText>
                </View>
                <Icon icon={ChevronRight} size={18} color="faint" />
              </View>
            </Card>
          ) : null}

          {SECTION_ORDER.map((sec) => {
            const teile = overview.teile.filter((t) => t.section === sec)
            if (teile.length === 0) return null
            return (
              <View key={sec} style={{ gap: space[3] }}>
                <SectionHeader title={sectionShort(sec)} />
                <TeilList teile={teile} examId={examId} glyph={SECTION_GLYPH[sec]} />
              </View>
            )
          })}

          <View style={{ gap: space[3] }}>
            <SectionHeader title="Sprechen" />
            <Card onPress={() => go(oralRoute({ level: overview.level }))}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <GaGlyph name="noi" size={22} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="bodyStrong">Thi nói 3 Teil với giám khảo AI</ThemedText>
                  <ThemedText variant="caption" color="muted">Khoảng 15 phút, cần micro</ThemedText>
                </View>
                <Icon icon={ChevronRight} size={18} color="faint" />
              </View>
            </Card>
          </View>

          <View style={{ gap: space[2] }}>
            <Button
              label={running ? 'Làm tiếp bài thi thử' : 'Thi thử trọn đề'}
              variant="primary"
              onPress={() => go(fullExamRoute(examId))}
            />
            <ThemedText variant="caption" color="muted" align="center">
              Lesen, Sprachbausteine, Hören, Schreiben liền nhau như thi thật.
            </ThemedText>
          </View>

          {finished.length > 0 ? (
            <View style={{ gap: space[3] }}>
              <SectionHeader title="Lịch sử thi thử" />
              <ScoreChart bars={scoreBars(attempts, examId, max)} />
              {finished.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Lượt thi thử ${a.total_score ?? 0} điểm, xem lại`}
                  onPress={() => router.push({ pathname: '/(student)/exam-review', params: { attemptId: String(a.id), title: overview.title } } as unknown as Href)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44, opacity: pressed ? 0.7 : 1 })}
                >
                  <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>
                    {(a.finished_at ?? a.started_at).slice(0, 10).split('-').reverse().join('/')}
                    {a.status === 'PARTIAL' ? ' · dừng giữa chừng' : ''}
                  </ThemedText>
                  <ThemedText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                    {a.total_score ?? 0}
                    {max > 0 ? `/${max}` : ''}
                  </ThemedText>
                  <Icon icon={ChevronRight} size={16} color="faint" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </Screen>
      )}
    </Screen>
  )
}

const CHART_HEIGHT = 120
/** Chiều cao của cột 100% — chừa chỗ cho số điểm trên đầu cột. */
const BAR_SPAN = CHART_HEIGHT - 20

/**
 * Điểm phần viết các lượt nộp đủ gần nhất (mẫu `set`): cột theo %, vạch đứt 60%, cột đạt màu navy, lượt
 * mới nhất màu vàng. Dựng bằng View, không thêm thư viện biểu đồ. Chưa có lượt nộp đủ thì không vẽ.
 */
function ScoreChart({ bars }: { bars: ScoreBar[] }) {
  const c = useTheme().colors
  if (bars.length === 0) return null
  const summary = bars.map((b) => `${b.label}: ${b.pct}%`).join(', ')
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Điểm phần viết ${bars.length} lượt thi thử gần nhất, mức đỗ 60%. ${summary}`}
      style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: space[4], gap: space[2] }}
    >
      <ThemedText variant="caption" color="muted">Phần viết · % điểm từng lượt nộp đủ</ThemedText>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2], height: CHART_HEIGHT }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (BAR_SPAN * CHART_PASS_PCT) / 100,
              borderTopWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: c.textPrimary,
              zIndex: 1,
            }}
          >
            <ThemedText variant="caption" style={{ position: 'absolute', left: 0, top: 2, fontFamily: fonts.bodyBold, backgroundColor: c.surface, paddingRight: space[1] }}>
              60%
            </ThemedText>
          </View>
          {bars.map((b) => (
            <View key={b.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_HEIGHT }}>
              <ThemedText variant="label" style={{ fontVariant: ['tabular-nums'], marginBottom: 2 }}>{b.pct}</ThemedText>
              <View
                style={{
                  alignSelf: 'stretch',
                  height: Math.max(8, (BAR_SPAN * b.pct) / 100),
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: b.latest ? c.accent : b.passed ? c.info : c.borderStrong,
                  borderWidth: b.latest ? 1.5 : 0,
                  borderColor: c.textPrimary,
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[1] }}>
          {bars.map((b) => (
            <ThemedText key={b.id} variant="caption" color="muted" align="center" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
              {b.label}
            </ThemedText>
          ))}
        </View>
      </View>
    </View>
  )
}

function TeilList({ teile, examId, glyph }: { teile: PracticeTeil[]; examId: number; glyph: GlyphName }) {
  const c = useTheme().colors
  const toneColor = { new: c.textMuted, doing: c.textPrimary, pass: c.success, fail: c.danger } as const
  return (
    <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
      {teile.map((t, i) => {
        const st = teilStatus(t)
        const hint = TYPE_HINT[t.key]
        return (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={`${sectionShort(t.section)} Teil ${t.teil}${hint ? `, ${hint}` : ''}, ${st.text}`}
            onPress={() => go(teilRoute(examId, t.key))}
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
              <GaGlyph name={st.tone === 'pass' ? 'hoanthanh' : glyph} size={22} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong" accessibilityLanguage="de-DE">Teil {t.teil}</ThemedText>
              {hint ? <ThemedText variant="caption" color="muted">{hint}</ThemedText> : null}
              <ThemedText variant="label" style={{ color: toneColor[st.tone], fontVariant: ['tabular-nums'] }}>{st.text}</ThemedText>
            </View>
            {t.suggestMinutes ? <ThemedText variant="caption" color="muted">{t.suggestMinutes} phút</ThemedText> : null}
            <Icon icon={ChevronRight} size={16} color="faint" />
          </Pressable>
        )
      })}
    </View>
  )
}
