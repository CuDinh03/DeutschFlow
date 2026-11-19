import { useEffect, useRef, useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, ScrollView, Pressable } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { ArrowLeft } from 'lucide-react-native'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { setTokens } from '@/lib/auth'
import { captureEvent } from '@/lib/analytics'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Button, GaGlyph, IconButton, PinCells } from '@/components/ui'
import { useT } from '@/lib/i18n'
import { authMessages } from '@/lib/i18n/messages/auth'
import {
  PIN_LENGTH,
  formatCountdown,
  markSignupVerified,
  resendSecondsLeft,
  sanitizePin,
  splitAtMarker,
  verifyFailure,
} from '@/lib/registrationPin'

/** Ký tự vô hình đánh dấu chỗ email trong câu dẫn đã dịch, để in đậm email (xem `splitAtMarker`). */
const EMAIL_MARK = '\u2063'
const LINK_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 }

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
  const subtitle = splitAtMarker(t('verify.subtitle', { email: EMAIL_MARK, minutes: String(ttlMinutes) }), EMAIL_MARK)

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
      {/* Nút quay lại = "Đổi email": form đăng ký nằm ngay dưới trong stack, dữ liệu còn nguyên. */}
      <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('verify.changeEmail')}
          onPress={() => router.back()}
          disabled={loading}
        />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space[6], paddingTop: space[5], paddingBottom: space[8] }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: motion.duration.slow }}
          >
            {/* Mẫu v3.4 `pin`: eyebrow, tiêu đề, câu dẫn có email đậm, sáu ô, hàng gửi lại, thẻ nhắc Spam. */}
            <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
              {t('verify.eyebrow')}
            </ThemedText>
            <ThemedText variant="titleLg" accessibilityRole="header" style={{ marginTop: space[2] }}>
              {t('verify.title')}
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={{ marginTop: space[2] }}>
              {subtitle.before}
              {subtitle.found ? (
                <ThemedText variant="bodyStrong" color="primary">
                  {email}
                </ThemedText>
              ) : null}
              {subtitle.after}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('verify.changeEmail')}
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              hitSlop={LINK_HIT_SLOP}
              onPress={() => router.back()}
              style={{ alignSelf: 'flex-start', marginTop: space[2] }}
            >
              <ThemedText variant="label" color="info">{t('verify.changeEmail')}</ThemedText>
            </Pressable>

            <View style={{ marginTop: space[6] }}>
              <PinCells
                label={t('verify.code')}
                hideLabel
                value={code}
                onChange={(v) => {
                  const digits = sanitizePin(v)
                  setCode(digits)
                  // Đủ 6 số (gõ, dán hoặc iOS tự điền từ Mail) là tự gửi — trừ đúng mã vừa bị từ chối.
                  if (digits.length === PIN_LENGTH && digits !== lastSubmitted.current) void verify(digits)
                }}
                length={PIN_LENGTH}
                autoFocus
                testID="verify-code"
              />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: space[4] }}>
              <ThemedText variant="label" color="secondary">
                {t('verify.notReceived')}{' '}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={left > 0 ? t('verify.resendAfter', { time: formatCountdown(left) }) : t('verify.resend')}
                accessibilityState={{ disabled: loading || left > 0 }}
                disabled={loading || left > 0}
                hitSlop={LINK_HIT_SLOP}
                onPress={() => void resend()}
              >
                {left > 0 ? (
                  <ThemedText variant="label" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                    {t('verify.resendAfter', { time: formatCountdown(left) })}
                  </ThemedText>
                ) : (
                  <ThemedText variant="label" color="info" style={{ opacity: loading ? 0.55 : 1 }}>
                    {t('verify.resend')}
                  </ThemedText>
                )}
              </Pressable>
            </View>

            <View
              style={{
                marginTop: space[6],
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: space[3],
                paddingVertical: space[3] + 2,
                paddingHorizontal: space[4],
                borderRadius: radius.lg,
                backgroundColor: theme.colors.surfaceSunken,
              }}
            >
              <GaGlyph name="thongbao" size={22} ink="primary" />
              <ThemedText variant="caption" color="secondary" style={{ flex: 1, lineHeight: 18 }}>
                {t('verify.spamHint')}
              </ThemedText>
            </View>

            <Button
              label={t('verify.submit')}
              onPress={() => void verify(code)}
              loading={loading}
              disabled={code.length !== PIN_LENGTH}
              style={{ marginTop: space[6] }}
            />
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
