package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Máy trạng thái kịch bản: từ blueprint + đề đã rút → các bước của từng Teil (theo PartFlow).
 * Thuần hàm, không I/O — unit test được. Vai partner ở đây là AI (chế độ cá nhân); tính năng B2B
 * dùng cùng kịch bản nhưng partner là người.
 */
@Component
public class ExamSessionOrchestrator {

    public SessionPlan buildPlan(ExamBlueprint bp, Map<Integer, List<SpeakingExamTask>> tasksByPart, Integer onlyTeil) {
        List<SessionPlan.PartPlan> parts = new ArrayList<>();
        for (BlueprintPart part : bp.parts()) {
            if (onlyTeil != null && part.teilNo() != onlyTeil) {
                continue;
            }
            List<SpeakingExamTask> tasks = tasksByPart.getOrDefault(part.teilNo(), List.of());
            List<Long> ids = tasks.stream().map(SpeakingExamTask::getId).toList();
            List<Map<String, Object>> stimuli = tasks.stream().map(SpeakingExamTask::getStimulusJson).toList();
            parts.add(new SessionPlan.PartPlan(part.teilNo(), part.archetype(), part.flow(), part.durationSec(),
                    ids, stimuli, steps(part, stimuli), preTurn(part, stimuli), null));
        }
        return new SessionPlan(parts);
    }

