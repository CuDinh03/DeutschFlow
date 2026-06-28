import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Pressable, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, useNavigation, type Href } from 'expo-router'
import { Check, BookOpen } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Button,
  AppHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  Caption,
  ProgressBar,
} from '@/components/ui'
import { parseLesenItems, type ExamObjItem } from '@/lib/examApi'
import { trackFeatureAction } from '@/lib/analytics'

interface AttemptResult {
  totalScore?: number
}

// Auto-scored objective reading (Lesen) attempt. Listening/Writing/Speaking are
// scored on the web; the app covers the true/false + single-choice items so a
// student can practise reading and get an instant score.
export default function ExamAttemptScreen() {
  const theme = useTheme()
  const c = theme.colors
  const params = useLocalSearchParams<{ examId: string; attemptId: string; title?: string }>()
  const examId = Number(params.examId)
  const attemptId = Number(params.attemptId)

  const navigation = useNavigation()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  // An attempt is "in progress" once the student has answered something and the
  // attempt has not been finished/scored yet. Leaving now silently discards the
  // answers and orphans the server-created attempt, so we confirm first.
  const hasUnsavedAttempt = Object.keys(answers).length > 0 && score == null
  // Set right before a confirmed navigation so the beforeRemove guard lets it through.
  const allowLeaveRef = useRef(false)

  // Confirm leaving mid-attempt; runs `proceed` only if the student chooses to exit.
  const confirmLeave = useCallback((proceed: () => void) => {
    Alert.alert(
      'Thoát bài thi?',
      'Bạn chưa nộp bài. Thoát bây giờ sẽ mất các câu đã trả lời.',
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Thoát', style: 'destructive', onPress: proceed },
      ],
    )
  }, [])

  const handleBack = useCallback(() => {
    if (hasUnsavedAttempt) {
      confirmLeave(() => {
        allowLeaveRef.current = true
        router.back()
      })
      return
    }
    router.back()
  }, [hasUnsavedAttempt, confirmLeave])

  // Guard the swipe-back / hardware-back gesture too, not just the header button.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedAttempt || allowLeaveRef.current) return
      e.preventDefault()
      confirmLeave(() => {
        allowLeaveRef.current = true
        navigation.dispatch(e.data.action)
      })
    })
    return unsubscribe
  }, [navigation, hasUnsavedAttempt, confirmLeave])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-questions', examId],
    queryFn: () =>
      api.get<{ sections_json: string }>(`/mock-exams/${examId}/questions`).then((r) => r.data),
    enabled: Number.isFinite(examId),
  })

  const parsed = useMemo(
    () => (data?.sections_json ? parseLesenItems(data.sections_json) : null),
    [data?.sections_json],
  )

  const totalItems = parsed?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0
  const answeredCount = Object.keys(answers).length

  async function submit() {
    if (answeredCount === 0) return
    setSubmitting(true)
    try {
      await api.post(`/mock-exams/attempts/${attemptId}/finish`, { answers })
      const res = await api.get<AttemptResult>(`/mock-exams/attempts/${attemptId}/result`)
      const total = res.data.totalScore ?? 0
      trackFeatureAction('mock_exam', 'completed', { score: total })
      setScore(total)
    } catch (e) {
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen edges={['top']}>
      <AppHeader title={params.title ?? 'Bài thi'} subtitle="Phần Đọc (Lesen)" onBack={handleBack} />

      {isLoading ? (
        <View style={{ paddingHorizontal: space[5], gap: space[3], paddingTop: space[2] }}>
          <Skeleton height={90} radius="2xl" />
          <Skeleton height={90} radius="2xl" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : score != null ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[5], gap: space[5] }}>
          {/* Result hero — editorial ink card carrying the auto-scored Lesen result */}
          <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: radius.md,
                  backgroundColor: c.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={Check} size={30} color="accent" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Caption color={c.accent}>Phần Đọc · Đã chấm</Caption>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                  <ThemedText variant="displayLg" style={{ color: c.onInk }}>
                    {String(score)}
                  </ThemedText>
                  <ThemedText variant="bodyStrong" style={{ color: c.onInkMuted }}>
                    điểm
                  </ThemedText>
                </View>
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  Nghe, Viết và Nói làm trên web để có điểm đầy đủ.
                </ThemedText>
              </View>
            </View>
          </Card>

          <View style={{ gap: space[2] }}>
            <Button
              label="Xem lại bài"
              onPress={() =>
                router.replace({
                  pathname: '/(student)/exam-review',
                  params: { attemptId: String(attemptId), title: params.title ?? 'Bài thi' },
                } as unknown as Href)
              }
            />
            <View style={{ alignItems: 'center', marginTop: space[1] }}>
              <ThemedText variant="label" color="muted" onPress={() => router.back()}>
                Xong
              </ThemedText>
            </View>
          </View>
        </View>
      ) : !parsed || parsed.groups.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={BookOpen}
            title="Chưa hỗ trợ trên app"
            message="Đề này gồm phần Nghe/Viết/Nói — hãy làm trên web. App hỗ trợ các đề có phần Đọc trắc nghiệm."
          />
        </View>
      ) : (
        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingBottom: space[10], gap: space[4], paddingTop: space[2] }}>
          {/* Progress — answered / total, mirrors the run-view progress bar */}
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Caption>Tiến độ</Caption>
              <ThemedText variant="monoLg" style={{ fontSize: 16, lineHeight: 20 }}>
                {answeredCount}
                <ThemedText variant="caption" color="faint">
                  {' '}
                  / {totalItems}
                </ThemedText>
              </ThemedText>
            </View>
            <ProgressBar value={totalItems > 0 ? answeredCount / totalItems : 0} height={6} />
          </View>

          {/* Editorial info banner */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              backgroundColor: c.infoSoft,
              borderRadius: radius.md,
              padding: space[3],
            }}
          >
            <Icon icon={BookOpen} size={18} color="info" />
            <ThemedText variant="caption" color="info" style={{ flex: 1 }}>
              Phần Đọc trắc nghiệm. Nghe/Viết/Nói làm trên web để có điểm đầy đủ.
            </ThemedText>
          </View>

          {parsed.groups.map((group, gi) => (
            <View key={gi} style={{ gap: space[3] }}>
              <Caption>{group.title}</Caption>
              {group.items.map((item) => (
                <QuestionCard
                  key={item.id}
                  item={item}
                  selected={answers[item.id]}
                  onSelect={(val) => setAnswers((prev) => ({ ...prev, [item.id]: val }))}
                />
              ))}
            </View>
          ))}

          <Button
            label={submitting ? 'Đang chấm…' : 'Nộp bài'}
            onPress={submit}
            loading={submitting}
            disabled={answeredCount === 0}
          />
        </Screen>
      )}
    </Screen>
  )
}

