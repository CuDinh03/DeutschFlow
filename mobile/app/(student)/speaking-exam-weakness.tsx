import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { MessageSquareQuote, Mic } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { drillTargets, type DrillTarget } from '@/lib/examSpeakingUi'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText, YellowSquare,
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
  const targets = drillTargets(weakPoints)
  const [starting, setStarting] = useState<string | null>(null)

  // Back về hub Luyện thi Nói (màn cha) — điều hướng tường minh, vì GO_BACK của Tabs (firstRoute) về Heute.
  const goBack = useCallback(() => router.navigate(examParentHref('weakness')), [])
  useHardwareBack(goBack)

  async function startDrill(t: DrillTarget) {
    if (starting) return
    const key = `${t.level}-${t.teilNo}`
    setStarting(key)
    try {
      trackFeatureAction('exam_speaking', 'started', { level: t.level, mode: 'DRILL', teil: t.teilNo, from: 'weakness' })
      const session = await examSpeakingApi.createSession({ provider: t.provider, level: t.level, mode: 'DRILL', teil: t.teilNo })
      router.push({ pathname: '/(student)/speaking-exam-room', params: { id: String(session.id) } })
    } catch (e) {
      Alert.alert('Không bắt đầu được', apiMessage(e))
    } finally {
      setStarting(null)
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Ôn yếu điểm" subtitle="Lỗi hay mắc trong phòng thi Nói" onBack={goBack} />
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
            icon={MessageSquareQuote}
            title="Chưa có dữ liệu điểm yếu"
            message="Thi thử vài lượt là hệ thống gom được lỗi bạn hay mắc để ôn đúng chỗ."
            actionLabel="Về Luyện thi Nói"
            onAction={goBack}
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>

          {targets.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>Luyện ngay đúng Teil hay sai</Caption>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                {targets.map((t) => {
                  const key = `${t.level}-${t.teilNo}`
                  const busy = starting === key
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Luyện Teil ${t.teilNo} trình độ ${t.level}, sai ${t.count} lần`}
                      accessibilityState={{ disabled: starting !== null, busy }}
                      disabled={starting !== null}
                      onPress={() => void startDrill(t)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: space[1] + 2,
                        borderWidth: 1, borderColor: c.accentText, backgroundColor: c.accentSoft,
                        borderRadius: radius.full, paddingHorizontal: space[3], paddingVertical: space[2],
                        opacity: starting !== null && !busy ? 0.5 : 1,
                      }}
                    >
                      {busy ? <ActivityIndicator size="small" color={c.accentText} /> : <Icon icon={Mic} size={14} color="accent" />}
                      <ThemedText variant="label">{`${t.level} · Teil ${t.teilNo}`}</ThemedText>
                      <Pill label={`×${t.count}`} tone="neutral" />
                    </Pressable>
                  )
                })}
              </View>
              <ThemedText variant="caption" color="faint">Một Teil ngắn, chấm riêng — không phải thi lại cả bài.</ThemedText>
            </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Icon icon={MessageSquareQuote} size={16} color="accent" />
                    <ThemedText variant="bodyStrong" style={{ flex: 1 }}>{p.archetype}</ThemedText>
                  </View>
                  <View style={{ gap: space[2] }}>
                    {p.phrases.slice(0, 8).map((ph, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
                        <YellowSquare size={5} style={{ marginTop: 7 }} />
                        <ThemedText variant="body" style={{ flex: 1 }}>{ph}</ThemedText>
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
