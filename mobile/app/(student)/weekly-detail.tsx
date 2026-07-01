import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowRight, MessageSquare } from 'lucide-react-native'
import { space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  AppHeader,
  Caption,
  Pill,
  ProgressBar,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { weeklyApi, rubricScore, type WeeklyGrammarError, type WeeklyReplacement } from '@/lib/weeklyApi'

const MAX_SCORE = 5

export default function WeeklyDetailScreen() {
  const c = useTheme().colors
  const params = useLocalSearchParams<{ id: string; title?: string }>()
  const id = Number(params.id)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['weekly-submission', id],
    queryFn: () => weeklyApi.getSubmission(id),
    enabled: Number.isFinite(id),
  })

  const rubric = data?.rubricOrNull ?? null
  const score = rubricScore(rubric)

  return (
    <Screen edges={['top']}>
      <AppHeader title={params.title ?? data?.promptTitle ?? 'Bài nói'} subtitle="Weekly Challenge · Sprechen" onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={120} radius="2xl" />
          <Skeleton height={120} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon={MessageSquare} title="Không tìm thấy bài nộp" />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[5], paddingTop: space[2] }}>
          {/* Score hero — editorial ink card for the key result metric */}
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ gap: space[1] }}>
                <Caption color={c.accent}>Điểm hoàn thành</Caption>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                  <ThemedText variant="displayLg" style={{ color: score != null ? c.onInk : c.onInkMuted }}>
                    {score != null ? String(score) : '—'}
                  </ThemedText>
                  <ThemedText variant="title" style={{ color: c.onInkMuted }}>
                    / {MAX_SCORE}
                  </ThemedText>
                </View>
              </View>
              {data.cefrBand ? <Pill label={data.cefrBand} tone="accent" /> : null}
            </View>
            {score != null ? (
              <ProgressBar value={score / MAX_SCORE} fillColor={c.accent} trackColor={c.onInkMuted} height={6} />
            ) : null}
            {rubric?.feedback_vi_summary ? (
              <ThemedText variant="caption" style={{ color: c.onInkMuted, lineHeight: 18 }}>
                {rubric.feedback_vi_summary}
              </ThemedText>
            ) : null}
          </Card>

          {/* Your answer */}
          {data.transcript ? (
            <Section title="Bạn đã nói">
              <Card>
                <ThemedText variant="body" color="secondary">
                  {data.transcript}
                </ThemedText>
              </Card>
            </Section>
          ) : null}

          {/* Grammar corrections */}
          {(rubric?.grammar?.errors?.length ?? 0) > 0 ? (
            <Section title="Ngữ pháp cần sửa">
              <Card style={{ gap: space[4] }}>
                {rubric!.grammar!.errors!.map((e, i) => (
                  <GrammarRow key={i} error={e} divider={i > 0} />
                ))}
              </Card>
            </Section>
          ) : null}

          {/* Vocabulary upgrades */}
          {(rubric?.lexis?.replacements_suggested_de_vi?.length ?? 0) > 0 ? (
            <Section title="Từ vựng hay hơn">
              <Card style={{ gap: space[4] }}>
                {rubric!.lexis!.replacements_suggested_de_vi!.map((r, i) => (
                  <ReplacementRow key={i} item={r} divider={i > 0} />
                ))}
              </Card>
            </Section>
          ) : null}

          {/* Fluency */}
          {rubric?.fluency?.subjective_notes_de || rubric?.fluency?.confidence_label ? (
            <Section title="Độ trôi chảy">
              <Card style={{ gap: space[2] }}>
                {rubric.fluency?.subjective_notes_de ? (
                  <ThemedText variant="body" color="secondary">
                    {rubric.fluency.subjective_notes_de}
                  </ThemedText>
                ) : null}
                {rubric.fluency?.wpm_approx != null || rubric.fluency?.confidence_label ? (
                  <ThemedText variant="caption" color="faint">
                    {rubric.fluency?.wpm_approx != null ? `~${rubric.fluency.wpm_approx} từ/phút` : ''}
                    {rubric.fluency?.confidence_label ? ` · ${rubric.fluency.confidence_label}` : ''}
                  </ThemedText>
                ) : null}
              </Card>
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
      <Caption>{title}</Caption>
      {children}
    </View>
  )
}

function GrammarRow({ error, divider }: { error: WeeklyGrammarError; divider: boolean }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[1], paddingTop: divider ? space[4] : 0, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
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
  )
}

function ReplacementRow({ item, divider }: { item: WeeklyReplacement; divider: boolean }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: space[1], paddingTop: divider ? space[4] : 0, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
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
  )
}
