package com.deutschflow.examstudio;

import com.deutschflow.common.exception.GuidedException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Câu chữ cho các thông báo của "lượt tạo bộ đề" (owner yêu cầu 13/11/2026): mỗi thông báo nói đủ chuyện gì,
 * ở đâu (lượt nào, Teil nào, bản nháp nào), làm gì tiếp. Hàm thuần, không đụng DB.
 *
 * <p>Tên gọi dùng đúng chữ trên giao diện: trạng thái lượt ("Đang chạy", "Cần bạn xem", "Sẵn sàng duyệt"…),
 * nút ("Tạo bộ đề telc B1", "Kiểm lại bộ", "Làm lại Teil này", "Tạo phần Nghe", "Duyệt cả bộ", "Bỏ lượt").
 */
final class RunGuide {

    private RunGuide() {}

    static final String BTN_START = "Tạo bộ đề telc B1";
    static final String BTN_RECHECK = "Kiểm lại bộ";
    static final String BTN_REDO = "Làm lại Teil này";
    static final String BTN_ADD_HOEREN = "Tạo phần Nghe";
    static final String BTN_APPROVE = "Duyệt cả bộ";

    /** Tab "Bộ đề" của Xưởng đề, cuộn tới thẻ của lượt. */
    static String runUrl(long runId) {
        return "/v2/admin/exam-studio?tab=assemblies&run=" + runId;
    }

    static String statusLabel(String status) {
        return switch (status == null ? "" : status) {
            case "PLANNING" -> "Đang lập kế hoạch";
            case "RUNNING" -> "Đang chạy";
            case "REVIEW" -> "Sẵn sàng duyệt";
            case "NEEDS_ATTENTION" -> "Cần bạn xem";
            case "APPROVED" -> "Đã duyệt";
            case "DISCARDED" -> "Đã bỏ";
            default -> status;
        };
    }

    /** Lượt đang ở trạng thái này thì việc hợp lý tiếp theo là gì. */
    static String adviceFor(String status) {
        return switch (status == null ? "" : status) {
            case "PLANNING", "RUNNING" -> "Đợi lượt chạy xong (bảng tự cập nhật mỗi 10 giây) rồi bấm lại";
            case "REVIEW" -> "Lượt đã đủ điều kiện: xem lại các Teil rồi bấm \"" + BTN_APPROVE + "\"";
            case "NEEDS_ATTENTION" -> "Sửa các Teil kẹt theo mục \"Vì sao kẹt và sửa thế nào\", rồi bấm \"" + BTN_RECHECK + "\"";
            case "APPROVED" -> "Lượt đã duyệt xong; bộ đề nằm ở danh sách \"Bộ đề đã ghép\" bên dưới";
            case "DISCARDED" -> "Lượt đã bỏ; bấm \"" + BTN_START + "\" để tạo lượt mới";
            default -> "Tải lại trang rồi thử lại";
        };
    }

    /** Mỗi lúc chỉ một lượt chạy: nói rõ lượt nào đang chạy và nút vừa bấm là nút nào. */
    static GuidedException anotherRunActive(long activeRunId, String activeStatus, String button) {
        return GuidedException.badRequest("EXAM_SET_RUN_ANOTHER_ACTIVE",
                        "Chưa chạy được \"" + button + "\": lượt #" + activeRunId + " đang chạy")
                .where("runId", activeRunId)
                .issue("ANOTHER_RUN_ACTIVE", "Lượt #" + activeRunId,
                        "Mỗi lúc máy chỉ chạy một lượt tạo bộ đề, và lượt #" + activeRunId + " đang ở trạng thái \""
                                + statusLabel(activeStatus) + "\"",
                        "Đợi lượt #" + activeRunId + " chạy xong (bảng tự cập nhật mỗi 10 giây), hoặc bấm \"Bỏ lượt\" ở lượt đó nếu không cần nữa",
                        runUrl(activeRunId), Map.of("runId", activeRunId))
                .next("Sau đó bấm lại \"" + button + "\"")
                .build();
    }

    /** Nút chỉ dùng được ở một số trạng thái của lượt. */
    static GuidedException wrongStatus(long runId, String status, String button, String usableWhen) {
        return GuidedException.badRequest("EXAM_SET_RUN_WRONG_STATUS",
                        "Chưa dùng được \"" + button + "\" cho lượt #" + runId)
                .where("runId", runId).where("status", status)
                .issue("WRONG_STATUS", "Lượt #" + runId,
                        "Lượt đang ở trạng thái \"" + statusLabel(status) + "\"; nút \"" + button + "\" chỉ dùng cho lượt " + usableWhen,
                        adviceFor(status), runUrl(runId), Map.of("runId", runId))
                .build();
    }

