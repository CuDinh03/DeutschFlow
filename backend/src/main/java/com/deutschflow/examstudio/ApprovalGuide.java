package com.deutschflow.examstudio;

import com.deutschflow.common.exception.GuidedException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Câu chữ cho lỗi "chưa duyệt được" của Xưởng đề (owner yêu cầu 13/11/2026 sau lượt #11: toast chỉ ghi "Nội dung
 * đã đổi sau lần tự kiểm cuối", không biết Teil nào, vào đâu sửa). Mỗi lý do trả lời đủ: chuyện gì, ở đâu, làm gì.
 * Hàm thuần, không đụng DB — {@link ExamDraftService#approvalBlockers} gom dữ kiện rồi gọi vào đây.
 *
 * <p>Tên gọi dùng đúng chữ trên giao diện: "Lượt #11", "Hören T2", "bản nháp #103", bước "Kiểm & duyệt",
 * nút "Chạy tự kiểm", "Làm lại Teil này", "Duyệt cả bộ".
 */
final class ApprovalGuide {

    private ApprovalGuide() {}

    /** Một lý do khiến bản nháp chưa vào kho được. */
    record Blocker(String code, String what, String action) {}

    /** Dữ kiện của một bản nháp, đủ để quyết định có duyệt được không. */
    record Facts(String status, boolean busy, boolean hasContent, boolean everVerified, boolean verifiedCurrent,
                 List<String> redLabels, boolean hasUsedSource, boolean sourceRequired, boolean usageConfirmed,
                 Long duplicateBlockId) {}

    /** Các Teil chưa đạt của một lượt. */
    record TeilBlockers(String section, int teil, Long draftId, List<Blocker> blockers) {}

    static final String REVIEW_STEP = "bước \"Kiểm & duyệt\"";

    static List<Blocker> blockers(Facts f) {
        List<Blocker> out = new ArrayList<>();
        if ("DISCARDED".equals(f.status())) {
            out.add(new Blocker("DRAFT_DISCARDED", "Bản nháp đã bị bỏ nên không duyệt được",
                    "Tạo bản nháp mới cho Teil này; trong lượt tạo bộ đề thì bấm \"Làm lại Teil này\""));
            return out;
        }
        if ("APPROVED".equals(f.status())) {
            out.add(new Blocker("DRAFT_ALREADY_APPROVED", "Bản nháp đã được duyệt vào kho từ trước",
                    "Không cần duyệt lại; xem Teil ở tab \"Kho Teil\""));
            return out;
        }
        if (f.busy()) {
            out.add(new Blocker("DRAFT_BUSY", "Máy đang chạy một thao tác AI trên bản nháp này",
                    "Đợi máy chạy xong (màn hình bản nháp tự cập nhật) rồi bấm duyệt lại"));
            return out;
        }
        if (!f.hasContent()) {
            out.add(new Blocker("DRAFT_EMPTY", "Bản nháp chưa có bài và câu hỏi",
                    "Mở bản nháp, viết bài ở bước \"Bài đọc\", sinh câu ở bước \"Câu hỏi\", rồi sang " + REVIEW_STEP
                            + " bấm \"Chạy tự kiểm\""));
            return out;
        }
        if (!f.everVerified()) {
            out.add(new Blocker("NOT_VERIFIED", "Bản nháp chưa chạy tự kiểm lần nào",
                    "Mở bản nháp, sang " + REVIEW_STEP + ", bấm \"Chạy tự kiểm\" và đợi chạy xong"));
        } else if (!f.verifiedCurrent()) {
            out.add(new Blocker("VERIFY_STALE",
                    "Bài hoặc câu hỏi đã được sửa sau lần tự kiểm gần nhất, nên kết quả tự kiểm cũ không còn đúng",
                    "Mở bản nháp, sang " + REVIEW_STEP + ", bấm \"Chạy tự kiểm\" và đợi chạy xong"));
        } else if (!f.redLabels().isEmpty()) {
            out.add(new Blocker("RED_LIGHTS",
                    "Còn " + f.redLabels().size() + " mục đỏ sau tự kiểm: " + String.join("; ", f.redLabels()),
                    "Mở bản nháp, sửa các mục đỏ, rồi ở " + REVIEW_STEP + " bấm \"Chạy tự kiểm\" cho tới khi hết đỏ"));
        }
        if (f.sourceRequired() && !f.hasUsedSource()) {
            out.add(new Blocker("NO_SOURCE", "Chưa có nguồn nào có dữ kiện được tích",
                    "Mở bản nháp, ở bước \"Nguồn\" thêm nguồn và tích ít nhất một dữ kiện"));
        }
        if (!f.usageConfirmed()) {
            out.add(new Blocker("USAGE_UNCONFIRMED", "Có nguồn chưa được xác nhận loại dùng",
                    "Mở bản nháp, ở bước \"Nguồn\" bấm \"Xác nhận\" loại dùng (Chuyển thể hoặc Chỉ dữ kiện) cho từng nguồn"));
        }
        if (f.duplicateBlockId() != null) {
            out.add(new Blocker("DUPLICATE_BLOCK", "Nội dung giống hệt Teil #" + f.duplicateBlockId() + " đã có trong kho",
                    "Sửa bài hoặc câu hỏi cho khác đi rồi chạy tự kiểm lại; trong lượt tạo bộ đề thì bấm \"Làm lại Teil này\""));
        }
        return out;
    }

    /** "Hören T2" — cùng cách gọi với bảng lượt và tab Bộ đề trên web. */
    static String slotLabel(String section, int teil) {
        String s = section == null ? "" : section.toUpperCase();
        String name = switch (s) {
            case "LESEN" -> "Lesen";
            case "SPRACHBAUSTEINE" -> "Sprachbausteine";
            case "HOEREN" -> "Hören";
            case "SCHREIBEN" -> "Schreiben";
            default -> section;
        };
        return name + " T" + teil;
    }

    static String draftUrl(long draftId) {
        return "/v2/admin/exam-studio/" + draftId;
    }

    /** Duyệt MỘT bản nháp (admin đang đứng ở bản nháp đó). */
    static GuidedException draftNotApprovable(long draftId, String section, int teil, List<Blocker> blockers) {
        String label = slotLabel(section, teil) + " · bản nháp #" + draftId;
        GuidedException.Builder b = GuidedException
                .conflict("EXAM_DRAFT_NOT_APPROVABLE", "Chưa duyệt được bản nháp #" + draftId + " (" + slotLabel(section, teil) + ")")
                .where("draftId", draftId).where("section", section).where("teil", teil);
        for (Blocker k : blockers) {
            b.issue(k.code(), label, k.what(), k.action(), draftUrl(draftId), where(null, section, teil, draftId));
        }
        return b.next("Xong thì bấm \"Duyệt và đưa vào kho\" lần nữa").build();
    }

    /** Duyệt cả bộ: báo MỘT lần mọi Teil chưa đạt, mỗi Teil kèm đường dẫn mở thẳng bản nháp. */
    static GuidedException runNotApprovable(long runId, int totalTeile, List<TeilBlockers> failing) {
        GuidedException.Builder b = GuidedException
                .conflict("EXAM_SET_RUN_NOT_APPROVABLE", "Chưa duyệt được lượt #" + runId + ": "
                        + failing.size() + " trong " + totalTeile + " Teil chưa đạt, chưa Teil nào vào kho")
                .where("runId", runId);
        for (TeilBlockers t : failing) {
            String slot = slotLabel(t.section(), t.teil());
            String label = t.draftId() == null ? slot : slot + " · bản nháp #" + t.draftId();
            String url = t.draftId() == null ? null : draftUrl(t.draftId());
            for (Blocker k : t.blockers()) {
                b.issue(k.code(), label, k.what(), k.action(), url, where(runId, t.section(), t.teil(), t.draftId()));
            }
        }
        return b.next("Sửa xong các Teil trên thì quay lại lượt #" + runId + " và bấm \"Duyệt cả bộ\" lần nữa").build();
    }

    /** Teil của lượt không có bản nháp (hiếm: bản nháp bị gỡ khỏi lượt). */
    static Blocker noDraft() {
        return new Blocker("TEIL_HAS_NO_DRAFT", "Teil này chưa có bản nháp",
                "Ở lượt, bấm \"Làm lại Teil này\" để máy tạo lại");
    }

    private static Map<String, Object> where(Long runId, String section, int teil, Long draftId) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (runId != null) m.put("runId", runId);
        m.put("section", section);
        m.put("teil", teil);
        if (draftId != null) m.put("draftId", draftId);
        return m;
    }
}
