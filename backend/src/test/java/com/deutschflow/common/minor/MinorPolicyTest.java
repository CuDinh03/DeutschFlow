package com.deutschflow.common.minor;

import com.deutschflow.common.minor.MinorPolicy.Status;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * DEC-22 (owner chốt 09/09/2026) — chốt hành vi của {@link MinorPolicy}: MỘT nơi duy nhất trả lời
 * "người này có phải chưa thành niên không", với HAI ngưỡng (dưới 16 = luật, 16–17 = luật nội bộ
 * của trung tâm).
 *
 * <p><b>Không có Spring context ở đây.</b> {@code MinorPolicy} chỉ là số học lịch, dựng thẳng bằng
 * {@code new MinorPolicy(16, 18)} — cấu hình đảo ngưỡng cũng phải kiểm được, mà một context Spring
 * không cho phép dựng bean sai.
 *
 * <p>🪤 <b>Mọi ca đều đi qua {@link MinorPolicy#statusAt} với một {@link Instant} CỐ ĐỊNH.</b> Bẫy
 * đã ghi trong repo: "test ngày cứng + {@code now()} tự đỏ theo lịch" — một ca dựng ngày sinh bằng
 * {@code LocalDate.now().minusYears(16)} sẽ xanh hôm nay và đỏ vào đúng ngày 29/02 hoặc khi CI chạy
 * qua nửa đêm. Ngày sinh ở đây là hằng, thời điểm đánh giá là hằng, nên ca hỏng chỉ khi CODE hỏng.
 */
@DisplayName("MinorPolicy — phân loại vị thành niên hai ngưỡng (DEC-22)")
class MinorPolicyTest {

    /** Ngưỡng thật đang cấu hình: 16 = NĐ 13/2023 Điều 20, 18 = luật nội bộ trung tâm pilot. */
    private final MinorPolicy policy = new MinorPolicy(16, 18);

    /**
     * Thời điểm đánh giá cố định. 03:00Z = 10:00 giờ Việt Nam cùng ngày, tức nằm GIỮA ngày ở cả hai
     * múi giờ — các ca thường không bị lẫn với ca biên múi giờ ở dưới.
     */
    private static final Instant NOON_VN_2026_09_09 = Instant.parse("2026-09-09T03:00:00Z");

    /** Cùng "hôm nay" theo giờ Việt Nam, dùng để đặt tên ngày sinh cho dễ đọc. */
    private static final LocalDate TODAY_VN = LocalDate.of(2026, 9, 9);

    @Test
    @DisplayName("Tiền đề của cả lớp test: mốc đánh giá đúng là 09/09/2026 theo giờ Việt Nam")
    void fixture_isTheDateWeThinkItIs() {
        // Không có ca này thì mọi con số tuổi bên dưới là niềm tin, không phải sự thật: đổi hằng
        // NOON_VN_2026_09_09 mà quên đổi TODAY_VN sẽ làm cả lớp nói dối trong im lặng.
        assertThat(LocalDate.ofInstant(NOON_VN_2026_09_09, MinorPolicy.ZONE)).isEqualTo(TODAY_VN);
    }

    // ── Bốn nhánh Status ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Bốn nhánh phân loại")
    class FourBranches {

        @Test
        @DisplayName("Chưa khai ngày sinh ⇒ UNKNOWN (không phải MINOR, cũng không phải ADULT)")
        void nullBirthDate_isUnknown() {
            assertThat(policy.statusAt(null, NOON_VN_2026_09_09)).isEqualTo(Status.UNKNOWN);
            assertThat(policy.statusOf(null)).isEqualTo(Status.UNKNOWN);
        }

        @Test
        @DisplayName("11 tuổi ⇒ MINOR_LEGAL — dưới ngưỡng pháp lý 16")
        void wellUnderLegalThreshold_isMinorLegal() {
            LocalDate born = LocalDate.of(2015, 1, 1);
            assertThat(policy.ageAt(born, NOON_VN_2026_09_09)).isEqualTo(11);
            assertThat(policy.statusAt(born, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_LEGAL);
        }

        @Test
        @DisplayName("17 tuổi ⇒ MINOR_CENTER_POLICY — hết nghĩa vụ luật, còn luật nội bộ trung tâm")
        void betweenThresholds_isMinorCenterPolicy() {
            LocalDate born = LocalDate.of(2009, 1, 1);
            assertThat(policy.ageAt(born, NOON_VN_2026_09_09)).isEqualTo(17);
            assertThat(policy.statusAt(born, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_CENTER_POLICY);
        }

        @Test
        @DisplayName("26 tuổi ⇒ ADULT")
        void aboveBothThresholds_isAdult() {
            LocalDate born = LocalDate.of(2000, 1, 1);
            assertThat(policy.ageAt(born, NOON_VN_2026_09_09)).isEqualTo(26);
            assertThat(policy.statusAt(born, NOON_VN_2026_09_09)).isEqualTo(Status.ADULT);
        }
    }

    // ── Ranh giới sinh nhật ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Ranh giới sinh nhật — hết MINOR_LEGAL vào ĐÚNG ngày tròn 16, không sớm không muộn")
    class BirthdayBoundary {

        /** Sinh 09/09/2010 ⇒ tròn 16 vào đúng 09/09/2026, tức đúng mốc đánh giá của lớp test. */
        private final LocalDate turnsSixteenToday = LocalDate.of(2010, 9, 9);

        @Test
        @DisplayName("Ngày HÔM TRƯỚC sinh nhật 16: vẫn 15 tuổi, vẫn MINOR_LEGAL")
        void dayBeforeSixteenthBirthday_stillNeedsGuardian() {
            Instant dayBefore = NOON_VN_2026_09_09.minus(java.time.Duration.ofDays(1));

            assertThat(LocalDate.ofInstant(dayBefore, MinorPolicy.ZONE)).isEqualTo(TODAY_VN.minusDays(1));
            assertThat(policy.ageAt(turnsSixteenToday, dayBefore)).isEqualTo(15);
            assertThat(policy.statusAt(turnsSixteenToday, dayBefore)).isEqualTo(Status.MINOR_LEGAL);
            assertThat(policy.statusAt(turnsSixteenToday, dayBefore).requiresGuardianConsent()).isTrue();
        }

        @Test
        @DisplayName("ĐÚNG ngày tròn 16: đã hết MINOR_LEGAL, hạ xuống MINOR_CENTER_POLICY")
        void onSixteenthBirthday_dropsOutOfLegalMinor() {
            // Ngưỡng là `age < 16`, nên đúng ngày tròn 16 phải RA khỏi nhánh pháp lý. Lệch một ngày
            // theo hướng nào cũng sai: sớm một ngày là bỏ chốt bảo vệ khi luật vẫn còn đòi, muộn một
            // ngày là giữ ràng buộc người giám hộ lên người luật đã thôi bảo hộ.
            assertThat(policy.ageAt(turnsSixteenToday, NOON_VN_2026_09_09)).isEqualTo(16);
            assertThat(policy.statusAt(turnsSixteenToday, NOON_VN_2026_09_09))
                    .isEqualTo(Status.MINOR_CENTER_POLICY);
            assertThat(policy.statusAt(turnsSixteenToday, NOON_VN_2026_09_09).requiresGuardianConsent())
                    .isFalse();
            // …nhưng VẪN là trẻ vị thành niên theo luật nội bộ của trung tâm.
            assertThat(policy.statusAt(turnsSixteenToday, NOON_VN_2026_09_09).isMinor()).isTrue();
        }

        @Test
        @DisplayName("Ranh giới 18 cũng khớp ngày: hôm trước còn MINOR_CENTER_POLICY, đúng ngày thành ADULT")
        void eighteenthBirthday_endsCenterPolicy() {
            LocalDate turnsEighteenToday = LocalDate.of(2008, 9, 9);
            Instant dayBefore = NOON_VN_2026_09_09.minus(java.time.Duration.ofDays(1));

            assertThat(policy.statusAt(turnsEighteenToday, dayBefore)).isEqualTo(Status.MINOR_CENTER_POLICY);
            assertThat(policy.statusAt(turnsEighteenToday, NOON_VN_2026_09_09)).isEqualTo(Status.ADULT);
        }
    }

    // ── 29/02 ───────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Sinh 29/02: năm KHÔNG nhuận thì lên tuổi vào 01/03, ngày 28/02 vẫn là tuổi cũ")
    void leapDayBirthday_agesOnMarchFirstInNonLeapYears() {
        // Hành vi THẬT của Period.between (đã đo, không đoán): plusMonths kẹp 29/02 về 28/02 của năm
        // không nhuận, nên phép trừ ra thiếu một ngày và tuổi chỉ tăng từ 01/03.
        //
        // Chiều lệch này là chiều AN TOÀN cho một chính sách bảo vệ trẻ em: người sinh 29/02 được
        // coi là NHỎ HƠN thêm một ngày, chứ không phải lớn sớm một ngày. Ghi lại ở đây để đợt sau
        // không ai "sửa cho tròn" thành 28/02 mà không biết mình đang nới chốt bảo vệ.
        LocalDate leapBorn = LocalDate.of(2008, 2, 29);

        assertThat(policy.ageAt(leapBorn, instantAtVnDate(2026, 2, 28))).isEqualTo(17);
        assertThat(policy.statusAt(leapBorn, instantAtVnDate(2026, 2, 28)))
                .isEqualTo(Status.MINOR_CENTER_POLICY);

        assertThat(policy.ageAt(leapBorn, instantAtVnDate(2026, 3, 1))).isEqualTo(18);
        assertThat(policy.statusAt(leapBorn, instantAtVnDate(2026, 3, 1))).isEqualTo(Status.ADULT);

        // Năm NHUẬN thì sinh nhật có thật và tuổi tăng đúng ngày 29/02.
        assertThat(policy.ageAt(leapBorn, instantAtVnDate(2028, 2, 28))).isEqualTo(19);
        assertThat(policy.ageAt(leapBorn, instantAtVnDate(2028, 2, 29))).isEqualTo(20);
    }

    // ── Biên múi giờ ────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("🔴 Biên múi giờ: UTC còn là hôm qua, Việt Nam đã sang sinh nhật ⇒ phải ra TUỔI MỚI")
    void timezoneBoundary_usesVietnamCalendarNotUtc() {
        // Container chạy giờ UTC. Trong 7 tiếng mỗi ngày (17:00Z–24:00Z) lịch Việt Nam đã sang ngày
        // mới còn UTC thì chưa. Đây là ca DUY NHẤT bắt được việc ai đó gỡ ZoneId.of("Asia/Ho_Chi_Minh")
        // và thay bằng ZoneOffset.UTC hoặc ZoneId.systemDefault(): mọi ca khác vẫn xanh.
        Instant justAfterMidnightInVietnam = Instant.parse("2026-09-08T17:30:00Z");

        // Tiền đề: hai múi giờ THẬT SỰ lệch ngày ở thời điểm này.
        assertThat(LocalDate.ofInstant(justAfterMidnightInVietnam, ZoneOffset.UTC))
                .isEqualTo(LocalDate.of(2026, 9, 8));
        assertThat(LocalDate.ofInstant(justAfterMidnightInVietnam, MinorPolicy.ZONE))
                .isEqualTo(LocalDate.of(2026, 9, 9));

        LocalDate turnsSixteenOnSep9 = LocalDate.of(2010, 9, 9);

        // Theo lịch Việt Nam: đã 16 ⇒ hết MINOR_LEGAL.
        assertThat(policy.ageAt(turnsSixteenOnSep9, justAfterMidnightInVietnam)).isEqualTo(16);
        assertThat(policy.statusAt(turnsSixteenOnSep9, justAfterMidnightInVietnam))
                .isEqualTo(Status.MINOR_CENTER_POLICY);

        // …và đây là kết quả SAI mà một bản cài đặt theo UTC sẽ trả về. Giữ đối chứng âm này để
        // thông điệp lỗi nói thẳng ra chuyện gì đã xảy ra khi ai đó bỏ zone.
        int ageIfSomeoneSwitchedToUtc =
                java.time.Period.between(turnsSixteenOnSep9,
                        LocalDate.ofInstant(justAfterMidnightInVietnam, ZoneOffset.UTC)).getYears();
        assertThat(ageIfSomeoneSwitchedToUtc)
                .as("nếu ca này bằng 16 thì hai múi giờ không còn lệch ngày — ca đã mất hiệu lực, hãy đổi mốc")
                .isEqualTo(15);
    }

    @Test
    @DisplayName("Zone được ghim cứng vào giờ Việt Nam, không lấy theo máy chạy test")
    void zone_isPinnedToVietnam() {
        // Chốt trực tiếp lên hằng số, vì ca biên phía trên chỉ chứng minh "không phải UTC" chứ không
        // chứng minh "đúng Asia/Ho_Chi_Minh" (mọi zone UTC+1..+14 đều qua được ca đó).
        assertThat(MinorPolicy.ZONE).isEqualTo(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    // ── UNKNOWN không âm thầm ngả về bên nào ────────────────────────────────────────────────

    @Test
    @DisplayName("🔴 UNKNOWN: isMinor() false VÀ requiresGuardianConsent() false — quyết định thuộc điểm gọi")
    void unknown_isNeitherAdultNorChild() {
        // Nếu UNKNOWN.isMinor() trả true thì 37 dòng ghi danh cũ trên production bị siết như trẻ em
        // trong im lặng; nếu requiresGuardianConsent() trả true thì họ bị chặn khỏi AI mà không ai
        // hiểu vì sao. Cả hai đều là quyết định CHÍNH SÁCH — phải nằm ở điểm gọi, có cấu hình của
        // trung tâm và có thông báo cho người dùng, chứ không nằm ẩn trong enum này.
        assertThat(Status.UNKNOWN.isMinor()).isFalse();
        assertThat(Status.UNKNOWN.requiresGuardianConsent()).isFalse();

        // …nhưng UNKNOWN vẫn là một giá trị PHÂN BIỆT ĐƯỢC với ADULT, để điểm gọi có thứ để rẽ nhánh.
        assertThat(Status.UNKNOWN).isNotEqualTo(Status.ADULT);
    }

    @Test
    @DisplayName("Bảng chân trị đầy đủ của Status — hai vị từ, bốn nhánh")
    void statusPredicates_fullTruthTable() {
        assertThat(Status.UNKNOWN.isMinor()).isFalse();
        assertThat(Status.MINOR_LEGAL.isMinor()).isTrue();
        assertThat(Status.MINOR_CENTER_POLICY.isMinor()).isTrue();
        assertThat(Status.ADULT.isMinor()).isFalse();

        assertThat(Status.UNKNOWN.requiresGuardianConsent()).isFalse();
        assertThat(Status.MINOR_LEGAL.requiresGuardianConsent()).isTrue();
        // 16–17: luật KHÔNG đòi người giám hộ, chỉ luật nội bộ của trung tâm siết. Trả true ở đây là
        // dựng ra một nghĩa vụ pháp lý không tồn tại và chặn nhóm học viên lớn nhất của trung tâm.
        assertThat(Status.MINOR_CENTER_POLICY.requiresGuardianConsent()).isFalse();
        assertThat(Status.ADULT.requiresGuardianConsent()).isFalse();
    }

    // ── Dữ liệu bẩn và cấu hình bẩn ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("Ngày sinh ở TƯƠNG LAI ⇒ 0 tuổi (fail về phía an toàn), không bao giờ ra số âm")
    void futureBirthDate_clampsToZero_neverNegative() {
        // Tầng DB không chặn được ("PostgreSQL cấm CURRENT_DATE trong CHECK"), nên gõ nhầm năm sinh
        // 2030 là chuyện sẽ xảy ra. Một số âm sẽ lọt qua MỌI phép so sánh `age < ngưỡng` theo đúng
        // hướng bảo vệ, nhưng lại lọt luôn vào mọi phép `age >= ngưỡng` ở nơi khác — 0 là giá trị
        // duy nhất an toàn ở cả hai chiều.
        LocalDate typoInTheFuture = LocalDate.of(2030, 1, 1);

        assertThat(policy.ageAt(typoInTheFuture, NOON_VN_2026_09_09)).isZero();
        assertThat(policy.statusAt(typoInTheFuture, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_LEGAL);
        assertThat(policy.statusAt(typoInTheFuture, NOON_VN_2026_09_09).requiresGuardianConsent()).isTrue();
    }

    @Test
    @DisplayName("Sinh đúng NGÀY HÔM NAY ⇒ 0 tuổi, không rơi vào nhánh tương lai")
    void bornToday_isZero_notTreatedAsFuture() {
        assertThat(policy.ageAt(TODAY_VN, NOON_VN_2026_09_09)).isZero();
        assertThat(policy.statusAt(TODAY_VN, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_LEGAL);
    }

    @Test
    @DisplayName("Cấu hình đảo ngưỡng (legal > center) ⇒ constructor NÉM, không boot lên rồi sai âm thầm")
    void invertedThresholds_failFastAtConstruction() {
        // Đảo hai biến môi trường là lỗi cấu hình dễ mắc nhất, và hậu quả im lặng: nhánh
        // MINOR_CENTER_POLICY không bao giờ đạt tới, nên toàn bộ nhóm 16–17 nhảy thẳng sang ADULT.
        assertThatThrownBy(() -> new MinorPolicy(18, 16))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.minor.legal-guardian-threshold")
                .hasMessageContaining("app.minor.center-policy-threshold");
    }

    @Test
    @DisplayName("Đối chứng dương: cấu hình thuận (16, 18) dựng được và giữ nguyên hai ngưỡng")
    void sensibleThresholds_areAccepted() {
        assertThatCode(() -> new MinorPolicy(16, 18)).doesNotThrowAnyException();
        assertThat(policy.legalThreshold()).isEqualTo(16);
        assertThat(policy.centerPolicyThreshold()).isEqualTo(18);
    }

    @Test
    @DisplayName("Ngưỡng đọc từ cấu hình, không ghim cứng số 16/18 trong thân hàm")
    void thresholds_actuallyDriveTheClassification() {
        // Owner có thể đổi luật nội bộ của trung tâm (16–17 → 16–20 chẳng hạn). Nếu ai đó viết
        // `if (age < 16)` thẳng vào statusAt thì mọi ca phía trên vẫn xanh — chỉ ca này đỏ.
        MinorPolicy strict = new MinorPolicy(13, 21);
        LocalDate age17 = LocalDate.of(2009, 1, 1);
        LocalDate age11 = LocalDate.of(2015, 1, 1);

        assertThat(strict.statusAt(age17, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_CENTER_POLICY);
        // 11 tuổi dưới ngưỡng 13 ⇒ vẫn MINOR_LEGAL, nhưng ở cấu hình gốc (16) thì cũng vậy —
        // nên thêm ca 14 tuổi: gốc là MINOR_LEGAL, cấu hình này là MINOR_CENTER_POLICY.
        assertThat(strict.statusAt(age11, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_LEGAL);

        LocalDate age14 = LocalDate.of(2012, 1, 1);
        assertThat(policy.ageAt(age14, NOON_VN_2026_09_09)).isEqualTo(14);
        assertThat(policy.statusAt(age14, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_LEGAL);
        assertThat(strict.statusAt(age14, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_CENTER_POLICY);
        // 22 tuổi: gốc là ADULT, cấu hình siết tới 21 vẫn ADULT; 20 tuổi thì hai bên khác nhau.
        LocalDate age20 = LocalDate.of(2006, 1, 1);
        assertThat(policy.statusAt(age20, NOON_VN_2026_09_09)).isEqualTo(Status.ADULT);
        assertThat(strict.statusAt(age20, NOON_VN_2026_09_09)).isEqualTo(Status.MINOR_CENTER_POLICY);
    }

    // ── statusOf ủy quyền cho statusAt ──────────────────────────────────────────────────────

    @Test
    @DisplayName("statusOf(hôm nay) ủy quyền cho statusAt — kiểm bằng hai ngày sinh KHÔNG phụ thuộc lịch")
    void statusOf_delegatesToStatusAt() {
        // Chỉ dùng ngày sinh mà kết quả không đổi theo ngày chạy test: 01/01/1900 mãi mãi là ADULT,
        // và 01/01/2100 (biên trên của CHECK trong V319) thì còn ở tương lai suốt vòng đời sản phẩm.
        assertThat(policy.statusOf(LocalDate.of(1900, 1, 1))).isEqualTo(Status.ADULT);
        assertThat(policy.statusOf(LocalDate.of(2100, 1, 1))).isEqualTo(Status.MINOR_LEGAL);
        assertThat(policy.statusOf(null)).isEqualTo(Status.UNKNOWN);
    }

    // ── helper ──────────────────────────────────────────────────────────────────────────────

    /** Một {@link Instant} rơi vào 12:00 trưa giờ Việt Nam của ngày đã cho — không dính biên nửa đêm. */
    private static Instant instantAtVnDate(int year, int month, int day) {
        return LocalDate.of(year, month, day).atTime(12, 0).atZone(MinorPolicy.ZONE).toInstant();
    }
}
