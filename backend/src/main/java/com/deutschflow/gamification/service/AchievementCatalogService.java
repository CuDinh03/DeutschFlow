package com.deutschflow.gamification.service;

import com.deutschflow.gamification.entity.Achievement;
import com.deutschflow.gamification.repository.AchievementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Catalogue achievement đọc qua cache "achievements" (Caffeine, TTL 60' — đã khai trong
 * {@link com.deutschflow.common.CacheConfig} từ lâu nhưng chưa nơi nào dùng).
 *
 * <p>Phải là bean RIÊNG chứ không phải method trong {@link XpService}: {@code checkAchievements}
 * gọi nội bộ cùng bean thì Spring proxy bị bỏ qua và {@code @Cacheable} không bao giờ chạy —
 * trước đây mỗi lần cộng XP (mỗi thẻ SRS, mỗi lượt nói…) là một {@code findAll()} thật xuống DB.
 *
 * <p>Bảng {@code achievements} chỉ thay đổi qua Flyway (read-only lúc runtime, xem entity),
 * entity không có quan hệ lazy → cache cả list là an toàn.
 */
@Service
@RequiredArgsConstructor
public class AchievementCatalogService {

    private final AchievementRepository achievementRepository;

    @Cacheable("achievements")
    @Transactional(readOnly = true)
    public List<Achievement> getAll() {
        return achievementRepository.findAll();
    }
}
