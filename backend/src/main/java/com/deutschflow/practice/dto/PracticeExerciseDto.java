package com.deutschflow.practice.dto;

import com.deutschflow.practice.entity.PracticeExercise;

public class PracticeExerciseDto {
    private Long id;
    private String exerciseType;
    private String cefrLevel;
    private String skillType;
    private String examName;
    private String contentJson;
    private String sourceName;
    private String sourceUrl;
    private Integer xpReward;

    public PracticeExerciseDto() {}

    public PracticeExerciseDto(PracticeExercise entity) {
        this.id = entity.getId();
        this.exerciseType = entity.getExerciseType();
        this.cefrLevel = entity.getCefrLevel();
        this.skillType = entity.getSkillType();
        this.examName = entity.getExamName();
        this.contentJson = entity.getContentJson();
        this.sourceName = entity.getSourceName();
        this.sourceUrl = entity.getSourceUrl();
        this.xpReward = entity.getXpReward();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getExerciseType() { return exerciseType; }
    public void setExerciseType(String exerciseType) { this.exerciseType = exerciseType; }
    public String getCefrLevel() { return cefrLevel; }
    public void setCefrLevel(String cefrLevel) { this.cefrLevel = cefrLevel; }
    public String getSkillType() { return skillType; }
    public void setSkillType(String skillType) { this.skillType = skillType; }
    public String getExamName() { return examName; }
    public void setExamName(String examName) { this.examName = examName; }
    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }
    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public Integer getXpReward() { return xpReward; }
    public void setXpReward(Integer xpReward) { this.xpReward = xpReward; }
}
