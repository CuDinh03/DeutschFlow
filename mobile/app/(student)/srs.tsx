import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { ArrowLeft, RotateCcw, Check, X, Minus } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface DueCard {
  id: string
  word: string
  translation: string
  exampleSentence?: string
  gender?: 'der' | 'die' | 'das'
  cefrLevel?: string
}

const SWIPE_THRESHOLD = 80

export default function SrsScreen() {
  const [flipped, setFlipped] = useState(false)
  const queryClient = useQueryClient()

  const { data: cards = [], isLoading, refetch } = useQuery({
    queryKey: ['srs-due'],
    queryFn: () => api.get<DueCard[]>('/srs/due?limit=20').then(r => r.data),
  })

  const [currentIndex, setCurrentIndex] = useState(0)
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
    setCurrentIndex(i => i + 1)
  }, [flipRotation, translateX, translateY])

  const submitReview = useCallback((quality: number) => {
    if (!currentCard) return
    void reviewMutation.mutateAsync({ vocabId: currentCard.id, quality })
    advance()
  }, [currentCard, reviewMutation, advance])

  // Flip animation
  const flipCard = useCallback(async () => {
    await Haptics.selectionAsync()
    flipRotation.value = withSpring(flipped ? 0 : 1)
    setFlipped(f => !f)
  }, [flipped, flipRotation])

  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipRotation.value, [0, 0.5, 1], [1, 0, 0], Extrapolation.CLAMP),
    transform: [{ rotateY: `${interpolate(flipRotation.value, [0, 1], [0, 180])}deg` }],
  }))

  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipRotation.value, [0, 0.5, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [{ rotateY: `${interpolate(flipRotation.value, [0, 1], [180, 360])}deg` }],
  }))

  // Swipe gesture
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value * 0.05}deg` },
    ],
    opacity: interpolate(Math.abs(translateX.value), [0, 150], [1, 0.5], Extrapolation.CLAMP),
  }))

  const swipe = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = e.translationX
      translateY.value = e.translationY * 0.2
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        // swipe right = easy (5)
        translateX.value = withTiming(400, { duration: 250 }, () => runOnJS(submitReview)(5))
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success)
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        // swipe left = hard (2)
        translateX.value = withTiming(-400, { duration: 250 }, () => runOnJS(submitReview)(2))
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Error)
      } else {
        translateX.value = withSpring(0)
        translateY.value = withSpring(0)
      }
    })

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0D0D0D] items-center justify-center">
        <ActivityIndicator color={Colors.yellow} size="large" />
      </SafeAreaView>
    )
  }

  if (cards.length === 0 || currentIndex >= cards.length) {
    return (
      <SafeAreaView className="flex-1 bg-[#0D0D0D] items-center justify-center px-6">
        <Text className="text-5xl mb-4">🎉</Text>
        <Text className="text-white text-xl font-bold text-center mb-2">Xong rồi!</Text>
        <Text className="text-[#64748B] text-sm text-center mb-8">
          {cards.length === 0 ? 'Không có thẻ nào đến hạn hôm nay.' : `Bạn đã ôn ${cards.length} thẻ hôm nay. Tuyệt vời!`}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#F5C842] rounded-xl px-8 py-4"
        >
          <Text className="text-[#0D0D0D] font-bold">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const genderColor = currentCard.gender === 'der' ? Colors.der : currentCard.gender === 'die' ? Colors.die : currentCard.gender === 'das' ? Colors.das : '#64748B'

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-[#64748B] text-sm font-medium">
          {currentIndex + 1} / {cards.length}
        </Text>
        <TouchableOpacity onPress={() => { setCurrentIndex(0); void refetch() }}>
          <RotateCcw size={20} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View className="mx-5 h-1.5 bg-[#1A1A1A] rounded-full mb-8">
        <View
          className="h-full bg-[#F5C842] rounded-full"
          style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
        />
      </View>

      {/* Card */}
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ flex: 1, paddingHorizontal: 20 }, cardStyle]}>
          <TouchableOpacity activeOpacity={1} onPress={flipCard} className="flex-1">
            {/* Front */}
            <Animated.View
              style={[frontStyle, { position: 'absolute', top: 0, left: 20, right: 20, bottom: 0 }]}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-8 items-center justify-center"
            >
              {currentCard.gender && (
                <View className="px-3 py-1 rounded-full mb-4" style={{ backgroundColor: `${genderColor}22` }}>
                  <Text className="text-sm font-bold" style={{ color: genderColor }}>{currentCard.gender}</Text>
                </View>
              )}
              <Text className="text-white text-4xl font-bold text-center mb-3">{currentCard.word}</Text>
              {currentCard.cefrLevel && (
                <Text className="text-[#64748B] text-sm">{currentCard.cefrLevel}</Text>
              )}
              <Text className="text-[#2A2A2A] text-sm mt-8">Nhấn để lật thẻ</Text>
            </Animated.View>

            {/* Back */}
            <Animated.View
              style={[backStyle, { position: 'absolute', top: 0, left: 20, right: 20, bottom: 0 }]}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-8 items-center justify-center"
            >
              <Text className="text-[#64748B] text-sm mb-2">Dịch nghĩa</Text>
              <Text className="text-white text-3xl font-bold text-center mb-6">{currentCard.translation}</Text>
              {currentCard.exampleSentence && (
                <View className="bg-[#0D0D0D] rounded-xl p-4 w-full">
                  <Text className="text-[#64748B] text-xs mb-1">Ví dụ</Text>
                  <Text className="text-white text-sm italic leading-5">{currentCard.exampleSentence}</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      {/* Swipe hints */}
      <View className="flex-row justify-between px-8 mb-3">
        <View className="flex-row items-center gap-1">
          <X size={14} color="#E63946" />
          <Text className="text-[#E63946] text-xs">Khó (vuốt trái)</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Check size={14} color="#2DC653" />
          <Text className="text-[#2DC653] text-xs">Dễ (vuốt phải)</Text>
        </View>
      </View>

      {/* Manual quality buttons (shown after flip) */}
      {flipped && (
        <View className="flex-row gap-3 px-5 mb-6">
          <TouchableOpacity
            onPress={() => submitReview(1)}
            className="flex-1 bg-[#E63946]/20 border border-[#E63946]/40 rounded-xl py-3 items-center"
          >
            <X size={18} color="#E63946" />
            <Text className="text-[#E63946] text-xs font-medium mt-1">Quên</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => submitReview(3)}
            className="flex-1 bg-[#F5C842]/20 border border-[#F5C842]/40 rounded-xl py-3 items-center"
          >
            <Minus size={18} color={Colors.yellow} />
            <Text className="text-[#F5C842] text-xs font-medium mt-1">Khó</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => submitReview(5)}
            className="flex-1 bg-[#2DC653]/20 border border-[#2DC653]/40 rounded-xl py-3 items-center"
          >
            <Check size={18} color="#2DC653" />
            <Text className="text-[#2DC653] text-xs font-medium mt-1">Dễ</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}
