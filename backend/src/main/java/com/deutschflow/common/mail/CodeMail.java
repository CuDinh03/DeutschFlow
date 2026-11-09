package com.deutschflow.common.mail;

/**
 * Nội dung các thư có mã của luồng tài khoản (mã xác minh đăng ký, mã đặt lại mật khẩu, thư "bạn đã có
 * tài khoản") theo mẫu "Thư B · Thẻ thương hiệu" owner chọn 08/11/2026: nền kem, thẻ trắng viền vàng
 * trên, mã tách 6 ô, khung cảnh báo "Không phải bạn?".
 *
 * <p>Mỗi thư có hai phần: chữ thuần và HTML ({@link TransactionalMail#sendRich}). HTML viết theo luật
 * thư điện tử, không theo luật web: bảng lồng nhau, style nội dòng, KHÔNG ảnh, KHÔNG SVG (Gmail/Outlook
 * bỏ SVG), KHÔNG phông web (đa số trình đọc thư không tải; Georgia/Arial là phương án dự phòng chắc chắn).
 * Không có dữ liệu người dùng nào lọt vào HTML: chỉ mã số, số phút và URL lấy từ cấu hình (vẫn được
 * escape cho chắc).
 *
 * <p>Mã nằm ở TIÊU ĐỀ để đọc ngay trên thông báo điện thoại (iOS còn tự gợi ý vào ô {@code one-time-code}).
 * Sáu ô số là sáu ô bảng: chép từ thư có thể dính dấu cách/tab giữa các số, ô nhập ở web/app đã lọc chỉ
 * giữ chữ số nên dán vẫn đúng.
 */
public final class CodeMail {

    private CodeMail() {}

    /**
     * {@code ADMIN_MFA_ENROLL}: mã email ở lần bật xác thực hai lớp đầu tiên của tài khoản quản trị
     * (09/11/2026) — chứng minh người đang đăng ký 2FA giữ hộp thư của tài khoản, không chỉ biết mật khẩu.
     */
    public enum Purpose { REGISTRATION, PASSWORD_RESET, ADMIN_MFA_ENROLL }

    /** Thư thông báo an ninh 2FA (không có mã): đã bật, đã dùng mã khôi phục, sắp hết mã, bị admin đặt lại. */
    public enum SecurityNotice { MFA_ENABLED, RECOVERY_CODE_USED, RECOVERY_CODES_LOW, MFA_RESET_BY_ADMIN }

    public record Rendered(String subject, String text, String html) {}

    // Bảng màu Galerie (frontend/src/styles/galerie.css) — viết thẳng vì thư không đọc được biến CSS.
    private static final String BG = "#FBFAF7";
    private static final String CARD = "#FFFFFF";
    private static final String INK = "#161513";
    private static final String BODY = "#3C3A36";
    private static final String MUTED = "#76716A";
    private static final String LINE = "#E7E3DA";
    private static final String YELLOW = "#FFCD00";
    private static final String GOLD = "#C79A00";
    private static final String RED = "#DA291C";
    private static final String WARN = "#9A5B12";
    private static final String LINK = "#27406B";
    private static final String SANS = "Arial,Helvetica,sans-serif";
    private static final String SERIF = "'Newsreader',Georgia,'Times New Roman',serif";

