package com.deutschflow.interview.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.interview.dto.InterviewRubricUpdateRequest;
import com.deutschflow.interview.entity.InterviewRubricTemplate;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Guards A-8: {@code PUT /api/admin/interviews/rubrics/{id}} used to store {@code criteriaJson} /
 * {@code weightJson} verbatim with no validation and no audit — malformed JSON slipped in and only
 * blew up later, in the interview-grading consumer that parses it.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("admin interview rubric · JSON validation + audit")
class InterviewAdminControllerRubricTest {

    @Mock
    private InterviewPersonaRepository personaRepository;
    @Mock
    private InterviewRubricTemplateRepository rubricRepository;
    @Mock
    private AuditLogService auditLogService;

    private InterviewAdminController controller;

    @BeforeEach
    void setUp() {
        controller = new InterviewAdminController(
                personaRepository, rubricRepository, new ObjectMapper(), auditLogService);
    }

    @Test
    @DisplayName("rejects malformed criteriaJson before persisting or auditing (A-8)")
    void rejectsMalformedJson() {
        when(rubricRepository.findById(1L)).thenReturn(Optional.of(new InterviewRubricTemplate()));
        InterviewRubricUpdateRequest req = new InterviewRubricUpdateRequest("{not valid json", null);

        assertThatThrownBy(() -> controller.updateRubric(1L, req, null))
                .isInstanceOf(BadRequestException.class);
        verify(rubricRepository, never()).save(any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("valid JSON persists (version bumped) and leaves an audit trail (A-8)")
    void validJsonPersistsAndAudits() {
        InterviewRubricTemplate rubric = new InterviewRubricTemplate();
        when(rubricRepository.findById(1L)).thenReturn(Optional.of(rubric));
        when(rubricRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        InterviewRubricUpdateRequest req = new InterviewRubricUpdateRequest("{\"a\":1}", "{\"w\":0.5}");

        assertThatCode(() -> controller.updateRubric(1L, req, null)).doesNotThrowAnyException();

        verify(rubricRepository).save(any());
        // F-M4 (03/09/2026): controller nay truyền AuditActor thay vì (null, email, role) rời rạc.
        verify(auditLogService).log(
                eq("admin.interview.rubric.updated"), eq(new AuditActor(null, null, null)),
                eq("INTERVIEW_RUBRIC"), eq("1"), anyMap());
    }
}
