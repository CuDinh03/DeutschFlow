package com.deutschflow.examspeaking.bank;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.deutschflow.examspeaking.dto.TaskBankView;
import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import com.deutschflow.examspeaking.repository.SpeakingExamTaskRepository;
import com.deutschflow.examspeaking.session.AiInterlocutorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Đ5b-A — Admin quản ngân hàng đề (`speaking_exam_tasks`) không cần sờ SQL: bảng đề CRUD, ma trận
 * pool theo blueprint (đỏ = phiên sẽ 409 vì thiếu đề), blueprint read-only. Đề mới mặc định DRAFT —
 * {@code ExamTaskBankService.pick} chỉ rút APPROVED nên bản nháp không bao giờ lọt vào phòng thi.
 *
 * <p>Ngân hàng đề nhỏ (~vài trăm dòng) nên lọc trong bộ nhớ từ một lượt findAll — tránh hẳn bẫy
 * tham số null trong JPQL, và một lượt đọc phục vụ cả bảng lẫn ma trận pool.</p>
 */
@Service
@RequiredArgsConstructor
public class ExamTaskBankAdminService {

    static final Set<String> STATUSES = Set.of("DRAFT", "APPROVED", "RETIRED");
    /** Cấp có thể seed dữ liệu — C1/C2 chưa có blueprint nhưng đề được phép soạn trước. */
    static final Set<String> LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final int MAX_ROWS = 1000;

    private final SpeakingExamTaskRepository taskRepository;
    private final ExamBlueprintCatalog catalog;

    // ── Ma trận pool ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TaskBankView.PoolCell> overview() {
        List<SpeakingExamTask> all = taskRepository.findAll();
        List<TaskBankView.PoolCell> out = new ArrayList<>();
        for (ExamBlueprint bp : catalog.listActive()) {
            for (BlueprintPart part : bp.parts()) {
                long pool = all.stream().filter(t -> "APPROVED".equals(t.getStatus())
                        && t.getLevel().equals(bp.level())
                        && t.getTeilNo() == part.teilNo()
                        && t.getArchetype().equals(part.archetype().name())
                        && (t.getProvider() == null || t.getProvider().equals(bp.provider().name())))
                        .count();
                out.add(new TaskBankView.PoolCell(bp.provider().name(), bp.level(), part.teilNo(),
                        part.archetype().name(), part.title(), part.cardsNeeded(), pool));
            }
        }
        return out;
    }

    // ── Bảng đề ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TaskBankView.TaskRow> list(String provider, String level, Integer teilNo, String status) {
        return taskRepository.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
                // provider lọc theo ngữ nghĩa của pick: đề riêng của hệ + đề dùng chung (NULL)
                .filter(t -> provider == null || provider.isBlank()
                        || t.getProvider() == null || t.getProvider().equals(provider))
                .filter(t -> level == null || level.isBlank() || t.getLevel().equals(level))
                .filter(t -> teilNo == null || t.getTeilNo() == teilNo)
                .filter(t -> status == null || status.isBlank() || t.getStatus().equals(status))
                .limit(MAX_ROWS)
                .map(ExamTaskBankAdminService::toRow)
                .toList();
    }

    @Transactional
    public TaskBankView.TaskRow create(TaskBankView.TaskPayload payload) {
        validate(payload, true);
        SpeakingExamTask t = SpeakingExamTask.builder()
                .provider(blankToNull(payload.provider()))
                .level(payload.level())
                .teilNo(payload.teilNo())
                .archetype(payload.archetype())
                .stimulusJson(payload.stimulus())
                .status(payload.status() == null || payload.status().isBlank() ? "DRAFT" : payload.status())
                .source("CURATED")
                .build();
        return toRow(taskRepository.save(t));
    }

    @Transactional
    public TaskBankView.TaskRow update(long id, TaskBankView.TaskPayload payload) {
        validate(payload, false);
        SpeakingExamTask t = taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không có đề #" + id));
        t.setProvider(blankToNull(payload.provider()));
        t.setLevel(payload.level());
        t.setTeilNo(payload.teilNo());
        t.setArchetype(payload.archetype());
        t.setStimulusJson(payload.stimulus());
        if (payload.status() != null && !payload.status().isBlank()) {
            t.setStatus(payload.status());
        }
        return toRow(taskRepository.save(t));
    }

    // ── Blueprint read-only ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TaskBankView.BlueprintRow> blueprints() {
        return catalog.listActive().stream()
                .map(bp -> new TaskBankView.BlueprintRow(bp.id(), bp.provider().name(), bp.level(),
                        bp.title(), bp.prepSec(),
                        bp.parts().stream().map(p -> new TaskBankView.BlueprintPartRow(p.teilNo(),
                                p.archetype().name(), p.title(), p.durationSec(), p.cardsNeeded(),
                                p.hasPartner())).toList()))
                .toList();
    }

    // ── Validation ───────────────────────────────────────────────────────────────

    private static void validate(TaskBankView.TaskPayload p, boolean creating) {
        if (p == null) {
            throw new BadRequestException("Thiếu payload.");
        }
        String provider = blankToNull(p.provider());
        if (provider != null) {
            try {
                ExamProvider.valueOf(provider);
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("provider phải là GOETHE/TELC hoặc bỏ trống (đề dùng chung).");
            }
        }
        if (p.level() == null || !LEVELS.contains(p.level())) {
            throw new BadRequestException("level phải thuộc " + LEVELS + ".");
        }
        if (p.teilNo() == null || p.teilNo() < 1 || p.teilNo() > 4) {
            throw new BadRequestException("teilNo phải trong khoảng 1–4.");
        }
        if (p.archetype() == null) {
            throw new BadRequestException("Thiếu archetype.");
        }
        try {
            TaskArchetype.valueOf(p.archetype());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("archetype không hợp lệ: " + p.archetype());
        }
        if (p.status() != null && !p.status().isBlank() && !STATUSES.contains(p.status())) {
            throw new BadRequestException("status phải thuộc " + STATUSES + ".");
        }
        Map<String, Object> stimulus = p.stimulus();
        if (stimulus == null || stimulus.isEmpty()) {
            throw new BadRequestException("stimulus phải là JSON object không rỗng.");
        }
        if (!(stimulus.get("type") instanceof String type) || type.isBlank()) {
            throw new BadRequestException("stimulus phải có khoá \"type\" (chuỗi) để FE render đúng thẻ.");
        }
        // 🪤 Khoá partner* lạ: clientStimulus ẩn khỏi client TỰ ĐỘNG theo tiền tố, nhưng AI chỉ đọc
        // khoá nó biết TÊN (AiInterlocutorService.privateContext) → khoá lạ hỏng ÂM THẦM. Chặn từ đầu.
        List<String> unknown = stimulus.keySet().stream()
                .filter(k -> k.startsWith("partner"))
                .filter(k -> !AiInterlocutorService.KNOWN_PARTNER_KEYS.contains(k))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            throw new BadRequestException("Khoá partner* chưa được AI hỗ trợ: " + unknown
                    + ". Chỉ dùng " + AiInterlocutorService.KNOWN_PARTNER_KEYS
                    + " — khoá mới cần thêm code ở AiInterlocutorService.privateContext trước.");
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static TaskBankView.TaskRow toRow(SpeakingExamTask t) {
        return new TaskBankView.TaskRow(t.getId(), t.getProvider(), t.getLevel(), t.getTeilNo(),
                t.getArchetype(), t.getStatus(), t.getSource(), t.getStimulusJson(),
                t.getCreatedAt(), t.getUpdatedAt());
    }
}
