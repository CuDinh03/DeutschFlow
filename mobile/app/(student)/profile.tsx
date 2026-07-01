import { View, Alert, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { LogOut, Star, Bell, Globe, BarChart3, User, ChevronRight, Trash2, HelpCircle, Presentation } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import api, { apiMessage } from '@/lib/api'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Pill, ListRow, Caption, FadeIn } from '@/components/ui'

export default function ProfileScreen() {
  const theme = useTheme()
  const c = theme.colors
  const { user, logout } = useAuthStore()
  const { plan, isPro } = usePlanStore()
  const { data: xp } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: () => gamificationApi.getXpSummary(),
    staleTime: 60_000,
  })

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

  function confirmDeleteAccount() {
    Alert.alert(
      'Xoá tài khoản',
      'Hành động này xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học tập của bạn. Không thể hoàn tác.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/profile/me')
              await logout()
              router.replace('/(auth)/login')
            } catch (e) {
              Alert.alert('Lỗi', apiMessage(e))
            }
          },
        },
      ],
    )
  }

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingBottom: space[10] }}>
      <FadeIn delay={0} style={{ paddingHorizontal: space[5], paddingTop: space[5] }}>
        <Caption style={{ marginBottom: space[2] }}>Tài khoản của bạn</Caption>
        {/* Identity — editorial ink hero, mirroring the Home streak card idiom */}
        <Card style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.md,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ThemedText variant="displayLg" color="onAccent">
                {initials}
              </ThemedText>
            </View>
            <View style={{ flex: 1, gap: space[2] }}>
              <ThemedText variant="titleLg" style={{ color: c.onInk }}>
                {user?.displayName}
              </ThemedText>
              <ThemedText variant="caption" style={{ color: c.onInkMuted }} numberOfLines={1}>
                {user?.email}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1] }}>
                <Pill label={plan?.tier ?? 'FREE'} tone={isPro ? 'accent' : 'neutral'} solid={isPro} />
                {xp ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cấp ${xp.level}, ${xp.totalXp} điểm kinh nghiệm. Xem thống kê`}
                    onPress={() => router.push('/(student)/stats')}
                    hitSlop={8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Icon icon={Star} size={13} color="accent" fill />
                    <ThemedText variant="label" style={{ color: c.onInkMuted }}>
                      Cấp {xp.level} · {xp.totalXp} XP
                    </ThemedText>
                    <Icon icon={ChevronRight} size={13} color="faint" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={100} style={{ paddingHorizontal: space[5], paddingTop: space[5], gap: space[6] }}>
        {!isPro && PAYWALL_ENABLED ? (
          <Card onPress={() => router.push('/(student)/upgrade')} style={{ borderColor: c.accentSoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: c.accentSoft,
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

        <View style={{ gap: space[3] }}>
          <Caption>Tài khoản</Caption>
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            <ListRow icon={User} title="Thông tin cá nhân" onPress={() => router.push('/(student)/settings/profile')} />
            <Divider />
            <ListRow icon={Bell} title="Thông báo" onPress={() => router.push('/(student)/notifications')} />
            <Divider />
            <ListRow icon={HelpCircle} title="Hướng dẫn sử dụng" onPress={() => router.push('/(student)/guide' as unknown as Href)} />
          </Card>
        </View>

        <View style={{ gap: space[3] }}>
          <Caption>Học tập</Caption>
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            <ListRow
              icon={Globe}
              title="Ngôn ngữ giao diện"
              trailing={<ThemedText variant="caption" color="faint">Tiếng Việt</ThemedText>}
              onPress={() => Alert.alert('Sắp ra mắt', 'Tuỳ chọn đổi ngôn ngữ giao diện sẽ có trong bản cập nhật tới.')}
            />
            <Divider />
            <ListRow icon={BarChart3} title="Tiến trình & thống kê" onPress={() => router.push('/(student)/stats')} />
            <Divider />
            <ListRow
              icon={Presentation}
              title="Lớp của tôi"
              subtitle="Lớp đang tham gia, bài tập, tiến độ"
              onPress={() => router.push('/(student)/classes' as never)}
            />
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xoá tài khoản"
          accessibilityHint="Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu, không thể hoàn tác"
          onPress={confirmDeleteAccount}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], paddingVertical: space[2] }}
        >
          <Icon icon={Trash2} size={14} color="faint" />
          <ThemedText variant="caption" color="faint">
            Xoá tài khoản
          </ThemedText>
        </Pressable>

        <ThemedText variant="caption" color="faint" align="center">
          DeutschFlow v1.0.0 • iOS/Android
        </ThemedText>
      </FadeIn>
    </Screen>
  )
}

function Divider() {
  const theme = useTheme()
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />
}
