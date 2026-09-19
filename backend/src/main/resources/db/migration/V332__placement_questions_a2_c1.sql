-- ============================================================
-- V332: Ngân hàng câu hỏi Kiểm tra đầu vào cho A2, B1, B2, C1 (19/09/2026)
--
-- V71 chỉ seed 10 câu A1 ⇒ trên prod mọi người khai A2+ chọn "Kiểm tra nhanh 10 câu" đều gặp
-- "Chưa đủ câu hỏi cho level …" (QA simulator 19/09/2026, AC-ONB-47/50). Mỗi trình độ dưới đây
-- có 12 câu: 3 Hören · 2 Sprechen · 4 Lesen · 3 Schreiben — PlacementTestService.selectBalancedQuestions
-- lấy 2/2/3/3 = 10 câu, còn dư để xáo.
--
-- Hợp đồng chấm (PlacementTestService.gradeAnswer):
--   • MULTIPLE_CHOICE: correct_answer PHẢI trùng đúng một phần tử trong options_json.
--   • FILL_BLANK: so khớp correct_answer hoặc alternative_answers (bỏ hoa/thường, dấu câu cuối).
--   • SPEAKING / FREE_WRITE: đậu khi câu trả lời chứa ≥ 50% grading_keywords (so khớp chuỗi con,
--     không phân biệt hoa/thường) — vì thế keyword là gốc từ ngắn (vd. "entschuldig") chứ không phải cả câu.
--   Client (web + mobile) hiện đáp án MCQ dạng chọn; loại khác là ô nhập chữ (Sprechen cũng gõ).
--
-- module_number: A2 theo giáo trình V121 (7 Ngữ pháp A2 · 8 Cuộc sống A2 · 9 Ngữ pháp nâng cao A2 ·
-- 10 Chủ đề A2 · 11 Tổng kết A2); B1 theo V181 (11 Ngữ pháp B1 · 12 Kỹ năng B1). B2 và C1 CHƯA có cây
-- kỹ năng, số module là nhóm danh nghĩa để báo "chủ đề cần ôn": B2 13 Grammatik · 14 Wortschatz ·
-- 15 Kommunikation · 16 Text; C1 17 · 18 · 19 · 20 cùng thứ tự. Khi giáo trình B2/C1 có, đổi số ở đây.
--
-- Ràng buộc thứ tự: V331 đã áp trên prod (18/09); file này là V332, không có V332 nào khác đang mở.
-- ============================================================

-- ═══════════════════════════════ A2 ═══════════════════════════════

-- Hören
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, audio_transcript, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('A2', 'HOEREN', 8, 'MULTIPLE_CHOICE',
 'Wann ist der neue Terminvorschlag?',
 'Lịch hẹn mới được đề nghị vào lúc nào?',
 'Guten Tag, hier ist die Praxis Dr. Berger. Ihr Termin am Donnerstag um 9 Uhr muss leider verschoben werden. Wir haben am Freitag um 11 Uhr noch einen Termin frei. Bitte rufen Sie uns zurück.',
 '["Donnerstag, 9 Uhr","Freitag, 11 Uhr","Freitag, 9 Uhr"]'::jsonb,
 'Freitag, 11 Uhr',
 ARRAY['Termine_und_Uhrzeit','Hoerverstehen_Ansagen'], 3, ARRAY['#Termin','#Hörverstehen','#Arzt']),
('A2', 'HOEREN', 10, 'MULTIPLE_CHOICE',
 'Was sollen die Fahrgäste tun?',
 'Hành khách nên làm gì?',
 'Liebe Fahrgäste, wegen einer Störung fährt die U-Bahn-Linie 2 heute nicht. Bitte benutzen Sie die Buslinie 40, die alle zehn Minuten vom Hauptbahnhof abfährt.',
 '["Mit der U2 fahren","Den Bus 40 nehmen","Zehn Minuten warten"]'::jsonb,
 'Den Bus 40 nehmen',
 ARRAY['Verkehr_und_Durchsagen'], 3, ARRAY['#Verkehr','#Hörverstehen','#Durchsage']),
('A2', 'HOEREN', 8, 'MULTIPLE_CHOICE',
 'Warum kommt Ben später?',
 'Vì sao Ben đến muộn?',
 'Hallo Jana, hier ist Ben. Ich komme heute etwas später zum Deutschkurs, weil mein Zug Verspätung hat. Fang bitte ohne mich an, ich bin gegen halb sieben da.',
 '["Er ist krank.","Sein Zug hat Verspätung.","Er hat den Kurs vergessen."]'::jsonb,
 'Sein Zug hat Verspätung.',
 ARRAY['Nebensaetze_weil','Alltagsgespraeche'], 3, ARRAY['#weil','#Hörverstehen','#Alltag']);

