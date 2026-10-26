-- Đề thi thử MÔ PHỎNG định dạng telc B1 — Set 3, BẢN NHÁP chờ duyệt (26/10/2026).
--
-- Cùng quy ước với V343 (Set 2): AI soạn nháp, reviewed = FALSE + is_active = FALSE (V342), học viên
-- thấy "Sắp có" tới khi có migration duyệt. Đề SOẠN GỐC theo khuôn Set 1 sau V327–V329, bối cảnh
-- Köln, chủ đề không trùng Set 1–2. 60 câu · 225 điểm · đỗ 135; phần Nói lấy từ module luyện thi nói.
--
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, sections_json,
                        total_points, pass_points, time_limit_minutes, is_active, reviewed)
VALUES ('B1', 'TELC', 'telc Deutsch B1 — Đề số 3',
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
            "a": "Traditionsbäckerei schließt nach 110 Jahren für immer",
            "b": "Wochenmarkt muss wegen einer Baustelle umziehen",
            "c": "Stadt verkauft gebrauchte Lastenräder günstig",
            "d": "Dorf lockt eine junge Hausärztin mit mietfreien Räumen",
            "e": "Bürgeramt: Termine nur noch online – kürzere Wartezeiten",
            "f": "Händler fordern neue Markttage",
            "g": "Frühere Auszubildende führt Bäckerei weiter",
            "h": "Kölner Krankenhaus sucht dringend Ärzte vom Land",
            "i": "Familien können Lastenräder kostenlos ausleihen",
            "j": "Bürgeramt schafft Termine per Telefon ab"
          },
          "items": [
            {
              "id": "LV1-1",
              "question": "Text 1",
              "text": "Wer in Köln einen neuen Personalausweis braucht oder sich nach einem Umzug anmelden muss, musste bisher oft stundenlang im Bürgeramt warten. Seit Januar lassen sich alle Termine nur noch online buchen, und das zeigt Wirkung: Die durchschnittliche Wartezeit vor Ort ist von 90 auf 15 Minuten gesunken. Für Menschen ohne Internet gibt es weiterhin eine Telefonnummer, unter der Mitarbeiter einen Termin eintragen. Kritik kommt allerdings von Seniorenverbänden: Die Leitung sei vormittags oft stundenlang besetzt.",
              "correct": "e",
              "explanation_vi": "Đặt hẹn chỉ qua mạng, thời gian chờ giảm từ 90 xuống 15 phút ⇒ e. Tiêu đề j là „bóng“: số điện thoại vẫn còn („weiterhin eine Telefonnummer“)."
            },
            {
              "id": "LV1-2",
              "question": "Text 2",
              "text": "Familien, die ihren Wocheneinkauf nicht mit dem Auto erledigen möchten, können sich in Köln ab sofort kostenlos ein Lastenrad ausleihen. An zwölf Stationen, meist bei Cafés oder Bioläden, stehen die Räder mit großer Kiste bereit. Man reserviert über eine App, holt sich den Schlüssel ab und darf das Rad bis zu drei Tage behalten. Finanziert wird das Projekt von der Stadt und von Spenden. Wer ein Rad beschädigt zurückbringt, muss allerdings für die Reparatur bezahlen.",
              "correct": "i",
              "explanation_vi": "Mượn xe đạp chở hàng miễn phí tới ba ngày ⇒ i. Tiêu đề c là bóng: thành phố cho MƯỢN, không bán."
            },
            {
              "id": "LV1-3",
              "question": "Text 3",
              "text": "Der beliebte Wochenmarkt auf dem Rudolfplatz muss für mindestens ein Jahr umziehen. Weil unter dem Platz eine neue Tiefgarage gebaut wird, stehen die rund sechzig Stände ab dem nächsten Monat auf dem Parkplatz am Stadtgarten, etwa fünfhundert Meter entfernt. Die Markttage dienstags und freitags bleiben gleich. Einige Händler befürchten trotzdem, dass sie Stammkunden verlieren, weil der neue Platz schlechter mit der Straßenbahn zu erreichen ist. Die Stadt will deshalb Hinweisschilder aufstellen.",
              "correct": "b",
              "explanation_vi": "Chợ phiên chuyển chỗ một năm vì xây hầm đỗ xe ⇒ b. Tiêu đề f là bóng: „Die Markttage … bleiben gleich“, tiểu thương chỉ lo mất khách."
            },
            {
              "id": "LV1-4",
              "question": "Text 4",
              "text": "Seit fast zwei Jahren hatte das Dorf Wahlscheid keinen Hausarzt mehr. Ältere Menschen mussten für jedes Rezept zwanzig Kilometer in die nächste Stadt fahren. Jetzt hat die Gemeinde eine ungewöhnliche Lösung gefunden: Sie hat eine leere Praxis renoviert und bietet einer jungen Ärztin die Räume und eine Wohnung drei Jahre lang mietfrei an. Dr. Lea Hartmann, die vorher in einem Kölner Krankenhaus gearbeitet hat, hat zugesagt und eröffnet ihre Praxis im Oktober.",
              "correct": "d",
              "explanation_vi": "Xã cho bác sĩ trẻ phòng khám và nhà ở miễn phí ba năm ⇒ d. Tiêu đề h là bóng: bác sĩ RỜI bệnh viện ở Köln về làng, không phải bệnh viện tìm bác sĩ."
            },
            {
              "id": "LV1-5",
              "question": "Text 5",
              "text": "Nach 110 Jahren wollte Bäckermeister Heinz Wolters seine Bäckerei in der Südstadt schließen, denn keines seiner Kinder wollte den Betrieb übernehmen. Doch dann meldete sich eine frühere Auszubildende. Die 29-jährige Merve Aydın führt die Bäckerei seit dem ersten Mai weiter, mit den alten Rezepten und denselben fünf Mitarbeitern. Neu ist nur, dass es jetzt auch Sesamkringel nach dem Rezept ihrer Großmutter gibt. Wolters kommt noch jeden Samstag und hilft beim Verkauf.",
              "correct": "g",
              "explanation_vi": "Người từng học nghề ở tiệm tiếp quản, tiệm không đóng ⇒ g. Tiêu đề a là bóng: ông chủ ĐỊNH đóng nhưng rốt cuộc tiệm vẫn mở."
            }
          ]
        },
        {
          "teil": 2,
          "type": "MULTIPLE_CHOICE",
          "point_per_item": 5,
          "instruction_de": "Lesen Sie zuerst den Text und lösen Sie dann die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Beachten Sie: Die Reihenfolge der Aufgaben folgt nicht immer der Reihenfolge des Textes.",
          "instruction_vi": "Đọc bài rồi làm câu 6–10: mỗi câu là một mở đầu câu, chọn đuôi đúng (a, b hoặc c). Thứ tự câu hỏi KHÔNG theo thứ tự bài — dùng số dòng để định vị.",
          "title_de": "Arbeiten nach der Rente*",
          "vorspann_de": "Immer mehr Menschen in Deutschland arbeiten weiter, obwohl sie schon Rente bekommen. Nicht alle tun es wegen des Geldes – und nicht alle können es überhaupt.",
          "context_lines": true,
          "glossary": [
            { "term": "Rente", "explanation_de": "Geld, das man im Alter jeden Monat bekommt, wenn man nicht mehr arbeitet" },
            { "term": "Minijob", "explanation_de": "eine Arbeit mit wenigen Stunden und einem kleinen Lohn" }
          ],
          "context": "Jeden Morgen um halb sieben schließt Werner Kowalski die Tür\nder Autowerkstatt in Köln-Ehrenfeld auf. Das hat er schon vierzig\nJahre lang getan. Der Unterschied: Seit zwei Jahren ist er offiziell\nRentner. „Zu Hause hätte ich nur auf dem Sofa gesessen“, sagt der\nSiebenundsechzigjährige. „Hier werde ich gebraucht.“ Heute arbeitet\ner drei Vormittage pro Woche und zeigt vor allem den Auszubildenden,\nwie man alte Motoren repariert, für die es keine Computer gibt.\n\nKowalski ist kein Einzelfall. Mehr als eine Million Menschen in\nDeutschland haben einen Job, obwohl sie bereits Rente beziehen.\nIhre Zahl hat sich in den letzten zwanzig Jahren fast verdoppelt.\nDie meisten von ihnen arbeiten in einem Minijob*, zum Beispiel im\nEinzelhandel, als Fahrer oder in Büros. Einige machen sich auch\nselbstständig und beraten junge Firmen.\n\nDie Gründe sind ganz unterschiedlich. Für viele ist die Rente zu\nniedrig, um davon gut leben zu können. Das gilt besonders für Frauen,\ndie wegen der Kinder lange Teilzeit gearbeitet haben. Eine Umfrage\nzeigt aber, dass Geld nicht der wichtigste Grund ist. Mehr als die\nHälfte der arbeitenden Rentner sagt, dass ihnen die Arbeit Spaß macht\nund dass sie den Kontakt zu anderen Menschen nicht verlieren wollen.\n\nAuch die Firmen profitieren. In vielen Branchen fehlen Fachkräfte,\nund ältere Mitarbeiter bringen viel Erfahrung mit. Der Chef der\nWerkstatt in Ehrenfeld ist froh über seinen erfahrenen Kollegen:\n„Werner kennt Autos, die meine jungen Leute nur aus Büchern kennen.\nUnd die Kunden vertrauen ihm.“ Allerdings müssen die Betriebe auch\nRücksicht nehmen. Schwere körperliche Arbeit ist für viele Ältere\nnicht mehr möglich, und die meisten wollen nicht mehr Vollzeit arbeiten.\n\nKritiker warnen davor, die Arbeit nach der Rente als Lösung für den\nFachkräftemangel zu sehen. Wer vierzig Jahre schwer gearbeitet habe,\netwa auf dem Bau oder in der Pflege, sei mit sechzig oft schon\nkrank und könne gar nicht weitermachen. Sie fordern deshalb, dass\nder Staat vor allem kleine Renten erhöht, damit niemand im Alter\narbeiten muss, nur weil das Geld nicht reicht.\n\nWerner Kowalski will noch mindestens zwei Jahre weitermachen. „Wenn\nmeine Knie nicht mehr wollen, höre ich auf“, sagt er und lacht.\n„Aber bis dahin bleibe ich hier.“",
          "items": [
            {
              "id": "LV2-6",
              "question": "Kritiker der Arbeit nach der Rente möchten, dass …",
              "options": {
                "a": "Rentner mehr Steuern bezahlen.",
                "b": "kleine Renten höher werden.",
                "c": "Firmen mehr junge Leute ausbilden."
              },
              "correct": "b",
              "explanation_vi": "Đoạn áp chót: họ đòi nhà nước „vor allem kleine Renten erhöht“ ⇒ b. Câu đầu tiên nhưng trả lời gần CUỐI bài."
            },
            {
              "id": "LV2-7",
              "question": "Werner Kowalski arbeitet heute …",
              "options": {
                "a": "an drei Vormittagen in der Woche.",
                "b": "jeden Tag in Vollzeit.",
                "c": "nur noch am Computer."
              },
              "correct": "a",
              "explanation_vi": "Dòng 5–6: „drei Vormittage pro Woche“ ⇒ a. c nói ngược: ông sửa động cơ cũ KHÔNG có máy tính."
            },
            {
              "id": "LV2-8",
              "question": "Die meisten arbeitenden Rentner sagen, dass sie arbeiten, weil …",
              "options": {
                "a": "ihre Rente nicht reicht.",
                "b": "ihr Chef sie darum gebeten hat.",
                "c": "die Arbeit ihnen Freude macht."
              },
              "correct": "c",
              "explanation_vi": "„Mehr als die Hälfte … sagt, dass ihnen die Arbeit Spaß macht“; tiền „nicht der wichtigste Grund“ ⇒ c. a là bẫy: đúng với NHIỀU người nhưng không phải đa số."
            },
            {
              "id": "LV2-9",
              "question": "Der Chef der Werkstatt schätzt an Herrn Kowalski besonders, …",
              "options": {
                "a": "dass er sich mit älteren Autos auskennt.",
                "b": "dass er sehr günstig arbeitet.",
                "c": "dass er die Werkstatt übernehmen will."
              },
              "correct": "a",
              "explanation_vi": "„Werner kennt Autos, die meine jungen Leute nur aus Büchern kennen“ ⇒ a."
            },
            {
              "id": "LV2-10",
              "question": "Viele Firmen müssen bei älteren Mitarbeitern beachten, dass …",
              "options": {
                "a": "sie keine Erfahrung mit Kunden haben.",
                "b": "sie oft keine schwere Arbeit mehr machen können.",
                "c": "sie nur am Wochenende arbeiten wollen."
              },
              "correct": "b",
              "explanation_vi": "„Schwere körperliche Arbeit ist für viele Ältere nicht mehr möglich“ ⇒ b."
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
          "instruction_vi": "Đọc 10 tình huống rồi 12 mẩu rao vặt a–l (bối cảnh Köln). Mỗi mẩu dùng một lần; mẩu của ví dụ được dùng lại. Không mẩu nào hợp thì chọn x — đề thật luôn có hai tình huống như vậy.",
          "examples": [
            { "label": "01", "situation": "Ihre Firma feiert ihr 25-jähriges Jubiläum mit 80 Gästen und braucht ein Buffet.", "answer": "l" },
            { "label": "02", "situation": "Sie möchten Kölsch lernen, den Dialekt der Stadt.", "answer": "x" }
          ],
          "ads": {
            "a": "Hausaufgabenhilfe für Grundschüler, Mo–Do 14–16 Uhr im Familienzentrum Nippes. Kostenlos, Anmeldung erforderlich.",
            "b": "Verkaufe gut erhaltenes Sofa (3-Sitzer, grau), nur Abholung, Köln-Sülz. 120 €.",
            "c": "Yoga am Rheinufer: jeden Sonntag 9 Uhr bei gutem Wetter, für alle Niveaus, Spende statt Gebühr.",
            "d": "Übersetzerin für Polnisch und Russisch: Urkunden und Zeugnisse, beglaubigt, schnell und zuverlässig.",
            "e": "Suche Mitbewohnerin für 2er-WG in Köln-Deutz, 16-m²-Zimmer, ab sofort, 450 € warm. Nur Nichtraucherinnen.",
            "f": "Kinderflohmarkt in der Turnhalle Lindenthal: Kleidung, Spielzeug, Kinderwagen. Samstag 10–14 Uhr.",
            "g": "Kleiner Hund (Mischling, 2 Jahre) sucht neues Zuhause mit Garten. Tierschutzverein Köln, Tel. 0221-30 40 50.",
            "h": "Hilfe beim Ausfüllen von Formularen (Jobcenter, Kindergeld, Wohngeld). Beratungsstelle Kalk, dienstags ohne Termin.",
            "i": "Chor „Kölsche Stimmen“ sucht Männerstimmen! Proben mittwochs 19:30 Uhr, Notenkenntnisse nicht nötig.",
            "j": "Übungsfahrten mit erfahrenem Fahrer für alle, die einen Führerschein haben, aber lange nicht gefahren sind.",
            "k": "Malerarbeiten: Ich streiche Ihre Wohnung schnell und sauber, auch am Wochenende. Kostenloser Kostenvoranschlag.",
            "l": "Catering für Firmenfeiern und Hochzeiten, internationale Küche, ab 30 Personen."
          },
          "items": [
            { "id": "LV3-11", "question": "Sie haben seit zehn Jahren einen Führerschein, sind aber nie Auto gefahren und haben jetzt Angst.", "correct": "j", "explanation_vi": "Có bằng lái nhưng lâu không lái, sợ ⇒ j (lái tập cùng người có kinh nghiệm)." },
            { "id": "LV3-12", "question": "Ihre Wohnung muss vor dem Auszug neu gestrichen werden.", "correct": "k", "explanation_vi": "Cần sơn lại nhà trước khi dọn đi ⇒ k (thợ sơn)." },
            { "id": "LV3-13", "question": "Sie brauchen eine offizielle Übersetzung Ihrer polnischen Geburtsurkunde.", "correct": "d", "explanation_vi": "Cần bản dịch có công chứng giấy khai sinh tiếng Ba Lan ⇒ d." },
            { "id": "LV3-14", "question": "Sie verstehen den Antrag für das Kindergeld nicht und brauchen Unterstützung.", "correct": "h", "explanation_vi": "Không hiểu mẫu đơn Kindergeld ⇒ h (hỗ trợ điền giấy tờ)." },
            { "id": "LV3-15", "question": "Ihr Sohn ist in der zweiten Klasse und braucht nachmittags Hilfe bei den Hausaufgaben.", "correct": "a", "explanation_vi": "Con lớp hai cần kèm bài buổi chiều ⇒ a (Hausaufgabenhilfe cho học sinh tiểu học)." },
            { "id": "LV3-16", "question": "Ihr Mann singt gern und sucht eine Gruppe, mit der er regelmäßig proben kann.", "correct": "i", "explanation_vi": "Chồng thích hát, tìm nhóm tập đều đặn ⇒ i (dàn hợp xướng tìm giọng nam)." },
            { "id": "LV3-17", "question": "Sie möchten am Wochenende günstig gebrauchte Kleidung für Ihr Baby kaufen.", "correct": "f", "explanation_vi": "Mua quần áo trẻ em cũ vào cuối tuần ⇒ f (chợ đồ cũ trẻ em thứ Bảy)." },
            { "id": "LV3-18", "question": "Ihre Kinder wünschen sich ein Haustier, und Sie haben ein Haus mit Garten.", "correct": "g", "explanation_vi": "Muốn nuôi thú, nhà có vườn ⇒ g (chó tìm nhà mới có vườn)." },
            { "id": "LV3-19", "question": "Sie suchen eine Wohnung für sich, Ihren Mann und Ihre zwei Kinder.", "correct": "x", "explanation_vi": "Gia đình bốn người cần căn hộ — mẩu e chỉ là một phòng trong nhà chung cho phụ nữ ⇒ x." },
            { "id": "LV3-20", "question": "Sie möchten ein gebrauchtes Bett kaufen.", "correct": "x", "explanation_vi": "Muốn mua giường cũ — mẩu b bán SOFA, không phải giường ⇒ x." }
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
          "gapped_text": "Sehr geehrte Frau Schneider,\n\nseit drei Wochen besuche ich den Deutschkurs B1 ___21___ Vormittag an Ihrer Sprachschule. Der Kurs gefällt mir sehr gut, und ich habe schon viel gelernt. Leider hat sich meine Situation ___22___ geändert: Ich habe eine neue Stelle in einem Hotel gefunden und arbeite ab dem nächsten Monat jeden Tag von acht ___23___ vierzehn Uhr.\n\nDeshalb möchte ich Sie fragen, ___24___ ich in den Abendkurs wechseln kann. Ich habe auf Ihrer Webseite gesehen, ___25___ es einen B1-Kurs gibt, der montags und mittwochs um achtzehn Uhr beginnt. Dieser Kurs ___26___ für mich ideal.\n\nNatürlich weiß ich, dass die Kurse schon angefangen haben. Ich bin aber bereit, die Lektionen, ___27___ ich verpasse, selbst nachzuholen. Muss ich für den Wechsel eine Gebühr bezahlen, oder kann ich den restlichen Betrag ___28___ den neuen Kurs verwenden?\n\nIch wäre Ihnen sehr dankbar, wenn Sie mir bald ___29___ könnten. Sie erreichen mich am besten per E-Mail oder nach vierzehn Uhr ___30___ Telefon.\n\nMit freundlichen Grüßen\nTran Minh Anh",
          "items": [
            { "id": "SB1-21", "gap": 21, "options": { "a": "im", "b": "um", "c": "am" }, "correct": "c", "explanation_vi": "Buổi trong ngày đi với „am“: am Vormittag, am Abend. „um“ dùng cho giờ chính xác." },
            { "id": "SB1-22", "gap": 22, "options": { "a": "plötzliche", "b": "plötzlich", "c": "plötzlicher" }, "correct": "b", "explanation_vi": "Trạng từ bổ nghĩa cho động từ „geändert“ không chia đuôi ⇒ „plötzlich“." },
            { "id": "SB1-23", "gap": 23, "options": { "a": "zu", "b": "nach", "c": "bis" }, "correct": "c", "explanation_vi": "Khoảng thời gian „von … bis …“." },
            { "id": "SB1-24", "gap": 24, "options": { "a": "dass", "b": "ob", "c": "wenn" }, "correct": "b", "explanation_vi": "Câu hỏi gián tiếp có/không sau „fragen“ ⇒ „ob“." },
            { "id": "SB1-25", "gap": 25, "options": { "a": "was", "b": "ob", "c": "dass" }, "correct": "c", "explanation_vi": "„Ich habe gesehen, dass …“ — mệnh đề nội dung, người viết đã biết chắc." },
            { "id": "SB1-26", "gap": 26, "options": { "a": "wäre", "b": "war", "c": "ist gewesen" }, "correct": "a", "explanation_vi": "Giả định lịch sự (chưa được đổi lớp) ⇒ Konjunktiv II „wäre“." },
            { "id": "SB1-27", "gap": 27, "options": { "a": "denen", "b": "die", "c": "der" }, "correct": "b", "explanation_vi": "Đại từ quan hệ cho „die Lektionen“ (số nhiều, Akkusativ sau „verpassen“) ⇒ „die“." },
            { "id": "SB1-28", "gap": 28, "options": { "a": "für", "b": "an", "c": "auf" }, "correct": "a", "explanation_vi": "„etwas FÜR etwas verwenden“ — dùng khoản tiền cho khoá mới." },
            { "id": "SB1-29", "gap": 29, "options": { "a": "antworten", "b": "antwortet", "c": "geantwortet" }, "correct": "a", "explanation_vi": "Sau „könnten“ là động từ nguyên thể ⇒ „antworten“." },
            { "id": "SB1-30", "gap": 30, "options": { "a": "im", "b": "am", "c": "beim" }, "correct": "b", "explanation_vi": "„jemanden am Telefon erreichen“ — cụm cố định." }
          ]
        },
        {
          "teil": 2,
          "type": "GAP_WORDBANK",
          "point_per_item": 1.5,
          "single_use": true,
          "instruction_de": "Lesen Sie die Anzeige und den Brief. Welches Wort aus dem Kasten (a–o) passt in die Lücken 31–40? Jedes Wort kann nur einmal verwendet werden. Nicht alle Wörter passen in den Text.",
          "instruction_vi": "Đọc mẩu tin rồi bức thư trả lời. Chọn từ trong hộp a–o cho mỗi ô 31–40; mỗi từ dùng một lần, năm từ thừa. Hộp gồm từ nối, giới từ, động từ khuyết thiếu — soi trật tự động từ và cặp từ dễ lẫn (WEIL/DENN, OB/WANN, VON/MIT…).",
          "stimulus_ad": "Nachmieter gesucht!\nHelle 3-Zimmer-Wohnung, 68 m², Köln-Ehrenfeld, 2. OG, Balkon · 980 € warm · frei ab 1. August\nFamilie Neumann · wohnung-ehrenfeld@example.de",
          "word_bank": {
            "a": "AM",
            "b": "DENN",
            "c": "FALLS",
            "d": "IM",
            "e": "MIT",
            "f": "MÖCHTE",
            "g": "OB",
            "h": "OBWOHL",
            "i": "ODER",
            "j": "SEIT",
            "k": "VON",
            "l": "WANN",
            "m": "WEIL",
            "n": "WOLLT",
            "o": "WÜRDEN"
          },
          "gapped_text": "Sehr geehrte Familie Neumann,\n\nich habe Ihre Anzeige gestern ___31___ einer Freundin bekommen und interessiere mich sehr für Ihre Wohnung. Mein Mann und ich suchen schon lange eine größere Wohnung, ___32___ wir im Herbst unser zweites Kind erwarten.\n\nDie Lage in Ehrenfeld wäre ideal für uns, ___33___ mein Mann arbeitet ganz in der Nähe. Ich habe aber noch einige Fragen. Gibt es in der Wohnung schon eine Küche, ___34___ müssen wir eine eigene mitbringen? Und wissen Sie, ___35___ die Nebenkosten im Winter höher sind?\n\nAußerdem ___36___ ich gern wissen, ob es im Haus einen Aufzug gibt. Mit einem Kinderwagen ist der zweite Stock sonst ziemlich anstrengend.\n\nWir ___37___ die Wohnung sehr gern so bald wie möglich besichtigen. Am besten passt es uns ___38___ Wochenende, aber auch unter der Woche ab siebzehn Uhr ist es möglich. ___39___ Sie Fragen zu uns haben, können Sie mich jederzeit anrufen.\n\nVielen Dank ___40___ Voraus und freundliche Grüße\nClaudia Weber",
          "items": [
            { "id": "SB2-31", "gap": 31, "correct": "k", "explanation_vi": "„etwas VON jemandem bekommen“ — nhận từ ai; MIT (e) là nhiễu." },
            { "id": "SB2-32", "gap": 32, "correct": "m", "explanation_vi": "„…, weil wir … erwarten“ — động từ ở CUỐI ⇒ phải là weil, không phải denn." },
            { "id": "SB2-33", "gap": 33, "correct": "b", "explanation_vi": "„…, denn mein Mann arbeitet …“ — động từ đứng THỨ HAI ⇒ denn, không phải weil." },
            { "id": "SB2-34", "gap": 34, "correct": "i", "explanation_vi": "Hai khả năng trong câu hỏi: có bếp sẵn HAY phải tự mang ⇒ „oder“." },
            { "id": "SB2-35", "gap": 35, "correct": "g", "explanation_vi": "Câu hỏi gián tiếp có/không ⇒ „ob“; WANN (l) hỏi thời điểm, không hợp nghĩa." },
            { "id": "SB2-36", "gap": 36, "correct": "f", "explanation_vi": "„Außerdem möchte ich gern wissen“ — chủ ngữ „ich“; WOLLT (n) là ngôi „ihr“, WÜRDEN (o) là ngôi „wir/sie“ — đều sai chủ ngữ." },
            { "id": "SB2-37", "gap": 37, "correct": "o", "explanation_vi": "„Wir würden die Wohnung gern besichtigen“ — Konjunktiv II lịch sự, chủ ngữ số nhiều." },
            { "id": "SB2-38", "gap": 38, "correct": "a", "explanation_vi": "„am Wochenende“ — cụm thời gian cố định; IM (d) là nhiễu cặp." },
            { "id": "SB2-39", "gap": 39, "correct": "c", "explanation_vi": "„Falls Sie Fragen haben, …“ — điều kiện; OBWOHL (h) sai nghĩa." },
            { "id": "SB2-40", "gap": 40, "correct": "d", "explanation_vi": "„im Voraus“ — cụm cố định ở cuối thư." }
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
          "framing_de": "Wie halten sich die Menschen fit? Wir haben fünf Personen gefragt: „Was tun Sie für Ihre Gesundheit, und warum gerade das?“ Hören Sie dazu die Antworten.",
          "instruction_de": "Sie hören nun fünf kurze Texte. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind.",
          "instruction_vi": "Nghe 5 người kể về cùng một chủ đề, mỗi người CHỈ MỘT LẦN. Sau hướng dẫn có 30 giây đọc câu hỏi. Chọn đúng hoặc sai.",
          "items": [
            {
              "id": "HV1-41",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin hat wegen gesundheitlicher Probleme mit dem Schwimmen angefangen.",
              "audio_script": "Nummer 41. Ich gehe dreimal pro Woche schwimmen, immer morgens um halb sieben, bevor ich zur Arbeit fahre. Um diese Zeit ist das Hallenbad fast leer, und ich kann in Ruhe meine Bahnen ziehen. Angefangen habe ich vor fünf Jahren wegen meiner Rückenschmerzen. Mein Arzt hat gesagt, Schwimmen sei besser als jede Tablette, und er hatte recht. Die Schmerzen sind fast weg. Ins Fitnessstudio würde ich nie gehen, da ist mir zu viel Lärm.",
              "correct": "richtig",
              "explanation_vi": "„Angefangen habe ich … wegen meiner Rückenschmerzen“ ⇒ ĐÚNG."
            },
            {
              "id": "HV1-42",
              "speaker": "PARTNER",
              "question": "Der Sprecher erreicht jeden Tag sein Ziel von zehntausend Schritten.",
              "audio_script": "Nummer 42. Ehrlich gesagt mache ich keinen richtigen Sport. Ich habe zwei kleine Kinder und einen Job im Schichtdienst, da bleibt dafür keine Zeit. Aber ich versuche, im Alltag möglichst viel zu laufen. Ich nehme nie den Aufzug, sondern immer die Treppe, und zum Bäcker gehe ich zu Fuß. Seit ein paar Monaten habe ich eine Uhr, die meine Schritte zählt. Zehntausend am Tag ist mein Ziel, das schaffe ich aber nur an etwa der Hälfte der Tage.",
              "correct": "falsch",
              "explanation_vi": "„nur an etwa der Hälfte der Tage“ — chỉ khoảng một nửa số ngày ⇒ SAI."
            },
            {
              "id": "HV1-43",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin geht vor allem wegen der anderen Menschen zum Volleyball.",
              "audio_script": "Nummer 43. Ich spiele seit meiner Jugend Volleyball in einem Verein. Inzwischen bin ich fünfundfünfzig und spiele in einer Mannschaft für Ältere, wir trainieren jeden Dienstagabend. Für mich ist das gar nicht so sehr Sport, sondern vor allem Gemeinschaft. Nach dem Training sitzen wir fast immer noch zusammen und essen etwas. Viele meiner besten Freundinnen habe ich im Verein kennengelernt. Wenn ich mal eine Woche nicht kann, fehlt mir wirklich etwas.",
              "correct": "richtig",
              "explanation_vi": "„gar nicht so sehr Sport, sondern vor allem Gemeinschaft“ ⇒ ĐÚNG."
            },
            {
              "id": "HV1-44",
              "speaker": "PARTNER",
              "question": "Der Sprecher fährt Fahrrad, um gesund zu bleiben.",
              "audio_script": "Nummer 44. Ich fahre jeden Tag mit dem Fahrrad zur Arbeit, das sind hin und zurück dreißig Kilometer. Das mache ich aber nicht wegen der Gesundheit, sondern weil ich kein Auto habe und die Bahn bei uns sehr unzuverlässig ist. Dass ich dadurch fit bleibe, ist eher ein schöner Nebeneffekt. Im Winter ist es manchmal hart, besonders wenn es dunkel und nass ist. Dann denke ich schon manchmal darüber nach, mir doch ein Auto zu kaufen.",
              "correct": "falsch",
              "explanation_vi": "„nicht wegen der Gesundheit, sondern weil ich kein Auto habe“ — khoẻ chỉ là phụ ⇒ SAI."
            },
            {
              "id": "HV1-45",
              "speaker": "PRUEFER",
              "question": "Die Sprecherin konnte schon immer gut kochen.",
              "audio_script": "Nummer 45. Bei mir ist es vor allem die Ernährung. Seit ich vor zwei Jahren Diabetes bekommen habe, koche ich fast jeden Tag selbst und esse viel Gemüse. Fertiggerichte und Süßigkeiten kaufe ich nicht mehr. Am Anfang war das schwer, weil ich gar nicht kochen konnte. Ich habe dann einen Kurs bei der Volkshochschule gemacht, und jetzt macht es mir richtig Spaß. Meine Werte sind viel besser geworden, und ich brauche weniger Medikamente.",
              "correct": "falsch",
              "explanation_vi": "„weil ich gar nicht kochen konnte“ — phải đi học nấu ăn ⇒ SAI."
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
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Guten Abend, liebe Hörerinnen und Hörer. Heute geht es in unserer Sendung „Stadtleben“ um ein Tier, an das man in der Großstadt nicht sofort denkt: die Biene. Bei mir im Studio ist Herr Lorenz. Er hält Bienen mitten in Köln. Herr Lorenz, wo stehen Ihre Bienenstöcke?" },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Die meisten stehen auf Dächern, zum Beispiel auf dem Dach eines Hotels in der Innenstadt und auf dem Dach einer Schule in Nippes. Insgesamt habe ich zwölf Völker. Viele Leute sind überrascht, aber den Bienen geht es in der Stadt oft besser als auf dem Land." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wie kann das sein?" },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Auf dem Land gibt es heute oft riesige Felder mit nur einer Pflanze, zum Beispiel Mais. Wenn die abgeblüht ist, finden die Bienen wochenlang nichts. In der Stadt dagegen gibt es Parks, Gärten, Balkone und Bäume an den Straßen, die zu ganz unterschiedlichen Zeiten blühen. Außerdem werden in der Stadt weniger Pflanzenschutzmittel gespritzt." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Wie sind Sie zur Imkerei gekommen?" },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Durch meinen Großvater. Er hatte Bienen in der Eifel, und als Kind war ich jeden Sommer bei ihm. Später habe ich das aber ganz vergessen, ich habe Informatik studiert und jahrelang in einer Bank gearbeitet. Erst als mein Großvater gestorben ist und ich seine alten Werkzeuge gefunden habe, habe ich wieder angefangen. Das war vor acht Jahren." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Ist das nicht gefährlich, Bienen mitten in der Stadt?" },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Nein, eigentlich nicht. Bienen sind friedliche Tiere, sie stechen nur, wenn sie sich bedroht fühlen. Auf den Dächern kommen ja auch keine Menschen vorbei. Ich selbst werde vielleicht fünfmal im Jahr gestochen, meistens weil ich unvorsichtig war. Mit Wespen, die im Sommer an den Kuchen gehen, darf man Bienen nicht verwechseln." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Was machen Sie mit dem Honig?" },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Den verkaufe ich auf zwei Wochenmärkten und an das Hotel, auf dessen Dach meine Bienen stehen. Das Hotel serviert ihn den Gästen zum Frühstück, und die finden das toll. Reich wird man davon aber nicht. Die Imkerei ist für mich ein Hobby, mein Geld verdiene ich immer noch als Informatiker, allerdings nur noch in Teilzeit." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Sie geben auch Kurse, habe ich gehört." },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Ja, seit drei Jahren. Jedes Frühjahr mache ich einen Anfängerkurs mit zehn Leuten. Die Nachfrage ist riesig, die Plätze sind meistens schon im Januar weg. Ich sage den Teilnehmern aber immer ehrlich: Bienen machen viel Arbeit, besonders im Sommer. Wer gern lange in Urlaub fährt, sollte sich das gut überlegen." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Was wünschen Sie sich von der Stadt?" },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Mehr Wiesen statt kurz geschnittenem Rasen. In den Parks wird oft alles gemäht, bevor die Blumen überhaupt blühen können. Da könnte die Stadt viel tun, und es kostet sogar weniger Geld, weil man seltener mähen muss. Jeder Einzelne kann aber auch helfen, zum Beispiel mit ein paar Kräutern auf dem Balkon." },
            { "speaker": "PRUEFER", "name": "Moderatorin", "text": "Herr Lorenz, vielen Dank für diesen interessanten Einblick." },
            { "speaker": "PARTNER", "name": "Herr Lorenz", "text": "Sehr gern, es hat mir Spaß gemacht." }
          ],
          "items": [
            { "id": "HV2-46", "question": "Herr Lorenz hat seine Bienen vor allem auf Dächern.", "correct": "richtig", "explanation_vi": "„Die meisten stehen auf Dächern“ ⇒ ĐÚNG." },
            { "id": "HV2-47", "question": "Nach Meinung von Herrn Lorenz finden Bienen auf dem Land mehr Nahrung als in der Stadt.", "correct": "falsch", "explanation_vi": "Ngược lại: ở thành phố cây nở hoa vào nhiều thời điểm, ở quê có khi mấy tuần không có gì ⇒ SAI." },
            { "id": "HV2-48", "question": "Herr Lorenz hat schon als Kind Bienen kennengelernt.", "correct": "richtig", "explanation_vi": "Mùa hè nào cũng ở với ông nội nuôi ong ⇒ ĐÚNG." },
            { "id": "HV2-49", "question": "Er hat seit seiner Kindheit ohne Pause Bienen gehalten.", "correct": "falsch", "explanation_vi": "„Später habe ich das aber ganz vergessen“, tám năm trước mới bắt đầu lại ⇒ SAI." },
            { "id": "HV2-50", "question": "Herr Lorenz wird oft gestochen, weil Bienen aggressiv sind.", "correct": "falsch", "explanation_vi": "Ong „friedliche Tiere“; ông bị đốt khoảng năm lần một năm vì bất cẩn ⇒ SAI." },
            { "id": "HV2-51", "question": "Ein Teil des Honigs wird in einem Hotel gegessen.", "correct": "richtig", "explanation_vi": "Khách sạn dọn mật ong cho khách ăn sáng ⇒ ĐÚNG." },
            { "id": "HV2-52", "question": "Herr Lorenz lebt heute nur von der Imkerei.", "correct": "falsch", "explanation_vi": "„mein Geld verdiene ich immer noch als Informatiker“ ⇒ SAI." },
            { "id": "HV2-53", "question": "Für die Anfängerkurse muss man sich früh anmelden.", "correct": "richtig", "explanation_vi": "„die Plätze sind meistens schon im Januar weg“ ⇒ ĐÚNG." },
            { "id": "HV2-54", "question": "Herr Lorenz empfiehlt allen Teilnehmern, sich Bienen anzuschaffen.", "correct": "falsch", "explanation_vi": "Ông nói thẳng ong rất tốn công, ai hay đi du lịch dài nên cân nhắc ⇒ SAI." },
            { "id": "HV2-55", "question": "Herr Lorenz wünscht sich, dass in den Parks seltener gemäht wird.", "correct": "richtig", "explanation_vi": "Muốn „mehr Wiesen statt kurz geschnittenem Rasen“ ⇒ ĐÚNG." }
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
              "question": "Das Sommerfest fällt wegen des Wetters ganz aus.",
              "audio_script": "Hallo, hier ist Jana vom Elternrat der Kita Sonnenblume. Wir planen ja für den nächsten Samstag das Sommerfest. Leider hat der Wetterdienst für Samstag Gewitter angekündigt. Wir haben deshalb entschieden, das Fest um eine Woche zu verschieben, also auf den zwanzigsten Juli. Die Uhrzeit bleibt gleich, ab fünfzehn Uhr. Wer einen Kuchen mitbringen wollte, kann das natürlich am neuen Termin tun. Bis dann!",
              "correct": "falsch",
              "explanation_vi": "Lễ hội DỜI một tuần sang 20/7, không huỷ ⇒ SAI."
            },
            {
              "id": "HV3-57",
              "speaker": "PARTNER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 57. Sie sind im Supermarkt und hören folgende Durchsage.",
              "question": "Der Supermarkt schließt heute früher als sonst.",
              "audio_script": "Liebe Kundinnen und Kunden, unser Markt schließt heute ausnahmsweise schon um achtzehn Uhr, da wir am Abend eine Inventur machen. Bitte gehen Sie rechtzeitig zur Kasse. Morgen sind wir wieder wie gewohnt von sieben bis zweiundzwanzig Uhr für Sie da. Und noch ein Hinweis: An der Fleischtheke bekommen Sie heute alle Grillwürstchen zum halben Preis. Vielen Dank für Ihren Einkauf.",
              "correct": "richtig",
              "explanation_vi": "„schließt heute ausnahmsweise schon um achtzehn Uhr“ — bình thường mở tới 22 giờ ⇒ ĐÚNG."
            },
            {
              "id": "HV3-58",
              "speaker": "PRUEFER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 58. Im Radio hören Sie eine Verkehrsmeldung.",
              "question": "Auf der A3 ist die ganze Autobahn gesperrt.",
              "audio_script": "Und nun die Verkehrslage in Nordrhein-Westfalen. Auf der A3 zwischen Köln-Mülheim und Leverkusen ist nach einem Unfall die rechte Spur gesperrt. Dort staut sich der Verkehr auf acht Kilometern. Wer kann, sollte die Strecke weiträumig umfahren. Auf der A4 Richtung Aachen gibt es wegen einer Baustelle ebenfalls Verzögerungen von etwa fünfzehn Minuten. Ansonsten ist es auf den Autobahnen im Moment ruhig.",
              "correct": "falsch",
              "explanation_vi": "Chỉ „die rechte Spur“ bị chặn, không phải cả đường cao tốc ⇒ SAI."
            },
            {
              "id": "HV3-59",
              "speaker": "PARTNER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 59. Sie hören eine Nachricht von Ihrem Vermieter.",
              "question": "Wer am Mittwoch nicht zu Hause ist, kann den Schlüssel beim Vermieter abgeben.",
              "audio_script": "Guten Tag, Herr Schulze hier, Ihr Vermieter. Ich wollte Ihnen sagen, dass am kommenden Mittwoch zwischen acht und zwölf Uhr die Fenster im ganzen Haus geputzt werden. Die Firma braucht dafür Zugang zu allen Wohnungen. Wenn Sie an diesem Vormittag nicht zu Hause sind, können Sie Ihren Schlüssel bis Dienstagabend bei mir abgeben. Ich wohne im Erdgeschoss links. Vielen Dank für Ihr Verständnis.",
              "correct": "richtig",
              "explanation_vi": "„können Sie Ihren Schlüssel bis Dienstagabend bei mir abgeben“ ⇒ ĐÚNG."
            },
            {
              "id": "HV3-60",
              "speaker": "PRUEFER",
              "lead_in_de": "Lesen Sie jetzt die Aufgabe 60. Sie sind im Museum und hören folgende Durchsage.",
              "question": "Für die Führung muss man extra bezahlen.",
              "audio_script": "Sehr geehrte Besucherinnen und Besucher, in fünfzehn Minuten beginnt im Erdgeschoss eine kostenlose Führung durch unsere neue Ausstellung über die Geschichte der Kölner Straßenbahn. Die Führung dauert etwa eine Stunde. Bitte treffen Sie sich am Informationsschalter neben dem Eingang. Kinder unter zwölf Jahren dürfen nur in Begleitung eines Erwachsenen teilnehmen. Wir wünschen Ihnen viel Vergnügen.",
              "correct": "falsch",
              "explanation_vi": "„eine kostenlose Führung“ ⇒ SAI."
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
          "instruction_de": "Ihre Freundin Mia hat Ihnen eine E-Mail geschrieben. Antworten Sie ihr. Schreiben Sie zu allen vier Punkten und überlegen Sie sich eine passende Reihenfolge der Punkte. Vergessen Sie nicht Anrede und Gruß.",
          "instruction_vi": "Viết một E-Mail xưng „du“ trả lời bạn: đủ bốn ý dưới đây, tự sắp thứ tự cho hợp lý, có lời chào đầu và cuối. Bốn ý in không theo thứ tự — như tờ đề thật. Gợi ý độ dài: 120–180 từ.",
          "prompt": "Ihre Freundin Mia hat Ihnen geschrieben. Antworten Sie ihr.",
          "stimulus": {
            "type": "EMAIL",
            "from": "Mia",
            "subject": "Sprachkurs im Ausland?",
            "body": "Hallo!\n\nIch habe eine große Neuigkeit: Ich möchte im Herbst vier Wochen lang einen Sprachkurs in Spanien machen! Du warst doch letztes Jahr in Valencia, oder? Wie hat es dir dort gefallen?\n\nIch bin noch nicht sicher, ob ich in einer Gastfamilie oder lieber in einer WG wohnen soll. Was meinst du? Und wie viel Geld sollte ich ungefähr mitnehmen?\n\nVielleicht können wir uns ja bald mal treffen und in Ruhe über alles sprechen. Hast du am nächsten Wochenende Zeit?\n\nLiebe Grüße\nMia"
          },
          "shuffle_points": true,
          "writing_points": [
            "Reaktion auf Mias Vorschlag: Haben Sie am Wochenende Zeit für ein Treffen?",
            "Wie Ihnen Ihr Aufenthalt in Valencia gefallen hat",
            "Ein Rat: Gastfamilie oder WG?",
            "Was es bei Ihnen Neues gibt"
          ]
        }
      ]
    }
  ]
}
$j$::jsonb,
        225, 135, 150, FALSE, FALSE);
