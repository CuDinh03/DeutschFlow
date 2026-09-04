package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.*;
import com.deutschflow.organization.entity.CurriculumItem;
import com.deutschflow.organization.entity.CurriculumLektion;
import com.deutschflow.organization.entity.CurriculumObjective;
import com.deutschflow.organization.entity.OrgCurriculum;
import com.deutschflow.organization.entity.OrgCurriculumVersion;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.CurriculumItemRepository;
import com.deutschflow.organization.repository.CurriculumLektionRepository;
import com.deutschflow.organization.repository.CurriculumObjectiveRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Soạn thảo + vòng đời giáo trình trung tâm (PR-1, quyết định P03).
 *
 * <p>Quy tắc bất biến: chỉ phiên bản {@code DRAFT} được sửa nội dung; {@code PUBLISHED} là bất
 * biến — muốn sửa phải tạo phiên bản DRAFT mới (spec §2.1: sửa mẫu chung không được âm thầm thay
 * đổi nội dung của lớp đang học). Quyền org-admin được kiểm ở controller
 * ({@code requireOrgAdmin}); service này chỉ kiểm chủ quyền dữ liệu theo {@code orgId}.
 */
@Service
@RequiredArgsConstructor
public class OrgCurriculumService {

    private static final Set<String> CEFR_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final Set<String> SKILL_TAGS = Set.of("HOEREN", "LESEN", "SCHREIBEN", "SPRECHEN");
    private static final Set<String> CONTENT_TAGS =
            Set.of("WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "LANDESKUNDE", "REDEMITTEL", "STRATEGIE");

    private static final int NAME_MAX = 300;
    private static final int TITLE_MAX = 500;
    private static final int TEXT_MAX = 4000;
    private static final int MAX_LEKTIONEN = 100;
    private static final int MAX_ITEMS_PER_LEKTION = 100;
    private static final int MAX_OBJECTIVES_PER_LEKTION = 100;

    private final OrgCurriculumRepository curriculumRepo;
    private final OrgCurriculumVersionRepository versionRepo;
    private final CurriculumLektionRepository lektionRepo;
    private final CurriculumItemRepository itemRepo;
    private final CurriculumObjectiveRepository objectiveRepo;
    private final ClassCurriculumLinkRepository linkRepo;

    // ── Bộ giáo trình ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrgCurriculumSummaryDto> listForOrg(Long orgId) {
        List<OrgCurriculum> curricula = curriculumRepo.findByOrgIdOrderByCreatedAtDesc(orgId);
        if (curricula.isEmpty()) return List.of();
        List<Long> ids = curricula.stream().map(OrgCurriculum::getId).toList();
        Map<Long, List<OrgCurriculumVersion>> versionsByCurriculum =
                versionRepo.findByCurriculumIdInOrderByCurriculumIdAscVersionNoDesc(ids).stream()
                        .collect(Collectors.groupingBy(OrgCurriculumVersion::getCurriculumId));
        return curricula.stream()
                .map(c -> new OrgCurriculumSummaryDto(
                        c.getId(), c.getName(), c.getCefrLevel(), c.getDescription(), c.isSample(),
                        c.getCreatedAt(),
                        versionsByCurriculum.getOrDefault(c.getId(), List.of()).stream()
                                .map(this::versionSummary)
                                .toList()))
                .toList();
    }

