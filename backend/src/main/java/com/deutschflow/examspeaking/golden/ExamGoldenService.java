package com.deutschflow.examspeaking.golden;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.ExamGradingService;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.entity.SpeakingExamGoldenRating;
import com.deutschflow.examspeaking.entity.SpeakingExamResult;
import com.deutschflow.examspeaking.entity.SpeakingExamTurn;
import com.deutschflow.examspeaking.repository.SpeakingExamGoldenRatingRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamResultRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamTurnRepository;
import com.deutschflow.examspeaking.scoring.BandScales;
import com.deutschflow.examspeaking.scoring.PassAssessment;
import com.deutschflow.examspeaking.scoring.RubricScorer;
import com.deutschflow.examspeaking.session.ExamSessionService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * G.1 Golden set — công cụ hiệu chuẩn chấm điểm (gate ra mắt, kế hoạch mục G):
 * giám khảo NGƯỜI chấm band từng tiêu chí của phiên mock; điểm người chấm do {@link RubricScorer}
 * tính lại từ band (cùng bảng quy điểm với máy) → so đồng thuận đạt/trượt và ±1 band.
 * Regrade chạy lại pipeline chấm trên transcript ĐÃ ĐÓNG BĂNG của phiên (không ghi đè kết quả lưu)
 * — nền cho regression harness khi đổi prompt/model.
 */
@Service
@RequiredArgsConstructor
public class ExamGoldenService {

    private static final int LIST_LIMIT = 200;

