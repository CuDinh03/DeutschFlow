import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { LogOut, Star, Bell, Globe, Shield, ChevronRight, User } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { Colors } from '@/lib/constants'

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const { plan, isPro } = usePlanStore()

  const initials = user?.displayName
    ?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  function confirmLogout() {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất', style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        }
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar */}
        <View className="items-center px-5 pt-6 pb-5">
          <View className="w-20 h-20 rounded-full bg-[#F5C842] items-center justify-center mb-3">
            <Text className="text-[#0D0D0D] text-3xl font-bold">{initials}</Text>
          </View>
          <Text className="text-white text-xl font-bold">{user?.displayName}</Text>
          <Text className="text-[#64748B] text-sm mt-0.5">{user?.email}</Text>
          <View className={`mt-2 px-3 py-1 rounded-full ${isPro ? 'bg-[rgba(245,200,66,0.15)]' : 'bg-[#1A1A1A]'}`}>
            <Text className={`text-xs font-bold ${isPro ? 'text-[#F5C842]' : 'text-[#64748B]'}`}>
              {plan?.tier ?? 'FREE'}
            </Text>
          </View>
        </View>

        {/* Upgrade card */}
        {!isPro && (
          <TouchableOpacity
            onPress={() => router.push('/(student)/upgrade')}
            className="mx-5 mb-5 bg-[#1A1A1A] border border-[#F5C842]/40 rounded-2xl p-4 flex-row items-center gap-3"
            activeOpacity={0.8}
          >
            <View className="w-10 h-10 rounded-xl bg-[rgba(245,200,66,0.15)] items-center justify-center">
              <Star size={20} color={Colors.yellow} fill={Colors.yellow} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-sm">Nâng cấp lên PRO</Text>
              <Text className="text-[#64748B] text-xs">Truy cập mydeutschflow.com</Text>
            </View>
            <ChevronRight size={16} color={Colors.muted} />
          </TouchableOpacity>
        )}

        {/* Menu sections */}
        <MenuSection title="Tài khoản">
          <MenuItem icon={<User size={18} color={Colors.muted} />} label="Thông tin cá nhân"
            onPress={() => router.push('/(student)/settings/profile')} />
          <MenuItem icon={<Bell size={18} color={Colors.muted} />} label="Thông báo"
            onPress={() => router.push('/(student)/notifications')} />
        </MenuSection>

        <MenuSection title="Học tập">
          <MenuItem icon={<Globe size={18} color={Colors.muted} />} label="Ngôn ngữ giao diện"
            onPress={() => {}} />
          <MenuItem icon={<Shield size={18} color={Colors.muted} />} label="Tiến trình & thống kê"
            onPress={() => router.push('/(student)/stats')} />
        </MenuSection>

        {/* Logout */}
        <View className="mx-5 mt-4">
          <TouchableOpacity
            onPress={confirmLogout}
            className="flex-row items-center gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-4"
          >
            <LogOut size={18} color="#E63946" />
            <Text className="text-[#E63946] font-medium text-sm">Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-center text-[#2A2A2A] text-xs mt-6">
          DeutschFlow v1.0.0 • iOS/Android
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-5 mb-4">
      <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-2">{title}</Text>
      <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        {children}
      </View>
    </View>
  )
}

function MenuItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-4 border-b border-[#2A2A2A] last:border-0"
      activeOpacity={0.7}
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-white text-sm">{label}</Text>
      </View>
      <ChevronRight size={16} color={Colors.muted} />
    </TouchableOpacity>
  )
}
