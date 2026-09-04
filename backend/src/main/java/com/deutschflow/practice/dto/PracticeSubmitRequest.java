package com.deutschflow.practice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class PracticeSubmitRequest {
    @NotNull
    private Long practiceId;

    // Client self-report; only honoured for answer-less external exercises and always clamped
    // server-side. Bounded here so a malformed value returns 400 instead of hitting a DB constraint.
    @Min(0)
    @Max(100)
    private Integer scorePercent;

    private String answerDataJson;

    public PracticeSubmitRequest() {}

    public Long getPracticeId() { return practiceId; }
    public void setPracticeId(Long practiceId) { this.practiceId = practiceId; }

    public Integer getScorePercent() { return scorePercent; }
    public void setScorePercent(Integer scorePercent) { this.scorePercent = scorePercent; }

    public String getAnswerDataJson() { return answerDataJson; }
    public void setAnswerDataJson(String answerDataJson) { this.answerDataJson = answerDataJson; }
}
