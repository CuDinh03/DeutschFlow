import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { router, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const { fetchPlan } = usePlanStore()

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu.')
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      await fetchPlan()
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(student)/')
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'NON_STUDENT_ROLE') {
        Alert.alert(
          'Tài khoản không phù hợp',
          'App chỉ dành cho học viên. Giáo viên và admin vui lòng dùng mydeutschflow.com',
          [{ text: 'OK' }]
        )
      } else {
        Alert.alert('Đăng nhập thất bại', 'Email hoặc mật khẩu không đúng.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 px-6 justify-center"
      >
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-14 h-14 rounded-2xl bg-[#F5C842] items-center justify-center mb-4">
            <Text className="text-[#0D0D0D] text-2xl font-bold">D</Text>
          </View>
          <Text className="text-white text-2xl font-bold">DeutschFlow</Text>
          <Text className="text-[#64748B] text-sm mt-1">Học tiếng Đức hiệu quả</Text>
        </View>

        {/* Form */}
        <View className="gap-3">
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
              placeholder="••••••••"
              placeholderTextColor="#4A5568"
              secureTextEntry
              autoComplete="current-password"
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="bg-[#F5C842] rounded-xl py-4 items-center mt-2"
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#0D0D0D" />
              : <Text className="text-[#0D0D0D] font-bold text-base">Đăng nhập</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-[#64748B] text-sm">Chưa có tài khoản? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text className="text-[#F5C842] text-sm font-semibold">Đăng ký miễn phí</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
