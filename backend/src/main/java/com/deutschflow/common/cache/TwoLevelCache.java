package com.deutschflow.common.cache;

import org.springframework.cache.Cache;
import org.springframework.lang.Nullable;

import java.util.concurrent.Callable;

/**
 * Read-through two-level cache: Caffeine in-process (L1) backed by Redis (L2).
 *
 * <p>get: L1 → on miss L2 (promoting the hit back into L1) → miss. put / evict / clear hit both
 * layers. The L2 lets warm entries (AI completions, TTS audio, curriculum) survive a blue-green
 * restart that drops the in-process L1 — saving the cost of regenerating them after every deploy.
 */
public class TwoLevelCache implements Cache {

    private final String name;
    private final Cache l1;
    private final Cache l2;

    public TwoLevelCache(String name, Cache l1, Cache l2) {
        this.name = name;
        this.l1 = l1;
        this.l2 = l2;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public Object getNativeCache() {
        return l1.getNativeCache();
    }

    @Override
    @Nullable
    public ValueWrapper get(Object key) {
        ValueWrapper v = l1.get(key);
        if (v != null) {
            return v;
        }
        v = l2.get(key);
        if (v != null) {
            l1.put(key, v.get()); // promote into L1 for subsequent low-latency hits
        }
        return v;
    }

    @Override
    @Nullable
    @SuppressWarnings("unchecked")
    public <T> T get(Object key, @Nullable Class<T> type) {
        ValueWrapper w = get(key);
        if (w == null) {
            return null;
        }
        Object value = w.get();
        return type != null && value != null ? type.cast(value) : (T) value;
    }

    @Override
    @Nullable
    @SuppressWarnings("unchecked")
    public <T> T get(Object key, Callable<T> valueLoader) {
        ValueWrapper w = get(key);
        if (w != null) {
            return (T) w.get();
        }
        T value;
        try {
            value = valueLoader.call();
        } catch (Exception e) {
            throw new ValueRetrievalException(key, valueLoader, e);
        }
        put(key, value);
        return value;
    }

    @Override
    public void put(Object key, @Nullable Object value) {
        l1.put(key, value);
        l2.put(key, value);
    }

    @Override
    @Nullable
    public ValueWrapper putIfAbsent(Object key, @Nullable Object value) {
        ValueWrapper existing = get(key);
        if (existing != null) {
            return existing;
        }
        put(key, value);
        return null;
    }

    @Override
    public void evict(Object key) {
        l1.evict(key);
        l2.evict(key);
    }

    @Override
    public boolean evictIfPresent(Object key) {
        boolean inL1 = l1.evictIfPresent(key);
        boolean inL2 = l2.evictIfPresent(key);
        return inL1 || inL2;
    }

    @Override
    public void clear() {
        l1.clear();
        l2.clear();
    }

    @Override
    public boolean invalidate() {
        boolean l1Had = l1.invalidate();
        boolean l2Had = l2.invalidate();
        return l1Had || l2Had;
    }
}