-- Sprechen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('A2', 'SPRECHEN', 8, 'SPEAKING',
 'Sie haben einen Termin beim Arzt und können nicht kommen. Sagen Sie den Termin ab und nennen Sie einen Grund.',
 'Bạn có hẹn bác sĩ nhưng không đến được. Hãy huỷ lịch hẹn và nêu lý do (nói hoặc viết 1–2 câu).',
 'Ich muss meinen Termin leider absagen, weil ich arbeiten muss.',
 ARRAY['Ich kann leider nicht kommen, weil ich krank bin.','Leider muss ich den Termin absagen, ich habe keine Zeit.'],
 ARRAY['termin','absagen','leider','weil'],
 ARRAY['Termin_absagen','Nebensaetze_weil'], 3, ARRAY['#Termin','#Sprechen','#weil']),
('A2', 'SPRECHEN', 10, 'SPEAKING',
 'Erzählen Sie: Was haben Sie letztes Wochenende gemacht? Sagen Sie zwei Sätze im Perfekt.',
 'Kể lại: cuối tuần trước bạn đã làm gì? Nói hai câu ở thì Perfekt.',
 'Am Samstag habe ich meine Freunde getroffen und am Sonntag bin ich mit dem Fahrrad gefahren.',
 ARRAY['Ich habe am Wochenende eingekauft und bin dann ins Kino gegangen.'],
 ARRAY['habe','bin','gegangen','gemacht'],
 ARRAY['Perfekt_haben_sein'], 3, ARRAY['#Perfekt','#Sprechen','#Wochenende']);

-- Lesen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('A2', 'LESEN', 7, 'MULTIPLE_CHOICE',
 'Ich habe meinem Bruder ein Buch geschenkt, ___ er gern liest.',
 'Tôi tặng anh tôi một quyển sách, ___ anh ấy thích đọc. (chọn liên từ đúng)',
 '["das","dass","weil","denn"]'::jsonb,
 'weil',
 ARRAY['Nebensaetze_weil','Satzbau_Nebensatz'], 3, ARRAY['#weil','#Nebensatz','#Satzbau']),
('A2', 'LESEN', 9, 'MULTIPLE_CHOICE',
 'Berlin ist ___ als Hamburg, aber Hamburg gefällt mir ___.',
 'Berlin ___ Hamburg, nhưng tôi thích Hamburg ___. (so sánh hơn)',
 '["größer / besser","größer / gut","groß / besser","am größten / besser"]'::jsonb,
 'größer / besser',
 ARRAY['Komparativ_Superlativ'], 3, ARRAY['#Komparativ','#Vergleich']),
('A2', 'LESEN', 10, 'MULTIPLE_CHOICE',
 E'Lesen Sie die Anzeige:\n"Wir suchen ab sofort eine Aushilfe für unser Café am Wochenende. Arbeitszeit: Samstag und Sonntag, 8–14 Uhr. Erfahrung ist nicht nötig, aber Sie sollten freundlich sein und gut Deutsch sprechen. Bewerbung bitte per E-Mail an cafe-sonne@mail.de."\n\nWas ist richtig?',
 'Điều nào đúng theo mẩu tin tuyển dụng?',
 '["Man muss Erfahrung haben.","Man arbeitet nur am Wochenende.","Man soll persönlich vorbeikommen."]'::jsonb,
 'Man arbeitet nur am Wochenende.',
 ARRAY['Leseverstehen_Anzeigen'], 3, ARRAY['#Leseverstehen','#Anzeige','#Arbeit']),
('A2', 'LESEN', 8, 'MULTIPLE_CHOICE',
 E'Lesen Sie die E-Mail:\n"Hallo Tom, ich ziehe am 1. März in meine neue Wohnung. Kannst du mir am Samstag beim Umzug helfen? Ich habe einen Transporter gemietet, aber ich brauche noch zwei Leute. Danach gibt es Pizza für alle! Viele Grüße, Lena"\n\nWas möchte Lena von Tom?',
 'Lena muốn Tom làm gì?',
 '["Er soll Pizza bestellen.","Er soll beim Umzug helfen.","Er soll einen Transporter mieten."]'::jsonb,
 'Er soll beim Umzug helfen.',
 ARRAY['Leseverstehen_Emails'], 3, ARRAY['#Leseverstehen','#E-Mail','#Umzug']);

-- Schreiben
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('A2', 'SCHREIBEN', 7, 'FILL_BLANK',
 'Wenn ich Zeit ___, gehe ich ins Schwimmbad. (haben)',
 'Khi tôi ___ thời gian, tôi đi bơi. (chia động từ "haben")',
 'habe', ARRAY['Zeit habe'], NULL,
 ARRAY['Nebensaetze_wenn','Konjugation_Praesens'], 3, ARRAY['#wenn','#Nebensatz','#Schreiben']),
('A2', 'SCHREIBEN', 9, 'FILL_BLANK',
 'Gestern ___ ich um 7 Uhr aufgestanden. (sein)',
 'Hôm qua tôi ___ dậy lúc 7 giờ. (trợ động từ "sein" ở Perfekt)',
 'bin', ARRAY['bin ich'], NULL,
 ARRAY['Perfekt_haben_sein'], 3, ARRAY['#Perfekt','#sein','#Schreiben']),
