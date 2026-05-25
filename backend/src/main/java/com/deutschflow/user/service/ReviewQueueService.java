package com.deutschflow.user.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.ReviewDueResponse;
import com.deutschflow.user.dto.ReviewGradeResponse;
import com.deutschflow.user.entity.LearningReviewItem;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.fsrs.FsrsAlgorithm;
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
                        item.getState(),
                        item.getDifficulty() != null ? item.getDifficulty().doubleValue() : 0.0,
                        item.getStability() != null ? item.getStability().doubleValue() : 0.0,
                        item.getLapses(),
                        item.getRepetitions(),
                        item.getDueAt()
                )).toList()
        );
    }

    @Transactional
    public ReviewGradeResponse grade(User user, long reviewId, int quality) {
        LearningReviewItem item = learningReviewItemRepository.findByIdAndUserId(reviewId, user.getId())
                .orElseThrow(() -> new NotFoundException("Review item not found"));

        // FSRS rating bounds: 1 to 4
        // If frontend still sends SM-2 (0-5), map it roughly:
        // SM-2: 0,1,2 -> FSRS: 1 (Again)
        // SM-2: 3 -> FSRS: 2 (Hard)
        // SM-2: 4 -> FSRS: 3 (Good)
        // SM-2: 5 -> FSRS: 4 (Easy)
        int rating;
        if (quality <= 2) rating = 1;
        else if (quality == 3) rating = 2;
        else if (quality == 4) rating = 3;
        else rating = 4; // if >= 5

        FsrsAlgorithm.Card card = new FsrsAlgorithm.Card(
                item.getState(),
                item.getDifficulty() != null ? item.getDifficulty().doubleValue() : 0.0,
                item.getStability() != null ? item.getStability().doubleValue() : 0.0,
                item.getLapses(),
                item.getRepetitions(),
                item.getLastReviewedAt()
        );

        FsrsAlgorithm.SchedulingResult result = FsrsAlgorithm.calculate(card, rating, LocalDateTime.now());

        item.setLastReviewedState(item.getState());
        item.setState(result.newState());
        item.setDifficulty(BigDecimal.valueOf(result.newDifficulty()).setScale(2, RoundingMode.HALF_UP));
        item.setStability(BigDecimal.valueOf(result.newStability()).setScale(4, RoundingMode.HALF_UP));
        item.setLapses(result.newLapses());
        item.setRepetitions(result.newReps());
        
        item.setIntervalDays(result.intervalDays());
        
        item.setLastReviewedAt(LocalDateTime.now());
        item.setDueAt(LocalDateTime.now().plusDays(result.intervalDays()));
        learningReviewItemRepository.save(item);

        return new ReviewGradeResponse(
                item.getId(),
                rating,
                item.getState(),
                item.getDifficulty().doubleValue(),
                item.getStability().doubleValue(),
                item.getLapses(),
                item.getRepetitions(),
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
                        .state(FsrsAlgorithm.STATE_NEW)
                        .difficulty(BigDecimal.ZERO)
                        .stability(BigDecimal.ZERO)
                        .dueAt(now)
                        .build(),
                LearningReviewItem.builder()
                        .user(user)
                        .itemType(LearningReviewItem.ItemType.GRAMMAR)
                        .itemRef("A1-WORD-ORDER-001")
                        .prompt("Sắp xếp câu Hauptsatz với động từ ở vị trí thứ 2.")
                        .state(FsrsAlgorithm.STATE_NEW)
                        .difficulty(BigDecimal.ZERO)
                        .stability(BigDecimal.ZERO)
                        .dueAt(now)
                        .build(),
                LearningReviewItem.builder()
                        .user(user)
                        .itemType(LearningReviewItem.ItemType.WORD)
                        .itemRef("VOCAB-A1-DAILY-001")
                        .prompt("Ôn lại nhóm từ vựng sinh hoạt hằng ngày A1.")
                        .state(FsrsAlgorithm.STATE_NEW)
                        .difficulty(BigDecimal.ZERO)
                        .stability(BigDecimal.ZERO)
                        .dueAt(now)
                        .build()
        );
        learningReviewItemRepository.saveAll(seeds);
    }
}
