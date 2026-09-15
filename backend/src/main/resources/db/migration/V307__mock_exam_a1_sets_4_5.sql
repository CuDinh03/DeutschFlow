-- V307: Hai đề thi thử A1 (Set 4, Set 5) — đủ cho A1 5 đề đầy đủ 4 kỹ năng.
-- Cấu trúc theo Goethe Start Deutsch 1: Lesen 15 câu · Hören 15 câu · Schreiben (form + thư) ·
-- Sprechen 3 Teil. Mỗi phần 25 điểm; điểm quy về thang phần theo số câu thật (xem ExamScoringService).
-- Chỉ dùng các dạng mà trình chạy vẽ được: options/richtig-falsch/chữ cái, form_fields, input_email,
-- prompt_words, topic_cards, prompt.

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'A1', 'GOETHE',
  'Goethe Start Deutsch 1 – Set 4',
  'Đề thi thử Goethe A1 – Chủ đề: Nhà ở, Mua sắm, Trong thành phố',
  100, 60, 75,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc tin nhắn/ghi chú và chọn Richtig (đúng) hoặc Falsch (sai)",
            "items": [
              {"id":"L1-1","text":"Notiz von Frau Weber: Der Hausmeister kommt am Dienstag um 9 Uhr. Bitte bleiben Sie zu Hause.","question":"Der Hausmeister kommt am Montag.","correct":"falsch","explanation_vi":"Ghi chú nói rõ thứ Ba (Dienstag), không phải thứ Hai (Montag)."},
              {"id":"L1-2","text":"SMS von Tom: Ich bin schon im Supermarkt. Brauchst du noch Milch und Brot?","question":"Tom ist im Supermarkt.","correct":"richtig","explanation_vi":"Câu đầu tin nhắn: Ich bin schon im Supermarkt = Tôi đang ở siêu thị."},
              {"id":"L1-3","text":"E-Mail: Liebe Nachbarn, am Samstag putzen wir zusammen den Hof. Bitte kommen Sie um 10 Uhr.","question":"Die Nachbarn treffen sich am Samstag um 10 Uhr.","correct":"richtig","explanation_vi":"Thư hẹn thứ Bảy lúc 10 giờ để cùng dọn sân."},
              {"id":"L1-4","text":"Zettel an der Tür: Die Waschmaschine im Keller ist kaputt. Ein Techniker kommt am Freitag.","question":"Man kann heute im Keller waschen.","correct":"falsch","explanation_vi":"Máy giặt hỏng (kaputt), thợ đến thứ Sáu nên hôm nay chưa giặt được."},
              {"id":"L1-5","text":"Nachricht: Der Deutschkurs am Mittwoch fällt aus. Der nächste Kurs ist am Freitag.","question":"Am Mittwoch gibt es keinen Deutschkurs.","correct":"richtig","explanation_vi":"fällt aus = bị huỷ, nên thứ Tư không có lớp."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 mẩu quảng cáo A–E rồi chọn quảng cáo hợp với từng người",
            "context": "A = Möbelhaus Nord: gebrauchte Sofas und Tische, günstig, Lieferung möglich, Mo bis Sa 10 bis 18 Uhr.\nB = Wochenmarkt am Rathausplatz: frisches Obst und Gemüse, jeden Samstag 7 bis 13 Uhr.\nC = Fahrradladen Rollo: Reparatur in 24 Stunden, auch für alte Räder, Di bis Fr 9 bis 17 Uhr.\nD = Buchhandlung Lesezeit: Bücher auf Deutsch und Englisch, kleines Lesecafé, täglich bis 20 Uhr.\nE = Sprachschule Fluss: Deutschkurse am Abend, kleine Gruppen, Anmeldung online.",
            "items": [
              {"id":"L2-1","person":"Frau Kim braucht einen billigen Tisch für ihre neue Wohnung.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"Chỉ quảng cáo A bán bàn ghế cũ giá rẻ."},
              {"id":"L2-2","person":"Herr Bauer möchte am Samstagmorgen frisches Gemüse kaufen.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"Chợ phiên B họp sáng thứ Bảy, bán rau quả tươi."},
              {"id":"L2-3","person":"Lan sucht einen Deutschkurs nach der Arbeit am Abend.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E là trường ngoại ngữ có lớp buổi tối (am Abend)."},
              {"id":"L2-4","person":"Tom hat einen Platten am Fahrrad und braucht schnell Hilfe.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C sửa xe đạp trong 24 giờ."},
              {"id":"L2-5","person":"Marie möchte ein englisches Buch kaufen und dort Kaffee trinken.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D bán sách tiếng Anh và có quán cà phê đọc sách."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Schilder. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc biển báo/thông báo và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Am Hauseingang: Bitte die Tür immer schließen. Kein Zutritt für Fremde.","question":"Man darf die Tür offen lassen.","correct":"falsch","explanation_vi":"immer schließen = luôn đóng cửa."},
              {"id":"L3-2","text":"Im Supermarkt: Heute Sonderangebot — Kartoffeln 2,5 kg für 1,99 Euro.","question":"Kartoffeln sind heute im Angebot.","correct":"richtig","explanation_vi":"Sonderangebot = hàng khuyến mãi hôm nay."},
              {"id":"L3-3","text":"Am Aufzug: Bei Feuer den Aufzug nicht benutzen. Bitte die Treppe nehmen.","question":"Bei Feuer soll man die Treppe nehmen.","correct":"richtig","explanation_vi":"Biển ghi rõ: khi cháy đi cầu thang, không dùng thang máy."},
              {"id":"L3-4","text":"Am Kiosk: Wir haben von 6 bis 20 Uhr geöffnet. Sonntag geschlossen.","question":"Der Kiosk ist am Sonntag offen.","correct":"falsch","explanation_vi":"Sonntag geschlossen = Chủ nhật đóng cửa."},
              {"id":"L3-5","text":"In der Bibliothek: Bitte leise sprechen. Essen und Trinken sind verboten.","question":"In der Bibliothek darf man essen.","correct":"falsch","explanation_vi":"Essen und Trinken sind verboten = cấm ăn uống."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe từng đoạn hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Entschuldigung, wo ist die Post? B: Gehen Sie geradeaus und dann links. Die Post ist neben der Apotheke.","question":"Wo ist die Post?","options":{"A":"Neben der Apotheke","B":"Neben der Bäckerei","C":"Neben dem Bahnhof"},"correct":"A","explanation_vi":"Câu trả lời: die Post ist neben der Apotheke (cạnh hiệu thuốc)."},
              {"id":"H1-2","audio_script":"A: Wann kommt der Bus Nummer 12? B: In fünf Minuten, um 14 Uhr 20.","question":"Wann kommt der Bus?","options":{"A":"Um 14 Uhr 10","B":"Um 14 Uhr 20","C":"Um 14 Uhr 30"},"correct":"B","explanation_vi":"Người trả lời nói um 14 Uhr 20."},
              {"id":"H1-3","audio_script":"Guten Tag, hier ist die Praxis Doktor Klein. Ihr Termin am Donnerstag ist um 11 Uhr, nicht um 9 Uhr.","question":"Wann ist der Termin?","options":{"A":"Um 9 Uhr","B":"Um 10 Uhr","C":"Um 11 Uhr"},"correct":"C","explanation_vi":"Phòng khám đổi lịch: um 11 Uhr, nicht um 9 Uhr."},
              {"id":"H1-4","audio_script":"A: Was kostet das Zimmer pro Nacht? B: Mit Frühstück 45 Euro, ohne Frühstück 38 Euro.","question":"Was kostet das Zimmer mit Frühstück?","options":{"A":"38 Euro","B":"53 Euro","C":"45 Euro"},"correct":"C","explanation_vi":"mit Frühstück = 45 Euro."},
              {"id":"H1-5","audio_script":"A: Ich möchte zwei Kilo Äpfel, bitte. B: Gern. Das macht 4 Euro 40.","question":"Wie viel bezahlt die Kundin?","options":{"A":"2 Euro 40","B":"14 Euro","C":"4 Euro 40"},"correct":"C","explanation_vi":"Das macht 4 Euro 40 = tổng tiền phải trả."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Durchsage. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo trong siêu thị rồi chọn Richtig hoặc Falsch",
            "audio_script": "Liebe Kundinnen und Kunden, herzlich willkommen im Markt Sonnenblume. Heute finden Sie frische Erdbeeren im Angebot: eine Schale kostet nur einen Euro fünfzig. Unsere Bäckerei schließt heute schon um 18 Uhr, der Markt ist bis 20 Uhr geöffnet. Am Samstag ist unser Markt von 8 bis 16 Uhr für Sie da. Bitte beachten Sie: Am Sonntag bleibt der Markt geschlossen. Vielen Dank für Ihren Einkauf.",
            "items": [
              {"id":"H2-1","question":"Die Erdbeeren kosten einen Euro fünfzig pro Schale.","correct":"richtig","explanation_vi":"Thông báo: eine Schale kostet nur einen Euro fünfzig."},
              {"id":"H2-2","question":"Die Bäckerei schließt um 20 Uhr.","correct":"falsch","explanation_vi":"Tiệm bánh đóng lúc 18 giờ, siêu thị mới mở đến 20 giờ."},
              {"id":"H2-3","question":"Am Samstag ist der Markt von 8 bis 16 Uhr geöffnet.","correct":"richtig","explanation_vi":"Đúng như câu về thứ Bảy trong thông báo."},
              {"id":"H2-4","question":"Am Sonntag kann man hier einkaufen.","correct":"falsch","explanation_vi":"Am Sonntag bleibt der Markt geschlossen = Chủ nhật đóng cửa."},
              {"id":"H2-5","question":"Die Durchsage kommt aus einem Supermarkt.","correct":"richtig","explanation_vi":"Người nói chào khách trong Markt Sonnenblume."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Nachrichten auf dem Anrufbeantworter und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe tin nhắn thoại và chọn đáp án đúng",
            "items": [
              {"id":"H3-1","audio_script":"Hallo Minh, hier ist Julia. Ich kann heute nicht kommen, ich bin krank. Können wir uns morgen um 17 Uhr treffen?","question":"Warum kommt Julia heute nicht?","options":{"A":"Sie muss arbeiten","B":"Sie ist krank","C":"Sie hat keine Zeit am Abend"},"correct":"B","explanation_vi":"ich bin krank = tôi bị ốm."},
              {"id":"H3-2","audio_script":"Guten Tag, hier ist die Autowerkstatt Meyer. Ihr Auto ist fertig. Sie können es ab morgen früh abholen.","question":"Was soll der Kunde tun?","options":{"A":"Einen neuen Termin machen","B":"Die Werkstatt anrufen","C":"Das Auto abholen"},"correct":"C","explanation_vi":"Xe đã sửa xong, khách đến lấy (abholen)."},
              {"id":"H3-3","audio_script":"Hallo, hier ist Frau Sommer von der Sprachschule. Ihr Kurs beginnt nicht am Montag, sondern erst am Mittwoch.","question":"Wann beginnt der Kurs?","options":{"A":"Am Mittwoch","B":"Am Dienstag","C":"Am Montag"},"correct":"A","explanation_vi":"nicht am Montag, sondern erst am Mittwoch."},
              {"id":"H3-4","audio_script":"Hi Papa, ich bin noch bei Lena. Kannst du mich um acht Uhr am Bahnhof abholen? Danke.","question":"Wo soll der Vater sein Kind abholen?","options":{"A":"Zu Hause bei Lena","B":"In der Schule","C":"Am Bahnhof"},"correct":"C","explanation_vi":"am Bahnhof abholen = đón ở nhà ga."},
              {"id":"H3-5","audio_script":"Guten Abend, hier ist das Restaurant Adler. Ihr Tisch für vier Personen ist am Freitag um 19 Uhr reserviert.","question":"Für wie viele Personen ist der Tisch?","options":{"A":"Für zwei Personen","B":"Für fünf Personen","C":"Für vier Personen"},"correct":"C","explanation_vi":"Tisch für vier Personen = bàn cho 4 người."}
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
            "instruction_de": "Füllen Sie das Anmeldeformular für die Stadtbibliothek aus.",
            "instruction_vi": "Điền form đăng ký thẻ thư viện thành phố",
            "form_fields": [
              {"field":"Vorname","instruction_vi":"Tên"},
              {"field":"Familienname","instruction_vi":"Họ"},
              {"field":"Geburtsdatum","instruction_vi":"Ngày sinh"},
              {"field":"Adresse in Deutschland","instruction_vi":"Địa chỉ tại Đức"},
              {"field":"Telefonnummer","instruction_vi":"Số điện thoại"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 30 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn và viết thư trả lời ~30 từ, nói đủ cả 3 ý bên dưới",
            "input_email": "Betreff: Neue Wohnung\nHallo, ich habe gehört, du hast eine neue Wohnung! Wo wohnst du jetzt? Wie viele Zimmer hat die Wohnung? Wann kann ich dich besuchen? Liebe Grüße, Sara",
            "writing_points": ["Wo du jetzt wohnst", "Wie viele Zimmer die Wohnung hat", "Wann Sara dich besuchen kann"]
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
            "instruction_de": "Stellen Sie sich vor.",
            "instruction_vi": "Giới thiệu bản thân theo các từ khoá gợi ý",
            "prompt_words": ["Name?", "Alter?", "Land?", "Wohnort?", "Familie?", "Beruf?", "Hobbys?"]
          },
          {
            "teil": 2,
            "type": "QA_PARTNER",
            "instruction_de": "Stellen Sie Fragen und antworten Sie.",
            "instruction_vi": "Đặt câu hỏi và trả lời theo các thẻ chủ đề: Wohnen, Einkaufen, Verkehr",
            "topic_cards": [
              {"card":"Wohnen","question_to_ask":"Wie viele Zimmer hat Ihre Wohnung?","possible_answer":"Meine Wohnung hat zwei Zimmer, eine Küche und ein Bad."},
              {"card":"Einkaufen","question_to_ask":"Wo kaufen Sie Obst und Gemüse?","possible_answer":"Ich kaufe Obst und Gemüse auf dem Markt, dort ist alles frisch."},
              {"card":"Verkehr","question_to_ask":"Wie kommen Sie zur Arbeit?","possible_answer":"Ich fahre mit dem Bus zur Arbeit, das dauert zwanzig Minuten."}
            ]
          },
          {
            "teil": 3,
            "type": "REQUEST_RESPOND",
            "instruction_de": "Formulieren Sie eine Bitte und reagieren Sie auf die Bitte Ihres Partners.",
            "instruction_vi": "Nói một lời đề nghị và phản hồi lời đề nghị của bạn cùng thi",
            "prompt": "Bitten Sie in diesen Situationen um Hilfe und antworten Sie höflich:\n1. Im Möbelhaus: Sie brauchen Hilfe beim Tragen.\n2. Beim Nachbarn: Sie möchten kurz das Telefon benutzen.\n3. Im Supermarkt: Sie finden das Salz nicht.\nBeispiel: Entschuldigung, können Sie mir bitte helfen?"
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
),
(
  'A1', 'GOETHE',
  'Goethe Start Deutsch 1 – Set 5',
  'Đề thi thử Goethe A1 – Chủ đề: Sức khoẻ, Thời gian rảnh, Đi lại',
  100, 60, 75,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc tin nhắn/thông báo và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L1-1","text":"SMS von Mai: Ich habe Halsschmerzen und gehe heute zum Arzt. Der Termin ist um 15 Uhr.","question":"Mai geht heute zum Arzt.","correct":"richtig","explanation_vi":"Tin nhắn nói rõ hôm nay đi khám lúc 15 giờ."},
              {"id":"L1-2","text":"Aushang im Sportzentrum: Der Schwimmkurs für Anfänger beginnt am 3. Oktober, immer montags um 18 Uhr.","question":"Der Schwimmkurs ist am Wochenende.","correct":"falsch","explanation_vi":"montags = thứ Hai, không phải cuối tuần."},
              {"id":"L1-3","text":"E-Mail: Hallo Ben, mein Zug kommt um 9 Uhr 40 in Köln an. Holst du mich bitte ab?","question":"Ben soll zum Bahnhof kommen.","correct":"richtig","explanation_vi":"Người viết nhờ Ben ra ga đón lúc 9 giờ 40."},
              {"id":"L1-4","text":"Notiz: Die Apotheke am Markt hat diese Woche Notdienst, Tag und Nacht geöffnet.","question":"Die Apotheke ist nachts geschlossen.","correct":"falsch","explanation_vi":"Notdienst, Tag und Nacht geöffnet = mở cả ngày lẫn đêm."},
              {"id":"L1-5","text":"Nachricht vom Fitnessstudio: Am Feiertag ist das Studio nur bis 14 Uhr geöffnet.","question":"Am Feiertag schließt das Studio früher.","correct":"richtig","explanation_vi":"Ngày lễ chỉ mở đến 14 giờ, tức đóng sớm hơn."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_AD",
            "instruction_de": "Lesen Sie die Anzeigen A bis E. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Đọc 5 mẩu tin A–E và chọn tin hợp với từng người",
            "context": "A = Yoga im Park: jeden Sonntag 9 Uhr, für Anfänger, Matte mitbringen, kostenlos.\nB = Zahnarztpraxis Dr. Lang: Termine auch am Abend, Notfälle sofort, Anmeldung telefonisch.\nC = Fahrschule Blitz: Führerschein in acht Wochen, Theorie am Wochenende.\nD = Reisebüro Weitblick: günstige Bahntickets nach Berlin und Hamburg, Beratung auf Englisch.\nE = Volkshochschule: Kochkurs vietnamesische Küche, freitags 18 bis 21 Uhr.",
            "items": [
              {"id":"L2-1","person":"Herr Nam hat starke Zahnschmerzen und braucht heute Hilfe.","question":"Welche Anzeige passt?","correct":"B","explanation_vi":"Chỉ B nhận ca cấp cứu răng ngay trong ngày."},
              {"id":"L2-2","person":"Frau Chi möchte am Sonntagmorgen Sport im Freien machen.","question":"Welche Anzeige passt?","correct":"A","explanation_vi":"A là lớp yoga trong công viên sáng Chủ nhật."},
              {"id":"L2-3","person":"Tuan will billig mit dem Zug nach Hamburg fahren.","question":"Welche Anzeige passt?","correct":"D","explanation_vi":"D bán vé tàu giá rẻ đi Berlin và Hamburg."},
              {"id":"L2-4","person":"Lisa möchte freitagabends kochen lernen.","question":"Welche Anzeige passt?","correct":"E","explanation_vi":"E là lớp nấu ăn tối thứ Sáu."},
              {"id":"L2-5","person":"Jan braucht schnell einen Führerschein und hat nur am Wochenende Zeit.","question":"Welche Anzeige passt?","correct":"C","explanation_vi":"C dạy lý thuyết vào cuối tuần, lấy bằng trong 8 tuần."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Schilder. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc biển báo và chọn Richtig hoặc Falsch",
            "items": [
              {"id":"L3-1","text":"Im Bus: Fahrkarten bitte vorne beim Fahrer kaufen. Kein Bargeld über 20 Euro.","question":"Man kauft die Fahrkarte hinten im Bus.","correct":"falsch","explanation_vi":"vorne beim Fahrer = mua ở phía trước, chỗ tài xế."},
              {"id":"L3-2","text":"In der Praxis: Bitte die Versichertenkarte an der Anmeldung abgeben.","question":"Man gibt die Karte an der Anmeldung ab.","correct":"richtig","explanation_vi":"Biển ghi rõ nộp thẻ bảo hiểm ở quầy tiếp nhận."},
              {"id":"L3-3","text":"Am Bahnsteig: Zug nach München heute 15 Minuten später.","question":"Der Zug nach München kommt pünktlich.","correct":"falsch","explanation_vi":"15 Minuten später = trễ 15 phút."},
              {"id":"L3-4","text":"Im Schwimmbad: Duschen vor dem Schwimmen. Kein Essen am Beckenrand.","question":"Vor dem Schwimmen soll man duschen.","correct":"richtig","explanation_vi":"Duschen vor dem Schwimmen = tắm trước khi bơi."},
              {"id":"L3-5","text":"Am Parkautomaten: Parken Montag bis Freitag 8 bis 18 Uhr gebührenpflichtig. Samstag und Sonntag frei.","question":"Am Samstag muss man für das Parken bezahlen.","correct":"falsch","explanation_vi":"Thứ Bảy và Chủ nhật miễn phí (frei)."}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Gespräche und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Guten Tag, ich habe seit gestern Kopfschmerzen. B: Nehmen Sie diese Tabletten, dreimal am Tag nach dem Essen.","question":"Wie oft soll der Patient die Tabletten nehmen?","options":{"A":"Einmal am Tag","B":"Zweimal am Tag","C":"Dreimal am Tag"},"correct":"C","explanation_vi":"dreimal am Tag = ba lần mỗi ngày."},
              {"id":"H1-2","audio_script":"A: Fährt dieser Zug nach Leipzig? B: Nein, dieser fährt nach Dresden. Der Zug nach Leipzig fährt von Gleis 5.","question":"Von welchem Gleis fährt der Zug nach Leipzig?","options":{"A":"Von Gleis 5","B":"Von Gleis 3","C":"Von Gleis 15"},"correct":"A","explanation_vi":"Der Zug nach Leipzig fährt von Gleis 5."},
              {"id":"H1-3","audio_script":"A: Was machst du am Wochenende? B: Am Samstag spiele ich Fußball, am Sonntag besuche ich meine Eltern.","question":"Was macht die Person am Sonntag?","options":{"A":"Die Eltern besuchen","B":"Fußball spielen","C":"Arbeiten"},"correct":"A","explanation_vi":"am Sonntag besuche ich meine Eltern."},
              {"id":"H1-4","audio_script":"A: Wie lange dauert der Film? B: Ungefähr zwei Stunden. Er beginnt um 20 Uhr und endet um 22 Uhr.","question":"Wie lange dauert der Film?","options":{"A":"Eine Stunde","B":"Zwei Stunden","C":"Drei Stunden"},"correct":"B","explanation_vi":"ungefähr zwei Stunden, từ 20 đến 22 giờ."},
              {"id":"H1-5","audio_script":"A: Entschuldigung, wo finde ich die Anmeldung? B: Im ersten Stock, links neben dem Aufzug.","question":"Wo ist die Anmeldung?","options":{"A":"Im Erdgeschoss","B":"Im ersten Stock","C":"Im zweiten Stock"},"correct":"B","explanation_vi":"Im ersten Stock = tầng một (trên tầng trệt)."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie die Durchsage am Bahnhof. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe thông báo ở nhà ga rồi chọn Richtig hoặc Falsch",
            "audio_script": "Sehr geehrte Fahrgäste, Achtung an Gleis 3: Der Regionalzug nach Frankfurt, Abfahrt 16 Uhr 12, hat heute etwa 20 Minuten Verspätung. Der Grund ist eine Reparatur an der Strecke. Reisende nach Frankfurt können auch den Zug um 16 Uhr 40 von Gleis 7 nehmen. Die Fahrkarten gelten in beiden Zügen. Der Speisewagen ist heute leider geschlossen. Wir danken für Ihr Verständnis.",
            "items": [
              {"id":"H2-1","question":"Der Zug nach Frankfurt hat Verspätung.","correct":"richtig","explanation_vi":"Thông báo: etwa 20 Minuten Verspätung."},
              {"id":"H2-2","question":"Der Grund für die Verspätung ist das Wetter.","correct":"falsch","explanation_vi":"Lý do là sửa đường ray (Reparatur an der Strecke)."},
              {"id":"H2-3","question":"Reisende können den Zug um 16 Uhr 40 nehmen.","correct":"richtig","explanation_vi":"Có chuyến thay thế lúc 16 giờ 40 ở sân ga 7."},
              {"id":"H2-4","question":"Die Fahrkarten gelten nur im ersten Zug.","correct":"falsch","explanation_vi":"Die Fahrkarten gelten in beiden Zügen = vé dùng được cho cả hai tàu."},
              {"id":"H2-5","question":"Der Speisewagen ist heute geschlossen.","correct":"richtig","explanation_vi":"Câu cuối thông báo nói toa ăn đóng cửa."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Nachrichten und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe tin nhắn thoại và chọn đáp án đúng",
            "items": [
              {"id":"H3-1","audio_script":"Hallo Anh, hier ist Doktor Weber. Ihre Blutwerte sind in Ordnung. Sie brauchen keinen neuen Termin.","question":"Was sagt der Arzt?","options":{"A":"Anh muss ins Krankenhaus","B":"Die Werte sind in Ordnung","C":"Anh braucht einen neuen Termin"},"correct":"B","explanation_vi":"Ihre Blutwerte sind in Ordnung = kết quả máu ổn."},
              {"id":"H3-2","audio_script":"Guten Tag, hier ist das Schwimmbad Wellenberg. Wegen Reparatur bleibt das Bad bis Freitag geschlossen.","question":"Warum ist das Schwimmbad geschlossen?","options":{"A":"Wegen Ferien","B":"Wegen eines Festes","C":"Wegen Reparatur"},"correct":"C","explanation_vi":"Wegen Reparatur = vì sửa chữa."},
              {"id":"H3-3","audio_script":"Hi Lan, wir treffen uns nicht im Kino, sondern direkt im Café gegenüber. Bis später!","question":"Wo treffen sich die Freunde?","options":{"A":"Im Kino","B":"Im Café","C":"Zu Hause"},"correct":"B","explanation_vi":"nicht im Kino, sondern im Café."},
              {"id":"H3-4","audio_script":"Guten Abend, hier ist die Fahrschule. Ihre Theorieprüfung ist am Montag um 8 Uhr 30, bitte bringen Sie Ihren Pass mit.","question":"Was soll die Person mitbringen?","options":{"A":"Ein Foto","B":"Den Pass","C":"Geld"},"correct":"B","explanation_vi":"bringen Sie Ihren Pass mit = mang hộ chiếu."},
              {"id":"H3-5","audio_script":"Hallo, hier ist Tom. Ich habe zwei Karten für das Konzert am Samstag. Hast du Lust mitzukommen?","question":"Was möchte Tom?","options":{"A":"Karten verkaufen","B":"Am Samstag arbeiten","C":"Zusammen ins Konzert gehen"},"correct":"C","explanation_vi":"Hast du Lust mitzukommen = rủ cùng đi nghe nhạc."}
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
            "instruction_vi": "Điền form đăng ký vào câu lạc bộ thể thao",
            "form_fields": [
              {"field":"Vorname","instruction_vi":"Tên"},
              {"field":"Familienname","instruction_vi":"Họ"},
              {"field":"Geburtsjahr","instruction_vi":"Năm sinh"},
              {"field":"Sportart","instruction_vi":"Môn thể thao muốn tập"},
              {"field":"E-Mail","instruction_vi":"Địa chỉ email"}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 30 Wörter) zu allen drei Punkten.",
            "instruction_vi": "Đọc tin nhắn và viết thư trả lời ~30 từ, nói đủ cả 3 ý",
            "input_email": "Betreff: Ausflug am Sonntag\nHallo, wir machen am Sonntag einen Ausflug an den See. Kommst du mit? Wann sollen wir losfahren? Was bringst du zum Essen mit? Viele Grüße, Jonas",
            "writing_points": ["Ob du mitkommst", "Wann ihr losfahren sollt", "Was du zum Essen mitbringst"]
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
            "instruction_de": "Stellen Sie sich vor.",
            "instruction_vi": "Giới thiệu bản thân theo các từ khoá gợi ý",
            "prompt_words": ["Name?", "Alter?", "Woher?", "Sprachen?", "Beruf?", "Sport?", "Lieblingsessen?"]
          },
          {
            "teil": 2,
            "type": "QA_PARTNER",
            "instruction_de": "Stellen Sie Fragen und antworten Sie.",
            "instruction_vi": "Đặt câu hỏi và trả lời theo các thẻ chủ đề: Gesundheit, Freizeit, Reisen",
            "topic_cards": [
              {"card":"Gesundheit","question_to_ask":"Was machen Sie, wenn Sie krank sind?","possible_answer":"Wenn ich krank bin, trinke ich viel Tee und gehe zum Arzt."},
              {"card":"Freizeit","question_to_ask":"Was machen Sie am Wochenende gern?","possible_answer":"Am Wochenende gehe ich gern spazieren und koche mit Freunden."},
              {"card":"Reisen","question_to_ask":"Wohin möchten Sie einmal reisen?","possible_answer":"Ich möchte einmal nach Österreich reisen, dort sind die Berge sehr schön."}
            ]
          },
          {
            "teil": 3,
            "type": "REQUEST_RESPOND",
            "instruction_de": "Formulieren Sie eine Bitte und reagieren Sie auf die Bitte Ihres Partners.",
            "instruction_vi": "Nói một lời đề nghị và phản hồi đề nghị của bạn cùng thi",
            "prompt": "Bitten Sie in diesen Situationen und antworten Sie höflich:\n1. In der Apotheke: Sie brauchen etwas gegen Husten.\n2. Am Bahnhof: Sie suchen den Fahrkartenautomaten.\n3. Im Hotel: Sie möchten das Frühstück später bekommen.\nBeispiel: Entschuldigung, könnten Sie mir bitte helfen?"
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
