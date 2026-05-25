# Smart Free vocabulary enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement **monthly character metering** (DeepL Free hard-stop 490k / Azure Free configurable cap), **`app.vocabulary.strict-free-mode`** guards, **Azure Cognitive Services Translator** client + backfill path, and an optional **orchestrated** enrichment flow that follows spec order: scrape → DeepL Free (under cap) → Azure Free (under cap).

**Architecture:** Add a small Postgres table for **per-provider, per-month `chars_input`** counters. A `TranslationUsageMeter` service performs **atomic** `UPDATE … WHERE chars_input + delta <= cap` so concurrent schedulers cannot overshoot. `DeepLLemmaBackfillService` and new Azure backfill call the meter **before** each external API call. `strict-free-mode` (default `true`) blocks paid DeepL endpoints and requires an explicit **`AZURE_TRANSLATOR_FREE_TIER_ACK=true`** env (or similar) before enabling Azure adapter. **Orchestration** is implemented as `SmartFreeEnrichmentOrchestrator` + single scheduler flag `app.vocabulary.smart-free-orchestrator.enabled`; when `true`, existing separate schedulers (`WiktionaryEnrichmentScheduler`, `GlosbeViEnrichmentService` tick, `DeepLLemmaBackfillScheduler`) are disabled via `@ConditionalOnProperty(matchIfMissing = true inverted)` — **preferred:** orchestrator `@ConditionalOnProperty` `enabled=true`, and flip **default false** first release, OR keep parallel until orchestrator validated — **plan chooses:** add orchestrator disabled by default, wire conditionals only when orchestrator enabled to avoid breaking current dev setups.

**Tech Stack:** Spring Boot 3.2, `JdbcTemplate`, Flyway, RestTemplate/WebClient for Azure Translator REST v3, JUnit 5 + `@JdbcTest` or lightweight Spring test with H2-disabled (use Postgres IT pattern from repo), Mockito for HTTP.

**Tracked copy:** This file lives under `superpowers-specs/plans/` because `docs/` is gitignored.

**Specification reference:** `superpowers-specs/2026-05-02-vocabulary-continuous-enrichment-roadmap-design.md`.

---

## File map (create / modify)

| Path | Responsibility |
|------|----------------|
| Create `backend/src/main/resources/db/migration/V49__translation_provider_monthly_usage.sql` *(bump version if branch already added a different V49)* | Table `translation_provider_monthly_usage (provider, billing_month, chars_input, updated_at)` PK `(provider,billing_month)` |
| Create `backend/src/main/java/com/deutschflow/vocabulary/service/TranslationUsageMeter.java` | `tryConsume(provider, billingMonth, delta, monthlyCap)`, `currentUsage`, uses `JdbcTemplate` + transactional updates |
| Create `backend/src/main/java/com/deutschflow/vocabulary/service/AzureTranslatorService.java` | POST `translate` API v3.0; maps DE→EN / DE→VI; returns `Optional<String>`; no-op if key unset |
| Create `backend/src/main/java/com/deutschflow/vocabulary/service/AzureLemmaBackfillService.java` | Batch select words needing EN/VI; call AzureTranslatorService; upsert `word_translations`; integrate meter (`AZURE` cap configurable, default **1_900_000** buffer below 2M) |
| Create `backend/src/main/java/com/deutschflow/vocabulary/service/AzureLemmaBackfillScheduler.java` | `@Scheduled` wired like `DeepLLemmaBackfillScheduler`; respects strict-free-mode |
| Modify `backend/src/main/java/com/deutschflow/vocabulary/service/DeepLLemmaBackfillService.java` | Call `TranslationUsageMeter.tryConsume` for `DEEPL_FREE` with cap **490_000**; skip translate when exhausted |
| Modify `DeepLTranslationService` (optional) | When `strict-free-mode` is on, assert base URL is DeepL **Free** host only; otherwise no-op |
| Create `backend/src/main/java/com/deutschflow/vocabulary/service/SmartFreeEnrichmentOrchestrator.java` | Per-word / small batch: scrape leg (delegates enrichOne Wikitionary/Glosbe); then DeepL leg with meter; then Azure leg with meter |
| Create `backend/src/main/java/com/deutschflow/vocabulary/service/SmartFreeEnrichmentScheduler.java` | `@Scheduled` invokes orchestrator slice |
| Create `backend/src/main/java/com/deutschflow/common/config/VocabularyStrictFreeProperties.java` | `@ConfigurationProperties(prefix = "app.vocabulary")` for `strictFreeMode`, orchestrator toggle, azure ack |
| Modify `backend/src/main/resources/application.yml` | New keys documented + env placeholders |
| Modify `.env.example` | `AZURE_TRANSLATOR_KEY`, region, caps, ack flags |
| Modify `backend/src/main/java/com/deutschflow/admin/controller/AdminManagementController.java` | `GET /vocabulary/enrichment/status` aggregates meter rows + cursory flags |
| Create `backend/src/test/java/com/deutschflow/vocabulary/TranslationUsageMeterTest.java` | Postgres or pure JDBC-H2 forbidden — follow `AbstractPostgresIntegrationTest` or Testcontainers-less unit with `@SpringBootTest` disabled; **prefer:** integration test inserting into real PG from project's IT base |
| Create `backend/src/test/java/com/deutschflow/vocabulary/AzureTranslatorServiceMockTest.java` | `RestTemplate` + `MockRestServiceServer` verifying URL, headers (`Ocp-Apim-Subscription-Key`), body |

