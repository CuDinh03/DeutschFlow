-- Đợt 2 — ngân hàng đề A2 (Goethe A2 + telc A2) cho mảng Luyện thi Nói.
-- Loại thẻ mới: PERSON_CARD (Goethe A2 T1 "Fragen zur Person"), PROMPT_CARD (Goethe A2 T2 "Von sich erzählen"),
-- CALENDAR_PAIR (A2 T3 "Gemeinsam etwas planen / Etwas aushandeln" — lịch A≠B, phần partnerCalendar KHÔNG gửi
-- cho client, chỉ AI partner biết), QUESTION_WORD_CARD (telc A2 T2 "Ein Alltagsgespräch führen"), KEYWORD_CARD
-- không có buchstabieren/số (telc A2 T1). Dollar-quote có khoảng trắng sau dấu mở để Flyway không nhầm thành placeholder (và KHÔNG viết chuỗi đô-la + ngoặc nhọn ở bất kỳ đâu, kể cả comment).

-- Goethe A2 T1 khai đúng loại thẻ trong parts_json (chỉ để mô tả; việc rút đề đi theo archetype+teil).
UPDATE speaking_exam_blueprints
SET parts_json = jsonb_set(parts_json, '{parts,0,stimulusType}', '"PERSON_CARD"'::jsonb)
WHERE provider = 'GOETHE' AND level = 'A2' AND version = 1;

-- Goethe A2 T1 — Fragen zur Person: mỗi thẻ một từ khóa, cần 8 thẻ/phiên (4 hỏi + 4 đáp).
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'GOETHE', 'A2', 1, 'CARD_QA', jsonb_build_object('type', 'PERSON_CARD', 'keyword', k.kw)
FROM (VALUES ('Name?'),('Alter?'),('Geburtstag?'),('Wohnort?'),('Familie?'),('Beruf?'),('Hobby?'),('Sprachen?'),
             ('Haustier?'),('Lieblingsessen?'),('Musik?'),('Sport?'),('Urlaub?'),('Wochenende?'),('Arbeit?'),
             ('Schule?'),('Freunde?'),('Auto?'),('Computer?'),('Kochen?'),('Wohnung?'),('Einkaufen?')) AS k(kw);

-- Goethe A2 T2 — Von sich erzählen: câu hỏi dẫn + gợi ý phụ (đúng kết cấu thẻ thật).
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'GOETHE', 'A2', 2, 'ABOUT_ME', jsonb_build_object('type', 'PROMPT_CARD', 'prompt', p.prompt, 'hints', p.hints)
FROM (VALUES
 ('Was machen Sie mit Ihrem Geld?', '["Sparen?","Reisen?","Kleidung?","Lebensmittel, Miete?"]'::jsonb),
 ('Wie sieht Ihr Wochenende aus?', '["Familie?","Sport?","Ausschlafen?","Freunde treffen?"]'::jsonb),
 ('Was essen Sie gern?', '["Frühstück?","Lieblingsessen?","Restaurant?","Kochen Sie selbst?"]'::jsonb),
 ('Wie kommen Sie zur Arbeit oder zur Schule?', '["Bus, Bahn?","Auto?","Fahrrad?","Wie lange?"]'::jsonb),
 ('Was machen Sie in Ihrer Freizeit?', '["Hobby?","Musik?","Fernsehen?","Mit wem?"]'::jsonb),
 ('Wie wohnen Sie?', '["Wohnung oder Haus?","Wie viele Zimmer?","Allein oder mit Familie?","Gefällt es Ihnen?"]'::jsonb),
 ('Wie feiern Sie Geburtstag?', '["Mit wem?","Essen?","Geschenke?","Zu Hause oder im Restaurant?"]'::jsonb),
 ('Wie lernen Sie Deutsch?', '["Kurs?","App?","Wie oft?","Was ist schwer?"]'::jsonb),
 ('Was machen Sie im Urlaub?', '["Wohin?","Mit wem?","Strand oder Stadt?","Wie lange?"]'::jsonb),
 ('Wie ist ein normaler Tag bei Ihnen?', '["Aufstehen?","Arbeit?","Abends?","Schlafen?"]'::jsonb),
 ('Wie bleiben Sie gesund?', '["Sport?","Essen?","Schlafen?","Arzt?"]'::jsonb),
 ('Wie kaufen Sie ein?', '["Supermarkt oder Markt?","Wann?","Online?","Was kaufen Sie oft?"]'::jsonb)
) AS p(prompt, hints);

