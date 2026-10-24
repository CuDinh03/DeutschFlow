package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;

import java.util.ArrayList;
import java.util.List;

/**
 * Curated interview questions per persona and shared phases.
 *
 * <p>K4 (22/10/2026): mỗi câu kèm bản dịch Việt/Anh để trang {@code /phong-van/[nghe]} hiện dưới câu
 * tiếng Đức. Câu tiếng Đức giữ nguyên văn — V187/V271 seed đúng chữ này
 * ({@code InterviewQuestionBankSeedParityTest}).
 */
public final class InterviewQuestionBank {

    private InterviewQuestionBank() {}

    /**
     * Vị trí chèn vào câu theo từng ngôn ngữ. Tiếng Đức giữ đúng chuỗi cũ; tiếng Việt/Anh bọc thành
     * cụm danh từ ("vị trí Kellner/in", "the Kellner/in position") để đứng được ở mọi chỗ trong câu.
     */
    private record Pos(String de, String vi, String en) {
        static Pos of(String position) {
            if (position == null || position.isBlank()) {
                return new Pos("diese Position", "vị trí này", "this position");
            }
            return new Pos(position, "vị trí " + position, "the " + position + " position");
        }
    }

    public static List<InterviewQuestionDef> forPersona(SpeakingPersona persona, String position) {
        Pos pos = Pos.of(position);
        List<InterviewQuestionDef> all = new ArrayList<>();
        all.addAll(commonQuestions(pos));
        all.addAll(switch (persona) {
            case LUKAS -> techQuestions(pos);
            case EMMA -> businessQuestions(pos);
            case ANNA -> educationQuestions(pos);
            case KLAUS -> gastroQuestions(pos);
            case WEBER -> dermatologyQuestions(pos);
            case SARAH -> medicalAssistantQuestions(pos);
            case SCHNEIDER -> ophthalmologyQuestions(pos);
            case LENA, THOMAS, PETRA -> retailFoodQuestions(persona, pos);
            case MAX, OLIVER -> operationsQuestions(persona, pos);
            case NIKLAS, NINA -> serviceQuestions(persona, pos);
            case HANNIE -> mediaQuestions(pos);
            default -> generalQuestions(pos);
        });
        return all;
    }

    private static List<InterviewQuestionDef> commonQuestions(Pos pos) {
        return List.of(
                q("ice_motivation", InterviewPhase.ICE_BREAKER, "motivation",
                        "Was hat Sie besonders an der Position " + pos.de() + " interessiert?",
                        "Điều gì ở " + pos.vi() + " khiến bạn đặc biệt quan tâm?",
                        "What interested you most about " + pos.en() + "?"),
                q("ice_typical_day", InterviewPhase.ICE_BREAKER, "routine",
                        "Beschreiben Sie einen typischen Arbeitstag in Ihrer letzten Stelle — konkret und chronologisch.",
                        "Hãy mô tả một ngày làm việc điển hình ở chỗ làm gần nhất của bạn — cụ thể và theo trình tự thời gian.",
                        "Describe a typical working day in your last job — concretely and in chronological order."),
                q("ice_found_role", InterviewPhase.ICE_BREAKER, "motivation",
                        "Wie sind Sie auf diese Stelle aufmerksam geworden, und was erwarten Sie vom Team?",
                        "Bạn biết đến vị trí này bằng cách nào, và bạn mong đợi gì ở đội ngũ?",
                        "How did you come across this job, and what do you expect from the team?"),
                q("star_conflict", InterviewPhase.STAR_SOFT, "team",
                        "Nennen Sie einen Konflikt im Team: Situation, Ihre Aufgabe, Ihre Handlung und das Ergebnis.",
                        "Hãy kể về một mâu thuẫn trong nhóm: tình huống, nhiệm vụ của bạn, việc bạn đã làm và kết quả.",
                        "Tell us about a conflict in your team: the situation, your task, what you did and the result."),
                q("star_stress", InterviewPhase.STAR_SOFT, "stress",
                        "Beschreiben Sie eine stressige Situation mit Zeitdruck — was genau haben Sie getan und was war das Ergebnis?",
                        "Hãy mô tả một tình huống căng thẳng vì gấp thời gian — chính xác bạn đã làm gì và kết quả ra sao?",
                        "Describe a stressful situation under time pressure — what exactly did you do and what was the result?"),
                q("star_mistake", InterviewPhase.STAR_SOFT, "fehler",
                        "Erzählen Sie von einem Fehler bei der Arbeit: wie entdeckt, wie behoben, was haben Sie daraus gelernt?",
                        "Hãy kể về một lỗi trong công việc: phát hiện ra thế nào, khắc phục ra sao, bạn rút ra bài học gì?",
                        "Tell us about a mistake at work: how it was discovered, how it was fixed, and what you learned from it."),
                q("close_ask", InterviewPhase.CLOSING, "closing",
                        "Haben Sie noch Fragen an uns?",
                        "Bạn có câu hỏi nào cho chúng tôi không?",
                        "Do you have any questions for us?"),
                q("intro_self", InterviewPhase.INTRO, "intro",
                        "Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung für " + pos.de() + ", und Ihr nächster Schritt.",
                        "Mời bạn giới thiệu ngắn về bản thân: quá trình học tập và làm việc, kinh nghiệm liên quan đến " + pos.vi() + ", và bước tiếp theo bạn hướng tới.",
                        "Please introduce yourself briefly: your background, relevant experience for " + pos.en() + ", and your next step.")
        );
    }

