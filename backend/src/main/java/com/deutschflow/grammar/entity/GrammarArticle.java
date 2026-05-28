package com.deutschflow.grammar.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "grammar_articles", indexes = {
    @Index(name = "idx_grammar_article_gender_kasus", columnList = "gender,kasus")
})
public class GrammarArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String gender;  // 'm', 'f', 'n'

    @Column(nullable = false, length = 20)
    private String kasus;   // nominative, accusative, dative, genitive

    @Column(nullable = false, length = 10)
    private String article; // der, die, das, den, dem, des, etc.

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public GrammarArticle() {}

    public GrammarArticle(Long id, String gender, String kasus, String article, LocalDateTime createdAt) {
        this.id = id;
        this.gender = gender;
        this.kasus = kasus;
        this.article = article;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getKasus() {
        return kasus;
    }

    public void setKasus(String kasus) {
        this.kasus = kasus;
    }

    public String getArticle() {
        return article;
    }

    public void setArticle(String article) {
        this.article = article;
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
