package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.OrgReadOnlyException;
import com.deutschflow.organization.service.OrgCurriculumAssignmentService;
import com.deutschflow.organization.service.OrgCurriculumService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgLicenseState;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gói 3 / D5 — cổng chỉ-đọc trên {@link OrgCurriculumController}.
 *
 * <p>Người soát đợt A chỉ đích danh chỗ này: cả handler ĐỌC lẫn handler GHI dùng CHUNG helper
 * {@code requireOrgAdmin(user)}, nên không thể gắn cổng vào helper mà không giết luôn đường đọc.
 * Cách chữa là helper thứ hai {@code requireOrgAdminForWrite}. Bảng này chốt đúng ranh giới đó:
 * đường SOẠN bị chặn, đường ĐỌC vẫn sống, đường DỌN DẸP không bị nhốt.
 *
 * <p>{@code OrgReadOnlyException} không mang {@code @ResponseStatus} nên standalone MockMvc để nó
 * nổi lên như một exception thật — vì vậy các ca chặn khẳng định bằng "ném ra đúng loại" +
 * "service KHÔNG chạy", chứ không đọc mã HTTP (mã 403 + {@code ORG_READ_ONLY} do
 * {@code GlobalExceptionHandler} dựng và đã có ca riêng ở đợt A).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OrgCurriculumController — cổng chỉ-đọc (D5)")
class OrgCurriculumControllerReadOnlyTest {

    private MockMvc mvc;

    @Mock private OrgGuard orgGuard;
    @Mock private OrgCurriculumService curriculumService;
    @Mock private OrgCurriculumAssignmentService assignmentService;

    @InjectMocks private OrgCurriculumController controller;

    private static final Long ORG_ID = 10L;

    private final User orgAdmin = User.builder()
            .id(1L).email("gd@trungtam.com").role(User.Role.TEACHER)
            .displayName("Giám đốc").passwordHash("hashed").orgId(ORG_ID)
            .build();

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, orgAdmin);
    }

    /**
     * Dựng một trung tâm CHỈ-ĐỌC.
     *
     * <p>{@code lenient()} có chủ ý: một nửa số ca ở đây khẳng định đường ĐỌC / đường DỌN DẸP
     * KHÔNG hề gọi tới cổng — đúng lúc đó Mockito nghiêm ngặt lại coi stub là thừa và đánh trượt
     * chính cái ca đang chứng minh điều ta muốn. Vẫn còn ràng buộc thật: nếu một đường lẽ ra phải
     * chặn mà không gọi cổng thì ca của nó đỏ vì không có exception nào ném ra.
     */
    private void orgIsReadOnly() {
        org.mockito.Mockito.lenient()
                .doThrow(new OrgReadOnlyException(ORG_ID, OrgLicenseState.Reason.EXPIRED))
                .when(orgGuard).assertOrgWritable(ORG_ID);
    }

    private static String createBody() {
        return "{\"name\":\"Giáo trình A1\",\"cefrLevel\":\"A1\"}";
    }

    // ── đường SOẠN: bốn POST người soát đợt A gọi tên ────────────────────────────────────────

    @Test
    @DisplayName("POST /curricula: trung tâm chỉ-đọc → chặn, service KHÔNG chạy")
    void createCurriculum_readOnlyOrg_blocked() {
        orgIsReadOnly();

        assertBlocked(() -> mvc.perform(post("/api/org/curricula")
                .contentType(MediaType.APPLICATION_JSON).content(createBody())));

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("POST /curricula/import: trung tâm chỉ-đọc → chặn, service KHÔNG chạy")
    void importCurriculum_readOnlyOrg_blocked() {
        orgIsReadOnly();

        assertBlocked(() -> mvc.perform(post("/api/org/curricula/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Giáo trình A1\",\"cefrLevel\":\"A1\",\"lektionen\":[]}")));

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("POST /curricula/sample: trung tâm chỉ-đọc → chặn, service KHÔNG chạy")
    void createSample_readOnlyOrg_blocked() {
        orgIsReadOnly();

        assertBlocked(() -> mvc.perform(post("/api/org/curricula/sample")));

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("POST /curricula/{id}/versions: trung tâm chỉ-đọc → chặn, service KHÔNG chạy")
    void createVersion_readOnlyOrg_blocked() {
        orgIsReadOnly();

        assertBlocked(() -> mvc.perform(post("/api/org/curricula/7/versions")
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"bản nháp\"}")));

        verifyNoInteractions(curriculumService);
    }

    // ── đường ĐỌC: KHÔNG được chạm cổng (D5 — trung tâm chỉ-đọc vẫn phải xem được) ───────────

    @Test
    @DisplayName("GET /curricula: đi qua assertOrgAdmin nhưng KHÔNG qua cổng trạng thái")
    void listCurricula_neverTouchesWriteGate() throws Exception {
        when(curriculumService.listForOrg(ORG_ID)).thenReturn(List.of());

        mvc.perform(get("/api/org/curricula")).andExpect(status().isOk());

        verify(orgGuard).assertOrgAdmin(1L, ORG_ID);
        verify(orgGuard, never()).assertOrgWritable(anyLong());
    }

    @Test
    @DisplayName("GET /curricula vẫn 200 NGAY CẢ khi trung tâm đang chỉ-đọc")
    void listCurricula_worksWhileReadOnly() throws Exception {
        orgIsReadOnly();   // cổng có ném — nhưng đường đọc không được gọi tới nó
        when(curriculumService.listForOrg(ORG_ID)).thenReturn(List.of());

        mvc.perform(get("/api/org/curricula")).andExpect(status().isOk());
    }

    // ── đường DỌN DẸP: cố ý KHÔNG gắn cổng (xem javadoc requireOrgAdminForWrite) ─────────────

    @Test
    @DisplayName("DELETE /curricula/{id}: trung tâm chỉ-đọc vẫn xoá được — không nhốt trung tâm với nội dung nó muốn dọn")
    void deleteCurriculum_readOnlyOrg_stillAllowed() throws Exception {
        orgIsReadOnly();

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/org/curricula/7"))
                .andExpect(status().isNoContent());

        verify(curriculumService).delete(ORG_ID, 7L);
    }

    /** Standalone MockMvc bọc exception của handler trong NestedServletException. */
    private void assertBlocked(ThrowingCall call) {
        Throwable thrown = org.assertj.core.api.Assertions.catchThrowable(call::run);
        org.assertj.core.api.Assertions.assertThat(thrown).isNotNull();
        Throwable root = thrown;
        while (root.getCause() != null) {
            root = root.getCause();
        }
        org.assertj.core.api.Assertions.assertThat(root).isInstanceOf(OrgReadOnlyException.class);
    }

    @FunctionalInterface
    private interface ThrowingCall {
        void run() throws Exception;
    }
}