---

### Task 1: Flyway — monthly usage table

**Files:**
- Create: `backend/src/main/resources/db/migration/V49__translation_provider_monthly_usage.sql` *(renumber if V49 taken — use next free version after inspecting `db/migration/` listing)*

- [ ] **Step 1: Pick next Flyway version**

Run:

```bash
ls backend/src/main/resources/db/migration/V*.sql | sort -V | tail -5
```

If `V48` exists, create `V49__translation_provider_monthly_usage.sql`; if collision, bump.

- [ ] **Step 2: Add migration SQL**

```sql
CREATE TABLE IF NOT EXISTS translation_provider_monthly_usage (
    provider VARCHAR(32) NOT NULL,
    billing_month VARCHAR(7) NOT NULL,
    chars_input BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_translation_provider_monthly_usage PRIMARY KEY (provider, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_translation_provider_month_updated
    ON translation_provider_monthly_usage (billing_month DESC, updated_at DESC);
```

- [ ] **Step 3: Run compile + test Flyway on IT DB**

```bash
cd backend && ./mvnw -q compile -DskipTests
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V49__translation_provider_monthly_usage.sql
git commit -m "feat(db): translation_provider_monthly_usage for API char metering"
```

---

### Task 2: `TranslationUsageMeter` (+ unit/integration test first)

**Files:**
- Create: `backend/src/main/java/com/deutschflow/vocabulary/service/TranslationUsageMeter.java`
- Create: `backend/src/test/java/com/deutschflow/vocabulary/TranslationUsageMeterTest.java`

**Constants:**

```java
public static final String PROVIDER_DEEPL_FREE = "DEEPL_FREE";
public static final String PROVIDER_AZURE_TRANSLATOR_FREE = "AZURE_TRANSLATOR_FREE";
```

- [ ] **Step 1: Write failing integration test**

Use your project’s Postgres IT base (`AbstractPostgresIntegrationTest` if present). Minimal test:

```java
@SpringBootTest
@ActiveProfiles("test")
// inherit or @Import minimal JdbcTemplate — match existing vocabulary IT patterns
class TranslationUsageMeterTest {

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired TranslationUsageMeter meter;

    @BeforeEach void clean() {
        jdbcTemplate.update("DELETE FROM translation_provider_monthly_usage");
    }

    @Test
    void tryConsume_accumulates_under_cap() {
        YearMonth ym = YearMonth.of(2026, 5);
        assertThat(meter.tryConsume(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym, 100, 490_000)).isTrue();
        assertThat(meter.tryConsume(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym, 489_900, 490_000)).isTrue();
        assertThat(meter.tryConsume(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym, 1, 490_000)).isFalse();
    }
}
```

Run:

```bash
cd backend && ./mvnw -q test -Dtest=TranslationUsageMeterTest
```

Expected: FAIL (class missing).

- [ ] **Step 2: Implement `TranslationUsageMeter`**