    @Transactional
    public OrgCurriculumSummaryDto create(Long userId, Long orgId, CreateCurriculumRequest req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new BadRequestException("Tên bộ giáo trình không được để trống");
        }
        OrgCurriculum curriculum = curriculumRepo.save(OrgCurriculum.builder()
                .orgId(orgId)
                .name(truncateName(req.name()))
                .cefrLevel(normalizeCefr(req.cefrLevel()))
                .description(req.description())
                .createdBy(userId)
                .build());
        OrgCurriculumVersion v1 = versionRepo.save(OrgCurriculumVersion.builder()
                .curriculumId(curriculum.getId())
                .versionNo(1)
                .status(OrgCurriculumVersion.STATUS_DRAFT)
                .build());
        return new OrgCurriculumSummaryDto(curriculum.getId(), curriculum.getName(),
                curriculum.getCefrLevel(), curriculum.getDescription(), curriculum.isSample(),
                curriculum.getCreatedAt(), List.of(versionSummary(v1)));
    }

    @Transactional
    public void updateMeta(Long orgId, Long curriculumId, UpdateCurriculumRequest req) {
        OrgCurriculum curriculum = loadCurriculum(orgId, curriculumId);
        if (req == null) throw new BadRequestException("Request body trống");
        if (req.name() != null && !req.name().isBlank()) {
            curriculum.setName(truncateName(req.name()));
        }
        if (req.cefrLevel() != null && !req.cefrLevel().isBlank()) {
            curriculum.setCefrLevel(normalizeCefr(req.cefrLevel()));
        }
        if (req.description() != null) {
            curriculum.setDescription(req.description());
        }
        curriculumRepo.save(curriculum);
    }

    /** Xoá bộ giáo trình — chỉ khi KHÔNG còn lớp nào gắn bất kỳ phiên bản nào (FE bắt buộc ConfirmDialog). */
    @Transactional
    public void delete(Long orgId, Long curriculumId) {
        OrgCurriculum curriculum = loadCurriculum(orgId, curriculumId);
        List<Long> versionIds = versionRepo.findByCurriculumIdOrderByVersionNoDesc(curriculumId)
                .stream().map(OrgCurriculumVersion::getId).toList();
        if (!versionIds.isEmpty() && linkRepo.existsByVersionIdIn(versionIds)) {
            throw new ConflictException("Không thể xoá: còn lớp đang dùng giáo trình này. Hãy gỡ giáo trình khỏi các lớp trước.");
        }
        curriculumRepo.delete(curriculum); // cascade DB xoá versions → lektionen → items/objectives
    }

    // ── Phiên bản ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CurriculumVersionDetailDto getVersionDetail(Long orgId, Long versionId) {
        OrgCurriculumVersion version = loadVersion(orgId, versionId);
        OrgCurriculum curriculum = loadCurriculum(orgId, version.getCurriculumId());
        List<CurriculumLektion> lektionen = lektionRepo.findByVersionIdOrderByOrderIndexAsc(versionId);
        List<Long> lektionIds = lektionen.stream().map(CurriculumLektion::getId).toList();
        Map<Long, List<CurriculumItem>> itemsByLektion = lektionIds.isEmpty() ? Map.of()
                : itemRepo.findByLektionIdInOrderByLektionIdAscOrderIndexAsc(lektionIds).stream()
                        .collect(Collectors.groupingBy(CurriculumItem::getLektionId));
        Map<Long, List<CurriculumObjective>> objectivesByLektion = lektionIds.isEmpty() ? Map.of()
                : objectiveRepo.findByLektionIdInOrderByLektionIdAscOrderIndexAsc(lektionIds).stream()
                        .collect(Collectors.groupingBy(CurriculumObjective::getLektionId));
        List<CurriculumLektionDto> lektionDtos = lektionen.stream()
                .map(l -> lektionDto(l,
                        itemsByLektion.getOrDefault(l.getId(), List.of()),
                        objectivesByLektion.getOrDefault(l.getId(), List.of())))
                .toList();
        return new CurriculumVersionDetailDto(version.getId(), curriculum.getId(), curriculum.getName(),
                curriculum.getCefrLevel(), version.getVersionNo(), version.getStatus(),
                version.getSourceNote(), version.getPublishedAt(),
                linkRepo.countByVersionId(versionId), lektionDtos);
    }

    /** Tạo bản DRAFT mới (sao chép nội dung từ sourceVersionId, mặc định bản mới nhất). Mỗi bộ chỉ 1 DRAFT. */
    @Transactional
    public CurriculumVersionDetailDto createVersion(Long orgId, Long curriculumId, CreateVersionRequest req) {
        loadCurriculum(orgId, curriculumId);
        List<OrgCurriculumVersion> versions = versionRepo.findByCurriculumIdOrderByVersionNoDesc(curriculumId);
        boolean hasDraft = versions.stream()
                .anyMatch(v -> OrgCurriculumVersion.STATUS_DRAFT.equals(v.getStatus()));
        if (hasDraft) {
            throw new ConflictException("Bộ giáo trình đã có bản nháp — hãy hoàn thiện hoặc xoá bản nháp đó trước");
        }
        Long sourceId = req == null ? null : req.sourceVersionId();
        OrgCurriculumVersion source = null;
        if (sourceId != null) {
            source = versions.stream().filter(v -> v.getId().equals(sourceId)).findFirst()
                    .orElseThrow(() -> new BadRequestException("Phiên bản nguồn không thuộc bộ giáo trình này"));
        } else if (!versions.isEmpty()) {
            source = versions.get(0); // versionNo lớn nhất
        }

        OrgCurriculumVersion draft = versionRepo.save(OrgCurriculumVersion.builder()
                .curriculumId(curriculumId)
                .versionNo(versionRepo.findMaxVersionNo(curriculumId) + 1)
                .status(OrgCurriculumVersion.STATUS_DRAFT)
                .build());
        if (source != null) {
            copyContent(source.getId(), draft.getId());
        }
        return getVersionDetail(orgId, draft.getId());
    }

    /** DRAFT → PUBLISHED. Yêu cầu ≥1 Lektion và mỗi Lektion ≥1 mục bắt buộc (giáo trình rỗng không công bố). */
    @Transactional
    public void publish(Long userId, Long orgId, Long versionId) {
        OrgCurriculumVersion version = loadVersion(orgId, versionId);
        if (!OrgCurriculumVersion.STATUS_DRAFT.equals(version.getStatus())) {
            throw new ConflictException("Chỉ bản nháp mới công bố được");
        }
        List<CurriculumLektion> lektionen = lektionRepo.findByVersionIdOrderByOrderIndexAsc(versionId);
        if (lektionen.isEmpty()) {
            throw new BadRequestException("Không thể công bố giáo trình chưa có Lektion nào");
        }
        for (CurriculumLektion lektion : lektionen) {
            if (itemRepo.countByLektionId(lektion.getId()) == 0) {
                throw new BadRequestException(
                        "Lektion \"" + lektion.getTitle() + "\" chưa có mục nội dung bắt buộc nào — bổ sung trước khi công bố");
            }
        }
        version.setStatus(OrgCurriculumVersion.STATUS_PUBLISHED);
        version.setPublishedBy(userId);
        version.setPublishedAt(java.time.LocalDateTime.now());
        versionRepo.save(version);
    }

    /** PUBLISHED → ARCHIVED: không gán mới; lớp đang gắn giữ nguyên. */
    @Transactional
    public void archive(Long orgId, Long versionId) {
        OrgCurriculumVersion version = loadVersion(orgId, versionId);
        if (!OrgCurriculumVersion.STATUS_PUBLISHED.equals(version.getStatus())) {
            throw new ConflictException("Chỉ phiên bản đã công bố mới lưu trữ được");
        }
        version.setStatus(OrgCurriculumVersion.STATUS_ARCHIVED);
        versionRepo.save(version);
    }

    /** Xoá phiên bản — chỉ DRAFT (PUBLISHED/ARCHIVED là lịch sử, giữ nguyên). */
    @Transactional
    public void deleteVersion(Long orgId, Long versionId) {
        OrgCurriculumVersion version = loadVersion(orgId, versionId);
        if (!OrgCurriculumVersion.STATUS_DRAFT.equals(version.getStatus())) {
            throw new ConflictException("Chỉ xoá được bản nháp; phiên bản đã công bố là lịch sử bất biến");
        }
        versionRepo.delete(version); // cascade DB xoá lektionen → items/objectives
    }

    // ── Lektion (chỉ bản DRAFT) ──────────────────────────────────────────────

    @Transactional
    public CurriculumLektionDto addLektion(Long orgId, Long versionId, UpsertLektionRequest req) {
        OrgCurriculumVersion version = loadDraft(orgId, versionId);
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("Tiêu đề Lektion không được để trống");
        }
        if (lektionRepo.countByVersionId(versionId) >= MAX_LEKTIONEN) {
            throw new BadRequestException("Một phiên bản tối đa " + MAX_LEKTIONEN + " Lektion");
        }
        CurriculumLektion lektion = lektionRepo.save(CurriculumLektion.builder()
                .versionId(version.getId())
                .orderIndex(lektionRepo.findMaxOrderIndex(versionId) + 1)
                .title(truncateTitle(req.title()))
                .description(req.description())
                .build());
        return lektionDto(lektion, List.of(), List.of());
    }

    @Transactional
    public CurriculumLektionDto updateLektion(Long orgId, Long lektionId, UpsertLektionRequest req) {
        CurriculumLektion lektion = loadDraftLektion(orgId, lektionId);
        if (req == null) throw new BadRequestException("Request body trống");
        if (req.title() != null && !req.title().isBlank()) {
            lektion.setTitle(truncateTitle(req.title()));
        }
        if (req.description() != null) {
            lektion.setDescription(req.description());
        }
        CurriculumLektion saved = lektionRepo.save(lektion);
        return lektionDto(saved,
                itemRepo.findByLektionIdOrderByOrderIndexAsc(lektionId),
                objectiveRepo.findByLektionIdOrderByOrderIndexAsc(lektionId));
    }

    @Transactional
    public void deleteLektion(Long orgId, Long lektionId) {
        CurriculumLektion lektion = loadDraftLektion(orgId, lektionId);
        lektionRepo.delete(lektion); // cascade DB xoá items/objectives; DRAFT chưa thể có lớp tham chiếu
    }

    @Transactional
    public List<CurriculumLektionDto> reorderLektionen(Long orgId, Long versionId, ReorderLektionenRequest req) {
        loadDraft(orgId, versionId);
        if (req == null || req.orderedLektionIds() == null || req.orderedLektionIds().isEmpty()) {
            throw new BadRequestException("Danh sách thứ tự không được trống");
        }
        List<CurriculumLektion> existing = lektionRepo.findByVersionIdOrderByOrderIndexAsc(versionId);
        Map<Long, CurriculumLektion> byId = new HashMap<>();
        existing.forEach(l -> byId.put(l.getId(), l));
        List<Long> ordered = req.orderedLektionIds();
        if (ordered.size() != existing.size()
                || new HashSet<>(ordered).size() != ordered.size()
                || !byId.keySet().containsAll(ordered)) {
            throw new BadRequestException("Danh sách Lektion không khớp với phiên bản");
        }
        for (int i = 0; i < ordered.size(); i++) {
            CurriculumLektion l = byId.get(ordered.get(i));
            if (!Objects.equals(l.getOrderIndex(), i)) {
                l.setOrderIndex(i);
                lektionRepo.save(l);
            }
        }
        return getVersionDetail(orgId, versionId).lektionen();
    }

    // ── Items / Objectives (chỉ bản DRAFT) ───────────────────────────────────

    @Transactional
    public List<CurriculumItemDto> replaceItems(Long orgId, Long lektionId, ReplaceItemsRequest req) {
        loadDraftLektion(orgId, lektionId);
        List<CurriculumItemInput> inputs = req == null || req.items() == null ? List.of() : req.items();
        if (inputs.size() > MAX_ITEMS_PER_LEKTION) {
            throw new BadRequestException("Một Lektion tối đa " + MAX_ITEMS_PER_LEKTION + " mục nội dung");
        }
        itemRepo.deleteByLektionId(lektionId);
        List<CurriculumItem> rows = new ArrayList<>();
        int idx = 0;
        for (CurriculumItemInput in : inputs) {
            if (in == null) continue;
            String text = in.text() == null ? "" : in.text().trim();
            if (text.isEmpty()) continue;
            rows.add(CurriculumItem.builder()
                    .lektionId(lektionId)
                    .orderIndex(idx++)
                    .text(truncateText(text))
                    .skillTag(normalizeSkill(in.skillTag()))
                    .contentTag(normalizeContent(in.contentTag()))
                    .estimatedMinutes(validateMinutes(in.estimatedMinutes()))
                    .build());
        }
        if (!rows.isEmpty()) itemRepo.saveAll(rows);
        return rows.stream().map(OrgCurriculumService::itemDto).toList();
    }

    @Transactional
    public List<CurriculumObjectiveDto> replaceObjectives(Long orgId, Long lektionId, ReplaceObjectivesRequest req) {
        loadDraftLektion(orgId, lektionId);
        List<CurriculumObjectiveInput> inputs = req == null || req.objectives() == null ? List.of() : req.objectives();
        if (inputs.size() > MAX_OBJECTIVES_PER_LEKTION) {
            throw new BadRequestException("Một Lektion tối đa " + MAX_OBJECTIVES_PER_LEKTION + " mục tiêu");
        }
        objectiveRepo.deleteByLektionId(lektionId);
        List<CurriculumObjective> rows = new ArrayList<>();
        int idx = 0;
        for (CurriculumObjectiveInput in : inputs) {
            if (in == null) continue;
            String text = in.text() == null ? "" : in.text().trim();
            if (text.isEmpty()) continue;
            rows.add(CurriculumObjective.builder()
                    .lektionId(lektionId)
                    .orderIndex(idx++)
                    .text(truncateText(text))
                    .cefrLevel(normalizeCefr(in.cefrLevel()))
                    .skillTag(normalizeSkill(in.skillTag()))
                    .build());
        }
        if (!rows.isEmpty()) objectiveRepo.saveAll(rows);
        return rows.stream().map(OrgCurriculumService::objectiveDto).toList();
    }

    // ── Nhập nháp từ JSON + bộ mẫu A1 ────────────────────────────────────────

    /** Nhập bộ giáo trình thật thành bản NHÁP (P03): tạo bộ mới + phiên bản 1 DRAFT kèm toàn bộ nội dung. */
    @Transactional
    public OrgCurriculumSummaryDto importDraft(Long userId, Long orgId, ImportCurriculumRequest req) {
        return importInternal(userId, orgId, req, false);
    }

    /** Bộ mẫu A1 (is_sample=true) — dữ liệu tự soạn để chạy thử luồng, không áp cho lớp thật (P03). */
    @Transactional
    public OrgCurriculumSummaryDto createSampleA1(Long userId, Long orgId) {
        return importInternal(userId, orgId, sampleA1Request(), true);
    }

    private OrgCurriculumSummaryDto importInternal(Long userId, Long orgId, ImportCurriculumRequest req, boolean sample) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new BadRequestException("Tên bộ giáo trình không được để trống");
        }
        List<ImportCurriculumRequest.ImportLektion> lektionen =
                req.lektionen() == null ? List.of() : req.lektionen();
        if (lektionen.isEmpty()) {
            throw new BadRequestException("Bản nhập phải có ít nhất một Lektion");
        }
        if (lektionen.size() > MAX_LEKTIONEN) {
            throw new BadRequestException("Bản nhập tối đa " + MAX_LEKTIONEN + " Lektion");
        }

        OrgCurriculum curriculum = curriculumRepo.save(OrgCurriculum.builder()
                .orgId(orgId)
                .name(truncateName(req.name()))
                .cefrLevel(normalizeCefr(req.cefrLevel()))
                .description(req.description())
                .sample(sample)
                .createdBy(userId)
                .build());
        OrgCurriculumVersion draft = versionRepo.save(OrgCurriculumVersion.builder()
                .curriculumId(curriculum.getId())
                .versionNo(1)
                .status(OrgCurriculumVersion.STATUS_DRAFT)
                .sourceNote(req.sourceNote())
                .build());

        int order = 0;
        for (ImportCurriculumRequest.ImportLektion in : lektionen) {
            if (in == null || in.title() == null || in.title().isBlank()) {
                throw new BadRequestException("Lektion thứ " + (order + 1) + " thiếu tiêu đề");
            }
            CurriculumLektion lektion = lektionRepo.save(CurriculumLektion.builder()
                    .versionId(draft.getId())
                    .orderIndex(order++)
                    .title(truncateTitle(in.title()))
                    .description(in.description())
                    .build());
            replaceItems(orgId, lektion.getId(), new ReplaceItemsRequest(in.items()));
            replaceObjectives(orgId, lektion.getId(), new ReplaceObjectivesRequest(in.objectives()));
        }
        return new OrgCurriculumSummaryDto(curriculum.getId(), curriculum.getName(),
                curriculum.getCefrLevel(), curriculum.getDescription(), curriculum.isSample(),
                curriculum.getCreatedAt(), List.of(versionSummary(draft)));
    }

    /** Nội dung mẫu TỰ SOẠN (repo public — không dùng nội dung giáo trình thương mại). */
    private static ImportCurriculumRequest sampleA1Request() {
        return new ImportCurriculumRequest(
                "Giáo trình mẫu A1 (sample)",
                "A1",
                "Bộ mẫu tự soạn để chạy thử luồng vận hành: 3 Lektion, mỗi Lektion dự kiến 3 buổi (540 phút học). Không dùng cho lớp thật.",
                "Seed sample A1 — PR-1",
                List.of(
                        new ImportCurriculumRequest.ImportLektion(
                                "Lektion 1 — Hallo und willkommen",
                                "Chào hỏi, bảng chữ cái, số đếm, câu giới thiệu đầu tiên.",
                                List.of(
                                        new CurriculumItemInput("Chào hỏi và tạm biệt: Hallo, Guten Tag, Auf Wiedersehen, Tschüss", null, "REDEMITTEL", 120),
                                        new CurriculumItemInput("Bảng chữ cái tiếng Đức và đánh vần tên riêng", null, "AUSSPRACHE", 150),
                                        new CurriculumItemInput("Số đếm 0–20 và hỏi–đáp số điện thoại", null, "WORTSCHATZ", 120),
                                        new CurriculumItemInput("Đại từ ich/du/Sie và động từ sein ở hiện tại", null, "GRAMMATIK", 150)),
                                List.of(
                                        new CurriculumObjectiveInput("Ich kann mich begrüßen und verabschieden.", "A1", "SPRECHEN"),
                                        new CurriculumObjectiveInput("Ich kann meinen Namen buchstabieren.", "A1", "SPRECHEN"),
                                        new CurriculumObjectiveInput("Ich kann Telefonnummern verstehen und nennen.", "A1", "HOEREN"))),
                        new ImportCurriculumRequest.ImportLektion(
                                "Lektion 2 — Ich stelle mich vor",
                                "Giới thiệu bản thân: tên, quê quán, nơi ở; câu hỏi W-.",
                                List.of(
                                        new CurriculumItemInput("Redemittel giới thiệu: Ich heiße …, Ich komme aus …, Ich wohne in …", null, "REDEMITTEL", 150),
                                        new CurriculumItemInput("Chia động từ hiện tại: heißen, kommen, wohnen", null, "GRAMMATIK", 150),
                                        new CurriculumItemInput("Câu hỏi W-: Wie? Woher? Wo? và trật tự từ", null, "GRAMMATIK", 120),
                                        new CurriculumItemInput("Tên quốc gia và ngôn ngữ", null, "WORTSCHATZ", 120)),
                                List.of(
                                        new CurriculumObjectiveInput("Ich kann mich vorstellen: Name, Herkunft, Wohnort.", "A1", "SPRECHEN"),
                                        new CurriculumObjectiveInput("Ich kann einfache W-Fragen stellen und beantworten.", "A1", "SPRECHEN"),
                                        new CurriculumObjectiveInput("Ich kann ein einfaches Formular mit persönlichen Daten ausfüllen.", "A1", "SCHREIBEN"))),
                        new ImportCurriculumRequest.ImportLektion(
                                "Lektion 3 — Familie und Zahlen bis 100",
                                "Gia đình, sở hữu mein/dein, số 20–100 và tuổi.",
                                List.of(
                                        new CurriculumItemInput("Từ vựng gia đình: Mutter, Vater, Geschwister, Kinder", null, "WORTSCHATZ", 150),
                                        new CurriculumItemInput("Quán từ sở hữu mein/dein và câu đơn về gia đình", null, "GRAMMATIK", 150),
                                        new CurriculumItemInput("Số 20–100, hỏi–đáp tuổi: Wie alt bist du?", null, "WORTSCHATZ", 120),
                                        new CurriculumItemInput("Hội thoại ngắn: giới thiệu ảnh gia đình", null, "REDEMITTEL", 120)),
                                List.of(
                                        new CurriculumObjectiveInput("Ich kann meine Familie mit einfachen Sätzen vorstellen.", "A1", "SPRECHEN"),
                                        new CurriculumObjectiveInput("Ich kann Zahlen bis 100 verstehen und verwenden.", "A1", "HOEREN"),
                                        new CurriculumObjectiveInput("Ich kann kurze, einfache Texte über eine Familie verstehen.", "A1", "LESEN")))));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private OrgCurriculum loadCurriculum(Long orgId, Long curriculumId) {
        return curriculumRepo.findByIdAndOrgId(curriculumId, orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bộ giáo trình"));
    }

    /** Version → curriculum → kiểm org (chống truy cập chéo trung tâm bằng id đoán). */
    OrgCurriculumVersion loadVersion(Long orgId, Long versionId) {
        OrgCurriculumVersion version = versionRepo.findById(versionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiên bản giáo trình"));
        loadCurriculum(orgId, version.getCurriculumId());
        return version;
    }

    private OrgCurriculumVersion loadDraft(Long orgId, Long versionId) {
        OrgCurriculumVersion version = loadVersion(orgId, versionId);
        if (!OrgCurriculumVersion.STATUS_DRAFT.equals(version.getStatus())) {
            throw new ConflictException("Phiên bản đã công bố là bất biến — tạo bản nháp mới để sửa nội dung");
        }
        return version;
    }

    private CurriculumLektion loadDraftLektion(Long orgId, Long lektionId) {
        CurriculumLektion lektion = lektionRepo.findById(lektionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy Lektion"));
        loadDraft(orgId, lektion.getVersionId());
        return lektion;
    }

    private void copyContent(Long sourceVersionId, Long targetVersionId) {
        List<CurriculumLektion> sources = lektionRepo.findByVersionIdOrderByOrderIndexAsc(sourceVersionId);
        for (CurriculumLektion src : sources) {
            CurriculumLektion copy = lektionRepo.save(CurriculumLektion.builder()
                    .versionId(targetVersionId)
                    .orderIndex(src.getOrderIndex())
                    .title(src.getTitle())
                    .description(src.getDescription())
                    .build());
            List<CurriculumItem> items = itemRepo.findByLektionIdOrderByOrderIndexAsc(src.getId()).stream()
                    .map(i -> CurriculumItem.builder()
                            .lektionId(copy.getId())
                            .orderIndex(i.getOrderIndex())
                            .text(i.getText())
                            .skillTag(i.getSkillTag())
                            .contentTag(i.getContentTag())
                            .estimatedMinutes(i.getEstimatedMinutes())
                            .build())
                    .toList();
            if (!items.isEmpty()) itemRepo.saveAll(items);
            List<CurriculumObjective> objectives = objectiveRepo.findByLektionIdOrderByOrderIndexAsc(src.getId()).stream()
                    .map(o -> CurriculumObjective.builder()
                            .lektionId(copy.getId())
                            .orderIndex(o.getOrderIndex())
                            .text(o.getText())
                            .cefrLevel(o.getCefrLevel())
                            .skillTag(o.getSkillTag())
                            .build())
                    .toList();
            if (!objectives.isEmpty()) objectiveRepo.saveAll(objectives);
        }
    }

    private CurriculumVersionSummaryDto versionSummary(OrgCurriculumVersion v) {
        return new CurriculumVersionSummaryDto(v.getId(), v.getVersionNo(), v.getStatus(),
                lektionRepo.countByVersionId(v.getId()), v.getPublishedAt(),
                linkRepo.countByVersionId(v.getId()));
    }

    private static CurriculumLektionDto lektionDto(CurriculumLektion l, List<CurriculumItem> items,
                                                   List<CurriculumObjective> objectives) {
        return new CurriculumLektionDto(l.getId(), l.getOrderIndex(), l.getTitle(), l.getDescription(),
                items.stream().map(OrgCurriculumService::itemDto).toList(),
                objectives.stream().map(OrgCurriculumService::objectiveDto).toList());
    }

    private static CurriculumItemDto itemDto(CurriculumItem i) {
        return new CurriculumItemDto(i.getId(), i.getOrderIndex(), i.getText(), i.getSkillTag(),
                i.getContentTag(), i.getEstimatedMinutes());
    }

    private static CurriculumObjectiveDto objectiveDto(CurriculumObjective o) {
        return new CurriculumObjectiveDto(o.getId(), o.getOrderIndex(), o.getText(), o.getCefrLevel(),
                o.getSkillTag());
    }

    private static String truncateName(String raw) {
        String v = raw.trim();
        return v.length() <= NAME_MAX ? v : v.substring(0, NAME_MAX);
    }

    private static String truncateTitle(String raw) {
        String v = raw.trim();
        return v.length() <= TITLE_MAX ? v : v.substring(0, TITLE_MAX);
    }

    private static String truncateText(String raw) {
        return raw.length() <= TEXT_MAX ? raw : raw.substring(0, TEXT_MAX);
    }

    private static String normalizeCefr(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase();
        if (!CEFR_LEVELS.contains(v)) throw new BadRequestException("Cấp CEFR không hợp lệ: " + raw);
        return v;
    }

    private static String normalizeSkill(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase();
        if (!SKILL_TAGS.contains(v)) throw new BadRequestException("Tag kỹ năng không hợp lệ: " + raw);
        return v;
    }

    private static String normalizeContent(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toUpperCase();
        if (!CONTENT_TAGS.contains(v)) throw new BadRequestException("Tag nội dung không hợp lệ: " + raw);
        return v;
    }

    private static Integer validateMinutes(Integer minutes) {
        if (minutes == null) return null;
        if (minutes <= 0) throw new BadRequestException("Phút dạy ước lượng phải là số dương");
        return minutes;
    }
}