    private final SpeakingExamResultRepository resultRepository;
    private final SpeakingExamTurnRepository turnRepository;
    private final SpeakingExamGoldenRatingRepository ratingRepository;
    private final ExamBlueprintCatalog catalog;
    private final RubricScorer rubricScorer;
    private final ExamSessionService sessionService;
    private final ExamGradingService gradingService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // ── danh sách phiên ─────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<GoldenView.SessionRow> listSessions(String provider, String level) {
        List<SpeakingExamResult> results = filteredResults(provider, level);
        Map<Long, List<SpeakingExamGoldenRating>> ratings = ratingsBySession(results);
        Map<Long, String> raterNames = raterNames(ratings);
        return results.stream().map(r -> new GoldenView.SessionRow(
                r.getSessionId(), r.getProvider(), r.getLevel(), r.getCreatedAt(),
                num(r.getTotalPoints()), num(r.getMaxPoints()), r.getPassed(),
                ratings.getOrDefault(r.getSessionId(), List.of()).stream()
                        .map(SpeakingExamGoldenRating::getRaterUserId).distinct()
                        .map(id -> raterNames.getOrDefault(id, "#" + id)).toList()
        )).toList();
    }

    // ── phiếu chấm ──────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public GoldenView.Detail detail(long sessionId, long raterUserId) {
        SpeakingExamResult result = requireResult(sessionId);
        RubricDefinition rubric = rubric(result);
        Ergebnisbogen machine = machineSheet(result);
        List<GoldenView.TurnLine> turns = turnRepository.findBySessionIdOrderBySeqAsc(sessionId).stream()
                .map(t -> new GoldenView.TurnLine(t.getPartNo(), t.getRole(), t.getTranscript()))
                .toList();
        List<GoldenView.RatingRow> mine = ratingRepository.findBySessionIdAndRaterUserId(sessionId, raterUserId).stream()
                .map(g -> new GoldenView.RatingRow(g.getTeilNo(), g.getCriterionCode(), g.getBand()))
                .toList();
        return new GoldenView.Detail(sessionId, result.getProvider(), result.getLevel(), result.getCreatedAt(),
                structure(rubric), turns, summary(machine), bandsByKey(machine), mine);
    }

    @Transactional
    public GoldenView.SaveResult saveRatings(long raterUserId, long sessionId, List<GoldenView.RatingRow> input) {
        SpeakingExamResult result = requireResult(sessionId);
        RubricDefinition rubric = rubric(result);
        Set<String> validKeys = validKeys(rubric);
        List<SpeakingExamGoldenRating> rows = new ArrayList<>();
        for (GoldenView.RatingRow r : input == null ? List.<GoldenView.RatingRow>of() : input) {
            String key = key(r.teilNo(), r.criterionCode());
            if (!validKeys.contains(key)) {
                throw new BadRequestException("Tiêu chí không thuộc rubric: " + key);
            }
            String band = BandScales.normalize(rubric.scale(), r.band());
            if (band == null) {
                throw new BadRequestException("Band không hợp lệ cho thang " + rubric.scale() + ": " + r.band());
            }
            rows.add(SpeakingExamGoldenRating.builder()
                    .sessionId(sessionId).raterUserId(raterUserId)
                    .teilNo(r.teilNo()).criterionCode(r.criterionCode()).band(band)
                    .build());
        }
        // Phiếu = replace-all theo (phiên × giám khảo): sửa lại là ghi đè trọn, không merge lắt nhắt.
        ratingRepository.deleteBySessionIdAndRaterUserId(sessionId, raterUserId);
        ratingRepository.saveAll(rows);

        Ergebnisbogen machine = machineSheet(result);
        Ergebnisbogen human = scoreHuman(result, rubric, rows);
        return new GoldenView.SaveResult(summary(human), summary(machine),
                passAgree(machine.passed(), human.passed()),
                bandAgreement(bandsByKey(machine), bandsByKey(human), rubric.scale()));
    }

    // ── so sánh máy ↔ người ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public GoldenView.CompareReport compare(String provider, String level) {
        List<SpeakingExamResult> results = filteredResults(provider, level);
        Map<Long, List<SpeakingExamGoldenRating>> bySession = ratingsBySession(results);
        Map<Long, String> raterNames = raterNames(bySession);

        List<GoldenView.CompareRow> rows = new ArrayList<>();
        int passPairs = 0;
        int passAgree = 0;
        int bandPairs = 0;
        int bandExact = 0;
        int bandWithin1 = 0;
        Set<Long> ratedSessions = new java.util.HashSet<>();

        for (SpeakingExamResult result : results) {
            List<SpeakingExamGoldenRating> ratings = bySession.getOrDefault(result.getSessionId(), List.of());
            if (ratings.isEmpty()) {
                continue;
            }
            RubricDefinition rubric = rubric(result);
            Ergebnisbogen machine = machineSheet(result);
            Map<String, String> machineBands = bandsByKey(machine);
            Map<Long, List<SpeakingExamGoldenRating>> byRater = ratings.stream()
                    .collect(Collectors.groupingBy(SpeakingExamGoldenRating::getRaterUserId));
            for (Map.Entry<Long, List<SpeakingExamGoldenRating>> e : byRater.entrySet()) {
                Ergebnisbogen human = scoreHuman(result, rubric, e.getValue());
                GoldenView.AgreementStats stats = bandAgreement(machineBands, bandsByKey(human), rubric.scale());
                Boolean agree = passAgree(machine.passed(), human.passed());
                rows.add(new GoldenView.CompareRow(result.getSessionId(), result.getProvider(), result.getLevel(),
                        raterNames.getOrDefault(e.getKey(), "#" + e.getKey()),
                        summary(machine), summary(human), stats));
                ratedSessions.add(result.getSessionId());
                bandPairs += stats.pairs();
                bandExact += stats.exact();
                bandWithin1 += stats.within1();
                if (agree != null) {
                    passPairs++;
                    if (agree) {
                        passAgree++;
                    }
                }
            }
        }
        return new GoldenView.CompareReport(ratedSessions.size(), rows.size(),
                pct(passAgree, passPairs), pct(bandExact, bandPairs), pct(bandWithin1, bandPairs), rows);
    }

    /** CSV phẳng cho phân tích ngoài (một dòng = một tiêu chí × giám khảo). */
    @Transactional(readOnly = true)
    public String exportCsv(String provider, String level) {
        StringBuilder sb = new StringBuilder("session_id,provider,level,rater,key,machine_band,human_band,"
                + "machine_total,human_total,machine_passed,human_passed\n");
        List<SpeakingExamResult> results = filteredResults(provider, level);
        Map<Long, List<SpeakingExamGoldenRating>> bySession = ratingsBySession(results);
        Map<Long, String> names = raterNames(bySession);
        for (SpeakingExamResult result : results) {
            List<SpeakingExamGoldenRating> ratings = bySession.getOrDefault(result.getSessionId(), List.of());
            if (ratings.isEmpty()) {
                continue;
            }
            RubricDefinition rubric = rubric(result);
            Ergebnisbogen machine = machineSheet(result);
            Map<String, String> machineBands = bandsByKey(machine);
            for (Map.Entry<Long, List<SpeakingExamGoldenRating>> e : ratings.stream()
                    .collect(Collectors.groupingBy(SpeakingExamGoldenRating::getRaterUserId)).entrySet()) {
                Ergebnisbogen human = scoreHuman(result, rubric, e.getValue());
                Map<String, String> humanBands = e.getValue().stream().collect(Collectors.toMap(
                        g -> key(g.getTeilNo(), g.getCriterionCode()), SpeakingExamGoldenRating::getBand,
                        (a, b) -> a, LinkedHashMap::new));
                String rater = names.getOrDefault(e.getKey(), "#" + e.getKey());
                for (String k : validKeys(rubric)) {
                    sb.append(result.getSessionId()).append(',').append(result.getProvider()).append(',')
                            .append(result.getLevel()).append(',').append(csv(rater)).append(',').append(k).append(',')
                            .append(nvl(machineBands.get(k))).append(',').append(nvl(humanBands.get(k))).append(',')
                            .append(nvl(machine.total())).append(',').append(nvl(human.total())).append(',')
                            .append(nvl(machine.passed())).append(',').append(nvl(human.passed())).append('\n');
                }
            }
        }
        return sb.toString();
    }

    // ── regrade (regression harness) ────────────────────────────────────────────────────────

    /**
     * Chạy LẠI pipeline chấm trên transcript đã lưu của phiên — TỐN TOKEN LLM thật, chỉ dành cho
     * hiệu chuẩn/regression sau khi đổi prompt/model. Kết quả KHÔNG ghi đè {@code speaking_exam_results}.
     */
    @Transactional(readOnly = true)
    public GoldenView.RegradeResult regrade(long sessionId, long callerUserId) {
        SpeakingExamResult result = requireResult(sessionId);
        RubricDefinition rubric = rubric(result);
        Ergebnisbogen stored = machineSheet(result);
        ParticipantBundle bundle = sessionService.bundle(sessionId);
        Ergebnisbogen fresh = gradingService.grade(callerUserId, bundle, stored.rubricRef());

        Map<String, String> before = bandsByKey(stored);
        Map<String, String> after = bandsByKey(fresh);
        List<GoldenView.BandChange> changes = new ArrayList<>();
        for (String k : validKeys(rubric)) {
            String b = before.get(k);
            String a = after.get(k);
            if (!java.util.Objects.equals(b, a)) {
                changes.add(new GoldenView.BandChange(k, b, a));
            }
        }
        Map<Long, String> raterNames = raterNames(Map.of(sessionId, ratingRepository.findBySessionId(sessionId)));
        List<GoldenView.CompareRow> humanRows = ratingRepository.findBySessionId(sessionId).stream()
                .collect(Collectors.groupingBy(SpeakingExamGoldenRating::getRaterUserId)).entrySet().stream()
                .map(e -> {
                    Ergebnisbogen human = scoreHuman(result, rubric, e.getValue());
                    return new GoldenView.CompareRow(sessionId, result.getProvider(), result.getLevel(),
                            raterNames.getOrDefault(e.getKey(), "#" + e.getKey()),
                            summary(fresh), summary(human),
                            bandAgreement(after, bandsByKey(human), rubric.scale()));
                }).toList();
        return new GoldenView.RegradeResult(sessionId, summary(stored), summary(fresh),
                round2(fresh.total() - stored.total()),
                !java.util.Objects.equals(stored.passed(), fresh.passed()),
                changes, humanRows);
    }

    // ── lõi tính toán ───────────────────────────────────────────────────────────────────────

    /** Điểm của giám khảo người: build PassAssessment từ band tay → cùng RubricScorer với máy. */
    Ergebnisbogen scoreHuman(SpeakingExamResult result, RubricDefinition rubric, List<SpeakingExamGoldenRating> ratings) {
        Map<Integer, Map<String, PassAssessment.CriterionAssessment>> byTeil = new HashMap<>();
        Map<String, PassAssessment.CriterionAssessment> global = new HashMap<>();
        for (SpeakingExamGoldenRating g : ratings) {
            PassAssessment.CriterionAssessment ca = new PassAssessment.CriterionAssessment(
                    g.getBand(), true, "high", List.of("Giám khảo người"));
            if (g.getTeilNo() == SpeakingExamGoldenRating.TEIL_GLOBAL) {
                global.put(g.getCriterionCode(), ca);
            } else {
                byTeil.computeIfAbsent(g.getTeilNo(), k -> new HashMap<>()).put(g.getCriterionCode(), ca);
            }
        }
        Map<Integer, PassAssessment.PartAssessment> parts = new HashMap<>();
        boolean vhn = rubric.scale() == RubricDefinition.BandScale.VHN;
        for (RubricDefinition.RubricPart rp : rubric.parts()) {
            Map<String, PassAssessment.CriterionAssessment> m = byTeil.getOrDefault(rp.teilNo(), Map.of());
            parts.put(rp.teilNo(), vhn
                    ? new PassAssessment.PartAssessment(rp.teilNo(), m, Map.of())
                    : new PassAssessment.PartAssessment(rp.teilNo(), Map.of(), m));
        }
        Ergebnisbogen machine = machineSheet(result);
        return rubricScorer.score(machine.rubricRef(), rubric, new PassAssessment(parts, global, List.of(), List.of()));
    }

    static GoldenView.AgreementStats bandAgreement(Map<String, String> machine, Map<String, String> human,
                                                   RubricDefinition.BandScale scale) {
        int pairs = 0;
        int exact = 0;
        int within1 = 0;
        for (Map.Entry<String, String> e : human.entrySet()) {
            String m = machine.get(e.getKey());
            if (m == null || e.getValue() == null) {
                continue;
            }
            int diff = Math.abs(BandScales.index(scale, m) - BandScales.index(scale, e.getValue()));
            pairs++;
            if (diff == 0) {
                exact++;
            }
            if (diff <= 1) {
                within1++;
            }
        }
        return new GoldenView.AgreementStats(pairs, exact, within1);
    }

    static Boolean passAgree(Boolean machine, Boolean human) {
        return machine == null || human == null ? null : machine.equals(human);
    }

    /** Band theo khoá "T{teil}:{code}" / "G:{code}" — chỉ tiêu chí ĐÃ CHẤM (scored). */
    static Map<String, String> bandsByKey(Ergebnisbogen sheet) {
        Map<String, String> out = new LinkedHashMap<>();
        for (Ergebnisbogen.PartResult p : sheet.parts()) {
            for (Ergebnisbogen.CriterionResult c : p.criteria()) {
                if (c.scored() && c.band() != null) {
                    out.put(key(p.teilNo(), c.code()), c.band());
                }
            }
        }
        for (Ergebnisbogen.CriterionResult c : sheet.global()) {
            if (c.scored() && c.band() != null) {
                out.put(key(SpeakingExamGoldenRating.TEIL_GLOBAL, c.code()), c.band());
            }
        }
        return out;
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    private List<SpeakingExamResult> filteredResults(String provider, String level) {
        String pv = provider == null || provider.isBlank() ? null : ExamProvider.fromApi(provider).name();
        String lv = level == null || level.isBlank() ? null : level.trim().toUpperCase(Locale.ROOT);
        if (pv != null && lv != null) {
            return resultRepository.findTop200ByProviderAndLevelOrderByCreatedAtDesc(pv, lv);
        }
        return resultRepository.findTop200ByOrderByCreatedAtDesc().stream()
                .filter(r -> pv == null || pv.equals(r.getProvider()))
                .filter(r -> lv == null || lv.equals(r.getLevel()))
                .limit(LIST_LIMIT)
                .toList();
    }

    private SpeakingExamResult requireResult(long sessionId) {
        return resultRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new NotFoundException("Phiên " + sessionId + " chưa có kết quả máy"));
    }

    private RubricDefinition rubric(SpeakingExamResult result) {
        return catalog.find(ExamProvider.valueOf(result.getProvider()), result.getLevel())
                .map(ExamBlueprint::rubric)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy blueprint " + result.getProvider() + " " + result.getLevel()));
    }

    private Ergebnisbogen machineSheet(SpeakingExamResult result) {
        return objectMapper.convertValue(result.getScoreSheetJson(), Ergebnisbogen.class);
    }

    private Map<Long, List<SpeakingExamGoldenRating>> ratingsBySession(List<SpeakingExamResult> results) {
        List<Long> ids = results.stream().map(SpeakingExamResult::getSessionId).toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return ratingRepository.findBySessionIdIn(ids).stream()
                .collect(Collectors.groupingBy(SpeakingExamGoldenRating::getSessionId));
    }

    private Map<Long, String> raterNames(Map<Long, List<SpeakingExamGoldenRating>> bySession) {
        Set<Long> ids = bySession.values().stream().flatMap(List::stream)
                .map(SpeakingExamGoldenRating::getRaterUserId).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getDisplayName() == null ? "#" + u.getId() : u.getDisplayName()));
    }

    private static GoldenView.Summary summary(Ergebnisbogen sheet) {
        return new GoldenView.Summary(sheet.total(), sheet.maxPoints(), sheet.passed());
    }

    static Set<String> validKeys(RubricDefinition rubric) {
        Set<String> keys = new java.util.LinkedHashSet<>();
        for (RubricDefinition.RubricPart rp : rubric.parts()) {
            rp.criteria().forEach(c -> keys.add(key(rp.teilNo(), c.code())));
            rp.items().forEach(it -> keys.add(key(rp.teilNo(), it.code())));
        }
        rubric.global().forEach(c -> keys.add(key(SpeakingExamGoldenRating.TEIL_GLOBAL, c.code())));
        return keys;
    }

    static GoldenView.SheetStructure structure(RubricDefinition rubric) {
        List<GoldenView.SheetPart> parts = rubric.parts().stream().map(rp -> {
            List<GoldenView.SheetCriterion> cs = new ArrayList<>();
            rp.criteria().forEach(c -> cs.add(new GoldenView.SheetCriterion(c.code(), c.label(), c.max(), false)));
            rp.items().forEach(it -> cs.add(new GoldenView.SheetCriterion(it.code(), it.label(), it.max(), true)));
            return new GoldenView.SheetPart(rp.teilNo(), cs);
        }).toList();
        List<GoldenView.SheetCriterion> global = rubric.global().stream()
                .map(c -> new GoldenView.SheetCriterion(c.code(), c.label(), c.max(), false)).toList();
        return new GoldenView.SheetStructure(rubric.scale().name(), BandScales.bands(rubric.scale()), parts, global);
    }

    static String key(int teilNo, String code) {
        return teilNo == SpeakingExamGoldenRating.TEIL_GLOBAL ? "G:" + code : "T" + teilNo + ":" + code;
    }

    private static Double num(BigDecimal v) {
        return v == null ? null : v.doubleValue();
    }

    private static Double pct(int hit, int n) {
        return n == 0 ? null : round2(hit * 100.0 / n);
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, java.math.RoundingMode.HALF_UP).doubleValue();
    }

    private static String nvl(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static String csv(String v) {
        return v == null ? "" : '"' + v.replace("\"", "\"\"") + '"';
    }
}
