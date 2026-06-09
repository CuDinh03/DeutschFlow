package com.deutschflow.common.cache;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.lang.Nullable;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Combines an L1 ({@link com.github.benmanes.caffeine.cache.Caffeine}) and L2 (Redis) cache manager,
 * returning a {@link TwoLevelCache} for every name both define. If only one layer knows a name, that
 * layer's cache is used directly.
 */
public class TwoLevelCacheManager implements CacheManager {

    private final CacheManager l1;
    private final CacheManager l2;
    private final ConcurrentHashMap<String, Cache> caches = new ConcurrentHashMap<>();

    public TwoLevelCacheManager(CacheManager l1, CacheManager l2) {
        this.l1 = l1;
        this.l2 = l2;
    }

    @Override
    @Nullable
    public Cache getCache(String name) {
        // computeIfAbsent does not store a null result, so an unknown name simply returns null.
        return caches.computeIfAbsent(name, n -> {
            Cache c1 = l1.getCache(n);
            Cache c2 = l2.getCache(n);
            if (c1 == null) {
                return c2;
            }
            if (c2 == null) {
                return c1;
            }
            return new TwoLevelCache(n, c1, c2);
        });
    }

    @Override
    public Collection<String> getCacheNames() {
        Set<String> names = new LinkedHashSet<>(l1.getCacheNames());
        names.addAll(l2.getCacheNames());
        return names;
    }
}
