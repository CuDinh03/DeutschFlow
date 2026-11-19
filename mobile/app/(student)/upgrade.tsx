import { useEffect, useState } from 'react'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { Check, X } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, ThemedText, Icon, Button } from '@/components/ui'
import { Badge, Eyebrow, MarkTitle, MeCard, SubHeader } from '@/components/me/MeParts'
import { trackFeatureAction } from '@/lib/analytics'
import { IAP_ENABLED, PAYWALL_ENABLED, PRO_UNLOCKED_FREE } from '@/lib/paywall'
import { openPrivacyPolicy, openTermsOfUse } from '@/lib/legal'
import { openManageSubscriptions } from '@/lib/iapManage'
import { useAppleIap } from '@/hooks/useAppleIap'
import { metaForProductId, periodLabel } from '@/lib/iapProducts'
import { selectedPlanId } from '@/lib/paywallSelection'
import { trialDaysLeft, usePlanStore } from '@/stores/usePlanStore'
import { useBackToMainTab } from '@/hooks/useBackTo'

// Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `upgrade`): nút đóng + "Khôi phục giao dịch" trên hàng đầu,
// nhãn myDeutschFlow PRO, tiêu đề có vệt vàng, danh sách quyền lợi có dấu tích, hàng chọn gói và một
// nút Đăng ký. Giá (displayPrice của StoreKit), quyền lợi, luồng mua và khôi phục giữ nguyên.

const PRO_FEATURES: { glyph: GlyphName; label: string }[] = [
  // PR-A7 (07/09/2026): không hứa "không giới hạn" — hạn mức AI theo gói vẫn có (lib/upsell.ts báo hết lượt).
  { glyph: 'speaking', label: 'Luyện nói AI với hạn mức PRO mỗi ngày' },
  { glyph: 'thithu', label: 'Thi thử telc B1 đủ 4 phần' },
  { glyph: 'xp', label: 'Thử thách nói theo tuần' },
  { glyph: 'lernweg', label: 'Toàn bộ lộ trình A1 đến B1' },
  { glyph: 'sualoi', label: 'Phân tích lỗi chi tiết' },
]

export default function UpgradeScreen() {
  // Back tường minh về màn cha — Tabs firstRoute sẽ về Heute (xem lib/screenParents).
  const goBack = useBackToMainTab()
  useEffect(() => {
    // v1.0 iOS free build: there is no PRO surface at all, so this route should never be reachable —
    // if something links here, bounce straight home rather than show any commercial screen (2.1(b)).
    if (PRO_UNLOCKED_FREE) {
      router.replace('/(student)')
      return
    }
    // Only a real paywall (Android, or iOS once StoreKit is live) is a 'paywall_viewed'; the iOS
    // neutral screen is not — don't pollute the monetization funnel with views that have no purchase path.
    if (PAYWALL_ENABLED) {
      trackFeatureAction('monetization', 'paywall_viewed')
    }
  }, [])

  // v1.0 iOS free build: render nothing while the effect above redirects home.
  if (PRO_UNLOCKED_FREE) {
    return null
  }

  // iOS with StoreKit IAP wired: the real, purchasable paywall.
  if (IAP_ENABLED) {
    return <IapPaywall />
  }

  // iOS without StoreKit IAP: neutral, non-commercial screen. Accounts already PRO (bought on the web)
  // still unlock automatically — App Store Review 3.1.1 forbids steering to an external purchase.
  if (!PAYWALL_ENABLED) {
    return (
      <Screen scroll edges={['top']} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[10] }}>
        <SubHeader onBack={goBack} backIcon={X} backLabel="Đóng" />
        <ProHero
          eyebrow="Tài khoản nâng cao"
          lead="MyDeutschFlow"
          mark="PRO"
          body="Tài khoản PRO mở khoá các tính năng nâng cao như luyện nói AI với hạn mức cao mỗi ngày, thi thử và lộ trình học đầy đủ."
        />
        <Eyebrow style={{ marginTop: space[6], marginBottom: space[1] }}>Bao gồm trong PRO</Eyebrow>
        <FeatureList />
        <ThemedText variant="caption" color="muted" align="center" style={{ marginTop: space[6] }}>
          Gói PRO được quản lý trong tài khoản MyDeutschFlow của bạn.
        </ThemedText>
      </Screen>
    )
  }

  // Android: PRO is managed on the web; this screen explains the value.
  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[10] }}>
      <SubHeader onBack={goBack} backIcon={X} backLabel="Đóng" />
      <ProHero
        eyebrow="myDeutschFlow PRO"
        lead="Mở khoá"
        mark="toàn bộ"
        body="Học tiếng Đức mỗi ngày với AI coach và lộ trình cá nhân hoá."
      />
      <Eyebrow style={{ marginTop: space[6], marginBottom: space[1] }}>Bạn sẽ nhận được</Eyebrow>
      <FeatureList />
      <ThemedText variant="caption" color="muted" align="center" style={{ marginTop: space[6] }}>
        Gói PRO được quản lý trong tài khoản MyDeutschFlow của bạn.
      </ThemedText>
    </Screen>
  )
}

