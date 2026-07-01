import { useEffect } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { Star, Zap, Mic, Trophy, BookOpen, Check, type LucideIcon } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader, Caption, YellowSquare } from '@/components/ui'
import { trackFeatureAction } from '@/lib/analytics'
import { PAYWALL_ENABLED } from '@/lib/paywall'

const PRO_FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Mic, label: 'AI Speaking không giới hạn' },
  { icon: Trophy, label: 'Mock Exam Goethe chuẩn' },
  { icon: Zap, label: 'Weekly Speaking Challenge' },
  { icon: BookOpen, label: 'Toàn bộ lộ trình A1 đến B2' },
  { icon: Star, label: 'Phân tích lỗi chi tiết' },
]

export default function UpgradeScreen() {
  useEffect(() => {
    // Only a real paywall (Android) is a 'paywall_viewed'; the iOS neutral screen is not — don't
    // pollute the monetization funnel with views that have no purchase path.
    if (PAYWALL_ENABLED) {
      trackFeatureAction('monetization', 'paywall_viewed')
    }
  }, [])

  // iOS: no StoreKit IAP wired yet, and App Store Review 3.1.1 forbids steering to an external (web)
  // purchase. Render a neutral, non-commercial screen — accounts already PRO (bought on the web) still
  // unlock automatically. Re-enable the full paywall once react-native-iap is live (see lib/paywall.ts).
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
