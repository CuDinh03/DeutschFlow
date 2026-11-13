package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDetailDto.LayerQuestion;
import com.deutschflow.interview.dto.OccupationDetailDto.SampleQuestion;
import com.deutschflow.interview.dto.OccupationDetailDto.Term;
import com.deutschflow.interview.dto.IndexableOccupationDto;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import com.deutschflow.speaking.interview.InterviewPhase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Chi tiết nghề cho trang công khai (đợt 2d A + B + E): danh mục + lớp nghề đã lưu (V335).
 *
 * <p>Chỉ đọc nội dung đã sinh, không bao giờ gọi AI theo lượt xem. Câu và từ {@code REJECTED} không
 * bao giờ ra ngoài; câu đã duyệt đứng trước câu AI tạo. Nghề có lớp nghề thì câu mẫu là câu mở đầu
 * chung + 2 câu lớp nghề — đúng loại câu phiên phỏng vấn hỏi trước ở HARD_SKILLS.
 */
@Service
@RequiredArgsConstructor
public class OccupationPublicService {

    /** Số câu đã duyệt tối thiểu để trang nghề dùng bộ chung được coi là "Đã duyệt" (được lập chỉ mục). */
    static final int MIN_APPROVED_FOR_REVIEWED = 3;
    static final int SAMPLE_LAYER_QUESTIONS = 2;

    private static final Comparator<OccupationContentStatus> APPROVED_FIRST =
            Comparator.comparingInt(s -> s == OccupationContentStatus.APPROVED ? 0 : 1);

    private final OccupationCatalogService catalogService;
    private final OccupationQuestionRepository questionRepository;
    private final OccupationTermRepository termRepository;

    public Optional<OccupationDetailDto> detail(String code) {
        return catalogService.detail(code).map(this::withLayer);
    }

    /**
     * Trang nghề được lập chỉ mục — CÙNG điều kiện {@code reviewed} của {@link #withLayer}: bộ viết tay,
     * hoặc ≥{@value #MIN_APPROVED_FOR_REVIEWED} câu HARD_SKILLS đã duyệt. Một truy vấn gộp cho cả danh
     * mục, để sitemap không phải gọi chi tiết từng nghề (bot quét làm backend 429, nghiệm thu 21/10/2026).
     */
    public List<IndexableOccupationDto> indexable() {
        Map<String, Object[]> stats = new HashMap<>();
        for (Object[] row : questionRepository.statsByOccupation(
                OccupationContentStatus.APPROVED, InterviewPhase.HARD_SKILLS.name())) {
            stats.put((String) row[0], row);
        }
        Map<String, Boolean> curated = new HashMap<>();
        catalogService.list().forEach(o -> curated.put(o.code(), OccupationDto.CURATED.equals(o.questionSet())));

        List<IndexableOccupationDto> out = new ArrayList<>();
        catalogService.updatedAtByCode().forEach((code, catalogUpdated) -> {
            Object[] row = stats.get(code);
            long approved = row == null ? 0 : ((Number) row[1]).longValue();
            if (!Boolean.TRUE.equals(curated.get(code)) && approved < MIN_APPROVED_FOR_REVIEWED) {
                return;
            }
            LocalDateTime last = latest(catalogUpdated, row == null ? null : (LocalDateTime) row[2]);
            out.add(new IndexableOccupationDto(code, last == null ? null : last.toLocalDate().toString()));
        });
        return List.copyOf(out);
    }

    private static LocalDateTime latest(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    OccupationDetailDto withLayer(OccupationDetailDto base) {
        String code = base.occupation().code();
        List<LayerQuestion> questions = questionRepository.findByOccupationCodeOrderByCreatedAtAscIdAsc(code).stream()
                .filter(q -> q.getStatus() != OccupationContentStatus.REJECTED)
                .filter(q -> InterviewPhase.HARD_SKILLS.name().equals(q.getPhase()))
                .sorted(Comparator.comparing(OccupationQuestion::getStatus, APPROVED_FIRST))
                .map(q -> new LayerQuestion(q.getQuestionDe(), q.getQuestionVi(), q.getQuestionEn(),
                        q.getDifficulty(), q.getStatus().name()))
                .toList();
        List<Term> terms = termRepository.findByOccupationCodeOrderByIdAsc(code).stream()
                .filter(t -> t.getStatus() != OccupationContentStatus.REJECTED)
                .sorted(Comparator.comparing(OccupationTerm::getStatus, APPROVED_FIRST))
                .map(t -> new Term(t.getTermDe(), t.getMeaningEn(), t.getMeaningVi(), t.getExampleDe(),
                        t.getStatus().name()))
                .toList();

        boolean curated = OccupationDto.CURATED.equals(base.occupation().questionSet());
        long approved = questions.stream()
                .filter(q -> OccupationContentStatus.APPROVED.name().equals(q.status())).count();
        boolean reviewed = curated || approved >= MIN_APPROVED_FOR_REVIEWED;
        List<SampleQuestion> samples = curated || questions.isEmpty()
                ? base.sampleQuestions()
                : layerSamples(base.sampleQuestions(), questions);

        return new OccupationDetailDto(base.occupation(), base.personaCode(), base.interviewPosition(),
                samples, reviewed, questions, terms);
    }

    /** Câu mở đầu chung (INTRO) + câu lớp nghề đầu tiên, ghi nguồn để client gắn nhãn. */
    private static List<SampleQuestion> layerSamples(List<SampleQuestion> bank, List<LayerQuestion> layer) {
        List<SampleQuestion> out = new ArrayList<>();
        bank.stream().filter(q -> InterviewPhase.INTRO.name().equals(q.phase())).findFirst().ifPresent(out::add);
        layer.stream().limit(SAMPLE_LAYER_QUESTIONS)
                .forEach(q -> out.add(new SampleQuestion(InterviewPhase.HARD_SKILLS.name(), q.questionDe(),
                        q.questionVi(), q.questionEn(), q.status())));
        return List.copyOf(out);
    }
}
