package com.deutschflow.video.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.entity.GrammarCase;
import com.deutschflow.grammar.entity.GrammarCaseExample;
import com.deutschflow.grammar.repository.GrammarCaseExampleRepository;
import com.deutschflow.grammar.repository.GrammarCaseRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.service.SrsService;
import com.deutschflow.video.dto.VideoSceneDto;
import com.deutschflow.video.dto.VideoTimelineDto;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.WordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
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
    private final SrsService srsService;
    private final GrammarCaseRepository grammarCaseRepository;
    private final GrammarCaseExampleRepository grammarCaseExampleRepository;

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

    /** Build a timeline from the learner's SRS due cards (only words that have an image). */
    public VideoTimelineDto buildDueTimeline(Long userId, int limit) {
        int cap = Math.max(1, Math.min(limit, MAX_SCENES));
        List<VideoSceneDto> scenes = new ArrayList<>();
        AtomicInteger seq = new AtomicInteger(1);
        for (VocabReviewCard card : srsService.getDueCards(userId)) {
            if (scenes.size() >= cap) {
                break;
            }
            wordRepository.findByWord(card.german())
                    .filter(w -> w.getImageUrl() != null && !w.getImageUrl().isBlank())
                    .ifPresent(w -> scenes.add(toScene(w, seq.getAndIncrement())));
        }
        return new VideoTimelineDto("VOCAB_DUE", "due", NARRATION_PERSONA, scenes.size(), scenes);
    }

    /**
     * Build a grammar-explainer timeline from a grammar case: an intro card (rule) plus
     * one card per worked example. These are text cards (no image) — the player and the
     * .mp4 render show the German text on a branded background.
     */
    public VideoTimelineDto buildGrammarTimeline(Long caseId, int limit) {
        return grammarTimeline(grammarCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Grammar case not found: id=" + caseId)), limit);
    }

    /** Same as {@link #buildGrammarTimeline} but keyed by case name (e.g. "akkusativ"). */
    public VideoTimelineDto buildGrammarTimelineByName(String caseName, int limit) {
        return grammarTimeline(grammarCaseRepository.findByCaseName(caseName)
                .orElseThrow(() -> new NotFoundException("Grammar case not found: " + caseName)), limit);
    }

    private VideoTimelineDto grammarTimeline(GrammarCase gc, int limit) {
        int cap = Math.max(1, Math.min(limit, MAX_SCENES));
        AtomicInteger seq = new AtomicInteger(1);
        List<VideoSceneDto> scenes = new ArrayList<>();
        scenes.add(textScene(seq.getAndIncrement(), gc.getCaseLabel(), gc.getGermanDescription(), gc.getEnglishDescription()));
        for (GrammarCaseExample ex : grammarCaseExampleRepository.findByGrammarCaseId(gc.getId())) {
            if (scenes.size() >= cap) {
                break;
            }
            scenes.add(textScene(seq.getAndIncrement(), ex.getWordInFocus(), ex.getGermanSentence(), ex.getEnglishTranslation()));
        }
        return new VideoTimelineDto("GRAMMAR", gc.getCaseName(), NARRATION_PERSONA, scenes.size(), scenes);
    }

    /** A text-only scene (imageUrl=null): narrates the German line; captions carry term + translation. */
    private VideoSceneDto textScene(int seq, String term, String germanText, String translation) {
        String de = (germanText != null && !germanText.isBlank()) ? germanText.trim() : (term == null ? "" : term);
        String vi = translation == null ? "" : translation;
        String label = term == null ? "" : term;
        String narrationUrl = narrationFor(de);
        long durationMs = Math.max(MIN_SCENE_MS, de.length() * MS_PER_CHAR);
        return new VideoSceneDto(seq, null, label, vi, de, null, narrationUrl, de, vi, durationMs, "fade");
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
