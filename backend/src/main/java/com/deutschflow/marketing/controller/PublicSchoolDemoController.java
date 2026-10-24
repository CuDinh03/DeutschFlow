package com.deutschflow.marketing.controller;

import com.deutschflow.common.security.ClientIpResolver;
import com.deutschflow.marketing.dto.SchoolDemoRequestPayload;
import com.deutschflow.marketing.service.SchoolDemoRequestService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Form "Đặt lịch demo 20 phút" của trang trung tâm ({@code /trung-tam/}, {@code /en/schools/}) — đợt 3a.
 *
 * <p>Nằm dưới {@code /api/public/**} (permitAll + {@code PublicApiRateLimitFilter}). Chống lạm dụng
 * thêm ở {@link SchoolDemoRequestService}. Trả 201 với thân tối thiểu: không vọng lại dữ liệu đã gửi.
 */
@RestController
@RequestMapping("/api/public/school-demo-requests")
@RequiredArgsConstructor
public class PublicSchoolDemoController {

    private final SchoolDemoRequestService schoolDemoRequestService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> submit(@RequestBody SchoolDemoRequestPayload request, HttpServletRequest httpRequest) {
        schoolDemoRequestService.submit(request, clientIpResolver.resolve(httpRequest));
        return Map.of("received", true);
    }
}
