// Phiếu chấm bài Viết telc trong chế độ luyện (Đợt 4, 19/11/2026): điểm, từng tiêu chí, nhận xét,
// ghi chú lỗi trong bài, bài mẫu. Bản rút gọn của `WritingResultView` trên web (chưa tô ghi chú
// ngay trong bài; ghi chú hiện thành danh sách bên dưới).

import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, Card, ThemedText } from '@/components/ui'
import type { WritingEvaluation } from '@/lib/telcPracticeApi'
import { scoreSummary } from '@/lib/practiceTeil'

const CATEGORY_VI: Record<string, string> = {
  INHALT: 'Nội dung',
  KOHAERENZ: 'Mạch lạc',
  GRAMMATIK: 'Ngữ pháp',
  WORTSCHATZ: 'Từ vựng',
  RECHTSCHREIBUNG: 'Chính tả',
  REGISTER: 'Văn phong',
}

export function WritingResultCard({ evaluation }: { evaluation: WritingEvaluation }) {
  const c = useTheme().colors
  const s = scoreSummary(evaluation.total, evaluation.max)
  const notes = evaluation.annotations ?? []
  return (
    <View style={{ gap: space[3] }}>
      <Card style={{ gap: space[2], backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
        <Caption color={c.accent}>Phiếu chấm bài viết</Caption>
        {s ? (
          <ThemedText variant="displayLg" color="onInk" style={{ fontVariant: ['tabular-nums'] }}>
            {s.score}/{s.max}
          </ThemedText>
        ) : null}
        {s ? (
          <ThemedText variant="bodyStrong" style={{ color: s.passed ? c.success : c.accent }}>
            {s.pct}% · {s.label}
          </ThemedText>
        ) : null}
        {evaluation.thema_verfehlt ? (
          <ThemedText variant="caption" color="onInk">Bài lạc đề: telc chấm 0 điểm phần nội dung.</ThemedText>
        ) : null}
      </Card>

      {evaluation.criteria?.length ? (
        <Card style={{ gap: space[2] }}>
          <Caption>Từng tiêu chí</Caption>
          {evaluation.criteria.map((k) => (
            <View key={k.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <ThemedText variant="body" style={{ flex: 1 }}>Kriterium {k.key}{k.band ? ` · ${k.band}` : ''}</ThemedText>
              <ThemedText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{k.score}/{k.max}</ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {evaluation.feedback_vi || evaluation.improvements?.length || evaluation.strengths?.length ? (
        <Card style={{ gap: space[2] }}>
          <Caption>Nhận xét</Caption>
          {evaluation.feedback_vi ? <ThemedText variant="body">{evaluation.feedback_vi}</ThemedText> : null}
          {evaluation.strengths?.map((x, i) => (
            <ThemedText key={`s${i}`} variant="body" color="secondary">+ {x}</ThemedText>
          ))}
          {evaluation.improvements?.map((x, i) => (
            <ThemedText key={`i${i}`} variant="body" color="secondary">→ {x}</ThemedText>
          ))}
        </Card>
      ) : null}

      {notes.length > 0 ? (
        <Card style={{ gap: space[3] }}>
          <Caption>Lỗi trong bài ({notes.length})</Caption>
          {notes.map((n, i) => (
            <View key={i} style={{ gap: 2, borderLeftWidth: 3, borderLeftColor: c.danger, paddingLeft: space[3] }}>
              <ThemedText variant="label" color="muted">{CATEGORY_VI[n.category] ?? n.category}</ThemedText>
              {n.quote ? (
                <ThemedText variant="body" accessibilityLanguage="de-DE" style={{ textDecorationLine: 'line-through', color: c.textSecondary }}>
                  {n.quote}
                </ThemedText>
              ) : null}
              <ThemedText variant="bodyStrong" accessibilityLanguage="de-DE">{n.correction}</ThemedText>
              <ThemedText variant="caption" color="muted">{n.whyVi}</ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {evaluation.musterloesung ? (
        <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[4] }}>
          <Caption>Bài mẫu</Caption>
          <ThemedText variant="body" accessibilityLanguage="de-DE">{evaluation.musterloesung}</ThemedText>
        </View>
      ) : null}
    </View>
  )
}
