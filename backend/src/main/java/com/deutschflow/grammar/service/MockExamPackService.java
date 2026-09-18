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
     * Cổng gói ở ĐƯỜNG LÀM BÀI, không chỉ ở catalog: một đề thuộc bộ trả phí thì người gói miễn phí
     * không được mở nội dung đề kể cả khi gọi thẳng {@code examId}. Trước bản này chỉ
     * {@link #getPack} kiểm gói, còn {@code POST /{examId}/start} và {@code GET /{examId}/questions}
     * chỉ đòi đăng nhập — biết một id là làm được đề trả phí.
     *
     * <p>Quan hệ đề ↔ bộ vẫn là quan hệ suy ra theo {@code (cefr_level, exam_format)} như cả lớp này
     * đang dùng, nên không sinh bảng nối mới. Đề không thuộc bộ trả phí nào — kể cả đề không tồn tại
     * — thì cho qua: chuyện 404 là việc của đường gọi, cổng này không biến nó thành 403.
     */
    @Transactional(readOnly = true)
    public void assertExamUnlocked(Long userId, long examId) {
        Integer lockedPacks = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM mock_exam_packs p
                JOIN mock_exams e
                  ON e.cefr_level = p.cefr_level AND e.exam_format = p.exam_format
                WHERE e.id = ? AND e.is_active = TRUE
                  AND p.is_active = TRUE AND p.requires_paid = TRUE
                """, Integer.class, examId);
        if (lockedPacks == null || lockedPacks == 0) return;
        if (!isPaid(userId)) {
            throw new ForbiddenException("Nâng cấp gói để mở khoá bộ đề luyện thi này.");
        }
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
