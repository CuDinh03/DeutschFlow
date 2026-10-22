package com.deutschflow.grammar.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Bảng xếp loại theo nhà tổ chức × bậc (LT1). Dữ liệu, không phải logic: thêm Goethe B1 sau này chỉ
 * cần thêm một dòng.
 *
 * <p>telc Deutsch B1 (Zertifikat Deutsch): thang 300 = phần viết 225 + phần nói 75; mỗi phần phải
 * đạt 60 % (cổng trong {@code pass_rule}), rồi xếp loại theo tổng: sehr gut 270–300, gut 240–269,5,
 * befriedigend 210–239,5, ausreichend 180–209,5.
 */
public final class ExamGradeBands {

    private ExamGradeBands() {}

    /** @param minPoints điểm tối thiểu trên thang {@code totalMax} */
    public record Band(String grade, double minPoints) {}

    public record Scale(double totalMax, List<Band> bands) {}

    private static final Map<String, Scale> SCALES = Map.of(
            "TELC:B1", new Scale(300, List.of(
                    new Band("SEHR_GUT", 270),
                    new Band("GUT", 240),
                    new Band("BEFRIEDIGEND", 210),
                    new Band("AUSREICHEND", 180)))
    );

    /** Bảng của đề, hoặc {@code null} khi chưa có (vd. đề Goethe — không có khối ngân sách). */
    public static Scale find(String format, String cefrLevel) {
        if (format == null || cefrLevel == null) return null;
        return SCALES.get(format.trim().toUpperCase(Locale.ROOT) + ":" + cefrLevel.trim().toUpperCase(Locale.ROOT));
    }
}
