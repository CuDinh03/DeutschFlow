package com.deutschflow.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deep vocabulary enricher for missing lexical details.
 *
 * Sources:
 * - Wiktionary (IPA, meaning, examples, noun/verb/adjective grammar hints)
 * - Goethe B1 sorted list fallback for verb paradigms
 *
 * Safety:
 * - Updates only missing fields
 * - Never overwrites non-empty data
 * - Supports dry-run mode
 *
 * Usage:
 *   mvn -q -DskipTests exec:java -Dexec.mainClass="com.deutschflow.util.GoetheWiktionaryDeepEnricher"
 *
 * Env:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD
 *   ENRICH_LIMIT=200
 *   ENRICH_DRY_RUN=true|false
 *   ENRICH_RATE_MS=900
 */
public class GoetheWiktionaryDeepEnricher {
    private static final String WIKTIONARY_BASE_URL = "https://en.wiktionary.org/wiki/";
    private static final String USER_AGENT = "DeutschFlow/1.0 (Vocabulary enricher; educational use)";
    private static final int TIMEOUT_MS = 15_000;
    private static final String GOETHE_B1_SORTED_URL =
            "https://raw.githubusercontent.com/kennethsible/goethe-wortliste/main/sorted.txt";

    private static final Pattern IPA_PATTERN = Pattern.compile("/[^/]{2,40}/|\\[[^\\]]{2,40}\\]");
    private static final Pattern EXAMPLE_PATTERN = Pattern.compile(
            "([A-ZÄÖÜ][^\\n]{8,220}?[\\.\\!\\?])\\s*―\\s*([^\\n]{3,220})");
    private static final Pattern VERB_LINE_PATTERN = Pattern.compile(
            "third-person singular present\\s+([\\p{L}ÄÖÜäöüß-]+),\\s+past tense\\s+([\\p{L}ÄÖÜäöüß-]+),\\s+past participle\\s+([\\p{L}ÄÖÜäöüß-]+),\\s+auxiliary\\s+(haben|sein)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PLURAL_PATTERN = Pattern.compile("plural\\s+([\\p{L}ÄÖÜäöüß-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern GENITIVE_PATTERN = Pattern.compile("genitive\\s+([\\p{L}ÄÖÜäöüß'\\-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern GENDER_PATTERN = Pattern.compile("\\b([mfn])\\b");

    public static void main(String[] args) {
        String host = env("DB_HOST", "localhost");
        String port = env("DB_PORT", "5432");
        String db = env("DB_NAME", "deutschflow");
        String user = env("DB_USERNAME", "root");
        String pass = env("DB_PASSWORD", "Password.1");
        int limit = parseInt(env("ENRICH_LIMIT", "200"), 200);
        boolean dryRun = Boolean.parseBoolean(env("ENRICH_DRY_RUN", "true"));
        int rateMs = Math.max(250, parseInt(env("ENRICH_RATE_MS", "900"), 900));

        String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?stringtype=unspecified";

        try {
            Map<String, GoetheVerbData> goetheVerbs = loadGoetheVerbFallbacks();
            HttpClient httpClient = HttpClient.newBuilder().build();

            try (Connection conn = DriverManager.getConnection(jdbcUrl, user, pass)) {
                conn.setAutoCommit(false);
                List<WordRow> targets = loadTargets(conn, limit);
                System.out.println("=== GOETHE/WIKTIONARY DEEP ENRICHER ===");
                System.out.println("dry_run=" + dryRun + ", rate_ms=" + rateMs + ", target_count=" + targets.size());

                Summary summary = new Summary();
                long lastRequestTs = 0L;

                for (WordRow row : targets) {
                    long now = System.currentTimeMillis();
                    long delta = now - lastRequestTs;
                    if (delta < rateMs) {
                        Thread.sleep(rateMs - delta);
                    }
                    lastRequestTs = System.currentTimeMillis();

                    try {
                        Optional<WiktionaryWordData> scraped = scrapeWiktionary(httpClient, row.baseForm());
                        EnrichPatch patch = buildPatch(row, scraped.orElse(null), goetheVerbs.get(normalizeLemma(row.baseForm())));
                        if (!patch.hasAnyChange()) {
                            summary.skippedNoChange++;
                            continue;
                        }
                        applyPatch(conn, row, patch, dryRun, summary);
                        summary.processed++;
                    } catch (Exception e) {
                        summary.errors++;
                        System.err.println("WARN enrich failed word_id=" + row.id() + " base_form=" + row.baseForm() + " error=" + e.getMessage());
                    }
                }

                if (dryRun) {
                    conn.rollback();
                } else {
                    conn.commit();
                }

                System.out.println("processed=" + summary.processed);
                System.out.println("skipped_no_change=" + summary.skippedNoChange);
                System.out.println("errors=" + summary.errors);
                System.out.println("updated_words=" + summary.updatedWords);
                System.out.println("updated_translations=" + summary.updatedTranslations);
                System.out.println("inserted_noun_rows=" + summary.insertedNounRows);
                System.out.println("updated_noun_rows=" + summary.updatedNounRows);
                System.out.println("inserted_verb_rows=" + summary.insertedVerbRows);
                System.out.println("updated_verb_rows=" + summary.updatedVerbRows);
                System.out.println("inserted_adjective_rows=" + summary.insertedAdjectiveRows);
                System.out.println("updated_adjective_rows=" + summary.updatedAdjectiveRows);
                System.out.println("inserted_noun_declensions=" + summary.insertedNounDeclensions);
                System.out.println("inserted_verb_conjugations=" + summary.insertedVerbConjugations);
                System.out.println("finished_at=" + Timestamp.from(Instant.now()));
                System.out.println("=== DONE ===");
            }
        } catch (Exception e) {
            System.err.println("ENRICHER FAILED: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static List<WordRow> loadTargets(Connection conn, int limit) throws Exception {
        String sql = """
                SELECT
                  w.id,
                  w.dtype,
                  w.base_form,
                  w.phonetic,
                  w.usage_note,
                  tde.meaning AS de_meaning,
                  tde.example AS de_example,
                  n.gender AS noun_gender,
                  n.plural_form,
                  n.genitive_form,
                  n.noun_type,
                  v.auxiliary_verb,
                  v.partizip2,
                  v.is_separable,
                  v.prefix,
                  v.is_irregular AS verb_irregular,
                  a.comparative,
                  a.superlative,
                  a.is_irregular AS adj_irregular,
                  (SELECT COUNT(*) FROM noun_declension_forms f WHERE f.noun_id = w.id) AS noun_decl_count,
                  (SELECT COUNT(*) FROM verb_conjugations c
                   WHERE c.verb_id = w.id
                     AND c.tense IN ('PRASENS','PRATERITUM','PERFEKT')
                     AND c.pronoun IN ('ICH','DU','ER_SIE_ES','WIR','IHR','SIE_FORMAL')) AS verb_conj_count
                FROM words w
                LEFT JOIN word_translations tde
                  ON tde.word_id = w.id AND tde.locale = 'de'
                LEFT JOIN nouns n ON n.id = w.id
                LEFT JOIN verbs v ON v.id = w.id
                LEFT JOIN adjectives a ON a.id = w.id
                WHERE
                  (w.phonetic IS NULL OR TRIM(w.phonetic) = '')
                  OR (w.usage_note IS NULL OR TRIM(w.usage_note) = '')
                  OR (tde.meaning IS NULL OR TRIM(tde.meaning) = '')
                  OR (tde.example IS NULL OR TRIM(tde.example) = '')
                  OR (w.dtype = 'Noun' AND (n.id IS NULL OR n.gender IS NULL OR n.plural_form IS NULL OR TRIM(n.plural_form) = '' OR n.genitive_form IS NULL OR TRIM(n.genitive_form) = ''
                    OR (SELECT COUNT(*) FROM noun_declension_forms f_cnt WHERE f_cnt.noun_id = w.id) < 8))
                  OR (w.dtype = 'Verb' AND (v.id IS NULL OR v.partizip2 IS NULL OR TRIM(v.partizip2) = ''
                    OR (SELECT COUNT(*) FROM verb_conjugations c_cnt WHERE c_cnt.verb_id = w.id AND c_cnt.tense IN ('PRASENS','PRATERITUM','PERFEKT') AND c_cnt.pronoun IN ('ICH','DU','ER_SIE_ES','WIR','IHR','SIE_FORMAL')) < 18))
                  OR (w.dtype = 'Adjective' AND (a.id IS NULL OR a.comparative IS NULL OR TRIM(a.comparative) = '' OR a.superlative IS NULL OR TRIM(a.superlative) = ''))
                ORDER BY w.id
                LIMIT ?
                """;

        List<WordRow> rows = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, Math.max(1, limit));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    rows.add(new WordRow(
                            rs.getLong("id"),
                            rs.getString("dtype"),
                            rs.getString("base_form"),
                            rs.getString("phonetic"),
                            rs.getString("usage_note"),
                            rs.getString("de_meaning"),
                            rs.getString("de_example"),
                            rs.getString("noun_gender"),
                            rs.getString("plural_form"),
                            rs.getString("genitive_form"),
                            rs.getString("noun_type"),
                            rs.getString("auxiliary_verb"),
                            rs.getString("partizip2"),
                            rs.getObject("is_separable") == null ? null : rs.getBoolean("is_separable"),
                            rs.getString("prefix"),
                            rs.getObject("verb_irregular") == null ? null : rs.getBoolean("verb_irregular"),
                            rs.getString("comparative"),
                            rs.getString("superlative"),
                            rs.getObject("adj_irregular") == null ? null : rs.getBoolean("adj_irregular"),
                            rs.getInt("noun_decl_count"),
                            rs.getInt("verb_conj_count")
                    ));
                }
            }
        }
        return rows;
    }

    private static Optional<WiktionaryWordData> scrapeWiktionary(HttpClient httpClient, String baseForm) throws Exception {
        String encoded = URLEncoder.encode(baseForm, StandardCharsets.UTF_8).replace("+", "%20");
        HttpRequest req = HttpRequest.newBuilder(URI.create(WIKTIONARY_BASE_URL + encoded))
                .header("User-Agent", USER_AGENT)
                .GET()
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            return Optional.empty();
        }

        Document doc = Jsoup.parse(res.body());
        Element germanHead = doc.selectFirst("h2:has(span#German)");
        if (germanHead == null) {
            return Optional.empty();
        }

        Element germanSection = new Element("section");
        for (Element sib = germanHead.nextElementSibling(); sib != null; sib = sib.nextElementSibling()) {
            if ("h2".equals(sib.tagName())) break;
            germanSection.appendChild(sib.clone());
        }
        String germanText = germanSection.text();
        if (germanText.isBlank()) {
            return Optional.empty();
        }

        WiktionaryWordData out = new WiktionaryWordData();
        out.ipa = extractIpa(germanSection, germanText);
        out.meaning = extractMeaning(germanSection);
        ExamplePair examplePair = extractExample(germanText);
        out.exampleDe = examplePair.de();
        out.exampleEn = examplePair.translation();
        out.noun = extractNounData(germanSection, germanText);
        out.verb = extractVerbData(germanText);
        out.adjective = extractAdjectiveData(germanText);
        return Optional.of(out);
    }

    private static EnrichPatch buildPatch(WordRow row, WiktionaryWordData scraped, GoetheVerbData goetheVerbData) {
        EnrichPatch patch = new EnrichPatch();

        if (isBlank(row.phonetic())) {
            String ipa = scraped != null ? scraped.ipa : null;
            patch.phonetic = isBlank(ipa) ? ("/" + row.baseForm().toLowerCase(Locale.ROOT) + "/") : normalizeIpa(ipa);
        }

        if (isBlank(row.usageNote())) {
            patch.usageNote = defaultUsageNote(row.dtype(), row.baseForm());
        }

        if (isBlank(row.deMeaning()) && scraped != null && !isBlank(scraped.meaning)) {
            patch.deMeaning = scraped.meaning;
        }
        if (isBlank(row.deExample()) && scraped != null && !isBlank(scraped.exampleDe)) {
            String example = scraped.exampleDe;
            if (!isBlank(scraped.exampleEn)) {
                example = example + " — " + scraped.exampleEn;
            }
            patch.deExample = example;
        }

        if ("Noun".equals(row.dtype())) {
            NounPatch nounPatch = buildNounPatch(row, scraped != null ? scraped.noun : null);
            patch.nounPatch = nounPatch;
        } else if ("Verb".equals(row.dtype())) {
            VerbPatch verbPatch = buildVerbPatch(row, scraped != null ? scraped.verb : null, goetheVerbData);
            patch.verbPatch = verbPatch;
        } else if ("Adjective".equals(row.dtype())) {
            AdjectivePatch adjectivePatch = buildAdjectivePatch(row, scraped != null ? scraped.adjective : null);
            patch.adjectivePatch = adjectivePatch;
        }

        return patch;
    }

    private static NounPatch buildNounPatch(WordRow row, NounData nounData) {
        NounPatch patch = new NounPatch();
        String normalizedBase = row.baseForm();
        String article = articleForGender(row.nounGender());
        if (isBlank(article) && nounData != null && !isBlank(nounData.gender)) {
            article = articleForGender(nounData.gender);
        }
        if (isBlank(row.nounGender()) && !isBlank(nounData != null ? nounData.gender : null)) {
            patch.gender = nounData.gender;
        }
        if (isBlank(row.pluralForm())) {
            patch.pluralForm = (nounData != null && !isBlank(nounData.plural)) ? nounData.plural : inferPlural(normalizedBase);
        }
        if (isBlank(row.genitiveForm())) {
            patch.genitiveForm = (nounData != null && !isBlank(nounData.genitive))
                    ? nounData.genitive
                    : inferGenitive(normalizedBase, row.nounGender());
        }
        if (isBlank(row.nounType())) {
            patch.nounType = nounData != null && !isBlank(nounData.nounType) ? nounData.nounType : "STARK";
        }
        if (row.nounDeclensionCount() < 8) {
            Map<Kasus, String> singular = new EnumMap<>(Kasus.class);
            Map<Kasus, String> plural = new EnumMap<>(Kasus.class);
            if (nounData != null) {
                singular.putAll(nounData.singularForms);
                plural.putAll(nounData.pluralForms);
            }
            String pluralFallback = isBlank(patch.pluralForm) ? row.pluralForm() : patch.pluralForm;
            String genitiveFallback = isBlank(patch.genitiveForm) ? row.genitiveForm() : patch.genitiveForm;
            String dativePlural = inferDativePlural(pluralFallback);
            singular.putIfAbsent(Kasus.NOMINATIV, normalizedBase);
            singular.putIfAbsent(Kasus.AKKUSATIV, normalizedBase);
            singular.putIfAbsent(Kasus.DATIV, normalizedBase);
            singular.putIfAbsent(Kasus.GENITIV, isBlank(genitiveFallback) ? normalizedBase : genitiveFallback);
            plural.putIfAbsent(Kasus.NOMINATIV, isBlank(pluralFallback) ? normalizedBase : pluralFallback);
            plural.putIfAbsent(Kasus.AKKUSATIV, isBlank(pluralFallback) ? normalizedBase : pluralFallback);
            plural.putIfAbsent(Kasus.DATIV, isBlank(dativePlural) ? (isBlank(pluralFallback) ? normalizedBase : pluralFallback) : dativePlural);
            plural.putIfAbsent(Kasus.GENITIV, isBlank(pluralFallback) ? normalizedBase : pluralFallback);
            patch.declensions = toDeclensionRows(singular, plural);
        }
        patch.article = article;
        return patch;
    }

    private static VerbPatch buildVerbPatch(WordRow row, VerbData verbData, GoetheVerbData goetheVerbData) {
        VerbPatch patch = new VerbPatch();
        String present3 = null;
        String preterite = null;
        String partizip2 = row.partizip2();
        String aux = row.auxiliaryVerb();

        if (verbData != null) {
            present3 = verbData.thirdPresent;
            preterite = verbData.preterite;
            if (isBlank(partizip2) && !isBlank(verbData.partizip2)) {
                partizip2 = verbData.partizip2;
            }
            if (isBlank(aux) && !isBlank(verbData.auxiliaryVerb)) {
                aux = verbData.auxiliaryVerb;
            }
        }
        if (goetheVerbData != null) {
            if (isBlank(present3) && !isBlank(goetheVerbData.thirdPersonPresent)) {
                present3 = goetheVerbData.thirdPersonPresent;
            }
            if (isBlank(preterite) && !isBlank(goetheVerbData.preterite)) {
                preterite = goetheVerbData.preterite;
            }
            if (isBlank(partizip2) && !isBlank(goetheVerbData.partizip2)) {
                partizip2 = goetheVerbData.partizip2;
            }
            if (isBlank(aux) && !isBlank(goetheVerbData.auxiliary)) {
                aux = goetheVerbData.auxiliary;
            }
        }

        if (isBlank(partizip2)) {
            partizip2 = inferPartizip2(row.baseForm());
        }
        if (isBlank(aux)) {
            aux = inferAuxiliary(row.baseForm());
        }
        if (isBlank(preterite)) {
            preterite = inferPreterite(row.baseForm());
        }
        if (isBlank(present3)) {
            present3 = inferPresentThird(row.baseForm());
        }

        if (isBlank(row.partizip2())) patch.partizip2 = partizip2;
        if (isBlank(row.auxiliaryVerb())) patch.auxiliaryVerb = aux;
        if (row.isSeparable() == null) patch.isSeparable = isLikelySeparable(row.baseForm());
        if (row.verbIrregular() == null) patch.isIrregular = isLikelyIrregular(row.baseForm(), present3, preterite);
        if (isBlank(row.prefix()) && patch.isSeparable != null && patch.isSeparable) patch.prefix = inferPrefix(row.baseForm());

        if (row.verbConjugationCount() < 18) {
            patch.conjugations = inferVerbConjugations(row.baseForm(), present3, preterite, partizip2, aux);
        }

        return patch;
    }

    private static AdjectivePatch buildAdjectivePatch(WordRow row, AdjectiveData adjectiveData) {
        AdjectivePatch patch = new AdjectivePatch();
        String comparative = null;
        String superlative = null;
        if (adjectiveData != null) {
            comparative = adjectiveData.comparative;
            superlative = adjectiveData.superlative;
        }
        if (isBlank(comparative)) comparative = inferComparative(row.baseForm());
        if (isBlank(superlative)) superlative = inferSuperlative(row.baseForm());

        if (isBlank(row.comparative())) patch.comparative = comparative;
        if (isBlank(row.superlative())) patch.superlative = superlative;
        if (row.adjIrregular() == null) patch.isIrregular = false;
        return patch;
    }

    private static void applyPatch(Connection conn, WordRow row, EnrichPatch patch, boolean dryRun, Summary summary) throws Exception {
        if (patch.phonetic != null || patch.usageNote != null) {
            if (!dryRun) {
                try (PreparedStatement ps = conn.prepareStatement("""
                        UPDATE words
                        SET phonetic = COALESCE(phonetic, ?),
                            usage_note = COALESCE(usage_note, ?),
                            updated_at = NOW()
                        WHERE id = ?
                        """)) {
                    ps.setString(1, patch.phonetic);
                    ps.setString(2, patch.usageNote);
                    ps.setLong(3, row.id());
                    summary.updatedWords += ps.executeUpdate();
                }
            } else {
                summary.updatedWords++;
            }
        }

        if (patch.deMeaning != null || patch.deExample != null) {
            if (!dryRun) {
                String fallbackMeaning = patch.deMeaning != null ? patch.deMeaning : "Bedeutung wird ergaenzt.";
                try (PreparedStatement ps = conn.prepareStatement("""
                        INSERT INTO word_translations (word_id, locale, meaning, example)
                        VALUES (?, 'de', ?, ?)
                        ON CONFLICT (word_id, locale) DO UPDATE SET
                          meaning = CASE WHEN word_translations.meaning IS NULL OR TRIM(word_translations.meaning) = '' THEN EXCLUDED.meaning ELSE word_translations.meaning END,
                          example = CASE WHEN word_translations.example IS NULL OR TRIM(word_translations.example) = '' THEN EXCLUDED.example ELSE word_translations.example END
                        """)) {
                    ps.setLong(1, row.id());
                    ps.setString(2, fallbackMeaning);
                    ps.setString(3, patch.deExample);
                    summary.updatedTranslations += ps.executeUpdate();
                }
            } else {
                summary.updatedTranslations++;
            }
        }

        if ("Noun".equals(row.dtype()) && patch.nounPatch != null) {
            applyNounPatch(conn, row, patch.nounPatch, dryRun, summary);
        }
        if ("Verb".equals(row.dtype()) && patch.verbPatch != null) {
            applyVerbPatch(conn, row, patch.verbPatch, dryRun, summary);
        }
        if ("Adjective".equals(row.dtype()) && patch.adjectivePatch != null) {
            applyAdjectivePatch(conn, row, patch.adjectivePatch, dryRun, summary);
        }
    }

    private static void applyNounPatch(Connection conn, WordRow row, NounPatch patch, boolean dryRun, Summary summary) throws Exception {
        if (dryRun) {
            if (patch.gender != null || patch.pluralForm != null || patch.genitiveForm != null || patch.nounType != null) {
                summary.updatedNounRows++;
            }
            summary.insertedNounDeclensions += patch.declensions.size();
            return;
        }

        boolean nounExists = exists(conn, "SELECT 1 FROM nouns WHERE id = ?", row.id());
        if (!nounExists) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type)
                    VALUES (?, ?, ?, ?, ?)
                    """)) {
                ps.setLong(1, row.id());
                ps.setString(2, patch.gender != null ? patch.gender : "DAS");
                ps.setString(3, patch.pluralForm != null ? patch.pluralForm : row.baseForm());
                ps.setString(4, patch.genitiveForm != null ? patch.genitiveForm : row.baseForm());
                ps.setString(5, patch.nounType != null ? patch.nounType : "STARK");
                summary.insertedNounRows += ps.executeUpdate();
            }
        } else if (patch.gender != null || patch.pluralForm != null || patch.genitiveForm != null || patch.nounType != null) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    UPDATE nouns
                    SET gender = COALESCE(gender, ?),
                        plural_form = CASE WHEN plural_form IS NULL OR TRIM(plural_form) = '' THEN ? ELSE plural_form END,
                        genitive_form = CASE WHEN genitive_form IS NULL OR TRIM(genitive_form) = '' THEN ? ELSE genitive_form END,
                        noun_type = COALESCE(noun_type, ?)
                    WHERE id = ?
                    """)) {
                ps.setString(1, patch.gender);
                ps.setString(2, patch.pluralForm);
                ps.setString(3, patch.genitiveForm);
                ps.setString(4, patch.nounType);
                ps.setLong(5, row.id());
                summary.updatedNounRows += ps.executeUpdate();
            }
        }

        for (DeclensionRow d : patch.declensions) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    INSERT INTO noun_declension_forms (noun_id, kasus, numerus, form)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (noun_id, kasus, numerus) DO NOTHING
                    """)) {
                ps.setLong(1, row.id());
                ps.setString(2, d.kasus.name());
                ps.setString(3, d.numerus.name());
                ps.setString(4, d.form);
                summary.insertedNounDeclensions += ps.executeUpdate();
            }
        }
    }

    private static void applyVerbPatch(Connection conn, WordRow row, VerbPatch patch, boolean dryRun, Summary summary) throws Exception {
        if (dryRun) {
            if (patch.partizip2 != null || patch.auxiliaryVerb != null || patch.isSeparable != null || patch.prefix != null || patch.isIrregular != null) {
                summary.updatedVerbRows++;
            }
            summary.insertedVerbConjugations += patch.conjugations.size();
            return;
        }

        boolean exists = exists(conn, "SELECT 1 FROM verbs WHERE id = ?", row.id());
        if (!exists) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, prefix, is_irregular)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """)) {
                ps.setLong(1, row.id());
                ps.setString(2, patch.auxiliaryVerb != null ? patch.auxiliaryVerb : "HABEN");
                ps.setString(3, patch.partizip2 != null ? patch.partizip2 : inferPartizip2(row.baseForm()));
                ps.setBoolean(4, patch.isSeparable != null && patch.isSeparable);
                ps.setString(5, patch.prefix);
                ps.setBoolean(6, patch.isIrregular != null && patch.isIrregular);
                summary.insertedVerbRows += ps.executeUpdate();
            }
        } else if (patch.partizip2 != null || patch.auxiliaryVerb != null || patch.isSeparable != null || patch.prefix != null || patch.isIrregular != null) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    UPDATE verbs
                    SET auxiliary_verb = COALESCE(auxiliary_verb, ?),
                        partizip2 = CASE WHEN partizip2 IS NULL OR TRIM(partizip2) = '' THEN ? ELSE partizip2 END,
                        is_separable = CASE WHEN is_separable IS NULL THEN ? ELSE is_separable END,
                        prefix = CASE WHEN (prefix IS NULL OR TRIM(prefix) = '') THEN ? ELSE prefix END,
                        is_irregular = CASE WHEN is_irregular IS NULL THEN ? ELSE is_irregular END
                    WHERE id = ?
                    """)) {
                ps.setString(1, patch.auxiliaryVerb);
                ps.setString(2, patch.partizip2);
                ps.setBoolean(3, patch.isSeparable != null && patch.isSeparable);
                ps.setString(4, patch.prefix);
                ps.setBoolean(5, patch.isIrregular != null && patch.isIrregular);
                ps.setLong(6, row.id());
                summary.updatedVerbRows += ps.executeUpdate();
            }
        }

        for (VerbConjugationRow c : patch.conjugations) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    INSERT INTO verb_conjugations (verb_id, tense, pronoun, form)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (verb_id, tense, pronoun) DO NOTHING
                    """)) {
                ps.setLong(1, row.id());
                ps.setString(2, c.tense.name());
                ps.setString(3, c.pronoun.name());
                ps.setString(4, c.form);
                summary.insertedVerbConjugations += ps.executeUpdate();
            }
        }
    }

    private static void applyAdjectivePatch(Connection conn, WordRow row, AdjectivePatch patch, boolean dryRun, Summary summary) throws Exception {
        if (dryRun) {
            if (patch.comparative != null || patch.superlative != null || patch.isIrregular != null) {
                summary.updatedAdjectiveRows++;
            }
            return;
        }

        boolean exists = exists(conn, "SELECT 1 FROM adjectives WHERE id = ?", row.id());
        if (!exists) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    INSERT INTO adjectives (id, comparative, superlative, is_irregular)
                    VALUES (?, ?, ?, ?)
                    """)) {
                ps.setLong(1, row.id());
                ps.setString(2, patch.comparative != null ? patch.comparative : inferComparative(row.baseForm()));
                ps.setString(3, patch.superlative != null ? patch.superlative : inferSuperlative(row.baseForm()));
                ps.setBoolean(4, patch.isIrregular != null && patch.isIrregular);
                summary.insertedAdjectiveRows += ps.executeUpdate();
            }
        } else if (patch.comparative != null || patch.superlative != null || patch.isIrregular != null) {
            try (PreparedStatement ps = conn.prepareStatement("""
                    UPDATE adjectives
                    SET comparative = CASE WHEN comparative IS NULL OR TRIM(comparative) = '' THEN ? ELSE comparative END,
                        superlative = CASE WHEN superlative IS NULL OR TRIM(superlative) = '' THEN ? ELSE superlative END,
                        is_irregular = CASE WHEN is_irregular IS NULL THEN ? ELSE is_irregular END
                    WHERE id = ?
                    """)) {
                ps.setString(1, patch.comparative);
                ps.setString(2, patch.superlative);
                ps.setBoolean(3, patch.isIrregular != null && patch.isIrregular);
                ps.setLong(4, row.id());
                summary.updatedAdjectiveRows += ps.executeUpdate();
            }
        }
    }

    private static boolean exists(Connection conn, String sql, long id) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static String extractIpa(Element germanSection, String germanText) {
        Element ipaNode = germanSection.selectFirst("span.IPA");
        if (ipaNode != null && !ipaNode.text().isBlank()) {
            return ipaNode.text();
        }
        Matcher m = IPA_PATTERN.matcher(germanText);
        return m.find() ? m.group(0) : null;
    }

    private static String extractMeaning(Element germanSection) {
        Element firstDef = germanSection.selectFirst("ol > li");
        if (firstDef == null) return null;
        String t = normalizeMeaning(firstDef.text());
        return t.isBlank() ? null : t;
    }

    private static ExamplePair extractExample(String germanText) {
        Matcher m = EXAMPLE_PATTERN.matcher(germanText);
        if (m.find()) {
            return new ExamplePair(cleanExampleFragment(m.group(1)), cleanExampleFragment(m.group(2)));
        }
        return new ExamplePair(null, null);
    }

    private static NounData extractNounData(Element germanSection, String germanText) {
        if (!germanText.contains("Noun")) return null;
        NounData out = new NounData();

        Matcher nounLine = Pattern.compile("Noun\\s+([^\\n]{0,140})").matcher(germanText);
        if (nounLine.find()) {
            String line = nounLine.group(1);
            Matcher g = GENDER_PATTERN.matcher(line);
            if (g.find()) {
                out.gender = switch (g.group(1).toLowerCase(Locale.ROOT)) {
                    case "m" -> "DER";
                    case "f" -> "DIE";
                    case "n" -> "DAS";
                    default -> null;
                };
            }
            Matcher pl = PLURAL_PATTERN.matcher(line);
            if (pl.find()) out.plural = pl.group(1);
            Matcher ge = GENITIVE_PATTERN.matcher(line);
            if (ge.find()) out.genitive = ge.group(1);
        }

        if (germanText.toLowerCase(Locale.ROOT).contains("strong")) out.nounType = "STARK";
        else if (germanText.toLowerCase(Locale.ROOT).contains("weak")) out.nounType = "SCHWACH";
        else if (germanText.toLowerCase(Locale.ROOT).contains("mixed")) out.nounType = "GEMISCHT";

        Elements tables = germanSection.select("table");
        for (Element table : tables) {
            String txt = table.text().toLowerCase(Locale.ROOT);
            if (!txt.contains("declension")) continue;
            parseNounDeclensionTable(table, out);
            if (out.singularForms.size() >= 4 && out.pluralForms.size() >= 4) break;
        }
        return out;
    }

    private static void parseNounDeclensionTable(Element table, NounData out) {
        for (Element tr : table.select("tr")) {
            Elements cells = tr.select("th,td");
            if (cells.size() < 3) continue;
            String label = normalizeToken(cells.get(0).text());
            Kasus kasus = switch (label) {
                case "nominative", "nominativ" -> Kasus.NOMINATIV;
                case "accusative", "akkusative", "akkusativ" -> Kasus.AKKUSATIV;
                case "dative", "dativ" -> Kasus.DATIV;
                case "genitive", "genitiv" -> Kasus.GENITIV;
                default -> null;
            };
            if (kasus == null) continue;
            String singular = cleanInflectionCell(cells.get(1).text());
            String plural = cleanInflectionCell(cells.get(2).text());
            if (!isBlank(singular)) out.singularForms.putIfAbsent(kasus, singular);
            if (!isBlank(plural)) out.pluralForms.putIfAbsent(kasus, plural);
        }
    }

    private static VerbData extractVerbData(String germanText) {
        if (!germanText.contains("Verb")) return null;
        VerbData out = new VerbData();
        Matcher m = VERB_LINE_PATTERN.matcher(germanText);
        if (m.find()) {
            out.thirdPresent = m.group(1);
            out.preterite = m.group(2);
            out.partizip2 = m.group(3);
            out.auxiliaryVerb = m.group(4).equalsIgnoreCase("sein") ? "SEIN" : "HABEN";
        }
        return out;
    }

    private static AdjectiveData extractAdjectiveData(String germanText) {
        if (!germanText.contains("Adjective")) return null;
        AdjectiveData out = new AdjectiveData();
        Matcher c = Pattern.compile("Comparative forms of\\s+[\\p{L}ÄÖÜäöüß-]+\\s+([^\\n]{0,90})", Pattern.CASE_INSENSITIVE).matcher(germanText);
        if (c.find()) out.comparative = firstWordCandidate(c.group(1));
        Matcher s = Pattern.compile("Superlative forms of\\s+[\\p{L}ÄÖÜäöüß-]+\\s+([^\\n]{0,90})", Pattern.CASE_INSENSITIVE).matcher(germanText);
        if (s.find()) out.superlative = firstWordCandidate(s.group(1));
        return out;
    }

    private static List<DeclensionRow> toDeclensionRows(Map<Kasus, String> singular, Map<Kasus, String> plural) {
        List<DeclensionRow> rows = new ArrayList<>();
        for (Kasus k : Kasus.values()) {
            String s = singular.get(k);
            String p = plural.get(k);
            if (!isBlank(s)) rows.add(new DeclensionRow(k, Numerus.SINGULAR, s));
            if (!isBlank(p)) rows.add(new DeclensionRow(k, Numerus.PLURAL, p));
        }
        return rows;
    }

    private static List<VerbConjugationRow> inferVerbConjugations(
            String infinitive,
            String thirdPresent,
            String preterite,
            String partizip2,
            String auxiliary
    ) {
        List<VerbConjugationRow> rows = new ArrayList<>();
        String stem = inferStem(infinitive);

        Map<Pronoun, String> present = new LinkedHashMap<>();
        present.put(Pronoun.ICH, stem + "e");
        present.put(Pronoun.DU, stem + "st");
        present.put(Pronoun.ER_SIE_ES, isBlank(thirdPresent) ? stem + "t" : thirdPresent);
        present.put(Pronoun.WIR, infinitive);
        present.put(Pronoun.IHR, stem + "t");
        present.put(Pronoun.SIE_FORMAL, infinitive);
        present.forEach((p, f) -> rows.add(new VerbConjugationRow(Tense.PRASENS, p, f)));

        String pret = isBlank(preterite) ? (stem + "te") : preterite;
        Map<Pronoun, String> past = new LinkedHashMap<>();
        past.put(Pronoun.ICH, pret);
        past.put(Pronoun.DU, pret + "st");
        past.put(Pronoun.ER_SIE_ES, pret);
        past.put(Pronoun.WIR, pret + "n");
        past.put(Pronoun.IHR, pret + "t");
        past.put(Pronoun.SIE_FORMAL, pret + "n");
        past.forEach((p, f) -> rows.add(new VerbConjugationRow(Tense.PRATERITUM, p, f)));

        String aux = "SEIN".equalsIgnoreCase(auxiliary) ? "sein" : "haben";
        String part = isBlank(partizip2) ? inferPartizip2(infinitive) : partizip2;
        Map<Pronoun, String> perf = new LinkedHashMap<>();
        perf.put(Pronoun.ICH, auxForPronoun(aux, Pronoun.ICH) + " " + part);
        perf.put(Pronoun.DU, auxForPronoun(aux, Pronoun.DU) + " " + part);
        perf.put(Pronoun.ER_SIE_ES, auxForPronoun(aux, Pronoun.ER_SIE_ES) + " " + part);
        perf.put(Pronoun.WIR, auxForPronoun(aux, Pronoun.WIR) + " " + part);
        perf.put(Pronoun.IHR, auxForPronoun(aux, Pronoun.IHR) + " " + part);
        perf.put(Pronoun.SIE_FORMAL, auxForPronoun(aux, Pronoun.SIE_FORMAL) + " " + part);
        perf.forEach((p, f) -> rows.add(new VerbConjugationRow(Tense.PERFEKT, p, f)));

        return rows;
    }

    private static String auxForPronoun(String aux, Pronoun p) {
        boolean sein = "sein".equals(aux);
        return switch (p) {
            case ICH -> sein ? "bin" : "habe";
            case DU -> sein ? "bist" : "hast";
            case ER_SIE_ES -> sein ? "ist" : "hat";
            case WIR -> sein ? "sind" : "haben";
            case IHR -> sein ? "seid" : "habt";
            case SIE_FORMAL -> sein ? "sind" : "haben";
        };
    }

    private static Map<String, GoetheVerbData> loadGoetheVerbFallbacks() {
        Map<String, GoetheVerbData> out = new HashMap<>();
        try {
            HttpClient client = HttpClient.newBuilder().build();
            HttpRequest req = HttpRequest.newBuilder(URI.create(GOETHE_B1_SORTED_URL))
                    .header("User-Agent", USER_AGENT)
                    .GET()
                    .build();
            HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() < 200 || res.statusCode() >= 300) return out;

            Pattern p = Pattern.compile(
                    "^([\\p{L}ÄÖÜäöüß-]+),\\s*([\\p{L}ÄÖÜäöüß-]+),\\s*([\\p{L}ÄÖÜäöüß-]+),\\s*(hat|ist)\\s+([\\p{L}ÄÖÜäöüß-]+).*",
                    Pattern.CASE_INSENSITIVE);
            String[] lines = res.body().split("\\R");
            for (String line : lines) {
                Matcher m = p.matcher(line.trim());
                if (!m.matches()) continue;
                String lemma = normalizeLemma(m.group(1));
                out.putIfAbsent(lemma, new GoetheVerbData(
                        m.group(2),
                        m.group(3),
                        m.group(5),
                        m.group(4).equalsIgnoreCase("ist") ? "SEIN" : "HABEN"
                ));
            }
        } catch (Exception ignored) {
            // Fallback map may be empty; utility still works with Wiktionary + heuristics.
        }
        return out;
    }

    private static String normalizeIpa(String ipa) {
        if (isBlank(ipa)) return ipa;
        String x = ipa.trim();
        if (x.startsWith("[") && x.endsWith("]")) return "/" + x.substring(1, x.length() - 1) + "/";
        if (!x.startsWith("/")) return "/" + x;
        if (!x.endsWith("/")) return x + "/";
        return x;
    }

    private static String normalizeMeaning(String text) {
        if (text == null) return null;
        String cleaned = text
                .replaceAll("\\[[^\\]]+\\]", "")
                .replaceAll("\\s+", " ")
                .trim();
        int dashIdx = cleaned.indexOf(" ― ");
        if (dashIdx > 0) cleaned = cleaned.substring(0, dashIdx).trim();
        return cleaned;
    }

    private static String cleanInflectionCell(String raw) {
        if (raw == null) return null;
        String cleaned = raw
                .replaceAll("\\[[^\\]]+\\]", "")
                .replaceAll("\\(.*?\\)", "")
                .replaceAll("\\s+", " ")
                .trim();
        if (cleaned.equals("-") || cleaned.equals("—")) return null;
        return cleaned;
    }

    private static String cleanExampleFragment(String raw) {
        if (raw == null) return null;
        return raw.replaceAll("\\[[^\\]]+\\]", "").replaceAll("\\s+", " ").trim();
    }

    private static String defaultUsageNote(String dtype, String baseForm) {
        if ("Noun".equals(dtype)) {
            return "Danh tu tieng Duc. Hoc kem mao tu, so nhieu va vi du ngu canh.";
        }
        if ("Verb".equals(dtype)) {
            return "Dong tu tieng Duc. Chia theo ngoi va uu tien hoc them Prasens/Prateritum/Perfekt.";
        }
        if ("Adjective".equals(dtype)) {
            return "Tinh tu tieng Duc. Bien doi duoi theo mao tu, giong, so va Kasus.";
        }
        return "Hoc tu " + baseForm + " theo cum tu va cau vi du de dung dung ngu canh.";
    }

    private static String inferPlural(String base) {
        if (isBlank(base)) return base;
        String b = base.trim();
        if (b.endsWith("e")) return b + "n";
        if (b.endsWith("er") || b.endsWith("el")) return b;
        return b + "e";
    }

    private static String inferGenitive(String base, String genderCode) {
        if (isBlank(base)) return base;
        String b = base.trim();
        if ("DER".equals(genderCode) || "DAS".equals(genderCode)) {
            if (b.endsWith("s") || b.endsWith("ß") || b.endsWith("x") || b.endsWith("z")) return b + "es";
            return b + "s";
        }
        return b;
    }

    private static String inferDativePlural(String plural) {
        if (isBlank(plural)) return plural;
        String p = plural.trim();
        if (p.endsWith("n") || p.endsWith("s")) return p;
        return p + "n";
    }

    private static String inferPartizip2(String infinitive) {
        if (isBlank(infinitive)) return infinitive;
        String b = infinitive.trim().toLowerCase(Locale.ROOT);
        if (b.endsWith("ieren")) return b.substring(0, b.length() - 2) + "t";
        if (b.startsWith("be") || b.startsWith("ge") || b.startsWith("ver") || b.startsWith("zer") || b.startsWith("emp")) {
            return b + "t";
        }
        if (b.endsWith("en")) return "ge" + b;
        return "ge" + b + "t";
    }

    private static String inferAuxiliary(String infinitive) {
        String lemma = normalizeLemma(infinitive);
        Set<String> seinVerbs = Set.of("gehen", "kommen", "fahren", "laufen", "bleiben", "werden", "sein", "aufstehen", "einsteigen", "aussteigen");
        return seinVerbs.contains(lemma) ? "SEIN" : "HABEN";
    }

    private static String inferPreterite(String infinitive) {
        String stem = inferStem(infinitive);
        return stem + "te";
    }

    private static String inferPresentThird(String infinitive) {
        String stem = inferStem(infinitive);
        return stem + "t";
    }

    private static String inferStem(String infinitive) {
        if (isBlank(infinitive)) return "";
        String b = infinitive.trim().toLowerCase(Locale.ROOT);
        if (b.endsWith("ern") || b.endsWith("eln")) return b.substring(0, b.length() - 2);
        if (b.endsWith("en")) return b.substring(0, b.length() - 2);
        return b;
    }

    private static boolean isLikelySeparable(String infinitive) {
        String lemma = normalizeLemma(infinitive);
        return lemma.startsWith("auf") || lemma.startsWith("an") || lemma.startsWith("ein")
                || lemma.startsWith("aus") || lemma.startsWith("mit") || lemma.startsWith("vor")
                || lemma.startsWith("nach") || lemma.startsWith("zu") || lemma.startsWith("weg");
    }

    private static String inferPrefix(String infinitive) {
        String lemma = normalizeLemma(infinitive);
        String[] prefixes = {"auf", "an", "ein", "aus", "mit", "vor", "nach", "zu", "weg"};
        for (String p : prefixes) {
            if (lemma.startsWith(p) && lemma.length() > p.length() + 2) return p;
        }
        return null;
    }

    private static boolean isLikelyIrregular(String infinitive, String thirdPresent, String preterite) {
        String stem = inferStem(infinitive);
        if (!isBlank(thirdPresent) && !thirdPresent.startsWith(stem)) return true;
        if (!isBlank(preterite) && !preterite.equals(stem + "te")) return true;
        return false;
    }

    private static String inferComparative(String base) {
        if (isBlank(base)) return base;
        return base.trim() + "er";
    }

    private static String inferSuperlative(String base) {
        if (isBlank(base)) return base;
        String b = base.trim();
        if (b.endsWith("d") || b.endsWith("t") || b.endsWith("s") || b.endsWith("ß") || b.endsWith("z")) {
            return "am " + b + "esten";
        }
        return "am " + b + "sten";
    }

    private static String firstWordCandidate(String text) {
        if (isBlank(text)) return null;
        Matcher m = Pattern.compile("([\\p{L}ÄÖÜäöüß-]{3,})").matcher(text);
        return m.find() ? m.group(1) : null;
    }

    private static String articleForGender(String gender) {
        if (isBlank(gender)) return null;
        return switch (gender.toUpperCase(Locale.ROOT)) {
            case "DER" -> "der";
            case "DIE" -> "die";
            case "DAS" -> "das";
            default -> null;
        };
    }

    private static String normalizeLemma(String token) {
        if (token == null) return "";
        return token.trim().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}äöüß-]", "");
    }

    private static String normalizeToken(String token) {
        if (token == null) return "";
        return token.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return isBlank(v) ? fallback : v;
    }

    private record WordRow(
            long id,
            String dtype,
            String baseForm,
            String phonetic,
            String usageNote,
            String deMeaning,
            String deExample,
            String nounGender,
            String pluralForm,
            String genitiveForm,
            String nounType,
            String auxiliaryVerb,
            String partizip2,
            Boolean isSeparable,
            String prefix,
            Boolean verbIrregular,
            String comparative,
            String superlative,
            Boolean adjIrregular,
            int nounDeclensionCount,
            int verbConjugationCount
    ) {}

    private static class WiktionaryWordData {
        String ipa;
        String meaning;
        String exampleDe;
        String exampleEn;
        NounData noun;
        VerbData verb;
        AdjectiveData adjective;
    }

    private static class NounData {
        String gender;
        String plural;
        String genitive;
        String nounType;
        Map<Kasus, String> singularForms = new EnumMap<>(Kasus.class);
        Map<Kasus, String> pluralForms = new EnumMap<>(Kasus.class);
    }

    private static class VerbData {
        String thirdPresent;
        String preterite;
        String partizip2;
        String auxiliaryVerb;
    }

    private static class AdjectiveData {
        String comparative;
        String superlative;
    }

    private record GoetheVerbData(
            String thirdPersonPresent,
            String preterite,
            String partizip2,
            String auxiliary
    ) {}

    private static class EnrichPatch {
        String phonetic;
        String usageNote;
        String deMeaning;
        String deExample;
        NounPatch nounPatch;
        VerbPatch verbPatch;
        AdjectivePatch adjectivePatch;

        boolean hasAnyChange() {
            return phonetic != null || usageNote != null || deMeaning != null || deExample != null
                    || (nounPatch != null && nounPatch.hasChange())
                    || (verbPatch != null && verbPatch.hasChange())
                    || (adjectivePatch != null && adjectivePatch.hasChange());
        }
    }

    private static class NounPatch {
        String article;
        String gender;
        String pluralForm;
        String genitiveForm;
        String nounType;
        List<DeclensionRow> declensions = new ArrayList<>();

        boolean hasChange() {
            return gender != null || pluralForm != null || genitiveForm != null || nounType != null || !declensions.isEmpty();
        }
    }

    private static class VerbPatch {
        String auxiliaryVerb;
        String partizip2;
        Boolean isSeparable;
        String prefix;
        Boolean isIrregular;
        List<VerbConjugationRow> conjugations = new ArrayList<>();

        boolean hasChange() {
            return auxiliaryVerb != null || partizip2 != null || isSeparable != null || prefix != null || isIrregular != null || !conjugations.isEmpty();
        }
    }

    private static class AdjectivePatch {
        String comparative;
        String superlative;
        Boolean isIrregular;

        boolean hasChange() {
            return comparative != null || superlative != null || isIrregular != null;
        }
    }

    private record ExamplePair(String de, String translation) {}
    private record DeclensionRow(Kasus kasus, Numerus numerus, String form) {}
    private record VerbConjugationRow(Tense tense, Pronoun pronoun, String form) {}

    private enum Kasus { NOMINATIV, AKKUSATIV, DATIV, GENITIV }
    private enum Numerus { SINGULAR, PLURAL }
    private enum Tense { PRASENS, PRATERITUM, PERFEKT }
    private enum Pronoun { ICH, DU, ER_SIE_ES, WIR, IHR, SIE_FORMAL }

    private static class Summary {
        int processed;
        int skippedNoChange;
        int errors;
        int updatedWords;
        int updatedTranslations;
        int insertedNounRows;
        int updatedNounRows;
        int insertedVerbRows;
        int updatedVerbRows;
        int insertedAdjectiveRows;
        int updatedAdjectiveRows;
        int insertedNounDeclensions;
        int insertedVerbConjugations;
    }
}