('A2', 'SCHREIBEN', 11, 'FREE_WRITE',
 'Schreiben Sie eine kurze Nachricht an Ihre Nachbarin: Sie machen am Samstag eine Party und es wird etwas laut. (2–3 Sätze)',
 'Viết tin nhắn ngắn cho hàng xóm: thứ Bảy bạn tổ chức tiệc và sẽ hơi ồn. (2–3 câu)',
 'Liebe Frau Müller, am Samstag feiere ich meinen Geburtstag. Es wird vielleicht etwas laut. Ich hoffe, das ist in Ordnung.',
 NULL,
 ARRAY['samstag','party','laut','entschuldig','feier','hoffe'],
 ARRAY['Schreiben_Nachricht','Alltagskommunikation'], 3, ARRAY['#Schreiben','#Nachricht','#Nachbarn']);

-- ═══════════════════════════════ B1 ═══════════════════════════════

-- Hören
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, audio_transcript, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('B1', 'HOEREN', 12, 'MULTIPLE_CHOICE',
 'Was ist richtig?',
 'Điều nào đúng theo thông báo?',
 'Liebe Kundinnen und Kunden, heute erhalten Sie in unserer Sportabteilung im dritten Stock 20 Prozent Rabatt auf alle Laufschuhe. Das Angebot gilt nur bis 18 Uhr.',
 '["Alle Sportartikel sind reduziert.","Der Rabatt gilt nur heute bis 18 Uhr.","Die Sportabteilung ist im zweiten Stock."]'::jsonb,
 'Der Rabatt gilt nur heute bis 18 Uhr.',
 ARRAY['Hoerverstehen_Durchsagen'], 3, ARRAY['#Hörverstehen','#Einkaufen','#Durchsage']),
('B1', 'HOEREN', 12, 'MULTIPLE_CHOICE',
 'Wie wird das Wetter am Abend?',
 'Thời tiết buổi tối thế nào?',
 'Und nun das Wetter: Nach einem sonnigen Vormittag ziehen am Nachmittag von Westen Wolken auf. Gegen Abend kann es zu kräftigen Gewittern kommen. Morgen bleibt es wechselhaft, aber deutlich kühler.',
 '["Sonnig und warm","Es gibt möglicherweise Gewitter","Kühl und trocken"]'::jsonb,
 'Es gibt möglicherweise Gewitter',
 ARRAY['Hoerverstehen_Radio'], 3, ARRAY['#Hörverstehen','#Wetter','#Radio']),
('B1', 'HOEREN', 12, 'MULTIPLE_CHOICE',
 'Was soll Herr Schmidt tun?',
 'Ông Schmidt cần làm gì?',
 'Hallo Herr Schmidt, hier ist Frau Koch von der Firma Weber. Vielen Dank für Ihre Bewerbung. Wir würden Sie gern zu einem Vorstellungsgespräch einladen, und zwar am Dienstag um 10 Uhr. Bitte bringen Sie Ihre Zeugnisse mit und bestätigen Sie den Termin per E-Mail.',
 '["Die Bewerbung noch einmal schicken","Den Termin per E-Mail bestätigen","Am Dienstag anrufen"]'::jsonb,
 'Den Termin per E-Mail bestätigen',
 ARRAY['Hoerverstehen_Beruf'], 3, ARRAY['#Hörverstehen','#Bewerbung','#Beruf']);

-- Sprechen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('B1', 'SPRECHEN', 12, 'SPEAKING',
 'Ihr Kollege möchte eine Weiterbildung machen. Geben Sie ihm einen Rat und begründen Sie ihn.',
 'Đồng nghiệp muốn đi học nâng cao. Hãy khuyên anh ấy và nêu lý do.',
 'Ich würde dir raten, die Weiterbildung zu machen, weil du dann bessere Chancen im Beruf hast.',
 ARRAY['An deiner Stelle würde ich die Weiterbildung machen, denn das ist gut für deine Karriere.'],
 ARRAY['würde','raten','weil','stelle','denn','weiterbildung'],
 ARRAY['Ratschlaege_Konjunktiv_II','Begruenden'], 3, ARRAY['#Ratschlag','#KonjunktivII','#Sprechen']),
('B1', 'SPRECHEN', 12, 'SPEAKING',
 'Beschreiben Sie einen Vorteil und einen Nachteil des Online-Einkaufens.',
 'Nêu một ưu điểm và một nhược điểm của việc mua sắm trực tuyến.',
 'Ein Vorteil ist, dass man bequem von zu Hause bestellen kann. Ein Nachteil ist, dass man die Ware nicht anprobieren kann.',
 NULL,
 ARRAY['vorteil','nachteil','dass','einerseits','andererseits'],
 ARRAY['Meinung_aeussern','Vor_und_Nachteile'], 3, ARRAY['#Meinung','#Sprechen','#Einkaufen']);

