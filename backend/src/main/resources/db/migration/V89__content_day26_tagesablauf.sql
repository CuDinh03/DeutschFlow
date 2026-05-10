-- V89: Day 26 — Tagesablauf & Trennbare Verben

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Tagesablauf & Trennbare Verben", "vi": "Thói quen hàng ngày & Động từ tách"},
  "overview": {"de": "Tagesroutine beschreiben und trennbare Verben (aufstehen, einkaufen, fernsehen) verwenden.", "vi": "Học cách mô tả thói quen hàng ngày bằng Trennbare Verben — loại động từ tách ra khi chia. Đây là điểm ngữ pháp đặc trưng của tiếng Đức mà nhiều người học hay sai!"},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Trennbare Verben — Động từ tách"},"content":{"vi":"Cấu trúc: Präfix + Verb (tiền tố + động từ)\nKhi chia: Präfix ra CUỐI câu, Verb ở vị trí 2:\n\naufstehen (dậy): Ich stehe um 7 Uhr AUF.\neinkaufen (mua sắm): Er kauft heute EIN.\nfernsehen (xem TV): Sie sieht abends FERN.\nanrufen (gọi điện): Ich rufe dich AN.\nabfahren (khởi hành): Der Zug fährt um 8 Uhr AB.\n\n⚠️ Infinitiv và Partizip: auf|stehen, auf|gestanden"},"tags":["#TrennbareVerben","#Grammatik"]},
    {"type":"RULE","title":{"vi":"Các Trennbare Verben thông dụng"},"content":{"vi":"auf|stehen — dậy (ngủ dậy)\nan|fangen — bắt đầu\nauf|räumen — dọn dẹp\nein|kaufen — mua sắm\nfern|sehen — xem TV\nan|rufen — gọi điện\nab|waschen — rửa (bát)\naus|gehen — ra ngoài\nzurück|kommen — trở về\nauf|machen — mở ra"},"tags":["#TrennbareVerben","#Vokabular"]},
    {"type":"EXAMPLE","title":{"vi":"Mô tả một ngày điển hình"},"content":{"vi":"Ich stehe um 6:30 Uhr auf.\nDann mache ich das Frühstück fertig.\nUm 8 Uhr fange ich mit der Arbeit an.\nIn der Mittagspause kaufe ich ein.\nNach der Arbeit rufe ich meine Eltern an.\nAbends sehe ich fern oder räume die Wohnung auf."},"tags":["#Tagesablauf","#TrennbareVerben"]}
  ],
  "vocabulary": [
    {"id":"v_tag_01","german":"aufstehen","meaning":"thức dậy","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich stehe jeden Morgen um 6 Uhr auf.","example_vi":"Mỗi sáng tôi thức dậy lúc 6 giờ.","speak_de":"Ich stehe auf.","tags":["#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaʊ̯fˌʃteːən/"],"common_errors_vi":["auf am Ende: auf-STEH-en"],"ipa_target":"ˈaʊ̯fˌʃteːən"}},
    {"id":"v_tag_02","german":"anfangen","meaning":"bắt đầu","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Arbeit fängt um 9 Uhr an.","example_vi":"Công việc bắt đầu lúc 9 giờ.","speak_de":"Es fängt an.","tags":["#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈanˌfaŋən/"],"common_errors_vi":["fängt: Umlaut ä, -an cuối câu"],"ipa_target":"ˈanˌfaŋən"}},
    {"id":"v_tag_03","german":"fernsehen","meaning":"xem TV","gender":null,"color_code":null,"gender_label":null,"example_de":"Abends sehe ich manchmal fern.","example_vi":"Buổi tối đôi khi tôi xem TV.","speak_de":"Ich sehe fern.","tags":["#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfɛʁnˌzeːən/"],"common_errors_vi":["sieht fern (er/sie): Umlaut! fern am Ende"],"ipa_target":"ˈfɛʁnˌzeːən"}},
    {"id":"v_tag_04","german":"aufräumen","meaning":"dọn dẹp","gender":null,"color_code":null,"gender_label":null,"example_de":"Am Wochenende räume ich die Wohnung auf.","example_vi":"Cuối tuần tôi dọn dẹp nhà cửa.","speak_de":"Ich räume auf.","tags":["#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaʊ̯fˌʁɔʏ̯mən/"],"common_errors_vi":["räume: ä=/ɛ/, eu=/ɔʏ/"],"ipa_target":"ˈaʊ̯fˌʁɔʏ̯mən"}},
    {"id":"v_tag_05","german":"anrufen","meaning":"gọi điện","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich rufe jeden Abend meine Mutter an.","example_vi":"Mỗi tối tôi gọi điện cho mẹ.","speak_de":"Ich rufe an.","tags":["#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈanˌʁuːfən/"],"common_errors_vi":["rufe... an: 2 vị trí khác nhau!"],"ipa_target":"ˈanˌʁuːfən"}},
    {"id":"v_tag_06","german":"zurückkommen","meaning":"trở về","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich komme um 18 Uhr zurück.","example_vi":"Tôi về nhà lúc 18 giờ.","speak_de":"Ich komme zurück.","tags":["#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/tsʊˈʁʏkˌkɔmən/"],"common_errors_vi":["zurück: z=/ts/, ü tròn môi"],"ipa_target":"tsʊˈʁʏkˌkɔmən"}},
    {"id":"v_tag_07","german":"meistens / manchmal / immer","meaning":"hầu như / đôi khi / luôn luôn","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich stehe meistens früh auf. Manchmal schlafe ich aus.","example_vi":"Tôi thường dậy sớm. Đôi khi tôi ngủ nướng.","speak_de":"meistens, manchmal, immer","tags":["#Adverb","#Häufigkeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈmaɪ̯stəns/"],"common_errors_vi":["meistens: ei=/ai/"],"ipa_target":"ˈmaɪ̯stəns"}}
  ],
  "phrases": [
    {"german":"Ich stehe um halb sieben auf.","meaning":"Tôi dậy lúc 6:30.","speak_de":"Ich stehe um halb sieben auf."},
    {"german":"Die Arbeit fängt um neun Uhr an.","meaning":"Công việc bắt đầu lúc 9 giờ.","speak_de":"Die Arbeit fängt um neun Uhr an."},
    {"german":"Abends rufe ich meine Familie an.","meaning":"Buổi tối tôi gọi điện cho gia đình.","speak_de":"Ich rufe meine Familie an."}
  ],
  "examples": [
    {"german":"Mein Tagesablauf: Ich stehe um 6 Uhr auf. Ich frühstücke und fahre um 7:30 zur Arbeit ab. Die Arbeit fängt um 8 Uhr an. Um 17 Uhr komme ich zurück. Abends sehe ich manchmal fern.","translation":"Lịch trình của tôi: Tôi dậy lúc 6 giờ. Tôi ăn sáng và 7:30 đi làm. Việc bắt đầu lúc 8 giờ. 17 giờ tôi về. Buổi tối đôi khi xem TV.","note":"Trennbare Verben: dậy-lên=auf|stehen, đi-khởi hành=ab|fahren","speak_de":"Ich stehe um sechs Uhr auf."},
    {"german":"— Was machst du abends? — Meistens räume ich die Küche auf und rufe meine Mutter an. Manchmal gehe ich mit Freunden aus.","translation":"— Buổi tối bạn làm gì? — Thường tôi dọn bếp và gọi điện cho mẹ. Đôi khi tôi ra ngoài với bạn bè.","note":"ausgehen (ra ngoài) cũng là Trennbar!","speak_de":"Ich räume die Küche auf."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg26_01","type":"FILL_BLANK","sentence_de":"Ich ___ um 7 Uhr ___. (aufstehen)","hint_vi":"Chia đúng: stehe ... auf","answer":"stehe, auf","accept_also":["stehe / auf"]},
      {"id":"tg26_02","type":"MULTIPLE_CHOICE","question_vi":"''Er sieht fern'' nghĩa là gì?","options":["Anh ấy nhìn xa","Anh ấy xem TV","Anh ấy ngủ","Anh ấy đọc sách"],"correct":1},
      {"id":"tg26_03","type":"FILL_BLANK","sentence_de":"Die Schule ___ um 8 Uhr ___. (anfangen)","hint_vi":"Chia đúng cho die Schule","answer":"fängt, an","accept_also":["fängt / an"]},
      {"id":"tg26_04","type":"MULTIPLE_CHOICE","question_vi":"Trennbar Verb đặt Präfix ở đâu trong câu chính?","options":["Đầu câu","Sau chủ ngữ","Cuối câu","Trước động từ"],"correct":2},
      {"id":"tg26_05","type":"FILL_BLANK","sentence_de":"Ich ___ jeden Abend meine Eltern ___. (anrufen)","hint_vi":"Chia đúng","answer":"rufe, an","accept_also":["rufe / an"]}
    ],
    "practice": [
      {"id":"p26_01","type":"TRANSLATE","from":"vi","sentence":"Tôi dậy lúc 6 giờ, ăn sáng và bắt đầu làm việc lúc 8 giờ.","answer":"Ich stehe um 6 Uhr auf, frühstücke und fange um 8 Uhr mit der Arbeit an.","accept_also":["Ich stehe um sechs auf, frühstücke und fange um acht an zu arbeiten."]},
      {"id":"p26_02","type":"REORDER","words":["auf.","um","Ich","Uhr","stehe","sieben"],"correct_order":["Ich","stehe","um","sieben","Uhr","auf."],"translation":"Tôi dậy lúc 7 giờ."},
      {"id":"p26_03","type":"FILL_BLANK","sentence_de":"Abends ___ ich meistens die Wohnung ___ und sehe manchmal ___.","hint_vi":"dọn dẹp (aufräumen) ... xem TV (fernsehen)","answer":"räume, auf, fern","accept_also":["räume / auf / fern"]}
    ]
  },
  "reading_passage": {
    "text_de": "Minh beschreibt seinen Tag\n\nIch stehe meistens um halb sechs auf. Ich dusche und frühstücke. Um Viertel vor acht fahre ich mit dem Bus zur Arbeit ab. Die Arbeit fängt um acht Uhr an und endet um 17 Uhr. In der Mittagspause kaufe ich manchmal ein. Nach der Arbeit komme ich um halb sechs zurück. Ich koche Abendessen und rufe meine Familie in Vietnam an. Das Gespräch dauert meistens eine Stunde. Dann sehe ich ein bisschen fern oder lese ein Buch. Um 22 Uhr schlafe ich ein.",
    "text_vi": "Minh mô tả ngày của anh\n\nTôi thường dậy lúc 5:30. Tôi tắm và ăn sáng. Lúc 7:45 tôi đi xe buýt đến chỗ làm. Công việc bắt đầu lúc 8 giờ và kết thúc lúc 17 giờ. Trong giờ nghỉ trưa đôi khi tôi đi mua sắm. Sau giờ làm tôi về nhà lúc 5:30 chiều. Tôi nấu bữa tối và gọi điện cho gia đình ở Việt Nam. Cuộc gọi thường kéo dài một tiếng. Rồi tôi xem TV một chút hoặc đọc sách. Lúc 22 giờ tôi đi ngủ.",
    "questions": [
      {"id":"rq26_01","type":"FILL_BLANK","question_vi":"Minh dậy lúc mấy giờ? (inoffiziell)","answer":"halb sechs","accept_also":["um halb sechs","5:30"]},
      {"id":"rq26_02","type":"MULTIPLE_CHOICE","question_vi":"Buổi tối Minh làm gì? (2 việc)","options":["Kochen und fernsehen","Anrufen und lesen/fernsehen","Einkaufen und kochen","Aufräumen und schlafen"],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie Ihren Tagesablauf mit mindestens 5 Trennbaren Verben.",
    "task_vi": "Mô tả lịch trình ngày của bạn, dùng ít nhất 5 Trennbare Verben.",
    "min_sentences": 6,
    "example_answer": "Ich stehe um sechs Uhr auf.\nIch mache das Frühstück fertig und esse.\nUm halb acht fahre ich zur Arbeit ab.\nDie Arbeit fängt um acht Uhr an.\nIn der Pause kaufe ich manchmal ein.\nAbends rufe ich meine Familie an und sehe fern."
  },
  "audio_content": {
    "listen_words": [
      {"text":"Ich stehe auf.","meaning":"Tôi dậy."},
      {"text":"Es fängt an.","meaning":"Nó bắt đầu."},
      {"text":"Ich rufe an.","meaning":"Tôi gọi điện."},
      {"text":"Ich sehe fern.","meaning":"Tôi xem TV."},
      {"text":"Ich komme zurück.","meaning":"Tôi trở về."}
    ],
    "listen_dialogue": "Wann stehst du auf? — Um halb sieben. Und wann fängt deine Arbeit an? — Um acht Uhr. Rufst du abends deine Familie an? — Ja, meistens nach dem Abendessen."
  }
}'::jsonb
WHERE day_number = 26 AND is_active = TRUE;
