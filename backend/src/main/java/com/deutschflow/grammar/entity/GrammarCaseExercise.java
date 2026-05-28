package com.deutschflow.grammar.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "grammar_case_exercises", indexes = {
    @Index(name = "idx_grammar_exercise_case_difficulty", columnList = "case_id,difficulty_level"),
    @Index(name = "idx_grammar_exercise_type", columnList = "exercise_type")
})
public class GrammarCaseExercise {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private GrammarCase grammarCase;

    @Column(name = "difficulty_level", nullable = false)
    private Integer difficultyLevel;  // 1=A1, 2=A2, 3=B1

    @Column(name = "exercise_type", nullable = false, length = 50)
    private String exerciseType;  // article_selection, noun_declension, sentence_fill, case_identification

    @Column(nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(name = "correct_answer", nullable = false, length = 100)
    private String correctAnswer;

    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public GrammarCaseExercise() {}

    public GrammarCaseExercise(Long id, GrammarCase grammarCase, Integer difficultyLevel, String exerciseType,
                              String question, String correctAnswer, String explanation, LocalDateTime createdAt) {
        this.id = id;
        this.grammarCase = grammarCase;
        this.difficultyLevel = difficultyLevel;
        this.exerciseType = exerciseType;
        this.question = question;
        this.correctAnswer = correctAnswer;
        this.explanation = explanation;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public GrammarCase getGrammarCase() {
        return grammarCase;
    }

    public void setGrammarCase(GrammarCase grammarCase) {
        this.grammarCase = grammarCase;
    }

    public Integer getDifficultyLevel() {
        return difficultyLevel;
    }

    public void setDifficultyLevel(Integer difficultyLevel) {
        this.difficultyLevel = difficultyLevel;
    }

    public String getExerciseType() {
        return exerciseType;
    }

    public void setExerciseType(String exerciseType) {
        this.exerciseType = exerciseType;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getCorrectAnswer() {
        return correctAnswer;
    }

    public void setCorrectAnswer(String correctAnswer) {
        this.correctAnswer = correctAnswer;
    }

    public String getExplanation() {
        return explanation;
    }

    public void setExplanation(String explanation) {
        this.explanation = explanation;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
