// Màn "Phiếu gửi gia đình" (R6/PR-R4): học viên xem ĐÚNG bản phiếu đánh giá mà giáo viên đã phát
// hành cho gia đình mình.
//
// Vào từ hai lối: hàng trong Hồ sơ, và chạm thông báo REPORT_ISSUED (lib/notificationRoute.ts).
// Back về Hồ sơ theo PARENT_OF — Tabs (student) không có stack nên router.back() sẽ rơi về Heute.
//
// Không có nút mở link công khai: link `/phieu/{token}` là thứ gửi cho GIA ĐÌNH, còn ở đây học viên
// đã xem được trọn nội dung ngay trong ứng dụng. Thêm nút mở link chỉ tạo thêm một đường phát tán
// token ra ngoài mà không cho em ấy biết thêm điều gì.
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import {
  Screen,
  AppHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  ThemedText,
  FadeIn,
  useTabBarClearance,
} from '@/components/ui'
import { ReportIssueCard } from '@/components/report/ReportIssueCard'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { useBackTo } from '@/hooks/useBackTo'
import { PARENT_OF } from '@/lib/screenParents'
import { space } from '@/lib/theme'
import { fetchMyReportIssues } from '@/lib/reportIssuesApi'

export default function ReportIssuesScreen() {
  const goBack = useBackTo(PARENT_OF['report-issues'])
  const tabClearance = useTabBarClearance()

  const { data: entries = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['student-report-issues'],
    queryFn: fetchMyReportIssues,
    staleTime: 60_000,
  })
  const pull = usePullRefresh(refetch)

  return (
    <Screen scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh} contentStyle={{ paddingBottom: tabClearance }}>
      <AppHeader title="Phiếu gửi gia đình" onBack={goBack} />

      <View style={{ paddingHorizontal: space[5], gap: space[4] }}>
        {isLoading ? (
          <>
            <Skeleton height={120} radius="xl" />
            <Skeleton height={120} radius="xl" />
          </>
        ) : isError ? (
          <ErrorState
            title="Không tải được phiếu"
            message="Kiểm tra kết nối rồi thử lại."
            onRetry={() => void refetch()}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            glyph="thongke"
            title="Chưa có phiếu nào"
            message="Khi giáo viên phát hành phiếu đánh giá gửi gia đình, phiếu sẽ hiện ở đây — đúng bản mà gia đình nhận được."
          />
        ) : (
          <>
            <ThemedText variant="caption" color="muted">
              Đây là bản đã gửi gia đình, chụp lại lúc phát hành — điểm thay đổi sau đó không làm đổi phiếu cũ.
            </ThemedText>
            {entries.map((entry, i) => (
              <FadeIn key={entry.issue.id} delay={i * 60}>
                <ReportIssueCard entry={entry} />
              </FadeIn>
            ))}
          </>
        )}
      </View>
    </Screen>
  )
}
