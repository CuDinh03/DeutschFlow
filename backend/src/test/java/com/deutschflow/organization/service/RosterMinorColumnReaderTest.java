package com.deutschflow.organization.service;

import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.StudentGuardian;
import com.deutschflow.organization.service.RosterMinorColumnReader.Result;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đọc từng dòng roster: ô {@code reportSharingConfirmed} (R6) dùng cùng bộ có/không với
 * {@code consentConfirmed} nhưng ĐỘC LẬP với nó; ô gõ lạ bị từ chối với câu mang TÊN CỘT; và
 * {@code guardianEmail} trùng email học viên (không phân biệt hoa thường) bị từ chối ngay tại dòng.
 */
@DisplayName("RosterMinorColumnReader — ô reportSharingConfirmed (R6), ô aiProcessingConfirmed (C3) và chốt guardianEmail ≠ email học viên")
class RosterMinorColumnReaderTest {

    private final RosterMinorColumnReader reader = new RosterMinorColumnReader(new MinorPolicy(16, 18));

    private static RosterColumnLayout layout(String... header) {
        return RosterColumnLayout.fromHeader(header);
    }

    private static String aged(int years) {
        return LocalDate.now(MinorPolicy.ZONE).minusYears(years).minusDays(1).toString();
    }

    @Test
    @DisplayName("hai ô có/không đọc ĐỘC LẬP: C2 đánh mà C1 trống chỉ cho reportSharingConfirmed=true, và ngược lại")
    void readsYesNoIndependently() {
        RosterColumnLayout l = layout("email", "consentConfirmed", "reportSharingConfirmed");

        Result onlySharing = reader.read(new String[]{"an@x.com", "", "x"}, l, 2, "an@x.com");
        assertThat(onlySharing.rejected()).isFalse();
        assertThat(onlySharing.consentConfirmed()).isFalse();
        assertThat(onlySharing.reportSharingConfirmed()).isTrue();

        Result onlyAudio = reader.read(new String[]{"an@x.com", "x", "không"}, l, 3, "an@x.com");
        assertThat(onlyAudio.rejected()).isFalse();
        assertThat(onlyAudio.consentConfirmed()).isTrue();
        assertThat(onlyAudio.reportSharingConfirmed()).isFalse();
    }

    @Test
    @DisplayName("bộ giá trị CÓ/KHÔNG của reportSharingConfirmed y hệt consentConfirmed (x/có/1/true/đã thu; trống/0/no/chưa)")
    void sameYesNoVocabulary() {
        RosterColumnLayout l = layout("email", "reportSharingConfirmed");
        for (String yes : List.of("x", "Có", "1", "true", "Đã thu", "đồng ý", "Y", "confirmed")) {
            Result r = reader.read(new String[]{"an@x.com", yes}, l, 2, "an@x.com");
            assertThat(r.rejected()).as("ô \"%s\"", yes).isFalse();
            assertThat(r.reportSharingConfirmed()).as("ô \"%s\"", yes).isTrue();
        }
        for (String no : List.of("", "0", "no", "Chưa", "không", "false")) {
            Result r = reader.read(new String[]{"an@x.com", no}, l, 2, "an@x.com");
            assertThat(r.rejected()).as("ô \"%s\"", no).isFalse();
            assertThat(r.reportSharingConfirmed()).as("ô \"%s\"", no).isFalse();
        }
    }

    @Test
    @DisplayName("ô gõ lạ ⇒ từ chối, câu mang số dòng + email + TÊN CỘT reportSharingConfirmed + giá trị gõ, KHÔNG đoán")
    void unknownValueRejectedNamingColumn() {
        RosterColumnLayout l = layout("email", "consentConfirmed", "reportSharingConfirmed");

        Result r = reader.read(new String[]{"an@x.com", "x", "đang xin"}, l, 5, "an@x.com");

        assertThat(r.rejected()).isTrue();
        assertThat(r.error()).startsWith("Dòng 5 (an@x.com): ")
                .contains("reportSharingConfirmed").contains("đang xin")
                .doesNotContain("consentConfirmed \"");
    }

    @Test
    @DisplayName("tệp chỉ có email,reportSharingConfirmed ⇒ vẫn đọc (không phải NOTHING); ngày sinh và giám hộ để trống là hợp lệ")
    void reportSharingAloneIsRead() {
        RosterColumnLayout l = layout("email", "reportSharingConfirmed");

        Result r = reader.read(new String[]{"an@x.com", "x"}, l, 2, "an@x.com");

        assertThat(r).isNotSameAs(RosterMinorColumnReader.NOTHING);
        assertThat(r.rejected()).isFalse();
        assertThat(r.reportSharingConfirmed()).isTrue();
        assertThat(r.birthDate()).isNull();
        assertThat(r.guardian()).isNull();
    }

    @Test
    @DisplayName("tệp không khai cột chưa thành niên ⇒ NOTHING, kể cả khi dòng có ô thứ tư")
    void legacyLayoutReadsNothing() {
        Result r = reader.read(new String[]{"an@x.com", "An", "0912", "x"}, RosterColumnLayout.legacy(), 2, "an@x.com");

        assertThat(r).isSameAs(RosterMinorColumnReader.NOTHING);
        assertThat(r.reportSharingConfirmed()).isFalse();
    }

