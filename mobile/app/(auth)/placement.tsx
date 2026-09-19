// M8b — Kiểm tra đầu vào 10 câu (Đợt 3 PR-2 kế hoạch onboarding 17/09/2026), trạng thái
// `FIRST_LESSON` của nhánh A1+ đã chọn placement. Port từ web `/v2/onboarding` bước STEP_PLACEMENT.
//
// Nguyên tắc: bỏ qua / thoát giữa chừng → vẫn vào Trang chủ, không mất gì (hồ sơ đã lưu trước
// khi tới đây; checklist tuần đầu mời lại). Nộp xong = ACTIVATION (`kind=PLACEMENT`) do SERVER
// ghi trong `PlacementTestService.submitTest` — client không gọi `/first-lesson/complete` (I-12).
// Không có trạng thái "thất bại": rớt là "đã tìm ra chỗ cần ôn", lộ trình bắt đầu thấp hơn.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, ArrowRight, Check, Volume2 } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { captureEvent } from '@/lib/analytics'
import { learningProfileApi } from '@/lib/learningProfileApi'
import {
  answeredCount,
  isAnswered,
  isChoiceQuestion,
  normalizePlacementLevel,
  placementApi,
  placementResultCopy,
  skillMeta,
  type PlacementAnswers,
  type PlacementLevel,
  type PlacementResult,
  type PlacementTestCreated,
} from '@/lib/placementTest'
import { speakGerman, stopGermanSpeech } from '@/lib/germanTts'
import { useBlockBackNavigation } from '@/hooks/useBlockBackNavigation'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Button, Caption, Card, Icon, Pill, Screen, SelectableChip, TextField, ThemedText, GaGlyph } from '@/components/ui'
import { RadioDot, TitleBlock } from '@/components/onboarding/WizardParts'
import { ConfettiBurst } from '@/components/guide/ConfettiBurst'
import { useT } from '@/lib/i18n'
import { placementMessages } from '@/lib/i18n/messages/placement'

type Phase = 'loading' | 'test' | 'submitting' | 'result' | 'error'

