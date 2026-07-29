package com.deutschflow.organization.service;

import com.deutschflow.common.quota.OrgReservationHolder;
import com.deutschflow.common.quota.QuotaExceededException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Hard-cap pool token cấp-org cho các tính năng AI ĐẮT không đi qua
 * {@code QuotaService.assertAllowed} (PPTX, chấm bài) — gọi đồng bộ tại controller
 * TRƯỚC khi khởi chạy job để giáo viên nhận phản hồi 429 ngay thay vì lỗi async im lặng.
 *
 * <p>Giáo viên B2C (không thuộc org) và HỌC VIÊN org (kênh ví cá nhân — 2 kênh 26/07) luôn được
 * cho qua; staff org đi theo bảng V237 (unlimited / metered / pool=0 fail-safe cap). Token tiêu thụ
 * của tính năng được ghi ledger dưới chính {@code userId} này nên việc kiểm tra theo org của user
 * là nhất quán với cách tính usage.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrgPoolGuard {

    private final OrgQuotaService orgQuotaService;

    /**
     * Ném {@link QuotaExceededException} (→ HTTP 429) khi org của {@code userId} sẽ vượt
     * pool token tháng này nếu nạp thêm {@code estimatedTokens}. No-op khi user null,
     * không thuộc org, hoặc org unlimited.
     *
     * <p>H-3: gate giờ GIỮ CHỖ atomic ({@code tryReserve}) thay vì chỉ kiểm tra. Với tính năng
     * charge ĐỒNG BỘ trong cùng request, charge sẽ tiêu thụ suất và ghi delta. Với tính năng
     * async (job PPTX/chấm bài): job charge đủ số thật ở worker-thread, còn suất giữ ở thread
     * request được {@code OrgReservationRefundFilter} hoàn trả khi request kết thúc — net không
     * double-count; cửa sổ race thu về khoảng thời gian controller (ms) thay vì cả vòng đời job.
     */
    public void assertOrgPoolAvailable(Long userId, long estimatedTokens) {
        if (userId == null) {
            return;
        }
        var reservation = orgQuotaService.tryReserve(userId, estimatedTokens).orElseThrow(() -> {
            // Empty chỉ xảy ra cho STAFF org (B2C/STUDENT luôn được NONE — 2 kênh 26/07) nên
            // membership chắc chắn tồn tại; resolve lại ở đường lỗi để tách mã "đã cạn" vs
            // "chưa cấu hình" (client hiển thị đúng trạng thái, không CTA nâng cấp — P0-02).
            log.warn("Org token pool blocked — expensive AI request denied for userId={}", userId);
            var membership = orgQuotaService.resolveActiveMembership(userId);
            boolean configured = membership != null && orgQuotaService.isPoolConfigured(membership.orgId());
            return configured
                    ? QuotaExceededException.orgBudgetExhausted(null)
                    : QuotaExceededException.orgBudgetNotConfigured(null);
        });
        if (reservation.metered()) {
            OrgReservationHolder.replace(reservation, orgQuotaService::refund);
        }
    }
}
