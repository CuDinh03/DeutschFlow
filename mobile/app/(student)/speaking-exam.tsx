import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ChevronRight, Crosshair, Lock, Mic } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, EmptyState, ErrorState, Pill, Screen, Skeleton, ThemedText, YellowSquare, Icon,
} from '@/components/ui'
import { usePlanStore } from '@/stores/usePlanStore'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { examSpeakingApi, type BlueprintSummary, type ExamMode, type ExamProvider } from '@/lib/examSpeakingApi'
import { getErrorTitle } from '@/lib/errorTaxonomy'
import { levelsFromBlueprints, providerName, verdict, verdictLabel, verdictTone } from '@/lib/examSpeakingUi'
import { trackFeatureAction } from '@/lib/analytics'
import { handleAiError } from '@/lib/upsell'

/** Hub Luyện thi Nói — thiết kế canvas 02/09 (đã chốt): hero chọn level, cấu trúc đề, điểm yếu, kết quả gần đây. */
export default function SpeakingExamHubScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { hasProAccess } = usePlanStore()
  // Parity web 05/09: mobile trước đây khoá cứng Goethe — telc có đủ blueprint A1–B2 từ V277.
  const [provider, setProvider] = useState<ExamProvider>('GOETHE')
  const [level, setLevel] = useState<string | null>(null)
  // Vorbereitungszeit: 5′ rút gọn (mặc định) hoặc chuẩn thi thật theo blueprint (B1/B2).
  const [prepMode, setPrepMode] = useState<'SHORT' | 'FULL'>('SHORT')
  // Khoá đang mở phòng: 'MOCK' hoặc `DRILL-<teil>` — mỗi nút chỉ xoay khi đúng là nó đang mở.
  const [starting, setStarting] = useState<string | null>(null)

  const blueprintsQ = useQuery({
    queryKey: ['exam-speaking-blueprints', provider],
    queryFn: () => examSpeakingApi.listBlueprints({ provider }),
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

  // N3 (đợt 2, 05/09): ngoài thi thử trọn bài (MOCK), backend nhận mode DRILL + teil để luyện
  // MỘT Teil — ngắn, chấm riêng, rẻ hơn (ExamSessionService: ~600 token/lượt chấm). Web đã có
  // thẻ drill từng Teil; mobile trước đây chỉ tạo MOCK.
  async function startSession(mode: ExamMode, teil?: number) {
    if (!activeLevel || starting) return
    const key = mode === 'MOCK' ? 'MOCK' : `DRILL-${teil ?? 0}`
    setStarting(key)
    try {
      trackFeatureAction('exam_speaking', 'started', { level: activeLevel, mode, teil: teil ?? null, provider })
      const session = await examSpeakingApi.createSession({
        provider,
        level: activeLevel,
        mode,
        teil,
        prepMode: mode === 'MOCK' && (activeBlueprint?.prepSec ?? 0) > 0 ? prepMode : undefined,
      })
      router.push({ pathname: '/(student)/speaking-exam-room', params: { id: String(session.id) } })
    } catch (e) {
      // F-08: tạo MOCK giữ chỗ ngân sách chấm — hết quota là lý do thường gặp nhất, dẫn thẳng tới nâng cấp.
      handleAiError(e, 'Không bắt đầu được')
    } finally {
      setStarting(null)
    }
  }
  const startMock = () => startSession('MOCK')

  if (!hasProAccess) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Luyện thi Nói" subtitle="Goethe · telc · Sprechen" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Lock}
            title="Tính năng PRO"
            message="Thi thử phần Nói với giám khảo AI, chấm theo đúng bộ tiêu chí Goethe hoặc telc."
            actionLabel={PAYWALL_ENABLED ? 'Xem PRO' : undefined}
            onAction={PAYWALL_ENABLED ? () => router.push('/(student)/upgrade') : undefined}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title="Luyện thi Nói" subtitle={`${providerName(provider)} · Sprechen · Beta`} onBack={() => router.back()} />
      <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
        {/* Hệ chứng chỉ — parity web (catalog có Goethe/telc từ Đợt 1) */}
        <View style={{ flexDirection: 'row', gap: space[2] }} accessibilityRole="radiogroup" accessibilityLabel="Hệ chứng chỉ">
          {(['GOETHE', 'TELC'] as const).map((p) => {
            const active = p === provider
            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Hệ ${providerName(p)}`}
                onPress={() => { setProvider(p); setLevel(null) }}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: space[3], borderRadius: radius.md,
                  borderWidth: 1, borderColor: active ? c.inkSurface : c.border,
                  backgroundColor: active ? c.inkSurface : c.surface,
                }}
              >
                <ThemedText variant="label" style={active ? { color: c.onInk } : undefined}>{providerName(p)}</ThemedText>
              </Pressable>
            )
          })}
        </View>

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
                <Caption color={c.onInkMuted}>Bài thi thử · phần Nói · Beta</Caption>
              </View>
              <ThemedText variant="display" style={{ color: c.onInk }}>
                Nói như trong phòng thi thật
              </ThemedText>
              <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                {`Giám khảo AI dẫn bạn qua đủ các Teil của đề ${providerName(provider)}, chấm theo đúng bộ tiêu chí của hệ.`}
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
              {(activeBlueprint?.prepSec ?? 0) > 0 && (
                <View style={{ gap: space[2] }}>
                  <Caption color={c.onInkMuted}>Thời gian chuẩn bị</Caption>
                  <View style={{ flexDirection: 'row', gap: space[2] }} accessibilityRole="radiogroup" accessibilityLabel="Thời gian chuẩn bị">
                    {([
                      { v: 'SHORT' as const, label: '5′ rút gọn' },
                      { v: 'FULL' as const, label: `${Math.round((activeBlueprint?.prepSec ?? 0) / 60)}′ chuẩn thi thật` },
                    ]).map((opt) => {
                      const active = prepMode === opt.v
                      return (
                        <Pressable
                          key={opt.v}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={opt.label}
                          onPress={() => setPrepMode(opt.v)}
                          style={{
                            borderRadius: radius.full, paddingHorizontal: space[4], paddingVertical: space[2] + 2,
                            backgroundColor: active ? c.accent : 'transparent',
                            borderWidth: active ? 0 : 1, borderColor: '#3A3833',
                          }}
                        >
                          <ThemedText variant="caption" style={{ color: active ? c.onAccent : c.onInkMuted }}>{opt.label}</ThemedText>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )}
              <Button
                label={starting === 'MOCK' ? 'Đang mở phòng thi…' : `Bắt đầu bài thi thử ${activeLevel ?? ''}`}
                onPress={() => void startMock()}
                loading={starting === 'MOCK'}
                disabled={starting !== null && starting !== 'MOCK'}
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
                      {/* N3: luyện riêng Teil này (mode DRILL) — không phải thi lại cả bài */}
                      <Button
                        label={`Luyện Teil ${p.teilNo}`}
                        variant="ghost"
                        size="sm"
                        loading={starting === `DRILL-${p.teilNo}`}
                        disabled={starting !== null && starting !== `DRILL-${p.teilNo}`}
                        onPress={() => void startSession('DRILL', p.teilNo)}
                      />
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
                  <ThemedText variant="bodyStrong">{`${providerName(r.provider)} ${r.level}`}</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    {verdict(r) === 'BORDERLINE' ? ' · sát ngưỡng, chưa kết luận' : r.passed === true ? ' · đủ điểm đỗ phần Nói' : r.passed === false ? ' · chưa đủ điểm đỗ' : ''}
                  </ThemedText>
                </View>
                <Pill label={verdictLabel(verdict(r))} tone={verdictTone(verdict(r))} />
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
        {/* Disclaimer — parity web catalog: điểm mô phỏng, đang hiệu chuẩn, không liên kết Goethe/telc */}
        <ThemedText variant="caption" color="faint" style={{ paddingHorizontal: space[1] }}>
          Mô phỏng theo định dạng đề thi công khai, đang hiệu chuẩn với giám khảo người (beta) — điểm chỉ để tham khảo, sai số ±1 bậc, không phải chứng nhận; không liên kết với Goethe-Institut hay telc.
        </ThemedText>
      </Screen>
    </Screen>
  )
}