    public static Rendered code(Purpose purpose, String locale, String code, int ttlMinutes) {
        if (purpose == Purpose.ADMIN_MFA_ENROLL) {
            return mfaEnrollCode(locale, code, ttlMinutes);
        }
        boolean reg = purpose == Purpose.REGISTRATION;
        String lang = lang(locale);
        String subject = reg
                ? pick(lang, code + " là mã xác minh myDeutschFlow của bạn",
                        code + " is your myDeutschFlow verification code",
                        code + " ist dein myDeutschFlow-Bestätigungscode")
                : pick(lang, code + " là mã đặt lại mật khẩu myDeutschFlow",
                        code + " is your myDeutschFlow password reset code",
                        code + " ist dein Code zum Zurücksetzen des myDeutschFlow-Passworts");
        String cap = reg
                ? pick(lang, "Xác minh email", "Verify your email", "E-Mail bestätigen")
                : pick(lang, "Đặt lại mật khẩu", "Reset your password", "Passwort zurücksetzen");
        String heading = pick(lang, "Mã của bạn", "Your code", "Dein Code");
        String intro = reg
                ? pick(lang, "Nhập mã này trên trang đăng ký để tạo tài khoản myDeutschFlow.",
                        "Enter this code on the sign-up page to create your myDeutschFlow account.",
                        "Gib diesen Code auf der Registrierungsseite ein, um dein myDeutschFlow-Konto anzulegen.")
                : pick(lang, "Nhập mã này trên trang Quên mật khẩu để đặt mật khẩu mới.",
                        "Enter this code on the Forgot password page to set a new password.",
                        "Gib diesen Code auf der Seite „Passwort vergessen“ ein, um ein neues Passwort festzulegen.");
        String expiry = pick(lang, "Hết hạn sau " + ttlMinutes + " phút · chỉ dùng được một lần",
                "Expires in " + ttlMinutes + " minutes · single use",
                "Gültig für " + ttlMinutes + " Minuten · nur einmal verwendbar");
        String warnTitle = reg
                ? pick(lang, "Bạn không đăng ký?", "Didn't sign up?", "Nicht registriert?")
                : pick(lang, "Không phải bạn yêu cầu?", "Didn't request this?", "Nicht von dir angefordert?");
        String neverShare = pick(lang,
                "Đừng gửi mã cho bất kỳ ai, myDeutschFlow không bao giờ hỏi mã qua điện thoại hay tin nhắn.",
                "Never share this code. myDeutschFlow will never ask for it by phone or message.",
                "Gib den Code an niemanden weiter. myDeutschFlow fragt nie per Telefon oder Nachricht danach.");
        String warnBody = (reg
                ? pick(lang, "Bỏ qua thư này, sẽ không có tài khoản nào được tạo.",
                        "Ignore this email and no account will be created.",
                        "Ignoriere diese E-Mail, dann wird kein Konto angelegt.")
                : pick(lang, "Bỏ qua thư này, mật khẩu của bạn không đổi.",
                        "Ignore this email and your password stays the same.",
                        "Ignoriere diese E-Mail, dein Passwort bleibt unverändert."))
                + " " + neverShare;

        String text = cap.toUpperCase(java.util.Locale.ROOT) + "\n\n"
                + intro + "\n\n"
                + "    " + code + "\n\n"
                + expiry + "\n\n"
                + warnTitle + " " + warnBody + "\n\n"
                + "-- \n" + footer(lang) + "\n";

        String body = capHtml(cap)
                + headingHtml(heading)
                + paragraphHtml(intro, "0 0 24px")
                + digitsHtml(code)
                + "<p style=\"margin:0;font-family:" + SANS + ";font-size:13px;line-height:1.5;color:" + MUTED + ";\">"
                + esc(expiry) + "</p>";

        return new Rendered(subject, text, page(lang, subject, expiry, body, warnTitle, warnBody));
    }

    private static Rendered mfaEnrollCode(String locale, String code, int ttlMinutes) {
        String lang = lang(locale);
        String subject = pick(lang, code + " là mã bật xác thực hai lớp myDeutschFlow",
                code + " is your myDeutschFlow two-factor setup code",
                code + " ist dein myDeutschFlow-Code für die Zwei-Faktor-Einrichtung");
        String cap = pick(lang, "Xác thực hai lớp", "Two-factor authentication", "Zwei-Faktor-Authentifizierung");
        String heading = pick(lang, "Mã của bạn", "Your code", "Dein Code");
        String intro = pick(lang,
                "Nhập mã này trên trang đăng nhập để bắt đầu bật xác thực hai lớp cho tài khoản quản trị.",
                "Enter this code on the sign-in page to start setting up two-factor authentication for your admin account.",
                "Gib diesen Code auf der Anmeldeseite ein, um die Zwei-Faktor-Authentifizierung für dein Admin-Konto einzurichten.");
        String expiry = pick(lang, "Hết hạn sau " + ttlMinutes + " phút · chỉ dùng được một lần",
                "Expires in " + ttlMinutes + " minutes · single use",
                "Gültig für " + ttlMinutes + " Minuten · nur einmal verwendbar");
        String warnTitle = pick(lang, "Không phải bạn?", "Wasn't you?", "Warst du das nicht?");
        String warnBody = pick(lang,
                "Ai đó vừa đăng nhập đúng mật khẩu tài khoản quản trị của bạn. Đổi mật khẩu ngay và đừng gửi mã này cho bất kỳ ai.",
                "Someone just signed in with your admin password. Change your password now and never share this code.",
                "Jemand hat sich gerade mit deinem Admin-Passwort angemeldet. Ändere sofort dein Passwort und gib diesen Code an niemanden weiter.");
        String text = cap.toUpperCase(java.util.Locale.ROOT) + "\n\n"
                + intro + "\n\n"
                + "    " + code + "\n\n"
                + expiry + "\n\n"
                + warnTitle + " " + warnBody + "\n\n"
                + "-- \n" + footer(lang) + "\n";
        String body = capHtml(cap)
                + headingHtml(heading)
                + paragraphHtml(intro, "0 0 24px")
                + digitsHtml(code)
                + "<p style=\"margin:0;font-family:" + SANS + ";font-size:13px;line-height:1.5;color:" + MUTED + ";\">"
                + esc(expiry) + "</p>";
        return new Rendered(subject, text, page(lang, subject, expiry, body, warnTitle, warnBody));
    }

