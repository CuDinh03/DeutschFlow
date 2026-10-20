package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDetailDto.LayerQuestion;
import com.deutschflow.interview.dto.OccupationDetailDto.SampleQuestion;
import com.deutschflow.interview.dto.OccupationDetailDto.Term;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import com.deutschflow.speaking.interview.InterviewPhase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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

    OccupationDetailDto withLayer(OccupationDetailDto base) {
        String code = base.occupation().code();
        List<LayerQuestion> questions = questionRepository.findByOccupationCodeOrderByCreatedAtAscIdAsc(code).stream()
                .filter(q -> q.getStatus() != OccupationContentStatus.REJECTED)
                .filter(q -> InterviewPhase.HARD_SKILLS.name().equals(q.getPhase()))
                .sorted(Comparator.comparing(OccupationQuestion::getStatus, APPROVED_FIRST))
                .map(q -> new LayerQuestion(q.getQuestionDe(), q.getDifficulty(), q.getStatus().name()))
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
                .forEach(q -> out.add(new SampleQuestion(InterviewPhase.HARD_SKILLS.name(), q.questionDe(), q.status())));
        return List.copyOf(out);
    }
}
