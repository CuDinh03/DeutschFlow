package com.deutschflow.marketing.controller;

import com.deutschflow.common.security.ClientIpResolver;
import com.deutschflow.marketing.dto.FreeGradeRequest;
import com.deutschflow.marketing.dto.FreeGradeResponse;
import com.deutschflow.marketing.service.LeadMagnetService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lead magnet public (không auth): "AI chấm thử 1 bài Schreiben B1 miễn phí" (checklist C8).
 *
 * <p>Nằm dưới {@code /api/public/**} (đã permitAll trong SecurityConfig). Chống lạm dụng do
 * {@link LeadMagnetService} đảm nhiệm (honeypot + giới hạn độ dài + rate-limit IP/global).
 */
@RestController
@RequestMapping("/api/public/free-grade")
@RequiredArgsConstructor
public class PublicLeadMagnetController {

    private final LeadMagnetService leadMagnetService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping
    public FreeGradeResponse gradeFree(@RequestBody FreeGradeRequest request,
                                       HttpServletRequest httpRequest) {
        return leadMagnetService.gradeFree(request, clientIpResolver.resolve(httpRequest));
    }
}