    /**
     * Thư thông báo an ninh của 2FA. {@code remaining} chỉ dùng cho {@link SecurityNotice#RECOVERY_CODE_USED}
     * và {@link SecurityNotice#RECOVERY_CODES_LOW}. Không có dữ liệu người dùng nào khác trong thư.
     */
    public static Rendered securityNotice(SecurityNotice kind, String locale, int remaining) {
        String lang = lang(locale);
        String cap = pick(lang, "Bảo mật tài khoản", "Account security", "Kontosicherheit");
        String subject;
        String heading;
        String intro;
        switch (kind) {
            case MFA_ENABLED -> {
                subject = pick(lang, "Đã bật xác thực hai lớp cho tài khoản myDeutschFlow",
                        "Two-factor authentication is now on for your myDeutschFlow account",
                        "Zwei-Faktor-Authentifizierung für dein myDeutschFlow-Konto ist aktiviert");
                heading = pick(lang, "Đã bật xác thực hai lớp", "Two-factor authentication is on",
                        "Zwei-Faktor-Authentifizierung ist aktiv");
                intro = pick(lang,
                        "Từ giờ mỗi lần đăng nhập cần thêm mã 6 số từ ứng dụng xác thực. Cất 10 mã khôi phục ở nơi an toàn.",
                        "From now on every sign-in also needs the 6-digit code from your authenticator app. Keep your 10 recovery codes somewhere safe.",
                        "Ab jetzt braucht jede Anmeldung zusätzlich den 6-stelligen Code aus deiner Authenticator-App. Bewahre deine 10 Wiederherstellungscodes sicher auf.");
            }
            case RECOVERY_CODE_USED -> {
                subject = pick(lang, "Một mã khôi phục 2FA vừa được dùng",
                        "A two-factor recovery code was just used",
                        "Ein Zwei-Faktor-Wiederherstellungscode wurde gerade verwendet");
                heading = pick(lang, "Đã dùng một mã khôi phục", "A recovery code was used",
                        "Ein Wiederherstellungscode wurde verwendet");
                intro = pick(lang,
                        "Tài khoản của bạn vừa đăng nhập bằng một mã khôi phục. Còn " + remaining + " mã chưa dùng.",
                        "Your account just signed in with a recovery code. " + remaining + " unused codes left.",
                        "Dein Konto hat sich gerade mit einem Wiederherstellungscode angemeldet. Noch " + remaining + " unbenutzte Codes.");
            }
            case RECOVERY_CODES_LOW -> {
                subject = pick(lang, "Sắp hết mã khôi phục 2FA",
                        "You are running out of two-factor recovery codes",
                        "Deine Zwei-Faktor-Wiederherstellungscodes gehen zur Neige");
                heading = pick(lang, "Sắp hết mã khôi phục", "Running out of recovery codes",
                        "Wiederherstellungscodes gehen zur Neige");
                intro = pick(lang,
                        "Chỉ còn " + remaining + " mã khôi phục. Vào Hồ sơ → Bảo mật để tạo bộ mã mới.",
                        "Only " + remaining + " recovery codes left. Go to Profile → Security to generate a new set.",
                        "Nur noch " + remaining + " Wiederherstellungscodes. Erzeuge unter Profil → Sicherheit neue Codes.");
            }
            default -> {
                subject = pick(lang, "Xác thực hai lớp của bạn đã được đặt lại",
                        "Your two-factor authentication was reset",
                        "Deine Zwei-Faktor-Authentifizierung wurde zurückgesetzt");
                heading = pick(lang, "2FA đã được đặt lại", "Two-factor was reset", "Zwei-Faktor zurückgesetzt");
                intro = pick(lang,
                        "Một quản trị viên khác đã đặt lại xác thực hai lớp của bạn và mọi phiên đăng nhập đã bị đóng. Lần đăng nhập tới bạn sẽ thiết lập lại 2FA.",
                        "Another administrator reset your two-factor authentication and all sessions were signed out. You will set up two-factor again at your next sign-in.",
                        "Ein anderer Administrator hat deine Zwei-Faktor-Authentifizierung zurückgesetzt und alle Sitzungen beendet. Bei der nächsten Anmeldung richtest du sie neu ein.");
            }
        }
        String warnTitle = pick(lang, "Không phải bạn?", "Wasn't you?", "Warst du das nicht?");
        String warnBody = pick(lang,
                "Đổi mật khẩu ngay và trả lời thư này để báo cho chúng tôi.",
                "Change your password now and reply to this email to let us know.",
                "Ändere sofort dein Passwort und antworte auf diese E-Mail, um uns Bescheid zu geben.");
        String text = cap.toUpperCase(java.util.Locale.ROOT) + "\n\n"
                + heading + "\n\n"
                + intro + "\n\n"
                + warnTitle + " " + warnBody + "\n\n"
                + "-- \n" + footer(lang) + "\n";
        String body = capHtml(cap) + headingHtml(heading) + paragraphHtml(intro, "0");
        return new Rendered(subject, text, page(lang, subject, intro, body, warnTitle, warnBody));
    }

