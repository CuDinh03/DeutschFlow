package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.entity.TeacherSession;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.teacher.repository.TeacherSessionRepository;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeacherSessionServiceTest {

    @Mock
    private TeacherSessionRepository sessionRepository;

    @Mock
    private TeacherProfileRepository profileRepository;

    @Mock
    private com.deutschflow.common.audit.AuditLogService auditLogService;

    private TeacherSessionService service;

    private static final User OWNER = User.builder().id(1L).role(User.Role.TEACHER).build();
    private static final User OTHER_TEACHER = User.builder().id(2L).role(User.Role.TEACHER).build();
    private static final User ADMIN = User.builder().id(3L).role(User.Role.ADMIN).build();
    private static final User STUDENT = User.builder().id(5L).role(User.Role.STUDENT).build();

    @BeforeEach
    void setUp() {
        service = new TeacherSessionService(sessionRepository, profileRepository, auditLogService);
    }

    private void mockProfileOwnedBy(Long profileId, User owner) {
        when(profileRepository.findByIdWithUser(profileId)).thenReturn(Optional.of(
                TeacherProfile.builder().id(profileId).user(owner).build()));
    }

    // ─── IDOR guard: profileId từ request param phải thuộc về caller ─────────────

    @Test
    void getTeacherSessions_throwsForbidden_whenProfileBelongsToAnotherTeacher() {
        mockProfileOwnedBy(10L, OWNER);

        assertThrows(ForbiddenException.class,
                () -> service.getTeacherSessions(OTHER_TEACHER, 10L, 0));
        verify(sessionRepository, never()).findByTeacherProfileId(anyLong(), any(Pageable.class));
    }

    @Test
    void getTeacherSessions_returnsSessions_forProfileOwner() {
        mockProfileOwnedBy(10L, OWNER);
        when(sessionRepository.findByTeacherProfileId(eq(10L), any(Pageable.class)))
                .thenReturn(Page.empty());

        service.getTeacherSessions(OWNER, 10L, 0);

        verify(sessionRepository).findByTeacherProfileId(eq(10L), any(Pageable.class));
    }

    @Test
    void getTeacherSessions_allowsAdmin_withoutOwnership() {
        when(sessionRepository.findByTeacherProfileId(eq(10L), any(Pageable.class)))
                .thenReturn(Page.empty());

        service.getTeacherSessions(ADMIN, 10L, 0);

        verify(sessionRepository).findByTeacherProfileId(eq(10L), any(Pageable.class));
        verify(profileRepository, never()).findByIdWithUser(anyLong());
    }

    @Test
    void getEarningsSummary_throwsForbidden_whenProfileBelongsToAnotherTeacher() {
        mockProfileOwnedBy(10L, OWNER);

        assertThrows(ForbiddenException.class,
                () -> service.getEarningsSummary(OTHER_TEACHER, 10L));
        verify(sessionRepository, never()).sumEarningsByTeacherProfile(anyLong());
    }

    @Test
    void getEarningsSummary_returnsSummary_forProfileOwner() {
        mockProfileOwnedBy(10L, OWNER);
        when(sessionRepository.sumEarningsByTeacherProfile(10L)).thenReturn(1_000_000L);

        Map<String, Object> result = service.getEarningsSummary(OWNER, 10L);

        assertEquals(1_000_000L, result.get("totalEarningsVnd"));
        assertEquals(150_000L, result.get("platformFeeVnd"));
        assertEquals(850_000L, result.get("netEarningsVnd"));
    }

    @Test
    void getEarningsSummary_throwsNotFound_whenProfileMissing() {
        when(profileRepository.findByIdWithUser(99L)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class,
                () -> service.getEarningsSummary(OWNER, 99L));
    }

    // ─── G-1: org teachers are hidden from 1:1 booking (symmetric with GET /{id}) ─

    @Test
    void bookSession_throwsNotFound_whenTeacherBelongsToOrg() {
        User orgTeacher = User.builder().id(20L).role(User.Role.TEACHER).orgId(7L).build();
        when(profileRepository.findByIdWithUser(30L)).thenReturn(Optional.of(
                TeacherProfile.builder().id(30L).user(orgTeacher).build()));

        assertThrows(NotFoundException.class,
                () -> service.bookSession(STUDENT, 30L, "Ôn B1", null,
                        LocalDateTime.now().plusDays(1), 60));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void bookSession_succeeds_forPublicTutor() {
        User tutor = User.builder().id(21L).role(User.Role.TEACHER).orgId(null).build();
        when(profileRepository.findByIdWithUser(31L)).thenReturn(Optional.of(
                TeacherProfile.builder().id(31L).user(tutor).hourlyRateVnd(200_000L).build()));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.bookSession(STUDENT, 31L, "Ôn B1", null, LocalDateTime.now().plusDays(1), 60);

        verify(sessionRepository).save(any());
    }

    @Test
    void bookSession_throwsNotFound_whenProfileMissing() {
        when(profileRepository.findByIdWithUser(99L)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class,
                () -> service.bookSession(STUDENT, 99L, "x", null,
                        LocalDateTime.now().plusDays(1), 60));
        verify(sessionRepository, never()).save(any());
    }

    // ─── F-M3: mark-paid là thao tác TIỀN, phải để lại vết ───────────────────────────────

    @Test
    @org.junit.jupiter.api.DisplayName("markPayoutProcessed ghi vết kèm danh sách id ĐÃ đổi trạng thái")
    @SuppressWarnings("unchecked")
    void markPayoutProcessed_writesAuditWithActuallyProcessedIds() {
        TeacherSession pending = TeacherSession.builder().id(11L)
                .payoutStatus(TeacherSession.PayoutStatus.PENDING).build();
        TeacherSession alreadyPaid = TeacherSession.builder().id(12L)
                .payoutStatus(TeacherSession.PayoutStatus.PROCESSED).build();
        when(sessionRepository.findById(11L)).thenReturn(Optional.of(pending));
        when(sessionRepository.findById(12L)).thenReturn(Optional.of(alreadyPaid));
        when(sessionRepository.findById(13L)).thenReturn(Optional.empty());
        com.deutschflow.common.audit.AuditActor actor =
                new com.deutschflow.common.audit.AuditActor(9L, "admin@x.com", "ADMIN");

        service.markPayoutProcessed(java.util.List.of(11L, 12L, 13L), actor);

        org.mockito.ArgumentCaptor<java.util.Map> meta =
                org.mockito.ArgumentCaptor.forClass(java.util.Map.class);
        verify(auditLogService).log(
                org.mockito.ArgumentMatchers.eq("admin.teacher_session.payout.marked_paid"),
                org.mockito.ArgumentMatchers.eq(actor),
                org.mockito.ArgumentMatchers.eq("TEACHER_SESSION"),
                org.mockito.ArgumentMatchers.isNull(),
                meta.capture());
        // Vết phải nói cái ĐÃ XẢY RA: chỉ 11L đổi trạng thái. 12L đã PROCESSED sẵn, 13L không tồn tại.
        assertThat(meta.getValue()).containsEntry("requestedCount", 3)
                .containsEntry("processedCount", 1)
                .containsEntry("processedSessionIds", java.util.List.of(11L));
    }

    @Test
    @org.junit.jupiter.api.DisplayName("phiên đã PROCESSED không bị ghi đè payoutProcessedAt lần hai")
    void markPayoutProcessed_isIdempotentPerSession() {
        TeacherSession alreadyPaid = TeacherSession.builder().id(12L)
                .payoutStatus(TeacherSession.PayoutStatus.PROCESSED).build();
        when(sessionRepository.findById(12L)).thenReturn(Optional.of(alreadyPaid));

        service.markPayoutProcessed(java.util.List.of(12L), null);

        verify(sessionRepository, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
    }

    // ─── R-H2: máy trạng thái phiên học chống double-payout ───────────────────────

    private TeacherSession sessionOwnedBy(User teacher, User student,
                                          TeacherSession.Status status,
                                          TeacherSession.PayoutStatus payout) {
        TeacherProfile profile = TeacherProfile.builder().id(50L).user(teacher).build();
        return TeacherSession.builder().id(70L)
                .teacherProfile(profile).student(student)
                .status(status).payoutStatus(payout).build();
    }

    @Test
    @org.junit.jupiter.api.DisplayName("R-H2: re-COMPLETED phiên đã chi trả bị chặn — payout KHÔNG lật về PENDING")
    void updateStatus_rejectsReCompletingAlreadyPaidSession() {
        TeacherSession paid = sessionOwnedBy(OWNER, STUDENT,
                TeacherSession.Status.COMPLETED, TeacherSession.PayoutStatus.PROCESSED);
        when(sessionRepository.findByIdFull(70L)).thenReturn(Optional.of(paid));

        // Giáo viên của phiên cố PATCH lại COMPLETED — đường double-payout của R-H2.
        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> service.updateStatus(OWNER, 70L, "COMPLETED", null));

        assertEquals(TeacherSession.PayoutStatus.PROCESSED, paid.getPayoutStatus());
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("R-H2: học viên KHÔNG huỷ được phiên đã hoàn thành")
    void updateStatus_rejectsCancellingCompletedSession() {
        TeacherSession completed = sessionOwnedBy(OWNER, STUDENT,
                TeacherSession.Status.COMPLETED, TeacherSession.PayoutStatus.PENDING);
        when(sessionRepository.findByIdFull(70L)).thenReturn(Optional.of(completed));

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> service.updateStatus(STUDENT, 70L, "CANCELLED", null));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("R-H2: CONFIRMED→COMPLETED hợp lệ, đánh dấu payout PENDING")
    void updateStatus_allowsConfirmedToCompleted_marksPayoutPending() {
        TeacherSession confirmed = sessionOwnedBy(OWNER, STUDENT,
                TeacherSession.Status.CONFIRMED, TeacherSession.PayoutStatus.PENDING);
        when(sessionRepository.findByIdFull(70L)).thenReturn(Optional.of(confirmed));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.updateStatus(OWNER, 70L, "COMPLETED", "buổi tốt");

        assertEquals(TeacherSession.Status.COMPLETED, confirmed.getStatus());
        assertEquals(TeacherSession.PayoutStatus.PENDING, confirmed.getPayoutStatus());
        verify(sessionRepository).save(confirmed);
    }

    @Test
    @org.junit.jupiter.api.DisplayName("R-H2: PENDING→COMPLETED (bỏ qua CONFIRMED) bị chặn")
    void updateStatus_rejectsPendingDirectlyToCompleted() {
        TeacherSession pending = sessionOwnedBy(OWNER, STUDENT,
                TeacherSession.Status.PENDING, TeacherSession.PayoutStatus.PENDING);
        when(sessionRepository.findByIdFull(70L)).thenReturn(Optional.of(pending));

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> service.updateStatus(OWNER, 70L, "COMPLETED", null));
        verify(sessionRepository, never()).save(any());
    }
}
