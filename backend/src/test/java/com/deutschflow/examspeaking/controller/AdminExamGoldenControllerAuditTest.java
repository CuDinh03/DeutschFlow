package com.deutschflow.examspeaking.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * R-L7/C2 (03/09/2026): export golden-set CSV (tên người chấm + band điểm) trước đây thiếu cả vết
 * audit lẫn Cache-Control: no-store.
 *
 * <p>DEC-13 (09/09/2026): các đường ĐỌC của màn này cũng phải để lại vết mà giám đốc trung tâm đọc
 * được — {@code GET /sessions/{id}} là đường duy nhất trả về giọng nói thật của học viên.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("AdminExamGoldenController — vết đường đọc + no-store cho export (R-L7/C2, DEC-13)")
class AdminExamGoldenControllerAuditTest {

    @Mock private ExamGoldenService goldenService;
    @Mock private AuditLogService auditLogService;
    @Mock private AuditOrgResolver auditOrgResolver;
    @Mock private JdbcTemplate jdbcTemplate;

    private static final String TRANSCRIPT = "Ich heiße Anna und wohne in Hanoi";
    private static final String AUDIO_URL = "https://s3.example/exam/7/turn-1.webm?X-Amz-Signature=deadbeef";

    private static User admin() {
        return User.builder().id(4L).email("admin@x.com").displayName("Admin")
                .role(User.Role.ADMIN).build();
    }

    private AdminExamGoldenController controller() {
        return new AdminExamGoldenController(goldenService, auditLogService, auditOrgResolver, jdbcTemplate);
    }

