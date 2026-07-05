-- V245 — A1 Day 2 "Phonetik und Aussprache" — SAMPLE nội dung 4 kỹ năng (Hybrid CORE, đóng băng)
-- Chứng minh khung Phase 1: theory_cards + vocabulary + skill_exercises {HOEREN,SPRECHEN,LESEN,SCHREIBEN}.
-- Bài tập dùng đúng schema PracticeExerciseGrader chấm server-side (correct_index / correct_answer+accept_also
-- / sentinel "spoken" cho phần AI chấm). ADDITIVE: các luồng hoàn thành cũ vẫn chạy (skill_exercises là dữ liệu
-- thêm cho runner 4 kỹ năng). ⚠️ Phase 2 sẽ mở rộng đủ ~6 bài/kỹ năng cho cả 30 ngày.
-- Loại bài tập: Hören = LISTEN_AND_CHOOSE/_FILL/DICTATION; Sprechen = SPEAKING_REPEAT/_RESPONSE (AI chấm);
-- Lesen = {reading_passage, exercises:[READ_AND_CHOOSE/READ_TRUE_FALSE]}; Schreiben = TRANSLATE_VI_DE/FILL_GRAMMAR/REORDER_WORDS.

UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Phonetik und Aussprache", "vi": "Phát âm và Ghép vần"},
  "overview": {"de": "Wichtige Laute: ä, ö, ü, ei, ie, eu, sch, ch.", "vi": "Các quy tắc phát âm quan trọng nhất của tiếng Đức."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type": "rule", "title": {"de": "Umlaute: ä ö ü", "vi": "Nguyên âm biến đổi"},
     "content": {"de": "ä wie e, ö wie ö (Lippen rund), ü wie ü (Lippen rund).",
                 "vi": "ä đọc gần như ê; ö tròn môi như ơ; ü tròn môi như uy. Chú ý tròn môi khi phát ö và ü."}},
    {"type": "rule", "title": {"de": "Doppellaute: ei ie eu", "vi": "Nguyên âm kép"},
     "content": {"de": "ei = ai, ie = langes i, eu = oi.",
                 "vi": "ei đọc là ai (mein = main); ie đọc i dài (Liebe); eu đọc là oi (neu = noi)."}},
    {"type": "rule", "title": {"de": "sch und ch", "vi": "Phụ âm ghép"},
     "content": {"de": "sch = sch, ch nach a/o/u = ach-Laut, ch nach e/i = ich-Laut.",
                 "vi": "sch đọc như s (Schule); ch sau a/o/u đọc khàn (Buch); ch sau e/i đọc mềm (ich)."}}
  ],
  "vocabulary": [
    {"id": "d2v1", "german": "schön", "meaning": "đẹp", "example_de": "Das Wetter ist schön.", "example_vi": "Thời tiết đẹp."},
    {"id": "d2v2", "german": "Brötchen", "meaning": "bánh mì nhỏ", "example_de": "Ich esse ein Brötchen.", "example_vi": "Tôi ăn một cái bánh mì."},
    {"id": "d2v3", "german": "Bücher", "meaning": "những cuốn sách", "example_de": "Die Bücher sind neu.", "example_vi": "Những cuốn sách thì mới."},
    {"id": "d2v4", "german": "neu", "meaning": "mới", "example_de": "Mein Auto ist neu.", "example_vi": "Xe của tôi thì mới."},
    {"id": "d2v5", "german": "Liebe", "meaning": "tình yêu", "example_de": "Liebe ist wichtig.", "example_vi": "Tình yêu thì quan trọng."},
    {"id": "d2v6", "german": "ich", "meaning": "tôi", "example_de": "Ich heiße Anna.", "example_vi": "Tôi tên là Anna."}
  ],
  "phrases": [],
  "examples": [],
  "exercises": {"theory_gate": [], "practice": []},
  "skill_exercises": {
    "HOEREN": [
      {"type": "LISTEN_AND_CHOOSE", "instruction_vi": "Nghe và chọn từ bạn nghe được",
       "audio_transcript": "Das Brötchen ist schön.", "question_vi": "Bạn nghe thấy từ nào?",
       "options": ["Brötchen", "Brotchen", "Broten"], "correct_index": 0,
       "explanation_vi": "ö tròn môi — Brötchen, không phải Brotchen."},
      {"type": "LISTEN_AND_FILL", "instruction_vi": "Nghe và điền từ còn thiếu",
       "audio_transcript": "Mein Auto ist neu.", "sentence_with_blank": "Mein Auto ist ___.",
       "correct_answer": "neu", "accept_also": ["Neu"], "explanation_vi": "eu đọc là oi: neu = /noi/."},
      {"type": "DICTATION", "instruction_vi": "Nghe và viết lại câu",
       "audio_transcript": "Ich lese ein Buch.", "correct_answer": "Ich lese ein Buch.",
       "accept_also": ["ich lese ein buch"], "explanation_vi": "ch sau u đọc khàn: Buch."}
    ],
    "SPRECHEN": [
      {"type": "SPEAKING_REPEAT", "instruction_vi": "Nghe và nhắc lại câu sau",
       "sentence_de": "Die Bücher sind schön.", "sentence_vi": "Những cuốn sách thì đẹp.",
       "focus_sounds": ["/yː/", "/ʃøːn/"], "explanation_vi": "ü trong Bücher tròn môi; ö trong schön tròn môi."},
      {"type": "SPEAKING_RESPONSE", "instruction_vi": "Trả lời câu hỏi bằng tiếng Đức",
       "question_de": "Wie heißen Sie?", "question_vi": "Bạn tên gì?", "expected_answer": "Ich heiße ...",
       "grading_keywords": ["heiße", "ich"], "accept_also": ["Mein Name ist ..."],
       "explanation_vi": "Dùng Ich heiße ... hoặc Mein Name ist ..."}
    ],
    "LESEN": {
      "reading_passage": {"text_de": "Anna ist neu in der Stadt. Sie liest gern Bücher. Am Morgen isst sie ein Brötchen. Das Wetter ist heute schön.",
                          "text_type": "Notiz", "text_vi_hint": "Anna mới đến thành phố, thích đọc sách, ăn sáng bằng bánh mì, thời tiết đẹp."},
      "exercises": [
        {"type": "READ_AND_CHOOSE", "instruction_vi": "Đọc và chọn đáp án đúng",
         "question_vi": "Anna thích làm gì?", "options": ["Đọc sách", "Nấu ăn", "Chạy bộ"], "correct_index": 0,
         "explanation_vi": "Sie liest gern Bücher = cô ấy thích đọc sách."},
        {"type": "READ_TRUE_FALSE", "instruction_vi": "Đọc và xác định Đúng/Sai",
         "statement_de": "Das Wetter ist schlecht.", "correct_answer": "falsch", "accept_also": ["false", "sai"],
         "explanation_vi": "Sai — trong bài nói das Wetter ist schön (đẹp)."}
      ]
    },
    "SCHREIBEN": [
      {"type": "TRANSLATE_VI_DE", "instruction_vi": "Dịch câu sau sang tiếng Đức",
       "sentence_vi": "Tôi đọc một cuốn sách.", "correct_answer": "Ich lese ein Buch.",
       "accept_also": ["ich lese ein buch"], "explanation_vi": "lesen = đọc; ein Buch = một cuốn sách."},
      {"type": "FILL_GRAMMAR", "instruction_vi": "Điền dạng đúng",
       "sentence_with_blank": "Das Wetter ist ___. (schön)", "hint_vi": "tính từ vị ngữ không đổi",
       "correct_answer": "schön", "accept_also": ["schon"], "grammar_rule_vi": "Tính từ đứng sau sein không chia: ist schön."},
      {"type": "REORDER_WORDS", "instruction_vi": "Sắp xếp thành câu đúng",
       "words": ["ein", "esse", "Ich", "Brötchen"], "correct_order": ["Ich", "esse", "ein", "Brötchen"],
       "correct_answer": "Ich esse ein Brötchen", "accept_also": ["ich esse ein brötchen"],
       "translation_vi": "Tôi ăn một cái bánh mì.", "explanation_vi": "Trật tự: Chủ ngữ + động từ + tân ngữ."}
    ]
  }
}'::jsonb
WHERE title_de = 'Phonetik und Aussprache' AND is_active = TRUE;
