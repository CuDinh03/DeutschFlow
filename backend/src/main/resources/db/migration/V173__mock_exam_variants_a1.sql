-- V140: Add 2 more Goethe A1 exam variants covering different topic areas
-- Exam Set 2: Health/family/shopping contexts
-- Exam Set 3: Travel/work/food contexts

INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json, is_active)
VALUES
(
  'A1', 'GOETHE',
  'Goethe Start Deutsch 1 – Set 2',
  'Đề thi thử Goethe A1 – Chủ đề: Gia đình, sức khỏe, mua sắm',
  100, 60, 75,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MATCH",
            "instruction_de": "Lesen Sie die Texte. Kreuzen Sie an: richtig oder falsch.",
            "instruction_vi": "Đọc thông báo và chọn Richtig/Falsch",
            "items": [
              {"id":"L1-1","text":"Arztpraxis Dr. Schmidt: Sprechstunden Mo–Fr 8–12 Uhr. Notfälle jederzeit.","question":"Die Praxis ist auch nachmittags geöffnet.","correct":"falsch","points":1},
              {"id":"L1-2","text":"Achtung Eltern: Kindergarten geschlossen am Freitag, 20. Juni. Bitte Kind zu Hause lassen.","question":"Am Freitag ist der Kindergarten zu.","correct":"richtig","points":1},
              {"id":"L1-3","text":"Sonderangebot: Äpfel 1kg = 0,99€. Nur diese Woche!","question":"Äpfel kosten diese Woche mehr als sonst.","correct":"falsch","points":1},
              {"id":"L1-4","text":"Fitnessstudio: Ab August neue Kurse! Yoga, Pilates, Zumba. Anmeldung online.","question":"Man kann sich im Studio direkt anmelden.","correct":"falsch","points":1},
              {"id":"L1-5","text":"Bitte im Krankenhaus kein Handy benutzen. Danke für Ihr Verständnis.","question":"Im Krankenhaus darf man kein Telefon benutzen.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Ghép mỗi người với quảng cáo phù hợp",
            "context": "A=Haushaltshilfe gesucht, 3x/Woche, 15€/h. B=Gitarrenunterricht für Kinder ab 8 Jahren, 25€/Stunde. C=Verkaufe Kinderwagen, fast neu, 60€. D=Arzttermin: Hautarzt Dr. Braun, freie Termine ab nächste Woche. E=Sprachkurs Spanisch für Anfänger, 8 Wochen, 120€.",
            "items": [
              {"id":"L2-1","person":"Frau Becker hat ein Baby bekommen und sucht etwas für das Kind.","correct":"C","points":1},
              {"id":"L2-2","person":"Herr Meier möchte eine neue Sprache lernen.","correct":"E","points":1},
              {"id":"L2-3","person":"Familie Koch sucht jemanden für den Haushalt.","correct":"A","points":1},
              {"id":"L2-4","person":"Mia hat Hautprobleme und braucht einen Arzt.","correct":"D","points":1},
              {"id":"L2-5","person":"Max ist 10 Jahre alt und möchte ein Instrument lernen.","correct":"B","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_vi": "Đọc email và chọn Richtig/Falsch",
            "context": "E-Mail von Klaus an seine Schwester Petra: Liebe Petra, ich bin letzte Woche zum Arzt gegangen. Ich hatte starke Rückenschmerzen. Der Arzt hat gesagt, ich soll mehr Sport machen und weniger sitzen. Er hat mir auch Tabletten gegeben. Jetzt geht es mir etwas besser. Nächste Woche haben wir einen Kontrolltermin. Mama fragt immer, wie es mir geht. Sag ihr bitte, dass ich wieder gesund werde. Bis bald, Klaus",
            "items": [
              {"id":"L3-1","question":"Klaus war beim Zahnarzt.","correct":"falsch","points":1},
              {"id":"L3-2","question":"Klaus hat Rückenschmerzen gehabt.","correct":"richtig","points":1},
              {"id":"L3-3","question":"Der Arzt sagt, Klaus soll viel sitzen.","correct":"falsch","points":1},
              {"id":"L3-4","question":"Klaus hat Medikamente bekommen.","correct":"richtig","points":1},
              {"id":"L3-5","question":"Klaus hat nächste Woche noch einen Arzttermin.","correct":"richtig","points":1}
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
            "instruction_vi": "Nghe các thông báo ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Das Kaufhaus öffnet morgen wegen eines Feiertages erst um 10 Uhr. Normale Öffnungszeit ist 9 Uhr.","question":"Wann öffnet das Kaufhaus morgen?","options":{"A":"Um 9 Uhr","B":"Um 10 Uhr","C":"Um 11 Uhr"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Liebe Passagiere, der Flug LH 456 nach Berlin hat 30 Minuten Verspätung. Neue Abflugzeit: 15:30 Uhr.","question":"Wann fliegt das Flugzeug ab?","options":{"A":"Um 15:00 Uhr","B":"Um 15:30 Uhr","C":"Um 16:00 Uhr"},"correct":"B","points":1},
              {"id":"H1-3","audio_script":"In der Bibliothek bitte leise sein! Handys ausschalten. Essen und Trinken verboten.","question":"Was ist in der Bibliothek verboten?","options":{"A":"Lesen","B":"Schreiben","C":"Essen"},"correct":"C","points":1},
              {"id":"H1-4","audio_script":"Das Schwimmbad ist heute wegen Reinigung von 12 bis 14 Uhr geschlossen.","question":"Wann ist das Schwimmbad geschlossen?","options":{"A":"Von 10 bis 12 Uhr","B":"Von 12 bis 14 Uhr","C":"Von 14 bis 16 Uhr"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"Achtung Kunden: Im Erdgeschoss gibt es heute frische Erdbeeren, 500g für 1,50 Euro.","question":"Was ist heute günstig?","options":{"A":"Äpfel","B":"Erdbeeren","C":"Bananen"},"correct":"B","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe hội thoại tại phòng khám và chọn Richtig/Falsch",
            "audio_script": "Rezeption: Guten Morgen, Arztpraxis Dr. Müller. A: Guten Morgen, ich brauche einen Termin. Ich habe Halsschmerzen. Rezeption: Wann passt es Ihnen? A: Ist heute noch etwas frei? Rezeption: Heute leider nicht, aber morgen um 11 Uhr. A: Das ist gut. Wie ist Ihr Name bitte? A: Mein Name ist Fischer, Anna Fischer. Rezeption: Gut, Frau Fischer. Bringen Sie bitte Ihre Krankenversicherungskarte mit. A: Natürlich. Danke schön.",
            "items": [
              {"id":"H2-1","question":"Die Frau hat Kopfschmerzen.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Heute gibt es noch freie Termine.","correct":"falsch","points":1},
              {"id":"H2-3","question":"Der Termin ist morgen um 11 Uhr.","correct":"richtig","points":1},
              {"id":"H2-4","question":"Der Name der Patientin ist Fischer.","correct":"richtig","points":1},
              {"id":"H2-5","question":"Die Frau soll ihre Versicherungskarte mitbringen.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_vi": "Nghe tin nhắn điện thoại và trả lời câu hỏi",
            "audio_script": "Hallo Sandra, hier ist deine Mutter. Ich rufe an, weil wir morgen zum Geburtstag von Oma kommen. Wir bringen Kuchen mit. Oma wird 75 Jahre alt. Die Feier beginnt um 15 Uhr. Kannst du bitte Getränke kaufen? Cola, Wasser und Orangensaft. Ruf mich zurück, wenn du Zeit hast. Tschüss!",
            "items": [
              {"id":"H3-1","question":"Wann ist die Feier?","options":{"A":"Heute","B":"Morgen","C":"Übermorgen"},"correct":"B","points":1},
              {"id":"H3-2","question":"Wie alt wird Oma?","options":{"A":"70 Jahre","B":"74 Jahre","C":"75 Jahre"},"correct":"C","points":1},
              {"id":"H3-3","question":"Was bringt die Mutter mit?","options":{"A":"Getränke","B":"Kuchen","C":"Blumen"},"correct":"B","points":1},
              {"id":"H3-4","question":"Um wie viel Uhr beginnt die Feier?","options":{"A":"14 Uhr","B":"15 Uhr","C":"16 Uhr"},"correct":"B","points":1},
              {"id":"H3-5","question":"Was soll Sandra kaufen?","options":{"A":"Kuchen","B":"Essen","C":"Getränke"},"correct":"C","points":1}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Formular für die Krankenversicherung aus.",
            "instruction_vi": "Điền form đăng ký bảo hiểm y tế",
            "form_fields": [
              {"field":"Vorname","instruction_vi":"Tên","points":1},
              {"field":"Familienname","instruction_vi":"Họ","points":1},
              {"field":"Geburtsdatum","instruction_vi":"Ngày sinh","points":1},
              {"field":"Geburtsland","instruction_vi":"Quốc gia sinh","points":1},
              {"field":"Adresse","instruction_vi":"Địa chỉ hiện tại","points":1},
              {"field":"Postleitzahl","instruction_vi":"Mã bưu chính","points":1},
              {"field":"Stadt","instruction_vi":"Thành phố","points":1},
              {"field":"Telefon","instruction_vi":"Số điện thoại","points":1},
              {"field":"Beruf","instruction_vi":"Nghề nghiệp","points":1},
              {"field":"Datum","instruction_vi":"Ngày điền form","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie haben diese Nachricht bekommen. Schreiben Sie eine Antwort (circa 30 Wörter).",
            "instruction_vi": "Đọc tin nhắn và viết trả lời ~30 từ về 3 điểm sau",
            "input_email": "Betreff: Einladung zum Geburtstag\nLiebe/r ..., ich mache am Samstag eine Geburtstagsparty! Kannst du kommen? Was möchtest du essen? Und was schenkst du mir? Liebe Grüße, Nina",
            "writing_points": [
              "Ob du kommen kannst",
              "Was du essen möchtest",
              "Was du mitbringen oder schenken wirst"
            ],
            "sample_answer": "Liebe Nina, ja, ich komme gerne zu deiner Party! Ich möchte Salat und Pizza essen. Ich bringe dir ein Buch als Geschenk mit. Herzliche Glückwünsche!",
            "points": 15,
            "rubric": {"Aufgabenerfüllung":5,"Kohärenz":4,"Wortschatz":3,"Strukturen":3}
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Stellen Sie sich vor.",
            "instruction_vi": "Giới thiệu bản thân: tên, tuổi, quê, nơi ở, gia đình, nghề nghiệp, sở thích",
            "prompt_words": ["Name?","Alter?","Woher?","Familie?","Beruf?","Hobbys?","Lieblingsessen?"],
            "sample_answer": "Ich heiße Minh Nguyen. Ich bin 30 Jahre alt. Ich komme aus Vietnam. Ich habe eine Frau und zwei Kinder. Ich bin Koch von Beruf. In meiner Freizeit koche ich gern und gehe in die Natur.",
            "points": 9,
            "rubric": {"Aussprache":3,"Wortschatz":2,"Grammatik":2,"Inhalt":2}
          },
          {
            "teil": 2,
            "type": "QA_PARTNER",
            "instruction_vi": "Hỏi và trả lời với partner về chủ đề gia đình và sức khỏe",
            "topic_cards": [
              {"card":"Familie","question_to_ask":"Haben Sie Geschwister?","possible_answer":"Ja, ich habe eine Schwester und einen Bruder."},
              {"card":"Gesundheit","question_to_ask":"Machen Sie Sport?","possible_answer":"Ja, ich schwimme dreimal pro Woche."},
              {"card":"Wohnen","question_to_ask":"Wo wohnen Sie?","possible_answer":"Ich wohne in einer 3-Zimmer-Wohnung in der Stadtmitte."},
              {"card":"Einkaufen","question_to_ask":"Wo kaufen Sie ein?","possible_answer":"Ich kaufe meistens im Supermarkt um die Ecke ein."}
            ],
            "points": 8
          },
          {
            "teil": 3,
            "type": "REQUEST_RESPOND",
            "instruction_vi": "Mỗi người đưa ra một yêu cầu và người kia phản hồi",
            "scenario_cards": [
              {"situation":"In der Apotheke","request":"Etwas gegen Kopfschmerzen kaufen","sample":"Guten Tag, ich brauche bitte etwas gegen Kopfschmerzen. Was empfehlen Sie?"},
              {"situation":"Im Supermarkt","request":"Nach einem Produkt fragen","sample":"Entschuldigung, wo finde ich hier die Milchprodukte?"},
              {"situation":"Beim Friseur","request":"Einen Termin vereinbaren","sample":"Hallo, ich möchte bitte einen Termin für einen Haarschnitt. Ist Donnerstag frei?"}
            ],
            "points": 8
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
),
(
  'A1', 'GOETHE',
  'Goethe Start Deutsch 1 – Set 3',
  'Đề thi thử Goethe A1 – Chủ đề: Đi lại, công việc, ăn uống',
  100, 60, 75,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MATCH",
            "instruction_de": "Lesen Sie die Texte. Kreuzen Sie an: richtig oder falsch.",
            "instruction_vi": "Đọc thông báo và chọn Richtig/Falsch",
            "items": [
              {"id":"L1-1","text":"Restaurant Zur Sonne: Mittagsmenü 12–14 Uhr, 3 Gänge nur 9,90€. Reservierung empfohlen.","question":"Das Mittagsmenü kostet unter 10 Euro.","correct":"richtig","points":1},
              {"id":"L1-2","text":"Buslinie 5: Fährt ab heute nicht mehr über die Hauptstraße. Neue Route über Bahnhofstraße.","question":"Der Bus Linie 5 fährt wie immer über die Hauptstraße.","correct":"falsch","points":1},
              {"id":"L1-3","text":"Stellenangebot: Kellner/in gesucht für Abendservice. Gute Deutschkenntnisse erforderlich.","question":"Der Job ist für den ganzen Tag.","correct":"falsch","points":1},
              {"id":"L1-4","text":"Achtung: Baustelle! Geschwindigkeitsbegrenzung 30 km/h auf der B12 bis Ende Juli.","question":"Auf der B12 muss man langsamer fahren.","correct":"richtig","points":1},
              {"id":"L1-5","text":"Volkshochschule: Kochkurs \"Deutsche Küche\" startet am 3. September. Anmeldung bis 30. August.","question":"Der Kochkurs beginnt im Oktober.","correct":"falsch","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Ghép mỗi người với quảng cáo phù hợp",
            "context": "A=Gebrauchtwagen VW Golf 2018, 85.000km, 12.500€, Tel. 0171-333. B=Pizzeria Roma sucht Lieferfahrer, Führerschein Klasse B nötig. C=Deutschkurs B1 ab Oktober, Di+Do 18–20h. D=Möbel zu verschenken: Sofa, Tisch, Stühle. E=Mitfahrgelegenheit München–Hamburg jeden Freitag, 25€.",
            "items": [
              {"id":"L2-1","person":"Thomas hat Deutsch A2 und möchte weiterlernen.","correct":"C","points":1},
              {"id":"L2-2","person":"Lisa zieht um und sucht kostenlose Möbel.","correct":"D","points":1},
              {"id":"L2-3","person":"Ahmed braucht ein Auto und sucht etwas Günstiges.","correct":"A","points":1},
              {"id":"L2-4","person":"Fatima sucht einen Job und hat einen Führerschein.","correct":"B","points":1},
              {"id":"L2-5","person":"Pedro muss jedes Wochenende nach Hamburg und sucht eine günstige Mitfahrt.","correct":"E","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_vi": "Đọc email và chọn Richtig/Falsch",
            "context": "E-Mail von Tobias an seinen Freund Ben: Hallo Ben, ich habe jetzt einen neuen Job gefunden! Ich arbeite seit Montag als Kellner im Restaurant Mediterrano in der Altstadt. Die Arbeit beginnt um 17 Uhr und endet meistens gegen Mitternacht. Meine Kollegen sind sehr nett. Das Essen im Restaurant ist sehr lecker, und nach der Schicht darf ich kostenlos essen. Mein Chef heißt Herr Rossi und kommt aus Italien. Das Gehalt ist nicht so hoch, aber ich bekomme auch Trinkgeld. Bis bald, Tobias",
            "items": [
              {"id":"L3-1","question":"Tobias arbeitet jetzt in einer Bäckerei.","correct":"falsch","points":1},
              {"id":"L3-2","question":"Tobias beginnt die Arbeit am Nachmittag.","correct":"richtig","points":1},
              {"id":"L3-3","question":"Tobias darf nach der Arbeit kostenlos essen.","correct":"richtig","points":1},
              {"id":"L3-4","question":"Sein Chef kommt aus Deutschland.","correct":"falsch","points":1},
              {"id":"L3-5","question":"Tobias bekommt nur Gehalt, kein Trinkgeld.","correct":"falsch","points":1}
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
            "instruction_vi": "Nghe các thông báo ngắn và chọn đáp án đúng",
            "items": [
              {"id":"H1-1","audio_script":"Willkommen im Restaurant Sonnenhof. Wir haben heute Mittagstisch von 11:30 bis 14:30 Uhr. Tischreservierung unter 089-777888.","question":"Wann ist der Mittagstisch?","options":{"A":"Von 11 bis 14 Uhr","B":"Von 11:30 bis 14:30 Uhr","C":"Von 12 bis 15 Uhr"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Achtung Fahrgäste: Die U-Bahn Linie 6 fährt heute wegen Bauarbeiten nur bis Marienplatz. Bitte nutzen Sie den Ersatzbus.","question":"Bis wohin fährt die U-Bahn heute?","options":{"A":"Bis zum Hauptbahnhof","B":"Bis zum Marienplatz","C":"Bis zum Flughafen"},"correct":"B","points":1},
              {"id":"H1-3","audio_script":"Das Wetter morgen: Im Süden sonnig, 26 Grad. Im Norden Regen und Wind, nur 14 Grad.","question":"Wie wird das Wetter morgen im Süden?","options":{"A":"Regen und kalt","B":"Bewölkt","C":"Sonnig und warm"},"correct":"C","points":1},
              {"id":"H1-4","audio_script":"Im Supermarkt heute: Hähnchen 1kg nur 3,99€. Brot 500g für 0,89€. Nur solange der Vorrat reicht.","question":"Was ist heute im Sonderangebot?","options":{"A":"Fisch","B":"Hähnchen","C":"Rind"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"Ihr Zug nach Frankfurt fährt in 5 Minuten von Gleis 3 ab. Bitte einsteigen und Türen schließen lassen.","question":"Von welchem Gleis fährt der Zug?","options":{"A":"Gleis 1","B":"Gleis 5","C":"Gleis 3"},"correct":"C","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe hội thoại đặt bàn tại nhà hàng và chọn Richtig/Falsch",
            "audio_script": "Restaurant: Guten Abend, Restaurant Da Vinci, wie kann ich helfen? A: Guten Abend, ich möchte für Samstag einen Tisch reservieren. Restaurant: Für wie viele Personen? A: Für vier Personen. Restaurant: Um wie viel Uhr? A: Um 19:30 Uhr, wenn möglich. Restaurant: Das ist kein Problem. Darf ich Ihren Namen haben? A: Schmidt, Wolfgang Schmidt. Restaurant: Gut, Herr Schmidt. Tisch für vier Personen, Samstag 19:30 Uhr. A: Gibt es auch ein Parkhaus in der Nähe? Restaurant: Ja, direkt gegenüber. A: Wunderbar, danke!",
            "items": [
              {"id":"H2-1","question":"Der Mann reserviert für Sonntag.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Der Tisch ist für 4 Personen.","correct":"richtig","points":1},
              {"id":"H2-3","question":"Die Reservierung ist um 20 Uhr.","correct":"falsch","points":1},
              {"id":"H2-4","question":"Der Name des Mannes ist Schmidt.","correct":"richtig","points":1},
              {"id":"H2-5","question":"Es gibt kein Parkhaus in der Nähe.","correct":"falsch","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_vi": "Nghe tin nhắn điện thoại và trả lời câu hỏi",
            "audio_script": "Hallo, ich bin es, Kai. Ich rufe an wegen unseres Fußballspiels am Donnerstag. Das Spiel beginnt nicht um 18 Uhr, sondern um 19 Uhr, weil der Platz bis 18:30 belegt ist. Wir treffen uns vorher um 18:30 in der Umkleidekabine. Bring bitte deine Schuhe mit, ich habe leider keinen Platz mehr im Auto. Ach ja, nach dem Spiel gehen wir alle ins Grillhaus Sommer. Bis Donnerstag!",
            "items": [
              {"id":"H3-1","question":"Wann beginnt das Fußballspiel?","options":{"A":"Um 18 Uhr","B":"Um 18:30 Uhr","C":"Um 19 Uhr"},"correct":"C","points":1},
              {"id":"H3-2","question":"Wo treffen sie sich vor dem Spiel?","options":{"A":"Auf dem Platz","B":"In der Umkleidekabine","C":"Im Restaurant"},"correct":"B","points":1},
              {"id":"H3-3","question":"Was soll die Person mitbringen?","options":{"A":"Den Ball","B":"Die Schuhe","C":"Das Trikot"},"correct":"B","points":1},
              {"id":"H3-4","question":"Was machen sie nach dem Spiel?","options":{"A":"Nach Hause gehen","B":"Ins Kino gehen","C":"Essen gehen"},"correct":"C","points":1},
              {"id":"H3-5","question":"Wann ist das Spiel?","options":{"A":"Mittwoch","B":"Donnerstag","C":"Freitag"},"correct":"B","points":1}
            ]
          }
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "FILL_FORM",
            "instruction_de": "Füllen Sie das Anmeldeformular für das Fitnessstudio aus.",
            "instruction_vi": "Điền form đăng ký phòng tập gym",
            "form_fields": [
              {"field":"Vorname","instruction_vi":"Tên","points":1},
              {"field":"Nachname","instruction_vi":"Họ","points":1},
              {"field":"Geburtsdatum","instruction_vi":"Ngày sinh","points":1},
              {"field":"Nationalität","instruction_vi":"Quốc tịch","points":1},
              {"field":"Straße und Hausnummer","instruction_vi":"Tên đường và số nhà","points":1},
              {"field":"PLZ und Ort","instruction_vi":"Mã bưu chính và thành phố","points":1},
              {"field":"Handynummer","instruction_vi":"Số điện thoại","points":1},
              {"field":"E-Mail-Adresse","instruction_vi":"Địa chỉ email","points":1},
              {"field":"Gewünschter Vertrag","instruction_vi":"Loại hợp đồng mong muốn","points":1},
              {"field":"Unterschrift","instruction_vi":"Chữ ký","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Schreiben Sie eine Antwort auf diese E-Mail (circa 30 Wörter).",
            "instruction_vi": "Đọc email và viết trả lời ~30 từ về 3 điểm sau",
            "input_email": "Betreff: Unser Abendessen\nHallo! Lass uns zusammen essen gehen! Wann hast du Zeit? Was für ein Restaurant magst du? Und wo sollen wir uns treffen? Viele Grüße, Yuki",
            "writing_points": [
              "Wann du Zeit hast",
              "Was für ein Restaurant du magst",
              "Wo ihr euch treffen könnt"
            ],
            "sample_answer": "Hallo Yuki, am Freitagabend habe ich Zeit. Ich mag gern italienische Küche. Wir können uns vor dem Rathaus treffen, das ist leicht zu finden. Bis Freitag!",
            "points": 15,
            "rubric": {"Aufgabenerfüllung":5,"Kohärenz":4,"Wortschatz":3,"Strukturen":3}
          }
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "SELF_INTRO",
            "instruction_de": "Stellen Sie sich vor.",
            "instruction_vi": "Giới thiệu bản thân: tên, tuổi, quê hương, công việc, thói quen ăn uống, sở thích",
            "prompt_words": ["Name?","Alter?","Beruf?","Wohnort?","Lieblingsessen?","Freizeit?","Pläne?"],
            "sample_answer": "Ich heiße Linh Tran. Ich bin 25 Jahre alt. Ich arbeite als Köchin. Ich wohne in Frankfurt. Ich esse sehr gern vietnamesisches und deutsches Essen. In meiner Freizeit koche ich, gehe spazieren und lerne Deutsch.",
            "points": 9,
            "rubric": {"Aussprache":3,"Wortschatz":2,"Grammatik":2,"Inhalt":2}
          },
          {
            "teil": 2,
            "type": "QA_PARTNER",
            "instruction_vi": "Hỏi và trả lời với partner về chủ đề ăn uống và đi lại",
            "topic_cards": [
              {"card":"Essen","question_to_ask":"Was essen Sie zum Frühstück?","possible_answer":"Ich esse morgens Brot mit Käse und trinke Kaffee."},
              {"card":"Transport","question_to_ask":"Wie fahren Sie zur Arbeit?","possible_answer":"Ich fahre mit dem Fahrrad und manchmal mit dem Bus."},
              {"card":"Restaurant","question_to_ask":"Gehen Sie oft ins Restaurant?","possible_answer":"Ja, ich gehe einmal pro Woche mit Freunden essen."},
              {"card":"Reisen","question_to_ask":"Wohin möchten Sie reisen?","possible_answer":"Ich möchte gerne nach Wien fahren und die Stadt besichtigen."}
            ],
            "points": 8
          },
          {
            "teil": 3,
            "type": "REQUEST_RESPOND",
            "instruction_vi": "Mỗi người đưa ra một yêu cầu và người kia phản hồi",
            "scenario_cards": [
              {"situation":"Im Restaurant","request":"Die Rechnung bezahlen","sample":"Entschuldigung, ich möchte bitte zahlen. Kann ich mit Karte bezahlen?"},
              {"situation":"Am Bahnhof","request":"Eine Fahrkarte kaufen","sample":"Einmal nach Berlin, bitte. Hin- und Rückfahrt. Wann fährt der nächste Zug?"},
              {"situation":"Im Büro","request":"Um Hilfe bitten","sample":"Entschuldigung, können Sie mir bitte helfen? Ich finde die Kaffeemaschine nicht."}
            ],
            "points": 8
          }
        ]
      }
    ]
  }' :: jsonb,
  TRUE
);
