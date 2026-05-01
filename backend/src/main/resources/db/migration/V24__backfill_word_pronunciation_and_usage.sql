-- Backfill pseudo-IPA + usage notes (PostgreSQL)

UPDATE words
SET phonetic = CONCAT('/', LOWER(TRIM(base_form)), '/')
WHERE phonetic IS NULL OR TRIM(phonetic) = '';

UPDATE words w
SET usage_note = CASE
    WHEN w.dtype = 'Noun' THEN CONCAT(
        'Danh tu tieng Duc. Hoc kem mao tu ',
        COALESCE(
            (SELECT CASE n.gender
                WHEN 'DER' THEN 'der'
                WHEN 'DIE' THEN 'die'
                WHEN 'DAS' THEN 'das'
                ELSE NULL
            END FROM nouns n WHERE n.id = w.id),
            '(chua xac dinh)'
        ),
        ', dang so nhieu va ngu canh vi du.'
    )
    WHEN w.dtype = 'Verb' THEN CONCAT(
        'Dong tu tieng Duc. Chia theo ngoi ich/du/er-sie-es/wir/ihr/sie; Perfekt dung tro dong tu ',
        COALESCE((SELECT LOWER(v.auxiliary_verb) FROM verbs v WHERE v.id = w.id), 'haben'),
        '.'
    )
    WHEN w.dtype = 'Adjective' THEN 'Tinh tu tieng Duc. Bien doi duoi theo mao tu, giong, so va Kasus.'
    ELSE 'Hoc tu nay theo cum tu va cau vi du de su dung dung ngu canh.'
END
WHERE w.usage_note IS NULL OR TRIM(w.usage_note) = '';
