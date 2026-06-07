package com.deutschflow.beginner.service;

import com.deutschflow.beginner.dto.BeginnerItemDto;
import com.deutschflow.beginner.dto.BeginnerSessionResponse;
import com.deutschflow.beginner.entity.BeginnerJourneyItem;
import com.deutschflow.beginner.repository.BeginnerJourneyItemRepository;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.service.SrsVocabScheduler;
import com.deutschflow.user.entity.User;
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
    private final SrsVocabScheduler srsVocabScheduler;
    private final PhaseEngineService phaseEngineService;

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
        // Derive progress from real signals (vocab mastered, sessions, speaking, grammar) and
        // advance the phase if ready — instead of re-passing the stored (zero) counters.
        phaseEngineService.recompute(user);
        scheduleFirstSrsItems(user);
        log.info("User {} completed first beginner session", user.getId());
    }

    private void scheduleFirstSrsItems(User user) {
        var requests = itemRepository.findByWeekNumberOrderBySequenceOrderAsc(1).stream()
                .filter(item -> "VOCABULARY".equals(item.getItemType()))
                .filter(item -> item.getTitleDe() != null && !item.getTitleDe().isBlank())
                .map(item -> new ScheduleVocabRequest(
                        null,
                        SrsVocabScheduler.vocabId(null, null, item.getTitleDe()),
                        item.getTitleDe(),
                        item.getTitleVi(),
                        item.getExampleDe(),
                        null))
                .toList();
        srsVocabScheduler.schedule(user.getId(), requests);
    }
}
