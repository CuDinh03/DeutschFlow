// Bài chẩn đoán telc B1 trên app (Đợt 4, 19/11/2026) — bản app của /v2/student/exam/diagnostic.
// Owner chốt 18/11: giữ đủ như web (mọi Teil như đề thật + thi nói, khoảng 170 phút, chia nhiều buổi
// được). Ba trạng thái: chưa bắt đầu (chọn ngày thi, số phút mỗi ngày) → đang làm (danh sách phần,
// mỗi phần mở màn luyện Teil chế độ chẩn đoán; phần nói mở phòng thi nói) → xong (kỹ năng cần luyện
// trước, lịch ôn đã sẵn sàng).

import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, TextInput, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { radius, space, useTheme } from '@/lib/theme'
import { AppHeader, Button, Card, ErrorState, GaGlyph, Icon, Screen, SelectableChip, Skeleton, ThemedText } from '@/components/ui'
import { examDiagnosticApi, ORAL_PART, type DiagnosticView } from '@/lib/examDiagnosticApi'
import { getPracticeOverview, type PracticeOverview } from '@/lib/telcPracticeApi'
import { parseExamDate } from '@/lib/examPlanApi'
import { practiceOverviewKey, teilTitle } from '@/lib/practiceTeil'
import { sectionShort, statusOf, STATUS_LABEL, type SkillId } from '@/lib/examHub'
import { diagnosticTeilRoute, oralRoute } from '@/lib/examRoutes'
import { EXAM_HUB_QUERY_KEY } from '@/hooks/useExamHub'
import { go } from '@/components/exam/hub/HubCards'
import { NEAR_TEXT } from '@/components/exam/hub/SkillsAndWeek'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

const MINUTES = [20, 30, 45, 60]
const DIAG_KEY = ['exam-diagnostic'] as const
const PART_GLYPH: Record<string, GlyphName> = { LESEN: 'doc', SPRACHBAUSTEINE: 'nguphap', HOEREN: 'nghe', SCHREIBEN: 'viet', SPRECHEN: 'noi' }
const SKILLS: SkillId[] = ['LESEN', 'HOEREN', 'SCHREIBEN', 'SPRECHEN']

export default function ExamDiagnosticScreen() {
  const goBack = useBackTo(PARENT_OF['exam-diagnostic'])
  const queryClient = useQueryClient()
  const { data: view, isLoading, isError, refetch } = useQuery({ queryKey: DIAG_KEY, queryFn: examDiagnosticApi.get })
  const examId = view?.examId ?? null
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: practiceOverviewKey(examId ?? -1),
    queryFn: () => getPracticeOverview(examId as number),
    enabled: examId != null && view?.status === 'IN_PROGRESS',
  })
  // Quay về từ một phần: trạng thái từng phần và lần thi nói phải mới.
  useFocusEffect(
    useCallback(() => {
      void refetch()
      if (examId != null) void refetchOverview()
    }, [refetch, refetchOverview, examId]),
  )
  const setView = (v: DiagnosticView) => {
    queryClient.setQueryData(DIAG_KEY, v)
    void queryClient.invalidateQueries({ queryKey: EXAM_HUB_QUERY_KEY })
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Bài chẩn đoán" subtitle="telc Deutsch B1" onBack={goBack} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
          <Skeleton height={240} radius="lg" />
        </View>
      ) : isError || !view ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[12], gap: space[4] }}>
          {view.status === 'NONE' ? (
            <StartForm onStarted={setView} onSkip={goBack} />
          ) : view.status === 'IN_PROGRESS' ? (
            overview ? (
              <RunList view={view} overview={overview} onView={setView} />
            ) : (
              <Skeleton height={300} radius="lg" />
            )
          ) : (
            <ResultView view={view} onDone={goBack} />
          )}
        </Screen>
      )}
    </Screen>
  )
}