-- Lesen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('B1', 'LESEN', 11, 'MULTIPLE_CHOICE',
 'Der Film, ___ wir gestern gesehen haben, war sehr spannend.',
 'Bộ phim ___ chúng tôi xem hôm qua rất hấp dẫn. (đại từ quan hệ)',
 '["der","den","dem","das"]'::jsonb,
 'den',
 ARRAY['Relativsaetze'], 3, ARRAY['#Relativsatz','#Akkusativ']),
('B1', 'LESEN', 11, 'MULTIPLE_CHOICE',
 'Wenn ich mehr Zeit ___, ___ ich eine Weltreise machen.',
 'Nếu tôi ___ nhiều thời gian hơn, tôi ___ đi vòng quanh thế giới. (Konjunktiv II)',
 '["habe / werde","hätte / würde","hatte / wollte","hätte / werde"]'::jsonb,
 'hätte / würde',
 ARRAY['Konjunktiv_II_irreal'], 4, ARRAY['#KonjunktivII','#wenn']),
('B1', 'LESEN', 12, 'MULTIPLE_CHOICE',
 E'Lesen Sie den Text:\n"Immer mehr Menschen in Deutschland arbeiten im Homeoffice. Eine Umfrage zeigt: Die meisten schätzen die Zeitersparnis, weil der Arbeitsweg wegfällt. Kritisch sehen viele jedoch, dass die Grenze zwischen Arbeit und Freizeit verschwimmt und der Kontakt zu Kolleginnen und Kollegen fehlt."\n\nWas kritisieren viele Befragte?',
 'Nhiều người được hỏi phê bình điều gì?',
 '["Dass sie länger zur Arbeit fahren müssen.","Dass Arbeit und Freizeit schwer zu trennen sind.","Dass sie zu viel Kontakt zu Kollegen haben."]'::jsonb,
 'Dass Arbeit und Freizeit schwer zu trennen sind.',
 ARRAY['Leseverstehen_Sachtext'], 3, ARRAY['#Leseverstehen','#Arbeit','#Homeoffice']),
('B1', 'LESEN', 12, 'MULTIPLE_CHOICE',
 E'Lesen Sie die E-Mail:\n"Sehr geehrte Frau Berger, leider muss ich Ihnen mitteilen, dass ich den Deutschkurs am Abend nicht weiter besuchen kann, da sich meine Arbeitszeiten geändert haben. Wäre es möglich, in den Vormittagskurs zu wechseln? Über eine kurze Rückmeldung würde ich mich freuen. Mit freundlichen Grüßen, Duc Nguyen"\n\nWorum bittet Duc?',
 'Duc đề nghị điều gì?',
 '["Um eine Verlängerung des Kurses","Um einen Wechsel in den Vormittagskurs","Um eine Rückerstattung der Kursgebühr"]'::jsonb,
 'Um einen Wechsel in den Vormittagskurs',
 ARRAY['Leseverstehen_formelle_Email'], 3, ARRAY['#Leseverstehen','#E-Mail','#formell']);

-- Schreiben
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('B1', 'SCHREIBEN', 11, 'FILL_BLANK',
 'Das Fenster ___ gestern von einem Handwerker repariert. (werden)',
 'Cửa sổ ___ được thợ sửa hôm qua. (bị động quá khứ với "werden")',
 'wurde', ARRAY['wurde gestern'], NULL,
 ARRAY['Passiv_Praeteritum'], 3, ARRAY['#Passiv','#Präteritum','#Schreiben']),
('B1', 'SCHREIBEN', 11, 'FILL_BLANK',
 '___ des schlechten Wetters wurde das Konzert abgesagt.',
 '___ thời tiết xấu, buổi hoà nhạc bị huỷ. (giới từ đi với Genitiv)',
 'Wegen', ARRAY['wegen','Aufgrund','aufgrund'], NULL,
 ARRAY['Praepositionen_Genitiv'], 3, ARRAY['#Genitiv','#Präposition','#Schreiben']),
('B1', 'SCHREIBEN', 12, 'FREE_WRITE',
 'Schreiben Sie eine kurze Beschwerde an Ihren Vermieter: Die Heizung funktioniert seit drei Tagen nicht. Bitten Sie um eine schnelle Reparatur. (3 Sätze)',
 'Viết thư phàn nàn ngắn gửi chủ nhà: máy sưởi hỏng ba ngày nay, đề nghị sửa nhanh. (3 câu)',
 'Sehr geehrter Herr Braun, seit drei Tagen funktioniert die Heizung in meiner Wohnung nicht. Es ist sehr kalt. Bitte lassen Sie sie so schnell wie möglich reparieren.',
 NULL,
 ARRAY['heizung','funktioniert','seit','reparier','bitte','sehr geehrte'],
 ARRAY['Schreiben_Beschwerde','formelle_Briefe'], 3, ARRAY['#Schreiben','#Beschwerde','#formell']);

-- ═══════════════════════════════ B2 ═══════════════════════════════
-- module_number danh nghĩa: 13 Grammatik · 14 Wortschatz · 15 Kommunikation · 16 Text

