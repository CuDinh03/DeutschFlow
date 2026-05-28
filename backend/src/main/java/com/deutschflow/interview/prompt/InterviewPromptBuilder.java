package com.deutschflow.interview.prompt;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.service.InterviewRubricService;
import com.deutschflow.interview.service.PersonaRegistryService;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.interview.PersonaInterviewRegistry;
import com.deutschflow.speaking.persona.SpeakingPersona;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Assembles the layered interview system prompt.
 *
 * <p>The existing {@code SystemPromptBuilder.appendInterviewPreamble} is a single 170-line
 * method that conflates orchestration and scoring. This builder separates the concerns into
 * five discrete layers, making each independently testable and A/B-testable.
 *
 * <p>Integration: call {@link #build} and use the result in place of the
 * {@code appendInterviewPreamble} call in {@code SystemPromptBuilder}. The surrounding
 * context lines (schema instruction, persona section, adaptive policy) continue to be
 * appended by {@code SystemPromptBuilder} so no existing behavior is broken.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewPromptBuilder {

    private final BaseSystemPolicyLayer baseLayer;
    private final PersonaPromptLayer personaLayer;
    private final PhasePromptLayer phaseLayer;
    private final ResponseRulesLayer responseRulesLayer;
    private final ScoringPromptLayer scoringLayer;
    private final PersonaRegistryService personaRegistryService;
    private final InterviewRubricService rubricService;
    private final PersonaInterviewRegistry legacyRegistry;

    private static final List<InterviewPromptLayer> LAYER_ORDER = List.of();

    /**
     * Builds the full interview prompt preamble from layered components.
     *
     * @param persona         speaking persona enum value (for backward compat)
     * @param cefrLevel       CEFR level for difficulty calibration
     * @param state           current interview session state
     * @param plan            current turn plan from orchestrator
     * @param position        job position being interviewed for
     * @param experienceLevel candidate's experience level string
     * @param industry        industry label (from persona registry or fallback)
     * @param promptVariant   A/B variant key (may affect layer selection in future)
     */
    public String build(SpeakingPersona persona,
                        String cefrLevel,
                        InterviewSessionState state,
                        InterviewTurnPlan plan,
                        String position,
                        String experienceLevel,
                        String industry,
                        String promptVariant) {

        String personaCode = persona != null ? persona.name() : "DEFAULT";
        Optional<InterviewPersonaEntity> personaEntity = personaRegistryService.findByCode(personaCode);

        String personaDisplayName = persona != null ? persona.displayName() : "HR-Manager";
        String personaRole = personaEntity.map(InterviewPersonaEntity::getRoleTitle)
                .orElse(resolvePersonaRole(persona));
        String resolvedIndustry = personaEntity.map(InterviewPersonaEntity::getIndustry)
                .orElse(industry != null ? industry : "Allgemein");

        Optional<InterviewRubricService.RubricSnapshot> rubric =
                rubricService.snapshotForIndustry(resolvedIndustry);

        InterviewPhase phase = plan.phase();
        String phaseName = switch (phase) {
            case INTRO -> "Begrüßung & Selbstvorstellung";
            case ICE_BREAKER -> "Ice-Breaker";
            case HARD_SKILLS -> "Fachliche Kompetenz / Hard Skills";
            case STAR_SOFT -> "Soft Skills & STAR";
            case CLOSING -> "Abschluss";
        };

        String topicFocus = state.getSessionTopicFocus() != null
                ? state.getSessionTopicFocus()
                : legacyRegistry.topicFocusForSession(persona, position, state.getSeed());

        var ctx = new InterviewPromptLayer.InterviewPromptContext(
                personaCode,
                personaDisplayName,
                personaRole,
                resolvedIndustry,
                position != null ? position : "Allgemeine Position",
                experienceLevel != null ? experienceLevel : "unbekannt",
                cefrLevel != null ? cefrLevel : "A2",
                state.getSeed(),
                plan.userTurn(),
                phaseName,
                String.valueOf(phase.number()),
                topicFocus,
                String.join(", ", state.getTopicsCovered()),
                plan.directive().name(),
                plan.directiveInstruction(),
                plan.mandatoryQuestion(),
                plan.ackMaxWords(),
                String.join(", ", plan.forbiddenPhrases()),
                plan.closingAnswerGuide(),
                plan.userTurn() >= 13,
                rubric.map(InterviewRubricService.RubricSnapshot::criteriaJson).orElse(null),
                rubric.map(InterviewRubricService.RubricSnapshot::weightJson).orElse(null),
                promptVariant
        );

        StringBuilder sb = new StringBuilder();
        baseLayer.appendTo(sb, ctx);
        personaLayer.appendTo(sb, ctx);
        phaseLayer.appendTo(sb, ctx);
        scoringLayer.appendTo(sb, ctx);
        responseRulesLayer.appendTo(sb, ctx);
        return sb.toString();
    }

    private String resolvePersonaRole(SpeakingPersona persona) {
        if (persona == null) return "HR-Managerin";
        return switch (persona) {
            case LUKAS    -> "Senior Tech Lead";
            case EMMA     -> "Business Development Managerin";
            case ANNA     -> "Studienberaterin & Karriere-Coach";
            case KLAUS    -> "Küchenchef";
            case HANNIE   -> "Moderatorin & MC";
            case LENA     -> "Filialleiterin im Einzelhandel";
            case THOMAS   -> "Bäckermeister";
            case PETRA    -> "Metzgerin";
            case SARAH    -> "Medizinische Fachangestellte";
            case SCHNEIDER-> "Augenarzt";
            case WEBER    -> "Dermatologin";
            case MAX      -> "Maschinenbediener";
            case OLIVER   -> "CNC-Fräser";
            case NIKLAS   -> "Kellner";
            case NINA     -> "Rezeptionistin";
            default       -> "HR-Managerin";
        };
    }
}
