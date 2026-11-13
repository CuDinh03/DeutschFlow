package com.deutschflow.vocabulary.saved;

import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SaveRequest;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWord;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWordList;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sổ từ riêng của học viên (13/11/2026). Lưu từ khi luyện đề đọc; lưu xong tự vào lịch ôn.
 *
 * <ul>
 *   <li>{@code POST /api/my-words} — lưu chữ đã bôi đen (1–5 từ). Đã có ⇒ 200 + {@code alreadySaved}.
 *       Chữ sai ⇒ 400; quá trần tra AI trong ngày ⇒ 429; AI không trả lời được ⇒ 503.</li>
 *   <li>{@code GET /api/my-words} — cả sổ, mới nhất trước.</li>
 *   <li>{@code DELETE /api/my-words/{id}} — gỡ khỏi sổ + gỡ thẻ ôn. Không phải của mình ⇒ 404.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/my-words")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class SavedWordController {

    private final SavedWordService service;

    @PostMapping
    public SavedWord save(@RequestBody SaveRequest body, @AuthenticationPrincipal User user) {
        return service.save(user.getId(), body);
    }

    @GetMapping
    public SavedWordList list(@AuthenticationPrincipal User user) {
        return service.list(user.getId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable long id, @AuthenticationPrincipal User user) {
        service.remove(user.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
