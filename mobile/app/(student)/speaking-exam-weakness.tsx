import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { MessageSquareQuote } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Caption, Card, EmptyState, ErrorState, Icon, Pill, Screen, Skeleton, ThemedText, YellowSquare,
} from '@/components/ui'
import { examSpeakingApi } from '@/lib/examSpeakingApi'

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

  return (
    <Screen edges={['top']}>
      <AppHeader title="Ôn yếu điểm" subtitle="Lỗi hay mắc trong phòng thi Nói" onBack={() => router.back()} />
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
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>

          {weakPoints.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>{`Lỗi hay mắc · ${weakPoints.length}`}</Caption>
              {weakPoints.map((w) => (
                <Card key={w.errorCode} style={{ gap: space[3] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                    <YellowSquare size={7} color={w.lastSeverity === 'HIGH' ? c.danger : c.orange} style={{ marginTop: 6 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="bodyStrong">{w.ruleVi ?? w.errorCode}</ThemedText>
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
