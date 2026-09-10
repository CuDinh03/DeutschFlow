package com.deutschflow.common.retention;

import com.deutschflow.common.minor.MinorPolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chốt LUẬT QUYẾT ĐỊNH của job dọn bản ghi âm trẻ vị thành niên (DEC-22, owner chốt 09/09/2026:
 * giữ 30 ngày).
 *
 * <p><b>Không có Spring ở đây.</b> {@link MinorAudioRetentionPlanner} chỉ là phép so tuổi và so mốc
 * thời gian — dựng thẳng bằng {@code new}. Một job XOÁ KHÔNG HOÀN LẠI phải kiểm được luật của nó mà
 * không cần database, không cần S3, không cần scheduler.
 *
 * <p>🪤 Mọi ca đều ghim {@code now} và ngày sinh bằng HẰNG SỐ. Bẫy đã ghi trong repo: "test ngày
 * cứng + {@code now()} tự đỏ theo lịch" — dùng {@code LocalDate.now().minusYears(17)} thì ca này
 * xanh hôm nay và đỏ vào một ngày không ai đoán trước.
 */
class MinorAudioRetentionPlannerTest {

    /** Ngưỡng mặc định của sản phẩm: 16 = luật, 18 = luật nội bộ trung tâm. */
    private static final MinorPolicy POLICY = new MinorPolicy(16, 18);
    private static final int RETENTION_DAYS = 30;

    /** Thời điểm chạy job, ghim cứng. */
    private static final Instant NOW = Instant.parse("2026-09-10T02:00:00Z");
    /** Quá hạn: thu ngày 10/01/2026, tức hơn 8 tháng trước mốc 30 ngày. */
    private static final Instant LONG_AGO = Instant.parse("2026-01-10T03:00:00Z");
    /** Chưa quá hạn: thu ngày 01/09/2026, mới 9 ngày. */
    private static final Instant RECENT = Instant.parse("2026-09-01T03:00:00Z");

    private final MinorAudioRetentionPlanner planner = new MinorAudioRetentionPlanner(POLICY, RETENTION_DAYS);

    @Nested
    @DisplayName("Ca chốt: tuổi tính TẠI THỜI ĐIỂM THU, không phải hôm nay")
    class AgeAtCapture {

        /**
         * Đây là ca mà một job viết ẩu sẽ trượt: em sinh 15/03/2008 thu bản ghi ngày 10/01/2026 lúc
         * <b>17 tuổi</b>, tới ngày chạy job 10/09/2026 đã <b>18</b>. Hỏi tuổi HÔM NAY thì ra ADULT và
         * bản ghi âm của một đứa trẻ nằm lại vĩnh viễn.
         */
        @Test
        @DisplayName("17 tuổi lúc thu, 18 tuổi hôm nay → VẪN dọn")
        void minorAtCapture_adultToday_isPurged() {
            MinorAudioCandidate c = candidate(1L, LocalDate.of(2008, 3, 15), LONG_AGO);

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(c), NOW);

            assertThat(plan.due()).containsExactly(c);
            assertThat(plan.keptAdult()).isZero();
            // Kiểm chứng ngược để ca không xanh vì lý do khác: hôm nay em ấy ĐÃ là người lớn.
            assertThat(POLICY.statusOf(LocalDate.of(2008, 3, 15))).isEqualTo(MinorPolicy.Status.ADULT);
        }

        @Test
        @DisplayName("Đã đủ tuổi từ lúc thu → KHÔNG dọn")
        void adultAtCapture_isKept() {
            MinorAudioCandidate c = candidate(2L, LocalDate.of(2000, 1, 1), LONG_AGO);

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(c), NOW);

