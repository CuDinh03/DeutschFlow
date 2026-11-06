package com.deutschflow.marketing.service;

import com.deutschflow.marketing.entity.SchoolDemoRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import com.deutschflow.common.mail.TransactionalMail;
import org.springframework.stereotype.Service;

/**
 * Báo owner qua email khi có yêu cầu đặt lịch demo (đợt 3a). Cùng khuôn {@code JavaMailSender} +
 * {@code SimpleMailMessage} như {@code OrgInvitationMailer}.
 *
 * <p>Không bao giờ ném lỗi: yêu cầu đã lưu trong DB và admin đã có thông báo trong chuông, nên email
 * hỏng (hoặc chưa cấu hình {@code app.leads.notify-email} / SMTP) chỉ để lại một dòng log.
 */
@Slf4j
@Service
public class SchoolDemoRequestMailer {

    private final TransactionalMail mail;
    private final String notifyTo;

    public SchoolDemoRequestMailer(
            TransactionalMail mail,
            @Value("${app.leads.notify-email:}") String notifyTo) {
        this.mail = mail;
        this.notifyTo = notifyTo == null ? "" : notifyTo.trim();
    }

    public void notifyOwner(SchoolDemoRequest r) {
        if (notifyTo.isEmpty() || !mail.isEnabled()) {
            log.info("[SchoolDemo] request id={} saved — email notify skipped (notify-email or SMTP not set)", r.getId());
            return;
        }
        try {
            // From + Reply-To gắn sẵn — xem javadoc TransactionalMail về vì sao SES từ chối thư thiếu From.
            var msg = mail.newMessage();
            msg.setTo(notifyTo);
            // Bấm Reply là trả lời thẳng người gửi khi họ để lại email.
            if ("EMAIL".equals(r.getContactChannel())) {
                msg.setReplyTo(r.getContact());
            }
            msg.setSubject("myDeutschFlow — Đặt lịch demo: " + r.getOrganization() + " (" + r.getCountry() + ")");
            msg.setText(
                    "Có yêu cầu đặt lịch demo mới từ trang trung tâm.\n\n" +
                    "Người gửi:   " + r.getName() + "\n" +
                    "Trung tâm:   " + r.getOrganization() + "\n" +
                    "Nước:        " + r.getCountry() + "\n" +
                    "Số học viên: " + r.getStudentCount() + "\n" +
                    "Liên hệ:     " + r.getContactChannel() + " " + r.getContact() + "\n" +
                    "Ngôn ngữ:    " + r.getLocale() + "\n" +
                    (r.getMessage() == null ? "" : "\nLời nhắn:\n" + r.getMessage() + "\n") +
                    "\nMã yêu cầu #" + r.getId() + "."
            );
            mail.send("school-demo", msg);
            log.info("[SchoolDemo] notify email sent for request id={}", r.getId());
        } catch (Exception e) {
            log.warn("[SchoolDemo] failed to send notify email for request id={}: {}", r.getId(), e.getMessage());
        }
    }
}
