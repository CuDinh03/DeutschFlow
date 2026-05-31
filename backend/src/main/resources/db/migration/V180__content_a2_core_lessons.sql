-- V180: A2 Core Content — full theory_cards + vocabulary + exercises
-- Updates 4 highest-priority A2 nodes that currently have empty content_json

-- ─── Day 31: Dativ ───────────────────────────────────────────────────────────
UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Der Dativ (Wem-Fall)", "vi": "Cách Dativ — Tặng cách"},
  "overview": {"de": "Dativ zeigt: Wem? Mit wem? Wo?", "vi": "Dativ dùng sau động từ geben/helfen/gefallen, giới từ mit/bei/nach/von/aus/seit/zu và câu hỏi Wem?"},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Mạo từ trong Dativ"},"content":{"vi":"Biến đổi mạo từ xác định:\n• der/das → dem (m/n)\n• die → der (f)\n• die (số nhiều) → den (+n)\n\nVí dụ:\nIch helfe dem Mann. (m)\nIch helfe der Frau. (f)\nIch helfe dem Kind. (n)\nIch helfe den Kindern. (pl)"},"tags":["#Dativ","#A2"]},
    {"type":"RULE","title":{"vi":"Giới từ luôn dùng Dativ"},"content":{"vi":"aus, bei, mit, nach, seit, von, zu, gegenüber\n\n• aus: Ich komme aus der Schweiz.\n• bei: Ich wohne bei meiner Schwester.\n• mit: Ich fahre mit dem Bus.\n• nach: Ich gehe nach der Arbeit.\n• seit: Ich lerne seit einem Jahr.\n• von: Das ist ein Geschenk von dem Chef.\n• zu: Ich gehe zum (= zu dem) Arzt."},"tags":["#Praepositionen","#Dativ","#A2"]},
    {"type":"EXAMPLE","title":{"vi":"Động từ đi với Dativ"},"content":{"vi":"helfen + Dativ: Ich helfe meinem Freund.\ngefallen + Dativ: Das Kleid gefällt der Frau.\ngeben + Dativ + Akkusativ: Ich gebe dem Kind ein Buch.\ngehören + Dativ: Das Auto gehört meinem Vater."},"tags":["#Dativ","#Verben"]}
  ],
  "vocabulary": [
    {"id":"v_dat_01","german":"helfen (+ Dativ)","meaning":"giúp đỡ (ai đó)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich helfe meiner Mutter im Haushalt.","example_vi":"Tôi giúp mẹ làm việc nhà.","speak_de":"Ich helfe dir.","tags":["#Dativ","#A2"],"ai_speech_hints":{"focus_phonemes":["/ˈhɛlfən/"],"common_errors_vi":["helfen: e=/ɛ/, -fen rõ"],"ipa_target":"ˈhɛlfən"}},
    {"id":"v_dat_02","german":"gehören","meaning":"thuộc về (ai)","gender":null,"color_code":null,"gender_label":null,"example_de":"Das gehört meinem Bruder.","example_vi":"Cái đó thuộc về anh trai tôi.","speak_de":"Das gehört mir.","tags":["#Dativ","#A2"],"ai_speech_hints":{"focus_phonemes":["/ɡəˈhøːʁən/"],"common_errors_vi":["ö=/øː/ tròn môi"],"ipa_target":"ɡəˈhøːʁən"}},
    {"id":"v_dat_03","german":"gefallen","meaning":"thích / vừa ý","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Kleid gefällt mir sehr gut.","example_vi":"Tôi rất thích bộ váy này.","speak_de":"Das gefällt mir.","tags":["#Dativ","#A2"],"ai_speech_hints":{"focus_phonemes":["/ɡəˈfalən/"],"common_errors_vi":["ä=/ɛ/ trong gefällt"],"ipa_target":"ɡəˈfɛlən"}},
    {"id":"v_dat_04","german":"schenken","meaning":"tặng quà","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich schenke meiner Mutter Blumen.","example_vi":"Tôi tặng mẹ hoa.","speak_de":"Ich schenke dir etwas.","tags":["#Dativ","#A2"],"ai_speech_hints":{"focus_phonemes":["/ˈʃɛŋkən/"],"common_errors_vi":["sch=/ʃ/, nk=/ŋk/"],"ipa_target":"ˈʃɛŋkən"}}
  ],
  "phrases": [
    {"german":"Ich helfe dir gern.","meaning":"Tôi sẵn lòng giúp bạn.","speak_de":"Ich helfe dir gern."},
    {"german":"Das gehört meinem Vater.","meaning":"Cái đó thuộc về bố tôi.","speak_de":"Das gehört meinem Vater."},
    {"german":"Wie gefällt Ihnen die Stadt?","meaning":"Bạn thấy thành phố thế nào?","speak_de":"Wie gefällt Ihnen die Stadt?"}
  ],
  "examples": [
    {"german":"— Kannst du mir helfen?\n— Ja, natürlich. Was brauchst du?\n— Ich muss diesen Brief übersetzen. Kannst du mir dabei helfen?\n— Kein Problem. Ich helfe dir gern!","translation":"— Bạn có thể giúp tôi không?\n— Tất nhiên. Bạn cần gì?\n— Tôi phải dịch lá thư này. Bạn có thể giúp không?\n— Không vấn đề. Tôi rất vui được giúp!","note":"mir/dir/ihm/ihr = Personalpronomen Dativ","speak_de":"Kannst du mir helfen?"}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg31_01","type":"FILL_BLANK","sentence_de":"Ich helfe ___ Mann. (dem/der/das)","hint_vi":"Mann = der (m) → Dativ: dem","answer":"dem","accept_also":["dem"]},
      {"id":"tg31_02","type":"MULTIPLE_CHOICE","question_vi":"Giới từ nào luôn dùng Dativ?","options":["durch","für","mit","gegen"],"correct":2},
      {"id":"tg31_03","type":"FILL_BLANK","sentence_de":"Das Buch gehört ___ Lehrerin.","hint_vi":"Lehrerin = die (f) → Dativ: der","answer":"der","accept_also":["der"]},
      {"id":"tg31_04","type":"MULTIPLE_CHOICE","question_vi":"''Ich fahre mit ___ Bus'' — điền gì?","options":["den","dem","der","des"],"correct":1},
      {"id":"tg31_05","type":"FILL_BLANK","sentence_de":"Seit ___ Jahr lerne ich Deutsch.","hint_vi":"einem/einer/einem?","answer":"einem","accept_also":["einem"]}
    ],
    "practice": [
      {"id":"p31_01","type":"TRANSLATE","from":"vi","sentence":"Tôi tặng bạn gái tôi một bó hoa.","answer":"Ich schenke meiner Freundin einen Blumenstrauß.","accept_also":["Ich gebe meiner Freundin Blumen."]},
      {"id":"p31_02","type":"REORDER","words":["helfe","gern.","meinem","Ich","Bruder"],"correct_order":["Ich","helfe","meinem","Bruder","gern."],"translation":"Tôi sẵn lòng giúp anh trai."},
      {"id":"p31_03","type":"FILL_BLANK","sentence_de":"Wie gefällt ___ die neue Wohnung?","hint_vi":"dir (bạn thân) hoặc Ihnen (kính trọng)","answer":"dir","accept_also":["Ihnen"]}
    ]
  },
  "reading_passage": {
    "text_de": "Hilfe für die Nachbarin\n\nMeine Nachbarin Frau Müller ist alt und kann nicht gut laufen. Ich helfe ihr jeden Samstag beim Einkaufen. Ich fahre mit dem Auto zum Supermarkt und kaufe ihr alles, was sie braucht. Danach bringe ich die Tüten zu ihr. Sie ist immer sehr dankbar. ''Das gehört sich so'', sage ich ihr immer. Wir Menschen sollen uns gegenseitig helfen.",
    "text_vi": "Giúp đỡ người hàng xóm\n\nNgười hàng xóm bà Müller của tôi đã già và đi lại không tốt. Mỗi thứ Bảy tôi giúp bà ấy đi mua sắm. Tôi lái xe đến siêu thị và mua tất cả những gì bà cần. Sau đó tôi mang túi đến nhà bà. Bà ấy luôn rất biết ơn. ''Điều đó là hiển nhiên'', tôi luôn nói với bà. Chúng ta phải giúp đỡ lẫn nhau.",
    "questions": [
      {"id":"rq31_01","type":"FILL_BLANK","question_vi":"Người tường thuật giúp bà Müller với việc gì?","answer":"beim Einkaufen","accept_also":["Einkaufen","einkaufen"]},
      {"id":"rq31_02","type":"MULTIPLE_CHOICE","question_vi":"Anh ấy đi đến siêu thị bằng gì?","options":["mit dem Bus","mit dem Auto","zu Fuß","mit dem Fahrrad"],"correct":1}
    ]
  },
  "writing_prompt": {"task_de":"Beschreiben Sie, wem Sie helfen und wie.","task_vi":"Hãy miêu tả bạn giúp ai và như thế nào.","min_sentences":4,"example_answer":"Ich helfe meiner Mutter im Haushalt.\nIch helfe ihr beim Kochen und beim Putzen.\nManchmal schenke ich ihr Blumen.\nMeiner Mutter gefällt das sehr."},
  "audio_content": {
    "listen_words": [
      {"text":"Ich helfe dir.","meaning":"Tôi giúp bạn."},
      {"text":"Das gehört meinem Bruder.","meaning":"Cái đó thuộc về anh trai tôi."},
      {"text":"Ich fahre mit dem Bus.","meaning":"Tôi đi bằng xe buýt."}
    ],
    "listen_dialogue": "Kannst du mir helfen? — Ja, was brauchst du? — Ich suche den Bahnhof. — Gehen Sie geradeaus, dann links. — Danke, das ist sehr nett von Ihnen!"
  }
}'::jsonb
WHERE day_number = 31 AND cefr_level = 'A2' AND is_active = TRUE;

