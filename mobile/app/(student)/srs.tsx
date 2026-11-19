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
import { RotateCcw, Check, X } from 'lucide-react-native'
import api, { apiMessage, isTransientFailure } from '@/lib/api'
import { trackFeatureAction } from '@/lib/analytics'
import { useStarterStore } from '@/stores/useStarterStore'
import { useSrsOfflineStore } from '@/stores/useSrsOfflineStore'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, IconButton, ProgressBar, EmptyState, ErrorState, Skeleton, VocabGlyphTile } from '@/components/ui'
import { ArtBadge, Badge, RuledNote, TopBar } from '@/components/learn/HocOnParts'
import type { ThemeColors } from '@/lib/theme'
import { useBackToMainTab } from '@/hooks/useBackTo'

interface DueCard {
  id: string
  vocabId: string
  word: string
  translation: string
  exampleSentence?: string
  gender?: 'der' | 'die' | 'das'
  cefrLevel?: string
}

// Backend VocabReviewCard (record): german/meaning/exampleDe — NOT word/translation/exampleSentence.
// Casting the response straight to DueCard rendered cards with blank text.
interface RawDueCard {
  id: number
  vocabId: string
  german: string
  meaning: string | null
  exampleDe?: string
  speakDe?: string
  gender?: string
  cefrLevel?: string
}

function mapCard(r: RawDueCard): DueCard {
  const g = r.gender === 'der' || r.gender === 'die' || r.gender === 'das' ? r.gender : undefined
  return {
    id: String(r.id),
    vocabId: r.vocabId,
    word: r.german,
    translation: r.meaning ?? '',
    exampleSentence: r.exampleDe,
    gender: g,
    cefrLevel: r.cefrLevel,
  }
}

const SWIPE_THRESHOLD = 80
const SWIPE_OUT = 400