-- Hören
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, audio_transcript, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('B2', 'HOEREN', 15, 'MULTIPLE_CHOICE',
 'Was ist laut der Studie entscheidend?',
 'Theo nghiên cứu, điều gì mang tính quyết định?',
 'Frau Dr. Lang, Sie haben eine Studie zum Thema Schlaf veröffentlicht. — Ja, wir konnten zeigen, dass nicht die Dauer, sondern die Regelmäßigkeit des Schlafs entscheidend ist. Wer jeden Tag zur gleichen Zeit ins Bett geht, ist tagsüber leistungsfähiger – selbst wenn er insgesamt etwas weniger schläft.',
 '["Möglichst lange zu schlafen","Regelmäßige Schlafenszeiten","Mittags ein kurzes Nickerchen zu machen"]'::jsonb,
 'Regelmäßige Schlafenszeiten',
 ARRAY['Hoerverstehen_Interview'], 4, ARRAY['#Hörverstehen','#Interview','#Gesundheit']),
('B2', 'HOEREN', 15, 'MULTIPLE_CHOICE',
 'Welche Folge der Vier-Tage-Woche nennt der Sprecher?',
 'Diễn giả nêu hệ quả nào của tuần làm việc 4 ngày?',
 'Viele Unternehmen setzen inzwischen auf die Vier-Tage-Woche. Die Befürchtung, die Produktivität würde sinken, hat sich in den meisten Pilotprojekten nicht bestätigt. Im Gegenteil: Die Mitarbeitenden meldeten sich seltener krank, und die Fluktuation ging deutlich zurück.',
 '["Die Produktivität ist stark gesunken.","Es gab weniger Krankmeldungen.","Mehr Mitarbeitende haben gekündigt."]'::jsonb,
 'Es gab weniger Krankmeldungen.',
 ARRAY['Hoerverstehen_Vortrag'], 4, ARRAY['#Hörverstehen','#Vortrag','#Arbeit']),
('B2', 'HOEREN', 15, 'MULTIPLE_CHOICE',
 'Was passiert, wenn Frau Yilmaz das Buch nicht bis Freitag abholt?',
 'Chuyện gì xảy ra nếu bà Yilmaz không lấy sách trước thứ Sáu?',
 'Hallo Frau Yilmaz, hier Peters von der Stadtbibliothek. Das von Ihnen vorbestellte Buch ist eingetroffen. Wir halten es bis einschließlich Freitag für Sie bereit; danach geht es an die nächste Person auf der Warteliste.',
 '["Sie muss eine Gebühr zahlen.","Das Buch bekommt jemand anderes.","Die Bibliothek schickt es ihr per Post."]'::jsonb,
 'Das Buch bekommt jemand anderes.',
 ARRAY['Hoerverstehen_Nachrichten'], 3, ARRAY['#Hörverstehen','#Nachricht','#Alltag']);

-- Sprechen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('B2', 'SPRECHEN', 15, 'SPEAKING',
 'Nehmen Sie Stellung: Sollten Handys an Schulen verboten werden? Nennen Sie Ihre Meinung und zwei Argumente.',
 'Nêu quan điểm: có nên cấm điện thoại ở trường không? Nêu ý kiến và hai lập luận.',
 'Meiner Meinung nach sollten Handys nicht komplett verboten werden, da sie im Unterricht sinnvoll eingesetzt werden können. Allerdings lenken sie in den Pausen oft ab.',
 NULL,
 ARRAY['meinung','finde','sollte','allerdings','andererseits','weil'],
 ARRAY['Stellung_nehmen','Argumentieren'], 4, ARRAY['#Meinung','#Argumentieren','#Sprechen']),
('B2', 'SPRECHEN', 15, 'SPEAKING',
 'Beschreiben Sie Ihrem Chef ein Problem im Team und schlagen Sie eine Lösung vor.',
 'Trình bày với sếp một vấn đề trong nhóm và đề xuất cách giải quyết.',
 'In letzter Zeit gibt es im Team Missverständnisse, weil Informationen nicht weitergegeben werden. Ich schlage vor, dass wir uns jeden Montag kurz abstimmen.',
 NULL,
 ARRAY['problem','schlage vor','vorschlag','lösung','könnten','sollten'],
 ARRAY['Probleme_beschreiben','Vorschlaege_machen'], 4, ARRAY['#Beruf','#Vorschlag','#Sprechen']);

-- Lesen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('B2', 'LESEN', 13, 'MULTIPLE_CHOICE',
 'Die ___ Bewerbungen werden bis Ende der Woche geprüft.',
 'Các hồ sơ ___ sẽ được xét đến cuối tuần. (phân từ làm tính từ)',
 '["eingehende","eingegangenen","eingegangene","eingehenden"]'::jsonb,
 'eingegangenen',
 ARRAY['Partizip_als_Adjektiv','Adjektivdeklination'], 4, ARRAY['#Partizip','#Adjektivdeklination']),
