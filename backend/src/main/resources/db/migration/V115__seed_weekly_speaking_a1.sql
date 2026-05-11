-- V115: Seed weekly speaking prompts for A1 level
-- Topics are synthesized from content already learned in the A1 curriculum (Days 1-35)
-- They reinforce vocabulary/grammar from completed nodes WITHOUT duplicating the exact
-- writing/speaking exercises used inside those nodes.
-- Week start dates cover the next 8 weeks from the current date (rolling, always available).

-- Helper: compute this Monday as the anchor for the next 8 weeks
-- We use a fixed base of 2026-05-11 (deploy date) and seed 8 consecutive weeks.

INSERT INTO weekly_speaking_prompts (
  week_start_date, cefr_band, title, prompt_de,
  mandatory_points_json, optional_points_json, prompt_version, is_active
) VALUES

-- Week 1 (current week): Mein erster Tag auf Deutsch — Bảng chữ cái & Số đếm
-- Liên quan node: Bảng chữ cái (P1/P2), Số đếm
-- Không trùng: bài tập trong node là nhận diện/đọc; đây là NGỮ CẢNH giao tiếp thực tế
(
  '2026-05-11',
  'A1',
  'Mein erster Tag auf Deutsch',
  E'Stell dir vor: Du hast heute deinen ersten Tag in Deutschland. Beschreibe auf Deutsch:\n'
  E'1. Wie heißt du? Buchstabiere deinen Namen.\n'
  E'2. Wie alt bist du? Nenn eine Zahl zwischen 1 und 100.\n'
  E'3. Wo wohnst du? Welche Hausnummer und Postleitzahl hast du?\n\n'
  E'Verwende: Alphabet, Zahlen (1–100), einfache Sätze mit "Ich heiße..." und "Ich bin...".',
  '["Deinen Vornamen buchstabieren", "Eine Zahl zwischen 1-100 nennen", "Einen Satz mit ''Ich bin...'' bilden"]',
  '["Eine Adresse auf Deutsch sagen", "Nach dem Namen fragen: ''Wie heißt du?''"]',
  'v1',
  TRUE
),

-- Week 2: Begrüßung im Alltag — Chào hỏi
-- Liên quan node: Grußformeln, Sich vorstellen
(
  '2026-05-18',
  'A1',
  'Begrüßung im Alltag',
  E'Du triffst verschiedene Menschen: einen Freund morgens, deinen Chef um 14 Uhr und eine alte Dame abends.\n'
  E'Beschreibe, wie du jede Person begrüßt und verabschiedest.\n\n'
  E'Verwende: Guten Morgen / Guten Tag / Guten Abend / Tschüs / Auf Wiedersehen / Wie geht es Ihnen? / Wie geht''s?',
  '["Drei verschiedene Begrüßungen nennen", "Einen formellen und einen informellen Abschied unterscheiden", "Auf ''Wie geht es Ihnen?'' antworten"]',
  '["Die Tageszeit erklären (Morgen/Mittag/Abend)", "Eine Person vorstellen: ''Das ist...''"]',
  'v1',
  TRUE
),

-- Week 3: Meine Familie — Gia đình
-- Liên quan node: Familie und Verwandte
(
  '2026-05-25',
  'A1',
  'Meine Familie',
  E'Beschreibe deine Familie (oder eine fiktive Familie) auf Deutsch.\n'
  E'Beantworte diese Fragen:\n'
  E'1. Wie viele Personen sind in deiner Familie?\n'
  E'2. Wie heißen deine Eltern / Geschwister?\n'
  E'3. Wie alt sind sie?\n\n'
  E'Verwende: Mutter, Vater, Bruder, Schwester, Oma, Opa + Verb "haben" + Zahlen.',
  '["Mindestens 3 Familienmitglieder nennen", "Possessivpronomen benutzen (mein/meine)", "Alter mit ''Er/Sie ist ... Jahre alt'' sagen"]',
  '["Beziehungen beschreiben: ''Mein Vater ist der Sohn von...''", "Eine Aktivität nennen, die die Familie gemeinsam macht"]',
  'v1',
  TRUE
),

-- Week 4: Im Supermarkt — Đi siêu thị (Lebensmittel + Zahlen + einkaufen)
-- Liên quan node: Lebensmittel, Einkaufen
(
  '2026-06-01',
  'A1',
  'Einkaufen im Supermarkt',
  E'Du bist im Supermarkt und kaufst Lebensmittel für das Wochenende ein.\n'
  E'Beschreibe:\n'
  E'1. Was kaufst du? Nenn mindestens 5 Lebensmittel.\n'
  E'2. Wie viel kostet alles? Sag den Preis auf Deutsch.\n'
  E'3. Führe einen kurzen Dialog an der Kasse: Begrüßung, zahlen, Verabschiedung.\n\n'
  E'Verwende: Ich möchte..., Das kostet..., Zahlen + Euro/Cent, bitte/danke.',
  '["5 Lebensmittel auf Deutsch nennen", "Einen Preis mit Euro und Cent sagen", "Einen Dialog mit Kassierer (3 Sätze min.) durchführen"]',
  '["Mengenangaben verwenden (ein Kilo, eine Flasche, zwei Liter)", "Nach dem Weg zur Kasse fragen"]',
  'v1',
  TRUE
),

