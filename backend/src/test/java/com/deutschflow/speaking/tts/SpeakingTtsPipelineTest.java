package com.deutschflow.speaking.tts;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link SpeakingTtsPipeline}: token→sentence→audio ordering, previous_text wiring,
 * skip-on-null, and trailing flush. Uses a same-thread executor so assertions are deterministic.
 */
class SpeakingTtsPipelineTest {

    private static final Executor DIRECT = Runnable::run;
    private static final XttsVoice VOICE = new XttsVoice("de-lukas_man", 1.0, 0.68, 5.0, "de");

    private record Captured(int index, String text, byte[] pcm) {}

    private final XttsStreamClient client = mock(XttsStreamClient.class);
    private final List<Captured> received = new ArrayList<>();

    private SpeakingTtsPipeline newPipeline() {
        return new SpeakingTtsPipeline(client, VOICE, DIRECT,
                (i, t, pcm) -> received.add(new Captured(i, t, pcm)));
    }

    @Test
    @DisplayName("delivers sentences in order with gapless indices and the matching PCM")
    void deliversSentencesInOrder() {
        when(client.synthesize(eq(VOICE), anyString(), any()))
                .thenAnswer(inv -> ("PCM:" + inv.getArgument(1)).getBytes());

        SpeakingTtsPipeline p = newPipeline();
        p.onToken("Hallo. Wie geht's? ");
        p.finish();
        p.drain().join();

        assertThat(received).extracting(Captured::index).containsExactly(0, 1);
        assertThat(received).extracting(Captured::text).containsExactly("Hallo.", "Wie geht's?");
        assertThat(new String(received.get(0).pcm())).isEqualTo("PCM:Hallo.");
    }

    @Test
    @DisplayName("passes the prior sentence as previous_text for prosody continuity")
    void passesPreviousText() {
        when(client.synthesize(eq(VOICE), anyString(), any())).thenReturn(new byte[]{1});

        SpeakingTtsPipeline p = newPipeline();
        p.onToken("Eins. Zwei. ");
        p.finish();
        p.drain().join();

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> prev = ArgumentCaptor.forClass(String.class);
        verify(client, times(2)).synthesize(eq(VOICE), text.capture(), prev.capture());
        assertThat(text.getAllValues()).containsExactly("Eins.", "Zwei.");
        assertThat(prev.getAllValues()).containsExactly(null, "Eins.");
    }

    @Test
    @DisplayName("skips a sentence whose synthesis returns null but keeps the others (and their order)")
    void skipsNullSynthesisButKeepsOrder() {
        when(client.synthesize(eq(VOICE), eq("Eins."), any())).thenReturn(new byte[]{1});
        when(client.synthesize(eq(VOICE), eq("Zwei."), any())).thenReturn(null);   // XTTS failed for this one
        when(client.synthesize(eq(VOICE), eq("Drei."), any())).thenReturn(new byte[]{3});

        SpeakingTtsPipeline p = newPipeline();
        p.onToken("Eins. Zwei. Drei. ");
        p.finish();
        p.drain().join();

        assertThat(received).extracting(Captured::index).containsExactly(0, 2);
        assertThat(received).extracting(Captured::text).containsExactly("Eins.", "Drei.");
    }

    @Test
    @DisplayName("flush() emits the trailing sentence that never received a terminator")
    void flushEmitsTrailingSentence() {
        when(client.synthesize(eq(VOICE), anyString(), any())).thenReturn(new byte[]{7});

        SpeakingTtsPipeline p = newPipeline();
        p.onToken("Ein Satz ohne Punkt am Ende");
        assertThat(received).isEmpty();          // nothing terminated yet
        p.finish();
        p.drain().join();

        assertThat(received).extracting(Captured::text).containsExactly("Ein Satz ohne Punkt am Ende");
    }

    @Test
    @DisplayName("does nothing (no synthesis, empty audio) for an empty turn")
    void emptyTurnProducesNothing() {
        SpeakingTtsPipeline p = newPipeline();
        p.finish();
        p.drain().join();

        assertThat(received).isEmpty();
        verifyNoInteractions(client);
    }
}
