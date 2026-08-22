package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;

import java.util.List;
import java.util.Map;

/**
 * Kịch bản cố định của một phiên (lưu plan_json): đề đã rút + các bước cho từng Teil.
 * Mỗi bước = thí sinh phải làm gì (ASK/ANSWER/SPEAK/REACT) với thẻ nào, rồi AI (vai nào) làm gì.
 */
public record SessionPlan(List<PartPlan> parts) {

    public SessionPlan {
        parts = parts == null ? List.of() : List.copyOf(parts);
    }

    public PartPlan part(int teilNo) {
        return parts.stream().filter(p -> p.teilNo() == teilNo).findFirst().orElse(null);
    }

    public record PartPlan(int teilNo, TaskArchetype archetype, PartFlow flow, int durationSec,
                           List<Long> taskIds, List<Map<String, Object>> stimuli, List<Step> steps,
                           Map<String, Object> preTurn) {
        public PartPlan {
            taskIds = taskIds == null ? List.of() : List.copyOf(taskIds);
            stimuli = stimuli == null ? List.of() : List.copyOf(stimuli);
            steps = steps == null ? List.of() : List.copyOf(steps);
            preTurn = preTurn == null ? Map.of() : Map.copyOf(preTurn);
        }
    }

    /**
     * @param candidateAction ASK | ANSWER | SPEAK | REACT
     * @param cardIndex       thẻ thí sinh nhìn thấy ở bước này (có thể là thẻ của partner khi ANSWER)
     * @param aiRole          PRUEFER | PARTNER | NONE — ai đáp lại sau lượt thí sinh
     * @param aiAction        ANSWER_AND_ASK | REACT_AND_ASK | REACT | FOLLOWUP_QUESTION | CONCLUDE | THANK | SPELL_REQUEST | NUMBER_REQUEST
     * @param hintVi          gợi ý ngắn tiếng Việt cho thí sinh
     */
    public record Step(int index, String candidateAction, Integer cardIndex, String aiRole, String aiAction, String hintVi) {}
}
