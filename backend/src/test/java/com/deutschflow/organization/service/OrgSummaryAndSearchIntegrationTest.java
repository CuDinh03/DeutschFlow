package com.deutschflow.organization.service;

import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgSummaryDto;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PR-A3 (O-2): tổng hợp toàn trung tâm phải đếm ở MÁY CHỦ, và tìm lớp phải lọc ở máy chủ.
 *
 * <p>Trước đợt này bảng điều khiển tải trang đầu 50 lớp rồi cộng tay: trung tâm 60 lớp hiện "50" và
 * cảnh báo thiếu giáo viên chỉ soi được 50 lớp đầu — số sai mà không dấu hiệu nào cho biết là sai.
 * Ô tìm kiếm cũng chỉ lọc trên phần đã tải, nên gõ tên một lớp ở trang sau sẽ ra rỗng.
 *
 * <p>Dựng 60 lớp thật trên Postgres thật: đúng cỡ dữ liệu làm lộ lỗi, mà mock thì không.
 */
@SpringBootTest
@DisplayName("Tổng hợp toàn trung tâm + tìm lớp phía máy chủ (PR-A3)")
class OrgSummaryAndSearchIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private OrgService orgService;

    private static final String SLUG = "a3-it-org";
    private Long orgId;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM class_teachers WHERE class_id IN (SELECT id FROM teacher_classes WHERE org_id = ?)", orgId);
        jdbcTemplate.update("DELETE FROM teacher_classes WHERE org_id = ?", orgId);
        jdbcTemplate.update("DELETE FROM org_members WHERE org_id = ?", orgId);
        jdbcTemplate.update("DELETE FROM organizations WHERE id = ?", orgId);
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE 'a3-it-%'");
    }

    /**
     * 60 lớp: 57 lớp do một giáo viên ACTIVE của trung tâm dạy, 3 lớp do một giáo viên ĐÃ RỜI dạy.
     *
     * <p>Không thể dựng lớp với {@code teacher_id} rỗng — cột đó NOT NULL. Đó chính là lý do định
     * nghĩa "thiếu GV" phải là "không còn ai ACTIVE đứng lớp", không phải "cột rỗng".
     */
    private void seed() {
        orgId = jdbcTemplate.queryForObject("""
                INSERT INTO organizations (name, slug, plan_code, seat_limit, status, created_at, updated_at)
                VALUES ('A3 IT', ?, 'PRO', 0, 'ACTIVE', now(), now()) RETURNING id
                """, Long.class, SLUG + "-" + System.nanoTime());

        Long teacherId = newTeacher("gv");
        Long daRoiId = newTeacher("da-roi");
        // Chỉ giáo viên đang dạy là thành viên ACTIVE; người kia đã rời trung tâm (INACTIVE).
        jdbcTemplate.update("""
                INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                VALUES (?, ?, 'TEACHER', 'ACTIVE', now())
                """, orgId, teacherId);
        jdbcTemplate.update("""
                INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                VALUES (?, ?, 'TEACHER', 'INACTIVE', now())
                """, orgId, daRoiId);

        for (int i = 1; i <= 57; i++) {
            Long classId = jdbcTemplate.queryForObject("""
                    INSERT INTO teacher_classes (name, teacher_id, org_id, invite_code, created_at, updated_at)
                    VALUES (?, ?, ?, ?, now(), now()) RETURNING id
                    """, Long.class, "Lop co GV " + i, teacherId, orgId, "A3C" + i + "-" + System.nanoTime());
            jdbcTemplate.update(
                    "INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, 'PRIMARY')",
                    classId, teacherId);
        }
        for (int i = 1; i <= 3; i++) {
            Long classId = jdbcTemplate.queryForObject("""
                    INSERT INTO teacher_classes (name, teacher_id, org_id, invite_code, created_at, updated_at)
                    VALUES (?, ?, ?, ?, now(), now()) RETURNING id
                    """, Long.class, "Lop thieu GV " + i, daRoiId, orgId, "A3N" + i + "-" + System.nanoTime());
            jdbcTemplate.update(
                    "INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, 'PRIMARY')",
                    classId, daRoiId);
        }
    }

    private Long newTeacher(String tag) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO users (email, password_hash, display_name, role, created_at)
                VALUES (?, '$2a$10$h', 'A3 GV', 'TEACHER', now()) RETURNING id
                """, Long.class, "a3-it-" + tag + "-" + System.nanoTime() + "@test.com");
    }

    @Test
    @DisplayName("60 lớp: tổng hợp trả đúng 60 và 3 lớp thiếu giáo viên, không phải 50 của trang đầu")
    void tongHopDemToanTrungTam() {
        seed();

        OrgSummaryDto summary = orgService.getSummary(orgId);

        assertThat(summary.classCount()).as("phải đếm cả 60 lớp, không dừng ở trang đầu").isEqualTo(60);
        assertThat(summary.classesWithoutTeacher()).isEqualTo(3);
    }

    @Test
    @DisplayName("Gán một GV ACTIVE làm đồng giảng dạy thì lớp đó hết thiếu, dù chủ nhiệm đã rời")
    void ganDongGiangDayThiHetThieu() {
        seed();
        Long troGiang = newTeacher("tg");
        jdbcTemplate.update("""
                INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                VALUES (?, ?, 'TEACHER', 'ACTIVE', now())
                """, orgId, troGiang);
        Long lopThieu = jdbcTemplate.queryForObject(
                "SELECT id FROM teacher_classes WHERE org_id = ? AND name LIKE 'Lop thieu GV%' ORDER BY id LIMIT 1",
                Long.class, orgId);
        jdbcTemplate.update(
                "INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, 'ASSISTANT')",
                lopThieu, troGiang);

        // Còn 2: lớp vừa gán đã có người đứng, dù cột teacher_id vẫn trỏ người đã rời.
        assertThat(orgService.getSummary(orgId).classesWithoutTeacher()).isEqualTo(2);
    }

    @Test
    @DisplayName("Định nghĩa cũ (teacher_id rỗng) luôn ra 0 — cột đó NOT NULL, không lớp nào rỗng được")
    void dinhNghiaCuLuonRaKhong() {
        seed();

        Long theoDinhNghiaCu = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM teacher_classes WHERE org_id = ? AND teacher_id IS NULL",
                Long.class, orgId);

        // Ca này khoá lại LÝ DO đổi định nghĩa: nếu ai đó quay về `teacher_id IS NULL`, con số sẽ
        // là 0 mãi mãi trong khi trung tâm đang có 3 lớp thật sự không ai dạy.
        assertThat(theoDinhNghiaCu).isZero();
        assertThat(orgService.getSummary(orgId).classesWithoutTeacher()).isEqualTo(3);
    }

    @Test
    @DisplayName("Tìm theo tên chạy trên TOÀN bộ lớp, không chỉ trang đã tải")
    void timTheoTenChayToanBo() {
        seed();
        // "Lop co GV 57" nằm ngoài trang đầu 20 lớp — đúng ca mà bản lọc phía trình duyệt trả rỗng.
        Page<OrgClassDto> page = orgService.listClasses(orgId, PageRequest.of(0, 20), "co GV 57", false);

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).name()).isEqualTo("Lop co GV 57");
    }

    @Test
    @DisplayName("Tìm không phân biệt hoa thường")
    void timKhongPhanBietHoaThuong() {
        seed();

        assertThat(orgService.listClasses(orgId, PageRequest.of(0, 20), "LOP CO GV 12", false)
                .getTotalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("Lọc `withoutTeacher` trả đúng 3 lớp chưa ai dạy")
    void locLopThieuGiaoVien() {
        seed();

        Page<OrgClassDto> page = orgService.listClasses(orgId, PageRequest.of(0, 20), null, true);

        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getContent()).extracting(OrgClassDto::name)
                .allMatch(n -> n.startsWith("Lop thieu GV"));
    }

    @Test
    @DisplayName("Không lọc gì thì vẫn phân trang bình thường và tổng là 60")
    void khongLocThiGiuNguyenPhanTrang() {
        seed();

        Page<OrgClassDto> page = orgService.listClasses(orgId, PageRequest.of(0, 20), "  ", false);

        assertThat(page.getTotalElements()).isEqualTo(60);
        assertThat(page.getContent()).hasSize(20);
    }

    @Test
    @DisplayName("Tìm không trúng gì thì trả rỗng chứ không trả cả trung tâm")
    void timKhongTrungThiRong() {
        seed();

        assertThat(orgService.listClasses(orgId, PageRequest.of(0, 20), "khong-co-lop-nao-ten-nay", false)
                .getTotalElements()).isZero();
    }

    @Test
    @DisplayName("Trung tâm chưa có lớp nào: đếm về 0, không nổ")
    void trungTamRong() {
        orgId = jdbcTemplate.queryForObject("""
                INSERT INTO organizations (name, slug, plan_code, seat_limit, status, created_at, updated_at)
                VALUES ('A3 IT rong', ?, 'PRO', 0, 'ACTIVE', now(), now()) RETURNING id
                """, Long.class, SLUG + "-rong-" + System.nanoTime());

        OrgSummaryDto summary = orgService.getSummary(orgId);

        assertThat(List.of(summary.classCount(), summary.classesWithoutTeacher())).containsExactly(0L, 0L);
    }
}
