// Màn "Chứng nhận" (đợt 4A A+B+E): giấy hoàn thành khoá học do trung tâm cấp cho học viên.
//
// Vào từ hai lối: hàng trong Hồ sơ, và chạm thông báo CERTIFICATE_ISSUED (lib/notificationRoute.ts).
// Back về Hồ sơ theo PARENT_OF — Tabs (student) không có stack nên router.back() sẽ rơi về Heute.
//
// Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `certs`): mỗi giấy là một tờ có khung kép, logo, nhãn
// "Zertifikat", trạng thái góc phải và nút "Mở chứng nhận".
import { useCallback } from 'react'
import { Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { format } from 'date-fns'
import {
  Screen,
  BrandMark,
  EmptyState,
  ErrorState,
  FadeIn,
  Skeleton,
  ThemedText,
  useTabBarClearance,
} from '@/components/ui'
import { Badge, Eyebrow, PageTitle, SubHeader } from '@/components/me/MeParts'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { useBackTo } from '@/hooks/useBackTo'
import { fetchMyCertificates, openCertificate, type StudentCertificate } from '@/lib/certificatesApi'
import { PARENT_OF } from '@/lib/screenParents'
import { radius, space, themeShadowStyle, useTheme } from '@/lib/theme'

function CertificateCard({ cert }: { cert: StudentCertificate }) {
  const theme = useTheme()
  const c = theme.colors
  return (
    // Khung kép như tờ giấy (`.cert` của mẫu): viền mực ngoài, viền mảnh lùi vào 5pt.
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Mở chứng nhận ${cert.cefrLevel}`}
      onPress={() => openCertificate(cert.verifyToken)}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: c.inkSurface,
        backgroundColor: c.surface,
        padding: 5,
        ...themeShadowStyle(theme.shadow.card),
      })}
    >
      <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, padding: space[4], paddingTop: space[5], gap: space[1] }}>
        <View style={{ position: 'absolute', top: space[3], right: space[3] }}>
          <Badge label={cert.active ? 'Còn hiệu lực' : 'Đã thu hồi'} tone={cert.active ? 'success' : 'danger'} />
        </View>
        <BrandMark size={34} />
        <Eyebrow style={{ marginTop: space[3] }}>Zertifikat · Chứng nhận hoàn thành</Eyebrow>
        <ThemedText variant="titleLg" style={{ fontSize: 24, lineHeight: 30, marginTop: space[1] }}>
          Hoàn thành khoá học {cert.cefrLevel}
        </ThemedText>
        <ThemedText variant="caption" color="secondary">
          {cert.orgName ?? 'DeutschFlow'} · Cấp ngày {format(new Date(cert.issuedAt), 'dd/MM/yyyy')}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {cert.certificateCode}
        </ThemedText>
        {/* Hình nút (`.btn.o.sm`); cả tờ giấy là vùng bấm như trước Đợt 6C. */}
        <View
          style={{
            marginTop: space[3],
            alignSelf: 'flex-start',
            height: 40,
            paddingHorizontal: space[4],
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: c.borderStrong,
            backgroundColor: c.surface,
            justifyContent: 'center',
          }}
        >
          <ThemedText variant="bodyStrong">Mở chứng nhận</ThemedText>
        </View>
      </View>
    </Pressable>
  )
}

export default function CertificatesScreen() {
  const goBack = useBackTo(PARENT_OF.certificates)
  const tabClearance = useTabBarClearance()

  const { data: certificates = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['student-certificates'],
    queryFn: fetchMyCertificates,
    staleTime: 60_000,
  })
  const pull = usePullRefresh(refetch)

  // Tab ẩn giữ màn cũ sống: chạm thông báo giấy mới vẫn phải thấy giấy đó.
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  return (
    <Screen
      scroll
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: tabClearance }}
    >
      <SubHeader onBack={goBack} />
      <PageTitle title="Chứng nhận" sub="Do trung tâm cấp khi hoàn thành khoá học." style={{ marginTop: space[4] }} />

      <View style={{ gap: space[4], marginTop: space[4] }}>
        {isLoading ? (
          <>
            <Skeleton height={180} radius="lg" />
            <Skeleton height={180} radius="lg" />
          </>
        ) : isError ? (
          <ErrorState
            title="Không tải được chứng nhận"
            message="Kiểm tra kết nối rồi thử lại."
            onRetry={() => void refetch()}
          />
        ) : certificates.length === 0 ? (
          <EmptyState
            glyph="hoanthanh"
            title="Chưa có chứng nhận nào"
            message="Khi trung tâm cấp chứng nhận hoàn thành khoá học, giấy sẽ hiện ở đây."
          />
        ) : (
          <>
            <ThemedText variant="caption" color="muted">
              Chạm vào giấy để mở và chia sẻ link xác thực. Đây là chứng nhận hoàn thành khoá học, không phải chứng chỉ ngôn ngữ.
            </ThemedText>
            {certificates.map((cert, i) => (
              <FadeIn key={cert.verifyToken} delay={i * 60}>
                <CertificateCard cert={cert} />
              </FadeIn>
            ))}
          </>
        )}
      </View>
    </Screen>
  )
}
