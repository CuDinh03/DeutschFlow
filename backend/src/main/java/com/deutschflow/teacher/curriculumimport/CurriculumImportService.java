package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.service.MaterialService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportConfig;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportPreview;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Builds the reviewable draft. Writes nothing to the curriculum — that is
 * {@link CurriculumImportCommitService}'s job, and only after the teacher says so.
 *
 * <p>Work runs on a background job because the OCR route rasterises and recognises several pages;
 * the template route is instant but takes the same path so the client has one contract to implement.
 *
 * <p>The uploaded document is treated as untrusted throughout: it is read for text, matched against
 * fixed patterns, and never logged. Only pedagogical metadata — titles, topic labels, goals, page
 * numbers — reaches the draft.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CurriculumImportService {

    private static final int MAX_SESSIONS_PER_CHAPTER = 10;
    private static final int MAX_UNITS_PER_SESSION = 20;
    /** Matches the material library's own upload ceiling. */
    private static final long MAX_PDF_BYTES = 25L * 1024 * 1024;

    public static final String JOB_TYPE = "CURRICULUM_IMPORT_PREVIEW";

    private final CurriculumTemplateCatalog templateCatalog;
    private final CurriculumDraftBuilder draftBuilder;
    private final DraftValidator draftValidator;
    private final PdfTocExtractor tocExtractor;
    private final TocParser tocParser;
    private final MaterialService materialService;
    private final S3StorageService s3StorageService;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassSessionRepository classSessionRepository;
    private final AsyncJobService asyncJobService;
    private final CurriculumPreviewWorker previewWorker;
    private final ObjectMapper objectMapper;

    @Value("${curriculum.import.ocr.language:deu}")
    private String ocrLanguage;

    /**
     * Validates the request, checks both permissions, and queues the work.
     *
     * <p>Everything that can fail fast fails here, synchronously, so the teacher sees a real error
     * instead of a job that quietly dies a few seconds later.
     */
    public UUID startPreview(User caller, Long classId, CurriculumImportConfig raw) {
        CurriculumImportConfig config = validateConfig(raw);
        assertTeacherOwns(caller.getId(), classId);

        Material material = materialService.requireReadable(caller, config.materialId());
        assertImportablePdf(material);

        // NOT @Transactional on purpose. createJob commits in its own transaction, so the job row
        // is already visible when the worker looks it up; inside an outer transaction the worker
        // would race the commit and its PROCESSING update would silently find nothing.
        AsyncJob job = asyncJobService.createJob(JOB_TYPE, caller.getId());
        List<LocalDate> scheduleDates = resolveScheduleDates(classId, config.startDate());

        // Dispatched through a separate bean: an @Async method called on `this` runs inline,
        // because self-invocation never crosses the proxy that makes it asynchronous. The worker
        // takes the work as a task rather than depending on this service, so the beans stay acyclic.
        UUID jobId = job.getId();
        String objectKey = material.getObjectKey();
        String materialTitle = material.getTitle();
        previewWorker.submit(() -> runPreview(jobId, config, objectKey, materialTitle, scheduleDates));
        return jobId;
    }

    /** Runs one preview to completion and reports it on the job. Invoked from {@link CurriculumPreviewWorker}. */
    public void runPreview(UUID jobId, CurriculumImportConfig config,
                           String objectKey, String materialTitle, List<LocalDate> scheduleDates) {
        asyncJobService.updateStatus(jobId, AsyncJob.Status.PROCESSING);
        try {
            CurriculumImportPreview preview = config.templateId() != null && !config.templateId().isBlank()
                    ? fromTemplate(config, scheduleDates, materialTitle)
                    : fromDocument(config, scheduleDates, objectKey, materialTitle);

            asyncJobService.completeJob(jobId, objectMapper.writeValueAsString(preview));
            log.info("Curriculum import preview {} ready: {} modules, {} sessions (source={})",
                    jobId, preview.modules().size(),
                    preview.modules().stream().mapToInt(m -> m.lessons().size()).sum(),
                    preview.source());
        } catch (BadRequestException e) {
            asyncJobService.failJob(jobId, e.getMessage());
        } catch (Exception e) {
            // The message is ours, never the document's: a PDF must not be able to choose what the
            // teacher reads on screen.
            log.error("Curriculum import preview {} failed", jobId, e);
            asyncJobService.failJob(jobId, "Không phân tích được tài liệu. Hãy thử lại hoặc chọn giáo trình mẫu.");
        }
    }

    // ── The two routes ──────────────────────────────────────────────────────

    private CurriculumImportPreview fromTemplate(CurriculumImportConfig config,
                                                 List<LocalDate> scheduleDates,
                                                 String materialTitle) {
        CurriculumTemplate template = templateCatalog.require(config.templateId());
        return revalidate(draftBuilder.build(template, config, scheduleDates, materialTitle));
    }

    private CurriculumImportPreview fromDocument(CurriculumImportConfig config,
                                                 List<LocalDate> scheduleDates,
                                                 String objectKey,
                                                 String materialTitle) {
        byte[] pdf = s3StorageService.downloadBytes(objectKey);
        if (pdf == null || pdf.length == 0) {
            throw new BadRequestException("Không tải được tài liệu từ thư viện.");
        }
        if (pdf.length > MAX_PDF_BYTES) {
            throw new BadRequestException("Tài liệu vượt quá giới hạn "
                    + (MAX_PDF_BYTES / 1024 / 1024) + " MB.");
        }
        assertPdfSignature(pdf);

        PdfTocExtractor.Extraction extraction = tocExtractor.extract(pdf, ocrLanguage);
        TocParser.TocParseResult parsed =
                tocParser.parse(extraction.text(), config.cefrLevel(), materialTitle);

        CurriculumImportPreview draft =
                draftBuilder.build(parsed.template(), config, scheduleDates, materialTitle);

        List<String> warnings = new ArrayList<>(extraction.warnings());
        warnings.addAll(parsed.warnings());
        warnings.addAll(draft.warnings());
        if (!parsed.confident()) {
            warnings.add("Kết quả đọc mục lục có độ tin cậy thấp — hãy kiểm tra và sửa bản nháp "
                    + "trước khi nhập.");
        }

        return revalidate(new CurriculumImportPreview(
                draft.sourceMaterialId(),
                draft.sourceFileName(),
                draft.detectedTitle(),
                draft.detectedLevel(),
                CurriculumImportPreview.SOURCE_OCR,
                List.copyOf(warnings),
                draft.modules()));
    }

    /**
     * Runs the draft through the same gate commit uses. A preview that could not be written is a
     * trap: the teacher would edit it for ten minutes and then be told no.
     */
    private CurriculumImportPreview revalidate(CurriculumImportPreview preview) {
        if (preview.modules().isEmpty()) {
            throw new BadRequestException(
                    "Không nhận diện được nội dung giáo trình trong tài liệu. Hãy chọn một giáo trình mẫu.");
        }
        List<DraftModule> checked = draftValidator.validate(preview.modules());
        return new CurriculumImportPreview(
                preview.sourceMaterialId(), preview.sourceFileName(), preview.detectedTitle(),
                preview.detectedLevel(), preview.source(), preview.warnings(), checked);
    }

    // ── Validation ──────────────────────────────────────────────────────────

    private CurriculumImportConfig validateConfig(CurriculumImportConfig raw) {
        if (raw == null) {
            throw new BadRequestException("Thiếu cấu hình nhập.");
        }
        CurriculumImportConfig c = raw.normalized();
        if (c.materialId() == null) {
            throw new BadRequestException("Hãy chọn tài liệu nguồn trong Thư viện tài liệu.");
        }
        if (c.sessionsPerChapter() < 1 || c.sessionsPerChapter() > MAX_SESSIONS_PER_CHAPTER) {
            throw new BadRequestException("Số buổi mỗi Kapitel phải nằm trong khoảng 1–"
                    + MAX_SESSIONS_PER_CHAPTER + ".");
        }
        if (c.estimatedUnitsPerSession() < 1 || c.estimatedUnitsPerSession() > MAX_UNITS_PER_SESSION) {
            throw new BadRequestException("Số tiết mỗi buổi phải nằm trong khoảng 1–"
                    + MAX_UNITS_PER_SESSION + ".");
        }
        // Rejects an unknown template id before a job is created rather than inside the worker.
        if (c.templateId() != null && !c.templateId().isBlank()) {
            templateCatalog.require(c.templateId());
        }
        return c;
    }

    /** Filename is a hint, not evidence — the kind recorded at upload time is what decides. */
    private static void assertImportablePdf(Material material) {
        boolean isPdf = "PDF".equalsIgnoreCase(material.getKind())
                || (material.getMimeType() != null
                    && material.getMimeType().toLowerCase().contains("pdf"));
        if (!isPdf) {
            throw new BadRequestException("Chỉ nhập được từ tài liệu PDF.");
        }
        if (material.getObjectKey() == null || material.getObjectKey().isBlank()) {
            throw new BadRequestException("Tài liệu này không có tệp đính kèm để đọc.");
        }
        if (material.getSizeBytes() != null && material.getSizeBytes() > MAX_PDF_BYTES) {
            throw new BadRequestException("Tài liệu vượt quá giới hạn "
                    + (MAX_PDF_BYTES / 1024 / 1024) + " MB.");
        }
    }

    /** %PDF- magic bytes: the stored object must really be what the record claims. */
    private static void assertPdfSignature(byte[] bytes) {
        boolean ok = bytes.length >= 5
                && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F'
                && bytes[4] == '-';
        if (!ok) {
            throw new BadRequestException("Tệp không phải PDF hợp lệ.");
        }
    }

    private void assertTeacherOwns(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền với lớp học này");
        }
    }

    /**
     * The class's own scheduled sessions from {@code startDate} onwards.
     *
     * <p>Dates come from the timetable the centre already keeps, never from a guessed cadence: with
     * no start date, or a class whose schedule has not been set up, every lesson stays undated and
     * the teacher fills them in. Inventing a weekly rhythm would silently misdate a plan that a
     * three-sessions-a-week class actually follows.
     */
    private List<LocalDate> resolveScheduleDates(Long classId, LocalDate startDate) {
        if (startDate == null) {
            return List.of();
        }
        LocalDateTime from = startDate.atStartOfDay();
        return classSessionRepository.findByClassIdOrderByStartAt(classId).stream()
                .filter(s -> s.getStartAt() != null && !s.getStartAt().isBefore(from))
                .map(s -> s.getStartAt().toLocalDate())
                .distinct()
                .toList();
    }
}