('B2', 'LESEN', 13, 'MULTIPLE_CHOICE',
 'Er tat so, ___ er nichts gehört hätte.',
 'Anh ta làm ___ chưa nghe thấy gì. (so sánh giả định)',
 '["als","als ob","obwohl","wenn"]'::jsonb,
 'als ob',
 ARRAY['Irreale_Vergleichssaetze'], 4, ARRAY['#alsob','#KonjunktivII']),
('B2', 'LESEN', 16, 'MULTIPLE_CHOICE',
 E'Lesen Sie den Text:\n"Der sogenannte Rebound-Effekt beschreibt ein Phänomen, das Energiesparmaßnahmen teilweise wirkungslos macht: Wird ein Gerät effizienter, nutzen Verbraucher es häufig länger oder intensiver, sodass der tatsächliche Verbrauch kaum sinkt – in manchen Fällen sogar steigt."\n\nWas besagt der Rebound-Effekt?',
 'Hiệu ứng Rebound nói lên điều gì?',
 '["Effiziente Geräte verbrauchen immer weniger Energie.","Einsparungen werden durch veränderte Nutzung teilweise aufgehoben.","Verbraucher kaufen seltener neue Geräte."]'::jsonb,
 'Einsparungen werden durch veränderte Nutzung teilweise aufgehoben.',
 ARRAY['Leseverstehen_Sachtext_B2'], 4, ARRAY['#Leseverstehen','#Umwelt','#Sachtext']),
('B2', 'LESEN', 14, 'MULTIPLE_CHOICE',
 'Welches Wort passt? Nach der Fusion der beiden Firmen wurden viele Stellen ___.',
 'Từ nào phù hợp? Sau khi hai công ty sáp nhập, nhiều vị trí đã bị ___.',
 '["abgebaut","aufgebaut","ausgebaut","eingebaut"]'::jsonb,
 'abgebaut',
 ARRAY['Wortschatz_Beruf_Wirtschaft'], 3, ARRAY['#Wortschatz','#Wirtschaft']);

-- Schreiben
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('B2', 'SCHREIBEN', 13, 'FILL_BLANK',
 'Der Minister sagte, er ___ von den Plänen nichts gewusst. (haben — indirekte Rede)',
 'Bộ trưởng nói ông ___ không biết gì về các kế hoạch. (lời dẫn gián tiếp với "haben")',
 'habe', ARRAY['hätte'], NULL,
 ARRAY['Konjunktiv_I_indirekte_Rede'], 4, ARRAY['#KonjunktivI','#indirekteRede','#Schreiben']),
('B2', 'SCHREIBEN', 13, 'FILL_BLANK',
 'Trotz des ___ Regens fand das Fest statt. (stark)',
 'Bất chấp cơn mưa ___, lễ hội vẫn diễn ra. (đuôi tính từ sau Genitiv)',
 'starken', NULL, NULL,
 ARRAY['Adjektivdeklination_Genitiv','Praepositionen_Genitiv'], 4, ARRAY['#Genitiv','#Adjektivdeklination','#Schreiben']),
('B2', 'SCHREIBEN', 16, 'FREE_WRITE',
 'Schreiben Sie eine Antwort auf einen Leserbrief: Der Autor fordert, den Autoverkehr in der Innenstadt zu verbieten. Stimmen Sie zu oder nicht? (3–4 Sätze)',
 'Viết phản hồi cho một thư bạn đọc đòi cấm ô tô trong trung tâm thành phố. Bạn đồng ý hay không? (3–4 câu)',
 'Ich stimme dem Autor nur teilweise zu. Zwar würde ein Verbot die Luftqualität verbessern, jedoch sind viele Geschäfte auf Kunden mit dem Auto angewiesen. Sinnvoller wären bessere Busverbindungen und mehr Radwege.',
 NULL,
 ARRAY['stimme','zwar','jedoch','allerdings','meinung','weil'],
 ARRAY['Schreiben_Leserbrief','Argumentieren_schriftlich'], 4, ARRAY['#Schreiben','#Leserbrief','#Argumentieren']);

-- ═══════════════════════════════ C1 ═══════════════════════════════
-- module_number danh nghĩa: 17 Grammatik · 18 Wortschatz · 19 Kommunikation · 20 Text

-- Hören
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, audio_transcript, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('C1', 'HOEREN', 19, 'MULTIPLE_CHOICE',
 'Welche Position vertritt die Sprecherin?',
 'Diễn giả bảo vệ quan điểm nào?',
 'Die Digitalisierung der Verwaltung wird oft als Allheilmittel gepriesen. Dabei wird übersehen, dass ein erheblicher Teil der Bevölkerung – insbesondere ältere Menschen – digitale Angebote nur eingeschränkt nutzen kann. Eine Verwaltung, die ausschließlich online erreichbar ist, läuft daher Gefahr, genau jene auszuschließen, die auf sie am meisten angewiesen sind.',
 '["Digitalisierung löst alle Verwaltungsprobleme.","Rein digitale Angebote können bestimmte Gruppen ausschließen.","Ältere Menschen lehnen digitale Angebote grundsätzlich ab."]'::jsonb,
 'Rein digitale Angebote können bestimmte Gruppen ausschließen.',
 ARRAY['Hoerverstehen_Vortrag_C1'], 4, ARRAY['#Hörverstehen','#Gesellschaft','#Vortrag']),
