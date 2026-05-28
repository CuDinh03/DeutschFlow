package com.deutschflow.grammar.dto;


public class GrammarCaseExerciseDto {
    public GrammarCaseExerciseDto() {}

    public GrammarCaseExerciseDto(Long id, Long caseId, Integer difficultyLevel, String exerciseType, String question, String correctAnswer, String explanation) {
        this.id = id;
        this.caseId = caseId;
        this.difficultyLevel = difficultyLevel;
        this.exerciseType = exerciseType;
        this.question = question;
        this.correctAnswer = correctAnswer;
        this.explanation = explanation;
    }
    public Long getId() { return this.id; }
    public Long getCaseId() { return this.caseId; }
    public Integer getDifficultyLevel() { return this.difficultyLevel; }
    public String getExerciseType() { return this.exerciseType; }
    public String getQuestion() { return this.question; }
    public String getCorrectAnswer() { return this.correctAnswer; }
    public String getExplanation() { return this.explanation; }
    public void setId(Long id) { this.id = id; }
    public void setCaseId(Long caseId) { this.caseId = caseId; }
    public void setDifficultyLevel(Integer difficultyLevel) { this.difficultyLevel = difficultyLevel; }
    public void setExerciseType(String exerciseType) { this.exerciseType = exerciseType; }
    public void setQuestion(String question) { this.question = question; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private Long caseId;
        private Integer difficultyLevel;
        private String exerciseType;
        private String question;
        private String correctAnswer;
        private String explanation;
        public Builder id(Long id) { this.id = id; return this; }
        public Builder caseId(Long caseId) { this.caseId = caseId; return this; }
        public Builder difficultyLevel(Integer difficultyLevel) { this.difficultyLevel = difficultyLevel; return this; }
        public Builder exerciseType(String exerciseType) { this.exerciseType = exerciseType; return this; }
        public Builder question(String question) { this.question = question; return this; }
        public Builder correctAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; return this; }
        public Builder explanation(String explanation) { this.explanation = explanation; return this; }
        public GrammarCaseExerciseDto build() { return new GrammarCaseExerciseDto(id, caseId, difficultyLevel, exerciseType, question, correctAnswer, explanation); }
    }

    private Long id;
    private Long caseId;
    private Integer difficultyLevel;    // 1=A1, 2=A2, 3=B1
    private String exerciseType;        // article_selection, noun_declension, sentence_fill, case_identification
    private String question;
    private String correctAnswer;
    private String explanation;
}
