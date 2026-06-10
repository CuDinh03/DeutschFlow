package com.deutschflow.organization.dto;

import java.util.List;

/** Kết quả import danh sách học viên qua CSV (POST /api/org/students/import). */
public record RosterImportResultDto(
        int total,
        int created,
        int linked,
        int enrolled,
        int failed,
        List<String> errors
) {}
