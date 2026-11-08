import { useEffect, useRef, useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { setTokens } from '@/lib/auth'
import { captureEvent } from '@/lib/analytics'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Button, GaGlyph, PinCells } from '@/components/ui'
import { useT } from '@/lib/i18n'
import { authMessages } from '@/lib/i18n/messages/auth'
import {
  PIN_LENGTH,
  markSignupVerified,
  resendSecondsLeft,
  sanitizePin,
  verifyFailure,
} from '@/lib/registrationPin'

/**
 * Nhập mã xác minh đăng ký (thiết kế mã PIN 05/11 §7.2). Đến từ `register.tsx` sau 202 của
 * /auth/register/start — CHƯA có tài khoản, CHƯA setTokens. Form đăng ký vẫn nằm dưới trong stack nên
 * "Đổi email" chỉ cần `router.back()`, dữ liệu đã nhập còn nguyên.
 *
 * Biểu tượng nhận diện dùng GaGlyph; không emoji (mobile/GALERIE_GLYPHS.md).
 */
export default function VerifyEmailScreen() {
  const theme = useTheme()
  const t = useT(authMessages)
  const params = useLocalSearchParams<{ email?: string; ttl?: string; resendAfter?: string }>()
  const email = params.email ?? ''
  const ttlMinutes = Math.max(1, Math.round(Number(params.ttl ?? 3600) / 60))
  const resendAfter = Number(params.resendAfter ?? 60)

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentAt, setSentAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const lastSubmitted = useRef('')
  const { fetchMe } = useAuthStore()
  const { fetchPlan } = usePlanStore()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const left = resendSecondsLeft(sentAt, resendAfter, now)

  async function verify(value: string) {
    if (loading || value.length !== PIN_LENGTH) return
    lastSubmitted.current = value
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register/verify', {
        email,
        code: value,
      })
      await setTokens(res.data.accessToken, res.data.refreshToken)
      await fetchMe()
      await fetchPlan()
      captureEvent('register_code_verified')
      captureEvent('register_success')
      captureEvent('signup_succeeded', { method: 'email' })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Đặt TRƯỚC khi điều hướng: màn đăng ký bên dưới đọc cờ này lúc unmount để giữ draft onboarding.
      markSignupVerified()
      router.replace('/(auth)/onboarding')
    } catch (e) {
      const f = verifyFailure(e)
      captureEvent('register_code_failed', { reason: f.key })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      const message =
        f.key === 'verify.wrongWithRemaining' ? t(f.key, { count: String(f.remaining) }) : t(f.key)
      Alert.alert(t('verify.failedTitle'), message)
      setCode('')
      setLoading(false)
    }
  }

  async function resend() {
    if (loading || left > 0) return
    setLoading(true)
    try {
      await api.post('/auth/register/resend', { email })
      setSentAt(Date.now())
      setCode('')
      lastSubmitted.current = ''
      captureEvent('register_code_resent')
      Alert.alert(t('verify.resentTitle'), t('verify.resentBody', { email }))
    } catch (e) {
      const f = verifyFailure(e)
      Alert.alert(t('common.errorTitle'), f.key === 'verify.tooMany' ? t('verify.tooMany') : t('verify.resendFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: space[6] }}
          contentContainerStyle={{ justifyContent: 'center', flexGrow: 1, paddingVertical: space[10], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              <ThemedText variant="titleLg">{t('verify.title')}</ThemedText>
              <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }} align="center">
                {t('verify.subtitle', { email, minutes: String(ttlMinutes) })}
              </ThemedText>
            </View>

            <PinCells
              label={t('verify.code')}
              value={code}
              onChange={(v) => {
                const digits = sanitizePin(v)
                setCode(digits)
                // Đủ 6 số (gõ, dán hoặc iOS tự điền từ Mail) là tự gửi — trừ đúng mã vừa bị từ chối.
                if (digits.length === PIN_LENGTH && digits !== lastSubmitted.current) void verify(digits)
              }}
              length={PIN_LENGTH}
              editable={!loading}
              autoFocus
              testID="verify-code"
            />
            <Button
              label={t('verify.submit')}
              onPress={() => void verify(code)}
              loading={loading}
              disabled={code.length !== PIN_LENGTH}
            />
            <Button
              label={left > 0 ? t('verify.resendIn', { seconds: String(left) }) : t('verify.resend')}
              variant="ghost"
              onPress={() => void resend()}
              disabled={loading || left > 0}
            />
            <Button label={t('verify.changeEmail')} variant="ghost" onPress={() => router.back()} disabled={loading} />
            <ThemedText variant="caption" color="muted" align="center">
              {t('verify.spamHint')}
            </ThemedText>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
