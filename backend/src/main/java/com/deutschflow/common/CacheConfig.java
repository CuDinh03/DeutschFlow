package com.deutschflow.common;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Caffeine in-memory multi-layer cache configuration.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SHARED / CONTENT CACHES                                            │
 * │  tags (10min) · words (5min) · subscriptionPlans (30min)           │
 * │  curriculum (60min) · achievements (60min) · weeklyPrompts (30min) │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  AI RESPONSE CACHES  (deterministic — input same → output same)    │
 * │  aiVocabCache (24h)  — examples, usage, mnemonic, similar, etymology│
 * │  aiVocabShort (6h)   — story (semi-deterministic)                  │
 * │  aiVocabQuiz  (1h)   — quiz questions (refresh more often)         │
 * │  ttsAudio     (24h)  — ElevenLabs byte[] MP3 audio                 │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Cache invalidation strategy:
 *  - Content caches: TTL-based (admin changes are rare)
 *  - AI caches: TTL-based + @CacheEvict via admin purge endpoint
 *  - TTS cache: TTL-based (audio content is immutable for same text)
 *
 * RAM estimate: aiVocabCache (2000 × ~2KB text) ≈ 4MB
 *               ttsAudio    (500 × ~60KB audio) ≈ 30MB
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    @org.springframework.context.annotation.Primary
    public CacheManager cacheManager() {
        // ── Shared content caches ──────────────────────────────────────
        var tags = buildCache("tags",
                Caffeine.newBuilder()
                        .maximumSize(200)
                        .expireAfterWrite(10, TimeUnit.MINUTES)
                        .recordStats());

        var words = buildCache("words",
                Caffeine.newBuilder()
                        .maximumSize(500)
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .recordStats());

        var plans = buildCache("subscriptionPlans",
                Caffeine.newBuilder()
                        .maximumSize(20)
                        .expireAfterWrite(30, TimeUnit.MINUTES)
                        .recordStats());

        var curriculum = buildCache("curriculum",
                Caffeine.newBuilder()
                        .maximumSize(50)
                        .expireAfterWrite(60, TimeUnit.MINUTES)
                        .recordStats());

        var achievements = buildCache("achievements",
                Caffeine.newBuilder()
                        .maximumSize(50)
                        .expireAfterWrite(60, TimeUnit.MINUTES)
                        .recordStats());

        var weeklyPrompts = buildCache("weeklyPrompts",
                Caffeine.newBuilder()
                        .maximumSize(10)
                        .expireAfterWrite(30, TimeUnit.MINUTES)
                        .recordStats());

        // ── AI Response caches (cost-saving) ──────────────────────────
        // Deterministic AI: examples, usage, mnemonic, similar, etymology
        var aiVocabCache = buildCache("aiVocabCache",
                Caffeine.newBuilder()
                        .maximumSize(2000)
                        .expireAfterWrite(24, TimeUnit.HOURS)
                        .recordStats());

        // Semi-deterministic: story (creative, refresh more often)
        var aiVocabShort = buildCache("aiVocabShort",
                Caffeine.newBuilder()
                        .maximumSize(500)
                        .expireAfterWrite(6, TimeUnit.HOURS)
                        .recordStats());

        // Quiz questions: refresh every 1h to keep variety
        var aiVocabQuiz = buildCache("aiVocabQuiz",
                Caffeine.newBuilder()
                        .maximumSize(200)
                        .expireAfterWrite(1, TimeUnit.HOURS)
                        .recordStats());

        // TTS audio: ElevenLabs byte[] — immutable for same text+persona
        // ~30MB RAM budget. Evict LRU automatically when full.
        var ttsAudio = buildCache("ttsAudio",
                Caffeine.newBuilder()
                        .maximumSize(500)
                        .expireAfterWrite(24, TimeUnit.HOURS)
                        .recordStats());

        var systemConfig = buildCache("systemConfig",
                Caffeine.newBuilder()
                        .maximumSize(50)
                        .expireAfterWrite(1, TimeUnit.HOURS)
                        .recordStats());

        var classLeaderboard = buildCache("classLeaderboard",
                Caffeine.newBuilder()
                        .maximumSize(500)
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .recordStats());

        var mgr = new SimpleCacheManager();
        mgr.setCaches(List.of(
                tags, words, plans, curriculum,
                achievements, weeklyPrompts,
                aiVocabCache, aiVocabShort, aiVocabQuiz,
                ttsAudio, systemConfig, classLeaderboard
        ));
        return mgr;
    }

    private static CaffeineCache buildCache(String name, Caffeine<Object, Object> builder) {
        return new CaffeineCache(name, builder.build());
    }
}

