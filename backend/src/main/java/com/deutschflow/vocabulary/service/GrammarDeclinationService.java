package com.deutschflow.vocabulary.service;

import com.deutschflow.grammar.repository.GrammarArticleRepository;
import com.deutschflow.vocabulary.dto.DeclensionsDto;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.entity.WordDeclension;
import com.deutschflow.vocabulary.repository.WordDeclensionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Builds and caches German noun declension tables.
 * Uses grammar_articles to resolve article forms per (gender × case).
 */
@Service
public class GrammarDeclinationService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GrammarDeclinationService.class);

    private static final List<String> GRAMMAR_TIPS = List.of(
            "German nouns have 3 genders: masculine (der), feminine (die), neuter (das).",
            "The article changes depending on the grammatical case.",
            "Nominative = subject, Accusative = direct object, Dative = indirect object, Genitive = possession.",
            "Only masculine nouns change article in the accusative case (der → den)."
    );

    private final WordDeclensionRepository declensionRepository;
    private final GrammarArticleRepository articleRepository;

    public GrammarDeclinationService(WordDeclensionRepository declensionRepository,
                                     GrammarArticleRepository articleRepository) {
        this.declensionRepository = declensionRepository;
        this.articleRepository = articleRepository;
    }

    /**
     * Returns declensions for the word, building and persisting them on first access.
     * Returns empty if the word has no gender (e.g. verbs, adjectives).
     */
    @Transactional
    public Optional<DeclensionsDto> getDeclensions(Word word) {
        if (word.getGender() == null || word.getGender().isBlank()) {
            return Optional.empty();
        }

        Optional<WordDeclension> existing = declensionRepository.findByWordId(word.getId());
        if (existing.isPresent()) {
            return Optional.of(toDto(existing.get()));
        }

        WordDeclension built = buildDeclension(word);
        WordDeclension saved = declensionRepository.save(built);
        return Optional.of(toDto(saved));
    }

    /**
     * Returns the nominative article for a word ("der", "die", "das") or null.
     */
    public String getNominativeArticle(String gender) {
        if (gender == null) return null;
        return articleRepository.findByGenderAndKasus(gender, "nominative")
                .map(a -> a.getArticle())
                .orElse(null);
    }

    public List<String> getGrammarTips() {
        return GRAMMAR_TIPS;
    }

    // ── private ────────────────────────────────────────────────────────────

    private WordDeclension buildDeclension(Word word) {
        String g = word.getGender();  // "m", "f", "n"
        String base = word.getWord();  // e.g. "Buch"

        Map<String, String> articles = articleRepository.findAll().stream()
                .filter(a -> g.equals(a.getGender()))
                .collect(Collectors.toMap(a -> a.getKasus(), a -> a.getArticle()));

        String nom = articles.getOrDefault("nominative", "?");
        String acc = articles.getOrDefault("accusative", "?");
        String dat = articles.getOrDefault("dative", "?");
        String gen = articles.getOrDefault("genitive", "?");

        return WordDeclension.builder()
                .wordId(word.getId())
                .nomSingular(nom + " " + base)
                .accSingular(acc + " " + base)
                .datSingular(dat + " " + base)
                .genSingular(gen + " " + genitiveSuffix(base, g))
                .nomPlural("die " + base + "e")
                .accPlural("die " + base + "e")
                .datPlural("den " + base + "en")
                .genPlural("der " + base + "e")
                .build();
    }

    private String genitiveSuffix(String base, String gender) {
        // Simplified rule: masculine/neuter nouns often add -s or -es in genitive.
        if ("m".equals(gender) || "n".equals(gender)) {
            return base.endsWith("s") || base.endsWith("z") ? base + "es" : base + "s";
        }
        return base;
    }

    private DeclensionsDto toDto(WordDeclension d) {
        return new DeclensionsDto(
                d.getNomSingular(),
                d.getAccSingular(),
                d.getDatSingular(),
                d.getGenSingular(),
                d.getNomPlural(),
                d.getAccPlural(),
                d.getDatPlural(),
                d.getGenPlural(),
                d.getPluralForm()
        );
    }
}
