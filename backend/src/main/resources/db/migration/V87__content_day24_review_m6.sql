-- V87: Day 24 — Review Module 6 (Wohnen)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 6", "vi": "Ôn tập Module 6 — Nhà cửa & Đồ đạc"},
  "overview": {"de": "Wiederholung: Zimmer, Möbel, Akkusativ, es gibt, Wohnungssuche.", "vi": "Ôn tập Module 6: phòng và đồ đạc, Akkusativ (DER→DEN), es gibt + Akkusativ, giới từ vị trí và đọc tin thuê nhà."},
  "session_type": "REVIEW",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Tổng hợp: Akkusativ"},"content":{"vi":"Chỉ DER đổi thành DEN trong Akkusativ:\nIch kaufe DEN Tisch. (der Tisch)\nIch kaufe DIE Lampe. (die Lampe — không đổi)\nIch kaufe DAS Bett. (das Bett — không đổi)\n\nSau möchten, kaufen, brauchen, suchen, nehmen → Akkusativ"},"tags":["#Akkusativ","#Review"]},
    {"type":"RULE","title":{"vi":"es gibt vs. haben — Nhắc lại"},"content":{"vi":"es gibt + Akkusativ = có (tồn tại)\nEs gibt einen Park hier. (Ở đây có công viên.)\n\nhaben = sở hữu cá nhân\nIch habe einen Fernseher. (Tôi có TV.)\n\nIn der Wohnung gibt es... (Trong nhà có...)\nIch habe... (Tôi có...)"},"tags":["#esGibt","#haben"]},
    {"type":"EXAMPLE","title":{"vi":"Mô tả nhà hoàn chỉnh"},"content":{"vi":"Meine Wohnung liegt im dritten Stock.\nSie hat drei Zimmer: ein Wohnzimmer, ein Schlafzimmer und ein Arbeitszimmer.\nEs gibt auch eine Küche und ein Bad.\nIm Wohnzimmer steht ein großes Sofa und ein Couchtisch.\nDas Schlafzimmer hat ein Doppelbett und einen Kleiderschrank.\nIch zahle 950 Euro Warmmiete."},"tags":["#Review","#Wohnen"]}
  ],
  "vocabulary": [
    {"id":"v_rev6_01","german":"das Stockwerk / der Stock","meaning":"tầng","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Ich wohne im dritten Stock.","example_vi":"Tôi sống ở tầng 3.","speak_de":"im dritten Stock","tags":["#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃtɔk/"],"common_errors_vi":["Stock: st=/ʃt/"],"ipa_target":"deːɐ̯ ʃtɔk"}},
    {"id":"v_rev6_02","german":"der Aufzug / der Lift","meaning":"thang máy","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Gibt es einen Aufzug?","example_vi":"Có thang máy không?","speak_de":"der Aufzug","tags":["#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaʊ̯ftsuːk/"],"common_errors_vi":["Auf-: au=/ao/, -zug: z=/ts/"],"ipa_target":"deːɐ̯ ˈaʊ̯ftsuːk"}},
    {"id":"v_rev6_03","german":"die Heizung","meaning":"hệ thống sưởi","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Heizung funktioniert nicht.","example_vi":"Hệ thống sưởi bị hỏng.","speak_de":"die Heizung","tags":["#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈhaɪ̯tsʊŋ/"],"common_errors_vi":["Hei-: ei=/ai/"],"ipa_target":"diː ˈhaɪ̯tsʊŋ"}},
    {"id":"v_rev6_04","german":"der Vermieter / die Vermieterin","meaning":"chủ nhà (cho thuê)","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Mein Vermieter ist sehr nett.","example_vi":"Chủ nhà của tôi rất tốt bụng.","speak_de":"der Vermieter","tags":["#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/fɛɐ̯ˈmiːtɐ/"],"common_errors_vi":["ver-=/fɛɐ̯/"],"ipa_target":"deːɐ̯ fɛɐ̯ˈmiːtɐ"}},
    {"id":"v_rev6_05","german":"ruhig / laut","meaning":"yên tĩnh / ồn ào","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Wohnung liegt ruhig, aber die Straße ist laut.","example_vi":"Căn hộ yên tĩnh, nhưng đường phố ồn ào.","speak_de":"ruhig oder laut","tags":["#Adjektiv","#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʁuːɪç/"],"common_errors_vi":["ruhig: R=uvular, h câm, ig=/ɪç/"],"ipa_target":"ˈʁuːɪç"}}
  ],
  "phrases": [
    {"german":"Die Wohnung liegt ruhig und zentral.","meaning":"Căn hộ yên tĩnh và trung tâm.","speak_de":"Die Wohnung liegt ruhig und zentral."},
    {"german":"Gibt es einen Aufzug?","meaning":"Có thang máy không?","speak_de":"Gibt es einen Aufzug?"},
    {"german":"Wann kann ich die Wohnung besichtigen?","meaning":"Tôi có thể xem nhà khi nào?","speak_de":"Wann kann ich besichtigen?"}
  ],
  "examples": [
    {"german":"Ich brauche einen Tisch und zwei Stühle für die Küche. Haben Sie etwas Günstiges bei IKEA?","translation":"Tôi cần một cái bàn và hai cái ghế cho bếp. Ở IKEA có gì rẻ không?","note":"IKEA = siêu thị đồ nội thất nổi tiếng ở Đức","speak_de":"Ich brauche einen Tisch für die Küche."},
    {"german":"Die Wohnung im dritten Stock hat 70 qm. Es gibt drei Zimmer, eine Küche und ein Bad mit Badewanne. Die Warmmiete beträgt 1.050 Euro.","translation":"Căn hộ ở tầng 3 rộng 70m². Có 3 phòng, bếp và phòng tắm với bồn tắm. Tiền thuê ấm là 1.050 Euro.","note":"beträgt = là/bằng (trang trọng)","speak_de":"Die Wohnung hat 70 Quadratmeter."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg24_01","type":"FILL_BLANK","sentence_de":"Ich suche ___ Tisch (DER) und ___ Lampe (DIE).","hint_vi":"Akkusativ: một bàn ... một đèn","answer":"einen, eine","accept_also":["einen / eine"]},
      {"id":"tg24_02","type":"MULTIPLE_CHOICE","question_vi":"''Es gibt'' dùng đúng trong câu nào?","options":["Es gibt ich ein Auto.","In der Stadt gibt es einen Park.","Ich gibt es einen Tisch.","Es gibt meine Wohnung groß."],"correct":1},
      {"id":"tg24_03","type":"FILL_BLANK","sentence_de":"___ Stock wohnen Sie? — Im ___ Stock.","hint_vi":"Tầng mấy ... thứ ba","answer":"Im welchen, dritten","accept_also":["Welchem, dritten","In welchem Stock? Im dritten."]},
      {"id":"tg24_04","type":"MULTIPLE_CHOICE","question_vi":"''ruhig'' là từ trái nghĩa của gì?","options":["klein","laut","teuer","alt"],"correct":1},
      {"id":"tg24_05","type":"FILL_BLANK","sentence_de":"In der Wohnung ___ ___ ein Bad und ___ Küche.","hint_vi":"có ... (DAS) ... (DIE)","answer":"gibt es, ein, eine","accept_also":["gibt es ein Bad und eine Küche"]}
    ],
    "practice": [
      {"id":"p24_01","type":"TRANSLATE","from":"vi","sentence":"Tôi cần một tủ lạnh và một bàn cho bếp. Có thang máy không?","answer":"Ich brauche einen Kühlschrank und einen Tisch für die Küche. Gibt es einen Aufzug?","accept_also":["Ich brauche einen Kühlschrank und einen Küchentisch. Gibt es einen Lift?"]},
      {"id":"p24_02","type":"REORDER","words":["gibt","Aufzug?","einen","Es"],"correct_order":["Gibt","es","einen","Aufzug?"],"translation":"Có thang máy không?"},
      {"id":"p24_03","type":"FILL_BLANK","sentence_de":"Ich wohne ___ vierten ___, und es ___ keinen Aufzug!","hint_vi":"ở tầng ... tầng ... không có","answer":"im, Stock, gibt","accept_also":["im / Stock / gibt"]}
    ]
  },
  "reading_passage": {
    "text_de": "Eine Wohnungsbesichtigung\n\nMai besichtigt heute eine Wohnung. Die Wohnung liegt im zweiten Stock ohne Aufzug. Sie hat 58 qm und drei Zimmer. Das Wohnzimmer ist groß und hell. Es gibt eine Einbauküche mit Herd und Kühlschrank. Das Schlafzimmer ist ruhig, weil es zum Innenhof liegt. Das Bad hat eine Dusche, aber keine Badewanne. Die Kaltmiete beträgt 780 Euro plus 130 Euro Nebenkosten. Mai findet die Wohnung gut, aber der Aufzug fehlt ihr.",
    "text_vi": "Đi xem nhà\n\nHôm nay Mai đi xem một căn hộ. Căn hộ ở tầng 2, không có thang máy. Nó rộng 58m² và có 3 phòng. Phòng khách rộng và sáng. Có bếp trang bị sẵn với bếp nấu và tủ lạnh. Phòng ngủ yên tĩnh vì nhìn ra sân trong. Phòng tắm có vòi hoa sen, nhưng không có bồn tắm. Tiền thuê lạnh 780 Euro cộng 130 Euro phí phụ. Mai thấy nhà ổn, nhưng tiếc là không có thang máy.",
    "questions": [
      {"id":"rq24_01","type":"FILL_BLANK","question_vi":"Tổng tiền thuê mỗi tháng là bao nhiêu?","answer":"910 Euro","accept_also":["780 + 130 = 910","neunhundertzehn Euro"]},
      {"id":"rq24_02","type":"MULTIPLE_CHOICE","question_vi":"Phòng ngủ yên tĩnh vì sao?","options":["Nó ở tầng cao","Nó nhìn ra sân trong","Nó có cửa sổ dày","Nó có thảm dày"],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie Ihre Traumwohnung: Lage, Zimmer, Möbel, Preis. (6 Sätze)",
    "task_vi": "Mô tả căn hộ mơ ước của bạn: vị trí, phòng, đồ đạc, giá. (6 câu)",
    "min_sentences": 6,
    "example_answer": "Meine Traumwohnung liegt zentral in der Stadtmitte.\nSie hat vier Zimmer und 90 Quadratmeter.\nEs gibt ein großes Wohnzimmer mit Balkon.\nDas Schlafzimmer ist ruhig und hat ein großes Bett.\nDie Küche ist modern mit allen Geräten.\nDie Warmmiete soll nicht mehr als 1.500 Euro betragen."
  },
  "audio_content": {
    "listen_words": [
      {"text":"im dritten Stock","meaning":"ở tầng 3"},
      {"text":"Gibt es einen Aufzug?","meaning":"Có thang máy không?"},
      {"text":"Die Wohnung ist ruhig.","meaning":"Căn hộ yên tĩnh."},
      {"text":"Kaltmiete plus Nebenkosten","meaning":"tiền thuê lạnh cộng phí phụ"},
      {"text":"Wann kann ich besichtigen?","meaning":"Tôi có thể xem nhà khi nào?"}
    ],
    "listen_dialogue": "Die Wohnung liegt im zweiten Stock. Es gibt leider keinen Aufzug. — Wie groß ist sie? — 60 Quadratmeter. Drei Zimmer und eine Küche. — Und die Miete? — 850 Euro warm."
  }
}'::jsonb
WHERE day_number = 24 AND is_active = TRUE;
