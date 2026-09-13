package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgStudentEvaluationDto;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.StudentEvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trung tâm đọc hồ sơ đánh giá của MỘT học viên — R12 (owner chốt 10/09/2026): điểm bốn kỹ năng,
 * nhận xét giáo viên và chuyên cần, gom theo học viên qua mọi lớp CỦA trung tâm.
 *
 * <p>Đây là phần còn thiếu của R12: PR-R2 (#639) chỉ mở đường cho sổ PHIẾU đã phát hành
 * ({@code GET /api/org/report-issues}), còn số liệu học tập thô thì trung tâm chưa có đường nào
 * đọc — giám đốc muốn biết vì sao một học viên chưa đủ điều kiện chứng nhận thì phải đi hỏi giáo
 * viên.
 *
 * <p><b>Hai chốt phạm vi, cả hai đều là biên tenant:</b>
 * <ol>
 *   <li>Học viên phải là thành viên của chính {@code orgId} đó, nếu không ⇒ 404 (không phải 403):
 *       cùng khuôn {@code OrgService#getStudentDetail} — "không thuộc" và "không tồn tại" phải nói
 *       cùng một câu, nếu không thì thông điệp lỗi tự nó thành công cụ dò id người dùng.</li>
 *   <li>Chỉ lớp có {@code org_id} = {@code orgId}. Một học viên hoàn toàn có thể vừa học lớp của
 *       trung tâm, vừa tự học lớp B2C ({@code org_id} NULL) hoặc lớp của trung tâm khác — hai loại
 *       sau là đời sống riêng của họ, trung tâm không có quyền nhìn.</li>
 * </ol>
 *
 * <p>Ghi danh đã kết thúc VẪN nằm trong hồ sơ, kèm {@code enrollmentStatus}: hồ sơ đánh giá là thứ
 * người ta mở ra để nhìn lại cả quá trình.
 *
 * <p>🪤 Chốt (1) soi DÒNG {@code org_members} chứ không soi {@code status} của nó — đúng như
 * {@code OrgService#getStudentDetail} mà trang chi tiết học viên đang dùng. Hệ quả: học viên đã rời
 * trung tâm (dòng còn lại với {@code LEFT}/{@code REVOKED}) thì trung tâm VẪN đọc được hồ sơ của
 * quãng họ từng học ở đây. Cố ý giữ nhất quán với trang chi tiết — nếu owner muốn siết thì phải siết
 * cả hai chỗ cùng lúc, vì siết một nơi sẽ cho ra hai câu trả lời khác nhau cho cùng một học viên.
 */
@Service
@RequiredArgsConstructor
public class OrgStudentEvaluationService {

    /** Lớp đang có mặt học viên xếp trước lớp đã đóng — thứ tự đọc tự nhiên của một hồ sơ. */
    private static final List<String> LIVE_STATUSES =
            List.of(ClassStudent.STATUS_ACTIVE, ClassStudent.STATUS_RESERVED);

    private final OrgMemberRepository memberRepo;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final StudentEvaluationService evaluationService;

    @Transactional(readOnly = true)
    public List<OrgStudentEvaluationDto> forStudent(Long orgId, Long studentId) {
        memberRepo.findByIdOrgIdAndIdUserId(orgId, studentId)
                .orElseThrow(() -> new NotFoundException("Học viên không thuộc tổ chức"));

        List<ClassStudent> enrollments = classStudentRepository.findAllEnrollmentsOfStudent(studentId);
        if (enrollments.isEmpty()) {
            return List.of();
        }

        List<Long> classIds = enrollments.stream().map(cs -> cs.getId().getClassId()).toList();
        Map<Long, TeacherClass> classesOfOrg = teacherClassRepository.findAllById(classIds).stream()
                .filter(c -> orgId.equals(c.getOrgId()))
                .collect(Collectors.toMap(TeacherClass::getId, Function.identity()));

        return enrollments.stream()
                .filter(cs -> classesOfOrg.containsKey(cs.getId().getClassId()))
                .map(cs -> toDto(cs, classesOfOrg.get(cs.getId().getClassId())))
                .sorted(Comparator
                        .comparing((OrgStudentEvaluationDto d) -> LIVE_STATUSES.contains(d.enrollmentStatus()) ? 0 : 1)
                        .thenComparing(OrgStudentEvaluationDto::joinedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private OrgStudentEvaluationDto toDto(ClassStudent enrollment, TeacherClass clazz) {
        Long classId = enrollment.getId().getClassId();
        Long studentId = enrollment.getId().getStudentId();
        StudentEvaluationDto e = evaluationService.evaluationOf(classId, studentId);
        return new OrgStudentEvaluationDto(
                classId,
                clazz.getName(),
                enrollment.getStatus(),
                enrollment.getJoinedAt(),
                enrollment.getEndedAt(),
                e.teacherComment(),
                e.skillHoren(),
                e.skillLesen(),
                e.skillSchreiben(),
                e.skillSprechen(),
                e.avgScore(),
                e.recordedSessions(),
                e.presentCount(),
                e.absentCount(),
                e.lateCount(),
                e.certificateEligible(),
                e.evaluatedAt());
    }
}
