package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AcademicApproverDto;
import com.deutschflow.organization.dto.GrantAcademicApproverRequest;
import com.deutschflow.organization.entity.OrgAcademicApprover;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.repository.OrgAcademicApproverRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Quản lý phân công NGƯỜI DUYỆT HỌC VỤ (PR-2, quyết định P01). Gán/thu hồi là đặc quyền OWNER
 * (giám đốc); org-admin (OWNER/MANAGER) được XEM danh sách. MANAGER không tự có quyền duyệt —
 * muốn duyệt phải được gán như mọi giáo viên trưởng khác (tách quyền học vụ khỏi quản trị, spec §6).
 */
@Service
@RequiredArgsConstructor
public class OrgAcademicApproverService {

    private final OrgGuard orgGuard;
    private final OrgAcademicApproverRepository approverRepo;
    private final OrgMemberRepository memberRepo;
    private final TeacherClassRepository teacherClassRepo;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AcademicApproverDto> list(Long actorId, Long orgId) {
        orgGuard.assertOrgAdmin(actorId, orgId);
        List<OrgAcademicApprover> rows = approverRepo.findByOrgIdAndRevokedAtIsNullOrderByGrantedAtAsc(orgId);
        if (rows.isEmpty()) return List.of();

        Map<Long, User> users = userRepository.findAllById(
                        rows.stream().map(OrgAcademicApprover::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<Long, TeacherClass> classes = teacherClassRepo.findAllById(
                        rows.stream().map(OrgAcademicApprover::getClassId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(TeacherClass::getId, Function.identity()));
        Map<Long, String> roles = memberRepo.findByIdOrgIdAndStatus(orgId, "ACTIVE").stream()
                .collect(Collectors.toMap(m -> m.getId().getUserId(), OrgMember::getRole, (a, b) -> a));

        return rows.stream()
                .map(r -> {
                    User u = users.get(r.getUserId());
                    TeacherClass k = r.getClassId() == null ? null : classes.get(r.getClassId());
                    return new AcademicApproverDto(
                            r.getId(), r.getUserId(),
                            u == null ? null : u.getDisplayName(),
                            u == null ? null : u.getEmail(),
                            roles.get(r.getUserId()),
                            r.getScope(), r.getClassId(),
                            k == null ? null : k.getName(),
                            r.getGrantedAt());
                })
                .toList();
    }

    /** Gán quyền duyệt học vụ — OWNER-only (giám đốc phân công giáo viên trưởng). */
    @Transactional
    public AcademicApproverDto grant(Long actorId, Long orgId, GrantAcademicApproverRequest req) {
        orgGuard.assertOrgOwner(actorId, orgId);
        if (req == null || req.userId() == null) {
            throw new BadRequestException("Thiếu userId");
        }
        String scope = normalizeScope(req.scope());

        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, req.userId())
                .filter(m -> "ACTIVE".equals(m.getStatus()))
                .orElseThrow(() -> new BadRequestException("Người này không phải thành viên đang hoạt động của trung tâm"));
        if ("STUDENT".equals(member.getRole())) {
            throw new BadRequestException("Học viên không thể làm người duyệt học vụ");
        }
        if ("OWNER".equals(member.getRole())) {
            throw new BadRequestException("Giám đốc (OWNER) mặc định đã có quyền duyệt học vụ — không cần phân công");
        }

        Long classId = null;
        if (OrgAcademicApprover.SCOPE_CLASS.equals(scope)) {
            if (req.classId() == null) {
                throw new BadRequestException("Phạm vi CLASS cần classId");
            }
            // Một thông điệp chung cho cả "không tồn tại" lẫn "thuộc org khác" — không làm oracle
            // dò id chéo trung tâm (security L1).
            TeacherClass klass = teacherClassRepo.findById(req.classId())
                    .filter(k -> Objects.equals(k.getOrgId(), orgId))
                    .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp trong trung tâm"));
            classId = klass.getId();
            if (approverRepo.existsByOrgIdAndUserIdAndScopeAndClassIdAndRevokedAtIsNull(
                    orgId, req.userId(), scope, classId)) {
                throw new ConflictException("Người này đã được phân công duyệt lớp này rồi");
            }
        } else {
            if (req.classId() != null) {
                throw new BadRequestException("Phạm vi ORG không đi kèm classId");
            }
            if (approverRepo.existsByOrgIdAndUserIdAndScopeAndRevokedAtIsNull(orgId, req.userId(), scope)) {
                throw new ConflictException("Người này đã được phân công duyệt toàn trung tâm rồi");
            }
        }

        OrgAcademicApprover saved = approverRepo.save(OrgAcademicApprover.builder()
                .orgId(orgId)
                .userId(req.userId())
                .scope(scope)
                .classId(classId)
                .grantedBy(actorId)
                .build());
        return list(actorId, orgId).stream()
                .filter(d -> Objects.equals(d.id(), saved.getId()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Không đọc lại được phân công vừa tạo"));
    }

    /** Thu hồi (soft — giữ lịch sử) — OWNER-only. FE bắt buộc ConfirmDialog trước khi gọi (§2.11). */
    @Transactional
    public void revoke(Long actorId, Long orgId, Long approverId) {
        orgGuard.assertOrgOwner(actorId, orgId);
        OrgAcademicApprover row = approverRepo.findById(approverId)
                .filter(r -> Objects.equals(r.getOrgId(), orgId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phân công"));
        if (!row.isActive()) {
            throw new ConflictException("Phân công này đã bị thu hồi trước đó");
        }
        row.setRevokedAt(LocalDateTime.now());
        row.setRevokedBy(actorId);
        approverRepo.save(row);
    }

    private static String normalizeScope(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Thiếu scope (ORG hoặc CLASS)");
        }
        String v = raw.trim().toUpperCase();
        if (!OrgAcademicApprover.SCOPE_ORG.equals(v) && !OrgAcademicApprover.SCOPE_CLASS.equals(v)) {
            throw new BadRequestException("Scope không hợp lệ: " + raw);
        }
        return v;
    }
}