('C1', 'HOEREN', 19, 'MULTIPLE_CHOICE',
 'Wie erklärt Frau Weiß die geringeren Mietsteigerungen?',
 'Bà Weiß giải thích thế nào về việc tiền thuê tăng chậm hơn?',
 'Herr Braun: Die Mietpreisbremse hat den Anstieg der Mieten spürbar gedämpft. — Frau Weiß: Das bezweifle ich. Die Zahlen zeigen zwar geringere Steigerungen, aber das liegt vor allem daran, dass weniger Wohnungen überhaupt neu vermietet wurden – die Bremse hat den Markt eher gelähmt als entlastet.',
 '["Durch die Wirkung der Mietpreisbremse","Durch weniger Neuvermietungen","Durch mehr Neubauten"]'::jsonb,
 'Durch weniger Neuvermietungen',
 ARRAY['Hoerverstehen_Diskussion'], 5, ARRAY['#Hörverstehen','#Diskussion','#Wohnen']),
('C1', 'HOEREN', 19, 'MULTIPLE_CHOICE',
 'Was erwartet das Lektorat von Herrn Hoffmann?',
 'Ban biên tập mong đợi gì từ ông Hoffmann?',
 'Guten Tag, Herr Hoffmann, Sabine Kern vom Lektorat. Wir haben Ihr Manuskript mit großem Interesse gelesen. Bevor wir eine Entscheidung treffen können, bräuchten wir allerdings eine gekürzte Fassung des zweiten Kapitels – etwa um ein Drittel. Wenn Sie uns diese bis Monatsende zukommen lassen könnten, wäre das ideal.',
 '["Ein komplett neues zweites Kapitel","Eine um ein Drittel gekürzte Fassung des zweiten Kapitels","Eine Verlängerung des Manuskripts"]'::jsonb,
 'Eine um ein Drittel gekürzte Fassung des zweiten Kapitels',
 ARRAY['Hoerverstehen_berufliche_Nachricht'], 4, ARRAY['#Hörverstehen','#Beruf','#Nachricht']);

-- Sprechen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('C1', 'SPRECHEN', 19, 'SPEAKING',
 'Sie halten einen kurzen Vortrag: Erläutern Sie Chancen und Risiken von künstlicher Intelligenz im Berufsleben. Formulieren Sie eine differenzierte Einschätzung.',
 'Trình bày ngắn: cơ hội và rủi ro của trí tuệ nhân tạo trong công việc. Đưa ra đánh giá có phân tích.',
 'Künstliche Intelligenz birgt einerseits das Potenzial, Routineaufgaben zu automatisieren und Fachkräfte zu entlasten. Andererseits besteht die Gefahr, dass ganze Berufsbilder verschwinden. Entscheidend wird sein, ob Weiterbildung mit dem Wandel Schritt hält.',
 NULL,
 ARRAY['einerseits','andererseits','chance','risiko','gefahr','zwar'],
 ARRAY['Vortrag_strukturieren','Differenziert_argumentieren'], 5, ARRAY['#Vortrag','#Argumentieren','#Sprechen']),
('C1', 'SPRECHEN', 19, 'SPEAKING',
 'Reagieren Sie diplomatisch auf die Kritik eines Kunden an einer verspäteten Lieferung und bieten Sie eine Lösung an.',
 'Phản hồi khéo léo lời phê bình của khách hàng về đơn hàng giao trễ và đề xuất giải pháp.',
 'Ich kann Ihren Ärger gut nachvollziehen und bitte die Verzögerung zu entschuldigen. Selbstverständlich erstatten wir Ihnen die Versandkosten und liefern morgen vorrangig.',
 NULL,
 ARRAY['nachvollziehen','entschuldig','verzögerung','selbstverständlich','erstatten','lösung'],
 ARRAY['Registerwechsel_diplomatisch','Kundenkommunikation'], 4, ARRAY['#Beruf','#Kunde','#Sprechen']);

-- Lesen
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer, weak_nodes, difficulty, tags)
VALUES
('C1', 'LESEN', 17, 'MULTIPLE_CHOICE',
 '___ seiner langjährigen Erfahrung wurde ihm die Leitung des Projekts übertragen.',
 '___ kinh nghiệm lâu năm, ông được giao lãnh đạo dự án. (giới từ nguyên nhân)',
 '["Trotz","Aufgrund","Anstelle","Ungeachtet"]'::jsonb,
 'Aufgrund',
 ARRAY['Praepositionen_kausal','Nominalstil'], 4, ARRAY['#Präposition','#Nominalstil']),
