package com.deutschflow.common.minor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * D3 — cổng chặn BÀI LÀM của học viên chưa đủ điều kiện về tuổi đi ra nhà cung cấp AI để chấm.
 *
 * <p>Ca ở đây chốt bốn thứ một PR sau rất dễ làm hỏng:
 * <ol>
 *   <li>cổng soi phạm vi {@code AI_PROCESSING}, KHÔNG phải {@code AUDIO_RECORDING} — đồng ý cho ghi
 *       âm không phải là đồng ý cho bài làm đi qua AI, và trộn hai phạm vi là cách hỏng im lặng
 *       nhất (mọi ca "đường sáng" vẫn xanh vì học viên thường có cả hai);</li>
 *   <li>hai cờ cấu hình ĐỘC LẬP — nới đường chấm bài không được nới luôn đường ghi âm;</li>
 *   <li>{@code REVOKED} ra lý do khác {@code REQUIRED}, và thông điệp thu hồi KHÔNG mời đồng ý lại;</li>
 *   <li>gọi với {@code null} phải NỔ chứ không lặng lẽ cho qua (fail-open là kiểu lỗi mà ca đếm
 *       điểm cắm không bắt được).</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MinorGate — cổng đường chấm bài AI (D3)")
class MinorGateAiGradingTest {

    private static final Long STUDENT = 42L;

    @Mock private MinorLearnerService learnerService;
    @Mock private JdbcTemplate jdbcTemplate;

    private MinorGate gate(MinorGate.UnknownAgeAudioPolicy aiGradingPolicy) {
        // Cờ ghi âm để BLOCK_ALL, cờ chấm bài theo tham số: nếu mã lỡ đọc nhầm cờ thì ca
        // "ALLOW cho qua" sẽ đỏ ngay, thay vì cả hai cờ giống nhau và không phân biệt được.
        return new MinorGate(learnerService, jdbcTemplate, "BLOCK_ALL", aiGradingPolicy.name());
    }

    private void ageIs(MinorPolicy.Status status) {
        when(learnerService.statusOf(STUDENT)).thenReturn(status);
    }

    private void consentIs(ConsentState state) {
        when(learnerService.consentStatus(STUDENT, StudentConsent.Scope.AI_PROCESSING)).thenReturn(state);
    }

