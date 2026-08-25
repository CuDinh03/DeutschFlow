package com.deutschflow.examspeaking.controller;

import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.golden.ExamGoldenService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * G.1 Golden set (ADMIN): danh sách phiên mock đã có kết quả máy → phiếu chấm tay của giám khảo
 * người → so sánh đồng thuận máy↔người (gate ra mắt: đạt/trượt ≥85%, ±1 band ≥90%) → CSV →
 * regrade (regression, TỐN token LLM — chỉ chạy khi hiệu chuẩn).
 */
@RestController
@RequestMapping("/api/admin/speaking/exam/golden")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminExamGoldenController {

    private final ExamGoldenService goldenService;

    @GetMapping("/sessions")
    public List<GoldenView.SessionRow> sessions(@RequestParam(required = false) String provider,
                                                @RequestParam(required = false) String level) {
        return goldenService.listSessions(provider, level);
    }

    @GetMapping("/sessions/{id}")
    public GoldenView.Detail detail(@AuthenticationPrincipal User user, @PathVariable long id) {
        return goldenService.detail(id, user.getId());
    }

    @PutMapping("/sessions/{id}/ratings")
    public GoldenView.SaveResult saveRatings(@AuthenticationPrincipal User user, @PathVariable long id,
                                             @RequestBody Map<String, List<GoldenView.RatingRow>> body) {
        return goldenService.saveRatings(user.getId(), id, body == null ? null : body.get("ratings"));
    }

    @GetMapping("/compare")
    public GoldenView.CompareReport compare(@RequestParam(required = false) String provider,
                                            @RequestParam(required = false) String level) {
        return goldenService.compare(provider, level);
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<String> exportCsv(@RequestParam(required = false) String provider,
                                            @RequestParam(required = false) String level) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .header("Content-Disposition", "attachment; filename=\"golden-set.csv\"")
                .body(goldenService.exportCsv(provider, level));
    }

    /** Regression: chấm LẠI phiên trên transcript đóng băng — không ghi đè kết quả lưu. */
    @PostMapping("/sessions/{id}/regrade")
    public GoldenView.RegradeResult regrade(@AuthenticationPrincipal User user, @PathVariable long id) {
        return goldenService.regrade(id, user.getId());
    }
}
