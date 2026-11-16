package com.deutschflow.feedback.controller;

import com.deutschflow.feedback.FeedbackEnums.Area;
import com.deutschflow.feedback.FeedbackEnums.Source;
import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.FeedbackEnums.Type;
import com.deutschflow.feedback.dto.FeedbackDtos.AdminDetail;
import com.deutschflow.feedback.dto.FeedbackDtos.AdminListPage;
import com.deutschflow.feedback.dto.FeedbackDtos.InternalNoteRequest;
import com.deutschflow.feedback.dto.FeedbackDtos.MarkReadRequest;
import com.deutschflow.feedback.dto.FeedbackDtos.ReplyDto;
import com.deutschflow.feedback.dto.FeedbackDtos.ReplyRequest;
import com.deutschflow.feedback.dto.FeedbackDtos.StatusChangeRequest;
import com.deutschflow.feedback.dto.FeedbackDtos.StatusChangeResult;
import com.deutschflow.feedback.dto.FeedbackDtos.UnreadCount;
import com.deutschflow.feedback.service.AdminFeedbackService;
import com.deutschflow.feedback.service.AdminFeedbackService.Filter;
import com.deutschflow.feedback.service.AdminFeedbackService.Sort;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Hộp góp ý của ADMIN (đặc tả gopycapnhat, FBK-15…23, 28). */
@RestController
@RequestMapping("/api/admin/feedback")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminFeedbackController {

    private final AdminFeedbackService service;

    @GetMapping
    public AdminListPage list(@RequestParam(required = false) Status status,
                              @RequestParam(required = false) Type type,
                              @RequestParam(required = false) Area area,
                              @RequestParam(required = false) Source source,
                              @RequestParam(required = false) String role,
                              @RequestParam(required = false) String q,
                              @RequestParam(defaultValue = "NEWEST") Sort sort,
                              @RequestParam(defaultValue = "0") int page) {
        return service.list(new Filter(status, type, area, source, role, q), sort, page);
    }

    @GetMapping("/unread-count")
    public UnreadCount unreadCount() {
        return new UnreadCount(service.unreadCount());
    }

    @GetMapping("/{id}")
    public AdminDetail detail(@PathVariable Long id) {
        return service.detail(id);
    }

    /** FBK-20: client gọi khi mở chi tiết một góp ý (GET không ghi — QLT-21). */
    @PostMapping("/{id}/mark-read")
    public Map<String, Integer> markOneRead(@PathVariable Long id) {
        return Map.of("updated", service.markRead(List.of(id)));
    }

    @PostMapping("/mark-read")
    public Map<String, Integer> markRead(@Valid @RequestBody MarkReadRequest body) {
        return Map.of("updated", service.markRead(body.ids()));
    }

    @PostMapping("/status")
    public StatusChangeResult changeStatus(@AuthenticationPrincipal User admin,
                                           @Valid @RequestBody StatusChangeRequest body) {
        return service.changeStatus(admin, body.ids(), body.status(), body.explanation());
    }

    @PostMapping("/{id}/replies")
    public ReplyDto reply(@AuthenticationPrincipal User admin, @PathVariable Long id,
                          @Valid @RequestBody ReplyRequest body) {
        return service.reply(admin, id, body.body());
    }

    @PutMapping("/{id}/internal-note")
    public ResponseEntity<Void> note(@AuthenticationPrincipal User admin, @PathVariable Long id,
                                     @Valid @RequestBody InternalNoteRequest body) {
        service.updateNote(admin, id, body.note());
        return ResponseEntity.noContent().build();
    }
}
