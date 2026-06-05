package com.deutschflow.video.service;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.video.dto.VideoSceneDto;
import com.deutschflow.video.dto.VideoTimelineDto;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.WordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Assembles learning-video timelines from existing content. M1 covers vocabulary:
 * each word with an image becomes a scene (image + German narration + captions).
 *
 * <p>Reuses {@link WordRepository} (images/examples already stored on {@code Word}),
 * {@link EdgeTtsService} (German narration, cached), and {@link S3StorageService}
 * (narration stored once under a content-hash key, deduped across users/requests).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VideoLessonService {

    private static final String NARRATION_PERSONA = "LUKAS";
    private static final int MAX_SCENES = 10;
    private static final long MIN_SCENE_MS = 2500L;
    private static final long MS_PER_CHAR = 70L;

    private final WordRepository wordRepository;
    private final EdgeTtsService edgeTtsService;
    private final S3StorageService s3StorageService;

    /** Build a vocab timeline for a CEFR level: most-frequent words that have an image. */
    public VideoTimelineDto buildVocabTimeline(String level, int limit) {
        int cap = Math.max(1, Math.min(limit, MAX_SCENES));
        List<Word> all = wordRepository.findByCefrLevel(level);
        List<Word> usable = all.stream()
                .filter(w -> w.getImageUrl() != null && !w.getImageUrl().isBlank())
                .sorted(Comparator.comparingInt(w -> w.getFrequencyRank() == null ? Integer.MAX_VALUE : w.getFrequencyRank()))
                .limit(cap)
                .toList();

        int skipped = all.size() - usable.size();
        if (usable.isEmpty()) {
            log.info("[VideoLesson] level={} has no words with images ({} total)", level, all.size());
        } else if (skipped > 0) {
            log.debug("[VideoLesson] level={} using {} scenes, skipped {} word(s) without image", level, usable.size(), skipped);
        }

        AtomicInteger seq = new AtomicInteger(1);
        List<VideoSceneDto> scenes = usable.stream()
                .map(w -> toScene(w, seq.getAndIncrement()))
                .toList();

        return new VideoTimelineDto("VOCAB", level, NARRATION_PERSONA, scenes.size(), scenes);
    }

    private VideoSceneDto toScene(Word w, int seq) {
        String example = (w.getExampleSentence() != null && !w.getExampleSentence().isBlank())
                ? w.getExampleSentence().trim()
                : w.getWord();
        String narrationUrl = narrationFor(example);
        long durationMs = Math.max(MIN_SCENE_MS, example.length() * MS_PER_CHAR);
        String captionDe = example.equals(w.getWord()) ? w.getWord() : w.getWord() + " — " + example;
        return new VideoSceneDto(
                seq,
                w.getId(),
                w.getWord(),
                w.getTranslation(),
                example,
                w.getImageUrl(),
                narrationUrl,
                captionDe,
                w.getTranslation(),
                durationMs,
                "kenburns");
    }

    /**
     * Synthesize (or reuse cached) German narration for a line of text.
     * Stored once under {@code video-narration/<sha256>.mp3}; returns the S3 URL,
     * or {@code null} when TTS is unavailable so the player can still show the scene.
     */
    private String narrationFor(String text) {
        if (!edgeTtsService.isConfigured()) {
            return null;
        }
        String key = "video-narration/" + sha256(text + "|" + NARRATION_PERSONA) + ".mp3";
        try {
            if (s3StorageService.objectExists(key)) {
                return s3StorageService.publicUrl(key);
            }
            byte[] mp3 = edgeTtsService.synthesize(text, NARRATION_PERSONA);
            if (mp3 == null || mp3.length == 0) {
                return null;
            }
            return s3StorageService.uploadBytes(mp3, key, "audio/mpeg").getUrl();
        } catch (Exception e) {
            log.warn("[VideoLesson] narration failed for \"{}\": {}", truncate(text), e.getMessage());
            return null;
        }
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }

    private static String truncate(String s) {
        return s.length() > 40 ? s.substring(0, 40) + "…" : s;
    }
}
