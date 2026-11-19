import { View, Alert, Pressable, Platform, Image } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'
import { Pencil } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { isOrgPlan, isTrialActive, orgPlanNotice, planActionRows, trialDaysLeft, usePlanStore } from '@/stores/usePlanStore'
import api, { apiMessage } from '@/lib/api'
import { IAP_ENABLED, PAYWALL_ENABLED, PRO_UNLOCKED_FREE } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { fetchStudentStats, STUDENT_STATS_QUERY_KEY } from '@/lib/studentStatsApi'
import { formatCountVi, formatSpokenTime } from '@/lib/progressFormat'
import { avatarInitial } from '@/lib/avatarInitial'
import { radius, space, useTheme } from '@/lib/theme'
import { openPrivacyPolicy, openTermsOfUse } from '@/lib/legal'
import { openManageSubscriptions, openRefundRequest } from '@/lib/iapManage'
import { planDisplayName } from '@/lib/iapProducts'
import { getAiConsent, resetAiConsent, setAiConsent } from '@/lib/aiConsent'
import { Screen, ThemedText, Pill, FadeIn, GaGlyph, IconButton, Button } from '@/components/ui'
import { Badge, Eyebrow, MeCard, Row, RowList, SubHeader } from '@/components/me/MeParts'
import { useBackToLastTab } from '@/hooks/useBackTo'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { formatAppVersion } from '@/lib/appVersion'

// Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `me`): danh tính, dải ba số, gói, hai nhóm "Học tập" và
// "Cài đặt", nút xoá tài khoản (viền đậm, chữ đỏ), chân trang phiên bản + pháp lý.
export default function ProfileScreen() {
  // Phiên bản thật của bản cài + OTA đang chạy (trước đây gõ cứng "v1.0.0" — lệch bản 1.0.1).
  const appVersionLabel = formatAppVersion({
    version: Application.nativeApplicationVersion,
    build: Application.nativeBuildVersion,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  })
  const theme = useTheme()
  const c = theme.colors
  // Hồ sơ thôi là tab (owner chốt 18/11/2026): mở từ ảnh đại diện, back về tab vừa mở.
  const goBack = useBackToLastTab()
  const { user, logout } = useAuthStore()
  const { plan, isPro, isUltra } = usePlanStore()
  // V-06: gói do trung tâm cấp → không mời huỷ/hoàn tiền Apple (xem cụm "Gói đăng ký" bên dưới).
  const planIsOrg = isOrgPlan(plan)
  const planRows = planActionRows(plan)
  // M-7 (Q1 28/08): đang dùng thử → ẩn thẻ mời "Nâng cấp lên PRO" chủ động. Cụm "Gói đăng ký" bên
  // dưới (nhãn "Đang dùng thử PRO" + mục xem/đổi gói) GIỮ — đó là người dùng tự tìm đến, không phải mời.
  const trialActive = isTrialActive(plan)
  const { data: xp } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: () => gamificationApi.getXpSummary(),
    staleTime: 60_000,
  })
  // Dải ba số (mẫu `me`): cùng khoá với tab Tiến bộ nên số hai nơi luôn khớp và chỉ gọi một lần.
  const { data: stats } = useQuery({
    queryKey: STUDENT_STATS_QUERY_KEY,
    queryFn: fetchStudentStats,
    staleTime: 60_000,
  })

  const initial = avatarInitial(user?.displayName)

  // Renewal/expiry date of the active subscription, formatted for the "Gói đăng ký" card. Guarded
  // against a malformed date so a bad value never crashes the profile screen.
  const renewalLabel = (() => {
    if (!plan?.endsAtUtc) return null
    const d = new Date(plan.endsAtUtc)
    return Number.isNaN(d.getTime()) ? null : `Gia hạn: ${d.toLocaleDateString('vi-VN')}`
  })()

  // F-20: người đang DÙNG THỬ phải thấy rõ điều đó + hạn — không phải "PRO đang
  // hoạt động" rồi bất ngờ hết quota khi trial kết thúc.
  const trialLabel = (() => {
    if (!plan?.isTrial) return null
    const days = trialDaysLeft(plan.trialEndsAt, new Date())
    if (days == null) return 'Đang trong thời gian dùng thử'
    const d = plan.trialEndsAt ? new Date(plan.trialEndsAt) : null
    const dateStr = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('vi-VN') : null
    return `Còn ${days} ngày dùng thử${dateStr ? ` · đến ${dateStr}` : ''}`
  })()

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

  function confirmRefund() {
    Alert.alert(
      'Yêu cầu hoàn tiền',
      'Việc hoàn tiền cho gói mua qua App Store do Apple xử lý, không phải qua ứng dụng. Bạn sẽ được mở trang yêu cầu hoàn tiền chính thức của Apple.',
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Mở trang Apple', onPress: openRefundRequest },
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
      // Mẫu v3.4 `delacc` + hướng dẫn xoá tài khoản của Apple: gói App Store tự gia hạn không tự huỷ theo tài khoản.
      `Hành động này xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học tập của bạn. Không thể hoàn tác.${
        Platform.OS === 'ios' && IAP_ENABLED ? '\n\nGói đang trả phí qua App Store phải huỷ riêng trong Cài đặt iPhone.' : ''
      }`,
      [
        { text: 'Giữ tài khoản', style: 'cancel' },
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

  const totalXp = xp?.totalXp ?? stats?.totalXp
  const figures: { value: string; label: string }[] = [
    { value: stats ? formatCountVi(stats.streakDays) : '—', label: 'ngày liên tiếp' },
    { value: totalXp != null ? formatCountVi(totalXp) : '—', label: 'XP' },
    { value: stats ? formatSpokenTime(stats.speakingMinutes) : '—', label: 'đã nói' },
  ]

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[10] }}>
      <SubHeader onBack={goBack} title="Tôi và cài đặt" />

      <FadeIn delay={0} style={{ marginTop: space[3] + 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 }}>
          {/* Ảnh tự tải lên (users.avatar_url, đổi ở settings/profile) — không có thì chữ cái tên gọi.
              Store nhận avatarUrl thẳng từ /auth/me và setUser() ở màn sửa, nên đổi ảnh xong quay
              ra đây là thấy ngay, không cần refetch. */}
          {user?.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={{ width: 64, height: 64, borderRadius: radius.full }}
              accessibilityIgnoresInvertColors
              accessibilityLabel="Ảnh đại diện"
            />
          ) : (
            <View
              style={{ width: 64, height: 64, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <ThemedText variant="display" color="onAccent">
                {initial}
              </ThemedText>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText variant="titleLg" style={{ fontSize: 24, lineHeight: 30 }} numberOfLines={2}>
              {user?.displayName}
            </ThemedText>
            <ThemedText variant="caption" color="muted" numberOfLines={1}>
              {user?.email}
            </ThemedText>
            {/* Commercial tier label — hidden on the iOS free build (App Store 2.1(b)). */}
            {!PRO_UNLOCKED_FREE ? (
              <View style={{ marginTop: space[1] }}>
                <Badge label={planDisplayName(plan?.tier)} tone={isPro ? 'accent' : 'neutral'} />
              </View>
            ) : null}
          </View>
          <IconButton icon={Pencil} accessibilityLabel="Sửa hồ sơ" color="primary" onPress={() => router.push('/(student)/settings/profile')} />
        </View>
      </FadeIn>

      <FadeIn delay={60} style={{ marginTop: space[4] + 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${figures.map((f) => `${f.value} ${f.label}`).join(', ')}${xp ? `, cấp ${xp.level}` : ''}. Xem tiến bộ`}
          onPress={() => router.push('/(student)/stats')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.lg,
            paddingVertical: space[4],
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          {figures.map((f, i) => (
            <View
              key={f.label}
              style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: c.border, paddingHorizontal: space[1] }}
            >
              <ThemedText variant="monoLg" numberOfLines={1} adjustsFontSizeToFit>
                {f.value}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {f.label}
              </ThemedText>
            </View>
          ))}
        </Pressable>
      </FadeIn>

      <FadeIn delay={100} style={{ gap: space[3], marginTop: space[3] }}>
        {!isPro && !trialActive && PAYWALL_ENABLED ? (
          <MeCard style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 }}>
            <GaGlyph name="goipro" size={28} ink="primary" />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="bodyStrong">Nâng cấp lên PRO</ThemedText>
              <ThemedText variant="caption" color="muted">
                Mở khoá toàn bộ tính năng học tập
              </ThemedText>
            </View>
            <Button label="Xem gói" variant="secondary" size="sm" fullWidth={false} onPress={() => router.push('/(student)/upgrade')} />
          </MeCard>
        ) : null}

        {/* Subscription management — shown for an active IAP subscriber on iOS. Lets them see the current
            plan, change/upgrade it (StoreKit handles PRO→ULTRA & period changes), and — per App Store
            policy where cancellation & refunds are Apple's — deep-link into Apple's own surfaces. */}
        {Platform.OS === 'ios' && IAP_ENABLED && isPro ? (
          <View style={{ gap: space[3] }}>
            <MeCard style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 }}>
              <GaGlyph name="goipro" size={28} ink="primary" />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong">
                  {plan?.isTrial ? 'Đang dùng thử Pro' : `Gói ${planDisplayName(plan?.tier ?? 'PRO')} đang hoạt động`}
                </ThemedText>
                {trialLabel ? (
                  <ThemedText variant="caption" color="muted">
                    {trialLabel}
                  </ThemedText>
                ) : renewalLabel ? (
                  <ThemedText variant="caption" color="muted">
                    {renewalLabel}
                  </ThemedText>
                ) : null}
              </View>
              <Pill label={plan?.isTrial ? 'DÙNG THỬ' : planDisplayName(plan?.tier ?? 'PRO')} tone="accent" solid />
            </MeCard>
            {/* V-06: gói do TRUNG TÂM cấp thì học viên không mua gì ở Apple — "Quản lý & huỷ gói"
                và "Yêu cầu hoàn tiền" dẫn thẳng vào ngõ cụt (Apple không có đăng ký nào của họ),
                và nếu huỷ được thì thứ mất đi là quyền lợi do trung tâm trả tiền. Thay bằng một
                dòng nói rõ ai cấp gói; nâng cấp/đổi gói cũng không mời, vì gói này không của họ. */}
            {planIsOrg ? (
              <MeCard tone="sunken" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <GaGlyph name="lophoc" size={18} ink="muted" />
                <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
                  {orgPlanNotice(plan)}
                </ThemedText>
              </MeCard>
            ) : null}
            {/* "Quản lý & huỷ gói" hiện với MỌI gói, kể cả gói trung tâm (planActionRows): người
                từng tự mua gói Apple rồi vào trung tâm vẫn đang bị Apple trừ tiền — dòng Apple chỉ
                chuyển sang PAUSED ở phía mình. Giấu mục này là bịt lối ra duy nhất trong app. */}
            <RowList>
              {planRows.includes('upgrade') ? (
                <Row
                  glyph="goipro"
                  title={isUltra ? 'Xem và đổi gói' : 'Nâng cấp hoặc đổi gói'}
                  subtitle={isUltra ? 'Đổi kỳ hạn thanh toán' : 'Lên gói Tăng tốc hoặc đổi kỳ hạn'}
                  onPress={() => router.push('/(student)/upgrade')}
                />
              ) : null}
              <Row
                glyph="thanhtoan"
                title="Quản lý và huỷ gói"
                subtitle={planIsOrg ? 'Nếu bạn từng tự mua gói trong App Store' : 'Đổi hoặc huỷ gói trong App Store'}
                onPress={() => void openManageSubscriptions()}
              />
              {planRows.includes('refund') ? (
                <Row glyph="hoantien" title="Yêu cầu hoàn tiền" subtitle="Hoàn tiền do Apple xử lý" onPress={confirmRefund} />
              ) : null}
            </RowList>
          </View>
        ) : null}
      </FadeIn>

      <FadeIn delay={140}>
        <Eyebrow style={{ marginTop: space[6], marginBottom: space[2] }}>Học tập</Eyebrow>
        <RowList>
          <Row
            glyph="lophoc"
            title="Lớp của tôi"
            subtitle="Lớp đang tham gia, bài tập, tiến độ"
            onPress={() => router.push('/(student)/classes' as never)}
          />
          <Row glyph="thongke" title="Tiến trình và thống kê" onPress={() => router.push('/(student)/stats')} />
          <Row
            glyph="hoanthanh"
            title="Chứng nhận"
            subtitle="Chứng nhận hoàn thành khoá học trung tâm đã cấp"
            onPress={() => router.push('/(student)/certificates' as never)}
          />
          <Row
            glyph="baigiao"
            title="Phiếu gửi gia đình"
            subtitle="Phiếu đánh giá giáo viên đã phát hành cho gia đình"
            onPress={() => router.push('/(student)/report-issues' as never)}
          />
        </RowList>

        <Eyebrow style={{ marginTop: space[6], marginBottom: space[2] }}>Cài đặt</Eyebrow>
        <RowList>
          <Row glyph="thongbao" title="Thông báo" onPress={() => router.push('/(student)/notifications')} />
          <Row
            glyph="ngonngu"
            title="Ngôn ngữ giao diện"
            subtitle="Tiếng Việt"
            onPress={() => Alert.alert('Sắp ra mắt', 'Tuỳ chọn đổi ngôn ngữ giao diện sẽ có trong bản cập nhật tới.')}
          />
          {/* App Review 5.1.1(i): lựa chọn chia sẻ dữ liệu với AI phải mở được từ trong app. */}
          <Row
            glyph="dulieuai"
            title="Dữ liệu và tính năng AI"
            subtitle="Xem hoặc thay đổi lựa chọn chia sẻ dữ liệu với đối tác AI"
            onPress={manageAiConsent}
          />
          <Row glyph="hoso" title="Thông tin cá nhân" onPress={() => router.push('/(student)/settings/profile')} />
          {/* N4 (05/09): trước đây người dùng chỉ-mobile phải thoát app đi luồng quên mật khẩu qua email. */}
          <Row glyph="matkhau" title="Đổi mật khẩu" onPress={() => router.push('/(student)/settings/password' as unknown as Href)} />
          <Row glyph="antoan" title="An toàn và chặn" onPress={() => router.push('/(student)/settings/blocked' as unknown as Href)} />
          <Row glyph="huongdan" title="Hướng dẫn sử dụng" onPress={() => router.push('/(student)/guide' as unknown as Href)} />
          <Row glyph="dangxuat" title="Đăng xuất" tone="danger" onPress={confirmLogout} />
        </RowList>

        {/* Account deletion — surfaced at the same level as logout so App Review (5.1.1(v)) can
            find it without hunting. Confirmation happens in the Alert inside confirmDeleteAccount. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xoá tài khoản"
          accessibilityHint="Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu, không thể hoàn tác"
          onPress={confirmDeleteAccount}
          style={({ pressed }) => ({
            marginTop: space[3] + 2,
            height: 52,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: c.borderStrong,
            backgroundColor: pressed ? c.dangerSoft : c.surface,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <ThemedText variant="bodyStrong" color="danger">
            Xoá tài khoản
          </ThemedText>
        </Pressable>
        <ThemedText variant="caption" color="muted" align="center" style={{ marginTop: space[2] }}>
          Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học tập
        </ThemedText>

        {/* Legal & privacy — App Review 5.1.1(i): chính sách bảo mật (nêu tên đối tác AI) và điều khoản
            phải mở được từ trong app; mẫu v3.4 đặt chúng ở chân trang cạnh số phiên bản. */}
        <View style={{ alignItems: 'center', marginTop: space[5], gap: space[1] }}>
          <ThemedText variant="caption" color="muted" align="center">
            {appVersionLabel}
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ThemedText
              variant="caption"
              color="secondary"
              accessibilityRole="link"
              onPress={openPrivacyPolicy}
              suppressHighlighting
              style={{ textDecorationLine: 'underline', paddingVertical: 14 }}
            >
              Chính sách bảo mật
            </ThemedText>
            <ThemedText variant="caption" color="faint" importantForAccessibility="no" accessibilityElementsHidden>
              ·
            </ThemedText>
            <ThemedText
              variant="caption"
              color="secondary"
              accessibilityRole="link"
              onPress={openTermsOfUse}
              suppressHighlighting
              style={{ textDecorationLine: 'underline', paddingVertical: 14 }}
            >
              Điều khoản sử dụng
            </ThemedText>
          </View>
        </View>
      </FadeIn>
    </Screen>
  )
}
