import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Trophy, Clock, Target, Lock } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'
import { usePlanStore } from '@/stores/usePlanStore'

interface ExamVariant {
  id: number
  title: string
  cefrLevel: string
  totalQuestions: number
  timeLimitMinutes: number
  isRecommended?: boolean
}

interface AttemptResult {
  attemptId: number
  totalScore: number
  passed: boolean
  weakAreas: string[]
}

export default function ExamScreen() {
  const { isPro } = usePlanStore()

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['exam-variants'],
    queryFn: () => api.get<ExamVariant[]>('/mock-exam/variants').then(r => r.data),
    enabled: isPro,
    staleTime: 300_000,
  })

  const startExam = useMutation({
    mutationFn: (variantId: number) =>
      api.post<{ attemptId: number }>('/mock-exam/start', { variantId }),
  })

  function handleStart(variantId: number) {
    if (!isPro) {
      Alert.alert('Tính năng PRO', 'Thi thử Goethe yêu cầu tài khoản PRO. Truy cập mydeutschflow.com để nâng cấp.')
      return
    }
    Alert.alert('Bắt đầu thi?', 'Bài thi sẽ tính giờ. Bạn có sẵn sàng?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Bắt đầu', onPress: () => {
          startExam.mutate(variantId, {
            onSuccess: () => Alert.alert('Đang phát triển', 'Màn hình thi đang được xây dựng.'),
          })
        }
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Mock Exam</Text>
      </View>

      {!isPro ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-3xl bg-[rgba(168,85,247,0.15)] items-center justify-center mb-5">
            <Lock size={36} color="#A855F7" />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">Tính năng PRO</Text>
          <Text className="text-[#64748B] text-sm text-center mb-6 leading-5">
            Thi thử theo format Goethe chính thức, xem điểm chi tiết và phân tích điểm yếu.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(student)/upgrade')}
            className="bg-[#F5C842] rounded-xl px-8 py-4"
          >
            <Text className="text-[#0D0D0D] font-bold">Xem PRO</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24, gap: 12, paddingTop: 8 }}>
          {variants.map(variant => (
            <TouchableOpacity
              key={variant.id}
              onPress={() => handleStart(variant.id)}
              className={`bg-[#1A1A1A] border rounded-2xl p-5 ${variant.isRecommended ? 'border-[#F5C842]/40' : 'border-[#2A2A2A]'}`}
              activeOpacity={0.8}
            >
              {variant.isRecommended && (
                <View className="bg-[rgba(245,200,66,0.15)] self-start px-2 py-0.5 rounded-full mb-3">
                  <Text className="text-[#F5C842] text-[10px] font-bold">GỢI Ý</Text>
                </View>
              )}
              <Text className="text-white font-bold text-base mb-1">{variant.title}</Text>
              <View className="flex-row gap-4 mt-2">
                <View className="flex-row items-center gap-1">
                  <Target size={13} color={Colors.muted} />
                  <Text className="text-[#64748B] text-xs">{variant.cefrLevel}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Trophy size={13} color={Colors.muted} />
                  <Text className="text-[#64748B] text-xs">{variant.totalQuestions} câu</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Clock size={13} color={Colors.muted} />
                  <Text className="text-[#64748B] text-xs">{variant.timeLimitMinutes} phút</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
