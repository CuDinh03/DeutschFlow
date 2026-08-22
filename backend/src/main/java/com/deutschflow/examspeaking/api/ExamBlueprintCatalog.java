package com.deutschflow.examspeaking.api;

import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;

import java.util.List;
import java.util.Optional;

/**
 * Contract public #1 (kế hoạch 2.9): đọc định nghĩa kỳ thi. Tính năng B2B nói đôi chỉ đọc qua đây,
 * không chạm bảng.
 */
public interface ExamBlueprintCatalog {

    Optional<ExamBlueprint> find(ExamProvider provider, String level);

    Optional<ExamBlueprint> findById(long blueprintId);

    List<ExamBlueprint> listActive();
}
