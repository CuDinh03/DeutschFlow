-- V281: Ngân hàng đề B2 (Goethe + telc) cho mảng Luyện thi Nói — Đợt 4.
--
-- Blueprint B2 đã seed sẵn ở V277 (parts_json + rubric_json đủ cả hai hệ); đợt này CHỈ thêm đề.
-- Thẻ được rút LẺ và ngẫu nhiên theo cardsNeeded của từng Teil, KHÔNG seed sẵn thành cặp/bộ:
--   Goethe B2 T1 cardsNeeded=2 → rút 2 chủ đề → màn "chọn 1 trong 2" tự bật (PartPlan.choiceRequired)
--   telc  B2 T1 cardsNeeded=5 → rút 5 chủ đề → màn "chọn 1 trong 5"
-- Nên pool mỗi Teil phải LỚN HƠN cardsNeeded, nếu không ExamTaskBankService.pick ném 409.
--
-- KHÔNG viết chuỗi đô-la liền ngoặc nhọn ở bất kỳ đâu trong file, kể cả trong comment:
-- Flyway hiểu đó là placeholder và migration sẽ nổ. Luôn để một khoảng trắng sau dấu mở.
--
-- Nội dung đề do dự án tự soạn theo ĐÚNG FORMAT quy chế (format không được bảo hộ); không sao
-- chép đề thật của Goethe/telc.

-- ─────────────────────────────────────────────────────────────────────────────
-- Goethe B2 — Teil 1 „Vortrag halten" (PRESENT, rút 2 → thí sinh chọn 1)
-- Cấu trúc bắt buộc: Einleitung – Hauptteil – Schluss, kèm 3 gạch nội dung theo
-- Durchführungsbestimmungen: mô tả nhiều phương án · cân nhắc lợi/hại · đi sâu một phương án.
-- Sau bài nói: partner-AI BẮT BUỘC đặt câu hỏi, rồi giám khảo hỏi (orchestrator đã lo).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'GOETHE', 'B2', 1, 'PRESENT',
       jsonb_build_object(
         'type', 'TOPIC_CHOICE',
         'context', 'Sie besuchen ein Seminar und halten dort einen kurzen Vortrag.',
         'topic', t.topic,
         'aspects', '["Beschreiben Sie mehrere Möglichkeiten oder Aspekte.",
                      "Bewerten Sie Vor- und Nachteile.",
                      "Beschreiben Sie eine Möglichkeit genauer und begründen Sie Ihre Wahl."]'::jsonb,
         'structureHint', 'Einleitung – Hauptteil – Schluss')
FROM (VALUES
 ('Wie sollten Städte den Autoverkehr in den Innenstädten regeln?'),
 ('Sollten Unternehmen ihren Mitarbeitenden Homeoffice garantieren?'),
 ('Wie kann man ältere Menschen besser in die digitale Welt einbinden?'),
 ('Welche Rolle sollte Werbung in sozialen Netzwerken spielen?'),
 ('Wie sollte eine Schule mit der Handynutzung umgehen?'),
 ('Sollte ehrenamtliches Engagement stärker belohnt werden?'),
 ('Wie lässt sich Lebensmittelverschwendung wirksam verringern?'),
 ('Welchen Stellenwert sollte Sport im Alltag von Erwachsenen haben?'),
 ('Wie kann man das Reisen umweltfreundlicher gestalten?'),
 ('Sollten Museen und Theater für junge Leute kostenlos sein?'),
 ('Wie sollte man mit Konflikten am Arbeitsplatz umgehen?'),
 ('Welche Bedeutung hat Mehrsprachigkeit für die Berufswelt?'),
 ('Wie viel Verantwortung tragen Verbraucherinnen und Verbraucher für den Klimaschutz?'),
 ('Sollte Nachbarschaftshilfe stärker organisiert werden?'),
 ('Wie kann man Kinder an das Lesen heranführen?'),
 ('Welchen Einfluss sollten Online-Bewertungen auf Kaufentscheidungen haben?')
) AS t(topic);

-- ─────────────────────────────────────────────────────────────────────────────
-- Goethe B2 — Teil 2 „Diskussion führen" (DISCUSS, Debattierclub)
-- DefaultPrueferScriptService case DISCUSS đọc khóa 'question' → BẮT BUỘC có.
-- 'partnerStance' là khóa riêng tư: clientStimulus lược mọi khóa bắt đầu bằng "partner",
-- AiInterlocutorService.privateContext đưa nó vào system prompt để partner giữ vai phản biện.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'GOETHE', 'B2', 2, 'DISCUSS',
       jsonb_build_object(
         'type', 'DEBATE_CARD',
         'context', 'Sie sind in einem Debattierclub.',
         'question', d.question,
         'instruction', 'Tauschen Sie Ihren Standpunkt aus, reagieren Sie auf Ihre Partnerin oder Ihren Partner und fassen Sie am Ende zusammen: dafür oder dagegen?',
         'partnerStance', d.stance)
