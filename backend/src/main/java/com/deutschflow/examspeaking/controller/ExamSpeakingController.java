package com.deutschflow.examspeaking.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.dto.ExamResultView;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.dto.TurnResponse;
import com.deutschflow.examspeaking.dto.WeaknessView;
import com.deutschflow.examspeaking.session.ExamSessionService;
import com.deutschflow.examspeaking.weakness.ExamWeaknessService;
import com.deutschflow.speaking.util.TranscribeUploads;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Mảng Luyện thi Nói — API phiên cá nhân (kế hoạch 2.3). Mock nhận AUDIO (server phiên âm); drill nhận text.
 * Quyền: người dùng đã đăng nhập (anyRequest().authenticated()); phiên chỉ truy cập bởi chủ sở hữu.
 */
@RestController
@RequestMapping("/api/speaking/exam")
@RequiredArgsConstructor
public class ExamSpeakingController {

    private final ExamBlueprintCatalog catalog;
    private final ExamSessionService sessionService;
    private final ExamWeaknessService weaknessService;
    private final com.deutschflow.examspeaking.session.ExamTurnIdempotencyService idempotency;

    @Value("${app.ai.transcribe.max-bytes:8388608}")
    private long transcribeMaxBytes;

    @GetMapping("/blueprints")
    public List<Map<String, Object>> blueprints(@RequestParam(required = false) String provider,
                                                @RequestParam(required = false) String level) {
        return catalog.listActive().stream()
                .filter(b -> provider == null || b.provider() == ExamProvider.fromApi(provider))
                .filter(b -> level == null || b.level().equalsIgnoreCase(level))
                .map(ExamSpeakingController::summary)
                .toList();
    }

