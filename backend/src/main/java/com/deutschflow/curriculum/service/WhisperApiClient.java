package com.deutschflow.curriculum.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Java-native Whisper STT client — loại bỏ Python sidecar.
 * Sử dụng OpenAI Whisper API (cũng dùng được qua Groq).
 *
 * <p>Chi phí: ~$0.006/phút audio. 10 nodes × 3 phút = ~$0.18 một lần.</p>
 */
@Service
@Slf4j
public class WhisperApiClient {

    private final RestClient restClient;

    @Value("${app.groq.api-key:${GROQ_API_KEY:}}")
    private String groqApiKey;

    @Value("${app.openai.api-key:}")
    private String openAiApiKey;

    @Value("${app.groq.whisper-model:whisper-large-v3-turbo}")
    private String whisperModel;

    @Value("${app.openai.whisper-base-url:https://api.openai.com/v1}")
    private String openAiBaseUrl;

    private String getApiKey() {
        if (groqApiKey != null && !groqApiKey.isBlank()) return groqApiKey;
        return openAiApiKey;
    }

    private String getBaseUrl() {
        if (groqApiKey != null && !groqApiKey.isBlank()) return "https://api.groq.com/openai/v1";
        return openAiBaseUrl;
    }

    private String getWhisperModel() {
        if (groqApiKey != null && !groqApiKey.isBlank()) return whisperModel;
        return "whisper-1";
    }

    public WhisperApiClient() {
        this.restClient = RestClient.create();
    }

    /**
     * Transcribe audio → word-level timestamps.
     *
     * @param audioBytes raw audio data (MP3, WAV, WebM, etc.)
     * @param filename   original filename (e.g., "recording.webm")
     * @return list of word-level timestamps
     */
    public List<WordTimestamp> transcribeWithTimestamps(byte[] audioBytes, String filename) {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[Whisper] No API key configured. Returning empty transcript.");
            return List.of();
        }

        var body = new LinkedMultiValueMap<String, Object>();
        body.add("file", new ByteArrayResource(audioBytes) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "audio.webm";
            }
        });
        body.add("model", getWhisperModel());
        body.add("response_format", "verbose_json");
        body.add("timestamp_granularities[]", "word");

        try {
            WhisperResponse response = restClient.post()
                    .uri(getBaseUrl() + "/audio/transcriptions")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(WhisperResponse.class);

            if (response == null || response.words() == null) {
                log.warn("[Whisper] Empty response for file={}", filename);
                return List.of();
            }

            log.info("[Whisper] Transcribed: {} words, text='{}...'",
                    response.words().size(),
                    response.text() != null ? response.text().substring(0, Math.min(50, response.text().length())) : "");

            return response.words().stream()
                    .map(w -> new WordTimestamp(w.word(), w.start(), w.end()))
                    .toList();

        } catch (Exception e) {
            log.error("[Whisper] Transcription failed for file={}: {}", filename, e.getMessage());
            return List.of();
        }
    }

    /**
     * Simple transcription without timestamps (for pronunciation evaluation).
     */
    public String transcribeText(byte[] audioBytes, String filename) {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[Whisper] No API key configured.");
            return "";
        }

        var body = new LinkedMultiValueMap<String, Object>();
        body.add("file", new ByteArrayResource(audioBytes) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "audio.webm";
            }
        });
        body.add("model", getWhisperModel());
        body.add("language", "de");
        body.add("response_format", "text");

        try {
            String text = restClient.post()
                    .uri(getBaseUrl() + "/audio/transcriptions")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            log.info("[Whisper] Text: '{}'", text != null ? text.trim() : "");
            return text != null ? text.trim() : "";

        } catch (Exception e) {
            log.error("[Whisper] Text transcription failed: {}", e.getMessage());
            return "";
        }
    }

    // ── DTOs ──

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WhisperResponse(
            String text,
            @JsonProperty("words") List<WordEntry> words
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WordEntry(String word, double start, double end) {}

    public record WordTimestamp(String word, double start, double end) {}
}
