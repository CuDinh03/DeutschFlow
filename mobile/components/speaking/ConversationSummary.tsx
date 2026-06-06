// End-of-session evaluation for a COMMUNICATION / LESSON speaking session.
// Renders the AI ConversationReport: score + estimated level, summary, strengths,
// improvements, grammar/vocabulary/fluency notes, next steps, and encouragement.

import { View, ScrollView } from 'react-native'
import { CheckCircle2, AlertTriangle, Target, TrendingUp, Sparkles, BookOpen } from 'lucide-react-native'
import { space, useTheme } from '@/lib/theme'
import { Card, ThemedText, Icon, Pill, Button } from '@/components/ui'
import type { ConversationReport } from '@/lib/speakingApi'

interface ConversationSummaryProps {
  report: ConversationReport
  onPracticeAgain: () => void
  onDone: () => void
}

type Tone = 'success' | 'danger' | 'accent' | 'info'

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

export function ConversationSummary({ report, onPracticeAgain, onDone }: ConversationSummaryProps) {
  const score = report.overallScore != null ? Math.round(report.overallScore * 10) / 10 : null
  const hasGrammar = !!report.grammarAccuracy || report.commonErrors.length > 0
  const hasAnyContent =
    score != null ||
    !!report.summary ||
    report.strengths.length > 0 ||
    report.improvements.length > 0 ||
    hasGrammar ||
    !!report.vocabulary ||
    !!report.fluency ||
    report.recommendedNext.length > 0 ||
    !!report.encouragement

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[10], gap: space[4] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Score + estimated level */}
      <Card tone="elevated">
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[2] }}>
          <Pill label={`Luyện nói${report.levelEstimate ? ` • ${report.levelEstimate}` : ''}`} tone="info" />
          {score != null ? (
            <View style={{ alignItems: 'center' }}>
              <ThemedText variant="displayLg">{score}</ThemedText>
              <ThemedText variant="caption" color="muted">
                điểm / 10
              </ThemedText>
            </View>
          ) : null}
          {report.summary ? (
            <ThemedText variant="body" color="muted" align="center">
              {report.summary}
            </ThemedText>
          ) : null}
          {!hasAnyContent ? (
            <ThemedText variant="body" color="muted" align="center">
              Buổi luyện nói đã hoàn thành! 🎉{'\n'}Lần này chưa có đánh giá chi tiết, nhưng mỗi câu bạn nói đều là một bước tiến. Tiếp tục luyện nhé!
            </ThemedText>
          ) : null}
        </View>
      </Card>

      {report.strengths.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Điểm mạnh</ThemedText>
            <BulletList items={report.strengths} tone="success" icon={CheckCircle2} />
          </View>
        </Card>
      ) : null}

      {report.improvements.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Cần cải thiện</ThemedText>
            <BulletList items={report.improvements} tone="danger" icon={AlertTriangle} />
          </View>
        </Card>
      ) : null}

      {hasGrammar ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
              <ThemedText variant="bodyStrong">Ngữ pháp</ThemedText>
              {report.grammarAccuracy ? <Pill label={report.grammarAccuracy} tone="accent" /> : null}
            </View>
            <BulletList items={report.commonErrors} tone="danger" icon={AlertTriangle} />
          </View>
        </Card>
      ) : null}

      {report.vocabulary || report.fluency ? (
        <Card>
          <View style={{ gap: space[3] }}>
            {report.vocabulary ? (
              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <View style={{ paddingTop: 2 }}>
                  <Icon icon={BookOpen} size={16} color="info" />
                </View>
                <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>
                  {report.vocabulary}
                </ThemedText>
              </View>
            ) : null}
            {report.fluency ? (
              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <View style={{ paddingTop: 2 }}>
                  <Icon icon={Sparkles} size={16} color="accent" />
                </View>
                <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>
                  {report.fluency}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {report.recommendedNext.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Luyện tiếp theo</ThemedText>
            <BulletList items={report.recommendedNext} tone="accent" icon={Target} />
          </View>
        </Card>
      ) : null}

      {report.encouragement ? (
        <Card tone="elevated">
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
            <View style={{ paddingTop: 2 }}>
              <Icon icon={Sparkles} size={18} color="accent" />
            </View>
            <ThemedText variant="body" color="primary" style={{ flex: 1 }}>
              {report.encouragement}
            </ThemedText>
          </View>
        </Card>
      ) : null}

      <View style={{ gap: space[3], marginTop: space[2] }}>
        <Button label="Luyện lại" onPress={onPracticeAgain} icon={TrendingUp} />
        <Button label="Xong" variant="secondary" onPress={onDone} />
      </View>
    </ScrollView>
  )
}
