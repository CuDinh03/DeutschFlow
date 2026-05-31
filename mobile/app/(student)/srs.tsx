import { useState, useCallback } from 'react'
import { View, Pressable } from 'react-native'
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
import api from '@/lib/api'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, Button, ProgressBar, AppHeader, EmptyState, Skeleton } from '@/components/ui'
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

  const { data: cards = [], isLoading, refetch } = useQuery({
    queryKey: ['srs-due'],
    queryFn: () => api.get<DueCard[]>('/srs/due?limit=20').then((r) => r.data),
  })

  const currentCard = cards[currentIndex]

  const flipRotation = useSharedValue(0)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const reviewMutation = useMutation({
    mutationFn: ({ vocabId, quality }: { vocabId: string; quality: number }) =>
      api.post('/srs/review', { vocabId, quality }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
      void reviewMutation.mutateAsync({ vocabId: currentCard.id, quality })
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
            {genderTone ? <Pill label={currentCard.gender!} tone={genderTone} /> : null}
            <ThemedText variant="displayLg" align="center" style={{ marginTop: space[4] }}>
              {currentCard.word}
            </ThemedText>
            {currentCard.cefrLevel ? (
              <ThemedText variant="caption" color="muted" style={{ marginTop: space[2] }}>
                {currentCard.cefrLevel}
              </ThemedText>
            ) : null}
            <ThemedText variant="caption" color="faint" style={{ marginTop: space[6] }}>
              Nhấn để lật thẻ
            </ThemedText>
          </Animated.View>

          <Animated.View
            style={[backStyle, cardFaceStyle(c)]}
            onTouchEnd={() => { void flipCard() }}
          >
            <ThemedText variant="caption" color="muted">
              Dịch nghĩa
            </ThemedText>
            <ThemedText variant="display" align="center" style={{ marginTop: space[2] }}>
              {currentCard.translation}
            </ThemedText>
            {currentCard.exampleSentence ? (
              <Card tone="sunken" style={{ width: '100%', marginTop: space[6] }}>
                <ThemedText variant="caption" color="muted">
                  Ví dụ
                </ThemedText>
                <ThemedText variant="body" style={{ marginTop: space[1], fontStyle: 'italic' }}>
                  {currentCard.exampleSentence}
                </ThemedText>
              </Card>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[6], marginBottom: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Icon icon={X} size={14} color="danger" />
          <ThemedText variant="caption" color="danger">
            Khó (vuốt trái)
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Icon icon={Check} size={14} color="success" />
          <ThemedText variant="caption" color="success">
            Dễ (vuốt phải)
          </ThemedText>
        </View>
      </View>

      {flipped ? (
        <View style={{ flexDirection: 'row', gap: space[3], paddingHorizontal: space[5], marginBottom: space[6] }}>
          <Button label="Quên" variant="danger" icon={X} style={{ flex: 1 }} onPress={() => submitReview(1)} />
          <Button label="Khó" variant="secondary" icon={Minus} style={{ flex: 1 }} onPress={() => submitReview(3)} />
          <Button label="Dễ" variant="primary" icon={Check} style={{ flex: 1 }} onPress={() => submitReview(5)} />
        </View>
      ) : null}
    </Screen>
  )
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
