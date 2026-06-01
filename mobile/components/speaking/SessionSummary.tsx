// Final feedback surface for a completed interview session (MVP checklist §5.3).
// Renders the structured InterviewReport: verdict, overall score, strengths,
// critical gaps, recommended drills, and per-phase breakdown.

import { View, ScrollView } from 'react-native'
import { CheckCircle2, AlertTriangle, Target, TrendingUp } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Card, ThemedText, Icon, Pill, Button, ProgressBar } from '@/components/ui'
import type { InterviewReport } from '@/lib/speakingApi'

interface SessionSummaryProps {
  report: InterviewReport
  onPracticeAgain: () => void
  onDone: () => void
}

type Tone = 'success' | 'danger' | 'accent'

function verdictPresentation(verdict: string | null): { label: string; tone: 'success' | 'info' | 'danger' } {
  switch (verdict) {
    case 'PASS':
      return { label: 'Đạt', tone: 'success' }
    case 'CONDITIONAL_PASS':
      return { label: 'Đạt có điều kiện', tone: 'info' }
    case 'NOT_PASS':
      return { label: 'Chưa đạt', tone: 'danger' }
    default:
      return { label: verdict ?? 'Hoàn thành', tone: 'info' }
  }
}

function BulletList({ items, tone, icon }: { items: string[]; tone: Tone; icon: typeof CheckCircle2 }) {
  if (items.length === 0) return null
  return (
    <View style={{ gap: space[2] }}>
      {items.map((item, i) => (
        <View key={`${i}-${item.slice(0, 12)}`} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
          <View style={{ paddingTop: 2 }}>
            <Icon icon={icon} size={16} color={tone} />
          </View>
          <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  )
}

export function SessionSummary({ report, onPracticeAgain, onDone }: SessionSummaryProps) {
  const theme = useTheme()
  const c = theme.colors
  const verdict = verdictPresentation(report.verdict)
  const score = report.overallScore != null ? Math.round(report.overallScore) : null

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[10], gap: space[4] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Verdict + overall score */}
      <Card tone="elevated">
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <Pill label={verdict.label} tone={verdict.tone} />
          {score != null ? (
            <View style={{ alignItems: 'center' }}>
              <ThemedText variant="displayLg">{score}</ThemedText>
              <ThemedText variant="caption" color="muted">
                điểm tổng / 100
              </ThemedText>
            </View>
          ) : null}
          {report.position ? (
            <ThemedText variant="body" color="muted" align="center">
              {report.position}
              {report.readinessLevel ? ` • ${report.readinessLevel}` : ''}
            </ThemedText>
          ) : null}
        </View>
      </Card>

      {report.strongAreas.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Điểm mạnh</ThemedText>
            <BulletList items={report.strongAreas} tone="success" icon={CheckCircle2} />
          </View>
        </Card>
      ) : null}

      {report.criticalGaps.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Cần cải thiện</ThemedText>
            <BulletList items={report.criticalGaps} tone="danger" icon={AlertTriangle} />
          </View>
        </Card>
      ) : null}

      {report.recommendedDrills.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Bài luyện gợi ý</ThemedText>
            <BulletList items={report.recommendedDrills} tone="accent" icon={Target} />
          </View>
        </Card>
      ) : null}

      {report.phaseResults.length > 0 ? (
        <Card>
          <View style={{ gap: space[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon icon={TrendingUp} size={18} color="accent" />
              <ThemedText variant="bodyStrong">Chi tiết theo giai đoạn</ThemedText>
            </View>
            {report.phaseResults.map((phase, i) => {
              const phaseScore = phase.score != null ? Math.round(phase.score) : 0
              return (
                <View key={`${phase.phase}-${i}`} style={{ gap: space[2] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText variant="label" color="secondary">
                      {phase.phase}
                    </ThemedText>
                    <ThemedText variant="label" color="muted">
                      {phaseScore}/100
                    </ThemedText>
                  </View>
                  <ProgressBar value={phaseScore / 100} />
                </View>
              )
            })}
          </View>
        </Card>
      ) : null}

      <View style={{ gap: space[3], marginTop: space[2] }}>
        <Button label="Luyện lại" onPress={onPracticeAgain} icon={TrendingUp} />
        <Button label="Xong" variant="secondary" onPress={onDone} />
      </View>

      <View style={{ height: 1, backgroundColor: c.border, borderRadius: radius.full, opacity: 0 }} />
    </ScrollView>
  )
}
