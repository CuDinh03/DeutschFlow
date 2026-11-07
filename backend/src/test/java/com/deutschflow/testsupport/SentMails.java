package com.deutschflow.testsupport;

import jakarta.mail.BodyPart;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đọc lại thư hai phần ({@code TransactionalMail#sendRich}) mà một {@link JavaMailSender} giả đã nhận.
 *
 * <p>Dùng: gọi {@link #stub(JavaMailSender)} trong {@code @BeforeEach} (mock trả {@code null} cho
 * {@code createMimeMessage()} nếu không stub), rồi {@link #all(JavaMailSender)} để lấy các thư đã gửi.
 */
public final class SentMails {

    private SentMails() {}

    /** Một thư đã gửi, đã giải ra chữ. */
    public record Sent(String subject, String from, String replyTo, List<String> to, String text, String html) {
        public String getSubject() { return subject; }
        public String getFrom() { return from; }
        public String getText() { return text; }
    }

    public static void stub(JavaMailSender sender) {
        when(sender.createMimeMessage()).thenAnswer(inv -> new MimeMessage((Session) null));
    }

    public static List<Sent> all(JavaMailSender sender) {
        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender, atLeastOnce()).send(captor.capture());
        List<Sent> out = new ArrayList<>();
        for (MimeMessage m : captor.getAllValues()) out.add(read(m));
        return out;
    }

    public static Sent read(MimeMessage m) {
        try {
            // JavaMailSenderImpl gọi saveChanges() lúc gửi thật; mock thì không, nên các phần chưa có
            // Content-Type (mặc định text/plain) — gọi ở đây để đọc đúng phần chữ thuần / HTML.
            m.saveChanges();
            StringBuilder text = new StringBuilder();
            StringBuilder html = new StringBuilder();
            collect(m.getContent(), text, html);
            return new Sent(
                    m.getSubject(),
                    addr(m.getFrom()),
                    addr(m.getReplyTo()),
                    m.getRecipients(Message.RecipientType.TO) == null ? List.of()
                            : Arrays.stream(m.getRecipients(Message.RecipientType.TO))
                                    .map(a -> ((InternetAddress) a).getAddress()).toList(),
                    text.toString(),
                    html.toString());
        } catch (Exception e) {
            throw new IllegalStateException("không đọc được thư", e);
        }
    }

    private static void collect(Object content, StringBuilder text, StringBuilder html) throws Exception {
        if (content instanceof String s) {
            text.append(s);
        } else if (content instanceof Multipart mp) {
            for (int i = 0; i < mp.getCount(); i++) {
                BodyPart part = mp.getBodyPart(i);
                Object inner = part.getContent();
                // Thư chưa saveChanges() thì phần bọc ngoài chưa có Content-Type (mặc định text/plain),
                // nên xét nội dung là Multipart TRƯỚC khi xét kiểu MIME.
                if (inner instanceof Multipart) collect(inner, text, html);
                else if (part.isMimeType("text/html")) html.append(inner);
                else text.append(inner);
            }
        }
    }

    private static String addr(jakarta.mail.Address[] addrs) {
        return addrs == null || addrs.length == 0 ? null : ((InternetAddress) addrs[0]).toUnicodeString();
    }
}
