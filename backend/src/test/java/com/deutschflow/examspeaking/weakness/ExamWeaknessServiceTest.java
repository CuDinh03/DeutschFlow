package com.deutschflow.examspeaking.weakness;

import com.deutschflow.examspeaking.dto.WeaknessView;
import com.deutschflow.examspeaking.entity.SpeakingExamErrorStat;
import com.deutschflow.examspeaking.repository.SpeakingExamErrorStatRepository;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamWeaknessServiceTest {

    private SpeakingExamErrorStatRepository statRepository;
    private UserErrorSkillRepository skillRepository;
    private UserGrammarErrorRepository grammarErrorRepository;
    private ExamWeaknessService service;

    private final LocalDateTime now = LocalDateTime.now();

    @BeforeEach
    void setUp() {
        statRepository = mock(SpeakingExamErrorStatRepository.class);
        skillRepository = mock(UserErrorSkillRepository.class);
        grammarErrorRepository = mock(UserGrammarErrorRepository.class);
        when(grammarErrorRepository.findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(anyLong())).thenReturn(List.of());
        service = new ExamWeaknessService(statRepository, skillRepository, grammarErrorRepository,
                new RedemittelCatalog(new ObjectMapper()));
    }

    private static SpeakingExamErrorStat stat(String provider, String level, int teil, String archetype,
                                              String code, int count, LocalDateTime seen) {
        return SpeakingExamErrorStat.builder().userId(7L).provider(provider).level(level).teilNo(teil)
                .archetype(archetype).errorCode(code).seenCount(count).lastSeenAt(seen)
                .lastOriginal("orig-" + code).lastCorrection("corr-" + code).build();
    }

    @Test
    void groupsStatsByCodeAndOrdersByskillPriority() {
        when(statRepository.findByUserIdOrderByLastSeenAtDesc(7L)).thenReturn(List.of(
                stat("GOETHE", "B1", 1, "PRESENT", "VERB_POSITION", 2, now),
                stat("GOETHE", "B1", 3, "DISCUSS", "VERB_POSITION", 1, now.minusHours(1)),
                stat("TELC", "B1", 2, "DISCUSS", "ARTICLE_GENDER", 5, now.minusHours(2))));
        when(skillRepository.findByUserIdOrderByPriorityScoreDesc(7L)).thenReturn(List.of(
                UserErrorSkill.builder().userId(7L).errorCode("VERB_POSITION").totalCount(9).openCount(4)
                        .lastSeverity("MAJOR").lastSeenAt(now).priorityScore(BigDecimal.valueOf(8)).build(),
                UserErrorSkill.builder().userId(7L).errorCode("ARTICLE_GENDER").totalCount(5).openCount(5)
                        .lastSeverity("MINOR").lastSeenAt(now).priorityScore(BigDecimal.valueOf(3)).build()));
        when(grammarErrorRepository.findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(7L, "VERB_POSITION"))
                .thenReturn(Optional.of(UserGrammarError.builder().ruleViShort("Động từ đứng vị trí 2").build()));

        WeaknessView view = service.weakness(7L, null, null);

        assertThat(view.weakPoints()).hasSize(2);
        WeaknessView.WeakPoint first = view.weakPoints().get(0);
        assertThat(first.errorCode()).isEqualTo("VERB_POSITION");
        assertThat(first.ruleVi()).isEqualTo("Động từ đứng vị trí 2");
        assertThat(first.totalCount()).isEqualTo(9);
        // examCount = TỔNG seenCount các stats exam (2+1) — KHÔNG phải totalCount toàn cục (QS-5 N0.7)
        assertThat(first.examCount()).isEqualTo(3);
        assertThat(first.contexts()).hasSize(2);
        assertThat(first.contexts().get(0).archetype()).isEqualTo("PRESENT"); // count 2 > 1
        assertThat(first.exampleOriginal()).isEqualTo("orig-VERB_POSITION");

        // packs chỉ chứa archetype đang yếu, band B1_B2
        assertThat(view.packs()).extracting(WeaknessView.RedemittelPack::archetype)
                .containsExactlyInAnyOrder("PRESENT", "DISCUSS");
    }

    @Test
    void filtersByProviderAndLevel() {
        when(statRepository.findByUserIdAndProviderAndLevelOrderByLastSeenAtDesc(7L, "GOETHE", "A2"))
                .thenReturn(List.of(stat("GOETHE", "A2", 1, "CARD_QA", "W_QUESTION_FORM", 1, now)));

        WeaknessView view = service.weakness(7L, "GOETHE", "a2");

        assertThat(view.weakPoints()).hasSize(1);
        assertThat(view.weakPoints().get(0).errorCode()).isEqualTo("W_QUESTION_FORM");
        // fallback: chưa có skill row → totalCount = số lần thấy trong exam
        assertThat(view.weakPoints().get(0).totalCount()).isEqualTo(1);
        assertThat(view.weakPoints().get(0).examCount()).isEqualTo(1);
    }

    @Test
    void emptyStatsStillReturnsPacksForLevel() {
        when(statRepository.findByUserIdOrderByLastSeenAtDesc(7L)).thenReturn(List.of());

        WeaknessView view = service.weakness(7L, null, "B1");

        assertThat(view.weakPoints()).isEmpty();
        assertThat(view.packs()).isNotEmpty(); // toàn bộ gói B1_B2 — màn không trống
    }
}
