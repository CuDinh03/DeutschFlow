package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.tts.GermanSentenceSplitter;
import com.deutschflow.speaking.tts.WavEncoder;
import com.deutschflow.speaking.tts.XttsPersonaVoiceResolver;
import com.deutschflow.speaking.tts.XttsStreamClient;
import com.deutschflow.speaking.tts.XttsVoice;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller for one-shot Text-to-Speech (greeting, on-device fallback).
 * <p>
 * Provider cascade:
 * 1. <b>XTTS</b> — when configured and the persona has a streaming voice, so non-streamed speech
 *    uses the SAME voice as the per-sentence streaming chat (returns {@code audio/wav}).
 * 2. <b>Edge TTS</b> sidecar — fallback (returns {@code audio/mpeg}).
 * 3. <b>503</b> — neither configured → clients fall back to on-device browser speech.
 */
@Slf4j
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
public class TtsController {

    /** XTTS native output format. */
    private static final int XTTS_SAMPLE_RATE = 24000;
    private static final int XTTS_CHANNELS = 1;

    private final EdgeTtsService ttsService;
    private final XttsStreamClient xttsStreamClient;
    private final XttsPersonaVoiceResolver voiceResolver;

    /**
     * POST /api/ai-speaking/tts
     * Body: { "text": "Hallo, wie geht es dir?", "persona": "LUKAS" }
     * Returns: audio/wav (XTTS) or audio/mpeg (Edge TTS); 503 when neither is available.
     */
    @PostMapping("/tts")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> synthesize(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        String text = body.getOrDefault("text", "");
        String persona = body.getOrDefault("persona", "DEFAULT");

        if (text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // 1. XTTS — match the streaming chat voice for this persona.
        byte[] wav = synthesizeViaXtts(persona, text);
        if (wav != null) {
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("audio/wav"))
                    .cacheControl(CacheControl.noCache())
                    .body(wav);
        }

        // 2. Edge TTS sidecar.
        byte[] audio = ttsService.synthesize(text, persona);
        if (audio == null || audio.length == 0) {
            // 3. Neither configured — clients fall back to on-device speech (documented 503).
            log.debug("[TTS] No audio for persona '{}' (no XTTS/Edge) — returning 503", persona);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/mpeg"))
                .cacheControl(CacheControl.noCache())
                .body(audio);
    }

    /**
     * Synthesize the full text via XTTS, sentence-by-sentence (same splitting + voice as the
     * streaming chat), concatenated into one WAV. Returns {@code null} when XTTS is not configured,
     * the persona has no streaming voice (e.g. Vietnamese tutors), or synthesis produced nothing.
     */
    private byte[] synthesizeViaXtts(String persona, String text) {
        if (!xttsStreamClient.isConfigured()) {
            return null;
        }
        Optional<XttsVoice> voice = voiceResolver.resolve(SpeakingPersona.fromApi(persona));
        if (voice.isEmpty()) {
            return null;
        }

        GermanSentenceSplitter splitter = new GermanSentenceSplitter();
        List<String> sentences = new ArrayList<>(splitter.append(text));
        splitter.flush().ifPresent(sentences::add);

        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        String previous = null;
        for (String sentence : sentences) {
            byte[] chunk = xttsStreamClient.synthesize(voice.get(), sentence, previous);
            if (chunk != null && chunk.length > 0) {
                pcm.writeBytes(chunk);
            }
            previous = sentence;
        }

        byte[] data = pcm.toByteArray();
        return data.length > 0 ? WavEncoder.pcm16ToWav(data, XTTS_SAMPLE_RATE, XTTS_CHANNELS) : null;
    }

    /**
     * GET /api/ai-speaking/tts/status — Edge TTS usage stats (admin dashboard).
     */
    @GetMapping("/tts/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> stats = ttsService.getUsageStats();
        return ResponseEntity.ok(stats);
    }
}
