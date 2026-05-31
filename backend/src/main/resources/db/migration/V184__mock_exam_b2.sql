-- V184: Insert 2 B2-level Goethe mock exam variants
-- Variant 1: Topics — Technologie, Wirtschaft, Gesundheitssystem
-- Variant 2: Topics — Globalisierung, Bildung, Medien

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'B2', 'GOETHE',
  'Goethe Zertifikat B2 – Set 1',
  'Đề thi thử Goethe B2 – Chủ đề: Công nghệ, Kinh tế, Y tế',
  100, 60, 100,
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
            "instruction_de": "Lesen Sie den Text. Welche Aussagen entsprechen dem Text (richtig) oder nicht (falsch)?",
            "instruction_vi": "Đọc bài và chọn Richtig/Falsch",
            "context": "Feuilleton: Künstliche Intelligenz im Gesundheitswesen\nDie Integration von KI in die Medizin schreitet mit bemerkenswerter Geschwindigkeit voran. Algorithmen erkennen Tumoren auf Röntgenbildern mit einer Genauigkeit, die manche erfahrene Radiologen übertrifft. KI-gestützte Diagnosesysteme sind in der Lage, aus Patientendaten Muster zu erkennen, die dem menschlichen Auge verborgen bleiben. Kritiker mahnen jedoch zur Vorsicht: Die Abhängigkeit von algorithmischen Entscheidungen berge das Risiko, dass Ärzte ihre diagnostische Kompetenz verkümmern lassen. Zudem wirft der Einsatz von Patientendaten erhebliche datenschutzrechtliche Fragen auf. Befürworter hingegen argumentieren, dass KI als Unterstützungswerkzeug – nicht als Ersatz – den medizinischen Fortschritt demokratisieren könne, indem hochwertige Diagnostik auch in ressourcenarmen Regionen zugänglich werde.",
            "items": [
              {"id":"L1-1","question":"KI-Algorithmen können Tumoren manchmal zuverlässiger erkennen als erfahrene Radiologen.","correct":"richtig","points":1},
              {"id":"L1-2","question":"Alle Experten begrüßen den KI-Einsatz in der Medizin ohne Vorbehalte.","correct":"falsch","points":1},
              {"id":"L1-3","question":"Datenschutzrechtliche Fragen spielen beim KI-Einsatz keine Rolle.","correct":"falsch","points":1},
              {"id":"L1-4","question":"Befürworter sehen KI als Ergänzung, nicht als vollständigen Ersatz für Ärzte.","correct":"richtig","points":1},
              {"id":"L1-5","question":"KI könnte die Diagnostik auch in Ländern mit wenig Ressourcen verbessern.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welcher Zeitungsartikel passt zu welcher Frage?",
            "instruction_vi": "Ghép mỗi câu hỏi với đoạn báo phù hợp",
            "context": "A=Bericht über steigende Energiepreise und deren Auswirkungen auf Privathaushalte und Industrie. B=Interview mit einem Neurowissenschaftler über die Auswirkungen von Social-Media-Nutzung auf das Gehirn Jugendlicher. C=Analyse der Gründe für den Fachkräftemangel im deutschen Pflegesektor und mögliche politische Lösungsansätze. D=Reportage über den wachsenden Markt für Second-Hand-Mode und den Trend zur Kreislaufwirtschaft in der Textilindustrie. E=Kommentar über die Notwendigkeit einer Reform des deutschen Bildungssystems angesichts digitaler Transformation.",
            "items": [
              {"id":"L2-1","person":"Mich interessiert, ob Smartphones das Denken junger Menschen verändert.","correct":"B","points":1},
              {"id":"L2-2","person":"Ich möchte verstehen, warum es so wenig Pflegepersonal gibt und was die Politik dagegen tut.","correct":"C","points":1},
              {"id":"L2-3","person":"Ich suche Informationen über nachhaltige Alternativen zur Fast Fashion.","correct":"D","points":1},
              {"id":"L2-4","person":"Mich beschäftigt, ob Schulen und Unis fit für die Zukunft sind.","correct":"E","points":1},
              {"id":"L2-5","person":"Ich will wissen, wie Strompreiserhöhungen Familien und Betriebe treffen.","correct":"A","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài và chọn đáp án đúng",
            "context": "Essay: Der Wert der Stille in einer lauten Welt\nIn einer Zeit, in der Reizüberflutung zur Normalität geworden ist, gewinnt die Stille als kulturelles und therapeutisches Gut an Bedeutung. Neurowissenschaftliche Studien belegen, dass regelmäßige Phasen der Stille das Hippocampus-Volumen vergrößern – jenen Hirnbereich, der für Gedächtnis und Lernen zuständig ist. Paradoxerweise haben viele Menschen Unbehagen mit echter Stille: Sie greifen reflexartig zum Smartphone, sobald keine auditive Reize vorhanden sind. Dieses Phänomen, von Psychologen als Geräuschabhängigkeit bezeichnet, spiegelt eine tiefere Unfähigkeit wider, mit sich selbst zu sein. Kontemplative Traditionen – vom Buddhismus bis zur christlichen Mystik – haben seit Jahrhunderten auf die transformierende Kraft der Stille hingewiesen. Moderne Achtsamkeitsbewegungen greifen dieses Wissen auf, ohne jedoch stets den kulturellen Kontext zu berücksichtigen.",
            "items": [
              {"id":"L3-1","question":"Was zeigen neurowissenschaftliche Studien über Stille?","options":{"A":"Sie verkleinert das Gehirn","B":"Sie vergrößert ein gedächtnisrelevantes Hirnareal","C":"Sie hat keinen messbaren Effekt"},"correct":"B","points":1},
              {"id":"L3-2","question":"Was ist mit Geräuschabhängigkeit gemeint?","options":{"A":"Eine Schwerhörigkeit","B":"Das reflexartige Suchen nach Geräuschen","C":"Eine Vorliebe für Musik"},"correct":"B","points":1},
              {"id":"L3-3","question":"Welche Kritik wird an modernen Achtsamkeitsbewegungen geübt?","options":{"A":"Sie ignorieren wissenschaftliche Erkenntnisse","B":"Sie berücksichtigen nicht immer den kulturellen Kontext","C":"Sie fördern Geräuschabhängigkeit"},"correct":"B","points":1},
              {"id":"L3-4","question":"Welche Traditionen haben die Kraft der Stille früh erkannt?","options":{"A":"Moderne Sportbewegungen","B":"Kontemplative religiöse Traditionen","C":"Industrielle Arbeitsbewegungen"},"correct":"B","points":1},
              {"id":"L3-5","question":"Wie reagieren viele Menschen auf Stille?","options":{"A":"Sie entspannen sich sofort","B":"Sie greifen zum Smartphone","C":"Sie schlafen ein"},"correct":"B","points":1}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_vi": "Nghe các đoạn hội thoại và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Die Ergebnisse der Studie sind eindeutig: Kurzarbeit hat während der Krise mehr Arbeitsplätze gesichert als ursprünglich angenommen. B: Das überrascht mich. Ich dachte, die Unternehmen hätten trotzdem massiv Personal abgebaut. A: Nein, das Gegenteil. Die staatliche Förderung war entscheidend. B: Was folgt daraus für künftige Krisen? A: Dass solche Instrumente dauerhaft bereitgehalten werden sollten.","question":"Was war die Haupterkenntnis der Studie?","options":{"A":"Unternehmen haben trotz Kurzarbeit viel Personal entlassen","B":"Kurzarbeit hat mehr Jobs gesichert als erwartet","C":"Die staatliche Förderung war unzureichend"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Sehr geehrte Damen und Herren, die Hauptversammlung unseres Unternehmens wird in diesem Jahr nicht wie gewohnt im Juni, sondern aufgrund von Renovierungsarbeiten im Dezembergebäude auf den 14. September verschoben. Bitte merken Sie sich diesen Termin vor. Weitere Details erhalten Sie per Post.","question":"Warum wird die Versammlung verschoben?","options":{"A":"Wegen eines Feiertags","B":"Wegen Renovierungsarbeiten","C":"Wegen personeller Engpässe"},"correct":"B","points":1},
              {"id":"H1-3","audio_script":"A: Ich finde es problematisch, dass Algorithmen jetzt über Kreditvergabe entscheiden. B: Warum? Sie sind doch objektiver als Menschen. A: Theoretisch. Aber wenn die Trainingsdaten voreingenommen sind, reproduziert der Algorithmus diese Vorurteile. B: Guter Punkt. Das ist mir so nicht bewusst gewesen. A: Deswegen brauchen wir unbedingt Transparenz und Regulierung.","question":"Was ist das Kernproblem beim Einsatz von Algorithmen laut Sprecher A?","options":{"A":"Algorithmen sind zu langsam","B":"Vorurteile aus Trainingsdaten werden reproduziert","C":"Algorithmen sind zu teuer"},"correct":"B","points":1},
              {"id":"H1-4","audio_script":"Für unser Forschungsprojekt zur urbanen Mobilität suchen wir Teilnehmer zwischen 25 und 55 Jahren, die täglich mit öffentlichen Verkehrsmitteln zur Arbeit fahren. Die Studie dauert vier Wochen und beinhaltet eine App-Nutzung und zwei kurze Interviews. Aufwandsentschädigung: 80 Euro. Interessenten melden sich bitte über unsere Website.","question":"Wen suchen die Forscher?","options":{"A":"Autofahrer zwischen 18 und 25 Jahren","B":"Berufstätige ÖPNV-Nutzer zwischen 25 und 55 Jahren","C":"Rentner, die öffentliche Verkehrsmittel nutzen"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"A: Ich habe gerade den Jahresbericht gelesen. Unsere Exportzahlen sind im zweiten Quartal um 12 Prozent gestiegen. B: Das ist erstaunlich angesichts der schwachen Nachfrage in Asien. A: Ja, aber wir haben neue Märkte in Südamerika erschlossen. Das hat den Rückgang kompensiert. B: Beeindruckend. Das sollten wir beim nächsten Aktionärstreffen hervorheben.","question":"Wie haben die Exportzahlen sich entwickelt?","options":{"A":"Um 12 Prozent gesunken","B":"Um 12 Prozent gestiegen","C":"Stagniert"},"correct":"B","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe bài thảo luận học thuật và chọn Richtig/Falsch",
            "audio_script": "Professorin: Herzlich willkommen zum Symposium über digitale Demokratie. Mein erster Gast ist Dr. Hagen, Politikwissenschaftler. Dr. Hagen, inwiefern verändern soziale Medien den demokratischen Prozess? Dr. Hagen: Die Auswirkungen sind ambivalent. Einerseits ermöglichen Plattformen eine bisher unerreichte politische Partizipation und Mobilisierung. Andererseits begünstigen sie die Entstehung von Echokammern, in denen Nutzer nur noch gleichgesinnte Meinungen konsumieren. Professorin: Welche Rolle spielen dabei Algorithmen? Dr. Hagen: Eine zentrale. Empfehlungsalgorithmen optimieren auf Engagement, was polarisierenden Inhalten zugutekommt. Falschinformationen verbreiten sich in diesen Systemen schneller als sachliche Richtigstellungen. Professorin: Welche regulatorischen Ansätze sehen Sie als vielversprechend an? Dr. Hagen: Transparenzpflichten für Algorithmen und eine unabhängige Plattformaufsicht wären sinnvolle erste Schritte.",
            "items": [
              {"id":"H2-1","question":"Dr. Hagen sieht die Auswirkungen sozialer Medien auf die Demokratie als rein positiv.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Echokammern entstehen, wenn Nutzer nur gleichgesinnte Meinungen sehen.","correct":"richtig","points":1},
              {"id":"H2-3","question":"Algorithmen optimieren auf sachliche Inhalte.","correct":"falsch","points":1},
              {"id":"H2-4","question":"Falschinformationen verbreiten sich langsamer als Richtigstellungen.","correct":"falsch","points":1},
              {"id":"H2-5","question":"Dr. Hagen befürwortet Transparenzpflichten für Algorithmen.","correct":"richtig","points":1},
              {"id":"H2-6","question":"Soziale Medien ermöglichen laut Dr. Hagen neue Formen politischer Teilhabe.","correct":"richtig","points":1}
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
            "instruction_de": "Schreiben Sie einen argumentativen Aufsatz (ca. 150 Wörter).",
            "instruction_vi": "Viết bài luận lập luận ~150 từ về chủ đề sau",
            "prompt": "Thema: Sollte das Homeoffice gesetzlich als Recht für alle Arbeitnehmer verankert werden?\nStrukturieren Sie Ihren Aufsatz: Einleitung mit Positionierung, zwei Argumente pro und contra, Gegenargument entkräften, Schlussfolgerung. Verwenden Sie akademisch-neutrale Sprache und verknüpfende Ausdrücke.",
            "points": 12,
            "rubric": {"Aufgabenerfüllung":4,"Argumentationsstruktur":3,"Wortschatz":3,"Grammatik":2}
          },
          {
            "teil": 2,
            "type": "FREE_TEXT",
            "instruction_de": "Schreiben Sie eine formelle E-Mail mit Einwand (ca. 120 Wörter).",
            "instruction_vi": "Viết email chính thức ~120 từ theo tình huống sau",
            "prompt": "Tình huống: Bạn là trưởng nhóm dự án. Sếp của bạn muốn rút ngắn thời gian dự án thêm 3 tuần để tiết kiệm chi phí. Viết email phản đối: giải thích tại sao điều này gây rủi ro cho chất lượng, đề xuất phương án thay thế (ví dụ: cắt giảm một tính năng thứ yếu), và yêu cầu một cuộc họp để thảo luận.",
            "points": 13,
            "rubric": {"Aufgabenerfüllung":5,"Argumentationsstruktur":3,"Wortschatz":3,"Grammatik":2}
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
            "instruction_de": "Halten Sie einen kurzen Vortrag (ca. 3 Minuten).",
            "instruction_vi": "Trình bày ~3 phút về chủ đề sau",
            "prompt": "Thema: Die Vor- und Nachteile der Digitalisierung des Gesundheitswesens\nStrukturieren Sie Ihren Vortrag: kurze Einleitung, Vorteile (mind. 2 mit Beispielen), Nachteile (mind. 2 mit Beispielen), persönliche Schlussfolgerung. Nutzen Sie akademisches Vokabular und Übergänge zwischen Argumenten.",
            "points": 13,
            "rubric": {"Aussprache":3,"Wortschatz":4,"Grammatik":3,"Struktur":3}
          },
          {
            "teil": 2,
            "type": "SPEAKING_PROMPT",
            "instruction_de": "Führen Sie eine Verhandlung.",
            "instruction_vi": "Thực hiện một cuộc thương lượng theo tình huống sau",
            "prompt": "Tình huống: Bạn là đại diện của một công ty start-up đang đàm phán với một nhà đầu tư tiềm năng. Nhà đầu tư muốn 40% cổ phần cho khoản đầu tư 200.000 Euro; bạn chỉ muốn nhượng tối đa 20%. Thương lượng: trình bày giá trị công ty, phản bác yêu cầu với lập luận chắc chắn, đề xuất thỏa hiệp, và kết thúc cuộc đàm phán một cách chuyên nghiệp.",
            "points": 12,
            "rubric": {"Argumentationsstruktur":4,"Aussprache":3,"Wortschatz":3,"Interaktion":2}
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
),
(
  'B2', 'GOETHE',
  'Goethe Zertifikat B2 – Set 2',
  'Đề thi thử Goethe B2 – Chủ đề: Toàn cầu hóa, Giáo dục, Truyền thông',
  100, 60, 100,
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
            "instruction_de": "Lesen Sie den Text. Sind die Aussagen richtig oder falsch?",
            "instruction_vi": "Đọc bài và chọn Richtig/Falsch",
            "context": "Kommentar: Die Ambivalenz der Globalisierung\nDie Globalisierung hat zweifelsohne zu materiellem Wohlstand geführt – Güter, Ideen und Menschen bewegen sich schneller als je zuvor. Gleichzeitig hat sie bestehende Ungleichheiten verschärft: Während Konzerne ihre Produktion in Niedriglohnländer verlagern, verlieren Arbeitnehmer in Industrienationen ihre Arbeitsplätze. Kulturelle Homogenisierung ist ein weiteres Spannungsfeld: Lokale Traditionen geraten unter den Einfluss globaler Konsumkulturen, vorwiegend westlicher Prägung. Andererseits ermöglicht kultureller Austausch Bereicherung und Verständigung. Die COVID-19-Pandemie hat die Verwundbarkeit hyperglobalisierter Lieferketten offengelegt und eine Debatte über strategische Autonomie entfacht. Eine reflexive Globalisierungspolitik müsste daher Effizienz gegen Resilienz abwägen.",
            "items": [
              {"id":"L1-1","question":"Die Globalisierung hat ausschließlich positive Auswirkungen auf die Wirtschaft.","correct":"falsch","points":1},
              {"id":"L1-2","question":"Die Verlagerung von Produktion in Niedriglohnländer kann Jobverluste in Industrienationen verursachen.","correct":"richtig","points":1},
              {"id":"L1-3","question":"Die Pandemie hat gezeigt, dass globale Lieferketten sehr robust sind.","correct":"falsch","points":1},
              {"id":"L1-4","question":"Kultureller Austausch kann laut Text auch positiv sein.","correct":"richtig","points":1},
              {"id":"L1-5","question":"Eine kluge Globalisierungspolitik sollte Effizienz und Resilienz in Balance bringen.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welcher Fachaufsatz beantwortet welche Forschungsfrage?",
            "instruction_vi": "Ghép mỗi câu hỏi nghiên cứu với bài học thuật phù hợp",
            "context": "A=Untersuchung der Korrelation zwischen sozialer Herkunft und Bildungserfolg in Deutschland anhand von PISA-Daten. B=Analyse der psychologischen Mechanismen hinter Desinformationsresistenz und Medienkompetenz. C=Vergleich von Lernplattformen hinsichtlich ihrer Effektivität beim Erwerb von Fremdsprachen. D=Quantitative Studie über den Zusammenhang zwischen Körperbewusstsein und schulischer Leistung bei Teenagern. E=Fallstudie über die Implementierung von KI-gestützten Tutoring-Systemen an deutschen Gymnasien.",
            "items": [
              {"id":"L2-1","person":"Meine Forschung fragt: Warum glauben manche Menschen Fake News, andere aber nicht?","correct":"B","points":1},
              {"id":"L2-2","person":"Ich untersuche, ob Kinder aus einkommensschwachen Familien in Deutschland schlechtere Schulabschlüsse machen.","correct":"A","points":1},
              {"id":"L2-3","person":"Ich vergleiche, ob KI-Tutoren besser als Apps beim Sprachenlernen sind.","correct":"C","points":1},
              {"id":"L2-4","person":"Mich interessiert, ob Sport und Körpergefühl die schulische Leistung von Teenagern beeinflussen.","correct":"D","points":1},
              {"id":"L2-5","person":"Ich analysiere ein konkretes Schulprojekt, das KI zum Erklären von Schulstoff einsetzt.","correct":"E","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE",
            "instruction_de": "Lesen Sie den Text und wählen Sie die richtige Antwort.",
            "instruction_vi": "Đọc bài và chọn đáp án đúng",
            "context": "Feuilleton: Der Journalismus in der Krise\nDer klassische Qualitätsjournalismus steht unter enormem Druck. Auflagenschwund, Abonnementrückgänge und die Dominanz algorithmisch kuratierter Nachrichtenangebote höhlen die wirtschaftliche Basis traditioneller Medienhäuser aus. Viele Redaktionen reagieren mit Kostensenkungen, die unweigerlich auf Kosten der journalistischen Tiefe gehen. Gleichzeitig prosperieren Boulevard- und Klickköder-Formate, die auf Empörung statt auf Aufklärung setzen. Medienwissenschaftler warnen vor einer epistemischen Krise: Wenn glaubwürdiger Qualitätsjournalismus nicht mehr finanziert werden kann, entstehen Informationsdefizite, die anfällig für Manipulation machen. Mögliche Antworten reichen von Subventionsmodellen über Stiftungsfinanzierung bis hin zu Plattformabgaben. Entscheidend sei, so die Mehrheit der Experten, dass redaktionelle Unabhängigkeit dabei gewahrt bleibe.",
            "items": [
              {"id":"L3-1","question":"Was ist laut Text eine der Hauptursachen für die Krise des Qualitätsjournalismus?","options":{"A":"Zu wenig Leserbriefe","B":"Algorithmisch dominierte Nachrichtenangebote","C":"Zu hohe Journalistengehälter"},"correct":"B","points":1},
              {"id":"L3-2","question":"Was kritisieren Medienwissenschaftler?","options":{"A":"Dass Journalisten zu viel recherchieren","B":"Eine drohende epistemische Krise durch Informationsdefizite","C":"Zu viele Subventionen für Medien"},"correct":"B","points":1},
              {"id":"L3-3","question":"Was betonen Experten bei Finanzierungsmodellen als unverzichtbar?","options":{"A":"Staatliche Kontrolle der Inhalte","B":"Redaktionelle Unabhängigkeit","C":"Niedrige Abopreise"},"correct":"B","points":1},
              {"id":"L3-4","question":"Welche Formate profitieren von der aktuellen Entwicklung?","options":{"A":"Investigativer Journalismus","B":"Boulevard- und Klickköder-Formate","C":"Wissenschaftsjournalismus"},"correct":"B","points":1},
              {"id":"L3-5","question":"Welche Finanzierungsform wird im Text NICHT erwähnt?","options":{"A":"Stiftungsfinanzierung","B":"Werbeeinnahmen aus Social Media","C":"Plattformabgaben"},"correct":"B","points":1}
            ]
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 25,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_vi": "Nghe các đoạn hội thoại và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"A: Die Konferenz war nicht das, was ich erwartet hatte. B: Inwiefern? A: Die Keynote war gut, aber die Workshops waren zu theoretisch. Es fehlten konkrete Praxisbeispiele. B: Das höre ich öfter. Viele Teilnehmer wollen wissen, was sie morgen im Büro anders machen können. A: Genau. Nächstes Jahr werde ich gezielter auswählen.","question":"Was kritisiert Sprecher A an den Workshops?","options":{"A":"Sie waren zu teuer","B":"Sie waren zu theoretisch ohne Praxisbeispiele","C":"Sie dauerten zu lange"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Hier ist eine Nachricht von der Personalabteilung: Das neue Gehaltsmodell tritt ab dem 1. April in Kraft. Alle Mitarbeiter erhalten eine Grundgehaltserhöhung von 3 Prozent. Zusätzlich wird eine leistungsbezogene Prämie von bis zu 10 Prozent eingeführt. Details finden Sie im Intranet unter Personalentwicklung.","question":"Was ändert sich am Gehaltsmodell?","options":{"A":"Nur eine Grundgehaltserhöhung","B":"Grundgehaltserhöhung plus leistungsbezogene Prämie","C":"Nur eine leistungsbezogene Prämie"},"correct":"B","points":1},
              {"id":"H1-3","audio_script":"A: Ich bin skeptisch, ob die neue Lehrplanreform wirklich etwas bringt. B: Warum? A: Weil der Fokus auf digitale Kompetenz gut gemeint ist, aber Lehrer die nötige Fortbildung fehlt. B: Das stimmt. Ohne Investitionen in die Lehrerbildung bleibt es beim guten Willen. A: Außerdem brauchen die Schulen die technische Infrastruktur.","question":"Was ist laut Sprecher A das Hauptproblem der Reform?","options":{"A":"Fehlende staatliche Finanzierung","B":"Mangelnde Lehrerfortbildung und Infrastruktur","C":"Ablehnung durch Schüler"},"correct":"B","points":1},
              {"id":"H1-4","audio_script":"Das Stadtarchiv lädt ein zur Ausstellung: 100 Jahre Rundfunk. Entdecken Sie die Geschichte des Radios – von den ersten Sendeanlagen bis zur digitalen Revolution. Eröffnung am Donnerstag, 19 Uhr, Eintritt frei. Die Ausstellung läuft bis 30. September.","question":"Wann endet die Ausstellung?","options":{"A":"Am 30. August","B":"Am 30. September","C":"Am 30. Oktober"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"A: Hast du die Ergebnisse der Befragung ausgewertet? B: Ja, erstaunlich. 68 Prozent der Befragten nutzen täglich mehr als drei Nachrichtenquellen, aber nur 22 Prozent können zuverlässig Falschinformationen erkennen. A: Das ist erschreckend. Quantität ersetzt keine Qualität der Medienkompetenz. B: Wir müssen das in unserem Bericht deutlich herausstellen.","question":"Was ist die Kernaussage der Umfrageergebnisse?","options":{"A":"Die meisten Menschen lesen keine Nachrichten","B":"Viele Quellen zu nutzen bedeutet nicht, Falschinformationen erkennen zu können","C":"Medienkompetenz ist in Deutschland sehr hoch"},"correct":"B","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe buổi thảo luận bàn tròn và chọn Richtig/Falsch",
            "audio_script": "Moderatorin: Guten Abend. Wir diskutieren heute über die Zukunft der Hochschulbildung. Ich begrüße Professor Schmitt von der Uni Hamburg und Bildungsaktivistin Leyla Yıldız. Professor Schmitt, wird das klassische Studium durch Online-Kurse ersetzt werden? Professor Schmitt: Ich bezweifle eine vollständige Substitution. Präsenzlehre ermöglicht soziales Lernen und wissenschaftliche Sozialisation, die sich online nur begrenzt replizieren lassen. Hybride Modelle werden sich durchsetzen. Leyla Yıldız: Ich sehe das pragmatischer. Für Studierende aus einkommensschwachen Verhältnissen oder in strukturschwachen Regionen ist die Flexibilität von Online-Angeboten enorm wichtig. Chancengerechtigkeit sollte Vorrang vor Traditionspflege haben. Moderatorin: Sind Abschlüsse aus reinen Online-Universitäten gleichwertig anerkannt? Professor Schmitt: Auf dem Arbeitsmarkt noch nicht vollständig, aber das verändert sich schnell.",
            "items": [
              {"id":"H2-1","question":"Professor Schmitt glaubt, dass Online-Kurse das klassische Studium vollständig ersetzen werden.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Hybride Lehrmodelle werden laut Professor Schmitt zunehmen.","correct":"richtig","points":1},
              {"id":"H2-3","question":"Leyla Yıldız betont die Bedeutung von Online-Bildung für benachteiligte Gruppen.","correct":"richtig","points":1},
              {"id":"H2-4","question":"Online-Abschlüsse sind auf dem Arbeitsmarkt bereits vollständig gleichgestellt.","correct":"falsch","points":1},
              {"id":"H2-5","question":"Leyla Yıldız priorisiert Chancengerechtigkeit über Tradition.","correct":"richtig","points":1},
              {"id":"H2-6","question":"Professor Schmitt sieht keine Einschränkungen bei sozialem Lernen in Online-Formaten.","correct":"falsch","points":1}
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
            "instruction_de": "Schreiben Sie einen argumentativen Aufsatz (ca. 150 Wörter).",
            "instruction_vi": "Viết bài luận lập luận ~150 từ về chủ đề sau",
            "prompt": "Thema: Sollte es ein bedingungsloses Grundeinkommen geben?\nStrukturieren Sie Ihren Aufsatz: Positionierung in der Einleitung, mindestens zwei Argumente für Ihre Position mit konkreten Beispielen, eine Auseinandersetzung mit der Gegenposition, und ein Fazit, das Ihre Position bekräftigt.",
            "points": 12,
            "rubric": {"Aufgabenerfüllung":4,"Argumentationsstruktur":3,"Wortschatz":3,"Grammatik":2}
          },
          {
            "teil": 2,
            "type": "FREE_TEXT",
            "instruction_de": "Schreiben Sie einen formellen Leserbrief (ca. 120 Wörter).",
            "instruction_vi": "Viết thư độc giả chính thức ~120 từ theo tình huống sau",
            "prompt": "Tình huống: Một tờ báo lớn vừa đăng bài cho rằng mạng xã hội không có tác hại thực sự với trẻ em dưới 16 tuổi và không cần bị quy định thêm. Bạn không đồng ý. Viết thư độc giả: phản bác lập luận của bài báo với bằng chứng cụ thể, trình bày quan điểm của bạn, và kêu gọi hành động cụ thể từ các nhà hoạch định chính sách.",
            "points": 13,
            "rubric": {"Aufgabenerfüllung":5,"Argumentationsstruktur":3,"Wortschatz":3,"Grammatik":2}
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
            "instruction_de": "Halten Sie einen strukturierten Vortrag (ca. 3 Minuten).",
            "instruction_vi": "Trình bày có cấu trúc ~3 phút về chủ đề sau",
            "prompt": "Thema: Sollte soziale Medien für Jugendliche unter 16 Jahren verboten werden?\nStrukturieren Sie Ihren Vortrag klar: These, Argumente mit Belegen, Gegenposition kurz beleuchten und entkräften, Fazit. Nutzen Sie Satzverbindungen wie: Einerseits/andererseits, Hinzu kommt, Dennoch muss man bedenken, Zusammenfassend lässt sich sagen.",
            "points": 13,
            "rubric": {"Aussprache":3,"Wortschatz":4,"Grammatik":3,"Struktur":3}
          },
          {
            "teil": 2,
            "type": "SPEAKING_PROMPT",
            "instruction_de": "Führen Sie ein Kritikgespräch.",
            "instruction_vi": "Thực hiện một cuộc trò chuyện phê bình theo tình huống sau",
            "prompt": "Tình huống: Bạn là quản lý cấp trung. Một nhân viên xuất sắc của bạn liên tục bỏ lỡ deadline trong 3 tuần qua và không giải thích lý do. Tiến hành cuộc trò chuyện: mở đầu bằng sự cảm thông, trình bày vấn đề cụ thể với dữ liệu, lắng nghe giải thích của nhân viên, đề xuất giải pháp chung, và kết thúc với sự khích lệ.",
            "points": 12,
            "rubric": {"Argumentationsstruktur":4,"Aussprache":3,"Wortschatz":3,"Interaktion":2}
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
