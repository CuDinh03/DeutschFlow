import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Flame, Star, BookOpen, Mic, TrendingUp } from 'lucide-react-native'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface StatsData {
  streakDays: number
  totalXp: number
  xpLevel: number
  wordsLearned: number
  speakingMinutes: number
  grammarAccuracy: number
  weeklyProgress: number[]
}

export default function StatsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<StatsData>('/student/stats').then(r => r.data),
    staleTime: 60_000,
  })

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Tiến độ học tập</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32, gap: 12, paddingTop: 8 }}>
          {/* Stats grid */}
          <View className="flex-row flex-wrap gap-3">
            <StatCard icon={<Flame size={20} color={Colors.yellow} />} label="Streak" value={`${data?.streakDays ?? 0} ngày`} color={Colors.yellow} />
            <StatCard icon={<Star size={20} color="#A855F7" />} label="Level" value={`Lv ${data?.xpLevel ?? 1}`} color="#A855F7" />
            <StatCard icon={<BookOpen size={20} color={Colors.blue} />} label="Từ đã học" value={`${data?.wordsLearned ?? 0}`} color={Colors.blue} />
            <StatCard icon={<Mic size={20} color={Colors.green} />} label="Phút nói" value={`${data?.speakingMinutes ?? 0}`} color={Colors.green} />
          </View>

          {/* Grammar accuracy */}
          {data?.grammarAccuracy != null && (
            <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-3">
                <TrendingUp size={16} color={Colors.yellow} />
                <Text className="text-white font-semibold text-sm">Độ chính xác ngữ pháp</Text>
                <Text className="text-[#F5C842] font-bold text-sm ml-auto">{data.grammarAccuracy}%</Text>
              </View>
              <View className="h-2 bg-[#0D0D0D] rounded-full overflow-hidden">
                <View
                  className="h-full bg-[#F5C842] rounded-full"
                  style={{ width: `${data.grammarAccuracy}%` }}
                />
              </View>
            </View>
          )}

          {/* XP total */}
          <View className="bg-[#1A1A1A] border border-[#A855F7]/30 rounded-2xl p-4">
            <Text className="text-[#64748B] text-xs font-semibold mb-1">Tổng XP tích lũy</Text>
            <Text className="text-white text-3xl font-bold">{(data?.totalXp ?? 0).toLocaleString()}</Text>
            <Text className="text-[#64748B] text-xs mt-0.5">điểm kinh nghiệm</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string
}) {
  return (
    <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 items-center" style={{ width: '47%' }}>
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: `${color}1A` }}>
        {icon}
      </View>
      <Text className="text-white text-lg font-bold">{value}</Text>
      <Text className="text-[#64748B] text-xs mt-0.5">{label}</Text>
    </View>
  )
}
