package com.deutschflow.user.service;

import com.deutschflow.common.WebRoutes;
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
                    // Trước đây là "/vocabulary/review" — một trang CHƯA BAO GIỜ tồn tại. Ôn tập từ
                    // vựng tới hạn nằm ở trang Ôn tập (gộp cả FSRS lẫn bài sửa lỗi).
                    WebRoutes.STUDENT_REVIEW
            ));
        }

        var weakPoints = errorRepository.findTopWeakPoints(userId, Pageable.ofSize(3));
        for (var wp : weakPoints) {
            items.add(new RecommendationItem(
                    "GRAMMAR_DRILL",
                    "Practice: " + formatGrammarPoint(wp.grammarPoint()),
                    "You've made " + wp.count() + " errors with this pattern recently.",
                    wp.count() >= 5 ? "HIGH" : "MEDIUM",
                    // Trước đây là "/speaking/drill" — cũng là một trang CHƯA BAO GIỜ tồn tại. Màn
                    // chọn chủ đề đọc `?focus=` rồi mở engine hội thoại với trọng tâm ngữ pháp đó.
                    WebRoutes.STUDENT_SPEAKING_SETUP + "?focus=" + wp.grammarPoint()
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
                    WebRoutes.STUDENT_SPEAKING_SETUP
            ));
        }

        if (items.size() < 2) {
            items.add(new RecommendationItem(
                    "NEW_VOCABULARY",
                    "Learn 5 new words today",
                    "Consistent daily vocabulary building accelerates fluency.",
                    "MEDIUM",
                    WebRoutes.STUDENT_VOCABULARY
            ));
        }

        return new RecommendationDto(items);
    }

    private String formatGrammarPoint(String code) {
        if (code == null) return "Grammar";
        return code.replace(".", " → ").replace("_", " ");
    }
}
