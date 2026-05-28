package com.deutschflow.grammar.dto;


import java.util.List;

public class GrammarCaseDto {
    public GrammarCaseDto() {}

    public GrammarCaseDto(Long id, String caseName, String caseLabel, String englishDescription, String germanDescription, String questionWords, List<GrammarCaseExampleDto> examples, List<GrammarCaseExerciseDto> exercises) {
        this.id = id;
        this.caseName = caseName;
        this.caseLabel = caseLabel;
        this.englishDescription = englishDescription;
        this.germanDescription = germanDescription;
        this.questionWords = questionWords;
        this.examples = examples;
        this.exercises = exercises;
    }
    public Long getId() { return this.id; }
    public String getCaseName() { return this.caseName; }
    public String getCaseLabel() { return this.caseLabel; }
    public String getEnglishDescription() { return this.englishDescription; }
    public String getGermanDescription() { return this.germanDescription; }
    public String getQuestionWords() { return this.questionWords; }
    public List<GrammarCaseExampleDto> getExamples() { return this.examples; }
    public List<GrammarCaseExerciseDto> getExercises() { return this.exercises; }
    public void setId(Long id) { this.id = id; }
    public void setCaseName(String caseName) { this.caseName = caseName; }
    public void setCaseLabel(String caseLabel) { this.caseLabel = caseLabel; }
    public void setEnglishDescription(String englishDescription) { this.englishDescription = englishDescription; }
    public void setGermanDescription(String germanDescription) { this.germanDescription = germanDescription; }
    public void setQuestionWords(String questionWords) { this.questionWords = questionWords; }
    public void setExamples(List<GrammarCaseExampleDto> examples) { this.examples = examples; }
    public void setExercises(List<GrammarCaseExerciseDto> exercises) { this.exercises = exercises; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private String caseName;
        private String caseLabel;
        private String englishDescription;
        private String germanDescription;
        private String questionWords;
        private List<GrammarCaseExampleDto> examples;
        private List<GrammarCaseExerciseDto> exercises;
        public Builder id(Long id) { this.id = id; return this; }
        public Builder caseName(String caseName) { this.caseName = caseName; return this; }
        public Builder caseLabel(String caseLabel) { this.caseLabel = caseLabel; return this; }
        public Builder englishDescription(String englishDescription) { this.englishDescription = englishDescription; return this; }
        public Builder germanDescription(String germanDescription) { this.germanDescription = germanDescription; return this; }
        public Builder questionWords(String questionWords) { this.questionWords = questionWords; return this; }
        public Builder examples(List<GrammarCaseExampleDto> examples) { this.examples = examples; return this; }
        public Builder exercises(List<GrammarCaseExerciseDto> exercises) { this.exercises = exercises; return this; }
        public GrammarCaseDto build() { return new GrammarCaseDto(id, caseName, caseLabel, englishDescription, germanDescription, questionWords, examples, exercises); }
    }

    private Long id;
    private String caseName;            // nominative, accusative, dative, genitive
    private String caseLabel;           // Nominativ (Subject), etc.
    private String englishDescription;
    private String germanDescription;
    private String questionWords;       // Wer? Was? for nominative, etc.
    private List<GrammarCaseExampleDto> examples;
    private List<GrammarCaseExerciseDto> exercises;
}
