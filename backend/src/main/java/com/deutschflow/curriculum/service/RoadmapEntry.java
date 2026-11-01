package com.deutschflow.curriculum.service;

/**
 * Điểm bắt đầu trên giáo trình 55 ngày theo trình độ học viên khai. Node trước điểm này không thuộc
 * lộ trình của học viên: không hiện, và không chặn bài ở điểm vào. Ngày/tuần hiển thị đếm từ đây,
 * nên tài khoản mới luôn thấy "Ngày 1" dù đang đứng giữa giáo trình.
 *
 * <p>A1 bỏ 10 ngày nền tảng (bảng chữ cái, số đếm…). B2 trở lên chưa có giáo trình riêng nên dùng
 * cấp cao nhất đang có. Thêm giáo trình cấp mới thì sửa tại đây.
 */
record RoadmapEntry(int day, int week) {

    static RoadmapEntry forLevel(String level) {
        if (level == null) {
            return new RoadmapEntry(1, 1);
        }
        return switch (level) {
            case "A1" -> new RoadmapEntry(11, 3);
            case "A2" -> new RoadmapEntry(31, 8);
            case "B1", "B2", "C1", "C2" -> new RoadmapEntry(51, 13);
            default -> new RoadmapEntry(1, 1);
        };
    }

    int dayShift() {
        return day - 1;
    }

    int weekShift() {
        return week - 1;
    }
}
