package com.deutschflow.notification;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.notification.dto.NotificationItemResponse;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.notification.service.NotificationOutboxService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgRosterService;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.PeriodDto;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.teacher.service.TeacherTimesheetService;
import com.deutschflow.teacher.service.TimesheetPeriodService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * DEC-18 (10/09/2026) trên PostgreSQL thật: ba thông báo nội bộ trung tâm đi qua
 * {@code notification_outbox} — duyệt / trả kỳ công cho giáo viên, phân lớp qua roster CSV (và
 * đường giáo viên thêm bằng email) cho học viên. Từ chối đề xuất đổi lịch nằm trong
 * {@code ScheduleChangeRequestIntegrationTest} (AC22) vì cần fixture giáo trình của nó.
 */
@SpringBootTest
@DisplayName("Org internal notifications Integration Tests (DEC-18: outbox cho kỳ công, phân lớp)")
class OrgInternalNotificationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private TimesheetPeriodService periodService;
    @Autowired private OrgRosterService rosterService;
    @Autowired private TeacherService teacherService;
    @Autowired private NotificationOutboxRepository outboxRepo;
    @Autowired private NotificationOutboxService outboxService;
    @Autowired private UserNotificationService userNotificationService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    // ── Kỳ công ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Trả lại rồi duyệt kỳ công → hai dòng outbox đúng loại cho giáo viên chủ kỳ, dedup_key khác nhau, worker gửi không đôi")
    void timesheetReturnedThenApproved_enqueuesForTeacher() {
        Fixture f = fixture();
        LocalDate end = TeacherTimesheetService.todayVn().minusDays(1);
        LocalDate start = end.minusDays(30);
        PeriodDto period = periodService.openPeriod(f.teacher.getId(), start, end);
        periodService.submit(actor(f.teacher), period.id());

        periodService.reject(actor(f.owner), f.org.getId(), period.id(), "Thiếu buổi 12/08");

        List<NotificationOutbox> afterReject = outboxOf(f.teacher.getId());
        assertThat(afterReject).hasSize(1);
        NotificationOutbox returned = afterReject.get(0);
        assertThat(returned.getNotificationType()).isEqualTo(NotificationType.TIMESHEET_PERIOD_RETURNED);
        assertThat(returned.getPayload())
                .containsEntry("periodId", period.id().intValue())
                .containsEntry("periodStart", start.toString())
                .containsEntry("periodEnd", end.toString())
                .containsEntry("reason", "Thiếu buổi 12/08");
        assertThat(returned.getDedupKey()).startsWith("timesheet:" + period.id() + ":REJECTED:s");

        // Giáo viên nộp lại (mốc nộp mới) → duyệt.
        periodService.submit(actor(f.teacher), period.id());
        periodService.approve(actor(f.owner), f.org.getId(), period.id());

        List<NotificationOutbox> afterApprove = outboxOf(f.teacher.getId());
        assertThat(afterApprove).hasSize(2);
        NotificationOutbox approved = afterApprove.stream()
                .filter(o -> o.getNotificationType() == NotificationType.TIMESHEET_PERIOD_APPROVED)
                .findFirst().orElseThrow();
        assertThat(approved.getDedupKey()).startsWith("timesheet:" + period.id() + ":APPROVED:s");
        assertThat(approved.getDedupKey()).isNotEqualTo(returned.getDedupKey());
        assertThat(approved.getPayload()).containsEntry("totalSessions", 0).doesNotContainKey("reason");

        // UNIQUE dedup_key: ghi lại cùng sự kiện là lỗi ràng buộc, không phải dòng thứ hai.
        assertThatThrownBy(() -> outboxRepo.saveAndFlush(NotificationOutbox.builder()
                .dedupKey(approved.getDedupKey())
                .notificationType(NotificationType.TIMESHEET_PERIOD_APPROVED)
                .recipientId(f.teacher.getId())
                .payload(approved.getPayload()).build()))
                .isInstanceOf(DataIntegrityViolationException.class);

        // Worker gửi cả hai; chạy lại không gửi đôi; nội dung render tiếng Việt, không emoji.
        outboxService.deliver(returned.getId());
        outboxService.deliver(approved.getId());
        outboxService.deliver(approved.getId());
        assertThat(countNotifications(f.teacher.getId())).isEqualTo(2);
        List<NotificationItemResponse> items =
                userNotificationService.listForRecipient(f.teacher.getId(), 0, 10, null).items();
        assertThat(items).extracting(NotificationItemResponse::type)
                .containsExactlyInAnyOrder(NotificationType.TIMESHEET_PERIOD_APPROVED,
                        NotificationType.TIMESHEET_PERIOD_RETURNED);
        assertThat(items).extracting(NotificationItemResponse::title)
                .containsExactlyInAnyOrder("Kỳ công đã được duyệt", "Kỳ công bị trả lại");
        assertThat(items).allSatisfy(i -> assertThat(i.body()).contains("Kỳ công "));
        // Chủ trung tâm (người duyệt) không tự nhận thông báo của mình.
        assertThat(countNotifications(f.owner.getId())).isZero();
    }

    // ── Phân lớp ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Roster CSV: học viên vào lớp nhận ADDED_TO_CLASS (addedBy=ORG, kèm giáo viên chính) đúng một lần; nhập lại không báo lại")
    void rosterImport_enqueuesAddedToClassOnce() {
        Fixture f = fixture();
        String newEmail = "csv-" + UUID.randomUUID() + "@test.local";
        String csv = "email,displayName\n" + f.student.getEmail() + ",HV cu\n" + newEmail + ",HV moi\n";

        RosterImportResultDto result = rosterService.importStudents(f.org.getId(), csv, f.klass.getId(), actor(f.owner));
        assertThat(result.enrolled()).isEqualTo(2);

        Long newStudentId = userRepository.findByEmailIgnoreCase(newEmail).orElseThrow().getId();
        List<NotificationOutbox> rows = outboxRepo.findAll().stream()
                .filter(o -> f.klass.getId().equals(o.getClassId())).toList();
        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(NotificationOutbox::getRecipientId)
                .containsExactlyInAnyOrder(f.student.getId(), newStudentId);
        assertThat(rows).allSatisfy(o -> {
            assertThat(o.getNotificationType()).isEqualTo(NotificationType.ADDED_TO_CLASS);
            assertThat(o.getPayload())
                    .containsEntry("classId", f.klass.getId().intValue())
                    .containsEntry("className", f.klass.getName())
                    .containsEntry("teacherName", f.teacher.getDisplayName())
                    .containsEntry("addedBy", "ORG");
            assertThat(o.getDedupKey()).startsWith("enroll:" + f.klass.getId() + ":u" + o.getRecipientId() + ":t");
        });

        // Nhập lại cùng tệp: hai người đang học → enroll trả false → không thêm dòng outbox nào.
        RosterImportResultDto again = rosterService.importStudents(f.org.getId(), csv, f.klass.getId(), actor(f.owner));
        assertThat(again.enrolled()).isZero();
        assertThat(outboxRepo.findAll().stream().filter(o -> f.klass.getId().equals(o.getClassId())).count())
                .isEqualTo(2);

        // Worker gửi → học viên đọc được câu "trung tâm đã xếp bạn vào lớp", không gán cho giáo viên.
        NotificationOutbox forOld = rows.stream()
                .filter(o -> o.getRecipientId().equals(f.student.getId())).findFirst().orElseThrow();
        outboxService.deliver(forOld.getId());
        NotificationItemResponse item =
                userNotificationService.listForRecipient(f.student.getId(), 0, 10, null).items().get(0);
        assertThat(item.type()).isEqualTo(NotificationType.ADDED_TO_CLASS);
        assertThat(item.body()).isEqualTo("Trung tâm đã xếp bạn vào lớp " + f.klass.getName()
                + " (giáo viên: " + f.teacher.getDisplayName() + ").");
    }

    @Test
    @DisplayName("Giáo viên phụ trách thêm bằng email → cùng cửa enrollAndNotify: ADDED_TO_CLASS addedBy=TEACHER qua outbox, không phát trực tiếp")
    void teacherAddByEmail_enqueuesAddedToClassByTeacher() {
        Fixture f = fixture();

        teacherService.addStudentToClassByEmail(f.teacher.getId(), f.klass.getId(), f.student.getEmail());

        // Chưa có notification nào phát trực tiếp — chỉ có dòng outbox chờ worker.
        assertThat(countNotifications(f.student.getId())).isZero();
        List<NotificationOutbox> rows = outboxOf(f.student.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getNotificationType()).isEqualTo(NotificationType.ADDED_TO_CLASS);
        assertThat(rows.get(0).getPayload())
                .containsEntry("addedBy", "TEACHER")
                .containsEntry("teacherName", f.teacher.getDisplayName());

        outboxService.deliver(rows.get(0).getId());
        NotificationItemResponse item =
                userNotificationService.listForRecipient(f.student.getId(), 0, 10, null).items().get(0);
        assertThat(item.body()).isEqualTo("Giáo viên " + f.teacher.getDisplayName()
                + " đã thêm bạn vào lớp " + f.klass.getName() + ".");
    }

    // ── fixture ──────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User teacher, User student, TeacherClass klass) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT notif " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-notif-" + UUID.randomUUID())
                .seatLimit(0)
                .status("ACTIVE")
                .build());
        User owner = member(org, "OWNER", User.Role.OWNER, "Giam doc");
        User teacher = member(org, "TEACHER", User.Role.TEACHER, "Co Lan");
        User student = member(org, "STUDENT", User.Role.STUDENT, "Hoc vien");

        TeacherClass klass = classRepo.save(TeacherClass.builder()
                .teacherId(teacher.getId())
                .orgId(org.getId())
                .name("A1 Sang " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(klass.getId(), teacher.getId()))
                .role("PRIMARY")
                .joinedAt(LocalDateTime.now())
                .build());
        return new Fixture(org, owner, teacher, student, klass);
    }

    private User member(Organization org, String orgRole, User.Role userRole, String displayName) {
        User u = userRepository.save(User.builder()
                .email("notif-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName(displayName)
                .role(userRole)
                .build());
        u.setOrgId(org.getId());   // openPeriod snapshot org của giáo viên; addStudentToClassByEmail so org
        userRepository.save(u);
        memberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(org.getId(), u.getId()))
                .role(orgRole)
                .status("ACTIVE")
                .joinedAt(Instant.now())
                .build());
        return u;
    }

    private static AuditActor actor(User u) {
        return new AuditActor(u.getId(), u.getEmail(), u.getRole().name());
    }

    private List<NotificationOutbox> outboxOf(Long recipientId) {
        return outboxRepo.findAll().stream().filter(o -> recipientId.equals(o.getRecipientId())).toList();
    }

    private int countNotifications(Long userId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ?", Integer.class, userId);
        return n == null ? 0 : n;
    }
}