```java
@Service
public class TranslationUsageMeter {

    private final JdbcTemplate jdbcTemplate;

    public TranslationUsageMeter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** @return true if delta was booked under cap */
    @Transactional
    public boolean tryConsume(String provider, YearMonth billingMonth, long delta, long monthlyHardCap) {
        if (delta <= 0) return true;
        String ym = billingMonth.toString();
        jdbcTemplate.update("""
                INSERT INTO translation_provider_monthly_usage (provider, billing_month, chars_input)
                VALUES (?, ?, 0)
                ON CONFLICT (provider, billing_month) DO NOTHING
                """, provider, ym);

        int n = jdbcTemplate.update("""
                UPDATE translation_provider_monthly_usage
                SET chars_input = chars_input + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE provider = ? AND billing_month = ?
                  AND chars_input + ? <= ?
                """, delta, provider, ym, delta, monthlyHardCap);
        return n == 1;
    }

    public long currentUsage(String provider, YearMonth billingMonth) {
        Long v = jdbcTemplate.query(
                "SELECT chars_input FROM translation_provider_monthly_usage WHERE provider = ? AND billing_month = ?",
                rs -> rs.next() ? rs.getLong(1) : 0L,
                provider, billingMonth.toString());
        return v == null ? 0L : v;
    }
}
```

Ensure `@EnableTransactionManagement` already on app — Spring Boot defaults yes.

Run:

```bash
cd backend && ./mvnw -q test -Dtest=TranslationUsageMeterTest
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/deutschflow/vocabulary/service/TranslationUsageMeter.java \
        backend/src/test/java/com/deutschflow/vocabulary/TranslationUsageMeterTest.java
git commit -m "feat(vocab): TranslationUsageMeter for monthly char caps"
```

---

### Task 3: Wire metering into DeepL lemma backfill (490k/month)

**Files:**
- Modify: `backend/src/main/java/com/deutschflow/vocabulary/service/DeepLLemmaBackfillService.java`
- Modify: `backend/src/test/resources/application-test.yml` (if needed for meter bean)

**Behavior:** Before each `deepLTranslationService.translate(lemma, ...)`, compute `delta = lemma.length()` (approximate billed input chars). Call `meter.tryConsume(DEEPL_FREE, YearMonth.now(ZoneOffset.UTC), delta, 490_000)`. If false, **abort further DeepL calls in this batch** and return structured status `deeplMonthlyCapReached`.

- [ ] **Step 1: Add integration test**

`DeepLLemmaBackfillServiceCapTest.java`: stub `DeepLTranslationService` `@MockBean` to count invocations; pre-fill table with chars_input near 490k; assert translate **not called** once cap blocked.

(Skeleton — adjust to Boot test wiring your module uses.)

- [ ] **Step 2: Edit `DeepLLemmaBackfillService`**

Inject `TranslationUsageMeter`. Replace inner loop excerpt:

```java
YearMonth ym = YearMonth.now(ZoneOffset.UTC);
final long HARD_CAP = 490_000L;

// before needEn translate:
long dEn = row.needEn ? lemma.length() : 0;
if (dEn > 0 && !translationUsageMeter.tryConsume(TranslationUsageMeter.PROVIDER_DEEPL_FREE, ym, dEn, HARD_CAP)) {
    out.put("deeplMonthlyCapReached", true);
    break;
}
// then Optional<String> en = deepLTranslationService.translate(lemma, "EN");
```

Mirror for VI. Accumulate `out.put("deeplCharsBookedEstimate", ...)`.

Run:

```bash
cd backend && ./mvnw -q test -Dtest=DeepLLemmaBackfillServiceCapTest,TranslationUsageMeterTest
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(vocab): DeepL lemma backfill respects 490k monthly meter"
```

---

### Task 4: Configuration — `strict-free-mode` & caps

**Files:**
- Create: `backend/src/main/java/com/deutschflow/common/config/VocabularyStrictFreeProperties.java`
- Modify: `backend/src/main/resources/application.yml`

```java
@ConfigurationProperties(prefix = "app.vocabulary")
@Getter
@Setter
public class VocabularyStrictFreeProperties {
    /** When true: never call paid SKUs; require explicit ack for Azure free tier. */
    private boolean strictFreeMode = true;
    /** Orchestrator replaces parallel schedulers when true */
    private boolean smartFreeOrchestratorEnabled = false;
    /** Operator asserts Azure subscription is Free F0/S0 free quota — documented in README */
    private boolean azureTranslatorFreeTierAcknowledged = false;
}
```

Enable:

```yaml
app:
  vocabulary:
    strict-free-mode: ${APP_VOCAB_STRICT_FREE_MODE:true}
    smart-free-orchestrator-enabled: ${APP_VOCAB_SMART_FREE_ORCHESTRATOR:false}
    azure-translator-free-tier-acknowledged: ${AZURE_TRANSLATOR_FREE_TIER_ACK:false}
```

