-- V183: Insert 2 B1-level Goethe mock exam variants
-- Variant 1: Topics — Beruf, Freizeit, Reisen
-- Variant 2: Topics — Umwelt, Gesellschaft, Wohnen

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'B1', 'GOETHE',
  'Goethe Zertifikat B1 – Set 1',
  'Đề thi thử Goethe B1 – Chủ đề: Nghề nghiệp, Giải trí, Du lịch',
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
            "type": "MATCH",
            "instruction_de": "Lesen Sie die Texte. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài và chọn Richtig/Falsch",
            "context": "Artikel: Homeoffice – Fluch oder Segen?\nImmer mehr Arbeitnehmer arbeiten von zu Hause aus. Laut einer Studie arbeitet jeder dritte Beschäftigte in Deutschland mindestens einen Tag pro Woche im Homeoffice. Die meisten Befragten schätzen die Flexibilität und die eingesparte Pendelzeit. Allerdings berichten viele auch von Problemen: fehlende Trennung zwischen Arbeit und Freizeit, Einsamkeit und schlechte Ergonomie. Arbeitgeber haben gemischte Gefühle: Einerseits sparen sie Bürofläche, andererseits befürchten manche einen Rückgang der Produktivität. Experten empfehlen ein hybrides Modell, bei dem Mitarbeiter zwei bis drei Tage im Büro und den Rest zu Hause arbeiten.",
            "items": [
              {"id":"L1-1","question":"Jeder dritte Arbeitnehmer in Deutschland arbeitet manchmal von zu Hause.","correct":"richtig","points":1},
              {"id":"L1-2","question":"Alle Befragten sind unzufrieden mit dem Homeoffice.","correct":"falsch","points":1},
              {"id":"L1-3","question":"Arbeitgeber sparen durch Homeoffice Kosten für Büroräume.","correct":"richtig","points":1},
              {"id":"L1-4","question":"Experten empfehlen, komplett im Homeoffice zu arbeiten.","correct":"falsch","points":1},
              {"id":"L1-5","question":"Fehlende Trennung von Arbeit und Freizeit ist ein genanntes Problem.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welche Stellenanzeige passt zu welcher Person?",
            "instruction_vi": "Ghép mỗi người với tin tuyển dụng phù hợp",
            "context": "A=Grafikdesigner/in gesucht, Kenntnisse in Adobe Creative Suite, Vollzeit, Hamburg. B=Pflegefachkraft für Altersheim, Schichtarbeit, gute Deutschkenntnisse (C1), Berlin. C=IT-Support Techniker, Erfahrung mit Windows-Netzwerken, Teilzeit möglich, München. D=Tourismusmanager/in, Erfahrung in der Reisebranche, Englisch fließend, Frankfurt. E=Grundschullehrer/in, Lehramt-Abschluss erforderlich, Vertretungsstelle, Stuttgart.",
            "items": [
              {"id":"L2-1","person":"Kenji hat Informatik studiert und kennt sich gut mit Netzwerken aus. Er sucht eine Teilzeitstelle.","correct":"C","points":1},
              {"id":"L2-2","person":"Maria hat Lehramt studiert und möchte in Baden-Württemberg unterrichten.","correct":"E","points":1},
              {"id":"L2-3","person":"Ahmed hat Tourismus studiert, spricht fließend Englisch und will in einer Großstadt arbeiten.","correct":"D","points":1},
              {"id":"L2-4","person":"Laura ist ausgebildete Krankenpflegerin und möchte nach Berlin ziehen.","correct":"B","points":1},
              {"id":"L2-5","person":"Tuan ist kreativ, kennt Photoshop und Illustrator und sucht eine Vollzeitstelle.","correct":"A","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài và chọn đáp án đúng",
            "context": "Reisebericht: Mit dem Interrail durch Europa\nLetzten Sommer habe ich drei Wochen lang Europa mit dem Interrail-Pass bereist. Mit einem einzigen Ticket konnte ich in 15 Länder fahren. Die Erfahrung war unvergesslich, aber auch anstrengend. In Paris hatte ich zwei Nächte in einem Hostel gebucht, doch als ich ankam, war die Reservierung verloren gegangen. Zum Glück fand ich schnell eine günstige Alternative in der Nähe. In Wien war das Wetter leider sehr schlecht – es regnete fast die ganze Zeit. Mein Highlight war eindeutig Budapest: Die Bäder, das Nachtleben und das günstige Essen haben mich begeistert. Für das nächste Mal würde ich weniger Städte besuchen und mehr Zeit an einem Ort verbringen.",
            "items": [
              {"id":"L3-1","question":"Wie lange hat die Reise gedauert?","options":{"A":"Zwei Wochen","B":"Drei Wochen","C":"Einen Monat"},"correct":"B","points":1},
              {"id":"L3-2","question":"Was ist in Paris passiert?","options":{"A":"Das Hostel war ausgebucht","B":"Die Reservierung war nicht auffindbar","C":"Der Autor hatte keine Unterkunft gebucht"},"correct":"B","points":1},
              {"id":"L3-3","question":"Wie war das Wetter in Wien?","options":{"A":"Sonnig","B":"Bewölkt","C":"Regnerisch"},"correct":"C","points":1},
              {"id":"L3-4","question":"Was hat dem Autor in Budapest besonders gut gefallen?","options":{"A":"Die Museen","B":"Die Bäder und das Nachtleben","C":"Die Architektur"},"correct":"B","points":1},
              {"id":"L3-5","question":"Was würde der Autor beim nächsten Mal anders machen?","options":{"A":"Mehr Länder besuchen","B":"Weniger Städte und mehr Zeit pro Ort","C":"Einen anderen Pass kaufen"},"correct":"B","points":1}
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
            "instruction_vi": "Nghe các đoạn hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Ich habe gehört, du hast einen neuen Job. B: Ja, ich fange nächste Woche als Projektleiter an. Das Gehalt ist besser, aber ich muss jetzt viel mehr reisen. A: Klingt aufregend!","question":"Was ist die Herausforderung beim neuen Job?","options":{"A":"Das Gehalt ist zu niedrig","B":"Er muss viel reisen","C":"Er kennt die Kollegen nicht"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Guten Tag, hier ist die Anmeldung der Volkshochschule. Ihr Kurs Fotografie für Fortgeschrittene beginnt am 15. Oktober, dienstags von 18 bis 20 Uhr. Bitte bringen Sie Ihre eigene Kamera mit. Das Kursmaterial erhalten Sie vor Ort.","question":"Was sollen die Teilnehmer mitbringen?","options":{"A":"Kursmaterial","B":"Eine eigene Kamera","C":"Ein Skizzenbuch"},"correct":"B","points":1},
              {"id":"H1-3","audio_script":"A: Wir müssen den Termin verschieben. Das Labor hat Verzögerungen gemeldet. B: Wie lange? A: Mindestens zwei Wochen. Der neue Termin wäre also der 3. November. B: Das ist ungünstig, aber wir haben keine andere Wahl.","question":"Warum wird der Termin verschoben?","options":{"A":"Wegen Urlaub","B":"Wegen Verzögerungen im Labor","C":"Wegen eines Feiertags"},"correct":"B","points":1},
              {"id":"H1-4","audio_script":"Herzlich willkommen beim Stadtmuseum Heidelberg. Unsere Sonderausstellung über die Römerzeit ist noch bis Ende des Monats geöffnet. Führungen finden stets samstags um 14 Uhr statt. Der Eintritt für Studenten beträgt drei Euro.","question":"Wann finden die Führungen statt?","options":{"A":"Täglich um 14 Uhr","B":"Samstags um 14 Uhr","C":"Sonntags um 11 Uhr"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"A: Ich überlege, ob ich das Seminar buchen soll. Es dauert ein Wochenende und kostet 250 Euro. B: Was bekommst du dafür? A: Ich lerne Verhandlungsführung. Das ist wichtig für meine Beförderung. B: Dann würde ich es machen.","question":"Warum möchte die Person das Seminar besuchen?","options":{"A":"Aus persönlichem Interesse","B":"Wegen der Beförderung","C":"Wegen des günstigen Preises"},"correct":"B","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe buổi phỏng vấn trên radio và chọn Richtig/Falsch",
            "audio_script": "Moderatorin: Guten Morgen, Herr Brandl. Sie haben ein Start-up gegründet, das nachhaltige Sportkleidung verkauft. Wie kam es dazu? Herr Brandl: Ich habe selbst viel Sport gemacht und gemerkt, dass herkömmliche Sportkleidung oft aus billigem Plastik besteht. Das schadet der Umwelt. Also habe ich zusammen mit einer Freundin ein Unternehmen gegründet, das recycelte Materialien verwendet. Moderatorin: Wie schwierig war der Anfang? Herr Brandl: Sehr schwierig. Wir hatten wenig Kapital und mussten viele Investoren überzeugen. Nach einem Jahr haben wir die ersten Gewinne gemacht. Moderatorin: Und wie sieht es heute aus? Herr Brandl: Wir haben 20 Mitarbeiter und liefern in 10 europäische Länder. Unser Ziel ist es, bis 2027 klimaneutral zu sein.",
            "items": [
              {"id":"H2-1","question":"Herr Brandl hat das Unternehmen alleine gegründet.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Die Kleidung wird aus recycelten Materialien hergestellt.","correct":"richtig","points":1},
              {"id":"H2-3","question":"Die Anfangsphase war einfach, weil sie viel Kapital hatten.","correct":"falsch","points":1},
              {"id":"H2-4","question":"Das Unternehmen macht seit dem zweiten Jahr Gewinne.","correct":"falsch","points":1},
              {"id":"H2-5","question":"Das Ziel ist, bis 2027 klimaneutral zu arbeiten.","correct":"richtig","points":1},
              {"id":"H2-6","question":"Das Unternehmen liefert heute in 10 europäische Länder.","correct":"richtig","points":1}
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
            "type": "FREE_TEXT",
            "instruction_de": "Schreiben Sie einen kurzen Artikel für ein Online-Forum (ca. 80 Wörter).",
            "instruction_vi": "Viết bài đăng diễn đàn ~80 từ về chủ đề sau",
            "prompt": "Thema: Sollte der öffentliche Nahverkehr in Städten kostenlos sein?\nSchreiben Sie: Ihre Meinung, zwei Argumente dafür oder dagegen, und was Sie sich für die Zukunft wünschen.",
            "points": 12,
            "rubric": {"Aufgabenerfüllung":4,"Kohärenz":3,"Wortschatz":3,"Strukturen":2}
          },
          {
            "teil": 2,
            "type": "FREE_TEXT",
            "instruction_de": "Schreiben Sie eine formelle E-Mail (ca. 80 Wörter).",
            "instruction_vi": "Viết email chính thức ~80 từ theo tình huống sau",
            "prompt": "Tình huống: Bạn đã đặt phòng khách sạn cho kỳ nghỉ nhưng cần thay đổi ngày. Viết email cho khách sạn: lý do thay đổi, ngày mới mong muốn, và hỏi về chính sách hoàn tiền nếu có phí phát sinh.",
            "points": 13,
            "rubric": {"Aufgabenerfüllung":5,"Kohärenz":3,"Wortschatz":3,"Strukturen":2}
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
            "type": "SPEAKING_PROMPT",
            "instruction_de": "Sprechen Sie ca. 2 Minuten über das folgende Thema.",
            "instruction_vi": "Nói khoảng 2 phút về chủ đề sau",
            "prompt": "Chủ đề: Digitale Medien und Freizeit\nBeschreiben Sie, wie Sie Ihre Freizeit verbringen. Welche digitalen Medien nutzen Sie? Was sind die Vorteile und Nachteile? Was bevorzugen Sie: digitale oder analoge Aktivitäten?",
            "points": 13,
            "rubric": {"Aussprache":3,"Wortschatz":4,"Grammatik":3,"Inhalt":3}
          },
          {
            "teil": 2,
            "type": "SPEAKING_PROMPT",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner.",
            "instruction_vi": "Thảo luận với partner về tình huống sau",
            "prompt": "Tình huống: Bạn và một người bạn đang lên kế hoạch cho một chuyến đi cuối tuần. Bạn muốn đi leo núi, người bạn muốn đến biển. Thảo luận và tìm ra giải pháp chung. Hãy đưa ra lý do, hỏi ý kiến đối phương, và đề xuất thỏa hiệp.",
            "points": 12,
            "rubric": {"Interaktion":4,"Aussprache":3,"Wortschatz":3,"Grammatik":2}
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
),
(
  'B1', 'GOETHE',
  'Goethe Zertifikat B1 – Set 2',
  'Đề thi thử Goethe B1 – Chủ đề: Môi trường, Xã hội, Nhà ở',
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
            "type": "MATCH",
            "instruction_de": "Lesen Sie den Text. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài và chọn Richtig/Falsch",
            "context": "Artikel: Wohnungsmarkt in deutschen Städten\nDie Mieten in deutschen Großstädten sind in den letzten zehn Jahren stark gestiegen. In München zahlt man heute durchschnittlich 20 Euro pro Quadratmeter – das ist fast doppelt so viel wie vor zehn Jahren. Viele junge Menschen können sich eine eigene Wohnung in der Stadt nicht mehr leisten und ziehen ins Umland. Einige Städte haben Mietpreisbremsen eingeführt, aber Experten sind sich uneinig über deren Wirksamkeit. Neubauprojekte sollen helfen, aber der Bau geht langsam voran. Gleichzeitig steigt die Nachfrage durch Zuzug aus dem Ausland und den Trend zu Einpersonenhaushalten.",
            "items": [
              {"id":"L1-1","question":"Die Mieten in München haben sich in zehn Jahren verdoppelt.","correct":"richtig","points":1},
              {"id":"L1-2","question":"Alle Experten halten die Mietpreisbremse für sehr wirksam.","correct":"falsch","points":1},
              {"id":"L1-3","question":"Viele junge Menschen ziehen wegen der hohen Mieten ins Umland.","correct":"richtig","points":1},
              {"id":"L1-4","question":"Die Nachfrage nach Wohnungen sinkt wegen weniger Zuzug.","correct":"falsch","points":1},
              {"id":"L1-5","question":"Neubauprojekte werden schnell umgesetzt.","correct":"falsch","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welches Wohnungsangebot passt zu welcher Person?",
            "instruction_vi": "Ghép mỗi người với căn hộ phù hợp",
            "context": "A=2-Zimmer-Wohnung, 55qm, ruhige Lage, Erdgeschoss, 800€ warm, Hauskatze erlaubt, Nähe Stadtpark. B=WG-Zimmer 18qm, möbliert, Gemeinschaftsküche, 450€ warm, ideal für Studenten, Köln-Zentrum. C=Penthouse 4 Zimmer, 140qm, Dachterrasse, Tiefgarage, 2.800€ kalt, exklusiv, Frankfurt. D=Familienhaus 5 Zimmer, Garten, 180qm, ruhige Siedlung, 1.600€ kalt, Schulen in der Nähe. E=Loft 70qm, offener Grundriss, Industriecharme, Heimarbeit ideal, keine Haustiere, 1.100€.",
            "items": [
              {"id":"L2-1","person":"Familie Müller hat zwei Kinder im Schulalter und sucht ein Haus mit Garten.","correct":"D","points":1},
              {"id":"L2-2","person":"Student Jonas sucht ein günstiges möbliertes Zimmer in Köln.","correct":"B","points":1},
              {"id":"L2-3","person":"Frau Weber arbeitet freiberuflich von zu Hause, hat keine Haustiere und braucht Platz.","correct":"E","points":1},
              {"id":"L2-4","person":"Herr Gründer ist Manager, schätzt Luxus und braucht eine Tiefgarage.","correct":"C","points":1},
              {"id":"L2-5","person":"Seniorin Hildegard sucht eine ruhige 2-Zimmer-Wohnung und hat eine Katze.","correct":"A","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài và chọn đáp án đúng",
            "context": "Bericht: Freiwilligenarbeit boomt in Deutschland\nLaut dem Deutschen Freiwilligensurvey engagieren sich 40 Prozent der Deutschen ehrenamtlich. Besonders beliebt ist Freiwilligenarbeit im Sport, in der Kultur und in sozialen Einrichtungen. Auffällig ist, dass auch immer mehr Unternehmen ihre Mitarbeiter für ehrenamtliche Tätigkeiten freistellen. Dieser Trend, bekannt als Corporate Volunteering, wird von Arbeitgebern genutzt, um die Teamarbeit zu stärken und das Image des Unternehmens zu verbessern. Experten warnen jedoch, dass echtes ehrenamtliches Engagement nicht durch betriebliche Interessen ersetzt werden sollte. Junge Menschen zwischen 14 und 30 Jahren sind überdurchschnittlich aktiv, besonders in den Bereichen Sport und digitale Projekte.",
            "items": [
              {"id":"L3-1","question":"Wie viel Prozent der Deutschen engagieren sich ehrenamtlich?","options":{"A":"20 Prozent","B":"40 Prozent","C":"60 Prozent"},"correct":"B","points":1},
              {"id":"L3-2","question":"Was versteht man unter Corporate Volunteering?","options":{"A":"Freiwilligenarbeit in der Natur","B":"Betriebliche Förderung von Ehrenamt","C":"Staatlich finanziertes Engagement"},"correct":"B","points":1},
              {"id":"L3-3","question":"Warum nutzen Unternehmen Corporate Volunteering?","options":{"A":"Um Steuern zu sparen","B":"Um Teamarbeit und Image zu verbessern","C":"Weil es gesetzlich vorgeschrieben ist"},"correct":"B","points":1},
              {"id":"L3-4","question":"Welche Altersgruppe ist besonders aktiv?","options":{"A":"30 bis 50 Jahre","B":"Über 60 Jahre","C":"14 bis 30 Jahre"},"correct":"C","points":1},
              {"id":"L3-5","question":"Wovor warnen Experten?","options":{"A":"Vor zu viel Freiwilligenarbeit insgesamt","B":"Dass betriebliche Interessen echtes Engagement ersetzen","C":"Vor Online-Engagement"},"correct":"B","points":1}
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
            "instruction_vi": "Nghe các đoạn hội thoại ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Hast du schon von der neuen Recycling-App gehört? B: Nein, was kann die? A: Du scannst den Barcode eines Produkts und siehst, wie du es richtig entsorgen sollst. B: Das ist praktisch! Ich schmeiße immer alles in den falschen Müll.","question":"Was kann die App?","options":{"A":"Produkte bestellen","B":"Entsorgungs-Hinweise geben","C":"Recyclingcenter finden"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Sehr geehrte Mieter, wir möchten Sie informieren, dass die Heizungsanlage am Donnerstag, den 14. März, von 9 bis 13 Uhr gewartet wird. In dieser Zeit ist die Heizung außer Betrieb. Bitte sorgen Sie für ausreichend Wärme in Ihrer Wohnung. Mit freundlichen Grüßen, die Hausverwaltung.","question":"Wann wird die Heizung gewartet?","options":{"A":"Mittwoch, 9-13 Uhr","B":"Donnerstag, 9-13 Uhr","C":"Donnerstag, 13-17 Uhr"},"correct":"B","points":1},
              {"id":"H1-3","audio_script":"A: Wie war dein Vorstellungsgespräch? B: Ganz gut, glaube ich. Sie haben mich nach meiner Berufserfahrung gefragt und nach meinen Stärken. A: Hast du die Stelle bekommen? B: Noch nicht. Ich soll nächste Woche zur zweiten Runde kommen.","question":"Was hat die Person beim Gespräch besprochen?","options":{"A":"Gehaltsvorstellungen","B":"Berufserfahrung und Stärken","C":"Arbeitszeiten"},"correct":"B","points":1},
              {"id":"H1-4","audio_script":"Liebe Hörerinnen und Hörer, wir berichten über den neuen Stadtpark im Norden. Er wird nächsten Frühling eröffnet und bietet Spielplätze, einen kleinen See und Laufwege. Der Eintritt ist kostenlos. Die Finanzierung kommt zu 60 Prozent aus EU-Fördermitteln.","question":"Wer finanziert den Park größtenteils?","options":{"A":"Die Stadt","B":"Die EU","C":"Private Spender"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"A: Ich muss bis Ende der Woche den Bericht fertig haben, aber ich schaffe das nicht alleine. B: Kann ich helfen? Ich habe Erfahrung mit solchen Analysen. A: Das wäre super! Könnten wir uns morgen früh treffen? B: Ja, um 8 Uhr passt mir gut.","question":"Wann wollen sie sich treffen?","options":{"A":"Heute Nachmittag","B":"Morgen um 8 Uhr","C":"Ende der Woche"},"correct":"B","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe podcast về môi trường và chọn Richtig/Falsch",
            "audio_script": "Moderatorin: Willkommen beim Umwelt-Podcast. Heute spreche ich mit der Biologin Dr. Krause über Insektensterben. Dr. Krause, wie schlimm ist die Situation wirklich? Dr. Krause: Die Lage ist ernst. Studien zeigen, dass die Insektenbiomasse in Europa in den letzten 30 Jahren um 75 Prozent zurückgegangen ist. Das ist alarmierend. Moderatorin: Was sind die Hauptursachen? Dr. Krause: Vor allem intensive Landwirtschaft und der Einsatz von Pestiziden. Aber auch Lichtverschmutzung und der Verlust von natürlichen Lebensräumen spielen eine Rolle. Moderatorin: Was kann jeder Einzelne tun? Dr. Krause: Insektenfreundliche Pflanzen im Garten, keine Pestizide im Privatbereich, und politisch für eine nachhaltigere Landwirtschaft eintreten.",
            "items": [
              {"id":"H2-1","question":"Die Insektenbiomasse ist um 75 Prozent gestiegen.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Pestizide sind eine der Hauptursachen für das Insektensterben.","correct":"richtig","points":1},
              {"id":"H2-3","question":"Lichtverschmutzung spielt keine Rolle.","correct":"falsch","points":1},
              {"id":"H2-4","question":"Dr. Krause ist Biologin.","correct":"richtig","points":1},
              {"id":"H2-5","question":"Privatpersonen können durch insektenfreundliche Pflanzen helfen.","correct":"richtig","points":1},
              {"id":"H2-6","question":"Der Rückgang der Insekten begann vor 10 Jahren.","correct":"falsch","points":1}
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
            "type": "FREE_TEXT",
            "instruction_de": "Schreiben Sie einen Beitrag für ein Diskussionsforum (ca. 80 Wörter).",
            "instruction_vi": "Viết bài diễn đàn ~80 từ về chủ đề sau",
            "prompt": "Chủ đề: Sollte man Autos aus Innenstädten verbannen?\nNêu quan điểm của bạn, đưa ra hai lý do ủng hộ hoặc phản đối, và đề xuất một giải pháp thay thế nếu cần.",
            "points": 12,
            "rubric": {"Aufgabenerfüllung":4,"Kohärenz":3,"Wortschatz":3,"Strukturen":2}
          },
          {
            "teil": 2,
            "type": "FREE_TEXT",
            "instruction_de": "Schreiben Sie eine formelle Beschwerde (ca. 80 Wörter).",
            "instruction_vi": "Viết thư khiếu nại chính thức ~80 từ theo tình huống sau",
            "prompt": "Tình huống: Bạn đã mua một chiếc máy tính xách tay qua mạng. Nó hoạt động không đúng như mô tả. Viết thư khiếu nại: mô tả vấn đề, yêu cầu hoàn trả hoặc đổi hàng, và nêu thời hạn bạn muốn được phản hồi.",
            "points": 13,
            "rubric": {"Aufgabenerfüllung":5,"Kohärenz":3,"Wortschatz":3,"Strukturen":2}
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
            "type": "SPEAKING_PROMPT",
            "instruction_de": "Sprechen Sie ca. 2 Minuten über das folgende Thema.",
            "instruction_vi": "Nói khoảng 2 phút về chủ đề sau",
            "prompt": "Chủ đề: Leben in der Stadt oder auf dem Land?\nMô tả ưu và nhược điểm của cả hai. Bạn thích sống ở đâu hơn và tại sao? Bạn nghĩ xu hướng trong tương lai sẽ như thế nào?",
            "points": 13,
            "rubric": {"Aussprache":3,"Wortschatz":4,"Grammatik":3,"Inhalt":3}
          },
          {
            "teil": 2,
            "type": "SPEAKING_PROMPT",
            "instruction_de": "Diskutieren Sie mit Ihrem Partner.",
            "instruction_vi": "Thảo luận với partner về tình huống sau",
            "prompt": "Tình huống: Bạn và người bạn cùng phòng muốn trang trí lại căn hộ chung. Bạn muốn phong cách tối giản, bạn cùng phòng muốn phong cách ấm cúng với nhiều cây cối. Thảo luận, chia sẻ ý kiến, hỏi đối phương, và tìm ra giải pháp phù hợp cho cả hai.",
            "points": 12,
            "rubric": {"Interaktion":4,"Aussprache":3,"Wortschatz":3,"Grammatik":2}
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
