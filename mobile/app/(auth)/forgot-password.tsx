import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import api, { apiMessage } from '@/lib/api'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button, GaGlyph } from '@/components/ui'
import { useT } from '@/lib/i18n'
import { authMessages } from '@/lib/i18n/messages/auth'

export default function ForgotPasswordScreen() {
  const theme = useTheme()
  const t = useT(authMessages)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleRequest() {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert(t('forgot.invalidEmailTitle'), t('forgot.invalidEmailBody'))
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: trimmed })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setSent(true)
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert(t('common.errorTitle'), apiMessage(e))
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
              <GaGlyph name="tinnhan" size={34} ink="success" gold="success" />
            </View>
            <ThemedText variant="titleLg" align="center">
              {t('forgot.sentTitle')}
            </ThemedText>
            <ThemedText variant="body" color="muted" align="center">
              {t('forgot.sentBody', { email: email.trim() })}
            </ThemedText>
            <Button
              label={t('forgot.enterCode')}
              onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { email: email.trim() } })}
              style={{ marginTop: space[2] }}
            />
            <Button
              label={t('forgot.tryAnotherEmail')}
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
              <GaGlyph name="tinnhan" size={26} ink="primary" />
            </View>
            <ThemedText variant="titleLg">{t('forgot.title')}</ThemedText>
            <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }} align="center">
              {t('forgot.subtitle')}
            </ThemedText>
          </View>

          <TextField
            label={t('common.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('common.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Button label={t('forgot.send')} onPress={handleRequest} loading={loading} />
          <Button label={t('forgot.backToLogin')} variant="ghost" onPress={() => router.back()} />
        </MotiView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
