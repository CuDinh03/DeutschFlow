package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Server-authoritative grading for skill-tree node exercises.
 *
 * <p>Grades the two deterministic exercise types embedded in a node's {@code content_json}
 * — {@code MULTIPLE_CHOICE} (answer key = {@code correct} option index) and {@code FILL_BLANK}
 * (answer key = {@code answer} string + optional {@code accept_also} list). The normalization
 * and matching rules mirror the client runner (see {@code mobile/lib/skillTreeApi.ts}
 * {@code normalizeAnswer}/{@code isFillCorrect}) so an honest client and the server compute the
 * same score, while a tampered client can no longer self-report an inflated {@code score_percent}
 * to unlock nodes or bypass paywalled content.
 *
 * <p>Exercises live under {@code content_json.exercises.theory_gate[]} and {@code .practice[]}.
 * SPEAKING/WRITING nodes have no deterministic items here (they are AI-graded), so grading them
 * yields {@link Result#gradeable()} == false and the caller falls back to the supplied score.
 */
public final class NodeExerciseGrader {

    private NodeExerciseGrader() {
    }

    /**
     * @param scoredCount  number of deterministically-gradeable exercises found
     * @param correctCount how many of those the submitted answers got right
     */
    public record Result(int scoredCount, int correctCount) {
        /** True when there was at least one deterministic item to grade. */
        public boolean gradeable() {
            return scoredCount > 0;
        }

        /** Percent 0-100, or -1 when there is nothing deterministic to grade. */
        public int percent() {
            return scoredCount == 0 ? -1 : (int) Math.round((correctCount * 100.0) / scoredCount);
        }
    }

    /**
     * Grade the scored exercises in {@code contentJson} against the learner's raw per-item answers.
     *
     * @param mapper      a Jackson {@link ObjectMapper}
     * @param contentJson the node's {@code content_json} (may be null/blank)
     * @param itemAnswers map of exerciseId -> answer, where an answer is either
     *                    {@code {"choice": <int>}} / a bare int (MULTIPLE_CHOICE) or
     *                    {@code {"text": "..."}} / a bare string (FILL_BLANK). May be null.
     * @return a {@link Result}; {@code Result.gradeable()} is false when nothing could be graded
     */
    public static Result grade(ObjectMapper mapper, String contentJson, Map<String, Object> itemAnswers) {
        if (contentJson == null || contentJson.isBlank() || itemAnswers == null) {
            return new Result(0, 0);
        }

        int scored = 0;
        int correct = 0;
        for (Map<String, Object> exercise : extractExercises(mapper, contentJson)) {
            String type = String.valueOf(exercise.get("type"));
            Object id = exercise.get("id");
            if (id == null) {
                continue;
            }
            Object answer = itemAnswers.get(String.valueOf(id));
            if ("MULTIPLE_CHOICE".equals(type)) {
                scored++;
                Integer chosen = choice(answer);
                Integer key = exercise.get("correct") instanceof Number n ? n.intValue() : null;
                if (chosen != null && chosen.equals(key)) {
                    correct++;
                }
            } else if ("FILL_BLANK".equals(type)) {
                scored++;
                if (fillCorrect(text(answer), exercise)) {
                    correct++;
                }
            }
        }
        return new Result(scored, correct);
    }

    /**
     * Count the deterministically-gradeable exercises ({@code MULTIPLE_CHOICE} + {@code FILL_BLANK})
     * in {@code contentJson}, independent of any answers. Used to distinguish a "theory-only" node
     * (0 scored items → may be completed via an explicit "mark as learned" action) from a node that
     * must be graded before it counts as passed — so a client can't skip grading. Never throws.
     */
    public static int countScored(ObjectMapper mapper, String contentJson) {
        if (contentJson == null || contentJson.isBlank()) {
            return 0;
        }
        int scored = 0;
        for (Map<String, Object> exercise : extractExercises(mapper, contentJson)) {
            String type = String.valueOf(exercise.get("type"));
            if (exercise.get("id") != null
                    && ("MULTIPLE_CHOICE".equals(type) || "FILL_BLANK".equals(type))) {
                scored++;
            }
        }
        return scored;
    }

    /** Flatten {@code content_json.exercises.theory_gate[]} + {@code .practice[]} into a list. */
    private static List<Map<String, Object>> extractExercises(ObjectMapper mapper, String contentJson) {
        List<Map<String, Object>> exercises = new ArrayList<>();
        try {
            Map<?, ?> content = mapper.readValue(contentJson, Map.class);
            Object ex = content.get("exercises");
            if (ex instanceof Map<?, ?> exMap) {
                collect(exMap.get("theory_gate"), exercises);
                collect(exMap.get("practice"), exercises);
            }
        } catch (Exception e) {
            return List.of();
        }
        return exercises;
    }

    @SuppressWarnings("unchecked")
    private static void collect(Object arr, List<Map<String, Object>> out) {
        if (arr instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    out.add((Map<String, Object>) m);
                }
            }
        }
    }

    private static Integer choice(Object answer) {
        if (answer instanceof Map<?, ?> m && m.get("choice") instanceof Number n) {
            return n.intValue();
        }
        if (answer instanceof Number n) {
            return n.intValue();
        }
        return null;
    }

    private static String text(Object answer) {
        if (answer instanceof Map<?, ?> m && m.get("text") != null) {
            return String.valueOf(m.get("text"));
        }
        if (answer instanceof String s) {
            return s;
        }
        return "";
    }

    private static boolean fillCorrect(String input, Map<String, Object> exercise) {
        String n = normalize(input);
        if (n.isEmpty()) {
            return false;
        }
        if (normalize(String.valueOf(exercise.get("answer"))).equals(n)) {
            return true;
        }
        if (exercise.get("accept_also") instanceof List<?> list) {
            for (Object a : list) {
                if (normalize(String.valueOf(a)).equals(n)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Mirrors the client's {@code normalizeAnswer}: trim, lowercase, strip .,!?;: and collapse spaces. */
    static String normalize(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().toLowerCase()
                .replaceAll("[.,!?;:]", "")
                .replaceAll("\\s+", " ");
    }
}
