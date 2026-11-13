package com.deutschflow.examstudio;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.common.exception.GlobalExceptionHandler.ProblemDetail;
import com.deutschflow.common.exception.GuidedException;
import com.deutschflow.examstudio.ApprovalGuide.Blocker;
import com.deutschflow.examstudio.ApprovalGuide.Facts;
import com.deutschflow.examstudio.ApprovalGuide.TeilBlockers;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Thông báo "chưa duyệt được" phải trả lời đủ ba câu: chuyện gì, ở đâu, làm gì (owner yêu cầu 13/11/2026).
 */
class ApprovalGuideTest {

    private static Facts ok() {
        return new Facts("DRAFT", false, true, true, true, List.of(), true, true, true, null);
    }

    private static Facts stale() {
        return new Facts("DRAFT", false, true, true, false, List.of(), true, true, true, null);
    }

    @Test
    @DisplayName("bản nháp đạt mọi điều kiện ⇒ không có lý do chặn")
    void noBlockersWhenReady() {
        assertThat(ApprovalGuide.blockers(ok())).isEmpty();
    }

    @Test
    @DisplayName("sửa sau lần tự kiểm ⇒ nói rõ vì sao và bấm gì ở bước nào")
    void staleVerify() {
        assertThat(ApprovalGuide.blockers(stale())).singleElement().satisfies(b -> {
            assertThat(b.code()).isEqualTo("VERIFY_STALE");
            assertThat(b.what()).contains("đã được sửa sau lần tự kiểm gần nhất");
            assertThat(b.action()).contains("Mở bản nháp", "Kiểm & duyệt", "Chạy tự kiểm");
        });
    }

    @Test
    @DisplayName("mỗi lý do chặn đều có mã, chuyện gì và việc cần làm; không lộ thuật ngữ nội bộ")
    void everyBlockerAnswersWhatAndAction() {
        List<Facts> cases = List.of(
                new Facts("DISCARDED", false, true, true, true, List.of(), true, true, true, null),
                new Facts("APPROVED", false, true, true, true, List.of(), true, true, true, null),
                new Facts("DRAFT", true, true, true, true, List.of(), true, true, true, null),
                new Facts("DRAFT", false, false, false, false, List.of(), true, true, true, null),
                new Facts("DRAFT", false, true, false, false, List.of(), true, true, true, null),
                stale(),
                new Facts("DRAFT", false, true, true, true, List.of("Trùng nguồn", "câu 3"), true, true, true, null),
                new Facts("DRAFT", false, true, true, true, List.of(), false, true, true, null),
                new Facts("DRAFT", false, true, true, true, List.of(), true, true, false, null),
                new Facts("DRAFT", false, true, true, true, List.of(), true, true, true, 57L));
        assertThat(cases).allSatisfy(f -> assertThat(ApprovalGuide.blockers(f)).isNotEmpty().allSatisfy(b -> {
            assertThat(b.code()).matches("[A-Z_]+");
            assertThat(b.what()).isNotBlank();
            assertThat(b.action()).isNotBlank();
            assertThat(b.what() + " " + b.action()).doesNotContainIgnoringCase("hash").doesNotContainIgnoringCase("stage")
                    .doesNotContainIgnoringCase("job").doesNotContain("RED").doesNotContain("busy");
        }));
        assertThat(ApprovalGuide.blockers(cases.get(6)).get(0).what()).contains("Còn 2 mục đỏ", "Trùng nguồn", "câu 3");
        assertThat(ApprovalGuide.blockers(cases.get(9)).get(0).what()).contains("Teil #57");
        // Teil tình huống (không cần nguồn báo) không bị chặn vì thiếu nguồn.
        assertThat(ApprovalGuide.blockers(new Facts("DRAFT", false, true, true, true, List.of(), false, false, true, null)))
                .isEmpty();
    }

    @Test
    @DisplayName("tên Teil đúng cách gọi trên giao diện")
    void slotLabels() {
        assertThat(ApprovalGuide.slotLabel("HOEREN", 2)).isEqualTo("Hören T2");
        assertThat(ApprovalGuide.slotLabel("LESEN", 3)).isEqualTo("Lesen T3");
        assertThat(ApprovalGuide.slotLabel("SPRACHBAUSTEINE", 1)).isEqualTo("Sprachbausteine T1");
        assertThat(ApprovalGuide.slotLabel("SCHREIBEN", 1)).isEqualTo("Schreiben T1");
    }

