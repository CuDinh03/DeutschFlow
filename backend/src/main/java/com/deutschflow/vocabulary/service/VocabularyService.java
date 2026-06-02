package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.GrammarContextDto;
import com.deutschflow.vocabulary.dto.WordDto;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.WordRepository;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.service.SrsVocabScheduler;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class VocabularyService {

    private final WordRepository wordRepository;
    private final SrsVocabScheduler srsVocabScheduler;

    public VocabularyService(WordRepository wordRepository, SrsVocabScheduler srsVocabScheduler) {
        this.wordRepository = wordRepository;
        this.srsVocabScheduler = srsVocabScheduler;
    }

    /**
     * Marks a dictionary word as "being learned" by scheduling it into the user's
     * FSRS spaced-repetition queue (best-effort, idempotent).
     */
    public void markWordLearned(Long userId, Long wordId) {
        Word word = wordRepository.findById(wordId)
                .orElseThrow(() -> new IllegalArgumentException("Word not found: id=" + wordId));
        srsVocabScheduler.schedule(userId, List.of(new ScheduleVocabRequest(
                null,
                "word_" + word.getId(),
                word.getWord(),
                word.getTranslation(),
                word.getExampleSentence(),
                null)));
    }

    public List<WordDto> getWordsByCefr(String cefrLevel) {
        List<Word> words;
        if (cefrLevel != null && !cefrLevel.isEmpty()) {
            words = wordRepository.findByCefrLevel(cefrLevel);
        } else {
            words = wordRepository.findAll();
        }
        return words.stream().map(this::toWordDto).collect(Collectors.toList());
    }

    public WordDto getWordById(Long wordId) {
        return wordRepository.findById(wordId)
                .map(this::toWordDto)
                .orElseThrow(() -> new IllegalArgumentException("Word not found: id=" + wordId));
    }

    public GrammarContextDto getGrammarContext(Long wordId) {
        Word word = wordRepository.findById(wordId)
                .orElseThrow(() -> new IllegalArgumentException("Word not found: id=" + wordId));

        return new GrammarContextDto(
                word.getWord(),
                word.getWordType(),
                new GrammarContextDto.GrammarInfo(
                        word.getGender(),
                        "German " + word.getGender(),
                        null,
                        "Regular"
                ),
                List.of(
                        new GrammarContextDto.Example(
                                "Ich lerne " + word.getWord(),
                                "I am learning " + word.getTranslation()
                        )
                ),
                List.of()
        );
    }

    private WordDto toWordDto(Word word) {
        return new WordDto(
                word.getId(),
                word.getWord(),
                word.getTranslation(),
                word.getWordType(),
                word.getGender(),
                word.getCefrLevel(),
                word.getPronunciationIpa(),
                word.getExampleSentence(),
                word.getFrequencyRank(),
                word.getImageUrl(),
                word.getAudioUrl()
        );
    }
}
