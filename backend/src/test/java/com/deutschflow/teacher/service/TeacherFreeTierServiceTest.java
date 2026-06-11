package com.deutschflow.teacher.service;

import com.deutschflow.common.quota.FreeTierGuard;
import com.deutschflow.teacher.dto.FreeTierStatusDto;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Khoá trạng thái gói GV (D6²): GV tự do (non-org) thấy hạn mức + lượt dùng; GV org → freeTier=false. */
@ExtendWith(MockitoExtension.class)
class TeacherFreeTierServiceTest {

    @Mock UserRepository userRepository;
    @Mock FreeTierGuard freeTierGuard;

    @InjectMocks TeacherFreeTierService service;

    @Test
    @DisplayName("GV tự do (orgId null) → freeTier=true kèm hạn mức + lượt dùng hôm nay")
    void status_freeTeacher_showsUsage() {
        User user = new User(); // orgId null
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(freeTierGuard.dailyLimit(FreeTierGuard.FEATURE_PPTX)).thenReturn(2);
        when(freeTierGuard.dailyLimit(FreeTierGuard.FEATURE_OCR_GRADE)).thenReturn(5);
        when(freeTierGuard.usedToday(7L, FreeTierGuard.FEATURE_PPTX)).thenReturn(1);
        when(freeTierGuard.usedToday(7L, FreeTierGuard.FEATURE_OCR_GRADE)).thenReturn(3);

        FreeTierStatusDto dto = service.status(7L);

        assertThat(dto.freeTier()).isTrue();
        assertThat(dto.pptxDaily()).isEqualTo(2);
        assertThat(dto.pptxUsedToday()).isEqualTo(1);
        assertThat(dto.ocrDaily()).isEqualTo(5);
        assertThat(dto.ocrUsedToday()).isEqualTo(3);
    }

    @Test
    @DisplayName("GV thuộc org → freeTier=false, KHÔNG truy vấn lượt dùng (org pool quản)")
    void status_orgTeacher_notFreeTier() {
        User user = new User();
        user.setOrgId(5L);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(freeTierGuard.dailyLimit(anyString())).thenReturn(2);

        FreeTierStatusDto dto = service.status(7L);

        assertThat(dto.freeTier()).isFalse();
        assertThat(dto.pptxUsedToday()).isZero();
        assertThat(dto.ocrUsedToday()).isZero();
        verify(freeTierGuard, never()).usedToday(anyLong(), any());
    }
}
