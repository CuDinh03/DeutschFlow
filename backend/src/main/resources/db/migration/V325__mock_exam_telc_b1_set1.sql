-- Bộ đề thi thử định dạng telc B1 — Set 1 (đề PILOT, 15/09/2026).
--
-- Đề SOẠN GỐC theo cấu trúc telc công khai. KHÔNG chép văn bản hay câu hỏi của bất kỳ bộ đề nào
-- đang lưu hành: repo này PUBLIC và sản phẩm có gói thu phí, nên chép vào seed là rủi ro pháp lý
-- lộ ngay trên GitHub. Lấy từ đề thật: hình thức, phân bố độ khó, trọng tâm ngữ pháp — những thứ
-- không được bảo hộ.
--
-- Cấu trúc (khớp §1.2 của SRS module 07):
--   Leseverstehen     75 = Teil 1 (5 × 5) + Teil 2 (5 × 5) + Teil 3 (10 × 2,5)
--   Sprachbausteine   30 = Teil 1 (10 × 1,5) + Teil 2 (10 × 1,5)
--   Hörverstehen      75 = Teil 1 (5 × 5, nghe 1 lần) + Teil 2 (10 × 2,5) + Teil 3 (5 × 5)
--   Schriftl. Ausdruck 45 = một bức thư, 3 Kriterien × 15
--   ───────────────────────────────────────────────────────────────────────────
--   Tổng 60 câu · 225 điểm · đỗ 135 (60 %)
--
-- 🪤 Dấu cách (hoặc xuống dòng) sau $j$ là BẮT BUỘC. Viết liền thì hai ký tự cuối của $j$ ghép
-- với dấu ngoặc nhọn mở đầu JSON thành đúng cú pháp placeholder của Flyway, và migration chết
-- ngay lúc khởi động: "No value provided for placeholder". V279 trở đi đều chừa dấu cách.
--
-- Phần NÓI không nằm trong đề giấy: điểm 75 của nó đến từ một phiên của module luyện thi nói
-- (`pass_rule.oral.source = SPEAKING_SESSION`). Vì vậy total_points/pass_points của hàng này là
-- 225/135 — đúng phần viết — chứ không phải 300/180.

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, sections_json,
                        total_points, pass_points, time_limit_minutes, is_active)