    List<SessionPlan.Step> steps(BlueprintPart part, List<Map<String, Object>> stimuli) {
        List<SessionPlan.Step> steps = new ArrayList<>();
        int cards = stimuli.size();
        String firstType = cards == 0 ? "" : String.valueOf(stimuli.get(0).getOrDefault("type", ""));
        int i = 0;
        switch (part.flow()) {
            case EXAMINER_LED -> {
                // A1: thẻ có từ để đánh vần + số → 3 bước cố định như đề thật. A2+ (telc A2 T1): chỉ giới thiệu
                // + giám khảo hỏi thêm (không buchstabieren).
                boolean spelling = cards > 0 && stimuli.get(0).get("spell") != null;
                if (spelling) {
                    steps.add(new SessionPlan.Step(i++, "SPEAK", 0, "PRUEFER", "SPELL_REQUEST",
                            "Giới thiệu bản thân theo các từ khóa trên thẻ (tên, tuổi, nước, nơi ở, ngôn ngữ, nghề, sở thích)."));
                    steps.add(new SessionPlan.Step(i++, "SPEAK", 0, "PRUEFER", "NUMBER_REQUEST", "Đánh vần từ giám khảo yêu cầu (buchstabieren)."));
                    steps.add(new SessionPlan.Step(i++, "SPEAK", 0, "PRUEFER", "THANK", "Đọc số/điện thoại/mã bưu điện giám khảo yêu cầu."));
                } else {
                    int n = Math.max(2, part.maxCandidateTurns());
                    steps.add(new SessionPlan.Step(i++, "SPEAK", 0, "PRUEFER", "FOLLOWUP_QUESTION",
                            "Giới thiệu bản thân theo các từ khóa trên thẻ — nói thành câu đầy đủ."));
                    for (int k = 1; k < n; k++) {
                        steps.add(new SessionPlan.Step(i++, "ANSWER", 0, "PRUEFER", k == n - 1 ? "THANK" : "FOLLOWUP_QUESTION",
                                "Trả lời câu hỏi thêm của giám khảo."));
                    }
                }
            }
            case ALTERNATING_QA -> {
                int rounds = Math.max(1, part.rounds());
                boolean request = part.archetype() == com.deutschflow.examspeaking.api.model.TaskArchetype.REQUEST_RESPOND;
                String askHint = switch (firstType) {
                    case "PERSON_CARD" -> "Đặt MỘT câu hỏi cho bạn thi về từ khóa trên thẻ (vd. Geburtstag? → Wann hast du Geburtstag?).";
                    case "QUESTION_WORD_CARD" -> "Đặt MỘT câu hỏi về chủ đề, bắt đầu bằng từ hỏi trên thẻ.";
                    default -> request ? "Nhìn hình và đưa ra một lời đề nghị/yêu cầu (Bitte) cho bạn thi."
                            : "Đặt MỘT câu hỏi về từ trên thẻ cho bạn thi.";
                };
                String answerHint = request ? "Phản ứng với lời đề nghị của bạn thi (đồng ý/từ chối lịch sự)."
                        : "Trả lời câu hỏi bạn thi vừa đặt (thẻ của bạn thi hiện ở đây).";
                for (int r = 0; r < rounds; r++) {
                    int askCard = Math.min(2 * r, Math.max(0, cards - 1));
                    int answerCard = Math.min(2 * r + 1, Math.max(0, cards - 1));
                    steps.add(new SessionPlan.Step(i++, "ASK", askCard, "PARTNER", "ANSWER_AND_ASK", askHint));
                    steps.add(new SessionPlan.Step(i++, "ANSWER", answerCard, "PARTNER", "REACT", answerHint));
                }
            }
            case MONOLOGUE -> {
                boolean presentation = part.archetype() == com.deutschflow.examspeaking.api.model.TaskArchetype.PRESENT;
                // Präsentation (B1/B2): thí sinh trình bày → partner nhận xét + hỏi → giám khảo hỏi → kết (≥3 lượt).
                int n = presentation ? Math.max(3, part.maxCandidateTurns()) : Math.max(2, part.maxCandidateTurns());
                steps.add(new SessionPlan.Step(i++, "SPEAK", 0,
                        presentation && part.hasPartner() ? "PARTNER" : "PRUEFER",
                        presentation && part.hasPartner() ? "FEEDBACK_AND_QUESTION" : "FOLLOWUP_QUESTION",
                        presentation ? "Trình bày theo đề (mở đầu – nội dung – kết). Nói liền mạch 3–4 phút, dùng ghi chú nếu có."
                                     : "Trình bày/kể theo đề. Nói liền mạch, có mở đầu – nội dung – kết."));
                for (int k = 1; k < n; k++) {
                    boolean last = k == n - 1;
                    String role = presentation ? "PRUEFER" : (part.hasPartner() && k % 2 == 1 ? "PARTNER" : "PRUEFER");
                    steps.add(new SessionPlan.Step(i++, "ANSWER", 0, role, last ? "THANK" : "FOLLOWUP_QUESTION",
                            presentation && k == 1 ? "Trả lời câu hỏi của bạn thi về bài trình bày." : "Trả lời câu hỏi vừa được đặt."));
                }
            }
            case DIALOGUE -> {
                int n = Math.max(2, part.maxCandidateTurns());
                boolean calendar = "CALENDAR_PAIR".equals(firstType);
                boolean contact = "CONTACT_CARD".equals(firstType);
                boolean vorlage = "TOPIC_GRAPHIC_PAIR".equals(firstType);
                // B2 „Diskussion führen" / telc „Diskussion": tranh luận Pro–Contra, KHÁC hẳn lập kế hoạch.
                // Nhánh mặc định của DIALOGUE dẫn thí sinh đi "đề xuất → chốt phương án"; ở đây phải là
                // Standpunkt austauschen – reagieren – zusammenfassen (dafür oder dagegen).
                boolean debate = firstType.startsWith("DEBATE");
                for (int k = 0; k < n; k++) {
                    boolean last = k == n - 1;
                    if (contact && k == n - 2) {
                        // telc B1 T1: sau phần làm quen, giám khảo đặt thêm một câu hỏi ngoài đề.
                        steps.add(new SessionPlan.Step(i++, "REACT", 0, "PRUEFER", "FOLLOWUP_QUESTION",
                                "Phản hồi bạn thi; sau đó giám khảo sẽ hỏi thêm một câu."));
                        continue;
                    }
                    if (contact && last) {
                        steps.add(new SessionPlan.Step(i++, "ANSWER", 0, "PRUEFER", "THANK", "Trả lời câu hỏi của giám khảo."));
                        continue;
                    }
                    String hint = k == 0
                            ? (calendar ? "Mở đầu: đề xuất một ngày/giờ còn trống trong lịch CỦA BẠN (bạn thi có lịch khác)."
                               : vorlage ? "Thuật lại cho bạn thi: Vorlage của bạn nói gì (chủ đề, số liệu chính)?"
                               : contact ? "Mở đầu: chào hỏi, giới thiệu và hỏi bạn thi về một chủ đề trên thẻ."
                               : debate ? "Mở đầu: nêu rõ quan điểm của bạn về câu hỏi và một lý do chính."
                               : "Mở đầu: đưa đề xuất/quan điểm đầu tiên.")
                            : last
                                ? (calendar ? "Chốt lại: nhắc lại ngày giờ đã thống nhất."
                                   : debate ? "Kết: tóm tắt hai luồng ý kiến rồi nói rõ bạn nghiêng về dafür oder dagegen."
                                   : "Kết: tóm tắt điều hai bên thống nhất.")
                                : (calendar ? "Phản hồi: đồng ý nếu bạn rảnh, nếu không thì từ chối có lý do và đề xuất giờ khác."
                                   : vorlage ? "Phản hồi Vorlage của bạn thi; nói về trải nghiệm/ý kiến của bạn và hỏi lại."
                                   : contact ? "Trả lời và hỏi lại bạn thi về một chủ đề khác trên thẻ."
                                   : debate ? "Phản biện lập luận vừa nghe (nhượng bộ một phần rồi đưa lý lẽ ngược lại)."
                                   : "Phản hồi bạn thi: đồng ý/phản đối có lý do, đề xuất tiếp.");
                    String aiAction = last ? "CONCLUDE" : (vorlage && k == 0 ? "REPORT_OWN" : "REACT_AND_ASK");
                    steps.add(new SessionPlan.Step(i++, k == 0 ? "SPEAK" : "REACT", 0, "PARTNER", aiAction, hint));
                }
            }
            case FEEDBACK -> {
                // Goethe B1 T3: partner đã trình bày (preTurn) → thí sinh nhận xét + hỏi → partner trả lời VÀ giám khảo hỏi
                // (2 lượt AI sau 1 lượt thí sinh) → thí sinh trả lời → kết.
                steps.add(new SessionPlan.Step(i++, "SPEAK", 0, "PARTNER", "ANSWER_QUESTION",
                        "Cho bạn thi một nhận xét về bài trình bày (hay/mới/thú vị ở đâu) và đặt MỘT câu hỏi.",
                        "PRUEFER", "FOLLOWUP_QUESTION"));
                steps.add(new SessionPlan.Step(i++, "ANSWER", 0, "PRUEFER", "THANK", "Trả lời câu hỏi của giám khảo về chủ đề."));
            }
        }
        return steps;
    }

    /** Bước mở đầu do AI nói TRƯỚC (FEEDBACK: partner trình bày trước khi thí sinh nhận xét). */
    Map<String, Object> preTurn(BlueprintPart part, List<Map<String, Object>> stimuli) {
        if (part.flow() == com.deutschflow.examspeaking.api.model.PartFlow.FEEDBACK && !stimuli.isEmpty()) {
            Object text = stimuli.get(0).get("partnerPresentation");
            if (text != null) {
                return Map.of("role", "PARTNER", "text", String.valueOf(text));
            }
        }
        return Map.of();
    }
}
