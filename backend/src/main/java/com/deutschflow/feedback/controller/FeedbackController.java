package com.deutschflow.feedback.controller;

import com.deutschflow.feedback.dto.FeedbackDtos.AttachmentUploaded;
import com.deutschflow.feedback.dto.FeedbackDtos.CreateFeedbackRequest;
import com.deutschflow.feedback.dto.FeedbackDtos.FormOptions;
import com.deutschflow.feedback.dto.FeedbackDtos.MyFeedbackDto;
import com.deutschflow.feedback.service.FeedbackService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Góp ý về phần mềm của người đang đăng nhập (đặc tả gopycapnhat, GĐ1). Học viên, giáo viên, chủ/quản lý
 * trung tâm gửi được; ADMIN nhận 403 (dùng ghi chú nội bộ). Mọi danh sách chỉ chứa góp ý của chính người gọi.
 */
@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class FeedbackController {

    private final FeedbackService feedbackService;

    @GetMapping("/form")
    public FormOptions form(@AuthenticationPrincipal User user) {
        return feedbackService.formOptions(user);
    }

    @GetMapping("/mine")
    public List<MyFeedbackDto> mine(@AuthenticationPrincipal User user) {
        return feedbackService.mine(user);
    }

    /** FBK-09: 201; gửi lại cùng {@code clientRequestId} trả đúng bản ghi cũ. 429 + Retry-After khi quá hạn mức. */
    @PostMapping
    public ResponseEntity<MyFeedbackDto> submit(@AuthenticationPrincipal User user,
                                                @Valid @RequestBody CreateFeedbackRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackService.submit(user, body));
    }

    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentUploaded> upload(@AuthenticationPrincipal User user,
                                                     @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackService.upload(user, file));
    }

    @DeleteMapping("/attachments/{id}")
    public ResponseEntity<Void> deleteAttachment(@AuthenticationPrincipal User user, @PathVariable Long id) {
        feedbackService.deleteUnattached(user, id);
        return ResponseEntity.noContent().build();
    }
}