VALUES ('B1', 'TELC', 'telc Deutsch B1 — Đề số 1',
        'Đề thi thử định dạng telc B1: Đọc, Ngữ pháp–từ vựng, Nghe, Viết. Phần Nói thi riêng ở mục Luyện thi.',
        $j$
{
  "format": "TELC",
  "blocks": [
    {
      "id": "LV_SB",
      "minutes": 90,
      "sections": [
        "LESEN",
        "SPRACHBAUSTEINE"
      ]
    },
    {
      "id": "PAUSE",
      "minutes": 20
    },
    {
      "id": "HV",
      "minutes": 30,
      "sections": [
        "HOEREN"
      ]
    },
    {
      "id": "SA",
      "minutes": 30,
      "sections": [
        "SCHREIBEN"
      ]
    }
  ],
  "pass_rule": {
    "written": {
      "sections": [
        "LESEN",
        "SPRACHBAUSTEINE",
        "HOEREN",
        "SCHREIBEN"
      ],
      "max": 225,
      "min": 135
    },
    "oral": {
      "source": "SPEAKING_SESSION",
      "provider": "TELC",
      "max": 75,
      "min": 45
    }
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
          "instruction_de": "Lesen Sie die Überschriften a–j und die Texte 1–5. Welche Überschrift passt zu welchem Text? Jede Überschrift kann nur einmal verwendet werden.",
          "instruction_vi": "Đọc 10 tiêu đề a–j và 5 văn bản. Mỗi tiêu đề chỉ dùng một lần.",
          "headlines": {
            "a": "Neue Radwege sollen den Verkehr entlasten",
            "b": "Stadtbücherei öffnet jetzt auch sonntags",
            "c": "Weniger Plastik in den Schulkantinen",
            "d": "Wohnungssuche wird für Studierende schwerer",
            "e": "Museum zeigt Fotos aus der Nachkriegszeit",
            "f": "Fahrpreise im Nahverkehr bleiben stabil",
            "g": "Nachbarn gründen einen Gemeinschaftsgarten",
            "h": "Handwerksbetriebe suchen dringend Lehrlinge",
            "i": "Hallenbad wegen Reparaturen geschlossen",
            "j": "Immer mehr Menschen arbeiten von zu Hause"
          },
          "items": [
            {
              "id": "LV1-1",
              "question": "Text 1",
              "text": "Ab Mai entstehen im Stadtzentrum vier neue Strecken nur für Fahrräder. Die Stadt hofft, dass dadurch weniger Autos in die Innenstadt fahren. Zwei Straßen werden dafür schmaler, was bei Geschäftsleuten auf Kritik stößt.",
              "correct": "a",
              "explanation_vi": "Bài nói về bốn tuyến đường mới chỉ dành cho xe đạp ⇒ tiêu đề a (thêm đường cho xe đạp)."
            },
            {
              "id": "LV1-2",
              "question": "Text 2",
              "text": "In der Region fehlen in diesem Jahr rund 900 junge Leute für eine Ausbildung im Handwerk. Bäckereien, Malerbetriebe und Elektrofirmen bieten inzwischen Prämien an, finden aber trotzdem kaum Bewerber.",
              "correct": "h",
              "explanation_vi": "Thiếu 900 người học nghề, các xưởng treo thưởng vẫn không tìm được ⇒ tiêu đề h (tuyển thợ học việc)."
            },
            {
              "id": "LV1-3",
              "question": "Text 3",
              "text": "Das städtische Hallenbad bleibt von Juni bis September zu. Die Technik der Lüftung ist alt und muss komplett erneuert werden. Schwimmkurse finden in dieser Zeit im Nachbarort statt.",
              "correct": "i",
              "explanation_vi": "Bể bơi đóng cửa từ tháng 6 đến tháng 9 để thay hệ thống thông gió ⇒ tiêu đề i (đóng cửa sửa chữa)."
            },
            {
              "id": "LV1-4",
              "question": "Text 4",
              "text": "Auf einem leeren Grundstück in der Lindenstraße pflanzen seit April etwa dreißig Anwohner gemeinsam Gemüse und Kräuter. Wer mitmachen will, bringt eigenes Werkzeug mit; die Ernte teilen alle.",
              "correct": "g",
              "explanation_vi": "Khoảng ba mươi người trong khu cùng trồng rau trên đất trống ⇒ tiêu đề g (vườn chung)."
            },
            {
              "id": "LV1-5",
              "question": "Text 5",
              "text": "Die Bücherei am Marktplatz hat ihre Zeiten geändert: Sonntags kann man nun von 11 bis 16 Uhr lesen und ausleihen. Dafür bleibt sie montags geschlossen.",
              "correct": "b",
              "explanation_vi": "Thư viện mở thêm chủ nhật 11–16 giờ ⇒ tiêu đề b (mở cả chủ nhật)."
            }
          ]
        },
        {
          "teil": 2,
          "type": "MULTIPLE_CHOICE",
          "point_per_item": 5,
          "instruction_de": "Lesen Sie den Text und lösen Sie die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig?",
          "instruction_vi": "Đọc bài và chọn đáp án đúng (a, b hoặc c).",
          "context": "Ehrenamt im Wandel\n\nWer sich in Deutschland freiwillig engagiert, tut das heute anders als noch vor zwanzig Jahren. Damals traten die meisten Menschen in einen Verein ein und blieben dort oft ihr ganzes Leben. Heute dagegen wollen viele Freiwillige genau wissen, wofür sie ihre Zeit einsetzen — und für wie lange.\n\nFrau Özdemir leitet eine Freiwilligenagentur in einer mittelgroßen Stadt. Sie beobachtet seit Jahren denselben Trend: „Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand. Ein Projekt über drei Monate finden viele gut. Eine Aufgabe ohne Ende schreckt ab.“ Besonders berufstätige Menschen zwischen dreißig und fünfzig meldeten sich lieber für einzelne Aktionen als für einen festen Posten.\n\nFür die Vereine ist das nicht einfach. Ein Sportverein braucht jemanden, der die Kasse führt — und zwar nicht nur bis zum Sommer. „Wir finden schnell zehn Leute für ein Stadtfest“, sagt der Vorsitzende eines Turnvereins, „aber niemanden für den Vorstand.“ Manche Vereine haben deshalb angefangen, große Aufgaben in kleine Teile zu zerlegen und auf mehrere Schultern zu verteilen.\n\nFrau Özdemir hält das für den richtigen Weg. Sie rät den Vereinen außerdem, neuen Freiwilligen von Anfang an eine feste Ansprechperson zu geben. „Die meisten hören nicht auf, weil die Arbeit zu schwer ist. Sie hören auf, weil sie sich allein gelassen fühlen.“",
          "items": [
            {
              "id": "LV2-6",
              "question": "Was hat sich beim Ehrenamt geändert?",
              "options": {
                "a": "Die Menschen engagieren sich heute seltener als früher.",
                "b": "Die Menschen binden sich heute für kürzere Zeit.",
                "c": "Die Menschen arbeiten heute lieber allein."
              },
              "correct": "b",
              "explanation_vi": "Đoạn đầu: trước kia người ta vào hội và ở lại cả đời, nay muốn biết rõ làm bao lâu ⇒ b (gắn bó ngắn hơn)."
            },
            {
              "id": "LV2-7",
              "question": "Was fragen die Freiwilligen laut Frau Özdemir zuerst?",
              "options": {
                "a": "wie viel Zeit die Aufgabe kostet",
                "b": "ob sie Geld dafür bekommen",
                "c": "wer sonst noch mitmacht"
              },
              "correct": "a",
              "explanation_vi": "Bà Özdemir nói rõ: „Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand“ ⇒ a (hỏi mất bao nhiêu thời gian)."
            },
            {
              "id": "LV2-8",
              "question": "Welches Problem nennt der Vorsitzende des Turnvereins?",
              "options": {
                "a": "Zum Stadtfest kommen zu wenige Helfer.",
                "b": "Für dauerhafte Ämter findet er niemanden.",
                "c": "Die Mitglieder zahlen ihre Beiträge nicht."
              },
              "correct": "b",
              "explanation_vi": "Ông chủ tịch: tìm mười người cho hội chợ thì dễ, „aber niemanden für den Vorstand“ ⇒ b (không ai nhận chức lâu dài)."
            },
            {
              "id": "LV2-9",
              "question": "Wie reagieren manche Vereine auf die Situation?",
              "options": {
                "a": "Sie teilen große Aufgaben in kleinere auf.",
                "b": "Sie stellen bezahlte Mitarbeiter ein.",
                "c": "Sie nehmen keine neuen Mitglieder mehr auf."
              },
              "correct": "a",
              "explanation_vi": "„große Aufgaben in kleine Teile zu zerlegen“ ⇒ a (chia nhỏ công việc lớn)."
            },
            {
              "id": "LV2-10",
              "question": "Warum hören Freiwillige nach Frau Özdemirs Erfahrung meistens auf?",
              "options": {
                "a": "weil die Aufgaben zu anspruchsvoll sind",
                "b": "weil sie keine Unterstützung spüren",
                "c": "weil sie in eine andere Stadt ziehen"
              },
              "correct": "b",
              "explanation_vi": "Câu cuối: họ bỏ vì „sie sich allein gelassen fühlen“ — thấy bị bỏ mặc ⇒ b (không có ai hỗ trợ)."
            }
          ]
        },
        {
          "teil": 3,
          "type": "MATCH_AD_X",
          "point_per_item": 2.5,
          "single_use": true,
          "allow_none": true,
          "instruction_de": "Lesen Sie die Situationen 11–20 und die Anzeigen a–l. Welche Anzeige passt zu welcher Situation? Passt keine Anzeige, wählen Sie x.",
          "instruction_vi": "Đọc 10 tình huống và 12 mẩu rao vặt a–l. Không mẩu nào hợp thì chọn x.",
          "ads": {
            "a": "Nachhilfe Mathe, Klasse 5–10, bei mir zu Hause. 15 €/Stunde. Tel. 0176-44 22 10",
            "b": "Verkaufe Kinderfahrrad, 20 Zoll, kaum benutzt. 60 € VB. Abholung am Wochenende.",
            "c": "Suche Mitfahrgelegenheit Leipzig–Dresden, freitags nachmittags. Teile die Benzinkosten.",
            "d": "Hundebetreuung: Ich gehe mit Ihrem Hund, während Sie arbeiten. Werktags 9–15 Uhr.",
            "e": "Zimmer in WG frei ab 1. Oktober, 18 m², Nähe Universität. 340 € warm.",
            "f": "Gitarrenunterricht für Anfänger, jedes Alter. Erste Stunde kostenlos.",
            "g": "Umzugshelfer gesucht, Samstag 10 Uhr, ca. 4 Stunden. Bezahlung nach Absprache.",
            "h": "Nähkurs für Erwachsene, dienstags abends, Volkshochschule. Maschinen vorhanden.",
            "i": "Kleiner Kühlschrank zu verschenken, funktioniert einwandfrei. Nur Selbstabholung.",
            "j": "Reinigungskraft für Büro gesucht, zweimal pro Woche abends, 3 Stunden.",
            "k": "Deutschkurs A2 in kleiner Gruppe, Start im September, 10 Wochen.",
            "l": "Fotograf für Familienfeier, auch kurzfristig. Preise auf Anfrage."
          },
          "items": [
            {
              "id": "LV3-11",
              "question": "Ihre Tochter hat Schwierigkeiten in Mathematik und braucht regelmäßig Hilfe.",
              "correct": "a",
              "explanation_vi": "Con gái kém môn Toán, cần kèm đều ⇒ mẩu a (dạy kèm Toán lớp 5–10)."
            },
            {
              "id": "LV3-12",
              "question": "Sie ziehen am Samstag um und brauchen jemanden, der beim Tragen hilft.",
              "correct": "g",
              "explanation_vi": "Chuyển nhà thứ Bảy, cần người khiêng ⇒ mẩu g (tìm người phụ chuyển nhà, thứ Bảy)."
            },
            {
              "id": "LV3-13",
              "question": "Sie arbeiten tagsüber und wissen nicht, wer mit Ihrem Hund spazieren geht.",
              "correct": "d",
              "explanation_vi": "Ban ngày đi làm, không ai dắt chó ⇒ mẩu d (trông chó giờ hành chính)."
            },
            {
              "id": "LV3-14",
              "question": "Sie suchen ein günstiges Zimmer in der Nähe der Universität.",
              "correct": "e",
              "explanation_vi": "Cần phòng rẻ gần trường ⇒ mẩu e (phòng trong nhà chung, gần đại học)."
            },
            {
              "id": "LV3-15",
              "question": "Sie möchten in Ihrer Freizeit ein Instrument lernen, haben aber noch nie gespielt.",
              "correct": "f",
              "explanation_vi": "Muốn học nhạc cụ, chưa từng chơi ⇒ mẩu f (dạy guitar cho người mới, buổi đầu miễn phí)."
            },
            {
              "id": "LV3-16",
              "question": "Sie brauchen einen gebrauchten Kühlschrank und haben fast kein Geld.",
              "correct": "i",
              "explanation_vi": "Cần tủ lạnh cũ mà gần như không có tiền ⇒ mẩu i (cho không tủ lạnh nhỏ)."
            },
            {
              "id": "LV3-17",
              "question": "Sie wollen Ihr Auto verkaufen und suchen einen Käufer in der Stadt.",
              "correct": "x",
              "explanation_vi": "Muốn BÁN ô tô — không mẩu nào rao mua xe ⇒ x. Mẩu b bán xe đạp trẻ em, không phải ô tô."
            },
            {
              "id": "LV3-18",
              "question": "Sie fahren freitags oft nach Dresden und möchten die Kosten teilen.",
              "correct": "c",
              "explanation_vi": "Thứ Sáu hay đi Dresden, muốn chia tiền xăng ⇒ mẩu c (tìm người đi chung Leipzig–Dresden, thứ Sáu)."
            },
            {
              "id": "LV3-19",
              "question": "Sie suchen einen Kindergartenplatz für Ihren zweijährigen Sohn.",
              "correct": "x",
              "explanation_vi": "Tìm chỗ gửi trẻ hai tuổi — không mẩu nào về nhà trẻ ⇒ x. Mẩu d là trông chó, không phải trông trẻ."
            },
            {
              "id": "LV3-20",
              "question": "Ihre Firma sucht jemanden, der abends die Büroräume sauber macht.",
              "correct": "j",
              "explanation_vi": "Công ty cần người dọn văn phòng buổi tối ⇒ mẩu j (tìm nhân viên vệ sinh, hai buổi tối mỗi tuần)."
            }
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
          "instruction_de": "Lesen Sie den Text und entscheiden Sie, welches Wort (a, b oder c) in die Lücken 21–30 passt.",
          "instruction_vi": "Chọn từ đúng (a, b hoặc c) cho mỗi ô trống 21–30.",
          "gapped_text": "Sehr geehrte Frau Richter,\n\nich schreibe Ihnen, ___21___ ich meinen Termin am Donnerstag leider nicht wahrnehmen kann. Mein Sohn ist krank geworden, und ich muss ___22___ Hause bleiben.\n\nKönnten Sie mir bitte ___23___ neuen Termin geben? Am besten passt es mir in der nächsten Woche, ___24___ ich ab Montag wieder arbeite. Wenn Sie mir zwei oder drei Möglichkeiten nennen, ___25___ ich mich sofort entscheiden.\n\nDie Unterlagen, ___26___ Sie mir geschickt haben, habe ich bereits ausgefüllt. Ich bringe sie ___27___ zum Termin mit.\n\nFür die Umstände möchte ich mich ___28___ entschuldigen. Es tut mir wirklich leid, dass ich so kurzfristig ___29___ muss.\n\nVielen Dank für Ihr Verständnis. Ich freue mich ___30___ Ihre Antwort.\n\nMit freundlichen Grüßen\nSaskia Berger",
          "items": [
            {
              "id": "SB1-21",
              "gap": 21,
              "options": {
                "a": "weil",
                "b": "denn",
                "c": "obwohl"
              },
              "correct": "a",
              "explanation_vi": "„weil“ mở mệnh đề lý do, động từ xuống cuối: …nicht wahrnehmen kann. „denn“ đứng sau sẽ giữ trật tự chính, „obwohl“ nghĩa trái ngược."
            },
            {
              "id": "SB1-22",
              "gap": 22,
              "options": {
                "a": "nach",
                "b": "zu",
                "c": "bei"
              },
              "correct": "b",
              "explanation_vi": "Cụm cố định „zu Hause bleiben“ (ở nhà). „nach Hause“ là về nhà — chỉ dùng khi có chuyển động."
            },
            {
              "id": "SB1-23",
              "gap": 23,
              "options": {
                "a": "einen",
                "b": "einem",
                "c": "ein"
              },
              "correct": "a",
              "explanation_vi": "„einen neuen Termin“ — Akkusativ giống đực sau động từ geben."
            },
            {
              "id": "SB1-24",
              "gap": 24,
              "options": {
                "a": "damit",
                "b": "trotzdem",
                "c": "weil"
              },
              "correct": "c",
              "explanation_vi": "Mệnh đề lý do: tôi đi làm lại từ thứ Hai nên tuần sau hợp ⇒ „weil“. „damit“ chỉ mục đích, „trotzdem“ chỉ sự nhượng bộ."
            },
            {
              "id": "SB1-25",
              "gap": 25,
              "options": {
                "a": "kann",
                "b": "könnte",
                "c": "konnte"
              },
              "correct": "a",
              "explanation_vi": "Câu điều kiện thực ở hiện tại dùng „kann“. „könnte“ là giả định, „konnte“ là quá khứ."
            },
            {
              "id": "SB1-26",
              "gap": 26,
              "options": {
                "a": "was",
                "b": "die",
                "c": "der"
              },
              "correct": "b",
              "explanation_vi": "Đại từ quan hệ cho „die Unterlagen“ (số nhiều, Akkusativ) ⇒ „die“."
            },
            {
              "id": "SB1-27",
              "gap": 27,
              "options": {
                "a": "gern",
                "b": "gerne",
                "c": "lieber"
              },
              "correct": "a",
              "explanation_vi": "„Ich bringe sie gern mit“ — trạng từ; „gerne“ cũng đúng nhưng dạng chuẩn ở đây là „gern“, còn „lieber“ nghĩa là thích hơn."
            },
            {
              "id": "SB1-28",
              "gap": 28,
              "options": {
                "a": "herzlich",
                "b": "vielmals",
                "c": "sehr gern"
              },
              "correct": "b",
              "explanation_vi": "Cụm quen dùng trong thư lịch sự: „sich vielmals entschuldigen“."
            },
            {
              "id": "SB1-29",
              "gap": 29,
              "options": {
                "a": "absagen",
                "b": "abgesagt",
                "c": "absage"
              },
              "correct": "a",
              "explanation_vi": "Sau động từ khuyết thiếu „muss“ là động từ nguyên thể ⇒ „absagen“."
            },
            {
              "id": "SB1-30",
              "gap": 30,
              "options": {
                "a": "über",
                "b": "auf",
                "c": "an"
              },
              "correct": "b",
              "explanation_vi": "Cụm cố định „sich freuen AUF“ + Akkusativ khi nói về điều sắp tới. „sich freuen über“ dùng cho việc đã xảy ra."
            }
          ]
        },
        {
          "teil": 2,
          "type": "GAP_WORDBANK",
          "point_per_item": 1.5,
          "single_use": true,
          "instruction_de": "Welches Wort aus dem Kasten a–o passt in die Lücken 31–40? Jedes Wort kann nur einmal verwendet werden.",
          "instruction_vi": "Chọn từ trong hộp a–o cho mỗi ô trống 31–40. Mỗi từ chỉ dùng một lần.",
          "word_bank": {
            "a": "Anmeldung",
            "b": "Bescheid",
            "c": "dringend",
            "d": "erreichbar",
            "e": "Gebühr",
            "f": "gültig",
            "g": "Nachweis",
            "h": "rechtzeitig",
            "i": "Sprechzeiten",
            "j": "Stelle",
            "k": "Unterlagen",
            "l": "verschieben",
            "m": "Voraussetzung",
            "n": "zuständig",
            "o": "zusätzlich"
          },
          "gapped_text": "Liebe Nachbarn,\n\nab dem 1. Oktober ändern sich die ___31___ unseres Bürgerbüros. Wir sind dann montags und donnerstags bis 18 Uhr für Sie ___32___.\n\nBitte bringen Sie zu jedem Termin alle ___33___ mit. Ohne einen gültigen ___34___ über Ihren Wohnsitz können wir Ihren Antrag leider nicht bearbeiten. Für manche Anträge fällt außerdem eine kleine ___35___ an; den genauen Betrag finden Sie auf unserer Webseite.\n\nWenn Sie einen Termin nicht einhalten können, sagen Sie bitte ___36___ ab — spätestens einen Tag vorher. So kann jemand anderes den Platz bekommen. Falls Ihr Anliegen sehr ___37___ ist, rufen Sie uns bitte direkt an.\n\nFür Fragen zum Wohngeld ist ab sofort Frau Kaufmann ___38___. Eine vorherige ___39___ ist nicht nötig.\n\nWir geben Ihnen rechtzeitig ___40___, sobald es weitere Änderungen gibt.\n\nIhr Bürgerbüro",
          "items": [
            {
              "id": "SB2-31",
              "gap": 31,
              "correct": "i",
              "explanation_vi": "„Sprechzeiten“ — giờ tiếp dân của văn phòng."
            },
            {
              "id": "SB2-32",
              "gap": 32,
              "correct": "d",
              "explanation_vi": "„erreichbar“ — liên hệ được; đi với „für Sie“."
            },
            {
              "id": "SB2-33",
              "gap": 33,
              "correct": "k",
              "explanation_vi": "„Unterlagen“ — giấy tờ mang theo khi đến làm thủ tục."
            },
            {
              "id": "SB2-34",
              "gap": 34,
              "correct": "g",
              "explanation_vi": "„Nachweis“ — giấy chứng minh nơi cư trú."
            },
            {
              "id": "SB2-35",
              "gap": 35,
              "correct": "e",
              "explanation_vi": "„Gebühr“ — khoản lệ phí phải nộp."
            },
            {
              "id": "SB2-36",
              "gap": 36,
              "correct": "h",
              "explanation_vi": "„rechtzeitig absagen“ — huỷ hẹn đúng lúc, chậm nhất trước một ngày."
            },
            {
              "id": "SB2-37",
              "gap": 37,
              "correct": "c",
              "explanation_vi": "„dringend“ — việc gấp thì gọi điện thẳng."
            },
            {
              "id": "SB2-38",
              "gap": 38,
              "correct": "n",
              "explanation_vi": "„zuständig“ — người phụ trách mảng đó."
            },
            {
              "id": "SB2-39",
              "gap": 39,
              "correct": "a",
              "explanation_vi": "„Anmeldung“ — việc đăng ký trước, ở đây là không cần."
            },
            {
              "id": "SB2-40",
              "gap": 40,
              "correct": "b",
              "explanation_vi": "„Bescheid geben“ — báo tin; cụm cố định với động từ geben."
            }
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
          "instruction_de": "Sie hören fünf kurze Texte. Sie hören jeden Text EINMAL. Richtig oder falsch?",
          "instruction_vi": "Nghe 5 đoạn ngắn, mỗi đoạn CHỈ MỘT LẦN. Chọn đúng hoặc sai.",
          "items": [
            {
              "id": "HV1-41",
              "question": "Der Zug nach Hannover fährt heute von einem anderen Gleis ab.",
              "audio_script": "Achtung an Gleis 7: Der Regionalexpress nach Hannover, planmäßige Abfahrt 14 Uhr 12, fährt heute ausnahmsweise von Gleis 9. Wir bitten um Ihr Verständnis.",
              "correct": "richtig",
              "explanation_vi": "Thông báo nói tàu đi Hannover hôm nay chạy từ đường ray 9 thay vì 7 ⇒ ĐÚNG."
            },
            {
              "id": "HV1-42",
              "question": "Das Konzert fällt aus.",
              "audio_script": "Liebe Gäste, das Konzert im Innenhof beginnt wegen des Regens eine halbe Stunde später als geplant. Es findet statt — bitte warten Sie im Foyer.",
              "correct": "falsch",
              "explanation_vi": "Buổi hoà nhạc chỉ bắt đầu muộn nửa tiếng vì mưa, „Es findet statt“ ⇒ SAI, không huỷ."
            },
            {
              "id": "HV1-43",
              "question": "Man muss sich für den Kurs vorher anmelden.",
              "audio_script": "Der Kochkurs am Samstag ist offen für alle. Eine Anmeldung ist nicht erforderlich, kommen Sie einfach vorbei. Bringen Sie nur eine Schürze mit.",
              "correct": "falsch",
              "explanation_vi": "„Eine Anmeldung ist nicht erforderlich“ — không cần đăng ký ⇒ SAI."
            },
            {
              "id": "HV1-44",
              "question": "Die Praxis ist am Freitagnachmittag geschlossen.",
              "audio_script": "Sie haben die Praxis Dr. Wenzel erreicht. Unsere Sprechzeiten: Montag bis Donnerstag von 8 bis 17 Uhr, freitags nur vormittags von 8 bis 12 Uhr.",
              "correct": "richtig",
              "explanation_vi": "Thứ Sáu chỉ mở buổi sáng 8–12 giờ ⇒ chiều đóng cửa ⇒ ĐÚNG."
            },
            {
              "id": "HV1-45",
              "question": "Der Sprecher sucht seinen Schlüssel.",
              "audio_script": "Entschuldigung, hat jemand einen blauen Regenschirm gefunden? Ich habe ihn heute Morgen im Wartezimmer vergessen. Bitte geben Sie ihn am Empfang ab.",
              "correct": "falsch",
              "explanation_vi": "Người nói tìm chiếc Ô mà mình để quên, không phải chìa khoá ⇒ SAI."
            }
          ]
        },
        {
          "teil": 2,
          "point_per_item": 2.5,
          "max_plays": 2,
          "instruction_de": "Sie hören ein Gespräch. Sie hören das Gespräch ZWEIMAL. Richtig oder falsch?",
          "instruction_vi": "Nghe một cuộc phỏng vấn, được nghe HAI LẦN. Chọn đúng hoặc sai.",
          "audio_script": [
            {
              "speaker": "PRUEFER",
              "name": "Moderatorin",
              "text": "Guten Tag, Herr Vogel. Sie leiten seit drei Jahren eine Fahrradwerkstatt, in der Jugendliche mitarbeiten. Wie kam es dazu?"
            },
            {
              "speaker": "PARTNER",
              "name": "Herr Vogel",
              "text": "Eigentlich war es ein Zufall. Ich habe früher in einem Büro gearbeitet und nur am Wochenende Räder repariert. Irgendwann standen ständig Nachbarskinder in meiner Garage."
            },
            {
              "speaker": "PRUEFER",
              "name": "Moderatorin",
              "text": "Und daraus wurde ein Projekt?"
            },
            {
              "speaker": "PARTNER",
              "name": "Herr Vogel",
              "text": "Ja, aber erst nach zwei Jahren. Die Stadt hat uns eine alte Halle vermietet, günstig, aber sie war in schlechtem Zustand. Das Dach haben wir selbst repariert."
            },
            {
              "speaker": "PRUEFER",
              "name": "Moderatorin",
              "text": "Wer kommt zu Ihnen?"
            },
            {
              "speaker": "PARTNER",
              "name": "Herr Vogel",
              "text": "Meistens Jugendliche zwischen vierzehn und achtzehn. Einige kommen, weil ihr Rad kaputt ist. Andere bleiben und lernen, wie man repariert. Wir zwingen niemanden."
            },
            {
              "speaker": "PRUEFER",
              "name": "Moderatorin",
              "text": "Bezahlen die Jugendlichen etwas?"
            },
            {
              "speaker": "PARTNER",
              "name": "Herr Vogel",
              "text": "Nein, das Material bezahlen wir aus Spenden. Aber wer ein Rad mitnimmt, arbeitet vorher zehn Stunden bei uns mit. Das ist die einzige Regel."
            },
            {
              "speaker": "PRUEFER",
              "name": "Moderatorin",
              "text": "Haben Sie genug Helfer?"
            },
            {
              "speaker": "PARTNER",
              "name": "Herr Vogel",
              "text": "Nein, das ist unser größtes Problem. Wir bräuchten dringend jemanden, der sich um die Buchhaltung kümmert. Handwerker finden wir leichter als Leute fürs Büro."
            },
            {
              "speaker": "PRUEFER",
              "name": "Moderatorin",
              "text": "Was planen Sie als Nächstes?"
            },
            {
              "speaker": "PARTNER",
              "name": "Herr Vogel",
              "text": "Im Frühjahr wollen wir einen Kurs nur für Mädchen anbieten. In der Werkstatt sind bisher fast nur Jungen, und das möchten wir ändern."
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
              "explanation_vi": "„Ich habe früher in einem Büro gearbeitet“ ⇒ ĐÚNG."
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
              "explanation_vi": "„Die Stadt hat uns eine alte Halle vermietet“ ⇒ ĐÚNG."
            },
            {
              "id": "HV2-50",
              "question": "Die Halle war sofort benutzbar.",
              "correct": "falsch",
              "explanation_vi": "Nhà xưởng „in schlechtem Zustand“, mái phải tự sửa ⇒ SAI."
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
              "explanation_vi": "„wer ein Rad mitnimmt, arbeitet vorher zehn Stunden bei uns mit“ ⇒ ĐÚNG."
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
          "instruction_de": "Sie hören fünf kurze Texte. Sie hören jeden Text ZWEIMAL. Richtig oder falsch?",
          "instruction_vi": "Nghe 5 đoạn ngắn, mỗi đoạn được nghe HAI LẦN. Chọn đúng hoặc sai.",
          "items": [
            {
              "id": "HV3-56",
              "question": "Die Frau möchte den Termin absagen.",
              "audio_script": "Hallo Frau Brandt, hier ist Nadine Krüger. Ich wollte fragen, ob wir unser Treffen von Dienstag auf Mittwoch legen können. Dienstag passt mir leider doch nicht.",
              "correct": "falsch",
              "explanation_vi": "Bà ấy muốn DỜI buổi hẹn từ thứ Ba sang thứ Tư, không phải huỷ ⇒ SAI."
            },
            {
              "id": "HV3-57",
              "question": "Das Paket wurde beim Nachbarn abgegeben.",
              "audio_script": "Guten Tag, hier ist der Paketdienst. Sie waren heute nicht zu Hause. Ihr Paket liegt jetzt in der Filiale in der Bahnhofstraße und kann dort sieben Tage abgeholt werden.",
              "correct": "falsch",
              "explanation_vi": "Bưu kiện để ở bưu cục đường Bahnhofstraße, không gửi hàng xóm ⇒ SAI."
            },
            {
              "id": "HV3-58",
              "question": "Der Kurs beginnt später als ursprünglich geplant.",
              "audio_script": "Liebe Teilnehmerinnen und Teilnehmer, der Anfängerkurs startet nicht wie angekündigt am 5. September, sondern erst am 19. September. Der Raum bleibt derselbe.",
              "correct": "richtig",
              "explanation_vi": "Khoá học dời từ 5/9 sang 19/9 — muộn hơn dự kiến ⇒ ĐÚNG."
            },
            {
              "id": "HV3-59",
              "question": "Der Mann empfiehlt, das Gerät zurückzugeben.",
              "audio_script": "Also, wenn die Maschine schon nach vier Monaten kaputt ist, würde ich sie an Ihrer Stelle reparieren lassen. Sie haben ja noch Garantie, das kostet Sie nichts.",
              "correct": "falsch",
              "explanation_vi": "Người nói khuyên đem đi SỬA vì còn bảo hành, không khuyên trả lại ⇒ SAI."
            },
            {
              "id": "HV3-60",
              "question": "Die Bibliothek verlangt für zu spät zurückgegebene Bücher Geld.",
              "audio_script": "Bitte denken Sie daran: Bücher müssen nach vier Wochen zurück sein. Für jeden Tag danach berechnen wir zwanzig Cent pro Buch.",
              "correct": "richtig",
              "explanation_vi": "„zwanzig Cent pro Buch“ cho mỗi ngày trả muộn ⇒ ĐÚNG."
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
          "instruction_de": "Schreiben Sie einen Brief (circa 100 Wörter).",
          "instruction_vi": "Viết một bức thư khoảng 100 từ, có đủ bốn ý bắt buộc.",
          "prompt": "Sie haben vor drei Wochen in einem Onlineshop eine Kaffeemaschine bestellt. Das Gerät ist angekommen, aber es funktioniert nicht richtig: Es schaltet sich nach kurzer Zeit von selbst aus. Schreiben Sie an den Kundenservice.",
          "writing_points": [
            "Warum Sie schreiben (Bestellung, Datum)",
            "Was genau nicht funktioniert",
            "Was Sie sich wünschen (Reparatur, Austausch oder Geld zurück)",
            "Bis wann Sie eine Antwort erwarten"
          ]
        }
      ]
    }
  ]
}
$j$::jsonb,
        225, 135, 150, TRUE);

-- Bộ đề để học viên tìm thấy đề này trong catalog. Xếp sau các bộ Goethe (A1…C1 đang dùng 1–5).
INSERT INTO mock_exam_packs (title, description_vi, cefr_level, exam_format, requires_paid, sort_order)
VALUES ('Luyện thi telc B1', 'Đề thi thử định dạng telc Deutsch B1 — hai ngưỡng đỗ riêng cho phần viết và phần nói.',
        'B1', 'TELC', TRUE, 6);
