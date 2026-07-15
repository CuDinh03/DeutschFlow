package com.deutschflow.material.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.material.dto.MaterialDto;
import com.deutschflow.material.dto.MaterialFolderDto;
import com.deutschflow.material.dto.PresignUploadResponse;
import com.deutschflow.material.entity.ClassMaterial;
import com.deutschflow.material.entity.ClassMaterialId;
import com.deutschflow.material.entity.LessonMaterial;
import com.deutschflow.material.entity.LessonMaterialId;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.entity.MaterialFolder;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.LessonMaterialRepository;
import com.deutschflow.material.repository.MaterialFolderRepository;
import com.deutschflow.material.repository.MaterialRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

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
    private static final String STATUS_UPLOADING = "UPLOADING"; // presigned-PUT record chưa verify
    private static final String KIND_LINK = "LINK";
    private static final String STORAGE_CATEGORY = "materials";
    // Multipart path: file nhỏ đẩy qua backend (khớp spring.servlet.multipart.max-file-size=25MB).
    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;
    // Presigned-PUT path: hard-cap chống abuse; kiểm CUỐI CÙNG bằng size thật từ S3 HEAD ở complete().
    private static final long MAX_PRESIGN_SIZE = 500L * 1024 * 1024;
    // Kẹp thời lượng audio/video do FE gửi (không tin cậy): 24h là trần hợp lý cho 1 track.
    private static final int MAX_DURATION_SECONDS = 86400;
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
    private final MaterialFolderRepository folderRepository;
    private final ClassMaterialRepository classMaterialRepository;
    private final S3StorageService s3StorageService;
    private final TeacherClassRepository teacherClassRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final LessonMaterialRepository lessonMaterialRepository;
    private final ClassLessonRepository lessonRepository;
    private final com.deutschflow.teacher.repository.ClassStudentRepository classStudentRepository;

    /** Creates a PERSONAL (teacher-owned) or ORG (center-owned) material from an uploaded file (≤25MB). */
    @Transactional
    public MaterialDto create(User caller, String scopeRaw, MultipartFile file, String title, String description,
                              Long folderId, List<String> tags) {
        if (file == null || file.isEmpty()) throw new BadRequestException("Tệp không được để trống.");
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Tệp quá lớn (tối đa 25MB). Với tệp lớn hơn, hãy dùng luồng tải trực tiếp.");
        }
        if (title == null || title.isBlank()) throw new BadRequestException("Tiêu đề là bắt buộc.");
        if (isBlockedMime(file.getContentType())) {
            throw new BadRequestException("Loại tệp không được phép vì lý do bảo mật.");
        }
        OwnerRef owner = resolveOwner(caller, scopeRaw);
        assertFolderAssignable(caller, owner, folderId);

        String objectKey;
        try {
            objectKey = s3StorageService.uploadFile(file, ownerPrefix(owner)).getS3Key();
        } catch (IOException ex) {
            throw new BadRequestException("Tải tệp lên thất bại: " + ex.getMessage());
        }
        Material.MaterialBuilder b = Material.builder()
                .createdBy(caller.getId())
                .title(title.trim())
                .description(description)
                .kind(kindOf(file))
                .objectKey(objectKey)
                .mimeType(file.getContentType())
                .sizeBytes(file.getSize())
                .folderId(folderId)
                .tags(toTagArray(tags))
                .status(STATUS_ACTIVE);
        owner.applyTo(b);
        return toDto(materialRepository.save(b.build()));
    }

    /**
     * Creates a {@code kind=LINK} material pointing at an external URL (allango / YouTube / Drive…).
     * No S3 object is stored ({@code objectKey} stays null — the DB CHECK allows null only for LINK).
     */
    @Transactional
    public MaterialDto createLink(User caller, String scopeRaw, String url, String title, String description,
                                  Long folderId, List<String> tags) {
        if (title == null || title.isBlank()) throw new BadRequestException("Tiêu đề là bắt buộc.");
        if (url == null || url.isBlank()) throw new BadRequestException("Liên kết là bắt buộc.");
        String scheme;
        try {
            scheme = URI.create(url.trim()).getScheme();
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Liên kết không hợp lệ.");
        }
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            throw new BadRequestException("Liên kết phải bắt đầu bằng http:// hoặc https://");
        }
        OwnerRef owner = resolveOwner(caller, scopeRaw);
        assertFolderAssignable(caller, owner, folderId);

        Material.MaterialBuilder b = Material.builder()
                .createdBy(caller.getId())
                .title(title.trim())
                .description(description)
                .kind(KIND_LINK)
                .externalUrl(url.trim())
                .folderId(folderId)
                .tags(toTagArray(tags))
                .status(STATUS_ACTIVE);
        owner.applyTo(b);
        return toDto(materialRepository.save(b.build()));
    }

    /**
     * Step 1 of the large-file (&gt;25MB) upload: reserve an {@code UPLOADING} record and hand back a
     * presigned PUT URL. The browser PUTs the bytes straight to S3, then calls {@link #complete}. The
     * client-declared size is only a fast fail here; the authoritative size is read from S3 at complete.
     */
    @Transactional
    public PresignUploadResponse presignUpload(User caller, String scopeRaw, String filename, String contentType,
                                               Long declaredSize, String title, String description,
                                               Long folderId, List<String> tags) {
        if (title == null || title.isBlank()) throw new BadRequestException("Tiêu đề là bắt buộc.");
        if (filename == null || filename.isBlank()) throw new BadRequestException("Tên tệp là bắt buộc.");
        if (isBlockedMime(contentType)) {
            throw new BadRequestException("Loại tệp không được phép vì lý do bảo mật.");
        }
        if (declaredSize != null && declaredSize > MAX_PRESIGN_SIZE) {
            throw new BadRequestException("Tệp quá lớn (tối đa 500MB).");
        }
        OwnerRef owner = resolveOwner(caller, scopeRaw);
        assertFolderAssignable(caller, owner, folderId);

        String objectKey = buildPresignKey(owner, filename);
        Material.MaterialBuilder b = Material.builder()
                .createdBy(caller.getId())
                .title(title.trim())
                .description(description)
                .kind(kindFromFilename(filename))
                .objectKey(objectKey)
                .mimeType(contentType)
                .sizeBytes(declaredSize) // provisional; overwritten from S3 HEAD at complete()
                .folderId(folderId)
                .tags(toTagArray(tags))
                .status(STATUS_UPLOADING);
        owner.applyTo(b);
        Material saved = materialRepository.save(b.build());
        String uploadUrl = s3StorageService.generatePresignedUrl(objectKey, contentType);
        return new PresignUploadResponse(saved.getId(), uploadUrl, objectKey);
    }

    /**
     * Step 2 of the large-file upload: verify the object landed on S3, read its REAL size (untrusted
     * client size is discarded), enforce the 500MB hard cap (deleting the object if it overflows), then
     * flip {@code UPLOADING → ACTIVE}. {@code durationSeconds} (from the browser's &lt;audio&gt;) is clamped.
     */
    @Transactional
    public MaterialDto complete(User caller, Long id, Integer durationSeconds) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        if (!canManage(caller, m)) throw new ForbiddenException("Bạn không có quyền hoàn tất tài liệu này.");
        if (!STATUS_UPLOADING.equals(m.getStatus())) {
            throw new BadRequestException("Tài liệu không ở trạng thái đang tải lên.");
        }
        if (m.getObjectKey() == null || !s3StorageService.objectExists(m.getObjectKey())) {
            throw new BadRequestException("Chưa thấy tệp trên kho lưu trữ. Hãy tải lên trước khi hoàn tất.");
        }
        S3StorageService.S3ObjectMetadata meta = s3StorageService.headObject(m.getObjectKey());
        if (meta.getContentLength() > MAX_PRESIGN_SIZE) {
            s3StorageService.deleteFile(m.getObjectKey());
            throw new BadRequestException("Tệp quá lớn (tối đa 500MB).");
        }
        String realMime = meta.getContentType();
        if (isBlockedMime(realMime)) {
            // Client set a dangerous Content-Type on the PUT despite the presign-time check — reject + purge.
            s3StorageService.deleteFile(m.getObjectKey());
            throw new BadRequestException("Loại tệp không được phép vì lý do bảo mật.");
        }
        m.setSizeBytes(meta.getContentLength());
        if (realMime != null) m.setMimeType(realMime);
        m.setDurationSeconds(clampDuration(durationSeconds));
        m.setStatus(STATUS_ACTIVE);
        return toDto(materialRepository.save(m));
    }

    /**
     * Fresh resolvable URL for a material (presigned GET re-signed, or the external link) — the player /
     * preview calls this when a previous presigned URL expired mid-listen. Same access rule as {@link #get}.
     */
    @Transactional(readOnly = true)
    public String refreshUrl(User caller, Long id) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        assertCanAccess(caller, m);
        if (!STATUS_ACTIVE.equals(m.getStatus())) throw new NotFoundException("Không tìm thấy tài liệu.");
        return resolveUrl(m);
    }

    /**
     * Edits mutable metadata: title, tags, and folder. {@code clearFolder=true} moves the material back to
     * the root (unfiled); otherwise a non-null {@code folderId} moves it into that folder (validated to the
     * same owner). PERSONAL: owner; ORG: author or OWNER/MANAGER (same as {@link #archive}).
     */
    @Transactional
    public MaterialDto patch(User caller, Long id, String title, List<String> tags, Long folderId,
                             boolean clearFolder) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        if (!canManage(caller, m)) throw new ForbiddenException("Bạn không có quyền sửa tài liệu này.");
        if (title != null && !title.isBlank()) m.setTitle(title.trim());
        if (tags != null) m.setTags(toTagArray(tags));
        if (clearFolder) {
            m.setFolderId(null); // move back to root (unfile) — the only wire way to leave a folder
        } else if (folderId != null) {
            assertFolderAssignable(caller, ownerOf(m), folderId);
            m.setFolderId(folderId); // move into a folder of the same owner
        }
        return toDto(materialRepository.save(m));
    }

    /**
     * Filtered list (title ILIKE {@code query}, {@code kind}, single {@code tag}, {@code folderId}). Falls
     * back to the unfiltered UNION when no filter is supplied. Same PERSONAL ∪ ORG(ACTIVE-member) scoping.
     */
    @Transactional(readOnly = true)
    public List<MaterialDto> list(User caller, String query, String kind, String tag, Long folderId) {
        if (isBlank(query) && isBlank(kind) && isBlank(tag) && folderId == null) {
            return list(caller);
        }
        String q = normalize(query);
        String k = normalizeUpper(kind); // kind stored upper-case (PDF/AUDIO/LINK…) → match case-insensitively
        String t = normalize(tag);        // tags keep original case (exact @> containment, GIN-indexed)
        List<Material> out = new ArrayList<>(
                materialRepository.searchPersonal(caller.getId(), STATUS_ACTIVE, q, k, t, folderId));
        Long orgId = caller.getOrgId();
        if (orgId != null && isActiveMember(caller.getId(), orgId)) {
            out.addAll(materialRepository.searchOrg(orgId, STATUS_ACTIVE, q, k, t, folderId));
        }
        return out.stream().map(this::toDto).toList();
    }

    // --------------------------------------------------------------- folders (Materials Library)

    /** Combined folders: PERSONAL of the caller ∪ ORG of the caller's org (only while ACTIVE there). */
    @Transactional(readOnly = true)
    public List<MaterialFolderDto> listFolders(User caller) {
        List<MaterialFolder> out = new ArrayList<>(folderRepository
                .findByOwnerScopeAndTeacherIdOrderByOrderIndexAscNameAsc(SCOPE_PERSONAL, caller.getId()));
        Long orgId = caller.getOrgId();
        if (orgId != null && isActiveMember(caller.getId(), orgId)) {
            out.addAll(folderRepository
                    .findByOwnerScopeAndOrgIdOrderByOrderIndexAscNameAsc(SCOPE_ORG, orgId));
        }
        return out.stream().map(MaterialFolderDto::from).toList();
    }

    @Transactional
    public MaterialFolderDto createFolder(User caller, String scopeRaw, String name, Integer orderIndex) {
        if (name == null || name.isBlank()) throw new BadRequestException("Tên thư mục là bắt buộc.");
        OwnerRef owner = resolveOwner(caller, scopeRaw);
        MaterialFolder f = MaterialFolder.builder()
                .createdBy(caller.getId())
                .name(name.trim())
                .orderIndex(orderIndex == null ? 0 : orderIndex)
                .ownerScope(owner.scope())
                .teacherId(owner.teacherId())
                .orgId(owner.orgId())
                .build();
        return MaterialFolderDto.from(folderRepository.save(f));
    }

    @Transactional
    public MaterialFolderDto renameFolder(User caller, Long id, String name, Integer orderIndex) {
        MaterialFolder f = folderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thư mục."));
        if (!canManageFolder(caller, f)) throw new ForbiddenException("Bạn không có quyền sửa thư mục này.");
        if (name != null && !name.isBlank()) f.setName(name.trim());
        if (orderIndex != null) f.setOrderIndex(orderIndex);
        return MaterialFolderDto.from(folderRepository.save(f));
    }

    /** Hard-deletes the folder row; FK {@code ON DELETE SET NULL} unfiles its materials (none is deleted). */
    @Transactional
    public void deleteFolder(User caller, Long id) {
        MaterialFolder f = folderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thư mục."));
        if (!canManageFolder(caller, f)) throw new ForbiddenException("Bạn không có quyền xoá thư mục này.");
        folderRepository.delete(f);
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

    /** Archived materials (the "Đã lưu trữ" filter) — same PERSONAL ∪ ORG scoping as {@link #list}. */
    @Transactional(readOnly = true)
    public List<MaterialDto> listArchived(User caller) {
        List<Material> out = new ArrayList<>(materialRepository
                .findByOwnerScopeAndTeacherIdAndStatusOrderByCreatedAtDesc(
                        SCOPE_PERSONAL, caller.getId(), STATUS_ARCHIVED));
        Long orgId = caller.getOrgId();
        if (orgId != null && isActiveMember(caller.getId(), orgId)) {
            out.addAll(materialRepository
                    .findByOwnerScopeAndOrgIdAndStatusOrderByCreatedAtDesc(SCOPE_ORG, orgId, STATUS_ARCHIVED));
        }
        return out.stream().map(this::toDto).toList();
    }

    /**
     * How many lessons and classes a material is currently attached to. The UI reads this before
     * archiving so it can warn ("đang gắn ở N bài học") instead of silently pulling the material out of
     * every lesson — archiving flips it to ARCHIVED and listForLesson drops non-ACTIVE, so an archive
     * makes it vanish from the plans it was attached to with no other signal.
     */
    @Transactional(readOnly = true)
    public AttachmentCount attachmentCount(User caller, Long id) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        assertCanAccess(caller, m);
        return new AttachmentCount(
                lessonMaterialRepository.countByIdMaterialId(id),
                classMaterialRepository.countByIdMaterialId(id));
    }

    /** Attachment counts for a material. */
    public record AttachmentCount(long lessons, long classes) {}

    /** Soft-archive (status → ARCHIVED). PERSONAL: owner; ORG: author or OWNER/MANAGER. Reversible. */
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

    /**
     * Restore an archived material (ARCHIVED → ACTIVE). Its lesson/class attachment rows were never
     * deleted, so it reappears in exactly the lessons it was attached to — archive is a hide, not a
     * teardown. Without this there was no way back: nothing set status to ACTIVE except the
     * upload-complete flow.
     */
    @Transactional
    public MaterialDto unarchive(User caller, Long id) {
        Material m = materialRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        if (!canManage(caller, m)) {
            throw new ForbiddenException("Bạn không có quyền khôi phục tài liệu này.");
        }
        if (!STATUS_ARCHIVED.equals(m.getStatus())) {
            throw new BadRequestException("Chỉ khôi phục được tài liệu đang lưu trữ.");
        }
        m.setStatus(STATUS_ACTIVE);
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

    // --------------------------------------------------------------- lesson attach (Phase 1d-D2)

    /** Attaches a material the caller can access to a lesson of a class the caller teaches (or org-admins). */
    @Transactional
    public void attachToLesson(User caller, Long materialId, Long lessonId) {
        Material m = materialRepository.findById(materialId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        assertCanAccess(caller, m);
        TeacherClass tc = resolveClassForLesson(caller, lessonId);
        // An ORG material may only be attached within its OWN org (no cross-org leak).
        if (SCOPE_ORG.equals(m.getOwnerScope()) && !m.getOrgId().equals(tc.getOrgId())) {
            throw new ForbiddenException("Tài liệu của tổ chức chỉ gắn được vào lớp của tổ chức đó.");
        }
        if (!lessonMaterialRepository.existsByIdLessonIdAndIdMaterialId(lessonId, materialId)) {
            int nextOrder = lessonMaterialRepository.findMaxOrderIndex(lessonId) + 1;
            lessonMaterialRepository.save(LessonMaterial.builder()
                    .id(new LessonMaterialId(lessonId, materialId))
                    .orderIndex(nextOrder)
                    .attachedBy(caller.getId())
                    .build());
        }
    }

    /** Detaches a material from a lesson (idempotent). Same authz as attach. */
    @Transactional
    public void detachFromLesson(User caller, Long materialId, Long lessonId) {
        resolveClassForLesson(caller, lessonId);
        lessonMaterialRepository.deleteByIdLessonIdAndIdMaterialId(lessonId, materialId);
    }

    /** Active materials attached to a lesson, in order_index order. */
    @Transactional(readOnly = true)
    public List<MaterialDto> listForLesson(User caller, Long lessonId) {
        resolveClassForLesson(caller, lessonId);
        // Preserve attach order (order_index) while dropping archived/deleted materials.
        return activeMaterialsInOrder(
                lessonMaterialRepository.findByIdLessonIdOrderByOrderIndexAsc(lessonId).stream()
                        .map(lm -> lm.getId().getMaterialId())
                        .toList());
    }

    // --------------------------------------------------------------- student read access
    //
    // Everything above is teacher/admin/org-scoped (canAccess). Students reach materials on a DIFFERENT
    // rule entirely: not "do you own/belong-to this material" but "is this material attached to a lesson
    // or class you are ENROLLED in". A student never lists the library, never sees a material by id, and
    // only ever gets the ones a teacher chose to attach to their class. This is what turns the attach
    // feature from a teacher-only shelf into actually handing materials to the class.

    /** Active materials attached to a lesson, for a student enrolled in that lesson's class. */
    @Transactional(readOnly = true)
    public List<MaterialDto> listLessonMaterialsForStudent(Long studentId, Long lessonId) {
        assertStudentInLessonClass(studentId, lessonId);
        return activeMaterialsInOrder(
                lessonMaterialRepository.findByIdLessonIdOrderByOrderIndexAsc(lessonId).stream()
                        .map(lm -> lm.getId().getMaterialId())
                        .toList());
    }

    /**
     * A fresh resolvable URL for one material, for a student — but ONLY if that material is attached to
     * the given lesson and the student is enrolled in its class. Scoping by lesson (not by material id
     * alone) means a student cannot probe for arbitrary material ids: the attach link is the capability.
     */
    @Transactional(readOnly = true)
    public String refreshLessonMaterialUrlForStudent(Long studentId, Long lessonId, Long materialId) {
        assertStudentInLessonClass(studentId, lessonId);
        if (!lessonMaterialRepository.existsByIdLessonIdAndIdMaterialId(lessonId, materialId)) {
            throw new NotFoundException("Không tìm thấy tài liệu.");
        }
        Material m = materialRepository.findById(materialId)
                .filter(x -> STATUS_ACTIVE.equals(x.getStatus()))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài liệu."));
        return resolveUrl(m);
    }

    /** Active materials for the given ids, keeping the given order and dropping archived/deleted ones. */
    private List<MaterialDto> activeMaterialsInOrder(List<Long> orderedIds) {
        if (orderedIds.isEmpty()) return List.of();
        Map<Long, Material> byId = materialRepository.findAllById(orderedIds).stream()
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .collect(java.util.stream.Collectors.toMap(Material::getId, m -> m));
        return orderedIds.stream()
                .map(byId::get)
                .filter(java.util.Objects::nonNull)
                .map(this::toDto)
                .toList();
    }

    private void assertStudentInLessonClass(Long studentId, Long lessonId) {
        ClassLesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bài học."));
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(lesson.getClassId(), studentId)) {
            throw new ForbiddenException("Bạn không thuộc lớp của bài học này.");
        }
    }

    /** Loads the lesson, resolves its class, and enforces the same attach authz as classes. */
    private TeacherClass resolveClassForLesson(User caller, Long lessonId) {
        ClassLesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bài học."));
        TeacherClass tc = teacherClassRepository.findById(lesson.getClassId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học."));
        if (!canAttachToClass(caller, tc)) {
            throw new ForbiddenException("Bạn không có quyền thao tác tài liệu cho bài học này.");
        }
        return tc;
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

    // --------------------------------------------------------------- owner / folder / metadata helpers

    /** Resolves the target owner (PERSONAL of the caller, or the caller's ORG while ACTIVE there). */
    private OwnerRef resolveOwner(User caller, String scopeRaw) {
        String scope = scopeRaw == null ? SCOPE_PERSONAL : scopeRaw.trim().toUpperCase(Locale.ROOT);
        if (SCOPE_PERSONAL.equals(scope)) {
            return new OwnerRef(SCOPE_PERSONAL, caller.getId(), null);
        }
        if (SCOPE_ORG.equals(scope)) {
            Long orgId = caller.getOrgId();
            if (orgId == null || !isActiveMember(caller.getId(), orgId)) {
                throw new ForbiddenException("Bạn không thuộc tổ chức nào để tạo tài liệu cấp tổ chức.");
            }
            return new OwnerRef(SCOPE_ORG, null, orgId);
        }
        throw new BadRequestException("Phạm vi không hợp lệ: " + scopeRaw);
    }

    private OwnerRef ownerOf(Material m) {
        return new OwnerRef(m.getOwnerScope(), m.getTeacherId(), m.getOrgId());
    }

    /** S3 key prefix per owner: {@code materials/{p-<teacherId>|<orgId>}/{yyyy}/{MM}} (usage/cleanup by prefix). */
    private String ownerPrefix(OwnerRef owner) {
        String seg = SCOPE_PERSONAL.equals(owner.scope())
                ? ("p-" + owner.teacherId()) : String.valueOf(owner.orgId());
        LocalDate now = LocalDate.now();
        return String.format(Locale.ROOT, "%s/%s/%04d/%02d",
                STORAGE_CATEGORY, seg, now.getYear(), now.getMonthValue());
    }

    private String buildPresignKey(OwnerRef owner, String filename) {
        return ownerPrefix(owner) + "/" + UUID.randomUUID() + extensionOf(filename);
    }

    private static String extensionOf(String filename) {
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf('.')).toLowerCase(Locale.ROOT); // includes the dot
        }
        return "";
    }

    /** Normalizes free tags: trim, drop blanks, dedupe. Never null (matches the NOT NULL text[] column). */
    private static String[] toTagArray(List<String> tags) {
        if (tags == null) return new String[0];
        return tags.stream()
                .filter(t -> t != null && !t.isBlank())
                .map(String::trim)
                .distinct()
                .toArray(String[]::new);
    }

    private static Integer clampDuration(Integer d) {
        if (d == null) return null;
        if (d < 0) return 0;
        return Math.min(d, MAX_DURATION_SECONDS);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String normalize(String s) {
        return isBlank(s) ? null : s.trim();
    }

    private static String normalizeUpper(String s) {
        return isBlank(s) ? null : s.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * True if the media type — ignoring any parameters (e.g. "; charset=utf-8") and case — is one we refuse
     * to store because a browser could execute/render it inline from the S3 origin (stored XSS). The MIME
     * value is client-controlled on both the multipart part and the presigned PUT, so this runs at create,
     * presign, and complete.
     */
    private static boolean isBlockedMime(String contentType) {
        if (contentType == null) return false;
        String mediaType = contentType.toLowerCase(Locale.ROOT).trim();
        int semi = mediaType.indexOf(';');
        if (semi >= 0) mediaType = mediaType.substring(0, semi).trim();
        return BLOCKED_MIME.contains(mediaType);
    }

    /**
     * A material may only be filed under a folder of the SAME owner (no cross-owner filing). Skips when
     * {@code folderId} is null (unfiled).
     */
    private void assertFolderAssignable(User caller, OwnerRef materialOwner, Long folderId) {
        if (folderId == null) return;
        MaterialFolder f = folderRepository.findById(folderId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thư mục."));
        if (!canAccessFolder(caller, f)) {
            throw new ForbiddenException("Bạn không có quyền dùng thư mục này.");
        }
        boolean sameOwner = f.getOwnerScope().equals(materialOwner.scope())
                && Objects.equals(f.getTeacherId(), materialOwner.teacherId())
                && Objects.equals(f.getOrgId(), materialOwner.orgId());
        if (!sameOwner) {
            throw new BadRequestException("Thư mục không cùng phạm vi sở hữu với tài liệu.");
        }
    }

    private boolean canAccessFolder(User caller, MaterialFolder f) {
        if (SCOPE_PERSONAL.equals(f.getOwnerScope())) {
            return caller.getId().equals(f.getTeacherId());
        }
        return f.getOrgId() != null
                && f.getOrgId().equals(caller.getOrgId())
                && isActiveMember(caller.getId(), f.getOrgId());
    }

    private boolean canManageFolder(User caller, MaterialFolder f) {
        if (SCOPE_PERSONAL.equals(f.getOwnerScope())) {
            return caller.getId().equals(f.getTeacherId());
        }
        return canAccessFolder(caller, f)
                && (caller.getId().equals(f.getCreatedBy()) || isOrgAdmin(caller.getId(), f.getOrgId()));
    }

    /** Owner tuple used across create/link/presign/folder — DRYs the PERSONAL/ORG resolution. */
    private record OwnerRef(String scope, Long teacherId, Long orgId) {
        void applyTo(Material.MaterialBuilder b) {
            b.ownerScope(scope).teacherId(teacherId).orgId(orgId);
        }
    }

    private MaterialDto toDto(Material m) {
        return MaterialDto.from(m, resolveUrl(m));
    }

    /**
     * Client-facing URL: a short-lived presigned GET for file materials (private — lets the owner / ACTIVE
     * org member view/stream in-browser without a world-readable object; Range-capable so {@code <audio>}
     * seeks), or the raw external URL for {@code kind=LINK}. Single QĐ-1 abstraction point for a later
     * CloudFront swap. Re-signed on every list/read.
     */
    private String resolveUrl(Material m) {
        return (m.getObjectKey() != null)
                ? s3StorageService.presignedGetUrl(m.getObjectKey(), MATERIAL_URL_TTL)
                : m.getExternalUrl();
    }

    private static String kindOf(MultipartFile file) {
        return kindFromFilename(file.getOriginalFilename());
    }

    private static String kindFromFilename(String name) {
        String ext = "";
        if (name != null && name.contains(".")) {
            ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        }
        return switch (ext) {
            case "pptx", "ppt" -> "PPTX";
            case "pdf" -> "PDF";
            case "docx", "doc" -> "DOCX";
            case "png", "jpg", "jpeg", "gif", "webp" -> "IMAGE";
            case "mp3", "m4a", "wav", "ogg", "aac", "flac" -> "AUDIO";
            case "mp4", "mov", "webm", "mkv" -> "VIDEO";
            default -> "OTHER";
        };
    }
}
