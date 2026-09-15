-- V308: Năm đề thi thử A2 (Set 1–5) — trình độ A2 trước đây KHÔNG có đề nào.
-- Cấu trúc theo Goethe-Zertifikat A2: Lesen 4 Teil (20 câu) · Hören 4 Teil (20 câu) ·
-- Schreiben (form + thư ~40 từ) · Sprechen 3 Teil. Mỗi phần 25 điểm.

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'A2', 'GOETHE',
  'Goethe-Zertifikat A2 – Set 1',
  'Đề thi thử Goethe A2 – Chủ đề: Công việc và sinh hoạt hằng ngày',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die E-Mail. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc email và chọn Richtig hoặc Falsch",
            "context": "E-Mail von Sabine an ihre Freundin Mai:\nLiebe Mai, endlich habe ich eine neue Stelle gefunden! Ich arbeite jetzt in einem kleinen Büro in der Nähe vom Hauptbahnhof. Die Arbeit beginnt um acht Uhr, aber freitags darf ich schon um 14 Uhr nach Hause gehen. Meine Kolleginnen und Kollegen sind sehr nett. Nur der Weg ist lang: Ich fahre jeden Tag 40 Minuten mit der S-Bahn. Am Anfang war alles neu und ich war abends immer müde, jetzt kenne ich meine Aufgaben besser. Nächsten Monat mache ich einen Computerkurs, die Firma bezahlt ihn. Wie läuft es bei dir im Restaurant? Liebe Grüße, Sabine",
            "items": [
              {"id":"L1-1","question":"Sabine hat eine neue Arbeitsstelle gefunden.","correct":"richtig","explanation_vi":"Câu đầu email: endlich habe ich eine neue Stelle gefunden."},
              {"id":"L1-2","question":"Sabine arbeitet an allen Tagen bis 18 Uhr.","correct":"falsch","explanation_vi":"Thứ Sáu Sabine được về từ 14 giờ."},
              {"id":"L1-3","question":"Der Weg zur Arbeit dauert etwa 40 Minuten.","correct":"richtig","explanation_vi":"jeden Tag 40 Minuten mit der S-Bahn."},
              {"id":"L1-4","question":"Sabine findet ihre Kollegen unfreundlich.","correct":"falsch","explanation_vi":"Sabine viết: die Kolleginnen und Kollegen sind sehr nett."},
              {"id":"L1-5","question":"Sabine muss den Computerkurs selbst bezahlen.","correct":"falsch","explanation_vi":"die Firma bezahlt ihn = công ty trả tiền khoá học."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 tin tuyển dụng A–E và chọn tin hợp với từng người",
            "context": "A = Café Morgenrot sucht Aushilfe für den Frühdienst, 6 bis 11 Uhr, auch ohne Erfahrung.\nB = Pflegeheim Sonnenhof sucht Betreuungskraft, Schichtdienst, Deutsch mindestens B1.\nC = Lager Logistik West sucht Mitarbeiter für die Nachtschicht, Führerschein nötig.\nD = Sprachschule Aktiv sucht Nachhilfelehrer für Mathematik, zwei Nachmittage pro Woche.\nE = Hotel Elbblick sucht Reinigungskraft, Teilzeit am Vormittag, Wochenende frei.",
            "items": [
              {"id":"L2-1","person":"Herr Duc hat einen Führerschein und möchte nachts arbeiten.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C là ca đêm và cần bằng lái."},
              {"id":"L2-2","person":"Frau Hoa studiert und kann nur nachmittags arbeiten. Sie ist gut in Mathe.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D dạy kèm Toán hai buổi chiều mỗi tuần."},
              {"id":"L2-3","person":"Frau Petrova sucht Arbeit am Vormittag und braucht das Wochenende für die Familie.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E làm buổi sáng, cuối tuần nghỉ."},
              {"id":"L2-4","person":"Ali steht gern sehr früh auf und hat noch keine Berufserfahrung.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"A làm ca sáng sớm, không cần kinh nghiệm."},
              {"id":"L2-5","person":"Frau Nguyen hat das Zertifikat B1 und möchte mit älteren Menschen arbeiten.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"B ở viện dưỡng lão, yêu cầu tiếng Đức từ B1."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die kurzen Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các thông báo ngắn nơi làm việc và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Aushang: Die Betriebsversammlung findet am Donnerstag um 16 Uhr im Raum 210 statt. Teilnahme für alle Mitarbeiter.","question":"Die Versammlung ist am Donnerstagnachmittag.","correct":"richtig","explanation_vi":"16 giờ thứ Năm là buổi chiều."},
              {"id":"L3-2","text":"Notiz an der Kaffeemaschine: Die Maschine ist defekt. Bitte den Automaten im zweiten Stock benutzen.","question":"Die Kaffeemaschine funktioniert wieder.","correct":"falsch","explanation_vi":"defekt = hỏng, phải dùng máy ở tầng 2."},
              {"id":"L3-3","text":"E-Mail der Personalabteilung: Bitte geben Sie Ihren Urlaubsantrag bis zum 15. Mai ab. Später eingehende Anträge werden nicht bearbeitet.","question":"Nach dem 15. Mai wird der Antrag noch bearbeitet.","correct":"falsch","explanation_vi":"Đơn nộp muộn sẽ không được xử lý."},
              {"id":"L3-4","text":"Schild in der Kantine: Warmes Essen gibt es von 11 Uhr 30 bis 14 Uhr. Danach nur noch Salat und Suppe.","question":"Um 15 Uhr bekommt man kein warmes Essen mehr.","correct":"richtig","explanation_vi":"Sau 14 giờ chỉ còn salad và súp."},
              {"id":"L3-5","text":"Information: Neue Mitarbeiter bekommen den Schlüssel für das Büro am ersten Arbeitstag beim Empfang.","question":"Den Schlüssel bekommt man beim Empfang.","correct":"richtig","explanation_vi":"beim Empfang = ở quầy lễ tân."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Zeitungstext: Arbeiten im Homeoffice\nSeit einigen Jahren arbeiten viele Menschen in Deutschland auch zu Hause. Besonders in Büroberufen ist das möglich. Eine Umfrage zeigt: Zwei von drei Beschäftigten möchten mindestens einen Tag pro Woche zu Hause arbeiten. Sie sparen so Zeit für den Weg und können ruhiger arbeiten. Aber es gibt auch Probleme. Viele vermissen den Kontakt zu den Kollegen, und manche Wohnungen sind zu klein für einen Arbeitsplatz. Firmen berichten, dass Teams am besten funktionieren, wenn sich alle mindestens einmal pro Woche im Büro treffen.",
            "items": [
              {"id":"L4-1","question":"Worum geht es in dem Text?","options":{"A":"Um Urlaub im Ausland","B":"Um neue Büromöbel","C":"Um Arbeit zu Hause"},"correct":"C","explanation_vi":"Cả bài nói về làm việc tại nhà (Homeoffice)."},
              {"id":"L4-2","question":"Wie viele Beschäftigte möchten zu Hause arbeiten?","options":{"A":"Einer von drei","B":"Zwei von drei","C":"Alle"},"correct":"B","explanation_vi":"Zwei von drei Beschäftigten = hai trong ba người."},
              {"id":"L4-3","question":"Welchen Vorteil nennt der Text?","options":{"A":"Man spart Zeit für den Weg","B":"Man verdient mehr Geld","C":"Man bekommt mehr Urlaub"},"correct":"A","explanation_vi":"Sie sparen so Zeit für den Weg."},
              {"id":"L4-4","question":"Welches Problem wird genannt?","options":{"A":"Die Kollegen fehlen","B":"Der Computer ist zu langsam","C":"Die Arbeit ist zu leicht"},"correct":"A","explanation_vi":"Viele vermissen den Kontakt zu den Kollegen."},
              {"id":"L4-5","question":"Was empfehlen die Firmen?","options":{"A":"Nie ins Büro kommen","B":"Jeden Tag ins Büro kommen","C":"Sich einmal pro Woche im Büro treffen"},"correct":"C","explanation_vi":"mindestens einmal pro Woche im Büro treffen."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Herr Schmidt, können Sie am Freitag die Schicht von Frau Klein übernehmen? B: Am Freitag habe ich schon einen Arzttermin, aber am Samstag geht es.","question":"Wann kann Herr Schmidt arbeiten?","options":{"A":"Am Freitag","B":"Gar nicht","C":"Am Samstag"},"correct":"C","explanation_vi":"aber am Samstag geht es = thứ Bảy thì được."},
              {"id":"H1-2","audio_script":"A: Wie komme ich zur Firma Berger? B: Nehmen Sie die Linie 4 bis Marktplatz, dann sind es noch fünf Minuten zu Fuß.","question":"Wie kommt man zur Firma Berger?","options":{"A":"Nur zu Fuß","B":"Mit der Linie 4 und dann zu Fuß","C":"Mit dem Taxi"},"correct":"B","explanation_vi":"Đi tuyến 4 rồi đi bộ 5 phút."},
              {"id":"H1-3","audio_script":"A: Ich brauche für morgen noch die Unterschrift vom Chef. B: Der Chef ist bis Mittwoch auf einer Messe. Frau Berg kann auch unterschreiben.","question":"Wer kann unterschreiben?","options":{"A":"Frau Berg","B":"Niemand","C":"Der Chef"},"correct":"A","explanation_vi":"Sếp đi hội chợ, bà Berg ký thay được."},
              {"id":"H1-4","audio_script":"A: Wann ist die Mittagspause bei euch? B: Von zwölf bis halb eins, aber im Sommer machen wir eine Stunde Pause.","question":"Wie lange dauert die Pause normalerweise?","options":{"A":"Zwei Stunden","B":"Eine Stunde","C":"Eine halbe Stunde"},"correct":"C","explanation_vi":"Von zwölf bis halb eins = 30 phút."},
              {"id":"H1-5","audio_script":"A: Hast du das Formular für die Krankenkasse schon abgegeben? B: Nein, ich schicke es heute Abend per Post.","question":"Wie schickt die Person das Formular?","options":{"A":"Per Post","B":"Per E-Mail","C":"Sie bringt es persönlich"},"correct":"A","explanation_vi":"per Post = gửi qua bưu điện."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Ansage. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo nội bộ công ty rồi chọn Richtig hoặc Falsch",
            "audio_script": "Guten Morgen, liebe Kolleginnen und Kollegen. Eine wichtige Information für diese Woche: Am Mittwoch kommt eine Firma und repariert die Heizung. Deshalb bleibt das Großraumbüro im Erdgeschoss den ganzen Tag geschlossen. Bitte arbeiten Sie an diesem Tag zu Hause oder im Besprechungsraum im dritten Stock. Die Kantine ist normal geöffnet. Am Donnerstag gibt es um 15 Uhr eine kurze Schulung zum neuen Computerprogramm, die Teilnahme ist freiwillig. Bitte melden Sie sich bis Dienstag bei Frau Hoffmann an. Vielen Dank.",
            "items": [
              {"id":"H2-1","question":"Am Mittwoch wird die Heizung repariert.","correct":"richtig","explanation_vi":"Thông báo nói thợ đến sửa lò sưởi thứ Tư."},
              {"id":"H2-2","question":"Das Großraumbüro ist am Mittwoch nur am Vormittag geschlossen.","correct":"falsch","explanation_vi":"den ganzen Tag geschlossen = đóng cả ngày."},
              {"id":"H2-3","question":"Die Kantine bleibt am Mittwoch geschlossen.","correct":"falsch","explanation_vi":"Die Kantine ist normal geöffnet."},
              {"id":"H2-4","question":"Die Schulung am Donnerstag ist freiwillig.","correct":"richtig","explanation_vi":"die Teilnahme ist freiwillig = tự nguyện."},
              {"id":"H2-5","question":"Man soll sich bei Frau Hoffmann anmelden.","correct":"richtig","explanation_vi":"melden Sie sich bis Dienstag bei Frau Hoffmann an."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc phỏng vấn rồi chọn đáp án đúng",
            "audio_script": "Reporterin: Herr Tran, Sie arbeiten seit zwei Jahren als Koch in Hamburg. Wie war der Anfang? Herr Tran: Am Anfang war die Sprache das größte Problem. In der Küche geht alles schnell und ich habe nicht alles verstanden. Reporterin: Und heute? Herr Tran: Heute leite ich ein kleines Team von vier Personen. Ich lerne immer noch, aber die Kollegen helfen mir. Reporterin: Was gefällt Ihnen am besten? Herr Tran: Dass die Gäste zufrieden sind. Schwierig sind nur die Arbeitszeiten am Wochenende. Reporterin: Was raten Sie anderen? Herr Tran: Einen Sprachkurs machen, bevor man anfängt. Das spart viel Stress.",
            "items": [
              {"id":"H3-1","question":"Wie lange arbeitet Herr Tran schon in Hamburg?","options":{"A":"Seit einem Jahr","B":"Seit zwei Jahren","C":"Seit vier Jahren"},"correct":"B","explanation_vi":"seit zwei Jahren als Koch."},
              {"id":"H3-2","question":"Was war am Anfang schwierig?","options":{"A":"Die Sprache","B":"Der Weg zur Arbeit","C":"Das Geld"},"correct":"A","explanation_vi":"die Sprache war das größte Problem."},
              {"id":"H3-3","question":"Was macht Herr Tran heute?","options":{"A":"Er lernt noch in der Schule","B":"Er leitet ein kleines Team","C":"Er sucht eine neue Stelle"},"correct":"B","explanation_vi":"Heute leite ich ein kleines Team von vier Personen."},
              {"id":"H3-4","question":"Was findet er schwierig?","options":{"A":"Die Arbeit am Wochenende","B":"Die Kollegen","C":"Die Gäste"},"correct":"A","explanation_vi":"Schwierig sind die Arbeitszeiten am Wochenende."},
              {"id":"H3-5","question":"Was rät Herr Tran anderen Menschen?","options":{"A":"In einer anderen Stadt arbeiten","B":"Vorher einen Sprachkurs machen","C":"Nur am Wochenende arbeiten"},"correct":"B","explanation_vi":"Einen Sprachkurs machen, bevor man anfängt."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Aussagen. Welche Meinung A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 người phát biểu, ghép mỗi người với ý kiến A–E",
            "context": "A = Diese Person möchte weniger Stunden pro Woche arbeiten.\nB = Diese Person findet den Kontakt zu Kunden am wichtigsten.\nC = Diese Person möchte einen neuen Beruf lernen.\nD = Diese Person ist mit dem Gehalt zufrieden.\nE = Diese Person hat Probleme mit dem Arbeitsweg.",
            "audio_script": "Sprecher 1: Ich fahre jeden Tag über eine Stunde mit dem Auto, im Winter oft noch länger. Das ist wirklich anstrengend.\nSprecher 2: Ich verdiene genug für meine Familie, wir kommen gut zurecht.\nSprecher 3: Ich arbeite gern mit Menschen. Wenn ich einem Kunden helfen kann, ist mein Tag gut.\nSprecher 4: Nächstes Jahr beginne ich eine Ausbildung als Erzieherin, mein alter Beruf macht mir keinen Spaß mehr.\nSprecher 5: Vierzig Stunden sind mir zu viel. Ich möchte lieber dreißig Stunden arbeiten und mehr Zeit für die Kinder haben.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 1 than đường đi làm quá xa."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 2 nói kiếm đủ tiền cho gia đình."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 3 thích làm việc với khách hàng."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 4 sắp học nghề mới."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 5 muốn làm 30 giờ thay vì 40 giờ."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Formular für die Anmeldung zum Weiterbildungskurs aus.",
            "instruction_vi": "Điền form đăng ký khoá học nâng cao tay nghề",
            "form_fields": [
              {"field":"Vorname und Familienname","instruction_vi":"Họ và tên"},
              {"field":"Beruf","instruction_vi":"Nghề nghiệp hiện tại"},
              {"field":"Arbeitgeber","instruction_vi":"Nơi làm việc"},
              {"field":"Gewünschter Kurstag","instruction_vi":"Ngày muốn học"},
              {"field":"Telefon oder E-Mail","instruction_vi":"Điện thoại hoặc email"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht von Ihrer Kollegin bekommen. Schreiben Sie eine Antwort (circa 40 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn của đồng nghiệp và viết thư trả lời ~40 từ, đủ cả 3 ý",
            "input_email": "Betreff: Vertretung nächste Woche\nHallo, ich bin nächste Woche im Urlaub. Kannst du meine Schicht am Dienstag übernehmen? Wie lange kannst du an diesem Tag bleiben? Und wen soll ich informieren? Danke dir, Katrin",
            "writing_points": ["Ob du die Schicht übernehmen kannst", "Wie lange du am Dienstag bleiben kannst", "Wen Katrin informieren soll"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Erzählen Sie etwas über sich und Ihren Alltag.",
            "instruction_vi": "Kể về bản thân và một ngày làm việc của bạn",
            "prompt_words": ["Beruf?", "Arbeitszeiten?", "Weg zur Arbeit?", "Kollegen?", "Was gefällt?", "Was ist schwer?"]
          },
          {
            "teil": 2,
            "type": "TOPIC_TALK",
            "instruction_de": "Sprechen Sie über das Thema und antworten Sie auf Fragen.",
            "instruction_vi": "Nói về chủ đề rồi trả lời câu hỏi của giám khảo",
            "topic_cards": [
              {"card":"Arbeit und Freizeit","question_to_ask":"Wie trennen Sie Arbeit und Freizeit?","possible_answer":"Nach der Arbeit schalte ich das Handy aus und gehe eine halbe Stunde spazieren."},
              {"card":"Weiterbildung","question_to_ask":"Welchen Kurs möchten Sie machen?","possible_answer":"Ich möchte einen Computerkurs machen, weil ich im Büro viel mit Excel arbeite."},
              {"card":"Team","question_to_ask":"Was ist für Sie ein gutes Team?","possible_answer":"Ein gutes Team hilft sich und spricht offen über Probleme."}
            ]
          },
          {
            "teil": 3,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie etwas gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lên kế hoạch cho tình huống sau",
            "prompt": "Situation: Ihr Team möchte für eine Kollegin eine kleine Abschiedsfeier organisieren.\nSprechen Sie über: Wann? Wo? Was zu essen und trinken? Wer kauft ein? Wie viel Geld gibt jede Person?\nMachen Sie Vorschläge, fragen Sie Ihren Partner und finden Sie eine gemeinsame Lösung."
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
  'A2', 'GOETHE',
  'Goethe-Zertifikat A2 – Set 2',
  'Đề thi thử Goethe A2 – Chủ đề: Thời gian rảnh và truyền thông',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie den Blogtext. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài blog và chọn Richtig hoặc Falsch",
            "context": "Blog von Nina: Mein Sonntag ohne Handy\nLetzten Sonntag habe ich ein Experiment gemacht: einen ganzen Tag ohne Handy. Am Morgen war es sehr komisch, ich habe fünfmal zum Tisch geschaut, wo das Handy normalerweise liegt. Dann bin ich mit meinem Bruder ins Schwimmbad gegangen. Wir sind zwei Stunden geschwommen und haben danach ein Eis gegessen. Am Nachmittag habe ich ein Buch gelesen, das schon zwei Jahre im Regal steht. Abends habe ich meine Oma besucht, ohne vorher anzurufen. Sie hat sich sehr gefreut. Nur einmal war es unpraktisch: Ich wusste nicht, wann der Bus fährt. Nächsten Monat mache ich das wieder, vielleicht sogar ein ganzes Wochenende.",
            "items": [
              {"id":"L1-1","question":"Nina war einen ganzen Tag ohne Handy.","correct":"richtig","explanation_vi":"Câu mở đầu: einen ganzen Tag ohne Handy."},
              {"id":"L1-2","question":"Nina war am Morgen ganz ruhig.","correct":"falsch","explanation_vi":"Buổi sáng cô thấy lạ và nhìn về phía bàn 5 lần."},
              {"id":"L1-3","question":"Nina und ihr Bruder waren im Schwimmbad.","correct":"richtig","explanation_vi":"mit meinem Bruder ins Schwimmbad gegangen."},
              {"id":"L1-4","question":"Nina hat ihre Oma vorher angerufen.","correct":"falsch","explanation_vi":"ohne vorher anzurufen = không gọi trước."},
              {"id":"L1-5","question":"Nina möchte das Experiment wiederholen.","correct":"richtig","explanation_vi":"Nächsten Monat mache ich das wieder."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 mẩu tin A–E và chọn tin hợp với từng người",
            "context": "A = Stadtbibliothek: Lesekreis für Erwachsene, jeden zweiten Montag, Anmeldung nicht nötig.\nB = Kino Kurbel: jeden Dienstag alle Filme für fünf Euro, auch Filme auf Englisch.\nC = Fotoclub Blende: Kurs für Handyfotografie, samstags 10 bis 13 Uhr, Kamera nicht nötig.\nD = Musikschule Takt: Gitarrenunterricht für Anfänger, Einzelstunden am Abend.\nE = Sportverein Delfin: Schwimmtraining für Erwachsene, dienstags und donnerstags 19 Uhr.",
            "items": [
              {"id":"L2-1","person":"Herr Bui möchte lernen, mit dem Handy bessere Fotos zu machen.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C dạy chụp ảnh bằng điện thoại."},
              {"id":"L2-2","person":"Frau Ha sucht einen günstigen Kinoabend unter der Woche.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"B chiếu phim 5 euro vào thứ Ba."},
              {"id":"L2-3","person":"Nam möchte abends ein Instrument lernen.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D dạy guitar buổi tối cho người mới."},
              {"id":"L2-4","person":"Frau Meier liest gern und möchte über Bücher sprechen.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"A là câu lạc bộ đọc sách."},
              {"id":"L2-5","person":"Linh will zweimal pro Woche nach der Arbeit schwimmen.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E tập bơi thứ Ba và thứ Năm lúc 19 giờ."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die kurzen Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các thông báo ngắn và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Aushang im Kino: Am Montag bleibt das Kino wegen einer privaten Feier geschlossen.","question":"Am Montag kann man keinen Film sehen.","correct":"richtig","explanation_vi":"Rạp đóng cửa thứ Hai."},
              {"id":"L3-2","text":"Information im Museum: Fotografieren ohne Blitz ist erlaubt. Videos sind verboten.","question":"Man darf im Museum Videos machen.","correct":"falsch","explanation_vi":"Videos sind verboten = cấm quay video."},
              {"id":"L3-3","text":"Schild am Spielplatz: Benutzung nur für Kinder bis 12 Jahre. Hunde bitte draußen lassen.","question":"Hunde dürfen auf den Spielplatz.","correct":"falsch","explanation_vi":"Chó phải để bên ngoài."},
              {"id":"L3-4","text":"Newsletter: Wer den Newsletter abbestellen möchte, klickt bitte unten auf den Link.","question":"Man kann den Newsletter über einen Link abbestellen.","correct":"richtig","explanation_vi":"Bấm vào link ở cuối thư để huỷ đăng ký."},
              {"id":"L3-5","text":"Notiz im Fitnessstudio: Die Sauna ist heute wegen Reinigung erst ab 16 Uhr offen.","question":"Die Sauna ist heute den ganzen Tag geschlossen.","correct":"falsch","explanation_vi":"Từ 16 giờ có mở lại."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Zeitungstext: Podcasts werden immer beliebter\nImmer mehr Menschen hören Podcasts, also Radiosendungen zum Herunterladen. Besonders beliebt sind sie bei jungen Leuten zwischen 20 und 35 Jahren. Die meisten hören unterwegs, zum Beispiel im Bus oder beim Sport. Viele sagen, dass sie so Zeit besser nutzen können. Am häufigsten gehört werden Sendungen über Nachrichten, Sprachen und Gesundheit. Kritisch ist nur: Wer den ganzen Tag Kopfhörer trägt, hört seine Umgebung schlechter. Fachleute empfehlen deshalb Pausen und eine nicht zu hohe Lautstärke.",
            "items": [
              {"id":"L4-1","question":"Was ist ein Podcast laut Text?","options":{"A":"Eine Zeitung","B":"Ein Konzert","C":"Eine Sendung zum Herunterladen"},"correct":"C","explanation_vi":"Radiosendungen zum Herunterladen."},
              {"id":"L4-2","question":"Wer hört besonders oft Podcasts?","options":{"A":"Junge Leute zwischen 20 und 35","B":"Kinder unter zehn","C":"Menschen über 70"},"correct":"A","explanation_vi":"beliebt bei jungen Leuten zwischen 20 und 35."},
              {"id":"L4-3","question":"Wo hören die meisten Menschen Podcasts?","options":{"A":"Im Büro","B":"Nur zu Hause","C":"Unterwegs"},"correct":"C","explanation_vi":"Die meisten hören unterwegs."},
              {"id":"L4-4","question":"Welches Thema wird im Text genannt?","options":{"A":"Kochen","B":"Autos","C":"Gesundheit"},"correct":"C","explanation_vi":"Nachrichten, Sprachen und Gesundheit."},
              {"id":"L4-5","question":"Was empfehlen die Fachleute?","options":{"A":"Lauter hören","B":"Nur abends hören","C":"Pausen machen"},"correct":"C","explanation_vi":"Fachleute empfehlen Pausen und âm lượng vừa phải."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Wollen wir am Freitag ins Konzert gehen? B: Freitag kann ich nicht, ich habe Training. Samstag hätte ich Zeit.","question":"Wann hat die zweite Person Zeit?","options":{"A":"Am Samstag","B":"Am Freitag","C":"Am Sonntag"},"correct":"A","explanation_vi":"Samstag hätte ich Zeit."},
              {"id":"H1-2","audio_script":"A: Was kostet der Eintritt für Studenten? B: Normal zwölf Euro, mit Studentenausweis nur sieben Euro.","question":"Wie viel zahlen Studenten?","options":{"A":"Neunzehn Euro","B":"Zwölf Euro","C":"Sieben Euro"},"correct":"C","explanation_vi":"mit Studentenausweis nur sieben Euro."},
              {"id":"H1-3","audio_script":"A: Wie war der Film gestern? B: Die Bilder waren toll, aber die Geschichte war mir zu langweilig.","question":"Wie fand die Person den Film?","options":{"A":"Ganz schlecht","B":"Perfekt","C":"Schöne Bilder, langweilige Geschichte"},"correct":"C","explanation_vi":"Khen hình ảnh, chê cốt truyện chán."},
              {"id":"H1-4","audio_script":"A: Ich suche ein Geschenk für meinen Bruder. Er spielt gern Gitarre. B: Wie wäre es mit einem Buch über Musik oder Konzertkarten?","question":"Was schlägt die zweite Person vor?","options":{"A":"Konzertkarten oder ein Buch","B":"Eine neue Gitarre","C":"Einen Gutschein für Kleidung"},"correct":"A","explanation_vi":"ein Buch über Musik oder Konzertkarten."},
              {"id":"H1-5","audio_script":"A: Wann fängt der Sprachkurs an? B: Der Kurs beginnt am 5. September und dauert bis Dezember.","question":"Wann beginnt der Kurs?","options":{"A":"Im September","B":"Im Juli","C":"Im Dezember"},"correct":"A","explanation_vi":"Der Kurs beginnt am 5. September."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Ansage im Radio. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo trên đài rồi chọn Richtig hoặc Falsch",
            "audio_script": "Und nun zu den Veranstaltungen am Wochenende. Am Samstag beginnt um 15 Uhr das Stadtfest am Rathausplatz, mit Musik aus fünf Ländern und Essen aus aller Welt. Der Eintritt ist frei. Für Kinder gibt es ab 14 Uhr ein eigenes Programm im Stadtpark. Am Sonntag lädt das Museum für Stadtgeschichte zu einem Tag der offenen Tür ein, von 10 bis 18 Uhr. Führungen starten jede volle Stunde. Wichtig: Am Sonntag ist die Innenstadt für Autos gesperrt, benutzen Sie bitte Bus und Bahn.",
            "items": [
              {"id":"H2-1","question":"Das Stadtfest beginnt am Samstag um 15 Uhr.","correct":"richtig","explanation_vi":"Đúng như thông báo."},
              {"id":"H2-2","question":"Man muss für das Stadtfest Eintritt bezahlen.","correct":"falsch","explanation_vi":"Der Eintritt ist frei = vào cửa miễn phí."},
              {"id":"H2-3","question":"Das Kinderprogramm ist im Stadtpark.","correct":"richtig","explanation_vi":"ein eigenes Programm im Stadtpark."},
              {"id":"H2-4","question":"Die Führungen im Museum starten jede halbe Stunde.","correct":"falsch","explanation_vi":"jede volle Stunde = mỗi giờ tròn."},
              {"id":"H2-5","question":"Am Sonntag soll man mit Bus und Bahn kommen.","correct":"richtig","explanation_vi":"Nội thành cấm ô tô, nên đi xe buýt và tàu."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderator: Heute spreche ich mit Frau Özdemir. Sie organisiert einen Filmclub. Frau Özdemir: Ja, wir treffen uns jeden zweiten Freitag in der Bibliothek. Moderator: Wie viele Leute kommen? Frau Özdemir: Meistens zwölf bis fünfzehn. Wir sehen einen Film und sprechen danach eine halbe Stunde darüber. Moderator: Welche Filme wählen Sie? Frau Özdemir: Die Mitglieder schlagen Filme vor und wir stimmen ab. Am liebsten sehen wir Filme aus Europa mit Untertiteln. Moderator: Kostet das etwas? Frau Özdemir: Nein, aber wir sammeln freiwillig Geld für Getränke.",
            "items": [
              {"id":"H3-1","question":"Wie oft trifft sich der Filmclub?","options":{"A":"Jeden Tag","B":"Einmal im Jahr","C":"Jeden zweiten Freitag"},"correct":"C","explanation_vi":"jeden zweiten Freitag = hai tuần một lần vào thứ Sáu."},
              {"id":"H3-2","question":"Wo trifft sich der Club?","options":{"A":"Im Kino","B":"Im Café","C":"In der Bibliothek"},"correct":"C","explanation_vi":"in der Bibliothek."},
              {"id":"H3-3","question":"Wie viele Personen kommen meistens?","options":{"A":"Zwölf bis fünfzehn","B":"Zwei bis fünf","C":"Über dreißig"},"correct":"A","explanation_vi":"Meistens zwölf bis fünfzehn."},
              {"id":"H3-4","question":"Wie wählt der Club die Filme aus?","options":{"A":"Die Mitglieder stimmen ab","B":"Die Bibliothek entscheidet","C":"Der Zufall entscheidet"},"correct":"A","explanation_vi":"Die Mitglieder schlagen Filme vor und wir stimmen ab."},
              {"id":"H3-5","question":"Was sagt Frau Özdemir über die Kosten?","options":{"A":"Nur Mitglieder zahlen","B":"Es kostet zehn Euro","C":"Es ist kostenlos"},"correct":"C","explanation_vi":"Nein, không mất phí, chỉ góp tự nguyện tiền nước."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Aussagen. Welche Meinung A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 người phát biểu, ghép mỗi người với ý kiến A–E",
            "context": "A = Diese Person sieht Serien am liebsten allein.\nB = Diese Person hört im Auto viel Radio.\nC = Diese Person liest lieber Bücher aus Papier.\nD = Diese Person nutzt soziale Netzwerke fast nicht mehr.\nE = Diese Person spielt am Wochenende Computerspiele mit Freunden.",
            "audio_script": "Sprecher 1: Ein Bildschirm ist nichts für mich. Ich brauche Papier in der Hand, das ist einfach schöner.\nSprecher 2: Ich habe die Apps vom Handy gelöscht. Ich habe zu viel Zeit verloren.\nSprecher 3: Am Samstagabend spiele ich online mit meinen Freunden, wir sprechen dabei über Kopfhörer.\nSprecher 4: Auf dem Weg zur Arbeit läuft immer Radio, so kenne ich die Nachrichten und den Verkehr.\nSprecher 5: Serien schaue ich am liebsten abends allein, dann kann ich stoppen, wann ich will.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 1 thích sách giấy."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 2 đã xoá app mạng xã hội."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 3 chơi game với bạn cuối tuần."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 4 nghe radio trên đường đi làm."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 5 xem phim bộ một mình."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Formular für die Anmeldung im Sportverein aus.",
            "instruction_vi": "Điền form đăng ký tham gia câu lạc bộ",
            "form_fields": [
              {"field":"Vorname und Familienname","instruction_vi":"Họ và tên"},
              {"field":"Geburtsdatum","instruction_vi":"Ngày sinh"},
              {"field":"Kurs oder Gruppe","instruction_vi":"Khoá/nhóm muốn tham gia"},
              {"field":"Wochentag","instruction_vi":"Thứ trong tuần muốn sinh hoạt"},
              {"field":"E-Mail","instruction_vi":"Email liên hệ"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 40 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn và viết thư trả lời ~40 từ, đủ cả 3 ý",
            "input_email": "Betreff: Kinoabend\nHallo, am Donnerstag läuft der neue Film im Kino Kurbel. Hast du Lust mitzukommen? Welchen Film möchtest du sehen? Und sollen wir vorher noch etwas essen? Liebe Grüße, Paul",
            "writing_points": ["Ob du mitkommst", "Welchen Film du sehen möchtest", "Ob ihr vorher essen geht"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Erzählen Sie etwas über sich und Ihre Freizeit.",
            "instruction_vi": "Kể về bản thân và cách bạn dùng thời gian rảnh",
            "prompt_words": ["Hobbys?", "Wie oft?", "Mit wem?", "Seit wann?", "Warum gern?", "Wunsch?"]
          },
          {
            "teil": 2,
            "type": "TOPIC_TALK",
            "instruction_de": "Sprechen Sie über das Thema und antworten Sie auf Fragen.",
            "instruction_vi": "Nói về chủ đề rồi trả lời câu hỏi",
            "topic_cards": [
              {"card":"Handy im Alltag","question_to_ask":"Wie lange nutzen Sie Ihr Handy pro Tag?","possible_answer":"Ungefähr zwei Stunden, meistens für Nachrichten und Musik."},
              {"card":"Sport","question_to_ask":"Welchen Sport machen Sie am liebsten?","possible_answer":"Ich schwimme am liebsten, weil ich mich danach sehr entspannt fühle."},
              {"card":"Musik","question_to_ask":"Welche Musik hören Sie gern?","possible_answer":"Ich höre gern ruhige Musik, besonders wenn ich lerne."}
            ]
          },
          {
            "teil": 3,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie etwas gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lên kế hoạch cho tình huống sau",
            "prompt": "Situation: Sie möchten am Wochenende zusammen einen Ausflug in eine andere Stadt machen.\nSprechen Sie über: Welche Stadt? Wann losfahren? Womit fahren? Was dort ansehen? Wie viel Geld ausgeben?\nMachen Sie Vorschläge, reagieren Sie auf Ihren Partner und einigen Sie sich."
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
  'A2', 'GOETHE',
  'Goethe-Zertifikat A2 – Set 3',
  'Đề thi thử Goethe A2 – Chủ đề: Sức khoẻ và ăn uống',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die E-Mail. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc email và chọn Richtig hoặc Falsch",
            "context": "E-Mail von Thomas an seinen Freund:\nHallo Kim, seit drei Wochen gehe ich dreimal pro Woche laufen. Am Anfang konnte ich nur zehn Minuten, jetzt schaffe ich schon eine halbe Stunde. Mein Arzt hat gesagt, ich soll mich mehr bewegen und weniger Zucker essen. Deshalb trinke ich meinen Kaffee jetzt ohne Zucker, das war am schwersten. Zum Frühstück esse ich Haferflocken mit Obst, das schmeckt besser als gedacht. Abends koche ich selbst, meistens Gemüse mit Reis oder Nudeln. Fleisch esse ich nur noch am Wochenende. Ich fühle mich fitter und schlafe besser. Willst du am Samstag mit mir laufen gehen? Viele Grüße, Thomas",
            "items": [
              {"id":"L1-1","question":"Thomas läuft seit drei Wochen regelmäßig.","correct":"richtig","explanation_vi":"seit drei Wochen dreimal pro Woche laufen."},
              {"id":"L1-2","question":"Thomas kann jetzt eine halbe Stunde laufen.","correct":"richtig","explanation_vi":"jetzt schaffe ich schon eine halbe Stunde."},
              {"id":"L1-3","question":"Der Arzt hat mehr Zucker empfohlen.","correct":"falsch","explanation_vi":"Bác sĩ khuyên ăn ÍT đường hơn."},
              {"id":"L1-4","question":"Thomas isst jeden Tag Fleisch.","correct":"falsch","explanation_vi":"Fleisch nur noch am Wochenende."},
              {"id":"L1-5","question":"Thomas lädt Kim zum Laufen ein.","correct":"richtig","explanation_vi":"Willst du am Samstag mit mir laufen gehen?"}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 mẩu tin A–E và chọn tin hợp với từng người",
            "context": "A = Praxis Dr. Sommer: Sprechstunde ohne Termin jeden Morgen 8 bis 10 Uhr.\nB = Bioladen Grünkorb: frisches Gemüse aus der Region, Lieferung nach Hause ab 20 Euro.\nC = Kochstudio Pfanne: Kurs gesunde Küche für Berufstätige, mittwochs 18 Uhr 30.\nD = Physiotherapie Aktiv: Rückentraining in kleinen Gruppen, auch nach der Arbeit.\nE = Zahnklinik Perle: Kontrolle und Reinigung, Termine auch samstags.",
            "items": [
              {"id":"L2-1","person":"Frau Lan hat Rückenschmerzen vom Sitzen im Büro.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D có lớp tập lưng, cả sau giờ làm."},
              {"id":"L2-2","person":"Herr Klein braucht am Samstag einen Zahnarzttermin.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E nhận khám cả thứ Bảy."},
              {"id":"L2-3","person":"Minh möchte lernen, schnell und gesund zu kochen.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C dạy nấu ăn lành mạnh cho người đi làm."},
              {"id":"L2-4","person":"Frau Weber ist heute Morgen krank und hat keinen Termin.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"A khám không cần hẹn vào buổi sáng."},
              {"id":"L2-5","person":"Familie Tran möchte Gemüse nach Hause geliefert bekommen.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"B giao rau tận nhà từ 20 euro."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die kurzen Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc thông báo ngắn và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Aushang in der Praxis: Bitte bringen Sie zu jedem Termin Ihre Versichertenkarte mit. Ohne Karte müssen Sie privat bezahlen.","question":"Ohne Karte zahlt man selbst.","correct":"richtig","explanation_vi":"Không có thẻ thì phải trả tiền tự túc."},
              {"id":"L3-2","text":"Hinweis auf der Packung: Zweimal täglich eine Tablette nach dem Essen. Nicht für Kinder unter zwölf Jahren.","question":"Kinder unter zwölf dürfen die Tabletten nehmen.","correct":"falsch","explanation_vi":"Không dùng cho trẻ dưới 12 tuổi."},
              {"id":"L3-3","text":"Kantine: Ab Montag gibt es jeden Tag ein vegetarisches Gericht und einen Salat als Beilage.","question":"Es gibt täglich ein vegetarisches Gericht.","correct":"richtig","explanation_vi":"jeden Tag ein vegetarisches Gericht."},
              {"id":"L3-4","text":"Schwimmbad: Wer Fieber oder Husten hat, darf das Bad nicht benutzen.","question":"Mit Husten darf man schwimmen gehen.","correct":"falsch","explanation_vi":"Ai bị sốt hoặc ho thì không được vào."},
              {"id":"L3-5","text":"Apotheke: Wir bestellen Medikamente auch für den nächsten Tag. Abholung ab 9 Uhr.","question":"Bestellte Medikamente kann man ab 9 Uhr abholen.","correct":"richtig","explanation_vi":"Abholung ab 9 Uhr = lấy thuốc từ 9 giờ."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Zeitungstext: Frühstück ja oder nein?\nLange galt: Ein gutes Frühstück ist die wichtigste Mahlzeit des Tages. Neue Studien zeigen ein anderes Bild. Wichtiger als die Uhrzeit ist, was und wie viel man isst. Wer morgens keinen Hunger hat, muss nicht essen, sollte dann aber mittags nicht zu Süßigkeiten greifen. Fachleute empfehlen Vollkornbrot, Joghurt oder Obst statt süßer Frühstücksflocken. Kinder dagegen brauchen am Morgen Energie für die Schule, hier raten Ärzte weiter zu einem kleinen Frühstück. Am Ende gilt für alle: genug trinken, am besten Wasser.",
            "items": [
              {"id":"L4-1","question":"Was sagt der Text über das Frühstück?","options":{"A":"Alle müssen morgens viel essen","B":"Wichtiger ist, was und wie viel man isst","C":"Frühstück ist verboten"},"correct":"B","explanation_vi":"Wichtiger als die Uhrzeit ist, was und wie viel man isst."},
              {"id":"L4-2","question":"Was soll man tun, wenn man morgens keinen Hunger hat?","options":{"A":"Mittags keine Süßigkeiten essen","B":"Trotzdem viel essen","C":"Den ganzen Tag nichts essen"},"correct":"A","explanation_vi":"Không ăn sáng thì trưa đừng ăn nhiều đồ ngọt."},
              {"id":"L4-3","question":"Was empfehlen die Fachleute?","options":{"A":"Vollkornbrot und Obst","B":"Süße Flocken","C":"Nur Kaffee"},"correct":"A","explanation_vi":"Vollkornbrot, Joghurt oder Obst."},
              {"id":"L4-4","question":"Was gilt für Kinder?","options":{"A":"Sie sollen nichts essen","B":"Sie sollen ein kleines Frühstück essen","C":"Sie sollen erst mittags essen"},"correct":"B","explanation_vi":"Ärzte raten weiter zu einem kleinen Frühstück."},
              {"id":"L4-5","question":"Was gilt für alle?","options":{"A":"Nie Obst essen","B":"Viel Kaffee trinken","C":"Genug trinken"},"correct":"C","explanation_vi":"genug trinken, am besten Wasser."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Guten Tag, ich hätte gern einen Termin. B: Diese Woche ist alles voll. Nächsten Montag um 9 Uhr 30 wäre frei.","question":"Wann bekommt die Person einen Termin?","options":{"A":"Diese Woche","B":"Nächsten Montag","C":"Heute Abend"},"correct":"B","explanation_vi":"Nächsten Montag um 9 Uhr 30."},
              {"id":"H1-2","audio_script":"A: Nehmen Sie die Tropfen morgens und abends. B: Und vor oder nach dem Essen? A: Immer nach dem Essen.","question":"Wann soll der Patient die Tropfen nehmen?","options":{"A":"Nach dem Essen","B":"Vor dem Essen","C":"Nur mittags"},"correct":"A","explanation_vi":"Immer nach dem Essen."},
              {"id":"H1-3","audio_script":"A: Ich möchte gern Sport machen, aber ich habe wenig Zeit. B: Dann probier es mit zwanzig Minuten am Morgen, das reicht am Anfang.","question":"Was empfiehlt die zweite Person?","options":{"A":"Zwanzig Minuten am Morgen","B":"Zwei Stunden am Abend","C":"Gar keinen Sport"},"correct":"A","explanation_vi":"zwanzig Minuten am Morgen."},
              {"id":"H1-4","audio_script":"A: Was möchten Sie bestellen? B: Die Gemüsesuppe, bitte. Aber ohne Sahne, ich vertrage keine Milch.","question":"Was möchte der Gast nicht?","options":{"A":"Gemüse","B":"Milchprodukte","C":"Suppe"},"correct":"B","explanation_vi":"ich vertrage keine Milch = không hợp sữa."},
              {"id":"H1-5","audio_script":"A: Wie oft trainierst du im Fitnessstudio? B: Früher jeden Tag, jetzt nur noch zweimal pro Woche.","question":"Wie oft trainiert die Person jetzt?","options":{"A":"Jeden Tag","B":"Einmal im Monat","C":"Zweimal pro Woche"},"correct":"C","explanation_vi":"jetzt nur noch zweimal pro Woche."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Ansage. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo tại trung tâm y tế rồi chọn Richtig hoặc Falsch",
            "audio_script": "Herzlich willkommen im Gesundheitszentrum Nordpark. Wir informieren Sie über unser Angebot im Herbst. Neu ist ein Kurs Rücken fit, immer dienstags um 18 Uhr, zehn Termine für sechzig Euro. Die Krankenkasse bezahlt oft einen Teil davon, fragen Sie bitte dort nach. Der beliebte Kochkurs für gesunde Ernährung startet erst im November, weil die Küche renoviert wird. Unsere Praxis hat neue Öffnungszeiten: montags bis freitags von 7 bis 19 Uhr, samstags nur nach Vereinbarung. Anmeldungen bitte online oder telefonisch.",
            "items": [
              {"id":"H2-1","question":"Der Kurs Rücken fit findet dienstags statt.","correct":"richtig","explanation_vi":"immer dienstags um 18 Uhr."},
              {"id":"H2-2","question":"Der Kurs kostet sechzig Euro.","correct":"richtig","explanation_vi":"zehn Termine für sechzig Euro."},
              {"id":"H2-3","question":"Die Krankenkasse zahlt nie etwas dazu.","correct":"falsch","explanation_vi":"Bảo hiểm thường trả một phần."},
              {"id":"H2-4","question":"Der Kochkurs beginnt schon im September.","correct":"falsch","explanation_vi":"Lớp nấu ăn bắt đầu tháng 11 vì bếp đang sửa."},
              {"id":"H2-5","question":"Am Samstag kann man nur nach Vereinbarung kommen.","correct":"richtig","explanation_vi":"samstags nur nach Vereinbarung."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderatorin: Frau Doktor Weiss, viele Menschen schlafen schlecht. Was raten Sie? Ärztin: Zuerst feste Zeiten. Wer jeden Tag zur gleichen Zeit ins Bett geht, schläft meistens besser. Moderatorin: Und das Handy? Ärztin: Eine Stunde vor dem Schlafen sollte man den Bildschirm weglegen. Das Licht macht wach. Moderatorin: Hilft Sport? Ärztin: Ja, aber nicht direkt vor dem Schlafen. Am besten am Nachmittag. Moderatorin: Was ist mit Kaffee? Ärztin: Nach 16 Uhr besser keinen mehr. Und das Schlafzimmer sollte kühl und dunkel sein.",
            "items": [
              {"id":"H3-1","question":"Was ist der erste Rat der Ärztin?","options":{"A":"Mehr Kaffee","B":"Feste Schlafzeiten","C":"Später ins Bett gehen"},"correct":"B","explanation_vi":"Zuerst feste Zeiten."},
              {"id":"H3-2","question":"Was sagt sie über das Handy?","options":{"A":"Eine Stunde vorher weglegen","B":"Es hilft beim Einschlafen","C":"Es ist egal"},"correct":"A","explanation_vi":"Eine Stunde vor dem Schlafen den Bildschirm weglegen."},
              {"id":"H3-3","question":"Wann soll man Sport machen?","options":{"A":"Direkt vor dem Schlafen","B":"Nie","C":"Am Nachmittag"},"correct":"C","explanation_vi":"Am besten am Nachmittag."},
              {"id":"H3-4","question":"Bis wann darf man Kaffee trinken?","options":{"A":"Bis 20 Uhr","B":"Bis 16 Uhr","C":"Ohne Grenze"},"correct":"B","explanation_vi":"Nach 16 Uhr besser keinen mehr."},
              {"id":"H3-5","question":"Wie soll das Schlafzimmer sein?","options":{"A":"Kühl und dunkel","B":"Warm und hell","C":"Laut"},"correct":"A","explanation_vi":"kühl und dunkel."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Aussagen. Welche Meinung A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 người phát biểu, ghép mỗi người với ý kiến A–E",
            "context": "A = Diese Person kocht fast jeden Tag selbst.\nB = Diese Person macht Sport in der Mittagspause.\nC = Diese Person isst kein Fleisch.\nD = Diese Person hat wegen der Arbeit oft keine Zeit zum Essen.\nE = Diese Person trinkt sehr viel Wasser.",
            "audio_script": "Sprecher 1: Fleisch esse ich seit fünf Jahren nicht mehr, Gemüse und Bohnen reichen mir völlig.\nSprecher 2: Ich stelle immer eine große Flasche auf den Tisch, zwei Liter am Tag sind normal für mich.\nSprecher 3: In der Pause gehe ich mit Kollegen dreißig Minuten schnell spazieren oder ins Studio.\nSprecher 4: Abends stehe ich in der Küche, Fertiggerichte kommen mir nicht ins Haus.\nSprecher 5: Manchmal merke ich erst um vier Uhr nachmittags, dass ich noch nichts gegessen habe.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 1 đã bỏ thịt 5 năm."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 2 uống 2 lít nước mỗi ngày."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 3 tập thể dục giờ nghỉ trưa."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 4 tối nào cũng tự nấu."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 5 bận đến chiều mới nhớ chưa ăn."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Formular für die Anmeldung in der Arztpraxis aus.",
            "instruction_vi": "Điền form khai báo khi đăng ký khám bệnh",
            "form_fields": [
              {"field":"Vorname und Familienname","instruction_vi":"Họ và tên"},
              {"field":"Geburtsdatum","instruction_vi":"Ngày sinh"},
              {"field":"Krankenkasse","instruction_vi":"Hãng bảo hiểm y tế"},
              {"field":"Beschwerden","instruction_vi":"Triệu chứng chính"},
              {"field":"Telefonnummer","instruction_vi":"Số điện thoại"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 40 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn và viết thư trả lời ~40 từ, đủ cả 3 ý",
            "input_email": "Betreff: Kochabend bei mir\nHallo, ich möchte am Freitag zusammen kochen. Isst du alles oder gibt es etwas, das du nicht magst? Was sollen wir kochen? Und wann kannst du kommen? Liebe Grüße, Eva",
            "writing_points": ["Was du nicht isst", "Welches Gericht du vorschlägst", "Wann du kommen kannst"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Erzählen Sie etwas über Ihre Ernährung und Ihren Sport.",
            "instruction_vi": "Kể về thói quen ăn uống và vận động của bạn",
            "prompt_words": ["Frühstück?", "Lieblingsessen?", "Sport?", "Wie oft?", "Was ist schwer?", "Ziel?"]
          },
          {
            "teil": 2,
            "type": "TOPIC_TALK",
            "instruction_de": "Sprechen Sie über das Thema und antworten Sie auf Fragen.",
            "instruction_vi": "Nói về chủ đề rồi trả lời câu hỏi",
            "topic_cards": [
              {"card":"Beim Arzt","question_to_ask":"Wann waren Sie zuletzt beim Arzt?","possible_answer":"Vor zwei Monaten, ich hatte eine Erkältung und brauchte ein Rezept."},
              {"card":"Kochen","question_to_ask":"Kochen Sie selbst oder essen Sie draußen?","possible_answer":"Unter der Woche koche ich selbst, am Wochenende esse ich manchmal im Restaurant."},
              {"card":"Schlaf","question_to_ask":"Wie viele Stunden schlafen Sie?","possible_answer":"Meistens sieben Stunden, an Arbeitstagen stehe ich um sechs Uhr auf."}
            ]
          },
          {
            "teil": 3,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie etwas gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lên kế hoạch cho tình huống sau",
            "prompt": "Situation: Ein Freund kommt nächste Woche aus dem Krankenhaus und Sie möchten ihm helfen.\nSprechen Sie über: Wer kauft ein? Wer kocht? Wann besuchen Sie ihn? Was bringen Sie mit? Wie oft kommen Sie?\nMachen Sie Vorschläge und einigen Sie sich auf einen Plan."
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
  'A2', 'GOETHE',
  'Goethe-Zertifikat A2 – Set 4',
  'Đề thi thử Goethe A2 – Chủ đề: Du lịch và đi lại',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie den Text. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài viết và chọn Richtig hoặc Falsch",
            "context": "Reisebericht von Yen:\nIm Sommer war ich zum ersten Mal in den Alpen. Ich bin mit dem Nachtzug von Hamburg nach München gefahren, das war günstiger als das Flugzeug und ich habe im Zug geschlafen. In München habe ich zwei Tage bei einer Freundin gewohnt, dann sind wir mit dem Bus in ein kleines Dorf gefahren. Dort haben wir eine einfache Pension gefunden, das Zimmer hat nur 45 Euro pro Nacht gekostet. Jeden Morgen sind wir gewandert, einmal fünf Stunden bis zu einem See. Das Wetter war leider nicht immer gut, an zwei Tagen hat es stark geregnet. Trotzdem möchte ich nächstes Jahr wiederkommen, dann aber im September, weil es dann ruhiger ist.",
            "items": [
              {"id":"L1-1","question":"Yen ist mit dem Flugzeug nach München gereist.","correct":"falsch","explanation_vi":"Cô đi tàu đêm (Nachtzug), rẻ hơn máy bay."},
              {"id":"L1-2","question":"In München hat Yen bei einer Freundin gewohnt.","correct":"richtig","explanation_vi":"zwei Tage bei einer Freundin gewohnt."},
              {"id":"L1-3","question":"Das Zimmer in der Pension war sehr teuer.","correct":"falsch","explanation_vi":"45 euro/đêm, được mô tả là nhà nghỉ đơn giản."},
              {"id":"L1-4","question":"An zwei Tagen hat es stark geregnet.","correct":"richtig","explanation_vi":"an zwei Tagen hat es stark geregnet."},
              {"id":"L1-5","question":"Yen möchte nächstes Jahr im September kommen.","correct":"richtig","explanation_vi":"dann aber im September, weil es ruhiger ist."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 mẩu tin A–E và chọn tin hợp với từng người",
            "context": "A = Jugendherberge Seeblick: Zimmer ab 22 Euro, Frühstück inklusive, direkt am See.\nB = Mietwagen Schnell: Auto ab 29 Euro pro Tag, Abholung am Flughafen rund um die Uhr.\nC = Radverleih Tour: Fahrräder für einen Tag oder eine Woche, Helm kostenlos dazu.\nD = Busreisen Panorama: Tagesfahrt in die Berge, Abfahrt 7 Uhr, Rückkehr 20 Uhr.\nE = Ferienwohnung Rosenhof: zwei Schlafzimmer, Küche, für Familien mit Kindern.",
            "items": [
              {"id":"L2-1","person":"Herr Pham landet nachts am Flughafen und braucht sofort ein Auto.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"B cho thuê xe, nhận xe 24/24 tại sân bay."},
              {"id":"L2-2","person":"Familie Nguyen mit zwei Kindern sucht eine Wohnung mit Küche.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E là căn hộ nghỉ dưỡng cho gia đình."},
              {"id":"L2-3","person":"Lisa reist allein und braucht ein billiges Bett mit Frühstück.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"A từ 22 euro, đã gồm ăn sáng."},
              {"id":"L2-4","person":"Herr Kraus möchte die Stadt mit dem Rad ansehen.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C cho thuê xe đạp kèm mũ bảo hiểm."},
              {"id":"L2-5","person":"Frau Ott hat nur einen freien Tag und möchte in die Berge.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D là tour trong ngày lên núi."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die kurzen Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc thông báo ngắn và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Am Automaten: Tickets für die Zone A bis C bekommen Sie nur mit Karte, kein Bargeld.","question":"Man kann am Automaten mit Bargeld bezahlen.","correct":"falsch","explanation_vi":"kein Bargeld = không nhận tiền mặt."},
              {"id":"L3-2","text":"Im Hotel: Das Frühstück gibt es von 6 Uhr 30 bis 10 Uhr, am Wochenende bis 11 Uhr.","question":"Am Sonntag kann man bis 11 Uhr frühstücken.","correct":"richtig","explanation_vi":"Cuối tuần phục vụ đến 11 giờ."},
              {"id":"L3-3","text":"Am Flughafen: Flüssigkeiten über 100 Milliliter dürfen nicht ins Handgepäck.","question":"Große Flaschen darf man im Handgepäck mitnehmen.","correct":"falsch","explanation_vi":"Trên 100 ml không được mang theo xách tay."},
              {"id":"L3-4","text":"Im Zug: Die Reservierung gilt bis 15 Minuten nach der Abfahrt. Danach kann jemand anderes sitzen.","question":"Nach 15 Minuten verliert man den reservierten Platz.","correct":"richtig","explanation_vi":"Sau 15 phút chỗ đặt không còn được giữ."},
              {"id":"L3-5","text":"Am Fahrradweg: Radfahrer bitte absteigen und schieben. Baustelle bis Ende Juni.","question":"Man darf hier mit dem Rad fahren.","correct":"falsch","explanation_vi":"absteigen und schieben = xuống xe dắt bộ."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Zeitungstext: Mit dem Zug statt mit dem Auto\nImmer mehr Menschen in Deutschland lassen für kurze Reisen das Auto stehen. Ein Grund sind die günstigen Monatstickets für Busse und Bahnen. Wer in der Stadt wohnt, spart damit oft Geld und Zeit, weil er keinen Parkplatz suchen muss. Auf dem Land ist die Lage anders: Dort fahren Busse manchmal nur zweimal am Tag. Fachleute fordern deshalb bessere Verbindungen am Abend und am Wochenende. Auch der Preis spielt eine Rolle: Familien reisen mit dem Auto oft billiger als mit vier Bahntickets.",
            "items": [
              {"id":"L4-1","question":"Worum geht es im Text?","options":{"A":"Um Reisen mit Bus und Bahn","B":"Um neue Automodelle","C":"Um Flugreisen"},"correct":"A","explanation_vi":"Bài nói về đi tàu xe thay vì ô tô."},
              {"id":"L4-2","question":"Warum lassen viele das Auto stehen?","options":{"A":"Weil es keine Straßen gibt","B":"Weil Autos verboten sind","C":"Wegen der günstigen Monatstickets"},"correct":"C","explanation_vi":"Ein Grund sind die günstigen Monatstickets."},
              {"id":"L4-3","question":"Welchen Vorteil nennt der Text für Stadtbewohner?","options":{"A":"Sie bekommen ein Auto geschenkt","B":"Sie müssen keinen Parkplatz suchen","C":"Sie fahren immer erster Klasse"},"correct":"B","explanation_vi":"keinen Parkplatz suchen müssen."},
              {"id":"L4-4","question":"Wie ist die Lage auf dem Land?","options":{"A":"Es fahren sehr viele Busse","B":"Busse fahren manchmal nur zweimal am Tag","C":"Es gibt gar keine Busse"},"correct":"B","explanation_vi":"Dort fahren Busse manchmal nur zweimal am Tag."},
              {"id":"L4-5","question":"Was sagt der Text über Familien?","options":{"A":"Sie fahren mit dem Auto oft billiger","B":"Sie zahlen nie für Tickets","C":"Sie reisen nie"},"correct":"A","explanation_vi":"Familien reisen mit dem Auto oft billiger."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Eine Fahrkarte nach Bremen, bitte. B: Einfach oder hin und zurück? A: Hin und zurück, bitte. B: Das macht 48 Euro.","question":"Was kauft der Kunde?","options":{"A":"Eine einfache Fahrt","B":"Eine Monatskarte","C":"Eine Hin- und Rückfahrt"},"correct":"C","explanation_vi":"Hin und zurück = khứ hồi."},
              {"id":"H1-2","audio_script":"A: Entschuldigung, hält dieser Bus am Krankenhaus? B: Nein, Sie müssen an der Post umsteigen, dann Linie 9.","question":"Was soll der Fahrgast tun?","options":{"A":"Sitzen bleiben","B":"Zu Fuß gehen","C":"An der Post umsteigen"},"correct":"C","explanation_vi":"an der Post umsteigen, dann Linie 9."},
              {"id":"H1-3","audio_script":"A: Wir wollen im Juli nach Italien fahren. B: Im Juli ist alles voll. Nehmt lieber Ende August, da ist es ruhiger.","question":"Was empfiehlt die zweite Person?","options":{"A":"Im Juli fahren","B":"Ende August fahren","C":"Zu Hause bleiben"},"correct":"B","explanation_vi":"Nehmt lieber Ende August."},
              {"id":"H1-4","audio_script":"A: Ist das Zimmer noch frei? B: Ja, aber nur bis Freitag. Ab Samstag ist das Hotel ausgebucht.","question":"Bis wann ist das Zimmer frei?","options":{"A":"Bis Mittwoch","B":"Bis Freitag","C":"Bis Sonntag"},"correct":"B","explanation_vi":"nur bis Freitag."},
              {"id":"H1-5","audio_script":"A: Wie komme ich am schnellsten zum Museum? B: Mit dem Rad zehn Minuten, zu Fuß eine halbe Stunde.","question":"Wie lange dauert es mit dem Rad?","options":{"A":"Zehn Minuten","B":"Zwanzig Minuten","C":"Eine halbe Stunde"},"correct":"A","explanation_vi":"Mit dem Rad zehn Minuten."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Durchsage. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo trên tàu rồi chọn Richtig hoặc Falsch",
            "audio_script": "Sehr geehrte Fahrgäste, willkommen im ICE 574 nach Berlin Hauptbahnhof. Wir erreichen in wenigen Minuten Hannover. Bitte beachten Sie: Wegen Bauarbeiten fährt dieser Zug heute über Wolfsburg, wir kommen deshalb etwa zehn Minuten später in Berlin an. Das Bordrestaurant im Wagen sieben ist bis 21 Uhr geöffnet. Reisende nach Hamburg steigen bitte in Hannover um, der Anschlusszug wartet auf Gleis 8. Wir wünschen Ihnen eine angenehme Fahrt.",
            "items": [
              {"id":"H2-1","question":"Der Zug fährt nach Berlin.","correct":"richtig","explanation_vi":"ICE 574 nach Berlin Hauptbahnhof."},
              {"id":"H2-2","question":"Der Zug kommt pünktlich in Berlin an.","correct":"falsch","explanation_vi":"Trễ khoảng 10 phút vì công trường."},
              {"id":"H2-3","question":"Das Bordrestaurant ist im Wagen sieben.","correct":"richtig","explanation_vi":"Bordrestaurant im Wagen sieben."},
              {"id":"H2-4","question":"Reisende nach Hamburg müssen in Hannover umsteigen.","correct":"richtig","explanation_vi":"Người đi Hamburg đổi tàu ở Hannover."},
              {"id":"H2-5","question":"Der Anschlusszug fährt von Gleis 3.","correct":"falsch","explanation_vi":"Tàu nối chờ ở sân ga 8."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Angestellte: Reisebüro Weitblick, guten Tag. Kunde: Guten Tag, ich möchte im Oktober eine Woche nach Wien. Angestellte: Mit dem Zug oder mit dem Flugzeug? Kunde: Lieber mit dem Zug, das ist bequemer. Angestellte: Dann empfehle ich den Nachtzug, Abfahrt 21 Uhr, Ankunft 8 Uhr. Kunde: Und was kostet das mit Hotel? Angestellte: Zug hin und zurück plus fünf Nächte im Zentrum, zusammen 520 Euro pro Person. Kunde: Gut, aber ich brauche ein ruhiges Zimmer. Angestellte: Kein Problem, ich notiere Zimmer zum Hof.",
            "items": [
              {"id":"H3-1","question":"Wann möchte der Kunde reisen?","options":{"A":"Im August","B":"Im Dezember","C":"Im Oktober"},"correct":"C","explanation_vi":"im Oktober eine Woche nach Wien."},
              {"id":"H3-2","question":"Wie möchte er reisen?","options":{"A":"Mit dem Zug","B":"Mit dem Flugzeug","C":"Mit dem Auto"},"correct":"A","explanation_vi":"Lieber mit dem Zug."},
              {"id":"H3-3","question":"Wann fährt der Nachtzug ab?","options":{"A":"Um 8 Uhr","B":"Um 21 Uhr","C":"Um 23 Uhr"},"correct":"B","explanation_vi":"Abfahrt 21 Uhr."},
              {"id":"H3-4","question":"Was kostet die Reise pro Person?","options":{"A":"520 Euro","B":"420 Euro","C":"250 Euro"},"correct":"A","explanation_vi":"zusammen 520 Euro pro Person."},
              {"id":"H3-5","question":"Was wünscht sich der Kunde im Hotel?","options":{"A":"Ein Zimmer mit Balkon","B":"Ein ruhiges Zimmer","C":"Ein Zimmer im Erdgeschoss"},"correct":"B","explanation_vi":"ich brauche ein ruhiges Zimmer."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Aussagen. Welche Meinung A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 người phát biểu, ghép mỗi người với ý kiến A–E",
            "context": "A = Diese Person fährt am liebsten mit dem Fahrrad.\nB = Diese Person findet Flugreisen zu teuer.\nC = Diese Person macht Urlaub am liebsten zu Hause.\nD = Diese Person reist gern mit dem Nachtzug.\nE = Diese Person braucht im Urlaub immer das Meer.",
            "audio_script": "Sprecher 1: Ohne Strand ist das für mich kein Urlaub, ich muss jeden Tag ins Wasser.\nSprecher 2: Abends einsteigen, morgens ankommen, das spart eine Hotelnacht und ich schlafe gut im Zug.\nSprecher 3: Fliegen kommt für mich kaum infrage, die Preise sind für eine Familie einfach zu hoch.\nSprecher 4: Ich bleibe in den Ferien gern in meiner Wohnung, koche in Ruhe und lese viel.\nSprecher 5: Ich packe zwei Taschen ans Rad und fahre los, so sehe ich am meisten von der Landschaft.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 1 cần biển."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 2 thích tàu đêm."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 3 chê vé máy bay đắt."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 4 nghỉ ở nhà."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 5 đi du lịch bằng xe đạp."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Formular für die Hotelbuchung aus.",
            "instruction_vi": "Điền form đặt phòng khách sạn",
            "form_fields": [
              {"field":"Vorname und Familienname","instruction_vi":"Họ và tên"},
              {"field":"Anreisedatum","instruction_vi":"Ngày đến"},
              {"field":"Anzahl der Nächte","instruction_vi":"Số đêm"},
              {"field":"Zimmerwunsch","instruction_vi":"Loại phòng mong muốn"},
              {"field":"E-Mail","instruction_vi":"Email liên hệ"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 40 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn và viết thư trả lời ~40 từ, đủ cả 3 ý",
            "input_email": "Betreff: Besuch in Berlin\nHallo, du kommst nächsten Monat nach Berlin. Wann genau kommst du an? Wo möchtest du übernachten? Und was willst du in der Stadt unbedingt sehen? Bis bald, Felix",
            "writing_points": ["Wann du ankommst", "Wo du übernachten möchtest", "Was du sehen willst"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Erzählen Sie von einer Reise.",
            "instruction_vi": "Kể về một chuyến đi của bạn",
            "prompt_words": ["Wohin?", "Mit wem?", "Wie lange?", "Womit gefahren?", "Wetter?", "Wieder hinfahren?"]
          },
          {
            "teil": 2,
            "type": "TOPIC_TALK",
            "instruction_de": "Sprechen Sie über das Thema und antworten Sie auf Fragen.",
            "instruction_vi": "Nói về chủ đề rồi trả lời câu hỏi",
            "topic_cards": [
              {"card":"Verkehrsmittel","question_to_ask":"Womit fahren Sie am liebsten und warum?","possible_answer":"Am liebsten fahre ich mit der Bahn, dort kann ich lesen und muss nicht selbst fahren."},
              {"card":"Unterkunft","question_to_ask":"Hotel oder Ferienwohnung?","possible_answer":"Ich nehme lieber eine Ferienwohnung, dann kann ich selbst kochen."},
              {"card":"Reisepläne","question_to_ask":"Wohin möchten Sie nächstes Jahr fahren?","possible_answer":"Nächstes Jahr möchte ich nach Österreich fahren und dort wandern."}
            ]
          },
          {
            "teil": 3,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie etwas gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lên kế hoạch cho tình huống sau",
            "prompt": "Situation: Sie planen zu zweit einen Wochenendausflug an die Ostsee.\nSprechen Sie über: Wann losfahren? Womit fahren? Wo übernachten? Was mitnehmen? Wie viel Geld ausgeben?\nMachen Sie Vorschläge, fragen Sie nach und finden Sie eine gemeinsame Lösung."
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
  'A2', 'GOETHE',
  'Goethe-Zertifikat A2 – Set 5',
  'Đề thi thử Goethe A2 – Chủ đề: Nhà ở và hàng xóm',
  100, 60, 90,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die E-Mail. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc email và chọn Richtig hoặc Falsch",
            "context": "E-Mail von Duc an seine Schwester:\nLiebe Trang, wir sind endlich umgezogen. Die neue Wohnung liegt im dritten Stock, leider ohne Aufzug. Dafür ist sie heller und ruhiger als die alte, weil die Fenster zum Hof zeigen. Wir haben jetzt drei Zimmer, ein Zimmer wird das Büro. Die Miete ist 120 Euro höher, aber die Heizkosten sind niedriger, weil das Haus neu isoliert ist. Die Nachbarn haben uns am ersten Abend Kuchen gebracht, das war sehr nett. Nur eine Sache stört: Die Waschküche im Keller darf man nur bis 20 Uhr benutzen. Kommst du im Frühling zu Besuch? Wir haben jetzt ein Gästebett. Liebe Grüße, Duc",
            "items": [
              {"id":"L1-1","question":"Die neue Wohnung ist im dritten Stock.","correct":"richtig","explanation_vi":"Câu thứ hai của thư nói rõ tầng ba."},
              {"id":"L1-2","question":"Im Haus gibt es einen Aufzug.","correct":"falsch","explanation_vi":"leider ohne Aufzug = tiếc là không có thang máy."},
              {"id":"L1-3","question":"Die neue Wohnung ist lauter als die alte.","correct":"falsch","explanation_vi":"Nhà mới yên tĩnh hơn vì cửa sổ quay ra sân trong."},
              {"id":"L1-4","question":"Die Heizkosten sind niedriger als vorher.","correct":"richtig","explanation_vi":"die Heizkosten sind niedriger, weil das Haus neu isoliert ist."},
              {"id":"L1-5","question":"Man darf die Waschküche auch nach 22 Uhr benutzen.","correct":"falsch","explanation_vi":"Chỉ được dùng đến 20 giờ."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 mẩu tin A–E và chọn tin hợp với từng người",
            "context": "A = Umzugsservice Kraft: Transporter mit Fahrer, Stundenpreis 45 Euro, auch am Wochenende.\nB = Möbel gebraucht: Schrank, Bett und Regal, Selbstabholung, Preis nach Vereinbarung.\nC = Hausmeisterdienst Rapid: kleine Reparaturen in der Wohnung, Termin innerhalb von 48 Stunden.\nD = WG-Zimmer frei: 18 Quadratmeter, Küche und Bad geteilt, ab 1. Oktober, nur Studierende.\nE = Wohnungsreinigung Klar: Grundreinigung vor der Übergabe, Fenster inklusive.",
            "items": [
              {"id":"L2-1","person":"Frau Tuyet zieht aus und muss die Wohnung sauber übergeben.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E dọn tổng vệ sinh trước khi bàn giao."},
              {"id":"L2-2","person":"Ein Student sucht ab Oktober ein günstiges Zimmer.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D là phòng trong nhà chung, chỉ cho sinh viên."},
              {"id":"L2-3","person":"Bei Herrn Ali tropft der Wasserhahn und er braucht schnell Hilfe.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C sửa vặt trong 48 giờ."},
              {"id":"L2-4","person":"Familie Berg braucht am Samstag ein Auto mit Fahrer für den Umzug.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"A có xe tải kèm tài xế, làm cả cuối tuần."},
              {"id":"L2-5","person":"Lien braucht billige Möbel und kann sie selbst abholen.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"B bán đồ cũ, tự đến lấy."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die kurzen Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc thông báo trong khu nhà và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Aushang im Treppenhaus: Von 13 bis 15 Uhr und ab 22 Uhr bitte Ruhe halten.","question":"Am Nachmittag gibt es eine Ruhezeit.","correct":"richtig","explanation_vi":"13–15 giờ là giờ nghỉ trưa."},
              {"id":"L3-2","text":"Info der Hausverwaltung: Der Müll wird ab Mai jeden zweiten Dienstag abgeholt.","question":"Der Müll wird jede Woche abgeholt.","correct":"falsch","explanation_vi":"jeden zweiten Dienstag = hai tuần một lần."},
              {"id":"L3-3","text":"Zettel im Keller: Fahrräder bitte nur im Fahrradraum abstellen, nicht im Gang.","question":"Fahrräder dürfen im Gang stehen.","correct":"falsch","explanation_vi":"Chỉ để trong phòng xe đạp, không để ở hành lang."},
              {"id":"L3-4","text":"Nachricht: Am Freitag kommt der Elektriker zwischen 9 und 12 Uhr. Bitte jemand zu Hause.","question":"Am Freitag muss jemand in der Wohnung sein.","correct":"richtig","explanation_vi":"Bitte jemand zu Hause = cần có người ở nhà."},
              {"id":"L3-5","text":"Hinweis: Pakete für Nachbarn nimmt Familie Weber in Wohnung 4 an.","question":"Familie Weber nimmt Pakete an.","correct":"richtig","explanation_vi":"Gia đình Weber nhận hộ bưu kiện."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Zeitungstext: Gemeinsam wohnen im Alter\nIn vielen deutschen Städten entstehen Wohnprojekte, in denen ältere und jüngere Menschen zusammenleben. Jede Familie hat eine eigene Wohnung, dazu gibt es Gemeinschaftsräume, zum Beispiel eine große Küche und einen Garten. Die Bewohner helfen sich gegenseitig: Jüngere gehen einkaufen, Ältere passen manchmal auf die Kinder auf. Ein Nachteil ist der Preis, denn solche Projekte sind oft nicht billig. Wichtig ist auch, dass alle Regeln gemeinsam beschlossen werden. Wer keine Lust auf Diskussionen hat, ist hier falsch.",
            "items": [
              {"id":"L4-1","question":"Was ist das Thema des Textes?","options":{"A":"Neue Bürogebäude","B":"Wohnprojekte für verschiedene Generationen","C":"Ferienhäuser am Meer"},"correct":"B","explanation_vi":"Bài nói về mô hình nhiều thế hệ sống chung."},
              {"id":"L4-2","question":"Was hat jede Familie?","options":{"A":"Eine eigene Wohnung","B":"Nur ein Zimmer","C":"Ein eigenes Haus"},"correct":"A","explanation_vi":"Jede Familie hat eine eigene Wohnung."},
              {"id":"L4-3","question":"Wie helfen sich die Bewohner?","options":{"A":"Sie arbeiten in derselben Firma","B":"Jüngere kaufen ein, Ältere passen auf Kinder auf","C":"Sie putzen nie"},"correct":"B","explanation_vi":"Đúng như câu về giúp đỡ lẫn nhau."},
              {"id":"L4-4","question":"Welchen Nachteil nennt der Text?","options":{"A":"Es ist oft teuer","B":"Es gibt keinen Garten","C":"Es ist zu ruhig"},"correct":"A","explanation_vi":"solche Projekte sind oft nicht billig."},
              {"id":"L4-5","question":"Für wen ist so ein Projekt nicht geeignet?","options":{"A":"Für Menschen mit Kindern","B":"Für Menschen, die nicht diskutieren möchten","C":"Für Menschen ohne Auto"},"correct":"B","explanation_vi":"Wer keine Lust auf Diskussionen hat, ist hier falsch."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Guten Tag, ich interessiere mich für die Wohnung in der Lindenstraße. B: Die hat 62 Quadratmeter und kostet 720 Euro warm.","question":"Wie groß ist die Wohnung?","options":{"A":"52 Quadratmeter","B":"72 Quadratmeter","C":"62 Quadratmeter"},"correct":"C","explanation_vi":"62 Quadratmeter."},
              {"id":"H1-2","audio_script":"A: Wann kann ich die Wohnung ansehen? B: Morgen um 17 Uhr oder am Samstagvormittag.","question":"Wann sind Besichtigungen möglich?","options":{"A":"Morgen oder am Samstag","B":"Nur morgen","C":"Erst nächste Woche"},"correct":"A","explanation_vi":"Có hai lựa chọn: mai 17 giờ hoặc sáng thứ Bảy."},
              {"id":"H1-3","audio_script":"A: Der Nachbar hört immer nachts laut Musik. B: Sprich zuerst freundlich mit ihm. Wenn das nicht hilft, schreib der Hausverwaltung.","question":"Was soll die Person zuerst tun?","options":{"A":"Die Polizei rufen","B":"Mit dem Nachbarn sprechen","C":"Sofort ausziehen"},"correct":"B","explanation_vi":"Sprich zuerst freundlich mit ihm."},
              {"id":"H1-4","audio_script":"A: Ist die Wohnung möbliert? B: Nein, nur die Küche ist eingebaut, alles andere müssen Sie mitbringen.","question":"Was ist in der Wohnung vorhanden?","options":{"A":"Alle Möbel","B":"Nur die Küche","C":"Nichts"},"correct":"B","explanation_vi":"nur die Küche ist eingebaut."},
              {"id":"H1-5","audio_script":"A: Wann muss ich die Kaution bezahlen? B: Vor dem Einzug, spätestens am Tag der Schlüsselübergabe.","question":"Wann ist die Kaution fällig?","options":{"A":"Spätestens bei der Schlüsselübergabe","B":"Nach einem Monat","C":"Nie"},"correct":"A","explanation_vi":"spätestens am Tag der Schlüsselübergabe."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Ansage der Hausverwaltung. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo của ban quản lý toà nhà rồi chọn Richtig hoặc Falsch",
            "audio_script": "Liebe Mieterinnen und Mieter, hier eine Information der Hausverwaltung. In der nächsten Woche werden die Fenster im Treppenhaus gestrichen. Von Montag bis Mittwoch ist der Haupteingang deshalb gesperrt, bitte benutzen Sie den Eingang auf der Gartenseite. Das Wasser wird am Dienstag von 9 bis 12 Uhr abgestellt. Denken Sie bitte daran, vorher etwas Wasser abzufüllen. Die neuen Mülltonnen stehen ab Donnerstag hinter dem Haus. Bei Fragen erreichen Sie uns montags und donnerstags von 14 bis 17 Uhr.",
            "items": [
              {"id":"H2-1","question":"Im Treppenhaus wird gestrichen.","correct":"richtig","explanation_vi":"die Fenster im Treppenhaus werden gestrichen."},
              {"id":"H2-2","question":"Der Haupteingang ist die ganze Woche gesperrt.","correct":"falsch","explanation_vi":"Chỉ từ thứ Hai đến thứ Tư."},
              {"id":"H2-3","question":"Am Dienstag gibt es drei Stunden kein Wasser.","correct":"richtig","explanation_vi":"Von 9 bis 12 Uhr abgestellt = 3 tiếng."},
              {"id":"H2-4","question":"Die neuen Mülltonnen stehen vor dem Haus.","correct":"falsch","explanation_vi":"Thùng rác mới ở phía sau nhà."},
              {"id":"H2-5","question":"Die Hausverwaltung ist auch donnerstags erreichbar.","correct":"richtig","explanation_vi":"montags und donnerstags von 14 bis 17 Uhr."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Makler: Guten Tag, schön dass Sie da sind. Das ist also die Wohnung. Interessentin: Sehr hell. Wie hoch sind die Nebenkosten? Makler: 180 Euro im Monat, Heizung und Wasser sind dabei, Strom nicht. Interessentin: Und gibt es einen Keller? Makler: Ja, ein Kellerraum mit sechs Quadratmetern gehört dazu. Interessentin: Wann könnte ich einziehen? Makler: Die Wohnung ist ab dem ersten Nächsten frei. Interessentin: Darf ich einen Hund halten? Makler: Kleine Hunde sind erlaubt, große müssen Sie vorher anmelden.",
            "items": [
              {"id":"H3-1","question":"Wie hoch sind die Nebenkosten?","options":{"A":"180 Euro","B":"80 Euro","C":"280 Euro"},"correct":"A","explanation_vi":"180 Euro im Monat."},
              {"id":"H3-2","question":"Was ist in den Nebenkosten nicht enthalten?","options":{"A":"Strom","B":"Wasser","C":"Heizung"},"correct":"A","explanation_vi":"Strom nicht = không gồm tiền điện."},
              {"id":"H3-3","question":"Was gehört zur Wohnung?","options":{"A":"Ein Balkon","B":"Eine Garage","C":"Ein Kellerraum"},"correct":"C","explanation_vi":"ein Kellerraum mit sechs Quadratmetern."},
              {"id":"H3-4","question":"Ab wann ist die Wohnung frei?","options":{"A":"Ab dem ersten nächsten Monat","B":"Sofort heute","C":"Erst in einem Jahr"},"correct":"A","explanation_vi":"ab dem ersten Nächsten = đầu tháng sau."},
              {"id":"H3-5","question":"Was sagt der Makler über Hunde?","options":{"A":"Hunde sind verboten","B":"Kleine Hunde sind erlaubt","C":"Nur große Hunde sind erlaubt"},"correct":"B","explanation_vi":"Kleine Hunde sind erlaubt."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Aussagen. Welche Meinung A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 người phát biểu, ghép mỗi người với ý kiến A–E",
            "context": "A = Diese Person möchte lieber auf dem Land wohnen.\nB = Diese Person findet die Miete zu hoch.\nC = Diese Person hat sehr nette Nachbarn.\nD = Diese Person braucht unbedingt einen Balkon.\nE = Diese Person möchte bald in eine größere Wohnung ziehen.",
            "audio_script": "Sprecher 1: Ohne Balkon halte ich es nicht aus, ich frühstücke im Sommer jeden Morgen draußen.\nSprecher 2: Fast die Hälfte meines Gehalts geht für die Wohnung weg, das ist einfach zu viel.\nSprecher 3: Wenn ich im Urlaub bin, gießen die Leute von nebenan meine Pflanzen und holen die Post.\nSprecher 4: In der Stadt ist mir alles zu laut, ich träume von einem Haus mit Garten außerhalb.\nSprecher 5: Mit dem zweiten Kind wird es zu eng, wir suchen etwas mit vier Zimmern.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 1 cần ban công."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 2 thấy tiền thuê quá cao."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 3 khen hàng xóm tốt bụng."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 4 muốn về vùng quê."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 5 cần nhà rộng hơn."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Formular für die Anmeldung beim Einwohnermeldeamt aus.",
            "instruction_vi": "Điền form đăng ký thường trú tại cơ quan quản lý cư trú",
            "form_fields": [
              {"field":"Vorname und Familienname","instruction_vi":"Họ và tên"},
              {"field":"Neue Adresse","instruction_vi":"Địa chỉ mới"},
              {"field":"Einzugsdatum","instruction_vi":"Ngày chuyển vào"},
              {"field":"Anzahl der Personen","instruction_vi":"Số người cùng ở"},
              {"field":"Telefonnummer","instruction_vi":"Số điện thoại"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 40 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn và viết thư trả lời ~40 từ, đủ cả 3 ý",
            "input_email": "Betreff: Hilfe beim Umzug\nHallo, am Samstag ziehe ich um. Kannst du mir helfen? Ab wann hast du Zeit? Und kennst du jemanden mit einem großen Auto? Danke, Marek",
            "writing_points": ["Ob du helfen kannst", "Ab wann du Zeit hast", "Ob du jemanden mit einem Auto kennst"]
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Beschreiben Sie Ihre Wohnung.",
            "instruction_vi": "Mô tả nơi ở của bạn",
            "prompt_words": ["Wie viele Zimmer?", "Wo?", "Seit wann?", "Was gefällt?", "Was fehlt?", "Nachbarn?"]
          },
          {
            "teil": 2,
            "type": "TOPIC_TALK",
            "instruction_de": "Sprechen Sie über das Thema und antworten Sie auf Fragen.",
            "instruction_vi": "Nói về chủ đề rồi trả lời câu hỏi",
            "topic_cards": [
              {"card":"Nachbarn","question_to_ask":"Wie ist der Kontakt zu Ihren Nachbarn?","possible_answer":"Wir grüßen uns immer und manchmal trinken wir zusammen Kaffee."},
              {"card":"Stadt oder Land","question_to_ask":"Wo möchten Sie lieber wohnen?","possible_answer":"Ich wohne lieber in der Stadt, weil ich alles zu Fuß erreichen kann."},
              {"card":"Hausarbeit","question_to_ask":"Wer macht bei Ihnen die Hausarbeit?","possible_answer":"Wir teilen uns die Arbeit: Ich koche und mein Partner putzt."}
            ]
          },
          {
            "teil": 3,
            "type": "PLAN_TOGETHER",
            "instruction_de": "Planen Sie etwas gemeinsam mit Ihrem Partner.",
            "instruction_vi": "Cùng bạn thi lên kế hoạch cho tình huống sau",
            "prompt": "Situation: Die Nachbarn im Haus möchten ein kleines Hoffest organisieren.\nSprechen Sie über: Wann? Wer lädt ein? Was zu essen? Wer räumt auf? Was tun bei Regen?\nMachen Sie Vorschläge, reagieren Sie auf Ihren Partner und einigen Sie sich."
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
