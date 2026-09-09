package com.deutschflow.organization;

import com.deutschflow.common.minor.ConsentState;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Gói 1 (DEC-22, owner chốt 09/09/2026) — nền dữ liệu cho học viên chưa thành niên, trên PostgreSQL
 * THẬT. Ba thứ chỉ DB thật mới chứng minh được, và cả ba đều là thứ không vá lại được sau khi hệ
 * thống đã nhận bài viết và bản ghi âm của trẻ:
 *
 * <ol>
 *   <li>V319 áp SẠCH trên DB trắng — không migration nào thất bại, không cột nào lệch kiểu;</li>
 *   <li>{@code student_consents} THẬT SỰ chỉ-ghi-thêm: trigger chặn UPDATE và DELETE. Đây là chốt
 *       duy nhất bắt được lỗi "ai đó gỡ trigger" ở đợt sau — bảng mất tính bất biến TRONG IM LẶNG,
 *       không log, không test nào khác đỏ;</li>
 *   <li>thu hồi đồng ý = ghi dòng {@code REVOKED} MỚI, dòng {@code GRANTED} cũ VẪN CÒN. Đây đúng
 *       chỗ khác luật với {@code speaking_exam_calibration_participants} (V284), nơi XOÁ dòng mới là
 *       rút đồng ý. Hai luật ngược nhau nằm cạnh nhau trong một repo thì phải có test giữ.</li>
 * </ol>
 *
 * <p>🪤 <b>Không đặt {@code @Transactional} lên lớp này.</b> Trigger {@code RAISE EXCEPTION} sẽ huỷ
 * transaction đang mở; các ca "phải ném" cần mỗi câu lệnh nằm trong transaction riêng của
 * {@code JdbcTemplate} (auto-commit) để ca kế tiếp còn chạy được. Cùng lý do
 * {@code OrgAuditLogIntegrationTest} không dùng {@code @Transactional}.
 */
