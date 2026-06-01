import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { KeyRound } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button, Icon } from '@/components/ui'

export default function ResetPasswordScreen() {
  const theme = useTheme()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    if (!email.trim() || !code.trim() || !newPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ.')
      return
    }
    if (code.trim().length !== 6) {
      Alert.alert('Mã không hợp lệ', 'Mã đặt lại gồm 6 chữ số.')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Hai lần nhập mật khẩu phải giống nhau.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Thành công', 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại.', [
        { text: 'Đăng nhập', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Lỗi', apiMessage(e))
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
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.slow }}
          style={{ flex: 1, paddingHorizontal: space[6], justifyContent: 'center', gap: space[4] }}
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
              <Icon icon={KeyRound} size={26} color="accent" />
            </View>
            <ThemedText variant="titleLg">Đặt lại mật khẩu</ThemedText>
            <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }} align="center">
              Nhập mã 6 chữ số từ email và mật khẩu mới
            </ThemedText>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Mã 6 chữ số"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TextField
            label="Mật khẩu mới"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Tối thiểu 8 ký tự"
            secureTextEntry
            autoComplete="new-password"
          />
          <TextField
            label="Xác nhận mật khẩu"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            secureTextEntry
            error={confirmPassword && newPassword !== confirmPassword ? 'Mật khẩu không khớp' : undefined}
          />
          <Button
            label="Đặt lại mật khẩu"
            onPress={handleReset}
            loading={loading}
            disabled={code.length !== 6 || newPassword.length < 8}
          />
          <Button label="Quay lại" variant="ghost" onPress={() => router.back()} />
        </MotiView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
