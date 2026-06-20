package com.deutschflow.video.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.service.SrsService;
import com.deutschflow.video.dto.VideoSceneDto;
import com.deutschflow.video.dto.VideoTimelineDto;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.WordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VideoLessonServiceTest {

    @Mock
    private WordRepository wordRepository;
    @Mock
    private EdgeTtsService edgeTtsService;
    @Mock
    private S3StorageService s3StorageService;
    @Mock
    private SrsService srsService;
    @Mock
    private com.deutschflow.grammar.repository.GrammarCaseRepository grammarCaseRepository;
    @Mock
    private com.deutschflow.grammar.repository.GrammarCaseExampleRepository grammarCaseExampleRepository;
    @Mock
    private com.deutschflow.speaking.ai.OpenAiChatClient llmClient;
    @Mock
    private AiUsageLedgerService ledgerService;

    private VideoLessonService service;

    @BeforeEach
    void setUp() {
        service = new VideoLessonService(wordRepository, edgeTtsService, s3StorageService, srsService,
                grammarCaseRepository, grammarCaseExampleRepository, llmClient,
                new com.fasterxml.jackson.databind.ObjectMapper(), ledgerService);
    }

    @Test
    @DisplayName("parseDialogueJson extracts the array from a noisy LLM reply")
    void parseDialogueJson_tolerant() {
        String raw = "Sure:\n```json\n[{\"speaker\":\"A\",\"de\":\"Hallo\",\"vi\":\"Xin chào\"},"
                + "{\"speaker\":\"B\",\"de\":\"Tschüss\",\"vi\":\"Tạm biệt\"}]\n```";
        var lines = service.parseDialogueJson(raw);
        assertThat(lines).hasSize(2);
        assertThat(lines.get(0)).containsEntry("de", "Hallo").containsEntry("vi", "Xin chào");
    }

    @Test
    @DisplayName("parseDialogueJson returns empty when there is no array")
    void parseDialogueJson_noArray() {
        assertThat(service.parseDialogueJson("sorry, no JSON here")).isEmpty();
    }

    @Test
    @DisplayName("due timeline maps SRS cards to image-bearing words, skipping the rest")
    void buildDueTimeline_mapsCardsToWords() {
        when(edgeTtsService.isConfigured()).thenReturn(false);
        when(srsService.getDueCards(7L)).thenReturn(List.of(
                new VocabReviewCard(1L, "word_1", "Haus", "house", "Das Haus.", "Das Haus.", 0, OffsetDateTime.now()),
                new VocabReviewCard(2L, "word_2", "Auto", "car", "Das Auto.", "Das Auto.", 0, OffsetDateTime.now())));
        when(wordRepository.findByWord("Haus")).thenReturn(Optional.of(word(1, "Haus", "http://i/h", 1)));
        when(wordRepository.findByWord("Auto")).thenReturn(Optional.empty()); // no Word → skipped

        VideoTimelineDto timeline = service.buildDueTimeline(7L, 8);

        assertThat(timeline.type()).isEqualTo("VOCAB_DUE");
        assertThat(timeline.totalScenes()).isEqualTo(1);
        assertThat(timeline.scenes().get(0).germanWord()).isEqualTo("Haus");
    }

    private Word word(long id, String w, String imageUrl, Integer rank) {
        return Word.builder()
                .id(id)
                .word(w)
                .translation(w + "-vi")
                .exampleSentence("Das ist " + w + ".")
                .imageUrl(imageUrl)
                .frequencyRank(rank)
                .build();
    }

    @Test
    @DisplayName("skips words without an image and orders by frequency rank")
    void buildVocabTimeline_filtersAndOrders() {
        when(edgeTtsService.isConfigured()).thenReturn(false);
        when(wordRepository.findByCefrLevel("A1")).thenReturn(List.of(
                word(1, "Haus", "http://img/haus.jpg", 5),
                word(2, "Auto", null, 1),            // no image → skipped
                word(3, "Buch", "http://img/buch.jpg", 2)));

        VideoTimelineDto timeline = service.buildVocabTimeline("A1", 8);

        assertThat(timeline.totalScenes()).isEqualTo(2);
        assertThat(timeline.scenes()).extracting(VideoSceneDto::germanWord).containsExactly("Buch", "Haus");
        assertThat(timeline.scenes().get(0).seq()).isEqualTo(1);
        assertThat(timeline.scenes().get(0).narrationAudioUrl()).isNull(); // TTS unconfigured
    }

    @Test
    @DisplayName("respects the scene limit")
    void buildVocabTimeline_capsLimit() {
        when(edgeTtsService.isConfigured()).thenReturn(false);
        when(wordRepository.findByCefrLevel("A1")).thenReturn(List.of(
                word(1, "a", "http://i/a", 1),
                word(2, "b", "http://i/b", 2),
                word(3, "c", "http://i/c", 3)));

        assertThat(service.buildVocabTimeline("A1", 2).totalScenes()).isEqualTo(2);
    }

    @Test
    @DisplayName("reuses cached narration without re-synthesizing or re-uploading")
    void narration_reusesCachedS3() {
        when(edgeTtsService.isConfigured()).thenReturn(true);
        when(s3StorageService.objectExists(anyString())).thenReturn(true);
        when(s3StorageService.publicUrl(anyString())).thenReturn("http://s3/narr.mp3");
        when(wordRepository.findByCefrLevel("A1")).thenReturn(List.of(word(1, "Haus", "http://i/h", 1)));

        VideoTimelineDto timeline = service.buildVocabTimeline("A1", 8);

        assertThat(timeline.scenes().get(0).narrationAudioUrl()).isEqualTo("http://s3/narr.mp3");
        verify(edgeTtsService, never()).synthesize(anyString(), anyString());
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
    }
}
