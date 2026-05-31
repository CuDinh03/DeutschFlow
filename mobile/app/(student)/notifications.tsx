import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

interface Notification {
  id: number
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
}

export default function NotificationsScreen() {
  const qc = useQueryClient()

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/notifications/me').then(r => r.data),
    staleTime: 30_000,
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color={Colors.muted} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Thông báo</Text>
        </View>
        <TouchableOpacity onPress={() => markAllRead.mutate()}>
          <CheckCheck size={20} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.yellow} />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center pt-20">
              <Bell size={36} color={Colors.muted} />
              <Text className="text-[#64748B] text-sm mt-3">Không có thông báo mới</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className={`bg-[#1A1A1A] border rounded-xl px-4 py-3 ${item.isRead ? 'border-[#1E1E1E]' : 'border-[#F5C842]/30'}`}>
              <View className="flex-row items-start gap-2">
                {!item.isRead && <View className="w-2 h-2 rounded-full bg-[#F5C842] mt-1.5" />}
                <View className="flex-1">
                  <Text className="text-white text-sm font-semibold">{item.title}</Text>
                  <Text className="text-[#64748B] text-xs mt-0.5 leading-4">{item.body}</Text>
                  <Text className="text-[#2A2A2A] text-[10px] mt-1">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}
