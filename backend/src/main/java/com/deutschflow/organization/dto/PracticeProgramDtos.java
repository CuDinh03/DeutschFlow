package com.deutschflow.organization.dto;

import java.time.LocalDate;

/** DTO của chương trình luyện theo lớp (đặc tả luyendeu ORG-50/51/65). */
public final class PracticeProgramDtos {

    private PracticeProgramDtos() {
    }

    /** Khai hoặc sửa. Trường null ⇒ dùng mặc định (weeks 6, target 3, required 4). */
    public record SaveRequest(LocalDate startDate, Integer weeks, Integer targetPerWeek, Integer weeksRequired) {
    }

    /**
     * @param currentWeek tuần chương trình chứa hôm nay (1…weeks); 0 = chưa bắt đầu; weeks+1 = đã kết thúc
     * @param locked      true khi tuần 1 đã qua: không đổi được ngày bắt đầu, chỉ tiêu, số tuần yêu cầu (ORG-51)
     */
    public record ProgramDto(Long classId, LocalDate startDate, int weeks, int targetPerWeek, int weeksRequired,
                             LocalDate endDate, int currentWeek, boolean locked) {
    }

    /** Cờ cho màn luyện nói của học viên: true ⇒ ẩn ô gõ (ORG-65, BR-luyendeu-15). */
    public record PracticeModeDto(boolean speakOnly) {
    }
}
