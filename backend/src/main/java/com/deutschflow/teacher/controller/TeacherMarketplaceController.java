package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.TeacherProfileDto;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.common.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/teachers")
@RequiredArgsConstructor
public class TeacherMarketplaceController {

    private final TeacherProfileRepository teacherProfileRepository;

    @GetMapping("/public")
    public ResponseEntity<Page<TeacherProfileDto>> getPublicTeachers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "featured", "id"));
        Page<TeacherProfile> profiles = teacherProfileRepository.findAllWithUser(pageRequest);
        
        Page<TeacherProfileDto> dtos = profiles.map(this::toDto);
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TeacherProfileDto> getTeacherProfile(@PathVariable Long id) {
        TeacherProfile profile = teacherProfileRepository.findByIdWithUser(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ chuyên gia"));
        return ResponseEntity.ok(toDto(profile));
    }

    private TeacherProfileDto toDto(TeacherProfile profile) {
        return TeacherProfileDto.builder()
                .id(profile.getId())
                .userId(profile.getUser().getId())
                .name(profile.getUser().getDisplayName())
                .email(profile.getUser().getEmail())
                .headline(profile.getHeadline())
                .bio(profile.getBio())
                .qualifications(profile.getQualifications())
                .featured(profile.isFeatured())
                .build();
    }
}
