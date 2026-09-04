import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react-native'
import { apiMessage } from '@/lib/api'
import { space } from '@/lib/theme'
import { profileApi, validatePasswordChange, PASSWORD_MIN_LENGTH } from '@/lib/profileApi'
import { useAuthStore } from '@/stores/useAuthStore'
import { AppHeader, Button, Caption, Card, Icon, Screen, TextField, ThemedText } from '@/components/ui'

/**
 * Đổi mật khẩu trong app (N4, đợt 2 plan nâng cấp mobile 05/09). Trước đây người
 * dùng chỉ-mobile phải thoát app đi luồng "quên mật khẩu" qua email. Backend đổi
 * xong thu hồi mọi refresh token → màn này chủ động đăng xuất và về màn đăng nhập,
 * kẻo người dùng kẹt với token đã chết tới lần gọi API kế.
 */
export default function ChangePasswordScreen() {
  const logout = useAuthStore((s) => s.logout)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const errors = validatePasswordChange(current, next, confirm)
  const canSubmit = Object.keys(errors).length === 0

  const mutation = useMutation({
    mutationFn: () => profileApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      Alert.alert(
        'Đã đổi mật khẩu',
        'Vì lý do bảo mật, mọi phiên đăng nhập đã được đóng. Hãy đăng nhập lại bằng mật khẩu mới.',
        [{ text: 'Đăng nhập lại', onPress: () => void logout() }],
        { cancelable: false },
      )
    },
    onError: (e) => {
      // Backend trả "Mật khẩu hiện tại không đúng." (400) — apiMessage lấy đúng câu đó.
      Alert.alert('Chưa đổi được', apiMessage(e))
    },
  })

  function submit() {
    setTouched(true)
    if (!canSubmit || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <AppHeader title="Đổi mật khẩu" subtitle="Bảo mật tài khoản" onBack={() => router.back()} />

        <Screen scroll edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8], gap: space[5] }}>
          <Card tone="sunken" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Icon icon={KeyRound} size={20} color="accent" />
            <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
              {`Mật khẩu mới cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự. Sau khi đổi, bạn sẽ được đưa về màn đăng nhập.`}
            </ThemedText>
          </Card>

          <View style={{ gap: space[2] }}>
            <Caption>Mật khẩu hiện tại</Caption>
            <TextField
              value={current}
              onChangeText={setCurrent}
              placeholder="Nhập mật khẩu đang dùng"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="next"
              accessibilityLabel="Mật khẩu hiện tại"
              error={touched ? errors.current : undefined}
            />
          </View>

          <View style={{ gap: space[2] }}>
            <Caption>Mật khẩu mới</Caption>
            <TextField
              value={next}
              onChangeText={setNext}
              placeholder={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
              accessibilityLabel="Mật khẩu mới"
              error={touched ? errors.next : undefined}
            />
          </View>

          <View style={{ gap: space[2] }}>
            <Caption>Nhập lại mật khẩu mới</Caption>
            <TextField
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Gõ lại mật khẩu mới"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Nhập lại mật khẩu mới"
              error={touched ? errors.confirm : undefined}
            />
          </View>

          <Button
            label="Đổi mật khẩu"
            onPress={submit}
            loading={mutation.isPending}
            disabled={touched && !canSubmit}
          />

          <ThemedText variant="caption" color="faint" align="center">
            Quên mật khẩu hiện tại? Đăng xuất rồi dùng "Quên mật khẩu?" ở màn đăng nhập.
          </ThemedText>
        </Screen>
      </KeyboardAvoidingView>
    </Screen>
  )
}
