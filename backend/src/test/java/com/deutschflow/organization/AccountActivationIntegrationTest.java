package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.activation.AccountActivationService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vòng đời "nhập CSV → liên kết kích hoạt → đặt mật khẩu → đăng nhập" trên PostgreSQL thật
 * (Q-09, owner chốt 14/09/2026).
 *
 * <p><b>Lỗ mà bản này vá.</b> {@code OrgRosterRowImporter} tạo tài khoản với mật khẩu ngẫu nhiên mà
 * KHÔNG ai biết, và tài khoản đó không nhận một email nào. Với lớp pilot 20 em, ngày đầu là 20 lần
 * hướng dẫn thao tác "Quên mật khẩu".
 *
 * <p><b>Ca chốt</b> ({@link Lifecycle#csvImport_thenActivate_thenLogin}) đi trọn con đường mà một em
 * học sinh sẽ đi: trung tâm nhập CSV → hệ thống phát liên kết → em đặt mật khẩu → em ĐĂNG NHẬP ĐƯỢC
 * bằng chính mật khẩu đó. Chỉ DB thật chứng minh được, vì mật khẩu được ghi bằng SQL thẳng và bước
 * đăng nhập đọc lại từ bảng.
 *
 * <p>🪤 Không {@code @Transactional} trên lớp: {@code importRow} chạy {@code REQUIRES_NEW} từng dòng
 * và token phải COMMIT thật thì bước kích hoạt sau mới thấy. Tự bỏ qua khi không có Postgres — xem
 * {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Kích hoạt tài khoản do trung tâm tạo từ CSV — Integration (Q-09)")
class AccountActivationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String IMPORT_PATH = "/api/org/students/import";
    private static final String ACTIVATE_PATH = "/api/auth/activate";
    private static final String NEW_PASSWORD = "MatKhauMoi123!";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AccountActivationService activationService;

    // ── 1. Ca chốt: đi trọn con đường của một học viên pilot ─────────────────

    @Nested
    @DisplayName("Vòng đời đầy đủ")
    class Lifecycle {

        @Test
        @DisplayName("🔴 Nhập CSV ⇒ có liên kết kích hoạt; đặt mật khẩu qua liên kết ⇒ ĐĂNG NHẬP ĐƯỢC")
        void csvImport_thenActivate_thenLogin() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "hocvien-" + UUID.randomUUID() + "@test.local";

            importCsv(owner, "email,displayName\n" + email + ",Em Bảy")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.created").value(1));

            Long studentId = userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
            String tokenHash = singleLiveTokenHashOf(studentId);
            assertThat(tokenHash)
                    .as("một dòng CSV tạo mới phải để lại đúng một liên kết sống")
                    .isNotNull().hasSize(64);

            // Token THÔ không nằm trong cơ sở dữ liệu — ta chỉ có hash. Để đi tiếp vòng đời, phát
            // lại một liên kết qua chính service (đúng thứ mailer nhận được) rồi dùng bản thô ấy.
            String rawToken = activationService.issue(studentId, org.getId());

            mockMvc.perform(get(ACTIVATE_PATH).param("token", rawToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.state").value("VALID"))
                    .andExpect(jsonPath("$.maskedEmail", containsString("***")))
                    .andExpect(jsonPath("$.orgName").value(org.getName()));

            activate(rawToken, NEW_PASSWORD).andExpect(status().isNoContent());

            String storedHash = jdbcTemplate.queryForObject(
                    "SELECT password_hash FROM users WHERE id = ?", String.class, studentId);
            assertThat(passwordEncoder.matches(NEW_PASSWORD, storedHash))
                    .as("mật khẩu em vừa đặt phải là mật khẩu đăng nhập được")
                    .isTrue();

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    Map.of("email", email, "password", NEW_PASSWORD))))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("Liên kết dùng MỘT lần: lượt thứ hai bị từ chối, mật khẩu không đổi lần nữa")
        void linkIsSingleUse() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "hocvien-" + UUID.randomUUID() + "@test.local";
            importCsv(owner, "email,displayName\n" + email + ",Em Tám").andExpect(status().isOk());

            Long studentId = userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
            String rawToken = activationService.issue(studentId, org.getId());

            activate(rawToken, NEW_PASSWORD).andExpect(status().isNoContent());
            activate(rawToken, "MotMatKhauKhac456!").andExpect(status().isBadRequest());

            String storedHash = jdbcTemplate.queryForObject(
                    "SELECT password_hash FROM users WHERE id = ?", String.class, studentId);
            assertThat(passwordEncoder.matches(NEW_PASSWORD, storedHash)).isTrue();
            assertThat(passwordEncoder.matches("MotMatKhauKhac456!", storedHash)).isFalse();

            mockMvc.perform(get(ACTIVATE_PATH).param("token", rawToken))
                    .andExpect(jsonPath("$.state").value("USED"))
                    .andExpect(jsonPath("$.maskedEmail").value(""));
        }

        @Test
        @DisplayName("Phát liên kết mới ⇒ liên kết CŨ chết ngay (thu hồi có nghĩa lý)")
        void issuingANewLinkKillsTheOldOne() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "hocvien-" + UUID.randomUUID() + "@test.local";
            importCsv(owner, "email,displayName\n" + email + ",Em Chín").andExpect(status().isOk());

            Long studentId = userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
            String first = activationService.issue(studentId, org.getId());
            String second = activationService.issue(studentId, org.getId());

            activate(first, NEW_PASSWORD).andExpect(status().isBadRequest());
            activate(second, NEW_PASSWORD).andExpect(status().isNoContent());
        }
    }

    // ── 2. Ai được phát liên kết (D6) ────────────────────────────────────────

    @Nested
    @DisplayName("Ai được phát liên kết")
    class WhoGetsOne {

        @Test
        @DisplayName("🔴 Nhập LẠI cùng tệp CSV ⇒ KHÔNG phát thêm liên kết nào (không gửi mail đôi)")
        void reimportDoesNotIssueASecondLink() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            String email = "hocvien-" + UUID.randomUUID() + "@test.local";
            String csv = "email,displayName\n" + email + ",Em Mười";

            importCsv(owner, csv).andExpect(status().isOk()).andExpect(jsonPath("$.created").value(1));
            Long studentId = userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
            assertThat(countTokens(studentId)).isEqualTo(1);

            importCsv(owner, csv).andExpect(status().isOk())
                    .andExpect(jsonPath("$.created").value(0))
                    .andExpect(jsonPath("$.linked").value(1));

            assertThat(countTokens(studentId))
                    .as("lần nhập thứ hai chỉ LIÊN KẾT tài khoản đã có — không có tài khoản nào để kích hoạt")
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("Email đã có tài khoản từ trước ⇒ chỉ liên kết, KHÔNG phát liên kết kích hoạt")
        void existingAccountGetsNoLink() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);
            User existing = userRepository.save(User.builder()
                    .email("cu-" + UUID.randomUUID() + "@test.local")
                    .passwordHash(passwordEncoder.encode("MatKhauCuaRieng1!"))
                    .displayName("Người dùng cũ")
                    .role(User.Role.STUDENT)
                    .build());

            importCsv(owner, "email,displayName\n" + existing.getEmail() + ",Người dùng cũ")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.linked").value(1));

            assertThat(countTokens(existing.getId()))
                    .as("người đã có mật khẩu của riêng mình không nhận lời mời đặt lại")
                    .isZero();
        }

        @Test
        @DisplayName("Dòng bị từ chối vì hết ghế ⇒ không tài khoản, không liên kết")
        void seatLimitedRowLeavesNothing() throws Exception {
            Organization org = org(0);   // seatLimit = 0 sau khi hạ xuống bên dưới
            User owner = member(org, "OWNER", User.Role.OWNER);
            // OWNER đã chiếm một ghế? Không — ghế đếm theo vai STUDENT. Hạ trần về đúng 0 chỗ trống.
            jdbcTemplate.update("UPDATE organizations SET seat_limit = 1 WHERE id = ?", org.getId());
            String taken = "day-" + UUID.randomUUID() + "@test.local";
            importCsv(owner, "email,displayName\n" + taken + ",Em Đầy").andExpect(status().isOk());

            String rejected = "het-ghe-" + UUID.randomUUID() + "@test.local";
            importCsv(owner, "email,displayName\n" + rejected + ",Em Hụt")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.created").value(0));

            assertThat(userRepository.findByEmailIgnoreCase(rejected))
                    .as("D6: dòng bị từ chối không để lại tài khoản nào")
                    .isEmpty();
        }
    }

    // ── 3. Cổng của endpoint công khai ───────────────────────────────────────

    @Nested
    @DisplayName("Endpoint công khai")
    class PublicEndpoint {

        @Test
        @DisplayName("Token lạ ⇒ 200 UNKNOWN (không phải 4xx: đây là màn mở từ email)")
        void unknownTokenPreviewsAsUnknown() throws Exception {
            mockMvc.perform(get(ACTIVATE_PATH).param("token", "khong-ton-tai"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.state").value("UNKNOWN"))
                    .andExpect(jsonPath("$.maskedEmail").value(""));
        }

        /**
         * 🔴 Ca này khoá lại một lỗi ĐÃ XẢY RA trong lúc làm: hạn mức khoá theo chuỗi cố định
         * ({@code "activate"}) thay vì theo token. Cả một lớp pilot ngồi cùng WiFi của trung tâm là
         * cùng MỘT địa chỉ IP công cộng, nên 20 em phải chia nhau 5 lượt/15 phút — em thứ ba bấm
         * liên kết của mình đã nhận 429. Đúng ngày khai giảng.
         */
        @Test
        @DisplayName("🔴 Nhiều học viên CÙNG một IP ⇒ mỗi liên kết có hạn mức riêng, không ai chặn ai")
        void manyStudentsBehindOneIpDoNotStarveEachOther() throws Exception {
            Organization org = org();
            User owner = member(org, "OWNER", User.Role.OWNER);

            // Sáu lượt kích hoạt liên tiếp — quá trần 5 lượt/15 phút của MỘT khoá. Nếu hạn mức khoá
            // theo IP hay theo chuỗi cố định thì em cuối nhận 429.
            for (int i = 0; i < 6; i++) {
                String email = "lop-" + UUID.randomUUID() + "@test.local";
                importCsv(owner, "email,displayName\n" + email + ",Em " + i).andExpect(status().isOk());
                Long id = userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
                String token = activationService.issue(id, org.getId());

                mockMvc.perform(get(ACTIVATE_PATH).param("token", token))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.state").value("VALID"));
                activate(token, NEW_PASSWORD).andExpect(status().isNoContent());
            }
        }

        @Test
        @DisplayName("Token lạ khi ĐẶT mật khẩu ⇒ 400, và mật khẩu yếu cũng bị chặn")
        void badRequestsAreRejected() throws Exception {
            activate("khong-ton-tai", NEW_PASSWORD).andExpect(status().isBadRequest());
            activate("khong-ton-tai", "123").andExpect(status().isBadRequest());
            mockMvc.perform(post(ACTIVATE_PATH).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private ResultActions importCsv(User actor, String csv) throws Exception {
        return mockMvc.perform(multipart(IMPORT_PATH)
                .file(new MockMultipartFile("file", "hoc-vien.csv", "text/csv",
                        csv.getBytes(StandardCharsets.UTF_8)))
                .with(user(actor)));
    }

    private ResultActions activate(String token, String password) throws Exception {
        return mockMvc.perform(post(ACTIVATE_PATH)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        Map.of("token", token, "newPassword", password))));
    }

    private Integer countTokens(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM account_activation_tokens WHERE user_id = ?", Integer.class, userId);
    }

    private String singleLiveTokenHashOf(Long userId) {
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT token_hash FROM account_activation_tokens WHERE user_id = ? AND used_at IS NULL",
                String.class, userId);
        return rows.size() == 1 ? rows.get(0) : null;
    }

    private Organization org() {
        return org(50);
    }

    private Organization org(int seatLimit) {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("activation-" + UUID.randomUUID())
                .seatLimit(seatLimit)
                .status("ACTIVE")
                .build());
    }

    private User member(Organization org, String orgRole, User.Role platformRole) {
        User u = userRepository.save(User.builder()
                .email("activation-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Activation " + orgRole)
                .role(platformRole)
                .orgId(org.getId())
                .build());

        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }
}
