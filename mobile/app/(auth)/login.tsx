import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, Pressable, ScrollView } from 'react-native'
import { router, Link } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { motion, space, useTheme } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { Screen, ThemedText, TextField, Button, BrandMark } from '@/components/ui'

export default function LoginScreen() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const fetchPlan = usePlanStore((s) => s.fetchPlan)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu.')
      return
    }
    setLoading(true)
    captureEvent('login_started')
    try {
      await login(email.trim(), password)
      captureEvent('login_success')
      // Plan + onboarding status are independent once authenticated — run them in
      // parallel, and don't block navigation on the success haptic. (Status check
      // is best-effort; default to the app for existing learners.)
      const [, statusRes] = await Promise.all([
        fetchPlan(),
        api
          .get<{ hasPlan: boolean }>('/onboarding/status')
          .catch(() => ({ data: { hasPlan: true } })),
      ])
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace(statusRes.data.hasPlan ? '/(student)' : '/(auth)/onboarding')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      captureEvent('login_failed', { reason: msg || 'unknown' })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      if (msg === 'NON_STUDENT_ROLE') {
        Alert.alert(
          'Tài khoản không phù hợp',
          'App chỉ dành cho học viên. Giáo viên và admin vui lòng dùng mydeutschflow.com',
          [{ text: 'OK' }],
        )
      } else {
        Alert.alert('Đăng nhập thất bại', 'Email hoặc mật khẩu không đúng.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: space[6] }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: motion.duration.slow }}
          >
            <View style={{ alignItems: 'center', marginBottom: space[10] }}>
              <View style={{ marginBottom: space[4] }}>
                <BrandMark size={60} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <ThemedText variant="titleLg">Deutsch</ThemedText>
                <ThemedText variant="titleLg" color="brand">
                  Flow
                </ThemedText>
              </View>
              <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }}>
                Học tiếng Đức hiệu quả
              </ThemedText>
            </View>

            <View style={{ gap: space[4] }}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TextField
                label="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
              />
              <Button label="Đăng nhập" onPress={handleLogin} loading={loading} style={{ marginTop: space[1] }} />

              <Pressable hitSlop={8} onPress={() => router.push('/(auth)/forgot-password')} style={{ alignItems: 'center', marginTop: space[2] }}>
                <ThemedText variant="caption" color="accent">Quên mật khẩu?</ThemedText>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space[6] }}>
              <ThemedText variant="body" color="muted">
                Chưa có tài khoản?{' '}
              </ThemedText>
              <Link href="/(auth)/register" asChild>
                <Pressable hitSlop={6}>
                  <ThemedText variant="bodyStrong" color="accent">
                    Đăng ký miễn phí
                  </ThemedText>
                </Pressable>
              </Link>
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
