package com.deutschflow.practice.service;

import com.deutschflow.gamification.service.XpService;
import com.deutschflow.practice.dto.PracticeExerciseDto;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.entity.PracticeHistory;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.practice.repository.PracticeHistoryRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeService {

    private final PracticeExerciseRepository exerciseRepository;
    private final PracticeHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final XpService xpService;

    @Transactional(readOnly = true)
    public Page<PracticeExerciseDto> getExercises(String exerciseType, String cefrLevel, String skillType, Pageable pageable) {
        Page<PracticeExercise> page;

        if (exerciseType != null && cefrLevel != null) {
            page = exerciseRepository.findByExerciseTypeAndCefrLevelAndIsActiveTrue(exerciseType, cefrLevel, pageable);
        } else if (exerciseType != null) {
            page = exerciseRepository.findByExerciseTypeAndIsActiveTrue(exerciseType, pageable);
        } else if (cefrLevel != null) {
            page = exerciseRepository.findByCefrLevelAndIsActiveTrue(cefrLevel, pageable);
        } else if (skillType != null) {
            page = exerciseRepository.findBySkillTypeAndIsActiveTrue(skillType, pageable);
        } else {
            page = exerciseRepository.findByIsActiveTrue(pageable);
        }

        return page.map(PracticeExerciseDto::new);
    }

    @Transactional(readOnly = true)
    public PracticeExerciseDto getExerciseById(Long id) {
        return exerciseRepository.findById(id)
                .map(PracticeExerciseDto::new)
                .orElseThrow(() -> new IllegalArgumentException("Practice exercise not found: " + id));
    }

    @Transactional
    public void submitPracticeResult(Long userId, PracticeSubmitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        PracticeExercise exercise = exerciseRepository.findById(request.getPracticeId())
                .orElseThrow(() -> new IllegalArgumentException("Practice exercise not found: " + request.getPracticeId()));

        // XP is proportional to score (80% score => 80% of the declared XP)
        int earnedXp = (int) Math.round((request.getScorePercent() / 100.0) * exercise.getXpReward());

        PracticeHistory history = PracticeHistory.builder()
                .user(user)
                .practiceExercise(exercise)
                .scorePercent(request.getScorePercent())
                .answerData(request.getAnswerDataJson())
                .xpEarned(earnedXp)
                .completedAt(LocalDateTime.now())
                .build();

        historyRepository.save(history);

        // Award XP only — no streak update (CUSTOM_PRACTICE type bypasses daily streak logic)
        if (earnedXp > 0) {
            xpService.awardCustomPractice(userId, earnedXp,
                    "Bài tập bổ trợ: " + exercise.getCefrLevel() + " " + exercise.getSkillType());
        }

        log.info("User {} completed practice exercise {} — score {}% — earned {} XP",
                userId, exercise.getId(), request.getScorePercent(), earnedXp);
    }
}
