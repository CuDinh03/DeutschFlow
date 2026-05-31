import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Flame, Lock, ChevronRight } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'
import { usePlanStore } from '@/stores/usePlanStore'

interface WeeklyPrompt {
  id: number
  promptTitle: string
  cefrBand: string
  weekStartDate: string
  durationSeconds: number
}

interface WeeklySubmission {
  id: number
  promptTitle: string
  weekStartDate: string
  cefrBand: string
  taskScoreOrNull?: number
}

export default function WeeklySpeakingScreen() {
  const { isPro } = usePlanStore()

  const { data: prompt, isLoading: promptLoading } = useQuery({
    queryKey: ['weekly-prompt'],
    queryFn: () => api.get<WeeklyPrompt>('/weekly-speaking/current-prompt').then(r => r.data),
    enabled: isPro,
    staleTime: 60_000 * 30,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['weekly-history'],
    queryFn: () => api.get<WeeklySubmission[]>('/weekly-speaking/my-submissions?page=0&size=10').then(r => r.data),
    enabled: isPro,
    staleTime: 60_000,
  })

  if (!isPro) {
    return (
      <SafeAreaView className="flex-1 bg-[#0D0D0D]">
        <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.muted} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Weekly Speaking</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Lock size={36} color="#A855F7" />
          <Text className="text-white text-xl font-bold text-center mt-4 mb-2">Tính năng PRO</Text>
          <Text className="text-[#64748B] text-sm text-center mb-6 leading-5">
            Nộp bài nói hàng tuần và nhận phản hồi AI chi tiết.
          </Text>
          <TouchableOpacity onPress={() => router.push('/(student)/upgrade')} className="bg-[#F5C842] rounded-xl px-8 py-4">
            <Text className="text-[#0D0D0D] font-bold">Xem PRO</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Weekly Speaking</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32, gap: 16, paddingTop: 8 }}>
        {/* Current challenge */}
        {promptLoading ? (
          <ActivityIndicator color={Colors.yellow} />
        ) : prompt ? (
          <View className="bg-[#1A1A1A] border border-[#3A86FF]/40 rounded-2xl p-5">
            <View className="flex-row items-center gap-2 mb-3">
              <Flame size={16} color="#3A86FF" />
              <Text className="text-[#3A86FF] text-xs font-bold uppercase tracking-wider">Thử thách tuần này</Text>
              <View className="ml-auto bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-0.5 rounded-full">
                <Text className="text-[#64748B] text-[10px] font-bold">{prompt.cefrBand}</Text>
              </View>
            </View>
            <Text className="text-white font-bold text-base mb-1">{prompt.promptTitle}</Text>
            <Text className="text-[#64748B] text-xs mb-4">{prompt.weekStartDate}</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Sắp có', 'Tính năng ghi âm đang được phát triển.')}
              className="bg-[#3A86FF] rounded-xl py-3 items-center"
            >
              <Text className="text-white font-bold text-sm">Nộp bài nói</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* History */}
        {history.length > 0 && (
          <View>
            <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-3">Lịch sử nộp bài</Text>
            <View className="gap-2">
              {history.map(sub => (
                <View key={sub.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 flex-row items-center justify-between">
                  <View>
                    <Text className="text-white text-sm font-medium">{sub.promptTitle}</Text>
                    <Text className="text-[#64748B] text-xs mt-0.5">{sub.weekStartDate} · {sub.cefrBand}</Text>
                  </View>
                  {sub.taskScoreOrNull != null && (
                    <View className="bg-[rgba(45,198,83,0.15)] px-2 py-1 rounded-lg">
                      <Text className="text-[#2DC653] text-sm font-bold">{sub.taskScoreOrNull}/5</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
