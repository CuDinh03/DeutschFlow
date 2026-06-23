package com.deutschflow.teacher.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobSseService;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.quota.FreeTierGuard;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.teacher.service.DocumentParsingService;
import com.deutschflow.teacher.service.PptxStore;
import com.deutschflow.teacher.service.TeacherLessonPlanService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Suite F — IDOR teacher↔teacher on the async PPTX-material jobs (assertOwnsJob), plus the
 * one-time-download / missing-job 404 paths. The {@code hasRole('TEACHER') or ADMIN} method gate
 * (F7) is exercised through the real filter chain in {@link com.deutschflow.security.RoleInteractionGateRbacTest};
 * here we lock the ownership/not-found logic with mocked stores (no DB).
 */
@ExtendWith(MockitoExtension.class)
class TeacherMaterialControllerTest {

    @Mock TeacherLessonPlanService lessonPlanService;
    @Mock DocumentParsingService documentParsingService;
    @Mock AsyncJobService asyncJobService;
    @Mock AsyncJobSseService asyncJobSseService;
    @Mock PptxStore pptxStore;
    @Mock OrgPoolGuard orgPoolGuard;
    @Mock FreeTierGuard freeTierGuard;

    @InjectMocks TeacherMaterialController controller;

    private static final User TEACHER_A = User.builder().id(1L).role(User.Role.TEACHER).build();
    private static final User TEACHER_B = User.builder().id(2L).role(User.Role.TEACHER).build();
    private static final UUID JOB = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private AsyncJob jobOwnedBy(Long uid) {
        return AsyncJob.builder().id(JOB).createdByUserId(uid).status(AsyncJob.Status.PENDING.name()).build();
    }

    // ── F6: teacher B cannot touch teacher A's job ───────────────────────────────

    @Test
    @DisplayName("getJobStatus: teacher B đọc job của teacher A → Forbidden")
    void getJobStatus_otherOwner_throwsForbidden() {
        when(asyncJobService.getJob(JOB)).thenReturn(Optional.of(jobOwnedBy(TEACHER_A.getId())));

        assertThatThrownBy(() -> controller.getJobStatus(TEACHER_B, JOB))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("downloadPptx: teacher B tải job của teacher A → Forbidden, KHÔNG chạm store")
    void downloadPptx_otherOwner_throwsForbidden() {
        when(asyncJobService.getJob(JOB)).thenReturn(Optional.of(jobOwnedBy(TEACHER_A.getId())));

        assertThatThrownBy(() -> controller.downloadPptx(TEACHER_B, JOB))
                .isInstanceOf(ForbiddenException.class);
        verify(pptxStore, never()).getAndRemove(any());
    }

    @Test
    @DisplayName("subscribeToJob (SSE): teacher B nghe job của teacher A → Forbidden")
    void subscribeToJob_otherOwner_throwsForbidden() {
        when(asyncJobService.getJob(JOB)).thenReturn(Optional.of(jobOwnedBy(TEACHER_A.getId())));

        assertThatThrownBy(() -> controller.subscribeToJob(TEACHER_B, JOB))
                .isInstanceOf(ForbiddenException.class);
        verify(asyncJobSseService, never()).register(any());
    }

    // ── F8: missing job / already-downloaded → 404 ───────────────────────────────

    @Test
    @DisplayName("getJobStatus: jobId không tồn tại → 404")
    void getJobStatus_missing_returns404() {
        when(asyncJobService.getJob(JOB)).thenReturn(Optional.empty());

        assertThat(controller.getJobStatus(TEACHER_A, JOB).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("downloadPptx: gọi lần 2 (store đã getAndRemove) → 404")
    void downloadPptx_alreadyRemoved_returns404() {
        when(asyncJobService.getJob(JOB)).thenReturn(Optional.of(jobOwnedBy(TEACHER_A.getId())));
        when(pptxStore.getAndRemove(JOB)).thenReturn(null);

        assertThat(controller.downloadPptx(TEACHER_A, JOB).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── positive control: the owner is allowed ───────────────────────────────────

    @Test
    @DisplayName("getJobStatus: chính chủ → 200")
    void getJobStatus_owner_returns200() {
        when(asyncJobService.getJob(JOB)).thenReturn(Optional.of(jobOwnedBy(TEACHER_A.getId())));

        assertThat(controller.getJobStatus(TEACHER_A, JOB).getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
