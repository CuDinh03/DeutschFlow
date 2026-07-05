import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { router } from 'expo-router'
import { Star, Zap, Mic, Trophy, BookOpen, Check, type LucideIcon } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, Caption, YellowSquare, Button, Pill } from '@/components/ui'
import { trackFeatureAction } from '@/lib/analytics'
import { IAP_ENABLED, PAYWALL_ENABLED, PRO_UNLOCKED_FREE } from '@/lib/paywall'
import { useAppleIap } from '@/hooks/useAppleIap'
import { metaForProductId } from '@/lib/iapProducts'

const PRO_FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Mic, label: 'AI Speaking không giới hạn' },
  { icon: Trophy, label: 'Mock Exam Goethe chuẩn' },
  { icon: Zap, label: 'Weekly Speaking Challenge' },
  { icon: BookOpen, label: 'Toàn bộ lộ trình A1 đến B2' },
  { icon: Star, label: 'Phân tích lỗi chi tiết' },
]

export default function UpgradeScreen() {
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
      <Screen scroll edges={['top']} contentStyle={{ paddingBottom: space[10] }}>
        <AppHeader title="DeutschFlow PRO" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
          <ProHero
            eyebrow="Tài khoản nâng cao"
            title="DeutschFlow PRO"
            body="Tài khoản PRO mở khoá các tính năng nâng cao như AI Speaking không giới hạn, Mock Exam và lộ trình học đầy đủ."
          />

          <Caption style={{ marginTop: space[7], marginBottom: space[3] }}>Bao gồm trong PRO</Caption>
          <FeatureList />

          <ThemedText variant="caption" color="faint" align="center" style={{ marginTop: space[5] }}>
            Gói PRO được quản lý trong tài khoản DeutschFlow của bạn.
          </ThemedText>
        </View>
      </Screen>
    )
  }

  // Android: PRO is managed on the web; this screen explains the value.
  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingBottom: space[10] }}>
      <AppHeader title="DeutschFlow PRO" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
        <ProHero
          eyebrow="Nâng cấp tài khoản"
          title="Mở khoá toàn bộ"
          body="Học tiếng Đức không giới hạn với AI coach và lộ trình cá nhân hoá."
        />

        <Caption style={{ marginTop: space[7], marginBottom: space[3] }}>Bạn sẽ nhận được</Caption>
        <FeatureList />

        <ThemedText variant="caption" color="faint" align="center" style={{ marginTop: space[5] }}>
          Gói PRO được quản lý trong tài khoản DeutschFlow của bạn.
        </ThemedText>
      </View>
    </Screen>
  )
}

/** Real StoreKit paywall: fetches products from the store, purchases, and restores. */
function IapPaywall() {
  const c = useTheme().colors
  const { connected, products, phase, activeSku, error, succeeded, buy, restore } = useAppleIap(true)
  const isBusy = phase === 'purchasing' || phase === 'restoring'
  const isLoadingProducts = (phase === 'loading' || !connected) && products.length === 0

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingBottom: space[10] }}>
      <AppHeader title="DeutschFlow PRO" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
        <ProHero
          eyebrow="Nâng cấp tài khoản"
          title="Mở khoá toàn bộ"
          body="Học tiếng Đức không giới hạn với AI coach và lộ trình cá nhân hoá."
        />

        {succeeded ? (
          <Card style={{ marginTop: space[6], gap: space[3], borderColor: c.success }}>
            <Icon icon={Check} size={28} color="success" />
            <ThemedText variant="title">Đã kích hoạt gói PRO!</ThemedText>
            <ThemedText variant="body" color="muted">
              Cảm ơn bạn. Toàn bộ tính năng nâng cao đã được mở khoá.
            </ThemedText>
            <Button label="Tiếp tục học" onPress={() => router.back()} />
          </Card>
        ) : (
          <>
            <Caption style={{ marginTop: space[7], marginBottom: space[3] }}>Chọn gói</Caption>

            {isLoadingProducts ? (
              <Card style={{ alignItems: 'center', paddingVertical: space[7] }}>
                <ActivityIndicator color={c.accent} />
                <ThemedText variant="caption" color="faint" style={{ marginTop: space[3] }}>
                  Đang tải các gói…
                </ThemedText>
              </Card>
            ) : products.length === 0 ? (
              <Card style={{ paddingVertical: space[6] }}>
                <ThemedText variant="body" color="muted" align="center">
                  Chưa tải được gói nào. Vui lòng kiểm tra kết nối và thử lại sau.
                </ThemedText>
              </Card>
            ) : (
              <View style={{ gap: space[3] }}>
                {products.map((p) => {
                  const meta = metaForProductId(p.id)
                  const period = meta?.durationMonths === 12 ? '/năm' : meta?.durationMonths === 1 ? '/tháng' : ''
                  return (
                    <Card key={p.id} style={{ gap: space[3] }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                        <ThemedText variant="title" style={{ flex: 1 }}>
                          {p.title || p.displayName || meta?.planCode || 'PRO'}
                        </ThemedText>
                        {meta ? <Pill label={meta.planCode} tone={meta.planCode === 'ULTRA' ? 'accent' : 'neutral'} /> : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                        <ThemedText variant="display">{p.displayPrice}</ThemedText>
                        {period ? (
                          <ThemedText variant="caption" color="faint">
                            {period}
                          </ThemedText>
                        ) : null}
                      </View>
                      <Button
                        label="Đăng ký"
                        onPress={() => buy(p.id)}
                        loading={phase === 'purchasing' && activeSku === p.id}
                        disabled={isBusy && activeSku !== p.id}
                      />
                    </Card>
                  )
                })}
              </View>
            )}

            {error ? (
              <ThemedText variant="caption" color="danger" align="center" style={{ marginTop: space[4] }}>
                {error}
              </ThemedText>
            ) : null}

            <Button
              label="Khôi phục giao dịch"
              variant="ghost"
              onPress={restore}
              loading={phase === 'restoring'}
              disabled={isBusy}
              style={{ marginTop: space[4] }}
            />

            <ThemedText variant="caption" color="faint" align="center" style={{ marginTop: space[4] }}>
              Gói tự động gia hạn, huỷ bất cứ lúc nào trong Cài đặt App Store. Thanh toán qua tài khoản Apple của bạn.
            </ThemedText>
          </>
        )}
      </View>
    </Screen>
  )
}

/** Editorial ink hero (Galerie v2): the ProBadge motif — ink square + gold star — with a serif title. */
function ProHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  const c = useTheme().colors
  return (
    <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface, gap: space[4] }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={Star} size={28} color="accent" fill />
      </View>
      <View style={{ gap: space[2] }}>
        <Caption color={c.accent}>{eyebrow}</Caption>
        <ThemedText variant="display" style={{ color: c.onInk }}>
          {title}
        </ThemedText>
        <ThemedText variant="body" style={{ color: c.onInkMuted }}>
          {body}
        </ThemedText>
      </View>
    </Card>
  )
}

/** Editorial feature list — hairline-divided rows with the yellow-square motif and a success tick. */
function FeatureList() {
  const c = useTheme().colors
  return (
    <Card padded={false} style={{ paddingHorizontal: space[4] }}>
      {PRO_FEATURES.map((f, i) => (
        <View key={f.label}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: c.border }} /> : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              paddingVertical: space[3],
            }}
          >
            <YellowSquare size={8} />
            <ThemedText variant="body" style={{ flex: 1 }}>
              {f.label}
            </ThemedText>
            <Icon icon={Check} size={16} color="success" />
          </View>
        </View>
      ))}
    </Card>
  )
}