function StartForm({ onStarted, onSkip }: { onStarted: (v: DiagnosticView) => void; onSkip: () => void }) {
  const c = useTheme().colors
  const [dateText, setDateText] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    const parsed = parseExamDate(dateText)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(`${parsed.iso}T00:00:00`) <= today) {
      setError('Ngày thi phải sau hôm nay.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      onStarted(await examDiagnosticApi.start(parsed.iso, minutes))
    } catch (e) {
      Alert.alert('Không bắt đầu được bài chẩn đoán', apiMessage(e) || 'Thử lại sau ít phút.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: space[4] }}>
      <GaGlyph name="muctieu" size={32} />
      <ThemedText variant="titleLg">Khoảng 170 phút để biết nên luyện gì trước</ThemedText>
      <ThemedText variant="body" color="secondary">
        Đủ mọi Teil như đề thật: Lesen 1–3, Sprachbausteine 1–2, Hören 1–3, Schreiben và thi nói, chấm theo chuẩn telc B1 (Viết và Nói do AI chấm). Mỗi Teil lưu riêng, làm dở được, chia ra nhiều buổi cũng được.
      </ThemedText>
      <View style={{ gap: space[2] }}>
        <ThemedText variant="label">Kỳ thi</ThemedText>
        <View style={{ minHeight: 48, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, paddingHorizontal: space[3], justifyContent: 'center' }}>
          <ThemedText variant="body">telc Deutsch B1</ThemedText>
        </View>
      </View>
      <View style={{ gap: space[2] }}>
        <ThemedText variant="label">Ngày thi (ngày/tháng/năm)</ThemedText>
        <TextInput
          value={dateText}
          onChangeText={setDateText}
          placeholder="15/03/2027"
          placeholderTextColor={c.textFaint}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Ngày thi"
          style={{ minHeight: 48, borderWidth: 1.5, borderColor: error ? c.danger : c.borderStrong, borderRadius: radius.sm, paddingHorizontal: space[3], color: c.textPrimary, fontSize: 16 }}
        />
        <ThemedText variant="caption" style={{ color: error ? c.danger : c.textMuted }} accessibilityLiveRegion="polite">
          {error ?? 'Chọn ngày thi để xếp lịch ôn.'}
        </ThemedText>
      </View>
      <View style={{ gap: space[2] }}>
        <ThemedText variant="label">Mỗi ngày ôn được</ThemedText>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {MINUTES.map((m) => (
            <SelectableChip key={m} label={`${m} phút`} selected={minutes === m} onPress={() => setMinutes(m)} style={{ flex: 1, alignItems: 'center', paddingVertical: space[3], borderRadius: radius.sm, borderWidth: 1.5, borderColor: minutes === m ? c.textPrimary : c.border, backgroundColor: minutes === m ? c.accentSoft : c.surface }}>
              <ThemedText variant="label">{m} phút</ThemedText>
            </SelectableChip>
          ))}
        </View>
      </View>
      <Button label={busy ? 'Đang bắt đầu…' : 'Bắt đầu'} onPress={() => void start()} loading={busy} />
      <ThemedText variant="label" color="info" align="center" onPress={onSkip} accessibilityRole="link">
        Bỏ qua
      </ThemedText>
    </View>
  )
}

function RunList({ view, overview, onView }: { view: DiagnosticView; overview: PracticeOverview; onView: (v: DiagnosticView) => void }) {
  const c = useTheme().colors
  const [busy, setBusy] = useState(false)
  const parts = useMemo(() => [...view.teile.filter((key) => overview.teile.some((x) => x.key === key)), ORAL_PART], [view.teile, overview.teile])
  const done = (part: string) => (part === ORAL_PART ? view.oral != null : !!overview.teile.find((x) => x.key === part)?.progress?.checked)
  const current = parts.find((p) => !done(p)) ?? null
  const doneCount = parts.filter(done).length

  async function finish() {
    setBusy(true)
    try {
      onView(await examDiagnosticApi.finish())
    } catch (e) {
      Alert.alert('Chưa tổng hợp được kết quả', apiMessage(e) || 'Thử lại sau ít phút.')
    } finally {
      setBusy(false)
    }
  }

  const open = (part: string) => go(part === ORAL_PART ? oralRoute({ level: 'B1' }) : diagnosticTeilRoute(overview.examId, part))

  return (
    <View style={{ gap: space[4] }}>
      <ThemedText variant="body" color="secondary">
        Đã xong {doneCount}/{parts.length} phần. Làm theo thứ tự như đề thật; phần đã nộp không làm lại được trong bài chẩn đoán.
      </ThemedText>
      <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
        {parts.map((p, i) => {
          const isDone = done(p)
          const isCurrent = p === current
          const section = p === ORAL_PART ? 'SPRECHEN' : p.split('-')[0]
          const name = p === ORAL_PART ? 'Sprechen · thi nói 3 Teil' : teilTitle(p)
          return (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${isDone ? 'đã xong' : isCurrent ? 'làm tiếp' : 'chưa làm'}`}
              disabled={isDone}
              onPress={() => open(p)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                padding: space[4],
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                backgroundColor: pressed ? c.surfaceSunken : isCurrent ? c.accentSoft : 'transparent',
              })}
            >
              <GaGlyph name={isDone ? 'hoanthanh' : PART_GLYPH[section] ?? 'doc'} size={22} ink={isDone ? 'muted' : undefined} />
              <ThemedText variant={isCurrent ? 'bodyStrong' : 'body'} color={isDone ? 'muted' : 'primary'} style={{ flex: 1 }} accessibilityLanguage="de-DE">
                {name}
              </ThemedText>
              <ThemedText variant="caption" color={isDone ? 'success' : 'muted'}>{isDone ? 'Đã xong' : isCurrent ? 'Làm tiếp' : ''}</ThemedText>
              {isDone ? null : <Icon icon={ChevronRight} size={16} color="faint" />}
            </Pressable>
          )
        })}
      </View>
      {current === ORAL_PART ? (
        <Card style={{ gap: space[2] }}>
          <ThemedText variant="bodyStrong">Thi nói với giám khảo AI</ThemedText>
          <ThemedText variant="caption" color="muted">
            Ba phần thi nói telc B1, khoảng 20 phút, cần micro. Thi xong quay lại đây, kết quả tự cập nhật.
          </ThemedText>
          <Button label="Vào phòng thi nói" onPress={() => open(ORAL_PART)} />
        </Card>
      ) : current ? (
        <Button label={`Làm tiếp: ${teilTitle(current)}`} onPress={() => open(current)} />
      ) : (
        <Button label={busy ? 'Đang tổng hợp kết quả…' : 'Xem kết quả'} onPress={() => void finish()} loading={busy} />
      )}
    </View>
  )
}

function ResultView({ view, onDone }: { view: DiagnosticView; onDone: () => void }) {
  const c = useTheme().colors
  const scored = SKILLS.filter((s) => typeof view.skills[s] === 'number')
  const weakest = [...scored].sort((a, b) => (view.skills[a] as number) - (view.skills[b] as number))[0]
  return (
    <View style={{ gap: space[4] }}>
      <ThemedText variant="titleLg">{weakest ? `${sectionShort(weakest)} cần luyện trước` : 'Kết quả bài chẩn đoán'}</ThemedText>
      {view.shortForm ? (
        <ThemedText variant="body" color="secondary">
          Kết quả này là của bài chẩn đoán bản ngắn (chỉ Teil 1 mỗi phần). Làm lại để đo đủ mọi Teil như đề thật.
        </ThemedText>
      ) : null}
      <Card style={{ gap: space[3] }}>
        {SKILLS.map((s) => {
          const pct = view.skills[s]
          const st = statusOf(typeof pct === 'number' ? pct : null)
          const color = st === 'ok' ? c.success : st === 'below' ? c.danger : st === 'near' ? NEAR_TEXT : c.textMuted
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <GaGlyph name={PART_GLYPH[s]} size={20} />
              <ThemedText variant="bodyStrong" style={{ flex: 1 }} accessibilityLanguage="de-DE">{sectionShort(s)}</ThemedText>
              <ThemedText variant="label" style={{ color, fontVariant: ['tabular-nums'] }}>
                {typeof pct === 'number' ? `${pct}% · ${STATUS_LABEL[st]}` : STATUS_LABEL.none}
              </ThemedText>
            </View>
          )
        })}
        <ThemedText variant="caption" color="muted">Viết và Nói do AI chấm theo tiêu chí telc, là điểm ước tính.</ThemedText>
      </Card>
      <ThemedText variant="body" color="secondary">Lịch ôn theo tuần đã sẵn sàng ở tab Luyện thi.</ThemedText>
      <Button label="Xem lịch ôn" onPress={onDone} />
    </View>
  )
}
