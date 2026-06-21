package com.deutschflow.organization.dto;

/** Một lớp (thuộc tổ chức) mà học viên đang theo học — dùng trong org student-detail. */
public record OrgStudentClassDto(
        Long classId,
        String name
) {}
