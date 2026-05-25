package com.deutschflow.system.service;

import com.deutschflow.system.entity.SystemConfig;
import com.deutschflow.system.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SystemConfigService {

    private final SystemConfigRepository repository;

    @Cacheable(value = "systemConfig", key = "#key")
    public String getString(String key, String defaultValue) {
        return repository.findById(key)
                .map(SystemConfig::getConfigValue)
                .orElse(defaultValue);
    }

    public Double getDouble(String key, Double defaultValue) {
        String val = getString(key, null);
        if (val == null) return defaultValue;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            log.warn("Failed to parse double for config key: {}", key);
            return defaultValue;
        }
    }

    public Integer getInteger(String key, Integer defaultValue) {
        String val = getString(key, null);
        if (val == null) return defaultValue;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            log.warn("Failed to parse integer for config key: {}", key);
            return defaultValue;
        }
    }

    @CacheEvict(value = "systemConfig", key = "#key")
    public void setString(String key, String value, String description) {
        SystemConfig config = repository.findById(key).orElseGet(() -> {
            SystemConfig newConfig = new SystemConfig();
            newConfig.setConfigKey(key);
            return newConfig;
        });
        config.setConfigValue(value);
        if (description != null) {
            config.setDescription(description);
        }
        repository.save(config);
    }
}