Add `@EnableConfigurationProperties(VocabularyStrictFreeProperties.class)` in an existing `@Configuration` (e.g. new `VocabularyQuotaConfig.java` minimal).

Run `./mvnw -q compile -DskipTests`.

Commit message: `feat(config): vocabulary strict-free-mode flags`.

---

### Task 5: `AzureTranslatorService` (REST v3)

**Files:**
- Create: `backend/src/main/java/com/deutschflow/vocabulary/service/AzureTranslatorService.java`
- Create: `backend/src/test/java/com/deutschflow/vocabulary/AzureTranslatorServiceMockTest.java`

**Endpoints (canonical):**

- Global: `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=de&to={en|vi}`
- Headers: `Ocp-Apim-Subscription-Key: {key}`, `Ocp-Apim-Subscription-Region: {region}` (required for multi-region keys)

Payload:

```json
[{"Text":"der"}]
```

- [ ] **Step 1: Mock server test expecting POST**

See Microsoft docs snapshot in test comment. Use `MockRestServiceServer` binding to a `RestTemplate` bean used only by `AzureTranslatorService`.

- [ ] **Step 2: Implement service**

```java
@Service
public class AzureTranslatorService {

    @Value("${app.azure.translator.key:}")
    private String apiKey;
    @Value("${app.azure.translator.region:}")
    private String region;
    @Value("${app.azure.translator.endpoint:https://api.cognitive.microsofttranslator.com}")
    private String endpoint;

    private final RestTemplate restTemplate = new RestTemplate();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && region != null && !region.isBlank();
    }

    public Optional<String> translateDeTo(String lemma, String targetIso6391) {
        if (!isConfigured()) return Optional.empty();
        // build URI, HttpEntity with List.of(Map.of("Text", lemma)), parse first translation
        return Optional.ofNullable(parsed);
    }
}
```

**strict-free:** In `@PostConstruct` or first call, if `strictFreeMode && !azureTranslatorFreeTierAcknowledged`, return empty and log once WARN.

Run tests.

Commit: `feat(vocab): AzureTranslatorService (translate v3)`.

---

### Task 6: `AzureLemmaBackfillService` + scheduler

**Files:**
- Create: `backend/src/main/java/com/deutschflow/vocabulary/service/AzureLemmaBackfillService.java`
- Create: `backend/src/main/java/com/deutschflow/vocabulary/service/AzureLemmaBackfillScheduler.java`

Reuse SQL shape from `DeepLLemmaBackfillService` (same `need_en` / `need_vi` CTE), `SOURCE = AZURE_LEMMA_BACKFILL`, separate `vocabulary_import_state` cursor.

Cap: `@Value("${app.vocabulary.azure-lemma-backfill.monthly-char-cap:1900000}")`

Before each `translateDeTo`, `tryConsume(PROVIDER_AZURE_TRANSLATOR_FREE, ym, lemma.length(), cap)`.

`application.yml`:

```yaml
app:
  azure:
    translator:
      key: ${AZURE_TRANSLATOR_KEY:}
      region: ${AZURE_TRANSLATOR_REGION:}
      endpoint: ${AZURE_TRANSLATOR_ENDPOINT:https://api.cognitive.microsofttranslator.com}
  vocabulary:
    azure-lemma-backfill:
      enabled: ${AZURE_LEMMA_BACKFILL_ENABLED:true}
      batch-size: ${AZURE_LEMMA_BACKFILL_BATCH_SIZE:20}
      delay-ms: ${AZURE_LEMMA_BACKFILL_TICK_MS:10000}
      monthly-char-cap: ${AZURE_LEMMA_BACKFILL_MONTHLY_CAP:1900000}
```

Disable in `application-test.yml`: `azure-lemma-backfill.enabled: false`.

Commit: `feat(vocab): Azure lemma backfill + scheduler + monthly meter`.

---

### Task 7: `SmartFreeEnrichmentOrchestrator` (policy order)

**Files:**
- Create: `backend/src/main/java/com/deutschflow/vocabulary/service/SmartFreeEnrichmentOrchestrator.java`
- Create: `backend/src/main/java/com/deutschflow/vocabulary/service/SmartFreeEnrichmentScheduler.java`

**Algorithm (per batch of word IDs from same CTE as today, limit N):**

For each `wordId`:

