package com.deutschflow.examstudio;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.examstudio.ExamSetRunService.CreateRunRequest;
import com.deutschflow.examstudio.ExamSetRunService.RunView;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Xưởng đề (admin) — lượt "Tạo bộ đề tự động". Tạo lượt chỉ ghi DB; mọi việc gọi AI do nhịp nền
 * ({@link ExamSetRunScheduler}) làm. GET không ghi DB.
 */
@RestController
@RequestMapping("/api/admin/exam-studio/sets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ExamSetRunController {

    private final ExamSetRunService runs;
    private final AuditLogService audit;

    @GetMapping
    public List<RunView> list() {
        return runs.list();
    }

    /** Chế độ "Tự nối lượt": xong một lượt thì nhịp nền tự tạo lượt kế tiếp. */
    @GetMapping("/auto")
    public ExamSetRunService.AutoView auto() {
        return runs.auto();
    }

    @PutMapping("/auto")
    public ExamSetRunService.AutoView setAuto(@RequestBody ExamSetRunService.AutoRequest req,
                                              @AuthenticationPrincipal User actor) {
        ExamSetRunService.AutoView v = runs.setAuto(req, actor.getId());
        audit.log(v.enabled() ? "admin.exam_studio.set_auto_enabled" : "admin.exam_studio.set_auto_disabled",
                AuditActor.of(actor), "EXAM_SET_AUTO", "1",
                Map.of("examFormat", v.examFormat(), "cefrLevel", v.cefrLevel(), "channel", v.channel()));
        return v;
    }

    @GetMapping("/{id}")
    public RunView get(@PathVariable long id) {
        return runs.get(id);
    }

    @PostMapping
    public RunView create(@RequestBody CreateRunRequest req, @AuthenticationPrincipal User actor) {
        RunView r = runs.create(req, actor.getId());
        audit.log("admin.exam_studio.set_run_created", AuditActor.of(actor), "EXAM_SET_RUN", String.valueOf(r.id()),
                Map.of("examFormat", r.examFormat(), "cefrLevel", r.cefrLevel(), "channel", r.channel()));
        return r;
    }

    /** Duyệt cả bộ: mọi Teil vào kho, ghép thành một bộ đề "Sắp có". Chưa phát hành cho học viên. */
    @PostMapping("/{id}/approve")
    public RunView approve(@PathVariable long id, @RequestBody(required = false) ExamSetRunService.ApproveRunRequest req,
                           @AuthenticationPrincipal User actor) {
        RunView r = runs.approve(id, req, actor.getId());
        audit.log("admin.exam_studio.set_run_approved", AuditActor.of(actor), "EXAM_SET_RUN", String.valueOf(id), Map.of());
        return r;
    }

    /** Kiểm lại lượt "Cần bạn xem" sau khi owner sửa tay Teil kẹt: Teil hết đỏ tính là xong, chạy lại kiểm cấp bộ. */
    @PostMapping("/{id}/recheck")
    public RunView recheck(@PathVariable long id, @AuthenticationPrincipal User actor) {
        RunView r = runs.recheck(id);
        audit.log("admin.exam_studio.set_run_rechecked", AuditActor.of(actor), "EXAM_SET_RUN", String.valueOf(id),
                Map.of("status", r.status()));
        return r;
    }

    /** Máy tạo lại riêng một Teil của lượt đã chạy xong (bản nháp cũ bị bỏ, chủ đề mới, luật hiện hành). */
    @PostMapping("/{id}/teile/{section}/{teil}/redo")
    public RunView redoTeil(@PathVariable long id, @PathVariable String section, @PathVariable int teil,
                            @RequestBody(required = false) Map<String, String> body,
                            @AuthenticationPrincipal User actor) {
        RunView r = runs.redoTeil(id, section, teil, body == null ? null : body.get("channel"));
        audit.log("admin.exam_studio.set_run_teil_redo", AuditActor.of(actor), "EXAM_SET_RUN", String.valueOf(id),
                Map.of("section", section, "teil", teil));
        return r;
    }

    /** Lượt cũ chỉ có 6 Teil: thêm ba Teil Nghe (chủ đề chưa dùng trong bộ) rồi cho lượt chạy tiếp. */
    @PostMapping("/{id}/add-hoeren")
    public RunView addHoeren(@PathVariable long id, @RequestBody(required = false) Map<String, String> body,
                             @AuthenticationPrincipal User actor) {
        RunView r = runs.addHoeren(id, body == null ? null : body.get("channel"));
        audit.log("admin.exam_studio.set_run_hoeren_added", AuditActor.of(actor), "EXAM_SET_RUN", String.valueOf(id),
                Map.of("channel", r.channel()));
        return r;
    }

    @PostMapping("/{id}/discard")
    public RunView discard(@PathVariable long id, @AuthenticationPrincipal User actor) {
        RunView r = runs.discard(id);
        audit.log("admin.exam_studio.set_run_discarded", AuditActor.of(actor), "EXAM_SET_RUN", String.valueOf(id), Map.of());
        return r;
    }
}
