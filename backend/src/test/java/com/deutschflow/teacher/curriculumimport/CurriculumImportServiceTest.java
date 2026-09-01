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
import com.deutschflow.teacher.curriculumimport.ocr.OcrProvider;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Everything that must be true before and around building a draft: who may ask for one, what may be
 * imported, and — the property the whole two-phase design rests on — that asking for one changes
 * nothing in the database.
 */
@ExtendWith(MockitoExtension.class)
class CurriculumImportServiceTest {

    @Mock private MaterialService materialService;
    @Mock private S3StorageService s3StorageService;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassSessionRepository classSessionRepository;
    @Mock private AsyncJobService asyncJobService;
    @Mock private CurriculumPreviewWorker previewWorker;

    private CurriculumImportService service;
    private FakeOcr ocr;

    private static final Long TEACHER_ID = 100L;
    private static final Long CLASS_ID = 10L;
    private static final Long MATERIAL_ID = 55L;
    private static final UUID JOB_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");

    private User teacher;

    private static final class FakeOcr implements OcrProvider {
        boolean available = true;
        String text = "";
        int calls;

        @Override public String name() { return "fake"; }
        @Override public boolean isAvailable() { return available; }
        @Override public String ocrPage(byte[] imageBytes, String languageTag) {
            calls++;
            return text;
        }
    }

