package com.deutschflow.teacher.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeacherProfileDto {
    private Long id;
    private Long userId;
    private String name;
    private String email;
    private String headline;
    private String bio;
    private String qualifications;
    private boolean featured;
}
