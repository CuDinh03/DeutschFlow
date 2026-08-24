package com.deutschflow.examspeaking.weakness;

import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.dto.WeaknessView;
import com.deutschflow.examspeaking.entity.SpeakingExamErrorStat;
import com.deutschflow.examspeaking.repository.SpeakingExamErrorStatRepository;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Đợt 5a: tổng hợp màn "Ôn yếu điểm". Nguồn: {@code speaking_exam_error_stats} (facet dạng bài)
 * × {@code user_error_skills} (độ ưu tiên SRS) × ví dụ mới nhất từ {@code user_grammar_errors}.
 * Khi học viên chưa có lỗi exam nào → weakPoints rỗng nhưng vẫn trả đủ gói Redemittel của
 * dải cấp (màn không trống, vẫn có giá trị ôn tập).
 */
@Service
@RequiredArgsConstructor
public class ExamWeaknessService {

    static final int MAX_WEAK_POINTS = 20;

    private final SpeakingExamErrorStatRepository statRepository;
    private final UserErrorSkillRepository skillRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final RedemittelCatalog redemittelCatalog;

    @Transactional(readOnly = true)
    public WeaknessView weakness(long userId, String provider, String level) {
        String lv = level == null || level.isBlank() ? null : level.trim().toUpperCase(Locale.ROOT);
        String pv = provider == null || provider.isBlank() ? null : ExamProvider.fromApi(provider).name();

        List<SpeakingExamErrorStat> stats = (pv != null && lv != null)
                ? statRepository.findByUserIdAndProviderAndLevelOrderByLastSeenAtDesc(userId, pv, lv)
                : statRepository.findByUserIdOrderByLastSeenAtDesc(userId);
        if (pv != null && lv == null) {
            stats = stats.stream().filter(s -> pv.equals(s.getProvider())).toList();
        } else if (pv == null && lv != null) {
            stats = stats.stream().filter(s -> lv.equals(s.getLevel())).toList();
        }

        Map<String, List<SpeakingExamErrorStat>> byCode = new LinkedHashMap<>();
        for (SpeakingExamErrorStat s : stats) {
            byCode.computeIfAbsent(s.getErrorCode(), k -> new ArrayList<>()).add(s);
        }

        Map<String, UserErrorSkill> skills = new LinkedHashMap<>();
        for (UserErrorSkill s : skillRepository.findByUserIdOrderByPriorityScoreDesc(userId)) {
            skills.put(s.getErrorCode(), s);
        }

        List<WeaknessView.WeakPoint> weakPoints = byCode.entrySet().stream()
                .map(e -> toWeakPoint(userId, e.getKey(), e.getValue(), skills.get(e.getKey())))
                .sorted(Comparator
                        .comparing((WeaknessView.WeakPoint w) -> skills.containsKey(w.errorCode())
                                ? skills.get(w.errorCode()).getPriorityScore() : BigDecimal.ZERO)
                        .reversed()
                        .thenComparing(Comparator.comparingInt(WeaknessView.WeakPoint::totalCount).reversed()))
                .limit(MAX_WEAK_POINTS)
                .toList();

        String bandLevel = lv != null ? lv
                : stats.isEmpty() ? "A1" : stats.get(0).getLevel();
        Set<String> archetypes = new LinkedHashSet<>();
        for (WeaknessView.WeakPoint w : weakPoints) {
            for (WeaknessView.Context c : w.contexts()) {
                archetypes.add(c.archetype());
            }
        }
        List<WeaknessView.RedemittelPack> packs = redemittelCatalog.packsFor(bandLevel, archetypes).stream()
                .map(p -> new WeaknessView.RedemittelPack(p.archetype(), p.phrases()))
                .toList();
        return new WeaknessView(weakPoints, packs);
    }

    private WeaknessView.WeakPoint toWeakPoint(long userId, String code, List<SpeakingExamErrorStat> stats,
                                               UserErrorSkill skill) {
        SpeakingExamErrorStat newest = stats.stream()
                .max(Comparator.comparing(SpeakingExamErrorStat::getLastSeenAt))
                .orElseThrow();
        int examCount = stats.stream().mapToInt(SpeakingExamErrorStat::getSeenCount).sum();
        String ruleVi = grammarErrorRepository.findFirstByUserIdAndErrorCodeOrderByCreatedAtDesc(userId, code)
                .map(g -> g.getRuleViShort())
                .orElse(null);
        List<WeaknessView.Context> contexts = stats.stream()
                .sorted(Comparator.comparingInt(SpeakingExamErrorStat::getSeenCount).reversed())
                .map(s -> new WeaknessView.Context(s.getProvider(), s.getLevel(), s.getTeilNo(),
                        s.getArchetype(), s.getSeenCount(), s.getLastSeenAt()))
                .toList();
        return new WeaknessView.WeakPoint(
                code,
                ruleVi,
                examCount,
                skill != null ? skill.getTotalCount() : examCount,
                skill != null ? skill.getOpenCount() : examCount,
                skill != null ? skill.getLastSeverity() : null,
                newest.getLastSeenAt(),
                newest.getLastOriginal(),
                newest.getLastCorrection(),
                contexts);
    }
}
