package com.deutschflow.organization.service;

import com.deutschflow.common.quota.QuotaExceededException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Hard-cap pool token cấp-org cho các tính năng AI ĐẮT không đi qua
 * {@code QuotaService.assertAllowed} (PPTX, chấm bài) — gọi đồng bộ tại controller
 * TRƯỚC khi khởi chạy job để giáo viên nhận phản hồi 429 ngay thay vì lỗi async im lặng.
 *
 * <p>Giáo viên B2C (không thuộc org) và org chưa cấu hình pool ({@code monthly_token_pool <= 0})
 * luôn được cho qua — B2C không đổi. Token tiêu thụ của tính năng được ghi ledger dưới chính
 * {@code userId} này nên việc kiểm tra theo org của user là nhất quán với cách tính usage.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrgPoolGuard {

    private final OrgQuotaService orgQuotaService;

    /**
     * Ném {@link QuotaExceededException} (→ HTTP 429) khi org của {@code userId} sẽ vượt
     * pool token tháng này nếu nạp thêm {@code estimatedTokens}. No-op khi user null,
     * không thuộc org, hoặc org chưa cấu hình pool.
     */
    public void assertOrgPoolAvailable(Long userId, long estimatedTokens) {
        if (userId == null) {
            return;
        }
        if (orgQuotaService.wouldExceedOrgPool(userId, estimatedTokens)) {
            log.warn("Org token pool exhausted — blocking expensive AI request for userId={}", userId);
            throw new QuotaExceededException(
                    "Tổ chức đã dùng hết ngân sách token AI tháng này. Vui lòng liên hệ quản trị nền tảng để nâng hạn mức.",
                    null);
        }
    }
}
