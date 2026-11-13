package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.GuidedException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Thông báo của lượt tạo bộ đề: đủ chuyện gì, ở đâu, làm gì (owner yêu cầu 13/11/2026). */
class RunGuideTest {

    @Test
    @DisplayName("có lượt đang chạy: nêu lượt nào, trạng thái gì, nút vừa bấm và đường dẫn tới lượt đó")
    void anotherRunActive() {
        GuidedException e = RunGuide.anotherRunActive(12, "RUNNING", RunGuide.BTN_REDO);
        assertThat(e).isInstanceOf(BadRequestException.class);
        assertThat(e.getStatus().value()).isEqualTo(400);
        assertThat(e.getCode()).isEqualTo("EXAM_SET_RUN_ANOTHER_ACTIVE");
        assertThat(e.getMessage()).contains("lượt #12 đang chạy", "Mỗi lúc máy chỉ chạy một lượt", "\"Đang chạy\"",
                "Bỏ lượt", "bấm lại \"Làm lại Teil này\"");
        assertThat(e.getIssues()).singleElement().satisfies(i -> {
            assertThat(i.url()).isEqualTo("/v2/admin/exam-studio?tab=assemblies&run=12");
            assertThat(i.where()).containsEntry("runId", 12L);
        });
    }

    @Test
    @DisplayName("nút dùng sai trạng thái: nói lượt đang ở trạng thái gì và việc hợp lý tiếp theo")
    void wrongStatus() {
        GuidedException review = RunGuide.wrongStatus(11, "REVIEW", RunGuide.BTN_RECHECK, "đang \"Cần bạn xem\"");
        assertThat(review.getMessage()).contains("lượt #11", "\"Sẵn sàng duyệt\"", "\"Kiểm lại bộ\"", "\"Cần bạn xem\"",
                "bấm \"Duyệt cả bộ\"");
        GuidedException running = RunGuide.wrongStatus(11, "RUNNING", RunGuide.BTN_APPROVE, "đang \"Sẵn sàng duyệt\"");
        assertThat(running.getMessage()).contains("\"Đang chạy\"", "Đợi lượt chạy xong");
        GuidedException stuck = RunGuide.wrongStatus(11, "NEEDS_ATTENTION", RunGuide.BTN_APPROVE, "đang \"Sẵn sàng duyệt\"");
        assertThat(stuck.getMessage()).contains("\"Cần bạn xem\"", "Vì sao kẹt và sửa thế nào", "\"Kiểm lại bộ\"");
        for (String s : List.of("PLANNING", "RUNNING", "REVIEW", "NEEDS_ATTENTION", "APPROVED", "DISCARDED")) {
            assertThat(RunGuide.statusLabel(s)).isNotEqualTo(s);
            assertThat(RunGuide.adviceFor(s)).isNotBlank();
        }
    }

    @Test
    @DisplayName("bản nháp đang bận: nêu Teil, số bản nháp, đường dẫn mở bản nháp và nút bấm lại")
    void draftBusy() {
        GuidedException e = RunGuide.draftBusy(11, "HOEREN", 2, 103, RunGuide.BTN_RECHECK);
        assertThat(e.getMessage()).contains("lượt #11", "Hören T2 · bản nháp #103", "Đợi máy chạy xong", "\"Kiểm lại bộ\"")
                .doesNotContain("HOEREN");
        assertThat(e.getIssues().get(0).url()).isEqualTo("/v2/admin/exam-studio/103");
    }

    @Test
    @DisplayName("Teil đã vào kho: nói vì sao không làm lại được và cách có Teil khác")
    void teilAlreadyApproved() {
        GuidedException e = RunGuide.teilAlreadyApproved(6, "LESEN", 1, 41);
        assertThat(e.getMessage()).contains("Không làm lại được Lesen T1 của lượt #6", "đã được duyệt vào kho", "Tạo Teil mới");
    }

    @Test
    @DisplayName("thao tác treo quá hạn: gọi tên thao tác như trên giao diện, không lộ mã nội bộ")
    void timedOut() {
        assertThat(RunGuide.timedOut("TEXT", 20)).isEqualTo("Thao tác \"Viết bài\" chạy quá 20 phút nên máy đã dừng.");
        assertThat(RunGuide.timedOut("VERIFY", 20)).contains("Tự kiểm");
        for (String op : List.of("FACTS", "TEXT", "ITEMS", "ITEM", "VERIFY")) {
            assertThat(RunGuide.timedOut(op, 20)).doesNotContain(op);
        }
        // Lời này không được bị coi là lỗi của model (lượt dùng tiền tố câu để phân loại).
        assertThat(ExamSetRunService.isModelError(RunGuide.timedOut("TEXT", 20))).isFalse();
    }

    @Test
    @DisplayName("chuông khi lượt xong: sẵn sàng duyệt thì nói bấm gì")
    void alertReady() {
        RunGuide.Alert a = RunGuide.finished(11, "telc B1", 9, List.of(), List.of());
        assertThat(a.title()).isEqualTo("Bộ đề telc B1 sẵn sàng duyệt");
        assertThat(a.message()).contains("#11", "9 Teil", "Duyệt cả bộ");
    }

    @Test
    @DisplayName("chuông khi lượt kẹt: nêu đích danh Teil kẹt và việc cần làm")
    void alertStuck() {
        RunGuide.Alert a = RunGuide.finished(11, "telc B1", 9, List.of("Hören T2", "Lesen T3"), List.of());
        assertThat(a.title()).isEqualTo("Bộ đề telc B1 cần bạn xem");
        assertThat(a.message()).contains("#11", "2 trong 9 Teil kẹt", "Hören T2, Lesen T3", "Vì sao kẹt và sửa thế nào",
                "Kiểm lại bộ").doesNotContain("Kiểm cấp bộ còn");
    }

    @Test
    @DisplayName("chuông khi không Teil nào kẹt nhưng kiểm cấp bộ đỏ: KHÔNG báo sẵn sàng duyệt")
    void alertSetChecksRed() {
        RunGuide.Alert a = RunGuide.finished(11, "telc B1", 9, List.of(), List.of("Trùng với Teil kho"));
        assertThat(a.title()).isEqualTo("Bộ đề telc B1 cần bạn xem");
        assertThat(a.message()).contains("Kiểm cấp bộ còn 1 mục đỏ: Trùng với Teil kho", "Làm lại Teil này", "Kiểm lại bộ")
                .doesNotContain("Teil kẹt sau khi");
        RunGuide.Alert both = RunGuide.finished(11, "telc B1", 9, List.of("Hören T2"), List.of("Trùng với Teil kho"));
        assertThat(both.message()).contains("1 trong 9 Teil kẹt", "Kiểm cấp bộ còn 1 mục đỏ", "Kiểm lại bộ");
    }
}
