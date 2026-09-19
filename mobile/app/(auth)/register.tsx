import { useEffect, useMemo, useRef, useState } from 'react'
import { View, KeyboardAvoidingView, Platform, Alert, ScrollView, Pressable } from 'react-native'
import { router, Link } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { Check } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { setTokens } from '@/lib/auth'
import { captureEvent } from '@/lib/analytics'
import { clearOnboardingDraft } from '@/lib/onboardingDraft'
import { clearGuestSessionCache } from '@/lib/guestSessionStore'
import { passwordStrength } from '@/lib/passwordStrength'
import { openPrivacyPolicy, openTermsOfUse } from '@/lib/legal'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, TextField, Button, Icon } from '@/components/ui'
import { getDeviceLocale, useT } from '@/lib/i18n'
import { authMessages } from '@/lib/i18n/messages/auth'

// Nhãn độ mạnh theo `strength.level` (0–4) của `lib/passwordStrength.ts` — file đó vẫn trả nhãn tiếng
// Việt cho phần còn lại của app; màn này chỉ ánh xạ mức sang từ điển để hiện đúng ngôn ngữ thiết bị.
const STRENGTH_LABEL_KEYS = [
  'register.strengthLabels.l0',
  'register.strengthLabels.l1',
  'register.strengthLabels.l2',
  'register.strengthLabels.l3',
  'register.strengthLabels.l4',
] as const