@SpringBootTest
@DisplayName("Nền dữ liệu học viên chưa thành niên Integration Tests (DEC-22, V319)")
class MinorFoundationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private MinorLearnerService minorLearnerService;

    // ── 1. Migration ────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("V319 áp sạch trên DB trắng")
    class MigrationApplied {

        @Test
        @DisplayName("V319 nằm trong lịch sử Flyway với success=true, và KHÔNG migration nào thất bại")
        void v319_appliedSuccessfully_andNothingFailed() {
            assertThat(jdbcTemplate.queryForObject("""
                    SELECT COUNT(*) FROM flyway_schema_history
                     WHERE version = '319' AND success
                    """, Long.class))
                    .as("V319 phải có trong flyway_schema_history — nếu 0 thì DB này chưa chạy migration")
                    .isEqualTo(1L);

            // Flyway dừng ở migration đầu tiên hỏng, nên "không dòng nào success=false" là cách duy
            // nhất phát biểu "áp sạch" mà không phải liệt kê 300 phiên bản.
            List<String> failed = jdbcTemplate.queryForList(
                    "SELECT version FROM flyway_schema_history WHERE NOT success", String.class);
            assertThat(failed).as("migration thất bại còn sót trong lịch sử").isEmpty();
        }

        @Test
        @DisplayName("V319 là migration MỚI NHẤT đã áp — đợt sau đánh số phải bắt đầu từ V320")
        void v319_isTheHighestAppliedVersion() {
            // `version` là text nên ORDER BY chữ sẽ xếp '99' sau '319'. Xếp theo installed_rank
            // (thứ tự áp thật) rồi so — đây cũng chính là thứ Flyway dùng để quyết định out-of-order.
            String latest = jdbcTemplate.queryForObject("""
                    SELECT version FROM flyway_schema_history
                     WHERE version IS NOT NULL
                     ORDER BY installed_rank DESC
                     LIMIT 1
                    """, String.class);
            assertThat(latest).isEqualTo("319");
        }
    }

    // ── 2. Hình dạng schema ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Hình dạng schema — cột, bảng, CHECK, index")
    class SchemaShape {

        @Test
        @DisplayName("Ba cột mới trên users tồn tại ĐÚNG KIỂU")
        void users_hasThreeNewColumns_withRightTypes() {
            // Kiểu là một phần của hợp đồng, không phải chi tiết: birth_date phải là DATE chứ không
            // TIMESTAMP (một dấu thời gian sẽ kéo theo múi giờ vào chỗ MinorPolicy đã ghim zone rồi),
            // và birth_date_recorded_at phải là TIMESTAMPTZ chứ không TIMESTAMP (mất offset thì câu
            // "lúc ghi" không so được với bản ghi âm).
            assertThat(columnType("users", "birth_date")).isEqualTo("date");
            assertThat(columnType("users", "birth_date_recorded_at")).isEqualTo("timestamp with time zone");
            assertThat(columnType("users", "birth_date_recorded_by")).isEqualTo("bigint");
        }

        @Test
        @DisplayName("birth_date_recorded_by trỏ về users(id) — người nhập hộ phải truy được")
        void recordedBy_isForeignKeyToUsers() {
            assertThat(jdbcTemplate.queryForObject("""
                    SELECT COUNT(*)
                      FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage kcu
                        ON kcu.constraint_name = tc.constraint_name
                     WHERE tc.table_name = 'users'
                       AND tc.constraint_type = 'FOREIGN KEY'
                       AND kcu.column_name = 'birth_date_recorded_by'
                    """, Long.class)).isEqualTo(1L);
        }

        @Test
        @DisplayName("Hai bảng mới tồn tại")
        void newTables_exist() {
            assertThat(tableExists("student_guardians")).isTrue();
            assertThat(tableExists("student_consents")).isTrue();
        }

        @Test
        @DisplayName("Đủ SÁU CHECK đã khai — không cái nào rơi mất trong khối DO $$")
        void allDeclaredChecks_exist() {
            // Các CHECK này nằm trong `IF NOT EXISTS ... THEN ALTER` nên gõ sai tên bảng cũng không
            // làm migration đỏ: nó chỉ lặng lẽ không tạo gì. Chỉ có chốt này bắt được.
            assertThat(constraintExists("chk_users_birth_date_sane")).isTrue();
            assertThat(constraintExists("chk_student_guardians_relationship")).isTrue();
            assertThat(constraintExists("chk_student_guardians_contactable")).isTrue();
            assertThat(constraintExists("chk_student_consents_scope")).isTrue();
            assertThat(constraintExists("chk_student_consents_action")).isTrue();
            assertThat(constraintExists("chk_student_consents_method")).isTrue();
        }

        @Test
        @DisplayName("Đủ NĂM index đã khai, và index sổ đồng ý là index MỘT PHẦN đúng như thiết kế")
        void allDeclaredIndexes_exist() {
            assertThat(indexExists("idx_users_birth_date_missing")).isTrue();
            assertThat(indexExists("uq_student_guardians_primary")).isTrue();
            assertThat(indexExists("idx_student_guardians_org")).isTrue();
            assertThat(indexExists("idx_student_consents_subject")).isTrue();
            assertThat(indexExists("idx_student_consents_org")).isTrue();

            // Index đếm "còn ai chưa khai ngày sinh" chỉ có nghĩa khi nó là MỘT PHẦN — index đầy đủ
            // trên users(org_id) sẽ tốn chỗ và không trả lời được câu hỏi đó.
            assertThat(indexDefinition("idx_users_birth_date_missing"))
                    .contains("WHERE").contains("birth_date IS NULL");
            assertThat(indexDefinition("uq_student_guardians_primary"))
                    .contains("UNIQUE").contains("WHERE");
        }

        @Test
        @DisplayName("chk_users_birth_date_sane chặn năm sinh vô lý (1800), cho qua năm hợp lệ")
        void birthDateSanityCheck_isEnforced() {
            User u = student();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE users SET birth_date = DATE '1800-01-01' WHERE id = ?", u.getId()))
                    .hasMessageContaining("chk_users_birth_date_sane");

            // Đối chứng dương: CHECK không siết quá tay lên ngày sinh bình thường.
            assertThatCode(() -> jdbcTemplate.update(
                    "UPDATE users SET birth_date = DATE '2010-09-09' WHERE id = ?", u.getId()))
                    .doesNotThrowAnyException();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT birth_date::text FROM users WHERE id = ?", String.class, u.getId()))
                    .isEqualTo("2010-09-09");
        }
    }

    // ── 3. student_consents chỉ-ghi-thêm ────────────────────────────────────────────────────

    @Nested
    @DisplayName("🔴 student_consents CHỈ GHI THÊM — trigger còn sống")
    class AppendOnlyLedger {

        @Test
        @DisplayName("Trigger trg_student_consents_immutable tồn tại trên bảng")
        void immutabilityTrigger_isInstalled() {
            assertThat(jdbcTemplate.queryForObject("""
                    SELECT COUNT(*) FROM pg_trigger
                     WHERE tgrelid = 'student_consents'::regclass
                       AND tgname = 'trg_student_consents_immutable'
                       AND NOT tgisinternal
                    """, Long.class)).isEqualTo(1L);
        }

        @Test
        @DisplayName("INSERT được, nhưng UPDATE NÉM và DELETE NÉM")
        void insertAllowed_updateAndDeleteRejected() {
            User student = student();
            long consentId = insertConsent(student.getId(), null, "AI_PROCESSING", "GRANTED",
                    null, Instant.now().minus(1, ChronoUnit.HOURS));

            // Ghi thêm: phải chạy được, nếu không thì trigger đang chặn nhầm cả INSERT.
            assertThat(consentId).isPositive();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE student_consents SET action = 'GRANTED', note = 'da sua' WHERE id = ?", consentId))
                    .hasMessageContaining("append-only")
                    .hasMessageContaining("trg_student_consents_immutable");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "DELETE FROM student_consents WHERE id = ?", consentId))
                    .hasMessageContaining("append-only")
                    .hasMessageContaining("trg_student_consents_immutable");

            // Đối chứng dương: dòng vẫn NGUYÊN VẸN sau hai lần thử phá — không phải chỉ "câu lệnh
            // ném" mà dữ liệu đã kịp đổi.
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT action FROM student_consents WHERE id = ?", String.class, consentId))
                    .isEqualTo("GRANTED");
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT note FROM student_consents WHERE id = ?", String.class, consentId)).isNull();
        }

        @Test
        @DisplayName("UPDATE không đụng cột nào (SET id = id) CŨNG bị chặn — trigger chặn theo thao tác")
        void noOpUpdate_isAlsoRejected() {
            // Trigger BEFORE UPDATE FOR EACH ROW không quan tâm cột nào đổi. Ca này chốt rằng không
            // ai có thể lách bằng một UPDATE "vô hại" rồi mở rộng dần.
            User student = student();
            long consentId = insertConsent(student.getId(), null, "DATA_PROCESSING", "GRANTED",
                    null, Instant.now());

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE student_consents SET id = id WHERE id = ?", consentId))
                    .hasMessageContaining("append-only");
        }

        @Test
        @DisplayName("CHECK chặn scope/action/method ngoài danh sách — sổ bằng chứng không nhận giá trị lạ")
        void enumLikeChecks_areEnforced() {
            User student = student();
            Instant now = Instant.now();

            assertThatThrownBy(() -> insertConsent(student.getId(), null, "MARKETING", "GRANTED", null, now))
                    .hasMessageContaining("chk_student_consents_scope");
            assertThatThrownBy(() -> insertConsent(student.getId(), null, "AI_PROCESSING", "MAYBE", null, now))
                    .hasMessageContaining("chk_student_consents_action");
            assertThatThrownBy(() -> jdbcTemplate.update("""
                    INSERT INTO student_consents
                        (student_user_id, scope, action, method, terms_version, effective_at)
                    VALUES (?, 'AI_PROCESSING', 'GRANTED', 'CARRIER_PIGEON', 'v1', NOW())
                    """, student.getId()))
                    .hasMessageContaining("chk_student_consents_method");
        }
    }

    // ── 4. Thu hồi = ghi thêm, không xoá ────────────────────────────────────────────────────

    @Test
    @DisplayName("🔴 Thu hồi bằng dòng REVOKED mới: trạng thái thành 'không còn đồng ý' mà dòng GRANTED VẪN CÒN")
    void revocation_appendsRow_andKeepsTheOriginalGrant() {
        // Khác biệt CỐ Ý với speaking_exam_calibration_participants (V284), nơi comment ghi "Xoá dòng
        // = rút đồng ý". Ở đây xoá dòng là mất luôn câu trả lời cho "ai đồng ý, lúc nào, rồi rút lúc
        // nào" — đúng ba câu cơ quan bảo vệ dữ liệu sẽ hỏi về dữ liệu của trẻ vị thành niên.
        User student = student();
        Organization org = org();
        Instant grantedAt = Instant.parse("2026-09-01T02:00:00Z");
        Instant revokedAt = Instant.parse("2026-09-05T02:00:00Z");

        // Chưa hỏi bao giờ ≠ đã hỏi rồi bị rút — hai tình huống vận hành khác hẳn nhau.
        assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.AUDIO_RECORDING))
                .isEqualTo(ConsentState.NEVER_RECORDED);

        long grantId = insertConsent(student.getId(), org.getId(), "AUDIO_RECORDING", "GRANTED",
                null, grantedAt);
        assertThat(currentConsentAction(student.getId(), "AUDIO_RECORDING")).isEqualTo("GRANTED");
        assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.AUDIO_RECORDING))
                .isEqualTo(ConsentState.GRANTED);

        long revokeId = insertConsent(student.getId(), org.getId(), "AUDIO_RECORDING", "REVOKED",
                null, revokedAt);

        // (1) Trạng thái hiện tại = "không còn đồng ý" — hỏi qua ĐÚNG đường đọc của sản phẩm, chứ
        //     không chỉ qua câu SQL của test. Cả hai phải nói cùng một điều.
        assertThat(currentConsentAction(student.getId(), "AUDIO_RECORDING")).isEqualTo("REVOKED");
        ConsentState afterRevoke =
                minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.AUDIO_RECORDING);
        assertThat(afterRevoke).isEqualTo(ConsentState.REVOKED);
        assertThat(afterRevoke.isEffective())
                .as("REVOKED phải chặn xử lý dữ liệu — đây là chốt mà đường gọi AI sẽ hỏi ở PR-1B")
                .isFalse();

        // (2) Dòng GRANTED cũ VẪN CÒN — đây là điểm khác V284 và là toàn bộ lý do bảng này tồn tại.
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM student_consents
                 WHERE student_user_id = ? AND scope = 'AUDIO_RECORDING' AND action = 'GRANTED'
                """, Long.class, student.getId())).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM student_consents WHERE id IN (?, ?)",
                Long.class, grantId, revokeId)).isEqualTo(2L);

        // (3) Thu hồi ở phạm vi này KHÔNG kéo theo phạm vi khác — mỗi scope là một dòng đời riêng.
        insertConsent(student.getId(), org.getId(), "MESSAGING", "GRANTED", null, grantedAt);
        assertThat(currentConsentAction(student.getId(), "MESSAGING")).isEqualTo("GRANTED");
        assertThat(currentConsentAction(student.getId(), "AUDIO_RECORDING")).isEqualTo("REVOKED");

        // (4) Đồng ý LẠI sau khi thu hồi cũng chỉ là ghi thêm một dòng nữa.
        insertConsent(student.getId(), org.getId(), "AUDIO_RECORDING", "GRANTED", null,
                Instant.parse("2026-09-08T02:00:00Z"));
        assertThat(currentConsentAction(student.getId(), "AUDIO_RECORDING")).isEqualTo("GRANTED");
        assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.AUDIO_RECORDING))
                .isEqualTo(ConsentState.GRANTED);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM student_consents
                 WHERE student_user_id = ? AND scope = 'AUDIO_RECORDING'
                """, Long.class, student.getId()))
                .as("ba lần thao tác ⇒ ba dòng, không dòng nào bị ghi đè")
                .isEqualTo(3L);
    }

    @Test
    @DisplayName("Trạng thái đọc theo effective_at (lúc đồng ý THẬT), không theo created_at (lúc bấm nút)")
    void currentStatus_readsEffectiveAt_notCreatedAt() {
        // Cảnh có thật: trung tâm nhập bù giấy thu hồi ký từ tuần trước SAU khi đã nhập giấy đồng ý
        // ký từ tháng trước. created_at đảo ngược thứ tự, effective_at thì không.
        User student = student();
        long ignoredNewerRow = insertConsent(student.getId(), null, "DATA_PROCESSING", "GRANTED",
                null, Instant.parse("2026-08-01T02:00:00Z"));
        insertConsent(student.getId(), null, "DATA_PROCESSING", "REVOKED",
                null, Instant.parse("2026-09-01T02:00:00Z"));

        assertThat(ignoredNewerRow).isPositive();
        assertThat(currentConsentAction(student.getId(), "DATA_PROCESSING")).isEqualTo("REVOKED");
        assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.DATA_PROCESSING))
                .isEqualTo(ConsentState.REVOKED);

        // Đối chứng: nhập bù một dòng GRANTED có effective_at CŨ HƠN thì KHÔNG lật lại trạng thái,
        // dù nó là dòng created_at mới nhất.
        insertConsent(student.getId(), null, "DATA_PROCESSING", "GRANTED",
                null, Instant.parse("2026-07-01T02:00:00Z"));
        assertThat(currentConsentAction(student.getId(), "DATA_PROCESSING")).isEqualTo("REVOKED");
        assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.DATA_PROCESSING))
                .as("nhập bù dòng cũ không được lật trạng thái — nếu đường đọc xếp theo created_at thì ca này đỏ")
                .isEqualTo(ConsentState.REVOKED);
    }

    // ── 5. student_guardians ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("student_guardians — liên lạc được và chỉ MỘT người giám hộ chính")
    class Guardians {

        @Test
        @DisplayName("Không phone VÀ không email ⇒ INSERT bị chặn (chk_student_guardians_contactable)")
        void guardianWithNoContactChannel_isRejected() {
            // Một người giám hộ không liên lạc được là bản ghi vô dụng đúng lúc cần dùng nhất.
            User student = student();

            assertThatThrownBy(() -> insertGuardian(student.getId(), "Khong lien lac duoc",
                    "MOTHER", null, null, true))
                    .hasMessageContaining("chk_student_guardians_contactable");

            // Đối chứng dương: CHỈ phone được, CHỈ email được, cả hai cũng được.
            User a = student();
            User b = student();
            User c = student();
            assertThatCode(() -> insertGuardian(a.getId(), "Chi co phone", "MOTHER", "0900000001", null, true))
                    .doesNotThrowAnyException();
            assertThatCode(() -> insertGuardian(b.getId(), "Chi co email", "FATHER", null, "g@test.local", true))
                    .doesNotThrowAnyException();
            assertThatCode(() -> insertGuardian(c.getId(), "Ca hai", "LEGAL_GUARDIAN", "0900000002",
                    "g2@test.local", true)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Quan hệ ngoài danh sách bị chặn (chk_student_guardians_relationship)")
        void unknownRelationship_isRejected() {
            User student = student();
            assertThatThrownBy(() -> insertGuardian(student.getId(), "Hang xom", "NEIGHBOUR",
                    "0900000003", null, true))
                    .hasMessageContaining("chk_student_guardians_relationship");
        }

        @Test
        @DisplayName("🔴 HAI người giám hộ CHÍNH cho cùng một học viên ⇒ bị chặn")
        void twoPrimaryGuardiansForSameStudent_areRejected() {
            User student = student();
            insertGuardian(student.getId(), "Me", "MOTHER", "0900000010", null, true);

            assertThatThrownBy(() -> insertGuardian(student.getId(), "Bo", "FATHER", "0900000011", null, true))
                    .hasMessageContaining("uq_student_guardians_primary");
        }

        @Test
        @DisplayName("MỘT chính + MỘT phụ cho cùng học viên ⇒ được (index là MỘT PHẦN, chỉ siết is_primary)")
        void onePrimaryPlusSecondary_isAllowed() {
            // Không có ca này thì một UNIQUE đầy đủ trên (student_user_id) vẫn xanh ở ca trên, trong
            // khi nó cấm luôn người giám hộ thứ hai — đúng cảnh phổ biến nhất (cả bố lẫn mẹ).
            User student = student();
            insertGuardian(student.getId(), "Me", "MOTHER", "0900000020", null, true);

            assertThatCode(() -> insertGuardian(student.getId(), "Bo", "FATHER", "0900000021", null, false))
                    .doesNotThrowAnyException();

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ?",
                    Long.class, student.getId())).isEqualTo(2L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ? AND is_primary",
                    Long.class, student.getId())).isEqualTo(1L);
        }

        @Test
        @DisplayName("Hai học viên KHÁC NHAU đều có người giám hộ chính ⇒ được, index chỉ siết trong một học viên")
        void primaryGuardiansAcrossDifferentStudents_areIndependent() {
            User first = student();
            User second = student();

            assertThatCode(() -> {
                insertGuardian(first.getId(), "Me A", "MOTHER", "0900000030", null, true);
                insertGuardian(second.getId(), "Me B", "MOTHER", "0900000031", null, true);
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("student_guardians SỬA ĐƯỢC — khác student_consents, gõ sai số điện thoại phải sửa được")
        void guardianRowIsMutable_unlikeTheConsentLedger() {
            // Đây là chốt phân biệt hai bảng: một bảng là PII sửa được, một bảng là sổ bằng chứng.
            // Nếu ai đó "cho nhất quán" mà gắn trigger append-only lên cả hai thì ca này đỏ.
            User student = student();
            long guardianId = insertGuardian(student.getId(), "Me", "MOTHER", "0900000040", null, true);

            assertThatCode(() -> jdbcTemplate.update(
                    "UPDATE student_guardians SET phone = '0911111111' WHERE id = ?", guardianId))
                    .doesNotThrowAnyException();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT phone FROM student_guardians WHERE id = ?", String.class, guardianId))
                    .isEqualTo("0911111111");

            // Xoá được — nhưng CHỈ vì chưa dòng đồng ý nào trỏ tới. Xem hai ca
            // Ca ngay dưới chốt chiều còn lại: có tham chiếu thì vẫn xoá được, chỉ mất đường nối.
            assertThatCode(() -> jdbcTemplate.update(
                    "DELETE FROM student_guardians WHERE id = ?", guardianId))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Sửa liên lạc của người giám hộ KHÔNG làm mất hiệu lực lần đồng ý đã thu")
        void editingGuardianContact_doesNotInvalidateStoredConsent() {
            User student = student();
            long guardianId = insertGuardian(student.getId(), "Me", "MOTHER", "0900000050", null, true);
            long consentId = insertConsent(student.getId(), null, "AI_PROCESSING", "GRANTED",
                    guardianId, Instant.parse("2026-09-01T02:00:00Z"));

            jdbcTemplate.update("UPDATE student_guardians SET phone = '0922222222' WHERE id = ?", guardianId);

            assertThat(currentConsentAction(student.getId(), "AI_PROCESSING")).isEqualTo("GRANTED");
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT guardian_id FROM student_consents WHERE id = ?", Long.class, consentId))
                    .isEqualTo(guardianId);
        }

        @Test
        @DisplayName("Xoá người giám hộ ĐÃ ĐƯỢC THAM CHIẾU: dòng đồng ý còn nguyên, guardian_id thành NULL")
        void deletingReferencedGuardian_keepsLedgerRowAndNullsTheLink() {
            // Khoá ngoại `ON DELETE SET NULL` được PostgreSQL thi hành bằng một câu
            // `UPDATE ONLY student_consents SET guardian_id = NULL`, tức nó ĐI QUA trigger append-only
            // của bảng sổ. Bản V319 đầu tiên không có mệnh đề WHEN nên câu đó bị chặn và việc xoá người
            // giám hộ trở thành BẤT KHẢ — trái chính lời V319 mô tả bảng này là "PII, SỬA ĐƯỢC".
            //
            // `WHEN (pg_trigger_depth() = 0)` phân biệt được hai thứ: lệnh do người gõ thẳng (depth 0,
            // vẫn chặn) và lệnh do khoá ngoại tự dọn (depth > 0, cho qua). Ca này chốt vế thứ hai; ca
            // `directUpdate_isBlocked` chốt vế thứ nhất. Thiếu một trong hai là mất một nửa ý nghĩa.
            User student = student();
            long guardianId = insertGuardian(student.getId(), "Me", "MOTHER", "0900000060", null, true);
            long consentId = insertConsent(student.getId(), null, "AI_PROCESSING", "GRANTED",
                    guardianId, Instant.parse("2026-09-01T02:00:00Z"));

            assertThatCode(() -> jdbcTemplate.update(
                    "DELETE FROM student_guardians WHERE id = ?", guardianId))
                    .doesNotThrowAnyException();

            // Bằng chứng đồng ý KHÔNG biến mất theo người giám hộ — chỉ mất đường nối.
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE id = ?", Long.class, consentId))
                    .isEqualTo(1L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT guardian_id FROM student_consents WHERE id = ?", Long.class, consentId))
                    .isNull();
            assertThat(currentConsentAction(student.getId(), "AI_PROCESSING")).isEqualTo("GRANTED");
        }

        @Test
        @DisplayName("Xoá tài khoản mang theo cả bằng chứng đồng ý — quyền xoá dữ liệu không bị sổ khoá lại")
        void deletingStudentWithConsentRow_cascadesAndRemovesEvidence() {
            // Đây là ca quan trọng nhất của cả bảng. Bản V319 đầu tiên biến một biện pháp BẢO VỆ trẻ
            // vị thành niên thành thứ CHẶN quyền xoá dữ liệu của chính các em: `ON DELETE CASCADE` được
            // thi hành bằng `DELETE FROM ONLY student_consents`, đi qua trigger, và bị chặn — nên chỉ
            // cần MỘT dòng đồng ý là tài khoản không xoá được nữa, còn mọi job đang xoá user thì bắt
            // đầu ném.
            //
            // Ngữ nghĩa đã chọn: xoá tài khoản mang theo dòng consent (dòng đó chứa PII). Ta KHÔNG mất
            // khả năng trả lời "đã từng thu đồng ý chưa" — mỗi lần ghi đồng ý để lại một dòng trong
            // `audit_logs`, mà bảng đó không có khoá ngoại tới `users` (V20: `actor_user_id BIGINT
            // NULL`) nên vết sống lâu hơn tài khoản.
            User student = student();
            insertConsent(student.getId(), null, "DATA_PROCESSING", "GRANTED", null,
                    Instant.parse("2026-09-01T02:00:00Z"));

            assertThatCode(() -> jdbcTemplate.update(
                    "DELETE FROM users WHERE id = ?", student.getId()))
                    .doesNotThrowAnyException();

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE id = ?", Long.class, student.getId()))
                    .isEqualTo(0L);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_consents WHERE student_user_id = ?",
                    Long.class, student.getId()))
                    .as("dòng consent mang PII nên đi cùng tài khoản; vết trong audit_logs mới là thứ ở lại")
                    .isEqualTo(0L);
        }

        @Test
        @DisplayName("Đối chứng: học viên CHƯA có dòng đồng ý nào thì vẫn xoá được bình thường")
        void deletingStudentWithoutConsentRows_stillWorks() {
            // Chốt rằng hai ca trên nói về ĐÚNG nguyên nhân (dòng sổ đồng ý), không phải về một ràng
            // buộc khoá ngoại nào khác của `users` đang chặn sẵn.
            User student = student();
            insertGuardian(student.getId(), "Me", "MOTHER", "0900000070", null, true);

            assertThatCode(() -> jdbcTemplate.update("DELETE FROM users WHERE id = ?", student.getId()))
                    .doesNotThrowAnyException();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE id = ?", Long.class, student.getId())).isZero();
            // Người giám hộ đi theo học viên (ON DELETE CASCADE) — không có trigger nào chặn đường này.
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM student_guardians WHERE student_user_id = ?",
                    Long.class, student.getId())).isZero();
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    private User student() {
        return userRepository.save(User.builder()
                .email("dec22-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("HV vi thanh nien")
                .role(User.Role.STUDENT)
                .build());
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("dec22-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    /** Ghi một dòng sổ đồng ý, trả về id. Ném nguyên vẹn lỗi DB để ca "phải bị chặn" bắt được. */
    private long insertConsent(Long studentUserId, Long orgId, String scope, String action,
                               Long guardianId, Instant effectiveAt) {
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO student_consents
                    (student_user_id, org_id, scope, action, guardian_id, method, terms_version, effective_at)
                VALUES (?, ?, ?, ?, ?, 'PAPER', 'dec22-v1', ?)
                RETURNING id
                """, Long.class,
                studentUserId, orgId, scope, action, guardianId, java.sql.Timestamp.from(effectiveAt));
        return id == null ? -1L : id;
    }

    private long insertGuardian(Long studentUserId, String fullName, String relationship,
                                String phone, String email, boolean primary) {
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO student_guardians
                    (student_user_id, full_name, relationship, phone, email, is_primary)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, studentUserId, fullName, relationship, phone, email, primary);
        return id == null ? -1L : id;
    }

    /**
     * Trạng thái đồng ý HIỆN TẠI của một học viên cho một phạm vi = dòng {@code effective_at} mới
     * nhất. Viết đúng câu truy vấn mà {@code idx_student_consents_subject} phục vụ — nếu index đổi
     * hình thì ca test này là chỗ nhắc.
     */
    private String currentConsentAction(Long studentUserId, String scope) {
        List<String> rows = jdbcTemplate.queryForList("""
                SELECT action FROM student_consents
                 WHERE student_user_id = ? AND scope = ?
                 ORDER BY effective_at DESC, id DESC
                 LIMIT 1
                """, String.class, studentUserId, scope);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String columnType(String table, String column) {
        return jdbcTemplate.queryForObject("""
                SELECT data_type FROM information_schema.columns
                 WHERE table_name = ? AND column_name = ?
                """, String.class, table, column);
    }

    private boolean tableExists(String table) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = ?", Long.class, table);
        return n != null && n == 1L;
    }

    private boolean constraintExists(String name) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conname = ? AND contype = 'c'", Long.class, name);
        return n != null && n == 1L;
    }

    private boolean indexExists(String name) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_indexes WHERE indexname = ?", Long.class, name);
        return n != null && n == 1L;
    }

    private String indexDefinition(String name) {
        return jdbcTemplate.queryForObject(
                "SELECT indexdef FROM pg_indexes WHERE indexname = ?", String.class, name);
    }
}
