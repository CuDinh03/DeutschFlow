package com.deutschflow.examstudio;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.examstudio.SourceCatalogService.ArticleView;
import com.deutschflow.examstudio.SourceCatalogService.FeedView;
import com.deutschflow.examstudio.SourceCatalogService.PollResult;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Xưởng đề (admin) — danh mục nguồn của dây chuyền tạo bộ đề. Các lệnh GET chỉ đọc DB; việc tải feed nằm ở POST.
 * Hợp đồng: {@code frontend/src/lib/adminExamStudioApi.ts}.
 */
@RestController
@RequestMapping("/api/admin/exam-studio/catalog")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ExamSourceCatalogController {

    private final SourceCatalogService catalog;
    private final AuditLogService audit;

    public record ActiveRequest(Boolean active) {}

    @GetMapping("/feeds")
    public List<FeedView> feeds() {
        return catalog.feeds();
    }

    @PatchMapping("/feeds/{id}")
    public List<FeedView> setActive(@PathVariable long id, @RequestBody ActiveRequest req,
                                    @AuthenticationPrincipal User actor) {
        if (req == null || req.active() == null) throw new BadRequestException("Yêu cầu bật/tắt nguồn gửi lên thiếu thông tin. Tải lại tab \"Nguồn\" rồi bấm lại.");
        catalog.setActive(id, req.active());
        audit.log(req.active() ? "admin.exam_studio.source_feed_enabled" : "admin.exam_studio.source_feed_disabled",
                AuditActor.of(actor), "EXAM_SOURCE_FEED", String.valueOf(id), Map.of());
        return catalog.feeds();
    }

    /** Đọc danh sách bài mới của một nơi đăng (feed hoặc trang mục lục). Không tải bài. */
    @PostMapping("/feeds/{id}/poll")
    public PollResult poll(@PathVariable long id, @AuthenticationPrincipal User actor) {
        PollResult r = catalog.poll(id);
        audit.log("admin.exam_studio.source_feed_polled", AuditActor.of(actor), "EXAM_SOURCE_FEED",
                String.valueOf(id), Map.of("found", r.found(), "added", r.added()));
        return r;
    }

    @GetMapping("/articles")
    public List<ArticleView> articles(@RequestParam(required = false) Long feedId,
                                      @RequestParam(required = false) String status,
                                      @RequestParam(defaultValue = "50") int limit) {
        return catalog.list(feedId, status, limit);
    }

    /** Bài còn dùng được, xếp theo từ khoá chủ đề ({@code q} = các từ cách nhau bằng dấu phẩy). */
    @GetMapping("/candidates")
    public List<ArticleView> candidates(@RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "20") int limit) {
        List<String> kws = q == null || q.isBlank() ? List.of()
                : Arrays.stream(q.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        return catalog.candidates(kws, Math.min(limit, 100));
    }
}
