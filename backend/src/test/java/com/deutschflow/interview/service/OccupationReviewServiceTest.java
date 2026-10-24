package com.deutschflow.interview.service;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.interview.dto.OccupationContentReviewRequest;
import com.deutschflow.interview.dto.OccupationReviewDto;
import com.deutschflow.interview.entity.Occupation;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OccupationReviewServiceTest {

    @Mock OccupationRepository occupationRepository;
    @Mock OccupationQuestionRepository questionRepository;
    @Mock OccupationTermRepository termRepository;
    @Mock OccupationContentGenerator contentGenerator;
    @Mock AuditLogService auditLogService;
    @InjectMocks OccupationReviewService service;

    @Test
    void queueShowsMostChosenFirstThenNursingAndConstructionThenCatalogRank() {
        when(questionRepository.findByStatusOrderByCreatedAtAscIdAsc(OccupationContentStatus.AI_GENERATED))
                .thenReturn(List.of(q("occ_koch_1", "buerokauf"), q("occ_a", "maurer"), q("occ_b", "pflegehelfer"),
                        q("occ_c", "florist")));
        when(termRepository.findByStatusOrderByCreatedAtAscIdAsc(OccupationContentStatus.AI_GENERATED))
                .thenReturn(List.of());
        when(occupationRepository.findAllById(any())).thenReturn(List.of(
                occ("buerokauf", "buero", 50), occ("maurer", "bau", 900), occ("pflegehelfer", "pflege", 800),
                occ("florist", "handel", 10)));
        when(questionRepository.countSessionsByOccupation())
                .thenReturn(List.<Object[]>of(new Object[]{"buerokauf", 7L}));

        List<OccupationReviewDto> queue = service.queue(OccupationContentStatus.AI_GENERATED);

        assertThat(queue).extracting(OccupationReviewDto::code)
                .containsExactly("buerokauf", "pflegehelfer", "maurer", "florist");
        assertThat(queue.get(0).sessionCount()).isEqualTo(7L);
    }

    @Test
    void reviewerCanEditThenApproveAndItIsAudited() {
        OccupationQuestion q = q("occ_x", "maurer");
        when(questionRepository.findById("occ_x")).thenReturn(Optional.of(q));
        User reviewer = mock(User.class);
        when(reviewer.getId()).thenReturn(42L);

        OccupationReviewDto.QuestionItem item = service.reviewQuestion("occ_x",
                new OccupationContentReviewRequest(OccupationContentStatus.APPROVED,
                        " Wie mauern Sie eine tragende Wand? ", " Bạn xây một bức tường chịu lực thế nào? ", null,
                        null, null, null, null, ""), reviewer);

        assertThat(item.status()).isEqualTo("APPROVED");
        assertThat(item.questionDe()).isEqualTo("Wie mauern Sie eine tragende Wand?");
        // K4: người duyệt sửa bản dịch cùng lúc; ô để trống giữ nguyên bản dịch cũ.
        assertThat(item.questionVi()).isEqualTo("Bạn xây một bức tường chịu lực thế nào?");
        assertThat(item.questionEn()).isEqualTo("How do you build a load-bearing wall?");
        assertThat(q.getReviewedBy()).isEqualTo(42L);
        assertThat(q.getReviewedAt()).isNotNull();
        assertThat(q.getReviewNote()).isNull();
        verify(auditLogService).log(eq("admin.occupation.question.reviewed"), any(), eq("OCCUPATION_QUESTION"),
                eq("occ_x"), anyMap());
    }

    @Test
    void decisionMustBeApproveOrReject() {
        assertThatThrownBy(() -> service.reviewQuestion("occ_x",
                new OccupationContentReviewRequest(OccupationContentStatus.AI_GENERATED, null, null, null, null, null,
                        null, null, null),
                null)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(questionRepository);
    }

    @Test
    void generateRefusesCuratedOccupationsAndReportsAiFailure() {
        Occupation waiter = occ("kellner", "gastro", 30);
        waiter.setLegacyPersonaCode("NIKLAS");
        waiter.setLegacyPositionDe("Kellner/in");
        when(occupationRepository.findById("kellner")).thenReturn(Optional.of(waiter));
        assertThatThrownBy(() -> service.generate("kellner", null)).isInstanceOf(ConflictException.class);

        Occupation mason = occ("maurer", "bau", 900);
        when(occupationRepository.findById("maurer")).thenReturn(Optional.of(mason));
        when(contentGenerator.generate(mason)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.generate("maurer", null)).isInstanceOf(AiServiceException.class);
    }

    private static OccupationQuestion q(String id, String code) {
        return OccupationQuestion.builder().id(id).occupationCode(code).topicKey("t")
                .questionDe("Frage?").questionEn("How do you build a load-bearing wall?").build();
    }

    private static Occupation occ(String code, String workplace, int rank) {
        return Occupation.builder().code(code).nameDe(code).nameEn(code).nameVi(code).workplace(workplace)
                .sortRank(rank).build();
    }
}
