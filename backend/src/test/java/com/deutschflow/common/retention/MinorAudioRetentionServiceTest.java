package com.deutschflow.common.retention;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.minor.MinorPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Chốt hành vi ĐIỀU PHỐI: chế độ đếm, ghi vết theo trung tâm, và việc khoảng mù không im lặng.
 *
 * <p>{@link MinorAudioOrgSnapshotResolver} dùng bản THẬT trên một {@code JdbcTemplate} giả: nó là
 * đường nối tới ảnh chụp {@code org_id}, và ca test cần chứng minh ảnh chụp trên chính dòng dữ liệu
 * được ưu tiên — thay bằng mock thì mất đúng điều đang muốn kiểm.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MinorAudioRetentionServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T02:00:00Z");
    private static final Instant LONG_AGO = Instant.parse("2026-01-10T03:00:00Z");
    private static final long ORG = 5L;

    @Mock
    MinorAudioRetentionCandidates candidates;
    @Mock
    MinorAudioRetentionPurger purger;
    @Mock
    AuditLogService auditLogService;
    @Mock
    JdbcTemplate jdbcTemplate;

    private MinorAudioOrgSnapshotResolver orgResolver;

    @BeforeEach
    void setUp() {
        orgResolver = new MinorAudioOrgSnapshotResolver(jdbcTemplate);
        when(candidates.examSpeaking(any(), anyInt())).thenReturn(List.of());
        when(candidates.assignmentUploads(any(), anyInt())).thenReturn(List.of());
        when(candidates.aiJobPayloads(any(), anyInt())).thenReturn(List.of());
    }

    @Test
    @DisplayName("Mặc định là CHẾ ĐỘ ĐẾM — vết mang tên khác và cờ dryRun")
    void defaultIsDryRun() {
        when(candidates.assignmentUploads(any(), anyInt())).thenReturn(List.of(minorAssignment(1L)));
        when(purger.purgeAssignmentUpload(any(), eq(true))).thenReturn(MinorAudioPurgeTally.ofAssignmentFile());

        service(true).purgeOnce(NOW);

        Map<String, Object> metadata = capturedMetadata(MinorAudioRetentionService.EVENT_PREVIEWED);
        assertThat(metadata).containsEntry("dryRun", true).containsEntry("retentionDays", 30);
        verify(purger).purgeAssignmentUpload(any(), eq(true));
    }

    @Test
    @DisplayName("Bật xoá thật: vết đổi tên sự kiện, số lượng vào sổ của TRUNG TÂM ảnh chụp")
    void realRunWritesOrgLedger() {
        when(candidates.assignmentUploads(any(), anyInt())).thenReturn(List.of(minorAssignment(1L), minorAssignment(2L)));
        when(purger.purgeAssignmentUpload(any(), eq(false))).thenReturn(MinorAudioPurgeTally.ofAssignmentFile());

        service(false).purgeOnce(NOW);

        ArgumentCaptor<Map<String, Object>> metadata = metadataCaptor();
        // org_id truyền TƯỜNG MINH — job không có actor nên đường lùi "suy từ users.org_id của actor"
        // sẽ cho NULL và vết biến mất khỏi đường đọc của giám đốc.
        verify(auditLogService).log(eq(MinorAudioRetentionService.EVENT_PURGED), isNull(), isNull(),
                eq("SYSTEM"), eq(MinorAudioRetentionService.TARGET_TYPE), eq("5"), eq(ORG), metadata.capture());
        assertThat(metadata.getValue())
                .containsEntry("assignmentFiles", 2)
                .containsEntry("dryRun", false);
    }

    @Test
    @DisplayName("⛔ Vết KHÔNG mang định danh học viên, không mang khoá S3, không mang ngày sinh")
    void ledgerCarriesCountsOnly() {
        when(candidates.assignmentUploads(any(), anyInt())).thenReturn(List.of(minorAssignment(1L)));
        when(purger.purgeAssignmentUpload(any(), anyBoolean())).thenReturn(MinorAudioPurgeTally.ofAssignmentFile());

        service(false).purgeOnce(NOW);

        Map<String, Object> metadata = capturedMetadata(MinorAudioRetentionService.EVENT_PURGED);
        assertThat(metadata.values()).allSatisfy(v ->
                assertThat(v).isInstanceOfAny(Integer.class, Long.class, Boolean.class, String.class));
        assertThat(metadata.keySet())
                .doesNotContain("studentId", "userId", "subjectUserId", "birthDate", "key", "url", "transcript");
        // Khoá thời gian duy nhất là mốc hạn lưu, không phải ngày sinh của ai.
        assertThat(metadata).containsEntry("cutoff", "2026-08-11T02:00:00Z");
    }

    @Test
    @DisplayName("Chủ thể UNKNOWN: không gọi purger, nhưng số lượng vào vết")
    void unknownSubjectsAreCountedNotPurged() {
        when(candidates.aiJobPayloads(any(), anyInt())).thenReturn(List.of(
                new MinorAudioCandidate(MinorAudioCandidate.Store.AI_JOB_PAYLOAD, 10L, 77L, null, LONG_AGO,
                        null, null, ORG)));

        MinorAudioPurgeTally total = service(false).purgeOnce(NOW);

        assertThat(total.unclassified()).isEqualTo(1);
        assertThat(total.touchedRows()).isZero();
        verify(purger, never()).purgeAiJobPayloads(anyList(), anyBoolean());
        assertThat(capturedMetadata(MinorAudioRetentionService.EVENT_PURGED)).containsEntry("unclassified", 1);
    }

    @Test
    @DisplayName("Không có gì quá hạn → KHÔNG ghi vết (sổ giám đốc không nhận nhịp tim mỗi đêm)")
    void quietNightWritesNothing() {
        service(false).purgeOnce(NOW);

        verify(auditLogService, never()).log(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Job đã đủ tuổi lúc thu thì không ai đụng tới")
    void adultAtCaptureIsUntouched() {
        when(candidates.assignmentUploads(any(), anyInt())).thenReturn(List.of(
                new MinorAudioCandidate(MinorAudioCandidate.Store.ASSIGNMENT_UPLOAD, 1L, 7L,
                        LocalDate.of(1995, 1, 1), LONG_AGO, "https://b/x.m4a", 42L, ORG)));

        MinorAudioPurgeTally total = service(false).purgeOnce(NOW);

        assertThat(total.touchedRows()).isZero();
        verify(purger, never()).purgeAssignmentUpload(any(), anyBoolean());
    }

    // ─────────────────────────────────────────────────────────────────────────

    private MinorAudioRetentionService service(boolean dryRun) {
        return new MinorAudioRetentionService(candidates, purger, orgResolver, auditLogService,
                new MinorPolicy(16, 18), 30, dryRun, 500);
    }

    /** Vị thành niên lúc thu (sinh 2010 ⇒ 15 tuổi ngày 10/01/2026), mang sẵn ảnh chụp org của LỚP. */
    private static MinorAudioCandidate minorAssignment(long rowId) {
        return new MinorAudioCandidate(MinorAudioCandidate.Store.ASSIGNMENT_UPLOAD, rowId, 100 + rowId,
                LocalDate.of(2010, 6, 1), LONG_AGO, "https://bucket/assignments/42/x.m4a", 42L, ORG);
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<Map<String, Object>> metadataCaptor() {
        return ArgumentCaptor.forClass(Map.class);
    }

    private Map<String, Object> capturedMetadata(String expectedEvent) {
        ArgumentCaptor<Map<String, Object>> captor = metadataCaptor();
        verify(auditLogService).log(eq(expectedEvent), isNull(), isNull(), any(), any(), any(), any(),
                captor.capture());
        return captor.getValue();
    }
}
