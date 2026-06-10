package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.TeacherProfile;
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

import java.util.Map;
import java.util.Optional;

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

    private TeacherSessionService service;

    private static final User OWNER = User.builder().id(1L).role(User.Role.TEACHER).build();
    private static final User OTHER_TEACHER = User.builder().id(2L).role(User.Role.TEACHER).build();
    private static final User ADMIN = User.builder().id(3L).role(User.Role.ADMIN).build();

    @BeforeEach
    void setUp() {
        service = new TeacherSessionService(sessionRepository, profileRepository);
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
}
