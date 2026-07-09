import { View, Alert, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { LogOut, Star, Bell, Globe, BarChart3, User, ChevronRight, Trash2, HelpCircle, Presentation, ShieldCheck, FileText, Lock, Sparkles } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import api, { apiMessage } from '@/lib/api'
import { PAYWALL_ENABLED, PRO_UNLOCKED_FREE } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { radius, space, useTheme } from '@/lib/theme'
import { openPrivacyPolicy, openTermsOfUse } from '@/lib/legal'
import { getAiConsent, resetAiConsent, setAiConsent } from '@/lib/aiConsent'
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

  async function manageAiConsent() {
    const status = await getAiConsent()
    const label = status === 'granted' ? 'Đang bật' : status === 'denied' ? 'Đang tắt' : 'Chưa quyết định'
    Alert.alert(
      'Dữ liệu & tính năng AI',
      `Trạng thái hiện tại: ${label}.\n\nKhi bật, bản ghi âm, ảnh bài viết và nội dung hội thoại của bạn được gửi tới đối tác AI (Groq, OpenAI, Google Gemini) để nhận dạng giọng nói, chấm và phản hồi bài. Không dùng cho quảng cáo.`,
      [
        { text: 'Đóng', style: 'cancel' },
        status === 'granted'
          ? {
              text: 'Tắt chia sẻ với AI',
              style: 'destructive',
              onPress: () => void resetAiConsent(),
            }
          : {
              text: 'Bật tính năng AI',
              onPress: () => void setAiConsent(true),
            },
        { text: 'Xem Chính sách bảo mật', onPress: openPrivacyPolicy },
      ],
    )
  }

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
                {/* Commercial tier label — hidden on the iOS free build (App Store 2.1(b)). */}
                {!PRO_UNLOCKED_FREE ? (
                  <Pill label={plan?.tier ?? 'FREE'} tone={isPro ? 'accent' : 'neutral'} solid={isPro} />
                ) : null}
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
            <ListRow icon={ShieldCheck} title="An toàn & chặn" onPress={() => router.push('/(student)/settings/blocked' as unknown as Href)} />
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

        {/* Legal & privacy — App Review 5.1.1(i): the privacy policy (naming our AI sub-processors)
            and the AI data-sharing choice must be reachable from inside the app. */}
        <View style={{ gap: space[3] }}>
          <Caption>Quyền riêng tư & pháp lý</Caption>
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            <ListRow
              icon={Sparkles}
              title="Dữ liệu & tính năng AI"
              subtitle="Xem hoặc thay đổi lựa chọn chia sẻ dữ liệu với đối tác AI"
              onPress={manageAiConsent}
            />
            <Divider />
            <ListRow icon={Lock} title="Chính sách bảo mật" onPress={openPrivacyPolicy} />
            <Divider />
            <ListRow icon={FileText} title="Điều khoản sử dụng" onPress={openTermsOfUse} />
          </Card>
        </View>

        <View style={{ gap: space[3] }}>
          <Card onPress={confirmLogout} elevation="flat">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Icon icon={LogOut} size={18} color="danger" />
              <ThemedText variant="bodyStrong" color="danger">
                Đăng xuất
              </ThemedText>
            </View>
          </Card>

          {/* Account deletion — surfaced at the same level as logout so App Review (5.1.1(v)) can
              find it without hunting. Confirmation happens in the Alert inside confirmDeleteAccount. */}
          <Card
            onPress={confirmDeleteAccount}
            elevation="flat"
            accessibilityLabel="Xoá tài khoản"
            accessibilityHint="Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu, không thể hoàn tác"
            style={{ backgroundColor: c.dangerSoft, borderColor: c.danger }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <Icon icon={Trash2} size={18} color="danger" />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong" color="danger">
                  Xoá tài khoản
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học tập
                </ThemedText>
              </View>
              <Icon icon={ChevronRight} size={18} color="danger" />
            </View>
          </Card>
        </View>

        <ThemedText variant="caption" color="faint" align="center">
          MyDeutschFlow v1.0.0 • iOS/Android
        </ThemedText>
      </FadeIn>
    </Screen>
  )
}

function Divider() {
  const theme = useTheme()
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />
}
