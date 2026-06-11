package com.deutschflow.teacher.service;

import com.deutschflow.common.quota.FreeTierGuard;
import com.deutschflow.teacher.dto.FreeTierStatusDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Surfaces the freelance-teacher free plan as an official, visible tier (D6²): is the teacher on the
 * free tier (non-org), and how much of today's expensive-AI daily allowance is left. The caps
 * themselves are enforced by {@link FreeTierGuard}; this is the read-only view of the same plan.
 */
@Service
@RequiredArgsConstructor
public class TeacherFreeTierService {

    private final UserRepository userRepository;
    private final FreeTierGuard freeTierGuard;

    @Transactional(readOnly = true)
    public FreeTierStatusDto status(Long userId) {
        Long orgId = userRepository.findById(userId).map(User::getOrgId).orElse(null);
        boolean freeTier = orgId == null;
        return new FreeTierStatusDto(
                freeTier,
                freeTierGuard.dailyLimit(FreeTierGuard.FEATURE_PPTX),
                freeTier ? freeTierGuard.usedToday(userId, FreeTierGuard.FEATURE_PPTX) : 0,
                freeTierGuard.dailyLimit(FreeTierGuard.FEATURE_OCR_GRADE),
                freeTier ? freeTierGuard.usedToday(userId, FreeTierGuard.FEATURE_OCR_GRADE) : 0);
    }
}
