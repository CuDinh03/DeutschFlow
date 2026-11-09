package com.deutschflow.common.controller;

import com.deutschflow.common.security.AuthTokenAttributes;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.security.SseTicketService;
import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.common.security.support.SupportSessionReadOnlyException;
import com.deutschflow.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Issues short-lived, single-use SSE tickets (S15) so EventSource connections don't need the access
 * token in the URL. Requires a normal Bearer-authenticated request; the ticket is bound to the
 * caller and consumed by {@link com.deutschflow.common.security.JwtAuthFilter} on connect.
 */
@RestController
@RequestMapping("/api/sse")
@RequiredArgsConstructor
public class SseTicketController {

    private final SseTicketService sseTicketService;

    /**
     * POST /api/sse/ticket → { "ticket": "...", "expiresInSeconds": 60 }
     *
     * <p>Ticket chỉ mở được GET tới endpoint SSE trong
     * {@link com.deutschflow.common.security.SseTicketEndpoints}.
     *
     * <p><b>Phiên hỗ trợ chỉ-đọc:</b> ticket mang subject trơn nên sẽ đánh mất loại token gốc — một ticket phát
     * cho token {@code typ=support} sẽ mở luồng SSE như CHÍNH người dùng đích, ngoài mọi giới hạn của phiên hỗ
     * trợ. Vì vậy token support KHÔNG BAO GIỜ được phát ticket (403 {@code SUPPORT_SESSION_READ_ONLY}).
     * {@code SupportSessionReadOnlyFilter} đã chặn {@code /api/sse/**} cho phiên hỗ trợ; kiểm ở đây là lớp thứ hai.
     */
    @PostMapping("/ticket")
    public Map<String, Object> issueTicket(@AuthenticationPrincipal User user, HttpServletRequest request) {
        if (JwtService.TYP_SUPPORT.equals(request.getAttribute(AuthTokenAttributes.TOKEN_TYPE))
                || request.getAttribute(SupportSessionContext.REQUEST_ATTRIBUTE) != null) {
            throw new SupportSessionReadOnlyException("Phiên hỗ trợ không mở được luồng SSE.");
        }
        String ticket = sseTicketService.issue(user.getEmail());
        return Map.of("ticket", ticket, "expiresInSeconds", sseTicketService.ttlSeconds());
    }
}
