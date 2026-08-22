package com.deutschflow.examspeaking.api;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.RubricRef;

/**
 * Contract public #2: chấm MỘT thí sinh theo đúng bộ tiêu chí của hệ (Goethe A–E / telc A–D / VHN).
 * Pipeline: metric extractor (code) → LLM trích bằng chứng → code quy điểm → 2 pass + trọng tài.
 */
public interface ExamGradingService {

    Ergebnisbogen grade(long userId, ParticipantBundle bundle, RubricRef rubricRef);
}
