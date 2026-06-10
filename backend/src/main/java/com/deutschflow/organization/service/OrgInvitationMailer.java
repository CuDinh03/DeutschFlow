package com.deutschflow.organization.service;

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
            // Reuse the existing CORS origin (app.cors.allowed-origins) as the web base URL;
            // fall back to WEB_URL env, then localhost.
            @Value("${app.cors.allowed-origins:${WEB_URL:http://localhost:3000}}") String webUrl,
            @Value("${spring.mail.host:}") String mailHost) {
        this.mailSender = mailSender;
        // allowed-origins may be a comma-separated list; the first origin is the canonical web URL.
        this.webUrl = stripTrailingSlash(firstOrigin(webUrl));
        this.mailEnabled = mailHost != null && !mailHost.isBlank();
    }

    /**
     * Sends the invite email with an accept link {@code <WEB_URL>/org/accept?token=<token>}.
     * Never throws — logs a warning on any failure (or when mail is disabled) so invite
     * creation is not blocked during pilot.
     */
    public void sendInvite(String to, String orgName, String role, String token) {
        String acceptLink = webUrl + "/org/accept?token=" + token;

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
