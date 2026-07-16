package com.deutschflow.organization.service;

import com.deutschflow.common.WebRoutes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends organization-invitation emails. Mirrors
 * {@link com.deutschflow.user.service.PasswordResetService} for the
 * {@link JavaMailSender} + {@link SimpleMailMessage} pattern.
 *
 * <p>Pilot fallback: when SMTP is not configured ({@code spring.mail.host} blank)
 * we do NOT throw — the invite row is already persisted, so we log the accept link
 * for the admin to forward manually and continue.
 */
@Slf4j
@Service
public class OrgInvitationMailer {

    private final JavaMailSender mailSender;
    private final String webUrl;
    private final boolean mailEnabled;

    public OrgInvitationMailer(
            JavaMailSender mailSender,
            // Base URL của web — khoá RIÊNG `app.web-url` (xem application.yml, nó tự rơi về
            // CORS_ALLOWED_ORIGINS khi không đặt WEB_URL).
            //
            // Vì sao phải có khoá riêng: trước đây link mời trong email được dựng từ origin ĐẦU TIÊN
            // của danh sách CORS. Nghĩa là đổi THỨ TỰ các origin trong CORS_ALLOWED_ORIGINS — một thay
            // đổi ai cũng tưởng là vô hại — sẽ lặng lẽ đổi domain trong mọi email mời gửi ra sau đó.
            @Value("${app.web-url:http://localhost:3000}") String webUrl,
            @Value("${spring.mail.host:}") String mailHost) {
        this.mailSender = mailSender;
        // allowed-origins may be a comma-separated list; the first origin is the canonical web URL.
        this.webUrl = stripTrailingSlash(firstOrigin(webUrl));
        this.mailEnabled = mailHost != null && !mailHost.isBlank();
    }

    /**
     * Sends the invite email with an accept link {@code <WEB_URL>/v2/org/accept?token=<token>}.
     * Never throws — logs a warning on any failure (or when mail is disabled) so invite
     * creation is not blocked during pilot.
     *
     * ⚠️ THỨ TỰ DEPLOY: `/v2/org/accept` chỉ tồn tại từ đợt 1 của kế hoạch xoá cây v1
     * (plans/2026-07-14-xoa-sach-v1-web.md). KHÔNG deploy backend này trước khi frontend đợt 1 lên
     * prod — nếu không, mọi email mời gửi ra sẽ trỏ vào một route chưa tồn tại.
     *
     * ⚠️ Email ĐÃ GỬI là BẤT BIẾN: những lời mời phát trước thay đổi này vẫn trỏ `/org/accept`.
     * Vì vậy redirect `/org/accept` → `/v2/org/accept` (giữ nguyên `?token=`) phải sống VĨNH VIỄN
     * ở tầng web, kể cả sau khi cây v1 bị xoá.
     */
    public void sendInvite(String to, String orgName, String role, String token) {
        String acceptLink = webUrl + WebRoutes.ORG_ACCEPT_INVITE + "?token=" + token;

        if (!mailEnabled) {
            // Do NOT log acceptLink — it carries the invite token (a bearer secret). Configure SMTP,
            // or surface the link to the authorized admin via the API (follow-up), not via logs.
            log.warn("[OrgInvite] mail host not configured — invite for {} (role={}, org={}) saved but NOT emailed",
                    to, role, orgName);
            return;
        }

        try {
            var msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject("DeutschFlow — Lời mời tham gia " + orgName);
            msg.setText(
                    "Xin chào,\n\n" +
                    "Bạn được mời tham gia tổ chức \"" + orgName + "\" trên DeutschFlow với vai trò "
                            + role + ".\n\n" +
                    "Nhấn vào liên kết dưới đây để nhận lời mời và thiết lập tài khoản:\n\n" +
                    "    " + acceptLink + "\n\n" +
                    "Nếu bạn không mong đợi email này, hãy bỏ qua nó.\n\n" +
                    "DeutschFlow Team"
            );
            mailSender.send(msg);
            log.info("[OrgInvite] invite email sent to {} (role={}, org={})", to, role, orgName);
        } catch (Exception e) {
            // Do not block invite creation; do NOT log the token-bearing link.
            log.warn("[OrgInvite] failed to send invite email to {} (role={}): {}",
                    to, role, e.getMessage());
        }
    }

    private static String firstOrigin(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:3000";
        }
        int comma = value.indexOf(',');
        return (comma >= 0 ? value.substring(0, comma) : value).trim();
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
