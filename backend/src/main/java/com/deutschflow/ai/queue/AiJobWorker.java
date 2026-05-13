package com.deutschflow.ai.queue;

import com.deutschflow.curriculum.service.SkillTreeService;
import com.deutschflow.speaking.ai.GroqWhisperClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelay = 2000)
    @Transactional
    public void processPendingJobs() {
        List<AiJob> jobs = aiJobRepository.claimPendingJobs(BATCH_SIZE);
        if (jobs.isEmpty()) return;

        // Mark all as PROCESSING immediately (in transaction, before AI call)
        List<Long> ids = jobs.stream().map(AiJob::getId).toList();
        aiJobRepository.bulkUpdateStatus(ids, AiJob.STATUS_PROCESSING);

        for (AiJob job : jobs) {
            try {
                Map<String, Object> result = switch (job.getJobType()) {
                    case AiJob.TYPE_PRONUNCIATION_EVAL -> handlePronunciationEval(job);
                    case AiJob.TYPE_INTERVIEW_REPORT   -> handleInterviewReport(job);
                    default -> Map.of("error", "Unknown job type: " + job.getJobType());
                };

                job.setResult(result);
                job.setStatus(AiJob.STATUS_COMPLETED);
                aiJobRepository.save(job);

                // Push kết quả về browser qua SSE
                sseRegistry.complete(job.getId(), result);
                log.info("[Worker] Completed jobId={} type={}", job.getId(), job.getJobType());

            } catch (Exception e) {
                log.error("[Worker] Failed jobId={}: {}", job.getId(), e.getMessage(), e);
                job.setStatus(AiJob.STATUS_FAILED);
                job.setErrorMsg(e.getMessage());
                job.setRetryCount(job.getRetryCount() + 1);
                aiJobRepository.save(job);
                sseRegistry.error(job.getId(), "Đánh giá thất bại. Vui lòng thử lại.");
            }
        }
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
                transcribedText = groqWhisperClient.transcribe(audioBytes, filename, "de", originalText);
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
