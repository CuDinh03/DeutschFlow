package com.deutschflow.vocabulary.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "word_declensions", indexes = {
    @Index(name = "idx_word_declensions_word", columnList = "word_id")
})
public class WordDeclension {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "word_id", nullable = false, unique = true)
    private Long wordId;

    @Column(name = "plural_form", length = 100)
    private String pluralForm;

    @Column(name = "nom_singular", length = 120)
    private String nomSingular;

    @Column(name = "acc_singular", length = 120)
    private String accSingular;

    @Column(name = "dat_singular", length = 120)
    private String datSingular;

    @Column(name = "gen_singular", length = 120)
    private String genSingular;

    @Column(name = "nom_plural", length = 120)
    private String nomPlural;

    @Column(name = "acc_plural", length = 120)
    private String accPlural;

    @Column(name = "dat_plural", length = 120)
    private String datPlural;

    @Column(name = "gen_plural", length = 120)
    private String genPlural;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public WordDeclension() {}

    public Long getId() { return id; }
    public Long getWordId() { return wordId; }
    public String getPluralForm() { return pluralForm; }
    public String getNomSingular() { return nomSingular; }
    public String getAccSingular() { return accSingular; }
    public String getDatSingular() { return datSingular; }
    public String getGenSingular() { return genSingular; }
    public String getNomPlural() { return nomPlural; }
    public String getAccPlural() { return accPlural; }
    public String getDatPlural() { return datPlural; }
    public String getGenPlural() { return genPlural; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setId(Long id) { this.id = id; }
    public void setWordId(Long wordId) { this.wordId = wordId; }
    public void setPluralForm(String pluralForm) { this.pluralForm = pluralForm; }
    public void setNomSingular(String nomSingular) { this.nomSingular = nomSingular; }
    public void setAccSingular(String accSingular) { this.accSingular = accSingular; }
    public void setDatSingular(String datSingular) { this.datSingular = datSingular; }
    public void setGenSingular(String genSingular) { this.genSingular = genSingular; }
    public void setNomPlural(String nomPlural) { this.nomPlural = nomPlural; }
    public void setAccPlural(String accPlural) { this.accPlural = accPlural; }
    public void setDatPlural(String datPlural) { this.datPlural = datPlural; }
    public void setGenPlural(String genPlural) { this.genPlural = genPlural; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long wordId;
        private String pluralForm;
        private String nomSingular, accSingular, datSingular, genSingular;
        private String nomPlural, accPlural, datPlural, genPlural;

        public Builder wordId(Long wordId) { this.wordId = wordId; return this; }
        public Builder pluralForm(String pluralForm) { this.pluralForm = pluralForm; return this; }
        public Builder nomSingular(String v) { this.nomSingular = v; return this; }
        public Builder accSingular(String v) { this.accSingular = v; return this; }
        public Builder datSingular(String v) { this.datSingular = v; return this; }
        public Builder genSingular(String v) { this.genSingular = v; return this; }
        public Builder nomPlural(String v) { this.nomPlural = v; return this; }
        public Builder accPlural(String v) { this.accPlural = v; return this; }
        public Builder datPlural(String v) { this.datPlural = v; return this; }
        public Builder genPlural(String v) { this.genPlural = v; return this; }

        public WordDeclension build() {
            WordDeclension d = new WordDeclension();
            d.wordId = wordId;
            d.pluralForm = pluralForm;
            d.nomSingular = nomSingular;
            d.accSingular = accSingular;
            d.datSingular = datSingular;
            d.genSingular = genSingular;
            d.nomPlural = nomPlural;
            d.accPlural = accPlural;
            d.datPlural = datPlural;
            d.genPlural = genPlural;
            d.createdAt = LocalDateTime.now();
            d.updatedAt = LocalDateTime.now();
            return d;
        }
    }
}
