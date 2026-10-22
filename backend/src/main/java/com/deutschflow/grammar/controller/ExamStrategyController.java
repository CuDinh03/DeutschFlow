package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.service.ExamStrategyCatalog;
import com.deutschflow.grammar.service.ExamStrategyCatalog.StrategyDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

/**
 * Chiến thuật từng Teil cho đề thi thử và phòng thi Nói (LT2, 22/10/2026). Nội dung chưa duyệt chỉ
 * admin/giáo viên thấy; học viên nhận {@code COMING_SOON}.
 */
@RestController
@RequestMapping("/api/exam-strategies")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ExamStrategyController {

    private static final Set<String> REVIEWER_ROLES = Set.of("ROLE_ADMIN", "ROLE_TEACHER");

    private final ExamStrategyCatalog catalog;

    @GetMapping
    public List<StrategyDto> list(@RequestParam String provider,
                                  @RequestParam String level,
                                  @RequestParam(defaultValue = "vi") String lang,
                                  Authentication authentication) {
        return catalog.forExam(provider, level, lang, isReviewer(authentication));
    }

    static boolean isReviewer(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> REVIEWER_ROLES.contains(a.getAuthority()));
    }
}
