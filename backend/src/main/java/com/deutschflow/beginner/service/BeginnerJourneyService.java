package com.deutschflow.beginner.service;

import com.deutschflow.beginner.dto.BeginnerItemDto;
import com.deutschflow.beginner.dto.BeginnerSessionResponse;
import com.deutschflow.beginner.entity.BeginnerJourneyItem;
import com.deutschflow.beginner.repository.BeginnerJourneyItemRepository;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.repository.WordRepository;
import com.deutschflow.vocabulary.service.SpacedRepetitionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BeginnerJourneyService {

    private static final String WELCOME_MESSAGE =
            "Chào mừng bạn đến với DeutschFlow! Hôm nay bạn sẽ học những từ tiếng Đức đầu tiên. Hãy bắt đầu với những câu chào hỏi đơn giản nhất.";

    private static final String FIRST_SPEAKING_PROMPT =
            "Bây giờ hãy thử nói chuyện với AI của chúng tôi bằng tiếng Đức! Chỉ cần nói 'Hallo' và AI sẽ hướng dẫn bạn.";

    private static final String ENCOURAGEMENT =
            "Tuyệt vời! Bạn đã học được những từ đầu tiên. Những từ này sẽ được ôn tập tự động theo lịch để bạn không bao giờ quên.";

    private final BeginnerJourneyItemRepository itemRepository;
    private final SpacedRepetitionService srsService;
    private final PhaseEngineService phaseEngineService;
    private final WordRepository wordRepository;

    @Transactional(readOnly = true)
    public BeginnerSessionResponse getFirstSession() {
        List<BeginnerJourneyItem> items = itemRepository
                .findByWeekNumberOrderBySequenceOrderAsc(1);

        List<BeginnerItemDto> dtos = items.stream()
                .map(item -> new BeginnerItemDto(
                        item.getSequenceOrder(),
                        item.getItemType(),
                        item.getTitleDe(),
                        item.getTitleVi(),
                        item.getExampleDe(),
                        item.getExampleVi(),
                        item.getAudioHint()
                ))
                .toList();

        return new BeginnerSessionResponse(
                WELCOME_MESSAGE,
                dtos,
                FIRST_SPEAKING_PROMPT,
                ENCOURAGEMENT
        );
    }

    @Transactional
    public void recordFirstSessionCompletion(User user) {
        var state = phaseEngineService.getOrCreatePhaseState(user);
        phaseEngineService.updateProgress(
                user,
                state.getVocabularyMasteredCount(),
                state.getSpeakingMinutesTotal(),
                state.getGrammarAccuracyPercent(),
                state.getSessionsCompleted() + 1
        );
        scheduleFirstSrsItems(user);
        log.info("User {} completed first beginner session", user.getId());
    }

    private void scheduleFirstSrsItems(User user) {
        itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1).stream()
                .filter(item -> "VOCABULARY".equals(item.getItemType()))
                .forEach(item -> wordRepository.findByWord(item.getTitleDe()).ifPresentOrElse(
                        word -> srsService.scheduleWord(user, word.getId()),
                        () -> log.warn("Beginner vocab '{}' not found in word table — skipping SRS", item.getTitleDe())
                ));
    }
}
