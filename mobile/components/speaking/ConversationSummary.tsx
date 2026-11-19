// End-of-session evaluation for a COMMUNICATION / LESSON speaking session.
// Renders the AI ConversationReport: score + estimated level, summary, strengths,
// improvements, grammar/vocabulary/fluency notes, next steps, and encouragement.
//
// Giao diện v3.4 (mẫu `speakreport`, Đợt 5 phần C, 19/11/2026): eyebrow + tiêu đề có vệt vàng theo
// điểm, điểm lớn /10, điểm mạnh đánh dấu "+", việc cần sửa đánh số, bài luyện gợi ý dạng danh sách.
// Mẫu vẽ thanh điểm Trôi chảy / Ngữ pháp / Từ vựng: báo cáo chưa có điểm số từng mặt (chỉ có nhận xét
// chữ) nên hiện nhận xét, không bịa số.

import { Pressable, ScrollView, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { BrushMark, Button, GaGlyph, Icon, Pill, ThemedText } from '@/components/ui'
import type { ConversationReport } from '@/lib/speakingApi'
import { conversationHeadline } from '@/lib/weeklyUi'

interface ConversationSummaryProps {
  report: ConversationReport
  onPracticeAgain: () => void
  onDone: () => void
  /** Mở Sửa lỗi — dòng gợi ý khi buổi có lỗi ngữ pháp. */
  onOpenErrors?: () => void
}

/**
 * Ô số/ký hiệu: nền nhạt + viền màu, chữ MỰC — chữ màu trên nền nhạt và chữ sáng trên nền đặc xanh/đỏ
 * đều dưới 4,5:1 (soát Đợt 5C).
 */
function Badge({ text, tone }: { text: string; tone: 'success' | 'danger' | 'accent' }) {
  const c = useTheme().colors
  const bg = tone === 'success' ? c.successSoft : tone === 'danger' ? c.dangerSoft : c.accentSoft
  const fg = c.textPrimary
  return (
    <View style={{ minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 12, backgroundColor: bg, borderWidth: 1.5, borderColor: tone === 'success' ? c.success : tone === 'danger' ? c.danger : c.accent, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText variant="label" style={{ color: fg }}>{text}</ThemedText>
    </View>
  )
}

function NoteRow({ badge, children }: { badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <View style={{ paddingTop: 1 }}>{badge}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <ThemedText variant="title" style={{ marginTop: space[2] }}>{children}</ThemedText>
}

export function ConversationSummary({ report, onPracticeAgain, onDone, onOpenErrors }: ConversationSummaryProps) {
  const c = useTheme().colors
  const score = report.overallScore != null ? Math.round(report.overallScore * 10) / 10 : null
  const head = conversationHeadline(score)
  const fixes = [...report.commonErrors, ...report.improvements]
  const hasAnyContent =
    score != null ||
    !!report.summary ||
    report.strengths.length > 0 ||
    fixes.length > 0 ||
    !!report.grammarAccuracy ||
    !!report.vocabulary ||
    !!report.fluency ||
    report.recommendedNext.length > 0 ||
    !!report.encouragement

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[10], gap: space[3] }}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
        {`Kết quả luyện nói${report.topic ? ` · ${report.topic}` : ''}`}
      </ThemedText>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space[2] }}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${head.mark} ${head.after}`.trim()}
      >
        <BrushMark>{head.mark}</BrushMark>
        {head.after ? <ThemedText variant="display">{head.after}</ThemedText> : null}
      </View>

      <View style={{ padding: space[4], borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <ThemedText variant="caption" color="secondary">Điểm buổi nói</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <ThemedText variant="displayLg" style={{ fontSize: 48, lineHeight: 52 }}>
                {score != null ? String(score).replace('.', ',') : '—'}
              </ThemedText>
              <ThemedText variant="title" color="muted">/10</ThemedText>
            </View>
          </View>
          {report.levelEstimate ? <Pill label={`Ước tính ${report.levelEstimate}`} tone="accent" /> : null}
        </View>
        {report.summary ? <ThemedText variant="body" color="secondary">{report.summary}</ThemedText> : null}
        {!hasAnyContent ? (
          <ThemedText variant="body" color="secondary">
            Buổi luyện nói đã hoàn thành. Lần này chưa có đánh giá chi tiết, nhưng mỗi câu bạn nói đều là một bước tiến.
          </ThemedText>
        ) : null}
      </View>

      {report.strengths.length > 0 ? (
        <>
          <SectionTitle>Điểm mạnh</SectionTitle>
          {report.strengths.map((t, i) => (
            <NoteRow key={`s${i}`} badge={<Badge text="+" tone="success" />}>
              <ThemedText variant="body" color="secondary">{t}</ThemedText>
            </NoteRow>
          ))}
        </>
      ) : null}

      {fixes.length > 0 || report.grammarAccuracy ? (
        <>
          <SectionTitle>Cần cải thiện</SectionTitle>
          {report.grammarAccuracy ? (
            <ThemedText variant="caption" color="secondary">{`Độ chính xác ngữ pháp: ${report.grammarAccuracy}`}</ThemedText>
          ) : null}
          {fixes.map((t, i) => (
            <NoteRow key={`f${i}`} badge={<Badge text={String(i + 1)} tone="danger" />}>
              <ThemedText variant="body" color="secondary">{t}</ThemedText>
            </NoteRow>
          ))}
        </>
      ) : null}

      {report.vocabulary || report.fluency ? (
        <>
          <SectionTitle>Từ vựng và độ trôi chảy</SectionTitle>
          {report.vocabulary ? (
            <NoteRow badge={<GaGlyph name="tuvung" size={20} ink="primary" />}>
              <ThemedText variant="body" color="secondary">{report.vocabulary}</ThemedText>
            </NoteRow>
          ) : null}
          {report.fluency ? (
            <NoteRow badge={<GaGlyph name="noi" size={20} ink="primary" />}>
              <ThemedText variant="body" color="secondary">{report.fluency}</ThemedText>
            </NoteRow>
          ) : null}
        </>
      ) : null}

      {report.recommendedNext.length > 0 || (onOpenErrors && report.commonErrors.length > 0) ? (
        <>
          <SectionTitle>Bài luyện gợi ý</SectionTitle>
          <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            {onOpenErrors && report.commonErrors.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở Sửa lỗi"
                onPress={onOpenErrors}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}
              >
                <GaGlyph name="sualoi" size={20} ink="primary" />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="bodyStrong">Sửa lỗi</ThemedText>
                  <ThemedText variant="caption" color="secondary">Ôn lại các lỗi ngữ pháp vừa gặp</ThemedText>
                </View>
                <Icon icon={ChevronRight} size={16} color="faint" />
              </Pressable>
            ) : null}
            {report.recommendedNext.map((t, i) => (
              <View
                key={`n${i}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3],
                  borderTopWidth: i === 0 && !(onOpenErrors && report.commonErrors.length > 0) ? 0 : 1, borderTopColor: c.border,
                }}
              >
                <GaGlyph name="muctieu" size={20} ink="primary" />
                <ThemedText variant="body" style={{ flex: 1 }}>{t}</ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {report.encouragement ? (
        <View style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: c.accentSoft }}>
          <ThemedText variant="body">{report.encouragement}</ThemedText>
        </View>
      ) : null}

      <View style={{ gap: space[2], marginTop: space[3] }}>
        <Button label="Luyện lại" onPress={onPracticeAgain} />
        <Button label="Xong" variant="secondary" onPress={onDone} />
      </View>
    </ScrollView>
  )
}