// Giao diện v3.4 (Đợt 6A, mẫu `srs`): đầu màn "Ôn thẻ · n / N", thẻ lật có viên mạo từ, mặt sau có
// câu ví dụ trên tờ giấy lề đỏ, ba ô chấm mức nhớ kiểu `.rate`, chú thích màu der/die/das ở cuối.
// Lật, vuốt, chấm (quality 1/3/5), hàng đợi offline giữ nguyên.
export default function SrsScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()
  const theme = useTheme()
  const c = theme.colors
  const [flipped, setFlipped] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const queryClient = useQueryClient()

  const { data: cards = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['srs-due'],
    // The server ignores a `limit` query param (it caps server-side); map the raw record
    // shape into the display shape so the German word/meaning actually render.
    queryFn: () => api.get<RawDueCard[]>('/srs/due').then((r) => r.data.map(mapCard)),
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

  // F-12 (soát 02/09): advance() chạy ngay (UX mượt) nghĩa là thẻ đã trôi qua khi
  // POST lỗi — trước đây lượt chấm đó MẤT HẲN (mutation không retry, Alert xong
  // là hết đường gửi lại). Nay lỗi thoáng qua (mất mạng/5xx) → đưa vào hàng đợi
  // offline; sync() tự bắn lại khi app foreground (app/_layout.tsx). 4xx là server
  // từ chối có chủ đích (vd vocab không trong lịch ôn) — vẫn báo như cũ.
  const pendingSync = useSrsOfflineStore((s) => s.pendingCount)
  useEffect(() => {
    useSrsOfflineStore.getState().loadCount()
  }, [])
  const reviewMutation = useMutation({
    mutationFn: ({ vocabId, quality }: { vocabId: string; quality: number }) =>
      api.post('/srs/review', { vocabId, quality }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e, vars) => {
      if (isTransientFailure(e)) {
        useSrsOfflineStore.getState().enqueue(vars.vocabId, vars.quality)
        return
      }
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
      // Review is keyed by the vocab string id ("sg01_01"), NOT the schedule row PK — sending
      // the PK made the backend throw "Vocab not found in SRS schedule" on every swipe.
      reviewMutation.mutate({ vocabId: currentCard.vocabId, quality })
      // Checklist "Bắt đầu" (§7.1): đếm thẻ đã ôn (dừng ở mốc checklist).
      useStarterStore.getState().bumpSrsReviews()
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
        <TopBar onBack={goBack} title="Ôn thẻ" />
        <View style={{ paddingHorizontal: space[5], gap: space[4], paddingTop: space[4] }}>
          <Skeleton height={6} radius="full" />
          <Skeleton height={330} radius="lg" />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen edges={['top']}>
        <TopBar onBack={goBack} title="Ôn thẻ" />
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
        <TopBar onBack={goBack} title="Ôn thẻ" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="hoanthanh"
            title={done ? 'Xong rồi!' : 'Chưa có thẻ đến hạn'}
            message={
              done
                ? `Bạn đã ôn ${cards.length} thẻ hôm nay. Tuyệt vời!${pendingSync > 0 ? `\n${pendingSync} lượt chấm sẽ tự đồng bộ khi có mạng.` : ''}`
                : 'Học bài mới là từ vựng sẽ tự vào hàng chờ ôn ở đây.'
            }
            actionLabel={done ? 'Quay lại' : 'Học từ mới ngay'}
            onAction={() => (done ? goBack() : router.navigate('/(student)/learn'))}
          />
        </View>
      </Screen>
    )
  }

  const gender = currentCard.gender ?? null

  return (
    <Screen edges={['top']}>
      <TopBar
        onBack={goBack}
        title={`Ôn thẻ · ${currentIndex + 1} / ${cards.length}`}
        right={
          <IconButton
            icon={RotateCcw}
            accessibilityLabel="Bắt đầu lại"
            color="secondary"
            size={20}
            onPress={() => {
              setCurrentIndex(0)
              void refetch()
            }}
          />
        }
      />

      <View style={{ paddingHorizontal: space[5], marginTop: space[3], marginBottom: space[5], gap: space[2] }}>
        <ProgressBar value={currentIndex / cards.length} height={6} />
        {pendingSync > 0 ? (
          <ThemedText variant="caption" color="muted">
            {pendingSync} lượt chấm chờ đồng bộ — sẽ tự gửi khi có mạng.
          </ThemedText>
        ) : null}
      </View>

      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ flex: 1, paddingHorizontal: space[5] }, cardStyle]}>
          <Animated.View
            style={[frontStyle, cardFaceStyle(c)]}
            onTouchEnd={() => { void flipCard() }}
            // VoiceOver không thấy phép xoay 3D: mặt đang úp phải ra khỏi cây trợ năng, kẻo đọc
            // luôn nghĩa tiếng Việt trước khi lật.
            accessible={!flipped}
            accessibilityElementsHidden={flipped}
            importantForAccessibility={flipped ? 'no-hide-descendants' : 'yes'}
            accessibilityRole="button"
            accessibilityLabel={`${currentCard.gender ? `${currentCard.gender} ` : ''}${currentCard.word}`}
            accessibilityHint="Chạm hai lần để xem nghĩa"
            onAccessibilityTap={() => { void flipCard() }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              {gender ? <ArtBadge gender={gender} /> : null}
              <View style={{ flex: 1 }} />
              {currentCard.cefrLevel ? <Badge label={currentCard.cefrLevel} /> : null}
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <VocabGlyphTile german={currentCard.word} meaning={currentCard.translation} size={72} style={{ marginBottom: space[4] }} />
              <ThemedText variant="displayLg" align="center" accessibilityLanguage="de-DE">
                {gender ? <ThemedText variant="displayLg" style={{ color: c[gender] }}>{`${gender} `}</ThemedText> : null}
                {currentCard.word}
              </ThemedText>
            </View>
            <ThemedText variant="caption" color="muted" align="center">
              Chạm để lật thẻ
            </ThemedText>
          </Animated.View>

          <Animated.View
            style={[backStyle, cardFaceStyle(c)]}
            onTouchEnd={() => { void flipCard() }}
            accessible={flipped}
            accessibilityElementsHidden={!flipped}
            importantForAccessibility={flipped ? 'yes' : 'no-hide-descendants'}
            accessibilityRole="button"
            accessibilityLabel={currentCard.exampleSentence ? `${currentCard.translation}. Ví dụ: ${currentCard.exampleSentence}` : currentCard.translation}
            accessibilityHint="Chạm hai lần để lật lại"
            onAccessibilityTap={() => { void flipCard() }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              {gender ? <ArtBadge gender={gender} /> : null}
              <View style={{ flex: 1 }} />
              <ThemedText variant="caption" color="muted">
                Chạm để lật lại
              </ThemedText>
            </View>
            <ThemedText variant="titleLg" style={{ marginTop: space[4] }} accessibilityLanguage="de-DE">
              {gender ? <ThemedText variant="titleLg" style={{ color: c[gender] }}>{`${gender} `}</ThemedText> : null}
              {currentCard.word}
            </ThemedText>
            <ThemedText variant="titleLg" style={{ fontFamily: fonts.bodyBold, marginTop: space[1] }}>
              {currentCard.translation}
            </ThemedText>
            {currentCard.exampleSentence ? (
              <RuledNote style={{ marginTop: space[4] }}>
                <ThemedText variant="body" accessibilityLanguage="de-DE">
                  {currentCard.exampleSentence}
                </ThemedText>
              </RuledNote>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[6], marginTop: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Icon icon={X} size={13} color="danger" />
          <ThemedText variant="caption" color="danger">
            Vuốt trái · khó
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <ThemedText variant="caption" color="success">
            Dễ · vuốt phải
          </ThemedText>
          <Icon icon={Check} size={13} color="success" />
        </View>
      </View>

      {flipped ? (
        <View style={{ paddingHorizontal: space[5], marginTop: space[4] }}>
          <ThemedText variant="caption" color="muted" align="center">
            Bạn nhớ từ này thế nào?
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
            <GradeButton label="Quên" hint="< 1 phút" tone="danger" onPress={() => submitReview(1)} />
            <GradeButton label="Khó" hint="Ôn lại" tone="neutral" onPress={() => submitReview(3)} />
            <GradeButton label="Dễ" hint="Vài ngày" tone="success" onPress={() => submitReview(5)} />
          </View>
        </View>
      ) : null}

      {/* Chú thích màu giống (mẫu: hàng der/die/das cuối màn). */}
      <View
        style={{ flexDirection: 'row', justifyContent: 'center', gap: space[4], marginTop: space[4], marginBottom: space[4] }}
        accessible
        accessibilityLabel="der giống đực, die giống cái, das giống trung"
      >
        {(['der', 'die', 'das'] as const).map((g) => (
          <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ArtBadge gender={g} small />
            <ThemedText variant="caption" color="muted">
              {g === 'der' ? 'giống đực' : g === 'die' ? 'giống cái' : 'giống trung'}
            </ThemedText>
          </View>
        ))}
      </View>
    </Screen>
  )
}

/** Ô chấm mức nhớ (mẫu `.rate`): nền giấy, viền đậm, nhãn đậm + gợi ý khoảng ôn. */
function GradeButton({
  label,
  hint,
  tone,
  onPress,
}: {
  label: string
  hint: string
  tone: 'danger' | 'neutral' | 'success'
  onPress: () => void
}) {
  const c = useTheme().colors
  const fg = tone === 'danger' ? c.danger : tone === 'success' ? c.success : c.textPrimary

  const handlePress = () => {
    void Haptics.selectionAsync()
    onPress()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${hint}`}
      onPress={handlePress}
      style={({ pressed }) => ({
        flex: 1,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: c.surface,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: radius.sm,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <ThemedText variant="bodyStrong" style={{ color: fg, fontFamily: fonts.bodyBold, fontSize: 14 }}>
        {label}
      </ThemedText>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 14, color: c.textMuted }}>{hint}</Text>
    </Pressable>
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
    borderRadius: radius.lg,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  }
}
