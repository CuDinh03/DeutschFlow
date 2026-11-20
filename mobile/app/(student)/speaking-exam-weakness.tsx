import { useCallback, useState } from 'react'
import { Alert, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { drillTargets, type DrillTarget } from '@/lib/examSpeakingUi'
import { isMicCheckedThisRun, markMicChecked } from '@/lib/oralRoom'
import { OralMicCheck } from '@/components/exam/OralMicCheck'
import { radius, space, useTheme } from '@/lib/theme'
import {
  BrushMark, Button, Caption, Card, EmptyState, ErrorState, IconButton, Pill, Screen, Skeleton, ThemedText, YellowSquare,
} from '@/components/ui'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { getErrorTitle } from '@/lib/errorTaxonomy'
import { examParentHref } from '@/lib/examSpeakingNav'
import { useHardwareBack } from '@/hooks/useHardwareBack'

/** Ôn yếu điểm (Đợt 5a backend): mã lỗi hay mắc trong phòng thi + gói Redemittel theo dạng bài. */
export default function SpeakingExamWeaknessScreen() {
  const theme = useTheme()
  const c = theme.colors

  const weaknessQ = useQuery({
    queryKey: ['exam-speaking-weakness'],
    queryFn: () => examSpeakingApi.getWeakness(),
    staleTime: 60_000 * 5,
  })

  const weakPoints = weaknessQ.data?.weakPoints ?? []
  const packs = weaknessQ.data?.packs ?? []
  // N3 (đợt 2, 05/09): màn này từng là ngõ cụt (chỉ có nút quay lại). Gom (level, Teil) hay sai
  // thành chip "Luyện ngay" → phiên DRILL đúng Teil đó, như web từ yếu điểm bấm là vào DRILL.
  // Đợt 5 phần B (19/11/2026): app chỉ luyện telc — lỗi cũ từ đề Goethe vẫn hiện, nhưng nút luyện chỉ mở telc.
  const targets = drillTargets(weakPoints).filter((t) => t.provider === 'TELC')
  const [starting, setStarting] = useState<string | null>(null)
  // Lần luyện đầu tiên trong lần mở app: kiểm micro trước khi tạo phiên (như sảnh thi nói).
  const [micFor, setMicFor] = useState<DrillTarget | null>(null)

  // Back về hub Luyện thi Nói (màn cha) — điều hướng tường minh, vì GO_BACK của Tabs (firstRoute) về Heute.
  const goBack = useCallback(() => {
    if (micFor) setMicFor(null)
    else router.navigate(examParentHref('weakness'))
  }, [micFor])
  useHardwareBack(goBack)
  // Màn ẩn dưới Tabs không unmount: rời màn thì đóng màn kiểm micro đang mở, quay lại thấy màn chính.
  useFocusEffect(useCallback(() => () => setMicFor(null), []))

  function requestDrill(t: DrillTarget) {
    if (starting) return
    if (!isMicCheckedThisRun()) {
      setMicFor(t)
      return
    }
    void startDrill(t)
  }

  async function startDrill(t: DrillTarget) {
    if (starting) return
    const key = `${t.level}-${t.teilNo}`
    setStarting(key)
    try {
      trackFeatureAction('exam_speaking', 'started', { level: t.level, mode: 'DRILL', teil: t.teilNo, from: 'weakness' })
      const session = await examSpeakingApi.createSession({ provider: t.provider, level: t.level, mode: 'DRILL', teil: t.teilNo })
      router.push({ pathname: '/(student)/speaking-exam-room', params: { id: String(session.id) } })
      setMicFor(null)
    } catch (e) {
      Alert.alert('Không bắt đầu được', apiMessage(e))
    } finally {
      setStarting(null)
    }
  }

  if (micFor) {
    return (
      <OralMicCheck
        level={micFor.level}
        entering={starting === `${micFor.level}-${micFor.teilNo}`}
        onBack={() => setMicFor(null)}
        onEnter={() => {
          markMicChecked()
          void startDrill(micFor)
        }}
      />
    )
  }

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[2], gap: space[3] }}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Quay lại" onPress={goBack} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }} accessible accessibilityRole="header" accessibilityLabel="Ôn yếu điểm">
          <ThemedText variant="display">Ôn</ThemedText>
          <BrushMark>yếu điểm</BrushMark>
        </View>
        <ThemedText variant="caption" color="secondary">Lỗi hay mắc trong phòng thi Nói.</ThemedText>
      </View>
      {weaknessQ.isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={120} radius="2xl" />
          <Skeleton height={120} radius="2xl" />
        </View>
      ) : weaknessQ.isError ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => void weaknessQ.refetch()} />
        </View>
      ) : weakPoints.length === 0 && packs.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="hoithoai"
            title="Chưa có dữ liệu điểm yếu"
            message="Thi thử vài lượt là hệ thống gom được lỗi bạn hay mắc để ôn đúng chỗ."
            actionLabel="Về Luyện thi Nói"
            onAction={goBack}
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>

          {targets.length > 0 && (
            <Card style={{ gap: space[3] }}>
              <View style={{ gap: 2 }}>
                <ThemedText variant="title">Luyện ngay đúng Teil hay sai</ThemedText>
                <ThemedText variant="caption" color="secondary">Một Teil ngắn, chấm riêng, không tính vào thi thử.</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                {targets.map((t, i) => {
                  const key = `${t.level}-${t.teilNo}`
                  const multiLevel = new Set(targets.map((x) => x.level)).size > 1
                  return (
                    <View key={key} style={{ flexGrow: 1, flexBasis: '45%' }}>
                      <Button
                        label={multiLevel ? `${t.level} · Luyện Teil ${t.teilNo}` : `Luyện Teil ${t.teilNo}`}
                        size="sm"
                        variant={i === 0 ? 'primary' : 'secondary'}
                        loading={starting === key}
                        disabled={starting !== null && starting !== key}
                        onPress={() => requestDrill(t)}
                      />
                    </View>
                  )
                })}
              </View>
            </Card>
          )}

          {weakPoints.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>{`Lỗi hay mắc · ${weakPoints.length}`}</Caption>
              {weakPoints.map((w) => (
                <Card key={w.errorCode} style={{ gap: space[3] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                    <YellowSquare size={7} color={w.lastSeverity === 'HIGH' ? c.danger : c.orange} style={{ marginTop: 6 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="bodyStrong">{w.ruleVi ?? getErrorTitle(w.errorCode)}</ThemedText>
                      <ThemedText variant="caption" color="secondary">
                        {`Gặp ${w.examCount} lần trong phòng thi${w.openCount > 0 ? ` · ${w.openCount} lần chưa trị dứt` : ''}`}
                      </ThemedText>
                    </View>
                    <Pill label={`×${w.examCount}`} tone={w.lastSeverity === 'HIGH' ? 'danger' : 'neutral'} />
                  </View>
                  {w.exampleOriginal && w.exampleCorrection ? (
                    <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: 2 }}>
                      <ThemedText variant="body" color="muted" style={{ textDecorationLine: 'line-through' }}>
                        {w.exampleOriginal}
                      </ThemedText>
                      <ThemedText variant="bodyStrong">{w.exampleCorrection}</ThemedText>
                    </View>
                  ) : null}
                  {w.contexts.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] + 2 }}>
                      {w.contexts.slice(0, 4).map((ctx, i) => (
                        <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: 4 }}>
                          <ThemedText variant="caption" color="secondary">
                            {`${ctx.level} · Teil ${ctx.teilNo}`}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              ))}
            </View>
          )}

          {packs.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>Redemittel cho dạng bài đang yếu</Caption>
              {packs.map((p) => (
                <Card key={p.archetype} style={{ gap: space[3] }}>
                  <ThemedText variant="bodyStrong">{p.archetype}</ThemedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                    {p.phrases.slice(0, 8).map((ph, i) => (
                      <View key={i} style={{ paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, backgroundColor: c.surfaceSunken }}>
                        <ThemedText variant="body">{ph}</ThemedText>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </Screen>
      )}
    </Screen>
  )
}