/** Real StoreKit paywall: fetches products from the store, purchases, and restores. */
function IapPaywall() {
  const goBack = useBackToMainTab()
  const c = useTheme().colors
  const { connected, products, phase, activeSku, error, succeeded, buy, restore } = useAppleIap(true)
  const isBusy = phase === 'purchasing' || phase === 'restoring'
  const isLoadingProducts = (phase === 'loading' || !connected) && products.length === 0
  // F-20 (soát 02/09): người đang dùng thử vào paywall phải thấy mình đang trial
  // và còn bao lâu — dữ liệu /auth/me/plan có sẵn nhưng trước đây không render.
  const plan = usePlanStore((s) => s.plan)
  const trialDays = plan?.isTrial ? trialDaysLeft(plan.trialEndsAt, new Date()) : null
  // Gói đang chọn: người dùng chạm hàng nào thì giữ hàng đó; chưa chạm thì gói chính (có nhãn badge).
  const [chosen, setChosen] = useState<string | null>(null)
  const selected = selectedPlanId(
    products.map((p) => p.id),
    chosen,
    (id) => !!metaForProductId(id)?.badge,
  )

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[10] }}>
      <SubHeader
        onBack={goBack}
        backIcon={X}
        backLabel="Đóng"
        right={
          succeeded ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Khôi phục giao dịch"
              accessibilityState={{ disabled: isBusy, busy: phase === 'restoring' }}
              onPress={() => void restore()}
              disabled={isBusy}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed || (isBusy && phase !== 'restoring') ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: space[1] })}
            >
              {phase === 'restoring' ? <ActivityIndicator size="small" color={c.info} /> : null}
              <ThemedText variant="label" color="info">
                Khôi phục giao dịch
              </ThemedText>
            </Pressable>
          )
        }
      />
      <ProHero
        eyebrow="myDeutschFlow PRO"
        lead="Mở khoá"
        mark="toàn bộ"
        body="Học tiếng Đức mỗi ngày với AI coach và lộ trình cá nhân hoá."
      />

      {plan?.isTrial ? (
        <MeCard tone="accent" style={{ marginTop: space[4], gap: 2, paddingVertical: space[3] }}>
          <ThemedText variant="bodyStrong">
            Bạn đang dùng thử PRO{trialDays != null ? ` — còn ${trialDays} ngày` : ''}
          </ThemedText>
          <ThemedText variant="caption" color="secondary">
            Đăng ký để không gián đoạn khi hết dùng thử.
          </ThemedText>
        </MeCard>
      ) : null}

      <View style={{ marginTop: space[4] }}>
        <FeatureList />
      </View>

      {succeeded ? (
        <MeCard style={{ marginTop: space[6], gap: space[3], borderColor: c.success }}>
          <Icon icon={Check} size={28} color="success" />
          <ThemedText variant="title">Đã kích hoạt gói trả phí!</ThemedText>
          <ThemedText variant="body" color="muted">
            Cảm ơn bạn. Toàn bộ tính năng nâng cao đã được mở khoá.
          </ThemedText>
          <Button label="Tiếp tục học" onPress={goBack} />
          <Button
            label="Quản lý gói đăng ký"
            variant="ghost"
            onPress={() => void openManageSubscriptions()}
          />
        </MeCard>
      ) : (
        <>
          <Eyebrow style={{ marginTop: space[6], marginBottom: space[2] }}>Chọn gói</Eyebrow>

          {isLoadingProducts ? (
            <MeCard style={{ alignItems: 'center', paddingVertical: space[7] }}>
              <ActivityIndicator color={c.textMuted} />
              <ThemedText variant="caption" color="muted" style={{ marginTop: space[3] }}>
                Đang tải các gói…
              </ThemedText>
            </MeCard>
          ) : products.length === 0 ? (
            <MeCard style={{ paddingVertical: space[6] }}>
              <ThemedText variant="body" color="muted" align="center">
                Chưa tải được gói nào. Vui lòng kiểm tra kết nối và thử lại sau.
              </ThemedText>
            </MeCard>
          ) : (
            <View style={{ gap: space[3] }} accessibilityRole="radiogroup">
              {products.map((p) => {
                const meta = metaForProductId(p.id)
                const period = periodLabel(meta?.durationMonths)
                const name = meta?.label || p.title || p.displayName || 'Pro'
                const on = selected === p.id
                return (
                  // Apple 3.1.2: số tiền bị trừ mỗi kỳ (displayPrice của StoreKit) là chữ lớn nhất của
                  // hàng gói; không gạch giá, không đếm ngược (sổ lời hứa QLT-19).
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${name}, ${p.displayPrice}${period ? ` ${period}` : ''}${meta?.badge ? `, ${meta.badge}` : ''}`}
                    accessibilityHint={meta?.note}
                    accessibilityState={{ checked: on, disabled: isBusy }}
                    disabled={isBusy}
                    onPress={() => setChosen(p.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[3],
                      paddingVertical: space[3],
                      paddingHorizontal: space[4],
                      borderRadius: radius.md,
                      borderWidth: on ? 2 : 1.5,
                      borderColor: on ? c.inkSurface : c.borderStrong,
                      backgroundColor: on ? c.accentSoft : c.surface,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
                        <ThemedText variant="bodyStrong">{name}</ThemedText>
                        {meta?.badge ? <Badge label={meta.badge} tone="accent" /> : null}
                      </View>
                      {meta?.note ? (
                        <ThemedText variant="caption" color="muted">
                          {meta.note}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText variant="titleLg">{p.displayPrice}</ThemedText>
                      {period ? (
                        <ThemedText variant="caption" color="muted">
                          {period}
                        </ThemedText>
                      ) : null}
                    </View>
                    <RadioDot on={on} />
                  </Pressable>
                )
              })}
              <Button
                label="Đăng ký"
                variant="yellow"
                size="lg"
                onPress={() => {
                  if (selected) void buy(selected)
                }}
                loading={phase === 'purchasing' && activeSku === selected}
                disabled={!selected || (isBusy && activeSku !== selected)}
                style={{ marginTop: space[2] }}
              />
            </View>
          )}

          {error ? (
            <ThemedText variant="caption" color="danger" align="center" style={{ marginTop: space[4] }}>
              {error}
            </ThemedText>
          ) : null}

          <ThemedText variant="caption" color="muted" align="center" style={{ marginTop: space[4] }}>
            Gói tự động gia hạn, huỷ bất cứ lúc nào trong Cài đặt App Store. Thanh toán qua tài khoản Apple của bạn.
          </ThemedText>

          {/* 3.1.2: auto-renewable subscriptions must link to a functional Terms of Use (EULA)
              and Privacy Policy inside the app. */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[4] }}>
            <ThemedText
              variant="caption"
              color="info"
              onPress={openTermsOfUse}
              accessibilityRole="link"
              suppressHighlighting
              style={{ textDecorationLine: 'underline', paddingVertical: 14 }}
            >
              Điều khoản sử dụng
            </ThemedText>
            <ThemedText
              variant="caption"
              color="info"
              onPress={openPrivacyPolicy}
              accessibilityRole="link"
              suppressHighlighting
              style={{ textDecorationLine: 'underline', paddingVertical: 14 }}
            >
              Chính sách bảo mật
            </ThemedText>
          </View>
        </>
      )}
    </Screen>
  )
}

/** Đầu màn PRO (mẫu `upgrade`): nhãn nhỏ, tiêu đề có vệt vàng, một câu giới thiệu. */
function ProHero({ eyebrow, lead, mark, body }: { eyebrow: string; lead: string; mark: string; body: string }) {
  return (
    <View style={{ marginTop: space[4], gap: space[1] }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <MarkTitle lead={lead} mark={mark} />
      <ThemedText variant="body" color="secondary" style={{ marginTop: space[1] }}>
        {body}
      </ThemedText>
    </View>
  )
}

/** Danh sách quyền lợi (`.feat`): dấu tích xanh + một dòng. */
function FeatureList() {
  return (
    <View style={{ gap: space[3] - 2, marginTop: space[2] }}>
      {PRO_FEATURES.map((f) => (
        <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] - 2 }}>
          <Icon icon={Check} size={18} color="success" />
          <ThemedText variant="body" style={{ flex: 1 }}>
            {f.label}
          </ThemedText>
        </View>
      ))}
    </View>
  )
}

/** Nút tròn chọn gói (`.radio`). */
function RadioDot({ on }: { on: boolean }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: on ? c.inkSurface : c.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: c.inkSurface }} /> : null}
    </View>
  )
}
