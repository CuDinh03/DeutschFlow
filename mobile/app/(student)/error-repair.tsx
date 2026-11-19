import { useMemo, useState } from 'react'
import { Alert, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Button, EmptyState, ErrorState, GaGlyph, Icon, Screen, Skeleton, TextField, ThemedText } from '@/components/ui'
import { GlyphTile, HeroTitle, ListCard, ListItem, RuledNote, SectionHead, TopBar } from '@/components/learn/HocOnParts'
import { drillPass, errorSkillsApi, todayApi, type ErrorSkill } from '@/lib/todayApi'
import { getErrorTitle } from '@/lib/errorTaxonomy'
import { trackFeatureAction } from '@/lib/analytics'
import { diffMiddle, errorMetaLine } from '@/lib/hocOnUi'
import { useBackToMainTab } from '@/hooks/useBackTo'

/**
 * Sửa lỗi đến hạn (cụm Heute — thiết kế đã chốt 02/09). Drill "gõ lại câu đúng"
 * gương ErrorRepairDrill web: target = sampleCorrected của chính lỗi bạn mắc;
 * pass → POST repair-attempt (semantics backend: đánh dấu RESOLVED sau drill).
 *
 * Giao diện v3.4 (Đợt 6A, mẫu `errors`): tiêu đề vệt vàng; lỗi đến hạn là thẻ có câu sai trên tờ giấy
 * lề đỏ (gạch chân đúng đoạn sai), ô "Câu đúng là…" và nút Kiểm tra; lỗi khác đang mở thành danh sách,
 * chạm một hàng để mở ô luyện ngay tại chỗ; "Đã trị dứt · N" ở cuối. Truy vấn và luật chấm giữ nguyên.
 */
