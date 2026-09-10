package com.deutschflow.organization;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>AC-ORG-CT-02</b> (DEC-13, owner chốt 09/09/2026) — <i>"admin nền tảng giữ quyền kỹ thuật,
 * nhưng MỌI thao tác chạm dữ liệu một trung tâm phải ghi vết mà chính giám đốc trung tâm đó đọc
 * được"</i>, kiểm qua đúng chuỗi thật: Spring Security filter chain → controller admin → Postgres →
 * {@code GET /api/org/audit-logs} của giám đốc.
 *
 * <blockquote>
 * Given admin đổi mật khẩu một OWNER, rồi đọc dữ liệu của trung tâm đó,<br>
 * Then CẢ HAI thao tác hiện trong {@code GET /api/org/audit-logs} của chính trung tâm đó.
 * </blockquote>
 *
 * <p><b>Vì sao AC này phải là một ca tích hợp, không tách được thành hai unit test.</b> Hai nửa của
 * nó hỏng theo hai cách khác hẳn nhau, và chỉ khi ghép lại mới thành một câu nói được:
 * <ul>
 *   <li>nửa GHI ({@code PATCH /api/admin/users/{id}/password}) hỏng ở chỗ {@code org_id}: admin nền
 *       tảng không bao giờ là thành viên trung tâm ⇒ {@code users.org_id} NULL ⇒ trước PR-0B mọi vết
 *       admin rơi vào vùng NULL mà đường đọc của giám đốc lọc {@code AND org_id = ?} nên loại sạch;</li>
 *   <li>nửa ĐỌC hỏng ở chỗ <b>không có vết nào cả</b> — quy ước cũ của repo là "mọi mutation ghi, mọi
 *       đường đọc câm". Với admin, đọc CHÍNH LÀ thao tác nguy hiểm: xem danh sách thành viên là xem
 *       PII của người khác, và nó không để lại dấu vết gì.</li>
 * </ul>
 *
 * <p><b>Ba assert cách ly / đối chứng, không phải trang trí.</b> Một ca chỉ khẳng định "thấy hai
 * vết" vẫn xanh khi sổ trung tâm biến thành sổ toàn nền tảng (ai cũng thấy mọi thứ) — nên phải có
 * {@link #otherOrgOwner_seesNeitherTrace()} (giám đốc B không thấy gì) và
 * {@link #platformOnlyAdminAction_staysOutOfOrgLedger()} (thao tác admin không chạm trung tâm nào
 * thì không lọt vào sổ của A, và ngay sau đó cùng lời gọi trên người CỦA A thì lọt — đối chứng
 * dương nằm trong cùng một ca để không thể xanh vì truy vấn hỏng).
 *
 * <p><b>{@link #trace_carriesIdentifiersOnly_neverContent()} là chốt chống hồi quy.</b> Vết này
 * giám đốc trung tâm đọc được, và mọi admin nền tảng cũng đọc được qua màn audit — chép nội dung
 * vào {@code metadata_json} là mở thêm một cửa rò rỉ, đúng cửa mà việc ghi vết sinh ra để đóng.
 *
 * <p>🪤 <b>Ghi vết cho đường đọc nằm ở CONTROLLER, không ở service</b> — các service đọc là
 * {@code @Transactional(readOnly = true)} còn {@code AuditLogService} dùng chung connection qua
 * {@code DataSourceUtils}, nên một INSERT ở đó ném <i>"cannot execute INSERT in a read-only
 * transaction"</i>. {@code AuditActor} nêu quy ước NGƯỢC LẠI ("ghi audit ở controller thì vết nằm
 * NGOÀI transaction nghiệp vụ"), nên người sau rất dễ "sửa cho đúng chuẩn" rồi làm vỡ endpoint —
 * ca này sẽ đỏ ngay nếu điều đó xảy ra.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("AC-ORG-CT-02: admin ghi VÀ đọc dữ liệu trung tâm — giám đốc đọc được cả hai (DEC-13)")
class AdminReadAuditIntegrationTest extends AbstractPostgresIntegrationTest {

    /** Sổ hoạt động của giám đốc — orgId lấy từ NGƯỜI GỌI, không nhận qua tham số. */
    private static final String ORG_LEDGER = "/api/org/audit-logs";

    /** Vết của nửa GHI, đã có từ PR-0B ({@code AdminManagementController.setUserPassword}). */
    private static final String PASSWORD_RESET_EVENT = "admin.user.password.reset";

    /**
     * Lệ đặt tên của repo: {@code admin.<đối tượng>.<hành động>}, hành động đọc mang hậu tố
     * {@code .read} hoặc {@code .exported}.
     *
     * <p>Cố ý khớp theo KHUÔN chứ không ghim một chuỗi cứng: AC nói "đọc dữ liệu của trung tâm đó",
     * còn việc console admin gọi đường nào (danh sách thành viên hay chi tiết trung tâm) là quyết
     * định của lớp thi công. Ghim cứng một tên sẽ biến ca nghiệm thu thành ca kiểm chính tả, và sẽ
     * đỏ vì một lần đổi tên vô hại trong khi hành vi vẫn đúng.
     */
    private static final Pattern READ_EVENT = Pattern.compile("^admin\\.[a-z0-9_]+(\\.[a-z0-9_]+)*\\.(read|exported)$");

    /**
     * Những gì TUYỆT ĐỐI không được có trong {@code metadata_json}. Đây là danh sách đen theo dấu
     * hiệu chứ không theo tên trường: một vết chép nội dung sẽ lộ ra qua chính nội dung đó
     * ({@code https://} của URL presigned, {@code X-Amz-Signature} của chữ ký S3, các khoá quen
     * thuộc của transcript) dù người viết đặt tên trường là gì.
     */
    private static final List<String> FORBIDDEN_IN_METADATA = List.of(
            "https://", "http://", "X-Amz-Signature", "X-Amz-Credential", "presign",
            "transcript", "audioUrl", "password", "passwordHash", "wrongSpan", "correctedSpan");

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository teacherClassRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Organization orgA;
    private Organization orgB;
    private User ownerA;
    private User ownerB;
    private User admin;

    @BeforeEach
    void seedTwoCentresAndPlatformAdmin() {
        orgA = newOrg("ct02-a");
        orgB = newOrg("ct02-b");
        ownerA = member(orgA, "OWNER");
        ownerB = member(orgB, "OWNER");
        admin = account(User.Role.ADMIN);

        // Trung tâm A có dữ liệu thật để đọc — một lớp và một giáo viên. Không có nó, "đọc dữ liệu
        // của trung tâm A" là đọc một trung tâm rỗng và ca mất hết ý nghĩa.
        User teacherA = member(orgA, "TEACHER");
        teacherClassRepo.save(TeacherClass.builder()
                .teacherId(teacherA.getId())
                .orgId(orgA.getId())
                .name("Lớp A1 " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("CT02-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());

        // Cảnh đã dựng đúng: DEC-13 nói admin nền tảng KHÔNG thuộc trung tâm nào.
        assertThat(admin.getOrgId()).isNull();
        assertThat(classCount(orgA)).isPositive();
    }

    @Test
    @DisplayName("Admin đổi mật khẩu OWNER rồi đọc dữ liệu trung tâm A ⇒ giám đốc A thấy CẢ HAI vết")
    void passwordResetThenOrgRead_bothAppearInThatOrgLedger() throws Exception {
        resetPassword(ownerA).andExpect(status().isOk());
        adminReadsOrganizationA();

        List<Map<String, Object>> ledger = ledgerOf(ownerA);

        // Nửa GHI: đúng MỘT vết, đúng tên, đúng người bị đổi, đúng trung tâm.
        Map<String, Object> writeTrace = exactlyOne(ledger, t -> PASSWORD_RESET_EVENT.equals(t.get("eventName")));
        assertThat(writeTrace.get("targetId")).isEqualTo(String.valueOf(ownerA.getId()));
        assertThat(num(writeTrace.get("actorUserId"))).isEqualTo(admin.getId());
        assertThat(num(writeTrace.get("orgId"))).isEqualTo(orgA.getId());

        // Nửa ĐỌC: đây là thứ PR-0C sinh ra. Trước nó, danh sách dưới đây rỗng và giám đốc không bao
        // giờ biết admin đã mở dữ liệu trung tâm mình ra xem.
        //
        // "ít nhất một" chứ không phải "đúng một": console mở một trung tâm bằng nhiều lời gọi đọc,
        // và số lời gọi là chuyện của lớp thi công. Điều AC đòi là KHÔNG CÒN im lặng.
        Map<String, Object> readTrace = firstMatching(ledger, this::isAdminReadTrace);
        assertThat(readTrace.get("actorEmail")).isEqualTo(admin.getEmail());
        assertThat(num(readTrace.get("orgId"))).isEqualTo(orgA.getId());
        assertThat((String) readTrace.get("targetId")).isNotBlank();
    }

    @Test
    @DisplayName("Cách ly: giám đốc trung tâm B mở cùng endpoint và KHÔNG thấy vết nào trong hai vết đó")
    void otherOrgOwner_seesNeitherTrace() throws Exception {
        resetPassword(ownerA).andExpect(status().isOk());
        adminReadsOrganizationA();

        // Đối chứng dương trước: sổ của A CÓ vết — nếu không, ca "B không thấy gì" xanh một cách rỗng.
        assertThat(tracesByAdmin(ownerA)).hasSizeGreaterThanOrEqualTo(2);

        // Giám đốc B đoán đúng cả tên sự kiện lẫn email admin vẫn không moi được gì: orgId lấy từ
        // người gọi, không nhận qua tham số, nên không có đường nào để hỏi sổ của trung tâm khác.
        assertThat(tracesByAdmin(ownerB)).isEmpty();
        assertThat(eventNames(ledgerOf(ownerB))).doesNotContain(PASSWORD_RESET_EVENT);
        assertThat(ledgerOf(ownerB).stream().noneMatch(this::isAdminReadTrace)).isTrue();
    }

    @Test
    @DisplayName("Vết mang ĐỊNH DANH và SỐ LƯỢNG — không mật khẩu, không transcript, không URL presigned")
    void trace_carriesIdentifiersOnly_neverContent() throws Exception {
        // Mật khẩu có dấu vân tay riêng để một lần LIKE trên toàn bảng là kết luận được — nếu nó lọt
        // vào bất kỳ cột nào, chuỗi này sẽ tìm thấy.
        String rawPassword = "PwCT02-" + UUID.randomUUID();

        resetPassword(ownerA, rawPassword).andExpect(status().isOk());
        adminReadsOrganizationA();

        List<Map<String, Object>> traces = tracesByAdmin(ownerA);
        // Đối chứng dương: có vết THẬT để soi. Thiếu dòng này, mọi assert phủ định dưới đây xanh
        // trên một danh sách rỗng.
        assertThat(traces).hasSizeGreaterThanOrEqualTo(2);

        for (Map<String, Object> trace : traces) {
            String metadata = String.valueOf(trace.get("metadataJson"));
            assertThat(metadata)
                    .as("metadata_json của vết %s", trace.get("eventName"))
                    .doesNotContain(rawPassword)
                    .doesNotContainIgnoringCase(FORBIDDEN_IN_METADATA.toArray(new String[0]));
        }

        // Và không chỉ trong sổ của A: mật khẩu thô không được nằm ở BẤT KỲ đâu trong audit_logs.
        // Đường đọc của giám đốc chỉ trả về cột metadata_json, nên một lần rò sang cột khác
        // (target_id chẳng hạn) sẽ vô hình với vòng lặp ở trên.
        assertThat(rowsContainingAnywhere(rawPassword)).isZero();
        // Mật khẩu ĐÃ đổi thật — nếu không, ca này chỉ chứng minh "chuỗi chưa từng tồn tại".
        assertThat(reload(ownerA).getPasswordHash()).isNotEqualTo(ownerA.getPasswordHash());
    }

    @Test
    @DisplayName("Đối chứng: thao tác admin thuần nền tảng (không chạm trung tâm nào) KHÔNG lọt vào sổ của A")
    void platformOnlyAdminAction_staysOutOfOrgLedger() throws Exception {
        User b2cLearner = account(User.Role.STUDENT); // không thuộc trung tâm nào
        assertThat(b2cLearner.getOrgId()).isNull();

        resetPassword(b2cLearner).andExpect(status().isOk());

        // Sổ của A im lặng: vết vừa ghi mang org_id NULL, không phải của trung tâm nào.
        assertThat(tracesByAdmin(ownerA)).isEmpty();

        // Đối chứng dương TRONG CÙNG một ca: đúng lời gọi đó trên người CỦA trung tâm A thì lọt.
        // Nhờ vậy ca trên không thể xanh vì truy vấn sổ hỏng hay vì cảnh dựng sai.
        resetPassword(ownerA).andExpect(status().isOk());
        List<Map<String, Object>> traces = tracesByAdmin(ownerA);
        assertThat(traces).hasSize(1);
        assertThat(traces.get(0).get("targetId")).isEqualTo(String.valueOf(ownerA.getId()));

        // Vết của người B2C vẫn tồn tại trên sổ toàn nền tảng — org chỉ là bộ LỌC, không phải bộ XOÁ.
        assertThat(platformTracesFor(b2cLearner)).isEqualTo(1L);
    }

    // ── thao tác của admin ──────────────────────────────────────────────────

    /** Nửa GHI của AC: đúng lời gọi HTTP mà console admin bắn khi bấm "Đặt lại mật khẩu". */
    private ResultActions resetPassword(User target) throws Exception {
        return resetPassword(target, "PwCT02-" + UUID.randomUUID());
    }

    private ResultActions resetPassword(User target, String rawPassword) throws Exception {
        return mockMvc.perform(patch("/api/admin/users/{userId}/password", target.getId())
                .with(user(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("password", rawPassword))));
    }

    /**
     * Nửa ĐỌC của AC — admin mở dữ liệu của TRUNG TÂM A trong console.
     *
     * <p>Bắn cả hai đường org-scoped của console ({@code GET /{id}} và {@code GET /{id}/members}) vì
     * AC nói "đọc dữ liệu của trung tâm đó" chứ không chỉ định endpoint, và màn console thật gọi cả
     * hai khi mở một trung tâm.
     *
     * <p>🪤 <b>Vì sao KHÔNG dùng {@code GET /api/admin/classes}</b>, dù AC-ORG-CT-02 nói "đọc danh
     * sách lớp": endpoint đó liệt kê lớp của TOÀN hệ thống và không nhận orgId, nên nó không đọc dữ
     * liệu của một trung tâm — nó đọc dữ liệu của mọi trung tâm cùng lúc. Nó có ghi vết (một dòng
     * cho mỗi trung tâm có lớp), nhưng lái ca này qua đó sẽ làm hỏng chính assert cách ly: một vết
     * xuất hiện trong sổ của trung tâm B khi đó là ĐÚNG (lớp của B thật sự đã bị đọc), nên
     * {@link #otherOrgOwner_seesNeitherTrace()} sẽ không còn phân biệt được "cách ly hoạt động" với
     * "cách ly đã vỡ". Đường org-scoped chạm đúng một trung tâm mới nói được câu đó.
     */
    private void adminReadsOrganizationA() throws Exception {
        mockMvc.perform(get("/api/admin/organizations/{id}", orgA.getId()).with(user(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/organizations/{id}/members", orgA.getId()).with(user(admin)))
                .andExpect(status().isOk());
    }

    // ── đọc sổ của giám đốc ─────────────────────────────────────────────────

    /** Giám đốc mở sổ trung tâm mình — đúng endpoint mà AC nêu tên. */
    private List<Map<String, Object>> ledgerOf(User owner) throws Exception {
        String body = mockMvc.perform(get(ORG_LEDGER).with(user(owner)).param("size", "100"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> page = objectMapper.readValue(body, new TypeReference<>() {});
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
        return items;
    }

    /** Những vết trong sổ của {@code owner} do CHÍNH admin nền tảng này tạo ra. */
    private List<Map<String, Object>> tracesByAdmin(User owner) throws Exception {
        return ledgerOf(owner).stream()
                .filter(t -> admin.getEmail().equals(t.get("actorEmail")))
                .toList();
    }

    private boolean isAdminReadTrace(Map<String, Object> trace) {
        return admin.getEmail().equals(trace.get("actorEmail"))
                && trace.get("eventName") instanceof String name
                && READ_EVENT.matcher(name).matches();
    }

    private List<String> eventNames(List<Map<String, Object>> ledger) {
        return ledger.stream().map(t -> String.valueOf(t.get("eventName"))).toList();
    }

    /** Đúng MỘT vết khớp; thông báo lỗi liệt kê những gì thật sự có để chẩn đoán không phải đoán. */
    private Map<String, Object> exactlyOne(List<Map<String, Object>> ledger,
                                           Predicate<Map<String, Object>> match) {
        List<Map<String, Object>> hits = ledger.stream().filter(match).toList();
        assertThat(hits)
                .as("sổ của trung tâm đang có các vết: %s", eventNames(ledger))
                .hasSize(1);
        return hits.get(0);
    }

    /** Ít nhất một vết khớp, trả vết đầu tiên — cùng lối chẩn đoán như trên. */
    private Map<String, Object> firstMatching(List<Map<String, Object>> ledger,
                                              Predicate<Map<String, Object>> match) {
        List<Map<String, Object>> hits = ledger.stream().filter(match).toList();
        assertThat(hits)
                .as("sổ của trung tâm đang có các vết: %s", eventNames(ledger))
                .isNotEmpty();
        return hits.get(0);
    }

    /**
     * Số trong JSON về tay Jackson là {@code Integer} hay {@code Long} tuỳ độ lớn — so thẳng với
     * {@code Long} của entity sẽ đỏ một cách khó hiểu. Quy về {@code Long} một lần ở đây.
     */
    private static Long num(Object jsonNumber) {
        return jsonNumber == null ? null : ((Number) jsonNumber).longValue();
    }

    // ── truy vấn thẳng DB (những thứ đường đọc không trả về) ─────────────────

    private Long rowsContainingAnywhere(String needle) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE COALESCE(CAST(metadata_json AS text), '') LIKE ?
                    OR COALESCE(target_id, '') LIKE ?
                    OR event_name LIKE ?
                """, Long.class, "%" + needle + "%", "%" + needle + "%", "%" + needle + "%");
    }

    private Long platformTracesFor(User target) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE target_type = 'USER' AND target_id = ? AND actor_user_id = ?",
                Long.class, String.valueOf(target.getId()), admin.getId());
    }

    private Long classCount(Organization org) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM teacher_classes WHERE org_id = ?", Long.class, org.getId());
    }

    // ── dựng cảnh ───────────────────────────────────────────────────────────

    private Organization newOrg(String slugPrefix) {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug(slugPrefix + "-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("ct02-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("CT02 " + role.name())
                .role(role)
                .build());
    }

    /** Thành viên ACTIVE của trung tâm với vai org đã cho ({@code org_members.role}). */
    private User member(Organization org, String orgRole) {
        User u = account(User.Role.TEACHER);
        u.setOrgId(org.getId());
        u = userRepository.save(u);

        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    private User reload(User u) {
        return userRepository.findById(u.getId()).orElseThrow();
    }
}
