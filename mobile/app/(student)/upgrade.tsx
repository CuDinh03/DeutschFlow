import { useEffect } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { Star, Zap, Mic, Trophy, BookOpen, Check, type LucideIcon } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, AppHeader } from '@/components/ui'
import { trackFeatureAction } from '@/lib/analytics'

const PRO_FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Mic, label: 'AI Speaking không giới hạn' },
  { icon: Trophy, label: 'Mock Exam Goethe chuẩn' },
  { icon: Zap, label: 'Weekly Speaking Challenge' },
  { icon: BookOpen, label: 'Toàn bộ lộ trình A1 đến B2' },
  { icon: Star, label: 'Phân tích lỗi chi tiết' },
]

export default function UpgradeScreen() {
  const theme = useTheme()
  useEffect(() => {
    trackFeatureAction('monetization', 'paywall_viewed')
  }, [])

  return (
    <Screen edges={['top']}>
      <AppHeader title="DeutschFlow PRO" onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: space[5] }}>
        <View style={{ alignItems: 'center', paddingVertical: space[8] }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radius['3xl'],
              backgroundColor: theme.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space[4],
            }}
          >
            <Icon icon={Star} size={40} color="accent" fill />
          </View>
          <ThemedText variant="display" align="center">
            Mở khoá toàn bộ
          </ThemedText>
          <ThemedText variant="body" color="secondary" align="center" style={{ marginTop: space[2] }}>
            Học tiếng Đức không giới hạn với AI coach và lộ trình cá nhân hoá
          </ThemedText>
        </View>

        <Card style={{ marginBottom: space[6], gap: space[4] }}>
          {PRO_FEATURES.map((f) => (
            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={f.icon} size={16} color="accent" />
              </View>
              <ThemedText variant="body" style={{ flex: 1 }}>
                {f.label}
              </ThemedText>
              <Icon icon={Check} size={16} color="success" />
            </View>
          ))}
        </Card>

        <ThemedText variant="caption" color="faint" align="center" style={{ marginTop: space[2] }}>
          Gói PRO được quản lý trong tài khoản DeutschFlow của bạn.
        </ThemedText>
      </View>
    </Screen>
  )
}
