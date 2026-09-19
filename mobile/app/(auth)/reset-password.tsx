import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import api, { apiMessage } from '@/lib/api'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button, GaGlyph } from '@/components/ui'
import { useT } from '@/lib/i18n'
import { authMessages } from '@/lib/i18n/messages/auth'

export default function ResetPasswordScreen() {
  const theme = useTheme()
  const t = useT(authMessages)
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    if (!email.trim() || !code.trim() || !newPassword) {
      Alert.alert(t('common.missingInfoTitle'), t('reset.missingInfoBody'))
      return
    }
    if (code.trim().length !== 6) {
      Alert.alert(t('reset.invalidCodeTitle'), t('reset.invalidCodeBody'))
      return
    }
    if (newPassword.length < 8) {
      Alert.alert(t('common.passwordTooShortTitle'), t('common.passwordTooShortBody'))
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('reset.mismatchTitle'), t('reset.mismatchBody'))
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
      Alert.alert(t('reset.successTitle'), t('reset.successBody'), [
        { text: t('common.login'), onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert(t('common.errorTitle'), apiMessage(e))
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
              <GaGlyph name="matkhau" size={26} ink="primary" />
            </View>
            <ThemedText variant="titleLg">{t('reset.title')}</ThemedText>
            <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }} align="center">
              {t('reset.subtitle')}
            </ThemedText>
          </View>

          <TextField
            label={t('common.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('common.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label={t('reset.code')}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TextField
            label={t('reset.newPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('common.passwordMinPlaceholder')}
            secureTextEntry
            autoComplete="new-password"
          />
          <TextField
            label={t('reset.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('reset.confirmPlaceholder')}
            secureTextEntry
            error={confirmPassword && newPassword !== confirmPassword ? t('reset.mismatchTitle') : undefined}
          />
          <Button
            label={t('reset.submit')}
            onPress={handleReset}
            loading={loading}
            disabled={code.length !== 6 || newPassword.length < 8}
          />
          <Button label={t('reset.back')} variant="ghost" onPress={() => router.back()} />
        </MotiView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
