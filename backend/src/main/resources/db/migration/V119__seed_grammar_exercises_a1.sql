-- V119: Seed A1 Grammar Exercises (Pre-approved)
-- 5-8 exercises per topic, covering Goethe A1 grammar
-- Status: APPROVED (bypasses Teacher→Admin workflow for initial seed)

-- ── HELPER: ensure topic IDs are resolved by code ──
-- We use topic_code to look up IDs dynamically

DO $$
DECLARE
  t_id BIGINT;
BEGIN

-- ═══════════════ 1. ARTIKEL ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'ARTIKEL';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"___ Tisch ist groß. (Der/Die/Das)","options":["Der","Die","Das","Ein"],"correct_answer":"Der","explanation_vi":"Tisch (cái bàn) là danh từ giống đực → dùng Der","explanation_de":"Tisch ist maskulin → bestimmter Artikel: Der"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"___ Frau arbeitet hier. (Der/Die/Das)","options":["Der","Die","Das","Eine"],"correct_answer":"Die","explanation_vi":"Frau (phụ nữ) là danh từ giống cái → dùng Die","explanation_de":"Frau ist feminin → bestimmter Artikel: Die"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"___ Kind spielt im Garten. (Der/Die/Das)","options":["Der","Die","Das","Ein"],"correct_answer":"Das","explanation_vi":"Kind (đứa trẻ) là danh từ trung tính → dùng Das","explanation_de":"Kind ist neutrum → bestimmter Artikel: Das"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ich habe ___ Hund. (ein/eine/einen)","options":["ein","eine","einen","einem"],"correct_answer":"einen","explanation_vi":"Hund (giống đực) ở vị trí túc từ → Akkusativ → einen","explanation_de":"Hund ist maskulin, Akkusativ → einen"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 2,
   '{"prompt":"___ Buch ist interessant. Das Buch gehört mir. (bestimmter Artikel)","options":[],"correct_answer":"Das","explanation_vi":"Buch là danh từ trung tính (neutrum) → Das","explanation_de":"Buch ist neutrum → Das"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ist das ___ Apfel oder ___ Orange?","options":["ein / eine","eine / ein","einen / eine","ein / ein"],"correct_answer":"ein / eine","explanation_vi":"Apfel (đực) → ein; Orange (cái) → eine","explanation_de":"Apfel maskulin → ein; Orange feminin → eine"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 2. KONJUGATION ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'KONJUGATION';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"Ich ___ aus Vietnam. (sein)","options":["bin","bist","ist","sind"],"correct_answer":"bin","explanation_vi":"sein với chủ ngữ ich → bin","explanation_de":"sein: ich bin"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"Er ___ Lehrer. (sein)","options":["bin","bist","ist","sind"],"correct_answer":"ist","explanation_vi":"sein với chủ ngữ er → ist","explanation_de":"sein: er/sie/es ist"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"Wir ___ Freunde. (sein)","options":["bin","bist","ist","sind"],"correct_answer":"sind","explanation_vi":"sein với chủ ngữ wir → sind","explanation_de":"sein: wir sind"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Du ___ sehr gut Deutsch. (sprechen)","options":["spreche","sprichst","spricht","sprechen"],"correct_answer":"sprichst","explanation_vi":"sprechen bất quy tắc: du sprichst (e→i)","explanation_de":"Vokalwechsel: sprechen → du sprichst"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 2,
   '{"prompt":"Sie (Frau Müller) ___ in München. (wohnen)","options":[],"correct_answer":"wohnt","explanation_vi":"wohnen có quy tắc: er/sie/es + t → wohnt","explanation_de":"wohnen: er/sie/es wohnt"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ihr ___ sehr fleißig. (arbeiten)","options":["arbeite","arbeitest","arbeitet","arbeiten"],"correct_answer":"arbeitet","explanation_vi":"arbeiten với ihr → arbeitet (thêm et vì gốc kết thúc bằng t)","explanation_de":"arbeiten: ihr arbeitet (Erweiterungsform)"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 3. SEIN_HABEN ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'SEIN_HABEN';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"Ich ___ einen Bruder. (haben)","options":["habe","hast","hat","haben"],"correct_answer":"habe","explanation_vi":"haben với ich → habe","explanation_de":"haben: ich habe"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"___ du Zeit heute Abend?","options":["Habe","Hast","Hat","Haben"],"correct_answer":"Hast","explanation_vi":"haben với du → hast","explanation_de":"haben: du hast"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Das Restaurant ___ gutes Essen.","options":["habe","hast","hat","haben"],"correct_answer":"hat","explanation_vi":"haben với es/das → hat","explanation_de":"haben: es hat"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 2,
   '{"prompt":"Wir ___ Hunger. (haben)","options":[],"correct_answer":"haben","explanation_vi":"haben với wir → haben","explanation_de":"haben: wir haben"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ich ___ krank. Ich ___ Fieber.","options":["bin / habe","habe / bin","bist / hast","ist / hat"],"correct_answer":"bin / habe","explanation_vi":"krank sein (là bệnh) → bin; Fieber haben (có sốt) → habe","explanation_de":"krank sein; Fieber haben"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 4. SATZBAU ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'SATZBAU';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Welche Satzstellung ist richtig?","options":["Ich jeden Tag arbeite.","Ich arbeite jeden Tag.","Jeden Tag ich arbeite.","Arbeite ich jeden Tag."],"correct_answer":"Ich arbeite jeden Tag.","explanation_vi":"Động từ luôn đứng vị trí số 2 trong câu trần thuật","explanation_de":"Das Verb steht auf Position 2 (V2-Regel)"}'::jsonb, 'APPROVED', true),
  (t_id, 'REORDER', 2,
   '{"prompt":"Sắp xếp thành câu đúng: [heute / gehe / Ich / ins Kino]","options":["Ich gehe heute ins Kino.","Heute gehe ich ins Kino."],"correct_answer":"Ich gehe heute ins Kino.","explanation_vi":"Có thể bắt đầu bằng Ich hoặc heute, nhưng động từ phải ở vị trí 2","explanation_de":"Verb steht immer an Position 2"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"Am Montag ___ ich zur Schule.","options":["ich gehe","gehe ich","geht ich","ich geht"],"correct_answer":"gehe ich","explanation_vi":"Khi trạng từ đứng đầu câu, chủ ngữ phải đứng sau động từ","explanation_de":"Inversion: Zeit-Adverbial + Verb + Subjekt"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 2,
   '{"prompt":"Er ___ jeden Morgen Kaffee. (trinken)","options":[],"correct_answer":"trinkt","explanation_vi":"Động từ chia theo er (trinkt) ở vị trí 2","explanation_de":"er trinkt — Verb an Position 2"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 5. W_FRAGEN ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'W_FRAGEN';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"___ heißt du? — Ich heiße Anna.","options":["Wo","Was","Wie","Wer"],"correct_answer":"Wie","explanation_vi":"Wie heißt du? = Bạn tên là gì?","explanation_de":"Wie fragt nach dem Namen"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 1,
   '{"prompt":"___ wohnst du? — In Berlin.","options":["Wer","Was","Wo","Wie"],"correct_answer":"Wo","explanation_vi":"Wo = ở đâu → hỏi về địa điểm","explanation_de":"Wo fragt nach dem Ort"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"___ ist das? — Das ist mein Hund.","options":["Wo","Was","Wie","Woher"],"correct_answer":"Was","explanation_vi":"Was = cái gì → hỏi về vật","explanation_de":"Was fragt nach Dingen/Sachen"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"___ kommst du? — Aus Vietnam.","options":["Wo","Was","Wie","Woher"],"correct_answer":"Woher","explanation_vi":"Woher = từ đâu → hỏi về nguồn gốc","explanation_de":"Woher fragt nach der Herkunft"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 2,
   '{"prompt":"___ Uhr ist es? — Es ist 10 Uhr. (W-Wort)","options":[],"correct_answer":"Wie viel","explanation_vi":"Wie viel Uhr ist es? = Mấy giờ rồi?","explanation_de":"Wie viel Uhr fragt nach der Uhrzeit"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"___ fährt der Zug? — Um 14 Uhr.","options":["Wo","Wann","Warum","Wie"],"correct_answer":"Wann","explanation_vi":"Wann = khi nào → hỏi về thời gian","explanation_de":"Wann fragt nach dem Zeitpunkt"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 6. NEGATION ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'NEGATION';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ich habe ___ Auto. (phủ định danh từ)","options":["nicht","kein","keine","nein"],"correct_answer":"kein","explanation_vi":"Phủ định danh từ → dùng kein/keine/keinen (Auto = neutrum → kein)","explanation_de":"Nomen verneinen: kein (neutrum: kein Auto)"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Er arbeitet ___ heute. (phủ định động từ)","options":["kein","keine","nicht","nein"],"correct_answer":"nicht","explanation_vi":"Phủ định động từ/trạng từ → dùng nicht","explanation_de":"Verben/Adjektive/Adverbien verneinen → nicht"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Hast du Geschwister? — Nein, ich habe ___ Geschwister.","options":["nicht","kein","keine","keinem"],"correct_answer":"keine","explanation_vi":"Geschwister = số nhiều → keine (phủ định số nhiều)","explanation_de":"Plural: keine Geschwister"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 3,
   '{"prompt":"Das ist ___ Problem. Es ist einfach. (phủ định → danh từ neutrum)","options":[],"correct_answer":"kein","explanation_vi":"Problem là neutrum → kein Problem","explanation_de":"Problem ist neutrum → kein Problem"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"Ich mag ___ Kaffee. Ich trinke lieber Tee.","options":["nicht","keinen","keine","kein"],"correct_answer":"keinen","explanation_vi":"Kaffee (đực) trong Akkusativ → keinen","explanation_de":"Kaffee maskulin, Akkusativ → keinen"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 7. AKKUSATIV ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'AKKUSATIV';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ich kaufe ___ Apfel. (Akkusativ)","options":["der","die","das","den"],"correct_answer":"den","explanation_vi":"Apfel là giống đực (maskulin) → Akkusativ: den","explanation_de":"maskulin Akkusativ: der → den"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Er trinkt ___ Milch.","options":["der","die","das","den"],"correct_answer":"die","explanation_vi":"Milch là giống cái (feminin) → Akkusativ: die (không đổi)","explanation_de":"feminin Akkusativ: die bleibt die"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Sie liest ___ Buch.","options":["der","die","das","den"],"correct_answer":"das","explanation_vi":"Buch là trung tính (neutrum) → Akkusativ: das (không đổi)","explanation_de":"neutrum Akkusativ: das bleibt das"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 3,
   '{"prompt":"Hast du ___ Stift? Ich brauche einen Stift. (bestimmter Artikel, Akk.)","options":[],"correct_answer":"den","explanation_vi":"Stift (đực) → Akkusativ bestimmt: den Stift","explanation_de":"maskulin bestimmt Akkusativ: den"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"Ich besuche ___ Freund. (einen/eine/ein)","options":["einen","eine","ein","einem"],"correct_answer":"einen","explanation_vi":"Freund (đực) → Akkusativ unbestimmt: einen","explanation_de":"maskulin unbestimmt Akkusativ: einen"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 8. MODALVERBEN ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'MODALVERBEN';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Ich ___ Deutsch sprechen. (können)","options":["kann","kannst","können","könnt"],"correct_answer":"kann","explanation_vi":"können với ich → kann","explanation_de":"können: ich kann"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Du ___ jetzt schlafen. (müssen)","options":["muss","musst","müssen","müsst"],"correct_answer":"musst","explanation_vi":"müssen với du → musst","explanation_de":"müssen: du musst"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Er ___ ein Eis essen. (möchten)","options":["möchte","möchtest","möchten","möchtet"],"correct_answer":"möchte","explanation_vi":"möchten với er → möchte","explanation_de":"möchten: er möchte"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"Hier ___ man nicht rauchen. (dürfen)","options":["darf","darfst","dürfen","dürft"],"correct_answer":"darf","explanation_vi":"dürfen với man → darf","explanation_de":"dürfen: man darf"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 2,
   '{"prompt":"Wir ___ morgen früh aufstehen. (müssen)","options":[],"correct_answer":"müssen","explanation_vi":"müssen với wir → müssen","explanation_de":"müssen: wir müssen"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"___ du mir helfen? (können — Frage)","options":["Kann","Kannst","Können","Könnt"],"correct_answer":"Kannst","explanation_vi":"können với du trong câu hỏi → Kannst du...?","explanation_de":"können: kannst du...? (Frage)"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 9. PERFEKT ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'PERFEKT';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"Ich ___ gestern Pizza ___. (essen)","options":["habe / gegessen","bin / gegessen","habe / geessen","bin / geessen"],"correct_answer":"habe / gegessen","explanation_vi":"essen dùng haben + Partizip II: gegessen","explanation_de":"Perfekt: haben + gegessen (unregelmäßig)"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"Sie ___ nach Berlin ___. (fahren)","options":["hat / gefahren","ist / gefahren","hat / gefahrt","ist / gefahrt"],"correct_answer":"ist / gefahren","explanation_vi":"fahren là động từ di chuyển → dùng sein + gefahren","explanation_de":"Bewegungsverb: sein + gefahren"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 3,
   '{"prompt":"Ich habe gestern viel ___. (lernen — Partizip II)","options":[],"correct_answer":"gelernt","explanation_vi":"lernen có quy tắc: ge + lern + t = gelernt","explanation_de":"regelmäßig: ge- + Stamm + -t = gelernt"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"___ du schon mal in Deutschland ___? (sein)","options":["Hast / gewesen","Bist / gewesen","Hast / gewest","Bist / gewest"],"correct_answer":"Bist / gewesen","explanation_vi":"sein dùng sein trong Perfekt: bist... gewesen","explanation_de":"sein: bist... gewesen"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 4,
   '{"prompt":"Er ___ das Buch schon ___. (lesen)","options":["hat / gelesen","ist / gelesen","hat / gelesst","ist / gelest"],"correct_answer":"hat / gelesen","explanation_vi":"lesen bất quy tắc: haben + gelesen","explanation_de":"lesen unregelmäßig: hat gelesen"}'::jsonb, 'APPROVED', true);
