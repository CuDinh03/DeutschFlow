// Màn "Chứng nhận" (đợt 4A A+B+E): giấy hoàn thành khoá học do trung tâm cấp cho học viên.
//
// Vào từ hai lối: hàng trong Hồ sơ, và chạm thông báo CERTIFICATE_ISSUED (lib/notificationRoute.ts).
// Back về Hồ sơ theo PARENT_OF — Tabs (student) không có stack nên router.back() sẽ rơi về Heute.
import { useCallback } from 'react'
import { Pressable, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { format } from 'date-fns'
import {
  Screen,
  AppHeader,
  Card,
  EmptyState,
  ErrorState,
  FadeIn,
  Pill,
  Skeleton,
  ThemedText,
  useTabBarClearance,
} from '@/components/ui'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { useBackTo } from '@/hooks/useBackTo'
import { fetchMyCertificates, openCertificate, type StudentCertificate } from '@/lib/certificatesApi'
import { PARENT_OF } from '@/lib/screenParents'
import { space } from '@/lib/theme'

function CertificateCard({ cert }: { cert: StudentCertificate }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Mở chứng nhận ${cert.cefrLevel}`}
      onPress={() => openCertificate(cert.verifyToken)}
    >
      <Card padded bordered style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <ThemedText variant="titleLg" style={{ flex: 1 }}>
            Hoàn thành khoá học {cert.cefrLevel}
          </ThemedText>
          <Pill
            label={cert.active ? 'Còn hiệu lực' : 'Đã thu hồi'}
            tone={cert.active ? 'success' : 'danger'}
          />
        </View>
        <ThemedText variant="caption" color="secondary">
          {cert.orgName ?? 'DeutschFlow'} · Cấp ngày {format(new Date(cert.issuedAt), 'dd/MM/yyyy')}
        </ThemedText>
        <ThemedText variant="caption" color="muted">
          {cert.certificateCode}
        </ThemedText>
      </Card>
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
    <Screen scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh} contentStyle={{ paddingBottom: tabClearance }}>
      <AppHeader title="Chứng nhận" onBack={goBack} />

      <View style={{ paddingHorizontal: space[5], gap: space[4] }}>
        {isLoading ? (
          <>
            <Skeleton height={96} radius="xl" />
            <Skeleton height={96} radius="xl" />
          </>
        ) : isError ? (
          <ErrorState
            title="Không tải được chứng nhận"
            message="Kiểm tra kết nối rồi thử lại."
            onRetry={() => void refetch()}
          />
        ) : certificates.length === 0 ? (
          <EmptyState
            glyph="thinoi"
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
