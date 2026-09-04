package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.WordCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordFacetsResponse;
import com.deutschflow.vocabulary.dto.WordCoverageResponse;
import com.deutschflow.vocabulary.dto.WordLevelCountsResponse;
import com.deutschflow.vocabulary.dto.WordListResponse;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.service.WordQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/words")
@RequiredArgsConstructor
public class WordController {

    private final WordQueryService wordQueryService;

    @GetMapping
    public WordListResponse list(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String cefr,
            // false (mặc định) = cộng dồn A1..cefr — giữ nguyên hành vi cũ cho mobile và web v1.
            // true = đúng một cấp; cefr=UNGRADED = từ chưa phân cấp.
            @RequestParam(name = "exact", defaultValue = "false") boolean cefrExact,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String focus,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String dtype,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Long userId = user != null ? user.getId() : null;
        return wordQueryService.listWords(
                userId, cefr, cefrExact, q, topic, focus, tag, dtype, gender, status, locale, page, size);
    }

    /**
     * Số từ theo từng cấp (kể cả UNGRADED).
     *
     * <p>Hub /v2 nay dùng {@link #facets} — endpoint này giữ lại cho các bản client cũ còn gọi.
     */
    @GetMapping("/levels")
    public WordLevelCountsResponse levels() {
        return wordQueryService.levelCounts();
    }

    /**
     * Số từ theo TỪNG TRỤC lọc — trạng thái học, từ loại, mạo từ, cấp độ và chủ đề — mỗi trục đã tính
     * giao với các bộ lọc khác đang bật. Nhận đúng bộ tham số như {@link #list}, trừ phân trang.
     */
    @GetMapping("/facets")
    public WordFacetsResponse facets(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String cefr,
            @RequestParam(name = "exact", defaultValue = "false") boolean cefrExact,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String focus,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String dtype,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String locale
    ) {
        Long userId = user != null ? user.getId() : null;
        return wordQueryService.facets(userId, cefr, cefrExact, q, topic, focus, tag, dtype, gender, status, locale);
    }

    /**
     * Bộ thẻ cho một lượt luyện — đến hạn ôn trước, rồi từ chưa học theo dải tần suất, trộn theo ngày.
     *
     * <p>Thay kiểu gọi cũ {@code /words?page=0&size=20}: trang 0 của danh sách là bất biến (sắp theo cấp rồi
     * alphabet) nên ba bài luyện lặp lại đúng một bộ thẻ. {@code mode=ARTICLE} thêm ràng buộc danh từ có mạo từ.
     */
    @GetMapping("/deck")
    public WordListResponse deck(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "SWIPE") String mode,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String cefr,
            // false (mặc định) = cộng dồn A1..cefr, khớp cách ba bài luyện vốn nhận một mức sàn.
            @RequestParam(name = "exact", defaultValue = "false") boolean cefrExact,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String focus,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String locale
    ) {
        Long userId = user != null ? user.getId() : null;
        return wordQueryService.deck(userId, mode, size, cefr, cefrExact, topic, focus, tag, locale);
    }

    @GetMapping("/coverage")
    public WordCoverageResponse coverage() {
        return wordQueryService.coverage();
    }

    @GetMapping("/coverage/history")
    public WordCoverageHistoryResponse coverageHistory(
            @RequestParam(defaultValue = "30") int days
    ) {
        return wordQueryService.coverageHistory(days);
    }

    @GetMapping("/coverage/translation")
    public WordTranslationCoverageResponse translationCoverage() {
        return wordQueryService.translationCoverage();
    }

    @GetMapping("/coverage/translation/history")
    public WordTranslationCoverageHistoryResponse translationCoverageHistory(
            @RequestParam(defaultValue = "30") int days
    ) {
        return wordQueryService.translationCoverageHistory(days);
    }
}

