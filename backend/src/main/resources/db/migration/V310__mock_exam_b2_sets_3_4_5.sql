-- V310: Ba đề thi thử B2 (Set 3, 4, 5) — bù cho B2 đủ 5 đề.
-- Cấu trúc theo Goethe-Zertifikat B2: Lesen 5 Teil (25 câu) · Hören 4 Teil (20 câu) ·
-- Schreiben 2 bài (bài luận diễn đàn + thư trang trọng) · Sprechen 2 Teil. Mỗi phần 25 điểm.

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'B2', 'GOETHE',
  'Goethe Zertifikat B2 – Set 3',
  'Đề thi thử Goethe B2 – Chủ đề: Thế giới việc làm và số hoá',
  100, 60, 110,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 35,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einer Wochenzeitung: Die Vier-Tage-Woche auf dem Prüfstand\nSeit einigen Jahren testen Unternehmen in Europa, ob sich die Arbeitszeit bei gleichem Lohn auf vier Tage verkürzen lässt. Die Ergebnisse der größten britischen Studie klingen zunächst eindeutig: Neun von zehn beteiligten Firmen blieben nach dem Versuch bei dem neuen Modell, die Zahl der Krankmeldungen sank deutlich, und die Beschäftigten berichteten von weniger Erschöpfung. Kritiker halten dagegen, dass vor allem Betriebe mitgemacht haben, die ohnehin gut organisiert sind. In der Pflege oder im Einzelhandel, wo Personal fehlt und Schichten gefüllt werden müssen, lässt sich Arbeitszeit nicht einfach verdichten. Auch die Frage der Produktivität bleibt umstritten: Zwar meldeten viele Firmen stabile Umsätze, doch die Untersuchungszeiträume waren kurz und die Teilnahme freiwillig, was die Aussagekraft einschränkt. Wirtschaftsforscher plädieren deshalb für differenzierte Modelle statt für eine gesetzliche Regelung: Wo Aufgaben planbar sind, könne die verkürzte Woche funktionieren, in personenbezogenen Dienstleistungen brauche es andere Wege, etwa längere Erholungsphasen oder zusätzliche freie Tage im Jahr.",
            "items": [
              {"id":"L1-1","question":"Wie fielen die Ergebnisse der britischen Studie aus?","options":{"A":"Die meisten Firmen behielten das Modell bei","B":"Fast alle Firmen kehrten zur Fünf-Tage-Woche zurück","C":"Die Krankmeldungen stiegen stark"},"correct":"A","explanation_vi":"Neun von zehn Firmen giữ mô hình mới."},
              {"id":"L1-2","question":"Welchen Einwand nennen die Kritiker?","options":{"A":"Vor allem gut organisierte Betriebe hätten teilgenommen","B":"Die Löhne seien gesunken","C":"Die Beschäftigten hätten sich nicht geäußert"},"correct":"A","explanation_vi":"Chỉ những doanh nghiệp vốn đã tổ chức tốt tham gia."},
              {"id":"L1-3","question":"Warum ist das Modell in der Pflege schwierig?","options":{"A":"Weil dort niemand kürzer arbeiten möchte","B":"Weil die Löhne dort zu hoch sind","C":"Weil Personal fehlt und Schichten besetzt werden müssen"},"correct":"C","explanation_vi":"Thiếu nhân lực và phải phủ kín ca."},
              {"id":"L1-4","question":"Was schränkt die Aussagekraft der Studien ein?","options":{"A":"Die staatliche Finanzierung","B":"Die große Zahl der Teilnehmer","C":"Kurze Zeiträume und freiwillige Teilnahme"},"correct":"C","explanation_vi":"die Untersuchungszeiträume waren kurz und die Teilnahme freiwillig."},
              {"id":"L1-5","question":"Wofür plädieren die Wirtschaftsforscher?","options":{"A":"Für differenzierte Modelle je nach Branche","B":"Für ein Gesetz für alle Branchen","C":"Für die Abschaffung des Modells"},"correct":"A","explanation_vi":"differenzierte Modelle statt gesetzlicher Regelung."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Kurzbeschreibungen A bis E. Welches Angebot passt zu welcher Person?",
            "instruction_vi": "Đọc 5 chương trình A–E và chọn chương trình hợp với từng người",
            "context": "A = Programm Quereinstieg IT: neunmonatige Umschulung für Menschen ohne Informatikabschluss, Vollzeit, Bildungsgutschein möglich.\nB = Netzwerk Rückkehr: Beratung für Eltern, die nach mehreren Jahren Elternzeit in den Beruf zurückkehren, inklusive Coaching für Bewerbungsgespräche.\nC = Gründerzentrum Fokus: Büroplätze und rechtliche Beratung für Selbstständige im ersten Jahr, Miete gestaffelt nach Umsatz.\nD = Fachkräfteagentur International: Anerkennung ausländischer Abschlüsse, Begleitung bis zur Zulassung, Beratung auf Englisch und Spanisch.\nE = Weiterbildung Führung kompakt: berufsbegleitende Module zu Gesprächsführung und Konfliktlösung, freitagabends und samstags.",
            "items": [
              {"id":"L2-1","person":"Frau Alvarez ist Ärztin aus Kolumbien und wartet auf die Anerkennung ihres Diploms in Deutschland.","question":"Welches Angebot passt?","correct":"D","explanation_vi":"D chuyên công nhận bằng cấp nước ngoài."},
              {"id":"L2-2","person":"Herr Lehner leitet seit Kurzem ein Team und fühlt sich bei Konflikten unsicher, kann aber nur am Wochenende lernen.","question":"Welches Angebot passt?","correct":"E","explanation_vi":"E học tối thứ Sáu và thứ Bảy về kỹ năng lãnh đạo."},
              {"id":"L2-3","person":"Frau Bicer war fünf Jahre in Elternzeit und traut sich Bewerbungsgespräche kaum noch zu.","question":"Welches Angebot passt?","correct":"B","explanation_vi":"B hỗ trợ phụ huynh quay lại thị trường lao động."},
              {"id":"L2-4","person":"Herr Novak hat Geschichte studiert und möchte als Softwareentwickler arbeiten.","question":"Welches Angebot passt?","correct":"A","explanation_vi":"A đào tạo chuyển ngành sang IT."},
              {"id":"L2-5","person":"Frau Cheng hat sich gerade selbstständig gemacht und sucht einen günstigen Arbeitsplatz mit Rechtsberatung.","question":"Welches Angebot passt?","correct":"C","explanation_vi":"C có chỗ ngồi làm việc và tư vấn pháp lý."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Diskussion: Künstliche Intelligenz am Arbeitsplatz\nRedakteurin Pohl: Ich nutze KI, um Rohfassungen zu strukturieren. Recherchieren und Prüfen bleibt meine Aufgabe, denn die Systeme erfinden gelegentlich Quellen.\nPersonalleiter Krämer: Bei uns dürfen Bewerbungen ausdrücklich nicht automatisch vorsortiert werden. Wir haben gesehen, dass die Programme Muster aus alten Daten übernehmen und dadurch benachteiligen.\nLehrer Idris: Verbote helfen nicht weiter. Meine Klasse arbeitet mit den Werkzeugen und lernt dabei, deren Ergebnisse kritisch zu prüfen.\nÄrztin Sander: In der Diagnostik hat mich das System zweimal auf Details hingewiesen, die ich übersehen hatte. Die Verantwortung für die Entscheidung bleibt trotzdem bei mir.\nBetriebsrätin Fuchs: Mich stört weniger die Technik als die fehlende Mitbestimmung. Eingeführt wird sie meistens ohne die Belegschaft zu fragen.",
            "items": [
              {"id":"L3-1","question":"Frau Pohl überlässt der KI auch die Prüfung der Quellen.","correct":"falsch","explanation_vi":"Việc kiểm chứng nguồn vẫn do cô đảm nhiệm."},
              {"id":"L3-2","question":"Bei Herrn Krämer werden Bewerbungen nicht automatisch vorsortiert.","correct":"richtig","explanation_vi":"Công ty cấm sàng lọc hồ sơ tự động."},
              {"id":"L3-3","question":"Herr Idris fordert ein Verbot der Werkzeuge im Unterricht.","correct":"falsch","explanation_vi":"Anh nói Verbote helfen nicht weiter."},
              {"id":"L3-4","question":"Frau Sander trägt weiterhin die Verantwortung für ihre Entscheidungen.","correct":"richtig","explanation_vi":"Die Verantwortung bleibt bei mir."},
              {"id":"L3-5","question":"Frau Fuchs kritisiert vor allem die Technik selbst.","correct":"falsch","explanation_vi":"Bà phê phán việc thiếu tham vấn người lao động, không phải công nghệ."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Erreichbarkeit ist keine Leistung\nWer abends um halb elf noch Mails beantwortet, gilt in manchen Betrieben als engagiert. Diese Gleichsetzung von Erreichbarkeit und Leistung ist jedoch ein Irrtum, der teuer zu stehen kommt. Studien zeigen, dass ständige Unterbrechungen die Konzentration über Stunden beeinträchtigen; wer alle zehn Minuten auf Nachrichten reagiert, arbeitet nicht schneller, sondern flacher. Hinzu kommt, dass Führungskräfte durch ihr eigenes Verhalten eine Erwartung erzeugen, die sie nie ausgesprochen haben. Antwortet die Chefin sonntags, fühlen sich Mitarbeitende verpflichtet, es ebenso zu tun. Sinnvoll wären klare Vereinbarungen: feste Zeitfenster für Rückmeldungen, technische Grenzen für den Versand am Wochenende und vor allem Vorgesetzte, die Pausen sichtbar selbst nehmen. Wer Ruhe organisiert, bekommt am Ende bessere Arbeit, nicht weniger.",
            "items": [
              {"id":"L4-1","question":"Was kritisiert der Kommentar?","options":{"A":"Dass Firmen zu viele Pausen erlauben","B":"Dass zu wenig E-Mails geschrieben werden","C":"Dass Erreichbarkeit mit Leistung verwechselt wird"},"correct":"C","explanation_vi":"Gleichsetzung von Erreichbarkeit und Leistung ist ein Irrtum."},
              {"id":"L4-2","question":"Was sagen die erwähnten Studien über Unterbrechungen?","options":{"A":"Sie steigern das Tempo","B":"Sie beeinträchtigen die Konzentration über Stunden","C":"Sie haben keine Wirkung"},"correct":"B","explanation_vi":"ständige Unterbrechungen beeinträchtigen die Konzentration."},
              {"id":"L4-3","question":"Welche Rolle spielen Führungskräfte?","options":{"A":"Sie verbieten das Mailen","B":"Sie haben keinen Einfluss","C":"Sie erzeugen durch ihr Verhalten unausgesprochene Erwartungen"},"correct":"C","explanation_vi":"Hành vi của sếp tạo ra kỳ vọng ngầm."},
              {"id":"L4-4","question":"Welchen Vorschlag macht der Text?","options":{"A":"Feste Zeitfenster für Rückmeldungen","B":"Mehr Überstunden","C":"Abschaffung der E-Mail"},"correct":"A","explanation_vi":"feste Zeitfenster für Rückmeldungen."},
              {"id":"L4-5","question":"Welche Haltung vertritt der Autor am Ende?","options":{"A":"Nur Technik löst das Problem","B":"Ruhe schadet dem Ergebnis","C":"Organisierte Ruhe führt zu besserer Arbeit"},"correct":"C","explanation_vi":"Wer Ruhe organisiert, bekommt bessere Arbeit."}
            ]
          },
          {
            "teil": 5,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie die Betriebsvereinbarung und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc quy định nội bộ doanh nghiệp và chọn đáp án đúng",
            "context": "Auszug aus der Betriebsvereinbarung zum mobilen Arbeiten\nParagraf 2: Mobiles Arbeiten ist an bis zu drei Tagen pro Woche möglich, sofern betriebliche Gründe nicht entgegenstehen. Ein Rechtsanspruch besteht nicht.\nParagraf 3: Die Beschäftigten teilen ihre Anwesenheitstage bis Donnerstag der Vorwoche im Kalender mit.\nParagraf 4: Die Arbeitszeit wird auch im mobilen Arbeiten elektronisch erfasst. Zwischen 20 und 6 Uhr ist die Erfassung gesperrt.\nParagraf 5: Der Arbeitgeber stellt Laptop und Bildschirm. Für den privaten Internetanschluss wird eine Pauschale von 15 Euro monatlich gezahlt.\nParagraf 6: Vertrauliche Unterlagen dürfen die Wohnung nicht verlassen und sind verschlossen aufzubewahren. Verstöße können arbeitsrechtliche Folgen haben.",
            "items": [
              {"id":"L5-1","question":"Wie viele Tage mobiles Arbeiten sind höchstens möglich?","options":{"A":"Zwei Tage","B":"Fünf Tage","C":"Drei Tage"},"correct":"C","explanation_vi":"bis zu drei Tagen pro Woche."},
              {"id":"L5-2","question":"Haben die Beschäftigten einen Anspruch darauf?","options":{"A":"Ja, immer","B":"Nein, ein Rechtsanspruch besteht nicht","C":"Nur Führungskräfte"},"correct":"B","explanation_vi":"Ein Rechtsanspruch besteht nicht."},
              {"id":"L5-3","question":"Bis wann meldet man die Anwesenheitstage?","options":{"A":"Bis Monatsende","B":"Am selben Morgen","C":"Bis Donnerstag der Vorwoche"},"correct":"C","explanation_vi":"bis Donnerstag der Vorwoche."},
              {"id":"L5-4","question":"Was gilt für die Zeiterfassung nachts?","options":{"A":"Sie ist zwischen 20 und 6 Uhr gesperrt","B":"Sie läuft rund um die Uhr","C":"Sie ist freiwillig"},"correct":"A","explanation_vi":"Zwischen 20 und 6 Uhr gesperrt."},
              {"id":"L5-5","question":"Was gilt für vertrauliche Unterlagen?","options":{"A":"Sie müssen in der Wohnung verschlossen bleiben","B":"Sie dürfen mitgenommen werden","C":"Sie werden vernichtet"},"correct":"A","explanation_vi":"Không được mang ra khỏi nhà, phải cất khoá."}
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
            "instruction_de": "Hören Sie die kurzen Texte und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Eine Information aus der Personalabteilung: Ab dem kommenden Quartal werden Weiterbildungen nur noch genehmigt, wenn sie vorher im Entwicklungsgespräch vereinbart wurden. Kurzfristige Anträge lehnen wir künftig ab, unabhängig vom Preis.","question":"Welche Bedingung gilt künftig für Weiterbildungen?","options":{"A":"Sie müssen vorher vereinbart worden sein","B":"Sie müssen günstig sein","C":"Sie müssen online stattfinden"},"correct":"A","explanation_vi":"Chỉ duyệt nếu đã thống nhất trong buổi đánh giá phát triển."},
              {"id":"H1-2","audio_script":"A: Wir könnten die Besprechung auf eine halbe Stunde kürzen. B: Einverstanden, aber dann brauchen wir vorher eine schriftliche Zusammenfassung, sonst diskutieren wir wieder über Details.","question":"Was fordert die zweite Person?","options":{"A":"Längere Sitzungen","B":"Eine schriftliche Zusammenfassung vorab","C":"Eine Absage der Sitzung"},"correct":"B","explanation_vi":"Cần bản tóm tắt gửi trước."},
              {"id":"H1-3","audio_script":"Durchsage im Betrieb: Wegen der Umstellung auf das neue Abrechnungssystem können am Freitag keine Reisekosten eingereicht werden. Bereits gestellte Anträge bleiben gültig und werden wie geplant ausgezahlt.","question":"Was ist am Freitag nicht möglich?","options":{"A":"Reisekosten einreichen","B":"Gehalt abholen","C":"Urlaub beantragen"},"correct":"A","explanation_vi":"Không nộp được chi phí công tác trong ngày thứ Sáu."},
              {"id":"H1-4","audio_script":"A: Wie lief das Gespräch mit der Praktikantin? B: Erstaunlich gut. Sie hat konkrete Vorschläge gemacht, statt nur Fragen zu stellen. Ich würde sie gern übernehmen.","question":"Was hat die Sprecherin beeindruckt?","options":{"A":"Die Praktikantin kam pünktlich","B":"Die Praktikantin stellte viele Fragen","C":"Die Praktikantin machte konkrete Vorschläge"},"correct":"C","explanation_vi":"Cô ấy đưa ra đề xuất cụ thể."},
              {"id":"H1-5","audio_script":"Hinweis der IT-Abteilung: Bitte speichern Sie Projektdateien ausschließlich im gemeinsamen Laufwerk. Dateien auf dem Desktop werden bei der nächtlichen Sicherung nicht erfasst.","question":"Warum sollen Dateien im Laufwerk liegen?","options":{"A":"Weil der Desktop zu klein ist","B":"Weil das Laufwerk schneller ist","C":"Weil der Desktop nicht gesichert wird"},"correct":"C","explanation_vi":"File trên desktop không được sao lưu ban đêm."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết trình và chọn Richtig hoặc Falsch",
            "audio_script": "Guten Abend. Ich spreche heute über den Fachkräftemangel und darüber, warum einfache Erklärungen zu kurz greifen. Häufig heißt es, es gebe zu wenige Bewerber. Die Zahlen zeigen ein anderes Bild: In vielen Berufen bewerben sich durchaus Menschen, sie bleiben aber nicht. Bei Pflegekräften verlässt fast ein Drittel den Beruf innerhalb der ersten fünf Jahre, und zwar überwiegend wegen der Arbeitsbedingungen, nicht wegen des Gehalts allein. Zweitens wird oft übersehen, dass Betriebe selbst Hürden aufbauen: unklare Stellenanzeigen, lange Auswahlverfahren, fehlende Rückmeldung. Wer sechs Wochen auf eine Antwort wartet, nimmt eine andere Stelle an. Drittens gibt es ein Anerkennungsproblem: Qualifizierte Zuwanderer warten teils über ein Jahr auf die Prüfung ihrer Abschlüsse. Meine These lautet daher: Der Mangel ist weniger ein Mangel an Menschen als ein Mangel an Bindung und an funktionierenden Verfahren.",
            "items": [
              {"id":"H2-1","question":"Der Redner hält die Erklärung, es gebe zu wenige Bewerber, für unvollständig.","correct":"richtig","explanation_vi":"Ông nói cách giải thích đơn giản là chưa đủ."},
              {"id":"H2-2","question":"Fast ein Drittel der Pflegekräfte verlässt den Beruf in den ersten fünf Jahren.","correct":"richtig","explanation_vi":"Đúng con số trong bài."},
              {"id":"H2-3","question":"Als Hauptgrund nennt er ausschließlich das Gehalt.","correct":"falsch","explanation_vi":"Chủ yếu do điều kiện làm việc, không chỉ lương."},
              {"id":"H2-4","question":"Lange Auswahlverfahren sind laut Vortrag kein Problem.","correct":"falsch","explanation_vi":"Quy trình tuyển dài khiến ứng viên nhận việc nơi khác."},
              {"id":"H2-5","question":"Er sieht auch bei der Anerkennung ausländischer Abschlüsse ein Problem.","correct":"richtig","explanation_vi":"Người nhập cư chờ hơn một năm để công nhận bằng."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Diskussion und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc thảo luận rồi chọn đáp án đúng",
            "audio_script": "Moderator: Frau Deniz, Sie haben in Ihrem Betrieb die Vier-Tage-Woche eingeführt. Deniz: Ja, seit anderthalb Jahren, bei vollem Lohnausgleich. Moderator: Herr Wolf, Sie sind skeptisch. Wolf: Nicht grundsätzlich. Aber in meiner Branche, der Logistik, laufen die Anlagen sieben Tage. Kürzere Wochen bedeuten dort mehr Schichten und mehr Personal, das ich nicht finde. Deniz: Das stimmt, deshalb sage ich auch nicht, dass es überall passt. Bei uns war der entscheidende Punkt, dass wir zuerst Besprechungen halbiert und Prozesse aufgeräumt haben. Ohne diese Vorarbeit hätte es nicht funktioniert. Moderator: Und die Kundschaft? Deniz: Am Anfang gab es Irritationen, weil freitags niemand erreichbar war. Wir haben dann eine Rufbereitschaft eingerichtet. Wolf: Genau da wird es interessant. Wenn am Ende doch jemand bereitsteht, ist die freie Zeit nur halb frei. Deniz: Deshalb rotiert die Bereitschaft und wird zusätzlich vergütet.",
            "items": [
              {"id":"H3-1","question":"Seit wann gilt das Modell im Betrieb von Frau Deniz?","options":{"A":"Seit einem halben Jahr","B":"Seit fünf Jahren","C":"Seit anderthalb Jahren"},"correct":"C","explanation_vi":"seit anderthalb Jahren."},
              {"id":"H3-2","question":"Warum ist Herr Wolf in seiner Branche skeptisch?","options":{"A":"Weil die Anlagen sieben Tage laufen und Personal fehlt","B":"Weil die Kunden es verbieten","C":"Weil die Löhne zu hoch sind"},"correct":"A","explanation_vi":"Ngành logistics chạy 7 ngày, thiếu người."},
              {"id":"H3-3","question":"Was war für Frau Deniz die Voraussetzung des Erfolgs?","options":{"A":"Neue Maschinen","B":"Mehr Werbung","C":"Weniger Besprechungen und aufgeräumte Prozesse"},"correct":"C","explanation_vi":"Halbierte Besprechungen und Prozesse aufgeräumt."},
              {"id":"H3-4","question":"Wie reagierte der Betrieb auf die Kritik der Kundschaft?","options":{"A":"Mit einer Rückkehr zur Fünf-Tage-Woche","B":"Mit Preissenkungen","C":"Mit einer Rufbereitschaft"},"correct":"C","explanation_vi":"Họ lập chế độ trực điện thoại."},
              {"id":"H3-5","question":"Wie wird die Rufbereitschaft geregelt?","options":{"A":"Sie ist unbezahlt","B":"Sie rotiert und wird zusätzlich vergütet","C":"Sie übernimmt immer dieselbe Person"},"correct":"B","explanation_vi":"Luân phiên và được trả thêm."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person betont, dass Technik Aufgaben verändert, aber nicht ersetzt.\nB = Diese Person fordert verbindliche Regeln für den Datenschutz am Arbeitsplatz.\nC = Diese Person hält Weiterbildung während der Arbeitszeit für entscheidend.\nD = Diese Person berichtet von schlechten Erfahrungen mit einer überstürzten Einführung.\nE = Diese Person sieht vor allem Chancen für kleinere Betriebe.",
            "audio_script": "Sprecherin 1: Bei uns wurde die Software an einem Montag eingeschaltet, ohne Schulung. Drei Wochen lang lief kaum etwas, das war vermeidbar.\nSprecher 2: Meine Tätigkeit hat sich verschoben, ich prüfe heute mehr und tippe weniger. Verschwunden ist die Arbeit deshalb nicht.\nSprecherin 3: Wer sich abends nach acht Stunden noch selbst fortbilden soll, wird es nicht tun. Lernen muss in die bezahlte Zeit.\nSprecher 4: Gerade Handwerksbetriebe mit zehn Leuten profitieren, weil Angebote und Rechnungen plötzlich in Minuten fertig sind.\nSprecherin 5: Solange nicht klar geregelt ist, welche Daten die Systeme über uns sammeln, bleibe ich skeptisch. Das gehört in eine Vereinbarung.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 1 kể trải nghiệm triển khai vội vàng."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 2 nói công việc đổi chứ không mất."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 3 đòi học trong giờ làm việc."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 4 thấy lợi cho doanh nghiệp nhỏ."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 5 đòi quy định về dữ liệu."}
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
            "instruction_de": "Schreiben Sie einen Forumsbeitrag (circa 150 Wörter).",
            "instruction_vi": "Viết bài đăng diễn đàn ~150 từ, lập luận có ví dụ",
            "input_email": "Online-Debatte: Sollte es ein Recht auf Nichterreichbarkeit nach Feierabend geben?\nIn mehreren Ländern wird darüber diskutiert, ob Beschäftigte gesetzlich das Recht bekommen sollen, außerhalb der Arbeitszeit nicht auf dienstliche Nachrichten zu antworten. Wie sehen Sie das?",
            "writing_points": ["Ihre Position klar formulieren", "Zwei Argumente mit Beispielen aus Ihrer Erfahrung", "Auf ein Gegenargument eingehen", "Einen konkreten Vorschlag zum Schluss"]
          },
          {
            "teil": 2,
            "type": "FORMAL_EMAIL",
            "instruction_de": "Schreiben Sie eine formelle E-Mail (circa 100 Wörter).",
            "instruction_vi": "Viết email trang trọng ~100 từ theo tình huống sau",
            "input_email": "Situation: Ihr Arbeitgeber hat eine zweitägige Weiterbildung zugesagt und den Termin nun ohne Absprache in Ihre Urlaubswoche gelegt. Schreiben Sie an die Personalleiterin, Frau Ostermann.",
            "writing_points": ["Sachlich auf die Zusage und die Terminverschiebung Bezug nehmen", "Erklären, warum der neue Termin nicht möglich ist", "Zwei Alternativen vorschlagen", "Um eine verbindliche Rückmeldung bitten"]
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
            "instruction_de": "Halten Sie einen Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày ~4 phút theo dàn ý",
            "prompt": "Thema: Homeoffice — Gewinn oder Verlust für die Zusammenarbeit?\nGliederung:\n1. Einstieg: Bedeutung des Themas heute\n2. Beschreiben Sie zwei Positionen (dafür und dagegen)\n3. Situation in Ihrem Heimatland oder Betrieb\n4. Ihre eigene Position mit Begründung und Beispiel\n5. Ausblick: Was sollte sich ändern?"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner.",
            "instruction_vi": "Thảo luận với bạn thi về đề xuất sau",
            "prompt": "Vorschlag: Ihr Unternehmen möchte Bewerbungsgespräche künftig nur noch per Video führen, um Kosten zu sparen.\nDiskutieren Sie: Welche Vorteile und Nachteile hat der Vorschlag? Für welche Stellen ist er geeignet? Welche Bedenken haben Bewerber? Welchen Kompromiss schlagen Sie vor?\nReagieren Sie auf die Argumente Ihres Partners und kommen Sie zu einer gemeinsamen Empfehlung."
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
  'B2', 'GOETHE',
  'Goethe Zertifikat B2 – Set 4',
  'Đề thi thử Goethe B2 – Chủ đề: Giáo dục và khoa học',
  100, 60, 110,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 35,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einem Wissenschaftsmagazin: Warum Vergessen zum Lernen gehört\nWer für eine Prüfung lernt, empfindet Vergessen als Feind. Die Gedächtnisforschung sieht das anders: Vergessen ist kein Defekt, sondern Teil eines Systems, das Wichtiges von Unwichtigem trennt. Entscheidend ist, wie oft und in welchen Abständen eine Information abgerufen wird. Wird ein Inhalt kurz nach dem Lernen wiederholt, bleibt der Effekt gering; liegen zwischen den Wiederholungen dagegen Tage, muss das Gehirn stärker arbeiten, und genau diese Anstrengung stabilisiert die Spur. Nachteilig wirkt das verbreitete Wiederlesen: Es erzeugt das Gefühl von Vertrautheit, das leicht mit Können verwechselt wird. Deutlich wirksamer ist das freie Abrufen, also der Versuch, den Inhalt ohne Vorlage zu rekonstruieren, auch wenn dabei Fehler entstehen. Studien zeigen zudem, dass Schlaf die Festigung unterstützt, weil Gelerntes nachts erneut aktiviert wird. Für die Praxis heißt das: kürzere Einheiten, verteilte Wiederholungen, viel Selbsttesten und ausreichend Schlaf statt langer Abende vor dem Text.",
            "items": [
              {"id":"L1-1","question":"Wie bewertet die Forschung das Vergessen?","options":{"A":"Als Fehler des Gehirns","B":"Als Folge von Schlafmangel","C":"Als Teil eines sinnvollen Systems"},"correct":"C","explanation_vi":"Vergessen ist kein Defekt, sondern Teil eines Systems."},
              {"id":"L1-2","question":"Welche Wiederholungsabstände sind laut Text günstig?","options":{"A":"Wiederholungen nach mehreren Tagen","B":"Wiederholungen direkt nach dem Lernen","C":"Wiederholungen nur vor der Prüfung"},"correct":"A","explanation_vi":"Cách nhau vài ngày thì hiệu quả hơn."},
              {"id":"L1-3","question":"Warum ist Wiederlesen problematisch?","options":{"A":"Es dauert zu lange","B":"Es erzeugt Vertrautheit, die mit Können verwechselt wird","C":"Es schadet dem Schlaf"},"correct":"B","explanation_vi":"Cảm giác quen thuộc bị nhầm là đã nắm vững."},
              {"id":"L1-4","question":"Was gilt als besonders wirksam?","options":{"A":"Markieren im Text","B":"Freies Abrufen ohne Vorlage","C":"Abschreiben"},"correct":"B","explanation_vi":"das freie Abrufen ist deutlich wirksamer."},
              {"id":"L1-5","question":"Welche Rolle spielt der Schlaf?","options":{"A":"Er unterstützt die Festigung","B":"Er stört die Erinnerung","C":"Er hat keinen Einfluss"},"correct":"A","explanation_vi":"Schlaf unterstützt die Festigung."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Angebote A bis E. Welches Angebot passt zu welcher Person?",
            "instruction_vi": "Đọc 5 chương trình A–E và chọn chương trình hợp với từng người",
            "context": "A = Schreibwerkstatt der Universität: Betreuung beim Verfassen von Abschlussarbeiten, Einzeltermine, auch online.\nB = Kinderuni Sommer: Vorlesungen für Acht- bis Zwölfjährige, samstags, Anmeldung der Eltern nötig.\nC = Studienkolleg Brücke: Vorbereitungskurs für internationale Studierende, Schwerpunkt Fachsprache und Prüfungstraining.\nD = Bürgerforschung Stadtnatur: Freiwillige zählen Vögel und Insekten, App und Schulung werden gestellt.\nE = Weiterbildung Statistik für Berufstätige: Grundlagen der Datenauswertung, sechs Abende, kein Vorwissen nötig.",
            "items": [
              {"id":"L2-1","person":"Frau Okonkwo kommt aus Nigeria und braucht Fachsprache für ihr Studium in Deutschland.","question":"Welches Angebot passt?","correct":"C","explanation_vi":"C là khoá dự bị cho sinh viên quốc tế."},
              {"id":"L2-2","person":"Herr Pfeiffer wertet im Job Umfragen aus und versteht die Auswertung nicht richtig.","question":"Welches Angebot passt?","correct":"E","explanation_vi":"E dạy thống kê cơ bản cho người đi làm."},
              {"id":"L2-3","person":"Frau Kilic hängt seit Wochen an ihrer Masterarbeit fest und braucht Beratung.","question":"Welches Angebot passt?","correct":"A","explanation_vi":"A hỗ trợ viết luận văn."},
              {"id":"L2-4","person":"Familie Wagner sucht für ihre neunjährige Tochter ein Ferienangebot mit Wissenschaft.","question":"Welches Angebot passt?","correct":"B","explanation_vi":"B là đại học cho trẻ 8–12 tuổi."},
              {"id":"L2-5","person":"Herr Sadiq möchte in seiner Freizeit an einem echten Forschungsprojekt mitarbeiten.","question":"Welches Angebot passt?","correct":"D","explanation_vi":"D là dự án khoa học công dân."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Debatte: Sollen Prüfungen an Hochschulen digital stattfinden?\nProfessorin Adler: Digitale Klausuren erleichtern die Auswertung, aber ich sehe ein Problem bei der Aufsicht. Kameras im Kinderzimmer sind für mich keine Lösung.\nStudent Bujar: Für mich wäre es eine Erleichterung. Ich pendle zwei Stunden und würde die Zeit lieber in die Vorbereitung stecken.\nPrüfungsamtsleiter Cramer: Technisch ist vieles möglich, rechtlich nicht. Fällt das Netz aus, muss die Prüfung wiederholt werden, und dafür haften wir.\nDozentin Delgado: Ich habe umgestellt, allerdings auf offene Aufgaben. Wer Verständnis prüft statt Auswendiglernen, hat mit Hilfsmitteln kein Problem.\nStudentin Erdem: Mich stört, dass niemand nach den Bedingungen fragt. Nicht alle haben zu Hause einen ruhigen Platz und schnelles Internet.",
            "items": [
              {"id":"L3-1","question":"Frau Adler lehnt Kameraaufsicht zu Hause ab.","correct":"richtig","explanation_vi":"Kameras im Kinderzimmer sind keine Lösung."},
              {"id":"L3-2","question":"Bujar findet digitale Prüfungen unpraktisch.","correct":"falsch","explanation_vi":"Anh thấy tiện vì đỡ phải đi lại 2 tiếng."},
              {"id":"L3-3","question":"Herr Cramer nennt vor allem rechtliche Bedenken.","correct":"richtig","explanation_vi":"Technisch möglich, rechtlich nicht."},
              {"id":"L3-4","question":"Frau Delgado prüft weiterhin vor allem Auswendiggelerntes.","correct":"falsch","explanation_vi":"Bà chuyển sang câu hỏi mở, kiểm tra hiểu."},
              {"id":"L3-5","question":"Frau Erdem weist auf ungleiche Bedingungen zu Hause hin.","correct":"richtig","explanation_vi":"Không phải ai cũng có chỗ yên tĩnh và mạng nhanh."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Forschung gehört ins Schaufenster\nWissenschaft finanziert sich in weiten Teilen aus öffentlichen Mitteln, deshalb hat die Öffentlichkeit ein Recht darauf zu erfahren, was mit diesem Geld geschieht. Dass Ergebnisse häufig in Zeitschriften erscheinen, die hinter Bezahlschranken liegen, ist schwer zu rechtfertigen. Offene Veröffentlichung allein genügt jedoch nicht. Wer nur Fachaufsätze ins Netz stellt, erreicht die Menschen nicht, für die er schreibt. Nötig sind Übersetzungen in verständliche Sprache, aber ohne die falsche Sicherheit, die entsteht, wenn Unsicherheiten weggelassen werden. Gerade in der Pandemie hat sich gezeigt, wie schnell vorläufige Resultate als endgültige Wahrheit gelesen wurden. Verantwortlich dafür waren nicht nur Medien, sondern auch Institute, die Pressemitteilungen zuspitzten. Eine gute Wissenschaftskommunikation erklärt daher immer mit, wie sicher ein Ergebnis ist und was noch offen bleibt. Das ist mühsamer als eine starke Schlagzeile, aber es ist die Bedingung dafür, dass Vertrauen dauerhaft trägt.",
            "items": [
              {"id":"L4-1","question":"Womit begründet der Autor den Anspruch der Öffentlichkeit?","options":{"A":"Mit gesetzlichen Fristen","B":"Mit dem Interesse der Verlage","C":"Mit der öffentlichen Finanzierung der Forschung"},"correct":"C","explanation_vi":"Nghiên cứu chủ yếu dùng tiền công."},
              {"id":"L4-2","question":"Was kritisiert er an Fachzeitschriften?","options":{"A":"Sie erscheinen zu oft","B":"Sie sind zu kurz","C":"Sie liegen häufig hinter Bezahlschranken"},"correct":"C","explanation_vi":"hinter Bezahlschranken."},
              {"id":"L4-3","question":"Warum reicht offene Veröffentlichung allein nicht?","options":{"A":"Weil Fachaufsätze die Zielgruppe nicht erreichen","B":"Weil sie zu teuer ist","C":"Weil sie verboten ist"},"correct":"A","explanation_vi":"Chỉ đăng bài chuyên môn thì không tới được công chúng."},
              {"id":"L4-4","question":"Welchen Fehler nennt er aus der Pandemie?","options":{"A":"Es wurde gar nicht berichtet","B":"Vorläufige Ergebnisse galten als endgültig","C":"Die Forschung wurde eingestellt"},"correct":"B","explanation_vi":"Kết quả sơ bộ bị hiểu là chân lý cuối cùng."},
              {"id":"L4-5","question":"Was fordert er von guter Wissenschaftskommunikation?","options":{"A":"Möglichst starke Schlagzeilen","B":"Angaben zur Sicherheit der Ergebnisse","C":"Verzicht auf Pressemitteilungen"},"correct":"B","explanation_vi":"Phải nói rõ mức độ chắc chắn và điều còn bỏ ngỏ."}
            ]
          },
          {
            "teil": 5,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie die Prüfungsordnung und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc quy chế thi và chọn đáp án đúng",
            "context": "Auszug aus der Prüfungsordnung\nParagraf 4: Die Anmeldung zur Klausur erfolgt online spätestens zehn Tage vor dem Termin. Eine Abmeldung ist bis 24 Stunden vorher ohne Angabe von Gründen möglich.\nParagraf 5: Wer wegen Krankheit fehlt, reicht innerhalb von drei Werktagen ein ärztliches Attest ein. Bei verspäteter Vorlage gilt die Prüfung als nicht bestanden.\nParagraf 6: Eine nicht bestandene Klausur kann zweimal wiederholt werden. Der dritte Versuch findet als mündliche Prüfung statt.\nParagraf 7: Hilfsmittel sind nur zugelassen, wenn sie in der Aufgabenstellung genannt werden. Elektronische Wörterbücher sind grundsätzlich ausgeschlossen.\nParagraf 8: Die Bewertung wird binnen sechs Wochen bekannt gegeben. Eine Einsicht in die Arbeit ist innerhalb von vier Wochen nach Bekanntgabe möglich.",
            "items": [
              {"id":"L5-1","question":"Bis wann kann man sich ohne Begründung abmelden?","options":{"A":"Am Prüfungstag","B":"Bis zehn Tage vorher","C":"Bis 24 Stunden vorher"},"correct":"C","explanation_vi":"Abmeldung bis 24 Stunden vorher."},
              {"id":"L5-2","question":"Was passiert bei verspätetem Attest?","options":{"A":"Die Prüfung gilt als nicht bestanden","B":"Der Termin wird verschoben","C":"Es passiert nichts"},"correct":"A","explanation_vi":"Nộp giấy trễ thì coi như trượt."},
              {"id":"L5-3","question":"Wie läuft der dritte Versuch ab?","options":{"A":"Als Hausarbeit","B":"Als mündliche Prüfung","C":"Als zweite Klausur"},"correct":"B","explanation_vi":"Der dritte Versuch findet als mündliche Prüfung statt."},
              {"id":"L5-4","question":"Was gilt für elektronische Wörterbücher?","options":{"A":"Sie sind immer erlaubt","B":"Sie sind nur mündlich erlaubt","C":"Sie sind grundsätzlich ausgeschlossen"},"correct":"C","explanation_vi":"grundsätzlich ausgeschlossen."},
              {"id":"L5-5","question":"Wie lange hat man Zeit für die Einsicht?","options":{"A":"Nur am Tag der Bekanntgabe","B":"Sechs Monate","C":"Vier Wochen nach Bekanntgabe"},"correct":"C","explanation_vi":"innerhalb von vier Wochen nach Bekanntgabe."}
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
            "instruction_de": "Hören Sie die kurzen Texte und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Hinweis der Bibliothek: Ab Oktober verlängern sich Ausleihen automatisch, sofern kein anderer Nutzer das Medium vorgemerkt hat. Mahngebühren entfallen dann in den meisten Fällen.","question":"Was ändert sich ab Oktober?","options":{"A":"Ausleihen verlängern sich automatisch","B":"Die Bibliothek schließt früher","C":"Alle Gebühren steigen"},"correct":"A","explanation_vi":"Tự động gia hạn nếu không ai đặt trước."},
              {"id":"H1-2","audio_script":"A: Hast du dich für das Seminar entschieden? B: Ich schwanke noch. Der Inhalt reizt mich, aber die Prüfungsleistung ist eine Hausarbeit von 20 Seiten neben dem Job.","question":"Was hält die Person vom Seminar ab?","options":{"A":"Der uninteressante Inhalt","B":"Der Umfang der Prüfungsleistung","C":"Der hohe Preis"},"correct":"B","explanation_vi":"Tiểu luận 20 trang song song với công việc."},
              {"id":"H1-3","audio_script":"Durchsage im Hörsaalgebäude: Die Vorlesung Statistik zwei findet heute im Raum B 3 statt, da die Technik im großen Hörsaal ausgefallen ist. Die Aufzeichnung wird nachgereicht.","question":"Warum wird der Raum gewechselt?","options":{"A":"Wegen Bauarbeiten","B":"Wegen zu vieler Studierender","C":"Wegen eines Technikausfalls"},"correct":"C","explanation_vi":"Kỹ thuật ở giảng đường lớn bị hỏng."},
              {"id":"H1-4","audio_script":"A: Wie war die Konferenz? B: Fachlich stark, aber die Diskussionen kamen zu kurz. Zehn Minuten für Fragen nach einem 40-Minuten-Vortrag sind einfach zu wenig.","question":"Was kritisiert die zweite Person?","options":{"A":"Die zu kurzen Diskussionszeiten","B":"Das schlechte Essen","C":"Den Ort der Konferenz"},"correct":"A","explanation_vi":"Chỉ 10 phút hỏi đáp là quá ít."},
              {"id":"H1-5","audio_script":"Information für Erstsemester: Die Einführungswoche ist freiwillig, wir empfehlen sie jedoch dringend. Wer teilnimmt, erhält Zugang zu den Lerngruppen des ersten Semesters.","question":"Was gilt für die Einführungswoche?","options":{"A":"Sie ist Pflicht","B":"Sie ist freiwillig, aber empfohlen","C":"Sie ist nur für Ausländer"},"correct":"B","explanation_vi":"freiwillig, jedoch dringend empfohlen."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài giảng và chọn Richtig hoặc Falsch",
            "audio_script": "Willkommen zur heutigen Sitzung über Lernmythen. Ich beginne mit dem bekanntesten: den sogenannten Lerntypen. Die Vorstellung, der eine lerne visuell, der andere auditiv, ist in Schulen weit verbreitet. Kontrollierte Studien konnten jedoch nicht zeigen, dass Unterricht besser wirkt, wenn er dem angeblichen Typ entspricht. Wirksam ist etwas anderes: Der Stoff sollte in der Form dargeboten werden, die zum Inhalt passt. Geografie braucht Karten, Musik braucht Klang, das gilt für alle Lernenden. Der zweite Mythos betrifft Multitasking. Wer beim Lernen Nachrichten beantwortet, verliert nicht nur die Zeit des Wechsels, sondern auch Tiefe im Verständnis. Der dritte Punkt ist heikler: Nicht jede Wiederholung ist gleich gut. Wer immer nur denselben Text liest, gewinnt Sicherheit ohne Können. Zum Schluss noch ein Hinweis, der Sie überraschen wird: Ein moderates Maß an Schwierigkeit beim Lernen ist kein Zeichen von Scheitern, sondern Bedingung für dauerhaftes Behalten.",
            "items": [
              {"id":"H2-1","question":"Die Theorie der Lerntypen ist wissenschaftlich gut belegt.","correct":"falsch","explanation_vi":"Các nghiên cứu có kiểm soát không chứng minh được."},
              {"id":"H2-2","question":"Die Darbietungsform sollte sich nach dem Inhalt richten.","correct":"richtig","explanation_vi":"Geografie braucht Karten, Musik braucht Klang."},
              {"id":"H2-3","question":"Multitasking kostet laut Vortrag nur Zeit, nicht Verständnis.","correct":"falsch","explanation_vi":"Mất cả chiều sâu hiểu biết."},
              {"id":"H2-4","question":"Wiederholtes Lesen desselben Textes führt zu Sicherheit ohne Können.","correct":"richtig","explanation_vi":"Sicherheit ohne Können."},
              {"id":"H2-5","question":"Eine gewisse Schwierigkeit beim Lernen ist laut Vortrag hilfreich.","correct":"richtig","explanation_vi":"Là điều kiện để nhớ lâu."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Diskussion und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc thảo luận rồi chọn đáp án đúng",
            "audio_script": "Moderatorin: Frau Roth, Sie unterrichten seit zwanzig Jahren. Wie verändert Technik den Unterricht? Roth: Weniger als viele denken. Ein Tablet ersetzt keine Erklärung. Was sich wirklich geändert hat, ist die Bandbreite in den Klassen. Herr Yildiz: Da widerspreche ich teilweise. Mit digitalen Aufgaben kann ich jedem Kind ein anderes Niveau geben, das war früher kaum machbar. Roth: Das stimmt, aber ich brauche dafür Zeit zur Vorbereitung, und die habe ich nicht. Moderatorin: Was wäre nötig? Yildiz: Verlässliche Geräte und jemand, der sie wartet. Bei uns fällt regelmäßig das WLAN aus. Roth: Und Fortbildung, die nicht am Freitagnachmittag stattfindet. Moderatorin: Sind Eltern eine Hilfe? Yildiz: Oft ja, manchmal erzeugen sie aber auch Druck, weil sie Ergebnisse sofort sehen wollen.",
            "items": [
              {"id":"H3-1","question":"Wie beurteilt Frau Roth den Einfluss der Technik?","options":{"A":"Er hat alles verändert","B":"Er ist geringer als oft angenommen","C":"Er ist ausschließlich negativ"},"correct":"B","explanation_vi":"Weniger als viele denken."},
              {"id":"H3-2","question":"Welchen Vorteil nennt Herr Yildiz?","options":{"A":"Weniger Vorbereitung","B":"Unterschiedliche Niveaus für einzelne Kinder","C":"Kürzere Unterrichtszeit"},"correct":"B","explanation_vi":"Có thể giao mức độ khác nhau cho từng em."},
              {"id":"H3-3","question":"Was fehlt Frau Roth vor allem?","options":{"A":"Zeit zur Vorbereitung","B":"Interesse der Schüler","C":"Ein Klassenraum"},"correct":"A","explanation_vi":"ich brauche Zeit zur Vorbereitung."},
              {"id":"H3-4","question":"Welches technische Problem nennt Herr Yildiz?","options":{"A":"Regelmäßige WLAN-Ausfälle","B":"Zu wenige Bücher","C":"Fehlende Tafeln"},"correct":"A","explanation_vi":"Bei uns fällt regelmäßig das WLAN aus."},
              {"id":"H3-5","question":"Wie beschreibt Herr Yildiz die Rolle der Eltern?","options":{"A":"Oft hilfreich, manchmal Druck erzeugend","B":"Immer hilfreich","C":"Ohne Bedeutung"},"correct":"A","explanation_vi":"Oft ja, manchmal erzeugen sie Druck."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person plädiert für kleinere Lerngruppen statt neuer Technik.\nB = Diese Person hält Prüfungen für überbewertet.\nC = Diese Person betont den Wert von Fehlern beim Lernen.\nD = Diese Person wünscht sich mehr Praxisbezug im Unterricht.\nE = Diese Person kritisiert die ungleichen Startbedingungen der Kinder.",
            "audio_script": "Sprecherin 1: Ein Kind, das nie einen Fehler machen darf, probiert nichts mehr aus. Genau daran wächst aber das Verständnis.\nSprecher 2: Man kann jedes Klassenzimmer mit Bildschirmen vollstellen, solange dreißig Kinder darin sitzen, ändert sich wenig.\nSprecherin 3: Wer zu Hause Bücher und Unterstützung hat, startet im Vorteil. Das gleicht die Schule bis heute nicht aus.\nSprecher 4: Was in der Schule fehlt, ist der Bezug zur Wirklichkeit. Steuern, Verträge, Bewerbungen — davon höre ich zu wenig.\nSprecherin 5: Noten sagen wenig darüber aus, was jemand kann. Wir messen vor allem, wer an einem bestimmten Tag funktioniert.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 1 nói về giá trị của sai lầm."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 2 muốn lớp ít học sinh hơn."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 3 nói về xuất phát điểm bất bình đẳng."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 4 đòi gắn với thực tế."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 5 cho rằng điểm số bị đề cao quá mức."}
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
            "instruction_de": "Schreiben Sie einen Forumsbeitrag (circa 150 Wörter).",
            "instruction_vi": "Viết bài đăng diễn đàn ~150 từ",
            "input_email": "Online-Debatte: Sollten Hausaufgaben abgeschafft werden?\nEinige Schulen verzichten inzwischen ganz auf Hausaufgaben und üben stattdessen im Unterricht. Andere halten das Üben zu Hause für unverzichtbar. Wie ist Ihre Meinung?",
            "writing_points": ["Ihre Position klar formulieren", "Zwei Argumente mit Beispielen", "Auf ein Gegenargument eingehen", "Einen Vorschlag zum Schluss"]
          },
          {
            "teil": 2,
            "type": "FORMAL_EMAIL",
            "instruction_de": "Schreiben Sie eine formelle E-Mail (circa 100 Wörter).",
            "instruction_vi": "Viết email trang trọng ~100 từ theo tình huống sau",
            "input_email": "Situation: Sie haben an einem Fachkurs teilgenommen, das versprochene Zertifikat aber nach acht Wochen noch nicht erhalten. Sie brauchen es für eine Bewerbung. Schreiben Sie an das Kursbüro, Herrn Bergmann.",
            "writing_points": ["Kurs und Zeitraum nennen", "Das Problem sachlich schildern", "Begründen, warum Sie das Zertifikat dringend brauchen", "Eine Frist und eine Rückmeldung erbitten"]
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
            "instruction_de": "Halten Sie einen Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày ~4 phút theo dàn ý",
            "prompt": "Thema: Lebenslanges Lernen — Chance oder Zwang?\nGliederung:\n1. Einstieg und Bedeutung des Themas\n2. Zwei Positionen darstellen\n3. Erfahrungen aus Ihrem Land oder Ihrem Umfeld\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick und Schluss"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner.",
            "instruction_vi": "Thảo luận với bạn thi về đề xuất sau",
            "prompt": "Vorschlag: Eine Hochschule möchte alle Vorlesungen aufzeichnen und dauerhaft online stellen.\nDiskutieren Sie: Welche Vorteile hat das für Studierende? Welche Bedenken haben Lehrende? Sinkt die Anwesenheit? Welche Regelung schlagen Sie vor?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
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
  'B2', 'GOETHE',
  'Goethe Zertifikat B2 – Set 5',
  'Đề thi thử Goethe B2 – Chủ đề: Đô thị, giao thông và môi trường',
  100, 60, 110,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 35,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài viết và chọn đáp án đúng",
            "context": "Aus einer Tageszeitung: Die Stadt der kurzen Wege\nUnter dem Schlagwort der Fünfzehn-Minuten-Stadt wird seit einigen Jahren ein Leitbild diskutiert, nach dem alle Dinge des täglichen Bedarfs zu Fuß oder mit dem Rad in einer Viertelstunde erreichbar sein sollen. Befürworter verweisen auf weniger Verkehr, belebtere Viertel und Geschäfte, die überleben, weil Menschen sie im Alltag ansteuern. Kritiker halten das Konzept für ein Wohlstandsmodell: In gewachsenen Innenstädten mit Ärzten, Schulen und Bäckerei sei es leicht umzusetzen, in Neubaugebieten am Rand dagegen fehle die Grundlage. Tatsächlich zeigen Untersuchungen, dass der Erfolg weniger von Verboten abhängt als von der Frage, ob Alternativen vorhanden sind: Wo Radwege durchgehend befahrbar sind und Busse verlässlich fahren, sinkt der Autoanteil auch ohne Gebühren. Umstritten bleibt die Reihenfolge. Manche Städte streichen zuerst Parkplätze und bauen später Wege, was regelmäßig zu Protesten führt. Verkehrsforscher raten zum umgekehrten Weg, warnen aber davor, den Umbau deshalb auf unbestimmte Zeit zu verschieben.",
            "items": [
              {"id":"L1-1","question":"Was besagt das Leitbild der Fünfzehn-Minuten-Stadt?","options":{"A":"Autos fahren höchstens 15 Minuten","B":"Alles Wichtige ist in einer Viertelstunde erreichbar","C":"Geschäfte öffnen 15 Stunden"},"correct":"B","explanation_vi":"Mọi nhu cầu hằng ngày trong 15 phút đi bộ/xe đạp."},
              {"id":"L1-2","question":"Welches Argument nennen die Befürworter?","options":{"A":"Höhere Mieten","B":"Mehr Parkplätze","C":"Belebtere Viertel und weniger Verkehr"},"correct":"C","explanation_vi":"weniger Verkehr, belebtere Viertel."},
              {"id":"L1-3","question":"Worin sehen Kritiker das Problem?","options":{"A":"Radwege sind zu teuer","B":"Innenstädte sind zu klein","C":"In Neubaugebieten fehlt die Grundlage"},"correct":"C","explanation_vi":"Ở khu xây mới ngoại vi thiếu hạ tầng cơ bản."},
              {"id":"L1-4","question":"Wovon hängt der Erfolg laut Untersuchungen vor allem ab?","options":{"A":"Vom Vorhandensein guter Alternativen","B":"Von hohen Gebühren","C":"Von der Größe der Stadt"},"correct":"A","explanation_vi":"Có lựa chọn thay thế tốt thì tỉ lệ ô tô giảm."},
              {"id":"L1-5","question":"Was raten Verkehrsforscher zur Reihenfolge?","options":{"A":"Zuerst Parkplätze streichen","B":"Gar nichts verändern","C":"Zuerst Alternativen bauen, aber den Umbau nicht verschieben"},"correct":"C","explanation_vi":"Làm hạ tầng trước, nhưng đừng hoãn cải tạo vô thời hạn."}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Angebote A bis E. Welches Angebot passt zu welcher Person?",
            "instruction_vi": "Đọc 5 chương trình A–E và chọn chương trình hợp với từng người",
            "context": "A = Förderprogramm Lastenrad: Zuschuss von 500 Euro für Familien und Gewerbe, Antrag online, Nachweis über zwei Jahre Nutzung nötig.\nB = Mieterinitiative Grüner Hof: Beratung, wie Innenhöfe entsiegelt und bepflanzt werden können, kostenlose Erstberatung.\nC = Nachbarschaftsauto Teilauto: stundenweise Nutzung ohne Grundgebühr, Abrechnung nach Kilometern.\nD = Beschwerdestelle Lärm: Meldung von nächtlichem Baustellenlärm, Prüfung innerhalb von zehn Tagen.\nE = Programm Dachbegrünung: technische Prüfung und Zuschuss für Hauseigentümer, Beratung nach Voranmeldung.",
            "items": [
              {"id":"L2-1","person":"Familie Sari möchte Kinder und Einkäufe ohne Auto transportieren.","question":"Welches Angebot passt?","correct":"A","explanation_vi":"A hỗ trợ mua xe đạp chở hàng."},
              {"id":"L2-2","person":"Herr Dorn besitzt ein Mehrfamilienhaus und überlegt, das Flachdach zu bepflanzen.","question":"Welches Angebot passt?","correct":"E","explanation_vi":"E dành cho chủ nhà muốn phủ xanh mái."},
              {"id":"L2-3","person":"Frau Lin braucht nur zweimal im Monat ein Auto und will keine feste Gebühr zahlen.","question":"Welches Angebot passt?","correct":"C","explanation_vi":"C tính theo giờ, không phí cố định."},
              {"id":"L2-4","person":"Herr Abadi kann seit Wochen wegen nächtlicher Bauarbeiten nicht schlafen.","question":"Welches Angebot passt?","correct":"D","explanation_vi":"D tiếp nhận khiếu nại tiếng ồn ban đêm."},
              {"id":"L2-5","person":"Die Hausgemeinschaft Bergstraße will den betonierten Hinterhof begrünen.","question":"Welches Angebot passt?","correct":"B","explanation_vi":"B tư vấn phá bê tông và trồng cây trong sân."}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_de": "Lesen Sie die Stellungnahmen. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc các ý kiến và chọn Richtig hoặc Falsch",
            "context": "Bürgerdebatte: Autofreie Innenstadt am Wochenende\nEinzelhändlerin Vogt: Ich war anfangs dagegen, weil ich Umsatzverluste befürchtet habe. Nach einem halben Jahr sehe ich mehr Laufkundschaft als vorher, allerdings brauche ich weiterhin eine Lieferzufahrt am Morgen.\nAnwohner Pribil: Für mich ist es eine Erleichterung, seit die Straße ruhiger ist. Nur die Parksuche in den Nebenstraßen hat deutlich zugenommen.\nTaxifahrer Rukavina: Über Umsatz beklage ich mich nicht, aber die Umleitungen sind schlecht ausgeschildert. Ortsfremde Fahrgäste verstehen nicht, warum ich Umwege fahre.\nPendlerin Aydin: Ich arbeite samstags im Krankenhaus. Solange die Ausnahmen für Schichtdienste gelten, kann ich mit der Regelung leben.\nStadtplanerin Kolar: Die Zahlen sind eindeutig positiv, entscheidend war jedoch, dass wir gleichzeitig den Bustakt verdichtet haben. Ohne das wäre es gescheitert.",
            "items": [
              {"id":"L3-1","question":"Frau Vogt hat ihre Meinung im Laufe der Zeit geändert.","correct":"richtig","explanation_vi":"Ban đầu phản đối, sau nửa năm thấy khách bộ hành đông hơn."},
              {"id":"L3-2","question":"Herr Pribil berichtet von mehr Parksuchverkehr in den Nebenstraßen.","correct":"richtig","explanation_vi":"die Parksuche hat deutlich zugenommen."},
              {"id":"L3-3","question":"Herr Rukavina klagt vor allem über sinkende Einnahmen.","correct":"falsch","explanation_vi":"Anh không than doanh thu mà than biển chỉ dẫn kém."},
              {"id":"L3-4","question":"Frau Aydin lehnt die Regelung grundsätzlich ab.","correct":"falsch","explanation_vi":"Cô chấp nhận được nếu vẫn có ngoại lệ cho ca kíp."},
              {"id":"L3-5","question":"Frau Kolar hält die Verdichtung des Bustakts für entscheidend.","correct":"richtig","explanation_vi":"Ohne das wäre es gescheitert."}
            ]
          },
          {
            "teil": 4,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Kommentar und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài bình luận và chọn đáp án đúng",
            "context": "Kommentar: Hitze ist ein Planungsproblem\nWenn Städte im Sommer zu Backöfen werden, ist das kein Wetterereignis, sondern das Ergebnis jahrzehntelanger Entscheidungen. Versiegelte Flächen speichern Wärme, fehlende Bäume nehmen den Schatten, enge Blockränder verhindern den Luftaustausch. Wer nun ausschließlich auf Klimaanlagen setzt, verschiebt das Problem: Die Geräte kühlen innen und heizen außen, und sie treffen jene am wenigsten, die keine Wohnung mit Anschluss haben. Wirksamer sind Maßnahmen, die im Stadtbild sichtbar werden: Entsiegelung von Höfen, Bäume mit ausreichend Wurzelraum, Trinkbrunnen an belebten Plätzen und kühle Räume in öffentlichen Gebäuden. Kritisch bleibt die Frage der Pflege. Ein Baum, der gepflanzt und dann vergessen wird, stirbt im dritten Sommer. Nötig sind daher feste Budgets für Bewässerung und Kontrolle, nicht nur Fördermittel für die Pflanzung. Hitzeschutz misst sich nicht an Absichtserklärungen, sondern daran, wie viele Menschen im August tatsächlich einen kühlen Ort erreichen.",
            "items": [
              {"id":"L4-1","question":"Wie erklärt der Autor die Hitze in Städten?","options":{"A":"Als reines Wetterereignis","B":"Als Folge von Planungsentscheidungen","C":"Als Zufall"},"correct":"B","explanation_vi":"Kết quả của các quyết định quy hoạch nhiều thập kỷ."},
              {"id":"L4-2","question":"Was kritisiert er an Klimaanlagen?","options":{"A":"Sie sind zu leise","B":"Sie sind verboten","C":"Sie kühlen innen und heizen außen"},"correct":"C","explanation_vi":"kühlen innen und heizen außen."},
              {"id":"L4-3","question":"Welche Maßnahme nennt der Text NICHT?","options":{"A":"Neue Parkhäuser","B":"Entsiegelung von Höfen","C":"Trinkbrunnen"},"correct":"A","explanation_vi":"Bài không nhắc tới bãi đỗ xe nhiều tầng."},
              {"id":"L4-4","question":"Warum ist die Pflege entscheidend?","options":{"A":"Weil Pflege billig ist","B":"Weil Bäume ohne Pflege eingehen","C":"Weil Bäume nicht wachsen sollen"},"correct":"B","explanation_vi":"Cây trồng rồi bỏ mặc sẽ chết vào mùa hè thứ ba."},
              {"id":"L4-5","question":"Woran soll man Hitzeschutz messen?","options":{"A":"An Absichtserklärungen","B":"An der Zahl der Menschen, die einen kühlen Ort erreichen","C":"An der Zahl der Pressekonferenzen"},"correct":"B","explanation_vi":"Câu cuối bài nói rõ điều này."}
            ]
          },
          {
            "teil": 5,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie die Satzung und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc quy định của thành phố và chọn đáp án đúng",
            "context": "Auszug aus der Satzung über Anwohnerparken\nParagraf 3: Anspruch auf einen Bewohnerparkausweis hat, wer mit Hauptwohnsitz im Gebiet gemeldet ist und über kein anderes Dauerstellplatzangebot verfügt.\nParagraf 4: Der Ausweis gilt zwölf Monate und wird nicht automatisch verlängert. Anträge sind frühestens sechs Wochen vor Ablauf möglich.\nParagraf 5: Die Gebühr beträgt 120 Euro im Jahr, für Fahrzeuge über fünf Meter Länge 180 Euro.\nParagraf 6: Handwerksbetriebe erhalten auf Antrag eine Ausnahmegenehmigung für die Dauer der Arbeiten, längstens für sechs Monate.\nParagraf 7: Bei Umzug aus dem Gebiet ist der Ausweis binnen zwei Wochen zurückzugeben; die Gebühr wird anteilig erstattet.",
            "items": [
              {"id":"L5-1","question":"Wer bekommt keinen Bewohnerparkausweis?","options":{"A":"Wer im Gebiet gemeldet ist","B":"Wer bereits einen Dauerstellplatz hat","C":"Wer ein kleines Auto fährt"},"correct":"B","explanation_vi":"Có chỗ đỗ cố định khác thì không được cấp."},
              {"id":"L5-2","question":"Wie lange gilt der Ausweis?","options":{"A":"Sechs Monate","B":"Unbegrenzt","C":"Zwölf Monate"},"correct":"C","explanation_vi":"Der Ausweis gilt zwölf Monate."},
              {"id":"L5-3","question":"Was zahlt man für ein Fahrzeug von 5,4 Metern Länge?","options":{"A":"180 Euro","B":"120 Euro","C":"Nichts"},"correct":"A","explanation_vi":"Xe dài trên 5 mét: 180 euro."},
              {"id":"L5-4","question":"Wie lange gilt die Ausnahme für Handwerksbetriebe höchstens?","options":{"A":"Sechs Monate","B":"Sechs Wochen","C":"Zwei Jahre"},"correct":"A","explanation_vi":"längstens für sechs Monate."},
              {"id":"L5-5","question":"Was passiert bei einem Umzug aus dem Gebiet?","options":{"A":"Der Ausweis muss binnen zwei Wochen zurück","B":"Der Ausweis bleibt gültig","C":"Die Gebühr verdoppelt sich"},"correct":"A","explanation_vi":"binnen zwei Wochen zurückzugeben."}
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
            "instruction_de": "Hören Sie die kurzen Texte und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe các đoạn ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Verkehrsmeldung: Auf der A7 zwischen Kreuz Nord und Flughafen staut es sich auf zwölf Kilometern. Grund ist eine gesperrte Fahrspur nach einem liegengebliebenen Lastwagen, die Bergung dauert noch bis etwa 15 Uhr.","question":"Warum staut es sich?","options":{"A":"Wegen einer Demonstration","B":"Wegen Schnee","C":"Wegen eines liegengebliebenen Lastwagens"},"correct":"C","explanation_vi":"Xe tải chết máy khiến một làn bị chặn."},
              {"id":"H1-2","audio_script":"A: Habt ihr euch für das Elektroauto entschieden? B: Noch nicht. Die Reichweite reicht uns, aber in unserer Straße gibt es keine einzige Lademöglichkeit.","question":"Was hält die Familie zurück?","options":{"A":"Die zu geringe Reichweite","B":"Die fehlende Lademöglichkeit","C":"Der hohe Verbrauch"},"correct":"B","explanation_vi":"Không có trạm sạc trong phố."},
              {"id":"H1-3","audio_script":"Ansage im Rathaus: Der Bürgerentscheid über die Umgestaltung des Marktplatzes findet am 12. November statt. Wahlberechtigt sind alle Einwohnerinnen und Einwohner ab 16 Jahren mit Hauptwohnsitz in der Stadt.","question":"Wer darf abstimmen?","options":{"A":"Alle ab 16 mit Hauptwohnsitz","B":"Nur Personen ab 18 Jahren","C":"Alle Besucher der Stadt"},"correct":"A","explanation_vi":"ab 16 Jahren mit Hauptwohnsitz."},
              {"id":"H1-4","audio_script":"A: Wie war die Radtour zur Arbeit im Winter? B: Machbar, solange geräumt wird. An zwei Tagen lag Schnee auf dem Radweg, da bin ich auf die Bahn umgestiegen.","question":"Was hat die Person bei Schnee gemacht?","options":{"A":"Sie ist mit der Bahn gefahren","B":"Sie ist zu Hause geblieben","C":"Sie ist trotzdem geradelt"},"correct":"A","explanation_vi":"bin ich auf die Bahn umgestiegen."},
              {"id":"H1-5","audio_script":"Hinweis der Stadtwerke: Wegen Wartungsarbeiten am Fernwärmenetz kann es am Dienstag zwischen 8 und 14 Uhr zu Unterbrechungen bei der Warmwasserversorgung kommen. Die Heizung bleibt in Betrieb.","question":"Was ist am Dienstag betroffen?","options":{"A":"Die Heizung","B":"Die Stromversorgung","C":"Die Warmwasserversorgung"},"correct":"C","explanation_vi":"Chỉ nước nóng bị gián đoạn, sưởi vẫn chạy."}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_de": "Hören Sie den Vortrag. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Nghe bài thuyết trình và chọn Richtig hoặc Falsch",
            "audio_script": "Guten Abend zu unserem Vortrag über Regenwasser in der Stadt. Lange galt der Grundsatz, Wasser möglichst schnell abzuleiten. Bei Starkregen zeigt sich, dass diese Logik an Grenzen stößt: Die Kanäle sind für die heutigen Mengen nicht ausgelegt, und je schneller das Wasser fließt, desto größer die Schäden weiter unten. Das Gegenmodell nennt sich Schwammstadt. Dabei wird Wasser dort gehalten, wo es fällt, in Mulden, unter Baumscheiben oder auf begrünten Dächern. Ein Nebeneffekt ist die Kühlung im Sommer, weil das gespeicherte Wasser verdunstet. Die Umsetzung ist allerdings kein Selbstläufer. Bestehende Straßen lassen sich nur bei ohnehin geplanten Sanierungen umbauen, sonst wird es unverhältnismäßig teuer. Und nicht jeder Boden eignet sich: Wo Lehm ansteht, versickert kaum etwas. Mein Fazit: Die Schwammstadt ist kein Ersatz für die Kanalisation, sondern ihre Ergänzung.",
            "items": [
              {"id":"H2-1","question":"Früher wollte man Regenwasser möglichst schnell ableiten.","correct":"richtig","explanation_vi":"Nguyên tắc cũ là thoát nước càng nhanh càng tốt."},
              {"id":"H2-2","question":"Die Kanäle sind für heutige Starkregenmengen ausgelegt.","correct":"falsch","explanation_vi":"nicht ausgelegt = không đủ sức."},
              {"id":"H2-3","question":"In der Schwammstadt wird Wasser dort gehalten, wo es fällt.","correct":"richtig","explanation_vi":"in Mulden, unter Baumscheiben, auf Dächern."},
              {"id":"H2-4","question":"Der Umbau bestehender Straßen ist laut Vortrag jederzeit günstig möglich.","correct":"falsch","explanation_vi":"Chỉ khả thi khi trùng với đợt cải tạo đã lên kế hoạch."},
              {"id":"H2-5","question":"Der Redner hält die Schwammstadt für eine Ergänzung der Kanalisation.","correct":"richtig","explanation_vi":"kein Ersatz, sondern ihre Ergänzung."}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_de": "Hören Sie die Diskussion und wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe cuộc thảo luận rồi chọn đáp án đúng",
            "audio_script": "Moderator: Frau Bauer, Ihre Gemeinde hat den Busverkehr kostenlos gemacht. Bauer: Ja, seit zwei Jahren. Die Fahrgastzahlen sind um vierzig Prozent gestiegen. Moderator: Herr Neumann, Sie sind skeptisch. Neumann: Die Zahl klingt gut, aber wer ist zusätzlich eingestiegen? Studien zeigen, dass vor allem frühere Fußgänger und Radfahrer umsteigen, nicht Autofahrer. Bauer: Bei uns ist auch der Autoverkehr messbar zurückgegangen, allerdings erst, nachdem wir den Takt verdoppelt haben. Neumann: Genau das ist mein Punkt. Entscheidend ist der Takt, nicht der Preis. Und die Mittel sind begrenzt. Bauer: Wir haben beides gemacht und finanzieren es über eine Abgabe der Arbeitgeber. Neumann: Das ist ein Modell, das nicht überall trägt. In dünn besiedelten Regionen fehlt die Basis dafür.",
            "items": [
              {"id":"H3-1","question":"Wie haben sich die Fahrgastzahlen entwickelt?","options":{"A":"Unverändert","B":"Minus zehn Prozent","C":"Plus vierzig Prozent"},"correct":"C","explanation_vi":"um vierzig Prozent gestiegen."},
              {"id":"H3-2","question":"Welchen Einwand bringt Herr Neumann?","options":{"A":"Vor allem Fußgänger und Radfahrer steigen um","B":"Die Busse seien zu neu","C":"Die Fahrgäste seien unzufrieden"},"correct":"A","explanation_vi":"Chủ yếu người đi bộ và đi xe đạp chuyển sang."},
              {"id":"H3-3","question":"Wann ging in der Gemeinde der Autoverkehr zurück?","options":{"A":"Erst nach der Verdopplung des Takts","B":"Sofort nach der Preissenkung","C":"Gar nicht"},"correct":"A","explanation_vi":"erst, nachdem wir den Takt verdoppelt haben."},
              {"id":"H3-4","question":"Wie wird das Angebot finanziert?","options":{"A":"Über eine Abgabe der Arbeitgeber","B":"Über höhere Parkgebühren","C":"Über Spenden"},"correct":"A","explanation_vi":"über eine Abgabe der Arbeitgeber."},
              {"id":"H3-5","question":"Welche Grenze sieht Herr Neumann?","options":{"A":"Es gibt zu viele Busse","B":"Das Modell trägt nicht in dünn besiedelten Regionen","C":"Die Fahrgäste zahlen zu viel"},"correct":"B","explanation_vi":"In dünn besiedelten Regionen fehlt die Basis."}
            ]
          },
          {
            "teil": 4,
            "type": "MATCH_OPINION_AUDIO",
            "instruction_de": "Hören Sie die fünf Statements. Welche Aussage A bis E passt zu welcher Person?",
            "instruction_vi": "Nghe 5 phát biểu và ghép với nhận định A–E",
            "context": "A = Diese Person hält Verbote ohne Alternativen für ungerecht.\nB = Diese Person hat ihren Alltag ohne Auto organisiert.\nC = Diese Person fordert mehr Grün in dicht bebauten Vierteln.\nD = Diese Person weist auf die Situation älterer Menschen hin.\nE = Diese Person kritisiert die langsame Umsetzung der Pläne.",
            "audio_script": "Sprecherin 1: Seit dem Umzug brauche ich kein Auto mehr, Arbeit, Kita und Markt liegen alle im Umkreis von zwei Kilometern.\nSprecher 2: Wer auf dem Dorf wohnt und keinen Bus hat, kann nicht einfach umsteigen. Erst die Alternative, dann die Regel.\nSprecherin 3: In unserem Viertel gibt es auf 600 Metern keinen einzigen Baum. Im Juli ist das kaum auszuhalten.\nSprecher 4: Beschlossen wurde das vor sechs Jahren, gebaut ist bis heute fast nichts. So verliert man die Leute.\nSprecherin 5: Meine Mutter ist 84 und kommt mit dem Rollator kaum über die neuen Radwege. Daran denkt niemand.",
            "items": [
              {"id":"H4-1","person":"Sprecherin 1","question":"Welche Aussage passt?","correct":"B","explanation_vi":"Người 1 sống không cần ô tô."},
              {"id":"H4-2","person":"Sprecher 2","question":"Welche Aussage passt?","correct":"A","explanation_vi":"Người 2 đòi có lựa chọn thay thế trước khi cấm."},
              {"id":"H4-3","person":"Sprecherin 3","question":"Welche Aussage passt?","correct":"C","explanation_vi":"Người 3 đòi thêm cây xanh."},
              {"id":"H4-4","person":"Sprecher 4","question":"Welche Aussage passt?","correct":"E","explanation_vi":"Người 4 phê phán triển khai chậm."},
              {"id":"H4-5","person":"Sprecherin 5","question":"Welche Aussage passt?","correct":"D","explanation_vi":"Người 5 nói về người cao tuổi."}
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
            "instruction_de": "Schreiben Sie einen Forumsbeitrag (circa 150 Wörter).",
            "instruction_vi": "Viết bài đăng diễn đàn ~150 từ",
            "input_email": "Online-Debatte: Sollen Innenstädte am Wochenende autofrei sein?\nMehrere Städte sperren samstags und sonntags die zentralen Straßen für Autos. Händler, Anwohner und Pendler beurteilen das sehr unterschiedlich. Wie sehen Sie das?",
            "writing_points": ["Ihre Position klar formulieren", "Zwei Argumente mit Beispielen", "Auf die Sicht einer betroffenen Gruppe eingehen", "Einen konkreten Vorschlag machen"]
          },
          {
            "teil": 2,
            "type": "FORMAL_EMAIL",
            "instruction_de": "Schreiben Sie eine formelle E-Mail (circa 100 Wörter).",
            "instruction_vi": "Viết email trang trọng ~100 từ theo tình huống sau",
            "input_email": "Situation: Vor Ihrem Haus wird seit drei Wochen auch nachts gebaut. Die Stadt hat eine Ausnahmegenehmigung erteilt, ohne die Anwohner zu informieren. Schreiben Sie an das Ordnungsamt, Frau Steiner.",
            "writing_points": ["Ort und Zeitraum der Arbeiten nennen", "Die Belastung sachlich beschreiben", "Nach Grund und Dauer der Ausnahmegenehmigung fragen", "Um eine schriftliche Antwort und mögliche Maßnahmen bitten"]
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
            "instruction_de": "Halten Sie einen Vortrag (circa 4 Minuten).",
            "instruction_vi": "Trình bày ~4 phút theo dàn ý",
            "prompt": "Thema: Wie sollen Städte in zwanzig Jahren aussehen?\nGliederung:\n1. Einstieg: Warum das Thema wichtig ist\n2. Zwei unterschiedliche Vorstellungen darstellen\n3. Die Lage in Ihrer Stadt oder Ihrem Heimatland\n4. Ihre Position mit Begründung und Beispiel\n5. Ausblick und Schluss"
          },
          {
            "teil": 2,
            "type": "DISCUSSION",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner.",
            "instruction_vi": "Thảo luận với bạn thi về đề xuất sau",
            "prompt": "Vorschlag: Die Stadt will Parkgebühren verdreifachen und mit dem Geld den Nahverkehr ausbauen.\nDiskutieren Sie: Wer profitiert, wer wird belastet? Welche Ausnahmen wären nötig? Welche Alternativen gibt es? Wie sollte man vorgehen?\nGehen Sie auf die Argumente Ihres Partners ein und formulieren Sie am Ende eine gemeinsame Empfehlung."
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
