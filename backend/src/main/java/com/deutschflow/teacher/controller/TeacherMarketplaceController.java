package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.TeacherProfileDto;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

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
        // Org teachers are excluded from the public marketplace (B2B decision 2026-06-10).
        Page<TeacherProfile> profiles = teacherProfileRepository.findPublicWithUser(pageRequest);
        return ResponseEntity.ok(profiles.map(this::toDto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TeacherProfileDto> getTeacherProfile(@PathVariable Long id) {
        TeacherProfile profile = teacherProfileRepository.findByIdWithUser(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hồ sơ chuyên gia"));
        // An org teacher's profile is not part of the public marketplace — hide it from direct access too.
        if (profile.getUser().getOrgId() != null) {
            throw new NotFoundException("Không tìm thấy hồ sơ chuyên gia");
        }
        return ResponseEntity.ok(toDto(profile));
    }

    /**
     * PUT /api/v2/teachers/profile
     * Giáo viên tự cập nhật hồ sơ công khai (headline, bio, qualifications).
     * Nếu chưa có profile → tự động tạo mới.
     */
    @PutMapping("/profile")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<TeacherProfileDto> updateMyProfile(
            @AuthenticationPrincipal User user,
            @RequestBody @Valid UpdateProfileRequest request) {

        // Org teachers don't have a public marketplace presence.
        if (user.getOrgId() != null) {
            throw new ForbiddenException("Giáo viên thuộc tổ chức không sử dụng marketplace 1-1");
        }

        TeacherProfile profile = teacherProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    TeacherProfile newProfile = new TeacherProfile();
                    newProfile.setUser(user);
                    newProfile.setHeadline("");
                    newProfile.setCreatedAt(LocalDateTime.now());
                    return newProfile;
                });

        if (request.headline() != null) profile.setHeadline(request.headline().trim());
        if (request.bio() != null) profile.setBio(request.bio().trim());
        if (request.qualifications() != null) profile.setQualifications(request.qualifications().trim());
        if (request.hourlyRateVnd() != null && request.hourlyRateVnd() > 0) profile.setHourlyRateVnd(request.hourlyRateVnd());
        if (request.maxStudentsPerWeek() != null && request.maxStudentsPerWeek() > 0) profile.setMaxStudentsPerWeek(request.maxStudentsPerWeek());
        profile.setUpdatedAt(LocalDateTime.now());

        TeacherProfile saved = teacherProfileRepository.save(profile);
        return ResponseEntity.ok(toDto(saved));
    }

    // ─── Request record ───────────────────────────────────────────────────────

    public record UpdateProfileRequest(
            @Size(max = 280) String headline,
            @Size(max = 5000) String bio,
            @Size(max = 5000) String qualifications,
            Long hourlyRateVnd,
            Integer maxStudentsPerWeek
    ) {}

    // ─── Mapper ───────────────────────────────────────────────────────────────

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
                .hourlyRateVnd(profile.getHourlyRateVnd())
                .maxStudentsPerWeek(profile.getMaxStudentsPerWeek())
                .build();
    }
}
