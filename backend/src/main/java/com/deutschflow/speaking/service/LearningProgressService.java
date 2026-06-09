package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.entity.UserLearningProgress;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * User-learning-progress / interest cluster extracted from {@code AiSpeakingServiceImpl}.
 *
 * <p>Owns reading and merging the learner's tracked interests on their
 * {@link UserLearningProfile}, and recording the most recent error type on
 * {@link UserLearningProgress}. The three public methods are moved verbatim from the
 * facade (pure move + delegate) so behavior — including the best-effort, never-rethrow
 * error handling — is unchanged.
 *
 * <p>{@link #extractInterests(UserLearningProfile)} is shared: it is invoked when building
 * the greeting, when preparing a chat turn, and from turn side effects. Every former
 * self-call on the facade now delegates here.
 */
@Service
@Slf4j
public class LearningProgressService {

    private final ObjectMapper objectMapper;
    private final UserLearningProfileRepository profileRepository;
    private final UserLearningProgressRepository progressRepository;
    private final UserRepository userRepository;

    public LearningProgressService(
            ObjectMapper objectMapper,
            UserLearningProfileRepository profileRepository,
            UserLearningProgressRepository progressRepository,
            UserRepository userRepository) {
        this.objectMapper = objectMapper;
        this.profileRepository = profileRepository;
        this.progressRepository = progressRepository;
        this.userRepository = userRepository;
    }

    public List<String> extractInterests(UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(profile.getInterestsJson(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse interestsJson for user profile: {}", e.getMessage());
            return List.of();
        }
    }

    public void mergeInterest(UserLearningProfile profile, String newInterest) {
        try {
            Set<String> updated = new LinkedHashSet<>(extractInterests(profile));
            updated.add(newInterest.trim());
            profile.setInterestsJson(objectMapper.writeValueAsString(updated));
            profileRepository.save(profile);
        } catch (Exception e) {
            log.warn("Failed to merge interest '{}': {}", newInterest, e.getMessage());
        }
    }

    public void updateUserLearningProgress(Long userId, AiResponseDto parsed) {
        try {
            String lastError = null;
            if ("OFF_TOPIC".equals(parsed.status())) {
                lastError = "OFF_TOPIC";
            } else if (parsed.errors() != null && !parsed.errors().isEmpty()) {
                lastError = parsed.errors().get(0).errorCode();
            } else if (parsed.correction() != null && !parsed.correction().isBlank()) {
                lastError = "GENERAL_GRAMMAR";
            }

            if (lastError != null) {
                final String finalError = lastError;
                UserLearningProgress progress = progressRepository.findByUserId(userId)
                        .orElseGet(() -> UserLearningProgress.builder()
                                .user(userRepository.getReferenceById(userId))
                                .build());
                progress.setLastErrorType(finalError);
                progressRepository.save(progress);
            }
        } catch (Exception e) {
            log.warn("Failed to update user learning progress: {}", e.getMessage());
        }
    }
}
