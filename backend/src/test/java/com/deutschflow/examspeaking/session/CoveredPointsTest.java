package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đợt 5 phòng thi nói — ý trên thẻ đề đã nói tới: tách danh sách ý của thẻ, đọc "covered" của AI một cách
 * phòng thủ, gộp chỉ cộng thêm, và plan_json của phiên cũ (chưa có khoá) vẫn đọc được.
 */
class CoveredPointsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("ý của thẻ lấy từ prompts; thẻ không có prompts hoặc null → rỗng")
    void cardPoints() {
        assertThat(AiInterlocutorService.cardPoints(Map.of("type", "TASK_SITUATION", "prompts", List.of("Wann?", "Wo?", " "))))
                .containsExactly("Wann?", "Wo?");
        assertThat(AiInterlocutorService.cardPoints(Map.of("type", "THEME_CARD", "wort", "Brot"))).isEmpty();
        assertThat(AiInterlocutorService.cardPoints(Map.of("prompts", "Wann?"))).isEmpty();
        assertThat(AiInterlocutorService.cardPoints(null)).isEmpty();
    }

    @Test
    @DisplayName("covered của AI: chỉ giữ số nguyên trong phạm vi, bỏ trùng; thiếu/sai kiểu → rỗng")
    void parseCovered() throws Exception {
        assertThat(AiInterlocutorService.parseCovered(mapper.readTree("{\"covered\":[2,0,0,9,-1,\"x\",1.0]}"), 4))
                .containsExactly(0, 1, 2);
        assertThat(AiInterlocutorService.parseCovered(mapper.readTree("{\"reply_de\":\"Ja.\"}"), 4)).isEmpty();
        assertThat(AiInterlocutorService.parseCovered(mapper.readTree("{\"covered\":\"0,1\"}"), 4)).isEmpty();
        assertThat(AiInterlocutorService.parseCovered(mapper.readTree("{\"covered\":[0]}"), 0)).isEmpty();
        assertThat(AiInterlocutorService.parseCovered(null, 4)).isEmpty();
    }

    @Test
    @DisplayName("gộp ý chỉ cộng thêm, sắp xếp; không có ý mới thì giữ nguyên đối tượng")
    void mergeOnlyAdds() {
        SessionPlan.PartPlan p = part().withCoveredPoints(List.of(2, 0));
        assertThat(p.coveredPoints()).containsExactly(0, 2);
        SessionPlan.PartPlan same = p.withCoveredPoints(List.of(0));
        assertThat(same).isSameAs(p);
        assertThat(p.withCoveredPoints(List.of(1)).coveredPoints()).containsExactly(0, 1, 2);
        // chọn chủ đề không làm mất ý đã gạch
        assertThat(p.withChosenIndex(1).coveredPoints()).containsExactly(0, 2);
    }

    @Test
    @DisplayName("plan_json của phiên cũ (không có coveredPoints) đọc được, ý đã gạch rỗng; khứ hồi giữ ý")
    void legacyPlanJsonStillReads() {
        Map<String, Object> json = mapper.convertValue(part(), new TypeReference<LinkedHashMap<String, Object>>() {});
        json.remove("coveredPoints");
        SessionPlan.PartPlan legacy = mapper.convertValue(json, SessionPlan.PartPlan.class);
        assertThat(legacy.coveredPoints()).isEmpty();

        SessionPlan plan = new SessionPlan(List.of(part().withCoveredPoints(List.of(1, 3))));
        Map<String, Object> stored = mapper.convertValue(plan, new TypeReference<Map<String, Object>>() {});
        assertThat(mapper.convertValue(stored, SessionPlan.class).part(3).coveredPoints()).containsExactly(1, 3);
    }

    private static SessionPlan.PartPlan part() {
        return new SessionPlan.PartPlan(3, TaskArchetype.PLAN_NEGOTIATE, PartFlow.ALTERNATING_QA, 360,
                List.of(1L), List.of(Map.of("type", "TASK_SITUATION", "prompts", List.of("Wann?", "Wo?", "Essen?", "Geschenk?"))),
                List.of(new SessionPlan.Step(0, "SPEAK", 0, "PARTNER", "REACT_AND_ASK", "Đề xuất")), Map.of(), null);
    }
}
