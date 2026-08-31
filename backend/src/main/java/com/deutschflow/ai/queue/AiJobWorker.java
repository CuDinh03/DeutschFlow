package com.deutschflow.ai.queue;

import com.deutschflow.curriculum.service.SkillTreeService;
import com.deutschflow.speaking.ai.GroqWhisperClient;
import com.deutschflow.speaking.ai.GroqWhisperClient.TranscribeResult;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

/**
 * Background worker: mỗi 2 giây lấy tối đa 5 job PENDING
 * xử lý AI (Whisper + Groq), lưu kết quả và push SSE về browser.
 *
 * Thread-safety: FOR UPDATE SKIP LOCKED đảm bảo không có 2 worker
 * nào xử lý cùng 1 job dù Spring chạy nhiều threads.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiJobWorker {

    private static final int BATCH_SIZE = 5;

    private final AiJobRepository aiJobRepository;
    private final AiJobSseRegistry sseRegistry;
    private final SkillTreeService skillTreeService;
    private final GroqWhisperClient groqWhisperClient;
    private final AiUsageLedgerService ledgerService;
    private final ObjectMapper objectMapper;
    /** Handler cắm được (module mới), tra theo jobType; các handler cũ giữ nguyên trong switch. */
    private final java.util.List<AiJobHandler> pluggableHandlers;
    private final PlatformTransactionManager transactionManager;

    /**
     * Chỉ nhận job đủ mới. Chốt chặn để sự cố 10/06–23/08 không lặp lại: khi worker chết một thời
     * gian dài, backlog PENDING tích lại; nếu claim không lọc tuổi thì lúc worker sống lại nó sẽ
     * gọi AI thật cho hàng loạt job mà người học đã rời phiên từ lâu — tốn token, dễ đụng rate
     * limit. Job quá hạn được {@link StaleAiJobExpirer} chuyển sang FAILED để không kẹt PENDING.
     */
    @Value("${app.ai-jobs.max-age-days:7}")
    private int maxAgeDays;

    @Scheduled(fixedDelay = 2000)
    public void processPendingJobs() {
        // Claim jobs in a short transaction, then release the connection before the AI calls.
        // BUG ĐÃ VÁ (23/08): gọi this.claimJobs() là tự-gọi trong cùng bean → @Transactional(REQUIRES_NEW) KHÔNG có hiệu
        // lực (proxy bị bỏ qua) → bulkUpdateStatus (@Modifying) ném TransactionRequiredException mỗi 2s và worker
        // KHÔNG BAO GIỜ claim được job (từ a7e48b28 10/06). Bọc bằng TransactionTemplate REQUIRES_NEW tường minh.
        List<AiJob> jobs = claimInNewTransaction();
        if (jobs.isEmpty()) return;

        for (AiJob job : jobs) {
            try {
                Map<String, Object> result = switch (job.getJobType()) {
                    case AiJob.TYPE_PRONUNCIATION_EVAL -> handlePronunciationEval(job);
                    case AiJob.TYPE_INTERVIEW_REPORT   -> handleInterviewReport(job);
                    default -> dispatchPluggable(job);
                };

                saveCompleted(job, result);
                sseRegistry.complete(job.getId(), result);
                log.info("[Worker] Completed jobId={} type={}", job.getId(), job.getJobType());

            } catch (Exception e) {
                log.error("[Worker] Failed jobId={}: {}", job.getId(), e.getMessage(), e);
                saveFailed(job, e.getMessage());
                notifyHandlerFailure(job, e);
                sseRegistry.error(job.getId(), "Đánh giá thất bại. Vui lòng thử lại.");
            }
        }
    }

    private Map<String, Object> dispatchPluggable(AiJob job) throws Exception {
        AiJobHandler h = findPluggable(job.getJobType());
        if (h != null) {
            return h.handle(job);
        }
        return Map.of("error", "Unknown job type: " + job.getJobType());
    }

    /**
     * Báo module chủ job rằng job đã FAILED, để nó gỡ trạng thái domain (phiên GRADING → lỗi).
     * Chạy SAU saveFailed và nuốt mọi lỗi: onFailure hỏng không được phép che mất trạng thái FAILED
     * của job — sweep định kỳ của module chủ là lưới đỡ cuối cho trường hợp đó.
     */
    private void notifyHandlerFailure(AiJob job, Exception cause) {
        AiJobHandler h = findPluggable(job.getJobType());
        if (h == null) {
            return;
        }
        try {
            h.onFailure(job, cause);
        } catch (Exception onFailureError) {
            log.error("[Worker] onFailure của handler {} cũng lỗi cho jobId={}: {}",
                    job.getJobType(), job.getId(), onFailureError.getMessage(), onFailureError);
        }
    }

    private AiJobHandler findPluggable(String jobType) {
        for (AiJobHandler h : pluggableHandlers) {
            if (h.jobType().equals(jobType)) {
                return h;
            }
        }
        return null;
    }

    private List<AiJob> claimInNewTransaction() {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        List<AiJob> claimed = tx.execute(status -> claimJobs());
        return claimed == null ? List.of() : claimed;
    }

    /** Chỉ gọi qua {@link #claimInNewTransaction()} (hoặc từ ngoài bean qua proxy) — tự-gọi sẽ mất transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<AiJob> claimJobs() {
        List<AiJob> jobs = aiJobRepository.claimPendingJobs(BATCH_SIZE, Math.max(1, maxAgeDays));
        if (!jobs.isEmpty()) {
            List<Long> ids = jobs.stream().map(AiJob::getId).toList();
            aiJobRepository.bulkUpdateStatus(ids, AiJob.STATUS_PROCESSING);
        }
        return jobs;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveCompleted(AiJob job, Map<String, Object> result) {
        job.setResult(result);
        job.setStatus(AiJob.STATUS_COMPLETED);
        aiJobRepository.save(job);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveFailed(AiJob job, String errorMsg) {
        job.setStatus(AiJob.STATUS_FAILED);
        job.setErrorMsg(errorMsg);
        job.setRetryCount(job.getRetryCount() + 1);
        aiJobRepository.save(job);
    }

    // ──────────────────────────────────────────────────────────────
    // PRONUNCIATION_EVAL handler
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> handlePronunciationEval(AiJob job) throws Exception {
        Map<String, Object> payload = job.getPayload();

        String originalText  = (String) payload.get("originalText");
        String transcribedText = (String) payload.getOrDefault("transcribedText", "");

        // Nếu payload chứa audio bytes ref (base64), cần Whisper trước
        if (transcribedText == null || transcribedText.isBlank()) {
            String audioBase64 = (String) payload.get("audioBase64");
            String filename    = (String) payload.getOrDefault("filename", "audio.webm");
            if (audioBase64 != null) {
                byte[] audioBytes = java.util.Base64.getDecoder().decode(audioBase64);
                TranscribeResult stt = groqWhisperClient.transcribe(audioBytes, filename, "de", originalText);
                ledgerService.recordStt(job.getUserId(), "PHONEME_ASYNC", groqWhisperClient.getWhisperModel(), stt.durationSeconds());
                transcribedText = stt.text();
                log.info("[Worker] Whisper transcribed jobId={}: \"{}\"", job.getId(), transcribedText);
            }
        }

        List<String> focusPhonemes = (List<String>) payload.getOrDefault("focusPhonemes", List.of());
        return skillTreeService.evaluatePronunciation(
                job.getUserId(), originalText, transcribedText, focusPhonemes);
    }

    // ──────────────────────────────────────────────────────────────
    // INTERVIEW_REPORT handler
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> handleInterviewReport(AiJob job) throws Exception {
        Map<String, Object> payload = job.getPayload();
        Long sessionId = Long.valueOf(String.valueOf(payload.get("sessionId")));
        return skillTreeService.generateInterviewReport(job.getUserId(), sessionId);
    }
}