    private static List<InterviewQuestionDef> dermatologyQuestions(Pos pos) {
        return List.of(
                q("web_hygiene_case", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Nennen Sie einen konkreten Vorfall in der Klinik/Praxis, bei dem Hygiene oder Qualität gefährdet war — Ihre Maßnahmen und das Ergebnis.",
                        "Hãy kể một sự cố cụ thể ở bệnh viện/phòng khám khi vệ sinh hoặc chất lượng bị đe doạ — bạn đã xử lý thế nào và kết quả ra sao.",
                        "Name a specific incident at the clinic or practice where hygiene or quality was at risk — your actions and the result."),
                q("web_sample_prep", InterviewPhase.HARD_SKILLS, "labor",
                        "Wie bereiten Sie Hautproben für mikrobiologische oder histologische Untersuchungen vor? Bitte mit einem echten Ablauf aus Ihrer Erfahrung.",
                        "Bạn chuẩn bị mẫu da cho xét nghiệm vi sinh hoặc mô học như thế nào? Hãy kể một quy trình thật từ kinh nghiệm của bạn.",
                        "How do you prepare skin samples for microbiological or histological tests? Please describe a real procedure from your experience."),
                q("web_patient_comm", InterviewPhase.HARD_SKILLS, "patient",
                        "Wie sprechen Sie mit einem Patienten, der sich wegen sichtbarer Hautveränderungen schämt? Ein konkretes Beispiel.",
                        "Bạn nói chuyện thế nào với một bệnh nhân ngại ngùng vì những thay đổi trên da dễ nhìn thấy? Một ví dụ cụ thể.",
                        "How do you talk to a patient who feels ashamed of visible skin changes? A concrete example."),
                q("web_emergency", InterviewPhase.HARD_SKILLS, "notfall",
                        "Beschreiben Sie, wie Sie bei einer allergischen Reaktion im Labor/Praxis vorgegangen sind — Schritte und Eskalation.",
                        "Hãy mô tả cách bạn đã xử lý một ca phản ứng dị ứng ở phòng xét nghiệm/phòng khám — các bước và cách báo lên cấp trên.",
                        "Describe how you handled an allergic reaction in the lab or practice — the steps and the escalation."),
                q("web_anamnese", InterviewPhase.HARD_SKILLS, "anamnese",
                        "Wie führen Sie eine Hautanamnese strukturiert durch, bevor der Arzt die Untersuchung übernimmt?",
                        "Bạn khai thác bệnh sử về da một cách có hệ thống như thế nào trước khi bác sĩ vào khám?",
                        "How do you take a structured skin history before the doctor takes over the examination?"),
                q("web_documentation", InterviewPhase.HARD_SKILLS, "doku",
                        "Welches KIS/LIS haben Sie genutzt, und wie vermeiden Sie Verwechslungen bei Proben und Befunden?",
                        "Bạn đã dùng hệ thống thông tin bệnh viện/xét nghiệm (KIS/LIS) nào, và làm sao để tránh nhầm lẫn mẫu và kết quả?",
                        "Which hospital or lab information system (KIS/LIS) have you used, and how do you avoid mixing up samples and results?")
        );
    }

