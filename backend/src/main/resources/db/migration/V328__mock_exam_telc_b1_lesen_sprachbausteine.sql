-- Gói A — phần Đọc và Sprachbausteine của đề telc B1 Set 1 đúng độ dài và đúng khuôn đề thật (17/09/2026).
--
-- Đối chiếu V325 với 10 Test Klett ZD, 3 đề thật tái dựng (PETRA, JAN, „New Set 1") và Übungstest
-- telc 2020:
--   • LV Teil 1: văn bản 25–33 từ — đề thật 55–110 từ, giọng Kurzmeldung; 5 tiêu đề thừa phải là
--     „bóng" của 5 văn bản (cùng từ khoá, sai một chi tiết / khẳng định điều bài đã bác).
--   • LV Teil 2: 207 từ, câu hỏi dạng nghi vấn — đề thật 370–520 từ, có Vorspann in đậm, số dòng
--     mỗi 5 dòng, chú thích từ khó; câu 6–10 là SATZANFANG + 3 đuôi, thứ tự KHÔNG theo bài.
--   • LV Teil 3: thiếu hai Beispiele (một ghép được, một x) mà mọi đề thật đều in trước.
--   • SB Teil 1: 117 từ — đề thật 130–180.
--   • SB Teil 2: hộp từ là DANH TỪ/TÍNH TỪ — đề thật là TỪ CHỨC NĂNG viết HOA, xếp theo bảng chữ
--     cái, nhiễu theo cặp đối chọi (AM/IM, VON/MIT, FALLS/OBWOHL, OB/WANN, MÖCHTEN/WOLLTEN), và
--     thư luôn TRẢ LỜI một mẩu tin in ngay trên.
--
-- Khoá mới: Teil LV2 `title_de`, `vorspann_de`, `context_lines`, `glossary[{term, explanation_de}]`
-- (thân bài `context` ngắt dòng ≈ 10 từ để số dòng ổn định); Teil LV3 `examples[{label, situation,
-- answer}]`; Teil SB2 `stimulus_ad`. Đề Goethe không khai ⇒ trình chạy như cũ.
--
-- Đáp án và id câu 1–30 GIỮ NGUYÊN so với V325. Riêng SB Teil 2 (31–40) đáp án ĐỔI: hộp từ mới
-- phải xếp theo bảng chữ cái như đề thật, nên chữ cái đáp án đi theo hộp. Đề pilot mới lên prod
-- 17/09 sau cổng PRO, chưa có bài nộp thật; cổng test ghi rõ ngoại lệ này.
--
-- Nội dung SOẠN GỐC (repo PUBLIC, không chép sách hay đề rò rỉ). 🪤 Dấu cách sau $j$ là BẮT BUỘC.

UPDATE mock_exams
SET sections_json = jsonb_set(
  jsonb_set(sections_json, '{sections,0}', $j$
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
        "a": "Vier neue Radwege: Die Stadt will weniger Autos im Zentrum",
        "b": "Stadtbücherei öffnet jetzt auch am Sonntag",
        "c": "Geschäftsleute fordern mehr Parkplätze in der Innenstadt",
        "d": "Immer mehr junge Leute entscheiden sich für das Handwerk",
        "e": "Neues Hallenbad wird im Sommer eröffnet",
        "f": "Stadtbücherei muss wegen Sparmaßnahmen schließen",
        "g": "Nachbarn machen aus einem leeren Grundstück einen Garten",
        "h": "Handwerksbetriebe finden trotz Prämien keine Lehrlinge",
        "i": "Hallenbad bleibt den ganzen Sommer geschlossen",
        "j": "Anwohner der Lindenstraße protestieren gegen ein Bauprojekt"
      },
      "items": [
        {
          "id": "LV1-1",
          "question": "Text 1",
          "text": "Ab Mai entstehen im Stadtzentrum von Leipzig vier neue Strecken, die nur für Fahrräder reserviert sind. Insgesamt sind es fast sechs Kilometer, vom Hauptbahnhof bis zur Universität. Die Stadt hofft, dass dadurch deutlich weniger Autos in die Innenstadt fahren und die Luft besser wird. Zwei Straßen werden dafür schmaler, und etwa vierzig Parkplätze fallen weg. Bei vielen Geschäftsleuten stößt der Plan deshalb auf Kritik: Sie fürchten, dass Kunden aus dem Umland künftig lieber in die Einkaufszentren am Stadtrand fahren. Die Stadtverwaltung will die Zahlen nach einem Jahr überprüfen.",
          "correct": "a",
          "explanation_vi": "Bài nói về bốn tuyến đường mới chỉ dành cho xe đạp để bớt ô tô ⇒ a. Tiêu đề c là „bóng“: giới kinh doanh chỉ lo mất khách, bài không nói họ ĐÒI thêm chỗ đỗ."
        },
        {
          "id": "LV1-2",
          "question": "Text 2",
          "text": "In der Region fehlen in diesem Jahr rund 900 junge Leute für eine Ausbildung im Handwerk. Betroffen sind vor allem Bäckereien, Malerbetriebe und Elektrofirmen. Viele Betriebe bieten inzwischen Prämien an: ein eigenes Werkzeug zum Start, die Fahrkarte für den Bus oder 500 Euro nach dem ersten Lehrjahr. Trotzdem finden sie kaum Bewerber. Die meisten Schulabgänger gehen lieber an die Universität, obwohl man im Handwerk schon während der Ausbildung Geld verdient. Die Handwerkskammer will nun mit Praktika in den Schulen für ihre Berufe werben.",
          "correct": "h",
          "explanation_vi": "Thiếu 900 người học nghề, treo thưởng vẫn không có người ⇒ h. Tiêu đề d nói ngược lại bài („immer mehr junge Leute“ chọn nghề)."
        },
        {
          "id": "LV1-3",
          "question": "Text 3",
          "text": "Das städtische Hallenbad in der Karl-Heine-Straße bleibt von Anfang Juni bis Ende September zu. Die Lüftungsanlage stammt noch aus den achtziger Jahren und muss komplett erneuert werden; außerdem werden die Duschen und die Umkleiden renoviert. Die Schwimmkurse für Kinder finden in dieser Zeit im Bad des Nachbarorts statt, ein kostenloser Bus fährt zweimal am Tag. Die Stadt rechnet mit Kosten von 1,2 Millionen Euro. Ab Oktober soll das Bad wieder wie gewohnt öffnen.",
          "correct": "i",
          "explanation_vi": "Bể bơi đóng cửa từ tháng 6 đến tháng 9 để thay hệ thống thông gió ⇒ i. Tiêu đề e („neues Hallenbad wird eröffnet“) là bóng: bể cũ sửa, không có bể mới."
        },
        {
          "id": "LV1-4",
          "question": "Text 4",
          "text": "Auf einem leeren Grundstück in der Lindenstraße pflanzen seit April etwa dreißig Anwohner gemeinsam Gemüse, Kräuter und Blumen. Das Grundstück gehört der Stadt, die es den Nachbarn für drei Jahre kostenlos überlässt. Wer mitmachen will, bringt eigenes Werkzeug mit und übernimmt einmal in der Woche das Gießen; die Ernte teilen alle. Am Samstag gibt es zum ersten Mal ein kleines Gartenfest, zu dem auch Familien aus den umliegenden Straßen eingeladen sind.",
          "correct": "g",
          "explanation_vi": "Khoảng ba mươi người trong khu cùng trồng rau trên đất trống ⇒ g. Tiêu đề j („protestieren gegen ein Bauprojekt“) là bóng: không có dự án xây dựng nào trong bài."
        },
        {
          "id": "LV1-5",
          "question": "Text 5",
          "text": "Die Stadtbücherei am Marktplatz hat ihre Öffnungszeiten geändert: Sonntags kann man dort nun von 11 bis 16 Uhr lesen, lernen und Bücher ausleihen. Die Leitung reagiert damit auf eine Umfrage, bei der sich viele Berufstätige und Studierende genau das gewünscht hatten. Dafür bleibt die Bücherei montags geschlossen, weil das Personal nicht aufgestockt wird. Die Rückgabe ist weiterhin an jedem Tag über die Box am Eingang möglich.",
          "correct": "b",
          "explanation_vi": "Thư viện mở thêm chủ nhật 11–16 giờ ⇒ b. Tiêu đề f („muss schließen“) là bóng: chỉ đóng thứ Hai, không đóng hẳn."
        }
      ]
    },
    {
      "teil": 2,
      "type": "MULTIPLE_CHOICE",
      "point_per_item": 5,
      "instruction_de": "Lesen Sie zuerst den Text und lösen Sie dann die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Beachten Sie: Die Reihenfolge der Aufgaben folgt nicht immer der Reihenfolge des Textes.",
      "instruction_vi": "Đọc bài rồi làm câu 6–10: mỗi câu là một mở đầu câu, chọn đuôi đúng (a, b hoặc c). Thứ tự câu hỏi KHÔNG theo thứ tự bài — dùng số dòng để định vị.",
      "title_de": "Ehrenamt* im Wandel",
      "vorspann_de": "Wer sich in Deutschland freiwillig engagiert, tut das heute anders als noch vor zwanzig Jahren. Vereine müssen umdenken – und einige tun es bereits.",
      "context_lines": true,
      "glossary": [
        { "term": "Ehrenamt", "explanation_de": "freiwillige, unbezahlte Arbeit für andere, z. B. in einem Verein" },
        { "term": "Vorstand", "explanation_de": "die Gruppe von Personen, die einen Verein leitet" }
      ],
      "context": "Damals traten die meisten Menschen in einen Verein ein und blieben\ndort oft ihr ganzes Leben: im Fußballverein, bei der Feuerwehr, im\nKirchenchor. Heute dagegen wollen viele Freiwillige genau wissen,\nwofür sie ihre Zeit einsetzen – und vor allem für wie lange.\n\nFrau Özdemir leitet seit acht Jahren eine Freiwilligenagentur in\neiner mittelgroßen Stadt in Sachsen. Sie beobachtet seit Jahren\ndenselben Trend: „Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand.\nEin Projekt über drei Monate finden viele gut. Eine Aufgabe ohne Ende\nschreckt ab.“ Besonders berufstätige Menschen zwischen dreißig und\nfünfzig meldeten sich lieber für einzelne Aktionen als für einen\nfesten Posten. Ein Nachmittag beim Stadtfest, ein Wochenende beim\nSpendenlauf – das passe in den Kalender, ein Amt für fünf Jahre nicht.\n\nFür die Vereine ist das nicht einfach. Ein Sportverein braucht\njemanden, der die Kasse führt, die Halle bucht und mit der Stadt\nverhandelt – und zwar nicht nur bis zum Sommer. „Wir finden schnell\nzehn Leute für ein Stadtfest“, sagt der Vorsitzende eines Turnvereins\nmit vierhundert Mitgliedern, „aber niemanden für den Vorstand*.“ Seit\nzwei Jahren sucht er einen Nachfolger für den Kassenwart, der mit\nsiebzig Jahren aufhören möchte. Bisher ohne Erfolg.\n\nManche Vereine haben deshalb angefangen, große Aufgaben in kleine\nTeile zu zerlegen und auf mehrere Schultern zu verteilen. Statt eines\nKassenwarts gibt es dann drei Personen, die sich die Arbeit teilen:\neine kümmert sich um die Beiträge, eine um die Rechnungen, eine um\nden Kontakt zur Bank. Jede von ihnen braucht nur zwei Stunden im\nMonat. Andere Vereine bezahlen inzwischen eine Bürokraft für ein paar\nStunden in der Woche, damit die Freiwilligen sich auf das\nkonzentrieren können, was ihnen Spaß macht.\n\nFrau Özdemir hält das Aufteilen für den richtigen Weg. Sie rät den\nVereinen außerdem, neuen Freiwilligen von Anfang an eine feste\nAnsprechperson zu geben und sie nicht mit einer Liste von Aufgaben\nallein zu lassen. „Die meisten hören nicht auf, weil die Arbeit zu\nschwer ist“, sagt sie. „Sie hören auf, weil sie sich allein gelassen\nfühlen.“ Wer nach einem halben Jahr gefragt werde, ob alles gut laufe,\nbleibe meistens auch im zweiten Jahr dabei.",
      "items": [
        {
          "id": "LV2-6",
          "question": "Freiwillige hören nach Frau Özdemirs Erfahrung meistens auf, weil …",
          "options": {
            "a": "die Aufgaben zu schwer für sie sind.",
            "b": "sich niemand um sie kümmert.",
            "c": "sie nach einem halben Jahr etwas Neues suchen."
          },
          "correct": "b",
          "explanation_vi": "Cuối bài (dòng 35–37): họ bỏ vì „sich allein gelassen fühlen“, không phải vì việc khó ⇒ b. Câu đầu tiên nhưng trả lời ở CUỐI bài — thứ tự câu không theo bài."
        },
        {
          "id": "LV2-7",
          "question": "Wer zu Frau Özdemir kommt, fragt zuerst, …",
          "options": {
            "a": "wie viel Zeit die Aufgabe kostet.",
            "b": "ob es Geld für die Arbeit gibt.",
            "c": "wer sonst noch mitmacht."
          },
          "correct": "a",
          "explanation_vi": "Dòng 7: „Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand“ ⇒ a."
        },
        {
          "id": "LV2-8",
          "question": "Der Vorsitzende des Turnvereins findet niemanden, der …",
          "options": {
            "a": "beim Stadtfest mithilft.",
            "b": "eine Aufgabe im Vorstand übernimmt.",
            "c": "die Halle für den Verein bucht."
          },
          "correct": "b",
          "explanation_vi": "Dòng 17–18: tìm mười người cho hội chợ thì nhanh, „aber niemanden für den Vorstand“ ⇒ b. a nói ngược bài."
        },
        {
          "id": "LV2-9",
          "question": "Manche Vereine …",
          "options": {
            "a": "teilen große Aufgaben auf mehrere Personen auf.",
            "b": "nehmen nur noch Mitglieder auf, die ein Amt übernehmen.",
            "c": "haben den Kassenwart abgeschafft und zahlen alles bar."
          },
          "correct": "a",
          "explanation_vi": "Dòng 22–23: „große Aufgaben in kleine Teile zu zerlegen und auf mehrere Schultern zu verteilen“ ⇒ a."
        },
        {
          "id": "LV2-10",
          "question": "Im Vergleich zu früher …",
          "options": {
            "a": "engagieren sich heute deutlich weniger Menschen.",
            "b": "binden sich Freiwillige heute für kürzere Zeit.",
            "c": "bleiben Freiwillige heute länger in einem Verein."
          },
          "correct": "b",
          "explanation_vi": "Dòng 1–4: trước kia vào hội và ở lại cả đời, nay muốn biết „für wie lange“ ⇒ b. Bài không nói số người GIẢM (a)."
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
      "instruction_vi": "Đọc 10 tình huống rồi 12 mẩu rao vặt a–l (bối cảnh Leipzig). Mỗi mẩu dùng một lần; mẩu của ví dụ được dùng lại. Không mẩu nào hợp thì chọn x — đề thật luôn có hai tình huống như vậy.",
      "examples": [
        { "label": "01", "situation": "Ihre Eltern feiern goldene Hochzeit, und Sie möchten schöne Bilder von dem Fest haben.", "answer": "l" },
        { "label": "02", "situation": "Ihr Nachbar sucht für seine Tochter eine Klavierlehrerin, die zu ihm nach Hause kommt.", "answer": "x" }
      ],
      "ads": {
        "a": "Nachhilfe Mathe, Klasse 5–10, bei mir zu Hause in Leipzig-Gohlis. Geduldig, seit 6 Jahren Erfahrung. 15 €/Stunde. Tel. 0176-44 22 10",
        "b": "Verkaufe Kinderfahrrad, 20 Zoll, blau, kaum benutzt. 60 € VB. Abholung am Wochenende in Leipzig-Süd.",
        "c": "Suche Mitfahrgelegenheit Leipzig–Dresden, jeden Freitag gegen 15 Uhr, zurück Sonntagabend. Teile gern die Benzinkosten.",
        "d": "Hundebetreuung: Ich gehe mit Ihrem Hund, während Sie arbeiten. Werktags 9–15 Uhr, auch mehrere Hunde. Mit Referenzen.",
        "e": "Zimmer in 3er-WG frei ab 1. Oktober, 18 m², 5 Minuten zur Universität, ruhige Lage. 340 € warm. Nichtraucher.",
        "f": "Gitarrenunterricht für Anfänger, jedes Alter, bei Ihnen zu Hause oder in meinem Studio. Erste Stunde kostenlos.",
        "g": "Umzugshelfer gesucht: Samstag ab 10 Uhr, ca. 4 Stunden, 3. Stock ohne Aufzug. Bezahlung nach Absprache, Pizza inklusive.",
        "h": "Nähkurs für Erwachsene, dienstags 18–20 Uhr an der Volkshochschule. Maschinen vorhanden, Anfänger willkommen.",
        "i": "Kleiner Kühlschrank zu verschenken, 85 cm hoch, funktioniert einwandfrei. Nur Selbstabholung in Leipzig-Reudnitz.",
        "j": "Reinigungskraft für unser Büro gesucht: zweimal pro Woche abends, je 3 Stunden. Faire Bezahlung, Erfahrung erwünscht.",
        "k": "Deutschkurs A2 in kleiner Gruppe (max. 8 Personen), Start im September, 10 Wochen, montags und mittwochs abends.",
        "l": "Fotograf für Familienfeiern, Hochzeiten und Geburtstage, auch kurzfristig. Preise auf Anfrage, Beispiele auf meiner Webseite."
      },
      "items": [
        { "id": "LV3-11", "question": "Ihre Tochter hat Schwierigkeiten in Mathematik und braucht regelmäßig Hilfe.", "correct": "a", "explanation_vi": "Con gái kém Toán, cần kèm đều ⇒ a (dạy kèm Toán lớp 5–10)." },
        { "id": "LV3-12", "question": "Sie ziehen am Samstag um und brauchen jemanden, der beim Tragen hilft.", "correct": "g", "explanation_vi": "Chuyển nhà thứ Bảy, cần người khiêng ⇒ g." },
        { "id": "LV3-13", "question": "Sie arbeiten tagsüber und wissen nicht, wer mit Ihrem Hund spazieren geht.", "correct": "d", "explanation_vi": "Ban ngày đi làm, không ai dắt chó ⇒ d (trông chó giờ hành chính)." },
        { "id": "LV3-14", "question": "Sie suchen ein günstiges Zimmer in der Nähe der Universität.", "correct": "e", "explanation_vi": "Cần phòng rẻ gần trường ⇒ e." },
        { "id": "LV3-15", "question": "Sie möchten in Ihrer Freizeit ein Instrument lernen, haben aber noch nie gespielt.", "correct": "f", "explanation_vi": "Muốn học nhạc cụ từ đầu ⇒ f (guitar cho người mới)." },
        { "id": "LV3-16", "question": "Sie brauchen einen gebrauchten Kühlschrank und haben fast kein Geld.", "correct": "i", "explanation_vi": "Cần tủ lạnh cũ, gần như không có tiền ⇒ i (cho không)." },
        { "id": "LV3-17", "question": "Sie wollen Ihr Auto verkaufen und suchen einen Käufer in der Stadt.", "correct": "x", "explanation_vi": "Muốn BÁN ô tô — không mẩu nào rao MUA xe ⇒ x. Mẩu b là người khác bán xe đạp, chiều ngược lại." },
        { "id": "LV3-18", "question": "Sie fahren freitags oft nach Dresden und möchten die Kosten teilen.", "correct": "c", "explanation_vi": "Thứ Sáu hay đi Dresden, muốn chia tiền xăng ⇒ c." },
        { "id": "LV3-19", "question": "Sie suchen einen Kindergartenplatz für Ihren zweijährigen Sohn.", "correct": "x", "explanation_vi": "Tìm chỗ gửi trẻ — không mẩu nào về nhà trẻ ⇒ x. Mẩu d là trông CHÓ." },
        { "id": "LV3-20", "question": "Ihre Firma sucht jemanden, der abends die Büroräume sauber macht.", "correct": "j", "explanation_vi": "Công ty cần người dọn văn phòng buổi tối ⇒ j." }
      ]
    }
  ]
}
$j$::jsonb),
  '{sections,1}', $j$
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
      "gapped_text": "Sehr geehrte Frau Richter,\n\nich schreibe Ihnen, ___21___ ich meinen Termin am Donnerstag um 10 Uhr leider nicht wahrnehmen kann. Mein Sohn ist gestern Abend krank geworden, er hat hohes Fieber, und ich muss die nächsten Tage ___22___ Hause bleiben. Mein Mann ist diese Woche beruflich in Hamburg und kann mich nicht vertreten.\n\nKönnten Sie mir bitte ___23___ neuen Termin geben? Am besten passt es mir in der nächsten Woche, ___24___ ich ab Montag wieder arbeite. Vormittags bin ich flexibel, nachmittags nur nach 15 Uhr. Wenn Sie mir zwei oder drei Möglichkeiten nennen, ___25___ ich mich sofort entscheiden und Ihnen noch am selben Tag Bescheid geben.\n\nDie Unterlagen, ___26___ Sie mir letzte Woche geschickt haben, habe ich bereits ausgefüllt und unterschrieben. Ich bringe sie ___27___ zum Termin mit, dann müssen Sie nichts noch einmal ausdrucken.\n\nFür die Umstände möchte ich mich ___28___ entschuldigen. Es tut mir wirklich leid, dass ich so kurzfristig ___29___ muss – normalerweise halte ich meine Termine immer ein.\n\nVielen Dank für Ihr Verständnis. Ich freue mich ___30___ Ihre Antwort.\n\nMit freundlichen Grüßen\nSaskia Berger",
      "items": [
        { "id": "SB1-21", "gap": 21, "options": { "a": "weil", "b": "denn", "c": "obwohl" }, "correct": "a", "explanation_vi": "„weil“ mở mệnh đề lý do, động từ xuống cuối (…nicht wahrnehmen kann). „denn“ giữ trật tự câu chính; „obwohl“ nghĩa trái ngược." },
        { "id": "SB1-22", "gap": 22, "options": { "a": "nach", "b": "zu", "c": "bei" }, "correct": "b", "explanation_vi": "Cụm cố định „zu Hause bleiben“. „nach Hause“ chỉ dùng khi có chuyển động về nhà." },
        { "id": "SB1-23", "gap": 23, "options": { "a": "einen", "b": "einem", "c": "ein" }, "correct": "a", "explanation_vi": "„einen neuen Termin“ — Akkusativ giống đực sau „geben“." },
        { "id": "SB1-24", "gap": 24, "options": { "a": "damit", "b": "trotzdem", "c": "weil" }, "correct": "c", "explanation_vi": "Mệnh đề lý do: tuần sau hợp VÌ tôi đi làm lại ⇒ „weil“. „damit“ là mục đích, „trotzdem“ là nhượng bộ." },
        { "id": "SB1-25", "gap": 25, "options": { "a": "kann", "b": "könnte", "c": "konnte" }, "correct": "a", "explanation_vi": "Điều kiện thực ở hiện tại ⇒ „kann“. „könnte“ giả định, „konnte“ quá khứ." },
        { "id": "SB1-26", "gap": 26, "options": { "a": "was", "b": "die", "c": "der" }, "correct": "b", "explanation_vi": "Đại từ quan hệ cho „die Unterlagen“ (số nhiều, Akkusativ) ⇒ „die“." },
        { "id": "SB1-27", "gap": 27, "options": { "a": "gern", "b": "gerne", "c": "lieber" }, "correct": "a", "explanation_vi": "„Ich bringe sie gern mit“; „lieber“ nghĩa là thích hơn — không có so sánh ở đây." },
        { "id": "SB1-28", "gap": 28, "options": { "a": "herzlich", "b": "vielmals", "c": "sehr gern" }, "correct": "b", "explanation_vi": "Cụm quen dùng trong thư lịch sự: „sich vielmals entschuldigen“." },
        { "id": "SB1-29", "gap": 29, "options": { "a": "absagen", "b": "abgesagt", "c": "absage" }, "correct": "a", "explanation_vi": "Sau „muss“ là động từ nguyên thể ⇒ „absagen“." },
        { "id": "SB1-30", "gap": 30, "options": { "a": "über", "b": "auf", "c": "an" }, "correct": "b", "explanation_vi": "„sich freuen AUF“ + Akkusativ cho điều sắp tới; „über“ cho việc đã xảy ra." }
      ]
    },
    {
      "teil": 2,
      "type": "GAP_WORDBANK",
      "point_per_item": 1.5,
      "single_use": true,
      "instruction_de": "Lesen Sie die Anzeige und den Brief. Welches Wort aus dem Kasten (a–o) passt in die Lücken 31–40? Jedes Wort kann nur einmal verwendet werden. Nicht alle Wörter passen in den Text.",
      "instruction_vi": "Đọc mẩu tin rồi bức thư trả lời. Chọn từ trong hộp a–o cho mỗi ô 31–40; mỗi từ dùng một lần, năm từ thừa. Hộp gồm từ nối, giới từ, trạng từ, động từ khuyết thiếu — soi trật tự động từ và cặp từ dễ lẫn (AM/IM, VON/MIT, OB/WANN…).",
      "stimulus_ad": "Ferienwohnung am Bodensee\n2 Zimmer, Küche, Balkon mit Seeblick · 3 Minuten zum Strand · ab Juli frei\nFamilie Berger · ferienwohnung-berger@example.de",
      "word_bank": {
        "a": "AM",
        "b": "BITTE",
        "c": "DESHALB",
        "d": "FALLS",
        "e": "FÜR",
        "f": "IM",
        "g": "MIT",
        "h": "MÖCHTEN",
        "i": "OB",
        "j": "OBWOHL",
        "k": "OHNE",
        "l": "VON",
        "m": "WANN",
        "n": "WOLLTEN",
        "o": "WÜRDEN"
      },
      "gapped_text": "Sehr geehrte Frau Berger,\n\nwir haben Ihre Anzeige ___31___ Wochenende in der Zeitung gelesen und interessieren uns sehr ___32___ die Ferienwohnung am See. Wir sind eine Familie mit zwei Kindern und ___33___ im Juli zwei Wochen bei Ihnen verbringen, ___34___ die Wohnung dann noch frei ist.\n\nKönnten Sie uns ___35___ mitteilen, wie hoch der Preis pro Woche ist und ___36___ Bettwäsche und Handtücher vorhanden sind? Unsere Tochter ist erst drei Jahre alt, ___37___ wäre ein Kinderbett sehr wichtig für uns. Außerdem würden wir gern wissen, wie weit der Strand ___38___ der Wohnung entfernt ist und ob man dort auch ___39___ Auto einkaufen kann.\n\nWir ___40___ uns sehr freuen, bald von Ihnen zu hören.\n\nMit freundlichen Grüßen\nFamilie Weber",
      "items": [
        { "id": "SB2-31", "gap": 31, "correct": "a", "explanation_vi": "„am Wochenende“ — cụm thời gian cố định; IM (f) là nhiễu cặp." },
        { "id": "SB2-32", "gap": 32, "correct": "e", "explanation_vi": "„sich interessieren FÜR“ — động từ đi với giới từ cố định." },
        { "id": "SB2-33", "gap": 33, "correct": "h", "explanation_vi": "„wir … möchten … verbringen“ — muốn lịch sự ở hiện tại; WOLLTEN (n) là quá khứ, sai thì." },
        { "id": "SB2-34", "gap": 34, "correct": "d", "explanation_vi": "„falls die Wohnung dann noch frei ist“ — điều kiện, động từ cuối câu; OBWOHL (j) nghĩa nhượng bộ, sai nghĩa." },
        { "id": "SB2-35", "gap": 35, "correct": "b", "explanation_vi": "„Könnten Sie uns bitte mitteilen“ — trạng từ lịch sự." },
        { "id": "SB2-36", "gap": 36, "correct": "i", "explanation_vi": "„… und OB Bettwäsche vorhanden sind“ — câu hỏi gián tiếp có/không; WANN (m) hỏi thời điểm, sai nghĩa." },
        { "id": "SB2-37", "gap": 37, "correct": "c", "explanation_vi": "„…, deshalb wäre ein Kinderbett wichtig“ — hệ quả, đứng đầu mệnh đề chính với đảo ngữ." },
        { "id": "SB2-38", "gap": 38, "correct": "l", "explanation_vi": "„weit VON der Wohnung entfernt“ — cụm cố định; MIT (g) là nhiễu." },
        { "id": "SB2-39", "gap": 39, "correct": "k", "explanation_vi": "„ohne Auto einkaufen“ — không có ô tô; MIT (g) đảo nghĩa." },
        { "id": "SB2-40", "gap": 40, "correct": "o", "explanation_vi": "„Wir würden uns sehr freuen“ — Konjunktiv II lịch sự; WOLLTEN (n) sai." }
      ]
    }
  ]
}
$j$::jsonb)
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 1'
  AND jsonb_array_length(sections_json->'sections') = 4
  AND sections_json->'sections'->0->>'name' = 'LESEN'
  AND sections_json->'sections'->1->>'name' = 'SPRACHBAUSTEINE';
