-- Năm bài B1 mới (ngày 56–60), BẢN NHÁP chờ duyệt (01/11/2026). Đưa B1 lên 10 bài như V181 dự kiến.
--
-- Cùng quy ước với V353: không gán node_family nên bài chưa hiện cho học viên, không nối dependency.
-- Phát hành bằng phat_hanh_node_goc (V355) sau khi duyệt. node_code có sẵn vì getRoadmapMeta không
-- nhận mã NULL. Điểm vào B1 vẫn là ngày 51 nên RoadmapEntry không đổi.
-- Bản đọc và danh sách 10 bài đề xuất tiếp theo: docs/duyet-noi-dung/2026-11-01-a2-b1-nhap.md.

INSERT INTO skill_tree_nodes (
  node_type, node_code, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ─── Ngày 56: Gegensätze und Folgen: obwohl, trotzdem, deshalb ───
('CORE_TRUNK', 'B1-006',
 'Gegensätze und Folgen: obwohl, trotzdem, deshalb',
 'Liên từ nhượng bộ và hệ quả',
 'obwohl, trotzdem, deshalb và bảng trật tự từ của mọi loại liên từ.',
 '🔀', 'CORE_B1', 56, 14, 56, 'B1', 7, 300, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#Konnektoren','#obwohl','#B1'],
 '{
  "title":{"de":"Gegensätze und Folgen: obwohl, trotzdem, deshalb","vi":"Liên từ nhượng bộ và hệ quả"},
  "overview":{"de":"Obwohl es regnet, gehen wir spazieren. Es regnet. Trotzdem gehen wir spazieren.","vi":"Hai cách nói \"mặc dù\" và \"vì vậy\", kèm bảng trật tự từ của mọi loại liên từ."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"obwohl và trotzdem"},"content":{"vi":"Cùng ý \"mặc dù ... vẫn\", khác vị trí động từ:\n\nobwohl mở câu phụ, động từ đứng cuối:\nObwohl es regnet, gehen wir spazieren.\nWir gehen spazieren, obwohl es regnet.\n\ntrotzdem đứng ở vị trí 1 của câu chính, động từ theo ngay sau:\nEs regnet. Trotzdem gehen wir spazieren.\nEs regnet, aber wir gehen trotzdem spazieren."},"tags":["#obwohl","#trotzdem","#B1"]},
    {"type":"RULE","title":{"vi":"Hệ quả: deshalb, deswegen, darum, daher"},"content":{"vi":"Bốn từ cùng nghĩa \"vì vậy\", đứng vị trí 1, động từ vị trí 2:\nIch bin krank. Deshalb bleibe ich zu Hause.\nDer Zug fällt aus. Darum nehmen wir den Bus.\n\nSo sánh với weil (nguyên nhân, động từ cuối):\nIch bleibe zu Hause, weil ich krank bin.\n\nweil nêu lý do, deshalb nêu kết quả."},"tags":["#deshalb","#B1"]},
    {"type":"EXAMPLE","title":{"vi":"Bảng trật tự từ"},"content":{"vi":"Vị trí 0, trật tự bình thường:\nund, aber, oder, denn, sondern\nIch bleibe hier, denn ich bin krank.\n\nVị trí 1, động từ ngay sau:\ndeshalb, trotzdem, dann, außerdem\nDeshalb bleibe ich hier.\n\nMở câu phụ, động từ cuối:\nweil, da, obwohl, wenn, dass, während\nIch bleibe hier, weil ich krank bin.\n\nwährend còn dùng để đối lập:\nIch trinke Tee, während mein Mann Kaffee trinkt."},"tags":["#Satzbau","#Konnektoren"]}
  ],
  "vocabulary":[
    {"id":"v56_01","german":"obwohl","meaning":"mặc dù","gender":null,"color_code":null,"gender_label":null,"example_de":"Obwohl ich müde bin, lerne ich weiter.","example_vi":"Mặc dù mệt, tôi vẫn học tiếp.","speak_de":"Obwohl ich müde bin, lerne ich weiter.","tags":[]},
    {"id":"v56_02","german":"trotzdem","meaning":"dù vậy, vẫn","gender":null,"color_code":null,"gender_label":null,"example_de":"Es war teuer. Trotzdem habe ich es gekauft.","example_vi":"Nó đắt. Dù vậy tôi vẫn mua.","speak_de":"Es war teuer. Trotzdem habe ich es gekauft.","tags":[]},
    {"id":"v56_03","german":"deshalb","meaning":"vì vậy","gender":null,"color_code":null,"gender_label":null,"example_de":"Der Bus kam nicht, deshalb bin ich gelaufen.","example_vi":"Xe buýt không đến, vì vậy tôi đi bộ.","speak_de":"Der Bus kam nicht, deshalb bin ich gelaufen.","tags":[]},
    {"id":"v56_04","german":"außerdem","meaning":"ngoài ra","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Wohnung ist schön. Außerdem ist sie günstig.","example_vi":"Căn hộ đẹp. Ngoài ra nó còn rẻ.","speak_de":"Die Wohnung ist schön. Außerdem ist sie günstig.","tags":[]},
    {"id":"v56_05","german":"aufgeben","meaning":"bỏ cuộc","gender":null,"color_code":null,"gender_label":null,"example_de":"Er hat nie aufgegeben.","example_vi":"Anh ấy chưa bao giờ bỏ cuộc.","speak_de":"Er hat nie aufgegeben.","tags":[]},
    {"id":"v56_06","german":"die Schwierigkeit","meaning":"khó khăn","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Am Anfang hatte ich viele Schwierigkeiten.","example_vi":"Lúc đầu tôi gặp nhiều khó khăn.","speak_de":"Am Anfang hatte ich viele Schwierigkeiten.","tags":[]}
  ],
  "phrases":[
    {"german":"Obwohl ich wenig Zeit habe, lerne ich jeden Tag.","meaning":"Mặc dù ít thời gian, tôi vẫn học mỗi ngày.","speak_de":"Obwohl ich wenig Zeit habe, lerne ich jeden Tag."},
    {"german":"Trotzdem gebe ich nicht auf.","meaning":"Dù vậy tôi không bỏ cuộc.","speak_de":"Trotzdem gebe ich nicht auf."},
    {"german":"Deshalb brauche ich Ihre Hilfe.","meaning":"Vì vậy tôi cần sự giúp đỡ của bạn.","speak_de":"Deshalb brauche ich Ihre Hilfe."}
  ],
  "examples":[
    {"german":"— Warum bist du heute zu Fuß gekommen?\n— Mein Fahrrad ist kaputt. Deshalb musste ich laufen.\n— Obwohl es so kalt ist?\n— Ja. Es war kalt, aber trotzdem war der Weg schön.","translation":"— Sao hôm nay bạn đi bộ đến?\n— Xe đạp của mình hỏng. Vì vậy mình phải đi bộ.\n— Mặc dù lạnh thế này à?\n— Ừ. Trời lạnh, nhưng con đường vẫn đẹp.","note":"deshalb và trotzdem kéo động từ ngay sau","speak_de":"Deshalb musste ich laufen."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg56_01","type":"FILL_BLANK","sentence_de":"___ ich müde bin, gehe ich zur Arbeit.","hint_vi":"Mặc dù (câu phụ, động từ cuối)","answer":"Obwohl","accept_also":["Obwohl"]},
      {"id":"tg56_02","type":"FILL_BLANK","sentence_de":"Ich bin müde. ___ gehe ich zur Arbeit.","hint_vi":"Dù vậy, vị trí 1","answer":"Trotzdem","accept_also":["Trotzdem"]},
      {"id":"tg56_03","type":"FILL_BLANK","sentence_de":"Es schneit stark. ___ fährt der Bus nicht.","hint_vi":"Vì vậy, vị trí 1","answer":"Deshalb","accept_also":["Deswegen","Darum","Daher"]},
      {"id":"tg56_04","type":"MULTIPLE_CHOICE","question_vi":"Câu nào đúng?","options":["Obwohl er krank ist, er arbeitet.","Obwohl er krank ist, arbeitet er.","Obwohl ist er krank, arbeitet er.","Obwohl er ist krank, arbeitet er."],"correct":1},
      {"id":"tg56_05","type":"MULTIPLE_CHOICE","question_vi":"Từ nào đứng ở vị trí 0, không làm đổi trật tự câu?","options":["deshalb","trotzdem","obwohl","denn"],"correct":3}
    ],
    "practice":[
      {"id":"p56_01","type":"TRANSLATE","from":"vi","sentence":"Mặc dù có ít thời gian, cô ấy vẫn học tiếng Đức mỗi ngày.","answer":"Obwohl sie wenig Zeit hat, lernt sie jeden Tag Deutsch.","accept_also":[]},
      {"id":"p56_02","type":"REORDER","words":["kam","spät.","hatte","deshalb","Verspätung,","Der","Zug","zu","ich"],"correct_order":["Der","Zug","hatte","Verspätung,","deshalb","kam","ich","zu","spät."],"translation":"Tàu đến trễ, vì vậy tôi đến muộn."},
      {"id":"p56_03","type":"FILL_BLANK","sentence_de":"Er spricht gut Deutsch, ___ er erst seit zwei Jahren hier lebt.","hint_vi":"mặc dù","answer":"obwohl","accept_also":["obwohl"]}
    ]
  },
  "reading_passage":{
    "text_de":"Ein schwieriger Anfang\n\nVor zwei Jahren ist Long nach Deutschland gekommen, obwohl er damals kaum Deutsch konnte. Am Anfang war alles schwierig: Die Behörden schrieben lange Briefe, und die Kollegen sprachen schnell. Trotzdem gab er nicht auf. Er besuchte abends einen Sprachkurs, während seine Freunde Fußball spielten. Deshalb hat er heute keine Probleme mehr bei der Arbeit. Seit letztem Monat leitet er sogar ein kleines Team.",
    "text_vi":"Một khởi đầu khó khăn\n\nHai năm trước Long đến Đức, dù lúc đó anh gần như không biết tiếng Đức. Ban đầu mọi thứ đều khó: cơ quan gửi những lá thư dài, đồng nghiệp nói nhanh. Dù vậy anh không bỏ cuộc. Buổi tối anh đi học một khoá tiếng, trong khi bạn bè chơi bóng đá. Vì vậy hôm nay anh không còn gặp khó khăn trong công việc. Từ tháng trước anh còn phụ trách một nhóm nhỏ.",
    "questions":[
      {"id":"rq56_01","type":"FILL_BLANK","question_vi":"Buổi tối Long học gì?","answer":"einen Sprachkurs","accept_also":["Sprachkurs","Deutsch","einen Deutschkurs"]},
      {"id":"rq56_02","type":"MULTIPLE_CHOICE","question_vi":"Hiện nay Long làm gì?","options":["Er leitet ein kleines Team.","Er spielt Fußball.","Er sucht Arbeit.","Er besucht nur noch Kurse."],"correct":0}
    ]
  },
  "writing_prompt":{"task_de":"Beschreiben Sie eine Schwierigkeit in Ihrem Leben. Benutzen Sie obwohl, trotzdem und deshalb.","task_vi":"Hãy kể về một khó khăn trong cuộc sống của bạn. Dùng obwohl, trotzdem và deshalb.","min_sentences":5,"example_answer":"Letztes Jahr wollte ich eine neue Arbeit finden.\nObwohl ich viele Bewerbungen geschrieben habe, bekam ich lange keine Antwort.\nDas war schwierig, aber ich habe trotzdem weitergemacht.\nIch habe meinen Lebenslauf verbessert.\nDeshalb habe ich jetzt eine gute Stelle."},
  "audio_content":{
    "listen_words":[
      {"text":"Obwohl es regnet, gehen wir spazieren.","meaning":"Mặc dù trời mưa, chúng tôi vẫn đi dạo."},
      {"text":"Trotzdem gebe ich nicht auf.","meaning":"Dù vậy tôi không bỏ cuộc."},
      {"text":"Der Zug fällt aus, deshalb nehmen wir den Bus.","meaning":"Chuyến tàu bị huỷ, vì vậy chúng tôi đi xe buýt."}
    ],
    "listen_dialogue":"Warum bist du so müde? — Ich habe die ganze Nacht gearbeitet. — Und trotzdem bist du heute zum Kurs gekommen? — Ja, obwohl ich kaum geschlafen habe. Die Prüfung ist bald, deshalb will ich nichts verpassen."
  }
}'::jsonb),

