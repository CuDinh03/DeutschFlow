package com.deutschflow.examspeaking.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** DTO màn Golden set (G.1): danh sách phiên, phiếu chấm tay, so sánh máy↔người, regrade. */
public final class GoldenView {

    private GoldenView() {}

    /** Một phiên mock đã có kết quả máy — ứng viên cho golden set. */
    public record SessionRow(
            long sessionId,
            String provider,
            String level,
            Instant createdAt,
            Double machineTotal,
            Double machineMax,
            Boolean machinePassed,
            List<String> raters
    ) {}

    /** Cấu trúc rubric để FE render phiếu chấm đúng hệ. */
    public record SheetStructure(
            String scale,
            List<String> bands,
            List<SheetPart> parts,
            List<SheetCriterion> global
    ) {}

    public record SheetPart(int teilNo, List<SheetCriterion> criteria) {}

    /** {@code item=true} = nhiệm vụ VHN (A1); false = tiêu chí band. */
    public record SheetCriterion(String code, String label, double max, boolean item) {}

    /**
     * @param audioUrl URL nghe lại có hạn (presigned ~1h) — chỉ có ở phiên hiệu chuẩn đã đồng ý lưu audio;
     *                 null nghĩa là chấm trên transcript (đa số phiên).
     */
    public record TurnLine(int teilNo, String role, String transcript, String audioUrl) {}

    /** Người học đã đồng ý cho lưu audio phục vụ hiệu chuẩn. */
    public record Participant(long userId, String displayName, String email, java.time.Instant consentedAt, String note) {}

    /**
     * Kết quả purge audio của một phiên (rút lại đồng ý / dọn dẹp). {@code failed > 0} = S3 từ chối xoá
     * một số key; tham chiếu được GIỮ để xoá lại (F-12) — admin phải thử lại, không coi là đã sạch.
     */
    public record PurgeResult(long sessionId, int deleted, int failed) {}

    public record RatingRow(int teilNo, String criterionCode, String band) {}

    public record Detail(
            long sessionId,
            String provider,
            String level,
            Instant createdAt,
            SheetStructure sheet,
            List<TurnLine> turns,
            Summary machine,
            /** band máy theo khoá "T{teil}:{code}" / "G:{code}" — hiện cạnh ô chấm để đối chiếu. */
            Map<String, String> machineBands,
            List<RatingRow> myRatings
    ) {}

    /** {@code borderline}: khoảng điểm máy vắt qua ngưỡng (F-17) — đối chiếu đạt/trượt bỏ qua phiên này. */
    public record Summary(Double total, Double max, Boolean passed, Boolean borderline) {}

    /** Kết quả sau khi lưu phiếu: điểm người chấm (RubricScorer tính từ band) + đối chiếu nhanh. */
    public record SaveResult(Summary human, Summary machine, Boolean passAgree, AgreementStats bands) {}

    /** Thống kê đồng thuận band trên các cặp (máy có chấm × người có chấm). */
    public record AgreementStats(int pairs, int exact, int within1) {}

    public record CompareRow(
            long sessionId,
            String provider,
            String level,
            String rater,
            Summary machine,
            Summary human,
            AgreementStats bands
    ) {}

    /**
     * Báo cáo gate: đạt/trượt ≥85%, ±1 band ≥90% (kế hoạch mục G). {@code machineBorderline} = số cặp
     * mà máy trả "sát ngưỡng" — loại khỏi mẫu số đạt/trượt, báo riêng để gate theo dõi (≤20%).
     */
    public record CompareReport(
            int sessions,
            int ratedPairs,
            Double passAgreePct,
            Double exactBandPct,
            Double within1BandPct,
            List<CompareRow> rows,
            int machineBorderline
    ) {}

    /** Một phiên trong regrade batch (regression harness — tài liệu gate §6.3). */
    public record RegradeBatchRow(long sessionId, String provider, String level, Double storedTotal, Double freshTotal,
                                  double totalDelta, boolean passedChanged, int bandChanges, String error) {}

    /** Tổng kết regrade batch: chạy lại pipeline chấm trên transcript đóng băng của nhiều phiên, không ghi đè. */
    public record RegradeBatchResult(int requested, int regraded, int failed, int passFlips, double avgTotalDelta,
                                     int totalBandChanges, List<RegradeBatchRow> rows) {}

    public record BandChange(String key, String before, String after) {}

    /** Kết quả regrade (regression): phiếu mới KHÔNG ghi đè kết quả lưu. */
    public record RegradeResult(
            long sessionId,
            Summary stored,
            Summary fresh,
            double totalDelta,
            boolean passedChanged,
            List<BandChange> bandChanges,
            /** Đồng thuận của phiếu MỚI với từng giám khảo người (nếu phiên đã được chấm tay). */
            List<CompareRow> humanAgreement
    ) {}
}
