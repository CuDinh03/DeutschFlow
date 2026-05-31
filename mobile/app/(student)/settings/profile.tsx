import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Check } from 'lucide-react-native'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import api from '@/lib/api'
import { Colors } from '@/lib/constants'

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')

  const mutation = useMutation({
    mutationFn: (name: string) =>
      api.patch<{ displayName: string }>('/profile/me', { displayName: name }),
    onSuccess: (res) => {
      if (user) setUser({ ...user, displayName: res.data.displayName })
      Alert.alert('Đã lưu', 'Thông tin của bạn đã được cập nhật.')
      router.back()
    },
    onError: () => {
      Alert.alert('Lỗi', 'Không thể lưu thay đổi. Vui lòng thử lại.')
    },
  })

  const canSave = displayName.trim().length >= 2 && displayName.trim() !== user?.displayName

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.muted} />
        </TouchableOpacity>
        <Text className="text-white text-base font-semibold">Chỉnh sửa hồ sơ</Text>
        <TouchableOpacity
          onPress={() => mutation.mutate(displayName.trim())}
          disabled={!canSave || mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator size="small" color={Colors.yellow} />
            : <Check size={22} color={canSave ? Colors.yellow : Colors.muted} />
          }
        </TouchableOpacity>
      </View>

      <View className="px-5 mt-4">
        {/* Avatar initials */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-[#F5C842] items-center justify-center mb-3">
            <Text className="text-[#0D0D0D] text-2xl font-bold">
              {(displayName || user?.displayName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-[#64748B] text-sm">{user?.email}</Text>
        </View>

        {/* Display name */}
        <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-2">
          Tên hiển thị
        </Text>
        <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3 mb-2">
          <TextInput
            className="text-white text-base"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nhập tên của bạn"
            placeholderTextColor={Colors.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => canSave && mutation.mutate(displayName.trim())}
          />
        </View>
        {displayName.trim().length > 0 && displayName.trim().length < 2 && (
          <Text className="text-[#E63946] text-xs">Tên phải có ít nhất 2 ký tự.</Text>
        )}

        {/* Email (read-only) */}
        <Text className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-2 mt-5">
          Email
        </Text>
        <View className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3 opacity-60">
          <Text className="text-[#64748B] text-base">{user?.email}</Text>
        </View>
        <Text className="text-[#64748B] text-xs mt-1.5">Email không thể thay đổi từ ứng dụng.</Text>
      </View>
    </SafeAreaView>
  )
}
