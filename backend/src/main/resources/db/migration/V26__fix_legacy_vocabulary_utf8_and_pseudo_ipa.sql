-- V24 backfilled usage_note without Vietnamese diacritics; clear so API can serve UTF-8 templates.
UPDATE words w
SET usage_note = NULL
WHERE w.usage_note IS NOT NULL
  AND (
    w.usage_note LIKE 'Danh tu tieng%'
    OR w.usage_note LIKE 'Dong tu tieng%'
    OR w.usage_note LIKE 'Tinh tu tieng%'
    OR w.usage_note LIKE 'Hoc tu nay theo cum tu%'
  );

-- V24 backfill set phonetic to "/lowercase_lemma/" — not real IPA; clear for re-enrichment.
UPDATE words
SET phonetic = NULL
WHERE phonetic IS NOT NULL
  AND phonetic = CONCAT('/', LOWER(TRIM(base_form)), '/');
