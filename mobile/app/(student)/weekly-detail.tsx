import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { ArrowLeft, ArrowRight } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  ThemedText,
  Icon,
  IconButton,
  Pill,
  ProgressBar,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { markSegments } from '@/lib/correctionMarks'
import { weeklyScoreLabel, wpmRatio } from '@/lib/weeklyUi'
import { weeklyApi, rubricScore, type WeeklyGrammarError, type WeeklyReplacement } from '@/lib/weeklyApi'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

const MAX_SCORE = 5

export default function WeeklyDetailScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['weekly-detail'])
  const c = useTheme().colors
  const params = useLocalSearchParams<{ id: string; title?: string; week?: string }>()
  const id = Number(params.id)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['weekly-submission', id],
    queryFn: () => weeklyApi.getSubmission(id),
    enabled: Number.isFinite(id),
  })

  const rubric = data?.rubricOrNull ?? null
  const score = rubricScore(rubric)
  const verdict = weeklyScoreLabel(score)
  const errors = rubric?.grammar?.errors ?? []
  const segments = data?.transcript ? markSegments(data.transcript, errors.map((e) => e.wrong_span)) : []

  return (
    <Screen edges={['top']}>
      {/* Đầu màn theo mẫu v3.4 `weeklyd` (Đợt 5C) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingTop: space[2], gap: space[2] }}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Quay lại" onPress={goBack} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ThemedText variant="label" numberOfLines={1}>
            {params.week ? `Thử thách tuần ${params.week} · Sprechen` : 'Thử thách tuần · Sprechen'}
          </ThemedText>
          <ThemedText variant="caption" color="muted" numberOfLines={1}>{params.title ?? data?.promptTitle ?? ''}</ThemedText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={120} radius="2xl" />
          <Skeleton height={120} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState glyph="hoithoai" title="Không tìm thấy bài nộp" />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[5], paddingTop: space[2] }}>
          {/* Điểm hoàn thành (mẫu `weeklyd`): số lớn giữa thẻ, nhãn kết luận */}
          <View style={{ padding: space[5], borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', gap: space[2] }}>
            <ThemedText variant="caption" color="secondary">Điểm hoàn thành</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <ThemedText variant="displayLg" style={{ fontSize: 60, lineHeight: 64 }}>{score != null ? String(score) : '—'}</ThemedText>
              <ThemedText variant="title" color="muted">{`/${MAX_SCORE}`}</ThemedText>
            </View>
            {verdict ? <Pill label={verdict.label} tone={verdict.tone} /> : null}
            {data.cefrBand ? <ThemedText variant="caption" color="muted">{`Trình độ ${data.cefrBand}`}</ThemedText> : null}
            {rubric?.feedback_vi_summary ? (
              <ThemedText variant="body" color="secondary" align="center">{rubric.feedback_vi_summary}</ThemedText>
            ) : null}
          </View>

          {/* Lời đã nói — gạch chỗ sai ngữ pháp (cùng cách đánh dấu với phòng phỏng vấn) */}
          {data.transcript ? (
            <Section title="Bạn đã nói">
              <View style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: c.surfaceSunken }}>
                <ThemedText variant="body" style={{ lineHeight: 26 }}>
                  {segments.map((seg, i) =>
                    seg.mark == null ? (
                      <ThemedText key={i} variant="body">{seg.text}</ThemedText>
                    ) : (
                      <ThemedText
                        key={i}
                        variant="body"
                        style={{ color: c.textPrimary, textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: c.danger, fontWeight: '600' }}
                      >
                        {seg.text}
                      </ThemedText>
                    ),
                  )}
                </ThemedText>
              </View>
            </Section>
          ) : null}

          {/* Grammar corrections */}
          {errors.length > 0 ? (
            <Section title="Ngữ pháp cần sửa">
              <View style={{ gap: space[4] }}>
                {errors.map((e, i) => (
                  <GrammarRow key={i} index={i + 1} error={e} />
                ))}
              </View>
            </Section>
          ) : null}

          {/* Vocabulary upgrades */}
          {(rubric?.lexis?.replacements_suggested_de_vi?.length ?? 0) > 0 ? (
            <Section title="Từ vựng hay hơn">
              <View style={{ gap: space[4] }}>
                {rubric!.lexis!.replacements_suggested_de_vi!.map((r, i) => (
                  <ReplacementRow key={i} item={r} />
                ))}
              </View>
            </Section>
          ) : null}

          {/* Fluency */}
          {rubric?.fluency?.subjective_notes_de || rubric?.fluency?.confidence_label ? (
            <Section title="Độ trôi chảy">
              <View style={{ gap: space[2] }}>
                {rubric.fluency?.wpm_approx != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }} accessible accessibilityLabel={`Khoảng ${rubric.fluency.wpm_approx} từ mỗi phút`}>
                    <ThemedText variant="caption" color="secondary" style={{ width: 64 }}>Từ / phút</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ProgressBar value={wpmRatio(rubric.fluency.wpm_approx)} fillColor={c.success} height={8} />
                    </View>
                    <ThemedText variant="mono" style={{ width: 36, textAlign: 'right' }}>{String(rubric.fluency.wpm_approx)}</ThemedText>
                  </View>
                ) : null}
                {rubric.fluency?.subjective_notes_de ? (
                  <ThemedText variant="body" color="secondary">
                    {rubric.fluency.subjective_notes_de}
                  </ThemedText>
                ) : null}
                {rubric.fluency?.confidence_label ? (
                  <ThemedText variant="caption" color="faint">{rubric.fluency.confidence_label}</ThemedText>
                ) : null}
              </View>
            </Section>
          ) : null}

          {rubric?.disclaimer_vi ? (
            <ThemedText variant="caption" color="faint" align="center">
              {rubric.disclaimer_vi}
            </ThemedText>
          ) : null}
        </Screen>
      )}
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[3] }}>
      <ThemedText variant="title">{title}</ThemedText>
      {children}
    </View>
  )
}

