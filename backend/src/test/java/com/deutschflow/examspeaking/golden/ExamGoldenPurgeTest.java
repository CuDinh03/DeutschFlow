package com.deutschflow.examspeaking.golden;

import com.deutschflow.examspeaking.audio.ExamAudioStorage;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.entity.SpeakingExamTurn;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamTurnRepository;
import com.deutschflow.examspeaking.scoring.RubricScorer;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** F-12: purge S3 thất bại một phần → GIỮ audio_ref của key lỗi + giữ cờ retain để xoá lại; không để object mồ côi. */
class ExamGoldenPurgeTest {

    private final SpeakingExamTurnRepository turnRepository = mock(SpeakingExamTurnRepository.class);
    private final SpeakingExamSessionRepository sessionRepository = mock(SpeakingExamSessionRepository.class);
    private final ExamAudioStorage audioStorage = mock(ExamAudioStorage.class);
    private final ExamGoldenService service = new ExamGoldenService(
            mock(com.deutschflow.examspeaking.repository.SpeakingExamResultRepository.class), turnRepository, sessionRepository,
            mock(com.deutschflow.examspeaking.repository.SpeakingExamGoldenRatingRepository.class),
            mock(com.deutschflow.examspeaking.api.ExamBlueprintCatalog.class),
            new RubricScorer(), null, null, mock(UserRepository.class), new ObjectMapper(), audioStorage,
            mock(com.deutschflow.examspeaking.repository.SpeakingExamCalibrationParticipantRepository.class));

    private static SpeakingExamTurn turn(String ref) {
        return SpeakingExamTurn.builder().sessionId(1L).partNo(1).seq(0).role("CANDIDATE").transcript("x").audioRef(ref).build();
    }

    @Test
    @DisplayName("một key xoá lỗi → key đó giữ nguyên, key xoá được về null, retain_audio KHÔNG tắt, failed=1")
    void partialFailureKeepsRefs() {
        SpeakingExamTurn ok = turn("exam-speaking/golden/1/000-a.webm");
        SpeakingExamTurn bad = turn("exam-speaking/golden/1/001-b.webm");
        SpeakingExamTurn none = turn(null);
        when(turnRepository.findBySessionIdOrderBySeqAsc(1L)).thenReturn(List.of(ok, bad, none));
        when(audioStorage.purge(any())).thenReturn(new ExamAudioStorage.PurgeOutcome(
                List.of(ok.getAudioRef()), List.of(bad.getAudioRef())));
        SpeakingExamSession s = SpeakingExamSession.builder().retainAudio(true).build();
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(s));

        GoldenView.PurgeResult r = service.purgeAudio(1L);

        assertThat(r.deleted()).isEqualTo(1);
        assertThat(r.failed()).isEqualTo(1);
        assertThat(ok.getAudioRef()).isNull();
        assertThat(bad.getAudioRef()).isEqualTo("exam-speaking/golden/1/001-b.webm");
        assertThat(s.isRetainAudio()).isTrue();
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("mọi key xoá được → tất cả audio_ref null và retain_audio tắt")
    void fullSuccessClearsEverything() {
        SpeakingExamTurn a = turn("k1");
        SpeakingExamTurn b = turn("k2");
        when(turnRepository.findBySessionIdOrderBySeqAsc(1L)).thenReturn(List.of(a, b));
        when(audioStorage.purge(any())).thenReturn(new ExamAudioStorage.PurgeOutcome(List.of("k1", "k2"), List.of()));
        SpeakingExamSession s = SpeakingExamSession.builder().retainAudio(true).build();
        when(sessionRepository.findById(1L)).thenReturn(Optional.of(s));

        GoldenView.PurgeResult r = service.purgeAudio(1L);

        assertThat(r.deleted()).isEqualTo(2);
        assertThat(r.failed()).isZero();
        assertThat(a.getAudioRef()).isNull();
        assertThat(b.getAudioRef()).isNull();
        assertThat(s.isRetainAudio()).isFalse();
        verify(sessionRepository).save(s);
    }
}
