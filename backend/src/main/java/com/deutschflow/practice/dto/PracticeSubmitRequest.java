package com.deutschflow.practice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class PracticeSubmitRequest {
    @NotNull
    private Long practiceId;

    // A2 (09/11/2026): IGNORED by the server — score is graded from the stored answer key, external
    // exercises get a fixed XP. Kept (with its old bounds) only so existing clients don't get a 400.
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