export default function RegisterScreen() {
  const theme = useTheme()
  const t = useT(authMessages)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  // Đăng ký thành công hay không quyết định số phận của draft khách khi màn này
  // rời khỏi ngăn xếp — xem effect dọn dẹp bên dưới (F-3).
  const signedUpRef = useRef(false)
  const { fetchMe } = useAuthStore()
  const { fetchPlan } = usePlanStore()

  const strength = useMemo(() => passwordStrength(password), [password])

  // Khách bỏ ngang ở màn này (vuốt lùi, đổi ý, kill app rồi mở lại) thì draft
  // phễu phải chết theo. Không dọn thì nó nằm lại và người ĐĂNG KÝ KẾ TIẾP trên
  // cùng máy sẽ bị replay im lặng câu trả lời của người trước, không hề thấy
  // bảng câu hỏi (QA 2026-08-20, F-3).
  useEffect(
    () => () => {
      if (!signedUpRef.current) {
        void clearOnboardingDraft()
        // Đợt 2 (17/09): cùng luật cho con trỏ phiên khách trên server — khách A bỏ dở ở đây, B đăng ký
        // sau trên cùng máy không được claim phiên (câu trả lời) của A. Phiên trên server tự hết hạn 72 h.
        void clearGuestSessionCache()
      }
    },
    [],
  )

  async function handleRegister() {
    const phoneTrimmed = phone.trim()
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('common.missingInfoTitle'), t('register.missingInfoBody'))
      return
    }
    if (!agree) {
      Alert.alert(t('register.termsTitle'), t('register.termsBody'))
      return
    }
    // Phone is optional (App Store 5.1.1(v)); only validate the format when the user actually enters one.
    if (phoneTrimmed && !/^0[35789]\d{8}$/.test(phoneTrimmed)) {
      Alert.alert(t('register.phoneInvalidTitle'), t('register.phoneInvalidBody'))
      return
    }
    if (password.length < 8) {
      Alert.alert(t('common.passwordTooShortTitle'), t('common.passwordTooShortBody'))
      return
    }
    setLoading(true)
    captureEvent('register_started')
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
        displayName: displayName.trim(),
        email: email.trim(),
        // Omit entirely when blank — never send "" (the phone column is UNIQUE; the backend stores NULL).
        ...(phoneTrimmed ? { phoneNumber: phoneTrimmed } : {}),
        password,
        locale: getDeviceLocale(),
      })
      await setTokens(res.data.accessToken, res.data.refreshToken)
      await fetchMe()
      await fetchPlan()
      captureEvent('register_success')
      captureEvent('signup_succeeded', { method: 'email' })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Đặt TRƯỚC khi điều hướng: replace làm màn này unmount ngay, và effect dọn
      // dẹp phải thấy được là đã đăng ký xong để không xoá mất draft sắp replay.
      signedUpRef.current = true
      // New learners go through onboarding before reaching the app.
      router.replace('/(auth)/onboarding')
    } catch (e) {
      captureEvent('register_failed')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      // Đừng đoán hộ nguyên nhân: mất mạng, 500, email sai định dạng đều từng bị
      // gộp thành "Email có thể đã được sử dụng" (F-9). apiMessage đọc `detail`
      // của ProblemDetail, đúng như phần còn lại của app.
      Alert.alert(t('register.failedTitle'), apiMessage(e))
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
              <ThemedText variant="titleLg">{t('register.title')}</ThemedText>
              <ThemedText variant="body" color="muted" style={{ marginTop: space[1] }}>
                {t('register.subtitle')}
              </ThemedText>
            </View>

            <View style={{ gap: space[4] }}>
              <TextField
                label={t('register.displayName')}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t('register.displayNamePlaceholder')}
                autoCapitalize="words"
              />
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
                label={t('register.phone')}
                value={phone}
                onChangeText={setPhone}
                placeholder="0912345678"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <View style={{ gap: space[2] }}>
                <TextField
                  label={t('common.password')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('common.passwordMinPlaceholder')}
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
                      {t('register.strength', { label: t(STRENGTH_LABEL_KEYS[strength.level] ?? 'register.strengthLabels.l0') })}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {/* Terms agreement — gates the submit, matching the v2 auth mockup.
                  QA 14/08: ô tích và phần chữ phải là HAI vùng chạm TÁCH BIỆT. Trước đây hai link
                  pháp lý nằm LỒNG trong <Pressable> của ô tích, nên chạm vào chúng tranh chấp
                  responder với Pressable cha: đo trên máy ảo thì lần nào cũng bật/tắt ô đồng ý,
                  còn tài liệu thì hầu như không mở. Người dùng muốn đọc thứ mình sắp đồng ý lại
                  vô tình đảo ngược chính lựa chọn đó — mà không có dấu hiệu gì. */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agree }}
                  accessibilityLabel={t('register.agreeA11y')}
                  onPress={() => setAgree((a) => !a)}
                  hitSlop={11}
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
                </Pressable>
                {/* Mỗi liên kết là một <Pressable> RIÊNG, không phải <Text onPress> lồng trong
                    <Text>: trên RN 0.81 + New Architecture (Fabric), onPress của Text lồng KHÔNG
                    kích hoạt — đo trên máy ảo thì `openTermsOfUse` không hề được gọi (không có log
                    nào), nên hai tài liệu pháp lý không bao giờ mở ở màn đăng ký.
                    Dùng hàng flexWrap để câu vẫn xuống dòng tự nhiên như cũ. */}
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  <ThemedText variant="caption" color="secondary" style={{ lineHeight: 18 }}>
                    {t('register.agreePrefix')}{' '}
                  </ThemedText>
                  <Pressable onPress={openTermsOfUse} accessibilityRole="link" hitSlop={8}>
                    <ThemedText
                      variant="caption"
                      color="primary"
                      style={{ textDecorationLine: 'underline', lineHeight: 18 }}
                    >
                      {t('register.terms')}
                    </ThemedText>
                  </Pressable>
                  <ThemedText variant="caption" color="secondary" style={{ lineHeight: 18 }}>
                    {' '}
                    {t('register.agreeAnd')}{' '}
                  </ThemedText>
                  <Pressable onPress={openPrivacyPolicy} accessibilityRole="link" hitSlop={8}>
                    <ThemedText
                      variant="caption"
                      color="primary"
                      style={{ textDecorationLine: 'underline', lineHeight: 18 }}
                    >
                      {t('register.privacy')}
                    </ThemedText>
                  </Pressable>
                  <ThemedText variant="caption" color="secondary" style={{ lineHeight: 18 }}>
                    {' '}
                    {t('register.agreeSuffix')}
                  </ThemedText>
                </View>
              </View>

              <Button
                label={t('register.submit')}
                onPress={handleRegister}
                loading={loading}
                disabled={!agree}
                style={{ marginTop: space[1] }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space[6] }}>
              <ThemedText variant="body" color="muted">
                {t('register.haveAccount')}{' '}
              </ThemedText>
              <Link href="/(auth)/login" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.login')} hitSlop={6}>
                  <ThemedText variant="bodyStrong" color="accent">
                    {t('common.login')}
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
