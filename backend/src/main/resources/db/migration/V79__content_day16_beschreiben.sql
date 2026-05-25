-- V79: Day 16 — Personen beschreiben (Adjektive + sein)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Personen beschreiben", "vi": "Miêu tả người"},
  "overview": {
    "de": "Adjektive mit sein: Personen und Dinge beschreiben.",
    "vi": "Học cách dùng tính từ để miêu tả ngoại hình và tính cách. Tính từ sau ''sein'' không biến đổi theo giống — đây là tin vui cho người mới học!"
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Tính từ sau sein — không biến đổi"},
      "content": {"vi": "Khi tính từ đứng SAU động từ sein → không thêm đuôi:\n✅ Er ist groß. (Anh ấy cao.)\n✅ Sie ist nett. (Cô ấy tốt bụng.)\n✅ Das Kind ist klein. (Đứa trẻ nhỏ.)\n\n⚠️ KHÁC với khi đứng TRƯỚC Nomen:\nein großer Mann (một người đàn ông cao)"},
      "tags": ["#Adjektiv", "#sein", "#Grammatik"]
    },
    {
      "type": "RULE",
      "title": {"vi": "So sánh: groß ↔ klein, alt ↔ jung"},
      "content": {"vi": "Đối lập:\ngroß ↔ klein (cao/to ↔ nhỏ/thấp)\nalt ↔ jung (già ↔ trẻ)\ndick ↔ dünn (mập ↔ gầy)\nlang ↔ kurz (dài ↔ ngắn) — tóc\nhübsch / schön (xinh đẹp)\nnett / freundlich (tốt bụng / thân thiện)\nstreng (nghiêm khắc)\nlustig (vui tính)"},
      "tags": ["#Adjektiv", "#Gegenteil"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Miêu tả ngoại hình & tính cách"},
      "content": {"vi": "Mein Vater ist groß und schlank. Er hat kurze, graue Haare und ist sehr freundlich.\nMeine Mutter ist nicht sehr groß, aber sehr elegant. Sie hat lange, schwarze Haare.\nMein Bruder ist jung und sportlich. Er ist sehr lustig.\n→ Tip: Dùng ''und'', ''aber'', ''sehr'', ''nicht sehr'' để tạo câu phức tạp hơn."},
      "tags": ["#Adjektiv", "#Beschreibung"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_adj_01", "german": "groß / klein", "meaning": "cao-to / nhỏ-thấp",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Mein Bruder ist sehr groß, aber meine Schwester ist klein.", "example_vi": "Anh trai tôi rất cao, nhưng em/chị gái tôi thấp.",
      "speak_de": "Er ist groß. Sie ist klein.", "tags": ["#Adjektiv", "#Größe", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɡʁoːs/", "/klaɪ̯n/"], "common_errors_vi": ["groß: ß=ss; klein: ei=/ai/"], "ipa_target": "ɡʁoːs"}
    },
    {
      "id": "v_adj_02", "german": "alt / jung", "meaning": "già / trẻ",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Mein Großvater ist alt. Mein Sohn ist jung.", "example_vi": "Ông tôi già. Con trai tôi còn trẻ.",
      "speak_de": "Er ist alt. Sie ist jung.", "tags": ["#Adjektiv", "#Alter", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/alt/", "/jʊŋ/"], "common_errors_vi": ["jung: j=/j/, ng cuối như ''nung''"], "ipa_target": "alt / jʊŋ"}
    },
    {
      "id": "v_adj_03", "german": "nett / freundlich", "meaning": "tốt bụng / thân thiện",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Meine Kollegen sind sehr freundlich.", "example_vi": "Đồng nghiệp tôi rất thân thiện.",
      "speak_de": "Sie ist sehr freundlich", "tags": ["#Adjektiv", "#Charakter", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/nɛt/", "/ˈfʁɔʏ̯ntlɪç/"], "common_errors_vi": ["freundlich: eu=/ɔʏ/, ch cuối=ich-Laut"], "ipa_target": "nɛt / ˈfʁɔʏ̯ntlɪç"}
    },
    {
      "id": "v_adj_04", "german": "lustig / streng", "meaning": "vui tính / nghiêm khắc",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Unser Lehrer ist lustig, aber manchmal streng.", "example_vi": "Giáo viên chúng tôi vui tính, nhưng đôi khi nghiêm khắc.",
      "speak_de": "Er ist lustig aber streng", "tags": ["#Adjektiv", "#Charakter", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈlʊstɪç/", "/ʃtʁɛŋ/"], "common_errors_vi": ["lustig: ch cuối=ich-Laut /ç/"], "ipa_target": "ˈlʊstɪç"}
    },
    {
      "id": "v_adj_05", "german": "die Haare (Pl.)", "meaning": "tóc (luôn dùng số nhiều)",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f-pl",
      "example_de": "Sie hat lange, blonde Haare.", "example_vi": "Cô ấy có mái tóc dài màu vàng.",
      "speak_de": "Sie hat lange blonde Haare", "tags": ["#Körper", "#Aussehen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈhaːʁə/"], "common_errors_vi": ["Haare luôn số nhiều, H bật /h/"], "ipa_target": "diː ˈhaːʁə"}
    },
    {
      "id": "v_adj_06", "german": "hübsch / schön", "meaning": "xinh xắn / đẹp",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Das Mädchen ist sehr hübsch.", "example_vi": "Cô gái trông rất xinh.",
      "speak_de": "Sie ist sehr hübsch", "tags": ["#Adjektiv", "#Aussehen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/hʏpʃ/"], "common_errors_vi": ["hübsch: ü tròn môi, psch=/pʃ/"], "ipa_target": "hʏpʃ"}
    },
    {
      "id": "v_adj_07", "german": "sportlich / schlank", "meaning": "thể thao / thon thả",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Mein Bruder ist sportlich und schlank.", "example_vi": "Anh trai tôi thể thao và thon thả.",
      "speak_de": "Er ist sportlich und schlank", "tags": ["#Adjektiv", "#Aussehen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈʃpɔʁtlɪç/"], "common_errors_vi": ["sportlich: sp=/ʃp/ ở đầu, ch=/ç/"], "ipa_target": "ˈʃpɔʁtlɪç"}
    }
  ],
  "phrases": [
    {"german": "Wie sieht er/sie aus?", "meaning": "Anh ấy/cô ấy trông thế nào?", "speak_de": "Wie sieht sie aus?"},
    {"german": "Er hat kurze, braune Haare und blaue Augen.", "meaning": "Anh ấy có tóc ngắn nâu và mắt xanh.", "speak_de": "Er hat kurze braune Haare und blaue Augen."},
    {"german": "Sie ist sehr sympathisch.", "meaning": "Cô ấy rất dễ mến.", "speak_de": "Sie ist sehr sympathisch."}
  ],
  "examples": [
    {"german": "Wie ist dein Vater? — Mein Vater ist groß und schlank. Er hat kurze, graue Haare. Er ist sehr nett und freundlich.", "translation": "Cha bạn như thế nào? — Cha tôi cao và thon. Ông có tóc ngắn bạc. Ông rất tốt bụng và thân thiện.", "note": "Miêu tả ngoại hình + tính cách", "speak_de": "Mein Vater ist groß und schlank."},
    {"german": "Meine beste Freundin heißt Linh. Sie ist hübsch und hat lange, schwarze Haare. Sie ist lustig und sehr intelligent.", "translation": "Bạn thân nhất của tôi tên Linh. Cô ấy xinh và có mái tóc dài đen. Cô ấy vui tính và rất thông minh.", "note": "beste Freundin = bạn thân nhất (nữ)", "speak_de": "Meine beste Freundin ist hübsch."}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg16_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Câu nào ĐÚNG về ngữ pháp?",
        "options": ["Er ist großer.", "Er ist groß.", "Er ist großes.", "Er ist großen."],
        "correct": 1
      },
      {
        "id": "tg16_02", "type": "FILL_BLANK",
        "sentence_de": "Meine Mutter ist nicht sehr ___, aber sehr ___.",
        "hint_vi": "cao ... xinh đẹp",
        "answer": "groß, hübsch", "accept_also": ["groß / hübsch", "groß, schön"]
      },
      {
        "id": "tg16_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "Tính từ nào là từ trái nghĩa của ''jung''?",
        "options": ["klein", "alt", "nett", "groß"],
        "correct": 1
      },
      {
        "id": "tg16_04", "type": "FILL_BLANK",
        "sentence_de": "Sie ___ lange, schwarze Haare und braune Augen.",
        "hint_vi": "có (ngoại hình)",
        "answer": "hat", "accept_also": ["hat"]
      },
      {
        "id": "tg16_05", "type": "MULTIPLE_CHOICE",
        "question_vi": "''freundlich'' nghĩa là gì?",
        "options": ["nghiêm khắc", "thân thiện", "thông minh", "mập"],
        "correct": 1
      }
    ],
    "practice": [
      {
        "id": "p16_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Bạn thân của tôi vui tính và thông minh. Cô ấy có tóc dài.",
        "answer": "Meine Freundin ist lustig und intelligent. Sie hat lange Haare.",
        "accept_also": ["Meine beste Freundin ist lustig und intelligent. Sie hat lange Haare."]
      },
      {
        "id": "p16_02", "type": "REORDER",
        "words": ["Haare.", "schwarze", "hat", "lange,", "Sie"],
        "correct_order": ["Sie", "hat", "lange,", "schwarze", "Haare."],
        "translation": "Cô ấy có tóc dài màu đen."
      },
      {
        "id": "p16_03", "type": "FILL_BLANK",
        "sentence_de": "Mein Lehrer ist ___ und manchmal ___, aber immer fair.",
        "hint_vi": "vui tính ... nghiêm khắc",
        "answer": "lustig, streng", "accept_also": ["lustig / streng"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Mein bester Freund\n\nMein bester Freund heißt Duc. Er kommt aus Vietnam und wohnt jetzt in Berlin. Duc ist 28 Jahre alt. Er ist groß und sportlich. Er hat kurze, schwarze Haare und braune Augen. Duc ist sehr freundlich und lustig — alle mögen ihn. Er ist Ingenieur bei einem Autokonzern. In seiner Freizeit spielt er Fußball und lernt Deutsch.",
    "text_vi": "Người bạn thân nhất của tôi\n\nNgười bạn thân nhất của tôi tên Đức. Anh ấy đến từ Việt Nam và hiện sống ở Berlin. Đức 28 tuổi. Anh ấy cao và thể thao. Anh ấy có tóc ngắn đen và mắt nâu. Đức rất thân thiện và vui tính — mọi người đều thích anh ấy. Anh ấy là kỹ sư tại một tập đoàn ô tô. Trong thời gian rảnh anh ấy chơi bóng đá và học tiếng Đức.",
    "questions": [
      {
        "id": "rq16_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Duc trông như thế nào?",
        "options": ["klein und dick", "groß und sportlich", "alt und freundlich", "jung und streng"],
        "correct": 1
      },
      {
        "id": "rq16_02", "type": "FILL_BLANK",
        "question_vi": "Duc làm gì trong thời gian rảnh? (2 hoạt động)",
        "answer": "Fußball spielen und Deutsch lernen", "accept_also": ["Fußball und Deutsch lernen", "Er spielt Fußball und lernt Deutsch"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie eine Person aus Ihrer Familie oder einen Freund: Aussehen und Charakter. (5-6 Sätze)",
    "task_vi": "Hãy miêu tả một người trong gia đình hoặc bạn bè: ngoại hình và tính cách. (5-6 câu)",
    "min_sentences": 5,
    "example_answer": "Meine Mutter heißt Thu.\nSie ist 52 Jahre alt.\nSie ist nicht sehr groß, aber sehr elegant.\nSie hat lange, schwarze Haare.\nMeine Mutter ist sehr nett und freundlich.\nAlle mögen sie sehr."
  },
  "audio_content": {
    "listen_words": [
      {"text": "Er ist groß und sportlich.", "meaning": "Anh ấy cao và thể thao."},
      {"text": "Sie hat lange, schwarze Haare.", "meaning": "Cô ấy có tóc dài đen."},
      {"text": "Wie sieht er aus?", "meaning": "Anh ấy trông thế nào?"},
      {"text": "Sie ist freundlich und lustig.", "meaning": "Cô ấy thân thiện và vui tính."},
      {"text": "nett / streng / sportlich", "meaning": "tốt bụng / nghiêm khắc / thể thao"}
    ],
    "listen_dialogue": "Wie ist dein Vater? — Er ist groß und hat kurze, graue Haare. Er ist sehr freundlich. — Und deine Mutter? — Sie ist hübsch und nett."
  }
}'::jsonb
WHERE day_number = 16 AND is_active = TRUE;
