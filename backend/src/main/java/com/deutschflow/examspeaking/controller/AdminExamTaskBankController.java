package com.deutschflow.examspeaking.controller;

import com.deutschflow.examspeaking.bank.ExamTaskBankAdminService;
import com.deutschflow.examspeaking.dto.TaskBankView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Đ5b-A — Admin ngân hàng đề Luyện thi Nói: ma trận pool (đỏ = phiên sẽ 409 vì thiếu đề),
 * CRUD `speaking_exam_tasks` (DRAFT/APPROVED/RETIRED — chỉ APPROVED được rút vào phòng thi),
 * blueprint read-only (đổi blueprint vẫn qua Flyway migration).
 */
@RestController
@RequestMapping("/api/admin/speaking/exam/bank")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminExamTaskBankController {

    private final ExamTaskBankAdminService service;

    @GetMapping("/overview")
    public List<TaskBankView.PoolCell> overview() {
        return service.overview();
    }

    @GetMapping("/tasks")
    public List<TaskBankView.TaskRow> tasks(@RequestParam(required = false) String provider,
                                            @RequestParam(required = false) String level,
                                            @RequestParam(required = false) Integer teilNo,
                                            @RequestParam(required = false) String status) {
        return service.list(provider, level, teilNo, status);
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskBankView.TaskRow create(@RequestBody TaskBankView.TaskPayload payload) {
        return service.create(payload);
    }

    @PutMapping("/tasks/{id}")
    public TaskBankView.TaskRow update(@PathVariable long id, @RequestBody TaskBankView.TaskPayload payload) {
        return service.update(id, payload);
    }

    @GetMapping("/blueprints")
    public List<TaskBankView.BlueprintRow> blueprints() {
        return service.blueprints();
    }
}
