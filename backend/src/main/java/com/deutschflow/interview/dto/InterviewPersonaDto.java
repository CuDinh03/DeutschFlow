package com.deutschflow.interview.dto;

import com.deutschflow.interview.entity.InterviewPersonaEntity;

public record InterviewPersonaDto(
        String code,
        String label,
        String industry,
        String roleTitle,
        String tone,
        String difficulty,
        String questionStyle,
        String evaluationBias,
        int version
) {
    public static InterviewPersonaDto from(InterviewPersonaEntity entity) {
        return new InterviewPersonaDto(
                entity.getCode(),
                entity.getLabel(),
                entity.getIndustry(),
                entity.getRoleTitle(),
                entity.getTone(),
                entity.getDifficulty(),
                entity.getQuestionStyle(),
                entity.getEvaluationBias(),
                entity.getVersion()
        );
    }
}
