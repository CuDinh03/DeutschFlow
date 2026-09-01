package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.ClassScheduleChangeRequest;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassScheduleChangeRequestRepository;
import com.deutschflow.teacher.repository.ClassSessionContentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Xếp một thay đổi lịch của lớp trung-tâm-có-giáo-trình vào HÀNG CHỜ DUYỆT (PR-5, AC18):
 * dựng payload + bản chụp tác động rồi lưu request PENDING — KHÔNG đụng lịch chính thức,
 * KHÔNG sinh thông báo học viên. Được {@link ClassScheduleService} gọi tại 4 đường ghi;
 * chiều áp dụng (sau duyệt) nằm ở {@code ScheduleChangeRequestService} — một chiều, không vòng.
 */
@Component
@RequiredArgsConstructor
public class ScheduleChangeQueue {

    private final ClassScheduleChangeRequestRepository requestRepo;
    private final ClassSessionContentRepository contentRepo;
    private final TeacherClassRepository classRepo;
    private final ObjectMapper objectMapper;

    /** Một cảnh báo/thống kê tác động do caller (nơi có sẵn ngữ cảnh lịch) đưa vào bản chụp. */
    public record ImpactSeed(List<Long> affectedSessionIds, List<String> warnings) {
        public static ImpactSeed of(List<Long> sessionIds, List<String> warnings) {
            return new ImpactSeed(sessionIds == null ? List.of() : sessionIds,
                    warnings == null ? List.of() : warnings);
        }
    }

    /**
     * Lưu đề xuất PENDING. {@code weekendTarget} = thời điểm ĐÍCH của thay đổi (giờ mới của buổi,
     * buổi bù, hoặc null) — rơi vào T7/CN thì {@code has_weekend=true} và chỉ OWNER duyệt được
     * (AC19/AC20); với pattern truyền thẳng {@code weekendByDay}.
     */
    public Long queue(Long teacherId, Long classId, ClassScheduleChangeRequest.Type type,
                      Object payloadObject, ImpactSeed seed, LocalDateTime weekendTarget,
                      boolean weekendByDay, String reason) {
        TeacherClass klass = classRepo.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp"));

        boolean weekend = weekendByDay || isWeekend(weekendTarget);

        Map<String, Object> impact = new LinkedHashMap<>();
        impact.put("affectedSessionIds", seed.affectedSessionIds());
        // Số phần nội dung ĐÃ XẾP (kế hoạch/chuyển tiếp/xác nhận) trên các buổi bị chạm — người
        // duyệt thấy ngay thay đổi này kéo theo bao nhiêu phân bổ phải sắp lại (spec §4.2).
        impact.put("plannedContentCount", seed.affectedSessionIds().isEmpty()
                ? 0 : contentRepo.countBySessionIdIn(seed.affectedSessionIds()));
        List<String> warnings = new ArrayList<>(seed.warnings());
        if (weekend) {
            warnings.add("Thay đổi chạm Thứ 7/Chủ nhật — chỉ giám đốc trung tâm duyệt được");
        }
        impact.put("warnings", warnings);

        ClassScheduleChangeRequest req = ClassScheduleChangeRequest.builder()
                .classId(classId)
                .requestType(type)
                .payload(toMap(payloadObject))
                .impactSnapshot(impact)
                .reason(reason)
                .hasWeekend(weekend)
                // AC10: chụp phiên bản lịch lúc ĐỀ XUẤT — duyệt trên nền khác là duyệt lỗi thời.
                .baseVersion(klass.getScheduleVersion())
                .requestedBy(teacherId)
                .build();
        return requestRepo.save(req).getId();
    }

    /** JSON hoá request record của đường ghi cũ thành payload jsonb (giữ nguyên tên trường). */
    private Map<String, Object> toMap(Object payloadObject) {
        @SuppressWarnings("unchecked")
        Map<String, Object> map = objectMapper.convertValue(payloadObject, Map.class);
        return map == null ? new LinkedHashMap<>() : new LinkedHashMap<>(map);
    }

    private static boolean isWeekend(LocalDateTime target) {
        if (target == null) return false;
        DayOfWeek d = target.getDayOfWeek();
        return d == DayOfWeek.SATURDAY || d == DayOfWeek.SUNDAY;
    }
}
