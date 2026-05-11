-- V80: Day 17 — Review Module 4 (Familie & Beschreibung)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 4", "vi": "Ôn tập Module 4 — Gia đình & Miêu tả"},
  "overview": {
    "de": "Wiederholung: Familie, Possessivpronomen, Adjektive zur Beschreibung.",
    "vi": "Ôn tập Module 4: thành viên gia đình, tính từ sở hữu (mein/dein/sein/ihr), miêu tả ngoại hình và tính cách. Bài tổng hợp trước khi sang chủ đề Mua sắm & Đồ ăn."
  },
  "session_type": "REVIEW",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Bảng Possessivpronomen"},
      "content": {"vi": "          | DER (m) | DIE (f) | DAS (n)\nich       | mein    | meine   | mein\ndu        | dein    | deine   | dein\ner/es     | sein    | seine   | sein\nsie (sie) | ihr     | ihre    | ihr\nSie       | Ihr     | Ihre    | Ihr\n\nVí dụ:\nMein Bruder (m), meine Schwester (f), mein Kind (n)"},
      "tags": ["#Possessivpronomen", "#Tabelle"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Ngoại hình + Tính cách: Bảng tổng hợp"},
      "content": {"vi": "NGOẠI HÌNH:\ngroß/klein | alt/jung | dick/schlank\nhübsch/schön | sportlich | elegant\nlange/kurze Haare | blonde/schwarze/graue Haare\n\nTÍNH CÁCH:\nnett | freundlich | lustig | streng\nintelligent | fleißig (chăm chỉ) | sympathisch"},
      "tags": ["#Adjektiv", "#Wiederholung"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Dialog tổng hợp"},
      "content": {"vi": "— Haben Sie Geschwister?\n— Ja, ich habe einen älteren Bruder und eine jüngere Schwester.\n— Wie ist Ihr Bruder?\n— Er ist groß und sportlich. Er hat kurze, braune Haare. Er ist sehr nett.\n— Und Ihre Schwester?\n— Meine Schwester ist Ärztin. Sie ist intelligent und freundlich."},
      "tags": ["#Dialog", "#Familie"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_rev4_01", "german": "die Eltern (Pl.)", "meaning": "bố mẹ (luôn số nhiều)",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f-pl",
      "example_de": "Meine Eltern wohnen noch in Vietnam.", "example_vi": "Bố mẹ tôi vẫn sống ở Việt Nam.",
      "speak_de": "Meine Eltern", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈɛltɐn/"], "common_errors_vi": ["Eltern luôn dùng số nhiều, không có Elter"], "ipa_target": "diː ˈɛltɐn"}
    },
    {
      "id": "v_rev4_02", "german": "der Onkel / die Tante", "meaning": "chú/cậu/bác trai / cô/dì/bác gái",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Mein Onkel und meine Tante wohnen in München.", "example_vi": "Chú và cô tôi sống ở Munich.",
      "speak_de": "mein Onkel, meine Tante", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈɔŋkl̩/"], "common_errors_vi": ["Onkel: O ngắn /ɔ/"], "ipa_target": "deːɐ̯ ˈɔŋkl̩"}
    },
    {
      "id": "v_rev4_03", "german": "fleißig / faul", "meaning": "chăm chỉ / lười biếng",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Meine Tochter ist sehr fleißig in der Schule.", "example_vi": "Con gái tôi rất chăm chỉ ở trường.",
      "speak_de": "Sie ist fleißig", "tags": ["#Adjektiv", "#Charakter", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈflaɪ̯sɪç/"], "common_errors_vi": ["fleißig: ei=/ai/, ß=ss, ch=/ç/"], "ipa_target": "ˈflaɪ̯sɪç"}
    },
    {
      "id": "v_rev4_04", "german": "der Cousin / die Cousine", "meaning": "anh/em họ nam / anh/em họ nữ",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Mein Cousin wohnt in Frankreich.", "example_vi": "Anh/em họ của tôi sống ở Pháp.",
      "speak_de": "mein Cousin", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/kuˈzɛ̃/"], "common_errors_vi": ["Cousin: từ tiếng Pháp, đọc /ku-zɛ̃/"], "ipa_target": "deːɐ̯ kuˈzɛ̃"}
    },
    {
      "id": "v_rev4_05", "german": "intelligent / klug", "meaning": "thông minh",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Mein Sohn ist sehr intelligent.", "example_vi": "Con trai tôi rất thông minh.",
      "speak_de": "Er ist sehr intelligent", "tags": ["#Adjektiv", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɪntɛliˈɡɛnt/"], "common_errors_vi": ["Nhấn vào -gent: in-tel-li-GENT"], "ipa_target": "ɪntɛliˈɡɛnt"}
    }
  ],
  "phrases": [
    {"german": "Meine Familie ist sehr wichtig für mich.", "meaning": "Gia đình rất quan trọng với tôi.", "speak_de": "Meine Familie ist sehr wichtig für mich."},
    {"german": "Wir sehen uns nicht so oft.", "meaning": "Chúng tôi không gặp nhau thường xuyên.", "speak_de": "Wir sehen uns nicht so oft."},
    {"german": "Ich vermisse meine Familie.", "meaning": "Tôi nhớ gia đình mình.", "speak_de": "Ich vermisse meine Familie."}
  ],
  "examples": [
    {"german": "Das ist meine Familie. Mein Vater ist groß und freundlich. Meine Mutter ist hübsch und klug. Ich habe einen Bruder — er ist jünger als ich und sehr lustig.", "translation": "Đây là gia đình tôi. Cha tôi cao và thân thiện. Mẹ tôi xinh và thông minh. Tôi có một người em trai — cậu ấy nhỏ hơn tôi và rất vui tính.", "note": "jünger als = nhỏ hơn (so sánh)", "speak_de": "Das ist meine Familie."},
    {"german": "Sein Großvater ist 85 Jahre alt. Er ist alt, aber noch fit und aktiv.", "translation": "Ông nội/ngoại của anh ấy 85 tuổi. Ông già rồi, nhưng vẫn còn khỏe và năng động.", "note": "aber = nhưng; noch = vẫn còn", "speak_de": "Er ist alt aber noch fit."}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg17_01", "type": "FILL_BLANK",
        "sentence_de": "Das ist ___ Onkel. Er ist der Bruder ___ Vaters.",
        "hint_vi": "của tôi ... của (không dùng ở A1, chỉ cần mein)",
        "answer": "mein, meines", "accept_also": ["mein / meines", "mein"]
      },
      {
        "id": "tg17_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "''die Eltern'' là gì?",
        "options": ["Cha hoặc mẹ", "Bố mẹ (luôn số nhiều)", "Ông bà", "Anh chị em"],
        "correct": 1
      },
      {
        "id": "tg17_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Er ist fleißig'' — fleißig nghĩa là?",
        "options": ["lười", "thông minh", "chăm chỉ", "vui tính"],
        "correct": 2
      },
      {
        "id": "tg17_04", "type": "FILL_BLANK",
        "sentence_de": "Meine Schwester hat ___ braune Haare und ___ Augen.",
        "hint_vi": "dài ... màu xanh lá",
        "answer": "lange, grüne", "accept_also": ["lange / grüne", "lange, braune"]
      },
      {
        "id": "tg17_05", "type": "MULTIPLE_CHOICE",
        "question_vi": "Possessivpronomen cho ''sie (cô ấy)'' với DER-Nomen?",
        "options": ["sein", "ihr", "ihre", "mein"],
        "correct": 1
      }
    ],
    "practice": [
      {
        "id": "p17_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Cha tôi già nhưng còn rất khỏe. Ông có tóc bạc và cao.",
        "answer": "Mein Vater ist alt, aber noch sehr fit. Er hat graue Haare und ist groß.",
        "accept_also": ["Mein Vater ist alt aber fit. Er hat graue Haare und ist groß."]
      },
      {
        "id": "p17_02", "type": "REORDER",
        "words": ["Familie.", "meine", "wichtig", "ist", "sehr", "Mir"],
        "correct_order": ["Mir", "ist", "meine", "Familie", "sehr", "wichtig."],
        "translation": "Gia đình rất quan trọng với tôi."
      },
      {
        "id": "p17_03", "type": "FILL_BLANK",
        "sentence_de": "___ Mutter ist Ärztin und ___ Vater ist Ingenieur.",
        "hint_vi": "Của cô ấy (f) ... Của anh ấy (m)",
        "answer": "Ihre, Sein", "accept_also": ["ihre, sein", "Ihre / Sein"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Eine vietnamesische Familie in Deutschland\n\nDie Familie Nguyen lebt seit fünf Jahren in Frankfurt. Der Vater Hung ist 45 Jahre alt. Er ist groß und schlank und arbeitet als Koch. Die Mutter Lan ist 42 Jahre alt. Sie ist hübsch, hat lange Haare und ist sehr freundlich. Sie arbeitet als Krankenpflegerin. Die Tochter Linh ist 19 Jahre alt. Sie studiert Medizin — sie ist fleißig und intelligent. Der Sohn Nam ist 15 Jahre alt. Er ist sportlich und lustig.",
    "text_vi": "Một gia đình người Việt ở Đức\n\nGia đình Nguyễn sống tại Frankfurt được năm năm. Người cha Hùng 45 tuổi. Ông cao và thon và làm đầu bếp. Người mẹ Lan 42 tuổi. Bà xinh, có tóc dài và rất thân thiện. Bà làm điều dưỡng. Người con gái Linh 19 tuổi. Cô đang học y khoa — cô chăm chỉ và thông minh. Người con trai Nam 15 tuổi. Cậu thể thao và vui tính.",
    "questions": [
      {
        "id": "rq17_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Linh học ngành gì?",
        "options": ["Informatik", "Medizin", "Wirtschaft", "Sprachen"],
        "correct": 1
      },
      {
        "id": "rq17_02", "type": "FILL_BLANK",
        "question_vi": "Người cha Hùng làm nghề gì?",
        "answer": "Koch", "accept_also": ["Er ist Koch", "Koch von Beruf"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie einen kurzen Text über Ihre Familie (6-8 Sätze): Namen, Alter, Beruf, Aussehen und Charakter.",
    "task_vi": "Viết đoạn văn ngắn về gia đình bạn (6-8 câu): tên, tuổi, nghề nghiệp, ngoại hình và tính cách.",
    "min_sentences": 6,
    "example_answer": "Meine Familie hat vier Personen.\nMein Vater heißt Thanh und ist 55 Jahre alt. Er ist groß und freundlich und arbeitet als Koch.\nMeine Mutter heißt Mai. Sie ist 52 Jahre alt und ist Lehrerin. Sie ist nett und intelligent.\nMein Bruder Nam ist 22 Jahre alt. Er ist sportlich und lustig.\nWir alle vermissen Vietnam, aber wir leben gern in Deutschland."
  },
  "audio_content": {
    "listen_words": [
      {"text": "Meine Eltern wohnen in Vietnam.", "meaning": "Bố mẹ tôi sống ở Việt Nam."},
      {"text": "Ich vermisse meine Familie.", "meaning": "Tôi nhớ gia đình mình."},
      {"text": "Sie ist fleißig und intelligent.", "meaning": "Cô ấy chăm chỉ và thông minh."},
      {"text": "Er ist groß und sportlich.", "meaning": "Anh ấy cao và thể thao."},
      {"text": "die Eltern, der Onkel, die Tante", "meaning": "bố mẹ, chú/cậu, cô/dì"}
    ],
    "listen_dialogue": "Wie ist Ihre Familie? — Meine Familie ist groß und freundlich. Mein Vater ist groß und meine Mutter ist sehr nett. Ich vermisse sie sehr."
  }
}'::jsonb
WHERE day_number = 17 AND is_active = TRUE;
