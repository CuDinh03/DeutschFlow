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

    public record TurnLine(int teilNo, String role, String transcript) {}

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

    public record Summary(Double total, Double max, Boolean passed) {}

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

    /** Báo cáo gate: đạt/trượt ≥85%, ±1 band ≥90% (kế hoạch mục G). */
    public record CompareReport(
            int sessions,
            int ratedPairs,
            Double passAgreePct,
            Double exactBandPct,
            Double within1BandPct,
            List<CompareRow> rows
    ) {}

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
