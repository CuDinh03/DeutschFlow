package com.deutschflow.examspeaking.weakness;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.entity.SpeakingExamErrorStat;
import com.deutschflow.examspeaking.repository.SpeakingExamErrorStatRepository;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.service.GrammarPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Đợt 5a: cầu nối lỗi luyện thi → kho yếu điểm. Mỗi lỗi được ghi hai nơi:
 * (1) kho SRS chung ({@link GrammarPersistenceService#persistExamError} — UserGrammarError +
 *     UserErrorSkill + review task) để lỗi exam xuất hiện trong "ôn tập hôm nay";
 * (2) {@code speaking_exam_error_stats} (V282) — facet theo hệ × cấp × Teil × archetype
 *     cho màn "Ôn yếu điểm" lọc theo dạng bài.
 * Mã "OTHER" (không chuẩn hoá được về ErrorCatalog) bị bỏ qua — không phải taxonomy thật,
 * correction vẫn hiển thị trong Ergebnisbogen/drill. KHÔNG BAO GIỜ ném lỗi ra ngoài:
 * hỏng ingest không được làm hỏng lượt thi hay job chấm.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExamErrorSrsBridge {

    private static final String CODE_OTHER = "OTHER";

    private final GrammarPersistenceService grammarPersistenceService;
    private final SpeakingExamErrorStatRepository statRepository;

    /** Lỗi từ Ergebnisbogen sau khi chấm mock (đã chuẩn hoá + kèm severity + teilNo). */
    public void ingestMockErrors(long userId, ExamBlueprint bp, List<Ergebnisbogen.ErrorItem> errors) {
        if (errors == null) {
            return;
        }
        for (Ergebnisbogen.ErrorItem err : errors) {
            try {
                if (skip(err.code())) {
                    continue;
                }
                grammarPersistenceService.persistExamError(userId,
                        new ErrorItem(err.code(), err.severity(), null, err.original(), err.correction(), null, null),
                        bp.level());
                upsertStat(userId, bp, err.teilNo(), err.code(), err.original(), err.correction());
            } catch (RuntimeException e) {
                log.error("[ExamSpeaking] ingest mock error failed userId={} code={}", userId, err.code(), e);
            }
        }
    }

    /** Corrections từ quickEval một lượt drill: list map {code, original, correction, severity}. */
    public void ingestDrillEval(long userId, ExamBlueprint bp, int teilNo, Map<String, Object> eval) {
        if (eval == null || !(eval.get("corrections") instanceof List<?> corrections)) {
            return;
        }
        for (Object o : corrections) {
            try {
                if (!(o instanceof Map<?, ?> c)) {
                    continue;
                }
                String code = str(c.get("code"));
                if (skip(code)) {
                    continue;
                }
                String original = str(c.get("original"));
                String correction = str(c.get("correction"));
                String severity = str(c.get("severity"));
                grammarPersistenceService.persistExamError(userId,
                        new ErrorItem(code, severity, null, original, correction, null, null), bp.level());
                upsertStat(userId, bp, teilNo, code, original, correction);
            } catch (RuntimeException e) {
                log.error("[ExamSpeaking] ingest drill error failed userId={} teil={}", userId, teilNo, e);
            }
        }
    }

    private static boolean skip(String code) {
        return code == null || code.isBlank() || CODE_OTHER.equals(code);
    }

    private void upsertStat(long userId, ExamBlueprint bp, int teilNo, String code, String original, String correction) {
        String archetype = bp.part(teilNo).map(p -> p.archetype().name()).orElse("UNKNOWN");
        SpeakingExamErrorStat stat = statRepository
                .findByUserIdAndProviderAndLevelAndTeilNoAndErrorCode(userId, bp.provider().name(), bp.level(), teilNo, code)
                .orElseGet(() -> SpeakingExamErrorStat.builder()
                        .userId(userId)
                        .provider(bp.provider().name())
                        .level(bp.level())
                        .teilNo(teilNo)
                        .archetype(archetype)
                        .errorCode(code)
                        .build());
        stat.setSeenCount(stat.getSeenCount() + 1);
        stat.setLastSeenAt(LocalDateTime.now());
        if (original != null && !original.isBlank()) {
            stat.setLastOriginal(original);
        }
        if (correction != null && !correction.isBlank()) {
            stat.setLastCorrection(correction);
        }
        statRepository.save(stat);
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