    public static Rendered alreadyRegistered(String locale, String loginUrl, String forgotUrl) {
        String lang = lang(locale);
        String subject = pick(lang, "Bạn đã có tài khoản myDeutschFlow",
                "You already have a myDeutschFlow account", "Du hast bereits ein myDeutschFlow-Konto");
        String cap = pick(lang, "Đăng ký", "Sign-up", "Registrierung");
        String heading = pick(lang, "Email này đã có tài khoản",
                "This email already has an account", "Für diese E-Mail gibt es bereits ein Konto");
        String intro = pick(lang,
                "Có người vừa dùng địa chỉ email này để đăng ký myDeutschFlow. Bạn có thể đăng nhập, hoặc đặt lại mật khẩu nếu đã quên.",
                "Someone just tried to sign up for myDeutschFlow with this email address. You can log in, or reset your password if you have forgotten it.",
                "Jemand hat gerade versucht, sich mit dieser E-Mail-Adresse bei myDeutschFlow zu registrieren. Du kannst dich anmelden oder dein Passwort zurücksetzen, falls du es vergessen hast.");
        String login = pick(lang, "Đăng nhập", "Log in", "Anmelden");
        String forgot = pick(lang, "Quên mật khẩu", "Forgot password", "Passwort vergessen");
        String warnTitle = pick(lang, "Không phải bạn?", "Wasn't you?", "Warst du das nicht?");
        String warnBody = pick(lang, "Bỏ qua thư này. Tài khoản của bạn không thay đổi gì.",
                "Ignore this email. Nothing has changed in your account.",
                "Ignoriere diese E-Mail. An deinem Konto hat sich nichts geändert.");

        String text = cap.toUpperCase(java.util.Locale.ROOT) + "\n\n"
                + heading + "\n\n"
                + intro + "\n\n"
                + login + ": " + loginUrl + "\n"
                + forgot + ": " + forgotUrl + "\n\n"
                + warnTitle + " " + warnBody + "\n\n"
                + "-- \n" + footer(lang) + "\n";

        String body = capHtml(cap)
                + headingHtml(heading)
                + paragraphHtml(intro, "0 0 24px")
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\" style=\"margin:0 auto;\"><tr>"
                + "<td style=\"background:" + YELLOW + ";border:1px solid " + GOLD + ";\">"
                + "<a href=\"" + esc(loginUrl) + "\" style=\"display:inline-block;padding:13px 28px;font-family:" + SANS
                + ";font-size:15px;font-weight:bold;color:" + INK + ";text-decoration:none;\">" + esc(login) + "</a></td>"
                + "</tr></table>"
                + "<p style=\"margin:16px 0 0;font-family:" + SANS + ";font-size:14px;line-height:1.5;\">"
                + "<a href=\"" + esc(forgotUrl) + "\" style=\"color:" + LINK + ";\">" + esc(forgot) + "</a></p>";

        return new Rendered(subject, text, page(lang, subject, intro, body, warnTitle, warnBody));
    }

