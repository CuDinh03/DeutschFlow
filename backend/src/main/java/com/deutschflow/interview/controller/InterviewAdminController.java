package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.InterviewPersonaDto;
import com.deutschflow.interview.dto.InterviewRubricUpdateRequest;
import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.entity.InterviewRubricTemplate;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import com.deutschflow.common.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin-only endpoints for managing interview personas and rubric templates.
 * Used for Phase 3 rubric weight tuning and persona lifecycle management.
 */
@RestController
@RequestMapping("/api/admin/interviews")
@RequiredArgsConstructor
public class InterviewAdminController {

    private final InterviewPersonaRepository personaRepository;
    private final InterviewRubricTemplateRepository rubricRepository;

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
    public ResponseEntity<List<InterviewRubricTemplate>> listRubrics() {
        return ResponseEntity.ok(rubricRepository.findAll());
    }

    @PutMapping("/rubrics/{id}")
    public ResponseEntity<InterviewRubricTemplate> updateRubric(
            @PathVariable Long id,
            @RequestBody InterviewRubricUpdateRequest req) {
        InterviewRubricTemplate rubric = rubricRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Rubric not found: " + id));
        if (req.criteriaJson() != null) rubric.setCriteriaJson(req.criteriaJson());
        if (req.weightJson() != null)   rubric.setWeightJson(req.weightJson());
        rubric.setVersion(rubric.getVersion() + 1);
        return ResponseEntity.ok(rubricRepository.save(rubric));
    }
}
