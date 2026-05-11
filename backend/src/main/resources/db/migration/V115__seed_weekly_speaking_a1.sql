-- V115: Seed weekly speaking prompts for A1 level
-- Topics synthesized from A1 curriculum content (Days 1-35)
-- Does NOT duplicate exact writing/speaking exercises from core nodes
-- Uses dollar-quoting ($$ ... $$) for multi-line text safety

INSERT INTO weekly_speaking_prompts (
  week_start_date, cefr_band, title, prompt_de,
  mandatory_points_json, optional_points_json, prompt_version, is_active
) VALUES

(
  '2026-05-11', 'A1',
  'Mein erster Tag auf Deutsch',
  $$Stell dir vor: Du hast heute deinen ersten Tag in Deutschland.
Beschreibe auf Deutsch:
1. Wie heißt du? Buchstabiere deinen Namen.
2. Wie alt bist du? Nenn eine Zahl zwischen 1 und 100.
3. Wo wohnst du? Welche Hausnummer und Postleitzahl hast du?

Verwende: Alphabet, Zahlen (1-100), einfache Saetze mit "Ich heisse..." und "Ich bin..."$$,
  '["Deinen Vornamen buchstabieren", "Eine Zahl zwischen 1-100 nennen", "Einen Satz mit Ich bin bilden"]',
  '["Eine Adresse auf Deutsch sagen", "Nach dem Namen fragen: Wie heisst du?"]',
  'v1', TRUE
),

(
  '2026-05-18', 'A1',
  'Begrüßung im Alltag',
  $$Du triffst verschiedene Menschen: einen Freund morgens, deinen Chef um 14 Uhr und eine alte Dame abends.
Beschreibe, wie du jede Person begruesst und verabschiedest.

Verwende: Guten Morgen / Guten Tag / Guten Abend / Tschuess / Auf Wiedersehen / Wie geht es Ihnen? / Wie gehts?$$,
  '["Drei verschiedene Begruessungen nennen", "Einen formellen und einen informellen Abschied unterscheiden", "Auf Wie geht es Ihnen antworten"]',
  '["Die Tageszeit erklaeren (Morgen/Mittag/Abend)", "Eine Person vorstellen: Das ist..."]',
  'v1', TRUE
),

(
  '2026-05-25', 'A1',
  'Meine Familie',
  $$Beschreibe deine Familie (oder eine fiktive Familie) auf Deutsch.
Beantworte diese Fragen:
1. Wie viele Personen sind in deiner Familie?
2. Wie heissen deine Eltern / Geschwister?
3. Wie alt sind sie?

Verwende: Mutter, Vater, Bruder, Schwester, Oma, Opa + Verb "haben" + Zahlen.$$,
  '["Mindestens 3 Familienmitglieder nennen", "Possessivpronomen benutzen (mein/meine)", "Alter mit Er/Sie ist X Jahre alt sagen"]',
  '["Beziehungen beschreiben", "Eine Aktivitaet nennen, die die Familie gemeinsam macht"]',
  'v1', TRUE
),

(
  '2026-06-01', 'A1',
  'Einkaufen im Supermarkt',
  $$Du bist im Supermarkt und kaufst Lebensmittel fuer das Wochenende ein.
Beschreibe:
1. Was kaufst du? Nenn mindestens 5 Lebensmittel.
2. Wie viel kostet alles? Sag den Preis auf Deutsch.
3. Fuehre einen kurzen Dialog an der Kasse: Begruessing, zahlen, Verabschiedung.

Verwende: Ich moechte..., Das kostet..., Zahlen + Euro/Cent, bitte/danke.$$,
  '["5 Lebensmittel auf Deutsch nennen", "Einen Preis mit Euro und Cent sagen", "Einen Dialog mit Kassierer (3 Saetze min.) durchfuehren"]',
  '["Mengenangaben verwenden (ein Kilo, eine Flasche, zwei Liter)", "Nach dem Weg zur Kasse fragen"]',
  'v1', TRUE
),

