-- Weekly speaking seed (PostgreSQL)
INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE,
       'B1',
       'Woche im Überblick',
       'Sprechen Sie etwa 1–2 Minuten auf Deutsch: Was haben Sie diese Woche gemacht? Nennen Sie mindestens eine Arbeitssache und eine Freizeitsache.',
       json_build_array('Arbeit oder Lernen nennen', 'Freizeit oder Hobby nennen', 'Zeitmarker wie „diese Woche“ verwenden')::jsonb,
       json_build_array('Kurz sagen, wie es war (gut/mühsam)')::jsonb,
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE
      AND w.cefr_band = 'B1'
);

INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE,
       'A2',
       'Meine Woche (einfach)',
       'Erzählen Sie in sehr einfachen Sätzen: Was haben Sie diese Woche gemacht?',
       json_build_array('Mindestens zwei Aktivitäten nennen', 'Ein Satz über Montag oder Wochenende')::jsonb,
       json_build_array('Ein Adjektiv: gut, müde, interessant')::jsonb,
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE
      AND w.cefr_band = 'A2'
);
