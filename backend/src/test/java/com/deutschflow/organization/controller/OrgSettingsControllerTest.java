package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** R10 (V323): hai khoá ngưỡng chứng nhận nhận số nguyên 0–100 — 0 và 100 hợp lệ, 101/-1/chữ bị từ chối TRƯỚC khi ghi. */
@ExtendWith(MockitoExtension.class)
class OrgSettingsControllerTest {

    @Mock private OrgSettingsService settingsService;
    @Mock private OrgGuard orgGuard;

    private OrgSettingsController controller() {
        return new OrgSettingsController(settingsService, orgGuard);
    }

    private static User owner() {
        User u = new User();
        u.setId(9L);
        u.setOrgId(7L);
        return u;
    }

    @Test
    @DisplayName("certificate_min_avg=60 và certificate_min_attendance_pct=0/100 ⇒ ghi qua service (trim)")
    void certificateThresholds_inRange_areStored() {
        assertThatCode(() -> controller().put(owner(), new OrgSettingsController.PutBody(Map.of(
                OrgSettingsService.CERTIFICATE_MIN_AVG, " 60 ",
                OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT, "100"))))
                .doesNotThrowAnyException();
        verify(settingsService).put(7L, OrgSettingsService.CERTIFICATE_MIN_AVG, "60", 9L);
        verify(settingsService).put(7L, OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT, "100", 9L);

        assertThatCode(() -> controller().put(owner(), new OrgSettingsController.PutBody(Map.of(
                OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT, "0"))))
                .as("0 = trung tâm tắt điều kiện chuyên cần — hợp lệ").doesNotThrowAnyException();
    }

    @Test
    @DisplayName("101, -1, 'nhieu' ⇒ 400 và KHÔNG ghi dòng nào (kể cả khoá hợp lệ đi cùng)")
    void certificateThresholds_outOfRange_areRejectedBeforeAnyWrite() {
        for (String bad : new String[]{"101", "-1", "nhieu", "5.5"}) {
            assertThatThrownBy(() -> controller().put(owner(), new OrgSettingsController.PutBody(Map.of(
                    OrgSettingsService.TIMESHEET_BREAK_INCLUDED, "true",
                    OrgSettingsService.CERTIFICATE_MIN_AVG, bad))))
                    .as("giá trị " + bad)
                    .isInstanceOf(BadRequestException.class);
        }
        verify(settingsService, never()).put(any(), anyString(), anyString(), any());
    }
}