(
  '2026-06-08', 'A1',
  'Mein Tagesablauf',
  $$Beschreibe deinen typischen Tagesablauf von morgens bis abends.
Beantworte:
1. Um wie viel Uhr stehst du auf? Was machst du als erstes?
2. Wann fruehstueckst du, arbeitest du, machst du Mittagspause?
3. Was machst du abends vor dem Schlafen?

Verwende: aufstehen, fruehstuecken, anfangen, aufmachen + Uhrzeiten (Es ist X Uhr / Um X Uhr).$$,
  '["Mindestens 4 Aktivitaeten mit Uhrzeiten nennen", "Zwei trennbare Verben korrekt verwenden", "Zeitausdruecke benutzen (morgens, mittags, abends, dann, danach)"]',
  '["Den Unterschied Arbeitstag vs. Wochenende beschreiben", "Einen Satz mit Ich muss bilden"]',
  'v1', TRUE
),

(
  '2026-06-15', 'A1',
  'Meine Wohnung',
  $$Beschreibe deine Wohnung oder dein Zimmer auf Deutsch.
Beantworte:
1. Wie viele Zimmer hast du? Welche Zimmer gibt es?
2. Was steht in deinem Wohnzimmer / Schlafzimmer?
3. Was magst du an deiner Wohnung? Was wuerdest du gerne aendern?

Verwende: Zimmer/Raeume (Kueche, Bad, Flur...), Moebel (Stuhl, Tisch, Bett...), es gibt.$$,
  '["Mindestens 3 Zimmer nennen", "5 Moebelstücke oder Gegenstaende beschreiben", "Einen Satz mit Ich mag oder Ich finde schoen bilden"]',
  '["Die Lage beschreiben: Das Bett steht neben...", "Eine Wohnungsanzeige kurz erklaeren"]',
  'v1', TRUE
),

(
  '2026-06-22', 'A1',
  'Mit dem Bus in die Stadt',
  $$Du moechtest mit dem Bus ins Stadtzentrum fahren und einen Freund treffen.
Beschreibe die Situation:
1. Wohin moechtest du fahren? Mit welchem Verkehrsmittel?
2. Wie kaufst du ein Ticket? Fuehre einen kurzen Dialog durch.
3. Wie lange dauert die Fahrt ungefaehr?

Verwende: Bus/Bahn/Strassenbahn, eine Fahrkarte kaufen, Wohin? Wo? + Praepositionen (zum, zur, nach).$$,
  '["Das Ziel und das Verkehrsmittel nennen", "Einen Satz zum Ticketkauf bilden (Ich moechte...)", "Eine ungefaehre Dauer in Minuten angeben"]',
  '["Nach dem Weg fragen: Wie komme ich zu...?", "Den Fahrplan lesen und eine Uhrzeit nennen"]',
  'v1', TRUE
),

(
  '2026-06-29', 'A1',
  'Beim Arzt',
  $$Du bist krank und gehst zum Arzt. Beschreibe:
1. Welche Beschwerden hast du? (Kopfschmerzen, Halsschmerzen, Fieber...)
2. Fuehre einen kurzen Dialog mit dem Arzt: Wie lange bist du schon krank?
3. Was empfiehlt der Arzt? (Tabletten, Ruhe, viel Wasser trinken...)

Verwende: Koerperteile, Schmerzen = ...schmerzen, seit (+ Dativ), Modalverb muessen/sollen.$$,
  '["Mindestens 2 Symptome auf Deutsch nennen", "Seit wann du krank bist sagen (Seit gestern / zwei Tagen)", "Eine Empfehlung des Arztes beschreiben"]',
  '["Eine Entschuldigung fuer die Arbeit erwaehnen", "Medikamente beschreiben: Ich nehme X Tabletten"]',
  'v1', TRUE
)

ON CONFLICT DO NOTHING;
