package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewExperimentAssignment;
import com.deutschflow.interview.repository.InterviewExperimentAssignmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Assigns users to A/B experiment variants at session creation time.
 *
 * <p>Assignment is deterministic per (userId, experimentKey): the same user always lands
 * on the same variant, preventing contamination across sessions. A prior assignment record
 * is reused when one exists so the variant stays sticky.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewExperimentService {

    /** Active experiments. Variants are distributed by user ID hash bucket. */
    private static final List<ExperimentDef> ACTIVE_EXPERIMENTS = List.of(
            new ExperimentDef("interview_prompt_v1", List.of("control", "variant_b", "variant_c"))
    );

    private final InterviewExperimentAssignmentRepository assignmentRepository;

    public record ExperimentDef(String key, List<String> variants) {}

    /**
     * Assigns and records all active experiments for a user/session.
     * Returns the primary prompt variant key, or "control" if no experiments are active.
     */
    @Transactional
    public String assignAndRecord(Long userId, Long sessionId) {
        String primaryVariant = "control";
        for (ExperimentDef exp : ACTIVE_EXPERIMENTS) {
            String variant = resolveVariant(userId, exp);
            persist(userId, sessionId, exp.key(), variant);
            if ("interview_prompt_v1".equals(exp.key())) {
                primaryVariant = variant;
            }
        }
        return primaryVariant;
    }

    public List<InterviewExperimentAssignment> getAssignmentsForSession(Long sessionId) {
        return assignmentRepository.findBySessionId(sessionId);
    }

    private String resolveVariant(Long userId, ExperimentDef exp) {
        return assignmentRepository
                .findFirstByUserIdAndExperimentKeyOrderByAssignedAtDesc(userId, exp.key())
                .map(InterviewExperimentAssignment::getVariantKey)
                .orElseGet(() -> {
                    int bucket = (int) (Math.abs(userId * 2654435761L) % exp.variants().size());
                    return exp.variants().get(bucket);
                });
    }

    private void persist(Long userId, Long sessionId, String experimentKey, String variantKey) {
        boolean alreadyAssigned = assignmentRepository
                .findFirstByUserIdAndExperimentKeyOrderByAssignedAtDesc(userId, experimentKey)
                .isPresent();
        if (!alreadyAssigned) {
            assignmentRepository.save(InterviewExperimentAssignment.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .experimentKey(experimentKey)
                    .variantKey(variantKey)
                    .reason("hash_bucket")
                    .build());
        }
    }
}
