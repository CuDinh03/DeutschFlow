-- V311: Năm đề thi thử C1 (Set 1–5) — trình độ C1 trước đây KHÔNG có đề nào.
-- Cấu trúc theo Goethe-Zertifikat C1: Lesen 4 Teil (20 câu) · Hören 4 Teil (20 câu) ·
-- Schreiben 2 bài (bài luận + thư trang trọng) · Sprechen 2 Teil. Mỗi phần 25 điểm.

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'C1', 'GOETHE',
  'Goethe-Zertifikat C1 – Set 1',
  'Đề thi thử Goethe C1 – Chủ đề: Khoa học và nghiên cứu',
  100, 60, 120,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einem Feuilleton: Die Reproduzierbarkeitskrise und was aus ihr folgt\nDass sich zahlreiche vielzitierte Studien nicht wiederholen lassen, gilt inzwischen als gesicherte Erkenntnis über den Wissenschaftsbetrieb selbst. Bemerkenswert ist weniger der Befund als die Erklärung, die sich durchgesetzt hat: Nicht Betrug, sondern ein System von Anreizen erzeugt die Schieflage. Wer Karriere machen will, braucht Veröffentlichungen in angesehenen Zeitschriften, und diese bevorzugen Aufsehen erregende Ergebnisse. Ein Befund, der nichts zeigt, gilt als Misserfolg, obwohl er den Erkenntnisstand ebenso präzisiert wie ein positiver. Die Folge ist eine stille Selektion: Studien mit unklarem Ausgang verschwinden in der Schublade, und der publizierte Bestand fällt systematisch zu optimistisch aus. Gegenmaßnahmen sind bekannt und teilweise wirksam. Wo Fragestellung und Auswertungsplan vor der Datenerhebung registriert werden, sinkt die Zahl der nachträglich zurechtgebogenen Hypothesen erheblich. Skeptiker halten dem entgegen, die Bürokratisierung bremse gerade jene explorative Forschung, aus der die interessanten Fragen erst entstehen. Dieser Einwand verdient Gehör, entkräftet die Kritik aber nicht: Es spricht nichts dagegen, exploratives Vorgehen als solches auszuweisen, statt es im Nachhinein als Bestätigung einer angeblich vorab formulierten Erwartung zu präsentieren.",
            "items": [
              {"id":"L1-1","question":"Worin sieht der Text die Hauptursache der Krise?","options":{"A":"In gezieltem Betrug einzelner Forschender","B":"In einem System falscher Anreize","C":"In veralteten Messgeräten"},"correct":"B","explanation_vi":"Nicht Betrug, sondern ein System von Anreizen."},
              {"id":"L1-2","question":"Wie wird ein Befund ohne Effekt im Wissenschaftsbetrieb bewertet?","options":{"A":"Als Misserfolg, obwohl er informativ ist","B":"Als besonders wertvoll","C":"Als Grund für eine Auszeichnung"},"correct":"A","explanation_vi":"gilt als Misserfolg, obwohl er den Erkenntnisstand präzisiert."},
              {"id":"L1-3","question":"Was bedeutet die stille Selektion für den publizierten Bestand?","options":{"A":"Er wird zu pessimistisch","B":"Er wird systematisch zu optimistisch","C":"Er bleibt unverändert"},"correct":"B","explanation_vi":"der publizierte Bestand fällt systematisch zu optimistisch aus."},
              {"id":"L1-4","question":"Welche Wirkung hat die Vorabregistrierung laut Text?","options":{"A":"Sie erhöht die Zahl der Publikationen","B":"Sie senkt die Zahl nachträglich angepasster Hypothesen","C":"Sie verhindert jede explorative Forschung"},"correct":"B","explanation_vi":"sinkt die Zahl der nachträglich zurechtgebogenen Hypothesen."},
              {"id":"L1-5","question":"Wie geht der Autor mit dem Einwand der Skeptiker um?","options":{"A":"Er hält ihn für berechtigt, aber nicht für entkräftend","B":"Er lehnt ihn vollständig ab","C":"Er übernimmt ihn ohne Einschränkung"},"correct":"A","explanation_vi":"Dieser Einwand verdient Gehör, entkräftet die Kritik aber nicht."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Kurztexte A bis E. Welcher Text passt zu welcher Aussage?",
            "instruction_vi": "Đọc 5 đoạn A–E và ghép với từng nhận định",
            "context": "A = Astrophysikerin Reinhardt: Unsere Instrumente liefern mehr Daten, als ein Team je auswerten kann. Ohne automatisierte Vorauswahl blieben neunzig Prozent unberührt, und genau dort liegt das Risiko: Der Algorithmus entscheidet mit, was wir überhaupt zu sehen bekommen.\nB = Wissenschaftshistoriker Lubbe: Der Mythos vom einsamen Genie hält sich hartnäckig, obwohl die Quellen etwas anderes zeigen. Auch die berühmten Durchbrüche waren Ergebnis von Werkstätten, Korrespondenz und nicht selten von Arbeit, die anderen zugeschrieben wurde.\nC = Toxikologin Feld: Der öffentliche Streit dreht sich meist um Ja oder Nein, während unsere Aussagen immer an Dosis, Dauer und Kontext gebunden sind. Wer das in eine Schlagzeile presst, erzeugt Gewissheiten, die es nicht gibt.\nD = Forschungsförderer Ntsiba: Anträge werden nach erwarteter Wirkung bewertet, was risikoreiche Ideen benachteiligt. Wir haben deshalb eine Sparte eingeführt, in der ein Scheitern ausdrücklich eingeplant ist.\nE = Doktorandin Vogel: Zwischen dem Anspruch, international zu publizieren, und befristeten Verträgen von zwei Jahren liegt ein Widerspruch, den niemand auflöst. Wer eine Familie plant, verlässt das System, nicht weil ihm die Neugier fehlt.",
            "items": [
              {"id":"L2-1","person":"Diese Person weist darauf hin, dass Befristungen Menschen aus der Wissenschaft drängen.","question":"Welcher Text passt?","correct":"E","explanation_vi":"E nói về hợp đồng ngắn hạn khiến người ta rời bỏ hệ thống."},
              {"id":"L2-2","person":"Diese Person betont, dass Ergebnisse ohne Angabe von Bedingungen missverständlich werden.","question":"Welcher Text passt?","correct":"C","explanation_vi":"C nhấn mạnh liều lượng, thời gian và bối cảnh."},
              {"id":"L2-3","person":"Diese Person beschreibt, dass technische Vorauswahl den Blick der Forschung mitbestimmt.","question":"Welcher Text passt?","correct":"A","explanation_vi":"A nói thuật toán quyết định ta nhìn thấy gì."},
              {"id":"L2-4","person":"Diese Person korrigiert eine verbreitete Vorstellung über die Entstehung von Erkenntnis.","question":"Welcher Text passt?","correct":"B","explanation_vi":"B bác bỏ huyền thoại thiên tài đơn độc."},
              {"id":"L2-5","person":"Diese Person berichtet von einer Änderung der Vergabepraxis zugunsten riskanter Vorhaben.","question":"Welcher Text passt?","correct":"D","explanation_vi":"D lập hạng mục tài trợ chấp nhận thất bại."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Streitgespräch: Wie viel Öffentlichkeit verträgt die Forschung?\nProf. Hanke: Ich veröffentliche Zwischenergebnisse bewusst früh. Wer wartet, bis alles gesichert ist, überlässt das Feld denjenigen, die keine Belege brauchen.\nDr. Simon: Das halte ich für riskant. Was einmal als Zahl in der Welt ist, verschwindet nicht mehr, auch wenn wir sie später korrigieren müssen. Vertrauen verliert man genau an dieser Stelle.\nJournalistin Marek: Beide unterschätzen unseren Teil. Wir fragen nach dem einen Satz, der die Meldung trägt, und bekommen ihn meistens auch. Die Zuspitzung entsteht im Zusammenspiel, nicht allein in der Redaktion.\nProf. Öztürk: Mir fehlt die Unterscheidung zwischen Fächern. In der Klimaforschung ist die Beweislage robust, in der Ernährungsforschung dagegen wechseln die Empfehlungen zu Recht häufiger. Wer beides gleich behandelt, erzeugt Verwirrung.\nDr. Simon: Dem stimme ich zu, nur folgt daraus nicht, dass frühe Kommunikation harmlos wäre.",
            "items": [
              {"id":"L3-1","question":"Prof. Hanke begründet frühe Veröffentlichung damit, dass sonst andere das Feld besetzen.","correct":"richtig","explanation_vi":"überlässt das Feld denjenigen, die keine Belege brauchen."},
              {"id":"L3-2","question":"Dr. Simon hält spätere Korrekturen für unproblematisch.","correct":"falsch","explanation_vi":"Ông cho rằng sửa sau vẫn làm mất niềm tin."},
              {"id":"L3-3","question":"Journalistin Marek sieht die Verantwortung für Zuspitzung allein bei den Redaktionen.","correct":"falsch","explanation_vi":"Die Zuspitzung entsteht im Zusammenspiel."},
              {"id":"L3-4","question":"Prof. Öztürk fordert, zwischen Fächern zu unterscheiden.","correct":"richtig","explanation_vi":"Mir fehlt die Unterscheidung zwischen Fächern."},
              {"id":"L3-5","question":"Dr. Simon widerspricht Prof. Öztürk vollständig.","correct":"falsch","explanation_vi":"Ông đồng ý, chỉ bảo lưu điểm về truyền thông sớm."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Gegen die Verwechslung von Zweifel und Kritik\nWissenschaftlicher Zweifel ist eine Methode, organisierter Zweifel als Geschäftsmodell ist etwas anderes. Der Unterschied lässt sich an der Zielsetzung ablesen. Wer methodisch zweifelt, gibt an, welche Beobachtung ihn überzeugen würde; wer Zweifel produziert, wechselt das Argument, sobald es widerlegt ist. Historisch ist dieses Muster gut dokumentiert, von der Tabakindustrie bis zu Debatten über Feinstaub. Für die Öffentlichkeit ist die Unterscheidung schwer, weil beide Seiten dieselbe Sprache benutzen und Unsicherheit betonen. Hilfreich ist deshalb weniger die Frage, ob jemand Zweifel äußert, als die Frage, ob er sich widerlegen ließe. Zugleich sollte man der Versuchung widerstehen, jede unbequeme Nachfrage als Kampagne zu deuten. Genau davon lebt der Vorwurf, Wissenschaft dulde keinen Widerspruch. Wer Vertrauen will, muss aushalten, dass Kritik zunächst nicht von der Absicht her beurteilt wird, sondern von ihren Gründen.",
            "items": [
              {"id":"L4-1","question":"Woran lässt sich laut Text der Unterschied ablesen?","options":{"A":"An der Lautstärke der Debatte","B":"An der Zielsetzung und der Bereitschaft, sich widerlegen zu lassen","C":"An der Zahl der Publikationen"},"correct":"B","explanation_vi":"Ai sẵn sàng bị bác bỏ mới là hoài nghi khoa học."},
              {"id":"L4-2","question":"Was kennzeichnet die Produktion von Zweifel?","options":{"A":"Das Argument wird gewechselt, sobald es widerlegt ist","B":"Es werden neue Daten erhoben","C":"Die Methode wird offengelegt"},"correct":"A","explanation_vi":"wechselt das Argument, sobald es widerlegt ist."},
              {"id":"L4-3","question":"Warum ist die Unterscheidung für die Öffentlichkeit schwierig?","options":{"A":"Weil beide Seiten dieselbe Sprache benutzen","B":"Weil es keine Studien gibt","C":"Weil Medien nicht berichten"},"correct":"A","explanation_vi":"beide Seiten benutzen dieselbe Sprache."},
              {"id":"L4-4","question":"Wovor warnt der Autor zusätzlich?","options":{"A":"Vor jeder Form von Kritik","B":"Davor, jede Nachfrage als Kampagne zu deuten","C":"Vor der Veröffentlichung von Daten"},"correct":"B","explanation_vi":"Đừng quy mọi câu hỏi khó thành chiến dịch."},
              {"id":"L4-5","question":"Welche Haltung empfiehlt der Text am Ende?","options":{"A":"Kritik nach ihren Gründen beurteilen","B":"Kritik nach der Absicht beurteilen","C":"Kritik ignorieren"},"correct":"A","explanation_vi":"nicht von der Absicht her, sondern von ihren Gründen."}
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
            "instruction_de": "Hören Sie die kurzen Beiträge und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Aus einer Institutsmitteilung: Die Ethikkommission hat dem Vorhaben zugestimmt, allerdings unter Auflagen. Die Teilnehmenden sind vor Beginn ausdrücklich darüber zu informieren, dass die Aufzeichnungen nach Abschluss der Auswertung gelöscht werden.","question":"Welche Auflage wird genannt?","options":{"A":"Die Teilnehmenden müssen über die Löschung informiert werden","B":"Die Studie darf nicht beginnen","C":"Die Aufzeichnungen bleiben dauerhaft gespeichert"},"correct":"A","explanation_vi":"Phải thông báo trước rằng bản ghi sẽ bị xoá."},
              {"id":"H1-2","audio_script":"A: Wie bewertest du das Gutachten? B: Handwerklich sauber, aber es beantwortet nicht die Frage, die wir gestellt haben. Es beschreibt den Ist-Zustand, während wir eine Prognose brauchen.","question":"Was kritisiert die zweite Person?","options":{"A":"Die Sprache des Gutachtens","B":"Dass die eigentliche Frage unbeantwortet bleibt","C":"Die zu hohen Kosten"},"correct":"B","explanation_vi":"Báo cáo mô tả hiện trạng thay vì dự báo."},
              {"id":"H1-3","audio_script":"Hinweis der Bibliothek: Die Datenbank ist ab Montag nur noch über den Campuszugang erreichbar. Wer von zu Hause arbeitet, benötigt künftig den Fernzugriff, der einmalig freigeschaltet werden muss.","question":"Was ändert sich für Nutzer im Homeoffice?","options":{"A":"Sie brauchen einen freigeschalteten Fernzugriff","B":"Sie verlieren den Zugang vollständig","C":"Sie müssen eine Gebühr zahlen"},"correct":"A","explanation_vi":"Cần kích hoạt truy cập từ xa một lần."},
              {"id":"H1-4","audio_script":"A: Der Vortrag war brillant, aber ich frage mich, ob die Zahlen tragen. B: Genau das ist mein Punkt. Bei einer Stichprobe von 30 Personen würde ich vorsichtiger formulieren, unabhängig davon, wie überzeugend der Vortrag klingt.","question":"Worin sind sich die Sprechenden einig?","options":{"A":"Der Vortrag war schlecht gehalten","B":"Die Datenbasis rechtfertigt keine starken Aussagen","C":"Die Stichprobe war zu groß"},"correct":"B","explanation_vi":"Mẫu 30 người quá nhỏ để kết luận mạnh."},
              {"id":"H1-5","audio_script":"Aus einer Rede: Ich bedanke mich bei allen, die diese Arbeit ermöglicht haben, und weise ausdrücklich darauf hin, dass die zentrale Idee nicht von mir stammt, sondern in der Diskussion mit unserer verstorbenen Kollegin entstanden ist.","question":"Was betont die Rednerin?","options":{"A":"Dass die Idee gemeinschaftlich entstanden ist","B":"Dass sie allein gearbeitet hat","C":"Dass die Arbeit unvollständig ist"},"correct":"A","explanation_vi":"Ý tưởng nảy sinh trong trao đổi với đồng nghiệp đã mất."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài giảng và chọn Richtig hoặc Falsch",
            "audio_script": "Meine Damen und Herren, ich spreche über Modelle und ihre Grenzen. Ein Modell ist keine verkleinerte Wirklichkeit, sondern eine bewusste Auswahl. Es taugt für die Fragen, für die es gebaut wurde, und nur für diese. Das klingt selbstverständlich, wird aber regelmäßig übergangen, sobald Ergebnisse politisch verwertbar sind. Beispiel Infektionsgeschehen: Ein Modell, das Kontaktverhalten als konstant annimmt, liefert brauchbare Kurzfristprognosen und wird unbrauchbar, sobald sich das Verhalten ändert. Der Fehler liegt dann nicht im Modell, sondern in seiner Verwendung. Zweitens: Unsicherheit ist keine Schwäche, die man wegkommunizieren sollte. Ein Bereich statt einer Zahl ist ehrlicher und, wie Untersuchungen zeigen, für Entscheidungsträger sogar nützlicher, weil er Handlungsspielräume sichtbar macht. Drittens warne ich vor der Vorstellung, mehr Daten führten automatisch zu besseren Modellen. Ohne theoretische Annahme über Zusammenhänge liefert die größte Datenmenge nur Korrelationen, die zufällig sein können. Und schließlich: Wer Modelle nutzt, sollte deren Annahmen offenlegen. Nicht, damit alle sie prüfen, sondern damit überhaupt jemand es kann.",
            "items": [
              {"id":"H2-1","question":"Ein Modell ist laut Vortrag eine bewusste Auswahl, keine verkleinerte Wirklichkeit.","correct":"richtig","explanation_vi":"Câu mở đầu của bài nói."},
              {"id":"H2-2","question":"Der Redner hält Modelle für grundsätzlich unbrauchbar.","correct":"falsch","explanation_vi":"Chúng dùng được cho đúng câu hỏi đã thiết kế."},
              {"id":"H2-3","question":"Er empfiehlt, Unsicherheit als Bereich statt als einzelne Zahl anzugeben.","correct":"richtig","explanation_vi":"Ein Bereich statt einer Zahl ist ehrlicher."},
              {"id":"H2-4","question":"Mehr Daten führen laut Vortrag automatisch zu besseren Modellen.","correct":"falsch","explanation_vi":"Không có giả định lý thuyết thì chỉ ra tương quan ngẫu nhiên."},
              {"id":"H2-5","question":"Er fordert, die Annahmen von Modellen offenzulegen.","correct":"richtig","explanation_vi":"damit überhaupt jemand es prüfen kann."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderatorin: Frau Professorin Kern, Sie haben Ihre Arbeitsgruppe umgebaut. Kern: Ja, wir haben die Autorenschaft neu geregelt. Früher stand die Leitung automatisch an letzter Stelle, heute wird der Beitrag jeder Person schriftlich festgehalten. Moderatorin: Herr Dr. Amini, Sie waren skeptisch. Amini: Ich fürchtete endlose Diskussionen. Tatsächlich haben wir am Anfang mehr gestritten, allerdings über Dinge, die vorher unausgesprochen blieben. Kern: Genau das war der Zweck. Der Konflikt war vorher auch da, nur ohne Verfahren. Moderatorin: Hat sich die Produktivität verändert? Amini: Kurzfristig sind wir langsamer geworden. Wer heute mitschreibt, muss nachweisen, was er beigetragen hat. Kern: Und langfristig sehen wir weniger Streit bei Beförderungen, weil die Beiträge dokumentiert sind. Moderatorin: Würden Sie es anderen empfehlen? Amini: Ja, aber nicht in der Endphase eines Projekts. Man braucht einen Neustart, sonst wirkt es wie Misstrauen.",
            "items": [
              {"id":"H3-1","question":"Was hat die Arbeitsgruppe geändert?","options":{"A":"Die Regeln der Autorenschaft","B":"Die Arbeitszeiten","C":"Das Forschungsthema"},"correct":"A","explanation_vi":"wir haben die Autorenschaft neu geregelt."},
              {"id":"H3-2","question":"Wie beschreibt Herr Amini die Anfangsphase?","options":{"A":"Es gab mehr Streit über vorher Unausgesprochenes","B":"Es gab keinerlei Konflikte","C":"Alle lehnten die Regeln ab"},"correct":"A","explanation_vi":"mehr gestritten über Dinge, die vorher unausgesprochen blieben."},
              {"id":"H3-3","question":"Wie wirkte sich die Änderung kurzfristig aus?","options":{"A":"Die Gruppe wurde langsamer","B":"Die Gruppe wurde schneller","C":"Nichts änderte sich"},"correct":"A","explanation_vi":"Kurzfristig sind wir langsamer geworden."},
              {"id":"H3-4","question":"Welchen langfristigen Vorteil nennt Frau Kern?","options":{"A":"Weniger Streit bei Beförderungen","B":"Mehr Publikationen","C":"Höhere Drittmittel"},"correct":"A","explanation_vi":"weniger Streit bei Beförderungen."},
              {"id":"H3-5","question":"Wann rät Herr Amini von der Umstellung ab?","options":{"A":"In der Endphase eines Projekts","B":"Zu Beginn eines Projekts","C":"In großen Gruppen"},"correct":"A","explanation_vi":"nicht in der Endphase eines Projekts."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person kritisiert die Bewertung von Forschenden nach Kennzahlen.\nB = Diese Person hält den Austausch zwischen Disziplinen für unterschätzt.\nC = Diese Person fordert bessere Betreuung des wissenschaftlichen Nachwuchses.\nD = Diese Person verteidigt Grundlagenforschung ohne absehbaren Nutzen.\nE = Diese Person spricht über den Umgang mit eigenen Fehlern.",
            "audio_script": "Sprecher 1: Ich habe eine Korrektur zu einem eigenen Aufsatz veröffentlicht. Unangenehm war nicht der Fehler, sondern die Erwartung, ihn zu verschweigen.\nSprecherin 2: Solange die Zahl der Zitationen über Stellen entscheidet, optimieren alle auf diese Zahl. Damit misst man Sichtbarkeit, nicht Qualität.\nSprecher 3: Die entscheidenden Fragen meiner Laufbahn kamen aus Gesprächen mit Leuten aus ganz anderen Fächern, nie aus meiner eigenen Tagung.\nSprecherin 4: Als der Laser entwickelt wurde, wusste niemand, wozu er gut sein würde. Wer nur fördert, was in fünf Jahren Ertrag bringt, streicht genau solche Wege.\nSprecher 5: Promovierende werden bei uns wie billige Arbeitskraft eingesetzt. Ein Gespräch im Halbjahr ist keine Betreuung.",
            "items": [
              {"id":"H4-1","person":"Sprecher 1","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 1 nói về việc công khai sai sót của chính mình."},
              {"id":"H4-2","person":"Sprecherin 2","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 2 phê phán đánh giá theo chỉ số trích dẫn."},
              {"id":"H4-3","person":"Sprecher 3","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 3 đề cao trao đổi liên ngành."},
              {"id":"H4-4","person":"Sprecherin 4","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 4 bảo vệ nghiên cứu cơ bản."},
              {"id":"H4-5","person":"Sprecher 5","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 5 đòi hướng dẫn nghiên cứu sinh tử tế hơn."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "ESSAY",
            "instruction_de": "Schreiben Sie einen strukturierten Text (circa 230 Wörter).",
            "instruction_vi": "Viết bài luận có bố cục ~230 từ",
            "input_email": "Aufgabe: In einer Wissenschaftsbeilage erschien die These, Forschung solle sich stärker an unmittelbar nutzbaren Ergebnissen orientieren, da sie überwiegend aus Steuermitteln finanziert wird. Nehmen Sie dazu Stellung.\nHinweis: Beziehen Sie die Situation in Ihrem Heimatland ein und gehen Sie auf mindestens ein Gegenargument ein.",
            "writing_points": ["Einleitung: Problem und eigene These", "Argument eins mit Beleg oder Beispiel", "Argument zwei mit Bezug auf Ihr Heimatland", "Gegenargument aufgreifen und einordnen", "Schluss mit Folgerung oder Vorschlag"]
          },
          {
            "teil": 2,
            "type": "FORMAL_LETTER",
            "instruction_de": "Schreiben Sie ein formelles Schreiben (circa 120 Wörter).",
            "instruction_vi": "Viết thư trang trọng ~120 từ theo tình huống sau",
            "input_email": "Situation: Sie haben sich für ein Stipendium beworben und eine Absage erhalten, die keinerlei Begründung enthält. Sie möchten wissen, welche Kriterien angelegt wurden, und um eine Rückmeldung zu Ihrer Bewerbung bitten. Schreiben Sie an die Auswahlkommission, Frau Dr. Hoffmann.",
            "writing_points": ["Bezug auf Bewerbung und Absage herstellen", "Sachlich um Auskunft über die Kriterien bitten", "Um eine individuelle Rückmeldung ersuchen und begründen, warum sie Ihnen nützt", "Höflicher Schluss mit Frist"]
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
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie einen strukturierten Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày có cấu trúc ~4 phút",
            "prompt": "Thema: Wem gehört das Wissen? Öffentlich finanzierte Forschung und freier Zugang\nGliederung:\n1. Einstieg: Warum die Frage aktuell ist\n2. Zwei Positionen mit ihren stärksten Argumenten\n3. Lage in Ihrem Heimatland\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick: Was müsste sich ändern?"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner und einigen Sie sich auf eine Empfehlung.",
            "instruction_vi": "Thảo luận với bạn thi và cùng đưa ra khuyến nghị",
            "prompt": "Ausgangslage: Eine Hochschule erwägt, Forschungsdaten aller Projekte verpflichtend zu veröffentlichen.\nDiskutieren Sie: Welche Vorteile hätte das für die Qualitätssicherung? Welche Einwände sind berechtigt (Datenschutz, Wettbewerb, Aufwand)? Für welche Fächer ist die Regel geeignet? Welche Ausnahmen und welche Übergangsfrist schlagen Sie vor?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
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
  'C1', 'GOETHE',
  'Goethe-Zertifikat C1 – Set 2',
  'Đề thi thử Goethe C1 – Chủ đề: Thế giới lao động và tự động hoá',
  100, 60, 120,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einer Wirtschaftszeitung: Die Rückkehr der Aufgabe\nDie Debatte über Automatisierung leidet an einer begrifflichen Unschärfe. Diskutiert werden Berufe, automatisiert werden jedoch Aufgaben. Ein Beruf besteht aus einem Bündel von Tätigkeiten, von denen sich einige zuverlässig beschreiben und damit maschinell abbilden lassen, andere nicht. Dass ein Buchhaltungsprogramm Belege zuordnet, macht die Buchhalterin nicht überflüssig, verschiebt aber ihr Tätigkeitsprofil in Richtung Prüfung, Kommunikation und Ausnahmefälle. Empirisch zeigt sich denn auch kein Verschwinden der Arbeit, sondern eine Umverteilung, die keineswegs neutral ist: Betroffen sind vor allem mittlere Qualifikationen mit hohem Routineanteil, während Tätigkeiten an beiden Enden der Skala wachsen. Ökonomisch entsteht dadurch eine Polarisierung, die sich in Lohnstrukturen niederschlägt. Bemerkenswert ist zudem, wie stark institutionelle Rahmenbedingungen die Wirkung modifizieren. Wo Mitbestimmung existiert und Weiterbildung tariflich verankert ist, verlaufen Einführungsprozesse langsamer, aber mit deutlich geringeren Reibungsverlusten. Die häufig zitierte Prognose, ein bestimmter Prozentsatz der Arbeitsplätze falle binnen zweier Jahrzehnte weg, beruht überdies auf Berufsklassifikationen und überschätzt daher den Effekt systematisch. Wer die Debatte auf Zahlen dieser Art stützt, verwechselt technische Machbarkeit mit betrieblicher Umsetzung, die von Kosten, Recht und Akzeptanz abhängt.",
            "items": [
              {"id":"L1-1","question":"Worin sieht der Text die begriffliche Unschärfe der Debatte?","options":{"A":"Berufe werden diskutiert, automatisiert werden Aufgaben","B":"Es fehlen Statistiken","C":"Die Technik ist unbekannt"},"correct":"A","explanation_vi":"Diskutiert werden Berufe, automatisiert werden Aufgaben."},
              {"id":"L1-2","question":"Wie verändert sich das Profil der Buchhalterin?","options":{"A":"Es verschwindet","B":"Es verschiebt sich zu Prüfung und Ausnahmefällen","C":"Es bleibt identisch"},"correct":"B","explanation_vi":"Richtung Prüfung, Kommunikation und Ausnahmefälle."},
              {"id":"L1-3","question":"Welche Gruppe ist laut Text besonders betroffen?","options":{"A":"Hochqualifizierte","B":"Mittlere Qualifikationen mit hohem Routineanteil","C":"Nur Ungelernte"},"correct":"B","explanation_vi":"mittlere Qualifikationen mit hohem Routineanteil."},
              {"id":"L1-4","question":"Welche Rolle spielen institutionelle Rahmenbedingungen?","options":{"A":"Sie verändern Tempo und Reibungsverluste der Einführung","B":"Sie sind wirkungslos","C":"Sie verhindern Automatisierung vollständig"},"correct":"A","explanation_vi":"Langsamer nhưng ít xung đột hơn."},
              {"id":"L1-5","question":"Warum überschätzen die zitierten Prognosen den Effekt?","options":{"A":"Weil sie auf Berufsklassifikationen beruhen","B":"Weil sie zu neu sind","C":"Weil sie nur ein Land betrachten"},"correct":"A","explanation_vi":"beruht auf Berufsklassifikationen."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Kurztexte A bis E. Welcher Text passt zu welcher Aussage?",
            "instruction_vi": "Đọc 5 đoạn A–E và ghép với từng nhận định",
            "context": "A = Betriebsrat Sorge: Wir haben ausgehandelt, dass niemand wegen der neuen Anlage gekündigt wird. Erreicht haben wir das nur, weil wir früh am Tisch saßen, nicht als die Maschinen schon bestellt waren.\nB = Logistikleiterin Frenzel: Die Technik hat weniger gebracht als erhofft, weil unsere Daten schlecht gepflegt waren. Ein Jahr Aufräumen war die eigentliche Voraussetzung.\nC = Berufsberaterin Iversen: Umschulungen scheitern selten am Willen. Sie scheitern daran, dass Menschen mit Familie zwei Jahre ohne verlässliches Einkommen nicht überbrücken können.\nD = Unternehmer Kaymak: Für kleine Betriebe ist der Kauf gar nicht das Problem, sondern die Wartung. Wer keinen eigenen Techniker hat, wartet im Zweifel drei Tage auf den Dienstleister.\nE = Arbeitsforscherin Nowak: Auffällig ist, wie oft Beschäftigte Aufgaben übernehmen, die das System eigentlich erledigen sollte. Die Arbeit verschwindet nicht, sie wird unsichtbar.",
            "items": [
              {"id":"L2-1","person":"Diese Person betont die Bedeutung früher Beteiligung bei Investitionsentscheidungen.","question":"Welcher Text passt?","correct":"A","explanation_vi":"A nói phải tham gia sớm, trước khi mua máy."},
              {"id":"L2-2","person":"Diese Person nennt die Datenqualität als eigentliche Voraussetzung.","question":"Welcher Text passt?","correct":"B","explanation_vi":"B nói một năm dọn dữ liệu mới là điều kiện."},
              {"id":"L2-3","person":"Diese Person weist auf finanzielle Hürden bei Umschulungen hin.","question":"Welcher Text passt?","correct":"C","explanation_vi":"C nói về việc thiếu thu nhập trong hai năm."},
              {"id":"L2-4","person":"Diese Person spricht über Abhängigkeit von externen Dienstleistern.","question":"Welcher Text passt?","correct":"D","explanation_vi":"D nói về bảo trì và chờ dịch vụ."},
              {"id":"L2-5","person":"Diese Person beschreibt Arbeit, die nicht verschwindet, sondern unsichtbar wird.","question":"Welcher Text passt?","correct":"E","explanation_vi":"E: die Arbeit wird unsichtbar."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Podiumsdiskussion: Vier Tage, sechs Stunden oder gar keine feste Zeit?\nSoziologin Brandt: Die Verkürzung der Arbeitszeit hat historisch nie zu weniger Wohlstand geführt, sie wurde nur nie geschenkt, sondern erkämpft.\nUnternehmer Wolter: In meinem Betrieb funktioniert Vertrauensarbeitszeit gut, allerdings nur, weil wir Ergebnisse klar definieren. Ohne das entsteht ein Klima, in dem niemand mehr abschaltet.\nGewerkschafterin Yildiz: Vertrauensarbeitszeit ohne Erfassung ist die elegante Form der unbezahlten Überstunde. Ich sehe die Zahlen aus den Betrieben.\nArbeitsmediziner Petrov: Entscheidend ist weniger die Zahl der Stunden als ihre Lage. Wechselnde Schichten belasten nachweislich stärker als eine Stunde mehr am Tag.\nSoziologin Brandt: Dem widerspreche ich nicht, nur darf das nicht dazu dienen, die Debatte über Dauer zu ersetzen.",
            "items": [
              {"id":"L3-1","question":"Frau Brandt behauptet, Arbeitszeitverkürzung sei stets freiwillig gewährt worden.","correct":"falsch","explanation_vi":"Bà nói nó luôn phải đấu tranh mới có."},
              {"id":"L3-2","question":"Herr Wolter nennt klar definierte Ergebnisse als Bedingung.","correct":"richtig","explanation_vi":"nur, weil wir Ergebnisse klar definieren."},
              {"id":"L3-3","question":"Frau Yildiz hält Vertrauensarbeitszeit ohne Erfassung für unproblematisch.","correct":"falsch","explanation_vi":"Bà gọi đó là làm thêm giờ không công."},
              {"id":"L3-4","question":"Herr Petrov hält die Lage der Arbeitszeit für wichtiger als deren Umfang.","correct":"richtig","explanation_vi":"weniger die Zahl der Stunden als ihre Lage."},
              {"id":"L3-5","question":"Frau Brandt lehnt Petrovs Einschätzung vollständig ab.","correct":"falsch","explanation_vi":"Bà không phản đối, chỉ không muốn nó thay thế tranh luận về thời lượng."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Der Mythos vom Fachkräftemangel als Naturereignis\nWer den Mangel an Fachkräften wie ein Wetterphänomen behandelt, entzieht sich der Frage nach Ursachen. Zwar schrumpft die erwerbsfähige Bevölkerung, doch erklärt die Demografie nur einen Teil des Befunds. Auffällig ist, dass Engpässe in Branchen besonders ausgeprägt sind, in denen Belastung hoch und Planbarkeit gering ist. Dort verlassen Menschen den Beruf, obwohl sie ihn erlernt haben, was in keiner Statistik über fehlende Absolventen auftaucht. Hinzu kommt eine Rekrutierungspraxis, die Passung mit Perfektion verwechselt: Anforderungsprofile listen zehn Kriterien, von denen drei entscheidend wären. Wer zudem sechs Wochen bis zur ersten Rückmeldung braucht, verliert Bewerber an schnellere Konkurrenten. Bemerkenswert ist schließlich die geringe Bereitschaft, Qualifikationen anzuerkennen, die im Ausland erworben wurden. Solange Verfahren Monate dauern, ist der Mangel auch ein selbst erzeugter. Nichts davon macht die demografische Entwicklung ungeschehen, aber es verschiebt die Verantwortung: von einem Schicksal, das man beklagt, zu Entscheidungen, die man ändern kann.",
            "items": [
              {"id":"L4-1","question":"Was kritisiert der Autor an der verbreiteten Sichtweise?","options":{"A":"Sie behandelt den Mangel wie ein Naturereignis","B":"Sie übertreibt die Demografie nicht","C":"Sie nennt zu viele Ursachen"},"correct":"A","explanation_vi":"wie ein Wetterphänomen behandelt."},
              {"id":"L4-2","question":"Welcher Zusammenhang wird als auffällig beschrieben?","options":{"A":"Engpässe dort, wo Belastung hoch und Planbarkeit gering ist","B":"Engpässe nur in gut bezahlten Berufen","C":"Engpässe unabhängig von Arbeitsbedingungen"},"correct":"A","explanation_vi":"Belastung hoch und Planbarkeit gering."},
              {"id":"L4-3","question":"Was wirft er der Rekrutierungspraxis vor?","options":{"A":"Sie verwechselt Passung mit Perfektion","B":"Sie stellt zu wenige Anforderungen","C":"Sie antwortet zu schnell"},"correct":"A","explanation_vi":"Passung mit Perfektion verwechselt."},
              {"id":"L4-4","question":"Welche Folge hat eine späte Rückmeldung?","options":{"A":"Bewerber gehen zur Konkurrenz","B":"Bewerber warten geduldig","C":"Die Stellen werden gestrichen"},"correct":"A","explanation_vi":"verliert Bewerber an schnellere Konkurrenten."},
              {"id":"L4-5","question":"Welche Schlussfolgerung zieht der Autor?","options":{"A":"Der Mangel ist unabänderlich","B":"Ein Teil des Mangels beruht auf änderbaren Entscheidungen","C":"Die Demografie spielt keine Rolle"},"correct":"B","explanation_vi":"zu Entscheidungen, die man ändern kann."}
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
            "instruction_de": "Hören Sie die kurzen Beiträge und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Aus einer Betriebsversammlung: Die Geschäftsführung hält fest, dass die Einführung des Systems nicht mit Personalabbau verbunden ist. Zugleich weisen wir darauf hin, dass frei werdende Stellen im Bereich Datenerfassung zunächst nicht neu besetzt werden.","question":"Was folgt aus der Ansage?","options":{"A":"Es gibt Kündigungen","B":"Frei werdende Stellen bleiben zunächst unbesetzt","C":"Die Einführung wird gestoppt"},"correct":"B","explanation_vi":"Không sa thải nhưng không tuyển bù."},
              {"id":"H1-2","audio_script":"A: Sollen wir die Schulung vor oder nach dem Umstieg ansetzen? B: Vorher, sonst lernen die Leute die Fehler mit, die in den ersten Wochen entstehen. Das bekommt man später kaum wieder heraus.","question":"Was spricht für eine Schulung vorher?","options":{"A":"Sie ist billiger","B":"Sonst werden falsche Routinen eingeübt","C":"Sie ist gesetzlich vorgeschrieben"},"correct":"B","explanation_vi":"Học sau thì học luôn cả lỗi của giai đoạn đầu."},
              {"id":"H1-3","audio_script":"Hinweis der Personalabteilung: Anträge auf Bildungsurlaub müssen spätestens neun Wochen vor Beginn eingereicht werden. Kürzere Fristen können wir nur berücksichtigen, wenn die Vertretung bereits geklärt ist.","question":"Unter welcher Bedingung sind kürzere Fristen möglich?","options":{"A":"Wenn die Vertretung geklärt ist","B":"Wenn der Kurs kostenlos ist","C":"Nie"},"correct":"A","explanation_vi":"wenn die Vertretung bereits geklärt ist."},
              {"id":"H1-4","audio_script":"A: Wie bewertest du das Pilotprojekt? B: Die Zahlen sehen gut aus, allerdings hat das Team wochenlang unter Beobachtung gearbeitet. Ich würde erst nach dem regulären Betrieb urteilen.","question":"Warum ist die Sprecherin zurückhaltend?","options":{"A":"Weil die Zahlen schlecht sind","B":"Weil die Bedingungen im Pilotprojekt besonders waren","C":"Weil das Team zu klein war"},"correct":"B","explanation_vi":"Nhóm làm dưới sự quan sát nhiều tuần."},
              {"id":"H1-5","audio_script":"Aus einer Rede zur Übergabe: Ich übergebe die Abteilung in einem Zustand, den ich selbst nie vorgefunden habe. Wichtiger als die eingeführten Systeme ist mir, dass Widerspruch hier heute nicht mehr als Illoyalität gilt.","question":"Was ist der Rednerin am wichtigsten?","options":{"A":"Die eingeführten Systeme","B":"Dass Widerspruch möglich ist","C":"Die Zahl der Mitarbeitenden"},"correct":"B","explanation_vi":"Widerspruch không còn bị coi là bất trung."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết trình và chọn Richtig hoặc Falsch",
            "audio_script": "Guten Tag. Mein Thema ist die Einführung digitaler Systeme in Betrieben und die Frage, warum so viele Projekte scheitern, obwohl die Technik funktioniert. Erstens: Die meisten Vorhaben scheitern nicht an der Software, sondern an ungeklärten Prozessen. Wer einen unklaren Ablauf digitalisiert, erhält einen unklaren Ablauf, nur schneller. Zweitens beobachte ich eine systematische Unterschätzung des Aufwands für Datenpflege. Bei einem mittelständischen Kunden entfielen achtzig Prozent des Projektbudgets nicht auf Lizenzen, sondern auf die Bereinigung der Stammdaten. Drittens: Der verbreitete Ansatz, das System zuerst in der Zentrale einzuführen und dann auszurollen, funktioniert selten. Die Zentrale hat andere Abläufe als der Standort, und die Anpassungen kommen dann zu spät. Empfehlenswert ist ein Standort mittlerer Größe als Pilot. Viertens, und das wird Sie überraschen: Die Akzeptanz hängt weniger von Schulungen ab als davon, ob die Beschäftigten Einfluss auf die Gestaltung hatten. Wo Formulare gemeinsam entworfen wurden, sank die Zahl der Umgehungen deutlich. Fünftens rate ich davon ab, den alten Prozess sofort abzuschalten. Eine Übergangszeit kostet Geld, aber sie ist billiger als ein Rückbau unter Zeitdruck.",
            "items": [
              {"id":"H2-1","question":"Die meisten Projekte scheitern laut Vortrag an der Software.","correct":"falsch","explanation_vi":"Chúng thất bại vì quy trình chưa rõ ràng."},
              {"id":"H2-2","question":"Beim genannten Kunden entfiel der größte Teil des Budgets auf Datenbereinigung.","correct":"richtig","explanation_vi":"achtzig Prozent auf die Bereinigung der Stammdaten."},
              {"id":"H2-3","question":"Der Redner empfiehlt, zuerst in der Zentrale einzuführen.","correct":"falsch","explanation_vi":"Ông khuyên chọn một chi nhánh cỡ vừa làm thí điểm."},
              {"id":"H2-4","question":"Die Akzeptanz hängt vor allem von Beteiligung an der Gestaltung ab.","correct":"richtig","explanation_vi":"weniger von Schulungen als von Einfluss auf die Gestaltung."},
              {"id":"H2-5","question":"Er rät, den alten Prozess sofort abzuschalten.","correct":"falsch","explanation_vi":"Ông khuyên có giai đoạn chuyển tiếp."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderator: Frau Hübner, Sie haben Ihren Beruf mit 48 gewechselt. Hübner: Ja, von der Sachbearbeitung in die Pflege. Der Auslöser war nicht die Digitalisierung, sondern dass mir die Arbeit sinnlos vorkam. Moderator: Herr Ferreira, Sie beraten solche Wechsel. Ferreira: Was Frau Hübner beschreibt, höre ich häufig. Problematisch ist der Einkommensverlust in der Übergangszeit, den viele unterschätzen. Hübner: Bei mir waren es achtzehn Monate mit etwa der Hälfte des früheren Gehalts. Ohne Rücklagen wäre das unmöglich gewesen. Ferreira: Und genau deshalb bleibt der Wechsel ein Privileg. Wer Miete und Kinder allein trägt, kann sich das nicht leisten. Moderator: Was müsste sich ändern? Ferreira: Eine verlässliche Absicherung während der Umschulung, unabhängig davon, ob man vorher arbeitslos war. Hübner: Und weniger Misstrauen. Ich wurde in Gesprächen gefragt, warum ich mit fast fünfzig noch etwas Neues anfange.",
            "items": [
              {"id":"H3-1","question":"Was war für Frau Hübner der Auslöser?","options":{"A":"Die Digitalisierung ihres Arbeitsplatzes","B":"Das Gefühl, sinnlos zu arbeiten","C":"Eine Kündigung"},"correct":"B","explanation_vi":"dass mir die Arbeit sinnlos vorkam."},
              {"id":"H3-2","question":"Was unterschätzen viele laut Herrn Ferreira?","options":{"A":"Den Einkommensverlust in der Übergangszeit","B":"Die Dauer der Ausbildung","C":"Die Schwierigkeit der Prüfungen"},"correct":"A","explanation_vi":"Einkommensverlust in der Übergangszeit."},
              {"id":"H3-3","question":"Wie lange dauerte bei Frau Hübner die Übergangszeit?","options":{"A":"Sechs Monate","B":"Achtzehn Monate","C":"Drei Jahre"},"correct":"B","explanation_vi":"achtzehn Monate."},
              {"id":"H3-4","question":"Warum nennt Herr Ferreira den Wechsel ein Privileg?","options":{"A":"Weil er teuer ist und nicht alle ihn tragen können","B":"Weil er selten angeboten wird","C":"Weil er nur für Junge gilt"},"correct":"A","explanation_vi":"Người gánh tiền nhà và con cái một mình không kham nổi."},
              {"id":"H3-5","question":"Was wünscht sich Frau Hübner zusätzlich?","options":{"A":"Weniger Misstrauen gegenüber späten Wechseln","B":"Kürzere Ausbildungen","C":"Höhere Prüfungsgebühren"},"correct":"A","explanation_vi":"Bà bị hỏi vì sao gần 50 tuổi còn bắt đầu lại."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person hält die Erfassung von Leistungsdaten für einen Eingriff in die Privatsphäre.\nB = Diese Person berichtet, dass die Technik die eigene Arbeit interessanter gemacht hat.\nC = Diese Person kritisiert, dass Weiterbildung in der Freizeit erwartet wird.\nD = Diese Person betont die Verantwortung der Führungskräfte für gelingende Veränderung.\nE = Diese Person weist auf körperliche Entlastung durch neue Geräte hin.",
            "audio_script": "Sprecherin 1: Seit die Maschine die schweren Teile hebt, habe ich abends keine Rückenschmerzen mehr. Das klingt banal, war für mich aber entscheidend.\nSprecher 2: Ich musste die Routineauswertungen nicht mehr selbst machen und konnte endlich den Fragen nachgehen, die mich wirklich interessieren.\nSprecherin 3: Von uns wird verlangt, die Module abends und am Wochenende zu bearbeiten. Das ist Arbeit und gehört bezahlt.\nSprecher 4: Wenn die Leitung selbst nicht erklären kann, wozu das Ganze dient, wird kein Team es tragen. Das ist keine Frage der Software.\nSprecherin 5: Jede Pause, jeder Tastendruck wird protokolliert. Ich arbeite gern, aber ich möchte nicht permanent gemessen werden.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 1 nói máy nâng vật nặng giúp đỡ đau lưng."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 2 thấy công việc thú vị hơn."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 3 phản đối học ngoài giờ không lương."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 4 nhấn mạnh trách nhiệm của lãnh đạo."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 5 phản đối bị đo đếm liên tục."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "ESSAY",
            "instruction_de": "Schreiben Sie einen strukturierten Text (circa 230 Wörter).",
            "instruction_vi": "Viết bài luận có bố cục ~230 từ",
            "input_email": "Aufgabe: In einer Wirtschaftszeitschrift wurde gefordert, Unternehmen sollten gesetzlich verpflichtet werden, Beschäftigte vor jeder größeren Automatisierung umfassend weiterzubilden. Nehmen Sie dazu Stellung.\nHinweis: Berücksichtigen Sie die Lage in Ihrem Heimatland und gehen Sie auf mindestens ein Gegenargument ein.",
            "writing_points": ["Einleitung mit eigener These", "Argument eins mit Beispiel", "Argument zwei mit Bezug auf Ihr Heimatland", "Gegenargument aufgreifen und bewerten", "Schluss mit konkretem Vorschlag"]
          },
          {
            "teil": 2,
            "type": "FORMAL_LETTER",
            "instruction_de": "Schreiben Sie ein formelles Schreiben (circa 120 Wörter).",
            "instruction_vi": "Viết thư trang trọng ~120 từ theo tình huống sau",
            "input_email": "Situation: Ihr Arbeitgeber hat ein System eingeführt, das Arbeitsschritte einzeln protokolliert. Eine Information der Belegschaft fand nicht statt. Sie schreiben als Beschäftigte oder Beschäftigter an die Geschäftsleitung, Herrn Dr. Wendland.",
            "writing_points": ["Sachlich auf die Einführung und die fehlende Information Bezug nehmen", "Ihre Bedenken begründen", "Konkrete Fragen zu Zweck und Speicherdauer stellen", "Um eine Informationsveranstaltung bitten"]
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
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie einen strukturierten Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày có cấu trúc ~4 phút",
            "prompt": "Thema: Automatisierung — Wer trägt die Kosten des Wandels?\nGliederung:\n1. Einstieg: Warum die Frage jetzt gestellt wird\n2. Zwei Positionen mit ihren stärksten Argumenten\n3. Die Situation in Ihrem Heimatland\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick und Schluss"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner und einigen Sie sich auf eine Empfehlung.",
            "instruction_vi": "Thảo luận với bạn thi và cùng đưa ra khuyến nghị",
            "prompt": "Ausgangslage: Ein Betrieb plant, Bewerbungen künftig durch ein automatisiertes Verfahren vorzusortieren.\nDiskutieren Sie: Welche Effizienzgewinne sind zu erwarten? Welche Risiken bestehen (Verzerrung, Rechtslage, Akzeptanz)? Welche Kontrollen wären nötig? Welche Alternative schlagen Sie vor?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
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
  'C1', 'GOETHE',
  'Goethe-Zertifikat C1 – Set 3',
  'Đề thi thử Goethe C1 – Chủ đề: Văn hoá và truyền thông',
  100, 60, 120,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einem Kulturmagazin: Das Publikum, das man sich wünscht\nWenn Häuser über sinkende Besucherzahlen klagen, folgt meist der Ruf nach jüngerem Publikum. Selten wird gefragt, was dieser Wunsch eigentlich voraussetzt. Wer neue Gruppen erreichen will, muss damit rechnen, dass sie das Haus verändern, und zwar nicht nur im Programmheft. Studien zur Besucherforschung zeigen erstens, dass der Preis seltener die Hürde ist als angenommen; entscheidend sind Vertrautheit und die Gewissheit, sich nicht falsch zu verhalten. Zweitens erweist sich die verbreitete Strategie, einzelne Sonderformate für ein junges Publikum anzubieten, als kurzlebig: Wer nach der Veranstaltung wieder in den regulären Betrieb kommt, trifft auf dieselben Codes wie zuvor. Drittens, und das wird ungern gehört, hängt die Bindung stärker vom Personal an der Kasse ab als von der Auswahl der Stücke. Kritiker dieser Befunde warnen vor einer Anpassung, die künstlerische Ansprüche schleift. Doch der Einwand trifft nur eine schwache Form des Arguments. Es geht nicht darum, Werke zu vereinfachen, sondern darum, den Zugang zu ihnen nicht an eine Herkunft zu binden, die man entweder mitbringt oder nicht.",
            "items": [
              {"id":"L1-1","question":"Was setzt der Wunsch nach jüngerem Publikum laut Text voraus?","options":{"A":"Dass sich das Haus selbst verändert","B":"Dass die Preise steigen","C":"Dass das Programm gleich bleibt"},"correct":"A","explanation_vi":"Nhóm khán giả mới sẽ thay đổi chính nhà hát."},
              {"id":"L1-2","question":"Was ist laut Besucherforschung seltener die Hürde als angenommen?","options":{"A":"Der Preis","B":"Die Uhrzeit","C":"Die Entfernung"},"correct":"A","explanation_vi":"der Preis ist seltener die Hürde als angenommen."},
              {"id":"L1-3","question":"Warum sind Sonderformate laut Text kurzlebig?","options":{"A":"Weil sie zu teuer sind","B":"Weil der reguläre Betrieb unverändert bleibt","C":"Weil sie schlecht besucht sind"},"correct":"B","explanation_vi":"Quay lại chương trình thường lệ vẫn gặp đúng những mã cũ."},
              {"id":"L1-4","question":"Welcher Faktor wird als besonders wirksam genannt?","options":{"A":"Das Personal an der Kasse","B":"Die Auswahl der Stücke","C":"Die Größe des Saals"},"correct":"A","explanation_vi":"Bindung hängt stärker vom Personal an der Kasse ab."},
              {"id":"L1-5","question":"Wie bewertet der Autor den Einwand der Kritiker?","options":{"A":"Er trifft nur eine schwache Form des Arguments","B":"Er ist vollständig berechtigt","C":"Er ist unverständlich"},"correct":"A","explanation_vi":"Der Einwand trifft nur eine schwache Form des Arguments."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Kurztexte A bis E. Welcher Text passt zu welcher Aussage?",
            "instruction_vi": "Đọc 5 đoạn A–E và ghép với từng nhận định",
            "context": "A = Museumsleiterin Sattler: Wir haben die Texte an den Wänden halbiert und dafür Sitzgelegenheiten aufgestellt. Die Verweildauer ist gestiegen, was mir mehr sagt als jede Besucherzahl.\nB = Verleger Rombach: Der Markt zerfällt in wenige sehr große Titel und eine breite Mitte, die kaum noch trägt. Für Debüts bedeutet das: ohne Preis oder Skandal keine Sichtbarkeit.\nC = Musikerin Delgado: Die Einnahmen aus dem Streaming decken bei uns nicht einmal die Studiokosten. Wir leben von Konzerten, was bedeutet, dass wir schreiben, was sich live spielen lässt.\nD = Filmkritiker Ohara: Ich schreibe seit dreißig Jahren, und der größte Unterschied ist nicht das Internet, sondern die Geschwindigkeit. Ein Urteil, das drei Tage reift, kommt heute zu spät.\nE = Bibliothekarin Frei: Für viele ist unser Lesesaal der einzige warme Ort ohne Konsumzwang. Ob das noch Kulturarbeit ist, wird diskutiert, aber es ist die Realität.",
            "items": [
              {"id":"L2-1","person":"Diese Person beschreibt eine Funktion der Einrichtung, die über Kultur im engeren Sinn hinausgeht.","question":"Welcher Text passt?","correct":"E","explanation_vi":"E nói phòng đọc là nơi ấm áp không phải mua gì."},
              {"id":"L2-2","person":"Diese Person berichtet, dass die wirtschaftliche Lage die künstlerische Form beeinflusst.","question":"Welcher Text passt?","correct":"C","explanation_vi":"C viết nhạc sao cho chơi được live vì sống nhờ concert."},
              {"id":"L2-3","person":"Diese Person nennt Zeitdruck als wichtigste Veränderung ihres Berufs.","question":"Welcher Text passt?","correct":"D","explanation_vi":"D nói tốc độ là khác biệt lớn nhất."},
              {"id":"L2-4","person":"Diese Person misst Erfolg an etwas anderem als an der Zahl der Besuchenden.","question":"Welcher Text passt?","correct":"A","explanation_vi":"A đo bằng thời gian lưu lại."},
              {"id":"L2-5","person":"Diese Person beschreibt eine Spaltung des Marktes.","question":"Welcher Text passt?","correct":"B","explanation_vi":"B nói thị trường chia thành vài đầu sách lớn và phần giữa yếu."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Debatte: Soll der öffentlich-rechtliche Rundfunk verkleinert werden?\nMedienökonom Prantl: Die Frage ist falsch gestellt. Entscheidend ist nicht die Größe, sondern der Auftrag. Wer alles anbieten soll, kann nichts wirklich gut machen.\nRedakteurin Sahin: Ich arbeite dort und sehe die Doppelstrukturen selbst. Nur wird in der Debatte selten erwähnt, dass gerade die teuren Formate, etwa Recherchen über Monate, sonst niemand finanziert.\nZuschauervertreter Klose: Mich stört weniger der Umfang als die Selbstbezogenheit. Programmbeschwerden verschwinden in Gremien, deren Sitzungen kaum jemand nachvollziehen kann.\nMedienökonom Prantl: Da stimme ich zu, Transparenz wäre der billigste Reformschritt.\nMedienwissenschaftlerin Buschmann: Wer den Rundfunk verkleinert, sollte sagen, welche Regionen dann keine eigene Berichterstattung mehr haben. Diese Antwort bleibt regelmäßig aus.",
            "items": [
              {"id":"L3-1","question":"Herr Prantl hält die Größe für die entscheidende Frage.","correct":"falsch","explanation_vi":"Ông nói vấn đề là sứ mệnh, không phải quy mô."},
              {"id":"L3-2","question":"Frau Sahin bestreitet die Existenz von Doppelstrukturen.","correct":"falsch","explanation_vi":"Bà thừa nhận có, nhưng nhắc tới các format đắt đỏ."},
              {"id":"L3-3","question":"Herr Klose kritisiert vor allem die mangelnde Nachvollziehbarkeit der Gremien.","correct":"richtig","explanation_vi":"Khiếu nại biến mất trong các hội đồng khó theo dõi."},
              {"id":"L3-4","question":"Herr Prantl hält Transparenz für einen kostengünstigen Reformschritt.","correct":"richtig","explanation_vi":"Transparenz wäre der billigste Reformschritt."},
              {"id":"L3-5","question":"Frau Buschmann fordert eine Antwort zu den Folgen für die Regionen.","correct":"richtig","explanation_vi":"Bà hỏi vùng nào sẽ mất tin tức riêng."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Empfehlung ist auch eine Auswahl\nDass Algorithmen bestimmen, was wir sehen, gilt als neue Bedrohung der kulturellen Vielfalt. Historisch betrachtet ist die Sache verwickelter. Auch Programmdirektoren, Feuilletons und Buchhandlungen haben ausgewählt, nur waren ihre Kriterien angreifbar, weil sie an Personen hingen. Das Neue liegt weniger im Filtern als in seiner Unsichtbarkeit: Wer nie erfährt, was ihm nicht angezeigt wurde, kann die Auswahl nicht kritisieren. Hinzu kommt die Rückkopplung. Empfehlungen erzeugen Nachfrage, die wiederum als Beleg für die Richtigkeit der Empfehlung gilt. So entsteht ein Kreis, in dem Erfolg sich selbst bestätigt und Abweichung teuer wird. Wer dagegen nur auf Vielfaltsquoten setzt, verkennt das Problem: Eine breite Auswahl nützt wenig, wenn die Oberfläche drei Titel zeigt. Sinnvoller wäre, den Nutzerinnen Kontrolle über die Kriterien zu geben, etwa die Möglichkeit, Empfehlungen bewusst gegen das eigene Profil zu stellen. Das ist unbequem und wird selten gewählt, verändert aber die Machtfrage: Nicht mehr allein die Plattform entscheidet, was als naheliegend gilt.",
            "items": [
              {"id":"L4-1","question":"Wie ordnet der Autor die Auswahl durch Algorithmen historisch ein?","options":{"A":"Auswahl gab es auch früher, aber sie war angreifbar","B":"Früher gab es keine Auswahl","C":"Algorithmen wählen nicht aus"},"correct":"A","explanation_vi":"Trước đây cũng có chọn lọc, nhưng gắn với con người nên phê phán được."},
              {"id":"L4-2","question":"Worin liegt laut Text das eigentlich Neue?","options":{"A":"In der Geschwindigkeit","B":"In der Unsichtbarkeit des Filterns","C":"In der Zahl der Titel"},"correct":"B","explanation_vi":"weniger im Filtern als in seiner Unsichtbarkeit."},
              {"id":"L4-3","question":"Was beschreibt der Autor als Rückkopplung?","options":{"A":"Empfehlungen erzeugen Nachfrage, die sie bestätigt","B":"Nutzer beschweren sich","C":"Plattformen wechseln die Kriterien"},"correct":"A","explanation_vi":"Vòng lặp tự xác nhận."},
              {"id":"L4-4","question":"Warum genügen Vielfaltsquoten laut Text nicht?","options":{"A":"Weil die Oberfläche trotzdem wenige Titel zeigt","B":"Weil sie zu teuer sind","C":"Weil niemand sie kontrolliert"},"correct":"A","explanation_vi":"Có nhiều lựa chọn mà giao diện chỉ hiện ba tựa thì vô ích."},
              {"id":"L4-5","question":"Welchen Vorschlag macht der Autor?","options":{"A":"Nutzerkontrolle über die Kriterien","B":"Verbot von Empfehlungen","C":"Mehr Werbung für Nischentitel"},"correct":"A","explanation_vi":"Trao quyền kiểm soát tiêu chí cho người dùng."}
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
            "instruction_de": "Hören Sie die kurzen Beiträge und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Aus einer Ansage im Theater: Wegen einer kurzfristigen Erkrankung übernimmt heute Abend die Zweitbesetzung die Hauptrolle. Wer deshalb nicht bleiben möchte, kann die Karte an der Kasse zurückgeben, allerdings nur bis Vorstellungsbeginn.","question":"Was gilt für die Rückgabe?","options":{"A":"Nur bis Vorstellungsbeginn","B":"Bis zur Pause","C":"Bis zum Folgetag"},"correct":"A","explanation_vi":"nur bis Vorstellungsbeginn."},
              {"id":"H1-2","audio_script":"A: Wie fandest du die Ausstellung? B: Die Werke ja, die Hängung nein. Auf drei Metern Abstand kann man diese Bilder nicht wirken lassen, das ist eine Frage des Respekts vor der Arbeit.","question":"Was kritisiert die zweite Person?","options":{"A":"Die Auswahl der Werke","B":"Die Art der Präsentation","C":"Den Eintrittspreis"},"correct":"B","explanation_vi":"Cách treo tranh quá sát nhau."},
              {"id":"H1-3","audio_script":"Hinweis eines Verlags: Die Lesung findet nicht in der Buchhandlung, sondern im Saal der Volkshochschule statt. Der Grund ist die unerwartet hohe Zahl der Anmeldungen. Bereits gekaufte Karten behalten ihre Gültigkeit.","question":"Warum wird der Ort gewechselt?","options":{"A":"Wegen zu weniger Anmeldungen","B":"Wegen der hohen Zahl der Anmeldungen","C":"Wegen einer Renovierung"},"correct":"B","explanation_vi":"unerwartet hohe Zahl der Anmeldungen."},
              {"id":"H1-4","audio_script":"A: Sollen wir die Serie weiterschauen? B: Handwerklich ist sie gut gemacht, aber mir fehlt eine Figur, die etwas riskiert. Nach vier Folgen weiß ich immer noch nicht, worum es eigentlich geht.","question":"Was bemängelt die zweite Person?","options":{"A":"Die technische Qualität","B":"Das Fehlen von Figuren mit Risiko und einer klaren Frage","C":"Die Länge der Folgen"},"correct":"B","explanation_vi":"Thiếu nhân vật dám mạo hiểm và chưa rõ vấn đề."},
              {"id":"H1-5","audio_script":"Aus einer Preisrede: Ich nehme diesen Preis an, weise aber darauf hin, dass die Übersetzerin auf dem Umschlag nicht genannt wird. Ein Text in einer anderen Sprache ist nicht derselbe Text, er ist ein zweites Mal geschrieben worden.","question":"Worauf weist die Rednerin hin?","options":{"A":"Auf die fehlende Nennung der Übersetzerin","B":"Auf einen Fehler in der Jury","C":"Auf den zu geringen Preis"},"correct":"A","explanation_vi":"Người dịch không được ghi tên trên bìa."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết trình và chọn Richtig hoặc Falsch",
            "audio_script": "Willkommen zu meinem Vortrag über Erinnerungsorte. Ich beginne mit einer Selbstverständlichkeit, die es nicht ist: Denkmäler sagen mehr über die Zeit ihrer Errichtung als über das Ereignis, an das sie erinnern. Ein Standbild aus dem Jahr 1890 erzählt vor allem, wie man 1890 auf den Krieg blicken wollte. Daraus folgt zweitens, dass die Diskussion über Abriss oder Erhalt oft an der Sache vorbeigeht. Wer ein Denkmal entfernt, löscht auch den Beleg für eine Haltung, die es gegeben hat. Wer es unkommentiert stehen lässt, verlängert dagegen deren Anspruch in die Gegenwart. Ich plädiere daher für einen dritten Weg: Kontextualisierung, die den Ort nicht glättet. Drittens ein häufiger Einwand: Das koste Geld und bringe wenig, weil ohnehin niemand die Tafeln lese. Der Einwand stimmt empirisch teilweise, verkennt aber, dass es nicht nur um Belehrung geht, sondern um eine offizielle Stellungnahme der Gemeinschaft. Viertens und letztens: Erinnerung ist keine abgeschlossene Aufgabe. Jede Generation entscheidet neu, und dass diese Entscheidung strittig ist, gehört zum Gegenstand.",
            "items": [
              {"id":"H2-1","question":"Denkmäler sagen laut Vortrag vor allem etwas über die Zeit ihrer Errichtung.","correct":"richtig","explanation_vi":"Câu mở đầu của bài."},
              {"id":"H2-2","question":"Die Rednerin befürwortet den Abriss umstrittener Denkmäler.","correct":"falsch","explanation_vi":"Bà đề xuất con đường thứ ba: đặt vào bối cảnh."},
              {"id":"H2-3","question":"Unkommentiertes Stehenlassen verlängert laut Vortrag den Anspruch des Denkmals.","correct":"richtig","explanation_vi":"verlängert deren Anspruch in die Gegenwart."},
              {"id":"H2-4","question":"Sie hält den Einwand, niemand lese die Tafeln, für vollständig falsch.","correct":"falsch","explanation_vi":"Bà nói phần nào đúng về mặt thực nghiệm."},
              {"id":"H2-5","question":"Erinnerung ist laut Vortrag eine abgeschlossene Aufgabe.","correct":"falsch","explanation_vi":"Erinnerung ist keine abgeschlossene Aufgabe."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderatorin: Frau Bruns, Sie leiten ein kleines Kino. Bruns: Seit elf Jahren, und wir haben in dieser Zeit dreimal überlegt aufzugeben. Moderatorin: Was hat geholfen? Bruns: Nicht die Technik, sondern die Mitgliedschaft. Fünfhundert Menschen zahlen monatlich einen kleinen Beitrag und kommen dadurch häufiger. Herr Lehmann: Das ist der entscheidende Punkt. Als Verleiher sehe ich, dass Häuser mit Bindung Krisen überstehen und Häuser mit reinem Ticketverkauf nicht. Moderatorin: Wie steht es mit den Streaminganbietern? Bruns: Ehrlich gesagt schaden sie uns weniger als angenommen. Unser Problem sind die kurzen Auswertungsfenster, wenn ein Film nach sechs Wochen im Abo verfügbar ist. Lehmann: Da bin ich vorsichtiger. Für große Titel stimmt das, bei kleinen Filmen ist die Plattform oft die einzige Chance, überhaupt gesehen zu werden. Bruns: Was Sie nicht sagen: Sie verdienen daran mit.",
            "items": [
              {"id":"H3-1","question":"Was hat dem Kino laut Frau Bruns geholfen?","options":{"A":"Neue Technik","B":"Ein Mitgliedschaftsmodell","C":"Höhere Ticketpreise"},"correct":"B","explanation_vi":"Nicht die Technik, sondern die Mitgliedschaft."},
              {"id":"H3-2","question":"Was beobachtet Herr Lehmann?","options":{"A":"Häuser mit Bindung überstehen Krisen besser","B":"Alle Kinos schließen","C":"Ticketverkauf ist am stabilsten"},"correct":"A","explanation_vi":"Häuser mit Bindung überstehen Krisen."},
              {"id":"H3-3","question":"Worin sieht Frau Bruns das eigentliche Problem?","options":{"A":"In den kurzen Auswertungsfenstern","B":"In den Streaminganbietern allgemein","C":"In den Filmpreisen"},"correct":"A","explanation_vi":"Phim lên nền tảng chỉ sau sáu tuần."},
              {"id":"H3-4","question":"Wie beurteilt Herr Lehmann Plattformen für kleine Filme?","options":{"A":"Als einzige Chance, gesehen zu werden","B":"Als bedeutungslos","C":"Als schädlich"},"correct":"A","explanation_vi":"die einzige Chance, überhaupt gesehen zu werden."},
              {"id":"H3-5","question":"Was wirft Frau Bruns Herrn Lehmann am Ende vor?","options":{"A":"Dass er selbst an den Plattformen verdient","B":"Dass er das Kino nie besucht","C":"Dass er die Zahlen nicht kennt"},"correct":"A","explanation_vi":"Sie verdienen daran mit."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person hält Kulturförderung für zu stark auf große Häuser konzentriert.\nB = Diese Person spricht über die Bedeutung von Sprache und Übersetzung.\nC = Diese Person beschreibt, wie sie ihr Publikum durch Beteiligung gewonnen hat.\nD = Diese Person kritisiert die Erwartung, Kunst müsse sich rechnen.\nE = Diese Person berichtet von der Schwierigkeit, von künstlerischer Arbeit zu leben.",
            "audio_script": "Sprecherin 1: Wir haben Jugendliche das Programm mitgestalten lassen, nicht als Projekt, sondern mit Stimmrecht. Seitdem füllen sich die Reihen.\nSprecher 2: Vier von fünf Kolleginnen haben einen Zweitjob. Von Auftritten allein lebt fast niemand, das gehört zur Wahrheit dieses Berufs.\nSprecherin 3: Solange achtzig Prozent der Mittel in drei Institutionen fließen, ist die Debatte über freie Szene eine Nebendebatte.\nSprecher 4: Ein Roman ist kein Produkt, das sich amortisieren muss. Diese Sprache hat sich eingeschlichen und verändert, was überhaupt geschrieben wird.\nSprecherin 5: Ohne Übersetzungen bliebe die halbe Welt für uns stumm. Trotzdem stehen die Namen der Übersetzenden selten auf dem Umschlag.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 1 cho khán giả trẻ tham gia quyết định chương trình."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 2 nói nghệ sĩ phải làm thêm việc khác."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 3 phê phán tiền dồn vào ba định chế lớn."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 4 phản đối đòi hỏi nghệ thuật phải sinh lời."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 5 nói về dịch thuật."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "ESSAY",
            "instruction_de": "Schreiben Sie einen strukturierten Text (circa 230 Wörter).",
            "instruction_vi": "Viết bài luận có bố cục ~230 từ",
            "input_email": "Aufgabe: In einer Zeitungsdebatte wurde gefordert, öffentliche Kulturförderung solle künftig an Besucherzahlen gekoppelt werden. Nehmen Sie dazu Stellung.\nHinweis: Beziehen Sie die Situation in Ihrem Heimatland ein und gehen Sie auf mindestens ein Gegenargument ein.",
            "writing_points": ["Einleitung mit eigener These", "Argument eins mit Beispiel", "Argument zwei mit Bezug auf Ihr Heimatland", "Ein Gegenargument aufgreifen und einordnen", "Schluss mit Folgerung"]
          },
          {
            "teil": 2,
            "type": "FORMAL_LETTER",
            "instruction_de": "Schreiben Sie ein formelles Schreiben (circa 120 Wörter).",
            "instruction_vi": "Viết thư trang trọng ~120 từ theo tình huống sau",
            "input_email": "Situation: Sie haben für eine Kulturzeitschrift einen bestellten Beitrag geschrieben. Der Text wurde ohne Rücksprache stark gekürzt und mit einer Überschrift versehen, die Ihre Aussage verändert. Schreiben Sie an die Redaktionsleitung, Herrn Ferner.",
            "writing_points": ["Beitrag und Vereinbarung benennen", "Die Eingriffe sachlich beschreiben", "Erläutern, warum die Überschrift Ihre Aussage verändert", "Eine konkrete Korrektur oder Klarstellung erbitten"]
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
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie einen strukturierten Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày có cấu trúc ~4 phút",
            "prompt": "Thema: Braucht eine Gesellschaft öffentlich finanzierte Kultur?\nGliederung:\n1. Einstieg: Warum die Frage gestellt wird\n2. Zwei Positionen mit ihren stärksten Argumenten\n3. Die Lage in Ihrem Heimatland\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick und Schluss"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner und einigen Sie sich auf eine Empfehlung.",
            "instruction_vi": "Thảo luận với bạn thi và cùng đưa ra khuyến nghị",
            "prompt": "Ausgangslage: Eine Stadt erwägt, den Eintritt in alle städtischen Museen dauerhaft frei zu machen und dafür Sonderausstellungen zu streichen.\nDiskutieren Sie: Wer profitiert von freiem Eintritt? Welche Rolle spielen Sonderausstellungen für Finanzierung und Aufmerksamkeit? Welche Alternativen gibt es (Zeitfenster, Ermäßigungen)? Welche Lösung empfehlen Sie?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
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
  'C1', 'GOETHE',
  'Goethe-Zertifikat C1 – Set 4',
  'Đề thi thử Goethe C1 – Chủ đề: Di cư và xã hội',
  100, 60, 120,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einer Wochenzeitung: Sprache als Bedingung und als Folge\nIn kaum einer Debatte wird so beharrlich Ursache mit Wirkung verwechselt wie in der über Sprache und Zugehörigkeit. Dass Sprachkenntnisse den Zugang zum Arbeitsmarkt erleichtern, ist unbestritten. Weniger beachtet wird die umgekehrte Richtung: Wer arbeitet, lernt schneller, weil er die Sprache täglich benötigt und nicht nur übt. Programme, die Beschäftigung erst nach dem Nachweis eines bestimmten Niveaus erlauben, verlängern daher genau den Zustand, den sie beenden wollen. Hinzu kommt ein methodisches Problem: Sprachstandserhebungen messen häufig schulische Formen, während im Betrieb andere Fähigkeiten zählen, etwa Rückfragen zu stellen oder eine Anweisung zu wiederholen. Es gibt Betriebe, die das erkannt haben und Sprachbegleitung in den Arbeitsalltag integrieren; die Ergebnisse sind besser als die klassischer Kurse, allerdings nur, wenn die Begleitung nicht als Belohnung für Wohlverhalten vergeben wird. Kritiker warnen, ein solcher Ansatz senke Standards. Diese Sorge verkennt, dass Standards nicht dadurch steigen, dass man den Zugang verengt. Sie steigen, wenn mehr Menschen die Gelegenheit erhalten, die Sprache dort zu gebrauchen, wo sie gebraucht wird.",
            "items": [
              {"id":"L1-1","question":"Welche Verwechslung kritisiert der Text?","options":{"A":"Ursache und Wirkung bei Sprache und Arbeit","B":"Schule und Betrieb","C":"Sprache und Dialekt"},"correct":"A","explanation_vi":"Bài phê phán việc lẫn lộn nhân với quả."},
              {"id":"L1-2","question":"Welche Wirkung hat Arbeit laut Text auf den Spracherwerb?","options":{"A":"Sie verlangsamt ihn","B":"Sie beschleunigt ihn","C":"Sie hat keinen Einfluss"},"correct":"B","explanation_vi":"Wer arbeitet, lernt schneller."},
              {"id":"L1-3","question":"Was wird an Sprachstandserhebungen bemängelt?","options":{"A":"Sie messen häufig schulische Formen","B":"Sie sind zu kurz","C":"Sie sind zu teuer"},"correct":"A","explanation_vi":"Đo hình thức trường lớp thay vì kỹ năng nơi làm việc."},
              {"id":"L1-4","question":"Unter welcher Bedingung wirkt Sprachbegleitung im Betrieb gut?","options":{"A":"Wenn sie nicht als Belohnung vergeben wird","B":"Wenn sie freiwillig ist","C":"Wenn sie abends stattfindet"},"correct":"A","explanation_vi":"nicht als Belohnung für Wohlverhalten."},
              {"id":"L1-5","question":"Wie antwortet der Text auf die Sorge sinkender Standards?","options":{"A":"Standards steigen nicht durch Verengung des Zugangs","B":"Standards sind unwichtig","C":"Standards sollten abgeschafft werden"},"correct":"A","explanation_vi":"Câu cuối bài trả lời chính xác điều này."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Kurztexte A bis E. Welcher Text passt zu welcher Aussage?",
            "instruction_vi": "Đọc 5 đoạn A–E và ghép với từng nhận định",
            "context": "A = Verwaltungsleiterin Mahler: Unsere Verfahren dauern nicht deshalb lange, weil die Vorschriften kompliziert wären, sondern weil dieselben Unterlagen in drei Ämtern getrennt geprüft werden.\nB = Ärztin Kowalczyk: Bis meine Approbation anerkannt war, habe ich zwei Jahre als Assistenz gearbeitet, für einen Bruchteil des Gehalts. Fachlich habe ich in dieser Zeit nichts dazugelernt.\nC = Lehrer Baruah: Meine Schülerinnen sprechen zu Hause drei Sprachen und gelten trotzdem als sprachschwach, weil nur eine davon zählt.\nD = Unternehmerin Sokolova: Ich stelle seit Jahren Geflüchtete ein. Der größte Hemmschuh ist nicht die Sprache, sondern die Unsicherheit über den Aufenthaltsstatus, die auch mich als Arbeitgeberin trifft.\nE = Stadtplaner Vogt: Wo Menschen mit geringem Einkommen nur in zwei Vierteln eine Wohnung finden, entsteht Konzentration nicht aus Wunsch, sondern aus Preisen.",
            "items": [
              {"id":"L2-1","person":"Diese Person führt räumliche Konzentration auf den Wohnungsmarkt zurück.","question":"Welcher Text passt?","correct":"E","explanation_vi":"E nói do giá thuê chứ không do mong muốn."},
              {"id":"L2-2","person":"Diese Person beschreibt fachlichen Stillstand während eines Anerkennungsverfahrens.","question":"Welcher Text passt?","correct":"B","explanation_vi":"B nói hai năm không học được gì về chuyên môn."},
              {"id":"L2-3","person":"Diese Person nennt Doppelprüfungen als Ursache langer Verfahren.","question":"Welcher Text passt?","correct":"A","explanation_vi":"A nói ba cơ quan kiểm tra cùng bộ hồ sơ."},
              {"id":"L2-4","person":"Diese Person kritisiert, dass mehrsprachige Kinder als sprachschwach gelten.","question":"Welcher Text passt?","correct":"C","explanation_vi":"C nói chỉ một ngôn ngữ được tính."},
              {"id":"L2-5","person":"Diese Person nennt Rechtsunsicherheit als größtes Einstellungshindernis.","question":"Welcher Text passt?","correct":"D","explanation_vi":"D nói tình trạng cư trú bấp bênh."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Diskussion: Wie viel Herkunft gehört in die Statistik?\nSozialforscherin Adam: Ohne Daten über Herkunft können wir Benachteiligung nicht nachweisen. Wer sie nicht erhebt, schützt nicht die Betroffenen, sondern die Verhältnisse.\nDatenschützer Böhm: Ich teile das Ziel, warne aber vor der Sammlung. Einmal erhoben, lassen sich solche Merkmale auch anders verwenden, als es heute gedacht ist.\nJournalistin Chowdhury: In der Berichterstattung sehe ich das Gegenteil des Problems: Herkunft wird genannt, wo sie nichts erklärt, und weggelassen, wo sie etwas erklären würde.\nSozialforscherin Adam: Deshalb plädiere ich für Zweckbindung und aggregierte Auswertung, nicht für Verzicht.\nVerwaltungsjurist Erdogan: Praktisch scheitert vieles an etwas Einfachem: Die Kategorien passen nicht. Wer in dritter Generation hier lebt, taucht in denselben Zahlen auf wie ein Neuzugewanderter.",
            "items": [
              {"id":"L3-1","question":"Frau Adam hält die Erhebung von Herkunftsdaten für notwendig.","correct":"richtig","explanation_vi":"Không có dữ liệu thì không chứng minh được bất bình đẳng."},
              {"id":"L3-2","question":"Herr Böhm lehnt das Ziel von Frau Adam ab.","correct":"falsch","explanation_vi":"Ông chia sẻ mục tiêu, chỉ cảnh báo về việc thu thập."},
              {"id":"L3-3","question":"Frau Chowdhury kritisiert eine unsystematische Nennung der Herkunft in Medien.","correct":"richtig","explanation_vi":"Nêu chỗ không cần và bỏ chỗ cần."},
              {"id":"L3-4","question":"Frau Adam fordert den vollständigen Verzicht auf solche Daten.","correct":"falsch","explanation_vi":"Bà đòi ràng buộc mục đích, không phải bỏ hẳn."},
              {"id":"L3-5","question":"Herr Erdogan bemängelt die Passgenauigkeit der Kategorien.","correct":"richtig","explanation_vi":"Die Kategorien passen nicht."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Integration ist keine Prüfung, die man besteht\nDer Begriff suggeriert einen Zustand, den man erreicht und danach hinter sich lässt. Genau darin liegt sein Fehler. Wer eine Sprache lernt, eine Arbeit findet und Nachbarn grüßt, hat nicht etwas abgeschlossen, sondern begonnen, am gewöhnlichen Leben teilzunehmen, das für alle Beteiligten unabgeschlossen bleibt. Die Vorstellung einer Prüfung erzeugt zudem eine Asymmetrie: Die einen bestehen, die anderen bewerten. Aufschlussreich ist, wie selten in diesen Debatten von der Seite der Aufnahmegesellschaft die Rede ist, etwa von der Frage, ob Vereine, Behörden und Betriebe auf neue Mitglieder eingerichtet sind. Nichts davon spricht gegen Erwartungen. Eine Gesellschaft darf verlangen, dass ihre Regeln gelten, und sie muss deutlich sagen, welche das sind. Der Unterschied liegt darin, ob Erwartungen an Personen gerichtet werden, die man dabei unterstützt, oder an Personen, deren Scheitern man einkalkuliert. Wer den zweiten Weg wählt, wird recht behalten, allerdings um einen Preis, den am Ende alle zahlen.",
            "items": [
              {"id":"L4-1","question":"Was kritisiert der Autor am Begriff Integration?","options":{"A":"Er suggeriert einen abgeschlossenen Zustand","B":"Er ist zu neu","C":"Er wird nur in Behörden verwendet"},"correct":"A","explanation_vi":"suggeriert einen Zustand, den man erreicht."},
              {"id":"L4-2","question":"Welche Asymmetrie beschreibt der Text?","options":{"A":"Die einen bestehen, die anderen bewerten","B":"Die einen zahlen, die anderen sparen","C":"Die einen arbeiten, die anderen studieren"},"correct":"A","explanation_vi":"Câu trong bài nói đúng như vậy."},
              {"id":"L4-3","question":"Was fehlt laut Autor in der Debatte?","options":{"A":"Die Seite der Aufnahmegesellschaft","B":"Die Sprachkurse","C":"Die Statistik"},"correct":"A","explanation_vi":"selten von der Seite der Aufnahmegesellschaft die Rede."},
              {"id":"L4-4","question":"Wie steht der Autor zu Erwartungen an Zugewanderte?","options":{"A":"Er hält sie für legitim","B":"Er lehnt sie ab","C":"Er hält sie für unwichtig"},"correct":"A","explanation_vi":"Nichts davon spricht gegen Erwartungen."},
              {"id":"L4-5","question":"Worin liegt für ihn der entscheidende Unterschied?","options":{"A":"Ob Erwartungen mit Unterstützung verbunden sind","B":"Ob sie schriftlich vorliegen","C":"Ob sie oft wiederholt werden"},"correct":"A","explanation_vi":"Kỳ vọng kèm hỗ trợ so với kỳ vọng đã tính trước thất bại."}
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
            "instruction_de": "Hören Sie die kurzen Beiträge und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Aus einer Behördeninformation: Termine zur Anerkennung ausländischer Abschlüsse werden ab sofort nur noch online vergeben. Wer keinen Zugang hat, kann sich weiterhin telefonisch melden, allerdings ausschließlich dienstags zwischen 9 und 12 Uhr.","question":"Was gilt für Personen ohne Internetzugang?","options":{"A":"Sie bekommen keinen Termin","B":"Sie können dienstags vormittags anrufen","C":"Sie müssen persönlich erscheinen"},"correct":"B","explanation_vi":"telefonisch, dienstags 9–12 Uhr."},
              {"id":"H1-2","audio_script":"A: Und, hat die Wohnungsbesichtigung geklappt? B: Wir waren zu fünfzehnt dort. Am Ende hat die Maklerin gesagt, sie nehme lieber jemanden mit unbefristetem Vertrag. Beweisen kann ich nichts.","question":"Was beschreibt die zweite Person?","options":{"A":"Eine erfolgreiche Besichtigung","B":"Eine mutmaßliche Benachteiligung, die schwer nachweisbar ist","C":"Eine zu teure Wohnung"},"correct":"B","explanation_vi":"Bị loại nhưng không chứng minh được."},
              {"id":"H1-3","audio_script":"Hinweis eines Vereins: Für unsere Hausaufgabenhilfe suchen wir Freiwillige, die mindestens ein halbes Jahr bleiben können. Kurzfristige Einsätze helfen den Kindern nicht, weil jede neue Person Vertrauen aufbauen muss.","question":"Warum werden längere Einsätze gewünscht?","options":{"A":"Weil Vertrauen Zeit braucht","B":"Weil die Schulung teuer ist","C":"Weil es zu wenige Freiwillige gibt"},"correct":"A","explanation_vi":"Mỗi người mới phải xây lại niềm tin."},
              {"id":"H1-4","audio_script":"A: Wie war der Sprachkurs? B: Der Unterricht gut, die Organisation nicht. Ich habe vier Monate auf einen Platz gewartet und in dieser Zeit fast alles wieder vergessen.","question":"Was kritisiert die zweite Person?","options":{"A":"Die Qualität des Unterrichts","B":"Die Wartezeit auf einen Kursplatz","C":"Die Kosten des Kurses"},"correct":"B","explanation_vi":"vier Monate auf einen Platz gewartet."},
              {"id":"H1-5","audio_script":"Aus einer Rede im Stadtrat: Wir beschließen heute nicht über Zahlen, sondern über die Frage, ob Menschen, die seit acht Jahren hier zur Schule gehen, weiterhin jedes Jahr um ihre Papiere bangen sollen.","question":"Worum geht es der Rednerin?","options":{"A":"Um die Aufenthaltssicherheit langjährig Ansässiger","B":"Um den Schulbau","C":"Um die Höhe der Gebühren"},"correct":"A","explanation_vi":"Về việc năm nào cũng lo giấy tờ."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết trình và chọn Richtig hoặc Falsch",
            "audio_script": "Guten Abend. Ich spreche über Nachbarschaft und darüber, was Zusammenleben tatsächlich beeinflusst. Zunächst eine Feststellung, die vielen nicht gefällt: Kontakt allein erzeugt keine Verständigung. Wo Menschen unter Druck stehen, etwa um knappe Kita-Plätze konkurrieren, verstärkt Nähe eher die Abgrenzung. Entscheidend ist, ob Begegnung mit einer gemeinsamen Aufgabe verbunden ist. Ein Sportverein, ein Hausprojekt, eine Elterninitiative schaffen genau das, ein Nachbarschaftsfest allein nicht. Zweitens: Der häufig zitierte Zusammenhang zwischen Vielfalt und geringem Vertrauen hält einer genaueren Prüfung nur teilweise stand. Kontrolliert man für Einkommen und Wohndauer, schrumpft der Effekt erheblich. Was bleibt, ist vor allem ein Befund über Armut, nicht über Herkunft. Drittens ein praktischer Punkt: Institutionen sind wichtiger als Programme. Eine verlässliche Schule, eine erreichbare Beratungsstelle und ein funktionierender Hausmeister leisten mehr als jede Kampagne. Und viertens: Konflikte sind nicht das Gegenteil von gelungenem Zusammenleben. Entscheidend ist, ob es Verfahren gibt, sie auszutragen, ohne dass gleich die Zugehörigkeit infrage steht.",
            "items": [
              {"id":"H2-1","question":"Kontakt allein führt laut Vortrag zu Verständigung.","correct":"falsch","explanation_vi":"Kontakt allein erzeugt keine Verständigung."},
              {"id":"H2-2","question":"Eine gemeinsame Aufgabe ist laut Rednerin entscheidend.","correct":"richtig","explanation_vi":"Begegnung verbunden mit gemeinsamer Aufgabe."},
              {"id":"H2-3","question":"Der Zusammenhang zwischen Vielfalt und Vertrauen bleibt nach Kontrolle für Einkommen unverändert.","correct":"falsch","explanation_vi":"Hiệu ứng giảm mạnh."},
              {"id":"H2-4","question":"Institutionen sind laut Vortrag wichtiger als Programme.","correct":"richtig","explanation_vi":"Institutionen sind wichtiger als Programme."},
              {"id":"H2-5","question":"Konflikte gelten im Vortrag als Zeichen des Scheiterns.","correct":"falsch","explanation_vi":"Xung đột không phải điều ngược lại của chung sống tốt."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderatorin: Herr Nazari, Sie sind vor neun Jahren gekommen und führen heute einen Betrieb mit vierzehn Beschäftigten. Nazari: Ja, aber der Weg war anders, als man ihn erzählt. Am Anfang durfte ich zwei Jahre nicht arbeiten. Moderatorin: Frau Reimers, Sie beraten Gründerinnen und Gründer. Reimers: Diese Zeit ist der eigentliche Verlust. Menschen kommen mit Qualifikation und verlieren sie im Wartezimmer. Nazari: Geholfen hat mir kein Programm, sondern ein Meister, der mich trotz fehlender Papiere hospitieren ließ. Reimers: Das höre ich oft, und es ist zugleich das Problem: Es hängt an Einzelnen. Moderatorin: Was würden Sie ändern? Nazari: Die Sprache der Formulare. Ich habe drei Anträge falsch ausgefüllt, nicht weil ich sie nicht verstand, sondern weil ich die Logik dahinter nicht kannte. Reimers: Und ich würde Bürgschaften erleichtern. Ohne Sicherheiten gibt es keinen Kredit, und ohne Kredit keinen Betrieb.",
            "items": [
              {"id":"H3-1","question":"Was war für Herrn Nazari die größte Hürde am Anfang?","options":{"A":"Das zweijährige Arbeitsverbot","B":"Die fehlende Ausbildung","C":"Die hohen Mieten"},"correct":"A","explanation_vi":"zwei Jahre nicht arbeiten dürfen."},
              {"id":"H3-2","question":"Wie bewertet Frau Reimers diese Wartezeit?","options":{"A":"Als eigentlichen Verlust","B":"Als notwendige Prüfung","C":"Als kurze Phase"},"correct":"A","explanation_vi":"Diese Zeit ist der eigentliche Verlust."},
              {"id":"H3-3","question":"Wer hat Herrn Nazari konkret geholfen?","options":{"A":"Ein staatliches Programm","B":"Ein Meister, der ihn hospitieren ließ","C":"Eine Bank"},"correct":"B","explanation_vi":"kein Programm, sondern ein Meister."},
              {"id":"H3-4","question":"Warum ist das für Frau Reimers zugleich ein Problem?","options":{"A":"Weil es von Einzelnen abhängt","B":"Weil es zu teuer ist","C":"Weil es verboten ist"},"correct":"A","explanation_vi":"Es hängt an Einzelnen."},
              {"id":"H3-5","question":"Was würde Frau Reimers ändern?","options":{"A":"Die Sprache der Formulare","B":"Den Zugang zu Bürgschaften","C":"Die Öffnungszeiten der Ämter"},"correct":"B","explanation_vi":"ich würde Bürgschaften erleichtern."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person spricht über den Verlust beruflicher Identität.\nB = Diese Person betont die Rolle der Schule für Kinder.\nC = Diese Person kritisiert die Sprache in Behördenschreiben.\nD = Diese Person berichtet von Unterstützung durch Nachbarn.\nE = Diese Person weist auf die Situation älterer Zugewanderter hin.",
            "audio_script": "Sprecherin 1: In meinem Land war ich Ingenieurin. Hier war ich vier Jahre Küchenhilfe. Man verliert nicht nur Geld, man verliert, wer man beruflich war.\nSprecher 2: Als wir ankamen, hat die Familie im Erdgeschoss uns die ersten Wochen einfach mitversorgt, ohne Fragen. Das vergesse ich nicht.\nSprecherin 3: Meine Mutter ist mit 62 gekommen. Für sie gibt es nichts: keinen Kurs, der zu ihr passt, und keine Aussicht auf Arbeit.\nSprecher 4: Ich verstehe jedes Wort in diesen Briefen und trotzdem nicht, was ich tun soll. Das ist keine Frage der Sprachkenntnisse.\nSprecherin 5: Meine Tochter hat die Sprache in der Grundschule gelernt, und zwar nicht im Förderunterricht, sondern auf dem Schulhof.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 1 nói về mất bản sắc nghề nghiệp."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 2 kể hàng xóm giúp đỡ."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 3 nói về mẹ 62 tuổi."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 4 phê phán văn phong công văn."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 5 nói con học tiếng ở trường."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "ESSAY",
            "instruction_de": "Schreiben Sie einen strukturierten Text (circa 230 Wörter).",
            "instruction_vi": "Viết bài luận có bố cục ~230 từ",
            "input_email": "Aufgabe: In einer Zeitungsdebatte wurde vorgeschlagen, den Zugang zum Arbeitsmarkt unabhängig vom Nachweis eines bestimmten Sprachniveaus zu öffnen und die Sprachförderung stattdessen in die Betriebe zu verlagern. Nehmen Sie dazu Stellung.\nHinweis: Beziehen Sie die Situation in Ihrem Heimatland ein und gehen Sie auf mindestens ein Gegenargument ein.",
            "writing_points": ["Einleitung mit eigener These", "Argument eins mit Beispiel", "Argument zwei mit Bezug auf Ihr Heimatland", "Gegenargument aufgreifen und einordnen", "Schluss mit konkretem Vorschlag"]
          },
          {
            "teil": 2,
            "type": "FORMAL_LETTER",
            "instruction_de": "Schreiben Sie ein formelles Schreiben (circa 120 Wörter).",
            "instruction_vi": "Viết thư trang trọng ~120 từ theo tình huống sau",
            "input_email": "Situation: Sie unterstützen eine befreundete Familie bei einem Antrag. Die Behörde hat den Antrag wegen angeblich fehlender Unterlagen abgelehnt, obwohl diese nachweislich eingereicht wurden. Schreiben Sie an das zuständige Amt, Frau Krüger.",
            "writing_points": ["Vorgang und Aktenzeichen benennen", "Die Einreichung der Unterlagen belegen", "Um Überprüfung der Entscheidung bitten", "Um schriftliche Rückmeldung innerhalb einer Frist bitten"]
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
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie einen strukturierten Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày có cấu trúc ~4 phút",
            "prompt": "Thema: Was macht eine Gesellschaft aufnahmefähig?\nGliederung:\n1. Einstieg: Warum die Frage wichtig ist\n2. Zwei Positionen mit ihren stärksten Argumenten\n3. Erfahrungen aus Ihrem Heimatland\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick und Schluss"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner und einigen Sie sich auf eine Empfehlung.",
            "instruction_vi": "Thảo luận với bạn thi và cùng đưa ra khuyến nghị",
            "prompt": "Ausgangslage: Eine Stadt will alle Formulare in einfacher Sprache anbieten und dafür Stellen in der Beratung streichen.\nDiskutieren Sie: Wem nützt einfache Sprache? Welche Aufgaben kann ein Formular nicht übernehmen? Wer wäre von der Streichung betroffen? Welche Lösung empfehlen Sie?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
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
  'C1', 'GOETHE',
  'Goethe-Zertifikat C1 – Set 5',
  'Đề thi thử Goethe C1 – Chủ đề: Môi trường và phát triển bền vững',
  100, 60, 120,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einer Fachzeitschrift: Die Grenzen der individuellen Verantwortung\nDie Frage, ob der Einzelne oder die Politik für den Klimaschutz zuständig sei, ist so beliebt wie unfruchtbar. Sie unterstellt eine Alternative, wo eine Wechselwirkung besteht. Individuelles Verhalten ist nicht folgenlos, aber es ist in hohem Maß vorstrukturiert: Wer in einem Ort ohne Bahnanschluss wohnt, entscheidet sich nicht frei für das Auto. Untersuchungen zur Wirksamkeit von Appellen zeigen entsprechend geringe und meist kurzlebige Effekte, sofern nicht gleichzeitig die Rahmenbedingungen verändert werden. Bemerkenswert ist ein zweiter Befund: Die Betonung persönlicher Verantwortung senkt in Experimenten die Zustimmung zu politischen Maßnahmen, weil sie das Problem als Summe privater Entscheidungen erscheinen lässt. Wer also mit dem Verweis auf den eigenen Fußabdruck argumentiert, kann ungewollt die Regelungen schwächen, die er befürwortet. Daraus folgt nicht, dass Verhalten belanglos wäre. Frühe Anwender neuer Technologien senken deren Kosten und verändern, was als normal gilt; dieser Effekt ist gut belegt. Der entscheidende Punkt ist die Reihenfolge der Argumente: Verhalten wirkt vor allem dann, wenn es als Vorwegnahme einer Regel verstanden wird, nicht als deren Ersatz.",
            "items": [
              {"id":"L1-1","question":"Warum hält der Text die Ausgangsfrage für unfruchtbar?","options":{"A":"Weil sie eine Alternative unterstellt, wo eine Wechselwirkung besteht","B":"Weil sie zu alt ist","C":"Weil sie unbeantwortbar ist"},"correct":"A","explanation_vi":"Câu thứ hai của bài nêu rõ điều này."},
              {"id":"L1-2","question":"Was zeigen Untersuchungen zur Wirkung von Appellen?","options":{"A":"Große und dauerhafte Effekte","B":"Geringe und meist kurzlebige Effekte ohne veränderte Rahmenbedingungen","C":"Gar keine Effekte"},"correct":"B","explanation_vi":"geringe und meist kurzlebige Effekte."},
              {"id":"L1-3","question":"Welcher überraschende Befund wird genannt?","options":{"A":"Betonung persönlicher Verantwortung senkt die Zustimmung zu politischen Maßnahmen","B":"Appelle erhöhen die Zustimmung stark","C":"Politische Maßnahmen sind unbeliebt"},"correct":"A","explanation_vi":"Nhấn mạnh trách nhiệm cá nhân làm giảm ủng hộ chính sách."},
              {"id":"L1-4","question":"Welche Wirkung individuellen Verhaltens hält der Text für belegt?","options":{"A":"Frühe Anwender senken Kosten neuer Technologien","B":"Verhalten ist wirkungslos","C":"Verhalten ersetzt Regeln"},"correct":"A","explanation_vi":"dieser Effekt ist gut belegt."},
              {"id":"L1-5","question":"Wie soll individuelles Verhalten laut Text verstanden werden?","options":{"A":"Als Ersatz für Regeln","B":"Als Vorwegnahme einer Regel","C":"Als reine Privatsache"},"correct":"B","explanation_vi":"als Vorwegnahme einer Regel, nicht als deren Ersatz."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Kurztexte A bis E. Welcher Text passt zu welcher Aussage?",
            "instruction_vi": "Đọc 5 đoạn A–E và ghép với từng nhận định",
            "context": "A = Landwirt Brügge: Ich habe auf Direktvermarktung umgestellt, weil ich sonst mit den Preisen im Handel nicht überlebt hätte. Ökologisch ist das ein Nebeneffekt, ökonomisch war es eine Notlage.\nB = Ingenieurin Halim: Der Speicher ist längst nicht das Problem. Was fehlt, sind Leitungen, und deren Bau scheitert an Verfahren, nicht an Technik.\nC = Ökonomin Ferrer: Ein Preis auf Emissionen wirkt, aber nur, wenn die Rückverteilung sichtbar ist. Sonst zahlen ihn jene, die keine Alternative haben, und die Zustimmung bricht weg.\nD = Stadtwerksleiter Kubin: Unsere Kundschaft verlangt Klimaneutralität und protestiert gleichzeitig gegen jedes Windrad im Blickfeld. Diesen Widerspruch löst kein Konzept.\nE = Klimaforscherin Nowak: Was mich in der Öffentlichkeit stört, ist die Fixierung auf einzelne Jahreszahlen. Entscheidend ist die kumulierte Menge, nicht ein Datum im Kalender.",
            "items": [
              {"id":"L2-1","person":"Diese Person betont, dass Akzeptanz von sichtbarer Rückverteilung abhängt.","question":"Welcher Text passt?","correct":"C","explanation_vi":"C nói về hoàn trả tiền phải nhìn thấy được."},
              {"id":"L2-2","person":"Diese Person beschreibt einen Widerspruch zwischen Forderung und Akzeptanz vor Ort.","question":"Welcher Text passt?","correct":"D","explanation_vi":"D nói khách đòi trung hoà nhưng phản đối tua-bin gió."},
              {"id":"L2-3","person":"Diese Person nennt Genehmigungsverfahren als eigentliches Hindernis.","question":"Welcher Text passt?","correct":"B","explanation_vi":"B nói vướng thủ tục chứ không phải kỹ thuật."},
              {"id":"L2-4","person":"Diese Person kritisiert die Konzentration der Debatte auf einzelne Zieljahre.","question":"Welcher Text passt?","correct":"E","explanation_vi":"E nói lượng tích luỹ mới quan trọng."},
              {"id":"L2-5","person":"Diese Person nennt wirtschaftlichen Druck als Auslöser einer Umstellung.","question":"Welcher Text passt?","correct":"A","explanation_vi":"A chuyển sang bán trực tiếp vì áp lực giá."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Diskussion: Sanierungspflicht für Wohngebäude?\nArchitekt Renner: Technisch ist fast jedes Haus sanierbar. Die Frage ist, wer es bezahlt und wer in der Zwischenzeit wo wohnt.\nMieterbund-Vertreterin Sahlmann: Genau hier liegt das Problem. Modernisierungskosten landen bei den Mietern, während die Einsparung beim Verbrauch die Erhöhung selten ausgleicht.\nEigentümervertreter Domke: Uns wird Verweigerung unterstellt. Tatsächlich fehlen Handwerker und Planungssicherheit, weil die Förderbedingungen fast jährlich wechseln.\nEnergieberaterin Tunc: Ich sehe beides. Am wirksamsten sind die einfachen Schritte, die kaum jemand fördert: Heizung richtig einstellen, Rohre dämmen, Fenster abdichten.\nArchitekt Renner: Dem stimme ich zu, nur ersetzt das keine Sanierung, es verschiebt sie.",
            "items": [
              {"id":"L3-1","question":"Herr Renner hält die meisten Häuser für technisch sanierbar.","correct":"richtig","explanation_vi":"Technisch ist fast jedes Haus sanierbar."},
              {"id":"L3-2","question":"Frau Sahlmann sagt, die Einsparung gleiche die Mieterhöhung meist aus.","correct":"falsch","explanation_vi":"Bà nói tiết kiệm hiếm khi bù được mức tăng."},
              {"id":"L3-3","question":"Herr Domke nennt wechselnde Förderbedingungen als Problem.","correct":"richtig","explanation_vi":"Förderbedingungen wechseln fast jährlich."},
              {"id":"L3-4","question":"Frau Tunc hält einfache Maßnahmen für besonders wirksam.","correct":"richtig","explanation_vi":"Am wirksamsten sind die einfachen Schritte."},
              {"id":"L3-5","question":"Herr Renner hält einfache Maßnahmen für einen vollständigen Ersatz der Sanierung.","correct":"falsch","explanation_vi":"Ông nói chúng chỉ trì hoãn chứ không thay thế."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Verzicht ist kein Programm\nWer Nachhaltigkeit vor allem als Verzicht erklärt, wird die Mehrheit nicht gewinnen, und zwar nicht aus Bequemlichkeit. Verzicht ist ungleich verteilt: Für den einen bedeutet er einen Flug weniger, für die andere kalte Räume. Wo Politik das nicht unterscheidet, entsteht der Eindruck, es gehe um Moral statt um Verhältnisse. Wirksamer ist der umgekehrte Zugang: sichtbare Verbesserungen, die zugleich Emissionen senken. Ein dichter Takt im Nahverkehr wird nicht als Opfer erlebt, sondern als Gewinn an Zeit; ein saniertes Haus als Gewinn an Komfort. Das ist kein Werbetrick, sondern eine Frage der Reihenfolge: Erst muss die bessere Option existieren, dann wird die schlechtere entbehrlich. Diese Einsicht schützt allerdings nicht vor Konflikten. Manche Maßnahmen kosten tatsächlich etwas, und wer das leugnet, verliert die Glaubwürdigkeit, die er für die schwierigen Schritte braucht. Die ehrlichste Formulierung lautet daher: Es wird sich einiges ändern, vieles davon zum Besseren, und über den Rest muss man streiten dürfen, ohne dass gleich die Ziele infrage stehen.",
            "items": [
              {"id":"L4-1","question":"Warum überzeugt Verzicht als Leitidee laut Autor nicht?","options":{"A":"Weil er ungleich verteilt ist","B":"Weil er zu teuer ist","C":"Weil ihn niemand versteht"},"correct":"A","explanation_vi":"Verzicht ist ungleich verteilt."},
              {"id":"L4-2","question":"Welchen Eindruck erzeugt eine Politik, die nicht unterscheidet?","options":{"A":"Es gehe um Moral statt um Verhältnisse","B":"Es gehe nur um Technik","C":"Es gehe um Statistik"},"correct":"A","explanation_vi":"Câu trong bài nói đúng như vậy."},
              {"id":"L4-3","question":"Welchen Zugang hält der Autor für wirksamer?","options":{"A":"Sichtbare Verbesserungen, die Emissionen senken","B":"Strengere Verbote","C":"Mehr Appelle"},"correct":"A","explanation_vi":"sichtbare Verbesserungen."},
              {"id":"L4-4","question":"Was betont er zur Reihenfolge?","options":{"A":"Erst die bessere Option, dann wird die schlechtere entbehrlich","B":"Erst das Verbot, dann die Alternative","C":"Beides gleichzeitig ist unmöglich"},"correct":"A","explanation_vi":"Erst muss die bessere Option existieren."},
              {"id":"L4-5","question":"Wovor warnt der Autor am Ende?","options":{"A":"Vor dem Leugnen tatsächlicher Kosten","B":"Vor jeder Diskussion","C":"Vor zu schnellen Verbesserungen"},"correct":"A","explanation_vi":"wer das leugnet, verliert die Glaubwürdigkeit."}
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
            "instruction_de": "Hören Sie die kurzen Beiträge und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Aus einer Gemeindeinformation: Die Förderung für Balkonkraftwerke wird fortgeführt, allerdings nur noch für Haushalte, die den Zuschuss nicht bereits erhalten haben. Anträge sind ab dem ersten Oktober möglich, das Budget ist begrenzt.","question":"Wer kann den Zuschuss beantragen?","options":{"A":"Alle Haushalte erneut","B":"Nur Haushalte ohne bisherigen Zuschuss","C":"Nur Unternehmen"},"correct":"B","explanation_vi":"Chỉ hộ chưa từng nhận hỗ trợ."},
              {"id":"H1-2","audio_script":"A: Lohnt sich die Wärmepumpe in einem Altbau? B: Pauschal nein, das hängt an den Heizflächen. Mit großen Flächen funktioniert sie, sonst wird es teuer.","question":"Wovon hängt es laut Antwort ab?","options":{"A":"Von den Heizflächen","B":"Vom Baujahr allein","C":"Von der Himmelsrichtung"},"correct":"A","explanation_vi":"das hängt an den Heizflächen."},
              {"id":"H1-3","audio_script":"Hinweis eines Betriebs: Wir liefern ab Januar nur noch in Mehrwegbehältern. Die Behälter bleiben unser Eigentum und werden bei der nächsten Lieferung getauscht, ein Pfand wird nicht erhoben.","question":"Was gilt für die Behälter?","options":{"A":"Sie werden getauscht, ohne Pfand","B":"Sie müssen gekauft werden","C":"Sie werden entsorgt"},"correct":"A","explanation_vi":"Đổi khi giao lần sau, không thu tiền cọc."},
              {"id":"H1-4","audio_script":"A: Was hältst du von der neuen Kennzeichnung? B: Grundsätzlich viel. Nur nützt sie wenig, solange sie freiwillig ist. Wer schlecht abschneidet, druckt sie einfach nicht auf.","question":"Was kritisiert die zweite Person?","options":{"A":"Die Freiwilligkeit der Kennzeichnung","B":"Die Farben der Kennzeichnung","C":"Die Kosten"},"correct":"A","explanation_vi":"Ai điểm kém thì không in nhãn."},
              {"id":"H1-5","audio_script":"Aus einer Ratssitzung: Der Antrag wird zurückgestellt. Nicht, weil er inhaltlich abgelehnt wird, sondern weil die Kostenschätzung fehlt. Ohne Zahlen können wir keinen Beschluss fassen.","question":"Warum wird der Antrag zurückgestellt?","options":{"A":"Weil er inhaltlich abgelehnt wird","B":"Weil die Kostenschätzung fehlt","C":"Weil die Sitzung zu lange dauert"},"correct":"B","explanation_vi":"weil die Kostenschätzung fehlt."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết trình và chọn Richtig hoặc Falsch",
            "audio_script": "Guten Abend. Mein Thema ist der Umgang mit Zielkonflikten im Naturschutz, ein Feld, in dem gut gemeinte Maßnahmen einander regelmäßig behindern. Beispiel eins: Windkraft und Artenschutz. Beide Anliegen sind legitim, und die Behauptung, es gebe hier keinen Konflikt, hilft niemandem. Was hilft, sind Standortkriterien und verbindliche Abschaltzeiten, also Verfahren, die den Konflikt regeln, statt ihn zu leugnen. Beispiel zwei: Wiedervernässung von Mooren. Ökologisch ist der Nutzen unstrittig, betroffen sind jedoch Betriebe, die dort seit Generationen wirtschaften. Wo Entschädigung erst nach der Umsetzung verhandelt wird, entsteht Widerstand, der sachlich vermeidbar wäre. Drittens, und das halte ich für unterschätzt: Der Erfolg vieler Maßnahmen wird an ihrer Umsetzung gemessen, nicht an ihrer Wirkung. Gepflanzte Bäume sind eine Zahl, überlebende Bäume nach fünf Jahren wären die Kennziffer, die zählt. Und viertens ein Wort zur Zeit: Ökosysteme reagieren verzögert. Wer politische Erfolge in Legislaturperioden misst, wird die falschen Maßnahmen bevorzugen, nämlich die schnell sichtbaren.",
            "items": [
              {"id":"H2-1","question":"Der Redner bestreitet, dass es Zielkonflikte gibt.","correct":"falsch","explanation_vi":"Ông nói phủ nhận xung đột chẳng giúp được ai."},
              {"id":"H2-2","question":"Er empfiehlt Standortkriterien und Abschaltzeiten.","correct":"richtig","explanation_vi":"Verfahren, die den Konflikt regeln."},
              {"id":"H2-3","question":"Bei der Wiedervernässung hält er späte Entschädigungsverhandlungen für problematisch.","correct":"richtig","explanation_vi":"Widerstand vermeidbar wäre."},
              {"id":"H2-4","question":"Er hält gepflanzte Bäume für die aussagekräftige Kennziffer.","correct":"falsch","explanation_vi":"Cây sống sau 5 năm mới là chỉ số đáng tin."},
              {"id":"H2-5","question":"Er warnt davor, Erfolge in Legislaturperioden zu messen.","correct":"richtig","explanation_vi":"sẽ ưu tiên biện pháp nhìn thấy nhanh."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie das Gespräch und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc trò chuyện rồi chọn đáp án đúng",
            "audio_script": "Moderatorin: Frau Steger, Ihre Genossenschaft betreibt ein Nahwärmenetz im Dorf. Steger: Ja, seit sechs Jahren, angeschlossen sind achtzig Prozent der Haushalte. Moderatorin: Wie haben Sie die Menschen überzeugt? Steger: Nicht mit Klimaargumenten. Entscheidend war, dass wir die Kalkulation offengelegt haben, inklusive der Risiken. Herr Prahl: Als Berater sehe ich das ähnlich, würde aber ergänzen: Ohne die zwei Landwirte, die früh mitgemacht haben, wäre es gescheitert. Es braucht lokale Fürsprecher. Steger: Und Geduld. Die ersten zwei Jahre waren wir bei jeder Versammlung im Dorf. Moderatorin: Was war das größte Hindernis? Steger: Die Finanzierung, ehrlich gesagt. Banken bewerten Genossenschaften vorsichtig, wir mussten mehr Eigenkapital aufbringen als geplant. Prahl: Und in vielen Gemeinden fehlt genau das, weshalb ich für Bürgschaften der Kommune plädiere.",
            "items": [
              {"id":"H3-1","question":"Wie viele Haushalte sind angeschlossen?","options":{"A":"Etwa die Hälfte","B":"Achtzig Prozent","C":"Alle"},"correct":"B","explanation_vi":"achtzig Prozent der Haushalte."},
              {"id":"H3-2","question":"Womit hat Frau Steger überzeugt?","options":{"A":"Mit offengelegter Kalkulation inklusive Risiken","B":"Mit Klimaargumenten","C":"Mit Werbung"},"correct":"A","explanation_vi":"die Kalkulation offengelegt, inklusive der Risiken."},
              {"id":"H3-3","question":"Was ergänzt Herr Prahl?","options":{"A":"Die Bedeutung lokaler Fürsprecher","B":"Die Notwendigkeit von Werbung","C":"Die Rolle des Staates allein"},"correct":"A","explanation_vi":"Es braucht lokale Fürsprecher."},
              {"id":"H3-4","question":"Was war das größte Hindernis?","options":{"A":"Die Technik","B":"Die Finanzierung","C":"Die Genehmigung"},"correct":"B","explanation_vi":"Die Finanzierung, ehrlich gesagt."},
              {"id":"H3-5","question":"Wofür plädiert Herr Prahl?","options":{"A":"Für kommunale Bürgschaften","B":"Für höhere Preise","C":"Für den Verzicht auf Genossenschaften"},"correct":"A","explanation_vi":"ich plädiere für Bürgschaften der Kommune."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person hält Verbote ohne soziale Abfederung für gefährlich.\nB = Diese Person berichtet von messbaren Einsparungen im eigenen Betrieb.\nC = Diese Person kritisiert die Werbung mit unklaren Umweltversprechen.\nD = Diese Person betont die Bedeutung langfristiger Planungssicherheit.\nE = Diese Person spricht über die Rolle von Bildung und Gewohnheiten.",
            "audio_script": "Sprecherin 1: Wir haben die Abwärme der Öfen in die Halle geleitet und sparen seither ein Drittel Gas. Das rechnet sich in vier Jahren.\nSprecher 2: Auf jeder zweiten Packung steht inzwischen etwas von Klima oder Natur, ohne dass geprüft wird, was dahintersteht.\nSprecherin 3: Wer heute investiert, plant für zwanzig Jahre. Wenn sich die Regeln alle zwei Jahre ändern, investiert niemand.\nSprecher 4: Meine Enkel trennen selbstverständlich Müll, für meine Generation war das eine Umstellung. Solche Gewohnheiten entstehen früh.\nSprecherin 5: Ein Verbot trifft die Familie mit dem alten Auto härter als den, der sich ein neues kaufen kann. Ohne Ausgleich wird das nicht funktionieren.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 1 nói tiết kiệm một phần ba khí đốt."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 2 phê phán quảng cáo môi trường mơ hồ."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 3 nói về ổn định quy định dài hạn."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 4 nói về thói quen hình thành từ nhỏ."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 5 đòi có bù đắp xã hội khi cấm."}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 40,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "ESSAY",
            "instruction_de": "Schreiben Sie einen strukturierten Text (circa 230 Wörter).",
            "instruction_vi": "Viết bài luận có bố cục ~230 từ",
            "input_email": "Aufgabe: In einer überregionalen Zeitung wurde die These vertreten, Klimaschutz sei in erster Linie eine Frage individueller Entscheidungen und nicht staatlicher Regeln. Nehmen Sie dazu Stellung.\nHinweis: Beziehen Sie die Lage in Ihrem Heimatland ein und gehen Sie auf mindestens ein Gegenargument ein.",
            "writing_points": ["Einleitung mit eigener These", "Argument eins mit Beleg oder Beispiel", "Argument zwei mit Bezug auf Ihr Heimatland", "Gegenargument aufgreifen und einordnen", "Schluss mit Folgerung oder Vorschlag"]
          },
          {
            "teil": 2,
            "type": "FORMAL_LETTER",
            "instruction_de": "Schreiben Sie ein formelles Schreiben (circa 120 Wörter).",
            "instruction_vi": "Viết thư trang trọng ~120 từ theo tình huống sau",
            "input_email": "Situation: Ihre Wohnanlage soll eine Photovoltaikanlage erhalten. Die Verwaltung hat die Eigentümer informiert, die Mieterinnen und Mieter jedoch nicht, obwohl deren Nebenkosten betroffen sind. Schreiben Sie an die Hausverwaltung, Frau Lehmann.",
            "writing_points": ["Vorhaben und Ihre Betroffenheit benennen", "Die fehlende Information sachlich ansprechen", "Konkrete Fragen zu Kosten und Zeitplan stellen", "Um eine Informationsveranstaltung und schriftliche Antwort bitten"]
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
            "type": "PRESENTATION",
            "instruction_de": "Halten Sie einen strukturierten Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày có cấu trúc ~4 phút",
            "prompt": "Thema: Wer soll die Kosten der ökologischen Umstellung tragen?\nGliederung:\n1. Einstieg: Warum die Verteilungsfrage entscheidend ist\n2. Zwei Positionen mit ihren stärksten Argumenten\n3. Die Situation in Ihrem Heimatland\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick und Schluss"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner und einigen Sie sich auf eine Empfehlung.",
            "instruction_vi": "Thảo luận với bạn thi và cùng đưa ra khuyến nghị",
            "prompt": "Ausgangslage: Eine Region erwägt, Inlandsflüge auf Strecken zu verbieten, die mit der Bahn in unter vier Stunden erreichbar sind.\nDiskutieren Sie: Welche Wirkung ist realistisch zu erwarten? Wer wäre betroffen? Welche Voraussetzungen müsste die Bahn erfüllen? Welche Ausnahmen wären nötig?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
