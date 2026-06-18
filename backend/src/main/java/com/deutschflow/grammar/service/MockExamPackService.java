package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.grammar.dto.MockExamPackDetailDto;
import com.deutschflow.grammar.dto.MockExamPackDetailDto.PackExamDto;
import com.deutschflow.grammar.dto.MockExamPackDto;
import com.deutschflow.grammar.entity.MockExamPack;
import com.deutschflow.grammar.repository.MockExamPackRepository;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.gamification.coin.service.CoinService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Mock-exam packs (checklist D3): a curated, subscription-gated catalog over the existing mock
 * exams. A pack's exams are the active {@code mock_exams} matching its (cefrLevel, examFormat).
 * {@code requiresPaid} packs are locked for FREE users and unlocked by any paid plan — the "SKU"
 * is the subscription tier, not a per-pack purchase.
 */
@Service
@RequiredArgsConstructor
public class MockExamPackService {

    private static final String TIER_DEFAULT = "DEFAULT";

    private final MockExamPackRepository packRepository;
    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;
    private final CoinService coinService;

    @Transactional(readOnly = true)
    public List<MockExamPackDto> listPacks(Long userId) {
        boolean paid = isPaid(userId);
        // A pack the user holds a coin trial pass for is openable (one attempt) → report it unlocked so
        // the catalog and the reopen-after-reload path both behave. The pass is consumed at attempt-start.
        java.util.Set<Long> trialPackIds = coinService.activeTrialPackIds(userId);
        Map<String, Integer> examCounts = MockExamCounts.byLevelFormat(jdbcTemplate);
        return packRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .map(pack -> new MockExamPackDto(
                        pack.getId(), pack.getTitle(), pack.getDescriptionVi(),
                        pack.getCefrLevel(), pack.getExamFormat(),
                        examCounts.getOrDefault(MockExamCounts.key(pack.getCefrLevel(), pack.getExamFormat()), 0),
                        pack.isRequiresPaid(),
                        pack.isRequiresPaid() && !paid && !trialPackIds.contains(pack.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public MockExamPackDetailDto getPack(Long userId, Long packId) {
        MockExamPack pack = packRepository.findById(packId)
                .filter(MockExamPack::isActive)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ đề"));
        // PRO/ULTRA unlock permanently; a FREE user with an active coin trial pass may VIEW the pack
        // (the pass is consumed only at attempt-start, in MockExamController.startExam, then relocks).
        if (pack.isRequiresPaid() && !isPaid(userId) && !coinService.hasTrialPassFor(userId, packId)) {
            throw new ForbiddenException("Nâng cấp gói hoặc dùng xu để mở khoá bộ đề luyện thi này.");
        }
        return new MockExamPackDetailDto(
                pack.getId(), pack.getTitle(), pack.getDescriptionVi(),
                pack.getCefrLevel(), pack.getExamFormat(), examsOf(pack));
    }

    /**
     * The active pack a mock exam belongs to, matched by {@code (cefrLevel, examFormat)}. Used by the
     * exam-start gate to decide whether a coin trial pass is needed/consumable. Empty when the exam
     * is not part of any curated pack (then it is freely startable).
     */
    @Transactional(readOnly = true)
    public Optional<MockExamPack> findPackForExam(long examId) {
        List<Long> ids = jdbcTemplate.query("""
                SELECT p.id FROM mock_exam_packs p
                JOIN mock_exams e ON e.cefr_level = p.cefr_level AND e.exam_format = p.exam_format
                WHERE e.id = ? AND p.is_active = TRUE
                ORDER BY p.sort_order ASC, p.id ASC
                LIMIT 1
                """, (rs, n) -> rs.getLong(1), examId);
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return packRepository.findById(ids.get(0));
    }

    /**
     * Paid = public tier PRO or ULTRA (covers PRO/ULTRA/INTERNAL). FREE, DEFAULT (expired trial),
     * PREMIUM, and null all resolve to tier DEFAULT → locked. Uses the READ-ONLY snapshot so this
     * read-only path never triggers subscription-reconciliation writes (which would fail in a
     * readOnly transaction).
     */
    public boolean isPaid(Long userId) {
        QuotaSnapshot snapshot = quotaService.getSnapshotReadOnly(userId, Instant.now());
        String tier = snapshot == null ? null : QuotaService.publicTier(snapshot.planCode());
        return tier != null && !TIER_DEFAULT.equals(tier);
    }

    private List<PackExamDto> examsOf(MockExamPack pack) {
        return jdbcTemplate.query(
                "SELECT id, title, total_points, pass_points, time_limit_minutes FROM mock_exams "
                        + "WHERE cefr_level = ? AND exam_format = ? AND is_active = TRUE ORDER BY id",
                (rs, rowNum) -> new PackExamDto(
                        rs.getLong("id"),
                        rs.getString("title"),
                        (Integer) rs.getObject("total_points"),
                        (Integer) rs.getObject("pass_points"),
                        (Integer) rs.getObject("time_limit_minutes")),
                pack.getCefrLevel(), pack.getExamFormat());
    }
}
