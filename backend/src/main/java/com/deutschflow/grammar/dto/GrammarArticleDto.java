package com.deutschflow.grammar.dto;


public class GrammarArticleDto {
    public GrammarArticleDto() {}

    public GrammarArticleDto(Long id, String gender, String kasus, String article) {
        this.id = id;
        this.gender = gender;
        this.kasus = kasus;
        this.article = article;
    }
    public Long getId() { return this.id; }
    public String getGender() { return this.gender; }
    public String getKasus() { return this.kasus; }
    public String getArticle() { return this.article; }
    public void setId(Long id) { this.id = id; }
    public void setGender(String gender) { this.gender = gender; }
    public void setKasus(String kasus) { this.kasus = kasus; }
    public void setArticle(String article) { this.article = article; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private String gender;
        private String kasus;
        private String article;
        public Builder id(Long id) { this.id = id; return this; }
        public Builder gender(String gender) { this.gender = gender; return this; }
        public Builder kasus(String kasus) { this.kasus = kasus; return this; }
        public Builder article(String article) { this.article = article; return this; }
        public GrammarArticleDto build() { return new GrammarArticleDto(id, gender, kasus, article); }
    }

    private Long id;
    private String gender;  // m, f, n
    private String kasus;   // nominative, accusative, dative, genitive
    private String article; // der, die, das, den, dem, des, etc.
}
