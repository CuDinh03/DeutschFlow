package com.deutschflow.speaking.service;

import com.deutschflow.speaking.domain.SpeakingPriority;
import com.deutschflow.speaking.dto.ErrorSkillDto;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ErrorSkillsService {

    private final UserGrammarErrorRepository grammarErrorRepository;
    private final UserErrorSkillRepository userErrorSkillRepository;
    private final ReviewSchedulerService reviewSchedulerService;
    private final SpeakingMetrics speakingMetrics;
    private final AdaptivePolicyService adaptivePolicyService;

    @Transactional(readOnly = true)
    public List<ErrorSkillDto> getSkills(Long userId, int days) {
        if (userErrorSkillRepository.countByUserId(userId) > 0) {
            return getSkillsFromSkillTable(userId);
        }
        return getSkillsFromLegacyAggregate(userId, days);
    }

    private List<ErrorSkillDto> getSkillsFromSkillTable(Long userId) {
        List<UserErrorSkill> rows = userErrorSkillRepository.findByUserIdOrderByPriorityScoreDesc(userId);
        List<ErrorSkillDto> out = new ArrayList<>();
        for (UserErrorSkill row : rows) {
            String code = row.getErrorCode();
            if (code == null || code.isBlank()) {
                continue;
            }
            Optional<UserGrammarError> latestOpt = grammarErrorRepository
                    .findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(userId, code);
            if (latestOpt.isEmpty()) {
                latestOpt = grammarErrorRepository.findFirstByUserIdAndGrammarPointOrderByCreatedAtDesc(userId, code);
            }
            UserGrammarError latest = latestOpt.orElse(null);
            double priority = row.getPriorityScore() != null ? row.getPriorityScore().doubleValue() : 0;
            String sampleWrong = latest != null ? latest.getOriginalText() : null;
            String sampleCorrected = latest != null ? latest.getCorrectionText() : null;
            String ruleVi = latest != null ? latest.getRuleViShort() : null;
            out.add(new ErrorSkillDto(code, row.getTotalCount(), row.getLastSeenAt(), priority,
                    sampleWrong, sampleCorrected, ruleVi));
        }
        out.sort(Comparator.comparingDouble(ErrorSkillDto::priorityScore).reversed());
        return out;
    }

    private List<ErrorSkillDto> getSkillsFromLegacyAggregate(Long userId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        List<Object[]> rows = grammarErrorRepository.aggregateErrorGroups(userId, since);
        List<ErrorSkillDto> out = new ArrayList<>();
        for (Object[] row : rows) {
            String code = (String) row[0];
            if (code == null || code.isBlank()) {
                continue;
            }

            long count = row[1] instanceof Long l ? l : ((Number) row[1]).longValue();
            LocalDateTime lastSeen = (LocalDateTime) row[2];

            Optional<UserGrammarError> latestOpt = grammarErrorRepository
                    .findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(userId, code);
            if (latestOpt.isEmpty()) {
                latestOpt = grammarErrorRepository.findFirstByUserIdAndGrammarPointOrderByCreatedAtDesc(userId, code);
            }
            UserGrammarError latest = latestOpt.orElse(null);
            double priority = computePriorityScore(count, lastSeen, latest);

            String sampleWrong = latest != null ? latest.getOriginalText() : null;
            String sampleCorrected = latest != null ? latest.getCorrectionText() : null;
            String ruleVi = latest != null ? latest.getRuleViShort() : null;

            out.add(new ErrorSkillDto(code, count, lastSeen, priority, sampleWrong, sampleCorrected, ruleVi));
        }
        out.sort(Comparator.comparingDouble(ErrorSkillDto::priorityScore).reversed());
        return out;
    }

    private static double computePriorityScore(long count, LocalDateTime lastSeen, UserGrammarError latest) {
        double w = SpeakingPriority.severityWeight(latest != null ? latest.getSeverity() : null);
        long daysSince = lastSeen != null
                ? Math.max(0, ChronoUnit.DAYS.between(lastSeen.toLocalDate(), LocalDateTime.now().toLocalDate()))
                : 0;
        return w * count / Math.sqrt(daysSince + 1.0);
    }

    @Transactional
    public void recordRepairAttempt(Long userId, String errorCode) {
        if (errorCode == null || errorCode.isBlank()) {
            return;
        }
        String trimmed = errorCode.trim();
        int updated = grammarErrorRepository.updateRepairStatusForOpenErrors(userId, trimmed, "RESOLVED");
        adjustSkillCountsAfterRepair(userId, trimmed, updated);
        reviewSchedulerService.onRepairRecorded(userId, trimmed, updated);
        adaptivePolicyService.recordCooldownAfterRepair(userId, trimmed);
        speakingMetrics.recordRepairAttempt(updated);
    }

    private void adjustSkillCountsAfterRepair(Long userId, String code, int rowsResolved) {
        if (rowsResolved <= 0) {
            return;
        }
        userErrorSkillRepository.findByUserIdAndErrorCode(userId, code).ifPresent(skill -> {
            skill.setOpenCount(Math.max(0, skill.getOpenCount() - rowsResolved));
            skill.setResolvedCount(skill.getResolvedCount() + rowsResolved);
            skill.setPriorityScore(BigDecimal.valueOf(
                    SpeakingPriority.skillScore(skill.getTotalCount(), skill.getLastSeenAt(), skill.getLastSeverity())));
            userErrorSkillRepository.save(skill);
        });
    }
}