    private static List<InterviewQuestionDef> ophthalmologyQuestions(Pos pos) {
        return List.of(
                q("oph_sehtest", InterviewPhase.HARD_SKILLS, "sehtest",
                        "Welche Sehtests führen Sie selbstständig durch, und wie dokumentieren Sie die Werte für " + pos.de() + "?",
                        "Bạn tự thực hiện được những bài đo thị lực nào, và ghi lại các chỉ số ở " + pos.vi() + " như thế nào?",
                        "Which eye tests do you carry out on your own, and how do you document the values for " + pos.en() + "?"),
                q("oph_contact_lens", InterviewPhase.HARD_SKILLS, "linsen",
                        "Beschreiben Sie die Anpassung oder Beratung zu Kontaktlinsen — ein konkreter Patientenfall.",
                        "Hãy mô tả việc lắp hoặc tư vấn kính áp tròng — một ca bệnh nhân cụ thể.",
                        "Describe fitting or advising on contact lenses — a specific patient case."),
                q("oph_accuracy", InterviewPhase.HARD_SKILLS, "genauigkeit",
                        "Nennen Sie einen Fehler bei Messung oder Dokumentation und wie Sie ihn behoben haben.",
                        "Hãy kể một lỗi khi đo hoặc khi ghi chép và cách bạn đã khắc phục.",
                        "Name a mistake in a measurement or in documentation and how you fixed it."),
                q("oph_patient_calm", InterviewPhase.HARD_SKILLS, "patient",
                        "Wie beruhigen Sie einen ängstlichen Patienten vor einer Untersuchung? Konkretes Beispiel.",
                        "Bạn trấn an một bệnh nhân đang lo lắng trước khi khám như thế nào? Ví dụ cụ thể.",
                        "How do you calm an anxious patient before an examination? A concrete example.")
        );
    }

    private static List<InterviewQuestionDef> medicalAssistantQuestions(Pos pos) {
        return List.of(
                q("ma_appointment", InterviewPhase.HARD_SKILLS, "termin",
                        "Wie organisieren Sie Termine und Patientenaufnahme unter Zeitdruck? Ein Beispiel aus der Praxis.",
                        "Bạn sắp xếp lịch hẹn và tiếp nhận bệnh nhân thế nào khi gấp thời gian? Một ví dụ từ phòng khám.",
                        "How do you organise appointments and patient admission under time pressure? An example from the practice."),
                q("ma_hygiene", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Welche Hygienemaßnahmen sind für " + pos.de() + " kritisch — und wann haben Sie sie verletzt gesehen und reagiert?",
                        "Những biện pháp vệ sinh nào là then chốt với " + pos.vi() + " — và có lần nào bạn thấy chúng bị vi phạm và đã phản ứng ra sao?",
                        "Which hygiene measures are critical for " + pos.en() + " — and when did you see them violated and react?"),
                q("ma_documentation", InterviewPhase.HARD_SKILLS, "doku",
                        "Wie dokumentieren Sie Befunde und Datenschutz im Alltag? Nennen Sie System und einen Ablauf.",
                        "Hằng ngày bạn ghi chép kết quả khám và bảo đảm bảo mật dữ liệu như thế nào? Hãy nêu hệ thống bạn dùng và một quy trình.",
                        "How do you document findings and handle data protection day to day? Name the system and a procedure.")
        );
    }

    private static List<InterviewQuestionDef> techQuestions(Pos pos) {
        return List.of(
                q("tech_project", InterviewPhase.HARD_SKILLS, "projekt",
                        "Welches technische Projekt für " + pos.de() + " war Ihr wichtigster Beitrag — Architektur, Ihre Rolle, Trade-off?",
                        "Dự án kỹ thuật nào ở " + pos.vi() + " là đóng góp quan trọng nhất của bạn — kiến trúc, vai trò của bạn, sự đánh đổi?",
                        "Which technical project for " + pos.en() + " was your most important contribution — architecture, your role, trade-offs?"),
                q("tech_debug", InterviewPhase.HARD_SKILLS, "debug",
                        "Beschreiben Sie einen schweren Produktionsfehler: Ursache, Debugging-Schritte, Fix und Prävention.",
                        "Hãy mô tả một lỗi nghiêm trọng trên môi trường production: nguyên nhân, các bước gỡ lỗi, cách sửa và cách phòng ngừa.",
                        "Describe a serious production bug: the cause, the debugging steps, the fix and prevention."),
                q("tech_api", InterviewPhase.HARD_SKILLS, "api",
                        "Wie haben Sie API-Design und Fehlerbehandlung in einem echten System umgesetzt?",
                        "Bạn đã thiết kế API và xử lý lỗi trong một hệ thống thật như thế nào?",
                        "How did you implement API design and error handling in a real system?"),
                q("tech_test", InterviewPhase.HARD_SKILLS, "test",
                        "Welche Testing-Strategie nutzen Sie, und wo hat sie versagt — konkretes Beispiel.",
                        "Bạn dùng chiến lược kiểm thử nào, và nó đã thất bại ở đâu — ví dụ cụ thể.",
                        "Which testing strategy do you use, and where did it fail — a concrete example.")
        );
    }