-- ─── Ngày 57: Relativsätze im Akkusativ und Dativ ───
('CORE_TRUNK', 'B1-007',
 'Relativsätze im Akkusativ und Dativ',
 'Mệnh đề quan hệ: Akkusativ, Dativ, có giới từ',
 'Đại từ quan hệ ở Akkusativ, Dativ và sau giới từ, cùng was và wo.',
 '🔗', 'CORE_B1', 57, 14, 57, 'B1', 7, 310, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#Relativsatz','#Dativ','#B1'],
 '{
  "title":{"de":"Relativsätze im Akkusativ und Dativ","vi":"Mệnh đề quan hệ: Akkusativ, Dativ, có giới từ"},
  "overview":{"de":"Das ist der Film, den ich gesehen habe. Das ist die Firma, bei der ich arbeite.","vi":"Chọn đúng đại từ quan hệ theo vai trò trong câu phụ, kể cả khi có giới từ đi trước."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Giống lấy từ danh từ, cách lấy từ câu phụ"},"content":{"vi":"Giống và số: theo danh từ đứng trước.\nCách: theo vai trò của đại từ TRONG câu phụ.\n\nAkkusativ:\nDas ist der Mann, den ich kenne. (ich kenne ihn)\n\nDativ:\nDas ist die Frau, der ich helfe. (ich helfe ihr)\n\nBảng (Nom / Akk / Dat):\nder: der / den / dem\ndie: die / die / der\ndas: das / das / dem\nsố nhiều: die / die / denen"},"tags":["#Relativsatz","#B1"]},
    {"type":"RULE","title":{"vi":"Có giới từ"},"content":{"vi":"Giới từ đứng trước đại từ, và quyết định cách:\nDas ist die Kollegin, mit der ich arbeite.\nDas ist die Stadt, in der ich wohne.\nDer Film, über den wir gesprochen haben, war gut.\nDie Kinder, mit denen ich spiele, sind nett.\n\nĐộng từ vẫn đứng cuối câu phụ."},"tags":["#Relativsatz","#Praepositionen"]},
    {"type":"EXAMPLE","title":{"vi":"was và wo"},"content":{"vi":"Sau alles, etwas, nichts, das Beste dùng was:\nAlles, was du sagst, stimmt.\nDas ist das Beste, was mir passiert ist.\n\nChỉ nơi chốn có thể dùng wo:\nDie Stadt, wo ich wohne, ist klein. (= in der ich wohne)"},"tags":["#Relativsatz","#was"]}
  ],
  "vocabulary":[
    {"id":"v57_01","german":"das Viertel","meaning":"khu phố","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Ich wohne in einem ruhigen Viertel.","example_vi":"Tôi sống ở một khu phố yên tĩnh.","speak_de":"Ich wohne in einem ruhigen Viertel.","tags":[]},
    {"id":"v57_02","german":"empfehlen","meaning":"giới thiệu, khuyên dùng","gender":null,"color_code":null,"gender_label":null,"example_de":"Das ist das Buch, das meine Lehrerin empfohlen hat.","example_vi":"Đây là cuốn sách cô giáo tôi đã giới thiệu.","speak_de":"Das ist das Buch, das meine Lehrerin empfohlen hat.","tags":[]},
    {"id":"v57_03","german":"sich treffen","meaning":"gặp nhau","gender":null,"color_code":null,"gender_label":null,"example_de":"Das ist das Café, in dem wir uns treffen.","example_vi":"Đây là quán cà phê nơi chúng tôi gặp nhau.","speak_de":"Das ist das Café, in dem wir uns treffen.","tags":[]},
    {"id":"v57_04","german":"passieren","meaning":"xảy ra","gender":null,"color_code":null,"gender_label":null,"example_de":"Das ist das Beste, was mir passiert ist.","example_vi":"Đó là điều tốt nhất đã xảy ra với tôi.","speak_de":"Das ist das Beste, was mir passiert ist.","tags":[]},
    {"id":"v57_05","german":"der Bäcker","meaning":"người làm bánh mì","gender":"DER","color_code":null,"gender_label":"der","example_de":"Der Bäcker, bei dem ich kaufe, ist sehr nett.","example_vi":"Người bán bánh mì chỗ tôi mua rất thân thiện.","speak_de":"Der Bäcker, bei dem ich kaufe, ist sehr nett.","tags":[]}
  ],
  "phrases":[
    {"german":"Das ist die Firma, bei der ich arbeite.","meaning":"Đây là công ty nơi tôi làm việc.","speak_de":"Das ist die Firma, bei der ich arbeite."},
    {"german":"Alles, was ich brauche, ist hier.","meaning":"Mọi thứ tôi cần đều ở đây.","speak_de":"Alles, was ich brauche, ist hier."},
    {"german":"Die Leute, die ich getroffen habe, waren nett.","meaning":"Những người tôi đã gặp rất thân thiện.","speak_de":"Die Leute, die ich getroffen habe, waren nett."}
  ],
  "examples":[
    {"german":"— Ist das der Kollege, von dem du erzählt hast?\n— Ja, das ist der Kollege, dem ich beim Umzug geholfen habe.\n— Und die Frau neben ihm?\n— Das ist seine Schwester, mit der er zusammen wohnt.","translation":"— Đó có phải người đồng nghiệp bạn đã kể không?\n— Phải, đó là đồng nghiệp mình đã giúp chuyển nhà.\n— Còn người phụ nữ bên cạnh?\n— Đó là chị gái anh ấy, người sống cùng anh ấy.","note":"von dem (erzählen von + Dativ), dem (helfen + Dativ), mit der (mit + Dativ)","speak_de":"Das ist der Kollege, dem ich geholfen habe."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg57_01","type":"FILL_BLANK","sentence_de":"Das ist der Film, ___ ich gestern gesehen habe.","hint_vi":"der Film, sehen + Akkusativ","answer":"den","accept_also":["den"]},
      {"id":"tg57_02","type":"FILL_BLANK","sentence_de":"Die Frau, ___ ich geholfen habe, ist meine Nachbarin.","hint_vi":"die Frau, helfen + Dativ","answer":"der","accept_also":["der"]},
      {"id":"tg57_03","type":"FILL_BLANK","sentence_de":"Das ist die Firma, bei ___ ich arbeite.","hint_vi":"die Firma, bei + Dativ","answer":"der","accept_also":["der"]},
      {"id":"tg57_04","type":"MULTIPLE_CHOICE","question_vi":"Đại từ quan hệ Dativ số nhiều là gì?","options":["den","dem","denen","deren"],"correct":2},
      {"id":"tg57_05","type":"MULTIPLE_CHOICE","question_vi":"Die Kinder, mit ___ ich spiele, sind nett.","options":["die","denen","den","dem"],"correct":1}
    ],
    "practice":[
      {"id":"p57_01","type":"TRANSLATE","from":"vi","sentence":"Đây là người bạn mà tôi đã gặp ở Berlin.","answer":"Das ist der Freund, den ich in Berlin getroffen habe.","accept_also":[]},
      {"id":"p57_02","type":"REORDER","words":["geboren","die","wurde.","Das","ich","der","ist","Stadt,","in"],"correct_order":["Das","ist","die","Stadt,","in","der","ich","geboren","wurde."],"translation":"Đây là thành phố nơi tôi sinh ra."},
      {"id":"p57_03","type":"FILL_BLANK","sentence_de":"Alles, ___ du sagst, stimmt.","hint_vi":"Sau alles","answer":"was","accept_also":["was"]}
    ]
  },
  "reading_passage":{
    "text_de":"Mein Viertel\n\nIch wohne in einem Viertel, in dem Menschen aus vielen Ländern leben. Der Bäcker, bei dem ich jeden Morgen Brot kaufe, kommt aus der Türkei. Die Nachbarin, der ich manchmal beim Einkaufen helfe, hat lange in Polen gelebt. Am besten gefällt mir das kleine Café, in dem sich unsere Deutschgruppe trifft. Die Leute, die ich dort kennengelernt habe, sind meine Freunde geworden. Das ist das Schönste, was mir hier passiert ist.",
    "text_vi":"Khu phố của tôi\n\nTôi sống ở một khu phố có người từ nhiều nước. Người bán bánh mì chỗ tôi mua mỗi sáng đến từ Thổ Nhĩ Kỳ. Bà hàng xóm mà thỉnh thoảng tôi giúp đi mua đồ đã sống lâu ở Ba Lan. Tôi thích nhất quán cà phê nhỏ nơi nhóm học tiếng Đức của chúng tôi gặp nhau. Những người tôi quen ở đó đã trở thành bạn của tôi. Đó là điều đẹp nhất đã xảy ra với tôi ở đây.",
    "questions":[
      {"id":"rq57_01","type":"FILL_BLANK","question_vi":"Nhóm học tiếng Đức gặp nhau ở đâu?","answer":"im Café","accept_also":["in dem Café","im kleinen Café","Café","in dem kleinen Café"]},
      {"id":"rq57_02","type":"MULTIPLE_CHOICE","question_vi":"Người bán bánh mì đến từ đâu?","options":["aus Polen","aus der Türkei","aus Vietnam","aus Italien"],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Beschreiben Sie Ihr Viertel oder Ihre Stadt. Benutzen Sie mindestens drei Relativsätze.","task_vi":"Hãy miêu tả khu phố hoặc thành phố của bạn. Dùng ít nhất ba mệnh đề quan hệ.","min_sentences":5,"example_answer":"Ich wohne in einer Stadt, die am Meer liegt.\nDie Straße, in der ich wohne, ist sehr ruhig.\nDer Supermarkt, den ich am liebsten mag, ist gleich um die Ecke.\nMeine Nachbarn, mit denen ich oft spreche, sind sehr freundlich.\nHier habe ich alles, was ich brauche."},
  "audio_content":{
    "listen_words":[
      {"text":"Das ist der Mann, den ich gestern getroffen habe.","meaning":"Đây là người đàn ông tôi đã gặp hôm qua."},
      {"text":"Das ist die Frau, der ich geholfen habe.","meaning":"Đây là người phụ nữ tôi đã giúp."},
      {"text":"Die Stadt, in der ich wohne, ist klein.","meaning":"Thành phố tôi sống rất nhỏ."}
    ],
    "listen_dialogue":"Kennst du den Film, über den alle sprechen? — Meinst du den Film, den Lisa empfohlen hat? — Genau. Die Schauspielerin, die mitspielt, kommt aus unserer Stadt. — Das ist das Beste, was ich heute gehört habe. Gehen wir hin!"
  }
}'::jsonb),

-- ─── Ngày 58: Passiv: Vergangenheit und mit Modalverben ───
('CORE_TRUNK', 'B1-008',
 'Passiv: Vergangenheit und mit Modalverben',
 'Thể bị động: quá khứ và với động từ khuyết thiếu',
 'Passiv Präteritum, Perfekt, Passiv với Modalverben; von và durch.',
 '🏗️', 'CORE_B1', 58, 15, 58, 'B1', 7, 310, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#Passiv','#Modalverben','#B1'],
 '{
  "title":{"de":"Passiv: Vergangenheit und mit Modalverben","vi":"Thể bị động: quá khứ và với động từ khuyết thiếu"},
  "overview":{"de":"Das Haus wurde 1950 gebaut. Das Auto muss repariert werden.","vi":"Bị động ở Präteritum, Perfekt và với động từ khuyết thiếu; phân biệt von và durch."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Bị động ở quá khứ"},"content":{"vi":"Präsens: Das Haus wird gebaut.\n\nPräteritum: wurde + Partizip II\nDas Haus wurde 1950 gebaut.\n\nPerfekt: ist + Partizip II + worden\nDas Haus ist 1950 gebaut worden.\n\nLưu ý: dùng worden, KHÔNG dùng geworden."},"tags":["#Passiv","#B1"]},
    {"type":"RULE","title":{"vi":"Với động từ khuyết thiếu"},"content":{"vi":"Động từ khuyết thiếu + Partizip II + werden:\nDas Auto muss repariert werden.\nDas Problem kann gelöst werden.\nDie Rechnung soll bezahlt werden.\n\nQuá khứ, đổi động từ khuyết thiếu:\nDas Auto musste repariert werden.\nDas Problem konnte nicht gelöst werden."},"tags":["#Passiv","#Modalverben"]},
    {"type":"EXAMPLE","title":{"vi":"von, durch và khi nào dùng bị động"},"content":{"vi":"von + Dativ: người hoặc tác nhân thực hiện\nDie Brücke wurde von einer Firma aus Köln gebaut.\n\ndurch + Akkusativ: nguyên nhân, phương tiện\nDas Dach wurde durch einen Sturm zerstört.\n\nDùng bị động khi việc xảy ra quan trọng hơn người làm. Hay gặp trong tin tức, thông báo, hướng dẫn."},"tags":["#Passiv","#von"]}
  ],
  "vocabulary":[
    {"id":"v58_01","german":"bauen","meaning":"xây","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Schule wurde 1990 gebaut.","example_vi":"Trường được xây năm 1990.","speak_de":"Die Schule wurde 1990 gebaut.","tags":[]},
    {"id":"v58_02","german":"zerstören","meaning":"phá huỷ","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Dach wurde durch einen Sturm zerstört.","example_vi":"Mái nhà bị bão phá huỷ.","speak_de":"Das Dach wurde durch einen Sturm zerstört.","tags":[]},
    {"id":"v58_03","german":"beschädigen","meaning":"làm hư hại","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Gebäude wurde stark beschädigt.","example_vi":"Toà nhà bị hư hại nặng.","speak_de":"Das Gebäude wurde stark beschädigt.","tags":[]},
    {"id":"v58_04","german":"lösen","meaning":"giải quyết","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Problem muss schnell gelöst werden.","example_vi":"Vấn đề phải được giải quyết nhanh.","speak_de":"Das Problem muss schnell gelöst werden.","tags":[]},
    {"id":"v58_05","german":"das Gebäude","meaning":"toà nhà","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Das Gebäude wird renoviert.","example_vi":"Toà nhà đang được sửa sang.","speak_de":"Das Gebäude wird renoviert.","tags":[]},
    {"id":"v58_06","german":"der Sturm","meaning":"cơn bão","gender":"DER","color_code":null,"gender_label":"der","example_de":"Der Sturm hat großen Schaden verursacht.","example_vi":"Cơn bão gây thiệt hại lớn.","speak_de":"Der Sturm hat großen Schaden verursacht.","tags":[]}
  ],
  "phrases":[
    {"german":"Das muss noch gemacht werden.","meaning":"Việc này còn phải làm.","speak_de":"Das muss noch gemacht werden."},
    {"german":"Wann wurde das gebaut?","meaning":"Cái này được xây khi nào?","speak_de":"Wann wurde das gebaut?"},
    {"german":"Die Rechnung ist schon bezahlt worden.","meaning":"Hoá đơn đã được thanh toán.","speak_de":"Die Rechnung ist schon bezahlt worden."}
  ],
  "examples":[
    {"german":"— Wurde die Heizung schon repariert?\n— Nein, sie konnte noch nicht repariert werden.\n— Warum nicht?\n— Das Ersatzteil ist noch nicht geliefert worden.\n— Dann muss der Termin verschoben werden.","translation":"— Lò sưởi đã được sửa chưa?\n— Chưa, vẫn chưa sửa được.\n— Sao vậy?\n— Linh kiện thay thế vẫn chưa được giao.\n— Vậy thì phải dời lịch hẹn.","note":"wurde (Präteritum), geliefert worden (Perfekt), verschoben werden (với muss)","speak_de":"Der Termin muss verschoben werden."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg58_01","type":"FILL_BLANK","sentence_de":"Das Haus ___ 1950 gebaut.","hint_vi":"Passiv Präteritum, ngôi es","answer":"wurde","accept_also":["wurde"]},
      {"id":"tg58_02","type":"FILL_BLANK","sentence_de":"Der Brief ist gestern geschrieben ___.","hint_vi":"Passiv Perfekt","answer":"worden","accept_also":["worden"]},
      {"id":"tg58_03","type":"FILL_BLANK","sentence_de":"Das Auto muss repariert ___.","hint_vi":"Với động từ khuyết thiếu","answer":"werden","accept_also":["werden"]},
      {"id":"tg58_04","type":"MULTIPLE_CHOICE","question_vi":"Câu Perfekt Passiv nào đúng?","options":["Das Essen ist gekocht geworden.","Das Essen hat gekocht worden.","Das Essen wurde gekocht worden.","Das Essen ist gekocht worden."],"correct":3},
      {"id":"tg58_05","type":"MULTIPLE_CHOICE","question_vi":"Người thực hiện hành động đi với giới từ nào?","options":["von","mit","bei","aus"],"correct":0}
    ],
    "practice":[
      {"id":"p58_01","type":"TRANSLATE","from":"vi","sentence":"Cây cầu được xây năm 2010.","answer":"Die Brücke wurde 2010 gebaut.","accept_also":["Die Brücke ist 2010 gebaut worden."]},
      {"id":"p58_02","type":"REORDER","words":["Die","Rechnung","Freitag","muss","werden.","bezahlt","bis"],"correct_order":["Die","Rechnung","muss","bis","Freitag","bezahlt","werden."],"translation":"Hoá đơn phải được thanh toán trước thứ Sáu."},
      {"id":"p58_03","type":"FILL_BLANK","sentence_de":"Die Stadt ___ im Krieg stark zerstört.","hint_vi":"Passiv Präteritum, ngôi sie (số ít)","answer":"wurde","accept_also":["wurde"]}
    ]
  },
  "reading_passage":{
    "text_de":"Das alte Rathaus\n\nDas alte Rathaus von Neustadt wurde im Jahr 1720 gebaut. Im Zweiten Weltkrieg wurde es stark beschädigt. Erst 1955 konnte es wieder aufgebaut werden. Vor zehn Jahren ist das Dach durch einen Sturm zerstört worden. Deshalb musste das Gebäude lange geschlossen werden. Heute wird hier nicht mehr gearbeitet: Das Rathaus ist ein Museum. Es wird jedes Jahr von vielen Touristen besucht.",
    "text_vi":"Toà thị chính cũ\n\nToà thị chính cũ của Neustadt được xây năm 1720. Trong Thế chiến thứ hai, nó bị hư hại nặng. Mãi đến năm 1955 nó mới được xây lại. Mười năm trước mái nhà bị một cơn bão phá huỷ. Vì vậy toà nhà phải đóng cửa một thời gian dài. Ngày nay không còn ai làm việc ở đây: toà thị chính là một bảo tàng. Mỗi năm có nhiều du khách đến thăm.",
    "questions":[
      {"id":"rq58_01","type":"FILL_BLANK","question_vi":"Toà thị chính được xây năm nào?","answer":"1720","accept_also":["im Jahr 1720"]},
      {"id":"rq58_02","type":"MULTIPLE_CHOICE","question_vi":"Ngày nay toà nhà là gì?","options":["ein Hotel","eine Schule","ein Büro","ein Museum"],"correct":3}
    ]
  },
  "writing_prompt":{"task_de":"Stellen Sie ein bekanntes Gebäude in Ihrer Stadt vor. Benutzen Sie das Passiv in der Vergangenheit.","task_vi":"Hãy giới thiệu một công trình nổi tiếng ở thành phố của bạn. Dùng thể bị động ở quá khứ.","min_sentences":5,"example_answer":"Der Kölner Dom steht mitten in Köln.\nDer Bau wurde 1248 begonnen.\nErst 1880 wurde der Dom fertiggestellt.\nIm Zweiten Weltkrieg wurde er beschädigt.\nHeute wird er jedes Jahr von Millionen Touristen besucht."},
  "audio_content":{
    "listen_words":[
      {"text":"Das Haus wurde 1950 gebaut.","meaning":"Ngôi nhà được xây năm 1950."},
      {"text":"Das Auto muss repariert werden.","meaning":"Chiếc xe phải được sửa."},
      {"text":"Das Dach ist durch einen Sturm zerstört worden.","meaning":"Mái nhà đã bị một cơn bão phá huỷ."}
    ],
    "listen_dialogue":"Wurde der Vertrag schon unterschrieben? — Ja, er ist gestern unterschrieben worden. — Und die Rechnung? — Die muss noch bezahlt werden. — Bis wann? — Bis Freitag. Das kann heute erledigt werden."
  }
}'::jsonb),

-- ─── Ngày 59: Infinitiv mit zu, um ... zu, damit ───
('CORE_TRUNK', 'B1-009',
 'Infinitiv mit zu, um ... zu, damit',
 'Động từ nguyên thể với zu; um ... zu và damit',
 'Khi nào dùng zu, nói mục đích bằng um ... zu và damit, cùng ohne ... zu, statt ... zu.',
 '🎯', 'CORE_B1', 59, 15, 59, 'B1', 7, 300, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#InfinitivMitZu','#umzu','#B1'],
 '{
  "title":{"de":"Infinitiv mit zu, um ... zu, damit","vi":"Động từ nguyên thể với zu; um ... zu và damit"},
  "overview":{"de":"Ich versuche, jeden Tag zu lernen. Ich lerne, um in Wien zu arbeiten.","vi":"Khi nào cần zu, và cách nói mục đích bằng um ... zu hoặc damit."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Infinitiv mit zu"},"content":{"vi":"Sau nhiều động từ và cụm từ, động từ nguyên thể đi với zu:\nversuchen, vergessen, anfangen, aufhören, hoffen, planen\nEs ist wichtig, ... / Ich habe Lust, ... / Ich habe Zeit, ...\n\nIch versuche, jeden Tag zu lernen.\nEs ist wichtig, pünktlich zu sein.\n\nĐộng từ tách được: zu chen giữa\nIch habe vergessen, dich anzurufen.\n\nSau động từ khuyết thiếu KHÔNG có zu:\nIch muss arbeiten."},"tags":["#InfinitivMitZu","#B1"]},
    {"type":"RULE","title":{"vi":"Mục đích: um ... zu và damit"},"content":{"vi":"Cùng một chủ ngữ, dùng um ... zu:\nIch lerne Deutsch, um in Wien zu arbeiten.\n(ich lerne, ich arbeite)\n\nKhác chủ ngữ, dùng damit:\nIch spreche langsam, damit du mich verstehst.\n(ich spreche, du verstehst)\n\nCùng chủ ngữ cũng dùng được damit, nhưng um ... zu tự nhiên hơn."},"tags":["#umzu","#damit"]},
    {"type":"EXAMPLE","title":{"vi":"ohne ... zu và statt ... zu"},"content":{"vi":"ohne ... zu = mà không:\nEr ging nach Hause, ohne etwas zu sagen.\n\nstatt ... zu = thay vì:\nStatt zu lernen, spielt er am Handy.\n\nCả hai cũng dùng được với động từ tách:\nSie ging weg, ohne die Tür zuzumachen."},"tags":["#ohne","#statt"]}
  ],
  "vocabulary":[
    {"id":"v59_01","german":"versuchen","meaning":"cố gắng","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich versuche, mehr Deutsch zu sprechen.","example_vi":"Tôi cố gắng nói tiếng Đức nhiều hơn.","speak_de":"Ich versuche, mehr Deutsch zu sprechen.","tags":[]},
    {"id":"v59_02","german":"vergessen","meaning":"quên","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich habe vergessen, die Tür abzuschließen.","example_vi":"Tôi đã quên khoá cửa.","speak_de":"Ich habe vergessen, die Tür abzuschließen.","tags":[]},
    {"id":"v59_03","german":"hoffen","meaning":"hy vọng","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich hoffe, die Prüfung zu bestehen.","example_vi":"Tôi hy vọng đỗ kỳ thi.","speak_de":"Ich hoffe, die Prüfung zu bestehen.","tags":[]},
    {"id":"v59_04","german":"sich vornehmen","meaning":"dự định, đặt mục tiêu","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich nehme mir vor, früher aufzustehen.","example_vi":"Tôi đặt mục tiêu dậy sớm hơn.","speak_de":"Ich nehme mir vor, früher aufzustehen.","tags":[]},
    {"id":"v59_05","german":"Lust haben","meaning":"có hứng","gender":null,"color_code":null,"gender_label":null,"example_de":"Hast du Lust, ins Kino zu gehen?","example_vi":"Bạn có muốn đi xem phim không?","speak_de":"Hast du Lust, ins Kino zu gehen?","tags":[]}
  ],
  "phrases":[
    {"german":"Hast du Lust, heute Abend zu kochen?","meaning":"Tối nay bạn có muốn nấu ăn không?","speak_de":"Hast du Lust, heute Abend zu kochen?"},
    {"german":"Es ist wichtig, pünktlich zu sein.","meaning":"Đúng giờ là điều quan trọng.","speak_de":"Es ist wichtig, pünktlich zu sein."},
    {"german":"Ich rufe an, um einen Termin zu vereinbaren.","meaning":"Tôi gọi để đặt lịch hẹn.","speak_de":"Ich rufe an, um einen Termin zu vereinbaren."}
  ],
  "examples":[
    {"german":"— Warum lernst du so viel?\n— Um die B1-Prüfung zu bestehen.\n— Und warum bist du heute hier?\n— Meine Lehrerin hilft mir, damit ich besser schreibe.\n— Hast du Lust, nachher einen Kaffee zu trinken?\n— Gern!","translation":"— Sao bạn học nhiều thế?\n— Để đỗ kỳ thi B1.\n— Còn hôm nay sao bạn ở đây?\n— Cô giáo giúp mình để mình viết tốt hơn.\n— Lát nữa bạn có muốn uống cà phê không?\n— Rất sẵn lòng!","note":"um ... zu: cùng chủ ngữ; damit: khác chủ ngữ","speak_de":"Ich lerne, um die Prüfung zu bestehen."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg59_01","type":"FILL_BLANK","sentence_de":"Ich habe vergessen, dich ___. (anrufen)","hint_vi":"Động từ tách: zu chen giữa","answer":"anzurufen","accept_also":["anzurufen"]},
      {"id":"tg59_02","type":"FILL_BLANK","sentence_de":"Ich lerne Deutsch, ___ in Wien zu studieren.","hint_vi":"Mục đích, cùng chủ ngữ","answer":"um","accept_also":["um"]},
      {"id":"tg59_03","type":"FILL_BLANK","sentence_de":"Ich spreche langsam, ___ du mich verstehst.","hint_vi":"Mục đích, khác chủ ngữ","answer":"damit","accept_also":["damit"]},
      {"id":"tg59_04","type":"MULTIPLE_CHOICE","question_vi":"Câu nào đúng?","options":["Ich muss zu arbeiten.","Ich muss um arbeiten.","Ich muss arbeiten.","Ich muss arbeiten zu."],"correct":2},
      {"id":"tg59_05","type":"MULTIPLE_CHOICE","question_vi":"Er geht zum Arzt, ___ gesund zu werden.","options":["um","damit","weil","dass"],"correct":0}
    ],
    "practice":[
      {"id":"p59_01","type":"TRANSLATE","from":"vi","sentence":"Tôi hy vọng sớm tìm được việc làm.","answer":"Ich hoffe, bald eine Arbeit zu finden.","accept_also":[]},
      {"id":"p59_02","type":"REORDER","words":["ging","nach","sagen.","ohne","zu","Er","etwas","Hause,"],"correct_order":["Er","ging","nach","Hause,","ohne","etwas","zu","sagen."],"translation":"Anh ấy về nhà mà không nói gì."},
      {"id":"p59_03","type":"FILL_BLANK","sentence_de":"Statt ___ lernen, spielt er am Handy.","hint_vi":"thay vì học","answer":"zu","accept_also":["zu"]}
    ]
  },
  "reading_passage":{
    "text_de":"Mais gute Vorsätze\n\nJedes Jahr nimmt sich Mai vor, gesünder zu leben. In diesem Jahr hat sie angefangen, früher aufzustehen, um vor der Arbeit joggen zu gehen. Sie versucht auch, weniger Zucker zu essen. Ihre Schwester kocht oft für sie, damit sie mehr Gemüse isst. Manchmal hat Mai keine Lust, bei Regen rauszugehen. Statt zu laufen, macht sie dann Yoga zu Hause. Sie hofft, dieses Mal nicht aufzugeben.",
    "text_vi":"Những dự định tốt của Mai\n\nMỗi năm Mai đều đặt mục tiêu sống lành mạnh hơn. Năm nay cô bắt đầu dậy sớm hơn để chạy bộ trước giờ làm. Cô cũng cố ăn ít đường hơn. Chị gái cô hay nấu ăn cho cô để cô ăn nhiều rau hơn. Đôi khi Mai không muốn ra ngoài lúc trời mưa. Thay vì chạy, lúc đó cô tập yoga ở nhà. Cô hy vọng lần này không bỏ cuộc.",
    "questions":[
      {"id":"rq59_01","type":"FILL_BLANK","question_vi":"Mai dậy sớm để làm gì?","answer":"um joggen zu gehen","accept_also":["joggen","zum Joggen","joggen gehen"]},
      {"id":"rq59_02","type":"MULTIPLE_CHOICE","question_vi":"Khi trời mưa Mai làm gì?","options":["Sie schläft weiter.","Sie geht schwimmen.","Sie macht Yoga zu Hause.","Sie kocht für ihre Schwester."],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Welche Pläne haben Sie für dieses Jahr? Benutzen Sie um ... zu, damit und Infinitiv mit zu.","task_vi":"Năm nay bạn có những kế hoạch gì? Dùng um ... zu, damit và Infinitiv mit zu.","min_sentences":5,"example_answer":"In diesem Jahr möchte ich viel erreichen.\nIch habe angefangen, jeden Tag Deutsch zu lernen.\nIch mache einen Kurs, um die B1-Prüfung zu bestehen.\nMein Mann hilft mir, damit ich mehr Zeit zum Lernen habe.\nIch hoffe, im Sommer eine neue Stelle zu finden."},
  "audio_content":{
    "listen_words":[
      {"text":"Ich versuche, jeden Tag zu lernen.","meaning":"Tôi cố gắng học mỗi ngày."},
      {"text":"Ich lerne Deutsch, um in Wien zu arbeiten.","meaning":"Tôi học tiếng Đức để làm việc ở Wien."},
      {"text":"Ich spreche langsam, damit du mich verstehst.","meaning":"Tôi nói chậm để bạn hiểu."}
    ],
    "listen_dialogue":"Hast du heute Zeit, mir zu helfen? — Wobei denn? — Ich versuche, ein Formular auszufüllen. — Klar. Warum brauchst du es? — Um mich für den Kurs anzumelden. — Gut, ich komme um drei, damit wir genug Zeit haben."
  }
}'::jsonb),

-- ─── Ngày 60: Verben mit Präpositionen ───
('CORE_TRUNK', 'B1-010',
 'Verben mit Präpositionen',
 'Động từ đi với giới từ',
 'Động từ đi với giới từ cố định, hỏi với wo(r)-, trả lời với da(r)-.',
 '🧩', 'CORE_B1', 60, 15, 60, 'B1', 7, 310, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#Verben','#Praepositionen','#B1'],
 '{
  "title":{"de":"Verben mit Präpositionen","vi":"Động từ đi với giới từ"},
  "overview":{"de":"Ich warte auf den Bus. Worauf wartest du? Ich warte darauf.","vi":"Học động từ cùng giới từ cố định, cách hỏi với wo(r)- và trả lời với da(r)-."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Giới từ đi cùng động từ"},"content":{"vi":"Nhiều động từ đi với một giới từ cố định, cần học cùng nhau:\n\nwarten auf + Akk: chờ\nsich freuen auf + Akk: mong đợi (việc sắp tới)\nsich freuen über + Akk: vui về (việc đã có)\ndenken an + Akk: nghĩ đến\nsich interessieren für + Akk: quan tâm đến\nsich kümmern um + Akk: chăm lo\nsich vorbereiten auf + Akk: chuẩn bị cho\nsprechen über + Akk: nói về\nsprechen mit + Dat: nói với\nteilnehmen an + Dat: tham gia\nträumen von + Dat: mơ về\nAngst haben vor + Dat: sợ"},"tags":["#Verben","#Praepositionen","#B1"]},
    {"type":"RULE","title":{"vi":"Đặt câu hỏi"},"content":{"vi":"Hỏi về sự vật: wo + giới từ (thêm r nếu giới từ bắt đầu bằng nguyên âm)\nWorauf wartest du? Auf den Bus.\nWofür interessierst du dich? Für Musik.\nWovon träumst du? Von einer Reise.\n\nHỏi về người: giới từ + wen/wem\nAuf wen wartest du? Auf meine Schwester.\nMit wem sprichst du? Mit dem Chef."},"tags":["#Frage","#Pronominaladverb"]},
    {"type":"EXAMPLE","title":{"vi":"Trả lời ngắn và nối câu"},"content":{"vi":"Sự vật: da + giới từ (thêm r trước nguyên âm)\nWartest du auf den Bus? Ja, ich warte darauf.\nIch interessiere mich dafür.\n\nNgười: giới từ + đại từ\nWartest du auf Lan? Ja, ich warte auf sie.\n\nNối với câu phụ:\nIch freue mich darauf, dich zu sehen.\nIch denke daran, dass morgen die Prüfung ist."},"tags":["#Pronominaladverb","#Satzbau"]}
  ],
  "vocabulary":[
    {"id":"v60_01","german":"warten auf","meaning":"chờ","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich warte auf die Antwort.","example_vi":"Tôi đang chờ câu trả lời.","speak_de":"Ich warte auf die Antwort.","tags":[]},
    {"id":"v60_02","german":"sich vorbereiten auf","meaning":"chuẩn bị cho","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bereite mich auf die Prüfung vor.","example_vi":"Tôi chuẩn bị cho kỳ thi.","speak_de":"Ich bereite mich auf die Prüfung vor.","tags":[]},
    {"id":"v60_03","german":"sich kümmern um","meaning":"chăm lo","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie kümmert sich um ihre Mutter.","example_vi":"Cô ấy chăm sóc mẹ.","speak_de":"Sie kümmert sich um ihre Mutter.","tags":[]},
    {"id":"v60_04","german":"teilnehmen an","meaning":"tham gia","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich nehme an einem Kurs teil.","example_vi":"Tôi tham gia một khoá học.","speak_de":"Ich nehme an einem Kurs teil.","tags":[]},
    {"id":"v60_05","german":"sich erinnern an","meaning":"nhớ lại","gender":null,"color_code":null,"gender_label":null,"example_de":"Erinnerst du dich an unseren Urlaub?","example_vi":"Bạn có nhớ kỳ nghỉ của chúng ta không?","speak_de":"Erinnerst du dich an unseren Urlaub?","tags":[]},
    {"id":"v60_06","german":"Angst haben vor","meaning":"sợ","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich habe Angst vor der Prüfung.","example_vi":"Tôi sợ kỳ thi.","speak_de":"Ich habe Angst vor der Prüfung.","tags":[]}
  ],
  "phrases":[
    {"german":"Worauf wartest du?","meaning":"Bạn đang chờ gì?","speak_de":"Worauf wartest du?"},
    {"german":"Ich freue mich auf das Wochenende.","meaning":"Tôi mong đến cuối tuần.","speak_de":"Ich freue mich auf das Wochenende."},
    {"german":"Ich kümmere mich darum.","meaning":"Tôi sẽ lo việc đó.","speak_de":"Ich kümmere mich darum."}
  ],
  "examples":[
    {"german":"— Worüber habt ihr gesprochen?\n— Über den neuen Plan.\n— Und was hat der Chef gesagt?\n— Er kümmert sich darum. Wir warten jetzt auf seine Antwort.\n— Ich bin gespannt darauf.","translation":"— Các bạn đã nói về chuyện gì?\n— Về kế hoạch mới.\n— Sếp đã nói gì?\n— Ông ấy sẽ lo việc đó. Giờ chúng tôi đang chờ câu trả lời của ông.\n— Tôi rất mong biết kết quả.","note":"worüber, darum, darauf thay cho sự vật","speak_de":"Ich kümmere mich darum."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg60_01","type":"FILL_BLANK","sentence_de":"Ich warte ___ den Bus.","hint_vi":"warten + giới từ nào?","answer":"auf","accept_also":["auf"]},
      {"id":"tg60_02","type":"FILL_BLANK","sentence_de":"Wir freuen uns ___ den Urlaub im Sommer.","hint_vi":"Việc sắp tới","answer":"auf","accept_also":["auf"]},
      {"id":"tg60_03","type":"FILL_BLANK","sentence_de":"___ interessierst du dich?","hint_vi":"Hỏi về sự vật, sich interessieren für","answer":"Wofür","accept_also":["Wofuer"]},
      {"id":"tg60_04","type":"MULTIPLE_CHOICE","question_vi":"Denkst du an die Prüfung? Câu trả lời nào đúng?","options":["Ja, ich denke an ihr.","Ja, ich denke daran.","Ja, ich denke dafür.","Ja, ich denke wo."],"correct":1},
      {"id":"tg60_05","type":"MULTIPLE_CHOICE","question_vi":"Hỏi về người: Auf ___ wartest du?","options":["wer","wem","was","wen"],"correct":3}
    ],
    "practice":[
      {"id":"p60_01","type":"TRANSLATE","from":"vi","sentence":"Tôi đang đợi thư trả lời của công ty.","answer":"Ich warte auf die Antwort der Firma.","accept_also":[]},
      {"id":"p60_02","type":"REORDER","words":["meine","um","Großmutter.","Am","mich","Wochenende","ich","kümmere"],"correct_order":["Am","Wochenende","kümmere","ich","mich","um","meine","Großmutter."],"translation":"Cuối tuần tôi chăm sóc bà tôi."},
      {"id":"p60_03","type":"FILL_BLANK","sentence_de":"Ich nehme an einem Deutschkurs ___.","hint_vi":"teilnehmen: tiền tố tách ra","answer":"teil","accept_also":["teil"]}
    ]
  },
  "reading_passage":{
    "text_de":"Ein Brief an Sophie\n\nLiebe Sophie,\n\nich freue mich sehr auf deinen Besuch im Mai! Zurzeit bereite ich mich auf die B1-Prüfung vor. Ich habe ein bisschen Angst vor dem Hörverstehen, aber meine Lehrerin kümmert sich gut um uns. Gestern haben wir im Kurs über das Thema Arbeit diskutiert. Erinnerst du dich an Minh? Er hat sich um eine Stelle in Köln beworben und wartet jetzt auf die Antwort. Schreib mir bald!\n\nLiebe Grüße\nLinh",
    "text_vi":"Một lá thư gửi Sophie\n\nSophie thân mến,\n\nMình rất mong bạn đến thăm vào tháng Năm! Hiện mình đang chuẩn bị cho kỳ thi B1. Mình hơi sợ phần nghe, nhưng cô giáo rất quan tâm đến chúng mình. Hôm qua trong lớp chúng mình thảo luận về chủ đề công việc. Bạn còn nhớ Minh không? Bạn ấy đã ứng tuyển một vị trí ở Köln và đang chờ câu trả lời. Viết cho mình sớm nhé!\n\nThân mến\nLinh",
    "questions":[
      {"id":"rq60_01","type":"FILL_BLANK","question_vi":"Linh đang chuẩn bị cho gì?","answer":"auf die B1-Prüfung","accept_also":["die B1-Prüfung","B1-Prüfung","die Prüfung","auf die B1-Pruefung","die B1-Pruefung","B1-Pruefung","die Pruefung"]},
      {"id":"rq60_02","type":"MULTIPLE_CHOICE","question_vi":"Linh lo nhất về phần nào?","options":["Schreiben","Grammatik","Hörverstehen","Lesen"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Schreiben Sie einem Freund: Worauf freuen Sie sich? Wovor haben Sie Angst? Woran denken Sie oft?","task_vi":"Viết cho một người bạn: Bạn mong đợi điều gì? Bạn sợ điều gì? Bạn thường nghĩ đến điều gì?","min_sentences":5,"example_answer":"Lieber Tom,\nich freue mich schon auf den Sommer.\nIm Juli nehme ich an einem Sprachkurs in Berlin teil.\nIch habe ein bisschen Angst vor der Prüfung.\nAber ich denke oft daran, wie viel ich schon gelernt habe.\nLiebe Grüße\nHa"},
  "audio_content":{
    "listen_words":[
      {"text":"Ich warte auf den Bus.","meaning":"Tôi đang chờ xe buýt."},
      {"text":"Worauf freust du dich?","meaning":"Bạn đang mong đợi điều gì?"},
      {"text":"Ich kümmere mich darum.","meaning":"Tôi sẽ lo việc đó."}
    ],
    "listen_dialogue":"Worüber denkst du nach? — Über die Prüfung. Ich habe Angst davor. — Hast du dich gut darauf vorbereitet? — Ich glaube schon. — Dann mach dir keine Sorgen. Ich denke an dich und drücke dir die Daumen."
  }
}'::jsonb);
