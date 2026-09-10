package com.deutschflow.common.minor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.annotation.Annotation;
import java.lang.reflect.Constructor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * DEC-22 — cổng chặn giọng nói của học viên chưa xác định tuổi đi ra nhà cung cấp AI.
 *
 * <p>Ca ở đây chốt bốn thứ mà một PR sau rất dễ làm hỏng mà không ai thấy:
 * <ol>
 *   <li>người đủ tuổi KHÔNG bị hỏi thêm truy vấn nào (gate nằm trên đường nóng của mọi lượt nói);</li>
 *   <li>hai mức tuổi vị thành niên đều đòi đồng ý, và {@code REVOKED} ra thông điệp KHÁC
 *       {@code NEVER_RECORDED} — rút đồng ý rồi thì tuyệt đối không mời đồng ý lại;</li>
 *   <li>nhánh {@code UNKNOWN} đi theo cấu hình, và {@code BLOCK_ORG_MEMBERS} chỉ chặn thành viên
 *       trung tâm chứ không chạm người dùng B2C;</li>
 *   <li>🔴 MẶC ĐỊNH của {@code app.minor.unknown-age-audio} KHÔNG được là {@code BLOCK_ALL} —
 *       xem {@link Cauhinh#macDinhKhongDuocLaBlockAll()}.</li>
 * </ol>
 *
 * <p>Không có Spring context: gate chỉ là luật + hai cộng tác viên, dựng thẳng bằng constructor.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MinorGate — cổng đường ghi âm (DEC-22)")
class MinorGateTest {

    private static final Long SUBJECT = 42L;

    @Mock private MinorLearnerService learnerService;
    @Mock private JdbcTemplate jdbcTemplate;

    private MinorGate gate(MinorGate.UnknownAgeAudioPolicy policy) {
        return new MinorGate(learnerService, jdbcTemplate, policy.name(), policy.name());
    }

    private void ageIs(MinorPolicy.Status status) {
        when(learnerService.statusOf(SUBJECT)).thenReturn(status);
    }

    private void consentIs(ConsentState state) {
        when(learnerService.consentStatus(SUBJECT, StudentConsent.Scope.AUDIO_RECORDING))
                .thenReturn(state);
    }

    private void orgMember(boolean member) {
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
                .thenReturn(member);
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Đủ tuổi")
    class DuTuoi {

        @Test
        @DisplayName("ADULT đi qua và KHÔNG tốn thêm truy vấn đồng ý hay membership")
        void adultDiQuaKhongTruyVanThem() {
            ageIs(MinorPolicy.Status.ADULT);

            gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL).assertAudioAllowed(SUBJECT);

            verify(learnerService, never()).consentStatus(anyLong(), any());
            verifyNoInteractions(jdbcTemplate);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Chưa thành niên — phải có đồng ý cho phạm vi AUDIO_RECORDING")
    class ChuaThanhNien {

        @Test
        @DisplayName("dưới 16 + đã đồng ý → cho qua")
        void duoi16DaDongY() {
            ageIs(MinorPolicy.Status.MINOR_LEGAL);
            consentIs(ConsentState.GRANTED);

            gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS).assertAudioAllowed(SUBJECT);
        }

        @Test
        @DisplayName("16–17 + đã đồng ý → cho qua")
        void tuoi16_17DaDongY() {
            ageIs(MinorPolicy.Status.MINOR_CENTER_POLICY);
            consentIs(ConsentState.GRANTED);

            gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS).assertAudioAllowed(SUBJECT);
        }

        @Test
        @DisplayName("dưới 16 + chưa từng hỏi → chặn GUARDIAN_CONSENT_REQUIRED, nêu việc cần làm")
        void duoi16ChuaTungHoi() {
            ageIs(MinorPolicy.Status.MINOR_LEGAL);
            consentIs(ConsentState.NEVER_RECORDED);

            assertThatThrownBy(() ->
                    gate(MinorGate.UnknownAgeAudioPolicy.ALLOW).assertAudioAllowed(SUBJECT))
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories
                            .type(MinorAudioBlockedException.class))
                    .satisfies(ex -> {
                        assertThat(ex.getReason())
                                .isEqualTo(MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED);
                        assertThat(ex.getStatus()).isEqualTo(MinorPolicy.Status.MINOR_LEGAL);
                        // Thông điệp phải nói LÀM GÌ, không chỉ nói "không được".
                        assertThat(ex.getMessage()).contains("liên hệ trung tâm");
                    });
        }

        @Test
        @DisplayName("16–17 + chưa từng hỏi → chặn, thông điệp nói rõ là quy định NỘI BỘ của trung tâm")
        void tuoi16_17ChuaTungHoi() {
            ageIs(MinorPolicy.Status.MINOR_CENTER_POLICY);
            consentIs(ConsentState.NEVER_RECORDED);

            assertThatThrownBy(() ->
                    gate(MinorGate.UnknownAgeAudioPolicy.ALLOW).assertAudioAllowed(SUBJECT))
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .hasMessageContaining("nội bộ");
        }

        @Test
        @DisplayName("đã THU HỒI → mã riêng REVOKED và KHÔNG mời đồng ý lại")
        void daThuHoi() {
            ageIs(MinorPolicy.Status.MINOR_LEGAL);
            consentIs(ConsentState.REVOKED);

            assertThatThrownBy(() ->
                    gate(MinorGate.UnknownAgeAudioPolicy.ALLOW).assertAudioAllowed(SUBJECT))
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories
                            .type(MinorAudioBlockedException.class))
                    .satisfies(ex -> {
                        assertThat(ex.getReason())
                                .isEqualTo(MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REVOKED);
                        // Người giám hộ phải CHỦ ĐỘNG cấp lại; hệ thống không được tự hỏi lại,
                        // nếu không quyền rút đồng ý chỉ còn là một nút phiền toái.
                        assertThat(ex.getMessage()).contains("thu hồi");
                        assertThat(ex.getMessage()).doesNotContain("hoàn tất phiếu đồng ý");
                    });
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Chưa khai ngày sinh — theo cấu hình app.minor.unknown-age-audio")
    class ChuaKhaiNgaySinh {

        @Test
        @DisplayName("ALLOW → cho qua, KHÔNG hỏi membership")
        void allow() {
            ageIs(MinorPolicy.Status.UNKNOWN);

            gate(MinorGate.UnknownAgeAudioPolicy.ALLOW).assertAudioAllowed(SUBJECT);

            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("BLOCK_ALL → chặn ngay, KHÔNG cần hỏi membership")
        void blockAll() {
            ageIs(MinorPolicy.Status.UNKNOWN);

            assertThatThrownBy(() ->
                    gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL).assertAudioAllowed(SUBJECT))
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories
                            .type(MinorAudioBlockedException.class))
                    .satisfies(ex -> assertThat(ex.getReason())
                            .isEqualTo(MinorAudioBlockedException.Reason.BIRTH_DATE_REQUIRED));

            verifyNoInteractions(jdbcTemplate);
        }

        @Test
        @DisplayName("BLOCK_ORG_MEMBERS + là thành viên ACTIVE của trung tâm → chặn")
        void blockOrgMembers_thanhVien() {
            ageIs(MinorPolicy.Status.UNKNOWN);
            orgMember(true);

            assertThatThrownBy(() ->
                    gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS).assertAudioAllowed(SUBJECT))
                    .isInstanceOf(MinorAudioBlockedException.class)
                    .hasMessageContaining("ngày sinh");
        }

        @Test
        @DisplayName("BLOCK_ORG_MEMBERS + người dùng B2C → CHO QUA (không có ai đi thu đồng ý hộ)")
        void blockOrgMembers_b2c() {
            ageIs(MinorPolicy.Status.UNKNOWN);
            orgMember(false);

            gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS).assertAudioAllowed(SUBJECT);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Cấu hình")
    class Cauhinh {

        /**
         * 🔴 Ca CHẶN DEPLOY, không phải ca kiểm chính tả. Tại thời điểm phát hành chưa một tài khoản
         * production nào có {@code birth_date} (cột vừa ra đời ở V319), nên đổi mặc định sang
         * {@code BLOCK_ALL} sẽ cắt tính năng nói của TOÀN BỘ người dùng — người lớn trả tiền, giáo
         * viên, học viên B2C — ngay giây deploy. Ca này đọc thẳng giá trị mặc định trong
         * {@code @Value} của constructor, nên một lần "siết cho chắc" sẽ đỏ ở đây trước khi ra prod.
         */
        @Test
        @DisplayName("mặc định là BLOCK_ORG_MEMBERS — KHÔNG được là BLOCK_ALL")
        void macDinhKhongDuocLaBlockAll() {
            assertThat(unknownAgeAudioDefault())
                    .as("mặc định của app.minor.unknown-age-audio")
                    .isEqualTo(MinorGate.UnknownAgeAudioPolicy.BLOCK_ORG_MEMBERS.name())
                    .isNotEqualTo(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL.name());
        }

        @Test
        @DisplayName("giá trị lạ → đổ vỡ NGAY lúc dựng bean, không lặng lẽ rơi về mặc định")
        @MockitoSettings(strictness = Strictness.LENIENT)
        void giaTriLa() {
            assertThatThrownBy(() -> new MinorGate(learnerService, jdbcTemplate, "BLOCK_ORGS", "BLOCK_ORG_MEMBERS"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("BLOCK_ORG_MEMBERS");
        }

        @Test
        @DisplayName("giá trị chấp nhận được vẫn nhận dạng khi viết thường / có khoảng trắng")
        void chuanHoaGiaTri() {
            assertThat(new MinorGate(learnerService, jdbcTemplate, " block_all ", "BLOCK_ORG_MEMBERS")
                    .unknownAgeAudioPolicy())
                    .isEqualTo(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("subjectUserId null → nổ to, KHÔNG im lặng cho qua (đó là fail-open)")
    void nullSubject() {
        assertThatThrownBy(() ->
                gate(MinorGate.UnknownAgeAudioPolicy.BLOCK_ALL).assertAudioAllowed(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fail-open");

        verifyNoInteractions(learnerService);
        verifyNoInteractions(jdbcTemplate);
    }

    /** Giá trị mặc định khai trong {@code @Value} của constructor {@link MinorGate}. */
    private static String unknownAgeAudioDefault() {
        Constructor<?> ctor = MinorGate.class.getDeclaredConstructors()[0];
        for (Annotation[] onParam : ctor.getParameterAnnotations()) {
            for (Annotation a : onParam) {
                if (a instanceof Value v) {
                    String expr = v.value();               // ${app.minor.unknown-age-audio:XXX}
                    int colon = expr.indexOf(':');
                    return expr.substring(colon + 1, expr.length() - 1);
                }
            }
        }
        throw new AssertionError("Constructor MinorGate không còn @Value nào — mặc định đi đâu?");
    }
}