-- ─── Day 35: Nebensätze mit weil/dass/wenn ────────────────────────────────────
UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Nebensätze: weil, dass, wenn", "vi": "Mệnh đề phụ: weil, dass, wenn"},
  "overview": {"de": "Im Nebensatz steht das Verb am Ende.", "vi": "Ba loại mệnh đề phụ thông dụng nhất — động từ luôn đứng CUỐI câu phụ."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Quy tắc chung — Verb cuối câu"},"content":{"vi":"Cấu trúc: [Hauptsatz], [Nebensatz mit Verb am Ende]\n\nVí dụ:\nIch lerne Deutsch, WEIL ich in Deutschland arbeiten MÖCHTE.\nIch glaube, DASS du Recht HAST.\nWENN du Zeit HAST, ruf mich an!\n\n→ Dấu phẩy luôn ngăn cách giữa hai mệnh đề!"},"tags":["#Nebensatz","#A2"]},
    {"type":"RULE","title":{"vi":"weil — vì / bởi vì (lý do)"},"content":{"vi":"Dùng để giải thích LÝ DO:\nIch esse kein Fleisch, weil ich Vegetarier bin.\nEr lernt viel, weil er die Prüfung bestehen will.\nSie ist müde, weil sie nicht geschlafen hat.\n\n💡 Phân biệt: warum? (câu hỏi) → weil (trả lời)\nWarum lernst du Deutsch? — Weil ich in Deutschland wohne."},"tags":["#weil","#Nebensatz"]},
    {"type":"RULE","title":{"vi":"dass — rằng / là (nội dung)"},"content":{"vi":"Dùng để nói NỘI DUNG (sau động từ sagen/glauben/wissen/hoffen):\nIch glaube, dass er krank ist.\nIch hoffe, dass du kommst.\nSie sagt, dass die Suppe gut schmeckt.\n\n💡 Sau dass, chủ ngữ mới xuất hiện!"},"tags":["#dass","#Nebensatz"]},
    {"type":"RULE","title":{"vi":"wenn — khi / nếu (điều kiện hoặc thời gian)"},"content":{"vi":"ĐIỀU KIỆN: Wenn du Zeit hast, besuche mich!\nTHỜI GIAN (lặp lại): Wenn ich morgens aufstehe, trinke ich Kaffee.\n\n⚠️ Phân biệt với wann (câu hỏi):\nWann kommst du? (Khi nào bạn đến?)\nIch komme, wenn ich Zeit habe. (Tôi đến khi tôi rảnh)"},"tags":["#wenn","#Nebensatz"]}
  ],
  "vocabulary": [
    {"id":"v_neb_01","german":"weil","meaning":"vì / bởi vì","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bin froh, weil heute Freitag ist.","example_vi":"Tôi vui vì hôm nay là thứ Sáu.","speak_de":"Ich lerne Deutsch, weil...","tags":["#Nebensatz","#A2"],"ai_speech_hints":{"focus_phonemes":["/vaɪ̯l/"],"common_errors_vi":["weil: w=/v/, ei=/ai/"],"ipa_target":"vaɪ̯l"}},
    {"id":"v_neb_02","german":"dass","meaning":"rằng / là","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich hoffe, dass du gesund bist.","example_vi":"Tôi hy vọng rằng bạn khỏe.","speak_de":"Ich glaube, dass...","tags":["#Nebensatz","#A2"],"ai_speech_hints":{"focus_phonemes":["/das/"],"common_errors_vi":["dass: ss=/s/ dài, không phải z"],"ipa_target":"das"}},
    {"id":"v_neb_03","german":"wenn","meaning":"khi / nếu","gender":null,"color_code":null,"gender_label":null,"example_de":"Wenn es regnet, bleibe ich zu Hause.","example_vi":"Khi trời mưa, tôi ở nhà.","speak_de":"Wenn ich Zeit habe,...","tags":["#Nebensatz","#A2"],"ai_speech_hints":{"focus_phonemes":["/vɛn/"],"common_errors_vi":["wenn: w=/v/, nn=/n/"],"ipa_target":"vɛn"}}
  ],
  "phrases": [
    {"german":"Ich lerne Deutsch, weil es interessant ist.","meaning":"Tôi học tiếng Đức vì nó thú vị.","speak_de":"Ich lerne Deutsch, weil es interessant ist."},
    {"german":"Ich glaube, dass du recht hast.","meaning":"Tôi nghĩ bạn đúng.","speak_de":"Ich glaube, dass du recht hast."},
    {"german":"Ruf mich an, wenn du Hilfe brauchst!","meaning":"Gọi cho tôi khi bạn cần giúp đỡ!","speak_de":"Ruf mich an, wenn du Hilfe brauchst!"}
  ],
  "examples": [
    {"german":"Ich bin heute müde, weil ich gestern lange gearbeitet habe.\nIch glaube, dass ich morgen früh aufstehen muss.\nWenn ich zuhause bin, koche ich immer Abendessen.","translation":"Hôm nay tôi mệt vì hôm qua làm việc đến khuya.\nTôi nghĩ rằng ngày mai tôi phải dậy sớm.\nKhi tôi ở nhà, tôi luôn nấu bữa tối.","note":"Verb = cuối câu phụ","speak_de":"Ich bin müde, weil ich gearbeitet habe."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg35_01","type":"FILL_BLANK","sentence_de":"Ich esse kein Fleisch, ___ ich Vegetarier bin.","hint_vi":"vì","answer":"weil","accept_also":["weil"]},
      {"id":"tg35_02","type":"FILL_BLANK","sentence_de":"Ich hoffe, ___ du bald kommst.","hint_vi":"rằng","answer":"dass","accept_also":["dass"]},
      {"id":"tg35_03","type":"FILL_BLANK","sentence_de":"___ du Zeit hast, besuche mich!","hint_vi":"Khi / Nếu","answer":"Wenn","accept_also":["wenn"]},
      {"id":"tg35_04","type":"MULTIPLE_CHOICE","question_vi":"''Ich lerne viel, ___ ich die Prüfung bestehen will.'' — điền gì?","options":["dass","wenn","weil","obwohl"],"correct":2},
      {"id":"tg35_05","type":"FILL_BLANK","sentence_de":"Er sagt, dass er krank ___. (sein - Präsens)","hint_vi":"ist","answer":"ist","accept_also":["ist"]}
    ],
    "practice": [
      {"id":"p35_01","type":"TRANSLATE","from":"vi","sentence":"Tôi học tiếng Đức vì tôi muốn làm việc ở Đức.","answer":"Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte.","accept_also":["Ich lerne Deutsch, weil ich in Deutschland arbeiten will."]},
      {"id":"p35_02","type":"REORDER","words":["dass","ist.","Er","weiß,","du","krank"],"correct_order":["Er","weiß,","dass","du","krank","ist."],"translation":"Anh ấy biết rằng bạn bị ốm."},
      {"id":"p35_03","type":"FILL_BLANK","sentence_de":"___ ich Zeit habe, lese ich gerne Bücher.","hint_vi":"Khi","answer":"Wenn","accept_also":["wenn"]}
    ]
  },
  "reading_passage": {
    "text_de": "Warum lernst du Deutsch?\n\nIch lerne Deutsch, weil ich in Wien arbeiten möchte. Wien ist eine wunderschöne Stadt, und ich glaube, dass man dort sehr gut leben kann. Wenn ich genug Deutsch spreche, werde ich mich um eine Stelle bewerben. Mein Arbeitgeber hat mir gesagt, dass ich mindestens B2-Niveau brauche. Ich lerne täglich, weil mir die Zeit läuft.",
    "text_vi": "Tại sao bạn học tiếng Đức?\n\nTôi học tiếng Đức vì tôi muốn làm việc ở Wien. Wien là một thành phố tuyệt đẹp, và tôi tin rằng người ta có thể sống rất tốt ở đó. Khi tôi nói đủ tiếng Đức, tôi sẽ xin việc. Sếp tôi đã nói với tôi rằng tôi cần ít nhất trình độ B2. Tôi học mỗi ngày vì thời gian đang cạn dần.",
    "questions": [
      {"id":"rq35_01","type":"FILL_BLANK","question_vi":"Người viết muốn làm gì ở Wien?","answer":"arbeiten","accept_also":["eine Stelle bewerben"]},
      {"id":"rq35_02","type":"MULTIPLE_CHOICE","question_vi":"Sếp nói anh ấy cần trình độ nào?","options":["A2","B1","B2","C1"],"correct":2}
    ]
  },
  "writing_prompt": {"task_de":"Warum lernen Sie Deutsch? Schreiben Sie 4 Sätze mit weil, dass und wenn.","task_vi":"Tại sao bạn học tiếng Đức? Viết 4 câu dùng weil, dass và wenn.","min_sentences":4,"example_answer":"Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte.\nIch glaube, dass Deutsch eine wichtige Sprache ist.\nWenn ich gut Deutsch spreche, finde ich leichter Arbeit.\nMein Ziel ist es, dass ich bald fließend spreche."},
  "audio_content": {
    "listen_words": [
      {"text":"Ich lerne Deutsch, weil es Spaß macht.","meaning":"Tôi học tiếng Đức vì nó thú vị."},
      {"text":"Ich glaube, dass du recht hast.","meaning":"Tôi nghĩ bạn đúng."},
      {"text":"Ruf an, wenn du Hilfe brauchst!","meaning":"Gọi khi bạn cần giúp đỡ!"}
    ],
    "listen_dialogue": "Warum lernst du so viel? — Weil ich nächsten Monat eine Prüfung habe. — Ich glaube, dass du gut vorbereitet bist. — Danke! Wenn ich Zeit habe, übe ich jeden Tag."
  }
}'::jsonb
WHERE day_number = 35 AND cefr_level = 'A2' AND is_active = TRUE;

