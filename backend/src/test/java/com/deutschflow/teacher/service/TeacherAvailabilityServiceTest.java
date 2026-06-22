package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.teacher.dto.AvailabilitySlot;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Khoá hành vi Lịch dạy (PROMPT 4): parse/serialize JSON, validate slot, get-or-create profile. */
@ExtendWith(MockitoExtension.class)
class TeacherAvailabilityServiceTest {

    @Mock TeacherProfileRepository teacherProfileRepository;
    @Mock UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private TeacherAvailabilityService service() {
        return new TeacherAvailabilityService(teacherProfileRepository, userRepository, objectMapper);
    }

    @Test
    @DisplayName("getSlots: chưa có profile → danh sách rỗng")
    void getSlots_noProfile_returnsEmpty() {
        when(teacherProfileRepository.findByUserId(5L)).thenReturn(Optional.empty());
        assertThat(service().getSlots(5L)).isEmpty();
    }

    @Test
    @DisplayName("getSlots: parse JSON đã lưu thành slot")
    void getSlots_parsesStoredJson() {
        TeacherProfile profile = new TeacherProfile();
        profile.setAvailableSlotsJson("[{\"day\":0,\"start\":\"18:00\",\"end\":\"20:00\"}]");
        when(teacherProfileRepository.findByUserId(5L)).thenReturn(Optional.of(profile));

        List<AvailabilitySlot> slots = service().getSlots(5L);

        assertThat(slots).hasSize(1);
        assertThat(slots.get(0).day()).isZero();
        assertThat(slots.get(0).start()).isEqualTo("18:00");
        assertThat(slots.get(0).end()).isEqualTo("20:00");
    }

    @Test
    @DisplayName("getSlots: JSON hỏng → rỗng (không ném)")
    void getSlots_corruptJson_returnsEmpty() {
        TeacherProfile profile = new TeacherProfile();
        profile.setAvailableSlotsJson("{not-json");
        when(teacherProfileRepository.findByUserId(5L)).thenReturn(Optional.of(profile));

        assertThat(service().getSlots(5L)).isEmpty();
    }

    @Test
    @DisplayName("setSlots: ghi JSON + trả slot")
    void setSlots_persistsJson() {
        TeacherProfile profile = new TeacherProfile();
        when(teacherProfileRepository.findByUserId(5L)).thenReturn(Optional.of(profile));

        List<AvailabilitySlot> result = service().setSlots(5L, List.of(new AvailabilitySlot(1, "09:00", "11:00")));

        assertThat(result).hasSize(1);
        assertThat(profile.getAvailableSlotsJson()).contains("\"day\":1").contains("09:00").contains("11:00");
        verify(teacherProfileRepository).save(profile);
    }

    @Test
    @DisplayName("setSlots: chưa có profile → tạo mới rồi lưu")
    void setSlots_createsProfileWhenMissing() {
        when(teacherProfileRepository.findByUserId(5L)).thenReturn(Optional.empty());
        when(userRepository.findById(5L)).thenReturn(Optional.of(new User()));

        service().setSlots(5L, List.of(new AvailabilitySlot(2, "14:00", "16:00")));

        verify(teacherProfileRepository).save(any(TeacherProfile.class));
    }

    @Test
    @DisplayName("setSlots: ngày ngoài 0–6 → 400, KHÔNG lưu")
    void setSlots_invalidDay_throws() {
        assertThatThrownBy(() -> service().setSlots(5L, List.of(new AvailabilitySlot(7, "09:00", "10:00"))))
                .isInstanceOf(BadRequestException.class);
        verify(teacherProfileRepository, never()).save(any());
    }

    @Test
    @DisplayName("setSlots: giờ sai định dạng → 400")
    void setSlots_badTimeFormat_throws() {
        assertThatThrownBy(() -> service().setSlots(5L, List.of(new AvailabilitySlot(0, "9am", "10:00"))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("setSlots: start ≥ end → 400")
    void setSlots_startNotBeforeEnd_throws() {
        assertThatThrownBy(() -> service().setSlots(5L, List.of(new AvailabilitySlot(0, "20:00", "18:00"))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("setSlots: danh sách rỗng → lưu []")
    void setSlots_empty_savesEmptyArray() {
        TeacherProfile profile = new TeacherProfile();
        when(teacherProfileRepository.findByUserId(5L)).thenReturn(Optional.of(profile));

        assertThat(service().setSlots(5L, List.of())).isEmpty();
        assertThat(profile.getAvailableSlotsJson()).isEqualTo("[]");
    }
}
