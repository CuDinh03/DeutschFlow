package com.deutschflow.common.cache;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.lang.Nullable;

/**
 * Wires the application's primary {@link CacheManager} (P1-4).
 *
 * <p>When Redis is configured ({@code spring.data.redis.host} set → the {@code redisCacheManager}
 * bean exists) the primary manager is a {@link TwoLevelCacheManager} (Caffeine L1 + Redis L2) so warm
 * entries survive the blue-green restart that drops the in-process L1. Otherwise it is Caffeine-only —
 * the previous effective behavior. Either way a graceful {@link CacheErrorHandler} makes a Redis
 * outage or a non-serializable value degrade to L1 instead of failing the request.
 */
@Configuration
@EnableCaching
@Slf4j
public class PrimaryCacheConfig implements CachingConfigurer {

    @Bean
    @Primary
    public CacheManager cacheManager(
            @Qualifier("caffeineCacheManager") CacheManager caffeine,
            @Nullable @Qualifier("redisCacheManager") CacheManager redis) {
        if (redis == null) {
            log.info("[Cache] Redis not configured — Caffeine L1 only.");
            return caffeine;
        }
        log.info("[Cache] Redis configured — two-level cache active (Caffeine L1 + Redis L2).");
        return new TwoLevelCacheManager(caffeine, redis);
    }

    /**
     * Never let a cache-backend failure (Redis down, a value that won't JSON-serialize) break the
     * request — log it and behave as a miss / no-op so the call falls through to the source.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                log.warn("[Cache] GET failed on '{}' key={} — treating as miss: {}", cache.getName(), key, e.toString());
            }

            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                log.warn("[Cache] PUT failed on '{}' key={} — not cached in L2: {}", cache.getName(), key, e.toString());
            }

            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                log.warn("[Cache] EVICT failed on '{}' key={}: {}", cache.getName(), key, e.toString());
            }

            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                log.warn("[Cache] CLEAR failed on '{}': {}", cache.getName(), e.toString());
            }
        };
    }
}
