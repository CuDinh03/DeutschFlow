import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Flame, BookOpen, Mic, Star, ChevronRight, Bell } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface DashboardData {
  streakDays: number
  todayXp: number
  totalXp: number
  xpLevel: number
  dueSrsCount: number
  todayPlan?: {
    suggestedActivity?: string
    targetMinutes?: number
  }
  unreadNotificationCount?: number
}

export default function DashboardScreen() {
  const { user } = useAuthStore()
  const { isPro } = usePlanStore()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/student/dashboard').then(r => r.data),
    staleTime: 60_000,
  })

  const firstName = user?.displayName?.split(' ').at(-1) ?? 'bạn'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0D0D0D] items-center justify-center">
        <ActivityIndicator color={Colors.yellow} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.yellow} />}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center px-5 pt-4 pb-2">
          <View>
            <Text className="text-[#64748B] text-sm">{greeting},</Text>
            <Text className="text-white text-xl font-bold">{firstName} 👋</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(student)/notifications')}
            className="relative"
          >
            <Bell size={22} color={Colors.muted} />
            {(data?.unreadNotificationCount ?? 0) > 0 && (
              <View className="absolute -top-1 -right-1 bg-[#E63946] rounded-full w-4 h-4 items-center justify-center">
                <Text className="text-white text-[9px] font-bold">
                  {Math.min(data!.unreadNotificationCount!, 9)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Streak + XP row */}
        <View className="flex-row gap-3 px-5 mt-3">
          <View className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-[rgba(245,200,66,0.15)] items-center justify-center">
              <Flame size={20} color={Colors.yellow} />
            </View>
            <View>
              <Text className="text-white text-xl font-bold">{data?.streakDays ?? 0}</Text>
              <Text className="text-[#64748B] text-xs">ngày liên tiếp</Text>
            </View>
          </View>

          <View className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-[rgba(168,85,247,0.15)] items-center justify-center">
              <Star size={20} color="#A855F7" />
            </View>
            <View>
              <Text className="text-white text-xl font-bold">Lv {data?.xpLevel ?? 1}</Text>
              <Text className="text-[#64748B] text-xs">{data?.totalXp ?? 0} XP</Text>
            </View>
          </View>
        </View>

        {/* Due SRS card */}
        {(data?.dueSrsCount ?? 0) > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(student)/srs')}
            className="mx-5 mt-4 bg-[#1A1A1A] border border-[#F5C842]/30 rounded-2xl p-4 flex-row items-center justify-between"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-[rgba(245,200,66,0.15)] items-center justify-center">
                <BookOpen size={20} color={Colors.yellow} />
              </View>
              <View>
                <Text className="text-white font-semibold text-sm">Ôn tập hôm nay</Text>
                <Text className="text-[#64748B] text-xs">{data?.dueSrsCount} thẻ đến hạn</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider px-5 mt-5 mb-3">
          Hoạt động học tập
        </Text>
        <View className="px-5 gap-3">
          <QuickAction
            icon={<BookOpen size={20} color={Colors.yellow} />}
            title="Luyện từ vựng SRS"
            subtitle="Spaced repetition flashcards"
            onPress={() => router.push('/(student)/srs')}
            color="yellow"
          />
          <QuickAction
            icon={<Mic size={20} color="#3A86FF" />}
            title="AI Speaking"
            subtitle="Hội thoại với AI coach"
            onPress={() => router.push('/(student)/speaking')}
            color="blue"
          />
          <QuickAction
            icon={<Star size={20} color="#2DC653" />}
            title="Lộ trình học"
            subtitle="Skill tree A1 → B2"
            onPress={() => router.push('/(student)/roadmap')}
            color="green"
          />
        </View>

        {/* PRO upgrade nudge for free users */}
        {!isPro && (
          <TouchableOpacity
            onPress={() => router.push('/(student)/upgrade')}
            className="mx-5 mt-5 bg-gradient-to-r from-[#1A1A1A] to-[#1A1A1A] border border-[#F5C842]/40 rounded-2xl p-4"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Star size={14} color={Colors.yellow} fill={Colors.yellow} />
                  <Text className="text-[#F5C842] text-xs font-bold">DeutschFlow PRO</Text>
                </View>
                <Text className="text-white text-sm font-semibold">Mở khoá toàn bộ tính năng</Text>
                <Text className="text-[#64748B] text-xs mt-0.5">Speaking AI, Mock Exam, Weekly Challenge...</Text>
              </View>
              <View className="bg-[#F5C842] rounded-xl px-3 py-1.5">
                <Text className="text-[#0D0D0D] text-xs font-bold">Xem PRO</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function QuickAction({
  icon, title, subtitle, onPress, color,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onPress: () => void
  color: 'yellow' | 'blue' | 'green'
}) {
  const bgMap = { yellow: 'rgba(245,200,66,0.12)', blue: 'rgba(58,134,255,0.12)', green: 'rgba(45,198,83,0.12)' }
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 flex-row items-center justify-between"
      activeOpacity={0.75}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: bgMap[color] }}>
          {icon}
        </View>
        <View>
          <Text className="text-white font-semibold text-sm">{title}</Text>
          <Text className="text-[#64748B] text-xs">{subtitle}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={Colors.muted} />
    </TouchableOpacity>
  )
}