    /** Chủ phiên thi nói mà controller tra thẳng từ bảng phiên (Detail không mang userId). */
    private void sessionOwnedBy(Long ownerUserId, Long orgId) {
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Long>>any(), any(Object[].class)))
                .thenReturn(ownerUserId);
        when(auditOrgResolver.forUser(ownerUserId)).thenReturn(orgId);
    }

    private static GoldenView.Detail detailWithAudio() {
        return new GoldenView.Detail(7L, "GOETHE", "B1", Instant.parse("2026-09-01T10:00:00Z"), null,
                List.of(new GoldenView.TurnLine(1, "STUDENT", TRANSCRIPT, AUDIO_URL),
                        new GoldenView.TurnLine(1, "PRUEFER", "Guten Tag", null)),
                null, Map.of(), List.of());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> captureMetadata(String eventName, String targetType, String targetId, Long orgId) {
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq(eventName), any(AuditActor.class), eq(targetType), eq(targetId),
                eq(orgId), meta.capture());
        return meta.getValue();
    }

    // ── GET /sessions/{id}: đường chạm giọng nói thật ───────────────────────────────────────

    @Test
    @DisplayName("detail: ghi vết theo TRUNG TÂM của chủ phiên, kèm số lượt và có/không audio")
    void detail_auditsWithOwnerOrg() {
        sessionOwnedBy(99L, 42L);
        when(goldenService.detail(7L, 4L)).thenReturn(detailWithAudio());

        controller().detail(admin(), 7L);

        Map<String, Object> meta = captureMetadata("admin.exam_golden.session.read", "EXAM_GOLDEN", "7", 42L);
        assertThat(meta).containsEntry("sessionId", 7L)
                .containsEntry("turns", 2)
                .containsEntry("audioTurns", 1L)
                .containsEntry("hasAudio", true);
    }

    @Test
    @DisplayName("detail: vết KHÔNG chứa transcript và KHÔNG chứa link audio presigned")
    void detail_auditNeverLeaksContent() {
        sessionOwnedBy(99L, 42L);
        when(goldenService.detail(7L, 4L)).thenReturn(detailWithAudio());

        controller().detail(admin(), 7L);

        String rendered = String.valueOf(captureMetadata("admin.exam_golden.session.read", "EXAM_GOLDEN", "7", 42L));
        assertThat(rendered).doesNotContain(TRANSCRIPT).doesNotContain("X-Amz-Signature").doesNotContain("https://");
    }

    @Test
    @DisplayName("detail: chủ phiên là người dùng B2C ⇒ orgId null, vết vẫn ghi")
    void detail_b2cOwnerStillAudited() {
        sessionOwnedBy(99L, null);
        when(goldenService.detail(7L, 4L)).thenReturn(detailWithAudio());

        controller().detail(admin(), 7L);

        assertThat(captureMetadata("admin.exam_golden.session.read", "EXAM_GOLDEN", "7", null)).isNotNull();
    }

    @Test
    @DisplayName("detail: ghi vết hỏng KHÔNG được làm hỏng lần đọc đã thành công (fail-open)")
    void detail_auditFailureNeverBreaksRead() {
        sessionOwnedBy(99L, 42L);
        when(goldenService.detail(7L, 4L)).thenReturn(detailWithAudio());
        doThrow(new RuntimeException("audit_logs.org_id vi phạm khoá ngoại"))
                .when(auditLogService).log(anyString(), any(AuditActor.class), any(), any(), any(), any());

        assertThatCode(() -> controller().detail(admin(), 7L)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("detail: tra trung tâm hỏng cũng không làm hỏng lần đọc — vết ghi với orgId null")
    void detail_orgLookupFailureIsSwallowed() {
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Long>>any(), any(Object[].class)))
                .thenThrow(new RuntimeException("DB tạm mất kết nối"));
        when(goldenService.detail(7L, 4L)).thenReturn(detailWithAudio());

        assertThatCode(() -> controller().detail(admin(), 7L)).doesNotThrowAnyException();
        assertThat(captureMetadata("admin.exam_golden.session.read", "EXAM_GOLDEN", "7", null)).isNotNull();
    }

    // ── Chiến dịch hiệu chuẩn: bật/tắt ghi âm + danh sách người đồng ý ──────────────────────

    @Test
    @DisplayName("participants: đường đọc trả về email học viên cũng để lại vết")
    void participants_audited() {
        when(goldenService.listParticipants()).thenReturn(List.of(
                new GoldenView.Participant(11L, "Anna", "anna@x.com", Instant.now(), null)));

        controller().participants(admin());

        assertThat(captureMetadata("admin.exam_golden.participants.read", "EXAM_GOLDEN", null, null))
                .containsEntry("count", 1);
    }

    @Test
    @DisplayName("addParticipant: BẬT ghi âm cho một học viên đích danh ⇒ vết vào sổ trung tâm của họ")
    void addParticipant_auditsWithStudentOrg() {
        when(auditOrgResolver.forUser(11L)).thenReturn(42L);
        Instant consented = Instant.parse("2026-08-26T10:00:00Z");
        when(goldenService.addParticipant(eq(4L), eq(11L), eq(consented), anyString()))
                .thenReturn(new GoldenView.Participant(11L, "Anna", "anna@x.com", consented, "ký giấy 26/08"));

        controller().addParticipant(admin(), Map.of(
                "userId", 11, "consentedAt", "2026-08-26T10:00:00Z", "note", "ký giấy 26/08"));

        Map<String, Object> meta = captureMetadata("admin.exam_golden.participant.added", "USER", "11", 42L);
        assertThat(meta).containsEntry("userId", 11L).containsEntry("hasNote", true);
        // `note` là chữ tự do của admin — vết chỉ nói CÓ/KHÔNG, không chép nội dung.
        assertThat(String.valueOf(meta)).doesNotContain("ký giấy");
    }

    @Test
    @DisplayName("removeParticipant: xoá audio vĩnh viễn ⇒ vết kèm số file đã xoá")
    void removeParticipant_audited() {
        when(auditOrgResolver.forUser(11L)).thenReturn(42L);
        when(goldenService.removeParticipant(11L)).thenReturn(3);

        Map<String, Object> body = controller().removeParticipant(admin(), 11L);

        assertThat(body).containsEntry("audioDeleted", 3);
        assertThat(captureMetadata("admin.exam_golden.participant.removed", "USER", "11", 42L))
                .containsEntry("userId", 11L).containsEntry("audioDeleted", 3);
    }

    @Test
    @DisplayName("purgeAudio: vết theo trung tâm của chủ phiên, kèm số key xoá được/thất bại")
    void purgeAudio_audited() {
        sessionOwnedBy(99L, 42L);
        when(goldenService.purgeAudio(7L)).thenReturn(new GoldenView.PurgeResult(7L, 2, 1));

        controller().purgeAudio(admin(), 7L);

        assertThat(captureMetadata("admin.exam_golden.audio.purged", "EXAM_GOLDEN", "7", 42L))
                .containsEntry("sessionId", 7L).containsEntry("deleted", 2).containsEntry("failed", 1);
    }

    // ── Export CSV (R-L7/C2) ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("exportCsv: ghi vết admin.exam_golden.exported + đặt no-store")
    void exportCsv_auditsAndSetsNoStore() {
        when(goldenService.exportCsv("openai", "B2")).thenReturn("session,rater,band\n");

        ResponseEntity<String> response = controller().exportCsv("openai", "B2", admin());

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getBody()).contains("session,rater,band");
        verify(auditLogService).log(eq("admin.exam_golden.exported"), any(AuditActor.class),
                eq("EXAM_GOLDEN"), eq(null), eq(null), any());
    }

    @Test
    @DisplayName("exportCsv: body mở đầu bằng BOM UTF-8 + Content-Type charset=utf-8 (Excel Windows đọc đúng tiếng Việt)")
    void exportCsv_prefixesUtf8Bom() {
        when(goldenService.exportCsv("goethe", "A1")).thenReturn("session,rater,band\n1,Prüferin Anna,B1\n");

        ResponseEntity<String> response = controller().exportCsv("goethe", "A1", admin());

        assertThat(response.getBody()).startsWith("\uFEFF" + "session,rater,band");
        assertThat(response.getBody()).contains("Prüferin Anna");
        assertThat(String.valueOf(response.getHeaders().getContentType())).contains("charset=utf-8");
    }

    @Test
    @DisplayName("saveRatings: đường GHI phiếu không phát sinh vết mới (ngoài phạm vi đợt này)")
    void saveRatings_notAudited() {
        controller().saveRatings(admin(), 7L, null);

        verify(auditLogService, never()).log(anyString(), any(AuditActor.class), any(), any(), any(), any());
    }
}