    @Nested
    @DisplayName("Đủ tuổi")
    class DuTuoi {
        @Test
        @DisplayName("cho qua và KHÔNG hỏi đồng ý — cổng nằm trên đường nóng của mọi lượt chấm")
        void adultPassesWithoutConsentLookup() {
            ageIs(MinorPolicy.Status.ADULT);
            assertThatCode(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL)
                    .assertAiGradingAllowed(STUDENT)).doesNotThrowAnyException();
            verifyNoInteractions(jdbcTemplate);
        }
    }

    @Nested
    @DisplayName("Vị thành niên")
    @MockitoSettings(strictness = Strictness.LENIENT)
    class ViThanhNien {
        @Test
        @DisplayName("dưới 16 có đồng ý AI_PROCESSING ⇒ cho qua")
        void minorLegalWithConsentPasses() {
            ageIs(MinorPolicy.Status.MINOR_LEGAL);
            consentIs(ConsentState.GRANTED);
            assertThatCode(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL)
                    .assertAiGradingAllowed(STUDENT)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("16–17 chưa có đồng ý ⇒ 403 GUARDIAN_CONSENT_REQUIRED, thông điệp mời chấm tay")
        void centerPolicyWithoutConsentBlocked() {
            ageIs(MinorPolicy.Status.MINOR_CENTER_POLICY);
            consentIs(ConsentState.NEVER_RECORDED);
            assertThatThrownBy(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL)
                    .assertAiGradingAllowed(STUDENT))
                    .isInstanceOf(MinorAiGradingBlockedException.class)
                    .satisfies(e -> assertThat(((MinorAiGradingBlockedException) e).getReason())
                            .isEqualTo(MinorAiGradingBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED))
                    .hasMessageContaining("chấm tay");
        }

        @Test
        @DisplayName("đã thu hồi ⇒ lý do REVOKED và thông điệp KHÔNG mời đồng ý lại")
        void revokedDoesNotInviteReconsent() {
            ageIs(MinorPolicy.Status.MINOR_LEGAL);
            consentIs(ConsentState.REVOKED);
            assertThatThrownBy(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL)
                    .assertAiGradingAllowed(STUDENT))
                    .isInstanceOf(MinorAiGradingBlockedException.class)
                    .satisfies(e -> assertThat(((MinorAiGradingBlockedException) e).getReason())
                            .isEqualTo(MinorAiGradingBlockedException.Reason.GUARDIAN_CONSENT_REVOKED))
                    // Rút đồng ý rồi mà hệ thống tự hỏi lại là biến quyền rút thành nút phiền toái.
                    .satisfies(e -> assertThat(e.getMessage()).doesNotContain("cấp lại"));
        }

        @Test
        @DisplayName("🔴 soi ĐÚNG phạm vi AI_PROCESSING — có đồng ý ghi âm KHÔNG mở được cổng chấm bài")
        void audioConsentDoesNotUnlockAiGrading() {
            ageIs(MinorPolicy.Status.MINOR_CENTER_POLICY);
            when(learnerService.consentStatus(STUDENT, StudentConsent.Scope.AUDIO_RECORDING))
                    .thenReturn(ConsentState.GRANTED);
            when(learnerService.consentStatus(STUDENT, StudentConsent.Scope.AI_PROCESSING))
                    .thenReturn(ConsentState.NEVER_RECORDED);
            assertThatThrownBy(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL)
                    .assertAiGradingAllowed(STUDENT))
                    .isInstanceOf(MinorAiGradingBlockedException.class);
        }
    }

    @Nested
    @DisplayName("Chưa khai ngày sinh")
    class ChuaKhaiNgaySinh {
        @Test
        @DisplayName("ALLOW ⇒ cho qua, và KHÔNG hỏi bảng org_members")
        void allowPasses() {
            ageIs(MinorPolicy.Status.UNKNOWN);
            assertThatCode(() -> gate(MinorGate.UnknownAgeAudioPolicy.ALLOW)
                    .assertAiGradingAllowed(STUDENT)).doesNotThrowAnyException();
            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("BLOCK_ORG_MEMBERS chặn thành viên trung tâm ⇒ BIRTH_DATE_REQUIRED")
        void blocksOrgMember() {
            ageIs(MinorPolicy.Status.UNKNOWN);
            when(jdbcTemplate.queryForObject(any(String.class), eq(Boolean.class), anyLong()))
                    .thenReturn(Boolean.TRUE);
            assertThatThrownBy(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS)
                    .assertAiGradingAllowed(STUDENT))
                    .isInstanceOf(MinorAiGradingBlockedException.class)
                    .satisfies(e -> assertThat(((MinorAiGradingBlockedException) e).getReason())
                            .isEqualTo(MinorAiGradingBlockedException.Reason.BIRTH_DATE_REQUIRED));
        }

        @Test
        @DisplayName("BLOCK_ORG_MEMBERS KHÔNG chạm người dùng B2C")
        void leavesB2cAlone() {
            ageIs(MinorPolicy.Status.UNKNOWN);
            when(jdbcTemplate.queryForObject(any(String.class), eq(Boolean.class), anyLong()))
                    .thenReturn(Boolean.FALSE);
            assertThatCode(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS)
                    .assertAiGradingAllowed(STUDENT)).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("Cấu hình và chủ thể")
    class CauHinhVaChuThe {
        @Test
        @DisplayName("🔴 hai cờ ĐỘC LẬP — nới đường chấm bài không nới đường ghi âm")
        void flagsAreIndependent() {
            MinorGate g = new MinorGate(learnerService, jdbcTemplate, "BLOCK_ALL", "ALLOW");
            assertThat(g.unknownAgeAudioPolicy()).isEqualTo(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL);
            assertThat(g.unknownAgeAiGradingPolicy()).isEqualTo(MinorGate.UnknownAgeAudioPolicy.ALLOW);
        }

        @Test
        @DisplayName("cờ chấm bài gõ sai ⇒ NỔ lúc khởi động, nêu đúng tên khoá của nó")
        void badAiFlagFailsFastWithItsOwnKey() {
            assertThatThrownBy(() ->
                    new MinorGate(learnerService, jdbcTemplate, "BLOCK_ORG_MEMBERS", "BLOCK_ORGS"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("app.minor.unknown-age-ai-grading");
        }

        @Test
        @DisplayName("🔴 gọi với null NỔ chứ không lặng lẽ cho qua (fail-open)")
        void nullSubjectIsNotFailOpen() {
            assertThatThrownBy(() -> gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL)
                    .assertAiGradingAllowed(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("fail-open");
        }
    }
}
