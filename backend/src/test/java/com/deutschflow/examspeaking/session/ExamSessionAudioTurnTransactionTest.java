package com.deutschflow.examspeaking.session;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.minor.MinorGate;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.audio.ExamAudioStorage;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamTurnRepository;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.ai.GroqWhisperClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Lượt nói audio của thi nói KHÔNG được giữ transaction (= một kết nối DB) trong lúc gọi nhận diện
 * giọng nói. Unit thuần: repository/STT là mock, còn transaction manager là một bản THẬT của Spring
 * ({@link AbstractPlatformTransactionManager}) không gắn DB — nên
 * {@link TransactionSynchronizationManager#isActualTransactionActive()} phản ánh đúng ranh giới
 * transaction mà {@code TransactionTemplate} mở/đóng, và đếm được commit/rollback.
 *
 * <p>Giới hạn: không có DB nên không kiểm được việc kết nối thật sự được trả về pool, khoá lạc quan
 * theo cột {@code version}, hay toàn bộ đường xử lý lượt (kịch bản, lời đáp AI) — các ca đó thuộc
 * integration test trên CI.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExamSessionAudioTurnTransactionTest {

    /** Transaction manager thật của Spring, không tài nguyên — chỉ để có ranh giới và bộ đếm. */
    private static final class CountingTxManager extends AbstractPlatformTransactionManager {
        int begun;
        int committed;
        int rolledBack;

        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
            begun++;
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
            committed++;
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
            rolledBack++;
        }
    }

    private static final long USER = 7L;
    private static final long SESSION = 42L;
    private static final byte[] AUDIO = {1, 2, 3};

    @Mock SpeakingExamSessionRepository sessionRepository;
    @Mock SpeakingExamTurnRepository turnRepository;
    @Mock ExamBlueprintCatalog catalog;
    @Mock QuotaService quotaService;
    @Mock OrgPoolGuard orgPoolGuard;
    @Mock AiRateLimiterService rateLimiter;
    @Mock AiUsageLedgerService ledger;
    @Mock GroqWhisperClient whisperClient;
    @Mock MinorGate minorGate;
    @Mock ExamAudioStorage audioStorage;

    private CountingTxManager txManager;
    private ExamSessionService service;
    /** Trạng thái transaction quan sát được tại từng điểm, theo thứ tự xảy ra. */
    private final List<String> trace = new ArrayList<>();

    @BeforeEach
    void setUp() {
        txManager = new CountingTxManager();
        // Chỉ các cộng tác viên mà đường audio chạm tới trước khi vào kịch bản; phần còn lại để null.
        service = new ExamSessionService(catalog, null, null, null, null, sessionRepository, turnRepository,
                null, null, quotaService, orgPoolGuard, null, rateLimiter, ledger, whisperClient, minorGate,
                audioStorage, null, null, null, null, null, txManager);
        when(rateLimiter.allow(any(), anyLong())).thenReturn(true);
        when(whisperClient.getWhisperModel()).thenReturn("whisper-test");
        doAnswer(inv -> {
            trace.add("ledger tx=" + TransactionSynchronizationManager.isActualTransactionActive());
            return null;
        }).when(ledger).recordStt(anyLong(), anyString(), anyString(), anyDouble());
    }

    private static SpeakingExamSession session(String state, int part, int step) {
        SpeakingExamSession s = mock(SpeakingExamSession.class);
        when(s.getId()).thenReturn(SESSION);
        when(s.getState()).thenReturn(state);
        when(s.getCurrentPart()).thenReturn(part);
        when(s.getCurrentStep()).thenReturn(step);
        when(s.isMock()).thenReturn(false);
        when(s.isRetainAudio()).thenReturn(false);
        when(s.getBlueprintId()).thenReturn(99L);
        return s;
    }

    /** Lần nạp đầu (bước 1) trả {@code first}; các lần sau (bước 3) trả {@code afterStt}. */
    private void stubLoads(SpeakingExamSession first, SpeakingExamSession afterStt) {
        when(sessionRepository.findByIdAndUserId(SESSION, USER)).thenAnswer(inv -> {
            boolean firstLoad = trace.stream().noneMatch(t -> t.startsWith("load"));
            trace.add("load tx=" + TransactionSynchronizationManager.isActualTransactionActive());
            return Optional.of(firstLoad ? first : afterStt);
        });
    }

    private void stubStt(String text) {
        when(whisperClient.transcribeVerbose(any(), anyString(), anyString(), anyString())).thenAnswer(inv -> {
            trace.add("stt tx=" + TransactionSynchronizationManager.isActualTransactionActive()
                    + " committedBefore=" + txManager.committed);
            return new GroqWhisperClient.VerboseTranscript(text, -0.2, List.of(), 4.5);
        });
    }

    @Test
    @DisplayName("STT được gọi khi KHÔNG có transaction đang mở; transaction kiểm tra đã commit trước đó")
    void sttRunsOutsideTransaction() {
        SpeakingExamSession s = session(SpeakingExamSession.STATE_IN_PART, 1, 0);
        stubLoads(s, s);
        stubStt("Guten Tag");
        // Dừng đường xử lý lượt ngay sau khi nó vào transaction thứ hai: không có blueprint.
        when(catalog.findById(99L)).thenAnswer(inv -> {
            trace.add("process tx=" + TransactionSynchronizationManager.isActualTransactionActive());
            return Optional.empty();
        });

        assertThatThrownBy(() -> service.submitAudioTurn(USER, SESSION, AUDIO, "turn.webm"))
                .isInstanceOf(NotFoundException.class);

        assertThat(trace).containsExactly(
                "load tx=true",                       // (1) kiểm phiên trong transaction ngắn
                "stt tx=false committedBefore=1",     // (2) STT ngoài transaction, sau khi (1) commit
                "ledger tx=true",                     // (3) sổ STT trong transaction thứ hai
                "load tx=true",                       //     nạp lại phiên
                "process tx=true");                   //     xử lý lượt trong cùng transaction
        assertThat(txManager.begun).isEqualTo(2);
        assertThat(txManager.committed).isEqualTo(1);
        assertThat(txManager.rolledBack).isEqualTo(1); // lượt lỗi → sổ STT cùng bị huỷ, như trước
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();

        InOrder order = inOrder(minorGate, quotaService, whisperClient, ledger);
        order.verify(minorGate).assertAudioAllowed(USER);
        order.verify(quotaService).assertAllowed(eq(USER), any(), eq(ExamSessionService.STT_ESTIMATED_TOKENS));
        order.verify(whisperClient).transcribeVerbose(any(), eq("turn.webm"), eq("de"), eq(""));
        order.verify(ledger).recordStt(USER, "EXAM_SPEAKING_STT", "whisper-test", 4.5);
    }

    @Test
    @DisplayName("phiên bị kết thúc trong lúc chờ STT → 409, không ghi lượt, không ghi đè phiên")
    void sessionFinishedDuringStt() {
        SpeakingExamSession before = session(SpeakingExamSession.STATE_IN_PART, 1, 0);
        SpeakingExamSession after = session(SpeakingExamSession.STATE_GRADING, 1, 0);
        stubLoads(before, after);
        stubStt("Guten Tag");

        assertThatThrownBy(() -> service.submitAudioTurn(USER, SESSION, AUDIO, "turn.webm"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("state=" + SpeakingExamSession.STATE_GRADING);

        verify(turnRepository, never()).save(any());
        verify(sessionRepository, never()).save(any());
        verifyNoInteractions(catalog, audioStorage);
        assertThat(txManager.committed).isEqualTo(1);
        assertThat(txManager.rolledBack).isEqualTo(1);
    }

    @Test
    @DisplayName("phiên đã sang Teil/bước khác trong lúc chờ STT → 409, bản ghi âm không bị gán vào bước mới")
    void sessionAdvancedDuringStt() {
        SpeakingExamSession before = session(SpeakingExamSession.STATE_IN_PART, 1, 2);
        SpeakingExamSession after = session(SpeakingExamSession.STATE_IN_PART, 2, 0);
        stubLoads(before, after);
        stubStt("Guten Tag");

        assertThatThrownBy(() -> service.submitAudioTurn(USER, SESSION, AUDIO, "turn.webm"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Teil 1 bước 2")
                .hasMessageContaining("Teil 2 bước 0");

        verify(turnRepository, never()).save(any());
        verify(sessionRepository, never()).save(any());
        verifyNoInteractions(catalog, audioStorage);
        assertThat(txManager.rolledBack).isEqualTo(1);
    }

    @Test
    @DisplayName("phiên đã đóng từ đầu → 409 TRƯỚC khi gọi STT (F-22), chỉ một transaction")
    void closedSessionRejectedBeforeStt() {
        SpeakingExamSession closed = session(SpeakingExamSession.STATE_RESULTS, 1, 0);
        stubLoads(closed, closed);

        assertThatThrownBy(() -> service.submitAudioTurn(USER, SESSION, AUDIO, "turn.webm"))
                .isInstanceOf(ConflictException.class);

        verifyNoInteractions(whisperClient, ledger, minorGate);
        assertThat(txManager.begun).isEqualTo(1);
        assertThat(txManager.rolledBack).isEqualTo(1);
    }

    @Test
    @DisplayName("audio không có lời → 400, transaction thứ hai rollback (sổ STT không được ghi) như trước")
    void blankTranscriptRollsBackLedger() {
        SpeakingExamSession s = session(SpeakingExamSession.STATE_IN_PART, 1, 0);
        stubLoads(s, s);
        stubStt("   ");

        assertThatThrownBy(() -> service.submitAudioTurn(USER, SESSION, AUDIO, null))
                .isInstanceOf(BadRequestException.class);

        verify(whisperClient).transcribeVerbose(any(), eq("audio.webm"), eq("de"), eq(""));
        assertThat(trace).contains("ledger tx=true");
        assertThat(txManager.committed).isEqualTo(1);
        assertThat(txManager.rolledBack).isEqualTo(1);
        verify(turnRepository, never()).save(any());
    }

    @Test
    @DisplayName("hết giờ Teil ngay ở bước kiểm tra: ExamPartTimeoutException vẫn COMMIT việc chuyển phần (noRollbackFor)")
    void partTimeoutCommitsInsteadOfRollingBack() {
        // Không dựng được phiên mock quá hạn mà không có blueprint thật; kiểm thẳng ngữ nghĩa của
        // khung transaction dùng chung cho cả hai bước.
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "inTurnTransaction",
                (java.util.function.Supplier<Object>) () -> {
                    throw new ExamPartTimeoutException("Hết giờ Teil 1");
                }))
                .isInstanceOf(ExamPartTimeoutException.class);
        assertThat(txManager.committed).isEqualTo(1);
        assertThat(txManager.rolledBack).isZero();

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "inTurnTransaction",
                (java.util.function.Supplier<Object>) () -> {
                    throw new ConflictException("x");
                }))
                .isInstanceOf(ConflictException.class);
        assertThat(txManager.committed).isEqualTo(1);
        assertThat(txManager.rolledBack).isEqualTo(1);
    }
}