function NumberBadge({ text, tone }: { text: string; tone: 'danger' | 'accent' }) {
  const c = useTheme().colors
  return (
    <View style={{ minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'danger' ? c.danger : c.accent }}>
      <ThemedText variant="label" style={{ color: tone === 'danger' ? c.onInk : c.onAccent }}>{text}</ThemedText>
    </View>
  )
}

function GrammarRow({ error, index }: { error: WeeklyGrammarError; index: number }) {
  const c = useTheme().colors
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <NumberBadge text={String(index)} tone="danger" />
      <View style={{ flex: 1, gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          {error.wrong_span ? (
            <ThemedText variant="bodyStrong" style={{ color: c.danger, textDecorationLine: 'line-through' }}>
              {error.wrong_span}
            </ThemedText>
          ) : null}
          <Icon icon={ArrowRight} size={13} color="faint" />
          <ThemedText variant="bodyStrong" style={{ color: c.success }}>
            {error.corrected_span}
          </ThemedText>
        </View>
        {error.rule_vi_short ? (
          <ThemedText variant="caption" color="muted">
            {error.rule_vi_short}
          </ThemedText>
        ) : null}
      </View>
    </View>
  )
}

function ReplacementRow({ item }: { item: WeeklyReplacement }) {
  const c = useTheme().colors
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <NumberBadge text="→" tone="accent" />
      <View style={{ flex: 1, gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <ThemedText variant="bodyStrong" color="muted">
            {item.from_de}
          </ThemedText>
          <Icon icon={ArrowRight} size={13} color="faint" />
          <ThemedText variant="bodyStrong" style={{ color: c.success }}>
            {item.to_de_suggestion}
          </ThemedText>
        </View>
        {item.note_vi ? (
          <ThemedText variant="caption" color="faint">
            {item.note_vi}
          </ThemedText>
        ) : null}
      </View>
    </View>
  )
}
