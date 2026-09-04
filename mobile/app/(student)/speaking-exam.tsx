import { useMemo, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ChevronRight, Crosshair, Lock, Mic } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, EmptyState, ErrorState, Pill, Screen, Skeleton, ThemedText, YellowSquare, Icon,
} from '@/components/ui'
import { usePlanStore } from '@/stores/usePlanStore'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { examSpeakingApi, type BlueprintSummary } from '@/lib/examSpeakingApi'
import { getErrorTitle } from '@/lib/errorTaxonomy'
import { levelsFromBlueprints } from '@/lib/examSpeakingUi'
import { trackFeatureAction } from '@/lib/analytics'

/** Hub Luyện thi Nói — thiết kế canvas 02/09 (đã chốt): hero chọn level, cấu trúc đề, điểm yếu, kết quả gần đây. */
export default function SpeakingExamHubScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { hasProAccess } = usePlanStore()
  const [level, setLevel] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const blueprintsQ = useQuery({
    queryKey: ['exam-speaking-blueprints'],
    queryFn: () => examSpeakingApi.listBlueprints({ provider: 'GOETHE' }),
    enabled: hasProAccess,
    staleTime: 60_000 * 30,
  })
  const resultsQ = useQuery({
    queryKey: ['exam-speaking-results'],
    queryFn: () => examSpeakingApi.listResults(),
    enabled: hasProAccess,
    staleTime: 30_000,
  })
  const weaknessQ = useQuery({
    queryKey: ['exam-speaking-weakness'],
    queryFn: () => examSpeakingApi.getWeakness(),
    enabled: hasProAccess,
    staleTime: 60_000 * 5,
  })

  const blueprints = blueprintsQ.data ?? []
  const levels = useMemo(() => levelsFromBlueprints(blueprints), [blueprints])
  // Ưu tiên B1 (band phổ biến nhất) — cùng luật với weekly (F-19).
  const activeLevel = level ?? (levels.includes('B1') ? 'B1' : levels[0] ?? null)
  const activeBlueprint: BlueprintSummary | undefined = blueprints.find((b) => b.level === activeLevel)
  const topWeak = (weaknessQ.data?.weakPoints ?? []).slice(0, 2)
  const recent = (resultsQ.data ?? []).slice(0, 3)

  async function startMock() {
    if (!activeLevel || starting) return
    setStarting(true)
    try {
      trackFeatureAction('exam_speaking', 'started', { level: activeLevel })
      const session = await examSpeakingApi.createSession({ provider: 'GOETHE', level: activeLevel, mode: 'MOCK' })
      router.push({ pathname: '/(student)/speaking-exam-room', params: { id: String(session.id) } })
    } catch (e) {
      Alert.alert('Không bắt đầu được', apiMessage(e))
    } finally {
      setStarting(false)
    }
  }

  if (!hasProAccess) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Luyện thi Nói" subtitle="Goethe-Zertifikat · Sprechen" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Lock}
            title="Tính năng PRO"
            message="Thi thử phần Nói với giám khảo AI, chấm theo đúng rubric Goethe."
            actionLabel={PAYWALL_ENABLED ? 'Xem PRO' : undefined}
            onAction={PAYWALL_ENABLED ? () => router.push('/(student)/upgrade') : undefined}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Luyện thi Nói" subtitle="Goethe-Zertifikat · Sprechen" onBack={() => router.back()} />
      <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>

        {blueprintsQ.isLoading ? (
          <Skeleton height={260} radius="3xl" />
        ) : blueprintsQ.isError ? (
          <ErrorState onRetry={() => void blueprintsQ.refetch()} />
        ) : blueprints.length === 0 ? (
          <Card style={{ paddingVertical: space[6] }}>
            <ThemedText variant="body" color="muted" align="center">
              Chưa có đề thi thử — bạn quay lại sau nhé.
            </ThemedText>
          </Card>
        ) : (
          <>
            {/* Ink hero — chọn level + bắt đầu (thiết kế đã chốt) */}
            <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[4] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <YellowSquare />
                <Caption color={c.onInkMuted}>Bài thi thử · phần Nói</Caption>
              </View>
              <ThemedText variant="display" style={{ color: c.onInk }}>
                Nói như trong phòng thi thật
              </ThemedText>
              <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                Giám khảo AI dẫn bạn qua đủ các Teil của đề Goethe, chấm theo đúng rubric 4 tiêu chí.
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                {levels.map((lv) => {
                  const active = lv === activeLevel
                  return (
                    <Pressable
                      key={lv}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Trình độ ${lv}`}
                      onPress={() => setLevel(lv)}
                      style={{
                        borderRadius: radius.full,
                        paddingHorizontal: space[4] + 2,
                        paddingVertical: space[3],
                        backgroundColor: active ? c.accent : 'transparent',
                        borderWidth: active ? 0 : 1,
                        borderColor: '#3A3833',
                      }}
                    >
                      <ThemedText variant="label" style={{ color: active ? c.onAccent : c.onInkMuted }}>{lv}</ThemedText>
                    </Pressable>
                  )
                })}
              </View>
              <Button
                label={starting ? 'Đang mở phòng thi…' : `Bắt đầu bài thi thử ${activeLevel ?? ''}`}
                onPress={() => void startMock()}
                loading={starting}
              />
            </Card>

            {/* Cấu trúc đề của level đang chọn */}
            {activeBlueprint && (
              <View style={{ gap: space[2] }}>
                <Caption>{`Cấu trúc đề · Sprechen ${activeBlueprint.level}`}</Caption>
                <Card padded={false}>
                  {activeBlueprint.parts.map((p, i) => (
                    <View
                      key={p.teilNo}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: space[3],
                        paddingHorizontal: space[4], paddingVertical: space[3] + 2,
                        borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border,
                      }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                        <ThemedText variant="label">{p.teilNo}</ThemedText>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText variant="bodyStrong">{p.title}</ThemedText>
                        <ThemedText variant="caption" color="secondary">
                          {`~${Math.max(1, Math.round(p.durationSec / 60))} phút${p.hasPartner ? ' · nói cùng partner' : ''}`}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}

        {/* Điểm yếu */}
        {topWeak.length > 0 && (
          <Card
            onPress={() => router.push('/(student)/speaking-exam-weakness')}
            accessibilityLabel="Xem điểm yếu của bạn"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
          >
            <Icon icon={Crosshair} size={20} color="accent" />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong">Điểm yếu của bạn</ThemedText>
              <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                {topWeak.map((w) => w.ruleVi ?? getErrorTitle(w.errorCode)).join(' · ')}
              </ThemedText>
            </View>
            <Icon icon={ChevronRight} size={16} color="muted" />
          </Card>
        )}

        {/* Kết quả gần đây */}
        {recent.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Caption>Kết quả gần đây</Caption>
            {recent.map((r) => (
              <Card
                key={r.sessionId}
                onPress={() => router.push({ pathname: '/(student)/speaking-exam-result', params: { id: String(r.sessionId) } })}
                accessibilityLabel={`Kết quả Sprechen ${r.level}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
              >
                <ThemedText variant="monoLg">{r.total != null ? String(Math.round(r.total)) : '—'}</ThemedText>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="bodyStrong">{`Sprechen ${r.level}`}</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    {r.passed === true ? ' · đủ điểm đỗ phần Nói' : r.passed === false ? ' · chưa đủ điểm đỗ' : ''}
                  </ThemedText>
                </View>
                <Pill
                  label={r.passed === false ? 'CHƯA ĐẠT' : 'ĐÃ CHẤM'}
                  tone={r.passed === false ? 'danger' : 'success'}
                />
              </Card>
            ))}
          </View>
        )}

        {/* Ghi chú mic cho người mới */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[1] }}>
          <Icon icon={Mic} size={14} color="faint" />
          <ThemedText variant="caption" color="faint" style={{ flex: 1 }}>
            Bài thi dùng microphone; bản ghi được gửi tới máy chủ và đối tác AI để phiên âm, chấm điểm.
          </ThemedText>
        </View>
      </Screen>
    </Screen>
  )
}
