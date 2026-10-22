package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDetailDto.SampleQuestion;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.entity.Occupation;
import com.deutschflow.interview.repository.OccupationRepository;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewQuestionBank;
import com.deutschflow.speaking.interview.InterviewQuestionDef;
import com.deutschflow.speaking.persona.SpeakingPersona;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Danh mục nghề công khai (đợt 2a A + B + E).
 *
 * <p>Danh mục nhỏ (~150 dòng) và hầu như không đổi, nên giữ một ảnh chụp trong bộ nhớ, làm mới sau
 * {@link #DEFAULT_TTL_NANOS}. Không dùng Spring cache: L2 Redis tuần tự hoá JSON không kèm kiểu,
 * đọc lại record sẽ lỗi ép kiểu ngoài {@code CacheErrorHandler}.
 *
 * <p>Câu hỏi mẫu lấy nguyên văn từ {@link InterviewQuestionBank} với đúng cặp nhân vật + vị trí mà
 * phiên phỏng vấn sẽ dùng — không gọi AI theo lượt xem.
 */
@Service
@Slf4j
public class OccupationCatalogService {

    static final long DEFAULT_TTL_NANOS = 10L * 60 * 1_000_000_000;
    /** Câu mở đầu + 2 câu chuyên môn — cùng số câu trang chủ đang hiện. */
    static final int SAMPLE_HARD_SKILLS = 2;

    private final OccupationRepository repository;
    private final long ttlNanos;

    private volatile Snapshot snapshot;

    @Autowired
    public OccupationCatalogService(OccupationRepository repository) {
        this(repository, DEFAULT_TTL_NANOS);
    }

    OccupationCatalogService(OccupationRepository repository, long ttlNanos) {
        this.repository = repository;
        this.ttlNanos = ttlNanos;
    }

    public List<OccupationDto> list() {
        return current().dtos();
    }

    public Optional<OccupationDetailDto> detail(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        Snapshot s = current();
        Occupation o = s.byCode().get(code.trim().toLowerCase(Locale.ROOT));
        if (o == null) {
            return Optional.empty();
        }
        SpeakingPersona persona = personaFor(o);
        String position = positionFor(o);
        // Lớp nghề và từ chuyên môn do OccupationPublicService ghép thêm (đợt 2d).
        return Optional.of(new OccupationDetailDto(
                toDto(o), persona.name(), position, sampleQuestions(persona, position),
                curatedPersona(o) != null, List.of(), List.of()));
    }

    /**
     * Nhân vật có bộ câu hỏi viết tay cho nghề; nghề dùng bộ chung nhận người tuyển dụng của nhóm
     * nơi làm việc (đợt 2c); không có nhóm hợp lệ thì DEFAULT.
     */
    static SpeakingPersona personaFor(Occupation o) {
        SpeakingPersona curated = curatedPersona(o);
        if (curated != null) {
            return curated;
        }
        return SpeakingPersona.forWorkplace(o.getWorkplace()).orElse(SpeakingPersona.DEFAULT);
    }

    /** Nhân vật cũ có bộ câu hỏi viết tay cho nghề, hoặc {@code null}. */
    private static SpeakingPersona curatedPersona(Occupation o) {
        if (o.getLegacyPersonaCode() != null) {
            try {
                return SpeakingPersona.valueOf(o.getLegacyPersonaCode());
            } catch (IllegalArgumentException e) {
                log.warn("occupation '{}' trỏ tới nhân vật không tồn tại '{}' — dùng bộ chung",
                        o.getCode(), o.getLegacyPersonaCode());
            }
        }
        return null;
    }

    /** Chuỗi vị trí gửi lên phiên: nhãn cũ nếu có (phiên cũ khớp lại được), không thì tên nghề. */
    static String positionFor(Occupation o) {
        return o.getLegacyPositionDe() != null ? o.getLegacyPositionDe() : o.getNameDe();
    }

    static List<SampleQuestion> sampleQuestions(SpeakingPersona persona, String position) {
        List<InterviewQuestionDef> bank = InterviewQuestionBank.forPersona(persona, position);
        List<SampleQuestion> out = new ArrayList<>();
        bank.stream().filter(q -> q.phase() == InterviewPhase.INTRO).findFirst()
                .ifPresent(q -> out.add(sample(q)));
        bank.stream().filter(q -> q.phase() == InterviewPhase.HARD_SKILLS).limit(SAMPLE_HARD_SKILLS)
                .forEach(q -> out.add(sample(q)));
        return List.copyOf(out);
    }

    private static SampleQuestion sample(InterviewQuestionDef q) {
        return new SampleQuestion(q.phase().name(), q.questionDe(), q.questionVi(), q.questionEn(),
                OccupationDetailDto.SOURCE_BANK);
    }

    private OccupationDto toDto(Occupation o) {
        boolean curated = curatedPersona(o) != null;
        return new OccupationDto(o.getCode(), o.getNameDe(), o.getNameEn(), o.getNameVi(), o.getWorkplace(),
                splitAliases(o.getAliases()), curated ? OccupationDto.CURATED : OccupationDto.GENERAL);
    }

    static List<String> splitAliases(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(a -> !a.isEmpty())
                .distinct()
                .toList();
    }

    private Snapshot current() {
        Snapshot s = snapshot;
        long now = System.nanoTime();
        if (s == null || now - s.loadedAt() > ttlNanos) {
            List<Occupation> rows = repository.findByActiveTrueOrderBySortRankAscCodeAsc();
            Map<String, Occupation> byCode = rows.stream()
                    .collect(Collectors.toUnmodifiableMap(Occupation::getCode, Function.identity()));
            s = new Snapshot(now, byCode, rows.stream().map(this::toDto).toList());
            snapshot = s;
        }
        return s;
    }

    private record Snapshot(long loadedAt, Map<String, Occupation> byCode, List<OccupationDto> dtos) {}
}
