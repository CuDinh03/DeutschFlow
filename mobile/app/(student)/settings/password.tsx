import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { apiMessage } from '@/lib/api'
import { space, useTheme } from '@/lib/theme'
import { profileApi, validatePasswordChange, PASSWORD_MIN_LENGTH } from '@/lib/profileApi'
import { passwordStrength } from '@/lib/passwordStrength'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button, Screen, TextField, ThemedText } from '@/components/ui'
import { Badge, PageTitle, SubHeader } from '@/components/me/MeParts'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'

/**
 * Đổi mật khẩu trong app (N4, đợt 2 plan nâng cấp mobile 05/09). Trước đây người
 * dùng chỉ-mobile phải thoát app đi luồng "quên mật khẩu" qua email. Backend đổi
 * xong thu hồi mọi refresh token → màn này chủ động đăng xuất và về màn đăng nhập,
 * kẻo người dùng kẹt với token đã chết tới lần gọi API kế.
 *
 * Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `password`): ô nhập có nhãn, thước độ mạnh dưới mật khẩu
 * mới, nhãn "Khớp" khi gõ lại đúng. Kiểm tra hợp lệ (`validatePasswordChange`) và luồng gửi giữ nguyên.
 */
export default function ChangePasswordScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackTo(PARENT_OF['settings/password'])
  const c = useTheme().colors
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

  // Chỉ để xem (cùng thang với màn Đăng ký) — điều kiện chặn gửi vẫn là `errors` ở trên.
  const strength = next.length > 0 ? passwordStrength(next) : null
  const confirmMatches = confirm.length > 0 && confirm === next

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
          <SubHeader onBack={goBack} />
        </View>

        <Screen scroll keyboardInsets={false} edges={[]} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[8], gap: space[4] }}>
          <PageTitle
            title="Đổi mật khẩu"
            sub={`Mật khẩu mới cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự. Sau khi đổi, bạn sẽ được đưa về màn đăng nhập.`}
          />

          <TextField
            label="Mật khẩu hiện tại"
            value={current}
            onChangeText={setCurrent}
            placeholder="Nhập mật khẩu đang dùng"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="next"
            error={touched ? errors.current : undefined}
          />

          <View style={{ gap: space[2] }}>
            <TextField
              label="Mật khẩu mới"
              value={next}
              onChangeText={setNext}
              placeholder={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
              error={touched ? errors.next : undefined}
            />
            {strength ? (
              <View accessible accessibilityLabel={`Độ mạnh mật khẩu: ${strength.label}`} style={{ gap: space[1] }}>
                <View style={{ flexDirection: 'row', gap: space[1] }}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: i < strength.level ? c[strength.tone] : c.surfaceSunken,
                      }}
                    />
                  ))}
                </View>
                <ThemedText variant="caption" color="muted">
                  {`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự · độ mạnh: ${strength.label.toLocaleLowerCase('vi')}`}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={{ gap: space[2] }}>
            <TextField
              label="Nhập lại mật khẩu mới"
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
              error={touched ? errors.confirm : undefined}
            />
            {confirmMatches ? <Badge label="Khớp" tone="success" /> : null}
          </View>

          <Button
            label="Đổi mật khẩu"
            onPress={submit}
            loading={mutation.isPending}
            disabled={touched && !canSubmit}
            style={{ marginTop: space[1] }}
          />

          <ThemedText variant="caption" color="muted" align="center">
            Quên mật khẩu hiện tại? Đăng xuất rồi dùng "Quên mật khẩu?" ở màn đăng nhập.
          </ThemedText>
        </Screen>
      </KeyboardAvoidingView>
    </Screen>
  )
}
