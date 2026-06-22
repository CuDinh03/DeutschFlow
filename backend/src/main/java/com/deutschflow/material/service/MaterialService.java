package com.deutschflow.material.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.entity.ClassMaterial;
import com.deutschflow.material.entity.ClassMaterialId;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * CRUD for teaching materials (B2B model §5/§6) with ownership-correct access:
 * <ul>
 *   <li>PERSONAL material → only its {@code teacherId} owner;</li>
 *   <li>ORG material → any ACTIVE member of that org (tied to the membership, NOT {@code createdBy}),
 *       so a teacher who leaves the center loses access while their PERSONAL items follow them.</li>
 * </ul>
 * Hot reads use the two partial indexes via {@link MaterialRepository}; the combined list is the
 * UNION ALL of the PERSONAL and ORG branches.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MaterialService {

    private static final String SCOPE_PERSONAL = "PERSONAL";
    private static final String SCOPE_ORG = "ORG";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_ARCHIVED = "ARCHIVED";
    private static final String STORAGE_CATEGORY = "materials";
    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;
    // Materials are private (not public-read on S3) → serve a short-lived presigned GET so the
    // owner / ACTIVE org member can VIEW the file in-browser. Re-presigned on every list/read.
    private static final Duration MATERIAL_URL_TTL = Duration.ofHours(1);
    private static final Set<String> ORG_ADMIN_ROLES = Set.of("OWNER", "MANAGER");
    /**
     * Content-types that a browser would execute/render inline. The uploaded content-type becomes
     * the S3 object's Content-Type, and the bucket serves public URLs — so an HTML/SVG/XML upload
     * could be served inline from the app's S3 origin (stored XSS). Block those; everything else
     * (PDF/Office/images/octet-stream/OTHER) downloads or renders inertly.
     */
    private static final Set<String> BLOCKED_MIME = Set.of(
            "text/html", "application/xhtml+xml", "image/svg+xml",
            "application/xml", "text/xml", "application/javascript", "text/javascript");

    private final MaterialRepository materialRepository;
    private final ClassMaterialRepository classMaterialRepository;
    private final S3StorageService s3StorageService;
    private final TeacherClassRepository teacherClassRepository;
    private final OrgMemberRepository orgMemberRepository;

    /** Creates a PERSONAL (teacher-owned) or ORG (center-owned) material from an uploaded file. */
    @Transactional
    public MaterialDto create(User caller, String scopeRaw, MultipartFile file, String title, String description) {
        if (file == null || file.isEmpty()) throw new BadRequestException("Tệp không được để trống.");
        if (file.getSize() > MAX_FILE_SIZE) throw new BadRequestException("Tệp quá lớn (tối đa 20MB).");
        if (title == null || title.isBlank()) throw new BadRequestException("Tiêu đề là bắt buộc.");
        String mime = file.getContentType();
        if (mime != null && BLOCKED_MIME.contains(mime.toLowerCase(Locale.ROOT).trim())) {
            throw new BadRequestException("Loại tệp không được phép vì lý do bảo mật.");
        }
        String scope = scopeRaw == null ? SCOPE_PERSONAL : scopeRaw.trim().toUpperCase(Locale.ROOT);

        Material.MaterialBuilder b = Material.builder()
                .createdBy(caller.getId())
                .title(title.trim())
                .description(description)
                .kind(kindOf(file))
                .mimeType(file.getContentType())
                .sizeBytes(file.getSize())
                .status(STATUS_ACTIVE);

        if (SCOPE_PERSONAL.equals(scope)) {
            b.ownerScope(SCOPE_PERSONAL).teacherId(caller.getId());
        } else if (SCOPE_ORG.equals(scope)) {
            Long orgId = caller.getOrgId();
            if (orgId == null || !isActiveMember(caller.getId(), orgId)) {
                throw new ForbiddenException("Bạn không thuộc tổ chức nào để tạo tài liệu cấp tổ chức.");
            }
            b.ownerScope(SCOPE_ORG).orgId(orgId);
        } else {
            throw new BadRequestException("Phạm vi không hợp lệ: " + scopeRaw);
        }

        String objectKey;
        try {
            objectKey = s3StorageService.uploadFile(file, STORAGE_CATEGORY).getS3Key();
        } catch (IOException ex) {
            throw new BadRequestException("Tải tệp lên thất bại: " + ex.getMessage());
        }
        Material saved = materialRepository.save(b.objectKey(objectKey).build());
        return toDto(saved);
    }

    /** Combined list: PERSONAL of the caller ∪ ORG of the caller's org (only while ACTIVE there). */
    @Transactional(readOnly = true)
    public List<MaterialDto> list(User caller) {
        List<Material> out = new ArrayList<>(materialRepository
                .findByOwnerScopeAndTeacherIdAndStatusOrderByCreatedAtDesc(
                        SCOPE_PERSONAL, caller.getId(), STATUS_ACTIVE));
        Long orgId = caller.getOrgId();
        if (orgId != null && isActiveMember(caller.getId(), orgId)) {
            out.addAll(materialRepository
                    .findByOwnerScopeAndOrgIdAndStatusOrderByCreatedAtDesc(SCOPE_ORG, orgId, STATUS_ACTIVE));
        }
        return out.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public MaterialDto get(User caller, Long id) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        assertCanAccess(caller, m);
        // Archived/deleted materials are hidden from direct fetch too (consistent with list()).
        if (!STATUS_ACTIVE.equals(m.getStatus())) {
            throw new NotFoundException("Không tìm thấy tài liệu.");
        }
        return toDto(m);
    }

    /** Soft-archive (status → ARCHIVED). PERSONAL: owner; ORG: author or OWNER/MANAGER. */
    @Transactional
    public MaterialDto archive(User caller, Long id) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        if (!canManage(caller, m)) {
            throw new ForbiddenException("Bạn không có quyền lưu trữ tài liệu này.");
        }
        m.setStatus(STATUS_ARCHIVED);
        return toDto(materialRepository.save(m));
    }

    /** Attaches a material the caller can access to a class the caller teaches (or org-admins). */
    @Transactional
    public void attachToClass(User caller, Long materialId, Long classId) {
        Material m = materialRepository.findById(materialId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        assertCanAccess(caller, m);
        TeacherClass tc = teacherClassRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học."));
        if (!canAttachToClass(caller, tc)) {
            throw new ForbiddenException("Bạn không có quyền gắn tài liệu vào lớp này.");
        }
        // An ORG material may only be attached to a class of the SAME org (no cross-org leak).
        if (SCOPE_ORG.equals(m.getOwnerScope()) && !m.getOrgId().equals(tc.getOrgId())) {
            throw new ForbiddenException("Tài liệu của tổ chức chỉ gắn được vào lớp của tổ chức đó.");
        }
        if (!classMaterialRepository.existsByIdClassIdAndIdMaterialId(classId, materialId)) {
            classMaterialRepository.save(ClassMaterial.builder()
                    .id(new ClassMaterialId(classId, materialId))
                    .attachedBy(caller.getId())
                    .build());
        }
    }

    /** Active materials attached to a class (for the class-detail view). */
    @Transactional(readOnly = true)
    public List<MaterialDto> listForClass(User caller, Long classId) {
        TeacherClass tc = teacherClassRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học."));
        if (!canAttachToClass(caller, tc)) {
            throw new ForbiddenException("Bạn không có quyền xem tài liệu của lớp này.");
        }
        List<Long> ids = classMaterialRepository.findByIdClassId(classId).stream()
                .map(cm -> cm.getId().getMaterialId())
                .toList();
        if (ids.isEmpty()) return List.of();
        return materialRepository.findAllById(ids).stream()
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .map(this::toDto)
                .toList();
    }

    // --------------------------------------------------------------- access rules

    private void assertCanAccess(User caller, Material m) {
        if (!canAccess(caller, m)) {
            throw new ForbiddenException("Bạn không có quyền truy cập tài liệu này.");
        }
    }

    /**
     * PERSONAL → owner only. ORG → tied to ACTIVE membership (users.org_id), NOT created_by.
     * NOTE: {@code visibility='OWNER_ONLY'} is reserved for a future iteration (B2B model §5
     * "Mở rộng sau") and is intentionally NOT enforced yet — every ORG material is ORG_ALL today.
     */
    private boolean canAccess(User caller, Material m) {
        if (SCOPE_PERSONAL.equals(m.getOwnerScope())) {
            return caller.getId().equals(m.getTeacherId());
        }
        return m.getOrgId() != null
                && m.getOrgId().equals(caller.getOrgId())
                && isActiveMember(caller.getId(), m.getOrgId());
    }

    private boolean canManage(User caller, Material m) {
        if (SCOPE_PERSONAL.equals(m.getOwnerScope())) {
            return caller.getId().equals(m.getTeacherId());
        }
        return canAccess(caller, m)
                && (caller.getId().equals(m.getCreatedBy()) || isOrgAdmin(caller.getId(), m.getOrgId()));
    }

    private boolean canAttachToClass(User caller, TeacherClass tc) {
        if (caller.getId().equals(tc.getTeacherId())) return true;
        return tc.getOrgId() != null && isOrgAdmin(caller.getId(), tc.getOrgId());
    }

    private boolean isActiveMember(Long userId, Long orgId) {
        return orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .isPresent();
    }

    private boolean isOrgAdmin(Long userId, Long orgId) {
        return orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .map(m -> ORG_ADMIN_ROLES.contains(m.getRole()))
                .orElse(false);
    }

    private MaterialDto toDto(Material m) {
        // Presigned GET (not a public URL): teaching materials are private — this lets the owner /
        // ACTIVE org member VIEW the file in-browser without making the S3 object world-readable.
        return MaterialDto.from(m, s3StorageService.presignedGetUrl(m.getObjectKey(), MATERIAL_URL_TTL));
    }

    private static String kindOf(MultipartFile file) {
        String name = file.getOriginalFilename();
        String ext = "";
        if (name != null && name.contains(".")) {
            ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        }
        return switch (ext) {
            case "pptx", "ppt" -> "PPTX";
            case "pdf" -> "PDF";
            case "docx", "doc" -> "DOCX";
            case "png", "jpg", "jpeg", "gif", "webp" -> "IMAGE";
            default -> "OTHER";
        };
    }
}
