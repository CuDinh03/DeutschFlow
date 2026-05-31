import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, ScrollView, Pressable } from 'react-native'
import { router, Link } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { setTokens } from '@/lib/auth'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button } from '@/components/ui'

export default function RegisterScreen() {
  const theme = useTheme()
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
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      })
      await setTokens(res.data.accessToken, res.data.refreshToken)
      await fetchMe()
      await fetchPlan()
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(student)/')
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Đăng ký thất bại', 'Email có thể đã được sử dụng.')
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
          style={{ flex: 1, paddingHorizontal: space[6] }}
          contentContainerStyle={{ justifyContent: 'center', flexGrow: 1, paddingVertical: space[10] }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: motion.duration.slow }}
          >
            <View style={{ alignItems: 'center', marginBottom: space[10] }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.xl,
                  backgroundColor: theme.colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: space[4],
                }}
              >
                <ThemedText variant="display" color="onAccent">
                  D
                </ThemedText>
              </View>
              <ThemedText variant="titleLg">Tạo tài khoản</ThemedText>
              <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }}>
                Miễn phí, không cần thẻ tín dụng
              </ThemedText>
            </View>

            <View style={{ gap: space[4] }}>
              <TextField
                label="Tên hiển thị"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nguyễn Văn A"
                autoCapitalize="words"
              />
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
                placeholder="Tối thiểu 8 ký tự"
                secureTextEntry
                autoComplete="new-password"
              />
              <Button label="Tạo tài khoản" onPress={handleRegister} loading={loading} style={{ marginTop: space[1] }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space[6] }}>
              <ThemedText variant="body" color="muted">
                Đã có tài khoản?{' '}
              </ThemedText>
              <Link href="/(auth)/login" asChild>
                <Pressable hitSlop={6}>
                  <ThemedText variant="bodyStrong" color="accent">
                    Đăng nhập
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