    private static List<InterviewQuestionDef> businessQuestions(Pos pos) {
        return List.of(
                q("biz_pipeline", InterviewPhase.HARD_SKILLS, "crm",
                        "Beschreiben Sie einen Deal oder Kunden, den Sie für " + pos.de() + " gewonnen haben — KPI und Vorgehen.",
                        "Hãy mô tả một thương vụ hoặc một khách hàng bạn đã giành được ở " + pos.vi() + " — chỉ số KPI và cách bạn làm.",
                        "Describe a deal or a client you won for " + pos.en() + " — KPIs and approach."),
                q("biz_negotiation", InterviewPhase.HARD_SKILLS, "verhandlung",
                        "Nennen Sie eine schwierige Verhandlung mit messbarem Ergebnis.",
                        "Hãy kể về một cuộc đàm phán khó khăn có kết quả đo được.",
                        "Name a difficult negotiation with a measurable result."),
                q("biz_kpi", InterviewPhase.HARD_SKILLS, "kpi",
                        "Welche KPIs haben Sie verbessert, und welche Entscheidung hat das ausgelöst?",
                        "Bạn đã cải thiện những chỉ số KPI nào, và điều đó dẫn đến quyết định gì?",
                        "Which KPIs did you improve, and what decision did that lead to?")
        );
    }

    private static List<InterviewQuestionDef> educationQuestions(Pos pos) {
        return List.of(
                q("edu_planning", InterviewPhase.HARD_SKILLS, "planung",
                        "Wie planen Sie Lern- oder Studienziele für " + pos.de() + " — konkretes Beispiel mit Zeitrahmen.",
                        "Bạn lập kế hoạch mục tiêu học tập cho " + pos.vi() + " như thế nào — ví dụ cụ thể kèm mốc thời gian.",
                        "How do you plan learning or study goals for " + pos.en() + " — a concrete example with a timeframe."),
                q("edu_conflict", InterviewPhase.HARD_SKILLS, "team",
                        "Wie moderieren Sie Konflikte in einer Gruppe? STAR-Beispiel.",
                        "Bạn hoà giải mâu thuẫn trong một nhóm như thế nào? Hãy kể theo mô hình STAR.",
                        "How do you mediate conflicts in a group? A STAR example.")
        );
    }

    private static List<InterviewQuestionDef> gastroQuestions(Pos pos) {
        return List.of(
                q("gas_haccp", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Nennen Sie einen HACCP-/Hygiene-Vorfall in der Küche und Ihre sofortigen Maßnahmen.",
                        "Hãy kể một sự cố HACCP/vệ sinh trong bếp và những việc bạn làm ngay lập tức.",
                        "Name a HACCP or hygiene incident in the kitchen and your immediate actions."),
                q("gas_rush", InterviewPhase.HARD_SKILLS, "stress",
                        "Wie organisieren Sie die Station in der Rush Hour für " + pos.de() + "? Konkretes Beispiel.",
                        "Bạn tổ chức khu vực làm việc vào giờ cao điểm ở " + pos.vi() + " như thế nào? Ví dụ cụ thể.",
                        "How do you organise the station during rush hour for " + pos.en() + "? A concrete example."),
                q("gas_menu", InterviewPhase.HARD_SKILLS, "kalkulation",
                        "Beschreiben Sie Menüplanung oder Kalkulation, die Sie selbst durchgeführt haben.",
                        "Hãy mô tả việc lên thực đơn hoặc tính giá món mà chính bạn đã thực hiện.",
                        "Describe menu planning or cost calculation that you did yourself.")
        );
    }

