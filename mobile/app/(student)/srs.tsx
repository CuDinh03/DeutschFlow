import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { RotateCcw, Check, X, Minus, PartyPopper } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, ProgressBar, AppHeader, EmptyState, ErrorState, Skeleton, Caption, YellowSquare } from '@/components/ui'
import type { ThemeColors } from '@/lib/theme'

interface DueCard {
  id: string
  word: string
  translation: string
  exampleSentence?: string
  gender?: 'der' | 'die' | 'das'
  cefrLevel?: string
}

const SWIPE_THRESHOLD = 80
const SWIPE_OUT = 400

export default function SrsScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [flipped, setFlipped] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const queryClient = useQueryClient()

  const { data: cards = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['srs-due'],
    queryFn: () => api.get<DueCard[]>('/srs/due?limit=20').then((r) => r.data),
  })

  const currentCard = cards[currentIndex]

  const startedRef = useRef(false)
  const completedRef = useRef(false)
  useEffect(() => {
    if (cards.length > 0 && !startedRef.current) {
      startedRef.current = true
      trackFeatureAction('srs_review', 'started', { due: cards.length })
    }
  }, [cards.length])
  useEffect(() => {
    if (cards.length > 0 && currentIndex >= cards.length && !completedRef.current) {
      completedRef.current = true
      trackFeatureAction('srs_review', 'completed', { reviewed: cards.length })
    }
  }, [currentIndex, cards.length])

  const flipRotation = useSharedValue(0)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const reviewMutation = useMutation({
    mutationFn: ({ vocabId, quality }: { vocabId: string; quality: number }) =>
      api.post('/srs/review', { vocabId, quality }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => {
      Alert.alert('Lỗi', apiMessage(e))
    },
  })

  const advance = useCallback(() => {
    setFlipped(false)
    flipRotation.value = 0
    translateX.value = 0
    translateY.value = 0
    setCurrentIndex((i) => i + 1)
  }, [flipRotation, translateX, translateY])

  const submitReview = useCallback(
    (quality: number) => {
      if (!currentCard) return
      reviewMutation.mutate({ vocabId: currentCard.id, quality })
      advance()
    },
    [currentCard, reviewMutation, advance],
  )

  const flipCard = useCallback(async () => {
    await Haptics.selectionAsync()
    flipRotation.value = withSpring(flipped ? 0 : 1)
    setFlipped((f) => !f)
  }, [flipped, flipRotation])

  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipRotation.value, [0, 0.5, 1], [1, 0, 0], Extrapolation.CLAMP),
    transform: [{ rotateY: `${interpolate(flipRotation.value, [0, 1], [0, 180])}deg` }],
  }))

  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipRotation.value, [0, 0.5, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [{ rotateY: `${interpolate(flipRotation.value, [0, 1], [180, 360])}deg` }],
  }))

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value * 0.05}deg` },
    ],
    opacity: interpolate(Math.abs(translateX.value), [0, 150], [1, 0.5], Extrapolation.CLAMP),
  }))

  const swipe = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX
      translateY.value = e.translationY * 0.2
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SWIPE_OUT, { duration: 250 }, () => runOnJS(submitReview)(5))
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success)
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SWIPE_OUT, { duration: 250 }, () => runOnJS(submitReview)(2))
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Error)
      } else {
        translateX.value = withSpring(0)
        translateY.value = withSpring(0)
      }
    })

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Ôn tập SRS" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: space[5], gap: space[4], paddingTop: space[2] }}>
          <Skeleton height={6} radius="full" />
          <Skeleton height={360} radius="3xl" />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen edges={['top']}>
        <AppHeader title="Ôn tập SRS" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState onRetry={() => void refetch()} />
        </View>
      </Screen>
    )
  }

  if (cards.length === 0 || currentIndex >= cards.length) {
    const done = cards.length > 0
    return (
      <Screen edges={['top']}>
        <AppHeader title="Ôn tập SRS" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={PartyPopper}
            title={done ? 'Xong rồi!' : 'Chưa có thẻ đến hạn'}
            message={
              done
                ? `Bạn đã ôn ${cards.length} thẻ hôm nay. Tuyệt vời!`
                : 'Không có thẻ nào đến hạn hôm nay. Quay lại sau nhé.'
            }
            actionLabel="Quay lại"
            onAction={() => router.back()}
          />
        </View>
      </Screen>
    )
  }

  const genderTone = currentCard.gender ?? null

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={`${currentIndex + 1} / ${cards.length}`}
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => { setCurrentIndex(0); void refetch() }} hitSlop={8}>
            <Icon icon={RotateCcw} size={20} color="secondary" />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: space[5], marginBottom: space[6] }}>
        <ProgressBar value={currentIndex / cards.length} />
      </View>

      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ flex: 1, paddingHorizontal: space[5] }, cardStyle]}>
          <Animated.View
            style={[frontStyle, cardFaceStyle(c)]}
            onTouchEnd={() => { void flipCard() }}
          >
            <View style={cardEyebrowStyle}>
              <Caption color={c.textMuted}>Tiếng Đức</Caption>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space[2], flexWrap: 'wrap' }}>
              {genderTone ? (
                <ThemedText variant="display" align="center" style={{ color: genderColor(c, genderTone) }}>
                  {currentCard.gender}
                </ThemedText>
              ) : null}
              <ThemedText variant="displayLg" align="center">
                {currentCard.word}
              </ThemedText>
            </View>
            {currentCard.cefrLevel ? (
              <View style={{ marginTop: space[4] }}>
                <Caption color={c.textFaint}>{currentCard.cefrLevel}</Caption>
              </View>
            ) : null}
            <View style={cardHintStyle}>
              <ThemedText variant="caption" color="faint">
                Chạm để xem nghĩa
              </ThemedText>
            </View>
          </Animated.View>

          <Animated.View
            style={[backStyle, cardFaceStyle(c)]}
            onTouchEnd={() => { void flipCard() }}
          >
            <View style={cardEyebrowStyle}>
              <Caption color={c.textMuted}>Nghĩa tiếng Việt</Caption>
            </View>
            <ThemedText variant="display" align="center">
              {currentCard.translation}
            </ThemedText>
            {currentCard.exampleSentence ? (
              <View
                style={{
                  width: '100%',
                  marginTop: space[6],
                  paddingTop: space[5],
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                }}
              >
                <Caption color={c.textMuted}>Ví dụ</Caption>
                <ThemedText variant="body" align="center" style={{ marginTop: space[2], fontStyle: 'italic' }}>
                  {currentCard.exampleSentence}
                </ThemedText>
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[6], marginBottom: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Icon icon={X} size={13} color="danger" />
          <Caption color={c.danger}>Vuốt trái · khó</Caption>
        </View>
        <YellowSquare size={6} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Caption color={c.success}>Dễ · vuốt phải</Caption>
          <Icon icon={Check} size={13} color="success" />
        </View>
      </View>

      {flipped ? (
        <View style={{ paddingHorizontal: space[5], marginBottom: space[6] }}>
          <View style={{ marginBottom: space[3] }}>
            <Caption>Mức độ nhớ</Caption>
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <GradeButton label="Quên" hint="< 1 phút" icon={X} tone="danger" onPress={() => submitReview(1)} />
            <GradeButton label="Khó" hint="Ôn lại" icon={Minus} tone="neutral" onPress={() => submitReview(3)} />
            <GradeButton label="Dễ" hint="Vài ngày" icon={Check} tone="success" onPress={() => submitReview(5)} />
          </View>
        </View>
      ) : null}
    </Screen>
  )
}

function GradeButton({
  label,
  hint,
  icon,
  tone,
  onPress,
}: {
  label: string
  hint: string
  icon: typeof Check
  tone: 'danger' | 'neutral' | 'success'
  onPress: () => void
}) {
  const c = useTheme().colors
  const toneMap = {
    danger: { soft: c.dangerSoft, fg: c.danger },
    neutral: { soft: c.surfaceSunken, fg: c.textSecondary },
    success: { soft: c.successSoft, fg: c.success },
  } as const
  const picked = toneMap[tone]

  const handlePress = () => {
    void Haptics.selectionAsync()
    onPress()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: space[1],
        paddingVertical: space[3],
        backgroundColor: picked.soft,
        borderWidth: 1,
        borderColor: picked.soft,
        borderRadius: radius.md,
      }}
    >
      <Icon icon={icon} size={18} color={tone === 'neutral' ? 'secondary' : tone} />
      <ThemedText variant="bodyStrong" style={{ color: picked.fg }}>
        {label}
      </ThemedText>
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 10,
          lineHeight: 13,
          color: c.textFaint,
        }}
      >
        {hint}
      </Text>
    </Pressable>
  )
}

function genderColor(c: ThemeColors, tone: 'der' | 'die' | 'das') {
  return c[tone]
}

const cardEyebrowStyle = {
  position: 'absolute' as const,
  top: space[6],
  left: 0,
  right: 0,
  alignItems: 'center' as const,
}

const cardHintStyle = {
  position: 'absolute' as const,
  bottom: space[6],
  left: 0,
  right: 0,
  alignItems: 'center' as const,
}

function cardFaceStyle(c: ThemeColors) {
  return {
    position: 'absolute' as const,
    top: 0,
    left: space[5],
    right: space[5],
    bottom: 0,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius['3xl'],
    padding: space[7],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }
}
