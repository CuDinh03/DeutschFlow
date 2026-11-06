package com.deutschflow.common.mail;

import com.deutschflow.marketing.entity.SchoolDemoRequest;
import com.deutschflow.marketing.service.SchoolDemoRequestMailer;
import com.deutschflow.user.activation.AccountActivationMailer;
import com.deutschflow.user.onboarding.lifecycle.OnboardingLifecycleMailer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * AC-MAIL-01: mọi thư giao dịch mang đúng {@code From} + {@code Reply-To} đã cấu hình.
 *
 * <p>Gmail SMTP tự viết lại {@code From} nên thiếu {@code setFrom()} không ai thấy; SES thì từ chối thẳng.
 * {@code AccountActivationMailer} và {@code OnboardingLifecycleMailer} từng thiếu đúng dòng đó (ra đời sau
 * PR #654). Hai mailer còn lại ({@code PasswordResetService}, {@code OrgInvitationMailer}) có ca riêng
 * trong unit test của chúng.
 */
class MailSenderIdentityUnitTest {

    private static final String FROM = "DeutschFlow <no-reply@mydeutschflow.com>";
    private static final String REPLY_TO = "support@mydeutschflow.com";

    private final JavaMailSender sender = mock(JavaMailSender.class);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final TransactionalMail mail = new TransactionalMail(sender, "smtp.example.com", FROM, REPLY_TO, meters);

    private SimpleMailMessage captured() {
        var captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("thư kích hoạt tài khoản (CSV) có From + Reply-To")
    void activationMailCarriesSenderIdentity() {
        new AccountActivationMailer(mail, "https://mydeutschflow.com", 14)
                .sendActivation("hv@example.com", "An", "Trung tâm A", "tok");
        var msg = captured();
        assertThat(msg.getFrom()).isEqualTo(FROM);
        assertThat(msg.getReplyTo()).isEqualTo(REPLY_TO);
    }

    @Test
    @DisplayName("thư lifecycle onboarding có From + Reply-To")
    void lifecycleMailCarriesSenderIdentity() {
        new OnboardingLifecycleMailer(mail, "https://mydeutschflow.com")
                .send("hv@example.com", "An", "Nhắc học", "Nội dung");
        var msg = captured();
        assertThat(msg.getFrom()).isEqualTo(FROM);
        assertThat(msg.getReplyTo()).isEqualTo(REPLY_TO);
    }

    @Test
    @DisplayName("thư báo yêu cầu demo có From; Reply-To trỏ người gửi khi họ để lại email")
    void demoMailCarriesSenderIdentity() {
        var r = SchoolDemoRequest.builder()
                .name("Lan").organization("TT B").country("VN").studentCount("11-30")
                .contactChannel("EMAIL").contact("lan@example.com").locale("vi").build();
        new SchoolDemoRequestMailer(mail, "owner@example.com").notifyOwner(r);
        var msg = captured();
        assertThat(msg.getFrom()).isEqualTo(FROM);
        assertThat(msg.getReplyTo()).isEqualTo("lan@example.com");
    }

    @Test
    @DisplayName("đếm mail.send theo mailer + outcome; lỗi gửi được ném lại cho mailer tự quyết")
    void countsOutcomesAndRethrows() {
        mail.send("t", mail.newMessage());
        doThrow(new MailSendException("down")).when(sender).send(any(SimpleMailMessage.class));
        assertThatThrownBy(() -> mail.send("t", mail.newMessage())).isInstanceOf(MailSendException.class);

        assertThat(meters.get("mail.send").tag("mailer", "t").tag("outcome", "ok").counter().count()).isEqualTo(1.0);
        assertThat(meters.get("mail.send").tag("mailer", "t").tag("outcome", "fail").counter().count()).isEqualTo(1.0);
    }

    /**
     * Chốt chặn cho mailer viết sau này: tạo thư bằng {@code new SimpleMailMessage()} là bỏ qua
     * {@code From} gắn sẵn. Chỉ {@link TransactionalMail} được phép.
     */
    @Test
    @DisplayName("không file main nào ngoài TransactionalMail gọi new SimpleMailMessage()")
    void onlyTransactionalMailCreatesMessages() throws IOException {
        Path root = Path.of("src/main/java");
        List<Path> offenders;
        try (Stream<Path> files = Files.walk(root)) {
            offenders = files
                    .filter(p -> p.toString().endsWith(".java"))
                    .filter(p -> !p.getFileName().toString().equals("TransactionalMail.java"))
                    .filter(p -> {
                        try {
                            return Files.readString(p, StandardCharsets.UTF_8).contains("new SimpleMailMessage(");
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    })
                    .toList();
        }
        assertThat(offenders).as("tạo thư qua TransactionalMail.newMessage()").isEmpty();
    }
}
