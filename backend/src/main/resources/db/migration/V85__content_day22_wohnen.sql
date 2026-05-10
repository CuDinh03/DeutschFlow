-- V85: Day 22 — Zimmer & Möbel (Wohnen)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Zimmer & Möbel", "vi": "Phòng & Đồ đạc"},
  "overview": {"de": "Zimmer im Haus und Möbelstücke beschreiben. Bestimmter Artikel im Akkusativ.", "vi": "Học tên các phòng trong nhà và đồ nội thất. Giới thiệu Akkusativ với quán từ xác định (den/die/das) — quan trọng khi tìm nhà và mô tả chỗ ở."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Bestimmter Artikel im Akkusativ"},"content":{"vi":"Nominativ → Akkusativ:\nDER → DEN (nam, thay đổi!)\nDIE → DIE (không đổi)\nDAS → DAS (không đổi)\n\nVí dụ:\nDer Tisch steht im Wohnzimmer. (Nominativ)\nIch stelle den Tisch ans Fenster. (Akkusativ)\n\n💡 Chỉ DER đổi thành DEN! DIE và DAS giữ nguyên."},"tags":["#Akkusativ","#Artikel"]},
    {"type":"RULE","title":{"vi":"Phòng trong nhà"},"content":{"vi":"das Wohnzimmer — phòng khách\ndas Schlafzimmer — phòng ngủ\ndas Badezimmer / das Bad — phòng tắm\ndie Küche — bếp\ndas Arbeitszimmer — phòng làm việc\nder Balkon — ban công\nder Keller — tầng hầm\ndie Garage — gara"},"tags":["#Zimmer","#Wohnen"]},
    {"type":"EXAMPLE","title":{"vi":"Mô tả căn hộ"},"content":{"vi":"Meine Wohnung hat drei Zimmer:\nIm Wohnzimmer steht das Sofa und der Fernseher.\nIm Schlafzimmer habe ich ein Bett und einen Schrank.\nIn der Küche gibt es einen Herd und einen Kühlschrank.\nDas Bad hat eine Dusche, aber keine Badewanne."},"tags":["#Wohnen","#Beschreibung"]}
  ],
  "vocabulary": [
    {"id":"v_moe_01","german":"das Sofa","meaning":"ghế sofa","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Sofa steht im Wohnzimmer.","example_vi":"Ghế sofa đặt trong phòng khách.","speak_de":"das Sofa","tags":["#Möbel","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈzoːfa/"],"common_errors_vi":["S am Anfang = /z/"],"ipa_target":"das ˈzoːfa"}},
    {"id":"v_moe_02","german":"der Tisch","meaning":"cái bàn","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Der Tisch steht in der Küche.","example_vi":"Cái bàn đặt trong bếp.","speak_de":"der Tisch","tags":["#Möbel","#A1"],"ai_speech_hints":{"focus_phonemes":["/tɪʃ/"],"common_errors_vi":["Tisch: sch=/ʃ/"],"ipa_target":"deːɐ̯ tɪʃ"}},
    {"id":"v_moe_03","german":"der Stuhl","meaning":"cái ghế (tựa lưng)","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Am Tisch stehen vier Stühle.","example_vi":"Quanh bàn có 4 cái ghế.","speak_de":"der Stuhl","tags":["#Möbel","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃtuːl/"],"common_errors_vi":["Stuhl: st=/ʃt/, uh=/uː/"],"ipa_target":"deːɐ̯ ʃtuːl"}},
    {"id":"v_moe_04","german":"das Bett","meaning":"cái giường","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Mein Bett ist sehr bequem.","example_vi":"Giường của tôi rất thoải mái.","speak_de":"das Bett","tags":["#Möbel","#A1"],"ai_speech_hints":{"focus_phonemes":["/bɛt/"],"common_errors_vi":["tt = /t/ dài: BET-t"],"ipa_target":"das bɛt"}},
    {"id":"v_moe_05","german":"der Schrank","meaning":"tủ (quần áo/đồ đạc)","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Im Schrank hängen meine Kleider.","example_vi":"Trong tủ treo quần áo của tôi.","speak_de":"der Schrank","tags":["#Möbel","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃʁaŋk/"],"common_errors_vi":["Schr=/ʃʁ/, ank cuối rõ"],"ipa_target":"deːɐ̯ ʃʁaŋk"}},
    {"id":"v_moe_06","german":"der Kühlschrank","meaning":"tủ lạnh","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Der Kühlschrank ist in der Küche.","example_vi":"Tủ lạnh ở trong bếp.","speak_de":"der Kühlschrank","tags":["#Möbel","#Küche","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈkyːlʃʁaŋk/"],"common_errors_vi":["Kühl: ü tròn môi, hl=/l/"],"ipa_target":"deːɐ̯ ˈkyːlʃʁaŋk"}},
    {"id":"v_moe_07","german":"stehen / liegen / hängen","meaning":"đứng / nằm / treo","gender":null,"color_code":null,"gender_label":null,"example_de":"Der Tisch steht am Fenster. Das Buch liegt auf dem Tisch.","example_vi":"Cái bàn đứng cạnh cửa sổ. Quyển sách nằm trên bàn.","speak_de":"Er steht. Es liegt.", "tags":["#Verb","#Lage","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʃteːən/"],"common_errors_vi":["stehen: st=/ʃt/"],"ipa_target":"ˈʃteːən"}}
  ],
  "phrases": [
    {"german":"Im Wohnzimmer steht ein großes Sofa.","meaning":"Trong phòng khách có một ghế sofa lớn.","speak_de":"Im Wohnzimmer steht ein großes Sofa."},
    {"german":"Die Wohnung hat zwei Schlafzimmer und eine Küche.","meaning":"Căn hộ có hai phòng ngủ và một bếp.","speak_de":"Die Wohnung hat zwei Schlafzimmer."},
    {"german":"Ich brauche einen neuen Tisch.","meaning":"Tôi cần một cái bàn mới.","speak_de":"Ich brauche einen neuen Tisch."}
  ],
  "examples": [
    {"german":"Meine Wohnung ist klein aber gemütlich. Im Wohnzimmer stehen ein Sofa und ein Fernseher. In der Küche gibt es einen Herd und einen Kühlschrank.","translation":"Căn hộ của tôi nhỏ nhưng ấm cúng. Trong phòng khách có sofa và TV. Trong bếp có bếp nấu và tủ lạnh.","note":"gemütlich = ấm cúng, thoải mái","speak_de":"Meine Wohnung ist gemütlich."},
    {"german":"Ich stelle den Tisch ans Fenster — dann hat man mehr Licht.","translation":"Tôi đặt cái bàn cạnh cửa sổ — như vậy có nhiều ánh sáng hơn.","note":"DEN Tisch (Akkusativ, DER→DEN)","speak_de":"Ich stelle den Tisch ans Fenster."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg22_01","type":"MULTIPLE_CHOICE","question_vi":"''der Tisch'' trong Akkusativ là gì?","options":["der Tisch","die Tisch","den Tisch","das Tisch"],"correct":2},
      {"id":"tg22_02","type":"FILL_BLANK","sentence_de":"Im Schlafzimmer steht ___ Bett und ___ Schrank.","hint_vi":"một (DAS) ... ein (DER-Akk)","answer":"ein, ein","accept_also":["ein / ein"]},
      {"id":"tg22_03","type":"MULTIPLE_CHOICE","question_vi":"''gemütlich'' nghĩa là gì?","options":["hiện đại","ấm cúng/thoải mái","rộng rãi","sạch sẽ"],"correct":1},
      {"id":"tg22_04","type":"FILL_BLANK","sentence_de":"Das Buch ___ auf dem Tisch. Der Mantel ___ an der Wand.","hint_vi":"nằm ... treo","answer":"liegt, hängt","accept_also":["liegt / hängt"]},
      {"id":"tg22_05","type":"MULTIPLE_CHOICE","question_vi":"''die Küche'' là gì?","options":["Phòng ngủ","Bếp","Phòng tắm","Phòng khách"],"correct":1}
    ],
    "practice": [
      {"id":"p22_01","type":"TRANSLATE","from":"vi","sentence":"Căn hộ của tôi có ba phòng. Trong phòng khách có sofa và TV.","answer":"Meine Wohnung hat drei Zimmer. Im Wohnzimmer stehen ein Sofa und ein Fernseher.","accept_also":["Meine Wohnung hat drei Räume. Im Wohnzimmer gibt es ein Sofa und einen Fernseher."]},
      {"id":"p22_02","type":"REORDER","words":["Tisch","stelle","Fenster.","den","ans","Ich"],"correct_order":["Ich","stelle","den","Tisch","ans","Fenster."],"translation":"Tôi đặt cái bàn cạnh cửa sổ."},
      {"id":"p22_03","type":"FILL_BLANK","sentence_de":"Ich brauche ___ neuen Tisch und ___ neue Lampe.","hint_vi":"một (DER-Akk) ... một (DIE-Akk)","answer":"einen, eine","accept_also":["einen / eine"]}
    ]
  },
  "reading_passage": {
    "text_de": "Meine neue Wohnung\n\nIch habe eine neue Wohnung in Frankfurt. Sie hat 60 Quadratmeter und drei Zimmer. Im Wohnzimmer stehen ein Sofa, ein Couchtisch und ein Fernseher. Das Schlafzimmer hat ein großes Bett und einen Kleiderschrank. Die Küche ist modern: Es gibt einen Herd, einen Kühlschrank und eine Spülmaschine. Das Bad ist klein, aber es hat eine Dusche. Ich zahle 900 Euro Miete im Monat.",
    "text_vi": "Căn hộ mới của tôi\n\nTôi có một căn hộ mới ở Frankfurt. Nó rộng 60 mét vuông và có ba phòng. Trong phòng khách có sofa, bàn cà phê và TV. Phòng ngủ có giường lớn và tủ quần áo. Bếp hiện đại: có bếp nấu, tủ lạnh và máy rửa bát. Phòng tắm nhỏ nhưng có vòi hoa sen. Tôi trả 900 Euro tiền thuê mỗi tháng.",
    "questions": [
      {"id":"rq22_01","type":"FILL_BLANK","question_vi":"Căn hộ rộng bao nhiêu?","answer":"60 Quadratmeter","accept_also":["60 qm","sechzig Quadratmeter"]},
      {"id":"rq22_02","type":"MULTIPLE_CHOICE","question_vi":"Nhà tắm có gì?","options":["Badewanne","Dusche","Whirlpool","Sauna"],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie Ihr Zimmer oder Ihre Wohnung. Was gibt es? Wo steht was? (5-6 Sätze)",
    "task_vi": "Mô tả phòng hoặc căn hộ của bạn. Có gì? Ở đâu? (5-6 câu)",
    "min_sentences": 5,
    "example_answer": "Mein Zimmer ist nicht groß, aber gemütlich.\nEs gibt ein Bett, einen Schrank und einen Schreibtisch.\nDer Schreibtisch steht am Fenster.\nAn der Wand hängen Bilder.\nIch habe kein Sofa, aber zwei Stühle."
  },
  "audio_content": {
    "listen_words": [
      {"text":"das Wohnzimmer","meaning":"phòng khách"},
      {"text":"der Kühlschrank","meaning":"tủ lạnh"},
      {"text":"Ich stelle den Tisch ans Fenster.","meaning":"Tôi đặt bàn cạnh cửa sổ."},
      {"text":"gemütlich","meaning":"ấm cúng"},
      {"text":"stehen / liegen / hängen","meaning":"đứng / nằm / treo"}
    ],
    "listen_dialogue": "Wie ist Ihre Wohnung? — Sie hat drei Zimmer. Im Wohnzimmer stehen ein Sofa und ein Fernseher. Das Schlafzimmer ist gemütlich. — Wie viel Miete zahlen Sie? — 850 Euro."
  }
}'::jsonb
WHERE day_number = 22 AND is_active = TRUE;