-- A2 T3 — Gemeinsam etwas planen / Etwas aushandeln (dùng chung Goethe + telc): lịch tuần A≠B.
-- candidateCalendar = thí sinh thấy; partnerCalendar = CHỈ AI partner biết (server lược trước khi trả client).
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json) VALUES
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Ein Freund hat nächste Woche Geburtstag. Sie möchten zusammen ein Geschenk kaufen.","goal":"Finden Sie einen gemeinsamen Termin und sagen Sie, was Sie kaufen.","candidateCalendar":{"Montag":["9–17 Arbeit"],"Dienstag":["9–17 Arbeit","19 Sport"],"Mittwoch":["9–13 Arbeit"],"Donnerstag":["ganztags Arbeit"],"Freitag":["9–13 Arbeit"],"Samstag":["frei"],"Sonntag":["Familie"]},"partnerCalendar":{"Montag":["18 Deutschkurs"],"Dienstag":["frei"],"Mittwoch":["ganztags Arbeit"],"Donnerstag":["18 Deutschkurs"],"Freitag":["14–20 Arbeit"],"Samstag":["10–14 Fußball"],"Sonntag":["frei"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Sie möchten zusammen ins Kino gehen.","goal":"Finden Sie einen Termin und einigen Sie sich auf einen Film.","candidateCalendar":{"Montag":["frei"],"Dienstag":["8–16 Arbeit"],"Mittwoch":["8–16 Arbeit","19 Kino? (Sie haben Lust)"],"Donnerstag":["8–16 Arbeit"],"Freitag":["frei"],"Samstag":["Besuch von Eltern"],"Sonntag":["frei"]},"partnerCalendar":{"Montag":["ganztags Arbeit"],"Dienstag":["frei ab 18"],"Mittwoch":["frei"],"Donnerstag":["19 Geburtstag Oma"],"Freitag":["ganztags Arbeit"],"Samstag":["frei"],"Sonntag":["10–14 Wandern"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Sie wollen zusammen für die Deutschprüfung lernen.","goal":"Vereinbaren Sie zwei Lerntermine in der Woche.","candidateCalendar":{"Montag":["9–15 Arbeit"],"Dienstag":["9–15 Arbeit","18 Fitness"],"Mittwoch":["frei"],"Donnerstag":["9–15 Arbeit"],"Freitag":["9–12 Arbeit"],"Samstag":["frei"],"Sonntag":["Familie"]},"partnerCalendar":{"Montag":["frei ab 16"],"Dienstag":["ganztags Uni"],"Mittwoch":["ganztags Uni"],"Donnerstag":["frei ab 16"],"Freitag":["frei"],"Samstag":["9–13 Arbeit"],"Sonntag":["frei"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Ihr Deutschkurs macht einen Ausflug. Sie beide organisieren ihn.","goal":"Einigen Sie sich auf Tag, Ziel und Verkehrsmittel.","candidateCalendar":{"Montag":["Kurs 9–12"],"Dienstag":["Kurs 9–12"],"Mittwoch":["Kurs 9–12","Arzt 15"],"Donnerstag":["Kurs 9–12"],"Freitag":["frei"],"Samstag":["frei"],"Sonntag":["frei"]},"partnerCalendar":{"Montag":["Kurs 9–12","Arbeit 14–20"],"Dienstag":["Kurs 9–12"],"Mittwoch":["Kurs 9–12"],"Donnerstag":["Kurs 9–12","Arbeit 14–20"],"Freitag":["Arbeit 14–20"],"Samstag":["frei"],"Sonntag":["Kirche 10"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Sie möchten zusammen Sport machen.","goal":"Finden Sie einen festen Termin in der Woche und eine Sportart.","candidateCalendar":{"Montag":["8–17 Arbeit"],"Dienstag":["8–17 Arbeit"],"Mittwoch":["8–17 Arbeit","19 Kino"],"Donnerstag":["8–17 Arbeit"],"Freitag":["8–14 Arbeit"],"Samstag":["10–12 Markt"],"Sonntag":["frei"]},"partnerCalendar":{"Montag":["frei ab 18"],"Dienstag":["18 Deutschkurs"],"Mittwoch":["frei ab 18"],"Donnerstag":["18 Deutschkurs"],"Freitag":["frei"],"Samstag":["ganztags Arbeit"],"Sonntag":["frei"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Eine Kollegin zieht um. Sie wollen ihr zusammen helfen.","goal":"Finden Sie einen Termin und besprechen Sie, wer was macht.","candidateCalendar":{"Montag":["9–18 Arbeit"],"Dienstag":["9–18 Arbeit"],"Mittwoch":["9–13 Arbeit"],"Donnerstag":["9–18 Arbeit"],"Freitag":["frei"],"Samstag":["frei"],"Sonntag":["Geburtstag Tante"]},"partnerCalendar":{"Montag":["frei"],"Dienstag":["ganztags Arbeit"],"Mittwoch":["ganztags Arbeit"],"Donnerstag":["frei ab 15"],"Freitag":["9–16 Arbeit"],"Samstag":["frei"],"Sonntag":["frei"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Sie möchten zusammen kochen und Freunde einladen.","goal":"Einigen Sie sich auf einen Abend, ein Gericht und wer was einkauft.","candidateCalendar":{"Montag":["frei"],"Dienstag":["18 Elternabend"],"Mittwoch":["frei"],"Donnerstag":["8–20 Arbeit"],"Freitag":["frei"],"Samstag":["Besuch"],"Sonntag":["frei"]},"partnerCalendar":{"Montag":["19 Sport"],"Dienstag":["frei"],"Mittwoch":["19 Deutschkurs"],"Donnerstag":["frei"],"Freitag":["ganztags Arbeit"],"Samstag":["frei"],"Sonntag":["Familie"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Sie wollen zusammen ein Fahrrad für den Sohn Ihres Nachbarn aussuchen.","goal":"Finden Sie einen Termin und ein Geschäft.","candidateCalendar":{"Montag":["ganztags Arbeit"],"Dienstag":["ganztags Arbeit"],"Mittwoch":["frei ab 14"],"Donnerstag":["ganztags Arbeit"],"Freitag":["frei ab 14"],"Samstag":["Fußball 15"],"Sonntag":["frei"]},"partnerCalendar":{"Montag":["frei"],"Dienstag":["frei"],"Mittwoch":["ganztags Arbeit"],"Donnerstag":["frei ab 17"],"Freitag":["ganztags Arbeit"],"Samstag":["frei"],"Sonntag":["Besuch"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Sie möchten zusammen einen Tag in einer anderen Stadt verbringen.","goal":"Wählen Sie Tag, Stadt, Verkehrsmittel und Programm.","candidateCalendar":{"Montag":["9–17 Arbeit"],"Dienstag":["9–17 Arbeit"],"Mittwoch":["9–17 Arbeit"],"Donnerstag":["9–17 Arbeit"],"Freitag":["frei"],"Samstag":["frei"],"Sonntag":["Oma besuchen"]},"partnerCalendar":{"Montag":["frei"],"Dienstag":["frei"],"Mittwoch":["ganztags Arbeit"],"Donnerstag":["ganztags Arbeit"],"Freitag":["9–14 Arbeit"],"Samstag":["frei"],"Sonntag":["frei"]}} $j$),
(NULL,'A2',3,'PLAN_NEGOTIATE',$j$ {"type":"CALENDAR_PAIR","situation":"Ihre Nachbarin ist im Krankenhaus. Sie möchten sie zusammen besuchen.","goal":"Finden Sie einen Termin und überlegen Sie, was Sie mitbringen.","candidateCalendar":{"Montag":["8–16 Arbeit"],"Dienstag":["8–16 Arbeit","18 Kurs"],"Mittwoch":["8–16 Arbeit"],"Donnerstag":["frei"],"Freitag":["8–16 Arbeit"],"Samstag":["frei"],"Sonntag":["Familie"]},"partnerCalendar":{"Montag":["frei ab 17"],"Dienstag":["ganztags Arbeit"],"Mittwoch":["frei ab 17"],"Donnerstag":["ganztags Arbeit"],"Freitag":["frei"],"Samstag":["Arbeit 8–13"],"Sonntag":["frei"]}} $j$);

-- telc A2 T1 — Sich vorstellen: thẻ từ khóa, KHÔNG có buchstabieren/số (khác A1).
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json) VALUES
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Wohnort?","Familie?","Beruf?","Sprachen?","Freizeit?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Herkunft?","Arbeit oder Schule?","Hobby?","Lieblingsessen?"]} $j$);

-- telc A2 T2 — Ein Alltagsgespräch führen: chủ đề + từ hỏi (thí sinh đặt câu hỏi bắt đầu bằng từ hỏi).
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'TELC', 'A2', 2, 'CARD_QA', jsonb_build_object('type', 'QUESTION_WORD_CARD', 'thema', q.thema, 'questionWord', q.qw)
FROM (VALUES
 ('Tagesablauf','Wann …?'),('Tagesablauf','Wie oft …?'),('Tagesablauf','Was …?'),('Tagesablauf','Wie lange …?'),
 ('Freizeit','Was …?'),('Freizeit','Mit wem …?'),('Freizeit','Wo …?'),('Freizeit','Wie oft …?'),
 ('Einkaufen','Wo …?'),('Einkaufen','Wann …?'),('Einkaufen','Was …?'),('Einkaufen','Wie viel …?'),
 ('Familie','Wer …?'),('Familie','Wie viele …?'),('Familie','Wo …?'),('Familie','Wie oft …?'),
 ('Wohnen','Wo …?'),('Wohnen','Wie groß …?'),('Wohnen','Seit wann …?'),('Wohnen','Mit wem …?'),
 ('Reisen','Wohin …?'),('Reisen','Wie …?'),('Reisen','Wann …?'),('Reisen','Wie lange …?')
) AS q(thema, qw);
