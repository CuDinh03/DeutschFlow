-- Ensure A1 row exists alongside V45 bands for the migrate-time ISO week so A1 learners do not cascade only via fallback.
INSERT INTO weekly_speaking_prompts (
    week_start_date, cefr_band, title, prompt_de, mandatory_points_json, optional_points_json, is_active
)
SELECT DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE,
       'A1',
       'Meine Woche (ganz kurz)',
       'Sagen Sie 3–6 sehr kurze deutsche Sätze: Was machen Sie oft? Was haben Sie diese Woche gemacht?',
       json_build_array(
           'Mindestens ein Satz mit „ich“ oder „am …“',
           'Ein Wort für Arbeit/Schule und ein Wort für Freizeit nennen',
           '„diese Woche“ oder einen Tag wie „Montag“ sagen')::jsonb,
       json_build_array('„gut“ oder „müde“ sagen')::jsonb,
       TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM weekly_speaking_prompts w
    WHERE w.week_start_date = DATE_TRUNC('week', CURRENT_TIMESTAMP::TIMESTAMP)::DATE
      AND w.cefr_band = 'A1'
);
