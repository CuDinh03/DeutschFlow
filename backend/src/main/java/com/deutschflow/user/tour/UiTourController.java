package com.deutschflow.user.tour;

import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Hướng dẫn lần đầu đã xem: {@code GET /api/auth/me/tours}, {@code PUT /api/auth/me/tours/{key}}. */
@RestController
@RequestMapping("/api/auth/me/tours")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UiTourController {

    private final UiTourService service;

    public record ToursView(List<String> seen) {}

    @GetMapping
    public ToursView seen(@AuthenticationPrincipal User user) {
        return new ToursView(service.seen(user.getId()));
    }

    @PutMapping("/{key}")
    public ToursView markSeen(@AuthenticationPrincipal User user, @PathVariable String key) {
        return new ToursView(service.markSeen(user.getId(), key));
    }
}
