package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassAssignmentRecipient;
import com.deutschflow.teacher.repository.ClassAssignmentRecipientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * MỘT nguồn sự thật cho câu hỏi "học viên này có được thấy/nhận bài tập này không" (PR-8):
 *
 * <ul>
 *   <li>P06: bài {@code DRAFT} vô hình với MỌI học viên — chưa StudentAssignment, chưa notification,
 *       không xuất hiện ở list/đếm/đánh giá.</li>
 *   <li>AC14: bài có dòng {@code class_assignment_recipients} chỉ thuộc về đúng những học viên đó;
 *       KHÔNG có dòng nào = giao cả lớp (tương thích dữ liệu cũ).</li>
 * </ul>
 *
 * Mọi đường đọc phía học viên (list bài, thống kê lớp, tab đánh giá, backfill late-joiner) phải đi
 * qua đây — lọc lệch nhau giữa các màn là cách AC14 chết âm thầm.
 */
@Service
@RequiredArgsConstructor
public class AssignmentAudienceService {

    private final ClassAssignmentRecipientRepository recipientRepo;

    /** Map bài → tập người nhận; bài KHÔNG có trong map (hoặc set rỗng) = giao cả lớp. */
    @Transactional(readOnly = true)
    public Map<Long, Set<Long>> audienceMap(Collection<Long> assignmentIds) {
        if (assignmentIds.isEmpty()) return Map.of();
        Map<Long, Set<Long>> map = new HashMap<>();
        for (ClassAssignmentRecipient r : recipientRepo.findByIdAssignmentIdIn(assignmentIds)) {
            map.computeIfAbsent(r.getId().getAssignmentId(), k -> new HashSet<>())
                    .add(r.getId().getStudentId());
        }
        return map;
    }

    /** true khi học viên được thấy/nhận bài này (PUBLISHED + đúng đối tượng). */
    public boolean isVisibleTo(ClassAssignment assignment, Long studentId, Map<Long, Set<Long>> audience) {
        if (!"PUBLISHED".equals(assignment.getStatus())) return false;
        Set<Long> recipients = audience.get(assignment.getId());
        return recipients == null || recipients.isEmpty() || recipients.contains(studentId);
    }

    /** Lọc danh sách bài của lớp xuống đúng những bài học viên này được thấy. */
    @Transactional(readOnly = true)
    public List<ClassAssignment> visibleTo(Long studentId, List<ClassAssignment> assignments) {
        if (assignments.isEmpty()) return assignments;
        Map<Long, Set<Long>> audience = audienceMap(assignments.stream().map(ClassAssignment::getId).toList());
        return assignments.stream().filter(a -> isVisibleTo(a, studentId, audience)).toList();
    }
}
