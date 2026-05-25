package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.WeeklySpeakingAdminService;
import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/speaking/weekly-prompts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class WeeklySpeakingAdminController {

    private final WeeklySpeakingAdminService weeklySpeakingAdminService;

    @GetMapping
    public List<Map<String, Object>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return weeklySpeakingAdminService.listPrompts(weekStart);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable long id) {
        return weeklySpeakingAdminService.getPrompt(id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @Valid @RequestBody WeeklySpeakingDtos.WeeklyPromptAdminUpsertRequest body
    ) throws Exception {
        long id = weeklySpeakingAdminService.createPrompt(body);
        return ResponseEntity.status(201).body(Map.of("id", id));
    }

    @PutMapping("/{id}")
    public Map<String, Object> replace(
            @PathVariable long id,
            @Valid @RequestBody WeeklySpeakingDtos.WeeklyPromptAdminUpsertRequest body
    ) throws Exception {
        return weeklySpeakingAdminService.updatePrompt(id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable long id) {
        weeklySpeakingAdminService.deactivatePrompt(id);
    }
}
