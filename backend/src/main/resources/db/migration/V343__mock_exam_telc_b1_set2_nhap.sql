-- Đề thi thử MÔ PHỎNG định dạng telc B1 — Set 2, BẢN NHÁP chờ duyệt (26/10/2026).
--
-- AI soạn nháp theo quyết định owner 21/10 (câu 8 kế hoạch sau 2d+2e): đúng cấu trúc, ghi "mô
-- phỏng", chưa duyệt thì học viên chỉ thấy "Sắp có". Hàng này mang reviewed = FALSE và
-- is_active = FALSE (V342) — duyệt xong mới bật bằng một migration riêng.
--
-- Đề SOẠN GỐC, khuôn y hệt Set 1 SAU các lớp sửa V327–V329 (repo PUBLIC: không chép sách hay đề
-- đang lưu hành, không dùng logo telc). Bối cảnh Bremen; chủ đề không trùng Set 1.
--   Leseverstehen     75 = Teil 1 (5 × 5) + Teil 2 (5 × 5) + Teil 3 (10 × 2,5)
--   Sprachbausteine   30 = Teil 1 (10 × 1,5) + Teil 2 (10 × 1,5)
--   Hörverstehen      75 = Teil 1 (5 × 5, nghe 1 lần) + Teil 2 (10 × 2,5) + Teil 3 (5 × 5)
--   Schriftl. Ausdruck 45 = một E-Mail trả lời bạn, 3 Kriterien × 15
--   Tổng 60 câu · 225 điểm · đỗ 135. Phần Nói lấy từ module luyện thi nói (cổng 45/75).
--
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, sections_json,
                        total_points, pass_points, time_limit_minutes, is_active, reviewed)
