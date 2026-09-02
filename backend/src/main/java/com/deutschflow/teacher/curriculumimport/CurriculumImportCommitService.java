package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitRequest;
import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitResult;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportPreview;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Writes an approved curriculum draft into a class — all of it or none of it.
 *
 * <p>Three guarantees shape this feature:
 *
 * <ul>
 *   <li><b>Additive.</b> Existing modules and lessons are never modified or deleted. New rows are
 *       appended after whatever the class already has, so a teacher who imports into a class they
 *       have already started keeps their work.</li>
 *   <li><b>Atomic.</b> One transaction covers the whole curriculum ({@link CurriculumImportWriter}).
 *       A failure at lesson thirty-nine cannot leave a half-built plan behind.</li>
 *   <li><b>Idempotent.</b> The client's key is stored in that same transaction, so a retry after a
 *       timeout replays the original answer instead of importing a second copy.</li>
 * </ul>
 *
 * <p>This class deliberately holds NO transaction of its own. A unique-key collision has to be
 * observed from OUTSIDE the failed transaction: once a constraint fires, that transaction is
 * rollback-only and cannot be used to read the winner's result.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CurriculumImportCommitService {

    private final CurriculumModuleRepository moduleRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final CurriculumImportCommitRepository commitRepository;
    private final CurriculumImportWriter writer;
    private final MaterialService materialService;
    private final CurriculumImportService importService;
    private final DraftValidator draftValidator;
    private final ObjectMapper objectMapper;

    /** Khớp `curriculum_import_commit.idempotency_key VARCHAR(120)` (V299). Chặn ở đây để
     *  một khoá quá dài thành 400 nói đúng nguyên nhân, thay vì để Postgres ném 22001 rồi
     *  bị nhánh xử lý tranh chấp bên dưới hiểu nhầm thành "có người giành cùng khoá". */
    private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 120;

    public CurriculumImportCommitResult commit(User caller, Long classId, CurriculumImportCommitRequest req) {
        if (req == null) {
            throw new BadRequestException("Thiếu dữ liệu nhập.");
        }
        String key = req.idempotencyKey() == null ? "" : req.idempotencyKey().trim();
        if (key.isEmpty()) {
            throw new BadRequestException("Thiếu idempotencyKey — không thể bảo đảm chống nhập trùng.");
        }
        if (key.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw new BadRequestException(
                    "idempotencyKey vượt quá " + MAX_IDEMPOTENCY_KEY_LENGTH + " ký tự.");
        }
        if (req.previewJobId() == null) {
            throw new BadRequestException("Thiếu previewJobId — không xác định được bản nháp nguồn.");
        }
        assertTeacherOwns(caller.getId(), classId);

        // Replay before any work: a retry must cost nothing and must not re-check anything that
        // might have changed since the original commit.
        var existing = commitRepository.findByClassIdAndIdempotencyKey(classId, key);
        if (existing.isPresent()) {
            return replay(existing.get());
        }

        // Provenance is READ, never accepted. requireOwnJob re-applies the class, job-type and
        // ownership checks, and the material id comes out of the preview's own result — so the
        // source recorded against this import is the document that actually produced the draft.
        Long sourceMaterialId = sourceMaterialOf(caller, classId, req.previewJobId());

        // The teacher must still be allowed to read it AT COMMIT TIME: a material can be archived or
        // its org membership revoked between analysing and confirming.
        if (sourceMaterialId != null) {
            materialService.requireReadable(caller, sourceMaterialId);
        }

        List<DraftModule> modules = draftValidator.validate(req.modules());
        String onDuplicate = normalizeDuplicatePolicy(req.onDuplicateModule());
        assertNoUnhandledDuplicates(classId, modules, onDuplicate);

        try {
            return writer.write(classId, caller.getId(), key, sourceMaterialId, modules, onDuplicate);
        } catch (DataIntegrityViolationException e) {
            // Only ONE reading of this exception is safe to act on: another request holding the same
            // key won the race, so its transaction wrote the curriculum and ours rolled back. That
            // is provable — the row is now there. Any other integrity failure (a bad foreign key, a
            // CHECK, a value too long for its column) must surface as itself; dressing it up as a
            // concurrency conflict hides a real defect from both the teacher and the logs.
            var winner = commitRepository.findByClassIdAndIdempotencyKey(classId, key);
            if (winner.isEmpty()) {
                log.error("Curriculum import into class {} failed on a data error unrelated to the "
                        + "idempotency key", classId, e);
                throw e;
            }
            log.info("Curriculum import key {} for class {} was claimed concurrently — replaying", key, classId);
            return replay(winner.get());
        }
    }

    /**
     * The material the preview actually read, taken from that job's stored result.
     *
     * <p>Deliberately not a field on the request: the draft's content is the teacher's to edit, but
     * WHERE it came from is a fact of the analysis, and a client that could state it would be able
     * to file a curriculum built from one book under another book's name.
     */
    private Long sourceMaterialOf(User caller, Long classId, java.util.UUID previewJobId) {
        AsyncJob job = importService.requireOwnJob(caller, classId, previewJobId);
        if (!AsyncJob.Status.COMPLETED.name().equals(job.getStatus()) || job.getResultPayload() == null) {
            throw new BadRequestException("Bản nháp chưa phân tích xong — hãy chờ rồi nhập lại.");
        }
        try {
            return objectMapper.readValue(job.getResultPayload(), CurriculumImportPreview.class)
                    .sourceMaterialId();
        } catch (JsonProcessingException e) {
            log.warn("Preview job {} has an unreadable payload", previewJobId, e);
            throw new BadRequestException("Không đọc được bản nháp nguồn — hãy phân tích lại.");
        }
    }

    /**
     * Reports title clashes up front when the teacher asked to be told about them.
     *
     * <p>Checks the draft against ITSELF as well as against the class: two draft modules that ended
     * up with the same title after hand-editing are as much a clash as one colliding with an
     * existing module, and letting the writer quietly suffix the second would contradict the
     * "stop and tell me" the teacher chose.
     */
    private void assertNoUnhandledDuplicates(Long classId, List<DraftModule> modules, String onDuplicate) {
        if (!CurriculumImportCommitRequest.ON_DUPLICATE_FAIL.equals(onDuplicate)) {
            return;
        }
        Set<String> taken = moduleRepository.findByClassIdOrderByOrderIndexAsc(classId).stream()
                .map(m -> CurriculumImportWriter.normalizeTitle(m.getTitle()))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<String> clashes = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (DraftModule m : modules) {
            String normalized = CurriculumImportWriter.normalizeTitle(m.title());
            boolean clashesWithClass = taken.contains(normalized);
            boolean clashesWithDraft = !seen.add(normalized);
            if ((clashesWithClass || clashesWithDraft) && !clashes.contains(m.title())) {
                clashes.add(m.title());
            }
        }
        if (!clashes.isEmpty()) {
            // Reported, not resolved: renaming or skipping is the teacher's decision, and making it
            // for them is how an import quietly buries a module they still teach from.
            throw new ConflictException("Lớp đã có module trùng tên: " + String.join(", ", clashes)
                    + ". Hãy chọn bỏ qua hoặc đổi tên trước khi nhập.");
        }
    }

    private CurriculumImportCommitResult replay(CurriculumImportCommitRecord record) {
        try {
            CurriculumImportCommitResult stored =
                    objectMapper.readValue(record.getResultPayload(), CurriculumImportCommitResult.class);
            return new CurriculumImportCommitResult(stored.modulesCreated(), stored.lessonsCreated(),
                    stored.moduleIds(), stored.skippedModuleTitles(), true);
        } catch (JsonProcessingException e) {
            // The counters are stored as columns too, so a payload we cannot parse still yields a
            // truthful answer rather than a 500 on an operation that already succeeded.
            log.warn("Unreadable curriculum import payload for commit {} — replaying from columns", record.getId());
            return new CurriculumImportCommitResult(record.getModulesCreated(), record.getLessonsCreated(),
                    List.of(), List.of(), true);
        }
    }

    private void assertTeacherOwns(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền với lớp học này");
        }
    }

    private static String normalizeDuplicatePolicy(String raw) {
        if (raw == null || raw.isBlank()) return CurriculumImportCommitRequest.ON_DUPLICATE_FAIL;
        String v = raw.trim().toUpperCase(Locale.ROOT);
        return switch (v) {
            case CurriculumImportCommitRequest.ON_DUPLICATE_SKIP,
                 CurriculumImportCommitRequest.ON_DUPLICATE_RENAME,
                 CurriculumImportCommitRequest.ON_DUPLICATE_FAIL -> v;
            default -> throw new BadRequestException("Cách xử lý module trùng tên không hợp lệ: " + raw);
        };
    }
}
