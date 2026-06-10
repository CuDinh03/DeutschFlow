package com.deutschflow.teacher.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Org teachers are excluded from the C2C marketplace (B2B decision 2026-06-10): they don't
 * appear in the public directory, their profile isn't directly accessible, and they can't
 * publish/update a marketplace profile.
 */
@ExtendWith(MockitoExtension.class)
class TeacherMarketplaceControllerTest {

    @Mock
    TeacherProfileRepository teacherProfileRepository;

    @InjectMocks
    TeacherMarketplaceController controller;

    @Test
    @DisplayName("public directory query excludes org teachers (uses findPublicWithUser)")
    void getPublicTeachers_usesPublicQuery() {
        when(teacherProfileRepository.findPublicWithUser(any())).thenReturn(Page.empty());

        controller.getPublicTeachers(0, 20);

        verify(teacherProfileRepository).findPublicWithUser(any());
        verify(teacherProfileRepository, never()).findAllWithUser(any());
    }

    @Test
    @DisplayName("an org teacher's profile is hidden from direct access (404)")
    void getTeacherProfile_orgTeacher_notFound() {
        User orgTeacher = User.builder().id(1L).displayName("GV").email("gv@x.com").orgId(7L).build();
        TeacherProfile profile = TeacherProfile.builder().user(orgTeacher).build();
        when(teacherProfileRepository.findByIdWithUser(9L)).thenReturn(Optional.of(profile));

        assertThatThrownBy(() -> controller.getTeacherProfile(9L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("a public (non-org) teacher's profile is accessible")
    void getTeacherProfile_publicTeacher_ok() {
        User publicTeacher = User.builder().id(2L).displayName("Tutor").email("t@x.com").orgId(null).build();
        TeacherProfile profile = TeacherProfile.builder().id(5L).user(publicTeacher).headline("Hi").build();
        when(teacherProfileRepository.findByIdWithUser(5L)).thenReturn(Optional.of(profile));

        var response = controller.getTeacherProfile(5L);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getUserId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("an org teacher cannot publish a marketplace profile (403)")
    void updateMyProfile_orgTeacher_forbidden() {
        User orgTeacher = User.builder().id(3L).displayName("GV").email("gv2@x.com").orgId(7L).build();
        var request = new TeacherMarketplaceController.UpdateProfileRequest("headline", null, null, null, null);

        assertThatThrownBy(() -> controller.updateMyProfile(orgTeacher, request))
                .isInstanceOf(ForbiddenException.class);

        verify(teacherProfileRepository, never()).save(any());
    }
}