    @BeforeEach
    void setUp() {
        ocr = new FakeOcr();
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        service = new CurriculumImportService(
                new CurriculumTemplateCatalog(mapper),
                new CurriculumDraftBuilder(),
                new DraftValidator(),
                new PdfTocExtractor(ocr, 8, 600, 100, 40_000_000L, 1),
                new TocParser(),
                materialService,
                s3StorageService,
                classTeacherRepository,
                classSessionRepository,
                asyncJobService,
                previewWorker,
                mapper);

        teacher = new User();
        teacher.setId(TEACHER_ID);

        lenient().when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID))
                .thenReturn(true);
        lenient().when(materialService.requireReadable(any(), anyLong())).thenReturn(pdfMaterial());
        lenient().when(asyncJobService.createJob(anyString(), anyLong()))
                .thenReturn(AsyncJob.builder().id(JOB_ID).jobType(CurriculumImportService.JOB_TYPE)
                        .status(AsyncJob.Status.PENDING.name()).createdByUserId(TEACHER_ID).build());
        lenient().when(classSessionRepository.findByClassIdOrderByStartAt(CLASS_ID)).thenReturn(List.of());
    }

    private static Material pdfMaterial() {
        Material m = new Material();
        m.setId(MATERIAL_ID);
        m.setKind("PDF");
        m.setMimeType("application/pdf");
        m.setObjectKey("materials/teacher/100/book.pdf");
        m.setTitle("Netzwerk neu A1");
        m.setSizeBytes(16L * 1024 * 1024);
        return m;
    }

    private static CurriculumImportConfig templateConfig() {
        return new CurriculumImportConfig("netzwerk-neu-a1", MATERIAL_ID, "A1", 3, 4, true, null, null);
    }

    // ── Gate: who and what ──────────────────────────────────────────────────

    @Test
    void queuesAJobForATeacherOfTheClass() {
        UUID jobId = service.startPreview(teacher, CLASS_ID, templateConfig());

        assertThat(jobId).isEqualTo(JOB_ID);
        verify(previewWorker).submit(any(Runnable.class));
    }

    @Test
    void theAsyncWorkerDoesNotDependOnTheServiceThatDispatchesToIt() {
        // A service -> worker -> service constructor cycle fails Spring Boot startup outright
        // (circular references are disallowed by default), and @Lazy on a Lombok-generated
        // constructor parameter would not save it — Lombok only copies annotations listed in
        // lombok.copyableAnnotations, and this project ships no lombok.config. Nothing else in the
        // suite would catch that, because a boot failure needs a Spring context.
        assertThat(CurriculumPreviewWorker.class.getDeclaredConstructors()[0].getParameterTypes())
                .as("worker must not take the service it runs work for")
                .doesNotContain(CurriculumImportService.class);
    }

    @Test
    void theDispatchedTaskIsWhatActuallyRunsThePreview() {
        // Prove the lambda handed to the worker really performs the preview, so "queued" cannot
        // quietly mean "nothing happens".
        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        service.startPreview(teacher, CLASS_ID, templateConfig());
        verify(previewWorker).submit(task.capture());

        task.getValue().run();

        verify(asyncJobService).completeJob(any(), anyString());
    }

    @Test
    void refusesAClassTheTeacherDoesNotTeach() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID, templateConfig()))
                .isInstanceOf(ForbiddenException.class);

        verify(asyncJobService, never()).createJob(anyString(), anyLong());
        verify(previewWorker, never()).submit(any(Runnable.class));
    }

    @Test
    void refusesAMaterialTheTeacherMayNotRead() {
        when(materialService.requireReadable(teacher, MATERIAL_ID))
                .thenThrow(new ForbiddenException("Bạn không có quyền truy cập tài liệu này."));

        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID, templateConfig()))
                .isInstanceOf(ForbiddenException.class);

        verify(previewWorker, never()).submit(any(Runnable.class));
    }

    @Test
    void refusesAMaterialThatIsNotAPdf() {
        Material docx = pdfMaterial();
        docx.setKind("DOCX");
        docx.setMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        when(materialService.requireReadable(teacher, MATERIAL_ID)).thenReturn(docx);

        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID, templateConfig()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("PDF");
    }

    @Test
    void refusesAMaterialLargerThanTheUploadCeiling() {
        Material huge = pdfMaterial();
        huge.setSizeBytes(40L * 1024 * 1024);
        when(materialService.requireReadable(teacher, MATERIAL_ID)).thenReturn(huge);

        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID, templateConfig()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("25");
    }

    @Test
    void refusesARequestWithNoSourceMaterial() {
        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID,
                new CurriculumImportConfig("netzwerk-neu-a1", null, "A1", 3, 4, true, null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesAnUnknownTemplateBeforeQueueingAnything() {
        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID,
                new CurriculumImportConfig("no-such-book", MATERIAL_ID, "A1", 3, 4, true, null, null)))
                .isInstanceOf(BadRequestException.class);

        verify(asyncJobService, never()).createJob(anyString(), anyLong());
    }

    @Test
    void refusesAbsurdPacingSettings() {
        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID,
                new CurriculumImportConfig("netzwerk-neu-a1", MATERIAL_ID, "A1", 0, 4, true, null, null)))
                .isInstanceOf(BadRequestException.class);

        assertThatThrownBy(() -> service.startPreview(teacher, CLASS_ID,
                new CurriculumImportConfig("netzwerk-neu-a1", MATERIAL_ID, "A1", 3, 99, true, null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    // ── Đọc job: chỉ job CỦA MÌNH và ĐÚNG loại ──────────────────────────────

    private static AsyncJob job(String type, Long owner) {
        return AsyncJob.builder().id(JOB_ID).jobType(type)
                .status(AsyncJob.Status.COMPLETED.name()).createdByUserId(owner)
                .resultPayload("{}").build();
    }

    @Test
    void readsBackTheTeachersOwnImportJob() {
        when(asyncJobService.getJob(JOB_ID))
                .thenReturn(Optional.of(job(CurriculumImportService.JOB_TYPE, TEACHER_ID)));

        assertThat(service.requireOwnJob(teacher, CLASS_ID, JOB_ID).getId()).isEqualTo(JOB_ID);
    }

    @Test
    void refusesAJobOfAnotherFeatureEvenWhenItHasNoOwner() {
        // VIDEO_RENDER_VOCAB / GENERATE_SATELLITE / PREFETCH_SATELLITE được tạo KHÔNG có creator.
        // Nếu chỉ bỏ qua kiểm quyền khi creator null thì endpoint này đọc được payload của chúng.
        when(asyncJobService.getJob(JOB_ID))
                .thenReturn(Optional.of(job("GENERATE_SATELLITE", null)));

        assertThatThrownBy(() -> service.requireOwnJob(teacher, CLASS_ID, JOB_ID))
                .isInstanceOf(com.deutschflow.common.exception.NotFoundException.class);
    }

    @Test
    void refusesAnImportJobWithNoRecordedOwner() {
        when(asyncJobService.getJob(JOB_ID))
                .thenReturn(Optional.of(job(CurriculumImportService.JOB_TYPE, null)));

        assertThatThrownBy(() -> service.requireOwnJob(teacher, CLASS_ID, JOB_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void refusesAnotherTeachersImportJob() {
        when(asyncJobService.getJob(JOB_ID))
                .thenReturn(Optional.of(job(CurriculumImportService.JOB_TYPE, 999L)));

        assertThatThrownBy(() -> service.requireOwnJob(teacher, CLASS_ID, JOB_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void refusesToReadAJobThroughAClassTheTeacherDoesNotTeach() {
        // classId trên đường dẫn phải thực sự được kiểm, không để làm cảnh.
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.requireOwnJob(teacher, CLASS_ID, JOB_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── Preview writes nothing ──────────────────────────────────────────────

    @Test
    void previewNeverTouchesTheCurriculum() {
        service.startPreview(teacher, CLASS_ID, templateConfig());
        service.runPreview(JOB_ID, templateConfig().normalized(),
                "materials/teacher/100/book.pdf", "Netzwerk neu A1", List.of());

        // The service is constructed without any curriculum repository at all — there is no path
        // from a preview to a write. What it does produce is a completed job carrying the draft.
        verify(asyncJobService).completeJob(any(), anyString());
        verify(asyncJobService, never()).failJob(any(), anyString());
    }

    @Test
    void theTemplateRouteProducesTheFullPlanWithoutReadingTheDocument() throws Exception {
        service.runPreview(JOB_ID, templateConfig().normalized(),
                "materials/teacher/100/book.pdf", "Netzwerk neu A1", List.of());

        CurriculumImportPreview preview = completedPreview();
        assertThat(preview.source()).isEqualTo(CurriculumImportPreview.SOURCE_TEMPLATE);
        assertThat(preview.modules()).hasSize(16);
        assertThat(preview.modules().stream().mapToInt(m -> m.lessons().size()).sum()).isEqualTo(40);

        // No download, no OCR: the stored PDF is only ever the provenance of the plan here.
        verify(s3StorageService, never()).downloadBytes(anyString());
        assertThat(ocr.calls).isZero();
    }

    // ── The document route ──────────────────────────────────────────────────

    @Test
    void theDocumentRouteReadsTheContentsPagesAndBuildsTheSamePlanShape() throws Exception {
        ocr.text = """
                1  Erste Schritte                                    6
                sich begrüßen | den Namen nennen | Zahlen nennen | buchstabieren
                Wortschatz    Zahlen | Begrüßungen
                Grammatik     W-Frage | Aussagesatz
                Strategie     Wörter sammeln | Notizen machen
                2  Meine Stadt                                      16
                Orte benennen | nach dem Weg fragen | Wege beschreiben | Verkehrsmittel nennen
                Wortschatz    Orte | Verkehrsmittel
                Grammatik     Artikel | Präpositionen
                Strategie     Karten lesen | Schilder verstehen
                """;
        when(s3StorageService.downloadBytes(anyString())).thenReturn(scannedPdf(3));

        service.runPreview(JOB_ID, documentConfig().normalized(),
                "materials/teacher/100/book.pdf", "Testbuch", List.of());

        CurriculumImportPreview preview = completedPreview();
        assertThat(preview.source()).isEqualTo(CurriculumImportPreview.SOURCE_OCR);
        assertThat(preview.modules()).hasSize(2);
        assertThat(preview.modules().stream().flatMap(m -> m.lessons().stream()))
                .allSatisfy(l -> assertThat(l.estimatedUnits()).isEqualTo(4));
    }

    @Test
    void failsTheJobWithAReadableMessageWhenNothingLooksLikeACurriculum() {
        ocr.text = "Impressum. Alle Rechte vorbehalten.";
        when(s3StorageService.downloadBytes(anyString())).thenReturn(scannedPdf(2));

        service.runPreview(JOB_ID, documentConfig().normalized(),
                "materials/teacher/100/book.pdf", "Testbuch", List.of());

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(asyncJobService).failJob(any(), message.capture());
        assertThat(message.getValue()).contains("giáo trình mẫu");
        verify(asyncJobService, never()).completeJob(any(), anyString());
    }

    @Test
    void failsTheJobWhenTheStoredObjectIsNotActuallyAPdf() {
        when(s3StorageService.downloadBytes(anyString())).thenReturn("<html>gotcha</html>".getBytes());

        service.runPreview(JOB_ID, documentConfig().normalized(),
                "materials/teacher/100/book.pdf", "Testbuch", List.of());

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(asyncJobService).failJob(any(), message.capture());
        assertThat(message.getValue()).contains("PDF");
    }

    @Test
    void aFailingDocumentNeverLeaksItsOwnTextIntoTheErrorShownToTheTeacher() {
        ocr.available = false;
        when(s3StorageService.downloadBytes(anyString())).thenReturn(scannedPdf(2));

        service.runPreview(JOB_ID, documentConfig().normalized(),
                "materials/teacher/100/book.pdf", "Testbuch", List.of());

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(asyncJobService).failJob(any(), message.capture());
        assertThat(message.getValue()).doesNotContain("Impressum").isNotBlank();
    }

    // ── Scheduling ──────────────────────────────────────────────────────────

    @Test
    void withoutAStartDateNoClassScheduleIsEvenConsulted() {
        service.startPreview(teacher, CLASS_ID, templateConfig());

        verify(classSessionRepository, never()).findByClassIdOrderByStartAt(anyLong());
    }

    @Test
    void withAStartDateTheClassesOwnSessionDatesAreUsed() throws Exception {
        when(classSessionRepository.findByClassIdOrderByStartAt(CLASS_ID)).thenReturn(List.of(
                session(LocalDateTime.of(2026, 9, 1, 18, 0)),   // before the start date
                session(LocalDateTime.of(2026, 9, 7, 18, 0)),
                session(LocalDateTime.of(2026, 9, 9, 18, 0))));

        CurriculumImportConfig cfg = new CurriculumImportConfig(
                "netzwerk-neu-a1", MATERIAL_ID, "A1", 3, 4, true, null, LocalDate.of(2026, 9, 5));

        service.startPreview(teacher, CLASS_ID, cfg);

        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        verify(previewWorker).submit(task.capture());
        task.getValue().run();

        // The class's own two upcoming session dates land on the first two sessions, in order; the
        // one before the start date is not used, and the rest of the plan stays undated.
        CurriculumImportPreview p = completedPreview();
        List<com.deutschflow.teacher.curriculumimport.dto.DraftLesson> lessons =
                p.modules().stream().flatMap(m -> m.lessons().stream()).toList();
        assertThat(lessons.get(0).plannedDate()).isEqualTo(LocalDate.of(2026, 9, 7));
        assertThat(lessons.get(1).plannedDate()).isEqualTo(LocalDate.of(2026, 9, 9));
        assertThat(lessons.get(2).plannedDate()).isNull();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static CurriculumImportConfig documentConfig() {
        return new CurriculumImportConfig(null, MATERIAL_ID, "A1", 3, 4, true, null, null);
    }

    private static ClassSession session(LocalDateTime at) {
        ClassSession s = new ClassSession();
        s.setStartAt(at);
        return s;
    }

    private CurriculumImportPreview completedPreview() throws Exception {
        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(asyncJobService).completeJob(any(), payload.capture());
        return new ObjectMapper().findAndRegisterModules()
                .readValue(payload.getValue(), CurriculumImportPreview.class);
    }

    /** A PDF whose pages carry no text — the shape of a scanned book. */
    private static byte[] scannedPdf(int pages) {
        try (PDDocument doc = new PDDocument()) {
            for (int i = 0; i < pages; i++) doc.addPage(new PDPage());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
