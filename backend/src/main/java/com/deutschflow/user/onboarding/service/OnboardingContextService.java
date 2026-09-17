package com.deutschflow.user.onboarding.service;

import com.deutschflow.common.quota.PlanBadge;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.AccountSource;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.OnboardingContextResponse;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.OrgInfo;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.TrialInfo;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.LearningPlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Ngữ cảnh onboarding của một học viên — Đợt 5 (kế hoạch 17/09/2026 §4.1, cổng G-7).
 *
 * <p>Luật rẽ cửa (hai điều kiện, thiếu một là {@code SELF}):
 * <ul>
 *   <li>{@code users.created_via} KHÔNG phải {@code SELF} (CSV → {@code ORG_ROSTER};
 *       OWNER/MANAGER/ADMIN tạo tay hoặc mời → {@code ORG_INVITE}); {@code null} (tài khoản trước
 *       V… có cột) coi như {@code SELF};</li>
 *   <li>và còn dòng {@code org_members} STUDENT ACTIVE. Người từng ở trung tâm rồi bị gỡ/rời
 *       là học viên thường — đi trọn phễu B2C, không hiện tên trung tâm cũ.</li>
 * </ul>
 * Người tự đăng ký rồi vào lớp bằng mã (C3) có membership nhưng {@code created_via = SELF} ⇒ vẫn
 * {@code SELF}: họ đã (hoặc đang) đi phễu B2C, không làm lại onboarding.
 *
 * <p>{@code presetCurrentLevel}: trình độ đã có sẵn để client KHÔNG hỏi lại — ưu tiên hồ sơ học
 * (giáo viên/placement đã đặt), rồi tới {@code cefr_level} của giáo trình gắn vào lớp đang học.
 * Không có cả hai ⇒ {@code null} và bản rút gọn hỏi thêm một câu trình độ.
 *
 * <p>Chỉ đọc; mọi tra cứu phụ (tên trung tâm, lớp, giáo trình) là best-effort — thiếu dữ liệu thì
 * trả {@code null} ở trường đó chứ không làm hỏng cả phản hồi, vì client chỉ cần
 * {@code accountSource} + {@code hasPlan} để rẽ lối.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingContextService {

    static final String ROLE_STUDENT = "STUDENT";
    static final String STATUS_ACTIVE = "ACTIVE";

    private final LearningPlanService learningPlanService;
    private final OrgMemberRepository orgMemberRepository;
    private final OrganizationRepository organizationRepository;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final ClassCurriculumLinkRepository classCurriculumLinkRepository;
    private final OrgCurriculumVersionRepository orgCurriculumVersionRepository;
    private final OrgCurriculumRepository orgCurriculumRepository;
    private final UserLearningProfileRepository learningProfileRepository;
    private final QuotaService quotaService;

    @Transactional(readOnly = true)
    public OnboardingContextResponse contextFor(User user) {
        Long userId = user.getId();
        boolean hasPlan = learningPlanService.hasPlan(user);
        Optional<OrgMember> membership = activeStudentMembership(userId);
        AccountSource source = resolveAccountSource(user.getCreatedVia(), membership.isPresent());

        OrgInfo org = null;
        TeacherClass currentClass = null;
        if (source != AccountSource.SELF) {
            Long orgId = membership.get().getId().getOrgId();
            currentClass = currentClassIn(orgId, userId).orElse(null);
            org = new OrgInfo(orgId, orgName(orgId), currentClass == null ? null : currentClass.getId(),
                    currentClass == null ? null : currentClass.getName());
        }

        final TeacherClass classForLevel = currentClass;
        String presetLevel = profileLevel(userId)
                .or(() -> curriculumLevel(classForLevel))
                .orElse(null);

        return new OnboardingContextResponse(source, hasPlan, org, presetLevel, trialOf(userId));
    }

    /** Thuần để test bảng chân trị; {@code createdVia == null} = tài khoản cũ trước khi có cột ⇒ SELF. */
    public static AccountSource resolveAccountSource(User.CreatedVia createdVia, boolean activeStudentMember) {
        if (createdVia == null || createdVia == User.CreatedVia.SELF || !activeStudentMember) {
            return AccountSource.SELF;
        }
        return createdVia == User.CreatedVia.CSV ? AccountSource.ORG_ROSTER : AccountSource.ORG_INVITE;
    }

    private Optional<OrgMember> activeStudentMembership(Long userId) {
        List<OrgMember> rows = orgMemberRepository.findByIdUserIdAndRoleAndStatus(userId, ROLE_STUDENT, STATUS_ACTIVE);
        if (rows.size() > 1) {
            // Chốt F4 giữ tối đa một membership ACTIVE; nếu dữ liệu lệch thì vẫn rẽ được lối nhưng phải thấy.
            log.warn("[ONB_CONTEXT] userId={} có {} membership STUDENT ACTIVE — lấy dòng mới nhất", userId, rows.size());
        }
        return rows.stream().max(Comparator.comparing(OrgMember::getJoinedAt,
                Comparator.nullsFirst(Comparator.naturalOrder())));
    }

    private String orgName(Long orgId) {
        return organizationRepository.findById(orgId).map(Organization::getName).orElse(null);
    }

    /** Lớp ACTIVE/RESERVED mới nhất (theo {@code joined_at}) THUỘC trung tâm đang xét — lớp của trung tâm khác bỏ qua. */
    private Optional<TeacherClass> currentClassIn(Long orgId, Long userId) {
        List<ClassStudent> enrollments = classStudentRepository.findByIdStudentId(userId);
        if (enrollments.isEmpty()) {
            return Optional.empty();
        }
        Map<Long, TeacherClass> byId = teacherClassRepository
                .findAllById(enrollments.stream().map(e -> e.getId().getClassId()).toList())
                .stream()
                .filter(c -> orgId.equals(c.getOrgId()))
                .collect(Collectors.toMap(TeacherClass::getId, Function.identity(), (a, b) -> a));
        return enrollments.stream()
                .filter(e -> byId.containsKey(e.getId().getClassId()))
                .max(Comparator.comparing(ClassStudent::getJoinedAt,
                        Comparator.nullsFirst(Comparator.<LocalDateTime>naturalOrder())))
                .map(e -> byId.get(e.getId().getClassId()));
    }

    private Optional<String> profileLevel(Long userId) {
        return learningProfileRepository.findByUserId(userId)
                .map(UserLearningProfile::getCurrentLevel)
                .map(Enum::name);
    }

    private Optional<String> curriculumLevel(TeacherClass currentClass) {
        if (currentClass == null) {
            return Optional.empty();
        }
        return classCurriculumLinkRepository.findByClassId(currentClass.getId())
                .flatMap(link -> orgCurriculumVersionRepository.findById(link.getVersionId()))
                .flatMap(version -> orgCurriculumRepository.findById(version.getCurriculumId()))
                .map(curriculum -> curriculum.getCefrLevel())
                .filter(level -> level != null && !level.isBlank());
    }

    private TrialInfo trialOf(Long userId) {
        PlanBadge badge = quotaService.resolvePlanBadge(userId, Instant.now());
        return new TrialInfo(badge.isTrial(), badge.trialEndsAt());
    }
}
