import { useMemo, useState } from 'react'
import { Alert, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Check, Wrench } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  AppHeader, Button, Caption, Card, EmptyState, ErrorState, Icon, Pill, Screen, Skeleton, TextField, ThemedText, YellowSquare,
} from '@/components/ui'
import { drillPass, errorSkillsApi, todayApi, type ErrorSkill } from '@/lib/todayApi'
import { trackFeatureAction } from '@/lib/analytics'

/**
 * Sửa lỗi đến hạn (cụm Heute — thiết kế đã chốt 02/09). Drill "gõ lại câu đúng"
 * gương ErrorRepairDrill web: target = sampleCorrected của chính lỗi bạn mắc;
 * pass → POST repair-attempt (semantics backend: đánh dấu RESOLVED sau drill).
 */
export default function ErrorRepairScreen() {
  const theme = useTheme()
  const c = theme.colors
  const queryClient = useQueryClient()

  const planQ = useQuery({ queryKey: ['today-plan'], queryFn: () => todayApi.me(), staleTime: 60_000 })
  const skillsQ = useQuery({ queryKey: ['error-skills'], queryFn: () => errorSkillsApi.mine(), staleTime: 60_000 })
  const resolvedQ = useQuery({ queryKey: ['error-skills-resolved'], queryFn: () => errorSkillsApi.resolved(), staleTime: 60_000 })

  const dueTasks = planQ.data?.dueRepairTasks ?? []
  const skillByCode = useMemo(
    () => new Map((skillsQ.data ?? []).map((s) => [s.errorCode, s])),
    [skillsQ.data],
  )
  // Lỗi đến hạn trước, rồi các lỗi mở khác theo priority — mỗi mã một thẻ drill.
  const dueCodes = new Set(dueTasks.map((t) => t.errorCode))
  const dueSkills = [...dueCodes].map((code) => skillByCode.get(code)).filter((s): s is ErrorSkill => !!s)
  const otherSkills = (skillsQ.data ?? []).filter((s) => !dueCodes.has(s.errorCode)).slice(0, 3)
  const intervalByCode = new Map(dueTasks.map((t) => [t.errorCode, t.intervalDays]))

  const isLoading = planQ.isLoading || skillsQ.isLoading

  return (
    <Screen edges={['top']}>
      <AppHeader title="Sửa lỗi đến hạn" subtitle="Lỗi bạn hay mắc, ôn theo lịch giãn cách" onBack={() => router.back()} />
      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={150} radius="2xl" />
          <Skeleton height={150} radius="2xl" />
        </View>
      ) : planQ.isError && skillsQ.isError ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => { void planQ.refetch(); void skillsQ.refetch() }} />
        </View>
      ) : dueSkills.length === 0 && otherSkills.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={Check}
            title="Không có lỗi nào đến hạn"
            message="Cứ luyện nói tiếp — lỗi mới (nếu có) sẽ vào lịch ôn ở đây."
            actionLabel="Quay lại"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
          {dueSkills.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>{`Đến hạn hôm nay · ${dueSkills.length}`}</Caption>
              {dueSkills.map((s) => (
                <DrillCard
                  key={s.errorCode}
                  skill={s}
                  intervalDays={intervalByCode.get(s.errorCode)}
                  onResolved={() => {
                    void queryClient.invalidateQueries({ queryKey: ['today-plan'] })
                    void queryClient.invalidateQueries({ queryKey: ['error-skills'] })
                    void queryClient.invalidateQueries({ queryKey: ['error-skills-resolved'] })
                  }}
                />
              ))}
            </View>
          )}

          {otherSkills.length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>Lỗi khác đang mở</Caption>
              {otherSkills.map((s) => (
                <DrillCard key={s.errorCode} skill={s} onResolved={() => {
                  void queryClient.invalidateQueries({ queryKey: ['error-skills'] })
                  void queryClient.invalidateQueries({ queryKey: ['error-skills-resolved'] })
                }} />
              ))}
            </View>
          )}

          {(resolvedQ.data ?? []).length > 0 && (
            <View style={{ gap: space[2] }}>
              <Caption>{`Đã trị dứt · ${(resolvedQ.data ?? []).length}`}</Caption>
              <View style={{ backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border, borderRadius: radius['2xl'], padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon icon={Check} size={16} color="success" />
                <ThemedText variant="caption" color="secondary" style={{ flex: 1 }} numberOfLines={2}>
                  {(resolvedQ.data ?? []).slice(0, 4).map((s) => s.ruleViShort ?? s.errorCode).join(' · ')}
                </ThemedText>
              </View>
            </View>
          )}
        </Screen>
      )}
    </Screen>
  )
}