export default function PlacementScreen() {
  const c = useTheme().colors
  const t = useT(placementMessages)
  const { level: rawLevel } = useLocalSearchParams<{ level?: string }>()
  const [level, setLevel] = useState<PlacementLevel | null>(normalizePlacementLevel(rawLevel))
  const [phase, setPhase] = useState<Phase>('loading')
  const [test, setTest] = useState<PlacementTestCreated | null>(null)
  const [answers, setAnswers] = useState<PlacementAnswers>({})
  const [current, setCurrent] = useState(0)
  const [result, setResult] = useState<PlacementResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView | null>(null)

  // Tới đây chỉ sau khi hồ sơ đã lưu ⇒ đang đăng nhập; lùi là rơi vào Đăng nhập (F-5). Thoát = "Bỏ qua".
  useBlockBackNavigation(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      // Trình độ: route param (A1–C2) → hồ sơ học trên server → không có = A0/không rõ ⇒ placement
      // vô nghĩa, về Trang chủ như "bỏ qua". Không bao giờ gửi claimedLevel bịa.
      let lv = normalizePlacementLevel(rawLevel)
      if (!lv) {
        try {
          lv = normalizePlacementLevel((await learningProfileApi.me()).currentLevel)
        } catch { /* rơi xuống dưới */ }
      }
      if (!active) return
      if (!lv) {
        captureEvent('onboarding_placement_skipped', { currentLevel: null, at: 'no_level' })
        router.replace('/(student)')
        return
      }
      setLevel(lv)
      try {
        const created = await placementApi.create(lv)
        if (!active) return
        if (created.questions.length === 0) throw new Error('empty')
        captureEvent('onboarding_placement_test_started', { level: lv })
        setTest(created)
        setPhase('test')
      } catch (e) {
        if (!active) return
        setErrorMsg(apiMessage(e))
        setPhase('error')
      }
    })()
    return () => { active = false }
    // Chạy đúng một lần khi vào màn; param không đổi trong đời màn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rời màn thì tắt giọng đang đọc transcript.
  useEffect(() => () => { void stopGermanSpeech() }, [])

  function leave(at: string) {
    captureEvent('onboarding_placement_skipped', { currentLevel: level, at, answered: test ? answeredCount(test.questions, answers) : 0 })
    router.replace('/(student)')
  }

  function goTo(index: number) {
    void Haptics.selectionAsync()
    void stopGermanSpeech()
    setCurrent(index)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  async function submit() {
    if (!test || !level) return
    setPhase('submitting')
    try {
      const r = await placementApi.submit(test.testId, answers)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      captureEvent('onboarding_placement_test_completed', { passed: r.passed, score: r.scorePercent, level })
      captureEvent('placement_completed', { level, passed: r.passed, score: r.scorePercent })
      // Taxonomy onb_v3 (spec §6.2): bài đầu tiên của nhánh A1+; activation do server ghi.
      captureEvent('first_lesson_completed', { kind: 'placement', passed: r.passed })
      setResult(r)
      setPhase('result')
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setPhase('test')
      Alert.alert(t('submitFailed.title'), apiMessage(e))
    }
  }

  function confirmSubmit() {
    if (!test) return
    const missing = test.questions.length - answeredCount(test.questions, answers)
    if (missing === 0) {
      void submit()
      return
    }
    Alert.alert(
      t('confirm.title', { count: missing }),
      t('confirm.body'),
      [
        { text: t('confirm.review'), style: 'cancel' },
        { text: t('confirm.submit'), onPress: () => void submit() },
      ],
    )
  }

  if (phase === 'loading') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: space[6] }}>
          <ActivityIndicator size="large" color={c.accent} />
          <ThemedText variant="titleLg" align="center">{t('loading.title')}</ThemedText>
          <ThemedText variant="caption" color="secondary" align="center">
            {t('loading.sub')}
          </ThemedText>
        </View>
      </Screen>
    )
  }

  if (phase === 'error') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[6], gap: space[5] }}>
          <TitleBlock cap={t('error.cap')} title={t('error.title')} sub={errorMsg ?? t('error.fallback')} />
          <ThemedText variant="body" color="secondary">
            {t('error.body')}
          </ThemedText>
        </View>
        <Footer>
          <Button label={t('error.cta')} onPress={() => leave('create_failed')} />
        </Footer>
      </Screen>
    )
  }

  if (phase === 'result' && result && level) {
    const copy = placementResultCopy(result, level)
    return (
      <Screen edges={['top', 'bottom']}>
        {result.passed ? <ConfettiBurst /> : null}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: space[6], paddingVertical: space[5] }}
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', ...motion.spring.bouncy }}
            style={{ alignItems: 'center', gap: space[4] }}
            accessibilityLiveRegion="polite"
          >
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: radius.full,
                backgroundColor: result.passed ? c.successSoft : c.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {result.passed ? (
                <Icon icon={Check} size={40} color="success" strokeWidth={2.6} />
              ) : (
                <GaGlyph name="sualoi" size={40} ink="primary" />
              )}
            </View>
            <ThemedText variant="display" align="center" accessibilityRole="header">
              {copy.title}
            </ThemedText>
            <Pill label={copy.score} tone={result.passed ? 'success' : 'accent'} />
            <ThemedText variant="body" color="secondary" align="center">
              {copy.body}
            </ThemedText>
          </MotiView>
        </ScrollView>
        <Footer>
          <Button label={copy.cta} icon={ArrowRight} iconRight onPress={() => router.replace('/(student)')} />
        </Footer>
      </Screen>
    )
  }

  if (!test || !level) return null
  const q = test.questions[current]
  const total = test.questions.length
  const isLast = current === total - 1
  const meta = skillMeta(q.skillSection)
  const answer = answers[String(q.id)] ?? ''
  const busy = phase === 'submitting'

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header: nhãn + Bỏ qua; dải 10 vạch + bộ đếm (thông tin thật ở bộ đếm, dải chỉ trang trí). */}
        <View style={{ paddingHorizontal: space[5], gap: space[2], paddingBottom: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
            <Caption>{t('header.cap', { level })}</Caption>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('header.skipA11y')}
              hitSlop={10}
              disabled={busy}
              onPress={() => leave('mid_test')}
              style={{ paddingVertical: space[1], paddingHorizontal: space[2] }}
            >
              <ThemedText variant="bodyStrong" color="accent">{t('header.skip')}</ThemedText>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ flex: 1, flexDirection: 'row', gap: space[1] }}
            >
              {test.questions.map((item, i) => (
                <View
                  key={item.id}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: radius.full,
                    backgroundColor: i < current ? (isAnswered(answers, item.id) ? c.success : c.border) : i === current ? c.accent : c.border,
                  }}
                />
              ))}
            </View>
            <ThemedText
              variant="label"
              color="secondary"
              accessibilityLabel={t('header.progressA11y', { current: current + 1, total })}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {current + 1}/{total}
            </ThemedText>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[8], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            key={q.id}
            from={{ opacity: 0, translateX: 24 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: motion.duration.normal }}
            style={{ gap: space[4] }}
          >
            <View style={{ flexDirection: 'row' }}>
              <Pill label={meta.label} glyph={meta.glyph} />
            </View>

            {q.audioTranscript ? (
              <Card tone="sunken" style={{ gap: space[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                  <GaGlyph name="nghe" size={20} ink="secondary" />
                  <ThemedText variant="body" color="secondary" style={{ flex: 1, fontStyle: 'italic' }}>
                    „{q.audioTranscript}“
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('audio.listenA11y')}
                  hitSlop={8}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    captureEvent('placement_audio_played', { questionId: q.id })
                    void speakGerman(q.audioTranscript ?? undefined)
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start' }}
                >
                  <Icon icon={Volume2} size={18} color="accent" />
                  <ThemedText variant="bodyStrong" color="accent">{t('audio.listen')}</ThemedText>
                </Pressable>
              </Card>
            ) : null}

            <View style={{ gap: space[1] }}>
              <ThemedText variant="titleLg" accessibilityRole="header">
                {q.questionDe}
              </ThemedText>
              {q.questionVi ? (
                <ThemedText variant="caption" color="secondary">
                  {q.questionVi}
                </ThemedText>
              ) : null}
            </View>

            {isChoiceQuestion(q) ? (
              <View accessibilityRole="radiogroup" style={{ gap: space[3] }}>
                {(q.options ?? []).map((opt, i) => {
                  const selected = answer === opt
                  const letter = String.fromCharCode(65 + i)
                  return (
                    <SelectableChip
                      key={`${q.id}-${i}`}
                      label={`${letter}. ${opt}`}
                      selected={selected}
                      disabled={busy}
                      onPress={() => {
                        void Haptics.selectionAsync()
                        setAnswers((a) => ({ ...a, [String(q.id)]: opt }))
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space[3],
                        padding: space[4],
                        borderRadius: radius.md,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? c.accentText : c.border,
                        backgroundColor: selected ? c.accentSoft : c.surface,
                      }}
                    >
                      <RadioDot selected={selected} />
                      <ThemedText variant="label" color="secondary" style={{ width: 18 }}>
                        {letter}
                      </ThemedText>
                      <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
                        {opt}
                      </ThemedText>
                    </SelectableChip>
                  )
                })}
              </View>
            ) : (
              <TextField
                label={t('answer.label')}
                value={answer}
                onChangeText={(text) => setAnswers((a) => ({ ...a, [String(q.id)]: text }))}
                placeholder={t('answer.placeholder')}
                multiline
                numberOfLines={4}
                autoCapitalize="sentences"
                autoCorrect={false}
                editable={!busy}
                style={{ minHeight: 112, textAlignVertical: 'top' }}
              />
            )}
          </MotiView>
        </ScrollView>

        <Footer row>
          {current > 0 ? (
            <Button label={t('nav.prev')} variant="ghost" icon={ArrowLeft} disabled={busy} onPress={() => goTo(current - 1)} />
          ) : (
            <View />
          )}
          {isLast ? (
            <Button label={t('nav.submit')} variant="yellow" loading={busy} disabled={busy} onPress={confirmSubmit} />
          ) : (
            <Button label={t('nav.next')} icon={ArrowRight} iconRight disabled={busy} onPress={() => goTo(current + 1)} />
          )}
        </Footer>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Footer({ children, row = false }: { children: ReactNode; row?: boolean }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.surface,
        paddingHorizontal: space[6],
        paddingTop: space[4],
        paddingBottom: space[2],
        gap: space[2],
        ...(row ? { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const } : null),
      }}
    >
      {children}
    </View>
  )
}
