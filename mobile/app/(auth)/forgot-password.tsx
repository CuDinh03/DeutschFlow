import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { Mail } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button, Icon } from '@/components/ui'

export default function ForgotPasswordScreen() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleRequest() {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập đúng địa chỉ email.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: trimmed })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setSent(true)
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Lỗi', apiMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Screen edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, paddingHorizontal: space[6], justifyContent: 'center' }}
        >
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: motion.duration.slow }}
            style={{ alignItems: 'center', gap: space[4] }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius['3xl'],
                backgroundColor: theme.colors.successSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: space[2],
              }}
            >
              <Icon icon={Mail} size={34} color="success" />
            </View>
            <ThemedText variant="titleLg" align="center">
              Kiểm tra email của bạn
            </ThemedText>
            <ThemedText variant="body" color="muted" align="center">
              Chúng tôi đã gửi mã 6 chữ số đến {email.trim()}. Mã có hiệu lực 15 phút.
            </ThemedText>
            <Button
              label="Nhập mã đặt lại"
              onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { email: email.trim() } })}
              style={{ marginTop: space[2] }}
            />
            <Button
              label="Thử lại với email khác"
              variant="ghost"
              onPress={() => setSent(false)}
            />
          </MotiView>
        </KeyboardAvoidingView>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, paddingHorizontal: space[6], justifyContent: 'center', gap: space[6] }}
      >
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.slow }}
          style={{ gap: space[4] }}
        >
          <View style={{ alignItems: 'center', marginBottom: space[4] }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.xl,
                backgroundColor: theme.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: space[3],
              }}
            >
              <Icon icon={Mail} size={26} color="accent" />
            </View>
            <ThemedText variant="titleLg">Quên mật khẩu</ThemedText>
            <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }} align="center">
              Nhập email tài khoản để nhận mã đặt lại
            </ThemedText>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Button label="Gửi mã" onPress={handleRequest} loading={loading} />
          <Button label="Quay lại đăng nhập" variant="ghost" onPress={() => router.back()} />
        </MotiView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
