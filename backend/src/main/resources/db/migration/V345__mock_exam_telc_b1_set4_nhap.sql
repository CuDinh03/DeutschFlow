-- Đề thi thử MÔ PHỎNG định dạng telc B1 — Set 4, BẢN NHÁP chờ duyệt (26/10/2026).
--
-- Cùng quy ước với V343 (Set 2): AI soạn nháp, reviewed = FALSE + is_active = FALSE (V342), học viên
-- thấy "Sắp có" tới khi có migration duyệt. Đề SOẠN GỐC theo khuôn Set 1 sau V327–V329, bối cảnh
-- Freiburg, chủ đề không trùng Set 1–3. 60 câu · 225 điểm · đỗ 135; phần Nói lấy từ module luyện thi nói.
--
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, sections_json,
                        total_points, pass_points, time_limit_minutes, is_active, reviewed)
VALUES ('B1', 'TELC', 'telc Deutsch B1 — Đề số 4',
        'Đề thi thử MÔ PHỎNG định dạng telc B1, soạn gốc, không liên kết với telc: Đọc, Ngữ pháp–từ vựng, Nghe, Viết. Phần Nói thi riêng ở mục Luyện thi.',
        $j$
{
  "format": "TELC",
  "blocks": [
    { "id": "LV_SB", "minutes": 90, "sections": ["LESEN", "SPRACHBAUSTEINE"] },
    { "id": "PAUSE", "minutes": 20 },
    { "id": "HV", "minutes": 30, "sections": ["HOEREN"] },
    { "id": "SA", "minutes": 30, "sections": ["SCHREIBEN"] }
  ],
  "pass_rule": {
    "written": { "sections": ["LESEN", "SPRACHBAUSTEINE", "HOEREN", "SCHREIBEN"], "max": 225, "min": 135 },
    "oral": { "source": "SPEAKING_SESSION", "provider": "TELC", "max": 75, "min": 45 }
  },
  "sections": [
    {
      "name": "LESEN",
      "label_vi": "Đọc",
      "time_minutes": 90,
      "max_points": 75,
      "teile": [
        {
          "teil": 1,
          "type": "MATCH_HEADLINE",
          "point_per_item": 5,
          "single_use": true,
          "instruction_de": "Lesen Sie zuerst die fünf Texte (1–5) und dann die zehn Überschriften (a–j). Welche Überschrift passt am besten zu welchem Text? Jede Überschrift kann nur einmal verwendet werden.",
          "instruction_vi": "Đọc 5 văn bản rồi 10 tiêu đề a–j. Chọn cho mỗi văn bản tiêu đề hợp nhất; mỗi tiêu đề chỉ dùng một lần. Năm tiêu đề thừa đều „gần đúng“ — hãy soi chi tiết.",
          "headlines": {
            "a": "Neue Zugverbindung: Schneller nach Offenburg",
            "b": "Bürger übernehmen die Pflege neuer Stadtbäume",
            "c": "Supermärkte verkaufen Lebensmittel vom Vortag zum halben Preis",
            "d": "Kino zieht im Sommer nach draußen",
            "e": "Pflegeschule verkürzt die Ausbildung auf zwei Jahre",
            "f": "Drei Wochen Busse statt Bahn",
            "g": "Stadt muss wegen der Hitze alte Bäume fällen",
            "h": "Übrige Lebensmittel gehen jetzt an Bedürftige",
            "i": "Kino Harmonie schließt für einen Umbau",
            "j": "Ausbildung in der Pflege jetzt auch für Eltern möglich"
          },
          "items": [
            {
              "id": "LV1-1",
              "question": "Text 1",
              "text": "Brot vom Vortag, Joghurt kurz vor dem Ablaufdatum, Obst mit kleinen Flecken: Was früher im Müll gelandet ist, bekommt jetzt die Freiburger Tafel. Drei große Supermärkte im Stadtgebiet haben eine Vereinbarung unterschrieben und geben ab sofort jeden Abend alle Lebensmittel ab, die sie nicht mehr verkaufen können. Ehrenamtliche holen die Waren mit einem Kühlwagen ab. Die Tafel versorgt damit pro Woche rund 1500 Menschen mit wenig Geld. Sie sucht allerdings noch Fahrerinnen und Fahrer mit Führerschein.",
              "correct": "h",
              "explanation_vi": "Siêu thị TẶNG thực phẩm còn dư cho Tafel, nơi phát đồ ăn cho người ít tiền ⇒ h. Tiêu đề c là „bóng“: không bán nửa giá, mà cho không."
            },
            {
              "id": "LV1-2",
              "question": "Text 2",
              "text": "Wer kleine Kinder hat, kann oft keine Ausbildung in Vollzeit machen. Die Pflegeschule am Universitätsklinikum bietet deshalb ab Herbst zum ersten Mal eine Ausbildung zur Pflegefachkraft in Teilzeit an. Statt drei dauert sie vier Jahre, dafür sind die Unterrichts- und Arbeitszeiten auf die Öffnungszeiten der Kitas abgestimmt. Nachtdienste müssen die Auszubildenden nicht machen. Für den ersten Kurs gibt es zwanzig Plätze, und schon jetzt liegen mehr als sechzig Bewerbungen vor.",
              "correct": "j",
              "explanation_vi": "Học nghề điều dưỡng bán thời gian, giờ học khớp giờ nhà trẻ ⇒ j. Tiêu đề e là bóng: khoá học DÀI hơn (bốn năm thay vì ba), không rút ngắn."
            },
            {
              "id": "LV1-3",
              "question": "Text 3",
              "text": "Die Stadt Freiburg will in den nächsten fünf Jahren tausend neue Bäume pflanzen, vor allem in Straßen, in denen es im Sommer besonders heiß wird. Bürgerinnen und Bürger können dabei helfen: Wer eine Baumpatenschaft übernimmt, gießt in trockenen Wochen einen bestimmten Baum vor der eigenen Haustür. Als Dank gibt es ein kleines Schild mit dem eigenen Namen. Fast vierhundert Menschen haben sich in den ersten zwei Wochen gemeldet, darunter viele Familien und Schulklassen.",
              "correct": "b",
              "explanation_vi": "Người dân nhận chăm và tưới cây mới trồng trước cửa nhà ⇒ b. Tiêu đề g là bóng: thành phố TRỒNG cây, không chặt."
            },
            {
              "id": "LV1-4",
              "question": "Text 4",
              "text": "Wenn es dunkel wird, geht es los: Von Juli bis Ende August zeigt das Kino „Harmonie“ jeden Abend einen Film unter freiem Himmel im Hof der alten Brauerei. Auf dem Programm stehen aktuelle Filme, aber auch Klassiker und an den Sonntagen Kinderfilme schon um 19 Uhr. Man kann eigene Decken und Kissen mitbringen; Getränke und Essen gibt es an einem Stand vor Ort. Bei Regen fällt die Vorstellung aus, und das Geld für die Tickets wird zurückgezahlt.",
              "correct": "d",
              "explanation_vi": "Rạp chiếu phim ngoài trời trong sân nhà máy bia cũ suốt mùa hè ⇒ d. Tiêu đề i là bóng: rạp không đóng cửa để sửa."
            },
            {
              "id": "LV1-5",
              "question": "Text 5",
              "text": "Pendler zwischen Freiburg und Offenburg müssen sich auf längere Fahrzeiten einstellen. Vom 3. bis zum 24. August ist die Bahnstrecke wegen Bauarbeiten an den Gleisen komplett gesperrt. Statt der Züge fahren Busse, die für die Strecke etwa fünfzig Minuten länger brauchen. Fahrräder dürfen in den Bussen nicht mitgenommen werden. Die Bahn empfiehlt, wenn möglich von zu Hause zu arbeiten oder Fahrgemeinschaften zu bilden. Wer eine Monatskarte hat, bekommt einen Teil des Preises zurück.",
              "correct": "f",
              "explanation_vi": "Từ 3 đến 24/8 tuyến tàu đóng, chạy xe buýt thay ⇒ f. Tiêu đề a là bóng: chuyến đi CHẬM hơn năm mươi phút, không nhanh hơn."
            }
          ]
        },
        {
          "teil": 2,
          "type": "MULTIPLE_CHOICE",
          "point_per_item": 5,
          "instruction_de": "Lesen Sie zuerst den Text und lösen Sie dann die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Beachten Sie: Die Reihenfolge der Aufgaben folgt nicht immer der Reihenfolge des Textes.",
          "instruction_vi": "Đọc bài rồi làm câu 6–10: mỗi câu là một mở đầu câu, chọn đuôi đúng (a, b hoặc c). Thứ tự câu hỏi KHÔNG theo thứ tự bài — dùng số dòng để định vị.",
          "title_de": "Wohnen für Hilfe*",
          "vorspann_de": "In vielen Universitätsstädten sind Zimmer für Studierende kaum zu bezahlen. Gleichzeitig leben viele ältere Menschen allein in großen Wohnungen. Ein Projekt bringt beide zusammen – mit einer einfachen Regel.",
          "context_lines": true,
          "glossary": [
            { "term": "Wohnen für Hilfe", "explanation_de": "ein Projekt, bei dem man statt mit Geld mit Arbeit im Haushalt für ein Zimmer bezahlt" },
            { "term": "Nebenkosten", "explanation_de": "Kosten für Wasser, Strom und Heizung, die man zusätzlich zur Miete bezahlt" }
          ],
          "context": "Als Jonas Berger im Oktober zum Studium nach Freiburg kam,\nsuchte er wochenlang vergeblich ein Zimmer. Die günstigsten\nAngebote kosteten über fünfhundert Euro, mehr als sein ganzes\nBudget. Heute wohnt der Zwanzigjährige in einem hellen Zimmer\nmit Blick auf den Garten und bezahlt dafür keine Miete. Er\nbezahlt mit Zeit: Für jeden Quadratmeter hilft er eine Stunde\nim Monat im Haushalt von Margarete Fuchs, einer 84-jährigen\nWitwe, der die Wohnung gehört.\n\nDie Regel „eine Stunde Hilfe pro Quadratmeter“ ist das Herz des\nProjekts „Wohnen für Hilfe“, das es inzwischen in mehr als\ndreißig deutschen Städten gibt. In Freiburg organisiert das\nStudierendenwerk die Vermittlung. Die Studierenden kaufen ein,\nmähen den Rasen, tragen Getränkekisten in den dritten Stock oder\nerklären das neue Smartphone. Pflege ist dagegen ausdrücklich\nnicht erlaubt; dafür sind ausgebildete Fachkräfte zuständig.\nNur die Nebenkosten* müssen die jungen Mieter selbst bezahlen.\n\nVor jeder Vermittlung besucht eine Mitarbeiterin beide Seiten\nzu Hause. „Es reicht nicht, dass das Zimmer frei ist“, erklärt\nProjektleiterin Ursula Kehl. „Die Menschen müssen zueinander\npassen. Ein Langschläfer ist bei einer Frau, die um sechs Uhr\nfrühstückt, nicht gut aufgehoben.“ Dann wird ein Vertrag\ngeschrieben, in dem genau steht, welche Aufgaben übernommen\nwerden und an welchen Tagen. Nach drei Monaten gibt es ein zweites\nGespräch, in dem beide sagen können, was gut läuft und was nicht.\n\nMargarete Fuchs war am Anfang skeptisch. „Meine Tochter hat mich\nüberredet“, sagt sie. „Ich hatte Angst, dass ich in meiner\neigenen Wohnung keine Ruhe mehr habe.“ Diese Angst sei schnell\nverschwunden. Jonas helfe nicht nur beim Einkaufen, sondern\nkoche auch manchmal für beide. Am wichtigsten sei für sie aber\netwas anderes: „Abends ist jemand im Haus. Seit mein Mann tot\nist, hatte ich nachts oft Angst.“\n\nNicht jede Wohnpartnerschaft funktioniert so gut. Etwa jede\nzehnte endet im ersten Jahr, meistens weil die Studierenden\nweniger helfen, als vereinbart war. Für solche Fälle gibt es\nregelmäßige Gespräche mit dem Studierendenwerk. Ein größeres\nProblem ist aber, dass es viel zu wenige Angebote gibt. Auf\njedes freie Zimmer kommen in Freiburg etwa acht Bewerbungen.\nViele ältere Menschen kennen das Projekt einfach nicht,\noder sie trauen sich nicht, einen Fremden aufzunehmen. Das\nStudierendenwerk plant deshalb Informationsabende in Seniorentreffs.",
          "items": [
            {
              "id": "LV2-6",
              "question": "Wohnpartnerschaften, die im ersten Jahr enden, scheitern meistens, weil …",
              "options": {
                "a": "die Studierenden zu wenig helfen.",
                "b": "die älteren Menschen zu viel verlangen.",
                "c": "das Zimmer zu klein ist."
              },
              "correct": "a",
              "explanation_vi": "Đoạn cuối: „meistens weil die Studierenden weniger helfen, als vereinbart war“ ⇒ a. Câu đầu tiên nhưng trả lời ở CUỐI bài."
            },
            {
              "id": "LV2-7",
              "question": "Jonas Berger bezahlt für sein Zimmer …",
              "options": {
                "a": "fünfhundert Euro im Monat.",
                "b": "mit Hilfe im Haushalt und den Nebenkosten.",
                "c": "die Hälfte der normalen Miete."
              },
              "correct": "b",
              "explanation_vi": "Không trả tiền thuê, trả bằng giờ giúp việc; chỉ tự trả „Nebenkosten“ ⇒ b. a là mức giá các phòng anh KHÔNG thuê nổi."
            },
            {
              "id": "LV2-8",
              "question": "Die Studierenden dürfen im Projekt nicht …",
              "options": {
                "a": "für die Vermieter einkaufen.",
                "b": "im Garten arbeiten.",
                "c": "die Pflege der älteren Menschen übernehmen."
              },
              "correct": "c",
              "explanation_vi": "„Pflege ist dagegen ausdrücklich nicht erlaubt“ ⇒ c. Đi chợ và cắt cỏ thì được."
            },
            {
              "id": "LV2-9",
              "question": "Bevor zwei Menschen zusammenziehen, …",
              "options": {
                "a": "müssen sie eine Woche zur Probe zusammenwohnen.",
                "b": "prüft das Studierendenwerk, ob sie zueinander passen.",
                "c": "bezahlen sie eine Gebühr an das Studierendenwerk."
              },
              "correct": "b",
              "explanation_vi": "Nhân viên đến thăm cả hai bên vì „Die Menschen müssen zueinander passen“ ⇒ b."
            },
            {
              "id": "LV2-10",
              "question": "Für Frau Fuchs ist am wichtigsten, dass …",
              "options": {
                "a": "Jonas manchmal für sie kocht.",
                "b": "ihre Tochter sie öfter besucht.",
                "c": "sie nachts nicht mehr allein ist."
              },
              "correct": "c",
              "explanation_vi": "„Am wichtigsten … Abends ist jemand im Haus“ — trước kia đêm nào cũng sợ ⇒ c. a có thật nhưng không phải điều quan trọng nhất."
            }
          ]
        },
        {
          "teil": 3,
          "type": "MATCH_AD_X",
          "point_per_item": 2.5,
          "single_use": true,
          "allow_none": true,
          "instruction_de": "Lesen Sie zuerst die zehn Situationen (11–20) und dann die zwölf Anzeigen (a–l). Welche Anzeige passt zu welcher Situation? Jede Anzeige kann nur einmal verwendet werden; die Anzeige aus dem Beispiel dürfen Sie noch einmal verwenden. Passt keine Anzeige, wählen Sie x.",
          "instruction_vi": "Đọc 10 tình huống rồi 12 mẩu rao vặt a–l (bối cảnh Freiburg). Mỗi mẩu dùng một lần; mẩu của ví dụ được dùng lại. Không mẩu nào hợp thì chọn x — đề thật luôn có hai tình huống như vậy.",
          "examples": [
            { "label": "01", "situation": "Sie ziehen nächsten Monat um und brauchen viele Kisten.", "answer": "l" },
            { "label": "02", "situation": "Sie suchen für Freitagabend einen Babysitter.", "answer": "x" }
          ],
          "ads": {
            "a": "Nachhilfe in Französisch und Englisch für alle Klassen, durch Lehramtsstudentin. Auch online. 18 €/Std.",
            "b": "Verschenke Kinderbett mit Matratze, guter Zustand. Nur Abholung, Freiburg-Wiehre.",
            "c": "Wanderfreunde Schwarzwald: Wir wandern jeden zweiten Sonntag 15–20 km. Neue Mitglieder willkommen, keine Kosten.",
            "d": "Fahrradverleih am Hauptbahnhof: E-Bikes und Tourenräder ab 15 € pro Tag. Auch Kindersitze.",
            "e": "Erfahrene Pflegekraft bietet Betreuung für Senioren am Nachmittag: Spaziergänge, Gespräche, Vorlesen.",
            "f": "Suche gebrauchte Nähmaschine, auch älteres Modell, bis 80 €. Tel. 0761-12 34 56.",
            "g": "Schachclub Freiburg-Süd: Training für Kinder ab 8 Jahren, freitags 16 Uhr. Die ersten vier Wochen sind kostenlos.",
            "h": "Steuererklärung zu kompliziert? Lohnsteuerhilfeverein berät Arbeitnehmer und Rentner. Termine nach Vereinbarung.",
            "i": "Garage zu vermieten, Nähe Universität, ab sofort, 75 € im Monat.",
            "j": "Köchin bietet Kochabende in Ihrer Küche: Sie lernen, ein Menü für Gäste zu kochen. Gruppen bis 6 Personen.",
            "k": "Familie in Freiburg sucht Au-pair für ein Jahr ab September, zwei Kinder (4 und 7), eigenes Zimmer.",
            "l": "Umzugskartons günstig abzugeben, 50 Stück, kaum benutzt, 1 € pro Karton."
          },
          "items": [
            { "id": "LV3-11", "question": "Sie möchten am Wochenende mit Ihren Gästen eine Radtour machen, haben aber selbst nur ein Fahrrad.", "correct": "d", "explanation_vi": "Cần thêm xe đạp cho khách ⇒ d (cho thuê xe đạp ở ga)." },
            { "id": "LV3-12", "question": "Ihre Großmutter wohnt allein und freut sich über Gesellschaft am Nachmittag.", "correct": "e", "explanation_vi": "Bà sống một mình, muốn có người bầu bạn buổi chiều ⇒ e." },
            { "id": "LV3-13", "question": "Sie haben eine alte Nähmaschine, die Sie nicht mehr brauchen, und möchten sie verkaufen.", "correct": "f", "explanation_vi": "Muốn BÁN máy may cũ — mẩu f là người MUA máy may cũ ⇒ f." },
            { "id": "LV3-14", "question": "Ihre Tochter (9) spielt gern Brettspiele und möchte regelmäßig mit anderen Kindern spielen.", "correct": "g", "explanation_vi": "Bé chín tuổi thích chơi cờ, muốn chơi đều với trẻ khác ⇒ g (câu lạc bộ cờ vua cho trẻ từ 8 tuổi)." },
            { "id": "LV3-15", "question": "Sie verstehen die Formulare für Ihre Steuererklärung nicht.", "correct": "h", "explanation_vi": "Không hiểu tờ khai thuế ⇒ h." },
            { "id": "LV3-16", "question": "Sie bekommen ein Baby und brauchen ein Bett für das Kind, haben aber wenig Geld.", "correct": "b", "explanation_vi": "Cần giường cho em bé, ít tiền ⇒ b (cho không giường trẻ em)." },
            { "id": "LV3-17", "question": "Sie möchten klettern lernen und suchen einen Kurs.", "correct": "x", "explanation_vi": "Học leo núi — mẩu c là nhóm ĐI BỘ đường dài, không dạy leo ⇒ x." },
            { "id": "LV3-18", "question": "Ihr Sohn hat schlechte Noten in Französisch.", "correct": "a", "explanation_vi": "Con điểm kém môn Pháp ⇒ a (dạy kèm tiếng Pháp, tiếng Anh)." },
            { "id": "LV3-19", "question": "Sie suchen einen Platz für Ihr Motorrad in der Nähe der Universität.", "correct": "i", "explanation_vi": "Chỗ để xe máy gần đại học ⇒ i (cho thuê ga-ra)." },
            { "id": "LV3-20", "question": "Sie möchten als Au-pair ein Jahr in Spanien verbringen.", "correct": "x", "explanation_vi": "Muốn làm Au-pair ở TÂY BAN NHA — mẩu k là gia đình ở Freiburg tìm Au-pair ⇒ x." }
          ]
        }
      ]
    },
    {
      "name": "SPRACHBAUSTEINE",
      "label_vi": "Ngữ pháp – từ vựng",
      "time_minutes": 0,
      "max_points": 30,
      "teile": [
        {
          "teil": 1,
          "type": "GAP_MC",
          "point_per_item": 1.5,
          "instruction_de": "Lesen Sie den Text und kreuzen Sie für jede Lücke (21–30) das richtige Wort (a, b oder c) an.",
          "instruction_vi": "Đọc thư và chọn từ đúng (a, b hoặc c) cho mỗi ô trống 21–30. Ba lựa chọn thường là ba dạng của cùng một từ hoặc ba từ nối cùng loại.",
          "gapped_text": "Sehr geehrte Damen und Herren,\n\nhiermit kündige ich meinen Vertrag ___21___ Ihrem Fitnessstudio zum nächstmöglichen Termin. Meine Mitgliedsnummer ist 40 218.\n\nLeider bin ich mit Ihrem Angebot in den letzten Monaten nicht mehr zufrieden. Als ich mich vor einem Jahr angemeldet habe, gab es jeden Abend mehrere Kurse. Seit dem Frühjahr finden die meisten Kurse nur noch ___22___ Vormittag statt, wenn ich arbeiten muss. Außerdem sind viele Geräte schon seit Wochen kaputt und ___23___ nicht repariert.\n\nIch habe mich deshalb schon zweimal an der Theke beschwert, ___24___ niemand hat reagiert. ___25___ ich im Mai umziehe, werde ich Ihr Studio ohnehin nicht mehr nutzen können.\n\nBitte bestätigen Sie mir die Kündigung schriftlich und teilen Sie mir mit, ___26___ welchem Datum mein Vertrag endet. Ich ___27___ Sie außerdem, kein Geld mehr von meinem Konto abzubuchen, ___28___ die Kündigungsfrist abgelaufen ist.\n\nMeine Mitgliedskarte gebe ich Ihnen gern zurück, ___29___ Sie mir sagen, wohin ich sie schicken soll. Vielen Dank ___30___ Ihre Bemühungen.\n\nMit freundlichen Grüßen\nPatrick Engel",
          "items": [
            { "id": "SB1-21", "gap": 21, "options": { "a": "bei", "b": "von", "c": "zu" }, "correct": "a", "explanation_vi": "„einen Vertrag BEI einer Firma haben / kündigen“ — hợp đồng tại một cơ sở." },
            { "id": "SB1-22", "gap": 22, "options": { "a": "im", "b": "am", "c": "um" }, "correct": "b", "explanation_vi": "Buổi trong ngày: „am Vormittag“." },
            { "id": "SB1-23", "gap": 23, "options": { "a": "wurden", "b": "werden", "c": "worden" }, "correct": "b", "explanation_vi": "Bị động hiện tại: „Die Geräte werden nicht repariert“ — vẫn đang không được sửa." },
            { "id": "SB1-24", "gap": 24, "options": { "a": "denn", "b": "aber", "c": "weil" }, "correct": "b", "explanation_vi": "Đã phàn nàn NHƯNG không ai phản hồi ⇒ đối lập „aber“, giữ trật tự câu chính." },
            { "id": "SB1-25", "gap": 25, "options": { "a": "Damit", "b": "Deshalb", "c": "Da" }, "correct": "c", "explanation_vi": "„Da ich im Mai umziehe, …“ — mệnh đề lý do đứng đầu, động từ cuối. „Deshalb“ cần đảo ngữ, „Damit“ chỉ mục đích." },
            { "id": "SB1-26", "gap": 26, "options": { "a": "mit", "b": "zu", "c": "um" }, "correct": "b", "explanation_vi": "„zu welchem Datum“ — hợp đồng kết thúc VÀO ngày nào (cách nói trong thư hủy hợp đồng)." },
            { "id": "SB1-27", "gap": 27, "options": { "a": "bitten", "b": "bitte", "c": "gebeten" }, "correct": "b", "explanation_vi": "Chủ ngữ „ich“ ở hiện tại ⇒ „bitte“." },
            { "id": "SB1-28", "gap": 28, "options": { "a": "seit", "b": "bevor", "c": "sobald" }, "correct": "c", "explanation_vi": "Ngừng trừ tiền NGAY KHI thời hạn báo hủy kết thúc ⇒ „sobald“. „bevor“ sai nghĩa." },
            { "id": "SB1-29", "gap": 29, "options": { "a": "wenn", "b": "als", "c": "ob" }, "correct": "a", "explanation_vi": "Điều kiện ở hiện tại/tương lai ⇒ „wenn“; „als“ chỉ dùng cho một lần trong quá khứ." },
            { "id": "SB1-30", "gap": 30, "options": { "a": "über", "b": "auf", "c": "für" }, "correct": "c", "explanation_vi": "„Vielen Dank FÜR …“ — cảm ơn vì điều gì." }
          ]
        },
        {
          "teil": 2,
          "type": "GAP_WORDBANK",
          "point_per_item": 1.5,
          "single_use": true,
          "instruction_de": "Lesen Sie die Anzeige und den Brief. Welches Wort aus dem Kasten (a–o) passt in die Lücken 31–40? Jedes Wort kann nur einmal verwendet werden. Nicht alle Wörter passen in den Text.",
          "instruction_vi": "Đọc mẩu tin rồi bức thư trả lời. Chọn từ trong hộp a–o cho mỗi ô 31–40; mỗi từ dùng một lần, năm từ thừa. Hộp gồm từ nối, giới từ, động từ khuyết thiếu — soi trật tự động từ và cặp từ dễ lẫn (AM/IM, IN/AN, WEIL/DENN…).",
          "stimulus_ad": "Tag der offenen Tür in der Musikschule Freiburg\nSamstag, 12. Oktober, 10–16 Uhr · Instrumente ausprobieren, Lehrkräfte kennenlernen\nKurse für Kinder ab 4 Jahren und für Erwachsene · info@musikschule-fr.example.de",
          "word_bank": {
            "a": "AB",
            "b": "AM",
            "c": "AN",
            "d": "AUF",
            "e": "DENN",
            "f": "FALLS",
            "g": "FÜR",
            "h": "IM",
            "i": "IN",
            "j": "MÜSSEN",
            "k": "OBWOHL",
            "l": "ÜBER",
            "m": "WAS",
            "n": "WEIL",
            "o": "WÜRDE"
          },
          "gapped_text": "Sehr geehrte Damen und Herren,\n\nich habe gestern Ihre Anzeige ___31___ der Zeitung gelesen und möchte gern mit meinen beiden Kindern zu Ihrem Tag der offenen Tür kommen. Meine Tochter ist sechs und interessiert sich sehr ___32___ die Geige. Mein Sohn ist erst vier und weiß noch nicht, ___33___ er spielen möchte.\n\nIch habe dazu noch einige Fragen. ___34___ wir uns für den Tag anmelden, oder können wir einfach vorbeikommen? Und ist der Unterricht für Kinder ___35___ vier Jahren wirklich schon sinnvoll?\n\nIch selbst habe als Kind Klavier gespielt, aber seit zwanzig Jahren nicht mehr. Ich ___36___ gern wieder anfangen, ___37___ ich nicht viel Zeit habe. Bieten Sie auch Unterricht ___38___ Abend an?\n\nLeider kann ich erst ab elf Uhr kommen, ___39___ meine Tochter am Vormittag Schwimmunterricht hat. Ich hoffe, das ist kein Problem.\n\nIch freue mich ___40___ Ihre Antwort.\n\nMit freundlichen Grüßen\nElena Petrova",
          "items": [
            { "id": "SB2-31", "gap": 31, "correct": "i", "explanation_vi": "„in der Zeitung lesen“ — đọc TRÊN báo; AN (c) là nhiễu, „an der Zeitung“ không đúng." },
            { "id": "SB2-32", "gap": 32, "correct": "g", "explanation_vi": "„sich interessieren FÜR“ — động từ đi với giới từ cố định." },
            { "id": "SB2-33", "gap": 33, "correct": "m", "explanation_vi": "„…, was er spielen möchte“ — câu hỏi gián tiếp về CÁI GÌ (nhạc cụ nào)." },
            { "id": "SB2-34", "gap": 34, "correct": "j", "explanation_vi": "„Müssen wir uns anmelden, oder …“ — câu hỏi, động từ khuyết thiếu đứng đầu." },
            { "id": "SB2-35", "gap": 35, "correct": "a", "explanation_vi": "„ab vier Jahren“ — từ bốn tuổi trở lên, như trong mẩu tin." },
            { "id": "SB2-36", "gap": 36, "correct": "o", "explanation_vi": "„Ich würde gern wieder anfangen“ — mong muốn lịch sự (Konjunktiv II)." },
            { "id": "SB2-37", "gap": 37, "correct": "k", "explanation_vi": "„…, obwohl ich nicht viel Zeit habe“ — nhượng bộ, động từ cuối; FALLS (f) sai nghĩa." },
            { "id": "SB2-38", "gap": 38, "correct": "b", "explanation_vi": "„am Abend“ — cụm thời gian; IM (h) là nhiễu cặp." },
            { "id": "SB2-39", "gap": 39, "correct": "n", "explanation_vi": "„…, weil meine Tochter … hat“ — động từ ở CUỐI ⇒ weil, không phải denn." },
            { "id": "SB2-40", "gap": 40, "correct": "d", "explanation_vi": "„sich freuen AUF“ + Akkusativ cho điều sắp tới; ÜBER (l) cho việc đã xảy ra." }
          ]
        }
      ]
    },
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
          "framing_de": "Wo kaufen die Menschen am liebsten ein? Wir haben fünf Personen gefragt: „Wo kaufen Sie Ihre Lebensmittel, und warum gerade dort?“ Hören Sie dazu die Antworten.",
          "instruction_de": "Sie hören nun fünf kurze Texte. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind.",
          "instruction_vi": "Nghe 5 người kể về cùng một chủ đề, mỗi người CHỈ MỘT LẦN. Sau hướng dẫn có 30 giây đọc câu hỏi. Chọn đúng hoặc sai.",
          "items": [
            {
              "id": "HV1-41",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin bestellt auch Obst und Gemüse im Internet.",
              "audio_script": "Nummer 41. Ich kaufe fast alles im Internet, auch Lebensmittel. Der Supermarkt liefert dreimal pro Woche bis an die Wohnungstür, und die Lieferung kostet nur zwei Euro. Ich arbeite viel und habe drei Kinder, da spare ich mir jede Woche bestimmt drei Stunden. Nur Obst und Gemüse kaufe ich lieber selbst auf dem Markt, weil ich es vorher sehen und anfassen möchte. Mit Bananen aus dem Internet habe ich schon zu viele schlechte Erfahrungen gemacht.",
              "correct": "falsch",
              "explanation_vi": "„Nur Obst und Gemüse kaufe ich lieber selbst auf dem Markt“ ⇒ SAI."
            },
            {
              "id": "HV1-42",
              "speaker": "PARTNER",
              "question": "Der Sprecher unterhält sich auf dem Markt gern mit den Händlern.",
              "audio_script": "Nummer 42. Ich gehe jeden Samstag auf den Wochenmarkt am Münsterplatz. Das ist für mich nicht nur Einkaufen, sondern ein Ritual. Ich kenne die Händler seit Jahren, wir reden ein bisschen über das Wetter und die Familie. Natürlich ist es dort etwas teurer als im Discounter, aber die Sachen kommen direkt von den Bauernhöfen aus der Region und halten viel länger. Unter der Woche kaufe ich nur das Nötigste im Laden um die Ecke.",
              "correct": "richtig",
              "explanation_vi": "Quen các tiểu thương nhiều năm, „wir reden ein bisschen über das Wetter und die Familie“ ⇒ ĐÚNG."
            },
            {
              "id": "HV1-43",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin nutzt eine App, um günstig an Essen zu kommen.",
              "audio_script": "Nummer 43. Ich bin Studentin und habe wenig Geld, deshalb kaufe ich nur im Discounter. Ich schreibe vorher immer eine Liste und halte mich auch daran, sonst kauft man so viel Unsinn. Am Ende des Monats wird es trotzdem oft knapp. Seit einiger Zeit benutze ich außerdem eine App, mit der man Essen, das Restaurants und Bäckereien am Abend übrig haben, sehr günstig abholen kann. So habe ich schon viele neue Gerichte probiert.",
              "correct": "richtig",
              "explanation_vi": "Dùng ứng dụng lấy đồ ăn dư buổi tối của nhà hàng, tiệm bánh với giá rẻ ⇒ ĐÚNG."
            },
            {
              "id": "HV1-44",
              "speaker": "PARTNER",
              "question": "Der Sprecher muss für den Einkauf nie mehr in die Stadt fahren.",
              "audio_script": "Nummer 44. Bei uns im Dorf gibt es seit drei Jahren keinen Laden mehr. Früher bin ich deshalb jedes Mal zwanzig Minuten mit dem Auto in die Stadt gefahren. Jetzt hat ein Bauer am Ortsrand einen kleinen Automaten aufgestellt, an dem man rund um die Uhr Milch, Eier, Kartoffeln und Nudeln kaufen kann. Das ist praktisch, aber für einen richtigen Wocheneinkauf reicht es natürlich nicht. Dafür fahre ich weiterhin einmal in der Woche in die Stadt.",
              "correct": "falsch",
              "explanation_vi": "Máy bán hàng không đủ, „fahre ich weiterhin einmal in der Woche in die Stadt“ ⇒ SAI."
            },
            {
              "id": "HV1-45",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin arbeitet regelmäßig in dem Laden, in dem sie einkauft.",
              "audio_script": "Nummer 45. Ich kaufe seit einem Jahr in einem kleinen Bioladen ein, der von den Kunden selbst organisiert wird. Jedes Mitglied arbeitet dort drei Stunden im Monat, zum Beispiel an der Kasse oder beim Auspacken der Lieferungen. Dafür sind die Preise viel niedriger als in einem normalen Bioladen. Am Anfang fand ich das kompliziert, inzwischen mag ich es sehr. Man weiß genau, woher die Produkte kommen, und ich habe dort schon nette Leute kennengelernt.",
              "correct": "richtig",
              "explanation_vi": "Mỗi thành viên làm ba giờ mỗi tháng ở cửa hàng ⇒ ĐÚNG."
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
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Guten Tag, liebe Hörerinnen und Hörer, und herzlich willkommen zu „Ideen für die Stadt“. Heute ist Herr Bauer bei uns. Er hat in Freiburg einen Leihladen gegründet. Herr Bauer, was ist denn ein Leihladen?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Ein Leihladen ist eigentlich wie eine Bibliothek, nur dass man keine Bücher ausleiht, sondern Gegenstände. Bei uns gibt es zum Beispiel Bohrmaschinen, Leitern, Zelte, Nähmaschinen, Beamer, aber auch Spiele für Kindergeburtstage. Insgesamt haben wir über achthundert Sachen. Die meisten davon braucht man nur ein- oder zweimal im Jahr." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Und wie funktioniert das genau?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Man wird Mitglied und bezahlt dafür einen kleinen Beitrag, je nach Einkommen zwischen zwei und zehn Euro im Monat. Dann kann man sich alles für eine Woche ausleihen, so oft man will. Wer etwas länger braucht, kann verlängern, wenn es niemand anderes reserviert hat. Die Gegenstände selbst haben fast alle Leute aus der Stadt gespendet. Reservieren kann man über unsere Webseite oder direkt im Laden, der viermal pro Woche geöffnet ist." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wie kamen Sie auf die Idee?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Durch einen Umzug. Ich brauchte damals eine Bohrmaschine, um ein paar Lampen aufzuhängen. Ich habe eine gekauft, sie genau einmal benutzt, und danach lag sie fünf Jahre im Keller. Irgendwann habe ich meine Nachbarn gefragt, und es stellte sich heraus, dass in unserem Haus mit zwölf Wohnungen acht Bohrmaschinen lagen. Das fand ich absurd. Ich dachte mir: Wenn alle eine Maschine teilen würden, bräuchten wir viel weniger Geräte." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wer leiht denn bei Ihnen aus?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Ganz unterschiedliche Leute. Viele Studierende, die nicht viel Geld haben, aber auch Familien und Rentner. Am beliebtesten sind übrigens nicht die Werkzeuge, wie ich erwartet hatte, sondern Campingausrüstung. Im Sommer sind unsere Zelte und Schlafsäcke fast immer ausgeliehen, da gibt es sogar eine Warteliste. Im Winter sind dagegen Raclette-Geräte sehr gefragt, besonders kurz vor Weihnachten." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Gehen nicht oft Sachen kaputt?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Weniger, als man denkt. Natürlich passiert das mal, aber die meisten Leute gehen sehr sorgfältig mit den Sachen um, weil sie wissen, dass der Nächste sie auch noch braucht. Wenn etwas kaputtgeht, muss man es nicht bezahlen. Wir haben zwei Rentner, die früher Elektriker und Schreiner waren. Die reparieren jeden Mittwoch alles, was beschädigt zurückgekommen ist." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wie finanzieren Sie den Laden?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Über die Mitgliedsbeiträge und eine kleine Unterstützung von der Stadt. Die Miete für den Raum ist das Teuerste. Außer mir arbeitet niemand gegen Bezahlung, alle anderen sind Freiwillige. Ich selbst bekomme auch nur eine halbe Stelle bezahlt und arbeite nebenbei noch als Hausmeister in einer Schule." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Und was haben Sie noch vor?" },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Wir möchten im nächsten Jahr eine zweite Ausleihstation in einem Stadtteil am Rand von Freiburg eröffnen, wo viele Familien wohnen. Und ich träume davon, dass es irgendwann in jeder Stadt einen Leihladen gibt. Andere Städte rufen uns schon an und fragen, wie wir das gemacht haben." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Herr Bauer, vielen Dank für das Gespräch." },
            { "speaker": "PARTNER", "name": "Herr Bauer", "text": "Ich danke Ihnen für die Einladung." }
          ],
          "items": [
            { "id": "HV2-46", "question": "Im Leihladen kann man vor allem Bücher ausleihen.", "correct": "falsch", "explanation_vi": "„nur dass man keine Bücher ausleiht, sondern Gegenstände“ ⇒ SAI." },
            { "id": "HV2-47", "question": "Alle Mitglieder bezahlen denselben Beitrag.", "correct": "falsch", "explanation_vi": "„je nach Einkommen zwischen zwei und zehn Euro“ ⇒ SAI." },
            { "id": "HV2-48", "question": "Die meisten Gegenstände wurden dem Laden geschenkt.", "correct": "richtig", "explanation_vi": "„Die Gegenstände selbst haben fast alle Leute aus der Stadt gespendet“ ⇒ ĐÚNG." },
            { "id": "HV2-49", "question": "Herr Bauer hat seine eigene Bohrmaschine sehr oft benutzt.", "correct": "falsch", "explanation_vi": "„sie genau einmal benutzt“ rồi để năm năm dưới hầm ⇒ SAI." },
            { "id": "HV2-50", "question": "In Herrn Bauers Haus gab es mehrere Bohrmaschinen.", "correct": "richtig", "explanation_vi": "Mười hai căn hộ có tám máy khoan ⇒ ĐÚNG." },
            { "id": "HV2-51", "question": "Am häufigsten werden Werkzeuge ausgeliehen.", "correct": "falsch", "explanation_vi": "„Am beliebtesten sind … nicht die Werkzeuge … sondern Campingausrüstung“ ⇒ SAI." },
            { "id": "HV2-52", "question": "Wer etwas kaputt macht, muss nichts dafür bezahlen.", "correct": "richtig", "explanation_vi": "„Wenn etwas kaputtgeht, muss man es nicht bezahlen“ ⇒ ĐÚNG." },
            { "id": "HV2-53", "question": "Alle Mitarbeiter im Laden bekommen Geld für ihre Arbeit.", "correct": "falsch", "explanation_vi": "„Außer mir arbeitet niemand gegen Bezahlung“ ⇒ SAI." },
            { "id": "HV2-54", "question": "Herr Bauer hat neben dem Leihladen noch einen anderen Job.", "correct": "richtig", "explanation_vi": "Ông còn làm „Hausmeister in einer Schule“ ⇒ ĐÚNG." },
            { "id": "HV2-55", "question": "Der Leihladen plant eine weitere Station.", "correct": "richtig", "explanation_vi": "„eine zweite Ausleihstation … eröffnen“ ⇒ ĐÚNG." }
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
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 56. Sie hören eine Nachricht auf Ihrem Anrufbeantworter.",
              "question": "Die Werkstatt hat auch schon neue Reifen montiert.",
              "audio_script": "Guten Tag, hier ist das Autohaus Keller. Ihr Wagen ist fertig repariert und kann ab morgen früh abgeholt werden. Wir haben die Bremsen erneuert, wie besprochen. Bei der Inspektion haben wir außerdem gesehen, dass die Reifen bald gewechselt werden müssen. Das haben wir aber noch nicht gemacht, weil wir zuerst mit Ihnen sprechen wollten. Rufen Sie uns bitte kurz an. Wir haben bis achtzehn Uhr geöffnet.",
              "correct": "falsch",
              "explanation_vi": "Lốp „noch nicht gemacht“ — xưởng muốn hỏi ý trước ⇒ SAI."
            },
            {
              "id": "HV3-57",
              "speaker": "PARTNER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 57. Sie sind im Schwimmbad und hören folgende Durchsage.",
              "question": "Die Badegäste dürfen im Hallenbad weiterschwimmen.",
              "audio_script": "Liebe Badegäste, wegen eines Gewitters, das in wenigen Minuten unsere Region erreicht, müssen wir das Außenbecken jetzt leider schließen. Bitte verlassen Sie sofort das Wasser und gehen Sie in das Gebäude. Das Hallenbad und die Sauna bleiben geöffnet. Sobald das Gewitter vorbei ist, öffnen wir das Außenbecken wieder. Vielen Dank für Ihr Verständnis.",
              "correct": "richtig",
              "explanation_vi": "Chỉ đóng bể ngoài trời; „Das Hallenbad und die Sauna bleiben geöffnet“ ⇒ ĐÚNG."
            },
            {
              "id": "HV3-58",
              "speaker": "PRUEFER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 58. Im Radio hören Sie einen Veranstaltungshinweis.",
              "question": "Kinder unter vierzehn müssen für das Weinfest keinen Eintritt bezahlen.",
              "audio_script": "Und hier noch ein Tipp für das Wochenende: Am Samstag und Sonntag findet auf dem Messegelände das große Freiburger Weinfest statt. Über fünfzig Winzer aus Baden stellen ihre Weine vor, und für die Kinder gibt es ein Programm mit Musik und Spielen. Der Eintritt kostet fünf Euro, Kinder unter vierzehn Jahren sind frei. Weil es auf dem Messegelände nur wenige Parkplätze gibt, sollten Besucher am besten mit der Straßenbahn kommen.",
              "correct": "richtig",
              "explanation_vi": "„Kinder unter vierzehn Jahren sind frei“ ⇒ ĐÚNG."
            },
            {
              "id": "HV3-59",
              "speaker": "PARTNER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 59. Sie hören eine Nachricht von einem Freund.",
              "question": "Tobias möchte das Treffen heute Abend absagen.",
              "audio_script": "Hi, hier ist Tobias. Du, wegen heute Abend: Das Kino hat mir gerade geschrieben, dass der Film, den wir sehen wollten, nicht mehr läuft. Ich habe mir das Programm angeschaut, und um halb neun gibt es eine Komödie, die gute Kritiken bekommen hat. Wenn du keine Lust darauf hast, können wir auch einfach essen gehen. Schreib mir bitte kurz, was dir lieber ist. Bis später!",
              "correct": "falsch",
              "explanation_vi": "Tobias đề xuất phim khác hoặc đi ăn — vẫn gặp nhau ⇒ SAI."
            },
            {
              "id": "HV3-60",
              "speaker": "PRUEFER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 60. Sie hören eine Durchsage im Zug.",
              "question": "Der Zug fährt von Freiburg weiter nach Basel.",
              "audio_script": "Sehr geehrte Fahrgäste, in wenigen Minuten erreichen wir Freiburg Hauptbahnhof. Dieser Zug endet dort. Sie haben Anschluss an den Regionalexpress nach Basel, Abfahrt elf Uhr zwölf von Gleis zwei, und an die S-Bahn nach Breisach, Abfahrt elf Uhr zwanzig von Gleis sechs. Bitte achten Sie beim Aussteigen auf die Lücke zwischen Zug und Bahnsteig und vergessen Sie Ihr Gepäck nicht. Wir bedanken uns für Ihre Reise.",
              "correct": "falsch",
              "explanation_vi": "„Dieser Zug endet dort“ — đi Basel phải đổi sang tàu Regionalexpress ⇒ SAI."
            }
          ]
        }
      ]
    },
    {
      "name": "SCHREIBEN",
      "label_vi": "Viết",
      "time_minutes": 30,
      "max_points": 45,
      "teile": [
        {
          "teil": 1,
          "instruction_de": "Ihr Freund Tim hat Ihnen eine E-Mail geschrieben. Antworten Sie ihm. Schreiben Sie zu allen vier Punkten und überlegen Sie sich eine passende Reihenfolge der Punkte. Vergessen Sie nicht Anrede und Gruß.",
          "instruction_vi": "Viết một E-Mail xưng „du“ trả lời bạn: đủ bốn ý dưới đây, tự sắp thứ tự cho hợp lý, có lời chào đầu và cuối. Bốn ý in không theo thứ tự — như tờ đề thật. Gợi ý độ dài: 120–180 từ.",
          "prompt": "Ihr Freund Tim hat Ihnen geschrieben. Antworten Sie ihm.",
          "stimulus": {
            "type": "EMAIL",
            "from": "Tim",
            "subject": "Ein neues Familienmitglied!",
            "body": "Hallo!\n\nStell dir vor, ich habe einen Hund! Er heißt Bruno, ist zwei Jahre alt und kommt aus dem Tierheim. Er ist total lieb, aber auch ziemlich wild. Am Wochenende würde ich dich gern mit ihm besuchen. Hättest du Lust auf einen langen Spaziergang?\n\nIch habe allerdings ein Problem: Nächsten Monat muss ich für eine Woche beruflich nach Berlin, und ich weiß nicht, wohin mit Bruno. Hast du eine Idee?\n\nUnd wie geht es dir? Was machst du gerade so?\n\nViele Grüße\nTim"
          },
          "shuffle_points": true,
          "writing_points": [
            "Reaktion auf Tims Vorschlag: Passt ein Besuch am Wochenende?",
            "Ihre eigenen Erfahrungen mit Haustieren",
            "Ein Tipp, wer sich um Bruno kümmern kann",
            "Was es bei Ihnen Neues gibt"
          ]
        }
      ]
    }
  ]
}
$j$::jsonb,
        225, 135, 150, FALSE, FALSE);
