-- Bơm đề cho hai ô pool mỏng nhất (audit 31/08 F-13): telc A2 Teil 1 và telc B1 Teil 1 chỉ có 3 thẻ,
-- cardsNeeded = 1 → thi lại lần 2–3 gặp lại thẻ cũ với xác suất ≥ 1/3. Mỗi ô lên 10 thẻ.
-- Đề tự soạn theo format công khai (không sao chép đề thật). Cùng cấu trúc JSON với V278/V279.

-- telc A2 T1 — Sich vorstellen: thẻ từ khoá (KEYWORD_CARD), không buchstabieren/số.
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json) VALUES
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Wohnort?","Familie?","Beruf oder Ausbildung?","Hobbys?","Warum Deutsch?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Herkunft?","Wohnung?","Arbeit?","Sprachen?","Sport?","Lieblingsessen?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Geschwister?","Schule oder Beruf?","Freizeit?","Musik?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Land und Stadt?","Wie lange in Deutschland?","Familie?","Beruf?","Wochenende?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Wohnort?","Haustier?","Hobby?","Lieblingsfilm oder Serie?","Sprachen?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Herkunft?","Familie?","Arbeit oder Studium?","Reisen?","Deutsch lernen — seit wann?"]} $j$),
('TELC','A2',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Wohnort?","Tagesablauf?","Beruf?","Freunde?","Hobby?","Urlaub?"]} $j$);

-- telc B1 T1 — Kontaktaufnahme: thẻ chủ đề (CONTACT_CARD); một số thẻ có câu hỏi thêm của giám khảo ở cuối.
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json) VALUES
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte.","topics":["Name","Herkunft","Familie","Ausbildung oder Beruf","Freizeit und Hobbys","Sprachen"]} $j$),
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte. Am Ende stellt die Prüferin noch eine Frage.","topics":["Name und Alter","Wohnort und Wohnung","Arbeit oder Studium","Reisen","Musik oder Sport","Warum lernen Sie Deutsch?"]} $j$),
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte.","topics":["Name","Herkunft und Muttersprache","Familie und Freunde","Beruf oder Ausbildung","Wochenende","Pläne für die Zukunft"]} $j$),
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte. Am Ende stellt die Prüferin noch eine Frage.","topics":["Name","Wohnen — Stadt oder Land?","Beruf oder Schule","Freizeit","Essen und Kochen","Deutsch lernen — wie und seit wann?"]} $j$),
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte.","topics":["Name und Alter","Herkunft","Familie","Arbeit oder Ausbildung","Lieblingsorte","Sprachen und Reisen"]} $j$),
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte. Am Ende stellt die Prüferin noch eine Frage.","topics":["Name","Wohnort","Tagesablauf","Beruf oder Studium","Hobbys","Haustiere"]} $j$),
('TELC','B1',1,'TOPIC_EXCHANGE',$j$ {"type":"CONTACT_CARD","instruction":"Lernen Sie sich kennen. Sprechen Sie über die Themen auf der Karte.","topics":["Name","Herkunft","Wohnen","Arbeit oder Ausbildung","Medien und Internet","Pläne für das nächste Jahr"]} $j$);