    private static List<InterviewQuestionDef> retailFoodQuestions(SpeakingPersona p, Pos pos) {
        return List.of(
                q(p.name().toLowerCase() + "_customer", InterviewPhase.HARD_SKILLS, "kunde",
                        "Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für " + pos.de() + ".",
                        "Bạn xử lý một khiếu nại khó của khách hàng như thế nào? Ví dụ cụ thể ở " + pos.vi() + ".",
                        "How do you handle a difficult customer complaint? A concrete example for " + pos.en() + "."),
                q(p.name().toLowerCase() + "_hygiene", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.",
                        "Những tiêu chuẩn vệ sinh và chất lượng nào là then chốt trong lĩnh vực của bạn — ví dụ thực tế.",
                        "Which hygiene and quality standards are critical in your area — a practical example."),
                q(p.name().toLowerCase() + "_team", InterviewPhase.HARD_SKILLS, "team",
                        "Beschreiben Sie Teamarbeit in Stoßzeiten und Ihre Verantwortung.",
                        "Hãy mô tả cách làm việc nhóm vào giờ cao điểm và trách nhiệm của bạn.",
                        "Describe teamwork at peak times and your responsibility.")
        );
    }

    private static List<InterviewQuestionDef> operationsQuestions(SpeakingPersona p, Pos pos) {
        return List.of(
                q(p.name().toLowerCase() + "_safety", InterviewPhase.HARD_SKILLS, "sicherheit",
                        "Nennen Sie einen Sicherheitsvorfall oder Beinahe-Unfall und Ihre Maßnahmen für " + pos.de() + ".",
                        "Hãy kể một sự cố an toàn hoặc một lần suýt xảy ra tai nạn và những việc bạn đã làm ở " + pos.vi() + ".",
                        "Name a safety incident or near miss and your actions for " + pos.en() + "."),
                q(p.name().toLowerCase() + "_maintenance", InterviewPhase.HARD_SKILLS, "wartung",
                        "Wie führen Sie Wartung oder Störungssuche an einer Maschine durch — konkreter Ablauf.",
                        "Bạn bảo trì hoặc tìm lỗi trên một máy móc như thế nào — quy trình cụ thể.",
                        "How do you carry out maintenance or troubleshooting on a machine — a concrete procedure."),
                q(p.name().toLowerCase() + "_quality", InterviewPhase.HARD_SKILLS, "qualitaet",
                        "Beschreiben Sie Qualitätskontrolle mit Toleranzen oder Messwerten aus Ihrer Erfahrung.",
                        "Hãy mô tả việc kiểm tra chất lượng với dung sai hoặc số đo từ kinh nghiệm của bạn.",
                        "Describe quality control with tolerances or measured values from your experience.")
        );
    }

    private static List<InterviewQuestionDef> serviceQuestions(SpeakingPersona p, Pos pos) {
        return List.of(
                q(p.name().toLowerCase() + "_guest", InterviewPhase.HARD_SKILLS, "gast",
                        "Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für " + pos.de() + ".",
                        "Bạn xử lý một vị khách không hài lòng như thế nào? Hãy kể theo mô hình STAR ở " + pos.vi() + ".",
                        "How do you deal with a dissatisfied guest? A STAR example for " + pos.en() + "."),
                q(p.name().toLowerCase() + "_rush", InterviewPhase.HARD_SKILLS, "tempo",
                        "Beschreiben Sie einen Abend mit hohem Gästeaufkommen — Priorisierung und Team.",
                        "Hãy mô tả một buổi tối đông khách — cách bạn ưu tiên công việc và phối hợp với nhóm.",
                        "Describe an evening with a lot of guests — prioritisation and teamwork."),
                q(p.name().toLowerCase() + "_cash", InterviewPhase.HARD_SKILLS, "kasse",
                        "Nennen Sie einen Fehler an Kasse/Reservierung und wie Sie ihn korrigiert haben.",
                        "Hãy kể một lỗi ở quầy thu ngân hoặc khâu đặt chỗ và cách bạn đã sửa.",
                        "Name a mistake at the till or with a reservation and how you corrected it.")
        );
    }

