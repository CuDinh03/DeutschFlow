import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Star, ArrowRight, MessageSquare, Sparkles, BookOpen, Gauge } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { weeklyApi, rubricScore, type WeeklyGrammarError, type WeeklyReplacement } from '@/lib/weeklyApi'

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
      <AppHeader title={params.title ?? data?.promptTitle ?? 'Bài nói'} subtitle={data?.cefrBand ?? undefined} onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={90} radius="2xl" />
          <Skeleton height={120} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon={MessageSquare} title="Không tìm thấy bài nộp" />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[3], paddingTop: space[2] }}>
          {/* Score */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon icon={Star} size={18} color="accent" fill />
                <ThemedText variant="bodyStrong">Điểm hoàn thành</ThemedText>
              </View>
              <ThemedText variant="monoLg" color={score != null ? 'accent' : 'faint'}>
                {score != null ? `${score}/5` : '—'}
              </ThemedText>
            </View>
            {rubric?.feedback_vi_summary ? (
              <ThemedText variant="caption" color="secondary" style={{ marginTop: space[2] }}>
                {rubric.feedback_vi_summary}
              </ThemedText>
            ) : null}
          </Card>

          {/* Your answer */}
          {data.transcript ? (
            <Section icon={MessageSquare} title="Bạn đã nói">
              <Card>
                <ThemedText variant="body" color="secondary">
                  {data.transcript}
                </ThemedText>
              </Card>
            </Section>
          ) : null}

          {/* Grammar corrections */}
          {(rubric?.grammar?.errors?.length ?? 0) > 0 ? (
            <Section icon={Sparkles} title="Ngữ pháp cần sửa">
              <Card style={{ gap: space[3] }}>
                {rubric!.grammar!.errors!.map((e, i) => (
                  <GrammarRow key={i} error={e} divider={i > 0} />
                ))}
              </Card>
            </Section>
          ) : null}

          {/* Vocabulary upgrades */}
          {(rubric?.lexis?.replacements_suggested_de_vi?.length ?? 0) > 0 ? (
            <Section icon={BookOpen} title="Từ vựng hay hơn">
              <Card style={{ gap: space[3] }}>
                {rubric!.lexis!.replacements_suggested_de_vi!.map((r, i) => (
                  <ReplacementRow key={i} item={r} divider={i > 0} />
                ))}
              </Card>
            </Section>
          ) : null}

          {/* Fluency */}
          {rubric?.fluency?.subjective_notes_de || rubric?.fluency?.confidence_label ? (
            <Section icon={Gauge} title="Độ trôi chảy">
              <Card style={{ gap: space[1] }}>
                {rubric.fluency?.subjective_notes_de ? (
                  <ThemedText variant="caption" color="secondary">
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

function Section({ icon, title, children }: { icon: typeof Star; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon icon={icon} size={16} color="accent" />
        <ThemedText variant="label" color="muted">
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  )
}

function GrammarRow({ error, divider }: { error: WeeklyGrammarError; divider: boolean }) {
  const c = useTheme().colors
  return (
    <View style={{ gap: 4, paddingTop: divider ? space[3] : 0, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {error.wrong_span ? (
          <ThemedText variant="caption" style={{ color: c.danger, textDecorationLine: 'line-through' }}>
            {error.wrong_span}
          </ThemedText>
        ) : null}
        <Icon icon={ArrowRight} size={12} color="faint" />
        <ThemedText variant="caption" style={{ color: c.success }}>
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
    <View style={{ gap: 4, paddingTop: divider ? space[3] : 0, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <ThemedText variant="caption" color="muted">
          {item.from_de}
        </ThemedText>
        <Icon icon={ArrowRight} size={12} color="faint" />
        <ThemedText variant="caption" style={{ color: c.success }}>
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
