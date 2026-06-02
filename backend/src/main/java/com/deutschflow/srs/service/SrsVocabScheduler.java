package com.deutschflow.srs.service;

import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Bridges content/learning flows into the FSRS spaced-repetition queue
 * ({@link SrsService}). Centralises the {@code vocabId} synthesis and the
 * content_json vocab extraction so callers (skill tree, practice nodes,
 * session workflow, vocabulary page) don't duplicate that logic.
 *
 * <p>All scheduling is best-effort: failures are logged and swallowed so a
 * problem feeding the review queue never breaks the lesson-completion flow
 * (same contract as XP awarding).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SrsVocabScheduler {

    private static final int MAX_VOCAB_ID_LEN = 80; // matches vocab_review_schedule.vocab_id VARCHAR(80)

    private final SrsService srsService;
    private final ObjectMapper objectMapper;

    /**
     * Schedules a pre-built batch of vocab requests (best-effort).
     * Idempotent — {@link SrsService#scheduleVocab} skips items already scheduled.
     */
    public void schedule(Long userId, List<ScheduleVocabRequest> requests) {
        if (userId == null || requests == null || requests.isEmpty()) return;
        try {
            srsService.scheduleVocabBatch(userId, requests);
            log.debug("[SRS] Scheduled {} vocab item(s) for user {}", requests.size(), userId);
        } catch (Exception e) {
            log.warn("[SRS] Failed to schedule {} vocab item(s) for user {}", requests.size(), userId, e);
        }
    }

    /**
     * Parses a node's {@code content_json} and schedules its {@code vocabulary[]}
     * entries into the FSRS queue (best-effort). Tolerates both snake_case
     * ({@code example_de}) and camelCase ({@code exampleDe}) field names, and a
     * {@code meaning} that is either a plain string or a {@code {vi,en}} object.
     */
    public void scheduleFromContentJson(Long userId, Long nodeId, String contentJson) {
        if (userId == null || contentJson == null || contentJson.isBlank()) return;
        try {
            Map<String, Object> content = objectMapper.readValue(contentJson, Map.class);
            Object vocabRaw = content.get("vocabulary");
            if (!(vocabRaw instanceof List<?> vocabList) || vocabList.isEmpty()) return;

            List<ScheduleVocabRequest> requests = new ArrayList<>(vocabList.size());
            for (Object o : vocabList) {
                if (!(o instanceof Map<?, ?> m)) continue;
                String german = str(m.get("german"));
                if (german == null || german.isBlank()) continue;
                String meaning = meaning(m.get("meaning"));
                String exampleDe = firstNonNull(str(m.get("example_de")), str(m.get("exampleDe")));
                String speakDe = firstNonNull(str(m.get("speak_de")), str(m.get("speakDe")));
                String idField = str(m.get("id"));
                requests.add(new ScheduleVocabRequest(
                        nodeId, vocabId(nodeId, idField, german), german, meaning, exampleDe, speakDe));
            }
            schedule(userId, requests);
        } catch (Exception e) {
            log.warn("[SRS] Failed to parse content_json vocab for user {} node {}", userId, nodeId, e);
        }
    }

    /**
     * Stable, idempotent vocab identifier.
     * Prefers an explicit content id (e.g. "sg02_01"); otherwise derives a slug
     * from the German lemma, scoped by node when available.
     */
    public static String vocabId(Long nodeId, String explicitId, String german) {
        if (explicitId != null && !explicitId.isBlank()) {
            return cap(explicitId.trim());
        }
        String slug = slug(german);
        String id = nodeId != null ? "node_" + nodeId + "_" + slug : "vocab_" + slug;
        return cap(id);
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private static String slug(String german) {
        String s = german == null ? "" : german.toLowerCase().trim().replaceAll("[^a-z0-9äöüß]+", "_");
        s = s.replaceAll("^_+|_+$", "");
        return s.isBlank() ? "x" : s;
    }

    private static String cap(String s) {
        return s.length() > MAX_VOCAB_ID_LEN ? s.substring(0, MAX_VOCAB_ID_LEN) : s;
    }

    @SuppressWarnings("unchecked")
    private static String meaning(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            Object vi = ((Map<String, Object>) map).get("vi");
            Object en = ((Map<String, Object>) map).get("en");
            return str(vi != null ? vi : en);
        }
        return str(raw);
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static String firstNonNull(String a, String b) {
        return a != null ? a : b;
    }
}
