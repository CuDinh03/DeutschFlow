package com.deutschflow.user.service;

import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.dto.RecommendationDto;
import com.deutschflow.user.dto.RecommendationDto.RecommendationItem;
import com.deutschflow.srs.repository.VocabReviewRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class RecommendationService {

    private final VocabReviewRepository srsRepository;
    private final UserGrammarErrorRepository errorRepository;

    public RecommendationService(VocabReviewRepository srsRepository,
                                 UserGrammarErrorRepository errorRepository) {
        this.srsRepository = srsRepository;
        this.errorRepository = errorRepository;
    }

    public RecommendationDto getRecommendations(Long userId) {
        List<RecommendationItem> items = new ArrayList<>();

        long wordsDue = srsRepository.countByUserId(userId);
        if (wordsDue > 0) {
            items.add(new RecommendationItem(
                    "VOCABULARY_REVIEW",
                    "Review " + Math.min(wordsDue, 20) + " words due today",
                    "Spaced repetition keeps vocabulary fresh. Don't let reviews pile up.",
                    "HIGH",
                    "/vocabulary/review"
            ));
        }

        var weakPoints = errorRepository.findTopWeakPoints(userId, Pageable.ofSize(3));
        for (var wp : weakPoints) {
            items.add(new RecommendationItem(
                    "GRAMMAR_DRILL",
                    "Practice: " + formatGrammarPoint(wp.grammarPoint()),
                    "You've made " + wp.count() + " errors with this pattern recently.",
                    wp.count() >= 5 ? "HIGH" : "MEDIUM",
                    "/speaking/drill?focus=" + wp.grammarPoint()
            ));
        }

        var recentErrors = errorRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId);
        boolean hasRecentErrors = recentErrors.stream()
                .anyMatch(e -> e.getCreatedAt() != null &&
                               e.getCreatedAt().isAfter(LocalDateTime.now().minusDays(3)));
        if (hasRecentErrors) {
            items.add(new RecommendationItem(
                    "SPEAKING_PRACTICE",
                    "Speaking practice to reinforce corrections",
                    "Practice speaking to turn grammar corrections into natural habits.",
                    "MEDIUM",
                    "/speaking"
            ));
        }

        if (items.size() < 2) {
            items.add(new RecommendationItem(
                    "NEW_VOCABULARY",
                    "Learn 5 new words today",
                    "Consistent daily vocabulary building accelerates fluency.",
                    "MEDIUM",
                    "/vocabulary"
            ));
        }

        return new RecommendationDto(items);
    }

    private String formatGrammarPoint(String code) {
        if (code == null) return "Grammar";
        return code.replace(".", " → ").replace("_", " ");
    }
}
