package com.deutschflow.gamification.controller;

import com.deutschflow.gamification.dto.AchievementDto;
import com.deutschflow.gamification.repository.AchievementRepository;
import com.deutschflow.gamification.repository.UserAchievementRepository;
import com.deutschflow.user.entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * GET /api/achievements/me — returns all achievements with unlocked status for the current user.
 */
@RestController
@RequestMapping("/api/achievements")
public class AchievementController {

    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;

    public AchievementController(AchievementRepository achievementRepository,
                                 UserAchievementRepository userAchievementRepository) {
        this.achievementRepository = achievementRepository;
        this.userAchievementRepository = userAchievementRepository;
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AchievementDto>> getMyAchievements(@AuthenticationPrincipal User user) {
        List<AchievementDto> result = achievementRepository.findAll().stream()
                .map(a -> new AchievementDto(
                        a.getId(), a.getCode(), a.getNameVi(), a.getDescriptionVi(),
                        a.getIconEmoji(), a.getXpReward(), a.getRarity(),
                        userAchievementRepository.existsByUserIdAndAchievementId(user.getId(), a.getId())
                ))
                .toList();
        return ResponseEntity.ok(result);
    }
}
