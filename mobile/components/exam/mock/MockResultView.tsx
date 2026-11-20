// Kết quả thi thử trọn đề (mẫu v3.4 `mockres`, Đợt 4b 19/11/2026). Gương `ResultSummary` của web:
// tiêu đề là kết luận, hai ô ngưỡng (phần viết · phần nói) có vạch ngưỡng và nhãn "Ước tính", "Lấy lại
// điểm" (ba chỗ mất nhiều nhất), điểm từng phần thu gọn, phân tích từng câu theo Teil (mở ra xem đề với
// đáp án đã chọn, đúng/sai và lời giải), ngân sách điểm. Dữ liệu từng câu lấy ở
// `GET /mock-exams/practice/attempts/{id}/analysis` — cùng endpoint màn kết quả web.

import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { BrushMark, Button, Card, GaGlyph, Icon, IconButton, Pill, Skeleton, ThemedText } from '@/components/ui'
import { formatPoints, parseExamSections, type ExamBudget, type ExamGate } from '@/lib/examApi'
import { locateTeil } from '@/lib/practiceTeil'
import { attemptAnalysisKey, getAttemptAnalysis } from '@/lib/mockAttemptApi'
import {
  analysisRows,
  gateBadge,
  gateView,
  givenAnswers,
  lostLabel,
  lostReason,
  lostRows,
  resultHeadline,
  sectionScoreRows,
  shortDate,
  teilName,
  teilNameOfKey,
  type GateView,
} from '@/lib/mockResult'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { ExamBudgetCard } from '@/components/exam/ExamBudgetCard'
import { MarkedObjGroup } from '@/components/exam/MarkedObjGroup'
import { WritingResultCard } from '@/components/exam/WritingResultCard'

const SECTION_GLYPH: Record<string, GlyphName> = { LESEN: 'doc', SPRACHBAUSTEINE: 'nguphap', HOEREN: 'nghe', SCHREIBEN: 'viet' }
const glyphOf = (section: string): GlyphName => SECTION_GLYPH[section] ?? 'thithu'

interface Props {
  attemptId: number
  title: string
  level?: string
  format?: string
  score: number
  passed?: boolean | null
  gates?: ExamGate[]
  budget?: ExamBudget
  detailedJson?: string | null
  finishedAt?: string | null
  /** Phần đề app không dựng được ("Nghe và Viết") — nói rõ điểm tính trên phần đã làm. */
  skippedLabel: string
  onBack: () => void
  onOral: () => void
  onReviewLegacy: () => void
}

