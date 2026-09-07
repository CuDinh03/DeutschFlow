-- V309: Hai đề thi thử B1 (Set 3, Set 4) — bù cho B1 đủ 5 đề.
-- Cấu trúc theo Goethe-Zertifikat B1: Lesen 5 Teil (25 câu) · Hören 4 Teil (20 câu) ·
-- Schreiben 2 bài · Sprechen 3 Teil. Mỗi phần 25 điểm.
-- Phần Viết dùng input_email + writing_points để trình chạy vẽ được ô nhập (đề B1 cũ để đề ở
-- khoá `prompt` nên trước bản vá 07/09/2026 học viên không có chỗ gõ).

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'B1', 'GOETHE',
  'Goethe Zertifikat B1 – Set 3',
  'Đề thi thử Goethe B1 – Chủ đề: Học tập, đào tạo nghề và công việc',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie den Blogtext. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài blog và chọn Richtig hoặc Falsch",
            "context": "Blog von Mert: Mein Weg zur Ausbildung\nNach der Schule wusste ich lange nicht, was ich machen soll. Ein Studium hat mich nicht gereizt, weil ich nicht wieder jahrelang nur in Büchern lesen wollte. Ein Freund hat mir von seiner Ausbildung zum Mechatroniker erzählt, und ich habe ein Praktikum in einer kleinen Firma gemacht. Nach zwei Wochen war klar: Diese Arbeit passt zu mir. Der Anfang war trotzdem hart. In der Berufsschule waren Mathematik und Physik anspruchsvoll, und einmal habe ich fast aufgegeben. Mein Ausbilder hat mir dann angeboten, jede Woche eine Stunde zusätzlich zu üben. Heute bin ich im dritten Lehrjahr und verdiene mein eigenes Geld. Nach der Prüfung möchte ich noch den Meister machen, aber erst in zwei oder drei Jahren, denn ich will zuerst Erfahrung sammeln.",
            "items": [
              {"id":"L1-1","question":"Mert hat sich sofort nach der Schule für eine Ausbildung entschieden.","correct":"falsch","explanation_vi":"Anh ấy đã lưỡng lự một thời gian dài (wusste ich lange nicht)."},
              {"id":"L1-2","question":"Ein Praktikum hat ihm bei der Entscheidung geholfen.","correct":"richtig","explanation_vi":"Sau hai tuần thực tập anh biết công việc hợp với mình."},
              {"id":"L1-3","question":"In der Berufsschule fielen ihm alle Fächer leicht.","correct":"falsch","explanation_vi":"Toán và Lý khó, có lúc anh suýt bỏ cuộc."},
              {"id":"L1-4","question":"Sein Ausbilder hat ihm zusätzliche Übungsstunden angeboten.","correct":"richtig","explanation_vi":"jede Woche eine Stunde zusätzlich zu üben."},
              {"id":"L1-5","question":"Mert will direkt nach der Prüfung den Meister machen.","correct":"falsch","explanation_vi":"Anh muốn tích luỹ kinh nghiệm 2–3 năm trước đã."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Angebote A bis E. Welches Angebot passt zu welcher Person?",
            "instruction_vi": "Đọc 5 chương trình A–E và chọn chương trình hợp với từng người",
            "context": "A = Abendkolleg Horizont: Fachabitur in zwei Jahren, Unterricht ab 18 Uhr, für Berufstätige.\nB = Handwerkskammer: Meisterkurs in Teilzeit, Beginn jedes Frühjahr, Förderung möglich.\nC = Jobcenter Startklar: Bewerbungstraining und Lebenslauf-Check, kostenlos, ohne Anmeldung.\nD = Uni Bremen: Studium ohne Abitur für Personen mit Berufserfahrung, Beratung donnerstags.\nE = Sprachzentrum Global: Fachsprache Pflege B2, zwölf Wochen, Prüfung inklusive.",
            "items": [
              {"id":"L2-1","person":"Frau Duong arbeitet als Pflegehelferin und braucht die Fachsprache für die Anerkennung.","question":"Welches Angebot passt?","correct":"E","explanation_vi":"E dạy tiếng chuyên ngành điều dưỡng kèm thi."},
              {"id":"L2-2","person":"Herr Klose ist seit zehn Jahren Elektriker und möchte einen eigenen Betrieb gründen.","question":"Welches Angebot passt?","correct":"B","explanation_vi":"Muốn mở xưởng riêng thì cần bằng Meister (B)."},
              {"id":"L2-3","person":"Frau Ilic hat keinen Schulabschluss und möchte neben der Arbeit das Fachabitur nachholen.","question":"Welches Angebot passt?","correct":"A","explanation_vi":"A học buổi tối dành cho người đi làm."},
              {"id":"L2-4","person":"Herr Sane sucht seit Monaten eine Stelle und weiß nicht, ob seine Unterlagen gut sind.","question":"Welches Angebot passt?","correct":"C","explanation_vi":"C kiểm tra hồ sơ và luyện phỏng vấn miễn phí."},
              {"id":"L2-5","person":"Frau Tran ist gelernte Kauffrau mit acht Jahren Erfahrung und will studieren, hat aber kein Abitur.","question":"Welches Angebot passt?","correct":"D","explanation_vi":"D cho học đại học không cần Abitur nếu có kinh nghiệm nghề."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Artikel und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài báo và chọn đáp án đúng",
            "context": "Zeitungsartikel: Wenn der Beruf nicht mehr passt\nEtwa jede vierte Person in Deutschland denkt darüber nach, den Beruf zu wechseln. Die Gründe sind unterschiedlich: schlechte Arbeitszeiten, wenig Anerkennung oder der Wunsch nach mehr Sinn. Fachleute raten, den Wechsel gut vorzubereiten. Wer einfach kündigt, steht schnell ohne Einkommen da. Besser ist es, zuerst Informationen zu sammeln, mit Menschen aus dem Wunschberuf zu sprechen und wenn möglich ein Praktikum zu machen. Auch die Finanzen sind wichtig: Für eine Umschulung braucht man oft ein Jahr oder länger. In manchen Fällen zahlt die Agentur für Arbeit einen Teil der Kosten. Wichtig ist außerdem die Familie. Wer zu Hause Unterstützung hat, hält die schwierige Zeit leichter durch. Die meisten, die den Schritt gewagt haben, sagen im Rückblick: Es war anstrengend, aber richtig.",
            "items": [
              {"id":"L3-1","question":"Wie viele Menschen denken laut Text über einen Berufswechsel nach?","options":{"A":"Jede zweite Person","B":"Fast niemand","C":"Etwa jede vierte Person"},"correct":"C","explanation_vi":"etwa jede vierte Person."},
              {"id":"L3-2","question":"Welchen Grund nennt der Text NICHT?","options":{"A":"Schlechte Arbeitszeiten","B":"Wenig Anerkennung","C":"Zu kurzer Arbeitsweg"},"correct":"C","explanation_vi":"Bài nêu giờ giấc, thiếu ghi nhận và mong muốn ý nghĩa hơn."},
              {"id":"L3-3","question":"Was raten die Fachleute?","options":{"A":"Den Wechsel gut vorbereiten","B":"Sofort kündigen","C":"Nie den Beruf wechseln"},"correct":"A","explanation_vi":"den Wechsel gut vorzubereiten."},
              {"id":"L3-4","question":"Was sagt der Text über die Kosten einer Umschulung?","options":{"A":"Sie ist immer kostenlos","B":"Man muss immer alles selbst zahlen","C":"Die Agentur für Arbeit zahlt manchmal einen Teil"},"correct":"C","explanation_vi":"In manchen Fällen zahlt die Agentur für Arbeit einen Teil."},
              {"id":"L3-5","question":"Wie beurteilen die meisten den Wechsel im Rückblick?","options":{"A":"Als Fehler","B":"Als anstrengend, aber richtig","C":"Als leicht und schnell"},"correct":"B","explanation_vi":"Es war anstrengend, aber richtig."}
            ]
          },
          {
            "teil": 4,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Leserbriefe. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến bạn đọc và chọn Richtig hoặc Falsch",
            "context": "Leserbriefe zum Thema Homeoffice in der Ausbildung\nAnna: Ich mache eine Ausbildung im Büro und darf einen Tag pro Woche zu Hause arbeiten. Für mich ist das ideal, ich lerne dort ruhiger als im Großraumbüro.\nBernd: Auszubildende gehören in den Betrieb. Wer zu Hause sitzt, bekommt vieles nicht mit und lernt langsamer.\nCem: Ich finde beides möglich, aber nur, wenn der Ausbilder regelmäßig anruft und Aufgaben erklärt. Ohne Kontakt funktioniert es nicht.\nDoris: Bei uns hat Homeoffice in der Ausbildung nicht geklappt, die Technik war zu alt und die Verbindung ständig schlecht.\nEmre: Ich arbeite lieber im Betrieb, aber für die Prüfungsvorbereitung fände ich zwei Tage zu Hause sinnvoll.",
            "items": [
              {"id":"L4-1","question":"Anna arbeitet gern einen Tag pro Woche zu Hause.","correct":"richtig","explanation_vi":"Anna nói làm ở nhà giúp cô học yên tĩnh hơn."},
              {"id":"L4-2","question":"Bernd ist für Homeoffice in der Ausbildung.","correct":"falsch","explanation_vi":"Bernd cho rằng học viên phải ở tại doanh nghiệp."},
              {"id":"L4-3","question":"Cem hält Homeoffice nur mit gutem Kontakt zum Ausbilder für möglich.","correct":"richtig","explanation_vi":"Ohne Kontakt funktioniert es nicht."},
              {"id":"L4-4","question":"Bei Doris hat Homeoffice wegen der Technik nicht funktioniert.","correct":"richtig","explanation_vi":"die Technik war zu alt und die Verbindung schlecht."},
              {"id":"L4-5","question":"Emre möchte die ganze Woche zu Hause arbeiten.","correct":"falsch","explanation_vi":"Anh chỉ muốn 2 ngày để ôn thi."}
            ]
          },
          {
            "teil": 5,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie die Ordnung der Berufsschule und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc nội quy trường nghề và chọn đáp án đúng",
            "context": "Auszug aus der Schulordnung der Berufsschule Nordstadt\nParagraf 1: Der Unterricht beginnt um 7 Uhr 45. Wer zu spät kommt, meldet sich im Sekretariat.\nParagraf 2: Bei Krankheit informieren Sie die Schule vor Unterrichtsbeginn telefonisch. Eine schriftliche Entschuldigung geben Sie spätestens am dritten Tag ab.\nParagraf 3: Handys bleiben im Unterricht ausgeschaltet. In den Pausen ist die Nutzung erlaubt.\nParagraf 4: Für Prüfungen ist die Anmeldung bis vier Wochen vorher nötig. Wer den Termin ohne Grund verpasst, kann erst im nächsten Halbjahr teilnehmen.\nParagraf 5: In den Werkstätten sind Sicherheitsschuhe Pflicht. Wer keine trägt, darf nicht teilnehmen.",
            "items": [
              {"id":"L5-1","question":"Was macht man, wenn man zu spät kommt?","options":{"A":"Sich im Sekretariat melden","B":"Nach Hause gehen","C":"Direkt in die Klasse gehen"},"correct":"A","explanation_vi":"Đến muộn thì trình diện văn phòng."},
              {"id":"L5-2","question":"Bis wann muss die schriftliche Entschuldigung da sein?","options":{"A":"Am gleichen Tag","B":"Innerhalb von zwei Wochen","C":"Spätestens am dritten Tag"},"correct":"C","explanation_vi":"spätestens am dritten Tag."},
              {"id":"L5-3","question":"Wann darf man das Handy benutzen?","options":{"A":"Im Unterricht","B":"Gar nicht","C":"In den Pausen"},"correct":"C","explanation_vi":"In den Pausen ist die Nutzung erlaubt."},
              {"id":"L5-4","question":"Wie lange vorher meldet man sich für Prüfungen an?","options":{"A":"Vier Wochen","B":"Eine Woche","C":"Am Prüfungstag"},"correct":"A","explanation_vi":"Anmeldung bis vier Wochen vorher."},
              {"id":"L5-5","question":"Was gilt in den Werkstätten?","options":{"A":"Essen ist erlaubt","B":"Sicherheitsschuhe sind Pflicht","C":"Man braucht keine Aufsicht"},"correct":"B","explanation_vi":"Sicherheitsschuhe sind Pflicht."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die kurzen Texte und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Guten Tag, hier ist die Personalabteilung der Firma Sander. Wir laden Sie zum Vorstellungsgespräch am Dienstag um 10 Uhr ein. Bitte bringen Sie Ihre Zeugnisse im Original mit.","question":"Was soll die Person mitbringen?","options":{"A":"Kopien der Zeugnisse","B":"Die Originalzeugnisse","C":"Ein Foto"},"correct":"B","explanation_vi":"Zeugnisse im Original mitbringen."},
              {"id":"H1-2","audio_script":"A: Ich überlege, ob ich die Weiterbildung mache. Sie dauert acht Monate. B: Und wer bezahlt das? A: Die Hälfte der Betrieb, die andere Hälfte ich.","question":"Wer bezahlt die Weiterbildung?","options":{"A":"Nur der Betrieb","B":"Nur die Person selbst","C":"Betrieb und Person je zur Hälfte"},"correct":"C","explanation_vi":"Mỗi bên trả một nửa."},
              {"id":"H1-3","audio_script":"Liebe Studierende, die Bibliothek bleibt in der Prüfungszeit bis 24 Uhr geöffnet. Gruppenräume müssen Sie weiterhin online reservieren.","question":"Was ändert sich in der Prüfungszeit?","options":{"A":"Die Bibliothek ist geschlossen","B":"Gruppenräume sind frei","C":"Die Bibliothek schließt später"},"correct":"C","explanation_vi":"Thư viện mở đến 24 giờ."},
              {"id":"H1-4","audio_script":"A: Wie war dein erster Arbeitstag? B: Anstrengend, aber gut. Am meisten hat mir geholfen, dass mir eine Kollegin alles in Ruhe gezeigt hat.","question":"Was hat der Person geholfen?","options":{"A":"Eine Kollegin hat alles erklärt","B":"Der kurze Arbeitsweg","C":"Die neue Software"},"correct":"A","explanation_vi":"eine Kollegin hat alles in Ruhe gezeigt."},
              {"id":"H1-5","audio_script":"Achtung, eine Information für alle Auszubildenden: Der Praxistag am Freitag beginnt ausnahmsweise erst um 9 Uhr, weil die Werkstatt gereinigt wird.","question":"Warum beginnt der Praxistag später?","options":{"A":"Wegen eines Feiertags","B":"Wegen einer Prüfung","C":"Wegen der Reinigung der Werkstatt"},"correct":"C","explanation_vi":"weil die Werkstatt gereinigt wird."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài nói ở buổi giới thiệu nghề và chọn Richtig hoặc Falsch",
            "audio_script": "Herzlich willkommen zum Informationsabend über die Ausbildung in unserem Krankenhaus. Ich stelle Ihnen kurz den Ablauf vor. Die Ausbildung dauert drei Jahre und verbindet Theorie und Praxis: sechs Wochen Schule, dann sechs Wochen Station. Sie erhalten von Anfang an eine Vergütung, im ersten Jahr rund 1200 Euro brutto. Nachtdienste beginnen erst im zweiten Lehrjahr und immer gemeinsam mit einer erfahrenen Kollegin. Eine Wohnung im Personalhaus können wir leider nicht garantieren, es gibt nur zwölf Zimmer. Bewerben können Sie sich bis zum 31. März, ein Praktikum vorher ist keine Pflicht, aber wir empfehlen es sehr.",
            "items": [
              {"id":"H2-1","question":"Die Ausbildung dauert drei Jahre.","correct":"richtig","explanation_vi":"Die Ausbildung dauert drei Jahre."},
              {"id":"H2-2","question":"Die Auszubildenden bekommen erst im zweiten Jahr Geld.","correct":"falsch","explanation_vi":"Có lương ngay từ đầu, năm đầu khoảng 1200 euro."},
              {"id":"H2-3","question":"Nachtdienste gibt es ab dem zweiten Lehrjahr.","correct":"richtig","explanation_vi":"Nachtdienste beginnen erst im zweiten Lehrjahr."},
              {"id":"H2-4","question":"Alle Auszubildenden bekommen ein Zimmer im Personalhaus.","correct":"falsch","explanation_vi":"Chỉ có 12 phòng, không đảm bảo cho tất cả."},
              {"id":"H2-5","question":"Ein Praktikum vor der Bewerbung ist Pflicht.","correct":"falsch","explanation_vi":"keine Pflicht, aber empfohlen = khuyến khích chứ không bắt buộc."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Lena: Und, wie läuft es im neuen Job? Kaan: Ganz gut, aber die Umstellung war größer als gedacht. Vorher habe ich im Lager gearbeitet, jetzt sitze ich den ganzen Tag am Rechner. Lena: Vermisst du die alte Arbeit? Kaan: Die Bewegung ja, das Heben nicht. Mein Rücken war ständig kaputt. Lena: Und das Team? Kaan: Sehr hilfsbereit, nur mein Chef gibt selten Rückmeldung. Ich weiß oft nicht, ob meine Arbeit gut ist. Lena: Hast du das schon angesprochen? Kaan: Noch nicht, aber nächste Woche habe ich ein Gespräch, da sage ich es. Lena: Gute Idee, sonst ärgerst du dich weiter.",
            "items": [
              {"id":"H3-1","question":"Wo hat Kaan früher gearbeitet?","options":{"A":"Im Büro","B":"Im Lager","C":"In einem Restaurant"},"correct":"B","explanation_vi":"Vorher habe ich im Lager gearbeitet."},
              {"id":"H3-2","question":"Was vermisst Kaan an der alten Arbeit?","options":{"A":"Die Bewegung","B":"Das schwere Heben","C":"Die Arbeitszeiten"},"correct":"A","explanation_vi":"Die Bewegung ja, das Heben nicht."},
              {"id":"H3-3","question":"Wie beschreibt Kaan sein Team?","options":{"A":"Unfreundlich","B":"Zu laut","C":"Hilfsbereit"},"correct":"C","explanation_vi":"Sehr hilfsbereit."},
              {"id":"H3-4","question":"Was stört Kaan an seinem Chef?","options":{"A":"Er kommt zu spät","B":"Er gibt selten Rückmeldung","C":"Er spricht zu leise"},"correct":"B","explanation_vi":"mein Chef gibt selten Rückmeldung."},
              {"id":"H3-5","question":"Was will Kaan tun?","options":{"A":"Sofort kündigen","B":"Das Problem im Gespräch ansprechen","C":"Nichts sagen"},"correct":"B","explanation_vi":"nächste Woche habe ich ein Gespräch, da sage ich es."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Meinungen. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 ý kiến trong buổi thảo luận và ghép với nhận định A–E",
            "context": "A = Diese Person hält praktische Erfahrung für wichtiger als Noten.\nB = Diese Person findet, dass Betriebe mehr für die Betreuung tun müssen.\nC = Diese Person empfiehlt, früh eine Fremdsprache zu lernen.\nD = Diese Person kritisiert die schlechte Bezahlung in manchen Berufen.\nE = Diese Person rät, sich Zeit für die Berufswahl zu nehmen.",
            "audio_script": "Sprecherin 1: Wer im Betrieb schon gearbeitet hat, kommt später viel besser zurecht. Ein Zeugnis mit guten Noten allein sagt wenig.\nSprecher 2: Man sollte nicht mit siebzehn entscheiden müssen, was man vierzig Jahre macht. Ein Jahr Orientierung schadet niemandem.\nSprecherin 3: In der Pflege und im Handwerk wird zu wenig gezahlt, deshalb finden diese Branchen kaum noch Leute.\nSprecher 4: Viele Auszubildende werden ins kalte Wasser geworfen. Die Firmen brauchen feste Ansprechpartner für sie.\nSprecherin 5: Englisch reicht heute oft nicht mehr. Wer noch eine zweite Sprache kann, hat auf dem Arbeitsmarkt klare Vorteile.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 1 coi trọng kinh nghiệm thực tế hơn điểm số."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 2 khuyên dành thời gian chọn nghề."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 3 phê phán lương thấp."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 4 đòi doanh nghiệp kèm cặp tốt hơn."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 5 khuyên học thêm ngoại ngữ."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FORUM_POST",
            "instruction_de": "Schreiben Sie einen Beitrag für ein Online-Forum (circa 80 Wörter).",
            "instruction_vi": "Viết bài đăng diễn đàn ~80 từ, nêu ý kiến và lý do",
            "input_email": "Forum Bildung heute\nFrage der Woche: Sollten Schulen mehr praktische Fächer anbieten und dafür weniger Theorie unterrichten? Schreiben Sie Ihre Meinung.",
            "writing_points": ["Ihre Meinung zum Thema", "Zwei Argumente mit Beispiel", "Was Sie sich für die Schulen wünschen"]
          },
          {
            "teil": 2,
            "type": "FORMAL_EMAIL",
            "instruction_de": "Schreiben Sie eine formelle E-Mail (circa 80 Wörter).",
            "instruction_vi": "Viết email trang trọng ~80 từ theo tình huống sau",
            "input_email": "Situation: Sie haben sich für einen Weiterbildungskurs angemeldet, können aber am ersten Termin nicht teilnehmen, weil Sie an diesem Tag arbeiten müssen. Schreiben Sie an die Kursleitung, Frau Dr. Brandt.",
            "writing_points": ["Grund für Ihr Schreiben und Ihre Anmeldung nennen", "Erklären, warum Sie am ersten Termin fehlen", "Um Materialien oder einen Ersatztermin bitten"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lập kế hoạch cho tình huống sau",
            "prompt": "Situation: Ihre Klasse organisiert einen Berufsinformationstag für jüngere Schüler.\nSprechen Sie über: Wann und wo? Welche Berufe vorstellen? Wen einladen? Wie informieren? Wer macht was?\nMachen Sie Vorschläge, reagieren Sie auf Ihren Partner und treffen Sie gemeinsam Entscheidungen."
          },
          {
            "teil": 2,
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie eine kurze Präsentation (circa 3 Minuten).",
            "instruction_vi": "Thuyết trình ngắn ~3 phút theo dàn ý",
            "prompt": "Thema: Lernen mit digitalen Medien\nGliederung:\n1. Ihre persönliche Erfahrung mit Lern-Apps oder Online-Kursen\n2. Die Situation in Ihrem Heimatland\n3. Vor- und Nachteile\n4. Ihre Meinung und ein Beispiel\n5. Abschluss und Dank an die Zuhörer"
          },
          {
            "teil": 3,
            "type": "FEEDBACK",
            "instruction_de": "Sprechen Sie über die Präsentation Ihres Partners.",
            "instruction_vi": "Phản hồi phần trình bày của bạn thi và trả lời câu hỏi",
            "prompt": "Aufgabe:\n1. Geben Sie Ihrem Partner eine kurze Rückmeldung zur Präsentation.\n2. Stellen Sie eine Frage zum Inhalt.\n3. Beantworten Sie die Frage Ihres Partners zu Ihrer eigenen Präsentation."
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'B1', 'GOETHE',
  'Goethe Zertifikat B1 – Set 4',
  'Đề thi thử Goethe B1 – Chủ đề: Môi trường, tiêu dùng và tiền bạc',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie den Text. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài viết và chọn Richtig hoặc Falsch",
            "context": "Erfahrungsbericht von Katrin: Ein Jahr ohne neue Kleidung\nLetztes Jahr habe ich mir vorgenommen, zwölf Monate lang nichts Neues zum Anziehen zu kaufen. Der Grund war nicht nur das Geld, sondern vor allem die Umwelt: Für ein einziges T-Shirt werden mehr als 2000 Liter Wasser gebraucht. Am schwersten waren die ersten Wochen, weil ich früher fast jeden Samstag durch die Läden gebummelt bin. Nach zwei Monaten hat sich das gelegt. Wenn wirklich etwas kaputt war, habe ich es reparieren lassen oder auf dem Flohmarkt gesucht. Einmal habe ich eine Ausnahme gemacht und Laufschuhe gekauft, die alten waren nach 900 Kilometern durch. Insgesamt habe ich rund 700 Euro gespart. Heute kaufe ich wieder, aber weniger und bewusster: lieber ein teures Teil, das zehn Jahre hält, als fünf billige für eine Saison.",
            "items": [
              {"id":"L1-1","question":"Katrin hat ein Jahr lang keine neue Kleidung gekauft.","correct":"richtig","explanation_vi":"Cô đặt mục tiêu 12 tháng không mua đồ mới."},
              {"id":"L1-2","question":"Der wichtigste Grund war für sie das Geld.","correct":"falsch","explanation_vi":"nicht nur das Geld, sondern vor allem die Umwelt."},
              {"id":"L1-3","question":"Die ersten Wochen waren für sie schwierig.","correct":"richtig","explanation_vi":"Am schwersten waren die ersten Wochen."},
              {"id":"L1-4","question":"Sie hat während des Jahres keine einzige Ausnahme gemacht.","correct":"falsch","explanation_vi":"Cô đã mua giày chạy mới khi đôi cũ hỏng."},
              {"id":"L1-5","question":"Heute kauft sie bewusster ein.","correct":"richtig","explanation_vi":"weniger und bewusster."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Angebote A bis E. Welches Angebot passt zu welcher Person?",
            "instruction_vi": "Đọc 5 dịch vụ A–E và chọn dịch vụ hợp với từng người",
            "context": "A = Repair-Café Nordlicht: samstags 14 bis 18 Uhr, ehrenamtliche Helfer reparieren Elektrogeräte, Material zum Selbstkostenpreis.\nB = Solidarische Landwirtschaft Hofgrün: feste Monatsgebühr, wöchentlich eine Kiste Gemüse aus der Region.\nC = Beratungsstelle Geld und Schulden: kostenlose Beratung bei Zahlungsproblemen, Termine auch abends.\nD = Verleihladen Teilen statt kaufen: Werkzeuge, Bohrmaschinen und Campingzubehör für ein bis sieben Tage.\nE = Energieberatung der Stadtwerke: kostenloser Termin zu Hause, Tipps zum Strom- und Heizkostensparen.",
            "items": [
              {"id":"L2-1","person":"Herr Ky braucht nur einmal eine Bohrmaschine und will keine kaufen.","question":"Welches Angebot passt?","correct":"D","explanation_vi":"D cho mượn dụng cụ theo ngày."},
              {"id":"L2-2","person":"Frau Weber kann ihre Rechnungen nicht mehr bezahlen und braucht Rat.","question":"Welches Angebot passt?","correct":"C","explanation_vi":"C tư vấn nợ nần miễn phí."},
              {"id":"L2-3","person":"Herr Ott findet seine Stromrechnung zu hoch und weiß nicht warum.","question":"Welches Angebot passt?","correct":"E","explanation_vi":"E tư vấn tiết kiệm điện, đến tận nhà."},
              {"id":"L2-4","person":"Frau Duyen hat einen defekten Toaster und möchte ihn nicht wegwerfen.","question":"Welches Angebot passt?","correct":"A","explanation_vi":"A sửa đồ điện miễn phí công."},
              {"id":"L2-5","person":"Familie Braun möchte regelmäßig Gemüse von Bauernhöfen aus der Nähe.","question":"Welches Angebot passt?","correct":"B","explanation_vi":"B giao rau vùng lân cận hằng tuần."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Artikel und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài báo và chọn đáp án đúng",
            "context": "Zeitungsartikel: Wohin mit dem Elektroschrott?\nJedes Jahr fallen in Deutschland etwa zwei Millionen Tonnen Elektroschrott an, das sind rund 24 Kilogramm pro Person. Vieles davon landet im Hausmüll, obwohl das verboten ist. Alte Geräte enthalten wertvolle Rohstoffe wie Kupfer und Gold, aber auch giftige Stoffe. Wer ein neues Gerät kauft, kann das alte im Geschäft abgeben, große Händler müssen es kostenlos zurücknehmen. Kleine Geräte bis 25 Zentimeter nehmen viele Läden sogar ohne Neukauf an. Trotzdem wird nur etwa die Hälfte richtig entsorgt. Fachleute fordern deshalb einfachere Wege, zum Beispiel Sammelboxen in Supermärkten. Am besten für die Umwelt ist aber weiterhin, Geräte lange zu nutzen und reparieren zu lassen.",
            "items": [
              {"id":"L3-1","question":"Wie viel Elektroschrott entsteht pro Person und Jahr?","options":{"A":"Etwa 2 Kilogramm","B":"Etwa 240 Kilogramm","C":"Etwa 24 Kilogramm"},"correct":"C","explanation_vi":"rund 24 Kilogramm pro Person."},
              {"id":"L3-2","question":"Was steht im Text über den Hausmüll?","options":{"A":"Elektroschrott darf hinein","B":"Elektroschrott gehört nicht hinein","C":"Es gibt keine Regeln"},"correct":"B","explanation_vi":"Vứt vào rác sinh hoạt là bị cấm."},
              {"id":"L3-3","question":"Was müssen große Händler tun?","options":{"A":"Nichts","B":"Für alte Geräte bezahlen","C":"Alte Geräte kostenlos zurücknehmen"},"correct":"C","explanation_vi":"große Händler müssen es kostenlos zurücknehmen."},
              {"id":"L3-4","question":"Wie viel Elektroschrott wird richtig entsorgt?","options":{"A":"Etwa die Hälfte","B":"Fast alles","C":"Fast nichts"},"correct":"A","explanation_vi":"nur etwa die Hälfte."},
              {"id":"L3-5","question":"Was ist laut Text am besten für die Umwelt?","options":{"A":"Geräte lange nutzen und reparieren","B":"Jedes Jahr neue Geräte kaufen","C":"Geräte verbrennen"},"correct":"A","explanation_vi":"Geräte lange zu nutzen und reparieren zu lassen."}
            ]
          },
          {
            "teil": 4,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Meinungen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến bạn đọc và chọn Richtig hoặc Falsch",
            "context": "Leserbriefe: Soll das Autofahren in der Innenstadt teurer werden?\nFatih: Ich bin dafür. Wer mit dem Auto in die Stadt fährt, soll zahlen. Mit dem Geld kann man Busse und Bahnen billiger machen.\nGabi: Für mich ist das ungerecht. Ich arbeite im Schichtdienst, nachts fährt kein Bus. Ohne Auto komme ich nicht zur Arbeit.\nHannes: Ich bin unsicher. Die Idee ist gut, aber erst muss der Nahverkehr besser werden, sonst trifft es die Falschen.\nIrina: Ich lebe ohne Auto und finde die Luft heute schon viel besser als früher. Höhere Preise wären der nächste richtige Schritt.\nJonas: Statt neuer Gebühren sollte die Stadt lieber mehr Radwege bauen. Verbote und Kosten bringen wenig.",
            "items": [
              {"id":"L4-1","question":"Fatih möchte mit dem Geld den Nahverkehr günstiger machen.","correct":"richtig","explanation_vi":"Anh muốn dùng tiền thu được để giảm giá vé công cộng."},
              {"id":"L4-2","question":"Gabi kann ihre Arbeit gut mit dem Bus erreichen.","correct":"falsch","explanation_vi":"Cô làm ca đêm, ban đêm không có xe buýt."},
              {"id":"L4-3","question":"Hannes lehnt die Idee vollständig ab.","correct":"falsch","explanation_vi":"Anh thấy ý tưởng tốt nhưng phải cải thiện giao thông công cộng trước."},
              {"id":"L4-4","question":"Irina findet die Luft in der Stadt besser als früher.","correct":"richtig","explanation_vi":"finde die Luft heute schon viel besser als früher."},
              {"id":"L4-5","question":"Jonas schlägt mehr Radwege vor.","correct":"richtig","explanation_vi":"lieber mehr Radwege bauen."}
            ]
          },
          {
            "teil": 5,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie die Informationen und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc hướng dẫn của thành phố và chọn đáp án đúng",
            "context": "Informationsblatt der Stadt: Müll richtig trennen\nPunkt 1: In die gelbe Tonne kommen Verpackungen aus Plastik und Metall, aber keine Elektrogeräte.\nPunkt 2: Papier und Kartons gehören in die blaue Tonne. Beschmutztes Papier, zum Beispiel Pizzakartons mit Fett, gehört in den Restmüll.\nPunkt 3: Glas bringen Sie bitte zu den Containern, sortiert nach Weiß, Grün und Braun. Einwurf nur von 7 bis 20 Uhr.\nPunkt 4: Gartenabfälle können Sie kostenlos zum Wertstoffhof bringen, maximal ein Kubikmeter pro Woche.\nPunkt 5: Sperrmüll wird nach Anmeldung abgeholt, die Wartezeit beträgt zurzeit etwa drei Wochen.",
            "items": [
              {"id":"L5-1","question":"Was gehört nicht in die gelbe Tonne?","options":{"A":"Elektrogeräte","B":"Metallverpackungen","C":"Plastikverpackungen"},"correct":"A","explanation_vi":"keine Elektrogeräte."},
              {"id":"L5-2","question":"Wohin kommt ein fettiger Pizzakarton?","options":{"A":"In die blaue Tonne","B":"In den Restmüll","C":"Zum Glascontainer"},"correct":"B","explanation_vi":"Giấy bẩn thuộc rác thải còn lại."},
              {"id":"L5-3","question":"Wann darf man Glas einwerfen?","options":{"A":"Rund um die Uhr","B":"Nur sonntags","C":"Von 7 bis 20 Uhr"},"correct":"C","explanation_vi":"Einwurf nur von 7 bis 20 Uhr."},
              {"id":"L5-4","question":"Wie viel Gartenabfall darf man pro Woche kostenlos bringen?","options":{"A":"Unbegrenzt","B":"Zehn Kubikmeter","C":"Einen Kubikmeter"},"correct":"C","explanation_vi":"maximal ein Kubikmeter pro Woche."},
              {"id":"L5-5","question":"Wie lange wartet man zurzeit auf die Sperrmüllabholung?","options":{"A":"Etwa drei Tage","B":"Etwa drei Monate","C":"Etwa drei Wochen"},"correct":"C","explanation_vi":"die Wartezeit beträgt etwa drei Wochen."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die kurzen Texte und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Achtung, eine Durchsage für unsere Kunden: Ab nächstem Monat geben wir keine Plastiktüten mehr aus. Stofftaschen erhalten Sie an der Kasse für zwei Euro.","question":"Was ändert sich im Geschäft?","options":{"A":"Es gibt keine Plastiktüten mehr","B":"Alle Taschen sind gratis","C":"Das Geschäft schließt"},"correct":"A","explanation_vi":"keine Plastiktüten mehr."},
              {"id":"H1-2","audio_script":"A: Was hast du für den alten Kühlschrank bezahlt? B: Nichts, ich habe ihn gebraucht bekommen. Nur der Transport hat 40 Euro gekostet.","question":"Was hat die Person bezahlt?","options":{"A":"400 Euro für den Kühlschrank","B":"40 Euro für den Transport","C":"Gar nichts"},"correct":"B","explanation_vi":"Chỉ tốn 40 euro tiền vận chuyển."},
              {"id":"H1-3","audio_script":"Liebe Fahrgäste, wegen einer Demonstration für den Klimaschutz fahren die Linien 3 und 7 heute Nachmittag über die Ringstraße.","question":"Warum ändern die Linien ihren Weg?","options":{"A":"Wegen einer Demonstration","B":"Wegen eines Unfalls","C":"Wegen Schnee"},"correct":"A","explanation_vi":"wegen einer Demonstration für den Klimaschutz."},
              {"id":"H1-4","audio_script":"A: Lohnt sich die Solaranlage auf dem Dach? B: Bei uns schon. Nach sieben Jahren hatten wir die Kosten wieder drin, seitdem sparen wir jeden Monat.","question":"Was sagt die zweite Person?","options":{"A":"Die Anlage hat sich nach sieben Jahren gerechnet","B":"Die Anlage war ein Fehler","C":"Die Anlage kostet nichts"},"correct":"A","explanation_vi":"Sau 7 năm thu hồi vốn."},
              {"id":"H1-5","audio_script":"Guten Tag, hier ist der Wertstoffhof. Ihre Anmeldung für den Sperrmüll ist angekommen. Wir holen die Möbel am Donnerstag zwischen 7 und 12 Uhr ab.","question":"Wann wird der Sperrmüll abgeholt?","options":{"A":"Am Donnerstagvormittag","B":"Am Donnerstagabend","C":"Am Freitag"},"correct":"A","explanation_vi":"Donnerstag zwischen 7 und 12 Uhr = buổi sáng."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Führung. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết minh trong nhà máy tái chế và chọn Richtig hoặc Falsch",
            "audio_script": "Schön, dass Sie heute bei unserer Führung durch die Recyclinganlage dabei sind. Wir verarbeiten hier pro Tag etwa 300 Tonnen Abfall. Der größte Teil kommt aus privaten Haushalten der Region. Zuerst wird der Müll auf ein Band gelegt, dann trennen Maschinen Metall mit Magneten heraus. Kunststoff wird mit Kameras nach Farbe und Art sortiert, das schafft ein Mensch nicht so schnell. Etwa fünfzehn Prozent können wir leider nicht verwerten, weil der Abfall falsch getrennt wurde. Diese Reste werden verbrannt und liefern immerhin Fernwärme für rund 4000 Haushalte. Am Ende der Führung zeigen wir Ihnen noch, wie aus alten Flaschen neue Verpackungen entstehen. Bitte bleiben Sie immer hinter der gelben Linie.",
            "items": [
              {"id":"H2-1","question":"Die Anlage verarbeitet täglich etwa 300 Tonnen Abfall.","correct":"richtig","explanation_vi":"pro Tag etwa 300 Tonnen."},
              {"id":"H2-2","question":"Der Kunststoff wird von Hand sortiert.","correct":"falsch","explanation_vi":"Máy dùng camera phân loại, người không làm nhanh bằng."},
              {"id":"H2-3","question":"Etwa 15 Prozent des Abfalls können nicht verwertet werden.","correct":"richtig","explanation_vi":"Etwa fünfzehn Prozent können wir nicht verwerten."},
              {"id":"H2-4","question":"Die Reste werden auf einer Deponie gelagert.","correct":"falsch","explanation_vi":"Phần còn lại được đốt để cấp nhiệt."},
              {"id":"H2-5","question":"Die Besucher sollen hinter der gelben Linie bleiben.","correct":"richtig","explanation_vi":"Bitte bleiben Sie hinter der gelben Linie."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Ben: Du hast dein Auto verkauft? Wirklich? Sara: Ja, seit April fahre ich nur noch mit Rad und Bahn. Ben: Und wie klappt das mit dem Einkauf? Sara: Besser als gedacht. Ich habe einen Anhänger fürs Rad, für große Sachen nutze ich Carsharing. Ben: Was kostet dich das im Monat? Sara: Etwa 60 Euro für Carsharing und 49 für das Ticket. Vorher waren es mit Versicherung und Reparaturen weit über 300. Ben: Und im Winter? Sara: Das ist ehrlich gesagt der schwierigste Teil. Bei Eis nehme ich die Bahn, dann dauert alles länger. Ben: Würdest du wieder ein Auto kaufen? Sara: Nur wenn ich aufs Land ziehe.",
            "items": [
              {"id":"H3-1","question":"Seit wann fährt Sara ohne eigenes Auto?","options":{"A":"Seit einem Jahr","B":"Seit April","C":"Seit zwei Wochen"},"correct":"B","explanation_vi":"seit April."},
              {"id":"H3-2","question":"Wie transportiert sie große Einkäufe?","options":{"A":"Mit dem Taxi","B":"Gar nicht","C":"Mit Carsharing"},"correct":"C","explanation_vi":"für große Sachen nutze ich Carsharing."},
              {"id":"H3-3","question":"Wie viel zahlte sie vorher ungefähr im Monat?","options":{"A":"Unter 100 Euro","B":"Über 300 Euro","C":"Etwa 200 Euro"},"correct":"B","explanation_vi":"weit über 300 Euro."},
              {"id":"H3-4","question":"Was findet sie am schwierigsten?","options":{"A":"Den Sommer","B":"Den Winter","C":"Das Einkaufen"},"correct":"B","explanation_vi":"Bei Eis nehme ich die Bahn, đó là phần khó nhất."},
              {"id":"H3-5","question":"Wann würde sie wieder ein Auto kaufen?","options":{"A":"Nie","B":"Nächstes Jahr","C":"Wenn sie aufs Land zieht"},"correct":"C","explanation_vi":"Nur wenn ich aufs Land ziehe."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Meinungen. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 ý kiến và ghép với nhận định A–E",
            "context": "A = Diese Person kauft fast nur gebrauchte Sachen.\nB = Diese Person findet umweltfreundliche Produkte zu teuer.\nC = Diese Person achtet vor allem auf regionale Lebensmittel.\nD = Diese Person spart bewusst Strom und Wasser.\nE = Diese Person meint, dass vor allem die Politik handeln muss.",
            "audio_script": "Sprecher 1: Fast alles bei uns kommt vom Flohmarkt oder aus Online-Börsen, neu kaufe ich höchstens Unterwäsche.\nSprecherin 2: Ich koche mit dem, was auf den Feldern in der Nähe wächst, Erdbeeren im Dezember kommen mir nicht in den Korb.\nSprecher 3: Ich dusche kurz, schalte Geräte ganz aus und habe überall LED. Die Rechnung ist deutlich kleiner geworden.\nSprecherin 4: Solange die Bio-Sachen doppelt so viel kosten, kann ich das mit drei Kindern nicht machen.\nSprecher 5: Einzelne können wenig ändern. Es braucht Gesetze, sonst bleibt alles wie es ist.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 1 mua đồ cũ là chính."},
              {"id":"H4-2","person":"Sprecherin 2","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 2 chọn thực phẩm địa phương, theo mùa."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 3 tiết kiệm điện nước."},
              {"id":"H4-4","person":"Sprecherin 4","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 4 thấy đồ hữu cơ quá đắt."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 5 cho rằng cần luật pháp."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FORUM_POST",
            "instruction_de": "Schreiben Sie einen Beitrag für ein Online-Forum (circa 80 Wörter).",
            "instruction_vi": "Viết bài đăng diễn đàn ~80 từ",
            "input_email": "Forum Stadtleben\nFrage der Woche: Sollen Supermärkte Lebensmittel, die kurz vor dem Ablaufdatum stehen, kostenlos abgeben? Schreiben Sie Ihre Meinung.",
            "writing_points": ["Ihre Meinung zur Frage", "Zwei Argumente mit Beispiel", "Ein Vorschlag, wie es funktionieren könnte"]
          },
          {
            "teil": 2,
            "type": "FORMAL_EMAIL",
            "instruction_de": "Schreiben Sie eine formelle E-Mail (circa 80 Wörter).",
            "instruction_vi": "Viết email trang trọng ~80 từ theo tình huống sau",
            "input_email": "Situation: Sie haben online eine Kaffeemaschine bestellt. Das Gerät ist beschädigt angekommen und funktioniert nicht. Schreiben Sie an den Kundenservice der Firma Elektro Blum.",
            "writing_points": ["Bestellung und Problem beschreiben", "Sagen, was Sie erwarten (Austausch oder Geld zurück)", "Um eine Antwort bis zu einem bestimmten Datum bitten"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lập kế hoạch cho tình huống sau",
            "prompt": "Situation: Ihr Wohnhaus möchte einen Tauschtag organisieren, an dem Nachbarn Kleidung und Bücher tauschen.\nSprechen Sie über: Wann und wo? Wie informieren Sie die Nachbarn? Was passiert mit den Resten? Wer hilft beim Aufbau? Brauchen Sie Geld dafür?\nMachen Sie Vorschläge und einigen Sie sich."
          },
          {
            "teil": 2,
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie eine kurze Präsentation (circa 3 Minuten).",
            "instruction_vi": "Thuyết trình ngắn ~3 phút theo dàn ý",
            "prompt": "Thema: Einkaufen früher und heute\nGliederung:\n1. Wie Sie persönlich einkaufen\n2. Wie es in Ihrem Heimatland üblich ist\n3. Vorteile und Nachteile des Online-Einkaufs\n4. Ihre Meinung mit einem Beispiel\n5. Abschluss und Dank"
          },
          {
            "teil": 3,
            "type": "FEEDBACK",
            "instruction_de": "Sprechen Sie über die Präsentation Ihres Partners.",
            "instruction_vi": "Phản hồi phần trình bày của bạn thi và trả lời câu hỏi",
            "prompt": "Aufgabe:\n1. Sagen Sie Ihrem Partner, was Ihnen an der Präsentation gefallen hat.\n2. Stellen Sie eine Frage zum Inhalt.\n3. Antworten Sie auf die Frage Ihres Partners zu Ihrer Präsentation."
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