VALUES ('B1', 'TELC', 'telc Deutsch B1 — Đề số 2',
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
            "a": "Bibliothek bietet jetzt Deutschkurse mit Abschlussprüfung an",
            "b": "Reparieren statt wegwerfen: Freiwillige helfen beim Selbermachen",
            "c": "Nachtbusse fahren am Wochenende künftig bis zum Morgen",
            "d": "Händler müssen die alte Markthalle verlassen",
            "e": "Schülervertretung setzt handyfreie Tage durch – mit Erfolg",
            "f": "Nachts wird Busfahren in Bremen teurer",
            "g": "Lebensmittel aus der Region in der umgebauten Markthalle",
            "h": "Gesamtschule verbietet Smartphones komplett",
            "i": "Im Sprachcafé üben Neuankömmlinge ohne Druck das Sprechen",
            "j": "Neuer Laden verkauft gebrauchte Elektrogeräte günstig"
          },
          "items": [
            {
              "id": "LV1-1",
              "question": "Text 1",
              "text": "Nach zwei Jahren Umbau öffnet die alte Markthalle am Bremer Domshof am kommenden Samstag wieder ihre Türen. Statt billiger Massenware gibt es dort jetzt vor allem Lebensmittel von Bauernhöfen aus der Region: Käse, Brot, Obst und frischen Fisch von der Küste. Die zwanzig Stände sind von Dienstag bis Samstag geöffnet, an zwei Abenden in der Woche sogar bis 22 Uhr. Im ersten Stock gibt es außerdem eine Kochschule, in der Kinder kostenlos Kurse besuchen können. Die Händler hoffen, dass die Halle wieder ein Treffpunkt für die ganze Innenstadt wird.",
              "correct": "g",
              "explanation_vi": "Chợ có mái che mở lại sau hai năm sửa, bán chủ yếu thực phẩm từ nông trại trong vùng ⇒ g. Tiêu đề d là „bóng“: tiểu thương không phải rời đi, họ đang mong chợ đông khách trở lại."
            },
            {
              "id": "LV1-2",
              "question": "Text 2",
              "text": "Jeden Donnerstag zwischen 17 und 19 Uhr wird der Lesesaal der Stadtbibliothek Vegesack zum Sprachcafé. Menschen, die neu in Deutschland sind, treffen dort Ehrenamtliche und üben ganz ohne Unterricht und ohne Noten das Sprechen. Man unterhält sich über Alltagsthemen wie Einkaufen, Arbeit oder Kinder. Eine Anmeldung ist nicht nötig, Tee und Kekse gibt es umsonst. Weil inzwischen oft mehr als vierzig Gäste kommen, sucht die Bibliothek dringend weitere Freiwillige, die Lust haben, sich eine Stunde pro Woche mit anderen zu unterhalten.",
              "correct": "i",
              "explanation_vi": "Người mới đến Đức luyện nói với tình nguyện viên, „ohne Unterricht und ohne Noten“ ⇒ i. Tiêu đề a là bóng: không có khoá học, càng không có kỳ thi."
            },
            {
              "id": "LV1-3",
              "question": "Text 3",
              "text": "Wer am Wochenende spät aus der Innenstadt nach Hause will, muss nicht mehr auf ein Taxi warten. Ab dem 1. März fahren die Nachtbusse in Bremen freitags und samstags nicht mehr nur bis ein Uhr, sondern die ganze Nacht im Stundentakt. Drei neue Linien verbinden außerdem die Stadtteile im Norden mit dem Hauptbahnhof. Die Fahrpreise bleiben gleich; mit einem normalen Monatsticket kann man auch nachts fahren. Die Verkehrsbetriebe testen das Angebot zunächst ein Jahr lang und wollen danach entscheiden, ob es bleibt.",
              "correct": "c",
              "explanation_vi": "Xe buýt đêm thứ Sáu, thứ Bảy chạy suốt đêm ⇒ c. Tiêu đề f là bóng: bài nói rõ „Die Fahrpreise bleiben gleich“."
            },
            {
              "id": "LV1-4",
              "question": "Text 4",
              "text": "An der Gesamtschule Ost bleiben die Smartphones seit diesem Schuljahr an zwei Tagen pro Woche im Schrank. Montags und donnerstags geben alle Schülerinnen und Schüler ihre Geräte morgens ab und bekommen sie erst nach der letzten Stunde zurück. Die Idee kam von der Schülervertretung selbst: Viele hatten bemerkt, dass in den Pausen kaum noch jemand miteinander spricht. Nach drei Monaten ist das Ergebnis positiv. Auf dem Schulhof wird wieder Fußball gespielt, und auch die Lehrkräfte berichten von ruhigeren Unterrichtsstunden.",
              "correct": "e",
              "explanation_vi": "Ý tưởng hai ngày không điện thoại đến từ chính hội học sinh, kết quả tốt ⇒ e. Tiêu đề h là bóng: chỉ hai ngày mỗi tuần, không cấm hoàn toàn."
            },
            {
              "id": "LV1-5",
              "question": "Text 5",
              "text": "Ein Toaster, der nicht mehr warm wird, eine Lampe mit Wackelkontakt, eine Hose mit Loch: Im Repair Café im Stadtteilhaus Findorff wird seit fünf Jahren einmal im Monat repariert statt weggeworfen. Rund fünfzehn Freiwillige – darunter ein pensionierter Elektriker und zwei Schneiderinnen – helfen den Besucherinnen und Besuchern, ihre Sachen selbst wieder in Ordnung zu bringen. Bezahlen muss man nichts, eine Spende ist aber willkommen. Im letzten Jahr konnten so mehr als 600 Gegenstände gerettet werden.",
              "correct": "b",
              "explanation_vi": "Tình nguyện viên giúp khách tự sửa đồ thay vì vứt ⇒ b. Tiêu đề j là bóng: ở đây không ai bán đồ điện cũ."
            }
          ]
        },
        {
          "teil": 2,
          "type": "MULTIPLE_CHOICE",
          "point_per_item": 5,
          "instruction_de": "Lesen Sie zuerst den Text und lösen Sie dann die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Beachten Sie: Die Reihenfolge der Aufgaben folgt nicht immer der Reihenfolge des Textes.",
          "instruction_vi": "Đọc bài rồi làm câu 6–10: mỗi câu là một mở đầu câu, chọn đuôi đúng (a, b hoặc c). Thứ tự câu hỏi KHÔNG theo thứ tự bài — dùng số dòng để định vị.",
          "title_de": "Leih-Großeltern*: Familie auf Zeit",
          "vorspann_de": "Viele Kinder sehen ihre Großeltern nur zweimal im Jahr, weil diese weit weg wohnen. Gleichzeitig gibt es ältere Menschen, die gern Zeit mit Kindern verbringen würden. Ein Verein in Hannover bringt beide Seiten zusammen.",
          "context_lines": true,
          "glossary": [
            { "term": "Leih-Großeltern", "explanation_de": "ältere Menschen, die regelmäßig Zeit mit einer fremden Familie verbringen, wie Oma und Opa" },
            { "term": "Probezeit", "explanation_de": "eine erste Zeit, in der man testet, ob etwas gut passt" }
          ],
          "context": "Als Familie Hoffmann vor vier Jahren von Leipzig nach Hannover\nzog, war die neue Wohnung schnell eingerichtet. Schwieriger war\netwas anderes: Die Großeltern wohnten plötzlich dreihundert\nKilometer entfernt. „Unsere Kinder haben Oma und Opa sehr vermisst“,\nerzählt Mutter Katrin Hoffmann. „Und wir hatten niemanden mehr,\nder mal einen Nachmittag einspringen konnte, wenn ein Kind krank war.“\n\nHeute kommt jeden Mittwoch Gisela Brandes zu Besuch. Die\nsiebzigjährige frühere Grundschullehrerin holt den sechsjährigen\nPaul vom Kindergarten ab, backt mit seiner Schwester Waffeln oder\ngeht mit beiden auf den Spielplatz. Verwandt ist sie mit der Familie\nnicht. Kennengelernt haben sie sich über den Verein „Wunschgroßeltern“,\nder seit zehn Jahren ältere Menschen und junge Familien zusammenbringt.\n\nDie Idee ist einfach, die Arbeit dahinter nicht. Bevor jemand\nvermittelt wird, führt der Verein mit beiden Seiten lange Gespräche.\n„Wir fragen nicht nur, wie viel Zeit jemand hat“, sagt Vereinsleiterin\nSabine Kröger. „Wir wollen wissen, was sich die Menschen wünschen und\nwovor sie Angst haben.“ Manche Familien hoffen vor allem auf eine\nkostenlose Kinderbetreuung. Solche Anfragen lehnt der Verein ab.\n„Leih-Großeltern sind keine Babysitter. Es geht um eine Beziehung.“\n\nNach dem ersten Treffen gibt es eine Probezeit* von drei Monaten.\nIn dieser Zeit können beide Seiten ohne Begründung aufhören. Laut\nKröger passiert das aber selten: Neun von zehn Paaren bleiben\nzusammen, viele über Jahre. Einige Kinder, die der Verein am Anfang\nvermittelt hat, sind heute schon erwachsen und besuchen ihre\nLeih-Oma immer noch.\n\nAuch für die Älteren lohnt sich das Projekt. Gisela Brandes hat\nselbst keine Enkel, ihr Sohn lebt in Kanada. „Nach meiner Pensionierung\nwaren die Tage plötzlich sehr lang“, sagt sie. „Jetzt freue ich mich\ndie ganze Woche auf den Mittwoch.“ Geld bekommt sie für ihre Besuche\nnicht; die Familie bezahlt nur die Fahrkarte und das Material, wenn\nsie zusammen basteln. Inzwischen hat sie sogar einen Erste-Hilfe-Kurs\nfür Kinder gemacht, den der Verein allen Leih-Großeltern anbietet.\n\nDas größte Problem des Vereins ist zurzeit, dass sich viel mehr\nFamilien melden als ältere Menschen. Auf der Warteliste stehen über\nhundert Familien. Besonders Männer fehlen: Nur jeder fünfte\nLeih-Großelternteil ist ein Opa. Der Verein wirbt deshalb jetzt\ngezielt in Sportvereinen und bei Seniorentreffen. Wer unsicher ist,\nkann zuerst an einem offenen Treffen teilnehmen, ohne sich festzulegen.",
          "items": [
            {
              "id": "LV2-6",
              "question": "Der Verein wirbt zurzeit besonders um …",
              "options": {
                "a": "junge Familien mit kleinen Kindern.",
                "b": "ältere Männer, die Zeit haben.",
                "c": "Lehrerinnen im Ruhestand."
              },
              "correct": "b",
              "explanation_vi": "Đoạn cuối: chỉ một phần năm là „Opa“, hội đang tìm người ở câu lạc bộ thể thao và buổi gặp người cao tuổi ⇒ b. Câu đầu tiên nhưng trả lời ở CUỐI bài."
            },
            {
              "id": "LV2-7",
              "question": "Familie Hoffmann hat nach dem Umzug vor allem gefehlt, …",
              "options": {
                "a": "dass jemand spontan helfen konnte.",
                "b": "eine größere Wohnung.",
                "c": "ein Platz im Kindergarten."
              },
              "correct": "a",
              "explanation_vi": "Dòng 5–6: không còn ai „einspringen“ khi con ốm ⇒ a. Nhà mới thì „schnell eingerichtet“, không phải vấn đề."
            },
            {
              "id": "LV2-8",
              "question": "Wenn eine Familie nur eine günstige Kinderbetreuung sucht, …",
              "options": {
                "a": "bekommt sie schneller einen Platz.",
                "b": "vermittelt der Verein sie nicht.",
                "c": "muss sie eine Gebühr bezahlen."
              },
              "correct": "b",
              "explanation_vi": "„Solche Anfragen lehnt der Verein ab“ — Leih-Großeltern không phải người trông trẻ ⇒ b."
            },
            {
              "id": "LV2-9",
              "question": "Gisela Brandes bekommt für ihre Besuche …",
              "options": {
                "a": "einen kleinen Lohn vom Verein.",
                "b": "jeden Monat Geld von der Familie.",
                "c": "nur ihre Fahrkosten und das Material bezahlt."
              },
              "correct": "c",
              "explanation_vi": "„Geld bekommt sie … nicht; die Familie bezahlt nur die Fahrkarte und das Material“ ⇒ c."
            },
            {
              "id": "LV2-10",
              "question": "In der Probezeit …",
              "options": {
                "a": "dürfen beide Seiten ohne Grund aufhören.",
                "b": "trifft man sich jeden Tag.",
                "c": "hören die meisten Paare wieder auf."
              },
              "correct": "a",
              "explanation_vi": "„können beide Seiten ohne Begründung aufhören“ ⇒ a. c nói ngược bài: chín trên mười cặp ở lại."
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
          "instruction_vi": "Đọc 10 tình huống rồi 12 mẩu rao vặt a–l (bối cảnh Bremen). Mỗi mẩu dùng một lần; mẩu của ví dụ được dùng lại. Không mẩu nào hợp thì chọn x — đề thật luôn có hai tình huống như vậy.",
          "examples": [
            { "label": "01", "situation": "Sie feiern Ihren 40. Geburtstag mit vielen Gästen und möchten nicht selbst kochen.", "answer": "l" },
            { "label": "02", "situation": "Sie suchen jemanden, der Ihnen das Autofahren beibringt.", "answer": "x" }
          ],
          "ads": {
            "a": "Babysitterin (Studentin, 23) hat abends und am Wochenende Zeit. Erfahrung mit Kleinkindern, Erste-Hilfe-Kurs. Bremen-Mitte, 12 €/Std.",
            "b": "Verkaufe Waschmaschine, 3 Jahre alt, sehr sparsam. 150 €. Muss bis Monatsende abgeholt werden, Bremen-Walle.",
            "c": "Wer hilft mir im Garten? Rasen mähen und Hecke schneiden, ca. 2 Stunden pro Woche, Bremen-Horn. Gute Bezahlung.",
            "d": "Schwimmkurs für Erwachsene: Keine Angst mehr vor dem Wasser! 8 Termine, samstags 9 Uhr, Hallenbad Süd. Nur 6 Personen pro Kurs.",
            "e": "Computerhilfe für Senioren: Ich erkläre Ihnen geduldig Handy, Tablet und E-Mail – bei Ihnen zu Hause. 15 € pro Stunde.",
            "f": "Tanzkurs Salsa für Paare und Singles, freitags 20 Uhr, Tanzschule am Wall. Probestunde kostenlos.",
            "g": "Biete Fahrdienst zum Flughafen Bremen und Hamburg, auch nachts und am frühen Morgen. Festpreise, Tel. 0421-55 66 77.",
            "h": "Nachmieter für 2-Zimmer-Wohnung gesucht, 52 m², Balkon, ab 1. Mai, Bremen-Neustadt. 620 € warm. Haustiere erlaubt.",
            "i": "Gebrauchte Schulbücher für die Klassen 7–10 günstig abzugeben. Liste per E-Mail: buecher-bremen@example.de",
            "j": "Fahrradwerkstatt mobil: Ich repariere Ihr Rad direkt vor Ihrer Haustür. Termine auch am Abend.",
            "k": "Englisch-Konversation für Berufstätige: kleine Gruppe, mittwochs 19 Uhr, Schwerpunkt Telefonieren und E-Mails.",
            "l": "Partyservice für Feiern bis 50 Personen: warme und kalte Buffets, auch vegetarisch. Lieferung im ganzen Stadtgebiet."
          },
          "items": [
            { "id": "LV3-11", "question": "Ihr Vater ist 78 und möchte lernen, wie er seinen Enkeln Fotos per E-Mail schickt.", "correct": "e", "explanation_vi": "Người cao tuổi muốn học gửi ảnh qua e-mail ⇒ e (hỗ trợ máy tính cho người già, tại nhà)." },
            { "id": "LV3-12", "question": "Sie können nicht schwimmen und möchten es als Erwachsener endlich lernen.", "correct": "d", "explanation_vi": "Người lớn học bơi ⇒ d." },
            { "id": "LV3-13", "question": "Ihr Flug geht morgen um 6 Uhr früh, und um diese Zeit fahren noch keine Busse.", "correct": "g", "explanation_vi": "Cần ra sân bay lúc sáng sớm, chưa có xe buýt ⇒ g (đưa đón sân bay cả đêm và sáng sớm)." },
            { "id": "LV3-14", "question": "Sie möchten am Samstagabend ins Kino und brauchen jemanden, der auf Ihre kleine Tochter aufpasst.", "correct": "a", "explanation_vi": "Cần người trông con tối thứ Bảy ⇒ a (sinh viên trông trẻ buổi tối và cuối tuần)." },
            { "id": "LV3-15", "question": "Ihr Fahrrad ist kaputt, aber Sie haben keine Zeit, es in eine Werkstatt zu bringen.", "correct": "j", "explanation_vi": "Xe đạp hỏng mà không có thời gian mang đi sửa ⇒ j (thợ sửa tận cửa)." },
            { "id": "LV3-16", "question": "Sie suchen eine Wohnung, in der Sie Ihre Katze halten dürfen.", "correct": "h", "explanation_vi": "Tìm nhà được nuôi mèo ⇒ h („Haustiere erlaubt“)." },
            { "id": "LV3-17", "question": "Sie müssen für Ihre neue Arbeitsstelle besser auf Englisch telefonieren können.", "correct": "k", "explanation_vi": "Cần gọi điện bằng tiếng Anh cho công việc ⇒ k (trọng tâm Telefonieren)." },
            { "id": "LV3-18", "question": "Ihre alte Waschmaschine ist kaputt, und Sie wollen nicht viel Geld ausgeben.", "correct": "b", "explanation_vi": "Máy giặt hỏng, muốn mua rẻ ⇒ b (máy giặt cũ 150 €)." },
            { "id": "LV3-19", "question": "Sie möchten Ihren alten Kühlschrank verkaufen.", "correct": "x", "explanation_vi": "Muốn BÁN tủ lạnh — không ai rao MUA tủ lạnh ⇒ x. Mẩu b là người khác bán máy giặt, chiều ngược lại." },
            { "id": "LV3-20", "question": "Sie suchen einen Kurs, in dem Sie Gitarre spielen lernen.", "correct": "x", "explanation_vi": "Học guitar — không có mẩu nào ⇒ x. Mẩu f là khiêu vũ Salsa, không phải nhạc cụ." }
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
          "gapped_text": "Sehr geehrte Damen und Herren,\n\nich wohne seit drei Jahren in der Wohnung Nummer 12 in der Hafenstraße 8 und wende mich heute ___21___ einem dringenden Problem an Sie. Seit letztem Freitag funktioniert die Heizung in meiner Wohnung nicht mehr. Die Heizkörper bleiben kalt, ___22___ ich sie ganz aufdrehe. Draußen sind es nachts nur noch zwei Grad, und in meinem Schlafzimmer ist es inzwischen sehr kalt.\n\nIch habe schon zweimal ___23___ Hausmeister angerufen, aber er war leider nie zu erreichen. Auch meine Nachbarin im zweiten Stock hat ___24___ gleiche Problem. Deshalb glaube ich, ___25___ es an der zentralen Heizungsanlage liegt.\n\nIch bitte Sie, so schnell wie möglich einen Techniker zu schicken. Ich bin von Montag bis Mittwoch ab 16 Uhr zu Hause; an den anderen Tagen kann der Techniker ___26___ bei meiner Nachbarin klingeln, ___27___ einen Schlüssel von mir hat.\n\nAußerdem möchte ich Sie fragen, ___28___ ich für die Zeit ohne Heizung weniger Miete zahlen muss. Ich ___29___ mich freuen, wenn Sie mir dazu eine kurze Auskunft geben könnten.\n\nIch hoffe auf eine schnelle Lösung und bedanke mich ___30___ Voraus.\n\nMit freundlichen Grüßen\nDaniel Krause",
          "items": [
            { "id": "SB1-21", "gap": 21, "options": { "a": "mit", "b": "von", "c": "über" }, "correct": "a", "explanation_vi": "„sich an jemanden MIT einem Problem wenden“ — cụm cố định." },
            { "id": "SB1-22", "gap": 22, "options": { "a": "weil", "b": "obwohl", "c": "damit" }, "correct": "b", "explanation_vi": "Lò sưởi vẫn lạnh DÙ đã vặn hết cỡ ⇒ nhượng bộ „obwohl“. „weil“ là lý do, „damit“ là mục đích." },
            { "id": "SB1-23", "gap": 23, "options": { "a": "dem", "b": "den", "c": "der" }, "correct": "b", "explanation_vi": "„jemanden anrufen“ + Akkusativ giống đực ⇒ „den Hausmeister“." },
            { "id": "SB1-24", "gap": 24, "options": { "a": "die", "b": "den", "c": "das" }, "correct": "c", "explanation_vi": "„das Problem“ giống trung, Akkusativ ⇒ „das gleiche Problem“." },
            { "id": "SB1-25", "gap": 25, "options": { "a": "ob", "b": "dass", "c": "wenn" }, "correct": "b", "explanation_vi": "„Ich glaube, dass …“ — mệnh đề nội dung sau động từ nghĩ/tin." },
            { "id": "SB1-26", "gap": 26, "options": { "a": "einfach", "b": "einfache", "c": "einfachen" }, "correct": "a", "explanation_vi": "Trạng từ đứng trước cụm động từ không chia đuôi ⇒ „einfach“; hai dạng kia là tính từ có đuôi, cần danh từ đi kèm." },
            { "id": "SB1-27", "gap": 27, "options": { "a": "der", "b": "die", "c": "das" }, "correct": "b", "explanation_vi": "Đại từ quan hệ cho „meine Nachbarin“ (giống cái, Nominativ) ⇒ „die“." },
            { "id": "SB1-28", "gap": 28, "options": { "a": "ob", "b": "dass", "c": "wann" }, "correct": "a", "explanation_vi": "Câu hỏi gián tiếp có/không sau „fragen“ ⇒ „ob“." },
            { "id": "SB1-29", "gap": 29, "options": { "a": "werde", "b": "würde", "c": "wurde" }, "correct": "b", "explanation_vi": "Lời đề nghị lịch sự dùng Konjunktiv II: „Ich würde mich freuen“." },
            { "id": "SB1-30", "gap": 30, "options": { "a": "im", "b": "am", "c": "zum" }, "correct": "a", "explanation_vi": "Cụm cố định cuối thư: „sich im Voraus bedanken“." }
          ]
        },
        {
          "teil": 2,
          "type": "GAP_WORDBANK",
          "point_per_item": 1.5,
          "single_use": true,
          "instruction_de": "Lesen Sie die Anzeige und den Brief. Welches Wort aus dem Kasten (a–o) passt in die Lücken 31–40? Jedes Wort kann nur einmal verwendet werden. Nicht alle Wörter passen in den Text.",
          "instruction_vi": "Đọc mẩu tin rồi bức thư trả lời. Chọn từ trong hộp a–o cho mỗi ô 31–40; mỗi từ dùng một lần, năm từ thừa. Hộp gồm từ nối, giới từ, động từ khuyết thiếu — soi trật tự động từ và cặp từ dễ lẫn (AM/IM, KÖNNEN/KONNTEN…).",
          "stimulus_ad": "Kochkurs „Vegetarisch für Einsteiger“\n6 Abende · donnerstags 18:30–21:00 · Volkshochschule Bremen-West\nMax. 10 Personen · Anmeldung bei Herrn Petersen · kochkurs-vhs@example.de",
          "word_bank": {
            "a": "AM",
            "b": "BIS",
            "c": "FALLS",
            "d": "FÜR",
            "e": "IM",
            "f": "KÖNNEN",
            "g": "KONNTEN",
            "h": "MIT",
            "i": "MÖCHTE",
            "j": "OBWOHL",
            "k": "ODER",
            "l": "OHNE",
            "m": "SEIT",
            "n": "WIE",
            "o": "WÜRDEN"
          },
          "gapped_text": "Sehr geehrter Herr Petersen,\n\nich habe Ihre Anzeige ___31___ Internet gesehen und interessiere mich sehr für den Kochkurs. Ich esse seit einem halben Jahr kein Fleisch mehr, aber ich weiß noch nicht genau, ___32___ ich gesund und abwechslungsreich kochen kann.\n\nBevor ich mich anmelde, habe ich noch ein paar Fragen. Muss ich eigene Messer und Töpfe mitbringen, ___33___ gibt es in der Küche alles, was man braucht? Und wie viel kostet der Kurs ___34___ die Lebensmittel?\n\nLeider arbeite ich donnerstags manchmal ___35___ 19 Uhr. ___36___ ich an einem Abend später komme, kann ich dann trotzdem teilnehmen? Ich ___37___ natürlich niemanden stören.\n\nAußerdem würde ich gern ___38___ meiner Freundin zusammen kommen. Wir ___39___ uns aber erst anmelden, wenn wir wissen, ob es noch zwei freie Plätze gibt.\n\nIch freue mich auf Ihre Antwort und bedanke mich ___40___ Ihre Hilfe.\n\nMit freundlichen Grüßen\nSophie Lange",
          "items": [
            { "id": "SB2-31", "gap": 31, "correct": "e", "explanation_vi": "„im Internet“ — cụm cố định; AM (a) là nhiễu cặp." },
            { "id": "SB2-32", "gap": 32, "correct": "n", "explanation_vi": "„…, wie ich gesund kochen kann“ — câu hỏi gián tiếp về CÁCH làm, động từ cuối câu." },
            { "id": "SB2-33", "gap": 33, "correct": "k", "explanation_vi": "Hai khả năng trong một câu hỏi: tự mang dao nồi HAY bếp có sẵn ⇒ „oder“, giữ trật tự câu hỏi." },
            { "id": "SB2-34", "gap": 34, "correct": "l", "explanation_vi": "„ohne die Lebensmittel“ — ohne + Akkusativ. MIT (h) cần Dativ „mit den Lebensmitteln“, nên sai." },
            { "id": "SB2-35", "gap": 35, "correct": "b", "explanation_vi": "„bis 19 Uhr arbeiten“ — mốc kết thúc; SEIT (m) chỉ mốc bắt đầu kéo dài tới nay." },
            { "id": "SB2-36", "gap": 36, "correct": "c", "explanation_vi": "„Falls ich später komme, …“ — điều kiện, động từ cuối mệnh đề; OBWOHL (j) sai nghĩa." },
            { "id": "SB2-37", "gap": 37, "correct": "i", "explanation_vi": "„Ich möchte niemanden stören“ — chủ ngữ „ich“ đi với „möchte“; WÜRDEN (o) là ngôi „wir/sie“, sai chủ ngữ." },
            { "id": "SB2-38", "gap": 38, "correct": "h", "explanation_vi": "„mit meiner Freundin zusammen“ — mit + Dativ." },
            { "id": "SB2-39", "gap": 39, "correct": "f", "explanation_vi": "„Wir können uns erst anmelden, wenn …“ — hiện tại; KONNTEN (g) là quá khứ, sai thì." },
            { "id": "SB2-40", "gap": 40, "correct": "d", "explanation_vi": "„sich FÜR etwas bedanken“ — động từ đi với giới từ cố định." }
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
          "framing_de": "Was machen die Menschen in ihrer Mittagspause? Wir haben fünf Personen gefragt: „Wie verbringen Sie Ihre Mittagspause, und warum so?“ Hören Sie dazu die Antworten.",
          "instruction_de": "Sie hören nun fünf kurze Texte. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind.",
          "instruction_vi": "Nghe 5 người kể về cùng một chủ đề, mỗi người CHỈ MỘT LẦN. Sau hướng dẫn có 30 giây đọc câu hỏi. Chọn đúng hoặc sai.",
          "items": [
            {
              "id": "HV1-41",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin isst mittags meistens in der Kantine.",
              "audio_script": "Nummer 41. Ich arbeite in einer großen Versicherung, und dort gibt es eine Kantine. Das Essen ist eigentlich gut und auch nicht teuer, aber ich gehe trotzdem fast nie hin. Mittags brauche ich einfach frische Luft. Deshalb nehme ich mir morgens ein Brot und etwas Obst mit und setze mich bei gutem Wetter in den Park gegenüber. Wenn es regnet, esse ich an meinem Schreibtisch, was ich eigentlich nicht mag. Aber eine halbe Stunde ohne Kollegen und ohne Telefon, das ist mir wichtig.",
              "correct": "falsch",
              "explanation_vi": "Cô ấy „gehe trotzdem fast nie hin“ — gần như không bao giờ ăn ở căng tin, mà ra công viên ⇒ SAI."
            },
            {
              "id": "HV1-42",
              "speaker": "PARTNER",
              "question": "Der Sprecher nimmt manchmal warmes Essen von zu Hause mit.",
              "audio_script": "Nummer 42. Ich bin Handwerker, ich arbeite jeden Tag auf einer anderen Baustelle. Eine richtige Mittagspause gibt es bei uns eigentlich nicht, wir machen um zwölf eine kurze Pause von zwanzig Minuten. Meistens holen wir uns etwas beim Bäcker oder an einer Imbissbude. Das ist auf Dauer natürlich nicht gesund und auch nicht billig. Meine Frau hat mir deshalb zum Geburtstag eine Thermosdose geschenkt. Seitdem nehme ich zweimal pro Woche Suppe von zu Hause mit, und das schmeckt mir sogar besser.",
              "correct": "richtig",
              "explanation_vi": "Hai lần mỗi tuần mang súp nóng trong hộp giữ nhiệt ⇒ ĐÚNG."
            },
            {
              "id": "HV1-43",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin macht in der Mittagspause Sport, damit sie abends mehr Zeit hat.",
              "audio_script": "Nummer 43. Ich nutze die Mittagspause für Sport. In unserem Firmengebäude gibt es seit letztem Jahr einen kleinen Fitnessraum, und zweimal pro Woche bietet eine Trainerin dort einen Kurs an, Rücken und Bauch, eine halbe Stunde. Danach dusche ich schnell und esse dann am Schreibtisch einen Salat. Viele Kollegen finden das stressig, aber für mich ist es genau richtig. Nach dem Sport bin ich am Nachmittag viel konzentrierter, und abends habe ich dann frei für meine Familie.",
              "correct": "richtig",
              "explanation_vi": "Tập buổi trưa nên „abends habe ich dann frei für meine Familie“ ⇒ ĐÚNG."
            },
            {
              "id": "HV1-44",
              "speaker": "PARTNER",
              "question": "Der Sprecher ärgert sich heute noch jeden Tag über die kurze Pause.",
              "audio_script": "Nummer 44. Ich bin Lehrer, und ehrlich gesagt: Eine Mittagspause habe ich nicht. Zwischen der fünften und der sechsten Stunde habe ich fünfzehn Minuten, und in dieser Zeit kommen oft noch Schüler mit Fragen zu mir. Früher habe ich mich darüber geärgert. Inzwischen esse ich einfach in der großen Pause um zehn ein richtiges Frühstück und zu Hause um halb drei eine warme Mahlzeit. Das funktioniert eigentlich ganz gut, nur am Donnerstag, wenn ich bis vier unterrichte, bekomme ich schlechte Laune.",
              "correct": "falsch",
              "explanation_vi": "„Früher habe ich mich darüber geärgert“ — đó là TRƯỚC KIA; nay chỉ bực vào thứ Năm ⇒ SAI."
            },
            {
              "id": "HV1-45",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin sieht ihre Schwester vor allem am Wochenende.",
              "audio_script": "Nummer 45. Ich treffe mich in der Mittagspause mit meiner Schwester. Sie arbeitet nur zwei Straßen weiter, in einer Apotheke. Wir gehen meistens zusammen in ein kleines türkisches Restaurant, wo es ein günstiges Mittagsmenü gibt. Seit wir beide Kinder haben, sehen wir uns am Wochenende kaum noch, deshalb ist diese Stunde für uns sehr wertvoll. Einmal im Monat kommt auch unsere Mutter dazu. Dann wird es meistens ein bisschen länger, und ich muss abends eine halbe Stunde länger arbeiten.",
              "correct": "falsch",
              "explanation_vi": "Cuối tuần „sehen wir uns … kaum noch“ — họ gặp nhau vào giờ nghỉ trưa ⇒ SAI."
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
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Guten Tag, liebe Hörerinnen und Hörer, und willkommen zu unserer Sendung „Neu in der Nachbarschaft“. Mein Gast heute ist Herr Albers. Er hat vor zwei Jahren in der Neustadt einen Laden eröffnet, in dem es fast keine Verpackungen gibt. Herr Albers, was genau verkaufen Sie?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Eigentlich alles, was man jeden Tag braucht: Nudeln, Reis, Mehl, Müsli, Öl, aber auch Seife und Waschmittel. Der Unterschied ist, dass die Kunden ihre eigenen Gläser, Dosen oder Stofftaschen mitbringen. Sie wiegen das leere Gefäß, füllen so viel ab, wie sie brauchen, und bezahlen nur den Inhalt. Wer nichts dabeihat, kann bei uns Gläser kaufen oder ausleihen." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wie sind Sie auf diese Idee gekommen?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Ich war früher Koch in einem Hotel. Dort habe ich jeden Abend gesehen, wie viel weggeworfen wird, nicht nur Essen, sondern vor allem Plastik. Irgendwann konnte ich das nicht mehr ertragen. Dann habe ich in Kopenhagen zufällig so einen Laden gesehen und dachte: Das will ich auch machen. Bis zur Eröffnung hat es dann aber noch fast drei Jahre gedauert." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Warum hat das so lange gedauert?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Vor allem wegen des Geldes. Die Banken wollten mir zuerst keinen Kredit geben, weil sie nicht geglaubt haben, dass so ein Laden funktioniert. Am Ende haben mir über zweihundert Menschen aus dem Stadtteil geholfen, mit einer Sammelaktion im Internet. Manche haben zwanzig Euro gegeben, andere viel mehr. Ohne diese Leute gäbe es den Laden heute nicht." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wer kauft denn bei Ihnen ein?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Das hat mich selbst überrascht. Ich dachte, es kommen vor allem junge Leute und Studenten. Aber viele meiner Stammkunden sind älter, über sechzig. Sie sagen oft, dass sie früher genauso eingekauft haben, mit der eigenen Milchkanne zum Bauern. Für sie ist das gar nichts Neues. Studenten kommen eher selten, denen ist es oft zu teuer." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Ist es denn teurer als im Supermarkt?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Bei manchen Sachen schon, zum Beispiel bei Nüssen oder Kaffee, weil wir nur Bio-Ware haben. Aber viele Kunden sparen trotzdem, weil sie nur so viel kaufen, wie sie wirklich brauchen. Wer nur hundert Gramm Linsen für ein Rezept braucht, muss bei uns nicht ein ganzes Kilo kaufen. Am Ende wirft man weniger weg." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Was ist für Sie die größte Schwierigkeit?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Die Hygiene. Das Gesundheitsamt kontrolliert uns natürlich regelmäßig, und alles muss sehr sauber sein. Die Kunden dürfen die Lebensmittel nicht mit den Händen anfassen, deshalb haben wir spezielle Behälter, aus denen alles von oben nach unten herausläuft. Am Anfang hatten wir Probleme mit Mehl, das in der Luft war. Das haben wir aber inzwischen gelöst." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Und wie geht es weiter?" },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Wir haben gerade einen Lieferservice mit Lastenrädern gestartet, für Menschen, die nicht mehr so gut zu Fuß sind. Die Gläser bringen wir voll und holen sie leer wieder ab. Einen zweiten Laden möchte ich vorerst nicht eröffnen. Ich will lieber hier jeden Kunden persönlich kennen." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Herr Albers, herzlichen Dank für das Gespräch und weiterhin viel Erfolg." },
            { "speaker": "PARTNER", "name": "Herr Albers", "text": "Vielen Dank, dass ich hier sein durfte." }
          ],
          "items": [
            { "id": "HV2-46", "question": "Im Laden von Herrn Albers bringen die Kunden eigene Behälter mit.", "correct": "richtig", "explanation_vi": "„die Kunden ihre eigenen Gläser, Dosen oder Stofftaschen mitbringen“ ⇒ ĐÚNG." },
            { "id": "HV2-47", "question": "Kunden ohne eigene Gläser können dort nicht einkaufen.", "correct": "falsch", "explanation_vi": "„Wer nichts dabeihat, kann bei uns Gläser kaufen oder ausleihen“ ⇒ SAI." },
            { "id": "HV2-48", "question": "Herr Albers hat früher in der Gastronomie gearbeitet.", "correct": "richtig", "explanation_vi": "„Ich war früher Koch in einem Hotel“ ⇒ ĐÚNG." },
            { "id": "HV2-49", "question": "Der Laden wurde kurz nach der Reise nach Kopenhagen eröffnet.", "correct": "falsch", "explanation_vi": "„fast drei Jahre gedauert“ ⇒ SAI, không phải ngay sau đó." },
            { "id": "HV2-50", "question": "Eine Bank hat den Laden von Anfang an finanziert.", "correct": "falsch", "explanation_vi": "Ngân hàng không cho vay; hơn hai trăm người trong khu góp tiền qua mạng ⇒ SAI." },
            { "id": "HV2-51", "question": "Viele Stammkunden sind ältere Menschen.", "correct": "richtig", "explanation_vi": "„viele meiner Stammkunden sind älter, über sechzig“ ⇒ ĐÚNG." },
            { "id": "HV2-52", "question": "Alle Produkte sind dort billiger als im Supermarkt.", "correct": "falsch", "explanation_vi": "„Bei manchen Sachen schon“ đắt hơn, ví dụ hạt và cà phê ⇒ SAI." },
            { "id": "HV2-53", "question": "Man kann dort auch sehr kleine Mengen kaufen.", "correct": "richtig", "explanation_vi": "Chỉ cần một trăm gram đậu thì không phải mua cả ký ⇒ ĐÚNG." },
            { "id": "HV2-54", "question": "Die Kunden nehmen die Lebensmittel mit der Hand aus den Behältern.", "correct": "falsch", "explanation_vi": "„dürfen die Lebensmittel nicht mit den Händen anfassen“ ⇒ SAI." },
            { "id": "HV2-55", "question": "Ältere Kunden können sich ihre Einkäufe bringen lassen.", "correct": "richtig", "explanation_vi": "Dịch vụ giao hàng bằng xe đạp chở hàng cho người đi lại khó khăn ⇒ ĐÚNG." }
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
              "question": "Wenn man nicht anruft, wird man morgen von einem anderen Arzt behandelt.",
              "audio_script": "Guten Tag, hier spricht Frau Meyer von der Zahnarztpraxis Doktor Lohmann. Sie haben morgen um neun Uhr einen Termin zur Kontrolle bei uns. Leider ist Frau Doktor Lohmann krank geworden. Ihr Kollege, Herr Doktor Behrens, kann Sie aber zur gleichen Zeit behandeln. Wenn Sie lieber auf Frau Doktor Lohmann warten möchten, rufen Sie uns bitte bis heute achtzehn Uhr an, dann geben wir Ihnen einen neuen Termin. Vielen Dank.",
              "correct": "richtig",
              "explanation_vi": "Bác sĩ đồng nghiệp khám cùng giờ; chỉ khi muốn chờ bà Lohmann thì gọi lại ⇒ không gọi thì khám với người khác ⇒ ĐÚNG."
            },
            {
              "id": "HV3-57",
              "speaker": "PARTNER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 57. Sie sind im Kaufhaus und hören folgende Durchsage.",
              "question": "Heute gibt es auf jede Kinderkleidung zehn Prozent Rabatt.",
              "audio_script": "Liebe Kundinnen und Kunden, heute ist bei uns Familientag. In der Spielwarenabteilung im dritten Stock gibt es von vierzehn bis siebzehn Uhr ein Programm für Kinder mit Basteln und Kinderschminken. Die Teilnahme ist kostenlos. Außerdem bekommen Sie heute an allen Kassen zehn Prozent Rabatt auf Kinderkleidung. Das Angebot gilt aber nicht für Ware, die bereits reduziert ist. Wir wünschen Ihnen einen schönen Einkauf.",
              "correct": "falsch",
              "explanation_vi": "Giảm 10 % nhưng „nicht für Ware, die bereits reduziert ist“ — không phải MỌI quần áo trẻ em ⇒ SAI."
            },
            {
              "id": "HV3-58",
              "speaker": "PRUEFER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 58. Im Radio hören Sie den Wetterbericht.",
              "question": "Am Samstagnachmittag soll es regnen.",
              "audio_script": "Und nun das Wetter für morgen, Samstag. Am Vormittag ist es im ganzen Norden noch freundlich und trocken bei Temperaturen um vierzehn Grad. Ab dem Mittag ziehen von der Nordsee aber dichte Wolken auf, und am Nachmittag regnet es überall kräftig, an der Küste auch mit starkem Wind. Wer einen Ausflug plant, sollte ihn also am besten auf den Vormittag legen. Am Sonntag wird es dann wieder sonniger, aber deutlich kühler.",
              "correct": "richtig",
              "explanation_vi": "„am Nachmittag regnet es überall kräftig“ ⇒ ĐÚNG."
            },
            {
              "id": "HV3-59",
              "speaker": "PARTNER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 59. Sie hören eine Nachricht von einem Kollegen.",
              "question": "Die Besprechung wird auf einen anderen Tag verschoben.",
              "audio_script": "Hallo Anna, hier ist Markus. Ich wollte dir nur kurz sagen, dass die Besprechung mit den Kunden aus München morgen nicht im großen Konferenzraum stattfindet, der ist nämlich schon belegt. Wir treffen uns stattdessen in meinem Büro im vierten Stock. Die Uhrzeit bleibt gleich, also zehn Uhr. Kannst du bitte die Präsentation auf einem USB-Stick mitbringen? Mein Laptop macht gerade Probleme. Danke dir, bis morgen.",
              "correct": "falsch",
              "explanation_vi": "Chỉ đổi PHÒNG họp, ngày và giờ giữ nguyên ⇒ SAI."
            },
            {
              "id": "HV3-60",
              "speaker": "PRUEFER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 60. Sie sind am Bahnhof und hören folgende Durchsage.",
              "question": "Mit der Fahrkarte für den Intercity darf man auch den Regionalexpress nach Hannover nehmen.",
              "audio_script": "Achtung an Gleis drei. Der Intercity nach Berlin über Hannover, planmäßige Abfahrt zehn Uhr fünfzehn, hat heute etwa zwanzig Minuten Verspätung. Grund dafür ist eine Störung an einem Signal. Reisende nach Hannover können auch den Regionalexpress um zehn Uhr zwanzig von Gleis fünf nehmen. Ihre Fahrkarte für den Intercity ist in diesem Zug gültig. Wir bitten um Entschuldigung.",
              "correct": "richtig",
              "explanation_vi": "„Ihre Fahrkarte für den Intercity ist in diesem Zug gültig“ ⇒ ĐÚNG."
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
          "instruction_de": "Ihr Freund Jonas hat Ihnen eine E-Mail geschrieben. Antworten Sie ihm. Schreiben Sie zu allen vier Punkten und überlegen Sie sich eine passende Reihenfolge der Punkte. Vergessen Sie nicht Anrede und Gruß.",
          "instruction_vi": "Viết một E-Mail xưng „du“ trả lời bạn: đủ bốn ý dưới đây, tự sắp thứ tự cho hợp lý, có lời chào đầu và cuối. Bốn ý in không theo thứ tự — như tờ đề thật. Gợi ý độ dài: 120–180 từ.",
          "prompt": "Ihr Freund Jonas hat Ihnen geschrieben. Antworten Sie ihm.",
          "stimulus": {
            "type": "EMAIL",
            "from": "Jonas",
            "subject": "Meine Geburtstagsparty",
            "body": "Hallo!\n\nStell dir vor: Ich werde am 14. Juni dreißig! Das möchte ich natürlich groß feiern, mit einem Grillfest im Garten meiner Eltern. Ich würde mich riesig freuen, wenn du auch kommst. Hast du an dem Samstag Zeit?\n\nIch habe allerdings ein kleines Problem: Ich habe noch nie für so viele Leute gekocht, es kommen ungefähr vierzig Gäste. Hast du eine Idee, was ich machen soll? Du kochst doch so gut.\n\nUnd wie geht es dir eigentlich? Wir haben uns seit Ostern nicht mehr gesehen. Was gibt es Neues bei dir?\n\nViele Grüße\nJonas"
          },
          "shuffle_points": true,
          "writing_points": [
            "Reaktion auf die Einladung: Können Sie am 14. Juni kommen?",
            "Was Sie selbst gern auf Feiern essen oder kochen",
            "Ein Tipp, wie Jonas das Essen für vierzig Gäste schaffen kann",
            "Was es bei Ihnen Neues gibt"
          ]
        }
      ]
    }
  ]
}
$j$::jsonb,
        225, 135, 150, FALSE, FALSE);