FROM (VALUES
 ('Sollte in Innenstädten ein generelles Tempolimit von 30 km/h gelten?', 'dagegen'),
 ('Sollten Arbeitgeber die Vier-Tage-Woche einführen?', 'dafür'),
 ('Sollte der Zugang zu öffentlichen Verkehrsmitteln kostenlos sein?', 'dagegen'),
 ('Sollten Smartphones an Schulen vollständig verboten werden?', 'dafür'),
 ('Sollte ein soziales Jahr für alle jungen Menschen verpflichtend sein?', 'dagegen'),
 ('Sollten Inlandsflüge deutlich teurer werden?', 'dafür'),
 ('Sollten Firmen verpflichtet werden, Gehälter transparent zu machen?', 'dagegen'),
 ('Sollte Werbung für ungesunde Lebensmittel eingeschränkt werden?', 'dafür'),
 ('Sollten Studierende während des Studiums arbeiten müssen?', 'dagegen'),
 ('Sollte man soziale Netzwerke erst ab 16 Jahren nutzen dürfen?', 'dafür'),
 ('Sollten Städte mehr Grünflächen statt Parkplätze schaffen?', 'dagegen'),
 ('Sollte lebenslanges Lernen gesetzlich gefördert werden?', 'dafür')
) AS d(question, stance);

-- ─────────────────────────────────────────────────────────────────────────────
-- telc B2 — Teil 1 „Präsentation" (PRESENT, rút 5 → thí sinh chọn 1; core ~90 giây)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'TELC', 'B2', 1, 'PRESENT',
       jsonb_build_object(
         'type', 'TOPIC_CHOICE',
         'topic', t.topic,
         'instruction', 'Halten Sie eine kurze Präsentation von etwa 90 Sekunden. Ihre Partnerin oder Ihr Partner stellt danach eine Rückfrage.',
         'structureHint', 'Einstieg – zwei bis drei Aspekte – persönliche Einschätzung')
FROM (VALUES
 ('Ehrenamtliches Engagement'), ('Gesunde Ernährung im Arbeitsalltag'),
 ('Reisen früher und heute'), ('Die Bedeutung von Fremdsprachen'),
 ('Leben in der Stadt oder auf dem Land'), ('Digitale Medien im Familienleben'),
 ('Sport als Ausgleich zum Beruf'), ('Nachhaltiger Konsum'),
 ('Weiterbildung im Beruf'), ('Feste und Traditionen'),
 ('Mobilität der Zukunft'), ('Wohnen im Alter'),
 ('Freundschaft über große Entfernungen'), ('Arbeiten im Team'),
 ('Umgang mit Stress'), ('Bücher oder Hörbücher'),
 ('Freiwillige Arbeit im Ausland'), ('Haustiere in der Großstadt'),
 ('Berufswahl und Familie'), ('Musik im Alltag'),
 ('Second-Hand kaufen und tauschen'), ('Gesundheitsvorsorge'),
 ('Sprachen lernen mit Apps'), ('Nachbarschaft heute'),
 ('Urlaub ohne Flugzeug'), ('Zeitmanagement im Studium'),
 ('Regionale Produkte einkaufen'), ('Kultur im Alltag'),
 ('Umzug in ein anderes Land'), ('Sicherheit im Internet')
) AS t(topic);

-- ─────────────────────────────────────────────────────────────────────────────
-- telc B2 — Teil 2 „Diskussion" (DISCUSS, xuất phát từ một đoạn text ngắn gây tranh cãi)
-- Text do dự án tự soạn; mọi số liệu nêu trong text đều ghi rõ là hư cấu.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'TELC', 'B2', 2, 'DISCUSS',
       jsonb_build_object(
         'type', 'DEBATE_TEXT',
         'text', d.text,
         'question', d.question,
         'instruction', 'Diskutieren Sie über den Text: Nennen Sie Ihre Meinung, gehen Sie auf Ihre Partnerin oder Ihren Partner ein und ziehen Sie am Ende ein Fazit.',
         'partnerStance', d.stance)
