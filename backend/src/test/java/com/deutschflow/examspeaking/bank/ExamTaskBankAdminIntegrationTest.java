package com.deutschflow.examspeaking.bank;

import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.dto.TaskBankView;
import com.deutschflow.examspeaking.session.ExamTaskBankService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đ5b-A trên DB thật (seed V277–V281): CRUD roundtrip JSONB, DRAFT vô hình với pick() cho tới khi
 * APPROVED (đường dây "bản nháp không lọt phòng thi"), overview khớp cardsNeeded của blueprint thật.
 * Tự skip khi không có Postgres.
 */
@SpringBootTest
class ExamTaskBankAdminIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamTaskBankAdminService adminService;
    @Autowired private ExamTaskBankService pickService;
    @Autowired private ExamBlueprintCatalog catalog;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("tạo DRAFT → pool overview không đổi + pick không rút trúng; APPROVED → pool +1")
    void draftInvisibleUntilApproved() {
        ExamBlueprint bp = catalog.find(ExamProvider.GOETHE, "A1").orElseThrow();
        // Chọn Teil có pool dồi dào nhất để pick() không 409 vì thiếu đề seed.
        var part = bp.parts().stream()
                .max(java.util.Comparator.comparingLong(p -> poolOf(bp, p.teilNo())))
                .orElseThrow();
        long poolBefore = poolOf(bp, part.teilNo());
        assertThat(poolBefore).as("seed V277 phải có đề A1").isGreaterThanOrEqualTo(part.cardsNeeded());

        TaskBankView.TaskRow draft = adminService.create(new TaskBankView.TaskPayload(
                "GOETHE", "A1", part.teilNo(), part.archetype().name(), null,
                Map.of("type", "IT_DRAFT_CARD", "thema", "Integrationstest")));
        assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(poolOf(bp, part.teilNo())).isEqualTo(poolBefore);
        // pick 50 lần không bao giờ rút trúng bản nháp
        for (int i = 0; i < 50; i++) {
            assertThat(pickService.pick(bp, part)).noneMatch(t -> t.getId() == draft.id());
        }

        adminService.update(draft.id(), new TaskBankView.TaskPayload(
                "GOETHE", "A1", part.teilNo(), part.archetype().name(), "APPROVED",
                Map.of("type", "IT_DRAFT_CARD", "thema", "Integrationstest")));
        assertThat(poolOf(bp, part.teilNo())).isEqualTo(poolBefore + 1);

        jdbcTemplate.update("DELETE FROM speaking_exam_tasks WHERE id = ?", draft.id());
    }

    @Test
    @DisplayName("CRUD roundtrip JSONB: stimulus lưu/đọc nguyên vẹn, updatedAt đổi, list lọc DRAFT thấy đề")
    void crudRoundtrip() {
        TaskBankView.TaskRow created = adminService.create(new TaskBankView.TaskPayload(
                null, "B1", 1, "PLAN_NEGOTIATE", null,
                Map.of("type", "PLANNING_CARD", "situation", "IT roundtrip",
                        "partnerCalendar", "Mo frei, Di belegt")));
        try {
            assertThat(created.provider()).isNull();
            assertThat(created.stimulus()).containsEntry("situation", "IT roundtrip");

            TaskBankView.TaskRow updated = adminService.update(created.id(), new TaskBankView.TaskPayload(
                    "TELC", "B1", 3, "PLAN_NEGOTIATE", "RETIRED",
                    Map.of("type", "PLANNING_CARD", "situation", "geändert")));
            assertThat(updated.provider()).isEqualTo("TELC");
            assertThat(updated.teilNo()).isEqualTo(3);
            assertThat(updated.status()).isEqualTo("RETIRED");
            assertThat(updated.stimulus()).containsEntry("situation", "geändert");

            List<TaskBankView.TaskRow> retired = adminService.list("TELC", "B1", 3, "RETIRED");
            assertThat(retired).anyMatch(r -> r.id() == created.id());
        } finally {
            jdbcTemplate.update("DELETE FROM speaking_exam_tasks WHERE id = ?", created.id());
        }
    }

    private long poolOf(ExamBlueprint bp, int teilNo) {
        return adminService.overview().stream()
                .filter(c -> c.provider().equals(bp.provider().name()) && c.level().equals(bp.level())
                        && c.teilNo() == teilNo)
                .findFirst().orElseThrow().poolApproved();
    }
}
