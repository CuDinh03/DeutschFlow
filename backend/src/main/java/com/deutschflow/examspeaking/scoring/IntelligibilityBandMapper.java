package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.RubricDefinition;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tầng 1 của Aussprache: proxy "nghe rõ" từ avg_logprob của Whisper. Chỉ là ước lượng (confidence thấp);
 * tầng 2 (Gemini-audio) và tầng 3 (Azure PA) bổ sung ở đợt sau. Không có logprob → không chấm.
 */
@Component
public class IntelligibilityBandMapper {

    public String band(RubricDefinition.BandScale scale, double avgLogprob) {
        int idx;
        if (avgLogprob >= -0.25) {
            idx = 0;
        } else if (avgLogprob >= -0.40) {
            idx = 1;
        } else if (avgLogprob >= -0.60) {
            idx = 2;
        } else if (avgLogprob >= -0.80) {
            idx = 3;
        } else {
            idx = 4;
        }
        List<String> bands = BandScales.bands(scale);
        return bands.get(Math.min(idx, bands.size() - 1));
    }
}