    /** Bản nháp của một Teil đang được máy xử lý nên chưa làm tiếp được. */
    static GuidedException draftBusy(long runId, String section, int teil, long draftId, String button) {
        return GuidedException.badRequest("EXAM_SET_RUN_DRAFT_BUSY",
                        "Chưa chạy được \"" + button + "\" cho lượt #" + runId)
                .where("runId", runId)
                .issue("DRAFT_BUSY", teilLabel(section, teil, draftId),
                        "Máy đang chạy một thao tác AI trên bản nháp này",
                        "Đợi máy chạy xong (mở bản nháp để xem tiến độ, màn hình tự cập nhật)",
                        ApprovalGuide.draftUrl(draftId), where(runId, section, teil, draftId))
                .next("Sau đó quay lại lượt #" + runId + " và bấm lại \"" + button + "\"")
                .build();
    }

    static GuidedException teilAlreadyApproved(long runId, String section, int teil, long draftId) {
        return GuidedException.badRequest("EXAM_SET_RUN_TEIL_APPROVED",
                        "Không làm lại được " + ApprovalGuide.slotLabel(section, teil) + " của lượt #" + runId)
                .where("runId", runId)
                .issue("TEIL_APPROVED", teilLabel(section, teil, draftId),
                        "Teil này đã được duyệt vào kho, nên máy không bỏ bản nháp để tạo lại",
                        "Giữ nguyên Teil này. Nếu cần một Teil khác cho ô này, tạo bản nháp riêng bằng nút \"Tạo Teil mới\" ở tab \"Bản nháp\"",
                        ApprovalGuide.draftUrl(draftId), where(runId, section, teil, draftId))
                .build();
    }

    /** Tên thao tác AI đúng như nhãn trên giao diện, thay cho mã nội bộ (TEXT, ITEMS…). */
    static String opLabel(String op) {
        return switch (op == null ? "" : op) {
            case "FACTS" -> "Rút dữ kiện";
            case "TEXT" -> "Viết bài";
            case "ITEMS" -> "Ra câu hỏi";
            case "ITEM" -> "Sinh lại câu";
            case "VERIFY" -> "Tự kiểm";
            default -> "AI";
        };
    }

    /** Lời ghi vào bản nháp khi một thao tác AI treo quá hạn và bị máy dừng. */
    static String timedOut(String op, long minutes) {
        return "Thao tác \"" + opLabel(op) + "\" chạy quá " + minutes + " phút nên máy đã dừng.";
    }

    static String teilLabel(String section, int teil, Long draftId) {
        String slot = ApprovalGuide.slotLabel(section, teil);
        return draftId == null ? slot : slot + " · bản nháp #" + draftId;
    }

    // ── Thông báo chuông khi lượt chạy xong ──────────────────────────────────────────────────────────────

    record Alert(String title, String message) {}

    /**
     * @param examName   vd. "telc B1"
     * @param stuck      nhãn các Teil kẹt ("Hören T2")
     * @param redChecks  nhãn các mục kiểm cấp bộ còn đỏ
     */
    static Alert finished(long runId, String examName, int totalTeile, List<String> stuck, List<String> redChecks) {
        if (stuck.isEmpty() && redChecks.isEmpty()) {
            return new Alert("Bộ đề " + examName + " sẵn sàng duyệt",
                    "Lượt tạo bộ đề #" + runId + " đã chạy xong " + totalTeile + " Teil và qua kiểm cấp bộ. "
                            + "Mở lượt, xem lại từng Teil rồi bấm \"" + BTN_APPROVE + "\".");
        }
        StringBuilder sb = new StringBuilder("Lượt tạo bộ đề #" + runId + " đã dừng nhưng chưa duyệt được.");
        if (!stuck.isEmpty()) {
            sb.append(' ').append(stuck.size()).append(" trong ").append(totalTeile)
                    .append(" Teil kẹt sau khi máy tự sửa: ").append(String.join(", ", stuck)).append('.');
        }
        if (!redChecks.isEmpty()) {
            sb.append(" Kiểm cấp bộ còn ").append(redChecks.size()).append(" mục đỏ: ")
                    .append(String.join("; ", redChecks)).append('.');
        }
        sb.append(" Mở lượt, ");
        if (!stuck.isEmpty()) sb.append("sửa từng Teil kẹt theo mục \"Vì sao kẹt và sửa thế nào\"");
        if (!stuck.isEmpty() && !redChecks.isEmpty()) sb.append(", ");
        if (!redChecks.isEmpty()) sb.append("xem mục \"Kiểm cấp bộ\" và sửa hoặc bấm \"" + BTN_REDO + "\" ở Teil liên quan");
        sb.append(", rồi bấm \"" + BTN_RECHECK + "\".");
        return new Alert("Bộ đề " + examName + " cần bạn xem", sb.toString());
    }

    private static Map<String, Object> where(long runId, String section, int teil, Long draftId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", runId);
        m.put("section", section);
        m.put("teil", teil);
        if (draftId != null) m.put("draftId", draftId);
        return m;
    }
}
