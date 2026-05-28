package com.deutschflow.grammar.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "grammar_cases")
public class GrammarCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String caseName;  // nominative, accusative, dative, genitive

    @Column(nullable = false, length = 50)
    private String caseLabel;  // "Nominativ (Subject)", etc.

    @Column(name = "english_description", columnDefinition = "TEXT")
    private String englishDescription;

    @Column(name = "german_description", columnDefinition = "TEXT")
    private String germanDescription;

    @Column(name = "question_words", length = 100)
    private String questionWords;  // "Wer? Was?" for nominative, etc.

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "grammarCase", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GrammarCaseExample> examples;

    @OneToMany(mappedBy = "grammarCase", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GrammarCaseExercise> exercises;

    public GrammarCase() {}

    public GrammarCase(Long id, String caseName, String caseLabel, String englishDescription,
                       String germanDescription, String questionWords, LocalDateTime createdAt) {
        this.id = id;
        this.caseName = caseName;
        this.caseLabel = caseLabel;
        this.englishDescription = englishDescription;
        this.germanDescription = germanDescription;
        this.questionWords = questionWords;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCaseName() {
        return caseName;
    }

    public void setCaseName(String caseName) {
        this.caseName = caseName;
    }

    public String getCaseLabel() {
        return caseLabel;
    }

    public void setCaseLabel(String caseLabel) {
        this.caseLabel = caseLabel;
    }

    public String getEnglishDescription() {
        return englishDescription;
    }

    public void setEnglishDescription(String englishDescription) {
        this.englishDescription = englishDescription;
    }

    public String getGermanDescription() {
        return germanDescription;
    }

    public void setGermanDescription(String germanDescription) {
        this.germanDescription = germanDescription;
    }

    public String getQuestionWords() {
        return questionWords;
    }

    public void setQuestionWords(String questionWords) {
        this.questionWords = questionWords;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<GrammarCaseExample> getExamples() {
        return examples;
    }

    public void setExamples(List<GrammarCaseExample> examples) {
        this.examples = examples;
    }

    public List<GrammarCaseExercise> getExercises() {
        return exercises;
    }

    public void setExercises(List<GrammarCaseExercise> exercises) {
        this.exercises = exercises;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
