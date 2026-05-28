-- V170: Seed Goethe-Zertifikat B1 mock exam
-- Format: Goethe B1 (4 sections: Lesen 25p, Hören 25p, Schreiben 30p, Sprechen 20p = 100p)
-- Pass threshold: 60 points

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES (
  'B1', 'GOETHE',
  'Goethe-Zertifikat B1 – Modellsatz',
  'Đề thi thử Goethe B1 – Chủ đề: Cuộc sống, công việc, xã hội Đức',
  100, 60, 135,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 30,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MATCH",
            "instruction_de": "Lesen Sie den Text und die Aufgaben. Kreuzen Sie an: richtig oder falsch.",
            "instruction_vi": "Đọc thông báo và chọn Richtig/Falsch",
            "context": "E-Mail: Liebe Kollegen, wie ihr wisst, findet die Betriebsfeier dieses Jahr nicht im Dezember, sondern bereits am 15. November statt. Das Restaurant ''Zur alten Post'' hat für uns reserviert. Beginn ist um 19 Uhr. Wer mit dem Auto kommt, findet Parkplätze hinter dem Gebäude. Bitte meldet euch bis zum 5. November bei Frau Schneider an. – Mit freundlichen Grüßen, das Organisationsteam",
            "items": [
              {"id":"L1-1","question":"Die Betriebsfeier findet im Dezember statt.","correct":"falsch","points":1},
              {"id":"L1-2","question":"Die Feier beginnt um 19 Uhr.","correct":"richtig","points":1},
              {"id":"L1-3","question":"Es gibt keine Parkmöglichkeiten.","correct":"falsch","points":1},
              {"id":"L1-4","question":"Man muss sich bis zum 5. November anmelden.","correct":"richtig","points":1},
              {"id":"L1-5","question":"Die Feier findet in einem Restaurant statt.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welche Überschrift passt zu welchem Abschnitt?",
            "instruction_vi": "Ghép tiêu đề phù hợp với đoạn văn",
            "context": "A=Neue Arbeitszeiten in deutschen Unternehmen. B=Homeoffice: Chancen und Herausforderungen. C=Weiterbildung als Karrierefaktor. D=Gesundheit am Arbeitsplatz. E=Digitalisierung verändert Berufsbilder.",
            "items": [
              {"id":"L2-1","person":"Immer mehr Arbeitnehmer können ihre Aufgaben von zu Hause erledigen. Das spart Pendelzeit, erfordert aber auch Selbstdisziplin.","correct":"B","points":1},
              {"id":"L2-2","person":"Wer regelmäßig Kurse besucht und neue Qualifikationen erwirbt, hat bessere Chancen auf eine Beförderung.","correct":"C","points":1},
              {"id":"L2-3","person":"Ergonomische Möbel und kurze Pausen können Rückenschmerzen und Stress am Arbeitsplatz deutlich reduzieren.","correct":"D","points":1},
              {"id":"L2-4","person":"Durch Automatisierung und künstliche Intelligenz entstehen neue Tätigkeiten, während andere verschwinden.","correct":"E","points":1},
              {"id":"L2-5","person":"Viele Firmen bieten flexible Modelle an: Gleitzeit, Vier-Tage-Woche oder individuelle Vereinbarungen.","correct":"A","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài và chọn câu trả lời đúng",
            "context": "Artikel: Das duale Ausbildungssystem in Deutschland gilt weltweit als Vorbild. Jugendliche lernen gleichzeitig in einem Betrieb und in der Berufsschule. Der praktische Teil macht etwa 70% der Ausbildungszeit aus. Die Ausbildungsdauer beträgt je nach Beruf zwei bis dreieinhalb Jahre. Am Ende steht eine Prüfung vor der zuständigen Kammer. Absolventen sind gut auf den Arbeitsmarkt vorbereitet, da sie von Anfang an echte Arbeitserfahrung sammeln.",
            "items": [
              {"id":"L3-1","question":"Wo lernen Auszubildende in Deutschland?","options":["Nur im Betrieb","Nur in der Schule","Im Betrieb und in der Berufsschule","An der Universität"],"correct":"Im Betrieb und in der Berufsschule","points":2},
              {"id":"L3-2","question":"Wie lange dauert eine Ausbildung?","options":["Ein Jahr","Vier Jahre","Zwei bis dreieinhalb Jahre","Fünf Jahre"],"correct":"Zwei bis dreieinhalb Jahre","points":2},
              {"id":"L3-3","question":"Was ist ein Vorteil des deutschen Ausbildungssystems?","options":["Studiengebühren sind niedrig","Absolventen haben früh Praxiserfahrung","Es gibt viele Prüfungen","Die Ausbildung ist kostenlos"],"correct":"Absolventen haben früh Praxiserfahrung","points":2},
              {"id":"L3-4","question":"Welcher Anteil der Ausbildungszeit ist praktisch?","options":["30 Prozent","50 Prozent","70 Prozent","90 Prozent"],"correct":"70 Prozent","points":2},
              {"id":"L3-5","question":"Wo findet die Abschlussprüfung statt?","options":["Im Betrieb","An der Universität","Vor der zuständigen Kammer","In der Berufsschule"],"correct":"Vor der zuständigen Kammer","points":2}
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
            "type": "TRUE_FALSE",
            "instruction_de": "Sie hören Nachrichten. Kreuzen Sie an: richtig oder falsch.",
            "instruction_vi": "Nghe tin tức và chọn Richtig/Falsch",
            "audio_script": "Guten Morgen, hier sind die Nachrichten. Die Bundesregierung hat gestern ein neues Klimaschutzpaket beschlossen. Ab nächstem Jahr sollen alle Neubauten mit erneuerbaren Energien beheizt werden. Im Verkehr kam es heute Morgen auf der A9 zu einem Stau von 15 Kilometern. Betroffen sind Pendler aus dem Münchner Umland. Die Stadtbibliothek lädt am Samstag zu einem kostenlosen Lesetag für Kinder ein. Beginn ist um 10 Uhr.",
            "items": [
              {"id":"H1-1","question":"Das neue Klimapaket betrifft nur alte Gebäude.","correct":"falsch","points":1},
              {"id":"H1-2","question":"Auf der A9 gibt es heute Verkehrsprobleme.","correct":"richtig","points":1},
              {"id":"H1-3","question":"Der Stau ist 15 Kilometer lang.","correct":"richtig","points":1},
              {"id":"H1-4","question":"Der Lesetag in der Bibliothek kostet Eintritt.","correct":"falsch","points":1},
              {"id":"H1-5","question":"Der Lesetag findet am Sonntag statt.","correct":"falsch","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Sie hören ein Gespräch. Wählen Sie die richtige Antwort.",
            "instruction_vi": "Nghe hội thoại và chọn câu trả lời đúng",
            "audio_script": "A: Hast du schon etwas von deiner Bewerbung gehört? B: Ja, ich hatte gestern ein Vorstellungsgespräch. A: Wie war es? B: Ziemlich gut, glaube ich. Sie haben mich nach meiner Erfahrung im Projektmanagement gefragt und ich konnte einige Beispiele nennen. A: Wann bekommst du eine Antwort? B: Die haben gesagt, innerhalb von zwei Wochen. Ich bin gespannt.",
            "items": [
              {"id":"H2-1","question":"Was hat Person B gestern gemacht?","options":["Eine E-Mail geschrieben","Ein Vorstellungsgespräch gehabt","Einen Vertrag unterschrieben","Eine Prüfung abgelegt"],"correct":"Ein Vorstellungsgespräch gehabt","points":2},
              {"id":"H2-2","question":"Wonach wurde Person B gefragt?","options":["Nach dem Gehalt","Nach der Ausbildung","Nach Erfahrung im Projektmanagement","Nach Sprachkenntnissen"],"correct":"Nach Erfahrung im Projektmanagement","points":2},
              {"id":"H2-3","question":"Wann kommt die Antwort?","options":["Sofort","In einer Woche","In zwei Wochen","In einem Monat"],"correct":"In zwei Wochen","points":2},
              {"id":"H2-4","question":"Wie bewertet Person B das Gespräch?","options":["Sehr schlecht","Ziemlich gut","Neutral","Sehr gut"],"correct":"Ziemlich gut","points":2},
              {"id":"H2-5","question":"Was erwartet Person B jetzt?","options":["Einen zweiten Termin","Die Antwort des Unternehmens","Ein Angebot per Post","Keine Reaktion mehr"],"correct":"Die Antwort des Unternehmens","points":2}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 60,
        "max_points": 30,
        "teile": [
          {
            "teil": 1,
            "type": "WRITE_FORMAL",
            "instruction_de": "Schreiben Sie einen formellen Brief oder eine E-Mail (ca. 100 Wörter).",
            "instruction_vi": "Viết thư/email chính thức khoảng 100 từ",
            "prompt": "Sie haben eine Seminarankündigung erhalten. Schreiben Sie eine E-Mail an den Veranstalter: Bedanken Sie sich für die Einladung, erklären Sie warum Sie interessiert sind, fragen Sie nach den Kosten und bestätigen Sie Ihre Teilnahme.",
            "rubric": {"content": 10, "grammar": 10, "vocabulary": 5, "structure": 5},
            "points": 15
          },
          {
            "teil": 2,
            "type": "WRITE_OPINION",
            "instruction_de": "Schreiben Sie Ihre Meinung zu einem Thema (ca. 80 Wörter).",
            "instruction_vi": "Viết ý kiến cá nhân về một chủ đề (~80 từ)",
            "prompt": "In vielen deutschen Städten gibt es Diskussionen über Fahrverbote für Autos in der Innenstadt. Was denken Sie darüber? Nennen Sie zwei Argumente für oder gegen Fahrverbote und begründen Sie Ihre Meinung.",
            "rubric": {"content": 8, "grammar": 7, "vocabulary": 5, "coherence": 5},
            "points": 15
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 20,
        "teile": [
          {
            "teil": 1,
            "type": "SPEAK_PRESENT",
            "instruction_de": "Stellen Sie ein Thema vor (ca. 2–3 Minuten).",
            "instruction_vi": "Trình bày một chủ đề (~2-3 phút)",
            "prompt": "Wählen Sie ein Thema: Ihr Heimatland, Ihr Beruf oder ein Hobby. Beschreiben Sie es und erklären Sie, warum es Ihnen wichtig ist.",
            "rubric": {"pronunciation": 5, "fluency": 5, "content": 5, "grammar": 5},
            "points": 10
          },
          {
            "teil": 2,
            "type": "SPEAK_DISCUSS",
            "instruction_de": "Diskutieren Sie über ein Thema mit dem Prüfer.",
            "instruction_vi": "Thảo luận với giám khảo về một chủ đề",
            "prompt": "Thema: Vor- und Nachteile des öffentlichen Nahverkehrs in Ihrer Stadt. Geben Sie Ihre Meinung und reagieren Sie auf die Argumente des Prüfers.",
            "rubric": {"interaction": 5, "content": 5, "grammar": 5, "vocabulary": 5},
            "points": 10
          }
        ]
      }
    ]
  }',
  TRUE
);