    /**
     * Thư báo "đội hỗ trợ vừa đặt lại mật khẩu của bạn" (đợt 2 admin, 09/11/2026).
     *
     * <p>⛔ Cố ý KHÔNG nhận lý do nội bộ hay danh tính admin làm tham số: thư rời hệ thống, nằm trong
     * hộp thư (có thể bị chuyển tiếp) — người nhận chỉ cần biết "có người đã đổi, lúc nào" để báo lại
     * nếu không phải họ yêu cầu.
     *
     * @param whenDisplay thời điểm đã render sẵn theo múi giờ của người nhận
     */
    public static Rendered passwordResetByAdmin(String locale, String whenDisplay, String forgotUrl) {
        String lang = lang(locale);
        String subject = pick(lang, "Mật khẩu myDeutschFlow của bạn vừa được đặt lại",
                "Your myDeutschFlow password was reset", "Dein myDeutschFlow-Passwort wurde zurückgesetzt");
        String cap = pick(lang, "Bảo mật tài khoản", "Account security", "Kontosicherheit");
        String heading = pick(lang, "Mật khẩu đã được đặt lại", "Your password was reset", "Passwort zurückgesetzt");
        String intro = pick(lang,
                "Mật khẩu của bạn vừa được đội hỗ trợ DeutschFlow đặt lại lúc " + whenDisplay
                        + ". Mọi phiên đăng nhập cũ đã bị đăng xuất.",
                "Your password was just reset by the DeutschFlow support team at " + whenDisplay
                        + ". All previous sessions have been signed out.",
                "Dein Passwort wurde soeben vom DeutschFlow-Supportteam zurückgesetzt (" + whenDisplay
                        + "). Alle bisherigen Sitzungen wurden abgemeldet.");
        String forgot = pick(lang, "Đặt lại mật khẩu của riêng bạn", "Set your own password", "Eigenes Passwort festlegen");
        String warnTitle = pick(lang, "Không phải bạn yêu cầu?", "Didn't ask for this?", "Hast du das nicht angefordert?");
        String warnBody = pick(lang, "Hãy liên hệ hỗ trợ ngay bằng cách trả lời thư này.",
                "Please contact support right away by replying to this email.",
                "Bitte wende dich sofort an den Support, indem du auf diese E-Mail antwortest.");

        String text = cap.toUpperCase(java.util.Locale.ROOT) + "\n\n"
                + heading + "\n\n"
                + intro + "\n\n"
                + forgot + ": " + forgotUrl + "\n\n"
                + warnTitle + " " + warnBody + "\n\n"
                + "-- \n" + footer(lang) + "\n";

        String body = capHtml(cap)
                + headingHtml(heading)
                + paragraphHtml(intro, "0 0 16px")
                + "<p style=\"margin:0;font-family:" + SANS + ";font-size:14px;line-height:1.5;\">"
                + "<a href=\"" + esc(forgotUrl) + "\" style=\"color:" + LINK + ";\">" + esc(forgot) + "</a></p>";

        return new Rendered(subject, text, page(lang, subject, intro, body, warnTitle, warnBody));
    }

    // ─── Khung chung ──────────────────────────────────────────────────────────

