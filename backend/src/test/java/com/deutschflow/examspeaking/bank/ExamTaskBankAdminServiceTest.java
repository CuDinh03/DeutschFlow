package com.deutschflow.examspeaking.bank;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.deutschflow.examspeaking.dto.TaskBankView;
import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import com.deutschflow.examspeaking.repository.SpeakingExamTaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Đ5b-A: validation payload (đặc biệt guard khoá partner* lạ), ma trận pool, ngữ nghĩa lọc. */
class ExamTaskBankAdminServiceTest {

    private SpeakingExamTaskRepository repo;
    private ExamBlueprintCatalog catalog;
    private ExamTaskBankAdminService service;

    @BeforeEach
    void setUp() {
        repo = mock(SpeakingExamTaskRepository.class);
        catalog = mock(ExamBlueprintCatalog.class);
        service = new ExamTaskBankAdminService(repo, catalog);
        // save gán id như DB thật rồi trả lại entity
        when(repo.save(any())).thenAnswer(inv -> {
            SpeakingExamTask t = inv.getArgument(0);
            if (t.getId() == null) {
                t.setId(100L);
            }
            return t;
        });
    }

    private static SpeakingExamTask task(Long id, String provider, String level, int teil, String archetype, String status) {
        return SpeakingExamTask.builder().id(id).provider(provider).level(level).teilNo(teil)
                .archetype(archetype).status(status).source("CURATED")
                .stimulusJson(Map.of("type", "THEMENKARTE")).build();
    }

    private static TaskBankView.TaskPayload payload(Map<String, Object> stimulus) {
        return new TaskBankView.TaskPayload("GOETHE", "B1", 1, "PLAN_NEGOTIATE", null, stimulus);
    }

    @Test
    @DisplayName("create: mặc định DRAFT + CURATED, provider rỗng thành NULL (đề dùng chung)")
    void createDefaults() {
        TaskBankView.TaskRow row = service.create(new TaskBankView.TaskPayload(
                "", "A1", 3, "REQUEST_RESPOND", null, Map.of("type", "BILDKARTE", "object", "Buch")));
        assertThat(row.status()).isEqualTo("DRAFT");
        assertThat(row.source()).isEqualTo("CURATED");
        assertThat(row.provider()).isNull();
    }

    @Test
    @DisplayName("🪤 khoá partner* lạ bị chặn 400 kèm danh sách khoá AI hỗ trợ — khoá lạ hỏng ÂM THẦM nếu lọt")
    void unknownPartnerKeyRejected() {
        assertThatThrownBy(() -> service.create(payload(Map.of(
                "type", "PLANNING_CARD", "partnerSchedule", "Mo 10:00"))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("partnerSchedule")
                .hasMessageContaining("partnerCalendar");
    }

    @Test
    @DisplayName("khoá partner* đã hỗ trợ (partnerCalendar/partnerStance…) đi qua bình thường")
    void knownPartnerKeysAccepted() {
        TaskBankView.TaskRow row = service.create(payload(Map.of(
                "type", "PLANNING_CARD", "situation", "Ausflug planen",
                "partnerCalendar", "Mo frei, Di belegt", "partnerStance", "dagegen")));
        assertThat(row.stimulus()).containsKey("partnerCalendar");
    }

    @Test
    @DisplayName("validation: thiếu type / archetype sai / level sai / teil sai / status sai → 400")
    void validationRejects() {
        assertThatThrownBy(() -> service.create(payload(Map.of("thema", "Reisen"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("type");
        assertThatThrownBy(() -> service.create(new TaskBankView.TaskPayload(
                "GOETHE", "B1", 1, "KARAOKE", null, Map.of("type", "X"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("archetype");
        assertThatThrownBy(() -> service.create(new TaskBankView.TaskPayload(
                "GOETHE", "Z9", 1, "PRESENT", null, Map.of("type", "X"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("level");
        assertThatThrownBy(() -> service.create(new TaskBankView.TaskPayload(
                "GOETHE", "B1", 9, "PRESENT", null, Map.of("type", "X"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("teilNo");
        assertThatThrownBy(() -> service.create(new TaskBankView.TaskPayload(
                "GOETHE", "B1", 1, "PRESENT", "LIVE", Map.of("type", "X"))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("status");
    }

    @Test
    @DisplayName("update: đổi status + stimulus; id không tồn tại → 404")
    void updateAndNotFound() {
        when(repo.findById(7L)).thenReturn(Optional.of(task(7L, null, "B1", 1, "PLAN_NEGOTIATE", "DRAFT")));
        TaskBankView.TaskRow row = service.update(7L, new TaskBankView.TaskPayload(
                null, "B1", 1, "PLAN_NEGOTIATE", "APPROVED", Map.of("type", "PLANNING_CARD")));
        assertThat(row.status()).isEqualTo("APPROVED");

        when(repo.findById(anyLong())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.update(99L, new TaskBankView.TaskPayload(
                null, "B1", 1, "PLAN_NEGOTIATE", null, Map.of("type", "X"))))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("overview: pool đếm đề APPROVED của hệ + đề dùng chung; DRAFT/RETIRED không tính")
    void overviewCountsSharedAndApprovedOnly() {
        BlueprintPart part = new BlueprintPart(1, TaskArchetype.PLAN_NEGOTIATE, "Gemeinsam planen",
                180, PartFlow.DIALOGUE, "PARTNER", "PLANNING_CARD", 1, 1, 6);
        ExamBlueprint bp = new ExamBlueprint(2, ExamProvider.GOETHE, "B1", 1, "Goethe B1", 900,
                List.of(part), null);
        when(catalog.listActive()).thenReturn(List.of(bp));
        when(repo.findAll()).thenReturn(List.of(
                task(1L, "GOETHE", "B1", 1, "PLAN_NEGOTIATE", "APPROVED"),
                task(2L, null, "B1", 1, "PLAN_NEGOTIATE", "APPROVED"),   // dùng chung → tính
                task(3L, "TELC", "B1", 1, "PLAN_NEGOTIATE", "APPROVED"), // hệ khác → không
                task(4L, "GOETHE", "B1", 1, "PLAN_NEGOTIATE", "DRAFT"),  // nháp → không
                task(5L, "GOETHE", "B1", 1, "PLAN_NEGOTIATE", "RETIRED")));
        List<TaskBankView.PoolCell> cells = service.overview();
        assertThat(cells).hasSize(1);
        assertThat(cells.get(0).poolApproved()).isEqualTo(2);
        assertThat(cells.get(0).cardsNeeded()).isEqualTo(1);
    }

    @Test
    @DisplayName("list: lọc GOETHE gồm cả đề dùng chung (đúng ngữ nghĩa pick); lọc status tách nháp")
    void listFilterSemantics() {
        when(repo.findAll(any(Sort.class))).thenReturn(List.of(
                task(1L, "GOETHE", "B1", 1, "PLAN_NEGOTIATE", "APPROVED"),
                task(2L, null, "B1", 1, "PLAN_NEGOTIATE", "APPROVED"),
                task(3L, "TELC", "B1", 3, "PLAN_NEGOTIATE", "DRAFT")));
        assertThat(service.list("GOETHE", null, null, null)).extracting(TaskBankView.TaskRow::id)
                .containsExactly(1L, 2L);
        assertThat(service.list(null, null, null, "DRAFT")).extracting(TaskBankView.TaskRow::id)
                .containsExactly(3L);
        assertThat(service.list(null, "B1", 1, null)).hasSize(2);
    }
}