/** Một thẻ drill: đọc luật + câu sai → gõ lại câu đúng → pass = repair-attempt. */
function DrillCard({ skill, intervalDays, onResolved }: { skill: ErrorSkill; intervalDays?: number; onResolved: () => void }) {
  const c = useTheme().colors
  const [attempt, setAttempt] = useState('')
  const [phase, setPhase] = useState<'idle' | 'fail' | 'submitting' | 'done'>('idle')
  const target = skill.sampleCorrected ?? ''

  async function check() {
    if (!target) return
    if (!drillPass(attempt, target)) {
      setPhase('fail')
      return
    }
    setPhase('submitting')
    try {
      await errorSkillsApi.repairAttempt(skill.errorCode)
      trackFeatureAction('error_repair', 'completed', { code: skill.errorCode })
      setPhase('done')
      onResolved()
    } catch (e) {
      setPhase('idle')
      Alert.alert('Lỗi', apiMessage(e))
    }
  }

  if (phase === 'done') {
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], borderColor: c.success }}>
        <Icon icon={Check} size={20} color="success" />
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {skill.ruleViShort ?? skill.errorCode} — đã trị xong hôm nay
        </ThemedText>
      </Card>
    )
  }

  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <YellowSquare size={7} color={c.danger} style={{ marginTop: 6 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="bodyStrong">{skill.ruleViShort ?? skill.errorCode}</ThemedText>
          <ThemedText variant="caption" color="secondary">
            {`Mắc ${skill.count} lần gần đây${intervalDays != null ? ` · chu kỳ ${intervalDays} ngày` : ''}`}
          </ThemedText>
        </View>
        <Pill label={`×${skill.count}`} tone="neutral" />
      </View>

      {skill.sampleWrong ? (
        <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: 2 }}>
          <ThemedText variant="body" color="muted" style={{ textDecorationLine: 'line-through' }}>
            {skill.sampleWrong}
          </ThemedText>
          <ThemedText variant="caption" color="faint">Gõ lại CÂU ĐÚNG vào ô dưới — đúng umlaut/ß nhé.</ThemedText>
        </View>
      ) : null}

      {target ? (
        <>
          <TextField
            value={attempt}
            onChangeText={(v) => { setAttempt(v); if (phase === 'fail') setPhase('idle') }}
            placeholder="Câu đúng là…"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {phase === 'fail' ? (
            <ThemedText variant="caption" color="danger">
              Chưa khớp — so từng từ với câu sai phía trên rồi thử lại (chấp nhận khác dấu câu).
            </ThemedText>
          ) : null}
          <Button
            label={phase === 'submitting' ? 'Đang lưu…' : 'Kiểm tra'}
            onPress={() => void check()}
            loading={phase === 'submitting'}
            disabled={attempt.trim().length === 0}
          />
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon icon={Wrench} size={14} color="muted" />
          <ThemedText variant="caption" color="muted" style={{ flex: 1 }}>
            Chưa có câu mẫu cho lỗi này — luyện nói thêm để hệ thống bắt được ví dụ.
          </ThemedText>
        </View>
      )}
    </Card>
  )
}
