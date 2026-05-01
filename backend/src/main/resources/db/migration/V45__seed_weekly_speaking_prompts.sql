-- Starter weekly prompts so dev/staging has a prompt on first boot (idempotent).
-- Uses MySQL server's calendar for "this Monday"; production may prefer admin CRUD for full control.

INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
       'B1',
       'Woche im Überblick',
       'Sprechen Sie etwa 1–2 Minuten auf Deutsch: Was haben Sie diese Woche gemacht? Nennen Sie mindestens eine Arbeitssache und eine Freizeitsache.',
       JSON_ARRAY('Arbeit oder Lernen nennen', 'Freizeit oder Hobby nennen', 'Zeitmarker wie „diese Woche“ verwenden'),
       JSON_ARRAY('Kurz sagen, wie es war (gut/mühsam)'),
       TRUE
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND w.cefr_band = 'B1'
);

INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
       'A2',
       'Meine Woche (einfach)',
       'Erzählen Sie in sehr einfachen Sätzen: Was haben Sie diese Woche gemacht?',
       JSON_ARRAY('Mindestens zwei Aktivitäten nennen', 'Ein Satz über Montag oder Wochenende'),
       JSON_ARRAY('Ein Adjektiv: gut, müde, interessant'),
       TRUE
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND w.cefr_band = 'A2'
);
