package com.deutschflow.examspeaking.api.model;

import java.util.List;

/**
 * Đầu vào chấm cho MỘT thí sinh (contract với tính năng B2B nói đôi: mỗi người một bundle, partner là
 * ngữ cảnh). {@code partnerKind} = AI | HUMAN — grader được dặn không trừ điểm vì partner yếu khi là người.
 */
public record ParticipantBundle(
        RubricRef rubricRef,
        List<PartTranscript> parts,
        String partnerKind,
        String candidateLabel
) {
    public ParticipantBundle {
        parts = parts == null ? List.of() : List.copyOf(parts);
    }

    /** Lượt nói của thí sinh + ngữ cảnh partner/giám khảo trong một Teil. */
    public record PartTranscript(
            int teilNo,
            TaskArchetype archetype,
            String taskDescription,
            List<Utterance> candidate,
            List<Utterance> others
    ) {
        public PartTranscript {
            candidate = candidate == null ? List.of() : List.copyOf(candidate);
            others = others == null ? List.of() : List.copyOf(others);
        }
    }
}
