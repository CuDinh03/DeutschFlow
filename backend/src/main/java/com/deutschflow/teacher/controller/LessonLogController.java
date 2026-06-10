package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.service.LessonLogService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/teacher/classes/{classId}/lesson-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class LessonLogController {

    private final LessonLogService lessonLogService;

    @GetMapping
    public List<ClassLessonLogDto> getLogs(@AuthenticationPrincipal User teacher,
                                            @PathVariable Long classId) {
        return lessonLogService.getLogs(teacher.getId(), classId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClassLessonLogDto createLog(@AuthenticationPrincipal User teacher,
                                        @PathVariable Long classId,
                                        @RequestBody CreateLessonLogRequest req) {
        return lessonLogService.createLog(teacher.getId(), classId, req);
    }

    @PutMapping("/{logId}")
    public ClassLessonLogDto updateLog(@AuthenticationPrincipal User teacher,
                                        @PathVariable Long classId,
                                        @PathVariable Long logId,
                                        @RequestBody CreateLessonLogRequest req) {
        return lessonLogService.updateLog(teacher.getId(), classId, logId, req);
    }

    @DeleteMapping("/{logId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLog(@AuthenticationPrincipal User teacher,
                           @PathVariable Long classId,
                           @PathVariable Long logId) {
        lessonLogService.deleteLog(teacher.getId(), classId, logId);
    }
}
