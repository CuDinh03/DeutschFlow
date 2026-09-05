import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronRight, Crosshair } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, ErrorState, Icon, Pill, Screen, Skeleton, TextField, ThemedText, YellowSquare,
} from '@/components/ui'
import { examSpeakingApi, type CriterionResult } from '@/lib/examSpeakingApi'
import { criterionRatio, ratioTone, rubricCaption, verdict, verdictLabel, verdictTone } from '@/lib/examSpeakingUi'
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
      <AppHeader
        title="Kết quả phần Nói"
        subtitle={r ? `Sprechen ${r.level} · ${new Date(r.createdAt).toLocaleDateString('vi-VN')}` : undefined}
        onBack={goBack}
      />
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
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>

          {/* Ink hero: tổng điểm */}
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, flexDirection: 'row', alignItems: 'center', gap: space[5] }}>
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                <ThemedText variant="displayLg" style={{ color: c.onInk }}>
                  {r.total != null ? String(Math.round(r.total)) : '—'}
                </ThemedText>
                <ThemedText variant="bodyStrong" style={{ color: c.onInkMuted }}>
                  {`/${r.max != null ? Math.round(r.max) : Math.round(sheet.officialMax || sheet.maxPoints)}`}
                </ThemedText>
              </View>
              <ThemedText variant="caption" style={{ color: c.onInkMuted }}>Điểm phần Nói</ThemedText>
            </View>
            <View style={{ flex: 1, gap: space[2], alignItems: 'flex-start' }}>
              {v !== 'NONE' && (
                <Pill label={verdictLabel(v)} tone={verdictTone(v)} solid />
              )}
              {r.totalLow != null && r.totalHigh != null && (
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  {`Dải tin cậy: ${Math.round(r.totalLow)}–${Math.round(r.totalHigh)} điểm`}
                </ThemedText>
              )}
              {v === 'BORDERLINE' && (
                <ThemedText variant="caption" style={{ color: c.onInk }}>
                  Hai lượt chấm vắt qua ngưỡng đỗ — giám khảo thật có thể quyết theo cả hai hướng. Hãy xem là "cần thêm luyện", không phải kết luận.
                </ThemedText>
              )}
            </View>
          </Card>

          {/* Tiêu chí chung */}
          {sheet.global.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>{rubricCaption(r.provider)}</Caption>
              <Card style={{ gap: space[4] }}>
                {sheet.global.map((cr) => <CriterionRow key={cr.code} cr={cr} />)}
              </Card>
            </View>
          )}

          {/* Từng Teil */}
          {sheet.parts.map((p) => (
            <View key={p.teilNo} style={{ gap: space[2] }}>
              <Caption>{`Teil ${p.teilNo} · ${p.points}/${p.max} điểm`}</Caption>
              <Card style={{ gap: space[4] }}>
                {p.comment ? (
                  <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
                    <ThemedText variant="caption" color="secondary">{p.comment}</ThemedText>
                  </View>
                ) : null}
                {p.criteria.map((cr) => <CriterionRow key={cr.code} cr={cr} />)}
              </Card>
            </View>
          ))}

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
              <Card
                onPress={() => router.push('/(student)/speaking-exam-weakness')}
                accessibilityLabel="Ôn các điểm yếu này"
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
              >
                <Icon icon={Crosshair} size={18} color="accent" />
                <ThemedText variant="bodyStrong" style={{ flex: 1 }}>Ôn yếu điểm + Redemittel</ThemedText>
                <Icon icon={ChevronRight} size={16} color="muted" />
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
