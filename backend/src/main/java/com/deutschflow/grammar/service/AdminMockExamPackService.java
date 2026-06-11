package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.CreateMockExamPackRequest;
import com.deutschflow.grammar.dto.MockExamPackAdminDto;
import com.deutschflow.grammar.dto.UpdateMockExamPackRequest;
import com.deutschflow.grammar.entity.MockExamPack;
import com.deutschflow.grammar.repository.MockExamPackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * ADMIN curation of mock-exam packs ({@code /api/admin/mock-exam-packs}) — lets admins create,
 * edit, and retire packs without raw SQL. Mirrors the thin-service style of {@code AdminOrgService}.
 *
 * <p>A pack only exposes exams to students once it resolves to ≥1 active {@code mock_exam} of its
 * (cefrLevel, examFormat); the {@code examCount} on each row makes empty packs visible to the curator.
 */
@Service
@RequiredArgsConstructor
public class AdminMockExamPackService {

    private static final String DEFAULT_FORMAT = "GOETHE";
    private static final int MAX_TITLE = 200;
    private static final int MAX_LEVEL = 5;
    private static final int MAX_FORMAT = 30;

    private final MockExamPackRepository packRepository;
    private final JdbcTemplate jdbcTemplate;

    /** All packs (active + inactive) in curation order, each with its live exam count. */
    @Transactional(readOnly = true)
    public List<MockExamPackAdminDto> list() {
        Map<String, Integer> counts = MockExamCounts.byLevelFormat(jdbcTemplate);
        return packRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(pack -> toAdminDto(pack, counts))
                .toList();
    }

    @Transactional
    public MockExamPackAdminDto create(CreateMockExamPackRequest request) {
        MockExamPack pack = MockExamPack.builder()
                .title(requireText(request.title(), "Tiêu đề bộ đề là bắt buộc"))
                .descriptionVi(trimToNull(request.descriptionVi()))
                .cefrLevel(requireLevel(request.cefrLevel()))
                .examFormat(normalizeFormat(request.examFormat()))
                .requiresPaid(request.requiresPaid() == null || request.requiresPaid())
                .active(true)
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .build();
        pack = packRepository.save(pack);
        return toAdminDto(pack, MockExamCounts.byLevelFormat(jdbcTemplate));
    }

    /** Partial update — only non-null fields are applied. */
    @Transactional
    public MockExamPackAdminDto update(Long id, UpdateMockExamPackRequest request) {
        MockExamPack pack = packRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ đề: " + id));
        if (request.title() != null) {
            pack.setTitle(requireText(request.title(), "Tiêu đề bộ đề không được để trống"));
        }
        if (request.descriptionVi() != null) {
            pack.setDescriptionVi(trimToNull(request.descriptionVi()));
        }
        if (request.cefrLevel() != null) {
            pack.setCefrLevel(requireLevel(request.cefrLevel()));
        }
        if (request.examFormat() != null) {
            if (request.examFormat().isBlank()) {
                throw new BadRequestException("Định dạng đề không được để trống");
            }
            pack.setExamFormat(normalizeFormat(request.examFormat()));
        }
        if (request.requiresPaid() != null) {
            pack.setRequiresPaid(request.requiresPaid());
        }
        if (request.active() != null) {
            pack.setActive(request.active());
        }
        if (request.sortOrder() != null) {
            pack.setSortOrder(request.sortOrder());
        }
        pack = packRepository.save(pack);
        return toAdminDto(pack, MockExamCounts.byLevelFormat(jdbcTemplate));
    }

    /** Soft-delete: retires a pack from the student catalog (re-publish via update active=true). */
    @Transactional
    public MockExamPackAdminDto deactivate(Long id) {
        MockExamPack pack = packRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ đề: " + id));
        pack.setActive(false);
        pack = packRepository.save(pack);
        return toAdminDto(pack, MockExamCounts.byLevelFormat(jdbcTemplate));
    }

    private MockExamPackAdminDto toAdminDto(MockExamPack pack, Map<String, Integer> counts) {
        return new MockExamPackAdminDto(
                pack.getId(), pack.getTitle(), pack.getDescriptionVi(),
                pack.getCefrLevel(), pack.getExamFormat(),
                pack.isRequiresPaid(), pack.isActive(), pack.getSortOrder(),
                counts.getOrDefault(MockExamCounts.key(pack.getCefrLevel(), pack.getExamFormat()), 0),
                pack.getCreatedAt());
    }

    private static String requireText(String raw, String blankMessage) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException(blankMessage);
        }
        String value = raw.trim();
        if (value.length() > MAX_TITLE) {
            throw new BadRequestException("Tiêu đề tối đa " + MAX_TITLE + " ký tự");
        }
        return value;
    }

    private static String requireLevel(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Trình độ (CEFR) là bắt buộc");
        }
        String value = raw.trim().toUpperCase();
        if (value.length() > MAX_LEVEL) {
            throw new BadRequestException("Trình độ CEFR tối đa " + MAX_LEVEL + " ký tự");
        }
        return value;
    }

    /** Normalizes the exam format (uppercased); null/blank → {@value #DEFAULT_FORMAT}. */
    private static String normalizeFormat(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT_FORMAT;
        }
        String value = raw.trim().toUpperCase();
        if (value.length() > MAX_FORMAT) {
            throw new BadRequestException("Định dạng đề tối đa " + MAX_FORMAT + " ký tự");
        }
        return value;
    }

    private static String trimToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim();
        return value.isEmpty() ? null : value;
    }
}