1. Load `base_form`, `need_en`, `need_vi` (query or two EXISTS).
2. If `need_en`: call `wiktionaryEnrichmentBatchService.enrichOne(wordId)` — if still missing valid EN (re-query or check result `enUpserts` / JDBC exists), optionally **second pass** omitted in v1 → go to DeepL EN only if `need_en` after scrape (strict: derive by small `WordTranslationReadPort` helper).
3. If `need_vi`: `glosbeViEnrichmentService.enrichOne(wordId)` (+ re-check VI).
4. For remaining locales: DeepL translate with meter; then Azure translate with meter. Reuse UPSERT SQL from `DeepLLemmaBackfillService` private method → extract `WordTranslationUpserter` util if DRY matters.

**v1 pragmatic:** Orchestrator selects words **only** those still missing EN or VI after a **cheap EXISTS check**, then runs **attempt scrape** (`enrichOne` for Wikitionary always updates IPA too — acceptable), **re-check**; if still gap, DeepL + Azure chains.

Expose `runBatch(limit, resetCursor)` returning `Map` like existing services.

- [ ] **Step 2: Conditional schedulers**

On `WiktionaryEnrichmentScheduler`, `GlosbeViEnrichmentService.runScheduled()`, `DeepLLemmaBackfillScheduler`, `AzureLemmaBackfillScheduler`:

```java
@ConditionalOnProperty(name = "app.vocabulary.smart-free-orchestrator-enabled", havingValue = "false", matchIfMissing = true)
```

On `SmartFreeEnrichmentScheduler`:

```java
@ConditionalOnProperty(name = "app.vocabulary.smart-free-orchestrator-enabled", havingValue = "true")
```

This preserves today’s defaults when orchestrator disabled.

Commit: `feat(vocab): SmartFree enrichment orchestrator (optional scheduler)`.

---

### Task 8: Admin status endpoint

**Files:**
- Modify: `backend/src/main/java/com/deutschflow/admin/controller/AdminManagementController.java`
- Optional: `AdminManagementService` method `enrichmentMeterStatus()` using `TranslationUsageMeter.currentUsage` for both providers and `YearMonth.now(UTC)`.

Example response:

```json
{
  "billingMonth": "2026-05",
  "deeplFree": { "charsInput": 12000, "cap": 490000 },
  "azureFree": { "charsInput": 0, "cap": 1900000 },
  "strictFreeMode": true,
  "orchestratorEnabled": false
}
```

Integration test: admin JWT → 200.

Commit: `feat(admin): GET vocabulary enrichment meter status`.

---

### Task 9: Docs & `.env.example`

**Files:**
- Modify: `.env.example`
- Modify: `superpowers-specs/2026-05-02-vocabulary-continuous-enrichment-roadmap-design.md` (optional cross-link to this plan path)

Append:

```
# Azure Translator (Smart Free Tier — confirm quota in Azure portal)
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_REGION=eastus
AZURE_TRANSLATOR_FREE_TIER_ACK=false

APP_VOCAB_STRICT_FREE_MODE=true
APP_VOCAB_SMART_FREE_ORCHESTRATOR=false
```

Commit: `docs: env knobs for Smart Free enrichment plan`.

---

## Self-review vs spec

| Spec section | Plan coverage |
|----------------|---------------|
| §4 Smart Free stack | Tasks 5–7 (Azure), Task 3 (DeepL adjunct), scraping unchanged orchestrated in 7 |
| §5 Fail-over order | Task 7 explicit sequence scrape → DeepL meter → Azure meter |
| §6 Done ~10k | Validated indirectly via coverage APIs + existing metrics; optional follow-up dashboard |
| §7 strict-free-mode | Task 4 + Azure ack gate in Task 5 |
| §8 Observability | Task 8 + existing logs extended in Tasks 6–7 |
| §9 Future schema `translation_source` | **Gap** — out of scope for this plan; add later |

**Placeholder scan:** No TBD remaining in actionable tasks.

**Type naming:** Providers are `TranslationUsageMeter.PROVIDER_*` constants — reuse consistently in Tasks 6–8.

---

## Execution handoff

**Plan complete and saved to `superpowers-specs/plans/2026-05-02-smart-free-enrichment-implementation.md`.** (Mirror under `docs/superpowers/plans/` if you keep local docs sync.)

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration (superpowers:subagent-driven-development).

2. **Inline Execution** — run tasks in this session with checkpoints (superpowers:executing-plans).

**Which approach do you want?**
