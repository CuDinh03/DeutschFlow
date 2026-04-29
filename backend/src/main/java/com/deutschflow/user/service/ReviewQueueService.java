package com.deutschflow.user.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.ReviewDueResponse;
import com.deutschflow.user.dto.ReviewGradeResponse;
import com.deutschflow.user.entity.LearningReviewItem;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningReviewItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewQueueService {

    private final LearningReviewItemRepository learningReviewItemRepository;

    @Transactional
    public ReviewDueResponse dueItems(User user, Integer limit, String type) {
        ensureSeedData(user);
        int safeLimit = Math.max(1, Math.min(limit == null ? 20 : limit, 100));
        LocalDateTime now = LocalDateTime.now();
        PageRequest page = PageRequest.of(0, safeLimit);
        List<LearningReviewItem> rows;
        if (type == null || type.isBlank()) {
            rows = learningReviewItemRepository.findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(user.getId(), now, page);
        } else {
            LearningReviewItem.ItemType itemType;
            try {
                itemType = LearningReviewItem.ItemType.valueOf(type.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new BadRequestException("Invalid review type");
            }
            rows = learningReviewItemRepository.findByUserIdAndItemTypeAndDueAtLessThanEqualOrderByDueAtAsc(
                    user.getId(), itemType, now, page
            );
        }
        return new ReviewDueResponse(
                safeLimit,
                learningReviewItemRepository.countByUserId(user.getId()),
                rows.stream().map(item -> new ReviewDueResponse.Item(
                        item.getId(),
                        item.getItemType().name(),
                        item.getItemRef(),
                        item.getPrompt(),
                        item.getRepetitions(),
                        item.getIntervalDays(),
                        item.getEaseFactor().doubleValue(),
                        item.getDueAt()
                )).toList()
        );
    }

    @Transactional
    public ReviewGradeResponse grade(User user, long reviewId, int quality) {
        LearningReviewItem item = learningReviewItemRepository.findByIdAndUserId(reviewId, user.getId())
                .orElseThrow(() -> new NotFoundException("Review item not found"));

        Sm2Result next = applySm2(
                item.getRepetitions(),
                item.getIntervalDays(),
                item.getEaseFactor().doubleValue(),
                quality
        );
        item.setRepetitions(next.repetitions());
        item.setIntervalDays(next.intervalDays());
        item.setEaseFactor(BigDecimal.valueOf(next.easeFactor()).setScale(2, RoundingMode.HALF_UP));
        item.setLastReviewedAt(LocalDateTime.now());
        item.setDueAt(LocalDateTime.now().plusDays(next.intervalDays()));
        learningReviewItemRepository.save(item);

        return new ReviewGradeResponse(
                item.getId(),
                quality,
                item.getRepetitions(),
                item.getIntervalDays(),
                item.getEaseFactor().doubleValue(),
                item.getDueAt()
        );
    }

    private void ensureSeedData(User user) {
        if (learningReviewItemRepository.countByUserId(user.getId()) > 0) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        List<LearningReviewItem> seeds = List.of(
                LearningReviewItem.builder()
                        .user(user)
                        .itemType(LearningReviewItem.ItemType.GRAMMAR)
                        .itemRef("A1-ARTICLES-001")
                        .prompt("Chọn đúng mạo từ cho danh từ giống đực.")
                        .repetitions(0)
                        .intervalDays(0)
                        .easeFactor(BigDecimal.valueOf(2.5))
                        .dueAt(now)
                        .build(),
                LearningReviewItem.builder()
                        .user(user)
                        .itemType(LearningReviewItem.ItemType.GRAMMAR)
                        .itemRef("A1-WORD-ORDER-001")
                        .prompt("Sắp xếp câu Hauptsatz với động từ ở vị trí thứ 2.")
                        .repetitions(0)
                        .intervalDays(0)
                        .easeFactor(BigDecimal.valueOf(2.5))
                        .dueAt(now)
                        .build(),
                LearningReviewItem.builder()
                        .user(user)
                        .itemType(LearningReviewItem.ItemType.WORD)
                        .itemRef("VOCAB-A1-DAILY-001")
                        .prompt("Ôn lại nhóm từ vựng sinh hoạt hằng ngày A1.")
                        .repetitions(0)
                        .intervalDays(0)
                        .easeFactor(BigDecimal.valueOf(2.5))
                        .dueAt(now)
                        .build()
        );
        learningReviewItemRepository.saveAll(seeds);
    }

    private Sm2Result applySm2(int repetitions, int intervalDays, double easeFactor, int quality) {
        double ef = easeFactor;
        int reps = repetitions;
        int interval;

        if (quality < 3) {
            reps = 0;
            interval = 1;
        } else {
            if (reps == 0) {
                interval = 1;
            } else if (reps == 1) {
                interval = 6;
            } else {
                interval = Math.max(1, (int) Math.round(intervalDays * ef));
            }
            reps += 1;
        }

        ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ef < 1.3) {
            ef = 1.3;
        }
        return new Sm2Result(reps, interval, ef);
    }

    private record Sm2Result(int repetitions, int intervalDays, double easeFactor) {
    }
}
