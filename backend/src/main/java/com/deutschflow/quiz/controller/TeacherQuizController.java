package com.deutschflow.quiz.controller;

import com.deutschflow.quiz.service.TeacherQuizService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher/quizzes")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class TeacherQuizController {
    private final TeacherQuizService teacherQuizService;

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal User teacher) {
        return teacherQuizService.listQuizzes(teacher.getId());
    }

    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal User teacher, @Valid @RequestBody QuizRequest req) {
        return teacherQuizService.createQuiz(teacher.getId(), req.title(), req.quizType(), req.classroomId());
    }

    @GetMapping("/{quizId}")
    public Map<String, Object> detail(@AuthenticationPrincipal User teacher, @PathVariable Long quizId) {
        return teacherQuizService.getQuizDetail(teacher.getId(), quizId);
    }

    @PutMapping("/{quizId}")
    public Map<String, Object> update(@AuthenticationPrincipal User teacher, @PathVariable Long quizId, @Valid @RequestBody QuizRequest req) {
        return teacherQuizService.updateQuiz(teacher.getId(), quizId, req.title(), req.quizType(), req.classroomId());
    }

    @DeleteMapping("/{quizId}")
    public void delete(@AuthenticationPrincipal User teacher, @PathVariable Long quizId) {
        teacherQuizService.deleteQuiz(teacher.getId(), quizId);
    }

    @PostMapping("/{quizId}/questions")
    public void addQuestion(@AuthenticationPrincipal User teacher, @PathVariable Long quizId, @Valid @RequestBody QuestionRequest req) {
        List<Map<String, Object>> choices = req.choices().stream()
                .map(c -> Map.<String, Object>of("content", c.content(), "isCorrect", c.isCorrect()))
                .toList();
        teacherQuizService.addQuestion(teacher.getId(), quizId, req.question(), req.timeLimit(), req.position(), choices);
    }

    @PostMapping("/{quizId}/publish")
    public void publish(@AuthenticationPrincipal User teacher, @PathVariable Long quizId) {
        teacherQuizService.updateStatus(teacher.getId(), quizId, "WAITING");
    }

    @PostMapping("/{quizId}/start")
    public void start(@AuthenticationPrincipal User teacher, @PathVariable Long quizId) {
        teacherQuizService.updateStatus(teacher.getId(), quizId, "ACTIVE");
    }

    @PostMapping("/{quizId}/finish")
    public void finish(@AuthenticationPrincipal User teacher, @PathVariable Long quizId) {
        teacherQuizService.updateStatus(teacher.getId(), quizId, "FINISHED");
    }

    @GetMapping("/{quizId}/results")
    public List<Map<String, Object>> results(@AuthenticationPrincipal User teacher, @PathVariable Long quizId) {
        return teacherQuizService.listResults(teacher.getId(), quizId);
    }

    public record QuizRequest(
            @NotBlank(message = "title is required") String title,
            @NotBlank(message = "quizType is required") String quizType,
            Long classroomId
    ) {}

    public record QuestionRequest(
            @NotBlank(message = "question is required") String question,
            @Min(value = 5, message = "timeLimit must be >= 5") @Max(value = 120, message = "timeLimit must be <= 120") Integer timeLimit,
            @Min(value = 1, message = "position must be >= 1") Integer position,
            List<ChoiceRequest> choices
    ) {}

    public record ChoiceRequest(
            @NotBlank(message = "content is required") String content,
            boolean isCorrect
    ) {}
}