    @Test
    @DisplayName("duyệt cả bộ: một lỗi liệt kê mọi Teil chưa đạt — lượt nào, Teil nào, bản nháp nào, làm gì, đường dẫn")
    void runNotApprovableListsEveryTeil() {
        List<Blocker> why = ApprovalGuide.blockers(stale());
        GuidedException e = ApprovalGuide.runNotApprovable(11, 9, List.of(
                new TeilBlockers("HOEREN", 2, 103L, why),
                new TeilBlockers("LESEN", 3, 98L, why),
                new TeilBlockers("SCHREIBEN", 1, null, List.of(ApprovalGuide.noDraft()))));

        // Đoạn chữ đứng riêng (client cũ, mobile) đủ cả ba ý.
        assertThat(e.getMessage())
                .contains("Chưa duyệt được lượt #11", "3 trong 9 Teil chưa đạt")
                .contains("Hören T2 · bản nháp #103", "Lesen T3 · bản nháp #98", "Schreiben T1")
                .contains("đã được sửa sau lần tự kiểm gần nhất")
                .contains("Chạy tự kiểm", "Làm lại Teil này")
                .contains("quay lại lượt #11", "Duyệt cả bộ");

        assertThat(e.getCode()).isEqualTo("EXAM_SET_RUN_NOT_APPROVABLE");
        assertThat(e.getWhere()).containsEntry("runId", 11L);
        assertThat(e.getIssues()).hasSize(3);
        GuidedException.Issue first = e.getIssues().get(0);
        assertThat(first.label()).isEqualTo("Hören T2 · bản nháp #103");
        assertThat(first.url()).isEqualTo("/v2/admin/exam-studio/103");
        assertThat(first.where()).containsEntry("runId", 11L).containsEntry("section", "HOEREN")
                .containsEntry("teil", 2).containsEntry("draftId", 103L);
        assertThat(e.getIssues().get(2).url()).isNull();
    }

    @Test
    @DisplayName("API trả 409: detail là đoạn chữ đủ ý, extensions mang mã, đối tượng, từng mục và việc sau cùng")
    @SuppressWarnings("unchecked")
    void problemDetailCarriesStructure() {
        GuidedException e = ApprovalGuide.runNotApprovable(11, 9,
                List.of(new TeilBlockers("HOEREN", 2, 103L, ApprovalGuide.blockers(stale()))));
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/admin/exam-studio/set-runs/11/approve");

        ResponseEntity<ProblemDetail> res = new GlobalExceptionHandler().handleGuided(e, req);

        assertThat(res.getStatusCode().value()).isEqualTo(409);
        ProblemDetail body = res.getBody();
        assertThat(body).isNotNull();
        assertThat(body.type()).endsWith("conflict");
        assertThat(body.detail()).isEqualTo(e.getMessage()).contains("Hören T2 · bản nháp #103");
        Map<String, Object> ext = body.extensions();
        assertThat(ext).containsEntry("code", "EXAM_SET_RUN_NOT_APPROVABLE").containsKeys("title", "where", "issues", "next");
        List<Map<String, Object>> issues = (List<Map<String, Object>>) ext.get("issues");
        assertThat(issues).singleElement().satisfies(i -> assertThat(i)
                .containsEntry("code", "VERIFY_STALE").containsEntry("url", "/v2/admin/exam-studio/103")
                .containsKeys("label", "what", "action", "where"));
    }

    @Test
    @DisplayName("duyệt một bản nháp: nêu bản nháp và Teil, kèm việc cần làm")
    void draftNotApprovable() {
        GuidedException e = ApprovalGuide.draftNotApprovable(103, "HOEREN", 2, ApprovalGuide.blockers(stale()));
        assertThat(e.getStatus().value()).isEqualTo(409);
        assertThat(e.getCode()).isEqualTo("EXAM_DRAFT_NOT_APPROVABLE");
        assertThat(e.getMessage()).contains("Chưa duyệt được bản nháp #103 (Hören T2)", "Chạy tự kiểm", "Duyệt và đưa vào kho");
    }
}
