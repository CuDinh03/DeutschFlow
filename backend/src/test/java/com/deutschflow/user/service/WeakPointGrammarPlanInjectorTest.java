package com.deutschflow.user.service;

import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeakPointGrammarPlanInjectorTest {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @Mock
    private UserErrorSkillRepository skillRepository;

    private WeakPointGrammarPlanInjector injector;

    @BeforeEach
    void setUp() {
        injector = new WeakPointGrammarPlanInjector(skillRepository);
    }

    @Test
    void no_skills_returns_NO_SKILLS() {
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(1L)).thenReturn(List.of());
        var res = injector.injectWeakPointGrammarSession(1L, minimalPlan(1), true);
        assertThat(res.injected()).isFalse();
        assertThat(res.reason()).isEqualTo("NO_SKILLS");
    }

    @Test
    void inject_first_time_with_enforceCooldown_updates_adaptiveMeta() {
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(7L)).thenReturn(List.of(skill(7L, "VERB.CONJ_PERSON_ENDING")));
        Map<String, Object> plan = minimalPlan(1);
        var res = injector.injectWeakPointGrammarSession(7L, plan, true);
        assertThat(res.injected()).isTrue();
        assertThat(res.reason()).isEqualTo("INJECTED");
        assertThat(res.errorCode()).isEqualTo("VERB.CONJ_PERSON_ENDING");
        assertThat(res.week()).isEqualTo(2);
        assertThat(res.sessionIndex()).isEqualTo(2);

        assertThat(plan.get("adaptiveMeta")).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) plan.get("adaptiveMeta");
        assertThat(meta.get("lastErrorCode")).isEqualTo("VERB.CONJ_PERSON_ENDING");
        assertThat(meta.get("lastInjectedWeek")).isEqualTo(2);
        assertThat(meta.get("count")).isEqualTo(1);
    }

    @Test
    void inject_first_time_without_enforceCooldown_does_not_touch_adaptiveMeta() {
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(2L)).thenReturn(List.of(skill(2L, "CASE.PREP_DAT_MIT")));
        Map<String, Object> plan = minimalPlan(1);
        var res = injector.injectWeakPointGrammarSession(2L, plan, false);
        assertThat(res.injected()).isTrue();
        assertThat(plan.containsKey("adaptiveMeta")).isFalse();
    }

    @Test
    void inject_twice_same_code_Yields_DEDUP() {
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(3L)).thenReturn(List.of(skill(3L, "WORD_ORDER.V2_MAIN_CLAUSE")));
        Map<String, Object> plan = minimalPlan(1);
        assertThat(injector.injectWeakPointGrammarSession(3L, plan, false).injected()).isTrue();
        var second = injector.injectWeakPointGrammarSession(3L, plan, false);
        assertThat(second.injected()).isFalse();
        assertThat(second.reason()).isEqualTo("DEDUP_WEEK_CODE");
    }

    @Test
    void inject_within_24h_with_enforceCooldown_Yields_COOLDOWN() {
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(4L)).thenReturn(List.of(skill(4L, "VERB.PARTIZIP_II_FORM")));
        Map<String, Object> plan = minimalPlan(1);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("lastInjectedAt", LocalDateTime.now().format(ISO));
        meta.put("count", 1);
        plan.put("adaptiveMeta", meta);

        var res = injector.injectWeakPointGrammarSession(4L, plan, true);
        assertThat(res.injected()).isFalse();
        assertThat(res.reason()).isEqualTo("COOLDOWN_24H");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) ((Map<String, Object>) ((List<?>) plan.get("weeks")).get(1)).get("sessions");
        assertThat(sessions.stream().anyMatch(s -> Boolean.TRUE.equals(s.get("weakPointAdaptive")))).isFalse();
    }

    @Test
    void inject_after_24h_with_enforceCooldown_Yields_INJECTED() {
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(5L)).thenReturn(List.of(skill(5L, "ARTICLE.GENDER_WRONG_DER_DIE_DAS")));
        Map<String, Object> plan = minimalPlan(1);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("lastInjectedAt", LocalDateTime.now().minusHours(25).format(ISO));
        meta.put("count", 0);
        plan.put("adaptiveMeta", meta);

        var res = injector.injectWeakPointGrammarSession(5L, plan, true);
        assertThat(res.injected()).isTrue();
        assertThat(res.reason()).isEqualTo("INJECTED");
        @SuppressWarnings("unchecked")
        Map<String, Object> metaOut = (Map<String, Object>) plan.get("adaptiveMeta");
        assertThat(metaOut.get("count")).isEqualTo(1);
    }

    private static UserErrorSkill skill(long userId, String code) {
        return UserErrorSkill.builder()
                .userId(userId)
                .errorCode(code)
                .lastSeenAt(LocalDateTime.now())
                .lastSeverity("HIGH")
                .priorityScore(BigDecimal.valueOf(10))
                .build();
    }

    /**
     * Week 1 and week 2, each with one plain GRAMMAR session. {@code currentWeek} drives target week = currentWeek+1.
     */
    private static Map<String, Object> minimalPlan(int currentWeek) {
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("weeksTotal", 8);

        List<Map<String, Object>> weeks = new ArrayList<>();
        weeks.add(weekBlock(1, 1));
        weeks.add(weekBlock(2, 1));
        plan.put("weeks", weeks);

        Map<String, Object> progress = new LinkedHashMap<>();
        progress.put("currentWeek", currentWeek);
        progress.put("currentSessionIndex", 1);
        progress.put("completedSessions", 0);
        plan.put("progress", progress);

        return plan;
    }

    private static Map<String, Object> weekBlock(int weekNumber, int firstSessionIndex) {
        Map<String, Object> w = new LinkedHashMap<>();
        w.put("week", weekNumber);
        List<Map<String, Object>> sessions = new ArrayList<>();
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("index", firstSessionIndex);
        s.put("type", "GRAMMAR");
        s.put("minutes", 25);
        sessions.add(s);
        w.put("sessions", sessions);
        return w;
    }
}
