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
    private final GroqConcurrencyLimiter concurrencyLimiter;

    public GroqWhisperClient(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.whisper-model:whisper-large-v3}") String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter) {
        this.apiKey = apiKey;
        this.whisperModel = whisperModel;
        this.objectMapper = objectMapper;
        this.concurrencyLimiter = concurrencyLimiter;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("GroqWhisperClient initialized — model: {}", whisperModel);
    }

    public String getWhisperModel() {
        return whisperModel;
    }

    /** Word-level result from verbose transcription. */
    public record WordTimestamp(String word, double start, double end) {}

    /** Verbose transcript with segment-level confidence and per-word timestamps. */
    public record VerboseTranscript(String text, double avgLogprob, java.util.List<WordTimestamp> words) {}

    /**
     * Transcribes with verbose_json + word timestamps for pronunciation scoring.
     */
    public VerboseTranscript transcribeVerbose(byte[] audioBytes, String filename, String language, String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException("Groq API key is not configured.");
        }

        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, audioBytes, filename, language, prompt, true);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(WHISPER_URL))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireWhisper();
            if (!acquired) throw new AiServiceException("Speech recognition is busy.");
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                throw new AiServiceException("Whisper verbose failed: HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText("");

            // Extract segment avg_logprob
            double avgLogprob = -0.3;
            JsonNode segments = root.path("segments");
            if (segments.isArray() && !segments.isEmpty()) {
                double sum = 0;
                for (JsonNode seg : segments) sum += seg.path("avg_logprob").asDouble(-0.3);
                avgLogprob = sum / segments.size();
            }

            // Extract word timestamps
            java.util.List<WordTimestamp> words = new java.util.ArrayList<>();
            JsonNode wordsNode = root.path("words");
            if (wordsNode.isArray()) {
                for (JsonNode w : wordsNode) {
                    words.add(new WordTimestamp(
                            w.path("word").asText("").strip(),
                            w.path("start").asDouble(0),
                            w.path("end").asDouble(0)));
                }
            }

            return new VerboseTranscript(text.strip(), avgLogprob, words);
        } catch (AiServiceException e) {
            throw e;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException("Whisper verbose request interrupted.", ie);
        } catch (Exception e) {
            throw new AiServiceException("Whisper verbose error: " + e.getMessage(), e);
        } finally {
            if (acquired) concurrencyLimiter.releaseWhisper();
        }
    }

    /**
     * Transcribes audio bytes using Groq Whisper.
     *
     * @param audioBytes    raw audio bytes (webm, mp4, wav, etc.)
     * @param filename      original filename (used to hint codec to Groq, e.g. "voice.webm")
     * @param language      BCP-47 language code to hint the model (e.g. "de")
     * @param prompt        Optional context prompt to guide transcription (e.g., the target text)
     * @return the transcribed text
     */
    public String transcribe(byte[] audioBytes, String filename, String language, String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException("Groq API key is not configured.");
        }

        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, audioBytes, filename, language, prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(WHISPER_URL))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireWhisper();
            if (!acquired) {
                log.warn("[Whisper] Semaphore timeout — too many concurrent STT requests");
                throw new AiServiceException("Speech recognition is busy. Please try again shortly.");
            }
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                log.error("[Whisper] HTTP {}: {}", response.statusCode(), response.body());
                throw new AiServiceException("Whisper transcription failed: HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText(null);
            if (text == null || text.isBlank()) {
                throw new AiServiceException("Whisper returned empty transcript.");
            }
            log.info("[Whisper] target='{}' -> transcribed='{}' ({} bytes)",
                    prompt != null ? prompt : "", text, audioBytes.length);
            return text;
        } catch (AiServiceException e) {
            throw e;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException("Whisper request interrupted.", ie);
        } catch (Exception e) {
            throw new AiServiceException("Whisper transcription error: " + e.getMessage(), e);
        } finally {
            if (acquired) {
                concurrencyLimiter.releaseWhisper();
            }
        }
    }

    // -----------------------------------------------------------------------
    // Build multipart/form-data body manually (no external dependency)
    // -----------------------------------------------------------------------

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes,
                                      String filename, String language, String prompt) {
        return buildMultipartBody(boundary, audioBytes, filename, language, prompt, false);
    }

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes,
                                      String filename, String language, String prompt, boolean verbose) {
        try {
            String safeFilename = (filename != null && !filename.isBlank()) ? filename : "audio.webm";
            StringBuilder sb = new StringBuilder();

            // --- model field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"model\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(whisperModel).append("\r\n");

            // --- language field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"language\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(language != null ? language : "de").append("\r\n");

            // --- response_format ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"response_format\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(verbose ? "verbose_json" : "json").append("\r\n");

            // --- timestamp_granularities for word-level data (verbose only) ---
            if (verbose) {
                sb.append("--").append(boundary).append("\r\n");
                sb.append("Content-Disposition: form-data; name=\"timestamp_granularities[]\"\r\n");
                sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
                sb.append("word\r\n");
            }

            // --- temperature (0.0 forces deterministic transcription) ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"temperature\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append("0.0\r\n");

            // --- prompt: must declare charset so the server interprets ü/ä/ö/ß bytes as UTF-8 ---
            if (prompt != null && !prompt.isBlank()) {
                sb.append("--").append(boundary).append("\r\n");
                sb.append("Content-Disposition: form-data; name=\"prompt\"\r\n");
                sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
                sb.append(prompt).append("\r\n");
            }

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
