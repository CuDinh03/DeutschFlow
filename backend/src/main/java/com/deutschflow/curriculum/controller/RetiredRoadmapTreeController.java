package com.deutschflow.curriculum.controller;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Cây manifest ({@code /api/roadmap/tree}, bảng {@code tree_*}) đã gỡ ở đợt 1 thiết kế lại lộ trình
 * (14/11/2026, ROUTE-05). Không màn nào hiện tại gọi tới; bản mobile trước 05/09/2026 từng đọc nó cho
 * màn Lernweg. Trả 410 có mã ổn định thay vì 404/5xx để app cũ báo lỗi rõ ràng.
 *
 * <p>Bảng {@code tree_*} giữ nguyên dữ liệu tới đợt dọn cuối (backup rồi mới drop, khi owner ra lệnh).
 */
@Hidden
@RestController
@RequestMapping("/api/roadmap/tree")
public class RetiredRoadmapTreeController {

    static final Map<String, String> BODY = Map.of("code", "ROADMAP_TREE_RETIRED");

    @RequestMapping({"", "/**"})
    public ResponseEntity<Map<String, String>> retired() {
        return ResponseEntity.status(HttpStatus.GONE).body(BODY);
    }
}
