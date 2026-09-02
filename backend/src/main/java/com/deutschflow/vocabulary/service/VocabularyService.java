package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.GrammarContextDto;
import com.deutschflow.vocabulary.dto.WordDto;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.WordRepository;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.service.SrsService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class VocabularyService {

    private final WordRepository wordRepository;
    private final SrsService srsService;

    public VocabularyService(WordRepository wordRepository, SrsService srsService) {
        this.wordRepository = wordRepository;
        this.srsService = srsService;
    }

    /**
     * Đánh dấu một mục từ là "đang học" — xếp nó vào hàng ôn FSRS của người học. Idempotent.
     *
     * <p><b>Không best-effort.</b> Đây là hành động tiến độ do người học chủ động bấm, nên lưu hỏng phải
     * nổi lên tới người gọi. Trước 02/09/2026 hàm này đi qua {@link SrsVocabScheduler#schedule} — một hàm
     * nuốt mọi exception — nên endpoint trả 202 kể cả khi không ghi được dòng nào.
     *
     * <p>Và nó hỏng thật: bảng {@code words} có hai cột song song cho cùng một mục từ — {@code base_form}
     * (cả hệ thống từ vựng dùng) và {@code word}/{@code translation} (entity JPA này dùng). Trình import
     * chỉ ghi {@code base_form}, nên ~41% số dòng có {@code word}/{@code translation} NULL. Lịch ôn lại
     * yêu cầu {@code german} và {@code meaning} NOT NULL ⇒ chèn thất bại ⇒ bị nuốt ⇒ mất tiến độ trong im
     * lặng. Vì vậy ở đây đọc lemma theo thứ tự {@code base_form} → {@code word}, và nghĩa theo
     * {@code word_translations} (vi → en → de) → cột {@code translation} cũ.
     */
    @Transactional
    public void markWordLearned(Long userId, Long wordId) {
        Word word = wordRepository.findById(wordId)
                .orElseThrow(() -> new IllegalArgumentException("Word not found: id=" + wordId));

        String german = firstNonBlank(wordRepository.findBaseFormById(wordId), word.getWord());
        if (german == null) {
            throw new IllegalStateException("Word " + wordId + " has no lemma in either base_form or word");
        }
        // meaning là NOT NULL. Không có bản dịch thì để chuỗi rỗng — thà thẻ thiếu nghĩa còn hơn nhân bản
        // lemma thành "nghĩa" giả (sanitizeMeaning ở đường đọc vốn coi nghĩa == lemma là KHÔNG có nghĩa).
        String meaning = firstNonBlank(wordRepository.findMeaningById(wordId), word.getTranslation());

        srsService.scheduleVocabBatch(userId, List.of(new ScheduleVocabRequest(
                null,
                "word_" + word.getId(),
                german,
                meaning == null ? "" : meaning,
                word.getExampleSentence(),
                null)));
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    /**
     * Cached by CEFR level (5-min TTL — see {@code CacheConfig "words"}). The no-level branch does a
     * full {@code findAll()} over ~5k rows; without this cache that ran on every unauthenticated
     * {@code GET /api/words} hit. Admin word edits propagate within the TTL.
     */
    @Cacheable(value = "words", key = "(#cefrLevel == null || #cefrLevel.isEmpty()) ? 'ALL' : #cefrLevel", sync = true)
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