-- ─── Day 39: Konjunktiv II ────────────────────────────────────────────────────
UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Konjunktiv II — würde + Infinitiv", "vi": "Điều kiện giả định — würde"},
  "overview": {"de": "Ich würde gern reisen. Könnten Sie mir helfen?", "vi": "Diễn đạt điều ước, lời đề nghị lịch sự. Hay dùng: würde, könnte, hätte, wäre."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"würde + Infinitiv — công thức cơ bản"},"content":{"vi":"Cách tạo: würde + động từ nguyên thể (ở cuối câu)\n\nich würde ... kaufen (tôi sẽ mua)\ndu würdest ... fahren (bạn sẽ đi)\ner/sie/es würde ... reisen (anh/cô ấy sẽ đi)\nwir würden ... leben (chúng tôi sẽ sống)\nihr würdet ... lernen (các bạn sẽ học)\nsie/Sie würden ... arbeiten (họ/Ngài sẽ làm)\n\n→ Dùng để nói điều KHÔNG CÓ THẬT hoặc điều ƯỚC"},"tags":["#KonjunktivII","#A2"]},
    {"type":"RULE","title":{"vi":"Dạng đặc biệt — không dùng würde"},"content":{"vi":"4 động từ quan trọng dùng trực tiếp:\n• sein → wäre (Ich wäre gern Ärztin.)\n• haben → hätte (Ich hätte gern mehr Zeit.)\n• können → könnte (Könnten Sie bitte...?)\n• müssen → müsste (Du müsstest mehr lernen.)\n\n💡 Đây là những dạng bạn nghe NHIỀU nhất trong giao tiếp!"},"tags":["#KonjunktivII","#wäre","#hätte","#könnte"]},
    {"type":"EXAMPLE","title":{"vi":"Lời đề nghị lịch sự"},"content":{"vi":"Könnten Sie mir bitte helfen? (Bạn có thể giúp tôi không?)\nHätten Sie einen Moment Zeit? (Bạn có chút thời gian không?)\nWürden Sie das bitte wiederholen? (Bạn lặp lại được không?)\n\n→ Lịch sự hơn NHIỀU so với: Können Sie...? / Haben Sie...?"},"tags":["#KonjunktivII","#Hoeflichkeit"]}
  ],
  "vocabulary": [
    {"id":"v_konj_01","german":"würde + Inf.","meaning":"sẽ (điều kiện)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich würde gern nach Deutschland reisen.","example_vi":"Tôi muốn đi du lịch Đức.","speak_de":"Ich würde gern...","tags":["#KonjunktivII","#A2"],"ai_speech_hints":{"focus_phonemes":["/ˈvʏʁdə/"],"common_errors_vi":["würde: ü tròn môi, -de /də/"],"ipa_target":"ˈvʏʁdə"}},
    {"id":"v_konj_02","german":"wäre","meaning":"sẽ là / nếu là (sein-KII)","gender":null,"color_code":null,"gender_label":null,"example_de":"Das wäre sehr schön!","example_vi":"Thật tuyệt vời!","speak_de":"Das wäre toll!","tags":["#KonjunktivII","#A2"],"ai_speech_hints":{"focus_phonemes":["/ˈvɛːʁə/"],"common_errors_vi":["wäre: ä=/ɛː/"],"ipa_target":"ˈvɛːʁə"}},
    {"id":"v_konj_03","german":"hätte","meaning":"sẽ có (haben-KII)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich hätte gern ein Glas Wasser.","example_vi":"Tôi muốn một ly nước.","speak_de":"Ich hätte gern...","tags":["#KonjunktivII","#A2"],"ai_speech_hints":{"focus_phonemes":["/ˈhɛtə/"],"common_errors_vi":["hätte: ä=/ɛ/, tt=/t/"],"ipa_target":"ˈhɛtə"}},
    {"id":"v_konj_04","german":"könnte","meaning":"có thể (können-KII)","gender":null,"color_code":null,"gender_label":null,"example_de":"Könnten Sie bitte lauter sprechen?","example_vi":"Bạn có thể nói to hơn không?","speak_de":"Könnten Sie...?","tags":["#KonjunktivII","#A2"],"ai_speech_hints":{"focus_phonemes":["/ˈkœntə/"],"common_errors_vi":["könnte: ö=/œ/ tròn môi"],"ipa_target":"ˈkœntə"}}
  ],
  "phrases": [
    {"german":"Ich würde gern mehr reisen.","meaning":"Tôi muốn được đi du lịch nhiều hơn.","speak_de":"Ich würde gern mehr reisen."},
    {"german":"Könnten Sie mir bitte helfen?","meaning":"Bạn có thể giúp tôi không?","speak_de":"Könnten Sie mir bitte helfen?"},
    {"german":"Das wäre sehr nett!","meaning":"Thật tuyệt vời!","speak_de":"Das wäre sehr nett!"},
    {"german":"Ich hätte gern einen Kaffee.","meaning":"Tôi muốn một ly cà phê.","speak_de":"Ich hätte gern einen Kaffee."}
  ],
  "examples": [
    {"german":"Im Restaurant:\n— Was hätten Sie gern?\n— Ich hätte gern das Schnitzel mit Salat, bitte.\n— Und zu trinken?\n— Ich würde gern ein Mineralwasser nehmen.\n— Würden Sie auch eine Vorspeise möchten?\n— Ja, könnten Sie mir die Suppe des Tages bringen?","translation":"Trong nhà hàng:\n— Quý khách muốn gì?\n— Tôi muốn Schnitzel với salad.\n— Và đồ uống?\n— Tôi muốn nước khoáng.\n— Quý khách có muốn món khai vị không?\n— Có, bạn có thể mang cho tôi súp hôm nay không?","note":"hätte gern = muốn (lịch sự trong nhà hàng)","speak_de":"Ich hätte gern das Schnitzel."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg39_01","type":"FILL_BLANK","sentence_de":"Ich ___ gern nach Japan reisen. (würde)","hint_vi":"điền thì würde dạng ich","answer":"würde","accept_also":["würde"]},
      {"id":"tg39_02","type":"MULTIPLE_CHOICE","question_vi":"Lịch sự hơn là cách nào?","options":["Können Sie mir helfen?","Könnten Sie mir helfen?","Hilf mir!","Ich will Hilfe."],"correct":1},
      {"id":"tg39_03","type":"FILL_BLANK","sentence_de":"Das ___ wirklich toll! (wäre)","hint_vi":"wäre = KII của sein","answer":"wäre","accept_also":["wäre"]},
      {"id":"tg39_04","type":"FILL_BLANK","sentence_de":"Ich ___ gern mehr Zeit. (hätte)","hint_vi":"hätte = KII của haben","answer":"hätte","accept_also":["hätte"]},
      {"id":"tg39_05","type":"MULTIPLE_CHOICE","question_vi":"''Wir ___ gern im Ausland leben.'' — điền gì?","options":["würdet","würde","würden","würdest"],"correct":2}
    ],
    "practice": [
      {"id":"p39_01","type":"TRANSLATE","from":"vi","sentence":"Bạn có thể nói chậm hơn không?","answer":"Könnten Sie bitte langsamer sprechen?","accept_also":["Würden Sie bitte langsamer sprechen?"]},
      {"id":"p39_02","type":"REORDER","words":["gern","wohnen.","in","würde","Ich","Berlin"],"correct_order":["Ich","würde","gern","in","Berlin","wohnen."],"translation":"Tôi muốn sống ở Berlin."},
      {"id":"p39_03","type":"FILL_BLANK","sentence_de":"___ Sie mir bitte die Rechnung bringen?","hint_vi":"Lịch sự = Konjunktiv II","answer":"Würden","accept_also":["Könnten"]}
    ]
  },
  "reading_passage": {
    "text_de": "Mein Traumleben\n\nWenn ich viel Geld hätte, würde ich die Welt bereisen. Ich würde nach Neuseeland, Japan und Brasilien fahren. Ich wäre frei und müsste nicht jeden Tag arbeiten. Ich hätte Zeit für meine Familie und meine Hobbys. Außerdem würde ich gern eine neue Sprache lernen — vielleicht Japanisch oder Portugiesisch. Das wäre mein perfektes Leben!",
    "text_vi": "Cuộc sống mơ ước của tôi\n\nNếu tôi có nhiều tiền, tôi sẽ đi du lịch khắp thế giới. Tôi sẽ đi New Zealand, Nhật Bản và Brazil. Tôi sẽ tự do và không phải làm việc mỗi ngày. Tôi sẽ có thời gian cho gia đình và sở thích của mình. Ngoài ra, tôi cũng muốn học một ngôn ngữ mới — có lẽ là tiếng Nhật hoặc tiếng Bồ Đào Nha. Đó sẽ là cuộc sống hoàn hảo của tôi!",
    "questions": [
      {"id":"rq39_01","type":"FILL_BLANK","question_vi":"Người viết muốn đi đâu?","answer":"Neuseeland, Japan und Brasilien","accept_also":["Japan","Brasilien","Neuseeland"]},
      {"id":"rq39_02","type":"MULTIPLE_CHOICE","question_vi":"Ngôn ngữ nào người viết muốn học thêm?","options":["Chinesisch","Japanisch","Arabisch","Russisch"],"correct":1}
    ]
  },
  "writing_prompt": {"task_de":"Was würden Sie tun, wenn Sie viel Freizeit hätten? Schreiben Sie 5 Sätze.","task_vi":"Bạn sẽ làm gì nếu có nhiều thời gian rảnh? Viết 5 câu.","min_sentences":5,"example_answer":"Wenn ich viel Freizeit hätte, würde ich mehr Sport treiben.\nIch würde gern Klavier spielen lernen.\nAußerdem würde ich mehr Bücher lesen.\nIch hätte Zeit für meine Freunde und Familie.\nDas wäre wirklich wunderbar!"},
  "audio_content": {
    "listen_words": [
      {"text":"Ich würde gern reisen.","meaning":"Tôi muốn đi du lịch."},
      {"text":"Das wäre sehr schön.","meaning":"Thật tuyệt vời."},
      {"text":"Könnten Sie mir helfen?","meaning":"Bạn có thể giúp tôi không?"},
      {"text":"Ich hätte gern einen Kaffee.","meaning":"Tôi muốn một ly cà phê."}
    ],
    "listen_dialogue": "Hätten Sie einen Moment Zeit? — Ja, natürlich. Was kann ich für Sie tun? — Ich würde gern wissen, wo der Bahnhof ist. — Das wäre einfach! Gehen Sie geradeaus. — Vielen Dank, das ist sehr nett!"
  }
}'::jsonb
WHERE day_number = 39 AND cefr_level = 'A2' AND is_active = TRUE;

