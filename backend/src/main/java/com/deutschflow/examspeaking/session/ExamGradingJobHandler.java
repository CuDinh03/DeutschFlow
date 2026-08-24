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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/** Chấm mock chạy nền: bundle từ lượt đã lưu → ExamGradingService → lưu Ergebnisbogen → RESULTS. */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExamGradingJobHandler implements AiJobHandler {

    private final ExamSessionService sessionService;
    private final ExamGradingService gradingService;
    private final SpeakingExamResultRepository resultRepository;
    private final SpeakingExamSessionRepository sessionRepository;
    private final ObjectMapper objectMapper;
    private final ExamBlueprintCatalog blueprintCatalog;
    private final ExamErrorSrsBridge srsBridge;

    @Override
    public String jobType() {
        return ExamSessionService.JOB_TYPE_MOCK_GRADING;
    }

    @Override
    public Map<String, Object> handle(AiJob job) {
        long sessionId = ((Number) job.getPayload().get("sessionId")).longValue();
        ParticipantBundle bundle = sessionService.bundle(sessionId);
        Ergebnisbogen sheet = gradingService.grade(job.getUserId(), bundle, bundle.rubricRef());
        boolean firstResult = persist(sessionId, job.getUserId(), sheet);
        if (firstResult) {
            // Đợt 5a: đổ lỗi Ergebnisbogen vào kho yếu điểm (SRS + stats theo dạng bài).
            // Chỉ lần chấm đầu của phiên — chấm lại (job retry) không được nhân đôi số lần thấy lỗi.
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

    /** @return true nếu đây là kết quả ĐẦU TIÊN của phiên (chưa có row trước đó). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean persist(long sessionId, long userId, Ergebnisbogen sheet) {
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
