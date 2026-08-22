package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.metrics.FluencyMetrics;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Flüssigkeit → band từ số liệu đo được. Ngưỡng khởi điểm theo cấp (từ/phút cho lời nói người học);
 * PHẢI hiệu chuẩn lại bằng golden set (kế hoạch 2.4) — đây là giá trị xuất phát, không phải chân lý.
 */
@Component
public class FluencyBandMapper {

    /** wpm tối thiểu cho band A, B, C, D theo cấp; dưới D → band thấp nhất. */
    private static double[] thresholds(String level) {
        return switch (level == null ? "A1" : level.toUpperCase(Locale.ROOT)) {
            case "B2", "C1", "C2" -> new double[]{115, 95, 80, 60};
            case "B1" -> new double[]{95, 80, 65, 50};
            default -> new double[]{70, 55, 40, 25};
        };
    }

    public String band(RubricDefinition.BandScale scale, String level, FluencyMetrics m) {
        double[] t = thresholds(level);
        int idx;
        if (m.wordsPerMinute() >= t[0]) {
            idx = 0;
        } else if (m.wordsPerMinute() >= t[1]) {
            idx = 1;
        } else if (m.wordsPerMinute() >= t[2]) {
            idx = 2;
        } else if (m.wordsPerMinute() >= t[3]) {
            idx = 3;
        } else {
            idx = 4;
        }
        double minutes = m.speakingSeconds() / 60.0;
        double longPausesPerMin = minutes > 0 ? m.longPauseCount() / minutes : 0;
        if (longPausesPerMin > 6 || m.meanLengthOfRun() < 3) {
            idx++;
        }
        List<String> bands = BandScales.bands(scale);
        return bands.get(Math.min(idx, bands.size() - 1));
    }
}
