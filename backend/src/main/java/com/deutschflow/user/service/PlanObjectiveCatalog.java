package com.deutschflow.user.service;

import com.deutschflow.user.entity.UserLearningProfile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Localized blueprint strings for weekly plan objectives ({@code en}, {@code vi}, {@code de}).
 */
public final class PlanObjectiveCatalog {

    private PlanObjectiveCatalog() {}

    private static Map<String, String> triple(String en, String vi, String de) {
        return Map.of(
                "en", en,
                "vi", vi,
                "de", de);
    }

    public static List<Map<String, String>> weekObjectives(int weekNumber,
                                                           UserLearningProfile.GoalType goalType) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(triple(
                "Build habit: complete all scheduled sessions",
                "Xây thói quen: hoàn thành mọi buổi học trong lịch",
                "Gewohnheit aufbauen: alle geplanten Lektionen abschließen"
        ));

        if (goalType == UserLearningProfile.GoalType.WORK) {
            rows.add(triple(
                    "Learn job-relevant vocabulary for your industry",
                    "Học từ vựng liên quan công việc trong ngành của bạn",
                    "Berufsrelevante Vokabeln für deine Branche lernen"
            ));
            rows.add(triple(
                    "Practice short dialogues for real situations",
                    "Luyện hội thoại ngắn cho tình huống thực tế",
                    "Kurze Dialoge für reale Situationen üben"
            ));
        } else {
            rows.add(triple(
                    "Cover core grammar points for the exam level",
                    "Ôn điểm ngữ pháp trọng tâm theo trình độ thi",
                    "Kerngrammatik für dein Prüfungsniveau abdecken"
            ));
            rows.add(triple(
                    "Practice listening/reading in exam-like format",
                    "Luyện nghe và đọc theo định dạng gần với đề thi",
                    "Hör- und Leseverständnis wie in der Prüfung üben"
            ));
        }

        if (weekNumber <= 2) {
            rows.add(triple(
                    "Establish A1 foundations (basic phrases, articles, sentence order)",
                    "Khởi động trình độ A1 (cụm cơ bản, mạo từ, trật tự câu)",
                    "Grundlagen A1 sichern (Grundwendungen, Artikel, Satzstellung)"
            ));
        } else if (weekNumber % 4 == 0) {
            rows.add(triple(
                    "Checkpoint: review + mini test",
                    "Điểm kiểm: ôn tập và mini test",
                    "Checkpoint: Kurz-Wiederholung und Mini-Test"
            ));
        }

        return rows;
    }
}
