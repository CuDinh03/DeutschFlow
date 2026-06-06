package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Server-authoritative grading for LLM-generated practice-node exercises (the 4-skill
 * Hören/Sprechen/Lesen/Schreiben follow-up sessions).
 *
 * <p>The exercise schema here differs from the main skill-tree node (see
 * {@link NodeExerciseGrader}): keys are {@code correct_index} (multiple choice, by option index)
 * and {@code correct_answer} (+ optional {@code accept_also}); free-speaking items submit the
 * sentinel answer {@code "spoken"} and count as correct (AI-graded elsewhere). The grading rules
 * mirror the web runner's {@code handleAnswer}
 * (frontend/src/app/student/practice-session/[nodeId]/[skill]/client-page.tsx) exactly, so an
 * honest client and the server compute the same score — while a tampered client can no longer
 * submit {@code correct: true} for wrong answers to inflate its XP.
 *
 * <p>Exercises are stored in {@code practice_node_sessions.exercises_json} as a JSON array (or an
 * object with an {@code exercises} array). The submitted answers map is keyed by exercise index
 * ("0", "1", …); each value is either the raw answer or {@code {"answer": <raw>, "correct": <bool>}}
 * — the client-supplied {@code correct} flag is ignored.
 */
public final class PracticeExerciseGrader {

    private PracticeExerciseGrader() {
    }

    public record Result(int total, int correctCount) {
        public boolean gradeable() {
            return total > 0;
        }

        public int percent() {
            return total == 0 ? -1 : (int) Math.round((correctCount * 100.0) / total);
        }
    }

    public static Result grade(ObjectMapper mapper, String exercisesJson, Map<String, Object> itemAnswers) {
        if (exercisesJson == null || exercisesJson.isBlank() || itemAnswers == null) {
            return new Result(0, 0);
        }

        List<?> exercises;
        try {
            Object parsed = mapper.readValue(exercisesJson, Object.class);
            if (parsed instanceof List<?> list) {
                exercises = list;
            } else if (parsed instanceof Map<?, ?> m && m.get("exercises") instanceof List<?> l) {
                exercises = l;
            } else {
                return new Result(0, 0);
            }
        } catch (Exception e) {
            return new Result(0, 0);
        }

        int total = 0;
        int correct = 0;
        for (int i = 0; i < exercises.size(); i++) {
            if (!(exercises.get(i) instanceof Map<?, ?> exRaw)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> exercise = (Map<String, Object>) exRaw;
            total++;
            Object cell = itemAnswers.get(String.valueOf(i));
            Object submitted = cell instanceof Map<?, ?> m ? m.get("answer") : cell;
            if (isCorrect(exercise, submitted)) {
                correct++;
            }
        }
        return new Result(total, correct);
    }

    /** Mirrors the web client's handleAnswer precedence: correct_index → correct_answer → "spoken". */
    private static boolean isCorrect(Map<String, Object> exercise, Object submitted) {
        Object correctIndex = exercise.get("correct_index");
        if (correctIndex instanceof Number ci && submitted instanceof Number sn) {
            return ci.intValue() == sn.intValue();
        }
        Object correctAnswer = exercise.get("correct_answer");
        if (correctAnswer != null && submitted instanceof String s) {
            String n = normalize(s);
            if (normalize(String.valueOf(correctAnswer)).equals(n)) {
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
        return "spoken".equals(submitted);
    }

    /** Mirrors the web client's normalization: lowercase + trim (no punctuation stripping). */
    static String normalize(String s) {
        return s == null ? "" : s.toLowerCase().trim();
    }
}
