package com.deutschflow.teacher.service;

import com.deutschflow.teacher.dto.ScheduleForecastDto;
import com.deutschflow.teacher.entity.ClassMilestone;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** compute() thuần (PR-6, AC09/AC17) — không mock: buổi + phút còn lại + mốc → dự báo. */
@DisplayName("ScheduleForecastService.compute")
class ScheduleForecastServiceTest {

    private static ScheduleForecastService.FutureSession s(String date, int teaching) {
        return new ScheduleForecastService.FutureSession(LocalDate.parse(date), teaching);
    }

    private static ClassMilestone m(long id, ClassMilestone.Kind kind, String date) {
        return ClassMilestone.builder().id(id).classId(1L).kind(kind).title("Mốc " + id)
                .plannedDate(LocalDate.parse(date)).createdBy(9L).build();
    }

    @Test
    @DisplayName("Đủ khung: projectedEndDate là NGÀY CỦA BUỔI mà lũy kế phút học phủ hết nội dung")
    void enoughCapacity_projectsEndDate() {
        // 400′ còn lại; buổi 180+180 chưa đủ (360), buổi thứ 3 chạm 540 ≥ 400.
        ScheduleForecastDto out = ScheduleForecastService.compute(400,
                List.of(s("2026-09-07", 180), s("2026-09-09", 180), s("2026-09-11", 180), s("2026-09-14", 180)),
                List.of());
        assertThat(out.projectedEndDate()).isEqualTo(LocalDate.parse("2026-09-11"));
        assertThat(out.shortfallMinutes()).isZero();
        assertThat(out.suggestedExtraSessions()).isZero();
        assertThat(out.availableMinutes()).isEqualTo(720);
    }

    @Test
    @DisplayName("AC17 — thiếu khung: shortfall + số buổi 180′ cần thêm; KHÔNG tự chế ngày xong")
    void shortfall_reportsNeededSessions() {
        ScheduleForecastDto out = ScheduleForecastService.compute(500,
                List.of(s("2026-09-07", 180)), List.of());
        assertThat(out.projectedEndDate()).isNull();
        assertThat(out.shortfallMinutes()).isEqualTo(320);
        assertThat(out.suggestedExtraSessions()).isEqualTo(2); // ceil(320/180)
    }

    @Test
    @DisplayName("Hết nợ nội dung: xong ngay, không mốc nào rủi ro")
    void nothingRemaining_doneToday() {
        ScheduleForecastDto out = ScheduleForecastService.compute(0,
                List.of(s("2026-09-07", 180)),
                List.of(m(1, ClassMilestone.Kind.EXAM, "2026-09-05")));
        assertThat(out.projectedEndDate()).isEqualTo(LocalDate.now());
        assertThat(out.milestones()).singleElement()
                .satisfies(v -> assertThat(v.atRisk()).isFalse());
    }

    @Test
    @DisplayName("AC09 — mốc TRƯỚC ngày học-xong-dự-kiến mang cờ atRisk; mốc sau thì không")
    void milestoneBeforeProjectedEnd_isAtRisk() {
        ScheduleForecastDto out = ScheduleForecastService.compute(360,
                List.of(s("2026-09-07", 180), s("2026-09-14", 180)),
                List.of(m(1, ClassMilestone.Kind.EXAM, "2026-09-10"),
                        m(2, ClassMilestone.Kind.COURSE_END, "2026-09-20")));
        assertThat(out.projectedEndDate()).isEqualTo(LocalDate.parse("2026-09-14"));
        assertThat(out.milestones()).hasSize(2);
        assertThat(out.milestones().get(0).atRisk()).isTrue();  // thi 10/09 trước khi học xong 14/09
        assertThat(out.milestones().get(1).atRisk()).isFalse();
    }

    @Test
    @DisplayName("Thiếu khung → MỌI mốc đều rủi ro (không biết bao giờ xong)")
    void shortfall_flagsAllMilestones() {
        ScheduleForecastDto out = ScheduleForecastService.compute(999, List.of(),
                List.of(m(1, ClassMilestone.Kind.COURSE_END, "2027-01-01")));
        assertThat(out.projectedEndDate()).isNull();
        assertThat(out.milestones().get(0).atRisk()).isTrue();
    }

    @Test
    @DisplayName("adjusted(): gỡ theo ngày + thêm buổi mới, giữ thứ tự thời gian")
    void adjusted_removesAndAddsSorted() {
        List<ScheduleForecastService.FutureSession> base =
                List.of(s("2026-09-07", 180), s("2026-09-09", 180));
        List<ScheduleForecastService.FutureSession> out = ScheduleForecastService.adjusted(
                base,
                List.of(s("2026-09-08", 180)),
                List.of(LocalDate.parse("2026-09-09")));
        assertThat(out).containsExactly(s("2026-09-07", 180), s("2026-09-08", 180));
    }
}
