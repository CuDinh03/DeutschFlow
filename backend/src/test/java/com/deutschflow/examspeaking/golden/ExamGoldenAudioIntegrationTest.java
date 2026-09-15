package com.deutschflow.examspeaking.golden;

import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quyết định owner 26/08/2026: CHỈ phiên hiệu chuẩn mới lưu audio.
 * Test chốt ba điều: (1) consent được ghi tường minh; (2) rút đồng ý xoá sạch audio_ref nhưng
 * GIỮ transcript (bằng chứng chấm điểm); (3) purge tắt luôn cờ retain_audio của phiên.
 * Tự skip khi không có Postgres.
 */
@SpringBootTest
class ExamGoldenAudioIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamGoldenService goldenService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    /**
     * F-12: S3 trong IT là client giả (khoá test) — delete THẬT sẽ nổ. Mock để tách hai đường: xoá thành công
     * (audio_ref sạch, retain tắt) và xoá thất bại (audio_ref + retain GIỮ NGUYÊN để xoá lại).
     */
    @org.springframework.boot.test.mock.mockito.MockBean private com.deutschflow.media.service.S3StorageService s3;

    private long studentId;
    private long adminId;
    private long sessionId;

    @BeforeEach
    void seed() {
        studentId = userRepository.save(User.builder()
                .email("audio-it-student-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Audio Student").role(User.Role.STUDENT).build()).getId();
        adminId = userRepository.save(User.builder()
                .email("audio-it-admin-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Owner").role(User.Role.ADMIN).build()).getId();

        Long blueprintId = jdbcTemplate.queryForObject(
                "SELECT id FROM speaking_exam_blueprints WHERE provider='GOETHE' AND level='A1' LIMIT 1", Long.class);
        sessionId = jdbcTemplate.queryForObject("""
                INSERT INTO speaking_exam_sessions (user_id, blueprint_id, mode, state, plan_json, retain_audio, finished_at)
                VALUES (?, ?, 'MOCK', 'RESULTS', '{"parts":[]}'::jsonb, true, now()) RETURNING id""",
                Long.class, studentId, blueprintId);
        jdbcTemplate.update("""
                INSERT INTO speaking_exam_turns (session_id, part_no, seq, role, transcript, audio_ref)
                VALUES (?, 1, 0, 'CANDIDATE', 'Ich heiße Anna.', 'exam-speaking/golden/1/000-x.m4a')""", sessionId);
    }

    @Test
    @DisplayName("thêm người đồng ý → hiện trong danh sách kèm mốc consent tường minh")
    void addParticipantRecordsConsent() {
        Instant signed = Instant.parse("2026-08-20T09:00:00Z");
        GoldenView.Participant p = goldenService.addParticipant(adminId, studentId, signed, "ký giấy 20/08");

        assertThat(p.userId()).isEqualTo(studentId);
        assertThat(p.consentedAt()).isEqualTo(signed);
        assertThat(goldenService.listParticipants())
                .anyMatch(row -> row.userId() == studentId && "ký giấy 20/08".equals(row.note()));
    }

    @Test
    @DisplayName("purge audio: audio_ref sạch + retain_audio tắt, NHƯNG transcript giữ nguyên")
    void purgeKeepsTranscript() {
        GoldenView.PurgeResult result = goldenService.purgeAudio(sessionId);
        assertThat(result.sessionId()).isEqualTo(sessionId);

        String audioRef = jdbcTemplate.queryForObject(
                "SELECT audio_ref FROM speaking_exam_turns WHERE session_id = ?", String.class, sessionId);
        String transcript = jdbcTemplate.queryForObject(
                "SELECT transcript FROM speaking_exam_turns WHERE session_id = ?", String.class, sessionId);
        Boolean retain = jdbcTemplate.queryForObject(
                "SELECT retain_audio FROM speaking_exam_sessions WHERE id = ?", Boolean.class, sessionId);

        assertThat(audioRef).isNull();
        assertThat(transcript).isEqualTo("Ich heiße Anna.");
        assertThat(retain).isFalse();
    }

    @Test
    @DisplayName("rút đồng ý → gỡ khỏi chiến dịch và dọn audio mọi phiên của người đó")
    void removeParticipantPurgesAudio() {
        goldenService.addParticipant(adminId, studentId, Instant.now(), null);
        goldenService.removeParticipant(studentId);

        assertThat(goldenService.listParticipants()).noneMatch(row -> row.userId() == studentId);
        Boolean retain = jdbcTemplate.queryForObject(
                "SELECT retain_audio FROM speaking_exam_sessions WHERE id = ?", Boolean.class, sessionId);
        assertThat(retain).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT audio_ref FROM speaking_exam_turns WHERE session_id = ?", String.class, sessionId)).isNull();
    }

    @Test
    @DisplayName("F-12: S3 từ chối xoá → audio_ref và retain_audio GIỮ NGUYÊN, kết quả báo failed=1 để admin xoá lại")
    void purgeFailureKeepsReferenceForRetry() {
        org.mockito.Mockito.doThrow(new RuntimeException("s3 down")).when(s3).deleteFile(org.mockito.ArgumentMatchers.anyString());
        GoldenView.PurgeResult result = goldenService.purgeAudio(sessionId);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.deleted()).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT audio_ref FROM speaking_exam_turns WHERE session_id = ?", String.class, sessionId))
                .isEqualTo("exam-speaking/golden/1/000-x.m4a");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT retain_audio FROM speaking_exam_sessions WHERE id = ?", Boolean.class, sessionId)).isTrue();

        org.mockito.Mockito.doNothing().when(s3).deleteFile(org.mockito.ArgumentMatchers.anyString());
        GoldenView.PurgeResult retry = goldenService.purgeAudio(sessionId);
        assertThat(retry.deleted()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT audio_ref FROM speaking_exam_turns WHERE session_id = ?", String.class, sessionId)).isNull();
    }

    @Test
    @DisplayName("phiếu chấm vẫn đọc được sau khi audio bị xoá (chấm trên transcript vẫn chạy)")
    void detailStillWorksWithoutAudio() {
        goldenService.purgeAudio(sessionId);
        List<GoldenView.SessionRow> rows = goldenService.listSessions(null, null);
        assertThat(rows).isNotNull();
    }
}
