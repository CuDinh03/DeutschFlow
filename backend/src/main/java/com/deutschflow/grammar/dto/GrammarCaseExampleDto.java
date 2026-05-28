package com.deutschflow.grammar.dto;


public class GrammarCaseExampleDto {
    public GrammarCaseExampleDto() {}

    public GrammarCaseExampleDto(Long id, Long caseId, String germanSentence, String englishTranslation, String wordInFocus, String caseRole) {
        this.id = id;
        this.caseId = caseId;
        this.germanSentence = germanSentence;
        this.englishTranslation = englishTranslation;
        this.wordInFocus = wordInFocus;
        this.caseRole = caseRole;
    }
    public Long getId() { return this.id; }
    public Long getCaseId() { return this.caseId; }
    public String getGermanSentence() { return this.germanSentence; }
    public String getEnglishTranslation() { return this.englishTranslation; }
    public String getWordInFocus() { return this.wordInFocus; }
    public String getCaseRole() { return this.caseRole; }
    public void setId(Long id) { this.id = id; }
    public void setCaseId(Long caseId) { this.caseId = caseId; }
    public void setGermanSentence(String germanSentence) { this.germanSentence = germanSentence; }
    public void setEnglishTranslation(String englishTranslation) { this.englishTranslation = englishTranslation; }
    public void setWordInFocus(String wordInFocus) { this.wordInFocus = wordInFocus; }
    public void setCaseRole(String caseRole) { this.caseRole = caseRole; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private Long caseId;
        private String germanSentence;
        private String englishTranslation;
        private String wordInFocus;
        private String caseRole;
        public Builder id(Long id) { this.id = id; return this; }
        public Builder caseId(Long caseId) { this.caseId = caseId; return this; }
        public Builder germanSentence(String germanSentence) { this.germanSentence = germanSentence; return this; }
        public Builder englishTranslation(String englishTranslation) { this.englishTranslation = englishTranslation; return this; }
        public Builder wordInFocus(String wordInFocus) { this.wordInFocus = wordInFocus; return this; }
        public Builder caseRole(String caseRole) { this.caseRole = caseRole; return this; }
        public GrammarCaseExampleDto build() { return new GrammarCaseExampleDto(id, caseId, germanSentence, englishTranslation, wordInFocus, caseRole); }
    }

    private Long id;
    private Long caseId;
    private String germanSentence;
    private String englishTranslation;
    private String wordInFocus;
    private String caseRole;  // subject, direct_object, indirect_object, possessive
}
