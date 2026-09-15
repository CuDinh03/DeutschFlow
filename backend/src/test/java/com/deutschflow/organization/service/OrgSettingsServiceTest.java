package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.entity.OrgSetting;
import com.deutschflow.organization.repository.OrgSettingRepository;
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

/** R10 (V323): hai khoá ngưỡng chứng nhận — mặc định đúng hằng cũ, org ghi đè được, giá trị hỏng rơi về mặc định. */
@ExtendWith(MockitoExtension.class)
class OrgSettingsServiceTest {

    @Mock private OrgSettingRepository settingRepo;

    private OrgSettingsService service() {
        return new OrgSettingsService(settingRepo);
    }

    @Test
    @DisplayName("Mặc định: certificate_min_avg=50, certificate_min_attendance_pct=80 — lớp B2C (org NULL) không chạm DB")
    void defaults_matchFormerHardcodedThresholds_withoutDbForB2c() {
        OrgSettingsService s = service();
        assertThat(s.get(null, OrgSettingsService.CERTIFICATE_MIN_AVG)).isEqualTo("50");
        assertThat(s.getInt(null, OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT)).isEqualTo(80);
        verify(settingRepo, never()).findById(any());
    }

    @Test
    @DisplayName("Trung tâm có dòng 60 ⇒ getInt trả 60; dòng hỏng 'abc' ⇒ rơi về mặc định 50")
    void storedValue_overridesDefault_andGarbageFallsBack() {
        when(settingRepo.findById(new OrgSetting.Id(7L, OrgSettingsService.CERTIFICATE_MIN_AVG)))
                .thenReturn(Optional.of(OrgSetting.builder()
                        .id(new OrgSetting.Id(7L, OrgSettingsService.CERTIFICATE_MIN_AVG)).value("60").build()));
        when(settingRepo.findById(new OrgSetting.Id(8L, OrgSettingsService.CERTIFICATE_MIN_AVG)))
                .thenReturn(Optional.of(OrgSetting.builder()
                        .id(new OrgSetting.Id(8L, OrgSettingsService.CERTIFICATE_MIN_AVG)).value("abc").build()));

        OrgSettingsService s = service();
        assertThat(s.getInt(7L, OrgSettingsService.CERTIFICATE_MIN_AVG)).isEqualTo(60);
        assertThat(s.getInt(8L, OrgSettingsService.CERTIFICATE_MIN_AVG)).isEqualTo(50);
    }

    @Test
    @DisplayName("all(org) liệt kê cả hai khoá mới với mặc định khi chưa có dòng")
    void all_includesNewKeysWithDefaults() {
        when(settingRepo.findByIdOrgId(7L)).thenReturn(List.of());
        assertThat(service().all(7L))
                .containsEntry(OrgSettingsService.CERTIFICATE_MIN_AVG, "50")
                .containsEntry(OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT, "80")
                .containsEntry(OrgSettingsService.TIMESHEET_BREAK_INCLUDED, "true");
    }

    @Test
    @DisplayName("Khoá lạ vẫn bị từ chối — org_settings không thành bãi rác key-value")
    void unknownKey_isRejected() {
        assertThatThrownBy(() -> service().put(7L, "certificate_min_xyz", "1", 1L))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service().get(7L, "certificate_min_xyz"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