('C1', 'LESEN', 17, 'MULTIPLE_CHOICE',
 'Das ist ein Ergebnis, ___ Bedeutung kaum zu überschätzen ist.',
 'Đó là một kết quả ___ ý nghĩa khó có thể đánh giá quá cao. (đại từ quan hệ Genitiv)',
 '["dessen","deren","das","dem"]'::jsonb,
 'dessen',
 ARRAY['Relativsaetze_Genitiv'], 5, ARRAY['#Relativsatz','#Genitiv']),
('C1', 'LESEN', 20, 'MULTIPLE_CHOICE',
 E'Lesen Sie den Text:\n"Dass Lesen die Empathiefähigkeit fördert, gilt inzwischen als gut belegt. Weniger klar ist jedoch, ob dieser Effekt allen Textsorten gleichermaßen zukommt. Neuere Untersuchungen legen nahe, dass vor allem literarische Erzählungen, die den Leser zwingen, sich in vielschichtige Figuren hineinzuversetzen, diese Wirkung entfalten – während Sachtexte und Unterhaltungsliteratur kaum messbare Effekte zeigen."\n\nWelche Aussage entspricht dem Text?',
 'Phát biểu nào đúng với bài đọc?',
 '["Alle Textsorten fördern Empathie in gleichem Maße.","Vor allem anspruchsvolle literarische Texte fördern Empathie.","Sachtexte fördern Empathie stärker als Romane."]'::jsonb,
 'Vor allem anspruchsvolle literarische Texte fördern Empathie.',
 ARRAY['Leseverstehen_wissenschaftlich'], 5, ARRAY['#Leseverstehen','#Wissenschaft','#Sachtext']),
('C1', 'LESEN', 18, 'MULTIPLE_CHOICE',
 'Welches Wort passt? Die Regierung hat die Reform nach massiven Protesten wieder ___.',
 'Từ nào phù hợp? Sau các cuộc biểu tình lớn, chính phủ đã ___ cải cách.',
 '["zurückgenommen","aufgenommen","vorgenommen","abgenommen"]'::jsonb,
 'zurückgenommen',
 ARRAY['Wortschatz_Politik','Praefixverben'], 4, ARRAY['#Wortschatz','#Politik','#Präfixverben']);

-- Schreiben
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer, alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES
('C1', 'SCHREIBEN', 17, 'FILL_BLANK',
 'Je länger die Verhandlungen dauerten, ___ geringer wurde die Hoffnung auf eine Einigung.',
 'Đàm phán càng kéo dài, hy vọng đạt thoả thuận ___ càng nhỏ. (cấu trúc je … desto)',
 'desto', ARRAY['umso'], NULL,
 ARRAY['Je_desto'], 4, ARRAY['#jedesto','#Schreiben']),
('C1', 'SCHREIBEN', 17, 'FILL_BLANK',
 'Hätte er das gewusst, ___ er anders entschieden. (haben, Konjunktiv II der Vergangenheit)',
 'Nếu biết điều đó, anh ấy ___ quyết định khác. (Konjunktiv II quá khứ với "haben")',
 'hätte', ARRAY['hätte er anders entschieden','so hätte'], NULL,
 ARRAY['Konjunktiv_II_Vergangenheit','Konditionalsatz_ohne_wenn'], 5, ARRAY['#KonjunktivII','#Vergangenheit','#Schreiben']),
('C1', 'SCHREIBEN', 20, 'FREE_WRITE',
 'Fassen Sie in 2–3 Sätzen die Kernaussage zusammen und bewerten Sie sie: „Homeoffice erhöht die Produktivität, gefährdet aber den Zusammenhalt im Team.“',
 'Tóm tắt luận điểm sau trong 2–3 câu và đánh giá: „Làm việc tại nhà tăng năng suất nhưng đe doạ sự gắn kết của nhóm.“',
 'Die These lautet, dass Homeoffice zwar effizienter macht, das Team aber auseinanderdriften lässt. Dem stimme ich weitgehend zu, halte den Zusammenhalt jedoch durch regelmäßige Präsenztage für sicherbar.',
 NULL,
 ARRAY['zwar','jedoch','stimme','allerdings','zusammenhalt','produktiv'],
 ARRAY['Zusammenfassen_und_bewerten','Textproduktion_C1'], 5, ARRAY['#Schreiben','#Zusammenfassung','#Bewertung']);

-- ═══════════════════════════════ A1 (vá V71) ═══════════════════════════════
-- Câu FREE_WRITE A1 của V71 không có grading_keywords ⇒ chỉ đậu khi gõ đúng nguyên văn một trong ba câu mẫu.
-- Cho keyword như các câu tự luận mới (đậu khi ≥ 50% keyword có mặt).
UPDATE placement_questions
SET grading_keywords = ARRAY['muss','man','deutsch','sprechen']
WHERE cefr_level = 'A1' AND question_type = 'FREE_WRITE' AND grading_keywords IS NULL
  AND correct_answer = 'Man muss hier Deutsch sprechen.';
