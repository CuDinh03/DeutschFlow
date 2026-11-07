package com.deutschflow.common.mail;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Lối DUY NHẤT để tạo và gửi thư giao dịch (plan hòm thư 05/11, giai đoạn 3).
 *
 * <p><b>Vì sao có lớp này.</b> PR #654 vá thiếu {@code setFrom()} cho 3 mailer, rồi 2 mailer ra đời sau
 * đó ({@code AccountActivationMailer}, {@code OnboardingLifecycleMailer}) lại quên đúng dòng ấy. Gmail
 * SMTP che lỗi vì tự viết lại {@code From}; SES xác thực một chuỗi {@code AKIA…} nên thư thiếu
 * {@code From} bị từ chối thẳng — lỗi chỉ nổ ở production, sau khi đổi {@code MAIL_HOST}. Mọi thư tạo
 * qua {@link #newMessage()} đều đã gắn sẵn {@code From} + {@code Reply-To} từ khối {@code app.mail},
 * nên mailer mới không thể quên nữa. {@code MailSenderIdentityArchTest} chặn ai đó gọi
 * {@code new SimpleMailMessage()} ở chỗ khác.
 *
 * <p><b>Đếm thư.</b> {@link #send} đếm {@code mail.send{mailer, outcome=ok|fail}} — trước đây thư hỏng
 * chỉ để lại một dòng log warn và mail chết im lặng.
 *
 * <p>{@link #send} <b>ném lại</b> lỗi gửi: mỗi mailer tự quyết nuốt (thư là kênh phụ) hay đẩy lên
 * (mã PIN đăng ký — email là lối vào duy nhất).
 */
@Component
public class TransactionalMail {

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String from;
    private final String replyTo;
    private final MeterRegistry meters;

    public TransactionalMail(
            JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String mailHost,
            // Bắt buộc nằm trong identity đã verify ở nhà cung cấp gửi thư — xem khối `app.mail`.
            @Value("${app.mail.from}") String from,
            @Value("${app.mail.reply-to}") String replyTo,
            MeterRegistry meters) {
        this.mailSender = mailSender;
        this.enabled = mailHost != null && !mailHost.isBlank();
        this.from = from;
        this.replyTo = replyTo;
        this.meters = meters;
    }

    /** {@code spring.mail.host} rỗng = chưa cấu hình SMTP; mailer tự quyết bỏ qua hay báo lỗi. */
    public boolean isEnabled() {
        return enabled;
    }

    /** Thư trống đã gắn {@code From} + {@code Reply-To}. Mailer có thể ghi đè {@code Reply-To}. */
    public SimpleMailMessage newMessage() {
        var msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setReplyTo(replyTo);
        return msg;
    }

    /**
     * Gửi và đếm. Ném lại mọi lỗi của {@link JavaMailSender}.
     *
     * @param mailer nhãn ngắn, cố định (không chứa dữ liệu người dùng) — thành tag Micrometer
     */
    public void send(String mailer, SimpleMailMessage msg) {
        try {
            mailSender.send(msg);
            counter(mailer, "ok").increment();
        } catch (RuntimeException e) {
            counter(mailer, "fail").increment();
            throw e;
        }
    }

    /**
     * Gửi thư hai phần ({@code multipart/alternative}: chữ thuần + HTML), cùng {@code From}/{@code Reply-To}
     * và cùng bộ đếm như {@link #send}. Ném lại mọi lỗi.
     *
     * <p>Vì sao có phần chữ thuần: nhà cung cấp (Brevo) tự bọc thư chỉ-có-chữ thành HTML một ảnh pixel,
     * bộ lọc thư rác trừ điểm "chỉ có HTML, toàn ảnh" (mail-tester 07/11: 7.6/10). Thư tự mang cả hai phần
     * thì người đọc bằng trình chỉ-chữ vẫn đọc được mã, và điểm không bị trừ vì lý do đó.
     *
     * @param mailer nhãn ngắn, cố định — thành tag Micrometer
     */
    public void sendRich(String mailer, String to, String subject, String text, String html) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(msg, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setReplyTo(replyTo);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(msg);
            counter(mailer, "ok").increment();
        } catch (MessagingException e) {
            counter(mailer, "fail").increment();
            throw new MailPreparationException("Không dựng được thư " + mailer, e);
        } catch (RuntimeException e) {
            counter(mailer, "fail").increment();
            throw e;
        }
    }

    private Counter counter(String mailer, String outcome) {
        return Counter.builder("mail.send")
                .description("Thư giao dịch đã gửi, theo mailer và kết quả")
                .tag("mailer", mailer)
                .tag("outcome", outcome)
                .register(meters);
    }
}
