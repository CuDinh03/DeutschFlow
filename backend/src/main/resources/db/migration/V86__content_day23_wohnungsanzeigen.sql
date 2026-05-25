-- V86: Day 23 — Wohnungsanzeigen & es gibt

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Wohnungsanzeigen & es gibt", "vi": "Tìm nhà & es gibt"},
  "overview": {"de": "Wohnungsanzeigen lesen, es gibt + Akkusativ, Präpositionen des Ortes.", "vi": "Học cách đọc tin cho thuê nhà, dùng ''es gibt'' và giới từ chỉ vị trí. Rất cần thiết khi tìm nhà ở Đức — tin đăng thường viết tắt nhiều!"},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"es gibt + Akkusativ"},"content":{"vi":"es gibt = có (tồn tại)\nDùng với Akkusativ:\nEs gibt einen Park. (Có một công viên.) — DER→einen\nEs gibt eine Schule. (Có một trường học.) — DIE→eine\nEs gibt ein Café. (Có một quán cà phê.) — DAS→ein\nEs gibt keine Garage. (Không có gara.)\n\n⚠️ KHÔNG nhầm với haben:\nhaben = tôi/bạn/anh ấy CÓ (sở hữu)\nes gibt = TỒN TẠI (có mặt ở đâu đó)"},"tags":["#esGibt","#Akkusativ"]},
    {"type":"RULE","title":{"vi":"Giới từ vị trí: in, an, auf, neben, zwischen"},"content":{"vi":"in + Dat: Das Buch ist im (=in dem) Regal.\nan + Dat: Der Tisch steht an der Wand.\nauf + Dat: Die Katze liegt auf dem Sofa.\nneben + Dat: Der Stuhl steht neben dem Tisch.\nzwischen + Dat: Das Bett ist zwischen dem Fenster und der Tür.\n\nDativ-Artikel: dem (DER/DAS), der (DIE)"},"tags":["#Präpositionen","#Dativ"]},
    {"type":"EXAMPLE","title":{"vi":"Đọc tin thuê nhà — chữ viết tắt"},"content":{"vi":"2-Zi.-Whg. = 2-Zimmer-Wohnung\nqm / m² = Quadratmeter\nKM = Kaltmiete (tiền thuê chưa gồm phí)\nWM = Warmmiete (tiền thuê đã gồm phí)\nEBK = Einbauküche (bếp được trang bị sẵn)\nNK = Nebenkosten (phí phụ: điện, nước...)\nKT = Kaution (tiền đặt cọc)"},"tags":["#Wohnen","#Anzeige"]}
  ],
  "vocabulary": [
    {"id":"v_whg_01","german":"die Wohnung","meaning":"căn hộ","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich suche eine 2-Zimmer-Wohnung in München.","example_vi":"Tôi tìm căn hộ 2 phòng ở Munich.","speak_de":"eine Wohnung suchen","tags":["#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈvoːnʊŋ/"],"common_errors_vi":["W=/v/, oh=/oː/"],"ipa_target":"diː ˈvoːnʊŋ"}},
    {"id":"v_whg_02","german":"die Miete","meaning":"tiền thuê","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Miete beträgt 800 Euro im Monat.","example_vi":"Tiền thuê là 800 Euro mỗi tháng.","speak_de":"die Miete","tags":["#Wohnen","#Geld","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈmiːtə/"],"common_errors_vi":["ie=/iː/ kéo dài"],"ipa_target":"diː ˈmiːtə"}},
    {"id":"v_whg_03","german":"die Kaution","meaning":"tiền đặt cọc","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Kaution ist drei Monatsmieten.","example_vi":"Tiền cọc là ba tháng tiền thuê.","speak_de":"die Kaution","tags":["#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/kaʊ̯ˈtsi̯oːn/"],"common_errors_vi":["Nhấn vào -tion: kau-TSI-on"],"ipa_target":"diː kaʊ̯ˈtsi̯oːn"}},
    {"id":"v_whg_04","german":"der Quadratmeter (qm)","meaning":"mét vuông","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Die Wohnung hat 65 Quadratmeter.","example_vi":"Căn hộ rộng 65 mét vuông.","speak_de":"65 Quadratmeter","tags":["#Maße","#A1"],"ai_speech_hints":{"focus_phonemes":["/kvaˈdʁaːtmeːtɐ/"],"common_errors_vi":["Qu=/kv/ tiếng Đức"],"ipa_target":"deːɐ̯ kvaˈdʁaːtmeːtɐ"}},
    {"id":"v_whg_05","german":"suchen","meaning":"tìm kiếm","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich suche eine ruhige Wohnung in der Nähe.","example_vi":"Tôi tìm căn hộ yên tĩnh gần đây.","speak_de":"Ich suche eine Wohnung","tags":["#Verb","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈzuːxən/"],"common_errors_vi":["S am Anfang=/z/, ch=/x/"],"ipa_target":"ˈzuːxən"}},
    {"id":"v_whg_06","german":"vermieten","meaning":"cho thuê","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich vermiete meine Wohnung für 900 Euro.","example_vi":"Tôi cho thuê căn hộ với giá 900 Euro.","speak_de":"Ich vermiete","tags":["#Verb","#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/fɛɐ̯ˈmiːtən/"],"common_errors_vi":["ver-=/fɛɐ̯/, ie=/iː/"],"ipa_target":"fɛɐ̯ˈmiːtən"}}
  ],
  "phrases": [
    {"german":"Ich suche eine 2-Zimmer-Wohnung, ca. 60 qm, bis 900 Euro Warmmiete.","meaning":"Tôi tìm căn hộ 2 phòng, khoảng 60m², không quá 900 Euro tiền thuê ấm.","speak_de":"Ich suche eine Wohnung."},
    {"german":"Es gibt einen Balkon und eine Einbauküche.","meaning":"Có ban công và bếp trang bị sẵn.","speak_de":"Es gibt einen Balkon."},
    {"german":"Ist die Wohnung noch frei?","meaning":"Căn hộ còn trống không?","speak_de":"Ist die Wohnung noch frei?"}
  ],
  "examples": [
    {"german":"Anzeige: 3-Zi.-Whg., 75 qm, ruhige Lage, EBK, 1.100 € WM, KT 3 Monatsmieten. Tel: 069-12345","translation":"Tin đăng: Căn hộ 3 phòng, 75m², vị trí yên tĩnh, bếp trang bị sẵn, 1.100€ thuê ấm, cọc 3 tháng tiền thuê. ĐT: 069-12345","note":"Cách đọc tin thuê nhà thực tế","speak_de":"Drei-Zimmer-Wohnung, 75 Quadratmeter."},
    {"german":"In der Wohnung gibt es ein Wohnzimmer, zwei Schlafzimmer, eine Küche und ein Bad. Es gibt leider keine Garage.","translation":"Trong căn hộ có phòng khách, hai phòng ngủ, bếp và phòng tắm. Tiếc là không có gara.","note":"es gibt = tồn tại; leider = tiếc là","speak_de":"Es gibt ein Wohnzimmer und zwei Schlafzimmer."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg23_01","type":"FILL_BLANK","sentence_de":"In der Stadt ___ ___ Park und ___ Supermarkt.","hint_vi":"có ... công viên (DER) ... siêu thị (DER)","answer":"gibt es einen, einen","accept_also":["gibt es einen Park und einen Supermarkt"]},
      {"id":"tg23_02","type":"MULTIPLE_CHOICE","question_vi":"''WM'' trong tin thuê nhà là gì?","options":["Waschmaschine","Warmmiete","Wohnungsmakler","Wochenmiete"],"correct":1},
      {"id":"tg23_03","type":"FILL_BLANK","sentence_de":"Das Buch liegt ___ dem Tisch (auf/in/an).","hint_vi":"trên bàn","answer":"auf","accept_also":["auf"]},
      {"id":"tg23_04","type":"MULTIPLE_CHOICE","question_vi":"''es gibt'' dùng với cách nào?","options":["Nominativ","Dativ","Akkusativ","Genitiv"],"correct":2},
      {"id":"tg23_05","type":"FILL_BLANK","sentence_de":"Ich ___ eine Wohnung in Frankfurt. Haben Sie etwas ___?","hint_vi":"tìm ... còn trống","answer":"suche, Freies","accept_also":["suche, frei"]}
    ],
    "practice": [
      {"id":"p23_01","type":"TRANSLATE","from":"vi","sentence":"Trong căn hộ có phòng khách, hai phòng ngủ và một bếp nhỏ.","answer":"In der Wohnung gibt es ein Wohnzimmer, zwei Schlafzimmer und eine kleine Küche.","accept_also":["Es gibt ein Wohnzimmer, zwei Schlafzimmer und eine kleine Küche."]},
      {"id":"p23_02","type":"REORDER","words":["Balkon?","noch","die","Ist","frei","Wohnung","mit"],"correct_order":["Ist","die","Wohnung","mit","Balkon","noch","frei?"],"translation":"Căn hộ có ban công còn trống không?"},
      {"id":"p23_03","type":"FILL_BLANK","sentence_de":"Die Lampe hängt ___ dem Tisch. Der Teppich liegt ___ dem Boden.","hint_vi":"trên (über/an) ... trên (auf)","answer":"über, auf","accept_also":["über / auf"]}
    ]
  },
  "reading_passage": {
    "text_de": "Wohnungssuche in Deutschland\n\nMinh sucht eine Wohnung in Hamburg. Er liest Anzeigen im Internet: ''2-Zimmer-Wohnung, 55 qm, ruhige Lage, EBK, 850 € KM + 150 € NK. KT: 2 Monatsmieten.''\n\nMinh rechnet: 850 + 150 = 1.000 € pro Monat. Und die Kaution: 1.700 €. Er ruft an: ''Ist die Wohnung noch frei?'' — ''Ja, aber wir haben viele Interessenten. Kommen Sie morgen zur Besichtigung?''",
    "text_vi": "Tìm nhà ở Đức\n\nMinh tìm nhà ở Hamburg. Anh đọc tin trên mạng: ''Căn hộ 2 phòng, 55m², vị trí yên tĩnh, bếp sẵn, 850€ thuê lạnh + 150€ phí phụ. Cọc: 2 tháng tiền thuê.''\n\nMinh tính: 850 + 150 = 1.000€ mỗi tháng. Và tiền cọc: 1.700€. Anh gọi điện: ''Căn hộ còn trống không?'' — ''Vâng, nhưng có nhiều người quan tâm. Ngày mai ông có thể đến xem nhà không?''",
    "questions": [
      {"id":"rq23_01","type":"FILL_BLANK","question_vi":"Minh phải trả bao nhiêu tiền cọc?","answer":"1.700 Euro","accept_also":["1700 Euro","siebzehnhundert Euro"]},
      {"id":"rq23_02","type":"MULTIPLE_CHOICE","question_vi":"Warmmiete mỗi tháng là bao nhiêu?","options":["850 Euro","150 Euro","1.000 Euro","1.700 Euro"],"correct":2}
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie eine Wohnungsanzeige für Ihre Traumwohnung: Zimmeranzahl, Größe, Lage, Ausstattung, Preis.",
    "task_vi": "Viết tin đăng cho căn hộ mơ ước của bạn: số phòng, diện tích, vị trí, tiện nghi, giá thuê.",
    "min_sentences": 5,
    "example_answer": "Zu vermieten: Schöne 3-Zimmer-Wohnung, 80 qm.\nRuhige Lage in der Nähe vom Park.\nModerne Küche und Bad mit Badewanne.\nGroßer Balkon mit Blick auf den Garten.\nWarmmiete: 1.200 Euro. Kaution: 2 Monatsmieten."
  },
  "audio_content": {
    "listen_words": [
      {"text":"Ich suche eine Wohnung.","meaning":"Tôi tìm căn hộ."},
      {"text":"Es gibt einen Balkon.","meaning":"Có ban công."},
      {"text":"Ist die Wohnung noch frei?","meaning":"Còn trống không?"},
      {"text":"die Miete / die Kaution","meaning":"tiền thuê / tiền cọc"},
      {"text":"Warmmiete / Kaltmiete","meaning":"thuê ấm / thuê lạnh"}
    ],
    "listen_dialogue": "Ich suche eine 2-Zimmer-Wohnung. — Wie viel möchten Sie zahlen? — Bis 900 Euro Warmmiete. — Wir haben etwas für 850 Euro. Es gibt eine Küche und einen Balkon. — Super! Ist sie noch frei?"
  }
}'::jsonb
WHERE day_number = 23 AND is_active = TRUE;
