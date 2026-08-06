package com.deutschflow.speaking.ai;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.prompt.BaseSystemPolicyLayer;
import com.deutschflow.interview.prompt.InterviewPromptBuilder;
import com.deutschflow.interview.prompt.PersonaPromptLayer;
import com.deutschflow.interview.prompt.PhasePromptLayer;
import com.deutschflow.interview.prompt.ResponseRulesLayer;
import com.deutschflow.interview.prompt.ScoringPromptLayer;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import com.deutschflow.interview.service.InterviewRubricService;
import com.deutschflow.interview.service.PersonaRegistryService;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPromptRequest;
import com.deutschflow.speaking.interview.InterviewAnswerAnalyzer;
import com.deutschflow.speaking.interview.InterviewOrchestrator;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.interview.PersonaInterviewRegistry;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.system.service.SystemConfigService;
import com.deutschflow.user.entity.UserLearningProfile;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.mockito.Mockito;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * QA harness — dump system prompt production THẬT (per persona × mode) ra JSON để script
 * ngoài probe độ nhất quán vai persona với model Groq thật (xem
 * BAO_CAO_KIEM_TRA_PERSONA_2026-08-06.md, mục 1). Chỉ chạy khi có
 * {@code -DpromptDump.path=...} — CI không bao giờ chạy.
 */
class PersonaProbePromptDumpTest {

    /** Khớp seed V163__interview_persona.sql (code → industry, role_title). */
    private static final Map<String, String[]> V163 = Map.ofEntries(
            Map.entry("LUKAS", new String[]{"IT / Software", "Senior Tech Lead"}),
            Map.entry("EMMA", new String[]{"Business / Office", "Business Development Manager"}),
            Map.entry("ANNA", new String[]{"Education / Career", "Career Counselor / Educator"}),
            Map.entry("KLAUS", new String[]{"Gastronomy", "Küchenchef / Head Chef"}),
            Map.entry("WEBER", new String[]{"Healthcare / Dermatology", "Dermatologin"}),
            Map.entry("SARAH", new String[]{"Healthcare / General", "Medizinische Fachangestellte"}),
            Map.entry("SCHNEIDER", new String[]{"Healthcare / Ophthalmology", "Augenarzt"}),
            Map.entry("LENA", new String[]{"Retail / Verkauf", "Supermarktmitarbeiterin"}),
            Map.entry("THOMAS", new String[]{"Retail / Bäckerei", "Bäcker"}),
            Map.entry("PETRA", new String[]{"Retail / Metzgerei", "Metzger"}),
            Map.entry("MAX", new String[]{"Operations / Maschinenbau", "Maschinenbediener"}),
            Map.entry("OLIVER", new String[]{"Operations / CNC", "CNC-Fräser"}),
            Map.entry("NIKLAS", new String[]{"Service / Restaurant", "Kellner"}),
            Map.entry("NINA", new String[]{"Service / Hotel", "Rezeptionistin"}),
            Map.entry("HANNIE", new String[]{"Media / Entertainment", "Moderatorin / MC"}));

    private static final Map<SpeakingPersona, String> INTERVIEW_POSITIONS = Map.ofEntries(
            Map.entry(SpeakingPersona.DEFAULT, "Bürokaufmann"),
            Map.entry(SpeakingPersona.LUKAS, "Backend Developer"),
            Map.entry(SpeakingPersona.EMMA, "Vertriebsmitarbeiter"),
            Map.entry(SpeakingPersona.ANNA, "Ausbildung Bürokauffrau"),
            Map.entry(SpeakingPersona.KLAUS, "Koch"),
            Map.entry(SpeakingPersona.LENA, "Verkäuferin"),
            Map.entry(SpeakingPersona.THOMAS, "Bäckereifachverkäufer"),
            Map.entry(SpeakingPersona.PETRA, "Fleischereifachverkäufer"),
            Map.entry(SpeakingPersona.SARAH, "Medizinische Fachangestellte"),
            Map.entry(SpeakingPersona.SCHNEIDER, "Augenoptiker"),
            Map.entry(SpeakingPersona.WEBER, "MFA Dermatologie"),
            Map.entry(SpeakingPersona.MAX, "Maschinenbediener"),
            Map.entry(SpeakingPersona.OLIVER, "CNC-Fräser"),
            Map.entry(SpeakingPersona.NIKLAS, "Kellner"),
            Map.entry(SpeakingPersona.NINA, "Rezeptionistin"),
            Map.entry(SpeakingPersona.HANNIE, "Event-Moderatorin"));

    @Test
    @EnabledIfSystemProperty(named = "promptDump.path", matches = ".+")
    void dumpPrompts() throws Exception {
        SystemConfigService config = Mockito.mock(SystemConfigService.class);
        lenient().when(config.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));

