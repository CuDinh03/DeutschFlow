package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService;
import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Van xả của H-3 reserve-then-reconcile: cuối MỌI request, suất giữ chỗ pool org chưa được charge
 * tiêu thụ ({@link OrgReservationHolder}) sẽ được hoàn trả — phủ các đường chết giữa chừng mà không
 * cần call-site nào tự dọn:
 * <ul>
 *   <li>LLM ném exception sau khi gate đã giữ chỗ.</li>
 *   <li>Gate pass nhưng việc charge chạy ở thread khác (job async / SSE executor) — job sẽ charge
 *       đủ số thật nên suất ở thread request phải trả lại, nếu không pool bị giữ ảo.</li>
 * </ul>
 * Đường sync bình thường (charge cùng thread) đã {@code take()} suất trước khi tới đây → no-op.
 *
 * <p>{@code finally} + {@code ThreadLocal.remove()} bảo đảm không rò rỉ giữa các request dùng chung
 * thread-pool.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrgReservationRefundFilter extends OncePerRequestFilter {

    private final OrgQuotaService orgQuotaService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            OrgReservation leftover = OrgReservationHolder.take();
            if (leftover != null && leftover.metered()) {
                try {
                    orgQuotaService.refund(leftover);
                } catch (Exception e) {
                    // Không được làm hỏng response vì bước dọn; pool lệch tối đa 1 suất ước lượng
                    // và tự hết khi sang kỳ tháng mới.
                    log.error("[OrgPool][H-3] Hoàn trả reservation thất bại: orgId={} tokens={}",
                            leftover.orgId(), leftover.reservedTokens(), e);
                }
            }
        }
    }
}