END IF;

-- ═══════════════ 10. PRAEPOSITIONEN ═══════════════
SELECT id INTO t_id FROM grammar_topics WHERE topic_code = 'PRAEPOSITIONEN';
IF t_id IS NOT NULL THEN
  INSERT INTO grammar_exercises (topic_id, exercise_type, difficulty, question_json, status, ai_generated) VALUES
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Wir treffen uns ___ Montag. (Zeitpräposition)","options":["in","an","um","nach"],"correct_answer":"an","explanation_vi":"Ngày trong tuần → an (am Montag = an + dem)","explanation_de":"Wochentage: an → am Montag"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Der Unterricht beginnt ___ 9 Uhr.","options":["an","in","um","nach"],"correct_answer":"um","explanation_vi":"Giờ cụ thể → um (um 9 Uhr)","explanation_de":"Uhrzeit: um + Uhrzeit"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 2,
   '{"prompt":"Das Buch liegt ___ dem Tisch.","options":["auf","in","an","vor"],"correct_answer":"auf","explanation_vi":"nằm trên bề mặt nằm ngang → auf","explanation_de":"auf + Dativ: auf dem Tisch"}'::jsonb, 'APPROVED', true),
  (t_id, 'FILL_BLANK', 3,
   '{"prompt":"Ich fahre ___ dem Bus zur Schule. (Transportmittel)","options":[],"correct_answer":"mit","explanation_vi":"Phương tiện giao thông → mit (mit dem Bus)","explanation_de":"Transportmittel: mit + Dativ"}'::jsonb, 'APPROVED', true),
  (t_id, 'MULTIPLE_CHOICE', 3,
   '{"prompt":"___ dem Essen gehe ich spazieren. (nach/vor)","options":["Vor","Nach","Bei","Mit"],"correct_answer":"Nach","explanation_vi":"sau khi ăn → nach (nach dem Essen)","explanation_de":"nach dem Essen = nach einer Aktivität"}'::jsonb, 'APPROVED', true);
END IF;

-- Update mastery counts for existing topics
RAISE NOTICE 'Grammar exercises seeded successfully';
END $$;
