import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, Pressable, ScrollView } from 'react-native'
import { router, Link } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { fetchOnboardingContext } from '@/lib/onboardingContext'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { motion, space } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { Screen, ThemedText, TextField, Button } from '@/components/ui'
import { AuthAura } from '@/components/auth/AuthAura'
import { AuthHeading } from '@/components/auth/AuthHeading'
import { AuthWordmark } from '@/components/auth/AuthWordmark'
import { useT } from '@/lib/i18n'
import { authMessages } from '@/lib/i18n/messages/auth'

export default function LoginScreen() {
  const t = useT(authMessages)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const fetchPlan = usePlanStore((s) => s.fetchPlan)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.missingInfoTitle'), t('login.missingInfoBody'))
      return
    }
    setLoading(true)
    captureEvent('login_started')
    try {
      await login(email.trim(), password)
      captureEvent('login_success')
      // Plan + onboarding context are independent once authenticated — run them in
      // parallel, and don't block navigation on the success haptic. Đợt 5 (17/09): hỏi
      // /onboarding/context (cùng `hasPlan` với /status, thêm cửa vào để màn onboarding rẽ bản
      // rút gọn cho học viên trung tâm). Best-effort: lỗi/404 ⇒ null ⇒ vào app như người đã có plan.
      const [, ctx] = await Promise.all([fetchPlan(), fetchOnboardingContext()])
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace(ctx?.hasPlan === false ? '/(auth)/onboarding' : '/(student)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      captureEvent('login_failed', { reason: msg || 'unknown' })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      if (msg === 'NON_STUDENT_ROLE') {
        Alert.alert(t('login.wrongRoleTitle'), t('login.wrongRoleBody'), [{ text: t('common.ok') }])
      } else {
        Alert.alert(t('login.failedTitle'), t('login.failedBody'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <AuthAura />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space[6], paddingTop: space[7], paddingBottom: space[8] }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: motion.duration.slow }}
          >
            {/* Mẫu v3.4 `login`: logo + chữ thương hiệu, tiêu đề lớn có vệt vàng, rồi form. */}
            <AuthWordmark />
            <View style={{ marginTop: space[10] }}>
              <AuthHeading lead={t('login.titleLead')} mark={t('login.titleMark')} stacked />
            </View>
            <ThemedText variant="body" color="secondary" style={{ marginTop: space[3] }}>
              {t('login.subtitle')}
            </ThemedText>

            <View style={{ gap: space[4], marginTop: space[7] }}>
              <TextField
                label={t('common.email')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('common.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TextField
                label={t('common.password')}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('login.forgotA11y')}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'flex-end', marginTop: space[3] }}
            >
              <ThemedText variant="label" color="info">{t('login.forgot')}</ThemedText>
            </Pressable>

            <Button
              label={t('common.login')}
              variant="yellow"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: space[5] }}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: space[6] }}>
              <ThemedText variant="body" color="secondary">
                {t('login.noAccount')}{' '}
              </ThemedText>
              <Link href="/(auth)/register" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('login.registerFree')}
                  hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                >
                  <ThemedText variant="bodyStrong" color="info">
                    {t('login.registerFree')}
                  </ThemedText>
                </Pressable>
              </Link>
            </View>

            {/* Đợt 3 (G-1): lối "Học thử" không còn sau cờ PostHog `onboarding-value-first` —
                màn Chào mừng là cửa vào phễu khách; ở đây chỉ giữ cổng quay lại. Mẫu v3.4 không vẽ
                lối này nhưng điều hướng giữ nguyên: đặt dưới cùng, cỡ chữ nhãn. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('login.tryFreeA11y')}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              onPress={() => { void Haptics.selectionAsync(); router.push('/(auth)/onboarding') }}
              style={{ alignSelf: 'center', marginTop: space[4] }}
            >
              <ThemedText variant="label" color="info" align="center">
                {t('login.tryFree')}
              </ThemedText>
            </Pressable>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
