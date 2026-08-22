package com.deutschflow.examspeaking.api;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;

import java.util.Map;

/**
 * Contract public #3: lời dẫn của giám khảo (Prüfer) cho từng thời điểm của một Teil. Text trước, TTS
 * do client gọi {@code POST /api/ai-speaking/tts} (EdgeTts) — không lưu audio ở Đợt 0.
 */
public interface PrueferScriptService {

    enum Moment { SESSION_OPENING, PART_INTRO, PART_TRANSITION, SESSION_CLOSING }

    /** @param stimulus đề của bước hiện tại (có thể rỗng) — để Prüfer nhắc đúng thẻ/chủ đề. */
    PrueferLine line(ExamBlueprint blueprint, BlueprintPart part, Moment moment, Map<String, Object> stimulus);

    record PrueferLine(String textDe, String voiceHint) {}
}
