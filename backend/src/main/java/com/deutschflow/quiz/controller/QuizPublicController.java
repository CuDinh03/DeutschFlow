package com.deutschflow.quiz.controller;

import com.deutschflow.quiz.service.QuizJoinService;
import com.deutschflow.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/quiz")
@RequiredArgsConstructor
public class QuizPublicController {
    private final QuizJoinService quizJoinService;

    @PostMapping("/{pinCode}/join")
    public Map<String, Object> join(
            @PathVariable String pinCode,
            @Valid @RequestBody JoinRequest req,
            Authentication authentication
    ) {
        User user = null;
        if (authentication != null && authentication.getPrincipal() instanceof User u) {
            user = u;
        }
        return quizJoinService.joinByPin(pinCode, req.nickname(), user);
    }

    @PostMapping("/{quizId}/submit")
    public void submit(@PathVariable Long quizId,
                       @Valid @RequestBody SubmitScoreRequest req,
                       Authentication authentication,
                       HttpServletRequest request) {
        String guestPin = null;
        if (authentication != null && authentication.getPrincipal() instanceof String s && s.startsWith("guest:")) {
            Object attr = request.getAttribute("guestPinCode");
            guestPin = attr != null ? attr.toString() : null;
        }
        quizJoinService.submitScore(authentication, quizId, req.participant(), req.totalScore(), guestPin);
    }

    public record JoinRequest(@NotBlank(message = "nickname is required") String nickname) {}

    public record SubmitScoreRequest(
            @NotBlank(message = "participant is required") String participant,
            @NotNull(message = "totalScore is required") Integer totalScore
    ) {}
}