-- Week 5: Mein Tagesablauf — Cuộc sống hàng ngày (Uhrzeit + trennbare Verben)
-- Liên quan node: Uhrzeit & Tagesablauf, Trennbare Verben
(
  '2026-06-08',
  'A1',
  'Mein Tagesablauf',
  E'Beschreibe deinen typischen Tagesablauf von morgens bis abends.\n'
  E'Beantworte:\n'
  E'1. Um wie viel Uhr stehst du auf? Was machst du als erstes?\n'
  E'2. Wann frühstückst du, arbeitest du, machst du Mittagspause?\n'
  E'3. Was machst du abends vor dem Schlafen?\n\n'
  E'Verwende: aufstehen, frühstücken, anfangen, aufmachen + Uhrzeiten (Es ist ... Uhr / Um ... Uhr).',
  '["Mindestens 4 Aktivitäten mit Uhrzeiten nennen", "Zwei trennbare Verben korrekt verwenden", "Zeitausdrücke benutzen (morgens, mittags, abends, dann, danach)"]',
  '["Den Unterschied Arbeitstag vs. Wochenende beschreiben", "Einen Satz mit ''Ich muss...'' bilden"]',
  'v1',
  TRUE
),

-- Week 6: Wohnen & Zimmer — Nơi ở
-- Liên quan node: Wohnen, Wohnungsanzeigen
(
  '2026-06-15',
  'A1',
  'Meine Wohnung',
  E'Beschreibe deine Wohnung oder dein Zimmer auf Deutsch.\n'
  E'Beantworte:\n'
  E'1. Wie viele Zimmer hast du? Welche Zimmer gibt es?\n'
  E'2. Was steht in deinem Wohnzimmer / Schlafzimmer?\n'
  E'3. Was magst du an deiner Wohnung? Was würdest du gerne ändern?\n\n'
  E'Verwende: Zimmer/Räume (Küche, Bad, Flur...), Möbel (Stuhl, Tisch, Bett...), es gibt, es hat.',
  '["Mindestens 3 Zimmer nennen", "5 Möbelstücke oder Gegenstände beschreiben", "Einen Satz mit ''Ich mag...'' oder ''Ich finde... (nicht) schön'' bilden"]',
  '["Die Lage beschreiben: ''Das Bett steht neben...''", "Eine Wohnungsanzeige kurz vorlesen und erklären"]',
  'v1',
  TRUE
),

-- Week 7: Verkehr & Orientierung — Đi lại
-- Liên quan node: Verkehr, Fahrkarten kaufen
(
  '2026-06-22',
  'A1',
  'Mit dem Bus in die Stadt',
  E'Du möchtest mit dem Bus ins Stadtzentrum fahren und einen Freund treffen.\n'
  E'Beschreibe die Situation:\n'
  E'1. Wohin möchtest du fahren? Mit welchem Verkehrsmittel?\n'
  E'2. Wie kaufst du ein Ticket? Führe einen kurzen Dialog durch.\n'
  E'3. Wie lange dauert die Fahrt ungefähr?\n\n'
  E'Verwende: Bus/Bahn/Straßenbahn, eine Fahrkarte kaufen, Wohin? / Wo? + Präpositionen (zum, zur, nach).',
  '["Das Ziel und das Verkehrsmittel nennen", "Einen Satz zum Ticketkauf bilden (''Ich möchte...'')", "Eine ungefähre Dauer in Minuten angeben"]',
  '["Nach dem Weg fragen: ''Wie komme ich zu...?''", "Den Fahrplan lesen und eine Uhrzeit nennen"]',
  'v1',
  TRUE
),

-- Week 8: Beim Arzt — Ở bệnh viện/phòng khám
-- Liên quan node: Körper & Gesundheit, Arztbesuch
(
  '2026-06-29',
  'A1',
  'Beim Arzt',
  E'Du bist krank und gehst zum Arzt. Beschreibe:\n'
  E'1. Welche Beschwerden hast du? (Kopfschmerzen, Halsschmerzen, Fieber...)\n'
  E'2. Führe einen kurzen Dialog mit dem Arzt: Wie lange bist du schon krank?\n'
  E'3. Was empfiehlt der Arzt? (Tabletten, Ruhe, viel Wasser trinken...)\n\n'
  E'Verwende: Körperteile, Schmerzen = ''...schmerzen'', seit (+ Dativ), Modalverb ''müssen/sollen''.',
  '["Mindestens 2 Symptome auf Deutsch nennen", "Seit wann du krank bist sagen (''Seit gestern / zwei Tagen'')", "Eine Empfehlung des Arztes beschreiben"]',
  '["Eine Entschuldigung für die Arbeit/Schule erwähnen (Krankschreibung)", "Medikamente beschreiben: ''Ich nehme ... Tabletten''"]',
  'v1',
  TRUE
)

ON CONFLICT DO NOTHING;
