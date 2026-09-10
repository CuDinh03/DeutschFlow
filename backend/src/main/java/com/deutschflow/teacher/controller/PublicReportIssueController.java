package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ReportIssueDtos.PublicReportIssueDto;
import com.deutschflow.teacher.service.ReportIssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phụ huynh mở link phiếu (R1/R9) — dưới {@code /api/public/**} (permitAll), token trong URL là bí mật
 * duy nhất. FAIL-CLOSED ba lớp:
 * <ul>
 *   <li>{@code PublicApiRateLimitFilter}: prefix này dùng ngân sách riêng và trả 503 khi Redis chết
 *       (khác phần còn lại của cây public vốn fail-open) — chống dò token;</li>
 *   <li>service: sai / hết hạn / thu hồi ⇒ CÙNG MỘT 404, không oracle; token sai hình dạng không chạm DB;</li>
 *   <li>vết {@code report.viewed} + lượt xem + payload trong MỘT giao dịch — không ghi được vết thì không
 *       trả nội dung.</li>
 * </ul>
 * Không có endpoint PDF công khai (§5 mặc định: phụ huynh chỉ In; PDF do trung tâm tải và gửi).
 * {@code no-store} + {@code X-Robots-Tag: noindex}: điểm số của một trẻ không nằm trong cache hay chỉ mục nào.
 */
@RestController
@RequestMapping("/api/public/report-issues")
@RequiredArgsConstructor
public class PublicReportIssueController {

    private final ReportIssueService reportIssueService;

    @GetMapping("/{token}")
    public ResponseEntity<PublicReportIssueDto> open(@PathVariable String token) {
        PublicReportIssueDto dto = reportIssueService.openByToken(token);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Robots-Tag", "noindex, nofollow")
                .body(dto);
    }
}
