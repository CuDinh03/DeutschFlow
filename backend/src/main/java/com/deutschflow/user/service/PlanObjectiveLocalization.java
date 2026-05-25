package com.deutschflow.user.service;

import com.deutschflow.user.entity.User;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Resolves week {@code objectives} for API responses — supports legacy string lists or
 * {@code objectives} shaped as {@code List<Map<String,String>>}.
 */
public final class PlanObjectiveLocalization {

    private PlanObjectiveLocalization() {}

    /** Mutates {@code weeks[*].objectives} in-place to localized {@link String} lists. */
    @SuppressWarnings("unchecked")
    public static void localizeWeekObjectives(Map<String, Object> planRoot, User.Locale locale) {
        Object weeksObj = planRoot.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) {
            return;
        }
        String key = locale == null ? "en" : locale.name().toLowerCase(Locale.ROOT);
        for (Object wo : weeks) {
            if (!(wo instanceof Map<?, ?> rawWeek)) continue;
            Object objs = rawWeek.get("objectives");
            if (!(objs instanceof List<?> rawList)) continue;

            Map<String, Object> weekMut = (Map<String, Object>) rawWeek;
            List<String> out = new ArrayList<>(rawList.size());
            for (Object item : rawList) {
                out.add(resolveLine(item, key));
            }
            weekMut.put("objectives", out);
        }
    }

    static String resolveLine(Object item, String localeKey) {
        if (item == null) {
            return "";
        }
        if (item instanceof String s) {
            return s;
        }
        if (item instanceof Map<?, ?> m) {
            Object v = m.get(localeKey);
            if (v != null && !String.valueOf(v).isBlank()) {
                return String.valueOf(v).trim();
            }
            Object en = m.get("en");
            if (en != null && !String.valueOf(en).isBlank()) {
                return String.valueOf(en).trim();
            }
            for (Object x : m.values()) {
                if (x != null && !String.valueOf(x).isBlank()) {
                    return String.valueOf(x).trim();
                }
            }
            return "";
        }
        return String.valueOf(item);
    }
}