    private static List<InterviewQuestionDef> mediaQuestions(Pos pos) {
        return List.of(
                q("mc_live", InterviewPhase.HARD_SKILLS, "live",
                        "Beschreiben Sie eine Live-Situation oder Moderation für " + pos.de() + " — was lief schief und wie reagierten Sie?",
                        "Hãy mô tả một tình huống trực tiếp hoặc một lần dẫn chương trình ở " + pos.vi() + " — điều gì đã trục trặc và bạn phản ứng ra sao?",
                        "Describe a live situation or a hosting job for " + pos.en() + " — what went wrong and how did you react?"),
                q("mc_prep", InterviewPhase.HARD_SKILLS, "vorbereitung",
                        "Wie bereiten Sie Skript und Improvisation vor? Konkretes Event.",
                        "Bạn chuẩn bị kịch bản và khả năng ứng biến như thế nào? Hãy kể một sự kiện cụ thể.",
                        "How do you prepare your script and improvisation? A specific event.")
        );
    }

    private static List<InterviewQuestionDef> generalQuestions(Pos pos) {
        return List.of(
                q("gen_responsibility", InterviewPhase.HARD_SKILLS, "verantwortung",
                        "Welche Verantwortung hatten Sie zuletzt für " + pos.de() + " — messbares Ergebnis?",
                        "Gần đây nhất bạn đảm nhận trách nhiệm gì ở " + pos.vi() + " — kết quả đo được là gì?",
                        "What responsibility did you most recently have for " + pos.en() + " — with a measurable result?"),
                q("gen_quality", InterviewPhase.HARD_SKILLS, "qualitaet",
                        "Wie sichern Sie Qualität im Alltag? Ein konkreter Ablauf, kein Theorieblock.",
                        "Hằng ngày bạn bảo đảm chất lượng công việc như thế nào? Một quy trình cụ thể, không phải lý thuyết.",
                        "How do you ensure quality day to day? A concrete procedure, not theory."),
                q("gen_team", InterviewPhase.HARD_SKILLS, "team",
                        "Wie arbeiten Sie mit anderen Rollen zusammen? Nennen Sie Namen/Rollen und einen Konflikt oder Erfolg.",
                        "Bạn phối hợp với những vai trò khác như thế nào? Hãy nêu tên/vai trò và một mâu thuẫn hoặc thành công.",
                        "How do you work with other roles? Name the people or roles and a conflict or success."),
                // Đợt E1 (10/08): bank DEFAULT chỉ có 3 câu HARD_SKILLS → phiên dài cạn bank từ lượt 7,
                // rơi vào fallback lặp nguyên văn (harness S3 lượt 7–9). Thêm 3 câu để đủ 6 lượt đào sâu.
                q("gen_process", InterviewPhase.HARD_SKILLS, "prozess",
                        "Beschreiben Sie einen Arbeitsablauf, den Sie verbessert haben — vorher/nachher, gern mit Zahlen.",
                        "Hãy mô tả một quy trình làm việc bạn đã cải thiện — trước và sau, nếu được thì kèm số liệu.",
                        "Describe a workflow you improved — before and after, ideally with numbers."),
                q("gen_tools", InterviewPhase.HARD_SKILLS, "werkzeuge",
                        "Welches Werkzeug oder System beherrschen Sie für " + pos.de() + " am besten, und wie haben Sie es zuletzt konkret eingesetzt?",
                        "Công cụ hoặc hệ thống nào bạn thành thạo nhất ở " + pos.vi() + ", và lần gần nhất bạn dùng nó cụ thể ra sao?",
                        "Which tool or system do you know best for " + pos.en() + ", and how did you use it most recently?"),
                q("gen_prioritize", InterviewPhase.HARD_SKILLS, "prioritaet",
                        "Wie priorisieren Sie, wenn zwei dringende Aufgaben gleichzeitig kommen? Ein reales Beispiel, kein Theorieblock.",
                        "Bạn ưu tiên thế nào khi hai việc gấp đến cùng lúc? Một ví dụ thật, không phải lý thuyết.",
                        "How do you prioritise when two urgent tasks come at the same time? A real example, not theory.")
        );
    }

    private static InterviewQuestionDef q(String id, InterviewPhase phase, String topic,
                                          String questionDe, String questionVi, String questionEn) {
        return new InterviewQuestionDef(id, phase, topic, questionDe, questionVi, questionEn);
    }
}