            assertThat(plan.due()).isEmpty();
            assertThat(plan.keptAdult()).isEqualTo(1);
        }

        @Test
        @DisplayName("Cả hai mức tuổi vị thành niên đều bị dọn (dưới 16 và 16–17)")
        void bothMinorTiersArePurged() {
            MinorAudioCandidate under16 = candidate(3L, LocalDate.of(2012, 1, 1), LONG_AGO);   // 14 lúc thu
            MinorAudioCandidate between = candidate(4L, LocalDate.of(2009, 1, 1), LONG_AGO);   // 17 lúc thu

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(under16, between), NOW);

            assertThat(plan.due()).containsExactlyInAnyOrder(under16, between);
        }
    }

    @Nested
    @DisplayName("Ca chốt: chủ thể UNKNOWN thì KHÔNG dọn, nhưng phải đếm được")
    class UnknownSubject {

        /**
         * Chưa khai ngày sinh = chưa xác lập được đây có phải dữ liệu trẻ em hay không. Xoá trong
         * tình trạng đó là mất mát không hoàn lại của người lớn; giữ lại là một khoảng mù sửa được.
         */
        @Test
        @DisplayName("Không có ngày sinh → không xoá, rơi vào danh sách không phân loại được")
        void unknownBirthDate_isNeverPurged() {
            MinorAudioCandidate c = candidate(5L, null, LONG_AGO);

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(c), NOW);

            assertThat(plan.due()).isEmpty();
            assertThat(plan.unclassified()).containsExactly(c);
            assertThat(plan.unclassifiedCount()).isEqualTo(1);
        }

        /**
         * Trả về cả DANH SÁCH chứ không chỉ số đếm là có chủ đích: service cần chủ thể để quy khoảng
         * mù về từng trung tâm. Mất danh sách là mất luôn khả năng nói "trung tâm này còn bao nhiêu".
         */
        @Test
        @DisplayName("Khoảng mù giữ được chủ thể để quy về trung tâm")
        void unclassifiedKeepsSubjects() {
            MinorAudioCandidate a = candidate(6L, null, LONG_AGO);
            MinorAudioCandidate b = candidate(7L, null, LONG_AGO);

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(a, b), NOW);

            assertThat(plan.unclassified())
                    .extracting(MinorAudioCandidate::subjectUserId)
                    .containsExactly(6L, 7L);
        }
    }

    @Nested
    @DisplayName("Mốc hạn lưu")
    class RetentionWindow {

        @Test
        @DisplayName("Trẻ vị thành niên nhưng chưa qua 30 ngày → chưa dọn")
        void minorButTooRecent_isKept() {
            MinorAudioCandidate c = candidate(8L, LocalDate.of(2012, 1, 1), RECENT);

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(c), NOW);

            assertThat(plan.due()).isEmpty();
            assertThat(plan.keptTooRecent()).isEqualTo(1);
        }

        @Test
        @DisplayName("Mốc = now trừ đúng số ngày cấu hình")
        void cutoffFollowsConfiguredDays() {
            assertThat(planner.cutoff(NOW)).isEqualTo(Instant.parse("2026-08-11T02:00:00Z"));
        }

        @Test
        @DisplayName("Hạn lưu 0 ngày = xoá ngay khi vừa thu → chặn ngay lúc dựng")
        void zeroRetentionIsRejected() {
            assertThatThrownBy(() -> new MinorAudioRetentionPlanner(POLICY, 0))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("audio-retention-days");
        }
    }

    @Nested
    @DisplayName("Dòng dữ liệu khuyết")
    class Malformed {

        @Test
        @DisplayName("Thiếu chủ thể hoặc thiếu thời điểm thu → giữ, không đoán")
        void malformedRowsAreKept() {
            MinorAudioCandidate noSubject = new MinorAudioCandidate(
                    MinorAudioCandidate.Store.AI_JOB_PAYLOAD, 9L, null, LocalDate.of(2012, 1, 1), LONG_AGO,
                    null, null, null);
            MinorAudioCandidate noCaptureTime = new MinorAudioCandidate(
                    MinorAudioCandidate.Store.AI_JOB_PAYLOAD, 10L, 99L, LocalDate.of(2012, 1, 1), null,
                    null, null, null);

            MinorAudioRetentionPlanner.Plan plan = planner.plan(List.of(noSubject, noCaptureTime), NOW);

            assertThat(plan.due()).isEmpty();
            assertThat(plan.keptMalformed()).isEqualTo(2);
        }

        @Test
        @DisplayName("Danh sách rỗng hoặc null không làm vỡ lượt chạy")
        void emptyInputIsSafe() {
            assertThat(planner.plan(List.of(), NOW).dueCount()).isZero();
            assertThat(planner.plan(null, NOW).dueCount()).isZero();
        }
    }

    private static MinorAudioCandidate candidate(long subjectId, LocalDate birthDate, Instant capturedAt) {
        return new MinorAudioCandidate(
                MinorAudioCandidate.Store.EXAM_SPEAKING_GOLDEN,
                subjectId * 100,
                subjectId,
                birthDate,
                capturedAt,
                null,
                null,
                null);
    }
}
