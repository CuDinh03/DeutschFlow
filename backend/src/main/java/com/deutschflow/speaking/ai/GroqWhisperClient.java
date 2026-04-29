package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/**
 * Client for Groq's Whisper STT API.
 * Endpoint: POST https://api.groq.com/openai/v1/audio/transcriptions
 * Model: whisper-large-v3
 */
@Component
@Slf4j
public class GroqWhisperClient {

    private static final String WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

    private final String apiKey;
    private final String whisperModel;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GroqWhisperClient(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.whisper-model:whisper-large-v3}") String whisperModel,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.whisperModel = whisperModel;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("GroqWhisperClient initialized — model: {}", whisperModel);
    }

    /**
     * Transcribes audio bytes using Groq Whisper.
     *
     * @param audioBytes    raw audio bytes (webm, mp4, wav, etc.)
     * @param filename      original filename (used to hint codec to Groq, e.g. "voice.webm")
     * @param language      BCP-47 language code to hint the model (e.g. "de")
     * @return the transcribed text
     */
    public String transcribe(byte[] audioBytes, String filename, String language) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException("Groq API key is not configured.");
        }

        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, audioBytes, filename, language);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(WHISPER_URL))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("[Whisper] HTTP {}: {}", response.statusCode(), response.body());
                throw new AiServiceException("Whisper transcription failed: HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText(null);
            if (text == null || text.isBlank()) {
                throw new AiServiceException("Whisper returned empty transcript.");
            }
            log.debug("[Whisper] transcript ({} bytes audio): {}", audioBytes.length, text);
            return text;
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AiServiceException("Whisper transcription error: " + e.getMessage(), e);
        }
    }

    // -----------------------------------------------------------------------
    // Build multipart/form-data body manually (no external dependency)
    // -----------------------------------------------------------------------

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes,
                                      String filename, String language) {
        try {
            String safeFilename = (filename != null && !filename.isBlank()) ? filename : "audio.webm";
            StringBuilder sb = new StringBuilder();

            // --- model field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n");
            sb.append(whisperModel).append("\r\n");

            // --- language field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n");
            sb.append(language != null ? language : "de").append("\r\n");

            // --- response_format ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n");
            sb.append("json\r\n");

            // --- file header ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"file\"; filename=\"")
              .append(safeFilename).append("\"\r\n");
            sb.append("Content-Type: application/octet-stream\r\n\r\n");

            byte[] prefix = sb.toString().getBytes(StandardCharsets.UTF_8);
            byte[] suffix = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);

            byte[] combined = new byte[prefix.length + audioBytes.length + suffix.length];
            System.arraycopy(prefix, 0, combined, 0, prefix.length);
            System.arraycopy(audioBytes, 0, combined, prefix.length, audioBytes.length);
            System.arraycopy(suffix, 0, combined, prefix.length + audioBytes.length, suffix.length);
            return combined;
        } catch (Exception e) {
            throw new AiServiceException("Failed to build multipart body", e);
        }
    }
}