export default function ErrorRepairScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()
  const queryClient = useQueryClient()
  // Hàng "Lỗi khác đang mở" đang mở ô luyện (một hàng một lúc).
  const [openCode, setOpenCode] = useState<string | null>(null)

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
  const resolved = resolvedQ.data ?? []

  const isLoading = planQ.isLoading || skillsQ.isLoading

  const heading = (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[4] }}>
      <HeroTitle lead="Sửa lỗi" mark="đến hạn" />
      <ThemedText variant="caption" color="muted" style={{ marginTop: space[1] }}>
        Lỗi bạn hay mắc, ôn theo lịch giãn cách.
      </ThemedText>
    </View>
  )

  return (
    <Screen edges={['top']}>
      <TopBar onBack={goBack} />
      {isLoading ? (
        <>
          {heading}
          <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[6] }}>
            <Skeleton height={180} radius="lg" />
            <Skeleton height={112} radius="md" />
          </View>
        </>
      ) : planQ.isError && skillsQ.isError ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => { void planQ.refetch(); void skillsQ.refetch() }} />
        </View>
      ) : dueSkills.length === 0 && otherSkills.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="hoanthanh"
            title="Không có lỗi nào đến hạn"
            message="Cứ luyện nói tiếp — lỗi mới (nếu có) sẽ vào lịch ôn ở đây."
            actionLabel="Quay lại"
            onAction={goBack}
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingBottom: space[10] }}>
          {heading}
          <View style={{ paddingHorizontal: space[5] }}>
            {dueSkills.length > 0 && (
              <>
                <SectionHead title={`Đến hạn hôm nay · ${dueSkills.length}`} />
                <View style={{ gap: space[3] }}>
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
              </>
            )}

            {otherSkills.length > 0 && (
              <>
                <SectionHead title="Lỗi khác đang mở" />
                <ListCard>
                  {otherSkills.map((s, i) => {
                    const open = openCode === s.errorCode
                    return (
                      <View key={s.errorCode}>
                        <ListItem
                          first={i === 0}
                          accessibilityLabel={`${s.ruleViShort ?? getErrorTitle(s.errorCode)}. ${errorMetaLine(s.count)}`}
                          accessibilityHint={open ? 'Thu ô luyện lại' : 'Mở ô luyện gõ lại câu đúng'}
                          onPress={() => setOpenCode(open ? null : s.errorCode)}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <WrongSnippet skill={s} />
                            <ThemedText variant="caption" color="muted">
                              {`${s.ruleViShort ?? getErrorTitle(s.errorCode)} · ${errorMetaLine(s.count)}`}
                            </ThemedText>
                          </View>
                          <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="faint" />
                        </ListItem>
                        {open ? (
                          <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
                            <DrillBody
                              skill={s}
                              onResolved={() => {
                                void queryClient.invalidateQueries({ queryKey: ['error-skills'] })
                                void queryClient.invalidateQueries({ queryKey: ['error-skills-resolved'] })
                              }}
                            />
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </ListCard>
              </>
            )}

            {resolved.length > 0 && (
              <>
                <SectionHead title={`Đã trị dứt · ${resolved.length}`} />
                <ListCard>
                  <ListItem first>
                    <GlyphTile name="hoanthanh" tone="green" />
                    <ThemedText variant="caption" color="secondary" style={{ flex: 1 }} numberOfLines={2}>
                      {resolved.slice(0, 4).map((s) => s.ruleViShort ?? getErrorTitle(s.errorCode)).join(' · ')}
                    </ThemedText>
                  </ListItem>
                </ListCard>
              </>
            )}
          </View>
        </Screen>
      )}
    </Screen>
  )
}

/** Câu sai, gạch chân đỏ đúng đoạn sai (mẫu `.fix-wrong`). Không tách được thì gạch cả câu. */
function WrongSentence({ wrong, corrected, variant = 'bodyLg' }: { wrong: string; corrected: string | null; variant?: 'bodyLg' | 'body' }) {
  const c = useTheme().colors
  const d = diffMiddle(wrong, corrected)
  const mark = {
    textDecorationLine: 'underline' as const,
    textDecorationStyle: 'dotted' as const,
    textDecorationColor: c.danger,
    color: c.danger,
  }
  if (!d || !d.wrong) {
    return (
      <ThemedText variant={variant} style={mark} accessibilityLanguage="de-DE">
        {wrong}
      </ThemedText>
    )
  }
  return (
    <ThemedText variant={variant} accessibilityLanguage="de-DE">
      {d.before ? `${d.before} ` : ''}
      <ThemedText variant={variant} style={mark}>
        {d.wrong}
      </ThemedText>
      {d.after ? ` ${d.after}` : ''}
    </ThemedText>
  )
}

/** Hàng danh sách: chỉ hiện đoạn sai (không lộ đáp án — người học còn có thể luyện ngay hàng này). */
function WrongSnippet({ skill }: { skill: ErrorSkill }) {
  const c = useTheme().colors
  if (!skill.sampleWrong) {
    return <ThemedText variant="body" style={{ fontFamily: fonts.bodyMedium }}>{skill.ruleViShort ?? getErrorTitle(skill.errorCode)}</ThemedText>
  }
  const d = diffMiddle(skill.sampleWrong, skill.sampleCorrected)
  const text = d && d.wrong ? d.wrong : skill.sampleWrong
  return (
    <ThemedText
      variant="body"
      numberOfLines={1}
      accessibilityLanguage="de-DE"
      style={{ fontFamily: fonts.bodyMedium, textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: c.danger }}
    >
      {text}
    </ThemedText>
  )
}

/** Thẻ drill của lỗi đến hạn (mẫu `#er-card`). */
function DrillCard({ skill, intervalDays, onResolved }: { skill: ErrorSkill; intervalDays?: number; onResolved: () => void }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.lg,
        padding: space[4],
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <DrillBody skill={skill} intervalDays={intervalDays} onResolved={onResolved} showRule />
    </View>
  )
}

/** Nội dung drill: câu sai → gõ lại câu đúng → pass = repair-attempt. Dùng cho thẻ đến hạn và hàng mở rộng. */
function DrillBody({
  skill,
  intervalDays,
  onResolved,
  showRule = false,
}: {
  skill: ErrorSkill
  intervalDays?: number
  onResolved: () => void
  showRule?: boolean
}) {
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <GlyphTile name="hoanthanh" tone="green" />
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {skill.ruleViShort ?? getErrorTitle(skill.errorCode)} — đã trị xong hôm nay
        </ThemedText>
      </View>
    )
  }

  return (
    <View style={{ gap: space[3] }}>
      {showRule ? (
        <ThemedText variant="bodyStrong">{skill.ruleViShort ?? getErrorTitle(skill.errorCode)}</ThemedText>
      ) : null}

      {skill.sampleWrong ? (
        <View style={{ gap: space[2] }}>
          <RuledNote>
            <WrongSentence wrong={skill.sampleWrong} corrected={skill.sampleCorrected} />
          </RuledNote>
          <ThemedText variant="caption" color="muted">
            {`${errorMetaLine(skill.count, intervalDays)} · gõ lại câu đúng, đúng umlaut/ß nhé`}
          </ThemedText>
        </View>
      ) : (
        <ThemedText variant="caption" color="muted">
          {errorMetaLine(skill.count, intervalDays)}
        </ThemedText>
      )}

      {target ? (
        <>
          <TextField
            label="Câu đúng là…"
            value={attempt}
            onChangeText={(v) => { setAttempt(v); if (phase === 'fail') setPhase('idle') }}
            placeholder="Gõ lại cả câu"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {phase === 'fail' ? (
            <ThemedText variant="caption" color="danger" accessibilityLiveRegion="polite">
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
          <GaGlyph name="sualoi" size={14} ink="muted" />
          <ThemedText variant="caption" color="muted" style={{ flex: 1 }}>
            Chưa có câu mẫu cho lỗi này — luyện nói thêm để hệ thống bắt được ví dụ.
          </ThemedText>
        </View>
      )}
    </View>
  )
}
