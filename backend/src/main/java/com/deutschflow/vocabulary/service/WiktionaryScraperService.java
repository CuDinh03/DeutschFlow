package com.deutschflow.vocabulary.service;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Scrapes Wiktionary entries for vocabulary enrichment.
 *
 * This service intentionally keeps the parsing implementation isolated so the
 * rest of the vocabulary pipeline can depend on a stable API.
 */
@Service
@Slf4j
public class WiktionaryScraperService {

    public Optional<WordData> scrapeWord(String lemma) {
        if (lemma == null || lemma.isBlank()) {
            return Optional.empty();
        }

        // Placeholder implementation: the production scraper can be restored
        // here if the original source is available. Returning empty keeps the
        // enrichment pipeline safe and compilable in the meantime.
        log.warn("Wiktionary scraper is not implemented for lemma={}", lemma);
        return Optional.empty();
    }

    @Data
    public static class WordData {
        private String word;
        private String ipa;
        private String usageNote;
        private String gender;
        private String plural;
        private String partizip2;
        private String auxiliaryVerb;
        private Boolean isSeparable;
        private Boolean isReflexive;
        private String meaning;
        private String exampleEn;
        private String exampleDe;
    }
}