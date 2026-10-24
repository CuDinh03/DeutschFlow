package com.deutschflow.marketing.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.marketing.dto.SchoolDemoRequestPayload;
import com.deutschflow.marketing.entity.SchoolDemoRequest;
import com.deutschflow.marketing.repository.SchoolDemoRequestRepository;
import com.deutschflow.notification.service.UserNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Đợt 3a — form "Đặt lịch demo" của trang trung tâm. */
@ExtendWith(MockitoExtension.class)
class SchoolDemoRequestServiceTest {

    @Mock
    private SchoolDemoRequestRepository repository;
    @Mock
    private UserNotificationService userNotificationService;
    @Mock
    private SchoolDemoRequestMailer mailer;

    private SchoolDemoRequestService service;

    @BeforeEach
    void setUp() {
        service = new SchoolDemoRequestService(repository, userNotificationService, mailer);
    }

    private static SchoolDemoRequestPayload valid() {
        return new SchoolDemoRequestPayload(
                "  Lan Nguyễn ", " Trung tâm Đức ngữ Hà Nội ", "Việt Nam", "S20_50",
                "ZALO", "+84 912 345 678", "  Muốn xem phần chấm bài nói. ", "vi", "");
    }

    private void stubSave() {
        when(repository.save(any(SchoolDemoRequest.class))).thenAnswer(inv -> {
            SchoolDemoRequest r = inv.getArgument(0);
            r.setId(7L);
            return r;
        });
    }

    @Test
    @DisplayName("Hợp lệ → lưu đã trim, báo admin trong chuông và gọi email")
    void submit_valid_savesAndNotifies() {
        stubSave();

        SchoolDemoRequest saved = service.submit(valid(), "203.0.113.5");

        ArgumentCaptor<SchoolDemoRequest> cap = ArgumentCaptor.forClass(SchoolDemoRequest.class);
        verify(repository).save(cap.capture());
        SchoolDemoRequest row = cap.getValue();
        assertEquals("Lan Nguyễn", row.getName());
        assertEquals("Trung tâm Đức ngữ Hà Nội", row.getOrganization());
        assertEquals("S20_50", row.getStudentCount());
        assertEquals("ZALO", row.getContactChannel());
        assertEquals("Muốn xem phần chấm bài nói.", row.getMessage());
        assertEquals("vi", row.getLocale());
        assertEquals(64, row.getIpHash().length(), "chỉ lưu SHA-256, không lưu IP thô");
        assertEquals(7L, saved.getId());
        verify(userNotificationService).onSystemAlert(eq("SCHOOL_DEMO"), anyString(), anyString(),
                eq(Map.of("schoolDemoRequestId", 7L)));
        verify(mailer).notifyOwner(saved);
    }

    @Test
    @DisplayName("Honeypot có chữ → 400, không lưu, không báo")
    void submit_honeypot_isDropped() {
        SchoolDemoRequestPayload bot = new SchoolDemoRequestPayload(
                "Bot", "Spam Ltd", "XX", "LT20", "EMAIL", "bot@spam.test", null, "en", "https://spam.test");

        assertThrows(BadRequestException.class, () -> service.submit(bot, "203.0.113.5"));

        verify(repository, never()).save(any());
        verifyNoInteractions(userNotificationService, mailer);
    }

    @Test
    @DisplayName("Thiếu trường bắt buộc, số học viên/kênh lạ, liên hệ sai dạng → 400, không lưu")
    void submit_invalidFields_areRejected() {
        String[][] bad = {
                {"", "Org", "VN", "LT20", "EMAIL", "a@b.vn"},
                {"Lan", " ", "VN", "LT20", "EMAIL", "a@b.vn"},
                {"Lan", "Org", "", "LT20", "EMAIL", "a@b.vn"},
                {"Lan", "Org", "VN", "1000", "EMAIL", "a@b.vn"},
                {"Lan", "Org", "VN", "LT20", "FAX", "a@b.vn"},
                {"Lan", "Org", "VN", "LT20", "EMAIL", "khong-phai-email"},
                {"Lan", "Org", "VN", "LT20", "PHONE", "abc"},
        };
        for (String[] f : bad) {
            SchoolDemoRequestPayload p = new SchoolDemoRequestPayload(f[0], f[1], f[2], f[3], f[4], f[5], null, "vi", null);
            assertThrows(BadRequestException.class, () -> service.submit(p, "203.0.113.5"), String.join("|", f));
        }
        verify(repository, never()).save(any());
        verifyNoInteractions(userNotificationService, mailer);
    }

    @Test
    @DisplayName("Quá trần theo IP hoặc toàn hệ thống → 429, không lưu")
    void submit_overLimits_isRateLimited() {
        when(repository.countByIpHashAndCreatedAtAfter(anyString(), any()))
                .thenReturn((long) SchoolDemoRequestService.PER_IP_DAILY_LIMIT);
        assertThrows(RateLimitExceededException.class, () -> service.submit(valid(), "203.0.113.5"));

        when(repository.countByIpHashAndCreatedAtAfter(anyString(), any())).thenReturn(0L);
        when(repository.countByCreatedAtAfter(any()))
                .thenReturn((long) SchoolDemoRequestService.GLOBAL_DAILY_LIMIT);
        assertThrows(RateLimitExceededException.class, () -> service.submit(valid(), "203.0.113.5"));

        verify(repository, never()).save(any());
        verifyNoInteractions(userNotificationService, mailer);
    }

    @Test
    @DisplayName("Báo admin lỗi → yêu cầu vẫn lưu và email vẫn gửi")
    void submit_alertFailure_doesNotLoseRequest() {
        stubSave();
        doThrow(new RuntimeException("db down")).when(userNotificationService)
                .onSystemAlert(anyString(), anyString(), anyString(), anyMap());

        SchoolDemoRequest saved = service.submit(valid(), "203.0.113.5");

        assertEquals(7L, saved.getId());
        verify(mailer).notifyOwner(saved);
    }

    @Test
    @DisplayName("Ngôn ngữ lạ → vi; lời nhắn rỗng → null; lời nhắn quá dài bị cắt")
    void submit_normalisesOptionalFields() {
        stubSave();
        SchoolDemoRequestPayload p = new SchoolDemoRequestPayload(
                "Anna", "Sprachschule", "India", "GT200", "EMAIL", "anna@school.in", "   ", "fr", null);

        SchoolDemoRequest saved = service.submit(p, null);

        assertEquals("vi", saved.getLocale());
        assertNull(saved.getMessage());
        assertNull(saved.getIpHash());

        SchoolDemoRequestPayload longMsg = new SchoolDemoRequestPayload(
                "Anna", "Sprachschule", "India", "GT200", "EMAIL", "anna@school.in",
                "x".repeat(SchoolDemoRequestService.MAX_MESSAGE + 50), "en", null);
        assertEquals(SchoolDemoRequestService.MAX_MESSAGE, service.submit(longMsg, null).getMessage().length());
    }
}
