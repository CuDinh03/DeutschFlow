import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { router, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { setTokens } from '@/lib/auth'

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { fetchMe } = useAuthStore()
  const { fetchPlan } = usePlanStore()

  async function handleRegister() {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/register',
        { displayName: displayName.trim(), email: email.trim(), password }
      )
      await setTokens(res.data.accessToken, res.data.refreshToken)
      await fetchMe()
      await fetchPlan()
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(student)/')
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Đăng ký thất bại', 'Email có thể đã được sử dụng.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ justifyContent: 'center', paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-10">
            <View className="w-14 h-14 rounded-2xl bg-[#F5C842] items-center justify-center mb-4">
              <Text className="text-[#0D0D0D] text-2xl font-bold">D</Text>
            </View>
            <Text className="text-white text-2xl font-bold">Tạo tài khoản</Text>
            <Text className="text-[#64748B] text-sm mt-1">Miễn phí, không cần thẻ tín dụng</Text>
          </View>

          <View className="gap-3">
            <View>
              <Text className="text-[#64748B] text-xs font-medium mb-1.5 uppercase tracking-wide">Tên hiển thị</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nguyễn Văn A"
                placeholderTextColor="#4A5568"
                autoCapitalize="words"
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-4 text-white text-base"
              />
            </View>

            <View>
              <Text className="text-[#64748B] text-xs font-medium mb-1.5 uppercase tracking-wide">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor="#4A5568"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-4 text-white text-base"
              />
            </View>

            <View>
              <Text className="text-[#64748B] text-xs font-medium mb-1.5 uppercase tracking-wide">Mật khẩu</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Tối thiểu 8 ký tự"
                placeholderTextColor="#4A5568"
                secureTextEntry
                autoComplete="new-password"
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-4 text-white text-base"
              />
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              className="bg-[#F5C842] rounded-xl py-4 items-center mt-2"
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#0D0D0D" />
                : <Text className="text-[#0D0D0D] font-bold text-base">Tạo tài khoản</Text>
              }
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-6">
            <Text className="text-[#64748B] text-sm">Đã có tài khoản? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-[#F5C842] text-sm font-semibold">Đăng nhập</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
