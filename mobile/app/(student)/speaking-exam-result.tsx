import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  BrushMark, Button, Caption, Card, ErrorState, Icon, IconButton, Pill, Screen, Skeleton, TextField, ThemedText, YellowSquare,
} from '@/components/ui'
import { examSpeakingApi, type CriterionResult } from '@/lib/examSpeakingApi'
import { criterionRatio, ratioTone, verdict, verdictTone } from '@/lib/examSpeakingUi'
import {
  findBlueprint, resultBadge, resultHeadline, resultRows, scoreBar, scoreNote, speakerName, transcriptByTeil,
} from '@/lib/oralRoom'
import { examParentHref } from '@/lib/examSpeakingNav'
import { useHardwareBack } from '@/hooks/useHardwareBack'

/** Phiếu điểm phần Nói — gương Ergebnisbogen web, tối giản cho màn dọc. */
export default function SpeakingExamResultScreen() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ id: string }>()
  const sessionId = Number(params.id)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSeeded, setNotesSeeded] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)

  // Back về hub Luyện thi Nói (màn cha) — điều hướng tường minh, vì GO_BACK của Tabs (firstRoute) về Heute.
  const goBack = useCallback(() => router.navigate(examParentHref('result')), [])
  useHardwareBack(goBack)

  const resultQ = useQuery({
    queryKey: ['exam-speaking-result', sessionId],
    queryFn: () => examSpeakingApi.getResult(sessionId),
    enabled: Number.isFinite(sessionId),
    staleTime: 60_000 * 10,
  })
  const sessionQ = useQuery({
    queryKey: ['exam-speaking-session', sessionId],
    queryFn: () => examSpeakingApi.getSession(sessionId),
    enabled: Number.isFinite(sessionId),
    staleTime: 60_000,
  })

  const r0 = resultQ.data
  const blueprintsQ = useQuery({
    queryKey: ['exam-speaking-blueprints', r0?.provider],
    queryFn: () => examSpeakingApi.listBlueprints({ provider: r0?.provider }),
    enabled: !!r0,
    staleTime: 60_000 * 30,
  })
  // "Xem lại hội thoại": chỉ tải khi người học mở.
  const transcriptQ = useQuery({
    queryKey: ['exam-speaking-transcript', sessionId],
    queryFn: () => examSpeakingApi.getTranscript(sessionId),
    enabled: showTranscript && Number.isFinite(sessionId),
    staleTime: 60_000 * 10,
  })

  // Màn ẩn dưới Tabs không unmount: mở phiếu khác thì thu gọn lại hội thoại và hàng đang mở.
  useEffect(() => {
    setShowTranscript(false)
    setOpenRow(null)
    setNotesSeeded(false)
  }, [sessionId])

  // Nạp ghi chú đã lưu đúng MỘT lần (đừng đè bản user đang gõ khi refetch).
  useEffect(() => {
    if (!notesSeeded && sessionQ.data) {
      setNotes(sessionQ.data.notesText ?? '')
      setNotesSeeded(true)
    }
  }, [notesSeeded, sessionQ.data])

  const r = resultQ.data
  const sheet = r?.scoreSheet
  const toneColor = { success: c.success, gold: c.accentText, orange: c.orange } as const
  const v = r ? verdict({ passed: r.passed, borderline: r.borderline ?? sheet?.borderline }) : 'NONE'
  const bp = r ? findBlueprint(blueprintsQ.data, r.provider, r.level) : undefined
  const passMin = bp?.speakingOnlyMin ?? null

  function retake() {
    if (!r) return
    router.navigate({ pathname: '/(student)/speaking-exam', params: { level: r.level, t: String(Date.now()) } })
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      await examSpeakingApi.saveNotes(sessionId, notes.trim())
      Alert.alert('Đã lưu', 'Ghi chú của bạn đã được lưu vào phiên thi này.')
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setSavingNotes(false)
    }
  }

  function CriterionRow({ cr }: { cr: CriterionResult }) {
    const ratio = criterionRatio(cr.points, cr.max)
    const barColor = toneColor[ratioTone(ratio)]
    const [open, setOpen] = useState(false)
    const evidence = (cr.evidence ?? []).filter((e) => e && e.trim())
    return (
      <View style={{ gap: space[1] + 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
          <ThemedText variant="bodyStrong" style={{ flex: 1 }}>{cr.label || cr.code}</ThemedText>
          {cr.band ? <Pill label={cr.band} tone="neutral" /> : null}
          <ThemedText variant="label">
            {cr.scored ? `${cr.points}` : '–'}
            <ThemedText variant="caption" color="muted">{`/${cr.max}`}</ThemedText>
          </ThemedText>
        </View>
        <View style={{ height: 6, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(ratio * 100)}%`, height: 6, backgroundColor: barColor }} />
        </View>
        {!cr.scored ? (
          <ThemedText variant="caption" color="muted">Chưa chấm được tiêu chí này (thiếu tín hiệu) — không tính vào mẫu số.</ThemedText>
        ) : evidence.length > 0 ? (
          // Parity web: trích dẫn bằng chứng của giám khảo AI (tiếng Đức, nguyên văn) — mở khi cần.
          <Pressable accessibilityRole="button" accessibilityLabel={`${open ? 'Ẩn' : 'Xem'} bằng chứng ${cr.label || cr.code}`} onPress={() => setOpen((o) => !o)}>
            <ThemedText variant="caption" color="accent">{open ? 'Ẩn bằng chứng' : `Bằng chứng (${evidence.length})`}</ThemedText>
            {open ? (
              <View style={{ gap: 2, marginTop: 4 }}>
                {evidence.slice(0, 4).map((e, i) => (
                  <ThemedText key={i} variant="caption" color="secondary">{`„${e}“`}</ThemedText>
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Về Luyện thi Nói" onPress={goBack} />
      </View>
      {resultQ.isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={120} radius="3xl" />
          <Skeleton height={280} radius="2xl" />
        </View>
      ) : resultQ.isError || !r || !sheet ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => void resultQ.refetch()} />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[3] }}>
          {(() => {
            const head = resultHeadline(v)
            const bar = scoreBar(r, passMin)
            const note = scoreNote(r, passMin, v)
            const max = r.max != null ? Math.round(r.max) : Math.round(sheet.officialMax || sheet.maxPoints)
            const d = new Date(r.createdAt)
            const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
            const barColor = v === 'PASS' ? c.success : v === 'FAIL' ? c.danger : c.orange
            return (
              <View style={{ gap: space[3] }}>
                <View style={{ gap: space[1] }}>
                  <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                    {`Mündliche Prüfung · ${r.provider === 'TELC' ? 'telc' : 'Goethe'} ${r.level} · ${dateLabel}`}
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
                <Card style={{ gap: space[3] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="caption" color="secondary">Điểm phần nói</ThemedText>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <ThemedText variant="displayLg" style={{ fontSize: 54, lineHeight: 58 }}>
                          {r.total != null ? String(Math.round(r.total)) : '—'}
                        </ThemedText>
                        <ThemedText variant="title" color="muted">{`/${max}`}</ThemedText>
                      </View>
                    </View>
                    <Pill label={resultBadge(v)} tone={v === 'NONE' ? 'neutral' : verdictTone(v)} />
                  </View>
                  <View
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={passMin ? `Điểm ${r.total ?? 0} trên ${max}, cần ${passMin} để đỗ` : `Điểm ${r.total ?? 0} trên ${max}`}
                    style={{ height: 8, borderRadius: radius.full, backgroundColor: c.surfaceSunken }}
                  >
                    <View style={{ width: `${Math.round(bar.ratio * 100)}%`, height: 8, borderRadius: radius.full, backgroundColor: barColor }} />
                    {bar.mark != null && (
                      <View style={{ position: 'absolute', left: `${Math.round(bar.mark * 100)}%`, top: -3, width: 2, height: 14, backgroundColor: c.textPrimary }} />
                    )}
                  </View>
                  {note ? <ThemedText variant="caption" color="secondary">{note}</ThemedText> : null}
                  {v === 'BORDERLINE' && (
                    <ThemedText variant="caption" color="secondary">
                      Giám khảo thật có thể quyết theo cả hai hướng. Hãy xem là "cần thêm luyện", không phải kết luận.
                    </ThemedText>
                  )}
                </Card>
              </View>
            )
          })()}

          {/* Điểm từng phần (mẫu `oralres`): chạm một hàng để xem tiêu chí và bằng chứng. */}
          <View style={{ gap: space[2] }}>
            <ThemedText variant="title">Điểm từng phần</ThemedText>
            <Card padded={false}>
              {resultRows(sheet, bp).map((row, i) => {
                const part = row.key.startsWith('T') ? sheet.parts.find((p) => `T${p.teilNo}` === row.key) : undefined
                const globalCr = row.key.startsWith('G-') ? sheet.global.find((g) => `G-${g.code}` === row.key) : undefined
                const details = part ? part.criteria : globalCr ? [globalCr] : []
                const expandable = details.length > 0
                const open = openRow === row.key
                return (
                  <View key={row.key} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border }}>
                    <Pressable
                      accessibilityRole={expandable ? 'button' : undefined}
                      accessibilityState={expandable ? { expanded: open } : undefined}
                      accessibilityLabel={`${row.title}, ${row.points} trên ${row.max} điểm`}
                      disabled={!expandable}
                      onPress={() => setOpenRow(open ? null : row.key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}
                    >
                      <View style={{ minWidth: 30, height: 30, paddingHorizontal: 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: row.low ? c.orange : c.inkSurface }}>
                        <ThemedText variant="label" style={{ color: c.onInk }}>{row.badge}</ThemedText>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText variant="bodyStrong">{row.title}</ThemedText>
                        {row.note ? <ThemedText variant="caption" color="secondary" numberOfLines={open ? undefined : 2}>{row.note}</ThemedText> : null}
                      </View>
                      <ThemedText variant="bodyStrong">{`${row.points}/${row.max}`}</ThemedText>
                      {expandable ? <Icon icon={open ? ChevronUp : ChevronDown} size={16} color="muted" /> : null}
                    </Pressable>
                    {open && expandable ? (
                      <View style={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[4] }}>
                        {details.map((cr) => <CriterionRow key={cr.code} cr={cr} />)}
                      </View>
                    ) : null}
                  </View>
                )
              })}
            </Card>
          </View>

          <View style={{ gap: space[2] }}>
            <Button label="Ôn yếu điểm" variant="secondary" onPress={() => router.push('/(student)/speaking-exam-weakness')} />
            <Button
              label={showTranscript ? 'Ẩn hội thoại' : 'Xem lại hội thoại'}
              variant="secondary"
              onPress={() => setShowTranscript((x) => !x)}
            />
            <Button label="Thi lại" onPress={retake} />
          </View>

          {showTranscript && (
            <View style={{ gap: space[2] }}>
              <ThemedText variant="title">Hội thoại</ThemedText>
              {transcriptQ.isLoading ? (
                <Skeleton height={160} radius="2xl" />
              ) : transcriptQ.isError ? (
                <ErrorState onRetry={() => void transcriptQ.refetch()} />
              ) : (transcriptQ.data ?? []).length === 0 ? (
                <ThemedText variant="caption" color="muted">Phiên này không lưu lời nói nào.</ThemedText>
              ) : (
                transcriptByTeil(transcriptQ.data ?? []).map((g) => (
                  <View key={g.teilNo} style={{ gap: space[2] }}>
                    <Caption>{`Teil ${g.teilNo}`}</Caption>
                    {g.lines.map((l) => {
                      const me = l.role === 'CANDIDATE'
                      return (
                        <View
                          key={`${l.teilNo}-${l.seq}`}
                          style={{
                            maxWidth: 300, alignSelf: me ? 'flex-end' : 'flex-start', padding: space[3], gap: 2,
                            borderRadius: radius['2xl'], backgroundColor: me ? c.inkSurface : c.surface,
                            borderWidth: me ? 0 : 1, borderColor: c.border,
                          }}
                        >
                          <Caption color={me ? c.onInkMuted : c.textSecondary}>{speakerName(l.role)}</Caption>
                          <ThemedText variant="body" style={me ? { color: c.onInk } : undefined}>{l.text}</ThemedText>
                        </View>
                      )
                    })}
                  </View>
                ))
              )}
            </View>
          )}

          {/* Lỗi kéo điểm */}
          {sheet.errors.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>{`Lỗi kéo điểm · ${sheet.errors.length}`}</Caption>
              <Card padded={false}>
                {sheet.errors.slice(0, 10).map((e, i) => (
                  <View
                    key={`${e.code}-${i}`}
                    style={{
                      flexDirection: 'row', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3],
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, alignItems: 'flex-start',
                    }}
                  >
                    <YellowSquare size={7} color={e.severity === 'HIGH' ? c.danger : c.orange} style={{ marginTop: 6 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="body">
                        <ThemedText variant="body" style={{ textDecorationLine: 'line-through' }} color="muted">{e.original}</ThemedText>
                        {'  →  '}
                        <ThemedText variant="bodyStrong">{e.correction}</ThemedText>
                      </ThemedText>
                      <ThemedText variant="caption" color="faint">{`Teil ${e.teilNo}`}</ThemedText>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Ghi chú backend (Teil im lặng, tiêu chí thiếu tín hiệu…) — phiếu web hiện, mobile trước đây bỏ */}
          {sheet.notes.length > 0 && (
            <View style={{ gap: 2, paddingHorizontal: space[1] }}>
              {sheet.notes.slice(0, 6).map((n, i) => (
                <ThemedText key={i} variant="caption" color="muted">{`• ${n}`}</ThemedText>
              ))}
            </View>
          )}

          {/* Disclaimer — parity web Ergebnisbogen: điểm mô phỏng, không phải chứng nhận */}
          <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
            <ThemedText variant="caption" color="secondary">
              Điểm mô phỏng theo bộ tiêu chí công khai của kỳ thi, đang hiệu chuẩn với giám khảo người (beta) — sai số khoảng ±1 bậc; không phải chứng nhận và không liên kết với Goethe-Institut hay telc.
            </ThemedText>
          </View>

          {/* Ghi chú của tôi */}
          <View style={{ gap: space[2] }}>
            <Caption>Ghi chú của tôi</Caption>
            <Card style={{ gap: space[3] }}>
              <TextField
                value={notes}
                onChangeText={setNotes}
                placeholder="Điều muốn nhớ cho lần thi sau…"
                multiline
              />
              <Button label={savingNotes ? 'Đang lưu…' : 'Lưu ghi chú'} variant="ghost" onPress={() => void saveNotes()} loading={savingNotes} />
            </Card>
          </View>
        </Screen>
      )}
    </Screen>
  )
}
