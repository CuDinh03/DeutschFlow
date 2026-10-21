package com.deutschflow.interview.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.interview.dto.OccupationContentReviewRequest;
import com.deutschflow.interview.dto.OccupationReviewDto;
import com.deutschflow.interview.entity.Occupation;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Hàng duyệt lớp nghề (đợt 2b A + B + E). Thứ tự: nghề được chọn nhiều nhất trước (sự kiện chọn
 * nghề = phiên có {@code occupation_code}); hoà thì Điều dưỡng, Xây dựng trước (landing đã hứa), rồi
 * theo {@code sort_rank} của danh mục (quyết định 6).
 */
@Service
@RequiredArgsConstructor
public class OccupationReviewService {

    /** Nhóm duyệt trước khi số phiên bằng nhau — trang chủ đang ghi "Sắp có" cho hai nhóm này. */
    static final List<String> PRIORITY_WORKPLACES = List.of("pflege", "bau");

    private final OccupationRepository occupationRepository;
    private final OccupationQuestionRepository questionRepository;
    private final OccupationTermRepository termRepository;
    private final OccupationContentGenerator contentGenerator;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<OccupationReviewDto> queue(OccupationContentStatus status) {
        Map<String, List<OccupationQuestion>> questions = questionRepository.findByStatusOrderByCreatedAtAscIdAsc(status)
                .stream().collect(Collectors.groupingBy(OccupationQuestion::getOccupationCode,
                        LinkedHashMap::new, Collectors.toList()));
        Map<String, List<OccupationTerm>> terms = termRepository.findByStatusOrderByCreatedAtAscIdAsc(status)
                .stream().collect(Collectors.groupingBy(OccupationTerm::getOccupationCode,
                        LinkedHashMap::new, Collectors.toList()));
        Set<String> codes = new LinkedHashSet<>(questions.keySet());
        codes.addAll(terms.keySet());
        if (codes.isEmpty()) {
            return List.of();
        }
        Map<String, Occupation> occupations = occupationRepository.findAllById(codes).stream()
                .collect(Collectors.toMap(Occupation::getCode, Function.identity()));
        Map<String, Long> sessions = sessionCounts();

        return codes.stream()
                .filter(occupations::containsKey)
                .map(code -> {
                    Occupation o = occupations.get(code);
                    return new OccupationReviewDto(code, o.getNameDe(), o.getNameVi(), o.getWorkplace(),
                            sessions.getOrDefault(code, 0L),
                            questions.getOrDefault(code, List.of()).stream()
                                    .map(OccupationReviewDto.QuestionItem::from).toList(),
                            terms.getOrDefault(code, List.of()).stream()
                                    .map(OccupationReviewDto.TermItem::from).toList());
                })
                .sorted(reviewOrder(occupations))
                .toList();
    }

    static Comparator<OccupationReviewDto> reviewOrder(Map<String, Occupation> occupations) {
        return Comparator.comparingLong(OccupationReviewDto::sessionCount).reversed()
                .thenComparingInt(d -> PRIORITY_WORKPLACES.contains(d.workplace()) ? 0 : 1)
                .thenComparingInt(d -> occupations.get(d.code()).getSortRank())
                .thenComparing(OccupationReviewDto::code);
    }

    private Map<String, Long> sessionCounts() {
        Map<String, Long> out = new HashMap<>();
        for (Object[] row : questionRepository.countSessionsByOccupation()) {
            out.put((String) row[0], ((Number) row[1]).longValue());
        }
        return out;
    }

    @Transactional
    public OccupationReviewDto.QuestionItem reviewQuestion(String id, OccupationContentReviewRequest req, User actor) {
        requireDecision(req.status());
        OccupationQuestion q = questionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Occupation question not found: " + id));
        String before = q.getQuestionDe();
        if (hasText(req.questionDe())) {
            q.setQuestionDe(req.questionDe().strip());
        }
        applyDecision(req, actor, q::setStatus, q::setReviewedBy, q::setReviewedAt, q::setReviewNote);
        questionRepository.save(q);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("occupation", q.getOccupationCode());
        meta.put("status", q.getStatus().name());
        meta.put("edited", !before.equals(q.getQuestionDe()));
        auditLogService.log("admin.occupation.question.reviewed", AuditActor.of(actor),
                "OCCUPATION_QUESTION", id, meta);
        return OccupationReviewDto.QuestionItem.from(q);
    }

    @Transactional
    public OccupationReviewDto.TermItem reviewTerm(Long id, OccupationContentReviewRequest req, User actor) {
        requireDecision(req.status());
        OccupationTerm t = termRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Occupation term not found: " + id));
        boolean edited = false;
        if (hasText(req.termDe())) { t.setTermDe(req.termDe().strip()); edited = true; }
        if (hasText(req.meaningEn())) { t.setMeaningEn(req.meaningEn().strip()); edited = true; }
        if (hasText(req.meaningVi())) { t.setMeaningVi(req.meaningVi().strip()); edited = true; }
        if (hasText(req.exampleDe())) { t.setExampleDe(req.exampleDe().strip()); edited = true; }
        applyDecision(req, actor, t::setStatus, t::setReviewedBy, t::setReviewedAt, t::setReviewNote);
        termRepository.save(t);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("occupation", t.getOccupationCode());
        meta.put("status", t.getStatus().name());
        meta.put("edited", edited);
        auditLogService.log("admin.occupation.term.reviewed", AuditActor.of(actor),
                "OCCUPATION_TERM", String.valueOf(id), meta);
        return OccupationReviewDto.TermItem.from(t);
    }

    /** Admin bấm "Sinh thêm": một lượt 6 câu + 6 từ mới vào hàng duyệt. Nghề có bộ viết tay → 409. */
    public OccupationReviewDto generate(String code, User actor) {
        Occupation o = occupationRepository.findById(code)
                .orElseThrow(() -> new NotFoundException("Occupation not found: " + code));
        if (o.getLegacyPersonaCode() != null) {
            throw new ConflictException("Nghề này đã có bộ câu hỏi viết tay của nhân vật " + o.getLegacyPersonaCode() + ".");
        }
        OccupationContentGenerator.Generated g = contentGenerator.generate(o)
                .orElseThrow(() -> new AiServiceException("Không sinh được câu hỏi cho nghề này, thử lại sau."));
        auditLogService.log("admin.occupation.content.generated", AuditActor.of(actor), "OCCUPATION", code,
                Map.of("questions", g.questions().size(), "terms", g.terms().size()));
        return new OccupationReviewDto(code, o.getNameDe(), o.getNameVi(), o.getWorkplace(),
                sessionCounts().getOrDefault(code, 0L),
                g.questions().stream().map(OccupationReviewDto.QuestionItem::from).toList(),
                g.terms().stream().map(OccupationReviewDto.TermItem::from).toList());
    }

    private static void requireDecision(OccupationContentStatus status) {
        if (status != OccupationContentStatus.APPROVED && status != OccupationContentStatus.REJECTED) {
            throw new BadRequestException("status must be APPROVED or REJECTED.");
        }
    }

    private static void applyDecision(OccupationContentReviewRequest req, User actor,
                                      java.util.function.Consumer<OccupationContentStatus> setStatus,
                                      java.util.function.Consumer<Long> setReviewedBy,
                                      java.util.function.Consumer<LocalDateTime> setReviewedAt,
                                      java.util.function.Consumer<String> setNote) {
        setStatus.accept(req.status());
        setReviewedBy.accept(actor != null ? actor.getId() : null);
        setReviewedAt.accept(LocalDateTime.now());
        setNote.accept(hasText(req.note()) ? req.note().strip() : null);
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}