    @Test
    @DisplayName("guardianEmail trùng email học viên (khác hoa thường) ⇒ từ chối, câu nêu dòng + email + guardianEmail + lý do")
    void guardianEmailEqualToStudentEmailRejected() {
        RosterColumnLayout l = layout("email", "birthDate", "guardianName", "guardianPhone", "guardianEmail");

        Result r = reader.read(new String[]{"An@X.com", aged(15), "Mẹ", "0901", "AN@x.COM"}, l, 4, "an@x.com");

        assertThat(r.rejected()).isTrue();
        assertThat(r.error()).startsWith("Dòng 4 (an@x.com): ")
                .contains("guardianEmail \"an@x.com\"").contains("trùng email của học viên");
    }

    @Test
    @DisplayName("guardianEmail là địa chỉ khác ⇒ vào GuardianDraft, hạ chữ thường; chốt trùng không cản người giám hộ thật")
    void differentGuardianEmailAccepted() {
        RosterColumnLayout l = layout("email", "birthDate", "guardianName", "guardianEmail", "reportSharingConfirmed");

        Result r = reader.read(new String[]{"an@x.com", aged(15), "Mẹ An", "Me.An@Example.COM", "x"}, l, 2, "an@x.com");

        assertThat(r.rejected()).as(r.error()).isFalse();
        assertThat(r.guardian()).isNotNull();
        assertThat(r.guardian().email()).isEqualTo("me.an@example.com");
        assertThat(r.guardian().phone()).isNull();
        assertThat(r.guardian().relationship()).isEqualTo(StudentGuardian.Relationship.OTHER);
        assertThat(r.reportSharingConfirmed()).isTrue();
    }

    @Test
    @DisplayName("ô đồng ý gõ lạ được báo TRƯỚC lỗi giám hộ — thông báo đồng ý không bị lỗi khác che")
    void consentErrorsReportedBeforeGuardianErrors() {
        RosterColumnLayout l = layout("email", "guardianRelationship", "reportSharingConfirmed");

        Result r = reader.read(new String[]{"an@x.com", "mẹ", "maybe"}, l, 2, "an@x.com");

        assertThat(r.rejected()).isTrue();
        assertThat(r.error()).contains("reportSharingConfirmed").doesNotContain("guardianRelationship");
    }

    @Test
    @DisplayName("C3: ba ô đồng ý đọc ĐỘC LẬP — chỉ đánh aiProcessingConfirmed thì hai ô kia vẫn false")
    void aiProcessingReadIndependently() {
        RosterColumnLayout l = layout("email", "consentConfirmed", "reportSharingConfirmed", "aiProcessingConfirmed");

        Result onlyAi = reader.read(new String[]{"an@x.com", "", "", "x"}, l, 2, "an@x.com");
        assertThat(onlyAi.rejected()).isFalse();
        assertThat(onlyAi.aiProcessingConfirmed()).isTrue();
        assertThat(onlyAi.consentConfirmed()).isFalse();
        assertThat(onlyAi.reportSharingConfirmed()).isFalse();

        // Và ngược lại: phiếu đánh C1+C2 mà bỏ C3 KHÔNG suy ra đồng ý chấm bài AI — đó là chỗ mà
        // đoán bừa sẽ gửi bài của một đứa trẻ ra nhà cung cấp AI mà không ai ký.
        Result noAi = reader.read(new String[]{"an@x.com", "x", "x", ""}, l, 3, "an@x.com");
        assertThat(noAi.aiProcessingConfirmed()).isFalse();
        assertThat(noAi.consentConfirmed()).isTrue();
        assertThat(noAi.reportSharingConfirmed()).isTrue();
    }

    @Test
    @DisplayName("C3: tệp chỉ có email,aiProcessingConfirmed ⇒ vẫn đọc (không rơi về NOTHING)")
    void aiProcessingAloneIsRead() {
        RosterColumnLayout l = layout("email", "aiProcessingConfirmed");

        Result r = reader.read(new String[]{"an@x.com", "đã thu"}, l, 2, "an@x.com");

        assertThat(r).isNotSameAs(RosterMinorColumnReader.NOTHING);
        assertThat(r.rejected()).isFalse();
        assertThat(r.aiProcessingConfirmed()).isTrue();
    }

    @Test
    @DisplayName("C3: ô gõ lạ ⇒ từ chối, câu mang TÊN CỘT aiProcessingConfirmed chứ không phải cột bên cạnh")
    void aiProcessingUnknownValueRejectedNamingColumn() {
        RosterColumnLayout l = layout("email", "reportSharingConfirmed", "aiProcessingConfirmed");

        Result r = reader.read(new String[]{"an@x.com", "x", "chờ bố mẹ"}, l, 7, "an@x.com");

        assertThat(r.rejected()).isTrue();
        assertThat(r.error()).startsWith("Dòng 7 (an@x.com): ")
                .contains("aiProcessingConfirmed").contains("chờ bố mẹ")
                .doesNotContain("reportSharingConfirmed \"");
    }

    @Test
    @DisplayName("C3: tiêu đề tiếng Việt \"Đồng ý chấm bằng AI\" khớp cột — thư ký trung tâm đặt tên cột bằng tiếng Việt")
    void aiProcessingVietnameseHeaderAlias() {
        RosterColumnLayout l = layout("email", "Đồng ý chấm bằng AI");

        assertThat(l.aiProcessingConfirmed()).isEqualTo(1);
        assertThat(reader.read(new String[]{"an@x.com", "x"}, l, 2, "an@x.com").aiProcessingConfirmed()).isTrue();
    }
}
