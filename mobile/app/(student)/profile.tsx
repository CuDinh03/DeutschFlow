import { View, Alert } from 'react-native'
import { router } from 'expo-router'
import { LogOut, Star, Bell, Globe, BarChart3, User, ChevronRight } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, ListRow, SectionHeader } from '@/components/ui'

export default function ProfileScreen() {
  const theme = useTheme()
  const { user, logout } = useAuthStore()
  const { plan, isPro } = usePlanStore()

  const initials =
    user?.displayName
      ?.split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?'

  function confirmLogout() {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingBottom: space[10] }}>
      <View style={{ alignItems: 'center', paddingHorizontal: space[5], paddingTop: space[6], paddingBottom: space[5], gap: space[1] }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            backgroundColor: theme.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space[2],
          }}
        >
          <ThemedText variant="displayLg" color="onAccent">
            {initials}
          </ThemedText>
        </View>
        <ThemedText variant="titleLg">{user?.displayName}</ThemedText>
        <ThemedText variant="body" color="muted">
          {user?.email}
        </ThemedText>
        <Pill label={plan?.tier ?? 'FREE'} tone={isPro ? 'accent' : 'neutral'} style={{ marginTop: space[2] }} />
      </View>

      <View style={{ paddingHorizontal: space[5], gap: space[5] }}>
        {!isPro ? (
          <Card onPress={() => router.push('/(student)/upgrade')} style={{ borderColor: theme.colors.accent + '66' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={Star} size={20} color="accent" fill />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong">Nâng cấp lên PRO</ThemedText>
                <ThemedText variant="caption" color="muted">
                  Mở khoá toàn bộ tính năng học tập
                </ThemedText>
              </View>
              <Icon icon={ChevronRight} size={18} color="faint" />
            </View>
          </Card>
        ) : null}

        <View>
          <SectionHeader title="Tài khoản" />
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            <ListRow icon={User} title="Thông tin cá nhân" onPress={() => router.push('/(student)/settings/profile')} />
            <Divider />
            <ListRow icon={Bell} title="Thông báo" onPress={() => router.push('/(student)/notifications')} />
          </Card>
        </View>

        <View>
          <SectionHeader title="Học tập" />
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            <ListRow icon={Globe} title="Ngôn ngữ giao diện" onPress={() => {}} />
            <Divider />
            <ListRow icon={BarChart3} title="Tiến trình & thống kê" onPress={() => router.push('/(student)/stats')} />
          </Card>
        </View>

        <Card onPress={confirmLogout} elevation="flat">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Icon icon={LogOut} size={18} color="danger" />
            <ThemedText variant="bodyStrong" color="danger">
              Đăng xuất
            </ThemedText>
          </View>
        </Card>

        <ThemedText variant="caption" color="faint" align="center" style={{ marginTop: space[2] }}>
          DeutschFlow v1.0.0 • iOS/Android
        </ThemedText>
      </View>
    </Screen>
  )
}

function Divider() {
  const theme = useTheme()
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />
}
