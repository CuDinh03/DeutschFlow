package com.deutschflow.practice.dto;

public class PracticeSubmitRequest {
    private Long practiceId;
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
