package com.deutschflow.examspeaking.session;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobRepository;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.audio.ExamAudioStorage;
import com.deutschflow.examspeaking.repository.SpeakingExamCalibrationParticipantRepository;
import com.deutschflow.examspeaking.api.PrueferScriptService;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.Utterance;
import com.deutschflow.examspeaking.config.ExamSpeakingProperties;
import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.dto.ExamResultView;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.dto.TurnResponse;
import com.deutschflow.examspeaking.entity.SpeakingExamResult;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import com.deutschflow.examspeaking.entity.SpeakingExamTurn;
import com.deutschflow.examspeaking.repository.SpeakingExamResultRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamTurnRepository;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.GroqWhisperClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Phiên luyện thi cá nhân: tạo (rút đề + kịch bản), lượt (STT verbose cho mock / text cho drill), chuyển Teil,
 * kết thúc (drill: tổng kết; mock: enqueue chấm nền). Quota 3 lớp theo đúng mẫu requireEvalBudget.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExamSessionService {

    public static final String JOB_TYPE_MOCK_GRADING = "EXAM_MOCK_GRADING";
    static final long TURN_ESTIMATED_TOKENS = 700L;
    static final long DRILL_EVAL_ESTIMATED_TOKENS = 600L;
    static final long STT_ESTIMATED_TOKENS = 200L;
    static final long MOCK_GRADING_ESTIMATED_TOKENS = 12_000L;
    static final int PART_GRACE_SECONDS = 10;

    private final ExamBlueprintCatalog catalog;
    private final ExamTaskBankService taskBank;
    private final ExamSessionOrchestrator orchestrator;
    private final AiInterlocutorService interlocutor;
    private final PrueferScriptService prueferScript;
    private final SpeakingExamSessionRepository sessionRepository;
    private final SpeakingExamTurnRepository turnRepository;
    private final SpeakingExamResultRepository resultRepository;
    private final AiJobRepository aiJobRepository;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;
    private final AiRateLimiterService rateLimiter;
    private final AiUsageLedgerService ledger;
    private final GroqWhisperClient whisperClient;
    private final ExamAudioStorage audioStorage;
    private final SpeakingExamCalibrationParticipantRepository calibrationParticipants;
    private final ObjectMapper objectMapper;
    private final ExamSpeakingProperties props;
    private final com.deutschflow.examspeaking.weakness.ExamErrorSrsBridge srsBridge;

    // ── tạo phiên ───────────────────────────────────────────────────────────────────────────

    @Transactional
    public ExamSessionView create(long userId, CreateExamSessionRequest req) {
        ExamProvider provider = ExamProvider.fromApi(req.provider());
        String level = req.level() == null ? "" : req.level().trim().toUpperCase(Locale.ROOT);
        String mode = req.mode() == null ? SpeakingExamSession.MODE_DRILL : req.mode().trim().toUpperCase(Locale.ROOT);
        if (!SpeakingExamSession.MODE_DRILL.equals(mode) && !SpeakingExamSession.MODE_MOCK.equals(mode)) {
            throw new BadRequestException("mode must be DRILL or MOCK");
        }
        ExamBlueprint bp = catalog.find(provider, level)
                .orElseThrow(() -> new NotFoundException("Chưa có blueprint cho " + provider + " " + level));
        Integer teil = SpeakingExamSession.MODE_DRILL.equals(mode) ? req.teil() : null;
        if (SpeakingExamSession.MODE_DRILL.equals(mode) && teil != null && bp.part(teil).isEmpty()) {
            throw new BadRequestException("Teil " + teil + " không tồn tại trong " + provider + " " + level);
        }
        quotaService.assertAllowed(userId, Instant.now(), TURN_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, TURN_ESTIMATED_TOKENS);

        Map<Integer, List<SpeakingExamTask>> tasks = new HashMap<>();
        for (BlueprintPart part : bp.parts()) {
            if (teil == null || part.teilNo() == teil) {
                tasks.put(part.teilNo(), taskBank.pick(bp, part));
            }
        }
        SessionPlan plan = orchestrator.buildPlan(bp, tasks, teil);
        boolean prep = SpeakingExamSession.MODE_MOCK.equals(mode) && bp.prepSec() > 0;
        Integer prepSec = prep ? effectivePrepSec(bp.prepSec(), req.prepMode()) : null;
        Instant now = Instant.now();
        SpeakingExamSession s = SpeakingExamSession.builder()
                .userId(userId).blueprintId(bp.id()).mode(mode)
                .state(prep ? SpeakingExamSession.STATE_PREP : SpeakingExamSession.STATE_IN_PART)
                .drillTeilNo(teil)
                .currentPart(prep ? 0 : plan.parts().get(0).teilNo())
                .currentStep(0)
                .planJson(objectMapper.convertValue(plan, new TypeReference<Map<String, Object>>() {}))
                .prepStartedAt(prep ? now : null)
                .prepSec(prepSec)
                // Chỉ phiên MOCK của người ĐÃ ĐỒNG Ý hiệu chuẩn mới giữ audio (V284). Mặc định: không lưu.
                .retainAudio(SpeakingExamSession.MODE_MOCK.equals(mode) && calibrationParticipants.existsById(userId))
                .build();
        if (!prep) {
            startPart(s, plan.parts().get(0), now);
        }
        s = sessionRepository.save(s);
        int seq = 0;
        if (SpeakingExamSession.MODE_MOCK.equals(mode)) {
            seq = addPrueferTurn(s, seq, 0, prueferScript.line(bp, bp.parts().get(0), PrueferScriptService.Moment.SESSION_OPENING, null).textDe());
        }
        if (!prep) {
            seq = openPart(s, bp, plan.parts().get(0), seq);
        }
        return view(s, bp, plan, null);
    }

    // ── snapshot ────────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ExamSessionView get(long userId, long sessionId) {
        SpeakingExamSession s = load(userId, sessionId);
        ExamBlueprint bp = blueprint(s);
        return view(s, bp, plan(s), null);
    }

    // ── lượt nói ────────────────────────────────────────────────────────────────────────────

    /** Overload không lang (test/tương thích): giải thích quickEval mặc định tiếng Việt. */
    @Transactional
    public TurnResponse submitTextTurn(long userId, long sessionId, String transcript) {
        return submitTextTurn(userId, sessionId, transcript, null);
    }

    @Transactional
    public TurnResponse submitTextTurn(long userId, long sessionId, String transcript, String lang) {
        SpeakingExamSession s = load(userId, sessionId);
        if (s.isMock() && !props.textTurnsInMockAllowed()) {
            throw new BadRequestException("Chế độ thi thử chỉ nhận audio (server tự phiên âm).");
        }
        if (transcript == null || transcript.isBlank()) {
            throw new BadRequestException("transcript is required");
        }
        return processCandidateTurn(userId, s, transcript.trim(), null, null, lang);
    }

    /** Overload không lang (test/tương thích). */
    @Transactional
    public TurnResponse submitAudioTurn(long userId, long sessionId, byte[] audio, String filename) {
        return submitAudioTurn(userId, sessionId, audio, filename, null);
    }

    @Transactional
    public TurnResponse submitAudioTurn(long userId, long sessionId, byte[] audio, String filename, String lang) {
        SpeakingExamSession s = load(userId, sessionId);
        requireBudget(userId, AiRateLimiterService.Bucket.TRANSCRIBE, STT_ESTIMATED_TOKENS, "Too many transcribe requests.");
        GroqWhisperClient.VerboseTranscript stt = whisperClient.transcribeVerbose(audio, filename == null ? "audio.webm" : filename, "de", "");
        ledger.recordStt(userId, "EXAM_SPEAKING_STT", whisperClient.getWhisperModel(), stt.durationSeconds());
        if (stt.text() == null || stt.text().isBlank()) {
            throw new BadRequestException("Không nghe được gì trong audio. Hãy thử lại gần mic hơn.");
        }
        Map<String, Object> sttJson = new LinkedHashMap<>();
        sttJson.put("avgLogprob", stt.avgLogprob());
        sttJson.put("durationSeconds", stt.durationSeconds());
        sttJson.put("words", stt.words().stream().map(w -> Map.of("word", w.word(), "start", w.start(), "end", w.end())).toList());
        // Phiên hiệu chuẩn: giữ audio để giám khảo nghe lại (G.2/G.3). Best-effort — S3 hỏng thì
        // audioRef = null và lượt nói vẫn chạy; không được để việc lưu trữ giết phiên thi.
        String audioRef = s.isRetainAudio()
                ? audioStorage.store(s.getId(), nextSeq(s), audio, filename)
                : null;
        return processCandidateTurn(userId, s, stt.text().trim(), sttJson, audioRef, lang);
    }

    private TurnResponse processCandidateTurn(long userId, SpeakingExamSession s, String transcript,
                                              Map<String, Object> sttJson, String audioRef, String lang) {
        if (!SpeakingExamSession.STATE_IN_PART.equals(s.getState())) {
            throw new ConflictException("Phiên không ở trạng thái nhận lượt nói (state=" + s.getState() + ")");
        }
        ExamBlueprint bp = blueprint(s);
        SessionPlan plan = plan(s);
        SessionPlan.PartPlan pp = plan.part(s.getCurrentPart());
        BlueprintPart part = bp.part(s.getCurrentPart()).orElseThrow();
        Instant now = Instant.now();
        if (s.isMock() && s.getPartDeadlineAt() != null && now.isAfter(s.getPartDeadlineAt().plusSeconds(PART_GRACE_SECONDS))) {
            advanceInternal(s, bp, plan, now);
            throw new ConflictException("Hết giờ Teil " + pp.teilNo() + " — đã chuyển sang phần kế tiếp.");
        }
        requireBudget(userId, AiRateLimiterService.Bucket.CHAT, TURN_ESTIMATED_TOKENS, "Too many turns. Please slow down.");

        SessionPlan.Step step = pp.steps().get(Math.min(s.getCurrentStep(), pp.steps().size() - 1));
        List<SpeakingExamTurn> turns = turnRepository.findBySessionIdOrderBySeqAsc(s.getId());
        int seq = turns.isEmpty() ? 0 : turns.get(turns.size() - 1).getSeq() + 1;
        String lastAiText = turns.stream().filter(t -> !SpeakingExamTurn.ROLE_CANDIDATE.equals(t.getRole()))
                .reduce((a, b) -> b).map(SpeakingExamTurn::getTranscript).orElse(null);

        SpeakingExamTurn candidate = SpeakingExamTurn.builder().sessionId(s.getId()).partNo(pp.teilNo()).seq(seq++)
                .role(SpeakingExamTurn.ROLE_CANDIDATE).transcript(transcript).sttJson(sttJson).audioRef(audioRef).build();

        Map<String, Object> card = stimulus(pp, step.cardIndex());
        Map<String, Object> nextCard = step.cardIndex() == null || pp.chosenIndex() != null ? null : stimulus(pp, step.cardIndex() + 1);
        List<ChatMessage> hist = history(turns, pp.teilNo());
        AiInterlocutorService.AiReply ai = interlocutor.reply(userId, bp, part, step, card, nextCard, hist, transcript);
        AiInterlocutorService.AiReply ai2 = null;
        if (ai != null && step.hasSecondAi()) {
            List<ChatMessage> hist2 = new ArrayList<>(hist);
            hist2.add(new ChatMessage("user", transcript));
            hist2.add(new ChatMessage("assistant", "[" + ai.role() + "] " + ai.textDe()));
            SessionPlan.Step second = new SessionPlan.Step(step.index(), step.candidateAction(), step.cardIndex(),
                    step.aiRole2(), step.aiAction2(), step.hintVi(), step.hintKey());
            ai2 = interlocutor.reply(userId, bp, part, second, card, null, hist2, transcript);
        }

        Map<String, Object> eval = null;
        if (!s.isMock()) {
            requireBudget(userId, AiRateLimiterService.Bucket.EVAL, DRILL_EVAL_ESTIMATED_TOKENS, "Too many evaluations.");
            eval = interlocutor.quickEval(userId, bp, part, step, card, lastAiText, transcript, lang);
            candidate.setTurnEvalJson(eval);
            // Đợt 5a: corrections của lượt drill đổ vào kho yếu điểm (SRS + stats theo dạng bài).
            srsBridge.ingestDrillEval(userId, bp, pp.teilNo(), eval);
        }
        turnRepository.save(candidate);
        List<TurnResponse.AiTurn> aiTurns = new ArrayList<>();
        for (AiInterlocutorService.AiReply r : new AiInterlocutorService.AiReply[]{ai, ai2}) {
            if (r != null) {
                turnRepository.save(SpeakingExamTurn.builder().sessionId(s.getId()).partNo(pp.teilNo()).seq(seq++)
                        .role(r.role()).transcript(r.textDe()).build());
                aiTurns.add(new TurnResponse.AiTurn(r.role(), r.textDe()));
            }
        }
        AiInterlocutorService.AiReply lastAi = ai2 != null ? ai2 : ai;

        s.setCurrentStep(s.getCurrentStep() + 1);
        if (s.getCurrentStep() >= pp.steps().size()) {
            advanceInternal(s, bp, plan, now);
        }
        sessionRepository.save(s);
        ExamSessionView v = view(s, bp, plan, eval);
        return new TurnResponse(transcript, lastAi == null ? null : lastAi.role(), lastAi == null ? null : lastAi.textDe(),
                lastAi == null ? null : lastAi.role(), aiTurns, eval, v);
    }

    // ── chọn đề (1 trong N) ─────────────────────────────────────────────────────────────────

    /**
     * Thí sinh chọn chủ đề cho Teil "chọn 1 trong N" (Goethe B1/B2 T2…). Cho phép trong PREP (mock) hoặc ngay khi
     * vào Teil đó mà chưa nói lượt nào (drill). Chọn muộn hơn → 409 (đúng luật thi: đã bắt đầu thì không đổi đề).
     */
    @Transactional
    public ExamSessionView choose(long userId, long sessionId, int teilNo, int index) {
        SpeakingExamSession s = load(userId, sessionId);
        ExamBlueprint bp = blueprint(s);
        SessionPlan plan = plan(s);
        SessionPlan.PartPlan pp = plan.part(teilNo);
        if (pp == null || !pp.choiceRequired()) {
            throw new BadRequestException("Teil " + teilNo + " không có lựa chọn chủ đề");
        }
        if (index < 0 || index >= pp.stimuli().size()) {
            throw new BadRequestException("index ngoài phạm vi (0.." + (pp.stimuli().size() - 1) + ")");
        }
        boolean inPrep = SpeakingExamSession.STATE_PREP.equals(s.getState());
        boolean atPartStart = SpeakingExamSession.STATE_IN_PART.equals(s.getState()) && s.getCurrentPart() == teilNo
                && turnRepository.countBySessionIdAndPartNoAndRole(s.getId(), teilNo, SpeakingExamTurn.ROLE_CANDIDATE) == 0;
        if (!inPrep && !atPartStart) {
            throw new ConflictException("Không thể đổi chủ đề sau khi đã bắt đầu nói ở Teil " + teilNo);
        }
        List<SessionPlan.PartPlan> parts = new ArrayList<>();
        for (SessionPlan.PartPlan p : plan.parts()) {
            parts.add(p.teilNo() == teilNo ? p.withChosenIndex(index) : p);
        }
        SessionPlan updated = new SessionPlan(parts);
        s.setPlanJson(objectMapper.convertValue(updated, new TypeReference<Map<String, Object>>() {}));
        if (atPartStart) {
            // Prüfer giới thiệu lại với đúng chủ đề đã chọn (thay lời giới thiệu cũ bằng lượt mới).
            addPrueferTurn(s, nextSeq(s), teilNo, prueferScript.line(bp, bp.part(teilNo).orElseThrow(),
                    PrueferScriptService.Moment.PART_INTRO, stimulus(updated.part(teilNo), 0)).textDe());
        }
        sessionRepository.save(s);
        return view(s, bp, updated, null);
    }

    /** Vorbereitungszeit hiệu lực: SHORT (mặc định) = 5′ rút gọn (mục 4b kế hoạch); FULL = chuẩn thi thật. */
    static int effectivePrepSec(int blueprintPrepSec, String prepMode) {
        if (prepMode != null && "FULL".equalsIgnoreCase(prepMode.trim())) {
            return blueprintPrepSec;
        }
        return Math.min(300, blueprintPrepSec);
    }

    // ── chuyển phần / kết thúc ──────────────────────────────────────────────────────────────

    @Transactional
    public ExamSessionView advance(long userId, long sessionId) {
        SpeakingExamSession s = load(userId, sessionId);
        ExamBlueprint bp = blueprint(s);
        SessionPlan plan = plan(s);
        if (s.isTerminal()) {
            throw new ConflictException("Phiên đã kết thúc (state=" + s.getState() + ")");
        }
        advanceInternal(s, bp, plan, Instant.now());
        sessionRepository.save(s);
        return view(s, bp, plan, null);
    }

    @Transactional
    public ExamSessionView finish(long userId, long sessionId) {
        SpeakingExamSession s = load(userId, sessionId);
        ExamBlueprint bp = blueprint(s);
        SessionPlan plan = plan(s);
        if (!s.isTerminal()) {
            closeSession(s, bp, plan, Instant.now());
            sessionRepository.save(s);
        }
        return view(s, bp, plan, null);
    }

    /**
     * Chấm lại phiên mock có job chấm đã chết (GRADING_FAILED): assert quota như finish rồi enqueue
     * job MỚI và quay về GRADING — poll sẵn có của client tự nối tiếp. Chỉ nhận đúng GRADING_FAILED:
     * GRADING đang chạy thì không chen (sinh job đôi), RESULTS thì đã có phiếu — đều 409.
     */
    @Transactional
    public ExamSessionView regrade(long userId, long sessionId) {
        SpeakingExamSession s = load(userId, sessionId);
        if (!SpeakingExamSession.STATE_GRADING_FAILED.equals(s.getState())) {
            throw new ConflictException("Phiên không ở trạng thái chấm lỗi (state=" + s.getState() + ")");
        }
        quotaService.assertAllowed(userId, Instant.now(), MOCK_GRADING_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, MOCK_GRADING_ESTIMATED_TOKENS);
        AiJob job = aiJobRepository.save(AiJob.builder().jobType(JOB_TYPE_MOCK_GRADING).userId(userId)
                .payload(Map.of("sessionId", s.getId())).build());
        s.setGradingJobId(job.getId());
        s.setState(SpeakingExamSession.STATE_GRADING);
        sessionRepository.save(s);
        log.info("[ExamSpeaking] mock session {} regrade → job {}", s.getId(), job.getId());
        return view(s, blueprint(s), plan(s), null);
    }

    @Transactional
    public ExamSessionView saveNotes(long userId, long sessionId, String notes) {
        SpeakingExamSession s = load(userId, sessionId);
        s.setNotesText(notes == null ? null : notes.substring(0, Math.min(notes.length(), 4000)));
        sessionRepository.save(s);
        return view(s, blueprint(s), plan(s), null);
    }

    private void advanceInternal(SpeakingExamSession s, ExamBlueprint bp, SessionPlan plan, Instant now) {
        if (SpeakingExamSession.STATE_PREP.equals(s.getState())) {
            SessionPlan.PartPlan first = plan.parts().get(0);
            s.setState(SpeakingExamSession.STATE_IN_PART);
            s.setCurrentPart(first.teilNo());
            s.setCurrentStep(0);
            startPart(s, first, now);
            openPart(s, bp, first, nextSeq(s));
            return;
        }
        SessionPlan.PartPlan next = null;
        boolean found = false;
        for (SessionPlan.PartPlan p : plan.parts()) {
            if (found) {
                next = p;
                break;
            }
            if (p.teilNo() == s.getCurrentPart()) {
                found = true;
            }
        }
        if (next == null) {
            closeSession(s, bp, plan, now);
            return;
        }
        int seq = nextSeq(s);
        if (s.isMock()) {
            BlueprintPart done = bp.part(s.getCurrentPart()).orElseThrow();
            seq = addPrueferTurn(s, seq, s.getCurrentPart(), prueferScript.line(bp, done, PrueferScriptService.Moment.PART_TRANSITION, null).textDe());
        }
        s.setState(SpeakingExamSession.STATE_IN_PART);
        s.setCurrentPart(next.teilNo());
        s.setCurrentStep(0);
        startPart(s, next, now);
        openPart(s, bp, next, seq);
    }

    private void closeSession(SpeakingExamSession s, ExamBlueprint bp, SessionPlan plan, Instant now) {
        s.setFinishedAt(now);
        s.setPartDeadlineAt(null);
        if (s.isMock()) {
            quotaService.assertAllowed(s.getUserId(), now, MOCK_GRADING_ESTIMATED_TOKENS);
            orgPoolGuard.assertOrgPoolAvailable(s.getUserId(), MOCK_GRADING_ESTIMATED_TOKENS);
            addPrueferTurn(s, nextSeq(s), s.getCurrentPart(),
                    prueferScript.line(bp, bp.parts().get(0), PrueferScriptService.Moment.SESSION_CLOSING, null).textDe());
            AiJob job = aiJobRepository.save(AiJob.builder().jobType(JOB_TYPE_MOCK_GRADING).userId(s.getUserId())
                    .payload(Map.of("sessionId", s.getId())).build());
            s.setGradingJobId(job.getId());
            s.setState(SpeakingExamSession.STATE_GRADING);
            log.info("[ExamSpeaking] mock session {} → grading job {}", s.getId(), job.getId());
        } else {
            s.setState(SpeakingExamSession.STATE_DONE);
        }
    }

    private void startPart(SpeakingExamSession s, SessionPlan.PartPlan pp, Instant now) {
        s.setPartStartedAt(now);
        s.setPartDeadlineAt(now.plusSeconds(pp.durationSec()));
    }

    /** Prüfer giới thiệu Teil (+ lượt mở đầu của partner nếu flow FEEDBACK). Trả seq kế tiếp. */
    private int openPart(SpeakingExamSession s, ExamBlueprint bp, SessionPlan.PartPlan pp, int seq) {
        BlueprintPart part = bp.part(pp.teilNo()).orElseThrow();
        Map<String, Object> first = stimulus(pp, 0);
        seq = addPrueferTurn(s, seq, pp.teilNo(), prueferScript.line(bp, part, PrueferScriptService.Moment.PART_INTRO, first).textDe());
        if (!pp.preTurn().isEmpty()) {
            turnRepository.save(SpeakingExamTurn.builder().sessionId(s.getId()).partNo(pp.teilNo()).seq(seq++)
                    .role(String.valueOf(pp.preTurn().get("role"))).transcript(String.valueOf(pp.preTurn().get("text"))).build());
        }
        return seq;
    }

    private int addPrueferTurn(SpeakingExamSession s, int seq, int partNo, String text) {
        turnRepository.save(SpeakingExamTurn.builder().sessionId(s.getId()).partNo(partNo).seq(seq)
                .role(SpeakingExamTurn.ROLE_PRUEFER).transcript(text).build());
        return seq + 1;
    }

    private int nextSeq(SpeakingExamSession s) {
        List<SpeakingExamTurn> turns = turnRepository.findBySessionIdOrderBySeqAsc(s.getId());
        return turns.isEmpty() ? 0 : turns.get(turns.size() - 1).getSeq() + 1;
    }

    // ── kết quả ─────────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ExamResultView result(long userId, long sessionId) {
        load(userId, sessionId);
        SpeakingExamResult r = resultRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new NotFoundException("Chưa có kết quả cho phiên " + sessionId));
        return toView(r);
    }

    @Transactional(readOnly = true)
    public List<ExamResultView> results(long userId) {
        return resultRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toView).toList();
    }

    /** Gói chấm cho MỘT thí sinh từ các lượt đã lưu (contract ParticipantBundle). */
    @Transactional(readOnly = true)
    public ParticipantBundle bundle(long sessionId) {
        SpeakingExamSession s = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("session " + sessionId));
        ExamBlueprint bp = blueprint(s);
        SessionPlan plan = plan(s);
        List<SpeakingExamTurn> turns = turnRepository.findBySessionIdOrderBySeqAsc(sessionId);
        List<ParticipantBundle.PartTranscript> parts = new ArrayList<>();
        for (SessionPlan.PartPlan pp : plan.parts()) {
            List<Utterance> candidate = new ArrayList<>();
            List<Utterance> others = new ArrayList<>();
            for (SpeakingExamTurn t : turns) {
                if (t.getPartNo() != pp.teilNo()) {
                    continue;
                }
                Utterance u = toUtterance(t);
                if (SpeakingExamTurn.ROLE_CANDIDATE.equals(t.getRole())) {
                    candidate.add(u);
                } else {
                    others.add(u);
                }
            }
            String desc = pp.stimuli().isEmpty() ? "" : pp.stimuli().toString();
            parts.add(new ParticipantBundle.PartTranscript(pp.teilNo(), pp.archetype(), desc, candidate, others));
        }
        return new ParticipantBundle(bp.rubricRef(), parts, "AI", "Kandidat");
    }

    @SuppressWarnings("unchecked")
    private Utterance toUtterance(SpeakingExamTurn t) {
        List<Utterance.Word> words = new ArrayList<>();
        Double logprob = null;
        Double duration = null;
        if (t.getSttJson() != null) {
            Object w = t.getSttJson().get("words");
            if (w instanceof List<?> list) {
                for (Object o : list) {
                    if (o instanceof Map<?, ?> m) {
                        words.add(new Utterance.Word(String.valueOf(m.get("word")),
                                ((Number) m.get("start")).doubleValue(), ((Number) m.get("end")).doubleValue()));
                    }
                }
            }
            Object lp = t.getSttJson().get("avgLogprob");
            Object du = t.getSttJson().get("durationSeconds");
            logprob = lp instanceof Number n ? n.doubleValue() : null;
            duration = du instanceof Number n ? n.doubleValue() : null;
        }
        return new Utterance(t.getRole(), t.getTranscript(), words, logprob, duration);
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    private SpeakingExamSession load(long userId, long sessionId) {
        return sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên " + sessionId));
    }

    private ExamBlueprint blueprint(SpeakingExamSession s) {
        return catalog.findById(s.getBlueprintId())
                .orElseThrow(() -> new NotFoundException("blueprint " + s.getBlueprintId()));
    }

    private SessionPlan plan(SpeakingExamSession s) {
        return objectMapper.convertValue(s.getPlanJson(), SessionPlan.class);
    }

    /**
     * Đề riêng tư (kế hoạch B2B §5 "stimulus riêng tư" áp dụng cả phiên cá nhân): mọi khóa bắt đầu bằng
     * {@code partner} (partnerCalendar, partnerNotes, partnerPresentation…) chỉ AI partner được biết —
     * KHÔNG BAO GIỜ gửi cho client, kể cả trong DevTools.
     */
    public static Map<String, Object> clientStimulus(Map<String, Object> full) {
        if (full == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        full.forEach((k, v) -> {
            if (!k.startsWith("partner")) {
                out.put(k, v);
            }
        });
        return out;
    }

    private static Map<String, Object> stimulus(SessionPlan.PartPlan pp, Integer index) {
        if (index == null || pp.stimuli().isEmpty()) {
            return null;
        }
        if (pp.chosenIndex() != null) {
            return pp.stimuli().get(Math.min(pp.chosenIndex(), pp.stimuli().size() - 1));
        }
        return pp.stimuli().get(Math.min(index, pp.stimuli().size() - 1));
    }

    private static List<ChatMessage> history(List<SpeakingExamTurn> turns, int partNo) {
        List<ChatMessage> h = new ArrayList<>();
        turns.stream().filter(t -> t.getPartNo() == partNo).skip(Math.max(0, turns.size() - 8)).forEach(t ->
                h.add(new ChatMessage(SpeakingExamTurn.ROLE_CANDIDATE.equals(t.getRole()) ? "user" : "assistant",
                        (SpeakingExamTurn.ROLE_CANDIDATE.equals(t.getRole()) ? "" : "[" + t.getRole() + "] ") + t.getTranscript())));
        return h;
    }

    private void requireBudget(long userId, AiRateLimiterService.Bucket bucket, long tokens, String msg) {
        quotaService.assertAllowed(userId, Instant.now(), tokens);
        orgPoolGuard.assertOrgPoolAvailable(userId, tokens);
        if (!rateLimiter.allow(bucket, userId)) {
            throw new RateLimitExceededException(msg, rateLimiter.retryAfterSeconds(bucket, userId));
        }
    }

    private ExamSessionView view(SpeakingExamSession s, ExamBlueprint bp, SessionPlan plan, Map<String, Object> lastEval) {
        Instant now = Instant.now();
        ExamSessionView.Directive directive = null;
        if (SpeakingExamSession.STATE_IN_PART.equals(s.getState())) {
            SessionPlan.PartPlan pp = plan.part(s.getCurrentPart());
            BlueprintPart part = bp.part(s.getCurrentPart()).orElseThrow();
            SessionPlan.Step step = pp.steps().get(Math.min(s.getCurrentStep(), pp.steps().size() - 1));
            List<SpeakingExamTurn> turns = turnRepository.findBySessionIdOrderBySeqAsc(s.getId());
            SpeakingExamTurn lastAi = turns.stream().filter(t -> t.getPartNo() == pp.teilNo()
                    && !SpeakingExamTurn.ROLE_CANDIDATE.equals(t.getRole())).reduce((a, b) -> b).orElse(null);
            SpeakingExamTurn lastPruefer = turns.stream().filter(t -> t.getPartNo() == pp.teilNo()
                    && SpeakingExamTurn.ROLE_PRUEFER.equals(t.getRole())).reduce((a, b) -> b).orElse(null);
            directive = new ExamSessionView.Directive(pp.teilNo(), part.title(), part.archetype().name(),
                    s.getCurrentStep(), pp.steps().size(), step.candidateAction(), step.hintVi(), step.hintKey(),
                    clientStimulus(stimulus(pp, step.cardIndex())),
                    lastPruefer == null ? null : lastPruefer.getTranscript(), "PRUEFER",
                    lastAi == null ? null : lastAi.getRole(), lastAi == null ? null : lastAi.getTranscript());
        }
        int prepSec = s.getPrepSec() != null ? s.getPrepSec() : bp.prepSec();
        Instant prepDeadline = s.getPrepStartedAt() == null ? null : s.getPrepStartedAt().plusSeconds(prepSec);
        boolean resultAvailable = SpeakingExamSession.STATE_RESULTS.equals(s.getState());
        List<ExamSessionView.PrepMaterial> materials = SpeakingExamSession.STATE_PREP.equals(s.getState())
                ? prepMaterials(bp, plan) : null;
        return new ExamSessionView(s.getId(), bp.provider().name(), bp.level(), s.getMode(), s.getState(),
                s.getCurrentPart(), s.getCurrentStep(), plan.parts().size(), now, prepDeadline, prepSec, materials,
                s.getPartDeadlineAt(), directive, lastEval, s.getNotesText(), s.getGradingJobId(), resultAvailable,
                s.isRetainAudio());
    }

    /** Tài liệu chuẩn bị: mọi Teil, chỉ phần thí sinh được xem (khóa partner* đã lược); Teil chọn đề trả đủ N phương án. */
    private static List<ExamSessionView.PrepMaterial> prepMaterials(ExamBlueprint bp, SessionPlan plan) {
        List<ExamSessionView.PrepMaterial> out = new ArrayList<>();
        for (SessionPlan.PartPlan pp : plan.parts()) {
            BlueprintPart part = bp.part(pp.teilNo()).orElseThrow();
            List<Map<String, Object>> stimuli = pp.choiceRequired()
                    ? pp.stimuli().stream().map(ExamSessionService::clientStimulus).toList()
                    : (pp.stimuli().isEmpty() ? List.of() : List.of(clientStimulus(stimulus(pp, 0))));
            out.add(new ExamSessionView.PrepMaterial(pp.teilNo(), part.title(), part.archetype().name(),
                    pp.choiceRequired(), pp.chosenIndex(), stimuli));
        }
        return out;
    }

    private ExamResultView toView(SpeakingExamResult r) {
        return new ExamResultView(r.getSessionId(), r.getProvider(), r.getLevel(), r.getRubricVersion(), r.getTotalPoints(),
                r.getTotalLow(), r.getTotalHigh(), r.getMaxPoints(), r.getPassed(), r.getScoreSheetJson(), r.getCreatedAt());
    }
}
