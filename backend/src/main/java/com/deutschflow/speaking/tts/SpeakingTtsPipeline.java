package com.deutschflow.speaking.tts;

import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-turn streaming-TTS pipeline: LLM tokens → completed German sentences → XTTS → ordered audio.
 *
 * <p>One instance per speaking turn. {@link #onToken(String)} feeds raw deltas (called sequentially
 * from the single LLM-stream thread); each completed sentence is synthesized on {@code executor}
 * and delivered to the {@link AudioSink} <strong>in order</strong> — ordering is guaranteed by
 * chaining each synthesis onto the previous one, so a fast sentence never overtakes a slow earlier
 * one. {@link #finish()} flushes the trailing sentence; {@link #drain()} completes once all audio
 * has been delivered.
 *
 * <p>Synthesis runs off the token thread so text keeps streaming at full speed; a {@code null}/empty
 * PCM result (XTTS disabled or failed for one sentence) is skipped without disturbing the others.
 */
@Slf4j
public final class SpeakingTtsPipeline {

    /** Receives one synthesized sentence. {@code index} is the sentence ordinal (0-based, gapless intent). */
    @FunctionalInterface
    public interface AudioSink {
        void onAudio(int index, String text, byte[] pcm);
    }

    private final XttsStreamClient client;
    private final XttsVoice voice;
    private final Executor executor;
    private final AudioSink sink;

    private final GermanSentenceSplitter splitter = new GermanSentenceSplitter();
    private final AtomicInteger nextIndex = new AtomicInteger(0);
    private String previousSentence = null;
    private CompletableFuture<Void> chain = CompletableFuture.completedFuture(null);

    public SpeakingTtsPipeline(XttsStreamClient client, XttsVoice voice, Executor executor, AudioSink sink) {
        this.client = client;
        this.voice = voice;
        this.executor = executor;
        this.sink = sink;
    }

    /** Feed a raw LLM token; queues any sentence that just completed for synthesis. */
    public void onToken(String token) {
        for (String sentence : splitter.append(token)) {
            submit(sentence);
        }
    }

    /** Flush the trailing fragment as the final sentence. Call once when the LLM stream ends. */
    public void finish() {
        splitter.flush().ifPresent(this::submit);
    }

    /** Completes once every queued sentence has been synthesized and delivered (in order). */
    public CompletableFuture<Void> drain() {
        return chain;
    }

    private void submit(String sentence) {
        final int index = nextIndex.getAndIncrement();
        final String prev = previousSentence;
        previousSentence = sentence;
        // Chain onto the previous synthesis → strict ordering regardless of executor parallelism.
        chain = chain.thenRunAsync(() -> synthesizeOne(index, sentence, prev), executor);
    }

    private void synthesizeOne(int index, String sentence, String prev) {
        try {
            byte[] pcm = client.synthesize(voice, sentence, prev);
            if (pcm != null && pcm.length > 0) {
                sink.onAudio(index, sentence, pcm);
            }
        } catch (Exception e) {
            // One sentence failing must not break the rest of the turn's audio.
            log.warn("[XTTS] pipeline sentence #{} failed: {}", index, e.getMessage());
        }
    }
}
