package com.deutschflow.grammar.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "grammar_case_examples")
public class GrammarCaseExample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private GrammarCase grammarCase;

    @Column(name = "german_sentence", nullable = false, columnDefinition = "TEXT")
    private String germanSentence;

    @Column(name = "english_translation", nullable = false, columnDefinition = "TEXT")
    private String englishTranslation;

    @Column(name = "word_in_focus", nullable = false, length = 100)
    private String wordInFocus;  // The highlighted word that demonstrates the case

    @Column(name = "case_role", nullable = false, length = 50)
    private String caseRole;  // subject, direct_object, indirect_object, possessive

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public GrammarCaseExample() {}

    public GrammarCaseExample(Long id, GrammarCase grammarCase, String germanSentence,
                             String englishTranslation, String wordInFocus, String caseRole, LocalDateTime createdAt) {
        this.id = id;
        this.grammarCase = grammarCase;
        this.germanSentence = germanSentence;
        this.englishTranslation = englishTranslation;
        this.wordInFocus = wordInFocus;
        this.caseRole = caseRole;
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

    public String getGermanSentence() {
        return germanSentence;
    }

    public void setGermanSentence(String germanSentence) {
        this.germanSentence = germanSentence;
    }

    public String getEnglishTranslation() {
        return englishTranslation;
    }

    public void setEnglishTranslation(String englishTranslation) {
        this.englishTranslation = englishTranslation;
    }

    public String getWordInFocus() {
        return wordInFocus;
    }

    public void setWordInFocus(String wordInFocus) {
        this.wordInFocus = wordInFocus;
    }

    public String getCaseRole() {
        return caseRole;
    }

    public void setCaseRole(String caseRole) {
        this.caseRole = caseRole;
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