export function MockResultView(p: Props) {
  const c = useTheme().colors
  const [open, setOpen] = useState<string | null>(null)
  const [showScores, setShowScores] = useState(false)
  const analysisQ = useQuery({
    queryKey: attemptAnalysisKey(p.attemptId),
    queryFn: () => getAttemptAnalysis(p.attemptId),
    enabled: Number.isFinite(p.attemptId),
    staleTime: 60_000 * 10,
  })
  const analysis = analysisQ.data
  const parsedAnalysis = useMemo(() => (analysis?.sectionsJson ? parseExamSections(analysis.sectionsJson) : null), [analysis?.sectionsJson])

  const written = gateView(p.gates, 'written')
  const oral = gateView(p.gates, 'oral')
  const head = resultHeadline(p.gates, p.score, p.passed)
  const rows = lostRows(p.budget)
  const scoreRows = sectionScoreRows(p.detailedJson)
  const writingScore = scoreRows.find((r) => r.section === 'SCHREIBEN') ?? null
  // Teil viết thư = Teil SCHREIBEN không phải điền form (parseExamSections đã bỏ Teil form khỏi `writing`).
  const letterTeil = parsedAnalysis?.sections.find((s) => s.name === 'SCHREIBEN')?.writing[0]?.teil ?? 1
  const teilRows = analysis ? analysisRows(analysis.teile, analysis.writing, writingScore, `SCHREIBEN-${letterTeil}`) : []
  const openable = new Set(teilRows.filter((r) => r.openable).map((r) => r.key))
  const writingInfo = analysis ? { text: analysis.writingText, missingPoints: analysis.writing?.leitpunkte_fehlt?.length ?? 0 } : null
  const date = shortDate(p.finishedAt)

  if (open && analysis) {
    return <TeilReview attemptId={p.attemptId} attemptKey={open} analysis={analysis} parsed={parsedAnalysis} format={p.format} level={p.level} onClose={() => setOpen(null)} />
  }

  return (
    <View style={{ gap: space[5] }}>
      <View style={{ gap: space[3] }}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Về Luyện thi" onPress={p.onBack} />
        <View style={{ gap: space[1] }}>
          <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }} numberOfLines={1}>
            {`Thi thử${date ? ` ${date}` : ''}${p.title ? ` · ${p.title}` : ''}`}
          </ThemedText>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space[2] }}
            accessible
            accessibilityRole="header"
            accessibilityLabel={[head.before, head.mark, head.after].filter(Boolean).join(' ')}
          >
            <ThemedText variant="display">{head.before}</ThemedText>
            <BrushMark>{head.mark}</BrushMark>
            {head.after ? <ThemedText variant="display">{head.after}</ThemedText> : null}
          </View>
        </View>
      </View>

      {written || oral ? (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <GateCard label="Phần viết" gate={written} />
            <GateCard label="Phần nói" gate={oral} onOral={oral?.status === 'PENDING' ? p.onOral : undefined} />
          </View>
          <ThemedText variant="caption" color="muted">
            Điểm Viết và Nói do AI chấm theo tiêu chí telc, không phải điểm chính thức.
          </ThemedText>
        </View>
      ) : (
        <Card style={{ gap: space[1] }}>
          <ThemedText variant="caption" color="secondary">Tổng điểm</ThemedText>
          <ThemedText variant="displayLg">{formatPoints(p.score)}</ThemedText>
        </Card>
      )}
      {p.skippedLabel ? (
        <ThemedText variant="caption" color="muted">{`Phần ${p.skippedLabel} của đề này làm trên web; điểm tính trên các phần bạn đã làm.`}</ThemedText>
      ) : null}

      {rows.length > 0 ? (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <ThemedText variant="title" accessibilityRole="header">Lấy lại điểm</ThemedText>
            <ThemedText variant="caption" color="muted">Mất nhiều nhất</ThemedText>
          </View>
          <View>
            {rows.map((r) => (
              <ListLine
                key={r.key}
                glyph={glyphOf(r.section)}
                title={teilName(r.section, r.teil)}
                detail={lostReason(r, writingInfo)}
                trailing={lostLabel(r.lost)}
                trailingColor={c.danger}
                onPress={openable.has(r.key) ? () => setOpen(r.key) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}

      {scoreRows.length > 0 ? (
        <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showScores }}
            accessibilityLabel="Điểm từng phần"
            onPress={() => setShowScores((v) => !v)}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <ThemedText variant="bodyStrong">Điểm từng phần</ThemedText>
            <Icon icon={showScores ? ChevronUp : ChevronDown} size={18} color="muted" />
          </Pressable>
          {showScores ? (
            <View style={{ paddingBottom: space[3] }}>
              {scoreRows.map((r) => (
                <ScoreLine key={r.section} label={r.label} value={`${formatPoints(r.total)} / ${formatPoints(r.max)}`} german />
              ))}
              {written ? <ScoreLine label="Phần viết" value={`${formatPoints(written.raw)} / ${formatPoints(written.max)}`} strong /> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space[2] }}>
        <ThemedText variant="title" accessibilityRole="header">Phân tích từng câu</ThemedText>
        {analysisQ.isLoading ? (
          <Skeleton height={140} radius="lg" />
        ) : analysisQ.isError || teilRows.length === 0 ? (
          <View style={{ gap: space[2] }}>
            <ThemedText variant="body" color="secondary">
              {analysisQ.isError ? 'Chưa tải được phân tích từng câu.' : 'Lượt này chưa có câu nào để phân tích.'}
            </ThemedText>
            {analysisQ.isError ? (
              <Button label="Tải lại" variant="ghost" size="sm" onPress={() => void analysisQ.refetch()} />
            ) : null}
            <Button label="Xem lại bài (phần Đọc)" variant="secondary" onPress={p.onReviewLegacy} />
          </View>
        ) : (
          <View>
            {teilRows.map((r) => (
              <ListLine
                key={r.key}
                glyph={glyphOf(r.section)}
                title={r.name}
                detail={r.meta}
                onPress={r.openable ? () => setOpen(r.key) : undefined}
              />
            ))}
          </View>
        )}
      </View>

      {p.budget ? <ExamBudgetCard budget={p.budget} strategyExam={{ provider: p.format, level: p.level }} /> : null}

      <Button label="Về Luyện thi" variant="secondary" onPress={p.onBack} />
    </View>
  )
}

function GateCard({ label, gate, onOral }: { label: string; gate: GateView | null; onOral?: () => void }) {
  const c = useTheme().colors
  const has = !!gate && gate.status !== 'PENDING'
  const badge = has && gate ? gateBadge(gate) : null
  const fill = gate?.status === 'PASSED' ? c.success : c.danger
  return (
    <Card style={{ flex: 1, gap: space[2], padding: space[4] }}>
      <ThemedText variant="caption" color="secondary">{label}</ThemedText>
      <View
        style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}
        accessible
        accessibilityLabel={has && gate ? `${label}: ${formatPoints(gate.raw)} trên ${formatPoints(gate.max)} điểm, cần ${formatPoints(gate.min)}` : `${label}: chưa thi`}
      >
        <ThemedText variant="display" style={{ fontSize: 34, lineHeight: 38, color: has ? c.textPrimary : c.textMuted }}>
          {has && gate ? formatPoints(gate.raw) : '–'}
        </ThemedText>
        <ThemedText variant="caption" color="muted">{gate ? `/${formatPoints(gate.max)}` : ''}</ThemedText>
      </View>
      <View style={{ height: 6, borderRadius: radius.full, backgroundColor: c.surfaceSunken }}>
        {has && gate ? <View style={{ width: `${Math.round(gate.ratio * 100)}%`, height: 6, borderRadius: radius.full, backgroundColor: fill }} /> : null}
        {gate ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: `${Math.round(gate.markRatio * 100)}%`, top: -3, width: 2, height: 12, backgroundColor: c.textPrimary }}
          />
        ) : null}
      </View>
      {badge ? <Pill label={badge.label} tone={badge.tone} style={{ alignSelf: 'flex-start' }} /> : null}
      {has && gate ? <ThemedText variant="caption" color="muted">{`cần ${formatPoints(gate.min)}`}</ThemedText> : null}
      {onOral ? <Button label="Thi phần nói" variant="yellow" size="sm" onPress={onOral} /> : null}
    </Card>
  )
}