-- ─── Day 40: Passiv Präsens ───────────────────────────────────────────────────
UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Passiv Präsens — werden + Partizip II", "vi": "Bị động thì hiện tại"},
  "overview": {"de": "Das Auto wird repariert. Die Tür wird geöffnet.", "vi": "Bị động: chuyển trọng tâm từ người làm sang hành động. Cấu trúc: werden (hiện tại) + Partizip II."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Cấu trúc Passiv Präsens"},"content":{"vi":"Chủ động: Der Mechaniker repariert das Auto.\nBị động: Das Auto WIRD (von dem Mechaniker) REPARIERT.\n\nwird/werden = Hilfsverb (chia theo chủ ngữ)\nPartizipII = ở cuối câu\n\nChia werden:\nik werde\ndu wirst\ner/sie/es wird\nwir werden\nihr werdet\nsie/Sie werden"},"tags":["#Passiv","#A2"]},
    {"type":"RULE","title":{"vi":"Khi dùng bị động"},"content":{"vi":"Dùng Passiv khi:\n1. Không biết / không quan trọng ai làm:\nDie Fenster werden geputzt. (Ai đó lau cửa sổ.)\n2. Nhấn mạnh hành động, không phải chủ thể:\nDie Brücke wird gebaut. (Cầu đang được xây.)\n3. Văn bản chính thức / hướng dẫn:\nDie Formulare werden ausgefüllt. (Các form được điền.)"},"tags":["#Passiv","#Textsorte"]},
    {"type":"EXAMPLE","title":{"vi":"Ví dụ thực tế"},"content":{"vi":"Im Supermarkt: Die Lebensmittel werden täglich geliefert.\nIm Büro: Die E-Mails werden jeden Morgen gelesen.\nIm Restaurant: Das Essen wird frisch zubereitet.\nIn der Schule: Die Hausaufgaben werden korrigiert."},"tags":["#Passiv","#Alltag"]}
  ],
  "vocabulary": [
    {"id":"v_pass_01","german":"reparieren","meaning":"sửa chữa","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Auto wird von einem Mechaniker repariert.","example_vi":"Xe ô tô đang được thợ cơ khí sửa.","speak_de":"Das Auto wird repariert.","tags":["#Passiv","#A2"],"ai_speech_hints":{"focus_phonemes":["/ʁepaʁiːʁən/"],"common_errors_vi":["re-pa-RIE-ren: nhấn IE"],"ipa_target":"ʁepaˈʁiːʁən"}},
    {"id":"v_pass_02","german":"herstellen","meaning":"sản xuất / chế tạo","gender":null,"color_code":null,"gender_label":null,"example_de":"Dieses Produkt wird in Deutschland hergestellt.","example_vi":"Sản phẩm này được sản xuất ở Đức.","speak_de":"Wird in Deutschland hergestellt.","tags":["#Passiv","#Industrie"],"ai_speech_hints":{"focus_phonemes":["/ˈheːɐ̯ˌʃtɛlən/"],"common_errors_vi":["her+stellen: trennbar"],"ipa_target":"ˈheːɐ̯ʃtɛlən"}},
    {"id":"v_pass_03","german":"öffnen / schließen","meaning":"mở / đóng","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Tür wird um 8 Uhr geöffnet.","example_vi":"Cửa được mở lúc 8 giờ.","speak_de":"Die Tür wird geöffnet.","tags":["#Passiv","#Alltag"],"ai_speech_hints":{"focus_phonemes":["/ˈœfnən/"],"common_errors_vi":["öffnen: ö=/œ/"],"ipa_target":"ˈœfnən"}}
  ],
  "phrases": [
    {"german":"Das wird hier nicht gemacht.","meaning":"Điều đó không được làm ở đây.","speak_de":"Das wird nicht gemacht."},
    {"german":"Das Essen wird frisch zubereitet.","meaning":"Thức ăn được chuẩn bị tươi.","speak_de":"Das Essen wird frisch zubereitet."},
    {"german":"Hier wird Deutsch gesprochen.","meaning":"Ở đây người ta nói tiếng Đức.","speak_de":"Hier wird Deutsch gesprochen."}
  ],
  "examples": [
    {"german":"In Deutschland:\n• Brot wird täglich frisch gebacken.\n• Müll wird regelmäßig getrennt und recycelt.\n• Weihnachten wird am 25. Dezember gefeiert.\n• In Bayern wird viel Bier gebraut.\n• Kinder werden in der Schule kostenlos unterrichtet.","translation":"Ở Đức:\n• Bánh mì được nướng tươi mỗi ngày.\n• Rác được phân loại và tái chế thường xuyên.\n• Giáng sinh được tổ chức vào ngày 25/12.\n• Ở Bayern người ta ủ nhiều bia.\n• Trẻ em được giáo dục miễn phí ở trường.","note":"Passiv thể hiện thói quen, quy trình","speak_de":"Brot wird täglich gebacken."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg40_01","type":"FILL_BLANK","sentence_de":"Das Auto ___ repariert. (werden, er/sie/es)","hint_vi":"wird","answer":"wird","accept_also":["wird"]},
      {"id":"tg40_02","type":"MULTIPLE_CHOICE","question_vi":"Bị động của ''Man öffnet die Tür'' là gì?","options":["Die Tür öffnet man.","Die Tür wird geöffnet.","Die Tür ist geöffnet.","Die Tür hat geöffnet."],"correct":1},
      {"id":"tg40_03","type":"FILL_BLANK","sentence_de":"Die Hausaufgaben ___ von den Schülern gemacht.","hint_vi":"werden","answer":"werden","accept_also":["werden"]},
      {"id":"tg40_04","type":"FILL_BLANK","sentence_de":"Dieses Auto ___ in Deutschland hergestellt.","hint_vi":"wird","answer":"wird","accept_also":["wird"]},
      {"id":"tg40_05","type":"MULTIPLE_CHOICE","question_vi":"Đâu là bị động đúng của ''kaufen''?","options":["wird gekauft","wird kauft","wird kauf","kauft wird"],"correct":0}
    ],
    "practice": [
      {"id":"p40_01","type":"TRANSLATE","from":"vi","sentence":"Thư được viết bằng tiếng Đức.","answer":"Der Brief wird auf Deutsch geschrieben.","accept_also":["Der Brief wird in Deutsch geschrieben."]},
      {"id":"p40_02","type":"REORDER","words":["hergestellt.","in","Dieses","Deutschland","Produkt","wird"],"correct_order":["Dieses","Produkt","wird","in","Deutschland","hergestellt."],"translation":"Sản phẩm này được sản xuất ở Đức."},
      {"id":"p40_03","type":"FILL_BLANK","sentence_de":"Hier ___ nicht geraucht!","hint_vi":"wird","answer":"wird","accept_also":["wird"]}
    ]
  },
  "reading_passage": {
    "text_de": "Wie wird Brot in Deutschland gemacht?\n\nIn Deutschland wird Brot mit viel Sorgfalt hergestellt. Zunächst werden Mehl, Wasser, Salz und Hefe vermischt. Dann wird der Teig geknetet und ruhen gelassen. Anschließend wird er geformt und in den Ofen gelegt. Das Brot wird bei hoher Temperatur gebacken. Nach dem Backen wird es abgekühlt und verpackt. Täglich werden in Deutschland Millionen Brote hergestellt — in über 3.000 Brotsorten!",
    "text_vi": "Bánh mì ở Đức được làm như thế nào?\n\nỞ Đức bánh mì được làm rất cẩn thận. Đầu tiên bột mì, nước, muối và men nở được trộn lại. Sau đó bột được nhào và để nghỉ. Tiếp theo bột được tạo hình và cho vào lò. Bánh mì được nướng ở nhiệt độ cao. Sau khi nướng xong nó được để nguội và đóng gói. Hàng ngày hàng triệu ổ bánh mì được sản xuất ở Đức — với hơn 3.000 loại bánh mì!",
    "questions": [
      {"id":"rq40_01","type":"FILL_BLANK","question_vi":"Nguyên liệu nào được nhắc đến?","answer":"Mehl, Wasser, Salz und Hefe","accept_also":["Mehl","Wasser","Salz","Hefe"]},
      {"id":"rq40_02","type":"MULTIPLE_CHOICE","question_vi":"Ở Đức có bao nhiêu loại bánh mì?","options":["über 300","über 1.000","über 3.000","über 10.000"],"correct":2}
    ]
  },
  "writing_prompt": {"task_de":"Beschreiben Sie einen Prozess mit Passiv (z.B. wie ein Kaffee gemacht wird, wie Müll getrennt wird).","task_vi":"Miêu tả một quy trình dùng bị động (ví dụ: cách pha cà phê, cách phân loại rác).","min_sentences":4,"example_answer":"Zuerst wird Wasser erhitzt.\nDann wird Kaffeepulver in die Maschine gegeben.\nDas Wasser wird durch das Pulver gefiltert.\nSchließlich wird der Kaffee in eine Tasse gegossen und serviert."},
  "audio_content": {
    "listen_words": [
      {"text":"Das wird repariert.","meaning":"Cái đó đang được sửa."},
      {"text":"Das Brot wird gebacken.","meaning":"Bánh mì đang được nướng."},
      {"text":"Hier wird Deutsch gesprochen.","meaning":"Ở đây người ta nói tiếng Đức."}
    ],
    "listen_dialogue": "Wann wird das Paket geliefert? — Es wird morgen zugestellt. — Und wo wird es abgegeben? — Es wird an der Haustür hinterlassen."
  }
}'::jsonb
WHERE day_number = 40 AND cefr_level = 'A2' AND is_active = TRUE;
