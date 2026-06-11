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
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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

    @Transactional(readOnly = true)
    public List<MockExamPackDto> listPacks(Long userId) {
        boolean paid = isPaid(userId);
        Map<String, Integer> examCounts = MockExamCounts.byLevelFormat(jdbcTemplate);
        return packRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .map(pack -> new MockExamPackDto(
                        pack.getId(), pack.getTitle(), pack.getDescriptionVi(),
                        pack.getCefrLevel(), pack.getExamFormat(),
                        examCounts.getOrDefault(MockExamCounts.key(pack.getCefrLevel(), pack.getExamFormat()), 0),
                        pack.isRequiresPaid(), pack.isRequiresPaid() && !paid))
                .toList();
    }

    @Transactional(readOnly = true)
    public MockExamPackDetailDto getPack(Long userId, Long packId) {
        MockExamPack pack = packRepository.findById(packId)
                .filter(MockExamPack::isActive)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ đề"));
        if (pack.isRequiresPaid() && !isPaid(userId)) {
            throw new ForbiddenException("Nâng cấp gói để mở khoá bộ đề luyện thi này.");
        }
        return new MockExamPackDetailDto(
                pack.getId(), pack.getTitle(), pack.getDescriptionVi(),
                pack.getCefrLevel(), pack.getExamFormat(), examsOf(pack));
    }

    /**
     * Paid = public tier PRO or ULTRA (covers PRO/ULTRA/INTERNAL). FREE, DEFAULT (expired trial),
     * PREMIUM, and null all resolve to tier DEFAULT → locked. Uses the READ-ONLY snapshot so this
     * read-only path never triggers subscription-reconciliation writes (which would fail in a
     * readOnly transaction).
     */
    private boolean isPaid(Long userId) {
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
