package com.deutschflow.examspeaking.session;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobHandler;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.ExamGradingService;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.entity.SpeakingExamResult;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamResultRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.examspeaking.weakness.ExamErrorSrsBridge;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/** Chấm mock chạy nền: bundle từ lượt đã lưu → ExamGradingService → lưu Ergebnisbogen → RESULTS. */
@Component
@Slf4j
public class ExamGradingJobHandler implements AiJobHandler {

    private final ExamSessionService sessionService;
    private final ExamGradingService gradingService;
    private final SpeakingExamResultRepository resultRepository;
    private final SpeakingExamSessionRepository sessionRepository;
    private final ObjectMapper objectMapper;
    private final ExamBlueprintCatalog blueprintCatalog;
    private final ExamErrorSrsBridge srsBridge;
    private final TransactionTemplate requiresNewTx;

    public ExamGradingJobHandler(ExamSessionService sessionService,
                                 ExamGradingService gradingService,
                                 SpeakingExamResultRepository resultRepository,
                                 SpeakingExamSessionRepository sessionRepository,
                                 ObjectMapper objectMapper,
                                 ExamBlueprintCatalog blueprintCatalog,
                                 ExamErrorSrsBridge srsBridge,
                                 PlatformTransactionManager transactionManager) {
        this.sessionService = sessionService;
        this.gradingService = gradingService;
        this.resultRepository = resultRepository;
        this.sessionRepository = sessionRepository;
        this.objectMapper = objectMapper;
        this.blueprintCatalog = blueprintCatalog;
        this.srsBridge = srsBridge;
        // Persist chạy trong transaction TƯỜNG MINH qua TransactionTemplate, không qua @Transactional
        // trên method cùng bean: handle() gọi persist là TỰ-GỌI nên proxy bị bỏ qua — đúng cái bẫy đã
        // giết AiJobWorker.claimJobs suốt 10/06–23/08. Trước bản vá này, save-result và update-session
        // chạy thành hai transaction rời: crash giữa chừng = result đã có nhưng phiên kẹt GRADING.
        this.requiresNewTx = new TransactionTemplate(transactionManager);
        this.requiresNewTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public String jobType() {
        return ExamSessionService.JOB_TYPE_MOCK_GRADING;
    }

    @Override
    public Map<String, Object> handle(AiJob job) {
        long sessionId = ((Number) job.getPayload().get("sessionId")).longValue();
        ParticipantBundle bundle = sessionService.bundle(sessionId);
        Ergebnisbogen sheet = gradingService.grade(job.getUserId(), bundle, bundle.rubricRef());
        boolean firstResult = Boolean.TRUE.equals(
                requiresNewTx.execute(status -> persist(sessionId, job.getUserId(), sheet)));
        if (firstResult) {
            // Đợt 5a: đổ lỗi Ergebnisbogen vào kho yếu điểm (SRS + stats theo dạng bài).
            // Chỉ lần chấm đầu của phiên — chấm lại (regrade) không được nhân đôi số lần thấy lỗi.
            blueprintCatalog.find(sheet.rubricRef().provider(), sheet.rubricRef().level())
                    .ifPresent(bp -> srsBridge.ingestMockErrors(job.getUserId(), bp, sheet.errors()));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sessionId", sessionId);
        out.put("total", sheet.total());
        out.put("totalLow", sheet.totalLow());
        out.put("totalHigh", sheet.totalHigh());
        out.put("max", sheet.maxPoints());
        out.put("passed", sheet.passed());
        return out;
    }

    /**
     * Job chấm đã FAILED (worker gọi sau saveFailed): đưa phiên GRADING → GRADING_FAILED để client
     * thấy lỗi thật và có nút chấm lại, thay vì spinner "đang chấm" vĩnh viễn. Chỉ hạ phiên đang
     * GRADING — nếu persist đã kịp chuyển RESULTS (lỗi xảy ra ở bước sau, ví dụ SRS ingest) thì
     * kết quả đã hợp lệ, không được kéo lùi.
     */
    @Override
    public void onFailure(AiJob job, Exception cause) {
        Object sid = job.getPayload() == null ? null : job.getPayload().get("sessionId");
        if (!(sid instanceof Number n)) {
            return;
        }
        long sessionId = n.longValue();
        requiresNewTx.executeWithoutResult(status ->
                sessionRepository.findById(sessionId)
                        .filter(s -> SpeakingExamSession.STATE_GRADING.equals(s.getState()))
                        .ifPresent(s -> {
                            s.setState(SpeakingExamSession.STATE_GRADING_FAILED);
                            sessionRepository.save(s);
                            log.warn("[ExamSpeaking] session {} → GRADING_FAILED (job {} lỗi: {})",
                                    sessionId, job.getId(), cause.getMessage());
                        }));
    }

    /**
     * Upsert kết quả + chuyển phiên sang RESULTS trong CÙNG một transaction (gọi qua
     * {@link #requiresNewTx}). @return true nếu đây là kết quả ĐẦU TIÊN của phiên.
     */
    private boolean persist(long sessionId, long userId, Ergebnisbogen sheet) {
        Map<String, Object> json = objectMapper.convertValue(sheet, new TypeReference<Map<String, Object>>() {});
        SpeakingExamResult r = resultRepository.findBySessionId(sessionId).orElseGet(SpeakingExamResult::new);
        boolean firstResult = r.getId() == null;
        r.setSessionId(sessionId);
        r.setUserId(userId);
        r.setProvider(sheet.rubricRef().provider().name());
        r.setLevel(sheet.rubricRef().level());
        r.setRubricVersion(sheet.rubricRef().version());
        r.setScoreSheetJson(json);
        r.setTotalPoints(BigDecimal.valueOf(sheet.total()));
        r.setTotalLow(BigDecimal.valueOf(sheet.totalLow()));
        r.setTotalHigh(BigDecimal.valueOf(sheet.totalHigh()));
        r.setMaxPoints(BigDecimal.valueOf(sheet.maxPoints()));
        r.setPassed(sheet.passed());
        resultRepository.save(r);
        sessionRepository.findById(sessionId).ifPresent(s -> {
            s.setState(SpeakingExamSession.STATE_RESULTS);
            sessionRepository.save(s);
        });
        log.info("[ExamSpeaking] result saved session={} total={} passed={}", sessionId, sheet.total(), sheet.passed());
        return firstResult;
    }
}