FROM (VALUES
 ('Immer mehr Betriebe erlauben Hunde am Arbeitsplatz. Befürworter sprechen von einem besseren Betriebsklima, Kritiker von Ablenkung und fehlender Rücksicht.',
  'Sollten Hunde am Arbeitsplatz erlaubt sein?', 'dagegen'),
 ('Einige Städte verlangen inzwischen eine Gebühr für die Einfahrt in die Innenstadt, um den Verkehr zu verringern. Geschäfte fürchten weniger Kundschaft.',
  'Ist eine Innenstadtgebühr sinnvoll?', 'dafür'),
 ('Manche Firmen schaffen feste Arbeitszeiten ab und bewerten nur noch Ergebnisse. Andere warnen davor, dass die Grenze zwischen Arbeit und Freizeit verschwindet.',
  'Sollten feste Arbeitszeiten abgeschafft werden?', 'dagegen'),
 ('In mehreren Schulen ersetzen Tablets die gedruckten Bücher vollständig. Eltern diskutieren über Kosten, Konzentration und Augengesundheit.',
  'Sollten Tablets gedruckte Schulbücher ersetzen?', 'dafür'),
 ('Einige Supermärkte geben am Abend übrig gebliebene Lebensmittel kostenlos ab. Kritiker befürchten, dass dadurch weniger sorgfältig geplant wird.',
  'Sollten Supermärkte Lebensmittel abends verschenken?', 'dagegen'),
 ('Manche Vereine verlangen von ihren Mitgliedern eine feste Zahl an Arbeitsstunden pro Jahr. Wer keine Zeit hat, zahlt stattdessen einen Betrag.',
  'Ist eine Arbeitsstundenpflicht in Vereinen gerecht?', 'dafür'),
 ('Immer mehr Menschen teilen Auto, Werkzeug und sogar Wohnraum, statt selbst zu besitzen. Manche sehen darin Fortschritt, andere Unsicherheit.',
  'Ist Teilen besser als Besitzen?', 'dagegen'),
 ('Manche Arbeitgeber verlangen keine Zeugnisse mehr, sondern laden Bewerberinnen und Bewerber direkt zu einer bezahlten Probearbeit ein.',
  'Sollte Probearbeit Zeugnisse ersetzen?', 'dafür')
) AS d(text, question, stance);

-- ─────────────────────────────────────────────────────────────────────────────
-- telc B2 — Teil 3 „Problemlösung" (PLAN_NEGOTIATE, cùng lập kế hoạch)
-- Dùng lại đúng hình dạng stimulus PLANNING_CARD của B1 (situation + prompts).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT 'TELC', 'B2', 3, 'PLAN_NEGOTIATE',
       jsonb_build_object('type', 'PLANNING_CARD', 'situation', s.situation, 'prompts', s.prompts)
FROM (VALUES
 ('Ihr Sprachkurs möchte einen Abschlussabend organisieren.',
  '["Wann und wo?","Essen und Getränke?","Programm?","Wer übernimmt was?"]'::jsonb),
 ('Ihre Abteilung bekommt eine neue Kollegin aus dem Ausland. Planen Sie die Einarbeitung.',
  '["Erste Woche?","Wer betreut?","Sprache im Team?","Was zeigen Sie zuerst?"]'::jsonb),
 ('Ihr Wohnhaus möchte einen Gemeinschaftsgarten anlegen.',
  '["Welche Fläche?","Was anpflanzen?","Kosten und Material?","Wer pflegt wann?"]'::jsonb),
 ('Ihr Verein braucht mehr junge Mitglieder. Planen Sie eine Aktion.',
  '["Welche Aktion?","Wie bekannt machen?","Wann?","Wer hilft mit?"]'::jsonb),
 ('Ihre Firma möchte Papier sparen. Planen Sie konkrete Maßnahmen.',
  '["Wo wird viel Papier gebraucht?","Welche Alternativen?","Wie überzeugen Sie die Kollegen?","Ab wann?"]'::jsonb),
 ('Sie organisieren eine Exkursion für Ihren Kurs.',
  '["Wohin?","Anreise?","Kosten pro Person?","Zeitplan für den Tag?"]'::jsonb),
 ('Ihr Team soll ein Willkommenspaket für neue Mitarbeitende zusammenstellen.',
  '["Was gehört hinein?","Budget?","Wer besorgt was?","Wann übergeben?"]'::jsonb),
 ('Ihre Nachbarschaft möchte ein Straßenfest veranstalten.',
  '["Termin?","Genehmigung und Aufbau?","Essen und Musik?","Wer spricht die Nachbarn an?"]'::jsonb)
) AS s(situation, prompts);
