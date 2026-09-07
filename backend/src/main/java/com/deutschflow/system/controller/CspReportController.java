package com.deutschflow.system.controller;

import com.deutschflow.system.service.CspReportIngestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Điểm thu vi phạm CSP mà middleware web trỏ tới qua {@code report-uri} +
 * {@code Reporting-Endpoints} (xem frontend/src/middleware.ts). Nằm dưới {@code /api/public/**}
 * theo mẫu {@link SystemStatusController}: permitAll (SecurityConfig) VÀ
 * {@code PublicApiRateLimitFilter} 30 req/phút/IP có sẵn — không mở bề mặt cấu hình mới.
 *
 * <p>CORS: giao hàng của Reporting API ({@code application/reports+json}) có preflight —
 * mapping {@code /api/**} trong WebConfig trả lời sẵn; giao hàng report-uri cũ miễn CORS.
 *
 * <p>Hợp đồng trả về: 204 cho MỌI payload lọt cap kích thước (kể cả rác — service đếm
 * {@code _unparseable} rồi bỏ; 4xx/5xx với trình duyệt chỉ sinh noise chứ không ai đọc);
 * duy nhất body quá cỡ trả 413 để cắt sớm kẻ nhồi.
 */
@RestController
@RequiredArgsConstructor
public class CspReportController {

    /** Report CSP thật chỉ vài trăm byte; 16KB là trần hào phóng cho một batch Reporting API. */
    static final int MAX_BODY_BYTES = 16 * 1024;

    private final CspReportIngestService ingestService;

    @PostMapping(
            value = "/api/public/csp-report",
            consumes = {"application/csp-report", "application/reports+json", MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<Void> receive(@RequestBody byte[] body) {
        if (body.length > MAX_BODY_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
        }
        ingestService.ingest(body);
        return ResponseEntity.noContent().build();
    }
}
