-- Gói B — phần Nghe của đề telc B1 Set 1 đúng nghi thức và đúng thể loại đề thật (17/09/2026).
--
-- Đối chiếu bộ đề pilot V325 với 10 Test của Klett „So geht's noch besser zum ZD", 20 file CD và
-- Übungstest 1 chính thức của telc (2020) cho thấy phần Nghe lệch chuẩn ở bốn chỗ:
--   • Teil 1 dùng THÔNG BÁO (Durchsage) rời rạc — đề thật là NĂM LỜI KỂ của năm người về cùng một
--     chủ đề, có câu khung dẫn vào; mỗi bài 60–110 từ (34–48 giây), không phải 24 từ.
--   • Teil 2 dài 187 từ — đề thật là phỏng vấn radio 500–650 từ (≈4 phút), mở bằng lời chào
--     radio, kết bằng lời cảm ơn; 10 mệnh đề đi đúng thứ tự bài.
--   • Teil 3 thiếu câu dẫn tình huống trước từng bài („Im Radio hören Sie folgenden Hinweis.")
--     và ngắn hơn một nửa (21–29 từ so với 40–90).
--   • Không có câu dẫn (Ansage) nguyên văn và không có thời gian đọc câu hỏi 30 s / 60 s.
--
-- Khoá mới ở cấp Teil: `ansage_de` (câu dẫn nguyên văn — lấy theo Übungstest công khai của telc,
-- là văn bản nghi thức chung của kỳ thi), `reading_seconds` (30 / 60 / 0), `framing_de` (câu khung
-- Teil 1). Ở cấp câu: `lead_in_de` (câu dẫn tình huống Teil 3) và `speaker` (PRUEFER = giọng nữ
-- ANNA, PARTNER = giọng nam THOMAS — xen kẽ ở Teil 1). Đề Goethe không khai ⇒ trình chạy như cũ.
--
-- Nội dung SOẠN GỐC (repo PUBLIC, không chép sách hay đề rò rỉ). Đáp án và id câu 41–60 GIỮ NGUYÊN
-- so với V325 nên bài thi đã nộp không đổi điểm; chỉ bài nghe dài ra và đúng thể loại.
--
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325). Chỉ thay phần tử thứ 3 (HOEREN) của mảng sections;
-- WHERE kiểm đúng đề và đúng vị trí để không ghi đè nhầm đề khác hoặc phần khác.

