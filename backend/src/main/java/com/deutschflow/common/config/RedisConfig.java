package com.deutschflow.common.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

/**
 * Optional Redis L2 cache configuration.
 *
 * Only activates when both:
 *  1. {@code spring.redis.host} is set in application properties, AND
 *  2. the spring-data-redis {@code RedisConnectionFactory} class is on the classpath.
 *
 * When Redis is unavailable or not configured, the application falls back to the
 * Caffeine L1 in-memory caches defined in {@link com.deutschflow.common.CacheConfig}.
 *
 * Two-layer design:
 *  L1 (Caffeine) — low-latency, per-node, bounded in-process cache (primary bean)
 *  L2 (Redis)    — shared, cross-node cache that survives pod restarts (secondary bean)
 */
@Configuration
@EnableCaching
@ConditionalOnProperty(name = "spring.redis.host")
@ConditionalOnClass(name = "org.springframework.data.redis.connection.RedisConnectionFactory")
public class RedisConfig {

    @Bean(name = "redisCacheManager")
    public RedisCacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(7)) // Lưu Cache 7 ngày
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }
}
