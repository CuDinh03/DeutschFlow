import { useMemo, useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, ScrollView, Pressable } from 'react-native'
import { router, Link } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { Check } from 'lucide-react-native'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { setTokens } from '@/lib/auth'
import { captureEvent } from '@/lib/analytics'
import { passwordStrength } from '@/lib/passwordStrength'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button, Icon } from '@/components/ui'

export default function RegisterScreen() {
  const theme = useTheme()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const { fetchMe } = useAuthStore()
  const { fetchPlan } = usePlanStore()

  const strength = useMemo(() => passwordStrength(password), [password])

  async function handleRegister() {
    const phoneTrimmed = phone.trim()
    if (!displayName.trim() || !email.trim() || !phoneTrimmed || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin.')
      return
    }
    if (!agree) {
      Alert.alert('Điều khoản', 'Vui lòng đồng ý với Điều khoản và Chính sách bảo mật.')
      return
    }
    // Backend requires a Vietnamese mobile number (RegisterRequest @Pattern).
    if (!/^0[35789]\d{8}$/.test(phoneTrimmed)) {
      Alert.alert('Số điện thoại không hợp lệ', 'Nhập số di động VN 10 chữ số, ví dụ 0912345678.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }
    setLoading(true)
    captureEvent('register_started')
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
        displayName: displayName.trim(),
        email: email.trim(),
        phoneNumber: phoneTrimmed,
        password,
        locale: 'vi',
      })
      await setTokens(res.data.accessToken, res.data.refreshToken)
      await fetchMe()
      await fetchPlan()
      captureEvent('register_success')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // New learners go through onboarding before reaching the app.
      router.replace('/(auth)/onboarding')
    } catch {
      captureEvent('register_failed')
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
                label="Số điện thoại"
                value={phone}
                onChangeText={setPhone}
                placeholder="0912345678"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <View style={{ gap: space[2] }}>
                <TextField
                  label="Mật khẩu"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Tối thiểu 8 ký tự"
                  secureTextEntry
                  autoComplete="new-password"
                />
                {password.length > 0 ? (
                  <View style={{ gap: space[1] }}>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor:
                              i < strength.level ? theme.colors[strength.tone] : theme.colors.border,
                          }}
                        />
                      ))}
                    </View>
                    <ThemedText variant="caption" style={{ color: theme.colors[strength.tone] }}>
                      Độ mạnh: {strength.label}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {/* Terms agreement — gates the submit, matching the v2 auth mockup. */}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agree }}
                accessibilityLabel="Đồng ý với Điều khoản sử dụng và Chính sách bảo mật"
                onPress={() => setAgree((a) => !a)}
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: agree ? theme.colors.textPrimary : theme.colors.border,
                    backgroundColor: agree ? theme.colors.inkSurface : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {agree ? <Icon icon={Check} size={15} color="accent" /> : null}
                </View>
                <ThemedText variant="caption" color="secondary" style={{ flex: 1, lineHeight: 18 }}>
                  Tôi đồng ý với <ThemedText variant="caption" color="primary">Điều khoản sử dụng</ThemedText> và{' '}
                  <ThemedText variant="caption" color="primary">Chính sách bảo mật</ThemedText> của DeutschFlow.
                </ThemedText>
              </Pressable>

              <Button
                label="Tạo tài khoản"
                onPress={handleRegister}
                loading={loading}
                disabled={!agree}
                style={{ marginTop: space[1] }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space[6] }}>
              <ThemedText variant="body" color="muted">
                Đã có tài khoản?{' '}
              </ThemedText>
              <Link href="/(auth)/login" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="Đăng nhập" hitSlop={6}>
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