function QuestionCard({
  item,
  selected,
  onSelect,
}: {
  item: ExamObjItem
  selected?: string
  onSelect: (val: string) => void
}) {
  const { colors } = useTheme()
  const choices = item.options ?? ['richtig', 'falsch']
  const labelFor = (v: string) => (v === 'richtig' ? 'Richtig' : v === 'falsch' ? 'Falsch' : v)
  return (
    <Card style={{ gap: space[4] }}>
      {item.passage ? (
        <View
          style={{
            gap: space[2],
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.md,
            padding: space[3],
          }}
        >
          <Caption>Đoạn văn</Caption>
          <ThemedText variant="body" color="secondary">
            {item.passage}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText variant="title">{item.question}</ThemedText>
      <View style={{ gap: space[2] }}>
        {choices.map((choice) => (
          <Choice key={choice} label={labelFor(choice)} active={selected === choice} onPress={() => onSelect(choice)} />
        ))}
      </View>
    </Card>
  )
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        borderRadius: radius.sm,
        paddingHorizontal: space[4],
        // Compensate the +1px active border so rows don't shift height.
        paddingVertical: active ? space[4] - 1 : space[4],
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: active ? colors.accent : colors.borderStrong,
          backgroundColor: active ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Icon icon={Check} size={13} color="onAccent" strokeWidth={3} /> : null}
      </View>
      <ThemedText
        variant={active ? 'bodyStrong' : 'body'}
        color={active ? 'primary' : 'secondary'}
        style={{ flex: 1 }}
      >
        {label}
      </ThemedText>
    </Pressable>
  )
}
