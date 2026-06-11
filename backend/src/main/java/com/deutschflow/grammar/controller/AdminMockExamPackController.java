package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.CreateMockExamPackRequest;
import com.deutschflow.grammar.dto.MockExamPackAdminDto;
import com.deutschflow.grammar.dto.UpdateMockExamPackRequest;
import com.deutschflow.grammar.service.AdminMockExamPackService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ADMIN curation of mock-exam packs (D3): create / update / retire packs without raw SQL. Mirrors
 * the thin-controller style of {@code AdminOrganizationController} (delegates to the service).
 */
@RestController
@RequestMapping("/api/admin/mock-exam-packs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMockExamPackController {

    private final AdminMockExamPackService adminMockExamPackService;

    @GetMapping
    public List<MockExamPackAdminDto> list() {
        return adminMockExamPackService.list();
    }

    @PostMapping
    public MockExamPackAdminDto create(@RequestBody CreateMockExamPackRequest request) {
        return adminMockExamPackService.create(request);
    }

    @PatchMapping("/{id}")
    public MockExamPackAdminDto update(@PathVariable Long id, @RequestBody UpdateMockExamPackRequest request) {
        return adminMockExamPackService.update(id, request);
    }

    /** Soft-delete: retire the pack from the student catalog. */
    @DeleteMapping("/{id}")
    public MockExamPackAdminDto deactivate(@PathVariable Long id) {
        return adminMockExamPackService.deactivate(id);
    }
}
