package com.deutschflow.vocabulary.saved;

import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.saved.SavedWordDtos.MeaningRequest;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SaveRequest;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWord;
import com.deutschflow.vocabulary.saved.SavedWordDtos.SavedWordList;
import com.deutschflow.vocabulary.saved.SavedWordDtos.Topic;
import com.deutschflow.vocabulary.saved.SavedWordDtos.TopicRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Sổ từ riêng của học viên (13/11/2026). Lưu từ khi luyện đề đọc; lưu xong tự vào lịch ôn.
 *
 * <ul>
 *   <li>{@code POST /api/my-words} — lưu chữ đã bôi đen (1–5 từ). Đã có ⇒ 200 + {@code alreadySaved}.
 *       Chữ sai ⇒ 400; quá trần tra AI trong ngày ⇒ 429; AI không trả lời được ⇒ 503.</li>
 *   <li>{@code GET /api/my-words} — cả sổ, mới nhất trước, kèm vị trí trong bài.</li>
 *   <li>{@code GET /api/my-words/topics} — bộ chủ đề sẵn của kho (để chuyển chủ đề).</li>
 *   <li>{@code PUT /api/my-words/{id}/topic} — chuyển chủ đề ({@code null} = chưa phân loại; tên lạ ⇒ 400).</li>
 *   <li>{@code PUT /api/my-words/{id}/meaning} — sửa nghĩa (thẻ ôn do sổ tạo đổi theo).</li>
 *   <li>{@code DELETE /api/my-words/{id}} — gỡ khỏi sổ + gỡ thẻ ôn. Không phải của mình ⇒ 404.</li>
 * </ul>
 * {@code locale} (vi / en / de) chỉ đổi nhãn chủ đề trả về.
 */
@RestController
@RequestMapping("/api/my-words")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class SavedWordController {

    private final SavedWordService service;

    @PostMapping
    public SavedWord save(@RequestBody SaveRequest body,
                          @RequestParam(required = false) String locale,
                          @AuthenticationPrincipal User user) {
        return service.save(user.getId(), body, locale);
    }

    @GetMapping
    public SavedWordList list(@RequestParam(required = false) String locale, @AuthenticationPrincipal User user) {
        return service.list(user.getId(), locale);
    }

    @GetMapping("/topics")
    public List<Topic> topics(@RequestParam(required = false) String locale) {
        return service.topics(locale);
    }

    @PutMapping("/{id}/topic")
    public SavedWord setTopic(@PathVariable long id, @RequestBody TopicRequest body,
                              @RequestParam(required = false) String locale,
                              @AuthenticationPrincipal User user) {
        return service.setTopic(user.getId(), id, body == null ? null : body.topic(), locale);
    }

    @PutMapping("/{id}/meaning")
    public SavedWord setMeaning(@PathVariable long id, @RequestBody MeaningRequest body,
                                @RequestParam(required = false) String locale,
                                @AuthenticationPrincipal User user) {
        return service.setMeaning(user.getId(), id, body == null ? null : body.meaning(), locale);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable long id, @AuthenticationPrincipal User user) {
        service.remove(user.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