    private static String page(String lang, String title, String preheader, String body,
                               String warnTitle, String warnBody) {
        return "<!doctype html>\n<html lang=\"" + lang + "\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\">"
                + "<title>" + esc(title) + "</title></head>"
                + "<body style=\"margin:0;padding:0;background:" + BG + ";\">"
                // Dòng xem trước (hiện sau tiêu đề trong hộp thư), ẩn khi mở thư.
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:" + BG + ";\">" + esc(preheader) + "</div>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:" + BG + ";\">"
                + "<tr><td align=\"center\" style=\"padding:28px 12px;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;\">"
                + "<tr><td align=\"center\" style=\"padding:0 0 20px;\">" + wordmark() + "</td></tr>"
                + "<tr><td style=\"background:" + CARD + ";border:1px solid " + LINE + ";border-top:4px solid " + YELLOW + ";\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
                + "<tr><td align=\"center\" style=\"padding:32px 28px 28px;\">" + body + "</td></tr>"
                + "<tr><td style=\"padding:0 28px 26px;\">" + warning(warnTitle, warnBody) + "</td></tr>"
                + "</table></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:18px 12px 0;font-family:" + SANS + ";font-size:12px;line-height:1.6;color:" + MUTED + ";\">"
                + esc(footer(lang)) + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    /** Chữ "myDeutschFlow" bằng chữ thật (không ảnh): ô vàng nhỏ của dấu hiệu + "my" mảnh, "Deutsch" đậm, "Flow" đỏ. */
    private static String wordmark() {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>"
                + "<td style=\"width:10px;height:10px;background:" + YELLOW + ";font-size:0;line-height:0;\">&nbsp;</td>"
                + "<td style=\"padding-left:8px;font-family:" + SANS + ";font-size:17px;line-height:1;color:" + INK + ";\">"
                + "<span style=\"font-weight:normal;\">my</span><b>Deutsch</b><b style=\"color:" + RED + ";\">Flow</b></td>"
                + "</tr></table>";
    }

    private static String capHtml(String cap) {
        return "<p style=\"margin:0 0 10px;font-family:" + SANS + ";font-size:11px;font-weight:bold;letter-spacing:1px;"
                + "text-transform:uppercase;color:" + MUTED + ";\">" + esc(cap) + "</p>";
    }

    private static String headingHtml(String heading) {
        return "<h1 style=\"margin:0 0 14px;font-family:" + SERIF + ";font-size:30px;font-weight:normal;line-height:1.15;color:"
                + INK + ";\">" + esc(heading) + "</h1>";
    }

    private static String paragraphHtml(String text, String margin) {
        return "<p style=\"margin:" + margin + ";font-family:" + SANS + ";font-size:15px;line-height:1.65;color:" + BODY + ";\">"
                + esc(text) + "</p>";
    }

    /** Sáu ô số, mỗi ô viền dưới vàng. 6×44 + 5×6 = 294px: vừa màn 320px. */
    private static String digitsHtml(String code) {
        StringBuilder sb = new StringBuilder("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\" style=\"margin:0 auto 16px;\"><tr>");
        for (int i = 0; i < code.length(); i++) {
            if (i > 0) sb.append("<td style=\"width:6px;font-size:0;line-height:0;\">&nbsp;</td>");
            sb.append("<td align=\"center\" valign=\"middle\" style=\"width:44px;height:54px;border:1px solid ").append(LINE)
                    .append(";border-bottom:3px solid ").append(YELLOW).append(";background:").append(CARD)
                    .append(";font-family:").append(SANS).append(";font-size:28px;font-weight:bold;color:").append(INK)
                    .append(";\">").append(esc(String.valueOf(code.charAt(i)))).append("</td>");
        }
        return sb.append("</tr></table>").toString();
    }

    private static String warning(String title, String body) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-top:1px solid " + LINE + ";\"><tr>"
                + "<td valign=\"top\" style=\"padding:18px 10px 0 0;width:14px;font-family:" + SANS + ";font-size:16px;font-weight:bold;color:" + WARN + ";\">!</td>"
                + "<td style=\"padding:18px 0 0;font-family:" + SANS + ";font-size:13.5px;line-height:1.65;color:" + BODY + ";\">"
                + "<b style=\"color:" + INK + ";\">" + esc(title) + "</b> " + esc(body) + "</td></tr></table>";
    }

    private static String footer(String lang) {
        return pick(lang, "Thư tự động từ myDeutschFlow · Cần hỗ trợ? Trả lời thư này.",
                "Automated email from myDeutschFlow · Need help? Just reply to this email.",
                "Automatische E-Mail von myDeutschFlow · Fragen? Antworte einfach auf diese E-Mail.");
    }

    // ─── Tiện ích ─────────────────────────────────────────────────────────────

    private static String lang(String locale) {
        String l = locale == null ? "vi" : locale.trim().toLowerCase(java.util.Locale.ROOT);
        return "en".equals(l) || "de".equals(l) ? l : "vi";
    }

    private static String pick(String lang, String vi, String en, String de) {
        return switch (lang) {
            case "en" -> en;
            case "de" -> de;
            default -> vi;
        };
    }

    static String esc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }
}
