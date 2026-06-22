package com.deutschflow.teacher.dto;

import java.util.List;

/** Kết quả lưu một buổi: buổi sau khi lưu + cảnh báo trùng phòng (mềm, không chặn). */
public record SessionSaveResult(
        ClassSessionDto session,
        List<String> roomWarnings
) {}