    /** Đợt 5a — màn "Ôn yếu điểm": yếu điểm theo dạng bài + gói Redemittel. */
    @GetMapping("/weakness")
    public WeaknessView weakness(@AuthenticationPrincipal User user,
                                 @RequestParam(required = false) String provider,
                                 @RequestParam(required = false) String level) {
        return weaknessService.weakness(user.getId(), provider, level);
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public ExamSessionView create(@AuthenticationPrincipal User user, @RequestBody CreateExamSessionRequest req) {
        return sessionService.create(user.getId(), req);
    }

    @GetMapping("/sessions/{id}")
    public ExamSessionView get(@AuthenticationPrincipal User user, @PathVariable long id) {
        return sessionService.get(user.getId(), id);
    }

    /**
     * Drill (và mock khi dev bật allow-text-turns-in-mock): lượt nói dạng text.
     * {@code clientTurnId} (tuỳ chọn, F-06): retry cùng khoá trong 15′ trả lại phản hồi đầu, không xử lý lại.
     */
    @PostMapping(value = "/sessions/{id}/turns", consumes = MediaType.APPLICATION_JSON_VALUE)
    public TurnResponse textTurn(@AuthenticationPrincipal User user, @PathVariable long id,
                                 @RequestBody Map<String, String> body,
                                 @RequestParam(value = "lang", required = false) String lang,
                                 @RequestParam(value = "clientTurnId", required = false) String clientTurnId) {
        String transcript = body == null ? null : body.get("transcript");
        return idempotency.execute(user.getId(), id, clientTurnId,
                () -> sessionService.submitTextTurn(user.getId(), id, transcript, lang),
                cached -> sessionService.withFreshSession(user.getId(), id, cached));
    }

    /**
     * Mock: lượt nói dạng audio — server phiên âm verbose (word-timestamps + logprob) và phát hành transcript.
     * Audio được đọc/validate TRƯỚC khoá idempotency để 400 (định dạng/kích thước) không chiếm khoá.
     */
    @PostMapping(value = "/sessions/{id}/turns", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TurnResponse audioTurn(@AuthenticationPrincipal User user, @PathVariable long id,
                                  @RequestParam("audio") MultipartFile file,
                                  @RequestParam(value = "lang", required = false) String lang,
                                  @RequestParam(value = "clientTurnId", required = false) String clientTurnId) throws IOException {
        byte[] audio = readValidatedAudio(file);
        String filename = file.getOriginalFilename();
        return idempotency.execute(user.getId(), id, clientTurnId,
                () -> sessionService.submitAudioTurn(user.getId(), id, audio, filename, lang),
                cached -> sessionService.withFreshSession(user.getId(), id, cached));
    }

    /** Chọn chủ đề cho Teil "1 trong N" (Goethe B1/B2 T2): trong PREP (mock) hoặc ngay đầu Teil (drill). */
    @PostMapping("/sessions/{id}/choice")
    public ExamSessionView choice(@AuthenticationPrincipal User user, @PathVariable long id,
                                  @RequestBody Map<String, Integer> body) {
        Integer teil = body == null ? null : body.get("teilNo");
        Integer index = body == null ? null : body.get("index");
        if (teil == null || index == null) {
            throw new BadRequestException("teilNo và index là bắt buộc");
        }
        return sessionService.choose(user.getId(), id, teil, index);
    }

    @PostMapping("/sessions/{id}/advance")
    public ExamSessionView advance(@AuthenticationPrincipal User user, @PathVariable long id) {
        return sessionService.advance(user.getId(), id);
    }

    @PostMapping("/sessions/{id}/finish")
    public ExamSessionView finish(@AuthenticationPrincipal User user, @PathVariable long id) {
        return sessionService.finish(user.getId(), id);
    }

    /** Chấm lại khi job chấm nền đã chết (state = GRADING_FAILED). Trạng thái khác → 409. */
    @PostMapping("/sessions/{id}/regrade")
    public ExamSessionView regrade(@AuthenticationPrincipal User user, @PathVariable long id) {
        return sessionService.regrade(user.getId(), id);
    }

    @PutMapping("/sessions/{id}/notes")
    public ExamSessionView notes(@AuthenticationPrincipal User user, @PathVariable long id,
                                 @RequestBody Map<String, String> body) {
        return sessionService.saveNotes(user.getId(), id, body == null ? null : body.get("notes"));
    }

    @GetMapping("/sessions/{id}/result")
    public ExamResultView result(@AuthenticationPrincipal User user, @PathVariable long id) {
        return sessionService.result(user.getId(), id);
    }

    @GetMapping("/results")
    public List<ExamResultView> results(@AuthenticationPrincipal User user) {
        return sessionService.results(user.getId());
    }

    private static Map<String, Object> summary(ExamBlueprint b) {
        return Map.of(
                "id", b.id(),
                "provider", b.provider().name(),
                "level", b.level(),
                "version", b.version(),
                "title", b.title(),
                "prepSec", b.prepSec(),
                "parts", b.parts().stream().map(p -> Map.of(
                        "teilNo", p.teilNo(), "archetype", p.archetype().name(), "title", p.title(),
                        "durationSec", p.durationSec(), "flow", p.flow().name(), "hasPartner", p.hasPartner())).toList(),
                "rubricScale", b.rubric().scale().name(),
                "maxTotal", b.rubric().maxTotal(),
                "speakingOnlyMin", b.rubric().speakingOnlyMin() == null ? 0 : b.rubric().speakingOnlyMin());
    }

    private byte[] readValidatedAudio(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Audio file is required.");
        }
        if (!TranscribeUploads.isAllowedAudioContentType(file.getContentType())) {
            throw new BadRequestException("Unsupported audio format. Allowed: webm, mp4, m4a, mpeg, ogg, wav.");
        }
        try (InputStream in = file.getInputStream()) {
            return TranscribeUploads.readAtMost(in, transcribeMaxBytes);
        } catch (IllegalArgumentException tooBig) {
            throw new BadRequestException("Audio file too large (max " + (transcribeMaxBytes / (1024 * 1024)) + "MB).");
        }
    }
}