function ListLine({
  glyph,
  title,
  detail,
  trailing,
  trailingColor,
  onPress,
}: {
  glyph: GlyphName
  title: string
  detail: string
  trailing?: string
  trailingColor?: string
  onPress?: () => void
}) {
  const c = useTheme().colors
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 60, paddingVertical: space[2] }}>
      <GaGlyph name={glyph} size={20} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bodyStrong" accessibilityLanguage="de-DE" numberOfLines={1}>{title}</ThemedText>
        <ThemedText variant="caption" color="muted" numberOfLines={1}>{detail}</ThemedText>
      </View>
      {trailing ? (
        <ThemedText variant="title" style={{ color: trailingColor ?? c.textPrimary, fontVariant: ['tabular-nums'] }}>{trailing}</ThemedText>
      ) : null}
      {onPress ? <Icon icon={ChevronRight} size={16} color="faint" /> : null}
    </View>
  )
  if (!onPress) return <View style={{ borderTopWidth: 1, borderColor: c.border }}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}${trailing ? `, ${trailing} điểm` : ''}`}
      accessibilityHint="Mở phân tích từng câu"
      onPress={onPress}
      style={({ pressed }) => ({ borderTopWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceSunken : 'transparent' })}
    >
      {body}
    </Pressable>
  )
}

function ScoreLine({ label, value, strong = false, german = false }: { label: string; value: string; strong?: boolean; german?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space[1] + 2 }}>
      <ThemedText variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'primary' : 'secondary'} accessibilityLanguage={german ? 'de-DE' : undefined}>
        {label}
      </ThemedText>
      <ThemedText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{value}</ThemedText>
    </View>
  )
}

/** Một Teil của lượt đã chấm: đề với đáp án đã chọn, tô đúng/sai, lời giải từng câu; bài Viết thì phiếu chấm. */
function TeilReview({
  attemptId,
  attemptKey,
  analysis,
  parsed,
  format,
  level,
  onClose,
}: {
  attemptId: number
  attemptKey: string
  analysis: NonNullable<Awaited<ReturnType<typeof getAttemptAnalysis>>>
  parsed: ReturnType<typeof parseExamSections> | null
  format?: string
  level?: string
  onClose: () => void
}) {
  const teil = analysis.teile.find((t) => t.teilKey === attemptKey) ?? null
  const located = locateTeil(parsed, attemptKey)
  const review = useMemo(() => (teil ? new Map(teil.items.map((it) => [it.id, it])) : undefined), [teil])
  const answers = useMemo(() => (teil ? givenAnswers(teil.items) : {}), [teil])
  return (
    <View style={{ gap: space[4] }}>
      <IconButton icon={ArrowLeft} accessibilityLabel="Về kết quả" onPress={onClose} />
      <View style={{ gap: space[1] }}>
        <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
          Phân tích từng câu
        </ThemedText>
        <ThemedText variant="display" accessibilityRole="header" accessibilityLanguage="de-DE">{teilNameOfKey(attemptKey)}</ThemedText>
        {teil ? (
          <ThemedText variant="body" color="secondary">
            {`${teil.correctCount}/${teil.total} câu đúng · ${formatPoints(teil.score)}/${formatPoints(teil.max)} điểm`}
          </ThemedText>
        ) : null}
      </View>
      {located?.kind === 'objective' && review ? (
        // Xem lại: thấy lại và sửa tiếp đánh dấu lúc thi của lượt này (như web).
        <MarkedObjGroup
          key={attemptKey}
          marksSource={{ kind: 'attempt', attemptId, teilKey: attemptKey }}
          sectionsJson={analysis.sectionsJson}
          group={located.group}
          section={located.section}
          format={format}
          level={level}
          answers={answers}
          onAnswer={() => undefined}
          review={review}
          unlimitedPlays
          hideStrategy
          hideTitle
        />
      ) : located?.kind === 'writing' && analysis.writing ? (
        <View style={{ gap: space[3] }}>
          {analysis.writingText ? (
            <Card style={{ gap: space[2] }}>
              <ThemedText variant="caption" color="secondary">Bài bạn đã viết</ThemedText>
              <ThemedText variant="body" accessibilityLanguage="de-DE">{analysis.writingText}</ThemedText>
            </Card>
          ) : null}
          <WritingResultCard evaluation={analysis.writing} />
        </View>
      ) : (
        <ThemedText variant="body" color="secondary">Chưa dựng lại được Teil này trên app.</ThemedText>
      )}
      <Button label="Về kết quả" variant="secondary" onPress={onClose} />
    </View>
  )
}
