package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Khoá hành vi tự khai "trung tâm" của GV (D11): trim/clear + lưu, not-found → 404. */
@ExtendWith(MockitoExtension.class)
class TeacherCenterServiceTest {

    @Mock UserRepository userRepository;
    @InjectMocks TeacherCenterService service;

    @Test
    @DisplayName("setCenter: trim khoảng trắng rồi lưu, trả giá trị chuẩn hoá")
    void setCenter_trimsAndSaves() {
        User user = new User();
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        String result = service.setCenter(5L, "  Trung tâm tiếng Đức ABC  ");

        assertThat(result).isEqualTo("Trung tâm tiếng Đức ABC");
        assertThat(user.getCenterName()).isEqualTo("Trung tâm tiếng Đức ABC");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("setCenter: chuỗi rỗng/khoảng trắng → xoá về null")
    void setCenter_blankClearsToNull() {
        User user = new User();
        user.setCenterName("Cũ");
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        assertThat(service.setCenter(5L, "   ")).isNull();
        assertThat(user.getCenterName()).isNull();
    }

    @Test
    @DisplayName("setCenter: không tìm thấy user → NotFound, KHÔNG lưu")
    void setCenter_userNotFound_throws() {
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setCenter(9L, "ABC")).isInstanceOf(NotFoundException.class);
        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("getCenter: trả về center hiện tại")
    void getCenter_returnsValue() {
        User user = new User();
        user.setCenterName("Goethe Hub Hà Nội");
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        assertThat(service.getCenter(5L)).isEqualTo("Goethe Hub Hà Nội");
    }
}
