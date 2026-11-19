// Final feedback surface for a completed interview session (MVP checklist §5.3).
// Renders the structured InterviewReport: verdict, overall score, strengths,
// critical gaps, recommended drills, and per-phase breakdown.

import { View, ScrollView } from 'react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { radius, space, useTheme } from '@/lib/theme'
import { Card, ThemedText, Pill, Button, ProgressBar, GaGlyph } from '@/components/ui'
import type { InterviewReport } from '@/lib/speakingApi'
import { phaseLabel } from '@/lib/speakingChat'
import { formatScore10 } from '@/lib/interviewHub'

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

// Audit 24/07 R-G3: điểm phỏng vấn ở backend là thang 0–10 (InterviewReportService), KHÔNG phải
// /100. Trước đây UI dán nhãn "/100" + progress bar chia 100 nên 7.5/10 hiện thành "8 / 100" và
// thanh chỉ ~8%. Hiển thị nguyên thang /10, giữ 1 chữ số thập phân khi có phần lẻ.
const SCORE_MAX = 10
function scoreFraction(score: number): number {
  return Math.max(0, Math.min(1, score / SCORE_MAX))
}

function BulletList({ items, tone, glyph }: { items: string[]; tone: Tone; glyph: GlyphName }) {
  if (items.length === 0) return null
  return (
    <View style={{ gap: space[2] }}>
      {items.map((item, i) => (
        <View key={`${i}-${item.slice(0, 12)}`} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
          <View style={{ paddingTop: 2 }}>
            <GaGlyph name={glyph} size={16} ink={tone} gold={tone} />
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
  const score = report.overallScore != null ? report.overallScore : null

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[10], gap: space[4] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Giao diện v3.4 (Đợt 5, mẫu `feedback`): điểm lớn thang /10 + kết luận, thanh điểm từng phần ngay dưới. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
            Điểm buổi phỏng vấn
          </ThemedText>
          {score != null ? (
            <View
              accessible
              accessibilityLabel={`${formatScore10(score)} trên 10`}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}
            >
              <ThemedText variant="displayLg" style={{ fontSize: 56, lineHeight: 60 }}>{formatScore10(score)}</ThemedText>
              <ThemedText variant="titleLg" color="muted">/10</ThemedText>
            </View>
          ) : (
            <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }}>Chưa có điểm tổng</ThemedText>
          )}
        </View>
        <Pill label={verdict.label} tone={verdict.tone} />
      </View>
      {report.position ? (
        <ThemedText variant="body" color="muted" accessibilityLanguage="de-DE">
          {report.position}
          {report.readinessLevel ? ` · ${report.readinessLevel}` : ''}
        </ThemedText>
      ) : null}

      {report.phaseResults.length > 0 ? (
        <View style={{ gap: space[2] }}>
          {report.phaseResults.map((phase, i) => {
            // Pha chưa chấm (phiếu dựng khi phiên kết thúc mà AI chưa chấm): "—", không vẽ thanh 0.
            const phaseScore = phase.score
            return (
              <View
                key={`${phase.phase}-${i}`}
                accessible
                accessibilityLabel={`${phaseLabel(phase.phase)}: ${phaseScore != null ? `${formatScore10(phaseScore)} trên 10` : 'chưa chấm'}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
              >
                <ThemedText variant="label" color="secondary" style={{ width: 92 }} numberOfLines={1}>
                  {phaseLabel(phase.phase)}
                </ThemedText>
                {phaseScore != null ? (
                  <ProgressBar value={scoreFraction(phaseScore)} style={{ flex: 1 }} fillColor={phaseScore >= 6 ? c.success : c.accent} />
                ) : (
                  <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceSunken }} />
                )}
                <ThemedText variant="label" style={{ width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {phaseScore != null ? formatScore10(phaseScore) : '—'}
                </ThemedText>
              </View>
            )
          })}
        </View>
      ) : null}

      {report.strongAreas.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Điểm mạnh</ThemedText>
            <BulletList items={report.strongAreas} tone="success" glyph="hoanthanh" />
          </View>
        </Card>
      ) : null}

      {report.criticalGaps.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Cần cải thiện</ThemedText>
            <BulletList items={report.criticalGaps} tone="danger" glyph="canhbao" />
          </View>
        </Card>
      ) : null}

      {report.recommendedDrills.length > 0 ? (
        <Card>
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">Bài luyện gợi ý</ThemedText>
            <BulletList items={report.recommendedDrills} tone="accent" glyph="muctieu" />
          </View>
        </Card>
      ) : null}

      <View style={{ gap: space[3], marginTop: space[2] }}>
        <Button label="Luyện lại" onPress={onPracticeAgain} glyph="thongke" />
        <Button label="Xong" variant="secondary" onPress={onDone} />
      </View>

      <View style={{ height: 1, backgroundColor: c.border, borderRadius: radius.full, opacity: 0 }} />
    </ScrollView>
  )
}
