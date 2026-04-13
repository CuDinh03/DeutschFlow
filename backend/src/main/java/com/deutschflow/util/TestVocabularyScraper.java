package com.deutschflow.util;

import com.deutschflow.vocabulary.service.DeepLTranslationService;
import com.deutschflow.vocabulary.service.VocabularyImportService;
import com.deutschflow.vocabulary.service.WiktionaryScraperService;

/**
 * Utility để test Wiktionary scraper và DeepL translation
 * 
 * Usage:
 * mvn exec:java -Dexec.mainClass="com.deutschflow.util.TestVocabularyScraper"
 */
public class TestVocabularyScraper {

    public static void main(String[] args) {
        System.out.println("=== DeutschFlow Vocabulary Scraper Test ===\n");

        // Test Wiktionary Scraper
        testWiktionary();

        // Test DeepL Translation (nếu có API key)
        // testDeepL();

        // Test full import workflow
        // testImportWorkflow();
    }

    private static void testWiktionary() {
        System.out.println("--- Testing Wiktionary Scraper ---");
        
        WiktionaryScraperService scraper = new WiktionaryScraperService();
        
        String[] testWords = {"Tisch", "Frau", "Kind", "Buch", "Haus"};
        
        for (String word : testWords) {
            System.out.println("\nScraping: " + word);
            scraper.scrapeWord(word).ifPresentOrElse(
                data -> {
                    System.out.println("  ✓ Word: " + data.getWord());
                    System.out.println("  ✓ Gender: " + data.getGender());
                    System.out.println("  ✓ Plural: " + data.getPlural());
                    System.out.println("  ✓ Meaning: " + data.getMeaning());
                    System.out.println("  ✓ Example (DE): " + data.getExampleDe());
                    System.out.println("  ✓ Example (EN): " + data.getExampleEn());
                },
                () -> System.out.println("  ✗ Failed to scrape")
            );
            
            // Rate limiting
            try {
                Thread.sleep(1500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private static void testDeepL() {
        System.out.println("\n--- Testing DeepL Translation ---");
        
        // Note: Cần set DEEPL_API_KEY trong .env
        DeepLTranslationService deepl = new DeepLTranslationService();
        
        String testText = "Der Tisch ist groß.";
        System.out.println("Original (DE): " + testText);
        
        deepl.translate(testText, "VI").ifPresent(
            vi -> System.out.println("Vietnamese: " + vi)
        );
        
        deepl.translate(testText, "EN").ifPresent(
            en -> System.out.println("English: " + en)
        );
        
        // Check usage
        deepl.checkUsage().ifPresent(usage -> {
            System.out.println("\nDeepL Usage:");
            System.out.println("  Characters: " + usage.getCharacterCount() + "/" + usage.getCharacterLimit());
            System.out.println("  Percentage: " + String.format("%.2f%%", usage.getPercentageUsed()));
        });
    }

    private static void testImportWorkflow() {
        System.out.println("\n--- Testing Full Import Workflow ---");
        
        WiktionaryScraperService wiktionary = new WiktionaryScraperService();
        DeepLTranslationService deepl = new DeepLTranslationService();
        VocabularyImportService importer = new VocabularyImportService(wiktionary, deepl);
        
        String[] words = {"Tisch", "Stuhl", "Buch"};
        int imported = importer.importBatch(words, "A1");
        
        System.out.println("\n✓ Import completed: " + imported + "/" + words.length + " words");
    }
}