UPDATE mock_exams
SET sections_json = jsonb_set(sections_json, '{sections,2}', $j$
{
  "name": "HOEREN",
  "label_vi": "Nghe",
  "time_minutes": 30,
  "max_points": 75,
  "teile": [
    {
      "teil": 1,
      "point_per_item": 5,
      "max_plays": 1,
      "reading_seconds": 30,
      "ansage_de": "Hörverstehen, Teil 1. Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41 bis 45 richtig oder falsch sind. Lesen Sie jetzt die Aufgaben 41 bis 45. Sie haben dazu 30 Sekunden Zeit.",
      "framing_de": "Wie kommen die Menschen morgens zur Arbeit oder zur Schule? Wir haben fünf Personen auf der Straße gefragt: „Wie kommen Sie zur Arbeit oder zur Schule, und warum so?“ Hören Sie dazu die Antworten.",
      "instruction_de": "Sie hören nun fünf kurze Texte. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind.",
      "instruction_vi": "Nghe 5 người kể về cùng một chủ đề, mỗi người CHỈ MỘT LẦN. Sau hướng dẫn có 30 giây đọc câu hỏi. Chọn đúng hoặc sai.",
      "items": [
        {
          "id": "HV1-41",
          "speaker": "PRUEFER",
          "question": "Die Sprecherin fährt auch im Winter mit dem Fahrrad zur Arbeit.",
          "audio_script": "Nummer 41. Ich fahre eigentlich das ganze Jahr mit dem Fahrrad ins Büro, auch im Winter. Viele Kollegen finden das verrückt, aber ich habe gute Regenkleidung und ein helles Licht am Rad. Es sind nur sechs Kilometer, das schaffe ich in zwanzig Minuten. Mit dem Auto würde ich morgens im Stau stehen und danach noch einen Parkplatz suchen. So bin ich schon wach, wenn ich ankomme, und ich spare mir das Fitnessstudio. Nur wenn es richtig Glatteis gibt, nehme ich ausnahmsweise die Straßenbahn.",
          "correct": "richtig",
          "explanation_vi": "„das ganze Jahr … auch im Winter“ — chỉ khi có băng trơn mới đi tàu điện ⇒ ĐÚNG."
        },
        {
          "id": "HV1-42",
          "speaker": "PARTNER",
          "question": "Zu der Bäckerei, in der der Sprecher arbeitet, fährt überhaupt kein Bus.",
          "audio_script": "Nummer 42. Ich arbeite in einer Bäckerei und fange um vier Uhr morgens an. Um diese Zeit fährt bei uns natürlich kein Bus, also nehme ich das Auto. Wenn ich Spätschicht habe, könnte ich eigentlich mit dem Bus fahren, der fährt tagsüber alle zwanzig Minuten direkt bis vor die Tür. Aber ehrlich gesagt bin ich dann zu bequem, um an der Haltestelle zu warten. Das Benzin ist teuer, das stimmt schon. Meine Frau sagt immer, ich soll wenigstens im Sommer das Rad nehmen. Vielleicht mache ich das nächstes Jahr wirklich.",
          "correct": "falsch",
          "explanation_vi": "Ban ngày xe buýt chạy „alle zwanzig Minuten direkt bis vor die Tür“ — chỉ 4 giờ sáng không có ⇒ SAI."
        },
        {
          "id": "HV1-43",
          "speaker": "PRUEFER",
          "question": "Die Sprecherin findet die tägliche Zugfahrt anstrengend und verlorene Zeit.",
          "audio_script": "Nummer 43. Ich pendle jeden Tag von Augsburg nach München, das sind ungefähr fünfzig Minuten mit dem Zug. Am Anfang dachte ich, das halte ich nicht lange aus. Aber inzwischen ist die Fahrt meine ruhigste Zeit am Tag. Morgens lese ich Zeitung oder beantworte schon die ersten E-Mails, abends höre ich Musik und schlafe manchmal ein bisschen. Zu Hause mit zwei kleinen Kindern hätte ich diese Ruhe nie. Teuer ist die Monatskarte schon, aber mein Arbeitgeber bezahlt die Hälfte.",
          "correct": "falsch",
          "explanation_vi": "Ngược lại: „die Fahrt ist meine ruhigste Zeit am Tag“ — đọc báo, nghe nhạc, trả lời mail ⇒ SAI."
        },
        {
          "id": "HV1-44",
          "speaker": "PARTNER",
          "question": "Der Sprecher geht seit einem Jahr zu Fuß zur Schule.",
          "audio_script": "Nummer 44. Ich gehe zu Fuß, meine Schule ist nur eine Viertelstunde von unserer Wohnung entfernt. Früher hat mich meine Mutter jeden Morgen mit dem Auto gebracht, weil sie sowieso zur Arbeit musste. Seit einem Jahr will ich das nicht mehr, vor dem Schultor stehen morgens sowieso viel zu viele Autos. Jetzt treffe ich mich an der Ecke mit zwei Freunden, und wir laufen zusammen und reden. Wenn es stark regnet, nehme ich den Bus, aber das passiert selten.",
          "correct": "richtig",
          "explanation_vi": "„Seit einem Jahr will ich das nicht mehr“ — thôi để mẹ chở, đi bộ với bạn ⇒ ĐÚNG."
        },
        {
          "id": "HV1-45",
          "speaker": "PRUEFER",
          "question": "Die Sprecherin geht jeden Morgen fünfzehn Minuten zu Fuß bis zur U-Bahn-Station.",
          "audio_script": "Nummer 45. Bei mir ist es eine Kombination: Ich fahre mit dem Roller zur U-Bahn-Station, das sind fünf Minuten, und dann noch acht Stationen mit der U-Bahn bis zum Büro. Den Roller darf ich mitnehmen, weil er sich zusammenklappen lässt. Ohne ihn müsste ich fünfzehn Minuten zur Station laufen oder auf den Bus warten, der nie pünktlich ist. Im Büro stelle ich ihn einfach unter den Schreibtisch. Meine Chefin fand das am Anfang komisch, jetzt hat sie selbst einen.",
          "correct": "falsch",
          "explanation_vi": "Cô ấy đi Roller 5 phút tới ga; 15 phút đi bộ chỉ là „ohne ihn müsste ich…“ ⇒ SAI."
        }
      ]
    },
    {
      "teil": 2,
      "point_per_item": 2.5,
      "max_plays": 2,
      "reading_seconds": 60,
      "ansage_de": "Hörverstehen, Teil 2. Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46 bis 55 richtig oder falsch sind. Lesen Sie jetzt die Aufgaben 46 bis 55. Sie haben dazu eine Minute Zeit.",
      "instruction_de": "Sie hören nun ein Gespräch. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig oder falsch sind.",
      "instruction_vi": "Nghe một cuộc phỏng vấn radio, được nghe HAI LẦN. Sau hướng dẫn có một phút đọc câu hỏi. Các mệnh đề đi theo thứ tự bài.",
      "audio_script": [
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Guten Morgen, liebe Hörerinnen und Hörer. In unserer Reihe „Menschen in der Stadt“ begrüße ich heute Herrn Vogel. Herr Vogel, Sie leiten seit drei Jahren eine Fahrradwerkstatt, in der Jugendliche mitarbeiten. Wie kam es dazu?"
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Eigentlich war es ein Zufall. Ich habe früher in einem Büro gearbeitet, bei einer Versicherung, und nur am Wochenende Räder repariert, für Freunde und Nachbarn. Irgendwann standen ständig Nachbarskinder in meiner Garage und wollten zuschauen. Und dann haben sie angefangen mitzuhelfen. Am Anfang habe ich nur gesagt: Halt mal den Schraubenschlüssel. Ein paar Wochen später konnten zwei von ihnen schon allein einen Reifen wechseln."
        },
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Und daraus wurde dann ein richtiges Projekt?"
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Ja, aber erst nach zwei Jahren. So lange hat es gedauert, bis ich mich getraut habe, das Büro aufzugeben. Die Stadt hat uns dann eine alte Halle vermietet, günstig, aber sie war in schlechtem Zustand. Das Dach war undicht, es gab keine Heizung, und im Winter stand das Wasser auf dem Boden. Das Dach haben wir selbst repariert, mit den Jugendlichen zusammen. Das war eigentlich unser erstes gemeinsames Projekt, noch bevor das erste Fahrrad fertig war."
        },
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Wer kommt denn zu Ihnen in die Werkstatt?"
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Meistens Jugendliche zwischen vierzehn und achtzehn, fast alle aus dem Stadtteil. Einige kommen, weil ihr eigenes Rad kaputt ist und sie kein Geld für eine Reparatur haben. Andere bleiben dann und lernen, wie man repariert: Bremsen einstellen, einen Schlauch flicken, später auch schwierigere Sachen wie eine Gangschaltung. Wir zwingen niemanden. Wer nur zwei Stunden bleibt und dann nie wiederkommt, ist genauso willkommen wie die, die jeden Nachmittag da sind."
        },
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Bezahlen die Jugendlichen etwas dafür?"
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Nein, das Material bezahlen wir aus Spenden. Ein Fahrradladen in der Nähe gibt uns alte Teile, und einmal im Jahr machen wir ein kleines Fest, bei dem wir reparierte Räder verkaufen. Aber eine Regel gibt es: Wer ein Rad mitnehmen möchte, arbeitet vorher zehn Stunden bei uns mit. Das ist die einzige Regel, und sie funktioniert erstaunlich gut. Die meisten bleiben sowieso länger als zehn Stunden."
        },
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Haben Sie genug Helfer?"
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Nein, das ist unser größtes Problem. Handwerker finden wir noch leichter, viele Rentner kommen gern vorbei und zeigen den Jungen etwas. Aber wir bräuchten dringend jemanden, der sich um die Buchhaltung kümmert, um Anträge und Rechnungen. Das mache ich im Moment abends am Küchentisch, und ehrlich gesagt kann ich das nicht besonders gut. Wenn jemand zuhört, der Zahlen mag: Melden Sie sich bei uns."
        },
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Und was planen Sie als Nächstes?"
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Im Frühjahr wollen wir einen Kurs nur für Mädchen anbieten. In der Werkstatt sind bisher fast nur Jungen, und das möchten wir ändern. Zwei Studentinnen haben schon zugesagt, den Kurs zu leiten. Wenn das klappt, machen wir im Sommer vielleicht eine Fahrradtour mit allen zusammen, an den See und wieder zurück."
        },
        {
          "speaker": "PRUEFER",
          "name": "Moderatorin",
          "text": "Herr Vogel, vielen Dank für das Gespräch, und viel Erfolg mit der Werkstatt."
        },
        {
          "speaker": "PARTNER",
          "name": "Herr Vogel",
          "text": "Ich danke Ihnen."
        }
      ],
      "items": [
        {
          "id": "HV2-46",
          "question": "Herr Vogel hat die Werkstatt von Anfang an geplant.",
          "correct": "falsch",
          "explanation_vi": "Ông Vogel nói „Eigentlich war es ein Zufall“ — hoàn toàn tình cờ ⇒ SAI."
        },
        {
          "id": "HV2-47",
          "question": "Früher hat er hauptberuflich in einem Büro gearbeitet.",
          "correct": "richtig",
          "explanation_vi": "„Ich habe früher in einem Büro gearbeitet, bei einer Versicherung“ ⇒ ĐÚNG."
        },
        {
          "id": "HV2-48",
          "question": "Das Projekt entstand innerhalb weniger Wochen.",
          "correct": "falsch",
          "explanation_vi": "„erst nach zwei Jahren“ — phải hai năm mới thành dự án ⇒ SAI."
        },
        {
          "id": "HV2-49",
          "question": "Die Stadt hat der Werkstatt eine Halle vermietet.",
          "correct": "richtig",
          "explanation_vi": "„Die Stadt hat uns dann eine alte Halle vermietet“ ⇒ ĐÚNG."
        },
        {
          "id": "HV2-50",
          "question": "Die Halle war sofort benutzbar.",
          "correct": "falsch",
          "explanation_vi": "Nhà xưởng „in schlechtem Zustand“: mái dột, không có sưởi, phải tự sửa ⇒ SAI."
        },
        {
          "id": "HV2-51",
          "question": "Die meisten Teilnehmer sind jünger als zwölf.",
          "correct": "falsch",
          "explanation_vi": "„zwischen vierzehn und achtzehn“ ⇒ SAI, không phải dưới mười hai."
        },
        {
          "id": "HV2-52",
          "question": "Wer ein Rad mitnehmen will, muss vorher mitarbeiten.",
          "correct": "richtig",
          "explanation_vi": "„Wer ein Rad mitnehmen möchte, arbeitet vorher zehn Stunden bei uns mit“ ⇒ ĐÚNG."
        },
        {
          "id": "HV2-53",
          "question": "Die Jugendlichen zahlen für das Material.",
          "correct": "falsch",
          "explanation_vi": "„das Material bezahlen wir aus Spenden“ — xưởng trả, không phải người học ⇒ SAI."
        },
        {
          "id": "HV2-54",
          "question": "Der Werkstatt fehlt jemand für die Buchhaltung.",
          "correct": "richtig",
          "explanation_vi": "„Wir bräuchten dringend jemanden, der sich um die Buchhaltung kümmert“ ⇒ ĐÚNG."
        },
        {
          "id": "HV2-55",
          "question": "Ein Angebot nur für Mädchen ist geplant.",
          "correct": "richtig",
          "explanation_vi": "„einen Kurs nur für Mädchen anbieten“ vào mùa xuân ⇒ ĐÚNG."
        }
      ]
    },
    {
      "teil": 3,
      "point_per_item": 5,
      "max_plays": 2,
      "reading_seconds": 0,
      "ansage_de": "Hörverstehen, Teil 3. Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56 bis 60 richtig oder falsch sind.",
      "instruction_de": "Sie hören nun fünf kurze Texte. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig oder falsch sind.",
      "instruction_vi": "Nghe 5 thông báo/tin nhắn ngắn, mỗi bài được nghe HAI LẦN. Trước mỗi bài có một câu dẫn tình huống. Chọn đúng hoặc sai.",
      "items": [
        {
          "id": "HV3-56",
          "speaker": "PRUEFER",
          "lead_in_de": "Lesen Sie jetzt die Aufgabe 56. Sie hören eine Nachricht auf dem Anrufbeantworter.",
          "question": "Die Frau möchte den Termin absagen.",
          "audio_script": "Hallo Frau Brandt, hier ist Nadine Krüger. Ich rufe wegen unseres Treffens an. Wir wollten uns ja am Dienstag um zehn Uhr treffen, aber da hat mir mein Zahnarzt jetzt einen Termin gegeben, den ich leider nicht verschieben kann. Könnten wir unser Treffen auf Mittwoch legen, gleiche Uhrzeit? Wenn Mittwoch bei Ihnen nicht passt, rufen Sie mich bitte kurz zurück, meine Nummer haben Sie ja. Vielen Dank und bis bald.",
          "correct": "falsch",
          "explanation_vi": "Bà ấy muốn DỜI buổi hẹn từ thứ Ba sang thứ Tư, không phải huỷ ⇒ SAI."
        },
        {
          "id": "HV3-57",
          "speaker": "PARTNER",
          "lead_in_de": "Lesen Sie jetzt die Aufgabe 57. Sie waren nicht zu Hause und hören folgende Nachricht des Paketdienstes.",
          "question": "Das Paket wurde beim Nachbarn abgegeben.",
          "audio_script": "Guten Tag, hier ist der Paketdienst Schnell und Sicher. Wir haben heute um elf Uhr versucht, Ihnen ein Paket zu bringen, aber leider war niemand zu Hause. Wir haben es auch bei den Nachbarn versucht, dort hat aber ebenfalls niemand geöffnet. Ihr Paket liegt jetzt in unserer Filiale in der Bahnhofstraße zwölf. Sie können es dort innerhalb von sieben Tagen abholen, montags bis samstags von acht bis zwanzig Uhr. Bitte bringen Sie Ihren Ausweis mit.",
          "correct": "falsch",
          "explanation_vi": "Hàng xóm cũng không mở cửa; bưu kiện nằm ở bưu cục đường Bahnhofstraße ⇒ SAI."
        },
        {
          "id": "HV3-58",
          "speaker": "PRUEFER",
          "lead_in_de": "Lesen Sie jetzt die Aufgabe 58. Sie haben sich an der Volkshochschule für einen Kurs angemeldet und hören folgende Durchsage.",
          "question": "Der Kurs beginnt später als ursprünglich geplant.",
          "audio_script": "Liebe Teilnehmerinnen und Teilnehmer des Anfängerkurses Spanisch, eine wichtige Information: Der Kurs startet nicht wie angekündigt am fünften September, sondern erst zwei Wochen später, am neunzehnten September. Unsere Kursleiterin ist noch im Ausland. Die Uhrzeit bleibt gleich, neunzehn Uhr, und auch der Raum bleibt derselbe: Raum zwei null vier im zweiten Stock. Wer an dem neuen Termin nicht kann, meldet sich bitte im Sekretariat.",
          "correct": "richtig",
          "explanation_vi": "Khoá học dời từ 5/9 sang 19/9 — muộn hơn dự kiến ⇒ ĐÚNG."
        },
        {
          "id": "HV3-59",
          "speaker": "PARTNER",
          "lead_in_de": "Lesen Sie jetzt die Aufgabe 59. Im Radio hören Sie den Verbrauchertipp der Woche.",
          "question": "Der Mann empfiehlt, das Gerät zurückzugeben.",
          "audio_script": "Und hier unser Verbrauchertipp. Eine Hörerin fragt: Meine Waschmaschine ist erst vier Monate alt und schon kaputt. Soll ich sie zurückgeben oder reparieren lassen? Also, wenn die Maschine schon nach vier Monaten kaputt ist, würde ich sie an Ihrer Stelle auf jeden Fall reparieren lassen. Sie haben noch Garantie, das kostet Sie also nichts. Rufen Sie einfach beim Händler an, nicht beim Hersteller. Der Händler muss sich darum kümmern, das ist gesetzlich so geregelt.",
          "correct": "falsch",
          "explanation_vi": "Người nói khuyên đem đi SỬA vì còn bảo hành, không khuyên trả lại ⇒ SAI."
        },
        {
          "id": "HV3-60",
          "speaker": "PRUEFER",
          "lead_in_de": "Lesen Sie jetzt die Aufgabe 60. In der Stadtbibliothek hören Sie folgende Durchsage.",
          "question": "Die Bibliothek verlangt für zu spät zurückgegebene Bücher Geld.",
          "audio_script": "Liebe Besucherinnen und Besucher, bitte denken Sie daran: Ausgeliehene Bücher müssen nach vier Wochen zurückgegeben werden. Für jeden Tag danach berechnen wir zwanzig Cent pro Buch. Wenn Sie ein Buch länger brauchen, können Sie die Ausleihe im Internet oder hier an der Theke einmal um vier Wochen verlängern. Die Bibliothek schließt heute um achtzehn Uhr. Die Rückgabebox am Eingang ist auch nachts geöffnet.",
          "correct": "richtig",
          "explanation_vi": "„zwanzig Cent pro Buch“ cho mỗi ngày trả muộn ⇒ ĐÚNG."
        }
      ]
    }
  ]
}
$j$::jsonb)
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 1'
  AND jsonb_array_length(sections_json->'sections') = 4
  AND sections_json->'sections'->2->>'name' = 'HOEREN';
