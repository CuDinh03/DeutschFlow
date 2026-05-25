-- V88: Day 25 — Uhrzeit: offiziell & inoffiziell

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Uhrzeit: offiziell & inoffiziell", "vi": "Đọc giờ: Chính thức & Thông thường"},
  "overview": {"de": "Uhrzeiten auf zwei Arten sagen: offiziell (14:30 Uhr) und inoffiziell (halb drei).", "vi": "Tiếng Đức có 2 cách đọc giờ: chính thức (dùng ở sân bay, lịch làm việc) và thông thường (nói chuyện hàng ngày). Cách thông thường khá khó — halb, viertel, Viertel vor/nach!"},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Cách đọc giờ CHÍNH THỨC (offiziell)"},"content":{"vi":"Dùng trong: Lịch, nhà ga, thông báo\n13:00 = dreizehn Uhr\n14:30 = vierzehn Uhr dreißig\n08:15 = acht Uhr fünfzehn\n22:45 = zweiundzwanzig Uhr fünfundvierzig\n\nCâu hỏi: Wie viel Uhr ist es? / Wann?\nTrả lời: Es ist... Uhr. / Um... Uhr."},"tags":["#Uhrzeit","#offiziell"]},
    {"type":"RULE","title":{"vi":"Cách đọc giờ THÔNG THƯỜNG (inoffiziell)"},"content":{"vi":"Dựa trên nửa giờ (halb):\n14:30 = halb drei (nửa để đến 3h — ý là 2h30!)\n14:15 = Viertel nach zwei (1/4 sau 2h)\n14:45 = Viertel vor drei (1/4 trước 3h)\n13:10 = zehn nach eins\n13:50 = zehn vor zwei\n\n⚠️ KHÓ: ''halb drei'' = 2:30, KHÔNG phải 3:30!\nQuy tắc: halb + (giờ tiếp theo)"},"tags":["#Uhrzeit","#inoffiziell","#halb"]},
    {"type":"EXAMPLE","title":{"vi":"So sánh hai cách đọc"},"content":{"vi":"07:00 → sieben Uhr / sieben Uhr\n07:15 → sieben Uhr fünfzehn / Viertel nach sieben\n07:30 → sieben Uhr dreißig / halb acht (!)\n07:45 → sieben Uhr fünfundvierzig / Viertel vor acht\n\nHỏi giờ:\n— Entschuldigung, wie viel Uhr ist es?\n— Es ist Viertel nach zehn.\n— Um wie viel Uhr fängt der Zug an?\n— Um dreizehn Uhr zwanzig."},"tags":["#Uhrzeit","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_uhr_01","german":"die Uhr","meaning":"đồng hồ / giờ","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Wie viel Uhr ist es? — Es ist 3 Uhr.","example_vi":"Mấy giờ rồi? — 3 giờ.","speak_de":"Wie viel Uhr ist es?","tags":["#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/uːɐ̯/"],"common_errors_vi":["Uhr: U dài /uː/, r=/ɐ̯/"],"ipa_target":"diː uːɐ̯"}},
    {"id":"v_uhr_02","german":"halb","meaning":"nửa (30 phút)","gender":null,"color_code":null,"gender_label":null,"example_de":"Halb drei = 2:30 Uhr (NICHT 3:30!)","example_vi":"halb drei = 2 giờ 30 (KHÔNG phải 3 giờ 30!)","speak_de":"Es ist halb drei.","tags":["#Uhrzeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/halp/"],"common_errors_vi":["b cuối đọc /p/"],"ipa_target":"halp"}},
    {"id":"v_uhr_03","german":"das Viertel","meaning":"1/4 (15 phút)","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Viertel nach acht = 8:15. Viertel vor neun = 8:45.","example_vi":"1/4 sau 8 = 8:15. 1/4 trước 9 = 8:45.","speak_de":"Viertel nach acht","tags":["#Uhrzeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfɪʁtl̩/"],"common_errors_vi":["V=/f/, ier=/iːɐ̯/"],"ipa_target":"das ˈfɪʁtl̩"}},
    {"id":"v_uhr_04","german":"der Termin","meaning":"cuộc hẹn / lịch hẹn","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich habe um 10 Uhr einen Termin beim Arzt.","example_vi":"Tôi có lịch hẹn với bác sĩ lúc 10 giờ.","speak_de":"Ich habe einen Termin","tags":["#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/tɛʁˈmiːn/"],"common_errors_vi":["Ter-MIN: nhấn MIN"],"ipa_target":"deːɐ̯ tɛʁˈmiːn"}},
    {"id":"v_uhr_05","german":"pünktlich","meaning":"đúng giờ","gender":null,"color_code":null,"gender_label":null,"example_de":"In Deutschland ist Pünktlichkeit sehr wichtig!","example_vi":"Ở Đức, đúng giờ rất quan trọng!","speak_de":"Bitte pünktlich!","tags":["#Kultur","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈpʏŋktlɪç/"],"common_errors_vi":["pünkt: ü tròn môi, ck=/k/"],"ipa_target":"ˈpʏŋktlɪç"}},
    {"id":"v_uhr_06","german":"nach / vor","meaning":"sau / trước (thời gian)","gender":null,"color_code":null,"gender_label":null,"example_de":"zehn nach zwei (2:10) / zehn vor drei (2:50)","example_vi":"10 phút sau 2 giờ (2:10) / 10 phút trước 3 giờ (2:50)","speak_de":"zehn nach zwei","tags":["#Uhrzeit","#Präpositionen","#A1"],"ai_speech_hints":{"focus_phonemes":["/naːx/","/foːɐ̯/"],"common_errors_vi":["nach: ch=/x/ (ach-Laut)"],"ipa_target":"naːx / foːɐ̯"}}
  ],
  "phrases": [
    {"german":"Wie viel Uhr ist es?","meaning":"Bây giờ mấy giờ rồi?","speak_de":"Wie viel Uhr ist es?"},
    {"german":"Um wie viel Uhr beginnt der Unterricht?","meaning":"Mấy giờ bắt đầu học?","speak_de":"Um wie viel Uhr beginnt der Unterricht?"},
    {"german":"Entschuldigung, ich komme leider zu spät!","meaning":"Xin lỗi, tôi đến muộn!","speak_de":"Ich komme leider zu spät!"}
  ],
  "examples": [
    {"german":"Der Zug fährt um 14:32 Uhr ab. Das ist halb drei — minus zwei Minuten.","translation":"Tàu khởi hành lúc 14:32. Đó là halb drei trừ hai phút.","note":"Cách tra lịch tàu ở Đức","speak_de":"Der Zug fährt um vierzehn Uhr zweiunddreißig ab."},
    {"german":"— Wann haben Sie Zeit? — Ich kann um Viertel nach drei. Geht das? — Nein, aber um halb vier geht es.", "translation":"— Bạn có thể khi nào? — Tôi có thể lúc 3:15. Được không? — Không, nhưng 3:30 thì được.","note":"Thương lượng lịch hẹn","speak_de":"Kann ich um Viertel nach drei?"}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg25_01","type":"MULTIPLE_CHOICE","question_vi":"''halb acht'' là mấy giờ?","options":["8:30","7:30","8:15","7:45"],"correct":1},
      {"id":"tg25_02","type":"FILL_BLANK","sentence_de":"Es ist ___ nach drei. (3:20)","hint_vi":"20 phút","answer":"zwanzig","accept_also":["20"]},
      {"id":"tg25_03","type":"MULTIPLE_CHOICE","question_vi":"''Viertel vor neun'' = mấy giờ?","options":["9:15","9:45","8:45","8:15"],"correct":2},
      {"id":"tg25_04","type":"FILL_BLANK","sentence_de":"Der Unterricht beginnt ___ acht Uhr. (chính thức)","hint_vi":"lúc (giới từ thời gian)","answer":"um","accept_also":["Um"]},
      {"id":"tg25_05","type":"MULTIPLE_CHOICE","question_vi":"Người Đức rất coi trọng điều gì?","options":["Ăn tối cùng nhau","Pünktlichkeit (đúng giờ)","Nói to","Mặc đồ đẹp"],"correct":1}
    ],
    "practice": [
      {"id":"p25_01","type":"TRANSLATE","from":"vi","sentence":"Bây giờ là 7 giờ 30. Tôi có cuộc hẹn lúc 9 giờ.","answer":"Es ist halb acht. Ich habe um neun Uhr einen Termin.","accept_also":["Es ist sieben Uhr dreißig. Ich habe um neun Uhr einen Termin."]},
      {"id":"p25_02","type":"FILL_BLANK","sentence_de":"14:15 = ___ nach zwei. / 14:45 = ___ vor drei.","hint_vi":"Viertel ... Viertel","answer":"Viertel, Viertel","accept_also":["viertel / viertel"]},
      {"id":"p25_03","type":"REORDER","words":["es","Uhr","Wie","ist?","viel"],"correct_order":["Wie","viel","Uhr","ist","es?"],"translation":"Bây giờ mấy giờ rồi?"}
    ]
  },
  "reading_passage": {
    "text_de": "Ein Tag in Deutschland\n\nMinh steht um halb sieben auf. Um sieben Uhr frühstückt er. Er verlässt das Haus um Viertel vor acht. Der Bus fährt um acht Uhr ab. Um Viertel nach neun beginnt die Arbeit. Um zwölf Uhr mittags isst er in der Kantine. Um halb eins geht er zurück ins Büro. Um fünf Uhr ist die Arbeit zu Ende. Abends sieht er fern und geht um halb elf schlafen.",
    "text_vi": "Một ngày ở Đức\n\nMinh dậy lúc 6 giờ 30. Lúc 7 giờ anh ăn sáng. Anh rời nhà lúc 7 giờ 45. Xe buýt khởi hành lúc 8 giờ. Lúc 9:15 bắt đầu làm việc. Lúc 12 giờ trưa anh ăn trong căng-tin. Lúc 12:30 anh quay lại văn phòng. Lúc 5 giờ chiều hết việc. Tối anh xem TV và đi ngủ lúc 10:30.",
    "questions": [
      {"id":"rq25_01","type":"FILL_BLANK","question_vi":"Minh rời nhà lúc mấy giờ? (inoffiziell)","answer":"Viertel vor acht","accept_also":["um Viertel vor acht","7:45"]},
      {"id":"rq25_02","type":"MULTIPLE_CHOICE","question_vi":"Minh đi ngủ lúc mấy giờ?","options":["um elf Uhr","um halb elf","um zehn Uhr","um Viertel nach zehn"],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie Ihren Tagesablauf mit Uhrzeiten (offiziell und inoffiziell). (6-7 Sätze)",
    "task_vi": "Mô tả lịch trình ngày của bạn với giờ cụ thể (chính thức và thông thường). (6-7 câu)",
    "min_sentences": 6,
    "example_answer": "Ich stehe um halb sechs auf.\nUm sechs Uhr frühstücke ich.\nUm Viertel vor sieben fahre ich zur Arbeit.\nDie Arbeit beginnt um acht Uhr.\nUm zwölf Uhr esse ich zu Mittag.\nUm siebzehn Uhr bin ich wieder zu Hause.\nAbends schlafe ich um elf Uhr."
  },
  "audio_content": {
    "listen_words": [
      {"text":"halb acht = 7:30","meaning":"7 giờ 30"},
      {"text":"Viertel nach drei = 3:15","meaning":"3 giờ 15"},
      {"text":"Viertel vor neun = 8:45","meaning":"8 giờ 45"},
      {"text":"Wie viel Uhr ist es?","meaning":"Mấy giờ rồi?"},
      {"text":"Um wie viel Uhr?","meaning":"Lúc mấy giờ?"}
    ],
    "listen_dialogue": "Entschuldigung, wie viel Uhr ist es? — Es ist Viertel nach zehn. — Oh! Ich habe um halb elf einen Termin! Ich muss schnell! — Pünktlichkeit ist wichtig in Deutschland!"
  }
}'::jsonb
WHERE day_number = 25 AND is_active = TRUE;
