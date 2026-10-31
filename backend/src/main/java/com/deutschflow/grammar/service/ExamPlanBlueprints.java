package com.deutschflow.grammar.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Cấu trúc kỳ thi cho lộ trình đếm ngược (LT3): các Teil và điểm tối đa của từng Teil. Nhà tổ chức ×
 * bậc nào có dòng ở đây thì mới có kế hoạch; thêm Goethe B1 sau này chỉ cần thêm dữ liệu.
 */
public final class ExamPlanBlueprints {

    private ExamPlanBlueprints() {}

    /** Khoá của một Teil trong {@code locked_weeks_json}: {@code HOEREN:1}. */
    public record Teil(String section, int teil, double max) {
        public String key() {
            return section + ":" + teil;
        }
    }

    public record Blueprint(String provider, String level, List<Teil> teile) {}

    public static final String SECTION_SPEAKING = "SPRECHEN";

    private static final Map<String, Blueprint> BLUEPRINTS = Map.of(
            "TELC:B1", new Blueprint("TELC", "B1", List.of(
                    new Teil("LESEN", 1, 25), new Teil("LESEN", 2, 25), new Teil("LESEN", 3, 25),
                    new Teil("SPRACHBAUSTEINE", 1, 15), new Teil("SPRACHBAUSTEINE", 2, 15),
                    new Teil("HOEREN", 1, 25), new Teil("HOEREN", 2, 25), new Teil("HOEREN", 3, 25),
                    new Teil("SCHREIBEN", 1, 45),
                    new Teil(SECTION_SPEAKING, 1, 15), new Teil(SECTION_SPEAKING, 2, 30),
                    new Teil(SECTION_SPEAKING, 3, 30))));

    /** @return {@code null} khi chưa có kế hoạch cho cặp này */
    public static Blueprint find(String provider, String level) {
        if (provider == null || level == null) return null;
        return BLUEPRINTS.get(provider.trim().toUpperCase(Locale.ROOT) + ":" + level.trim().toUpperCase(Locale.ROOT));
    }
}