        InterviewPersonaRepository personaRepo = Mockito.mock(InterviewPersonaRepository.class);
        lenient().when(personaRepo.findByCodeAndActiveTrue(anyString())).thenAnswer(inv -> {
            String code = inv.getArgument(0);
            String[] row = V163.get(code);
            if (row == null) {
                return Optional.empty();
            }
            return Optional.of(InterviewPersonaEntity.builder()
                    .code(code).label(code).industry(row[0]).roleTitle(row[1])
                    .tone("neutral").difficulty("INTERMEDIATE")
                    .questionStyle("situational").followUpStyle("deepen")
                    .build());
        });

        InterviewRubricTemplateRepository rubricRepo = Mockito.mock(InterviewRubricTemplateRepository.class);
        lenient().when(rubricRepo.findFirstByIndustryAndPhaseAndActiveTrue(anyString(), anyString()))
                .thenReturn(Optional.empty());
        lenient().when(rubricRepo.findByIndustryAndPhaseAndActiveTrue(anyString(), anyString()))
                .thenReturn(List.of());

        PersonaInterviewRegistry legacyRegistry = new PersonaInterviewRegistry();
        InterviewPromptBuilder interviewPromptBuilder = new InterviewPromptBuilder(
                new BaseSystemPolicyLayer(), new PersonaPromptLayer(), new PhasePromptLayer(),
                new ResponseRulesLayer(), new ScoringPromptLayer(),
                new PersonaRegistryService(personaRepo, new ObjectMapper()),
                new InterviewRubricService(rubricRepo),
                legacyRegistry);

        SystemPromptBuilder builder = new SystemPromptBuilder(config, legacyRegistry, interviewPromptBuilder);
        InterviewOrchestrator orchestrator = new InterviewOrchestrator(new InterviewAnswerAnalyzer(), legacyRegistry);

        // Profile tái hiện bug gốc: nghề học viên là kỹ thuật.
        UserLearningProfile profile = UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A2)
                .industry("Kỹ thuật viên điện tử (Elektroniker)")
                .build();
        String topic = "Täglicher Alltag";
        String cefr = "A2";

        List<SpeakingPersona> germanPersonas = List.of(
                SpeakingPersona.DEFAULT, SpeakingPersona.LUKAS, SpeakingPersona.EMMA, SpeakingPersona.ANNA,
                SpeakingPersona.KLAUS, SpeakingPersona.LENA, SpeakingPersona.THOMAS, SpeakingPersona.PETRA,
                SpeakingPersona.SARAH, SpeakingPersona.SCHNEIDER, SpeakingPersona.WEBER, SpeakingPersona.MAX,
                SpeakingPersona.OLIVER, SpeakingPersona.NIKLAS, SpeakingPersona.NINA, SpeakingPersona.HANNIE);

        ObjectMapper om = new ObjectMapper();
        ObjectNode root = om.createObjectNode();
        ArrayNode comm = root.putArray("communication");
        for (SpeakingPersona p : germanPersonas) {
            String systemPrompt = builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                    .profile(profile).topic(topic).sessionCefrLevel(cefr)
                    .persona(p).turnCount(4).build());
            ObjectNode n = comm.addObject();
            n.put("persona", p.name());
            n.put("displayName", p.displayName());
            n.put("systemPrompt", systemPrompt);
        }

        ArrayNode iv = root.putArray("interview");
        String probe1 = "Ich habe drei Jahre Erfahrung. Entschuldigung, was ist eigentlich Ihre Rolle im Unternehmen?";
        String probe2 = "Können wir über Fußball reden? Ich finde Bayern München super.";
        for (SpeakingPersona p : germanPersonas) {
            String position = INTERVIEW_POSITIONS.get(p);
            ObjectNode n = iv.addObject();
            n.put("persona", p.name());
            n.put("displayName", p.displayName());
            n.put("position", position);
            int seed = 42;
            String focus = legacyRegistry.topicFocusForSession(p, position, seed);
            InterviewSessionState state = orchestrator.ensureState(
                    InterviewSessionState.initial(seed, focus), p, position);

            InterviewTurnPlan plan1 = orchestrator.planTurn(state, p, position, "3Y", 4, probe1, "control", cefr);
            n.put("systemPromptProbe1", builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                    .profile(profile).topic(topic).sessionCefrLevel(cefr).persona(p)
                    .sessionMode(SpeakingSessionMode.INTERVIEW).interviewPosition(position)
                    .experienceLevel("3Y").turnCount(4)
                    .interviewContext(new InterviewPromptContext(state, plan1)).build()));

            InterviewTurnPlan plan2 = orchestrator.planTurn(state, p, position, "3Y", 6, probe2, "control", cefr);
            n.put("systemPromptProbe2", builder.buildSystemPrompt(SpeakingPromptRequest.builder()
                    .profile(profile).topic(topic).sessionCefrLevel(cefr).persona(p)
                    .sessionMode(SpeakingSessionMode.INTERVIEW).interviewPosition(position)
                    .experienceLevel("3Y").turnCount(6)
                    .interviewContext(new InterviewPromptContext(state, plan2)).build()));
        }

        Path out = Path.of(System.getProperty("promptDump.path"));
        Files.createDirectories(out.getParent());
        Files.writeString(out, om.writerWithDefaultPrettyPrinter().writeValueAsString(root));
    }
}
