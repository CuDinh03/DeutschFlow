package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.LearningPlan;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StoredLearningPlanSupport {
    private final ObjectMapper objectMapper;

    public String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Invalid JSON payload");
        }
    }

    public String toJsonOrNull(Object obj) {
        if (obj == null) return null;
        if (obj instanceof java.util.Collection<?> c && c.isEmpty()) return null;
        return toJson(obj);
    }

    public Map<String, Object> fromJsonMap(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    public List<String> fromJsonList(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> findSession(Map<String, Object> planObj, int week, int sessionIndex) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) throw new NotFoundException("Session not found");
        for (Object wObj : weeks) {
            if (!(wObj instanceof Map<?, ?>)) continue;
            Map<String, Object> w = (Map<String, Object>) wObj;
            int wn = safeInt(w.get("week"), -1);
            if (wn != week) continue;
            Object sessionsObj = w.get("sessions");
            if (!(sessionsObj instanceof List<?> sessions)) break;
            for (Object sObj : sessions) {
                if (!(sObj instanceof Map<?, ?>)) continue;
                Map<String, Object> s = (Map<String, Object>) sObj;
                int idx = safeInt(s.get("index"), -1);
                if (idx == sessionIndex) return s;
            }
        }
        throw new NotFoundException("Session not found");
    }

    public int[] computeNextSessionPointer(Map<String, Object> planObj, LearningPlan plan, int week, int sessionIndex) {
        int spw = extractSessionsPerWeek(planObj);
        if (spw < 1) {
            return null;
        }
        int nw = week;
        int ni = sessionIndex + 1;
        if (ni > spw) {
            nw++;
            ni = 1;
        }
        if (nw > plan.getWeeksTotal()) {
            return null;
        }
        try {
            findSession(planObj, nw, ni);
        } catch (NotFoundException e) {
            return null;
        }
        return new int[]{nw, ni};
    }

    @SuppressWarnings("unchecked")
    public int extractSessionsPerWeek(Map<String, Object> planObj) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks) || weeks.isEmpty()) return -1;
        Object w0 = weeks.get(0);
        if (!(w0 instanceof Map<?, ?>)) return -1;
        Object sessionsObj = ((Map<String, Object>) w0).get("sessions");
        if (!(sessionsObj instanceof List<?> sessions)) return -1;
        return sessions.size();
    }

    @SuppressWarnings("unchecked")
    public void enrichMissingSessionDetails(Map<String, Object> planObj) {
        Object weeksObj = planObj.get("weeks");
        if (!(weeksObj instanceof List<?> weeks)) return;

        for (Object wObj : weeks) {
            if (!(wObj instanceof Map<?, ?> w)) continue;
            Object sessionsObj = ((Map<String, Object>) w).get("sessions");
            if (!(sessionsObj instanceof List<?> sessions)) continue;

            for (Object sObj : sessions) {
                if (!(sObj instanceof Map<?, ?>)) continue;
                Map<String, Object> s = (Map<String, Object>) sObj;
                if (s.get("details") != null) continue;

                String type = String.valueOf(s.getOrDefault("type", "GRAMMAR"));
                int minutes = safeInt(s.getOrDefault("minutes", 25), 25);
                int difficulty = safeInt(s.getOrDefault("difficulty", 3), 3);

                s.put("details", buildSessionDetailsFallback(type, minutes, difficulty));
            }
        }
    }

    public int safeInt(Object v, int fallback) {
        if (v == null) return fallback;
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private Map<String, Object> buildSessionDetailsFallback(String type, int minutes, int difficulty) {
        List<String> theory = new ArrayList<>();
        List<Map<String, Object>> exercises = new ArrayList<>();

        if ("GRAMMAR".equals(type)) {
            theory.add("Articles (der/die/das, ein/eine) + basic sentence order (V2).");
            exercises.add(ex("Choose the correct article (DER/DIE/DAS)", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
            exercises.add(ex("Word order: build 5 sentences (S-V-O)", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
        } else if ("PRACTICE".equals(type)) {
            theory.add("Practice vocabulary-in-context + grammar micro-drills.");
            exercises.add(ex("Vocabulary in short sentences (10 items)", "VOCABULARY", difficulty, Math.max(6, minutes / 2)));
            exercises.add(ex("Mini quiz: article + noun (10 items)", "GRAMMAR", difficulty, Math.max(6, minutes / 2)));
        } else if ("SPEAKING".equals(type)) {
            theory.add("Speaking drills: shadowing + role-play.");
            exercises.add(ex("Role-play dialogue (2 rounds)", "SPEAKING", difficulty, Math.max(8, minutes)));
        } else {
            theory.add("Review: mixed recall + quick test.");
            exercises.add(ex("Mixed review quiz (15 items)", "REVIEW", difficulty, Math.max(6, minutes)));
        }

        return new LinkedHashMap<>(Map.of(
                "title", type + " session",
                "theory", theory,
                "exercises", exercises
        ));
    }

    private Map<String, Object> ex(String title, String skill, int difficulty, int minutes) {
        return new LinkedHashMap<>(Map.of(
                "title", title,
                "skill", skill,
                "difficulty", difficulty,
                "minutes", minutes
        ));
    }
}

