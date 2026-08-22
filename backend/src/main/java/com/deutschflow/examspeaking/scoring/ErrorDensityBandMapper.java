package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Độ đúng ngôn ngữ (Strukturen / Formale Richtigkeit) → band từ MẬT ĐỘ LỖI đếm được (lỗi/100 từ; MAJOR = 1,
 * MINOR = 0,5). Band do code quyết, LLM chỉ liệt kê lỗi nguyên văn. Ngưỡng khởi điểm theo cấp — hiệu chuẩn
 * trên CÙNG pipeline STT bằng golden set (nuốt bias "Whisper sửa hộ lỗi").
 */
@Component
public class ErrorDensityBandMapper {

    /** Mật độ tối đa (lỗi/100 từ) cho band A, B, C, D theo cấp. */
    private static double[] thresholds(String level) {
        return switch (level == null ? "A1" : level.toUpperCase(Locale.ROOT)) {
            case "B2", "C1", "C2" -> new double[]{2.0, 3.5, 6.0, 9.0};
            case "B1" -> new double[]{3.0, 5.0, 8.0, 12.0};
            case "A2" -> new double[]{5.0, 8.0, 12.0, 18.0};
            default -> new double[]{6.0, 10.0, 15.0, 22.0};
        };
    }

    public double densityPer100(List<Ergebnisbogen.ErrorItem> errors, int wordCount) {
        if (wordCount <= 0) {
            return 0;
        }
        double weighted = errors.stream()
                .mapToDouble(e -> "MINOR".equalsIgnoreCase(e.severity()) ? 0.5 : 1.0)
                .sum();
        return weighted * 100.0 / wordCount;
    }

    public String band(RubricDefinition.BandScale scale, String level, double densityPer100) {
        double[] t = thresholds(level);
        int idx;
        if (densityPer100 <= t[0]) {
            idx = 0;
        } else if (densityPer100 <= t[1]) {
            idx = 1;
        } else if (densityPer100 <= t[2]) {
            idx = 2;
        } else if (densityPer100 <= t[3]) {
            idx = 3;
        } else {
            idx = 4;
        }
        List<String> bands = BandScales.bands(scale);
        return bands.get(Math.min(idx, bands.size() - 1));
    }
}
