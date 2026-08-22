package com.deutschflow.examspeaking.api.model;

import java.util.List;
import java.util.Optional;

/** Định nghĩa kỳ thi của một hệ × cấp (điều phối + quy điểm). Bất biến. */
public record ExamBlueprint(
        long id,
        ExamProvider provider,
        String level,
        int version,
        String title,
        int prepSec,
        List<BlueprintPart> parts,
        RubricDefinition rubric
) {
    public ExamBlueprint {
        parts = parts == null ? List.of() : List.copyOf(parts);
    }

    public Optional<BlueprintPart> part(int teilNo) {
        return parts.stream().filter(p -> p.teilNo() == teilNo).findFirst();
    }

    public RubricRef rubricRef() {
        return new RubricRef(provider, level, version);
    }
}
