-- V120: Seed 45 Real Goethe A1 Questions into Mock Exam
-- Format: Goethe Start Deutsch 1 (SD1)
-- Sections: Lesen (15q), Hören (15q), Schreiben (10q), Sprechen (5q)

DO $$
DECLARE
  exam_id BIGINT;
BEGIN
  SELECT id INTO exam_id FROM mock_exams WHERE cefr_level = 'A1' AND exam_format = 'GOETHE' LIMIT 1;
  IF exam_id IS NULL THEN
    RAISE EXCEPTION 'No Goethe A1 exam found. Run V118 first.';
  END IF;

  -- Update exam with full content
  UPDATE mock_exams SET sections_json = '{
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
            "instruction_de": "Lesen Sie die Texte und die Aufgaben. Kreuzen Sie an: richtig oder falsch.",
            "instruction_vi": "Đọc thông báo và chọn Richtig/Falsch",
            "items": [
              {"id":"L1-1","text":"Im Supermarkt: Sonderangebot! Milch 1L nur 0,79€. Gültig bis Samstag.","question":"Milch kostet heute weniger als sonst.","correct":"richtig","points":1},
              {"id":"L1-2","text":"Achtung! Der Aufzug ist kaputt. Bitte benutzen Sie die Treppe.","question":"Der Aufzug funktioniert.","correct":"falsch","points":1},
              {"id":"L1-3","text":"Bibliothek geschlossen: Dienstag, 14. Mai wegen Renovierung.","question":"Die Bibliothek ist am Dienstag geöffnet.","correct":"falsch","points":1},
              {"id":"L1-4","text":"Schwimmbad: Kinder unter 6 Jahren zahlen keinen Eintritt.","question":"Kinder unter 6 Jahren müssen nichts bezahlen.","correct":"richtig","points":1},
              {"id":"L1-5","text":"Parkverbot! Keine Autos zwischen 8-18 Uhr. Polizei.","question":"Man darf hier abends parken.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "MATCH_PERSON",
            "instruction_de": "Lesen Sie die Anzeigen. Welche Anzeige passt zu welcher Person?",
            "instruction_vi": "Ghép mỗi người với quảng cáo phù hợp",
            "context": "Anzeigen: A=Deutschkurs für Anfänger Mo+Mi 18-20h 50€/Monat. B=Fahrrad zu verkaufen, 80€, Tel 0176-123. C=Babysitter gesucht, Fr+Sa Abend. D=Wohnung 2Zi, Küche, Bad, 600€ warm. E=Yoga für Anfänger, Di+Do 19h, Stadtpark.",
            "items": [
              {"id":"L2-1","person":"Peter lernt seit 2 Wochen Deutsch und sucht einen Kurs.","correct":"A","points":1},
              {"id":"L2-2","person":"Maria braucht ein günstiges Fahrrad.","correct":"B","points":1},
              {"id":"L2-3","person":"Familie Bauer sucht jemanden für ihre Kinder am Wochenende.","correct":"C","points":1},
              {"id":"L2-4","person":"Klaus sucht eine kleine Wohnung in der Stadt.","correct":"D","points":1},
              {"id":"L2-5","person":"Anna möchte Sport machen und Stress abbauen.","correct":"E","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "TRUE_FALSE",
            "instruction_vi": "Đọc email và chọn Richtig/Falsch",
            "context": "E-Mail von Lisa an Tom: Lieber Tom, wie geht es dir? Ich bin jetzt in Hamburg und wohne in einer kleinen Wohnung. Die Wohnung hat zwei Zimmer, eine Küche und ein Bad. Sie ist nicht sehr groß, aber ich mag sie. Mein Nachbar heißt Stefan. Er ist sehr nett. Ich arbeite bei einer Firma in der Innenstadt. Die Arbeit ist interessant. Am Wochenende gehe ich gern in die Altstadt oder in den Park. Viele Grüße, Lisa",
            "items": [
              {"id":"L3-1","question":"Lisa wohnt in Berlin.","correct":"falsch","points":1},
              {"id":"L3-2","question":"Lisas Wohnung hat zwei Zimmer.","correct":"richtig","points":1},
              {"id":"L3-3","question":"Lisa mag ihre Wohnung nicht.","correct":"falsch","points":1},
              {"id":"L3-4","question":"Lisas Nachbar ist unfreundlich.","correct":"falsch","points":1},
              {"id":"L3-5","question":"Am Wochenende geht Lisa oft spazieren.","correct":"richtig","points":1}
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
            "instruction_vi": "Nghe các thông báo ngắn và chọn đáp án đúng (A, B hoặc C)",
            "items": [
              {"id":"H1-1","audio_script":"Achtung! Der Zug nach München fährt heute von Gleis 7, nicht von Gleis 3. Abfahrt um 14:22 Uhr.","question":"Von welchem Gleis fährt der Zug?","options":{"A":"Gleis 3","B":"Gleis 7","C":"Gleis 12"},"correct":"B","points":1},
              {"id":"H1-2","audio_script":"Das Wetter heute: In München ist es sonnig und warm, 24 Grad. Im Norden regnet es.","question":"Wie ist das Wetter in München?","options":{"A":"Es regnet.","B":"Es ist kalt.","C":"Es ist sonnig."},"correct":"C","points":1},
              {"id":"H1-3","audio_script":"Der Supermarkt ist montags bis samstags von 8 bis 20 Uhr geöffnet. Sonntags ist er geschlossen.","question":"Wann ist der Supermarkt sonntags geöffnet?","options":{"A":"Von 9 bis 18 Uhr","B":"Von 8 bis 20 Uhr","C":"Er ist geschlossen."},"correct":"C","points":1},
              {"id":"H1-4","audio_script":"Arztpraxis Dr. Müller: Termine nur nach Anmeldung. Telefonnummer: 089-45678.","question":"Wie kann man einen Termin bekommen?","options":{"A":"Einfach kommen","B":"Anrufen","C":"Per E-Mail"},"correct":"B","points":1},
              {"id":"H1-5","audio_script":"Achtung im Kaufhaus: Im zweiten Stock gibt es heute 30% Rabatt auf alle Jacken!","question":"Wo gibt es Rabatt?","options":{"A":"Im ersten Stock","B":"Im zweiten Stock","C":"Im Erdgeschoss"},"correct":"B","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_AUDIO",
            "instruction_vi": "Nghe hội thoại và chọn Richtig/Falsch",
            "audio_script": "A: Entschuldigung, wie komme ich zum Hauptbahnhof? B: Sie fahren am besten mit der U-Bahn, Linie 3. A: Wie lange dauert das? B: Ungefähr 10 Minuten. A: Und wie viel kostet eine Fahrkarte? B: Einzelfahrt 2,90 Euro. A: Danke schön! B: Bitte sehr.",
            "items": [
              {"id":"H2-1","question":"Die Person fährt mit dem Bus zum Bahnhof.","correct":"falsch","points":1},
              {"id":"H2-2","question":"Die Fahrt dauert ca. 10 Minuten.","correct":"richtig","points":1},
              {"id":"H2-3","question":"Eine Fahrkarte kostet 2,90 Euro.","correct":"richtig","points":1},
              {"id":"H2-4","question":"Die Person kauft eine Wochenkarte.","correct":"falsch","points":1},
              {"id":"H2-5","question":"Die Person fragt nach dem Weg.","correct":"richtig","points":1}
            ]
          },
          {
            "teil": 3,
            "type": "MULTIPLE_CHOICE_AUDIO",
            "instruction_vi": "Nghe tin nhắn điện thoại và trả lời câu hỏi",
            "audio_script": "Hallo, hier ist Monika. Ich rufe wegen unseres Treffens morgen an. Ich kann leider nicht um 18 Uhr kommen, weil ich länger arbeiten muss. Können wir uns stattdessen um 20 Uhr treffen? Ruf mich bitte zurück. Meine Nummer ist 0160-9876543. Bis bald!",
            "items": [
              {"id":"H3-1","question":"Warum ruft Monika an?","options":{"A":"Sie kann nicht kommen.","B":"Sie möchte die Zeit ändern.","C":"Sie sucht eine Arbeit."},"correct":"B","points":1},
              {"id":"H3-2","question":"Um wie viel Uhr möchte Monika sich treffen?","options":{"A":"18 Uhr","B":"19 Uhr","C":"20 Uhr"},"correct":"C","points":1},
              {"id":"H3-3","question":"Warum kommt Monika nicht um 18 Uhr?","options":{"A":"Sie ist krank.","B":"Sie muss länger arbeiten.","C":"Sie hat keinen Bus."},"correct":"B","points":1},
              {"id":"H3-4","question":"Was soll die Person tun?","options":{"A":"Eine E-Mail schreiben","B":"Monika zurückrufen","C":"An die Adresse kommen"},"correct":"B","points":1},
              {"id":"H3-5","question":"Was ist Monikas Telefonnummer?","options":{"A":"0160-9876543","B":"0160-9876453","C":"0160-9867543"},"correct":"A","points":1}
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
            "instruction_de": "Füllen Sie das Anmeldeformular für den Deutschkurs aus.",
            "instruction_vi": "Điền form đăng ký khóa học tiếng Đức",
            "form_fields": [
              {"field":"Vorname","instruction_vi":"Tên","points":1},
              {"field":"Nachname","instruction_vi":"Họ","points":1},
              {"field":"Geburtsdatum","instruction_vi":"Ngày sinh","points":1},
              {"field":"Geburtsort","instruction_vi":"Nơi sinh","points":1},
              {"field":"Muttersprache","instruction_vi":"Tiếng mẹ đẻ","points":1},
              {"field":"Adresse","instruction_vi":"Địa chỉ","points":1},
              {"field":"Telefonnummer","instruction_vi":"Số điện thoại","points":1},
              {"field":"E-Mail","instruction_vi":"Email","points":1},
              {"field":"Kursbeginn","instruction_vi":"Ngày bắt đầu khóa học","points":1},
              {"field":"Unterschrift","instruction_vi":"Chữ ký","points":1}
            ]
          },
          {
            "teil": 2,
            "type": "WRITE_EMAIL",
            "instruction_de": "Sie bekommen diese E-Mail. Schreiben Sie eine Antwort (circa 30 Wörter). Schreiben Sie zu allen drei Punkten.",
            "instruction_vi": "Đọc email và viết trả lời ~30 từ về 3 điểm sau",
            "input_email": "Betreff: Unser Treffen\nLiebe/r ..., wann können wir uns treffen? Wo möchtest du essen? Was sollen wir mitbringen? Viele Grüße, Stefan",
            "writing_points": [
              "Wann du treffen kannst",
              "Wo du essen möchtest",
              "Was du mitbringen wirst"
            ],
            "sample_answer": "Lieber Stefan, am Samstag um 18 Uhr passt mir gut. Ich möchte im Restaurant Italia essen. Ich bringe Getränke mit. Viele Grüße!",
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
            "instruction_de": "Stellen Sie sich vor. Sprechen Sie über: Name, Alter, Land, Wohnort, Sprachen, Beruf, Hobbys.",
            "instruction_vi": "Giới thiệu bản thân: tên, tuổi, quê, nơi ở, ngôn ngữ, nghề nghiệp, sở thích",
            "prompt_words": ["Name?","Alter?","Woher?","Wohnort?","Sprachen?","Beruf?","Hobbys?"],
            "sample_answer": "Ich heiße Anna Müller. Ich bin 28 Jahre alt. Ich komme aus Vietnam, aber ich wohne jetzt in München. Ich spreche Vietnamesisch und Deutsch. Ich bin Ingenieurin. In meiner Freizeit lese ich gern und mache Sport.",
            "points": 9,
            "rubric": {"Aussprache":3,"Wortschatz":2,"Grammatik":2,"Inhalt":2}
          },
          {
            "teil": 2,
            "type": "QA_PARTNER",
            "instruction_vi": "Hỏi và trả lời với partner về cuộc sống hàng ngày",
            "topic_cards": [
              {"card":"Freizeit","question_to_ask":"Was machst du in der Freizeit?","possible_answer":"In der Freizeit lese ich gern Bücher und spiele Fußball."},
              {"card":"Familie","question_to_ask":"Wie viele Personen hat deine Familie?","possible_answer":"Meine Familie hat vier Personen: meine Eltern, meine Schwester und ich."},
              {"card":"Essen","question_to_ask":"Was isst du gern?","possible_answer":"Ich esse gern Pizza und Salat."},
              {"card":"Arbeit","question_to_ask":"Was machst du beruflich?","possible_answer":"Ich bin Student. Ich studiere Informatik."}
            ],
            "points": 8
          },
          {
            "teil": 3,
            "type": "REQUEST_RESPOND",
            "instruction_vi": "Mỗi người đưa ra một yêu cầu và người kia phản hồi",
            "scenario_cards": [
              {"situation":"Im Café","request":"Bitte um etwas zu trinken","sample":"Entschuldigung, ich möchte bitte einen Kaffee und ein Glas Wasser."},
              {"situation":"Beim Arzt","request":"Termin vereinbaren","sample":"Guten Tag, ich brauche einen Termin bei Dr. Müller. Ist Montag möglich?"},
              {"situation":"Im Supermarkt","request":"Nach dem Preis fragen","sample":"Entschuldigung, was kostet dieser Käse?"}
            ],
            "points": 8
          }
        ]
      }
    ]
  }' :: jsonb
  WHERE id = exam_id;

  RAISE NOTICE 'Mock exam questions seeded for exam_id=%', exam_id;
END $$;
