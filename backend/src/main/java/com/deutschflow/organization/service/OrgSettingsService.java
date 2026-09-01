package com.deutschflow.organization.service;

import com.deutschflow.organization.entity.OrgSetting;
import com.deutschflow.organization.repository.OrgSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Cấu hình theo trung tâm (V298). Key được LIỆT KÊ TĨNH kèm default — key lạ bị từ chối ở
 * {@link #put} thay vì thành rác key-value; thiếu dòng = dùng default (không seed).
 */
@Service
@RequiredArgsConstructor
public class OrgSettingsService {

    /** P04 (PR-10): công một buổi tính GỒM giờ nghỉ (195′) — default true = hành vi hiện hành. */
    public static final String TIMESHEET_BREAK_INCLUDED = "timesheet_break_included";
    /** Spec §7 (PR-9): ≤ N học viên yếu một mục tiêu → gợi ý KÈM RIÊNG (kèm tên). */
    public static final String SUPPORT_INDIVIDUAL_MAX = "support_individual_max";
    /** Spec §7 (PR-9): ≥ N học viên yếu một mục tiêu → gợi ý CÂN NHẮC ÔN CHUNG cả lớp. */
    public static final String REVIEW_GROUP_MIN = "review_group_min";

    public static final Map<String, String> DEFAULTS = Map.of(
            TIMESHEET_BREAK_INCLUDED, "true",
            SUPPORT_INDIVIDUAL_MAX, "2",
            REVIEW_GROUP_MIN, "3");

    private final OrgSettingRepository settingRepo;

    @Transactional(readOnly = true)
    public String get(Long orgId, String key) {
        String def = DEFAULTS.get(key);
        if (def == null) throw new IllegalArgumentException("Key cấu hình không tồn tại: " + key);
        if (orgId == null) return def;
        return settingRepo.findById(new OrgSetting.Id(orgId, key))
                .map(OrgSetting::getValue)
                .orElse(def);
    }

    public int getInt(Long orgId, String key) {
        try {
            return Integer.parseInt(get(orgId, key));
        } catch (NumberFormatException e) {
            return Integer.parseInt(DEFAULTS.get(key));
        }
    }

    public boolean getBoolean(Long orgId, String key) {
        return Boolean.parseBoolean(get(orgId, key));
    }

    /** Toàn bộ cấu hình của org — default phủ những key chưa có dòng. */
    @Transactional(readOnly = true)
    public Map<String, String> all(Long orgId) {
        Map<String, String> stored = settingRepo.findByIdOrgId(orgId).stream()
                .collect(Collectors.toMap(s -> s.getId().getSettingKey(), OrgSetting::getValue));
        return DEFAULTS.keySet().stream()
                .collect(Collectors.toMap(k -> k, k -> stored.getOrDefault(k, DEFAULTS.get(k))));
    }

    @Transactional
    public void put(Long orgId, String key, String value, Long updatedBy) {
        if (!DEFAULTS.containsKey(key)) {
            throw new com.deutschflow.common.exception.BadRequestException("Key cấu hình không hợp lệ: " + key);
        }
        OrgSetting setting = settingRepo.findById(new OrgSetting.Id(orgId, key))
                .orElseGet(() -> OrgSetting.builder().id(new OrgSetting.Id(orgId, key)).build());
        setting.setValue(value);
        setting.setUpdatedBy(updatedBy);
        settingRepo.save(setting);
    }
}
