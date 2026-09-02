package com.deutschflow.interview.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.interview.dto.InterviewPersonaDto;
import com.deutschflow.interview.dto.InterviewRubricDto;
import com.deutschflow.interview.dto.InterviewRubricUpdateRequest;
import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.entity.InterviewRubricTemplate;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/interviews")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class InterviewAdminController {

    private final InterviewPersonaRepository personaRepository;
    private final InterviewRubricTemplateRepository rubricRepository;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;

    @GetMapping("/personas")
    public ResponseEntity<List<InterviewPersonaDto>> listAllPersonas() {
        return ResponseEntity.ok(
                personaRepository.findAll().stream()
                        .map(InterviewPersonaDto::from)
                        .toList());
    }

    @PatchMapping("/personas/{code}/toggle")
    public ResponseEntity<InterviewPersonaDto> togglePersona(@PathVariable String code) {
        InterviewPersonaEntity persona = personaRepository.findByCodeAndActiveTrue(code)
                .or(() -> personaRepository.findAll().stream()
                        .filter(p -> p.getCode().equals(code))
                        .findFirst())
                .orElseThrow(() -> new NotFoundException("Persona not found: " + code));
        persona.setActive(!persona.isActive());
        personaRepository.save(persona);
        return ResponseEntity.ok(InterviewPersonaDto.from(persona));
    }

    @GetMapping("/rubrics")
    public ResponseEntity<List<InterviewRubricDto>> listRubrics() {
        return ResponseEntity.ok(
                rubricRepository.findAll().stream()
                        .map(InterviewRubricDto::from)
                        .toList());
    }

    @PutMapping("/rubrics/{id}")
    public ResponseEntity<InterviewRubricDto> updateRubric(
            @PathVariable Long id,
            @RequestBody InterviewRubricUpdateRequest req,
            Authentication authentication) {
        InterviewRubricTemplate rubric = rubricRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Rubric not found: " + id));
        // Validate the JSON before persisting — a malformed string silently breaks interview grading
        // downstream (the consumer parses these), and the change was previously unaudited (A-8).
        if (req.criteriaJson() != null) rubric.setCriteriaJson(requireJson(req.criteriaJson(), "criteriaJson"));
        if (req.weightJson() != null)   rubric.setWeightJson(requireJson(req.weightJson(), "weightJson"));
        rubric.setVersion(rubric.getVersion() + 1);
        InterviewRubricTemplate saved = rubricRepository.save(rubric);
        auditLogService.log(
                "admin.interview.rubric.updated",
                AuditActor.ofAuthentication(authentication),
                "INTERVIEW_RUBRIC",
                String.valueOf(id),
                Map.of("version", saved.getVersion()));
        return ResponseEntity.ok(InterviewRubricDto.from(saved));
    }

    private String requireJson(String raw, String field) {
        try {
            objectMapper.readTree(raw);
            return raw;
        } catch (Exception e) {
            throw new BadRequestException(field + " không phải JSON hợp lệ.");
        }
    }

}
