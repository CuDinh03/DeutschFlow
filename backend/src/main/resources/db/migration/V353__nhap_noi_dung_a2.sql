-- Nội dung 16 bài A2 còn rỗng (ngày 32–34, 36–38, 41–50), BẢN NHÁP chờ duyệt (01/11/2026).
--
-- AI soạn nháp, người duyệt, chưa duyệt thì không tới tay học viên (quy ước owner 21/10). Migration
-- này CHỈ ghi content_json: node_family vẫn NULL nên /roadmap/me và /skill-tree/me tiếp tục ẩn các
-- node này, chuỗi dependency giữ nguyên như V352. Phát hành là một migration riêng sau khi duyệt,
-- chỉ một dòng gọi phat_hanh_node_goc (V355), giống cách V346 duyệt đề V343.
--
-- Soạn gốc, cùng khuôn V180. Đáp án nằm trong exercises để NodeExerciseGrader chấm (MULTIPLE_CHOICE
-- theo correct, FILL_BLANK theo answer + accept_also). TRANSLATE và REORDER chỉ để tự kiểm tra.
-- Bản đọc cho người duyệt: docs/duyet-noi-dung/2026-11-01-a2-b1-nhap.md.
-- WHERE khoá theo vỏ rỗng để không đè nội dung đã sửa tay.

-- ─── Ngày 32: Wechselpräpositionen ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Wechselpräpositionen","vi":"Giới từ hai hướng"},
  "overview":{"de":"Das Buch liegt auf dem Tisch. Ich lege das Buch auf den Tisch.","vi":"Chín giới từ đi với cả hai cách: hỏi Wo? thì dùng Dativ, hỏi Wohin? thì dùng Akkusativ."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Wo? hay Wohin?"},"content":{"vi":"Chín giới từ: an, auf, hinter, in, neben, über, unter, vor, zwischen.\n\nWo? = ở đâu, đứng yên → Dativ:\nDas Buch liegt auf dem Tisch.\nIch bin in der Stadt.\n\nWohin? = đi đâu, chuyển hướng → Akkusativ:\nIch lege das Buch auf den Tisch.\nIch gehe in die Stadt."},"tags":["#Praepositionen","#A2"]},
    {"type":"RULE","title":{"vi":"Cặp động từ vị trí và hướng"},"content":{"vi":"Vị trí (Wo? + Dativ):\nliegen: Das Handy liegt auf dem Sofa.\nstehen: Die Flasche steht auf dem Tisch.\nsitzen: Das Kind sitzt auf dem Stuhl.\nhängen: Das Bild hängt an der Wand.\n\nHướng (Wohin? + Akkusativ):\nlegen: Ich lege das Handy auf das Sofa.\nstellen: Ich stelle die Flasche auf den Tisch.\nsetzen: Ich setze das Kind auf den Stuhl.\nhängen: Ich hänge das Bild an die Wand."},"tags":["#Verben","#A2"]},
    {"type":"EXAMPLE","title":{"vi":"Dạng rút gọn"},"content":{"vi":"in + dem = im: Ich bin im Büro.\nin + das = ins: Ich gehe ins Büro.\nan + dem = am: Wir sind am See.\nan + das = ans: Wir fahren ans Meer.\n\nHai dạng im và am là Dativ, hai dạng ins và ans là Akkusativ."},"tags":["#Praepositionen","#Grammatik"]}
  ],
  "vocabulary":[
    {"id":"v32_01","german":"legen","meaning":"đặt, để (nằm)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich lege den Schlüssel auf den Tisch.","example_vi":"Tôi để chìa khoá lên bàn.","speak_de":"Ich lege den Schlüssel auf den Tisch.","tags":[]},
    {"id":"v32_02","german":"stellen","meaning":"đặt, để (đứng)","gender":null,"color_code":null,"gender_label":null,"example_de":"Stell die Tasse bitte ins Regal.","example_vi":"Làm ơn đặt cái cốc vào giá.","speak_de":"Stell die Tasse bitte ins Regal.","tags":[]},
    {"id":"v32_03","german":"hängen","meaning":"treo","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Bild hängt an der Wand.","example_vi":"Bức tranh treo trên tường.","speak_de":"Das Bild hängt an der Wand.","tags":[]},
    {"id":"v32_04","german":"das Regal","meaning":"giá, kệ","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Die Bücher stehen im Regal.","example_vi":"Sách nằm trên giá.","speak_de":"Die Bücher stehen im Regal.","tags":[]},
    {"id":"v32_05","german":"der Schrank","meaning":"tủ","gender":"DER","color_code":null,"gender_label":"der","example_de":"Der Schrank steht neben der Tür.","example_vi":"Cái tủ ở cạnh cửa.","speak_de":"Der Schrank steht neben der Tür.","tags":[]},
    {"id":"v32_06","german":"die Wand","meaning":"bức tường","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Wir stellen das Sofa an die Wand.","example_vi":"Chúng tôi đặt ghế sofa sát tường.","speak_de":"Wir stellen das Sofa an die Wand.","tags":[]}
  ],
  "phrases":[
    {"german":"Wo ist mein Schlüssel?","meaning":"Chìa khoá của tôi đâu rồi?","speak_de":"Wo ist mein Schlüssel?"},
    {"german":"Stell die Tasche bitte neben die Tür.","meaning":"Làm ơn đặt cái túi cạnh cửa.","speak_de":"Stell die Tasche bitte neben die Tür."},
    {"german":"Das Bild hängt an der Wand.","meaning":"Bức tranh treo trên tường.","speak_de":"Das Bild hängt an der Wand."}
  ],
  "examples":[
    {"german":"— Wohin soll ich den Schrank stellen?\n— Stell ihn bitte an die Wand, neben das Fenster.\n— Und die Bücher?\n— Die Bücher kommen ins Regal. Der Fernseher steht schon im Wohnzimmer.","translation":"— Tôi nên đặt cái tủ ở đâu?\n— Đặt sát tường, cạnh cửa sổ nhé.\n— Còn sách thì sao?\n— Sách để lên giá. Ti vi đã ở trong phòng khách rồi.","note":"stellen + Akkusativ (hướng); stehen + Dativ (vị trí)","speak_de":"Stell ihn bitte an die Wand."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg32_01","type":"FILL_BLANK","sentence_de":"Das Buch liegt auf ___ Tisch.","hint_vi":"Wo? → Dativ, der Tisch","answer":"dem","accept_also":["dem"]},
      {"id":"tg32_02","type":"FILL_BLANK","sentence_de":"Ich lege das Buch auf ___ Tisch.","hint_vi":"Wohin? → Akkusativ, der Tisch","answer":"den","accept_also":["den"]},
      {"id":"tg32_03","type":"MULTIPLE_CHOICE","question_vi":"Câu nào chỉ VỊ TRÍ (Dativ)?","options":["Ich gehe in die Stadt.","Ich hänge das Bild an die Wand.","Ich bin in der Stadt.","Ich fahre ans Meer."],"correct":2},
      {"id":"tg32_04","type":"FILL_BLANK","sentence_de":"Das Bild hängt an ___ Wand.","hint_vi":"Wo? → Dativ, die Wand","answer":"der","accept_also":["der"]},
      {"id":"tg32_05","type":"MULTIPLE_CHOICE","question_vi":"Động từ nào đi với Wohin? và Akkusativ?","options":["liegen","stehen","sitzen","stellen"],"correct":3}
    ],
    "practice":[
      {"id":"p32_01","type":"TRANSLATE","from":"vi","sentence":"Tôi đặt cái cốc lên bàn.","answer":"Ich stelle die Tasse auf den Tisch.","accept_also":["Ich stelle das Glas auf den Tisch."]},
      {"id":"p32_02","type":"REORDER","words":["dem","unter","sitzt","Katze","Die","Stuhl."],"correct_order":["Die","Katze","sitzt","unter","dem","Stuhl."],"translation":"Con mèo ngồi dưới ghế."},
      {"id":"p32_03","type":"FILL_BLANK","sentence_de":"Wir gehen heute ___ Kino.","hint_vi":"in + das, viết rút gọn","answer":"ins","accept_also":["ins"]}
    ]
  },
  "reading_passage":{
    "text_de":"Der Umzug\n\nLetzte Woche ist Minh in eine neue Wohnung gezogen. Sein Freund Tom hat ihm geholfen. Zuerst haben sie das Bett ins Schlafzimmer gestellt. Dann haben sie den Schrank an die Wand gestellt. Die Bücher stehen jetzt im Regal neben dem Fenster. Nur die Lampe liegt noch auf dem Boden, denn Minh weiß nicht, wo sie hängen soll.",
    "text_vi":"Chuyển nhà\n\nTuần trước Minh chuyển vào một căn hộ mới. Bạn anh ấy là Tom đã giúp anh. Đầu tiên họ đặt giường vào phòng ngủ. Sau đó họ đặt tủ sát tường. Sách giờ nằm trên giá cạnh cửa sổ. Chỉ còn cái đèn vẫn nằm trên sàn, vì Minh không biết nên treo nó ở đâu.",
    "questions":[
      {"id":"rq32_01","type":"FILL_BLANK","question_vi":"Sách bây giờ nằm ở đâu?","answer":"im Regal","accept_also":["im Regal neben dem Fenster"]},
      {"id":"rq32_02","type":"MULTIPLE_CHOICE","question_vi":"Cái gì vẫn còn nằm trên sàn?","options":["das Bett","die Lampe","der Schrank","die Bücher"],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Beschreiben Sie Ihr Zimmer. Wo stehen die Möbel? Schreiben Sie 4 Sätze.","task_vi":"Hãy miêu tả phòng của bạn. Đồ đạc ở đâu? Viết 4 câu.","min_sentences":4,"example_answer":"Mein Zimmer ist klein.\nDas Bett steht neben dem Fenster.\nAn der Wand hängt ein Bild.\nMeine Bücher stehen im Regal."},
  "audio_content":{
    "listen_words":[
      {"text":"Das Buch liegt auf dem Tisch.","meaning":"Quyển sách nằm trên bàn."},
      {"text":"Ich lege das Buch auf den Tisch.","meaning":"Tôi đặt quyển sách lên bàn."},
      {"text":"Wir gehen heute ins Kino.","meaning":"Hôm nay chúng tôi đi xem phim."}
    ],
    "listen_dialogue":"Wo ist mein Handy? — Ich glaube, es liegt auf dem Sofa. — Nein, da ist es nicht. — Dann schau mal in die Tasche. — Ah, hier ist es. Danke!"
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 32 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 33: Adjektivdeklination ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Adjektivdeklination","vi":"Biến đổi tính từ"},
  "overview":{"de":"Der große Mann. Eine nette Frau. Kaltes Wasser.","vi":"Tính từ đứng trước danh từ thêm đuôi theo mạo từ, giống và cách."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Sau der, die, das"},"content":{"vi":"Nominativ: đuôi -e\nder große Mann, die nette Frau, das kleine Kind\n\nAkkusativ: chỉ giống đực đổi thành -en\nden großen Mann, die nette Frau, das kleine Kind\n\nDativ và số nhiều: luôn -en\ndem großen Mann, der netten Frau, dem kleinen Kind\ndie kleinen Kinder"},"tags":["#Adjektiv","#A2"]},
    {"type":"RULE","title":{"vi":"Sau ein, kein, mein"},"content":{"vi":"Khi mạo từ không cho thấy giống, tính từ gánh đuôi đó:\n\nNominativ:\nein großer Mann, eine nette Frau, ein kleines Kind\n\nAkkusativ:\neinen großen Mann, eine nette Frau, ein kleines Kind\n\nDativ:\neinem großen Mann, einer netten Frau, einem kleinen Kind\n\nSố nhiều: meine kleinen Kinder, keine neuen Schuhe"},"tags":["#Adjektiv","#Deklination"]},
    {"type":"EXAMPLE","title":{"vi":"Không có mạo từ, và khi nào không thêm đuôi"},"content":{"vi":"Không có mạo từ, tính từ mang đuôi giống như der/die/das:\nkalter Kaffee, frische Milch, kaltes Wasser, neue Schuhe\n\nGiống đực Akkusativ: Ich trinke kalten Kaffee.\nDativ: mit kaltem Wasser\n\nSau sein thì KHÔNG thêm đuôi:\nDer Mann ist groß. Die Jacke ist neu."},"tags":["#Adjektiv","#Grammatik"]}
  ],
  "vocabulary":[
    {"id":"v33_01","german":"freundlich","meaning":"thân thiện","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie ist eine freundliche Kollegin.","example_vi":"Cô ấy là một đồng nghiệp thân thiện.","speak_de":"Sie ist eine freundliche Kollegin.","tags":[]},
    {"id":"v33_02","german":"bequem","meaning":"thoải mái","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich suche bequeme Schuhe.","example_vi":"Tôi tìm một đôi giày thoải mái.","speak_de":"Ich suche bequeme Schuhe.","tags":[]},
    {"id":"v33_03","german":"günstig","meaning":"giá hợp lý","gender":null,"color_code":null,"gender_label":null,"example_de":"Das ist ein günstiges Angebot.","example_vi":"Đây là một ưu đãi giá tốt.","speak_de":"Das ist ein günstiges Angebot.","tags":[]},
    {"id":"v33_04","german":"gemütlich","meaning":"ấm cúng","gender":null,"color_code":null,"gender_label":null,"example_de":"Wir wohnen in einer gemütlichen Wohnung.","example_vi":"Chúng tôi sống trong một căn hộ ấm cúng.","speak_de":"Wir wohnen in einer gemütlichen Wohnung.","tags":[]},
    {"id":"v33_05","german":"teuer","meaning":"đắt","gender":null,"color_code":null,"gender_label":null,"example_de":"Das ist ein teures Auto.","example_vi":"Đây là một chiếc xe đắt tiền.","speak_de":"Das Auto ist teuer.","tags":[]},
    {"id":"v33_06","german":"die Anzeige","meaning":"tin rao, quảng cáo","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Ich habe eine interessante Anzeige gelesen.","example_vi":"Tôi đã đọc một tin rao thú vị.","speak_de":"Ich habe eine interessante Anzeige gelesen.","tags":[]}
  ],
  "phrases":[
    {"german":"Ich suche eine kleine Wohnung.","meaning":"Tôi đang tìm một căn hộ nhỏ.","speak_de":"Ich suche eine kleine Wohnung."},
    {"german":"Das ist ein guter Preis.","meaning":"Đây là một mức giá tốt.","speak_de":"Das ist ein guter Preis."},
    {"german":"Ich hätte gern einen schwarzen Kaffee.","meaning":"Tôi muốn một ly cà phê đen.","speak_de":"Ich hätte gern einen schwarzen Kaffee."}
  ],
  "examples":[
    {"german":"— Wie findest du die blaue Jacke?\n— Sie ist schön, aber ich suche eine warme Jacke.\n— Und der schwarze Mantel?\n— Ja, der schwarze Mantel gefällt mir. Ich nehme ihn.","translation":"— Bạn thấy cái áo khoác xanh thế nào?\n— Đẹp, nhưng mình đang tìm một cái áo ấm.\n— Còn cái áo măng tô đen?\n— Ừ, mình thích cái áo đen. Mình lấy nó.","note":"die blaue Jacke (sau die) nhưng eine warme Jacke (sau eine): giống cái có cùng đuôi -e","speak_de":"Der schwarze Mantel gefällt mir."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg33_01","type":"FILL_BLANK","sentence_de":"Das ist ein ___ Mann. (groß)","hint_vi":"Nominativ giống đực sau ein","answer":"großer","accept_also":["grosser"]},
      {"id":"tg33_02","type":"FILL_BLANK","sentence_de":"Ich kaufe den ___ Mantel. (schwarz)","hint_vi":"Akkusativ giống đực sau den","answer":"schwarzen","accept_also":["schwarzen"]},
      {"id":"tg33_03","type":"FILL_BLANK","sentence_de":"Sie trägt eine ___ Jacke. (neu)","hint_vi":"Akkusativ giống cái sau eine","answer":"neue","accept_also":["neue"]},
      {"id":"tg33_04","type":"MULTIPLE_CHOICE","question_vi":"Chọn dạng đúng: Ich wohne in einem ___ Haus.","options":["kleinen","kleine","kleines","kleiner"],"correct":0},
      {"id":"tg33_05","type":"MULTIPLE_CHOICE","question_vi":"Chọn dạng đúng: Der Kaffee ist ___.","options":["heiße","heißer","heiß","heißen"],"correct":2}
    ],
    "practice":[
      {"id":"p33_01","type":"TRANSLATE","from":"vi","sentence":"Tôi mua một cái áo khoác mới.","answer":"Ich kaufe eine neue Jacke.","accept_also":["Ich kaufe einen neuen Mantel."]},
      {"id":"p33_02","type":"REORDER","words":["Mein","Bruder","ein","schnelles","hat","Auto."],"correct_order":["Mein","Bruder","hat","ein","schnelles","Auto."],"translation":"Anh trai tôi có một chiếc xe nhanh."},
      {"id":"p33_03","type":"FILL_BLANK","sentence_de":"Ich trinke gern ___ Kaffee. (schwarz)","hint_vi":"Không có mạo từ, Akkusativ giống đực","answer":"schwarzen","accept_also":["schwarzen"]}
    ]
  },
  "reading_passage":{
    "text_de":"Ein neues Zuhause\n\nLan sucht eine kleine Wohnung in Leipzig. Gestern hat sie eine interessante Anzeige gelesen: zwei helle Zimmer, eine moderne Küche und ein großer Balkon. Die freundliche Vermieterin zeigt ihr die Wohnung. Der alte Holzboden gefällt Lan sehr gut, aber die Miete ist ein bisschen hoch. Trotzdem möchte sie die schöne Wohnung nehmen.",
    "text_vi":"Một tổ ấm mới\n\nLan đang tìm một căn hộ nhỏ ở Leipzig. Hôm qua cô đọc được một tin rao thú vị: hai phòng sáng sủa, một bếp hiện đại và một ban công lớn. Bà chủ nhà thân thiện cho cô xem căn hộ. Lan rất thích sàn gỗ cũ, nhưng tiền thuê hơi cao. Dù vậy cô vẫn muốn thuê căn hộ đẹp này.",
    "questions":[
      {"id":"rq33_01","type":"FILL_BLANK","question_vi":"Căn hộ có mấy phòng sáng?","answer":"zwei","accept_also":["zwei Zimmer","2"]},
      {"id":"rq33_02","type":"MULTIPLE_CHOICE","question_vi":"Lan thấy điều gì chưa ổn?","options":["die Küche","der Balkon","die Miete","die Vermieterin"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Beschreiben Sie Ihre Wohnung oder Ihre Stadt mit 4 Adjektiven.","task_vi":"Hãy miêu tả căn hộ hoặc thành phố của bạn, dùng 4 tính từ.","min_sentences":4,"example_answer":"Ich wohne in einer kleinen Stadt.\nWir haben eine gemütliche Wohnung.\nIn der Nähe gibt es einen großen Park.\nDort treffe ich oft nette Leute."},
  "audio_content":{
    "listen_words":[
      {"text":"Ich suche eine kleine Wohnung.","meaning":"Tôi đang tìm một căn hộ nhỏ."},
      {"text":"Das ist ein großer Balkon.","meaning":"Đây là một ban công lớn."},
      {"text":"Der schwarze Mantel gefällt mir.","meaning":"Tôi thích cái áo măng tô đen."}
    ],
    "listen_dialogue":"Guten Tag, ich suche bequeme Schuhe. — Welche Farbe möchten Sie? — Am liebsten schwarze Schuhe. — Hier habe ich ein günstiges Modell. — Danke, die nehme ich."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 33 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 34: Komparativ und Superlativ ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Komparativ und Superlativ","vi":"So sánh hơn và so sánh nhất"},
  "overview":{"de":"Berlin ist groß. Hamburg ist kleiner als Berlin. Berlin ist am größten.","vi":"Cách tạo dạng so sánh hơn với -er và so sánh nhất với am -sten."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"So sánh hơn: -er + als"},"content":{"vi":"Tính từ + -er + als:\nschnell → schneller\nDer Zug ist schneller als der Bus.\n\nSo sánh bằng: so + tính từ + wie:\nAnna ist so groß wie Tom.\nHeute ist es nicht so warm wie gestern."},"tags":["#Komparativ","#A2"]},
    {"type":"RULE","title":{"vi":"So sánh nhất: am -sten"},"content":{"vi":"am + tính từ + -sten:\nschnell → am schnellsten\nDer Zug fährt am schnellsten.\n\nTrước danh từ: der schnellste Zug.\n\nNhiều tính từ ngắn với a, o, u biến âm:\nalt → älter → am ältesten\njung → jünger → am jüngsten\ngroß → größer → am größten\n\nĐuôi -t, -d, -s, -ß, -z thường thêm -e-:\nheiß → am heißesten (riêng groß là ngoại lệ: am größten)"},"tags":["#Superlativ","#A2"]},
    {"type":"EXAMPLE","title":{"vi":"Dạng bất quy tắc cần thuộc"},"content":{"vi":"gut → besser → am besten\nviel → mehr → am meisten\ngern → lieber → am liebsten\nhoch → höher → am höchsten\n\nIch trinke gern Tee.\nIch trinke lieber Kaffee.\nAm liebsten trinke ich Wasser."},"tags":["#Komparativ","#Superlativ"]}
  ],
  "vocabulary":[
    {"id":"v34_01","german":"billig","meaning":"rẻ","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Hotel ist billiger als die Pension.","example_vi":"Khách sạn này rẻ hơn nhà trọ.","speak_de":"Das Hotel ist billiger als die Pension.","tags":[]},
    {"id":"v34_02","german":"besser","meaning":"tốt hơn","gender":null,"color_code":null,"gender_label":null,"example_de":"Heute geht es mir besser.","example_vi":"Hôm nay tôi thấy khoẻ hơn.","speak_de":"Heute geht es mir besser.","tags":[]},
    {"id":"v34_03","german":"lieber","meaning":"thích hơn","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich fahre lieber mit dem Zug.","example_vi":"Tôi thích đi tàu hơn.","speak_de":"Ich fahre lieber mit dem Zug.","tags":[]},
    {"id":"v34_04","german":"am liebsten","meaning":"thích nhất","gender":null,"color_code":null,"gender_label":null,"example_de":"Am liebsten esse ich Reis.","example_vi":"Tôi thích ăn cơm nhất.","speak_de":"Am liebsten esse ich Reis.","tags":[]},
    {"id":"v34_05","german":"mehr","meaning":"nhiều hơn","gender":null,"color_code":null,"gender_label":null,"example_de":"In der Stadt gibt es mehr Arbeit.","example_vi":"Ở thành phố có nhiều việc làm hơn.","speak_de":"In der Stadt gibt es mehr Arbeit.","tags":[]},
    {"id":"v34_06","german":"das Dorf","meaning":"ngôi làng","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Das Dorf ist ruhiger als die Stadt.","example_vi":"Làng yên tĩnh hơn thành phố.","speak_de":"Das Dorf ist ruhiger als die Stadt.","tags":[]}
  ],
  "phrases":[
    {"german":"Das ist viel besser.","meaning":"Như vậy tốt hơn nhiều.","speak_de":"Das ist viel besser."},
    {"german":"Was machst du am liebsten?","meaning":"Bạn thích làm gì nhất?","speak_de":"Was machst du am liebsten?"},
    {"german":"Der Zug ist schneller als der Bus.","meaning":"Tàu nhanh hơn xe buýt.","speak_de":"Der Zug ist schneller als der Bus."}
  ],
  "examples":[
    {"german":"— Fahren wir mit dem Bus oder mit dem Zug?\n— Der Bus ist billiger, aber der Zug ist schneller.\n— Und das Auto?\n— Das ist am teuersten. Ich fahre lieber mit dem Zug.","translation":"— Mình đi xe buýt hay đi tàu?\n— Xe buýt rẻ hơn, nhưng tàu nhanh hơn.\n— Còn ô tô?\n— Cái đó đắt nhất. Mình thích đi tàu hơn.","note":"teuer mất chữ e khi thêm đuôi: teurer, nhưng am teuersten","speak_de":"Der Zug ist schneller."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg34_01","type":"FILL_BLANK","sentence_de":"Der Zug ist schneller ___ der Bus.","hint_vi":"So sánh hơn đi với từ nào?","answer":"als","accept_also":["als"]},
      {"id":"tg34_02","type":"FILL_BLANK","sentence_de":"Anna ist so alt ___ Tom.","hint_vi":"So sánh bằng: so ... ?","answer":"wie","accept_also":["wie"]},
      {"id":"tg34_03","type":"FILL_BLANK","sentence_de":"Ich trinke ___ Tee als Kaffee. (gern)","hint_vi":"So sánh hơn của gern","answer":"lieber","accept_also":["lieber"]},
      {"id":"tg34_04","type":"MULTIPLE_CHOICE","question_vi":"So sánh nhất của gut là gì?","options":["am gutesten","am bessten","am besten","am güten"],"correct":2},
      {"id":"tg34_05","type":"MULTIPLE_CHOICE","question_vi":"München ist ___ als Leipzig. (groß)","options":["größer","groß","großer","am größten"],"correct":0}
    ],
    "practice":[
      {"id":"p34_01","type":"TRANSLATE","from":"vi","sentence":"Mùa hè nóng hơn mùa xuân.","answer":"Der Sommer ist heißer als der Frühling.","accept_also":[]},
      {"id":"p34_02","type":"REORDER","words":["als","ist","Bruder","älter","Mein","ich."],"correct_order":["Mein","Bruder","ist","älter","als","ich."],"translation":"Anh trai tôi lớn tuổi hơn tôi."},
      {"id":"p34_03","type":"FILL_BLANK","sentence_de":"Deutsch mag ich am ___. (gern)","hint_vi":"So sánh nhất của gern","answer":"liebsten","accept_also":["liebsten"]}
    ]
  },
  "reading_passage":{
    "text_de":"Stadt oder Land?\n\nThu wohnt seit zwei Jahren in Berlin. Ihre Schwester wohnt in einem kleinen Dorf in Bayern. Berlin ist viel größer und lauter als das Dorf, aber dort gibt es mehr Arbeit. Das Leben auf dem Land ist ruhiger und die Wohnungen sind billiger. Am liebsten besucht Thu ihre Schwester im Sommer, denn dann ist es im Dorf am schönsten.",
    "text_vi":"Thành phố hay nông thôn?\n\nThu sống ở Berlin đã hai năm. Chị gái cô sống ở một ngôi làng nhỏ ở Bayern. Berlin lớn hơn và ồn hơn làng rất nhiều, nhưng ở đó có nhiều việc làm hơn. Cuộc sống ở nông thôn yên tĩnh hơn và nhà cũng rẻ hơn. Thu thích về thăm chị nhất vào mùa hè, vì lúc đó làng đẹp nhất.",
    "questions":[
      {"id":"rq34_01","type":"FILL_BLANK","question_vi":"Cuộc sống ở đâu yên tĩnh hơn?","answer":"auf dem Land","accept_also":["im Dorf","Land","das Dorf"]},
      {"id":"rq34_02","type":"MULTIPLE_CHOICE","question_vi":"Thu thích về thăm chị nhất vào khi nào?","options":["im Winter","im Frühling","im Sommer","im Herbst"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Vergleichen Sie zwei Städte oder zwei Länder. Schreiben Sie 4 Sätze.","task_vi":"Hãy so sánh hai thành phố hoặc hai đất nước. Viết 4 câu.","min_sentences":4,"example_answer":"Hanoi ist größer als Hue.\nIn Hanoi gibt es mehr Arbeit.\nIn Hue ist das Leben ruhiger.\nAm besten gefällt mir das Essen in Hue."},
  "audio_content":{
    "listen_words":[
      {"text":"Der Zug ist schneller als der Bus.","meaning":"Tàu nhanh hơn xe buýt."},
      {"text":"Heute ist es nicht so warm wie gestern.","meaning":"Hôm nay không ấm bằng hôm qua."},
      {"text":"Am liebsten trinke ich Tee.","meaning":"Tôi thích uống trà nhất."}
    ],
    "listen_dialogue":"Welche Wohnung findest du besser? — Die Wohnung in der Stadt ist kleiner, aber näher an der Arbeit. — Und welche ist billiger? — Die Wohnung auf dem Land. Sie ist am größten und am billigsten."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 34 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 36: Kommunikation am Telefon ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Kommunikation am Telefon","vi":"Giao tiếp qua điện thoại"},
  "overview":{"de":"Guten Tag, hier spricht Minh Nguyen. Kann ich eine Nachricht hinterlassen?","vi":"Cách mở đầu cuộc gọi, nhắn lại, xử lý khi nghe không rõ và chào kết thúc."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Mở đầu cuộc gọi"},"content":{"vi":"Tự giới thiệu:\nGuten Tag, hier spricht Minh Nguyen.\n\nỞ công ty, người nghe máy thường nói tên công ty rồi tên mình:\nFirma Schmidt, Müller am Apparat, guten Tag.\n\nHỏi gặp ai đó:\nKann ich bitte Frau Weber sprechen?\nIch möchte gern mit Frau Weber sprechen."},"tags":["#Telefon","#A2"]},
    {"type":"RULE","title":{"vi":"Khi người cần gặp vắng mặt"},"content":{"vi":"Người nghe máy có thể nói:\nFrau Weber ist gerade nicht im Büro.\nKann ich ihr etwas ausrichten?\n\nBạn có thể đáp:\nKann ich eine Nachricht hinterlassen?\nKönnen Sie mich bitte zurückrufen?\nIch rufe später noch einmal an.\n\nHộp thư thoại: Bitte sprechen Sie nach dem Signalton."},"tags":["#Telefon","#Nachricht"]},
    {"type":"EXAMPLE","title":{"vi":"Nghe không rõ và kết thúc cuộc gọi"},"content":{"vi":"Wie bitte? Können Sie das bitte wiederholen?\nKönnen Sie bitte langsamer sprechen?\nKönnen Sie das bitte buchstabieren?\nDie Verbindung ist schlecht.\nEntschuldigung, ich habe mich verwählt.\n\nKết thúc: Auf Wiederhören!\nTrên điện thoại nói Auf Wiederhören (hẹn nghe lại), không nói Auf Wiedersehen."},"tags":["#Telefon","#Hoeflichkeit"]}
  ],
  "vocabulary":[
    {"id":"v36_01","german":"anrufen","meaning":"gọi điện","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich rufe dich heute Abend an.","example_vi":"Tối nay tôi gọi cho bạn.","speak_de":"Ich rufe dich heute Abend an.","tags":[]},
    {"id":"v36_02","german":"zurückrufen","meaning":"gọi lại","gender":null,"color_code":null,"gender_label":null,"example_de":"Können Sie mich bitte zurückrufen?","example_vi":"Bạn có thể gọi lại cho tôi không?","speak_de":"Können Sie mich bitte zurückrufen?","tags":[]},
    {"id":"v36_03","german":"ausrichten","meaning":"nhắn lại","gender":null,"color_code":null,"gender_label":null,"example_de":"Kann ich ihm etwas ausrichten?","example_vi":"Tôi có thể nhắn gì cho anh ấy không?","speak_de":"Kann ich ihm etwas ausrichten?","tags":[]},
    {"id":"v36_04","german":"hinterlassen","meaning":"để lại (lời nhắn)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich möchte eine Nachricht hinterlassen.","example_vi":"Tôi muốn để lại lời nhắn.","speak_de":"Ich möchte eine Nachricht hinterlassen.","tags":[]},
    {"id":"v36_05","german":"besetzt","meaning":"máy bận","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Leitung ist besetzt.","example_vi":"Đường dây đang bận.","speak_de":"Die Leitung ist besetzt.","tags":[]},
    {"id":"v36_06","german":"der Anrufbeantworter","meaning":"hộp thư thoại","gender":"DER","color_code":null,"gender_label":"der","example_de":"Der Anrufbeantworter ist an.","example_vi":"Hộp thư thoại đang bật.","speak_de":"Der Anrufbeantworter ist an.","tags":[]}
  ],
  "phrases":[
    {"german":"Hier spricht Minh Nguyen.","meaning":"Tôi là Minh Nguyen đang gọi.","speak_de":"Hier spricht Minh Nguyen."},
    {"german":"Kann ich eine Nachricht hinterlassen?","meaning":"Tôi có thể để lại lời nhắn không?","speak_de":"Kann ich eine Nachricht hinterlassen?"},
    {"german":"Auf Wiederhören!","meaning":"Hẹn nghe lại!","speak_de":"Auf Wiederhören!"}
  ],
  "examples":[
    {"german":"— Firma Schmidt, Müller am Apparat, guten Tag.\n— Guten Tag, hier spricht Lan Tran. Kann ich bitte Frau Weber sprechen?\n— Frau Weber ist gerade nicht im Büro. Kann ich ihr etwas ausrichten?\n— Ja, bitte. Sie soll mich zurückrufen.\n— Gern. Auf Wiederhören!","translation":"— Công ty Schmidt, Müller nghe đây, xin chào.\n— Xin chào, tôi là Lan Tran. Tôi có thể gặp bà Weber không?\n— Bà Weber hiện không có ở văn phòng. Tôi có thể nhắn gì cho bà ấy không?\n— Vâng, nhờ bà ấy gọi lại cho tôi.\n— Vâng. Hẹn nghe lại!","note":"Sie soll mich zurückrufen = nhờ bà ấy gọi lại","speak_de":"Kann ich bitte Frau Weber sprechen?"}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg36_01","type":"FILL_BLANK","sentence_de":"Guten Tag, hier ___ Minh Nguyen.","hint_vi":"Động từ sprechen, ngôi er","answer":"spricht","accept_also":["spricht"]},
      {"id":"tg36_02","type":"MULTIPLE_CHOICE","question_vi":"Kết thúc cuộc gọi điện thoại, bạn nói gì?","options":["Auf Wiedersehen!","Bis dann, Telefon!","Auf Wiederhören!","Gute Nacht!"],"correct":2},
      {"id":"tg36_03","type":"FILL_BLANK","sentence_de":"Kann ich eine Nachricht ___?","hint_vi":"để lại","answer":"hinterlassen","accept_also":["hinterlassen"]},
      {"id":"tg36_04","type":"MULTIPLE_CHOICE","question_vi":"Bạn nghe không rõ, nói thế nào cho lịch sự?","options":["Was?","Können Sie das bitte wiederholen?","Sprich lauter!","Ich verstehe nichts, tschüss."],"correct":1},
      {"id":"tg36_05","type":"FILL_BLANK","sentence_de":"Ich rufe Sie später ___.","hint_vi":"zurückrufen: tiền tố tách ra đứng cuối câu","answer":"zurück","accept_also":["zurueck"]}
    ],
    "practice":[
      {"id":"p36_01","type":"TRANSLATE","from":"vi","sentence":"Tôi có thể gặp bà Weber được không?","answer":"Kann ich bitte Frau Weber sprechen?","accept_also":["Ich möchte gern mit Frau Weber sprechen."]},
      {"id":"p36_02","type":"REORDER","words":["Können","mich","zurückrufen?","bitte","Sie","morgen"],"correct_order":["Können","Sie","mich","bitte","morgen","zurückrufen?"],"translation":"Bạn có thể gọi lại cho tôi vào ngày mai không?"},
      {"id":"p36_03","type":"FILL_BLANK","sentence_de":"Entschuldigung, ich habe mich ___.","hint_vi":"gọi nhầm số","answer":"verwählt","accept_also":["verwaehlt"]}
    ]
  },
  "reading_passage":{
    "text_de":"Eine Nachricht auf dem Anrufbeantworter\n\nGuten Tag, hier spricht Anna Berger von der Zahnarztpraxis Dr. Vogel. Ich rufe wegen Ihres Termins am Donnerstag an. Leider ist Dr. Vogel an diesem Tag krank. Wir können Ihnen einen neuen Termin am Montag um 10 Uhr anbieten. Bitte rufen Sie uns bis Freitag zurück. Vielen Dank und auf Wiederhören!",
    "text_vi":"Lời nhắn trong hộp thư thoại\n\nXin chào, tôi là Anna Berger từ phòng khám nha khoa của bác sĩ Vogel. Tôi gọi về lịch hẹn của bạn vào thứ Năm. Tiếc là hôm đó bác sĩ Vogel bị ốm. Chúng tôi có thể đề xuất lịch mới vào thứ Hai lúc 10 giờ. Vui lòng gọi lại cho chúng tôi trước thứ Sáu. Xin cảm ơn và hẹn nghe lại!",
    "questions":[
      {"id":"rq36_01","type":"FILL_BLANK","question_vi":"Lịch hẹn mới vào ngày nào?","answer":"am Montag","accept_also":["Montag"]},
      {"id":"rq36_02","type":"MULTIPLE_CHOICE","question_vi":"Vì sao lịch hẹn phải đổi?","options":["Der Patient hat abgesagt.","Die Praxis ist umgezogen.","Dr. Vogel ist krank.","Das Telefon ist kaputt."],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Sie sind krank und können nicht zur Arbeit kommen. Schreiben Sie, was Sie Ihrem Chef am Telefon sagen.","task_vi":"Bạn bị ốm và không thể đi làm. Viết những gì bạn nói với sếp qua điện thoại.","min_sentences":4,"example_answer":"Guten Morgen, hier spricht Minh.\nIch bin leider krank und kann heute nicht kommen.\nIch gehe heute zum Arzt.\nKönnen Sie mich bitte morgen zurückrufen?"},
  "audio_content":{
    "listen_words":[
      {"text":"Hier spricht Lan Tran.","meaning":"Tôi là Lan Tran đang gọi."},
      {"text":"Kann ich ihr etwas ausrichten?","meaning":"Tôi có thể nhắn gì cho cô ấy không?"},
      {"text":"Können Sie das bitte wiederholen?","meaning":"Bạn có thể nhắc lại không?"}
    ],
    "listen_dialogue":"Praxis Dr. Vogel, guten Tag. — Guten Tag, hier spricht Minh Nguyen. Ich möchte einen Termin machen. — Wie ist Ihr Name, bitte? Können Sie das buchstabieren? — Ja, N, G, U, Y, E, N. — Danke. Kommen Sie am Montag um zehn Uhr? — Ja, gern. Auf Wiederhören!"
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 36 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 37: Behörden und Formulare ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Behörden und Formulare","vi":"Cơ quan hành chính và thủ tục"},
  "overview":{"de":"Ich möchte mich anmelden. Wo finde ich das Formular?","vi":"Đăng ký cư trú, đọc mẫu đơn và hỏi việc ở cơ quan hành chính."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Đăng ký cư trú (Anmeldung)"},"content":{"vi":"Khi chuyển đến một địa chỉ mới ở Đức, bạn thường phải đăng ký tại Bürgeramt (có nơi gọi là Einwohnermeldeamt), thường trong vòng hai tuần.\n\nGiấy tờ thường cần:\nder Reisepass (hộ chiếu)\ndie Wohnungsgeberbestätigung (giấy xác nhận của chủ nhà)\ndas Anmeldeformular (mẫu đăng ký)\n\nThủ tục có thể khác nhau tuỳ thành phố, hãy xem trang web của cơ quan đó."},"tags":["#Behoerde","#A2"]},
    {"type":"RULE","title":{"vi":"Đọc một mẫu đơn"},"content":{"vi":"Familienname: họ\nVorname: tên\nGeburtsdatum: ngày sinh\nGeburtsort: nơi sinh\nStaatsangehörigkeit: quốc tịch\nFamilienstand: tình trạng hôn nhân (ledig, verheiratet)\nAnschrift: địa chỉ\nUnterschrift: chữ ký\n\nKhi viết ngày tháng trong mẫu đơn Đức: 15.03.1995 (ngày.tháng.năm)."},"tags":["#Formular","#Wortschatz"]},
    {"type":"EXAMPLE","title":{"vi":"Câu hỏi tại cơ quan"},"content":{"vi":"Ich möchte mich anmelden.\nWelche Unterlagen brauche ich?\nMuss ich einen Termin vereinbaren?\nWo finde ich das Formular?\nKönnen Sie mir beim Ausfüllen helfen?\nWie viel kostet das?"},"tags":["#Behoerde","#Alltag"]}
  ],
  "vocabulary":[
    {"id":"v37_01","german":"das Amt","meaning":"cơ quan nhà nước","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Das Amt öffnet um acht Uhr.","example_vi":"Cơ quan mở cửa lúc tám giờ.","speak_de":"Das Amt öffnet um acht Uhr.","tags":[]},
    {"id":"v37_02","german":"das Formular","meaning":"mẫu đơn","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Bitte füllen Sie das Formular aus.","example_vi":"Xin hãy điền vào mẫu đơn.","speak_de":"Bitte füllen Sie das Formular aus.","tags":[]},
    {"id":"v37_03","german":"ausfüllen","meaning":"điền (đơn)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich fülle das Formular aus.","example_vi":"Tôi điền vào mẫu đơn.","speak_de":"Ich fülle das Formular aus.","tags":[]},
    {"id":"v37_04","german":"die Unterschrift","meaning":"chữ ký","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Hier fehlt noch Ihre Unterschrift.","example_vi":"Ở đây còn thiếu chữ ký của bạn.","speak_de":"Hier fehlt noch Ihre Unterschrift.","tags":[]},
    {"id":"v37_05","german":"die Unterlagen","meaning":"giấy tờ, hồ sơ (số nhiều)","gender":null,"color_code":null,"gender_label":null,"example_de":"Haben Sie alle Unterlagen dabei?","example_vi":"Bạn có mang đủ giấy tờ không?","speak_de":"Haben Sie alle Unterlagen dabei?","tags":[]},
    {"id":"v37_06","german":"vereinbaren","meaning":"thoả thuận, đặt (hẹn)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich möchte einen Termin vereinbaren.","example_vi":"Tôi muốn đặt một cuộc hẹn.","speak_de":"Ich möchte einen Termin vereinbaren.","tags":[]}
  ],
  "phrases":[
    {"german":"Ich möchte mich anmelden.","meaning":"Tôi muốn đăng ký cư trú.","speak_de":"Ich möchte mich anmelden."},
    {"german":"Welche Unterlagen brauche ich?","meaning":"Tôi cần những giấy tờ nào?","speak_de":"Welche Unterlagen brauche ich?"},
    {"german":"Ich möchte ein Konto eröffnen.","meaning":"Tôi muốn mở một tài khoản.","speak_de":"Ich möchte ein Konto eröffnen."}
  ],
  "examples":[
    {"german":"— Guten Tag, ich möchte mich anmelden.\n— Haben Sie einen Termin?\n— Ja, um neun Uhr.\n— Gut. Ich brauche Ihren Reisepass und die Wohnungsgeberbestätigung.\n— Hier, bitte. Muss ich noch etwas ausfüllen?\n— Ja, dieses Formular. Bitte unterschreiben Sie hier.","translation":"— Xin chào, tôi muốn đăng ký cư trú.\n— Bạn có lịch hẹn không?\n— Có, lúc chín giờ.\n— Được. Tôi cần hộ chiếu và giấy xác nhận của chủ nhà.\n— Đây ạ. Tôi có phải điền gì nữa không?\n— Có, mẫu đơn này. Xin ký vào đây.","note":"sich anmelden: ich melde mich an","speak_de":"Ich möchte mich anmelden."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg37_01","type":"FILL_BLANK","sentence_de":"Ich möchte ___ anmelden.","hint_vi":"Động từ phản thân, ngôi ich","answer":"mich","accept_also":["mich"]},
      {"id":"tg37_02","type":"MULTIPLE_CHOICE","question_vi":"Familienstand nghĩa là gì?","options":["quê quán","nghề nghiệp","quốc tịch","tình trạng hôn nhân"],"correct":3},
      {"id":"tg37_03","type":"MULTIPLE_CHOICE","question_vi":"Unterschrift nghĩa là gì?","options":["chữ ký","địa chỉ","ngày sinh","lệ phí"],"correct":0},
      {"id":"tg37_04","type":"FILL_BLANK","sentence_de":"Bitte füllen Sie das Formular ___.","hint_vi":"ausfüllen: tiền tố tách ra","answer":"aus","accept_also":["aus"]},
      {"id":"tg37_05","type":"FILL_BLANK","sentence_de":"Muss ich einen Termin ___?","hint_vi":"đặt (hẹn)","answer":"vereinbaren","accept_also":["machen"]}
    ],
    "practice":[
      {"id":"p37_01","type":"TRANSLATE","from":"vi","sentence":"Tôi cần những giấy tờ nào?","answer":"Welche Unterlagen brauche ich?","accept_also":[]},
      {"id":"p37_02","type":"REORDER","words":["möchte","bei","Konto","ein","Bank","der","eröffnen.","Ich"],"correct_order":["Ich","möchte","bei","der","Bank","ein","Konto","eröffnen."],"translation":"Tôi muốn mở một tài khoản ở ngân hàng."},
      {"id":"p37_03","type":"FILL_BLANK","sentence_de":"Hier müssen Sie bitte ___.","hint_vi":"ký tên","answer":"unterschreiben","accept_also":["unterzeichnen"]}
    ]
  },
  "reading_passage":{
    "text_de":"Bürgeramt: wichtige Informationen\n\nSie sind umgezogen? Dann müssen Sie sich innerhalb von zwei Wochen anmelden. Vereinbaren Sie bitte zuerst online oder telefonisch einen Termin. Bringen Sie Ihren Reisepass, die Wohnungsgeberbestätigung und das ausgefüllte Anmeldeformular mit. Das Formular finden Sie auf unserer Webseite. Öffnungszeiten: Montag bis Freitag von 8 bis 14 Uhr, donnerstags bis 18 Uhr. Die Anmeldung ist kostenlos.",
    "text_vi":"Bürgeramt: thông tin quan trọng\n\nBạn đã chuyển nhà? Vậy bạn phải đăng ký trong vòng hai tuần. Trước tiên hãy đặt lịch hẹn qua mạng hoặc điện thoại. Mang theo hộ chiếu, giấy xác nhận của chủ nhà và mẫu đăng ký đã điền. Bạn tìm mẫu đơn trên trang web của chúng tôi. Giờ mở cửa: thứ Hai đến thứ Sáu từ 8 đến 14 giờ, thứ Năm đến 18 giờ. Việc đăng ký miễn phí.",
    "questions":[
      {"id":"rq37_01","type":"FILL_BLANK","question_vi":"Phải đăng ký trong thời hạn bao lâu?","answer":"zwei Wochen","accept_also":["innerhalb von zwei Wochen","2 Wochen"]},
      {"id":"rq37_02","type":"MULTIPLE_CHOICE","question_vi":"Thứ Năm cơ quan mở đến mấy giờ?","options":["14 Uhr","16 Uhr","18 Uhr","20 Uhr"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Sie brauchen einen Termin beim Bürgeramt. Schreiben Sie eine kurze E-Mail.","task_vi":"Bạn cần một lịch hẹn ở Bürgeramt. Viết một email ngắn.","min_sentences":4,"example_answer":"Sehr geehrte Damen und Herren,\nich bin nach Bremen umgezogen und möchte mich anmelden.\nIch brauche bitte einen Termin in dieser Woche.\nWelche Unterlagen muss ich mitbringen?\nMit freundlichen Grüßen\nHoa Pham"},
  "audio_content":{
    "listen_words":[
      {"text":"Ich möchte mich anmelden.","meaning":"Tôi muốn đăng ký cư trú."},
      {"text":"Haben Sie alle Unterlagen dabei?","meaning":"Bạn có mang đủ giấy tờ không?"},
      {"text":"Bitte unterschreiben Sie hier.","meaning":"Xin ký vào đây."}
    ],
    "listen_dialogue":"Guten Tag, ich möchte ein Konto eröffnen. — Gern. Haben Sie Ihren Reisepass dabei? — Ja, hier. — Danke. Bitte füllen Sie dieses Formular aus. — Was muss ich hier schreiben? — Hier Ihre Adresse und dort Ihre Unterschrift."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 37 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 38: Einkaufen und Reklamieren ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Einkaufen und Reklamieren","vi":"Mua sắm và khiếu nại"},
  "overview":{"de":"Das Gerät ist kaputt. Ich möchte es umtauschen.","vi":"Cách nói về hàng lỗi, yêu cầu đổi, trả hoặc sửa, nói và viết lịch sự."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Nói về vấn đề"},"content":{"vi":"Das Gerät ist kaputt.\nDer Drucker funktioniert nicht.\nDer Fernseher geht nicht an.\nDie Hose hat ein Loch.\nDie Schuhe passen mir nicht.\n\nThêm thời điểm mua:\nIch habe das letzte Woche bei Ihnen gekauft."},"tags":["#Reklamation","#A2"]},
    {"type":"RULE","title":{"vi":"Nói điều bạn muốn"},"content":{"vi":"Ich möchte das umtauschen. (đổi)\nIch möchte das zurückgeben. (trả lại)\nKann ich mein Geld zurückbekommen?\nKönnen Sie das reparieren?\n\nNgười bán thường hỏi:\nHaben Sie den Kassenbon?\nHaben Sie noch die Rechnung?"},"tags":["#Einkaufen","#Reklamation"]},
    {"type":"EXAMPLE","title":{"vi":"Giữ giấy tờ và quyền của người mua"},"content":{"vi":"Hãy giữ der Kassenbon (hoá đơn bán lẻ) hoặc die Rechnung (hoá đơn).\n\nHàng lỗi: người mua có quyền yêu cầu sửa hoặc đổi.\nHàng không lỗi mua ở cửa hàng: nhiều nơi vẫn cho đổi nhưng không bắt buộc.\nMua trực tuyến trong EU: thường được trả lại trong 14 ngày."},"tags":["#Einkaufen","#Alltag"]}
  ],
  "vocabulary":[
    {"id":"v38_01","german":"umtauschen","meaning":"đổi (hàng)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich möchte die Schuhe umtauschen.","example_vi":"Tôi muốn đổi đôi giày.","speak_de":"Ich möchte die Schuhe umtauschen.","tags":[]},
    {"id":"v38_02","german":"zurückgeben","meaning":"trả lại","gender":null,"color_code":null,"gender_label":null,"example_de":"Kann ich die Jacke zurückgeben?","example_vi":"Tôi có thể trả lại cái áo không?","speak_de":"Kann ich die Jacke zurückgeben?","tags":[]},
    {"id":"v38_03","german":"funktionieren","meaning":"hoạt động","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Gerät funktioniert nicht.","example_vi":"Thiết bị này không hoạt động.","speak_de":"Das Gerät funktioniert nicht.","tags":[]},
    {"id":"v38_04","german":"der Kassenbon","meaning":"hoá đơn bán lẻ","gender":"DER","color_code":null,"gender_label":"der","example_de":"Haben Sie den Kassenbon noch?","example_vi":"Bạn còn giữ hoá đơn không?","speak_de":"Haben Sie den Kassenbon noch?","tags":[]},
    {"id":"v38_05","german":"die Rechnung","meaning":"hoá đơn","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Die Rechnung ist im Anhang.","example_vi":"Hoá đơn nằm trong tệp đính kèm.","speak_de":"Die Rechnung ist im Anhang.","tags":[]},
    {"id":"v38_06","german":"die Garantie","meaning":"bảo hành","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Das Gerät hat zwei Jahre Garantie.","example_vi":"Thiết bị được bảo hành hai năm.","speak_de":"Das Gerät hat zwei Jahre Garantie.","tags":[]}
  ],
  "phrases":[
    {"german":"Das funktioniert leider nicht.","meaning":"Tiếc là cái này không hoạt động.","speak_de":"Das funktioniert leider nicht."},
    {"german":"Ich möchte das umtauschen.","meaning":"Tôi muốn đổi cái này.","speak_de":"Ich möchte das umtauschen."},
    {"german":"Kann ich mein Geld zurückbekommen?","meaning":"Tôi có thể nhận lại tiền không?","speak_de":"Kann ich mein Geld zurückbekommen?"}
  ],
  "examples":[
    {"german":"— Guten Tag, ich habe ein Problem. Dieser Wasserkocher funktioniert nicht.\n— Wann haben Sie ihn gekauft?\n— Letzte Woche. Hier ist der Kassenbon.\n— Möchten Sie ihn umtauschen?\n— Nein, ich möchte lieber mein Geld zurück.\n— Kein Problem.","translation":"— Xin chào, tôi có một vấn đề. Ấm đun nước này không hoạt động.\n— Bạn mua khi nào?\n— Tuần trước. Đây là hoá đơn.\n— Bạn có muốn đổi không?\n— Không, tôi muốn nhận lại tiền hơn.\n— Không vấn đề gì.","note":"lieber = muốn hơn, thích hơn","speak_de":"Ich möchte lieber mein Geld zurück."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg38_01","type":"FILL_BLANK","sentence_de":"Der Drucker ___ nicht.","hint_vi":"không hoạt động","answer":"funktioniert","accept_also":["geht","druckt"]},
      {"id":"tg38_02","type":"MULTIPLE_CHOICE","question_vi":"Trước khi đổi hàng, người bán thường hỏi gì?","options":["Wie alt sind Sie?","Haben Sie den Kassenbon?","Wo wohnen Sie?","Haben Sie Hunger?"],"correct":1},
      {"id":"tg38_03","type":"FILL_BLANK","sentence_de":"Ich möchte die Schuhe ___.","hint_vi":"đổi","answer":"umtauschen","accept_also":["umtauschen"]},
      {"id":"tg38_04","type":"MULTIPLE_CHOICE","question_vi":"Geld zurückbekommen nghĩa là gì?","options":["gửi tiền","vay tiền","trả thêm tiền","nhận lại tiền"],"correct":3},
      {"id":"tg38_05","type":"FILL_BLANK","sentence_de":"Können Sie das Gerät ___?","hint_vi":"sửa","answer":"reparieren","accept_also":["reparieren"]}
    ],
    "practice":[
      {"id":"p38_01","type":"TRANSLATE","from":"vi","sentence":"Cái điện thoại này bị hỏng, tôi muốn trả lại.","answer":"Dieses Handy ist kaputt. Ich möchte es zurückgeben.","accept_also":[]},
      {"id":"p38_02","type":"REORDER","words":["die","Jacke","Ich","Woche","letzte","gekauft.","habe","hier"],"correct_order":["Ich","habe","die","Jacke","letzte","Woche","hier","gekauft."],"translation":"Tôi đã mua cái áo khoác này ở đây tuần trước."},
      {"id":"p38_03","type":"FILL_BLANK","sentence_de":"Das Gerät hat zwei Jahre ___.","hint_vi":"bảo hành","answer":"Garantie","accept_also":["Garantie"]}
    ]
  },
  "reading_passage":{
    "text_de":"Eine Reklamation\n\nSehr geehrte Damen und Herren,\n\nam 3. März habe ich in Ihrem Online-Shop einen Wasserkocher gekauft. Leider funktioniert das Gerät nicht: Das Wasser wird nicht heiß. Ich möchte den Wasserkocher zurückschicken und mein Geld zurückbekommen. Die Rechnung ist im Anhang. Bitte antworten Sie mir bis Ende der Woche.\n\nMit freundlichen Grüßen\nHoa Pham",
    "text_vi":"Một đơn khiếu nại\n\nKính gửi quý ông bà,\n\nNgày 3 tháng 3 tôi đã mua một ấm đun nước trên cửa hàng trực tuyến của quý vị. Tiếc là thiết bị không hoạt động: nước không nóng lên. Tôi muốn gửi trả ấm và nhận lại tiền. Hoá đơn nằm trong tệp đính kèm. Vui lòng trả lời tôi trước cuối tuần.\n\nTrân trọng\nHoa Pham",
    "questions":[
      {"id":"rq38_01","type":"FILL_BLANK","question_vi":"Hoa đã mua sản phẩm gì?","answer":"einen Wasserkocher","accept_also":["Wasserkocher","ein Wasserkocher"]},
      {"id":"rq38_02","type":"MULTIPLE_CHOICE","question_vi":"Hoa muốn gì?","options":["ein neues Gerät","eine Reparatur","ihr Geld zurück","einen Rabatt"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Ihre neuen Kopfhörer sind kaputt. Schreiben Sie eine E-Mail an das Geschäft.","task_vi":"Tai nghe mới của bạn bị hỏng. Viết email cho cửa hàng.","min_sentences":4,"example_answer":"Sehr geehrte Damen und Herren,\nich habe letzte Woche bei Ihnen Kopfhörer gekauft.\nLeider funktionieren sie nicht.\nIch möchte sie umtauschen.\nMit freundlichen Grüßen\nMinh Le"},
  "audio_content":{
    "listen_words":[
      {"text":"Das Gerät funktioniert nicht.","meaning":"Thiết bị này không hoạt động."},
      {"text":"Haben Sie den Kassenbon?","meaning":"Bạn có hoá đơn không?"},
      {"text":"Ich möchte die Hose umtauschen.","meaning":"Tôi muốn đổi cái quần."}
    ],
    "listen_dialogue":"Guten Tag, kann ich Ihnen helfen? — Ja, diese Hose hat ein Loch. — Oh, das tut mir leid. Haben Sie den Kassenbon? — Ja, hier. Kann ich sie umtauschen? — Natürlich. Welche Größe brauchen Sie?"
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 38 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 41: Relativsätze (Nominativ) ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Relativsätze (Nominativ)","vi":"Mệnh đề quan hệ (Nominativ)"},
  "overview":{"de":"Das ist die Frau, die in Berlin wohnt.","vi":"Mệnh đề quan hệ nói thêm về một danh từ, động từ đứng cuối câu."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Mệnh đề quan hệ là gì"},"content":{"vi":"Ghép hai câu thành một:\nDas ist der Mann. Er wohnt neben mir.\n→ Das ist der Mann, der neben mir wohnt.\n\nĐiều cần nhớ:\n1. Có dấu phẩy trước đại từ quan hệ.\n2. Động từ đứng CUỐI mệnh đề."},"tags":["#Relativsatz","#A2"]},
    {"type":"RULE","title":{"vi":"Chọn đại từ quan hệ"},"content":{"vi":"Đại từ lấy giống và số của danh từ đứng trước:\n\nder Mann → der: der Mann, der hier arbeitet\ndie Frau → die: die Frau, die hier arbeitet\ndas Kind → das: das Kind, das hier spielt\ndie Leute → die: die Leute, die hier wohnen\n\nBài này chỉ học Nominativ: đại từ làm chủ ngữ của mệnh đề. Mẹo kiểm tra: thay nó bằng er, sie hoặc es."},"tags":["#Relativsatz","#Nominativ"]},
    {"type":"EXAMPLE","title":{"vi":"Mệnh đề chen giữa câu và động từ tách"},"content":{"vi":"Mệnh đề có thể chen giữa câu, có dấu phẩy hai bên:\nDer Mann, der dort steht, ist mein Lehrer.\n\nĐộng từ tách được nối lại ở cuối:\nDas ist der Zug, der um acht Uhr abfährt."},"tags":["#Relativsatz","#Satzbau"]}
  ],
  "vocabulary":[
    {"id":"v41_01","german":"der Nachbar","meaning":"người hàng xóm","gender":"DER","color_code":null,"gender_label":"der","example_de":"Das ist der Nachbar, der mir oft hilft.","example_vi":"Đây là người hàng xóm hay giúp tôi.","speak_de":"Das ist der Nachbar, der mir oft hilft.","tags":[]},
    {"id":"v41_02","german":"die Kollegin","meaning":"đồng nghiệp nữ","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Ich kenne eine Kollegin, die aus Köln kommt.","example_vi":"Tôi quen một đồng nghiệp đến từ Köln.","speak_de":"Ich kenne eine Kollegin, die aus Köln kommt.","tags":[]},
    {"id":"v41_03","german":"die Abteilung","meaning":"phòng ban","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Sie leitet die Abteilung.","example_vi":"Cô ấy điều hành phòng.","speak_de":"Sie leitet die Abteilung.","tags":[]},
    {"id":"v41_04","german":"kennenlernen","meaning":"làm quen","gender":null,"color_code":null,"gender_label":null,"example_de":"Heute habe ich einen neuen Kollegen kennengelernt.","example_vi":"Hôm nay tôi đã làm quen một đồng nghiệp mới.","speak_de":"Heute habe ich einen neuen Kollegen kennengelernt.","tags":[]},
    {"id":"v41_05","german":"begrüßen","meaning":"chào đón","gender":null,"color_code":null,"gender_label":null,"example_de":"Die Chefin begrüßt die neuen Mitarbeiter.","example_vi":"Bà chủ chào đón các nhân viên mới.","speak_de":"Die Chefin begrüßt die neuen Mitarbeiter.","tags":[]}
  ],
  "phrases":[
    {"german":"Das ist die Frau, die in Berlin wohnt.","meaning":"Đây là người phụ nữ sống ở Berlin.","speak_de":"Das ist die Frau, die in Berlin wohnt."},
    {"german":"Kennst du den Mann, der dort steht?","meaning":"Bạn có biết người đàn ông đang đứng đó không?","speak_de":"Kennst du den Mann, der dort steht?"},
    {"german":"Ich suche jemanden, der mir hilft.","meaning":"Tôi tìm người có thể giúp tôi.","speak_de":"Ich suche jemanden, der mir hilft."}
  ],
  "examples":[
    {"german":"— Wer ist die Frau, die dort sitzt?\n— Das ist Frau Keller. Sie ist die Chefin, die unsere Abteilung leitet.\n— Und der junge Mann?\n— Das ist der Praktikant, der seit Montag hier arbeitet.","translation":"— Người phụ nữ đang ngồi đó là ai?\n— Đó là bà Keller, người điều hành phòng chúng ta.\n— Còn người thanh niên kia?\n— Đó là thực tập sinh làm ở đây từ thứ Hai.","note":"die Frau → die; der Praktikant → der","speak_de":"Das ist die Chefin, die unsere Abteilung leitet."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg41_01","type":"FILL_BLANK","sentence_de":"Das ist die Frau, ___ in Berlin wohnt.","hint_vi":"die Frau, giống cái","answer":"die","accept_also":["die"]},
      {"id":"tg41_02","type":"FILL_BLANK","sentence_de":"Das ist der Kollege, ___ mir immer hilft.","hint_vi":"der Kollege, giống đực","answer":"der","accept_also":["der"]},
      {"id":"tg41_03","type":"FILL_BLANK","sentence_de":"Das ist das Kind, ___ im Garten spielt.","hint_vi":"das Kind, giống trung","answer":"das","accept_also":["das"]},
      {"id":"tg41_04","type":"MULTIPLE_CHOICE","question_vi":"Động từ trong mệnh đề quan hệ đứng ở đâu?","options":["Đầu mệnh đề","Vị trí thứ hai","Cuối mệnh đề","Ngay sau dấu phẩy"],"correct":2},
      {"id":"tg41_05","type":"MULTIPLE_CHOICE","question_vi":"Câu nào đúng?","options":["Ich kenne den Mann, der wohnt hier.","Ich kenne den Mann, der hier wohnt.","Ich kenne den Mann, wohnt der hier.","Ich kenne den Mann, die hier wohnt."],"correct":1}
    ],
    "practice":[
      {"id":"p41_01","type":"TRANSLATE","from":"vi","sentence":"Đây là người bạn sống ở München.","answer":"Das ist der Freund, der in München wohnt.","accept_also":["Das ist die Freundin, die in München wohnt."]},
      {"id":"p41_02","type":"REORDER","words":["die","Kollegin,","Deutsch","spricht.","gut","die","Das","ist"],"correct_order":["Das","ist","die","Kollegin,","die","gut","Deutsch","spricht."],"translation":"Đây là người đồng nghiệp nói tiếng Đức giỏi."},
      {"id":"p41_03","type":"FILL_BLANK","sentence_de":"Die Leute, ___ neben uns wohnen, sind sehr nett.","hint_vi":"die Leute, số nhiều","answer":"die","accept_also":["die"]}
    ]
  },
  "reading_passage":{
    "text_de":"Mein erster Tag\n\nHeute war mein erster Tag in der neuen Firma. Frau Keller, die die Abteilung leitet, hat mich begrüßt. Dann habe ich Herrn Demir kennengelernt, der seit zehn Jahren hier arbeitet. Er hat mir das Büro gezeigt, das im dritten Stock liegt. Mittags habe ich mit Lena gegessen, die auch neu in der Firma ist. Alle Leute, die hier arbeiten, sind sehr freundlich.",
    "text_vi":"Ngày đầu tiên của tôi\n\nHôm nay là ngày đầu tiên của tôi ở công ty mới. Bà Keller, người điều hành phòng, đã chào đón tôi. Sau đó tôi làm quen với ông Demir, người đã làm ở đây mười năm. Ông chỉ cho tôi văn phòng ở tầng ba. Buổi trưa tôi ăn cùng Lena, người cũng mới vào công ty. Tất cả mọi người làm ở đây đều rất thân thiện.",
    "questions":[
      {"id":"rq41_01","type":"FILL_BLANK","question_vi":"Ai điều hành phòng?","answer":"Frau Keller","accept_also":["Keller"]},
      {"id":"rq41_02","type":"MULTIPLE_CHOICE","question_vi":"Văn phòng ở tầng mấy?","options":["im ersten Stock","im zweiten Stock","im dritten Stock","im vierten Stock"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Stellen Sie drei Personen aus Ihrem Leben vor. Benutzen Sie Relativsätze.","task_vi":"Hãy giới thiệu ba người trong cuộc sống của bạn. Dùng mệnh đề quan hệ.","min_sentences":4,"example_answer":"Mein Bruder ist ein Mann, der sehr viel arbeitet.\nMeine Mutter ist eine Frau, die gut kocht.\nLan ist eine Freundin, die mir immer hilft.\nDas sind die Menschen, die für mich wichtig sind."},
  "audio_content":{
    "listen_words":[
      {"text":"Das ist der Mann, der neben mir wohnt.","meaning":"Đây là người đàn ông sống cạnh nhà tôi."},
      {"text":"Kennst du die Frau, die dort sitzt?","meaning":"Bạn có biết người phụ nữ đang ngồi đó không?"},
      {"text":"Das ist das Buch, das mir gefällt.","meaning":"Đây là quyển sách tôi thích."}
    ],
    "listen_dialogue":"Wer ist der Mann, der dort am Fenster steht? — Das ist Herr Demir, der seit zehn Jahren hier arbeitet. — Und die Frau neben ihm? — Das ist Lena, die heute ihren ersten Tag hat."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 41 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 42: Genitiv ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Genitiv","vi":"Cách sở hữu (Genitiv)"},
  "overview":{"de":"Das ist das Auto meines Vaters. Wegen des Regens bleiben wir zu Hause.","vi":"Genitiv cho biết sở hữu và đi sau các giới từ wegen, trotz, während, statt."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Hình thức Genitiv"},"content":{"vi":"Câu hỏi: Wessen? (của ai?)\n\nGiống đực và trung: des, eines, meines + danh từ thêm -(e)s\ndas Auto meines Vaters\ndie Farbe des Hauses\n\nGiống cái và số nhiều: der, einer, meiner\ndie Tasche meiner Mutter\ndie Zimmer der Kinder"},"tags":["#Genitiv","#A2"]},
    {"type":"RULE","title":{"vi":"Tên riêng và cách nói thường ngày"},"content":{"vi":"Tên riêng thêm -s, không có dấu nháy:\nAnnas Buch, Minhs Auto\n\nKhi nói chuyện, người Đức hay dùng von + Dativ:\ndas Auto von meinem Vater\ndie Tasche von meiner Mutter\n\nTrong văn viết và bài thi, nên dùng Genitiv."},"tags":["#Genitiv","#Alltag"]},
    {"type":"EXAMPLE","title":{"vi":"Giới từ đi với Genitiv"},"content":{"vi":"wegen (vì): wegen des Wetters\ntrotz (mặc dù): trotz des Regens\nwährend (trong lúc): während der Arbeit\nstatt (thay vì): statt eines Autos\n\nTrong văn nói có người dùng wegen + Dativ, nhưng khi viết hãy dùng Genitiv."},"tags":["#Genitiv","#Praepositionen"]}
  ],
  "vocabulary":[
    {"id":"v42_01","german":"wegen","meaning":"vì, do","gender":null,"color_code":null,"gender_label":null,"example_de":"Wegen des Staus komme ich später.","example_vi":"Vì tắc đường nên tôi đến muộn.","speak_de":"Wegen des Staus komme ich später.","tags":[]},
    {"id":"v42_02","german":"trotz","meaning":"mặc dù","gender":null,"color_code":null,"gender_label":null,"example_de":"Trotz des Regens gehen wir spazieren.","example_vi":"Mặc dù mưa, chúng tôi vẫn đi dạo.","speak_de":"Trotz des Regens gehen wir spazieren.","tags":[]},
    {"id":"v42_03","german":"während","meaning":"trong lúc","gender":null,"color_code":null,"gender_label":null,"example_de":"Während der Arbeit trinke ich viel Wasser.","example_vi":"Trong lúc làm việc tôi uống nhiều nước.","speak_de":"Während der Arbeit trinke ich viel Wasser.","tags":[]},
    {"id":"v42_04","german":"statt","meaning":"thay vì","gender":null,"color_code":null,"gender_label":null,"example_de":"Statt eines Autos kaufe ich ein Fahrrad.","example_vi":"Thay vì ô tô, tôi mua một chiếc xe đạp.","speak_de":"Statt eines Autos kaufe ich ein Fahrrad.","tags":[]},
    {"id":"v42_05","german":"der Besitzer","meaning":"chủ sở hữu","gender":"DER","color_code":null,"gender_label":"der","example_de":"Der Besitzer des Hauses wohnt in Bonn.","example_vi":"Chủ của ngôi nhà sống ở Bonn.","speak_de":"Der Besitzer des Hauses wohnt in Bonn.","tags":[]}
  ],
  "phrases":[
    {"german":"Das ist das Auto meines Vaters.","meaning":"Đây là xe của bố tôi.","speak_de":"Das ist das Auto meines Vaters."},
    {"german":"Wegen des Wetters bleiben wir zu Hause.","meaning":"Vì thời tiết nên chúng tôi ở nhà.","speak_de":"Wegen des Wetters bleiben wir zu Hause."},
    {"german":"Am Ende der Woche habe ich frei.","meaning":"Cuối tuần tôi được nghỉ.","speak_de":"Am Ende der Woche habe ich frei."}
  ],
  "examples":[
    {"german":"— Wessen Tasche ist das?\n— Das ist die Tasche meiner Kollegin.\n— Warum ist sie noch hier?\n— Wegen des Termins musste sie schnell gehen und hat sie vergessen.","translation":"— Cái túi này của ai?\n— Đây là túi của đồng nghiệp tôi.\n— Sao nó vẫn còn ở đây?\n— Vì có cuộc hẹn nên cô ấy phải đi vội và để quên.","note":"meiner Kollegin (giống cái), wegen des Termins (giống đực, thêm -s)","speak_de":"Das ist die Tasche meiner Kollegin."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg42_01","type":"FILL_BLANK","sentence_de":"Das ist das Auto ___ Vaters. (mein)","hint_vi":"der Vater, giống đực","answer":"meines","accept_also":["meines"]},
      {"id":"tg42_02","type":"FILL_BLANK","sentence_de":"Die Tasche ___ Frau ist neu.","hint_vi":"die Frau, giống cái","answer":"der","accept_also":["der"]},
      {"id":"tg42_03","type":"FILL_BLANK","sentence_de":"Wegen ___ Regens bleiben wir zu Hause.","hint_vi":"der Regen, giống đực","answer":"des","accept_also":["des"]},
      {"id":"tg42_04","type":"MULTIPLE_CHOICE","question_vi":"Cách nào dùng đúng Genitiv?","options":["das Haus meinem Bruder","das Haus mein Bruder","das Haus meinen Bruders","das Haus meines Bruders"],"correct":3},
      {"id":"tg42_05","type":"MULTIPLE_CHOICE","question_vi":"Khi nói chuyện thường ngày, người ta hay thay Genitiv bằng gì?","options":["von + Dativ","für + Akkusativ","mit + Akkusativ","durch + Dativ"],"correct":0}
    ],
    "practice":[
      {"id":"p42_01","type":"TRANSLATE","from":"vi","sentence":"Đây là xe của anh trai tôi.","answer":"Das ist das Auto meines Bruders.","accept_also":["Das ist das Auto von meinem Bruder."]},
      {"id":"p42_02","type":"REORDER","words":["trinke","viel","Während","ich","der","Arbeit","Kaffee."],"correct_order":["Während","der","Arbeit","trinke","ich","viel","Kaffee."],"translation":"Trong lúc làm việc tôi uống nhiều cà phê."},
      {"id":"p42_03","type":"FILL_BLANK","sentence_de":"Trotz ___ Kälte gehen wir spazieren.","hint_vi":"die Kälte, giống cái","answer":"der","accept_also":["der"]}
    ]
  },
  "reading_passage":{
    "text_de":"Das Familienfest\n\nAm Samstag feiert meine Familie den Geburtstag meiner Großmutter. Das Haus meines Onkels ist groß genug für alle Gäste. Wegen des schlechten Wetters können wir leider nicht im Garten essen. Die Kinder meiner Schwester helfen während des Nachmittags in der Küche. Trotz des Regens sind alle gut gelaunt.",
    "text_vi":"Buổi tiệc gia đình\n\nThứ Bảy gia đình tôi mừng sinh nhật bà tôi. Nhà của chú tôi đủ rộng cho tất cả khách. Vì thời tiết xấu nên tiếc là chúng tôi không thể ăn ngoài vườn. Các con của chị tôi phụ giúp trong bếp suốt buổi chiều. Mặc dù trời mưa, mọi người đều rất vui.",
    "questions":[
      {"id":"rq42_01","type":"FILL_BLANK","question_vi":"Mọi người tụ họp ở nhà của ai?","answer":"meines Onkels","accept_also":["Onkel","mein Onkel","bei meinem Onkel","das Haus meines Onkels"]},
      {"id":"rq42_02","type":"MULTIPLE_CHOICE","question_vi":"Vì sao không ăn ngoài vườn?","options":["wegen der Kinder","wegen der Gäste","wegen des Wetters","wegen des Essens"],"correct":2}
    ]
  },
  "writing_prompt":{"task_de":"Beschreiben Sie Ihre Familie. Benutzen Sie den Genitiv und wegen oder trotz.","task_vi":"Hãy miêu tả gia đình bạn. Dùng Genitiv và wegen hoặc trotz.","min_sentences":4,"example_answer":"Das Haus meiner Eltern steht in Da Nang.\nDer Name meiner Schwester ist Hoa.\nWegen der Arbeit sehe ich sie selten.\nTrotz der Entfernung telefonieren wir jede Woche."},
  "audio_content":{
    "listen_words":[
      {"text":"Das ist das Auto meines Vaters.","meaning":"Đây là xe của bố tôi."},
      {"text":"Wegen des Regens bleiben wir zu Hause.","meaning":"Vì trời mưa nên chúng tôi ở nhà."},
      {"text":"Während der Arbeit trinke ich viel Wasser.","meaning":"Trong lúc làm việc tôi uống nhiều nước."}
    ],
    "listen_dialogue":"Wessen Jacke ist das? — Das ist die Jacke meines Bruders. — Warum liegt sie hier? — Wegen des Regens hat er sie im Flur gelassen."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 42 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 43: Kultur und Medien ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Kultur und Medien","vi":"Văn hoá và truyền thông"},
  "overview":{"de":"Ich sehe gern Krimis. Der Film handelt von einer jungen Ärztin.","vi":"Nói về phim, nhạc, sách, tin tức và đưa ra nhận xét đơn giản."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Nói về sở thích"},"content":{"vi":"Ich sehe gern Krimis.\nMein Lieblingsfilm ist ...\nIch höre am liebsten Popmusik.\nIch interessiere mich für Musik.\n\nsich interessieren für + Akkusativ:\nich interessiere mich, du interessierst dich, er interessiert sich."},"tags":["#Kultur","#A2"]},
    {"type":"RULE","title":{"vi":"Kể nội dung và nhận xét"},"content":{"vi":"Der Film handelt von einer jungen Ärztin.\nDas Buch spielt in Berlin.\nIn der Serie geht es um eine Familie.\n\nNhận xét:\nIch finde den Film spannend.\nDas Buch hat mir gut gefallen.\nDie Serie war langweilig.\n\nTừ hay dùng: spannend, lustig, traurig, langweilig, interessant."},"tags":["#Medien","#Meinung"]},
    {"type":"EXAMPLE","title":{"vi":"Tin tức và thói quen dùng truyền thông"},"content":{"vi":"die Nachrichten: tin tức (luôn số nhiều)\nIch lese die Nachrichten im Internet.\nIch sehe abends die Nachrichten im Fernsehen.\n\nChia sẻ thông tin:\nIch habe gelesen, dass ...\nIch habe gehört, dass ..."},"tags":["#Medien","#Alltag"]}
  ],
  "vocabulary":[
    {"id":"v43_01","german":"der Krimi","meaning":"phim, truyện trinh thám","gender":"DER","color_code":null,"gender_label":"der","example_de":"Am Sonntag sehe ich gern einen Krimi.","example_vi":"Chủ nhật tôi thích xem phim trinh thám.","speak_de":"Am Sonntag sehe ich gern einen Krimi.","tags":[]},
    {"id":"v43_02","german":"die Nachrichten","meaning":"tin tức (số nhiều)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich höre die Nachrichten im Radio.","example_vi":"Tôi nghe tin tức trên đài.","speak_de":"Ich höre die Nachrichten im Radio.","tags":[]},
    {"id":"v43_03","german":"die Sendung","meaning":"chương trình (truyền hình)","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Die Sendung beginnt um acht Uhr.","example_vi":"Chương trình bắt đầu lúc tám giờ.","speak_de":"Die Sendung beginnt um acht Uhr.","tags":[]},
    {"id":"v43_04","german":"der Roman","meaning":"tiểu thuyết","gender":"DER","color_code":null,"gender_label":"der","example_de":"Ich lese gerade einen deutschen Roman.","example_vi":"Tôi đang đọc một cuốn tiểu thuyết Đức.","speak_de":"Ich lese gerade einen deutschen Roman.","tags":[]},
    {"id":"v43_05","german":"spannend","meaning":"hồi hộp, hấp dẫn","gender":null,"color_code":null,"gender_label":null,"example_de":"Der Film war sehr spannend.","example_vi":"Bộ phim rất hồi hộp.","speak_de":"Der Film war sehr spannend.","tags":[]},
    {"id":"v43_06","german":"handeln von","meaning":"kể về","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Buch handelt von einer Reise.","example_vi":"Cuốn sách kể về một chuyến đi.","speak_de":"Das Buch handelt von einer Reise.","tags":[]}
  ],
  "phrases":[
    {"german":"Was für Filme siehst du gern?","meaning":"Bạn thích xem loại phim nào?","speak_de":"Was für Filme siehst du gern?"},
    {"german":"Das Buch hat mir sehr gut gefallen.","meaning":"Tôi rất thích cuốn sách này.","speak_de":"Das Buch hat mir sehr gut gefallen."},
    {"german":"Ich habe gelesen, dass das Konzert ausfällt.","meaning":"Tôi đọc được rằng buổi hoà nhạc bị huỷ.","speak_de":"Ich habe gelesen, dass das Konzert ausfällt."}
  ],
  "examples":[
    {"german":"— Hast du den neuen Film schon gesehen?\n— Ja, gestern. Er handelt von einem jungen Koch.\n— Und? Wie findest du ihn?\n— Sehr lustig. Er hat mir gut gefallen.\n— Dann gehe ich am Wochenende ins Kino.","translation":"— Bạn xem phim mới chưa?\n— Rồi, hôm qua. Phim kể về một đầu bếp trẻ.\n— Thế nào? Bạn thấy sao?\n— Rất hài hước. Mình rất thích.\n— Vậy cuối tuần mình đi xem.","note":"handeln von + Dativ","speak_de":"Der Film hat mir gut gefallen."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg43_01","type":"FILL_BLANK","sentence_de":"Ich interessiere mich ___ Musik.","hint_vi":"sich interessieren + giới từ nào?","answer":"für","accept_also":["fuer"]},
      {"id":"tg43_02","type":"FILL_BLANK","sentence_de":"Der Film ___ von einer jungen Ärztin.","hint_vi":"kể về","answer":"handelt","accept_also":["handelt"]},
      {"id":"tg43_03","type":"MULTIPLE_CHOICE","question_vi":"Spannend nghĩa là gì?","options":["buồn ngủ","rẻ","ồn ào","hồi hộp, hấp dẫn"],"correct":3},
      {"id":"tg43_04","type":"MULTIPLE_CHOICE","question_vi":"Câu nào là ý kiến cá nhân?","options":["Der Film dauert zwei Stunden.","Ich finde den Film langweilig.","Das Kino ist in der Stadt.","Der Film beginnt um acht."],"correct":1},
      {"id":"tg43_05","type":"FILL_BLANK","sentence_de":"Das Buch hat mir sehr gut ___.","hint_vi":"Partizip II của gefallen","answer":"gefallen","accept_also":["gefallen"]}
    ],
    "practice":[
      {"id":"p43_01","type":"TRANSLATE","from":"vi","sentence":"Bạn thích xem loại phim nào?","answer":"Was für Filme siehst du gern?","accept_also":["Welche Filme siehst du gern?"]},
      {"id":"p43_02","type":"REORDER","words":["im","Internet.","lese","Morgen","Ich","Nachrichten","die","jeden"],"correct_order":["Ich","lese","die","Nachrichten","jeden","Morgen","im","Internet."],"translation":"Tôi đọc tin tức trên mạng mỗi sáng."},
      {"id":"p43_03","type":"FILL_BLANK","sentence_de":"Welche Musik hörst du am ___?","hint_vi":"So sánh nhất của gern","answer":"liebsten","accept_also":["liebsten"]}
    ]
  },
  "reading_passage":{
    "text_de":"Meine Woche mit Medien\n\nMorgens lese ich die Nachrichten auf dem Handy, weil ich im Bus Zeit habe. Eine gedruckte Zeitung kaufe ich nur noch selten. Abends sehe ich gern Serien, am liebsten Krimis. Am Wochenende gehe ich manchmal mit Freunden ins Kino. Letzten Samstag haben wir einen deutschen Film gesehen. Er war spannend, aber ich habe nicht alles verstanden. Das nächste Mal sehe ich den Film lieber mit Untertiteln.",
    "text_vi":"Một tuần của tôi với truyền thông\n\nBuổi sáng tôi đọc tin trên điện thoại vì trên xe buýt tôi có thời gian. Tôi hiếm khi còn mua báo giấy. Buổi tối tôi thích xem phim bộ, nhất là phim trinh thám. Cuối tuần thỉnh thoảng tôi đi xem phim với bạn bè. Thứ Bảy tuần trước chúng tôi xem một bộ phim Đức. Phim hồi hộp, nhưng tôi không hiểu hết. Lần sau tôi sẽ xem phim có phụ đề.",
    "questions":[
      {"id":"rq43_01","type":"FILL_BLANK","question_vi":"Người viết đọc tin bằng gì?","answer":"auf dem Handy","accept_also":["Handy","mit dem Handy"]},
      {"id":"rq43_02","type":"MULTIPLE_CHOICE","question_vi":"Vấn đề gì xảy ra khi xem phim Đức?","options":["Der Film war zu teuer.","Er hat nicht alles verstanden.","Das Kino war geschlossen.","Der Film war langweilig."],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Erzählen Sie von einem Film, einem Buch oder einer Serie. Worum geht es? Wie finden Sie es?","task_vi":"Kể về một bộ phim, cuốn sách hoặc phim bộ. Nội dung là gì? Bạn thấy thế nào?","min_sentences":4,"example_answer":"Letzte Woche habe ich einen Film gesehen.\nEr handelt von einer Familie in Hamburg.\nIch finde den Film sehr traurig, aber schön.\nDie Musik hat mir am besten gefallen."},
  "audio_content":{
    "listen_words":[
      {"text":"Ich sehe gern Krimis.","meaning":"Tôi thích xem phim trinh thám."},
      {"text":"Der Film handelt von einem Koch.","meaning":"Bộ phim kể về một đầu bếp."},
      {"text":"Ich interessiere mich für Musik.","meaning":"Tôi quan tâm đến âm nhạc."}
    ],
    "listen_dialogue":"Was machst du heute Abend? — Ich sehe eine neue Serie. — Worum geht es? — Um eine Ärztin in Berlin. — Ist sie spannend? — Ja, sehr. Ich habe gestern schon drei Folgen gesehen."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 43 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 44: Umwelt und Natur ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Umwelt und Natur","vi":"Môi trường và thiên nhiên"},
  "overview":{"de":"Wir müssen die Umwelt schützen. Man soll Müll trennen.","vi":"Nói về rác, năng lượng và những việc nhỏ để bảo vệ môi trường."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Từ vựng và động từ chính"},"content":{"vi":"die Umwelt schützen: bảo vệ môi trường\nEnergie sparen: tiết kiệm năng lượng\nWasser sparen: tiết kiệm nước\nMüll trennen: phân loại rác\ndie Luft: không khí\ndas Klima: khí hậu\n\nWir müssen die Umwelt schützen.\nIch fahre mit dem Fahrrad, weil das gut für die Umwelt ist."},"tags":["#Umwelt","#A2"]},
    {"type":"RULE","title":{"vi":"Nói về việc nên làm: man, müssen, sollen"},"content":{"vi":"man = người ta, chia như er:\nMan soll Müll trennen.\nMan kann auch zu Fuß gehen.\n\nmüssen: việc bắt buộc\nWir müssen weniger Plastik benutzen.\n\nsollen: lời khuyên, quy định\nMan soll das Licht ausmachen."},"tags":["#Modalverben","#Umwelt"]},
    {"type":"EXAMPLE","title":{"vi":"Phân loại rác ở Đức"},"content":{"vi":"Ở nhiều nơi tại Đức, rác được chia thành:\ndie blaue Tonne: giấy\ndie gelbe Tonne, der gelbe Sack: bao bì\ndie Biotonne: rác hữu cơ\nder Restmüll: rác còn lại\ndie Glascontainer: thuỷ tinh\n\ndas Pfand: tiền cọc cho nhiều loại chai và lon, trả lại chai thì nhận lại tiền.\nMàu thùng có thể khác nhau tuỳ thành phố."},"tags":["#Umwelt","#Alltag"]}
  ],
  "vocabulary":[
    {"id":"v44_01","german":"die Umwelt","meaning":"môi trường","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Die Umwelt ist wichtig für uns alle.","example_vi":"Môi trường quan trọng với tất cả chúng ta.","speak_de":"Die Umwelt ist wichtig für uns alle.","tags":[]},
    {"id":"v44_02","german":"schützen","meaning":"bảo vệ","gender":null,"color_code":null,"gender_label":null,"example_de":"Wir müssen die Natur schützen.","example_vi":"Chúng ta phải bảo vệ thiên nhiên.","speak_de":"Wir müssen die Natur schützen.","tags":[]},
    {"id":"v44_03","german":"sparen","meaning":"tiết kiệm","gender":null,"color_code":null,"gender_label":null,"example_de":"So kann man viel Energie sparen.","example_vi":"Như vậy có thể tiết kiệm nhiều năng lượng.","speak_de":"So kann man viel Energie sparen.","tags":[]},
    {"id":"v44_04","german":"trennen","meaning":"phân loại, tách","gender":null,"color_code":null,"gender_label":null,"example_de":"Wir trennen den Müll.","example_vi":"Chúng tôi phân loại rác.","speak_de":"Wir trennen den Müll.","tags":[]},
    {"id":"v44_05","german":"der Müll","meaning":"rác","gender":"DER","color_code":null,"gender_label":"der","example_de":"Bring bitte den Müll raus.","example_vi":"Làm ơn đem rác ra ngoài.","speak_de":"Bring bitte den Müll raus.","tags":[]},
    {"id":"v44_06","german":"der Strom","meaning":"điện","gender":"DER","color_code":null,"gender_label":"der","example_de":"Diese Lampe braucht wenig Strom.","example_vi":"Cái đèn này dùng ít điện.","speak_de":"Diese Lampe braucht wenig Strom.","tags":[]}
  ],
  "phrases":[
    {"german":"Wir müssen die Umwelt schützen.","meaning":"Chúng ta phải bảo vệ môi trường.","speak_de":"Wir müssen die Umwelt schützen."},
    {"german":"Mach bitte das Licht aus.","meaning":"Làm ơn tắt đèn.","speak_de":"Mach bitte das Licht aus."},
    {"german":"Das ist gut für die Umwelt.","meaning":"Điều này tốt cho môi trường.","speak_de":"Das ist gut für die Umwelt."}
  ],
  "examples":[
    {"german":"— Wohin kommt diese Flasche?\n— Die kannst du zurückbringen. Da gibt es Pfand.\n— Und das Papier?\n— In die blaue Tonne.\n— Du trennst den Müll aber genau!\n— Natürlich. Man muss die Umwelt schützen.","translation":"— Cái chai này bỏ vào đâu?\n— Bạn có thể đem trả lại. Có tiền cọc đấy.\n— Còn giấy?\n— Bỏ vào thùng xanh.\n— Bạn phân loại rác kỹ thật!\n— Tất nhiên. Phải bảo vệ môi trường chứ.","note":"Wohin kommt ...? hỏi chỗ để đồ","speak_de":"Wir trennen den Müll."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg44_01","type":"FILL_BLANK","sentence_de":"Wir müssen die Umwelt ___.","hint_vi":"bảo vệ","answer":"schützen","accept_also":["schuetzen"]},
      {"id":"tg44_02","type":"FILL_BLANK","sentence_de":"Man soll den Müll ___.","hint_vi":"phân loại","answer":"trennen","accept_also":["trennen"]},
      {"id":"tg44_03","type":"MULTIPLE_CHOICE","question_vi":"Ở nhiều thành phố Đức, giấy thường bỏ vào đâu?","options":["die gelbe Tonne","die blaue Tonne","die Biotonne","der Restmüll"],"correct":1},
      {"id":"tg44_04","type":"MULTIPLE_CHOICE","question_vi":"Pfand là gì?","options":["thuế rác","vé xe","tiền cọc chai, lon","tiền điện"],"correct":2},
      {"id":"tg44_05","type":"FILL_BLANK","sentence_de":"Wir fahren mit dem Fahrrad, ___ das besser für die Umwelt ist.","hint_vi":"vì (động từ cuối câu)","answer":"weil","accept_also":["weil"]}
    ],
    "practice":[
      {"id":"p44_01","type":"TRANSLATE","from":"vi","sentence":"Chúng ta phải tiết kiệm nước.","answer":"Wir müssen Wasser sparen.","accept_also":[]},
      {"id":"p44_02","type":"REORDER","words":["Arbeit.","zur","dem","Viele","Fahrrad","mit","heute","Menschen","fahren"],"correct_order":["Viele","Menschen","fahren","heute","mit","dem","Fahrrad","zur","Arbeit."],"translation":"Ngày nay nhiều người đi làm bằng xe đạp."},
      {"id":"p44_03","type":"FILL_BLANK","sentence_de":"Mach bitte das Licht ___, wenn du gehst.","hint_vi":"ausmachen: tiền tố tách ra","answer":"aus","accept_also":["aus"]}
    ]
  },
  "reading_passage":{
    "text_de":"Familie Schulz spart Energie\n\nFamilie Schulz möchte weniger Energie verbrauchen. Deshalb hat sie neue Lampen gekauft, die wenig Strom brauchen. Die Kinder gehen zu Fuß zur Schule, und Herr Schulz fährt mit dem Fahrrad zur Arbeit. Das Auto bleibt oft in der Garage. Im Winter heizen sie nicht alle Zimmer. Den Müll trennt die Familie genau: Papier, Glas und Plastik kommen in verschiedene Tonnen. So spart sie jeden Monat Geld und schützt die Umwelt.",
    "text_vi":"Gia đình Schulz tiết kiệm năng lượng\n\nGia đình Schulz muốn dùng ít năng lượng hơn. Vì vậy họ đã mua đèn mới ít tốn điện. Bọn trẻ đi bộ đến trường, còn ông Schulz đi làm bằng xe đạp. Ô tô thường để trong ga ra. Mùa đông họ không sưởi tất cả các phòng. Gia đình phân loại rác kỹ: giấy, thuỷ tinh và nhựa vào các thùng khác nhau. Nhờ vậy mỗi tháng họ tiết kiệm được tiền và bảo vệ môi trường.",
    "questions":[
      {"id":"rq44_01","type":"FILL_BLANK","question_vi":"Ông Schulz đi làm bằng gì?","answer":"mit dem Fahrrad","accept_also":["Fahrrad","das Fahrrad"]},
      {"id":"rq44_02","type":"MULTIPLE_CHOICE","question_vi":"Gia đình đã mua gì mới?","options":["ein neues Auto","eine Heizung","eine Tonne","neue Lampen"],"correct":3}
    ]
  },
  "writing_prompt":{"task_de":"Was tun Sie für die Umwelt? Was möchten Sie noch ändern?","task_vi":"Bạn làm gì cho môi trường? Bạn còn muốn thay đổi điều gì?","min_sentences":4,"example_answer":"Ich fahre oft mit dem Bus.\nIch trenne den Müll zu Hause.\nAußerdem kaufe ich wenig Plastik.\nIch möchte noch mehr Energie sparen."},
  "audio_content":{
    "listen_words":[
      {"text":"Wir müssen die Umwelt schützen.","meaning":"Chúng ta phải bảo vệ môi trường."},
      {"text":"Man soll den Müll trennen.","meaning":"Nên phân loại rác."},
      {"text":"Diese Lampe braucht wenig Strom.","meaning":"Cái đèn này dùng ít điện."}
    ],
    "listen_dialogue":"Warum fährst du jetzt mit dem Fahrrad? — Das ist gut für die Umwelt und ich spare Geld. — Ist das nicht anstrengend? — Am Anfang schon, aber jetzt macht es mir Spaß."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 44 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 45: Gesundheit und Sport ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Gesundheit und Sport","vi":"Sức khoẻ và thể thao"},
  "overview":{"de":"Ich treibe zweimal pro Woche Sport. Du solltest mehr schlafen.","vi":"Nói về thói quen sống khoẻ, động từ phản thân và cách đưa lời khuyên."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Nói về thói quen"},"content":{"vi":"Ich treibe zweimal pro Woche Sport.\nIch gehe jeden Tag spazieren.\nIch ernähre mich gesund.\nIch schlafe acht Stunden.\n\nTần suất:\neinmal, zweimal, dreimal pro Woche\njeden Tag, oft, manchmal, selten, nie"},"tags":["#Gesundheit","#A2"]},
    {"type":"RULE","title":{"vi":"Động từ phản thân"},"content":{"vi":"sich fühlen (cảm thấy):\nich fühle mich, du fühlst dich, er fühlt sich,\nwir fühlen uns, ihr fühlt euch, sie fühlen sich\n\nTương tự:\nsich bewegen: vận động\nsich ernähren: ăn uống\nsich ausruhen: nghỉ ngơi\n\nIch fühle mich heute nicht gut.\nEr ruht sich am Wochenende aus."},"tags":["#Reflexiv","#Grammatik"]},
    {"type":"EXAMPLE","title":{"vi":"Đưa lời khuyên và nói về triệu chứng"},"content":{"vi":"Lời khuyên với sollte:\nDu solltest mehr schlafen.\nSie sollten sich mehr bewegen.\n\nỞ phòng khám:\nIch habe Kopfschmerzen.\nIch habe seit gestern Rückenschmerzen.\nBác sĩ hỏi: Seit wann haben Sie die Schmerzen?\n\nNếu đau kéo dài, hãy đi khám bác sĩ."},"tags":["#Gesundheit","#Beim_Arzt"]}
  ],
  "vocabulary":[
    {"id":"v45_01","german":"Sport treiben","meaning":"chơi thể thao","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich treibe am Wochenende Sport.","example_vi":"Cuối tuần tôi chơi thể thao.","speak_de":"Ich treibe am Wochenende Sport.","tags":[]},
    {"id":"v45_02","german":"sich ernähren","meaning":"ăn uống, dinh dưỡng","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich ernähre mich gesund.","example_vi":"Tôi ăn uống lành mạnh.","speak_de":"Ich ernähre mich gesund.","tags":[]},
    {"id":"v45_03","german":"sich bewegen","meaning":"vận động","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie sollten sich mehr bewegen.","example_vi":"Bạn nên vận động nhiều hơn.","speak_de":"Sie sollten sich mehr bewegen.","tags":[]},
    {"id":"v45_04","german":"sich ausruhen","meaning":"nghỉ ngơi","gender":null,"color_code":null,"gender_label":null,"example_de":"Heute ruhe ich mich aus.","example_vi":"Hôm nay tôi nghỉ ngơi.","speak_de":"Heute ruhe ich mich aus.","tags":[]},
    {"id":"v45_05","german":"die Schmerzen","meaning":"cơn đau (số nhiều)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich habe starke Schmerzen.","example_vi":"Tôi bị đau nhiều.","speak_de":"Ich habe starke Schmerzen.","tags":[]},
    {"id":"v45_06","german":"gesund","meaning":"khoẻ mạnh, lành mạnh","gender":null,"color_code":null,"gender_label":null,"example_de":"Gemüse ist gesund.","example_vi":"Rau tốt cho sức khoẻ.","speak_de":"Gemüse ist gesund.","tags":[]}
  ],
  "phrases":[
    {"german":"Wie fühlst du dich heute?","meaning":"Hôm nay bạn thấy thế nào?","speak_de":"Wie fühlst du dich heute?"},
    {"german":"Du solltest mehr Wasser trinken.","meaning":"Bạn nên uống nhiều nước hơn.","speak_de":"Du solltest mehr Wasser trinken."},
    {"german":"Gute Besserung!","meaning":"Chúc bạn mau khoẻ!","speak_de":"Gute Besserung!"}
  ],
  "examples":[
    {"german":"— Du siehst müde aus. Wie fühlst du dich?\n— Nicht so gut. Ich habe seit Tagen Rückenschmerzen.\n— Du solltest zum Arzt gehen.\n— Ja, das stimmt. Ich sitze zu viel.\n— Dann beweg dich mehr! Gute Besserung!","translation":"— Trông bạn mệt. Bạn thấy thế nào?\n— Không khoẻ lắm. Mấy hôm nay mình bị đau lưng.\n— Bạn nên đi khám.\n— Ừ, đúng thế. Mình ngồi nhiều quá.\n— Vậy thì vận động nhiều lên! Chúc bạn mau khoẻ!","note":"Du solltest ... = bạn nên ...","speak_de":"Du solltest zum Arzt gehen."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg45_01","type":"FILL_BLANK","sentence_de":"Ich treibe ___ pro Woche Sport.","hint_vi":"hai lần","answer":"zweimal","accept_also":["2-mal","2 mal"]},
      {"id":"tg45_02","type":"FILL_BLANK","sentence_de":"Ich fühle ___ heute nicht gut.","hint_vi":"Đại từ phản thân, ngôi ich","answer":"mich","accept_also":["mich"]},
      {"id":"tg45_03","type":"FILL_BLANK","sentence_de":"Du ___ mehr Wasser trinken.","hint_vi":"nên (lời khuyên), ngôi du","answer":"solltest","accept_also":["solltest"]},
      {"id":"tg45_04","type":"MULTIPLE_CHOICE","question_vi":"Sich ernähren nghĩa là gì?","options":["tập gym","ăn uống, dinh dưỡng","tắm","nghỉ ngơi"],"correct":1},
      {"id":"tg45_05","type":"MULTIPLE_CHOICE","question_vi":"Seit wann haben Sie die Schmerzen? hỏi điều gì?","options":["Đau ở đâu","Đau thế nào","Đau từ khi nào","Ai bị đau"],"correct":2}
    ],
    "practice":[
      {"id":"p45_01","type":"TRANSLATE","from":"vi","sentence":"Tôi đau lưng từ hôm qua.","answer":"Ich habe seit gestern Rückenschmerzen.","accept_also":[]},
      {"id":"p45_02","type":"REORDER","words":["oft","gehe","Am","Wochenende","im","Park","ich","joggen."],"correct_order":["Am","Wochenende","gehe","ich","oft","im","Park","joggen."],"translation":"Cuối tuần tôi hay chạy bộ trong công viên."},
      {"id":"p45_03","type":"FILL_BLANK","sentence_de":"Er ruht ___ am Wochenende aus.","hint_vi":"Đại từ phản thân, ngôi er","answer":"sich","accept_also":["sich"]}
    ]
  },
  "reading_passage":{
    "text_de":"Ein gesünderes Leben\n\nSeit einem Jahr lebt Herr Lam gesünder. Früher hat er viel am Computer gesessen und hatte oft Rückenschmerzen. Sein Arzt hat gesagt: \"Sie sollten sich mehr bewegen.\" Jetzt geht er dreimal pro Woche schwimmen und fährt mit dem Fahrrad zur Arbeit. Er isst mehr Gemüse und trinkt weniger Cola. Er fühlt sich viel besser und schläft auch besser.",
    "text_vi":"Một cuộc sống khoẻ mạnh hơn\n\nMột năm nay ông Lam sống lành mạnh hơn. Trước đây ông ngồi máy tính nhiều và hay đau lưng. Bác sĩ của ông nói: \"Ông nên vận động nhiều hơn.\" Giờ ông đi bơi ba lần một tuần và đi làm bằng xe đạp. Ông ăn nhiều rau hơn và uống ít nước ngọt hơn. Ông thấy khoẻ hơn nhiều và cũng ngủ ngon hơn.",
    "questions":[
      {"id":"rq45_01","type":"FILL_BLANK","question_vi":"Ông Lam đi bơi mấy lần một tuần?","answer":"dreimal","accept_also":["dreimal pro Woche","3 mal","3-mal"]},
      {"id":"rq45_02","type":"MULTIPLE_CHOICE","question_vi":"Trước đây ông Lam có vấn đề gì?","options":["Rückenschmerzen","Zahnschmerzen","Fieber","Husten"],"correct":0}
    ]
  },
  "writing_prompt":{"task_de":"Was machen Sie für Ihre Gesundheit? Geben Sie einem Freund auch einen Rat.","task_vi":"Bạn làm gì cho sức khoẻ? Hãy đưa ra một lời khuyên cho bạn của bạn.","min_sentences":4,"example_answer":"Ich gehe zweimal pro Woche schwimmen.\nIch ernähre mich gesund und esse viel Gemüse.\nAm Wochenende ruhe ich mich aus.\nDu solltest auch mehr Sport treiben."},
  "audio_content":{
    "listen_words":[
      {"text":"Ich treibe zweimal pro Woche Sport.","meaning":"Tôi chơi thể thao hai lần một tuần."},
      {"text":"Wie fühlst du dich heute?","meaning":"Hôm nay bạn thấy thế nào?"},
      {"text":"Du solltest mehr schlafen.","meaning":"Bạn nên ngủ nhiều hơn."}
    ],
    "listen_dialogue":"Guten Tag, was fehlt Ihnen? — Ich habe seit drei Tagen Kopfschmerzen. — Schlafen Sie genug? — Nein, nur fünf Stunden. — Sie sollten mehr schlafen und mehr Wasser trinken."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 45 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 46: Schule und Bildung ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Schule und Bildung","vi":"Trường học và giáo dục"},
  "overview":{"de":"Nach der Grundschule geht sie aufs Gymnasium. Nach dem Abitur studiere ich.","vi":"Hệ thống giáo dục ở Đức, cách nói về học tập, thi cử, và Präteritum của động từ khuyết thiếu."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Hệ thống trường học ở Đức"},"content":{"vi":"die Grundschule: tiểu học, thường bốn năm.\nSau đó tuỳ bang có thể là:\ndie Hauptschule, die Realschule, das Gymnasium, die Gesamtschule.\n\ndas Abitur: bằng tốt nghiệp của Gymnasium, thường dùng để vào đại học.\ndie Ausbildung: đào tạo nghề, thường vừa làm ở công ty vừa học ở die Berufsschule.\n\nMỗi bang có quy định riêng."},"tags":["#Schule","#A2"]},
    {"type":"RULE","title":{"vi":"lernen, studieren, bestehen"},"content":{"vi":"lernen: học (bài, ngôn ngữ, một việc)\nIch lerne Deutsch.\n\nstudieren: học đại học\nIch studiere Informatik an der Universität.\n\neine Prüfung machen: dự thi\neine Prüfung bestehen: đỗ\ndurch eine Prüfung fallen: trượt\n\neine Ausbildung machen:\nIch mache eine Ausbildung als Koch."},"tags":["#Bildung","#Verben"]},
    {"type":"EXAMPLE","title":{"vi":"Kể chuyện đã qua: musste, konnte, wollte"},"content":{"vi":"Động từ khuyết thiếu kể chuyện đã qua thường dùng Präteritum:\nmüssen → ich musste\nkönnen → ich konnte\nwollen → ich wollte\ndürfen → ich durfte\n\nCác ngôi: ich musste, du musstest, er musste, wir mussten.\n\nFrüher musste ich jeden Tag lernen.\nAls Kind konnte ich nicht schwimmen."},"tags":["#Praeteritum","#Modalverben"]}
  ],
  "vocabulary":[
    {"id":"v46_01","german":"die Grundschule","meaning":"trường tiểu học","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Mein Sohn geht in die Grundschule.","example_vi":"Con trai tôi học tiểu học.","speak_de":"Mein Sohn geht in die Grundschule.","tags":[]},
    {"id":"v46_02","german":"das Abitur","meaning":"bằng tốt nghiệp phổ thông","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Mit dem Abitur kann man studieren.","example_vi":"Có Abitur thì có thể học đại học.","speak_de":"Mit dem Abitur kann man studieren.","tags":[]},
    {"id":"v46_03","german":"die Ausbildung","meaning":"đào tạo nghề","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Sie macht eine Ausbildung im Hotel.","example_vi":"Cô ấy học nghề ở khách sạn.","speak_de":"Sie macht eine Ausbildung im Hotel.","tags":[]},
    {"id":"v46_04","german":"studieren","meaning":"học đại học","gender":null,"color_code":null,"gender_label":null,"example_de":"Mein Bruder studiert in Dresden.","example_vi":"Anh trai tôi học đại học ở Dresden.","speak_de":"Mein Bruder studiert in Dresden.","tags":[]},
    {"id":"v46_05","german":"bestehen","meaning":"đỗ (kỳ thi)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich habe die Prüfung bestanden.","example_vi":"Tôi đã đỗ kỳ thi.","speak_de":"Ich habe die Prüfung bestanden.","tags":[]},
    {"id":"v46_06","german":"das Fach","meaning":"môn học","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Mein Lieblingsfach ist Mathematik.","example_vi":"Môn học yêu thích của tôi là toán.","speak_de":"Mein Lieblingsfach ist Mathematik.","tags":[]}
  ],
  "phrases":[
    {"german":"Was möchtest du nach der Schule machen?","meaning":"Sau khi học xong bạn muốn làm gì?","speak_de":"Was möchtest du nach der Schule machen?"},
    {"german":"Ich habe die Prüfung bestanden.","meaning":"Tôi đã đỗ kỳ thi.","speak_de":"Ich habe die Prüfung bestanden."},
    {"german":"Ich mache eine Ausbildung als Koch.","meaning":"Tôi đang học nghề đầu bếp.","speak_de":"Ich mache eine Ausbildung als Koch."}
  ],
  "examples":[
    {"german":"— Was machst du nach dem Abitur?\n— Ich möchte eine Ausbildung machen.\n— Wolltest du nicht studieren?\n— Doch, früher wollte ich Medizin studieren. Aber jetzt möchte ich lieber schnell arbeiten.","translation":"— Sau Abitur bạn làm gì?\n— Mình muốn học nghề.\n— Không phải bạn muốn học đại học sao?\n— Có chứ, trước đây mình muốn học y. Nhưng giờ mình muốn đi làm sớm hơn.","note":"wollte = đã muốn (Präteritum của wollen)","speak_de":"Früher wollte ich Medizin studieren."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg46_01","type":"FILL_BLANK","sentence_de":"Mit dem ___ kann man an der Universität studieren.","hint_vi":"bằng tốt nghiệp phổ thông","answer":"Abitur","accept_also":["Abitur"]},
      {"id":"tg46_02","type":"MULTIPLE_CHOICE","question_vi":"Ausbildung nghĩa là gì?","options":["mẫu giáo","đào tạo nghề","kỳ nghỉ","tiền lương"],"correct":1},
      {"id":"tg46_03","type":"FILL_BLANK","sentence_de":"Ich habe die Prüfung ___.","hint_vi":"đỗ (Partizip II của bestehen)","answer":"bestanden","accept_also":["bestanden"]},
      {"id":"tg46_04","type":"FILL_BLANK","sentence_de":"Früher ___ ich jeden Tag zur Schule laufen.","hint_vi":"müssen, Präteritum, ngôi ich","answer":"musste","accept_also":["musste"]},
      {"id":"tg46_05","type":"MULTIPLE_CHOICE","question_vi":"\"Tôi học đại học ngành Luật\" nói thế nào?","options":["Ich studiere Jura.","Ich gehe Jura.","Ich lerne Jura zu Universität.","Ich mache Jura lernen."],"correct":0}
    ],
    "practice":[
      {"id":"p46_01","type":"TRANSLATE","from":"vi","sentence":"Tôi muốn học nghề điều dưỡng.","answer":"Ich möchte eine Ausbildung zur Pflegefachkraft machen.","accept_also":["Ich möchte eine Ausbildung als Krankenpfleger machen."]},
      {"id":"p46_02","type":"REORDER","words":["ich","Abitur","möchte","in","Nach","Deutschland","dem","studieren."],"correct_order":["Nach","dem","Abitur","möchte","ich","in","Deutschland","studieren."],"translation":"Sau Abitur tôi muốn học đại học ở Đức."},
      {"id":"p46_03","type":"FILL_BLANK","sentence_de":"Als Kind ___ ich nicht schwimmen.","hint_vi":"können, Präteritum, ngôi ich","answer":"konnte","accept_also":["konnte"]}
    ]
  },
  "reading_passage":{
    "text_de":"Phuongs Weg\n\nPhuong kommt aus Vietnam und lebt seit drei Jahren in Stuttgart. In Vietnam hat sie die Schule abgeschlossen. In Deutschland wollte sie zuerst studieren, aber ihr Deutsch war noch nicht gut genug. Deshalb hat sie einen Sprachkurs besucht. Jetzt macht sie eine Ausbildung als Hotelfachfrau. Drei Tage pro Woche arbeitet sie im Hotel, zwei Tage geht sie in die Berufsschule. Sie lernt viel und ist sehr zufrieden.",
    "text_vi":"Con đường của Phương\n\nPhương đến từ Việt Nam và sống ở Stuttgart đã ba năm. Ở Việt Nam cô đã học xong phổ thông. Ở Đức, ban đầu cô muốn học đại học, nhưng tiếng Đức của cô chưa đủ tốt. Vì vậy cô đã học một khoá tiếng. Hiện cô đang học nghề nhân viên khách sạn. Ba ngày một tuần cô làm ở khách sạn, hai ngày đi học ở trường nghề. Cô học được nhiều và rất hài lòng.",
    "questions":[
      {"id":"rq46_01","type":"FILL_BLANK","question_vi":"Hai ngày một tuần Phương đi đâu?","answer":"in die Berufsschule","accept_also":["Berufsschule","zur Berufsschule","die Berufsschule"]},
      {"id":"rq46_02","type":"MULTIPLE_CHOICE","question_vi":"Vì sao lúc đầu Phương chưa học đại học được?","options":["Sie hatte kein Geld.","Ihr Deutsch war nicht gut genug.","Sie hatte keine Zeit.","Sie wollte nicht studieren."],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Erzählen Sie von Ihrer Schulzeit. Was mussten oder konnten Sie machen? Was möchten Sie noch lernen?","task_vi":"Kể về thời đi học của bạn. Bạn đã phải hoặc đã có thể làm gì? Bạn còn muốn học gì nữa?","min_sentences":4,"example_answer":"Ich bin in Can Tho zur Schule gegangen.\nIch musste jeden Tag früh aufstehen.\nMein Lieblingsfach war Englisch.\nJetzt möchte ich gut Deutsch lernen."},
  "audio_content":{
    "listen_words":[
      {"text":"Ich habe die Prüfung bestanden.","meaning":"Tôi đã đỗ kỳ thi."},
      {"text":"Sie macht eine Ausbildung als Hotelfachfrau.","meaning":"Cô ấy học nghề nhân viên khách sạn."},
      {"text":"Früher musste ich viel lernen.","meaning":"Trước đây tôi phải học nhiều."}
    ],
    "listen_dialogue":"Herzlichen Glückwunsch! Du hast die Prüfung bestanden! — Danke! Ich konnte es erst nicht glauben. — Was machst du jetzt? — Ich beginne im September eine Ausbildung."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 46 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 47: Beruf und Bewerbung ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Beruf und Bewerbung","vi":"Nghề nghiệp và xin việc"},
  "overview":{"de":"Ich bewerbe mich um die Stelle als Koch. Ich habe drei Jahre Erfahrung.","vi":"Sơ yếu lý lịch, thư xin việc ngắn và các câu cho buổi phỏng vấn."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Sơ yếu lý lịch (der Lebenslauf)"},"content":{"vi":"Các mục thường có:\nPersönliche Daten: thông tin cá nhân\nBerufserfahrung: kinh nghiệm làm việc\nAusbildung: học vấn, đào tạo\nSprachkenntnisse: ngoại ngữ\n\nViết theo thứ tự thời gian ngược: việc mới nhất ở trên cùng.\nVí dụ: seit 2024 Koch im Restaurant Lotus, Bremen."},"tags":["#Lebenslauf","#A2"]},
    {"type":"RULE","title":{"vi":"Thư xin việc ngắn (das Anschreiben)"},"content":{"vi":"Mở đầu: Sehr geehrte Frau Weber,\n\nNội dung:\nich bewerbe mich um die Stelle als Koch.\nIch habe drei Jahre Erfahrung in der Küche.\nIch arbeite gern im Team.\n\nKết thúc:\nIch freue mich auf eine Einladung zum Vorstellungsgespräch.\nMit freundlichen Grüßen\n\nGhi nhớ: sich bewerben um + Akkusativ, bei + Dativ (nơi nộp)."},"tags":["#Bewerbung","#Schreiben"]},
    {"type":"EXAMPLE","title":{"vi":"Câu cho buổi phỏng vấn"},"content":{"vi":"Câu hỏi hay gặp:\nErzählen Sie etwas über sich.\nWarum möchten Sie bei uns arbeiten?\nWelche Erfahrung haben Sie?\n\nTrả lời:\nIch arbeite seit zwei Jahren als Krankenpfleger.\nIch habe drei Jahre in einem Hotel gearbeitet.\nMeine Stärke ist, dass ich sehr zuverlässig bin."},"tags":["#Vorstellungsgespraech","#Sprechen"]}
  ],
  "vocabulary":[
    {"id":"v47_01","german":"die Stelle","meaning":"vị trí công việc","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Ich suche eine Stelle als Koch.","example_vi":"Tôi tìm một vị trí đầu bếp.","speak_de":"Ich suche eine Stelle als Koch.","tags":[]},
    {"id":"v47_02","german":"sich bewerben","meaning":"ứng tuyển","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bewerbe mich bei einem Hotel.","example_vi":"Tôi ứng tuyển vào một khách sạn.","speak_de":"Ich bewerbe mich bei einem Hotel.","tags":[]},
    {"id":"v47_03","german":"der Lebenslauf","meaning":"sơ yếu lý lịch","gender":"DER","color_code":null,"gender_label":"der","example_de":"Ich schicke Ihnen meinen Lebenslauf.","example_vi":"Tôi gửi cho bạn sơ yếu lý lịch của tôi.","speak_de":"Ich schicke Ihnen meinen Lebenslauf.","tags":[]},
    {"id":"v47_04","german":"die Erfahrung","meaning":"kinh nghiệm","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Ich habe viel Erfahrung im Service.","example_vi":"Tôi có nhiều kinh nghiệm phục vụ.","speak_de":"Ich habe viel Erfahrung im Service.","tags":[]},
    {"id":"v47_05","german":"das Vorstellungsgespräch","meaning":"buổi phỏng vấn","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Morgen habe ich ein Vorstellungsgespräch.","example_vi":"Ngày mai tôi có buổi phỏng vấn.","speak_de":"Morgen habe ich ein Vorstellungsgespräch.","tags":[]},
    {"id":"v47_06","german":"das Gehalt","meaning":"lương","gender":"DAS","color_code":null,"gender_label":"das","example_de":"Das Gehalt ist gut.","example_vi":"Lương tốt.","speak_de":"Das Gehalt ist gut.","tags":[]}
  ],
  "phrases":[
    {"german":"Ich bewerbe mich um die Stelle als Koch.","meaning":"Tôi ứng tuyển vị trí đầu bếp.","speak_de":"Ich bewerbe mich um die Stelle als Koch."},
    {"german":"Ich arbeite gern im Team.","meaning":"Tôi thích làm việc nhóm.","speak_de":"Ich arbeite gern im Team."},
    {"german":"Mit freundlichen Grüßen","meaning":"Trân trọng (kết thư)","speak_de":"Mit freundlichen Grüßen"}
  ],
  "examples":[
    {"german":"— Guten Tag, Frau Tran. Erzählen Sie bitte etwas über sich.\n— Gern. Ich komme aus Vietnam und arbeite seit zwei Jahren als Köchin.\n— Warum möchten Sie bei uns arbeiten?\n— Ihr Restaurant gefällt mir, und ich möchte mehr lernen.\n— Wann können Sie anfangen?\n— Ab dem 1. Juli.","translation":"— Chào chị Tran. Chị hãy giới thiệu về mình.\n— Vâng. Tôi đến từ Việt Nam và làm đầu bếp đã hai năm.\n— Vì sao chị muốn làm ở chỗ chúng tôi?\n— Tôi thích nhà hàng của anh và tôi muốn học hỏi thêm.\n— Khi nào chị có thể bắt đầu?\n— Từ ngày 1 tháng 7.","note":"seit + thì hiện tại: việc đang tiếp diễn","speak_de":"Ich arbeite seit zwei Jahren als Köchin."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg47_01","type":"FILL_BLANK","sentence_de":"Ich bewerbe mich ___ die Stelle als Koch.","hint_vi":"sich bewerben + giới từ nào?","answer":"um","accept_also":["um"]},
      {"id":"tg47_02","type":"FILL_BLANK","sentence_de":"Ich arbeite ___ zwei Jahren als Krankenpfleger.","hint_vi":"từ (một mốc đến nay)","answer":"seit","accept_also":["seit"]},
      {"id":"tg47_03","type":"MULTIPLE_CHOICE","question_vi":"Lebenslauf nghĩa là gì?","options":["thư xin việc","hợp đồng","sơ yếu lý lịch","bảng lương"],"correct":2},
      {"id":"tg47_04","type":"MULTIPLE_CHOICE","question_vi":"Thư trang trọng kết thúc thế nào?","options":["Liebe Grüße","Mit freundlichen Grüßen","Tschüss","Bis bald"],"correct":1},
      {"id":"tg47_05","type":"FILL_BLANK","sentence_de":"Ich freue mich ___ eine Einladung zum Vorstellungsgespräch.","hint_vi":"sich freuen + giới từ nào (việc sắp tới)?","answer":"auf","accept_also":["über","ueber"]}
    ],
    "practice":[
      {"id":"p47_01","type":"TRANSLATE","from":"vi","sentence":"Tôi có ba năm kinh nghiệm làm đầu bếp.","answer":"Ich habe drei Jahre Erfahrung als Koch.","accept_also":[]},
      {"id":"p47_02","type":"REORDER","words":["drei","einem","Jahre","Hotel","habe","in","gearbeitet.","Ich"],"correct_order":["Ich","habe","drei","Jahre","in","einem","Hotel","gearbeitet."],"translation":"Tôi đã làm ba năm trong một khách sạn."},
      {"id":"p47_03","type":"FILL_BLANK","sentence_de":"Sehr ___ Frau Weber,","hint_vi":"mở đầu thư trang trọng","answer":"geehrte","accept_also":["geehrte"]}
    ]
  },
  "reading_passage":{
    "text_de":"Stellenanzeige\n\nDas Hotel am See in Konstanz sucht ab sofort eine Servicekraft (m/w/d) in Vollzeit. Sie haben Erfahrung im Service, sprechen gut Deutsch und arbeiten gern im Team. Wir bieten ein gutes Gehalt, 30 Tage Urlaub und ein freundliches Team. Bitte schicken Sie Ihre Bewerbung mit Lebenslauf bis zum 30. Juni per E-Mail an Frau Albrecht.",
    "text_vi":"Tin tuyển dụng\n\nKhách sạn am See ở Konstanz đang tìm gấp một nhân viên phục vụ làm toàn thời gian. Bạn có kinh nghiệm phục vụ, nói tiếng Đức tốt và thích làm việc nhóm. Chúng tôi mang đến mức lương tốt, 30 ngày nghỉ phép và một tập thể thân thiện. Vui lòng gửi hồ sơ kèm sơ yếu lý lịch trước ngày 30 tháng 6 qua email cho bà Albrecht.",
    "questions":[
      {"id":"rq47_01","type":"FILL_BLANK","question_vi":"Hạn nộp hồ sơ là khi nào?","answer":"bis zum 30. Juni","accept_also":["30. Juni","zum 30. Juni","30 Juni"]},
      {"id":"rq47_02","type":"MULTIPLE_CHOICE","question_vi":"Có bao nhiêu ngày nghỉ phép?","options":["20","25","28","30"],"correct":3}
    ]
  },
  "writing_prompt":{"task_de":"Schreiben Sie eine kurze Bewerbung auf die Stelle im Hotel am See.","task_vi":"Viết một thư ứng tuyển ngắn cho vị trí ở khách sạn am See.","min_sentences":5,"example_answer":"Sehr geehrte Frau Albrecht,\nich bewerbe mich um die Stelle als Servicekraft.\nIch habe zwei Jahre in einem Restaurant gearbeitet.\nIch spreche gut Deutsch und arbeite gern im Team.\nIch freue mich auf eine Einladung zum Vorstellungsgespräch.\nMit freundlichen Grüßen\nLinh Vo"},
  "audio_content":{
    "listen_words":[
      {"text":"Ich bewerbe mich um die Stelle.","meaning":"Tôi ứng tuyển vị trí này."},
      {"text":"Ich habe viel Erfahrung im Service.","meaning":"Tôi có nhiều kinh nghiệm phục vụ."},
      {"text":"Wann können Sie anfangen?","meaning":"Khi nào bạn có thể bắt đầu?"}
    ],
    "listen_dialogue":"Warum möchten Sie bei uns arbeiten? — Ich arbeite gern mit Menschen, und Ihr Hotel gefällt mir. — Welche Erfahrung haben Sie? — Ich habe zwei Jahre in einem Restaurant gearbeitet. — Sehr gut. Wann können Sie anfangen?"
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 47 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 48: Indirekte Rede ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Indirekte Rede","vi":"Lời nói gián tiếp"},
  "overview":{"de":"Er sagt, dass er Hunger hat. Sie fragt, ob ich kommen kann.","vi":"Thuật lại lời người khác bằng dass, ob và từ để hỏi; động từ đứng cuối câu phụ."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Thuật lại câu kể: dass"},"content":{"vi":"Lời nói: \"Ich habe Hunger.\"\nThuật lại: Er sagt, dass er Hunger hat.\n\nCác động từ dùng được: sagen, meinen, erzählen, erklären.\n\nNhớ đổi ngôi và đưa động từ về cuối câu:\n\"Wir kommen später.\" → Sie sagen, dass sie später kommen."},"tags":["#IndirekteRede","#dass"]},
    {"type":"RULE","title":{"vi":"Thuật lại câu hỏi: ob và từ để hỏi"},"content":{"vi":"Câu hỏi có/không dùng ob:\n\"Kommst du?\" → Sie fragt, ob ich komme.\n\nCâu hỏi có từ để hỏi giữ nguyên từ đó:\n\"Wann kommst du?\" → Sie fragt, wann ich komme.\n\"Wo wohnst du?\" → Er fragt, wo ich wohne.\n\nCả hai đều đưa động từ về cuối câu."},"tags":["#IndirekteRede","#ob"]},
    {"type":"EXAMPLE","title":{"vi":"Thuật lại lời yêu cầu: sollen"},"content":{"vi":"\"Ruf mich bitte an!\" → Sie sagt, ich soll sie anrufen.\n\"Trinken Sie mehr Wasser!\" → Der Arzt sagt, ich soll mehr Wasser trinken.\n\nsollen ở đây nghĩa là: người khác muốn tôi làm việc đó."},"tags":["#IndirekteRede","#sollen"]}
  ],
  "vocabulary":[
    {"id":"v48_01","german":"erzählen","meaning":"kể","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie erzählt, dass sie umgezogen ist.","example_vi":"Cô ấy kể rằng cô đã chuyển nhà.","speak_de":"Sie erzählt, dass sie umgezogen ist.","tags":[]},
    {"id":"v48_02","german":"meinen","meaning":"cho rằng","gender":null,"color_code":null,"gender_label":null,"example_de":"Mein Chef meint, dass das kein Problem ist.","example_vi":"Sếp tôi cho rằng đó không phải vấn đề.","speak_de":"Mein Chef meint, dass das kein Problem ist.","tags":[]},
    {"id":"v48_03","german":"fragen","meaning":"hỏi","gender":null,"color_code":null,"gender_label":null,"example_de":"Er fragt, ob du morgen Zeit hast.","example_vi":"Anh ấy hỏi liệu ngày mai bạn có rảnh không.","speak_de":"Er fragt, ob du morgen Zeit hast.","tags":[]},
    {"id":"v48_04","german":"verschieben","meaning":"dời lại","gender":null,"color_code":null,"gender_label":null,"example_de":"Wir müssen den Termin verschieben.","example_vi":"Chúng ta phải dời cuộc hẹn.","speak_de":"Wir müssen den Termin verschieben.","tags":[]},
    {"id":"v48_05","german":"die Nachricht","meaning":"tin nhắn","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Ich gebe dem Chef die Nachricht weiter.","example_vi":"Tôi chuyển tin nhắn cho sếp.","speak_de":"Ich gebe dem Chef die Nachricht weiter.","tags":[]}
  ],
  "phrases":[
    {"german":"Er sagt, dass er später kommt.","meaning":"Anh ấy nói rằng anh sẽ đến muộn.","speak_de":"Er sagt, dass er später kommt."},
    {"german":"Sie fragt, ob du Zeit hast.","meaning":"Cô ấy hỏi liệu bạn có rảnh không.","speak_de":"Sie fragt, ob du Zeit hast."},
    {"german":"Der Arzt sagt, ich soll mich ausruhen.","meaning":"Bác sĩ nói tôi nên nghỉ ngơi.","speak_de":"Der Arzt sagt, ich soll mich ausruhen."}
  ],
  "examples":[
    {"german":"— Was hat die Kundin gesagt?\n— Sie hat gesagt, dass sie heute nicht kommen kann.\n— Hat sie gefragt, wann wir morgen geöffnet haben?\n— Ja, und sie möchte wissen, ob wir samstags arbeiten.","translation":"— Khách hàng đã nói gì?\n— Bà ấy nói rằng hôm nay không đến được.\n— Bà ấy có hỏi ngày mai mình mở cửa lúc nào không?\n— Có, và bà ấy muốn biết thứ Bảy mình có làm việc không.","note":"dass, wann, ob: động từ đứng cuối","speak_de":"Sie hat gesagt, dass sie nicht kommen kann."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg48_01","type":"FILL_BLANK","sentence_de":"Er sagt, ___ er müde ist.","hint_vi":"Thuật lại câu kể","answer":"dass","accept_also":["dass"]},
      {"id":"tg48_02","type":"FILL_BLANK","sentence_de":"Sie fragt, ___ ich morgen Zeit habe.","hint_vi":"Thuật lại câu hỏi có/không","answer":"ob","accept_also":["ob"]},
      {"id":"tg48_03","type":"FILL_BLANK","sentence_de":"Der Lehrer fragt, wann du ___. (kommen)","hint_vi":"Động từ đứng cuối, chia với du","answer":"kommst","accept_also":["kommst"]},
      {"id":"tg48_04","type":"MULTIPLE_CHOICE","question_vi":"\"Wo wohnst du?\" → Er fragt, ...","options":["wo wohnst du","wo du wohnst","ob du wohnst","dass du wo wohnst"],"correct":1},
      {"id":"tg48_05","type":"MULTIPLE_CHOICE","question_vi":"\"Ruf mich an!\" → Sie sagt, ...","options":["ich sollen sie anrufen","sie ruft mich an","ich soll sie anrufen","ob ich sie anrufe"],"correct":2}
    ],
    "practice":[
      {"id":"p48_01","type":"TRANSLATE","from":"vi","sentence":"Cô ấy hỏi liệu tôi có rảnh không.","answer":"Sie fragt, ob ich Zeit habe.","accept_also":[]},
      {"id":"p48_02","type":"REORDER","words":["kommen","Chef","Mein","dass","sagt,","ich","soll.","früher","morgen"],"correct_order":["Mein","Chef","sagt,","dass","ich","morgen","früher","kommen","soll."],"translation":"Sếp tôi nói rằng ngày mai tôi phải đến sớm hơn."},
      {"id":"p48_03","type":"FILL_BLANK","sentence_de":"Mein Arzt sagt, ich ___ weniger Kaffee trinken.","hint_vi":"Thuật lại lời khuyên, ngôi ich","answer":"soll","accept_also":["soll"]}
    ]
  },
  "reading_passage":{
    "text_de":"Eine Nachricht für den Chef\n\nAm Morgen hat Frau Neumann angerufen. Sie hat gesagt, dass sie heute nicht kommen kann, weil ihr Sohn krank ist. Sie hat gefragt, ob wir den Termin auf Freitag verschieben können. Thanh hat dem Chef die Nachricht weitergegeben. Der Chef hat gesagt, dass das kein Problem ist. Er hat gefragt, um wie viel Uhr sie kommen möchte. Thanh soll sie noch einmal anrufen.",
    "text_vi":"Một lời nhắn cho sếp\n\nBuổi sáng bà Neumann đã gọi điện. Bà nói rằng hôm nay không đến được vì con trai bị ốm. Bà hỏi liệu có thể dời hẹn sang thứ Sáu không. Thanh đã chuyển lời nhắn cho sếp. Sếp nói rằng không vấn đề gì. Ông hỏi bà muốn đến lúc mấy giờ. Thanh phải gọi lại cho bà một lần nữa.",
    "questions":[
      {"id":"rq48_01","type":"FILL_BLANK","question_vi":"Bà Neumann muốn dời hẹn sang ngày nào?","answer":"auf Freitag","accept_also":["Freitag","am Freitag"]},
      {"id":"rq48_02","type":"MULTIPLE_CHOICE","question_vi":"Vì sao bà ấy không đến được?","options":["Sie ist im Urlaub.","Ihr Auto ist kaputt.","Sie hat keine Lust.","Ihr Sohn ist krank."],"correct":3}
    ]
  },
  "writing_prompt":{"task_de":"Was haben Ihre Freunde oder Kollegen diese Woche gesagt? Schreiben Sie 4 Sätze.","task_vi":"Tuần này bạn bè hoặc đồng nghiệp của bạn đã nói gì? Viết 4 câu.","min_sentences":4,"example_answer":"Meine Kollegin hat gesagt, dass sie im Mai heiratet.\nMein Freund fragt, ob ich am Samstag Zeit habe.\nMein Chef meint, dass wir mehr Personal brauchen.\nDer Arzt sagt, ich soll mehr schlafen."},
  "audio_content":{
    "listen_words":[
      {"text":"Er sagt, dass er später kommt.","meaning":"Anh ấy nói rằng anh sẽ đến muộn."},
      {"text":"Sie fragt, ob du Zeit hast.","meaning":"Cô ấy hỏi liệu bạn có rảnh không."},
      {"text":"Sie fragt, wann wir essen.","meaning":"Cô ấy hỏi khi nào chúng ta ăn."}
    ],
    "listen_dialogue":"Was hat Tom gesagt? — Er hat gesagt, dass er heute nicht kommen kann. — Warum nicht? — Er meint, dass er zu viel Arbeit hat. — Und was fragt er? — Er fragt, ob wir das Treffen verschieben können."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 48 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 49: Meinungen ausdrücken ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"Meinungen ausdrücken","vi":"Diễn đạt quan điểm"},
  "overview":{"de":"Ich finde, dass das richtig ist. Meiner Meinung nach ist das falsch.","vi":"Nêu ý kiến, đồng ý, phản đối lịch sự và đưa lý do."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Nêu ý kiến"},"content":{"vi":"Ich finde, dass ...\nIch denke, dass ...\nIch glaube, dass ...\nIch bin der Meinung, dass ...\n(động từ đứng cuối câu phụ)\n\nMeiner Meinung nach ist das richtig.\nSau Meiner Meinung nach, động từ đứng ngay vị trí thứ hai."},"tags":["#Meinung","#A2"]},
    {"type":"RULE","title":{"vi":"Đồng ý và không đồng ý"},"content":{"vi":"Đồng ý:\nDas stimmt.\nDa hast du recht.\nIch bin deiner Meinung.\nGenau!\n\nKhông đồng ý một cách lịch sự:\nDas sehe ich anders.\nIch bin nicht deiner Meinung.\nDas finde ich nicht.\n\nVới người lạ, dùng Sie: Da haben Sie recht. Ich bin Ihrer Meinung."},"tags":["#Meinung","#Diskussion"]},
    {"type":"EXAMPLE","title":{"vi":"Đưa lý do, ưu điểm và nhược điểm"},"content":{"vi":"weil + động từ cuối câu:\nIch finde das gut, weil es Geld spart.\n\ndenn + trật tự câu bình thường:\nIch finde das gut, denn es spart Geld.\n\nÝ cân nhắc:\nEin Vorteil ist, dass man Zeit spart.\nEin Nachteil ist, dass es teuer ist."},"tags":["#Meinung","#Argumente"]}
  ],
  "vocabulary":[
    {"id":"v49_01","german":"die Meinung","meaning":"ý kiến","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Was ist deine Meinung?","example_vi":"Ý kiến của bạn là gì?","speak_de":"Was ist deine Meinung?","tags":[]},
    {"id":"v49_02","german":"der Vorteil","meaning":"ưu điểm","gender":"DER","color_code":null,"gender_label":"der","example_de":"Ein Vorteil ist, dass man Zeit spart.","example_vi":"Một ưu điểm là tiết kiệm được thời gian.","speak_de":"Ein Vorteil ist, dass man Zeit spart.","tags":[]},
    {"id":"v49_03","german":"der Nachteil","meaning":"nhược điểm","gender":"DER","color_code":null,"gender_label":"der","example_de":"Ein Nachteil ist der Preis.","example_vi":"Một nhược điểm là giá.","speak_de":"Ein Nachteil ist der Preis.","tags":[]},
    {"id":"v49_04","german":"stimmen","meaning":"đúng","gender":null,"color_code":null,"gender_label":null,"example_de":"Das stimmt nicht.","example_vi":"Điều đó không đúng.","speak_de":"Das stimmt nicht.","tags":[]},
    {"id":"v49_05","german":"recht haben","meaning":"có lý, đúng","gender":null,"color_code":null,"gender_label":null,"example_de":"Da hast du recht.","example_vi":"Bạn nói đúng.","speak_de":"Da hast du recht.","tags":[]},
    {"id":"v49_06","german":"zustimmen","meaning":"đồng ý","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich stimme dir zu.","example_vi":"Tôi đồng ý với bạn.","speak_de":"Ich stimme dir zu.","tags":[]}
  ],
  "phrases":[
    {"german":"Was meinst du dazu?","meaning":"Bạn nghĩ sao về chuyện này?","speak_de":"Was meinst du dazu?"},
    {"german":"Da hast du recht.","meaning":"Bạn nói đúng.","speak_de":"Da hast du recht."},
    {"german":"Das sehe ich anders.","meaning":"Tôi thấy khác.","speak_de":"Das sehe ich anders."}
  ],
  "examples":[
    {"german":"— Ich finde, dass Homeoffice sehr praktisch ist.\n— Warum?\n— Man spart Zeit, weil man nicht fahren muss.\n— Das stimmt. Aber ein Nachteil ist, dass man die Kollegen nicht sieht.\n— Da hast du recht. Vielleicht ist eine Mischung am besten.","translation":"— Mình thấy làm ở nhà rất tiện.\n— Vì sao?\n— Tiết kiệm thời gian vì không phải đi lại.\n— Đúng thế. Nhưng nhược điểm là không gặp đồng nghiệp.\n— Bạn nói đúng. Có lẽ kết hợp cả hai là tốt nhất.","note":"weil: động từ cuối; dass: động từ cuối","speak_de":"Ich finde, dass Homeoffice praktisch ist."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg49_01","type":"FILL_BLANK","sentence_de":"Meiner Meinung ___ ist das richtig.","hint_vi":"theo ý tôi: Meiner Meinung ...","answer":"nach","accept_also":["nach"]},
      {"id":"tg49_02","type":"FILL_BLANK","sentence_de":"Ich bin nicht ___ Meinung.","hint_vi":"của bạn (du)","answer":"deiner","accept_also":["Ihrer"]},
      {"id":"tg49_03","type":"MULTIPLE_CHOICE","question_vi":"Câu nào đúng?","options":["Meiner Meinung nach das ist gut.","Meiner Meinung nach gut das ist.","Meiner Meinung nach ist das gut.","Meiner Meinung nach, das ist gut."],"correct":2},
      {"id":"tg49_04","type":"MULTIPLE_CHOICE","question_vi":"Câu nào thể hiện KHÔNG đồng ý?","options":["Das stimmt.","Das sehe ich anders.","Da hast du recht.","Genau!"],"correct":1},
      {"id":"tg49_05","type":"FILL_BLANK","sentence_de":"Ich esse kein Fleisch, ___ ich mag es nicht.","hint_vi":"vì, trật tự câu bình thường","answer":"denn","accept_also":["denn"]}
    ],
    "practice":[
      {"id":"p49_01","type":"TRANSLATE","from":"vi","sentence":"Theo tôi, làm việc ở nhà rất tiện.","answer":"Meiner Meinung nach ist Homeoffice sehr praktisch.","accept_also":["Ich finde, dass Homeoffice sehr praktisch ist."]},
      {"id":"p49_02","type":"REORDER","words":["sollen.","Kinder","lesen","der","viel","bin","dass","Meinung,","Ich"],"correct_order":["Ich","bin","der","Meinung,","dass","Kinder","viel","lesen","sollen."],"translation":"Tôi cho rằng trẻ em nên đọc nhiều."},
      {"id":"p49_03","type":"FILL_BLANK","sentence_de":"Ein ___ ist, dass man viel Geld spart.","hint_vi":"ưu điểm","answer":"Vorteil","accept_also":["Vorteil"]}
    ]
  },
  "reading_passage":{
    "text_de":"Handys in der Schule?\n\nIn einem Forum diskutieren Leser über Handys in der Schule. Marie schreibt: \"Ich finde, dass Handys im Unterricht stören. Die Schüler passen nicht auf.\" Jonas meint: \"Das sehe ich anders. Man kann mit dem Handy schnell Informationen finden. Ein Vorteil ist auch, dass Eltern ihre Kinder erreichen können.\" Frau Stein, eine Lehrerin, schreibt: \"Meiner Meinung nach brauchen wir klare Regeln. In der Pause ist das Handy in Ordnung, im Unterricht aber nicht.\"",
    "text_vi":"Điện thoại ở trường?\n\nTrên một diễn đàn, độc giả tranh luận về điện thoại ở trường. Marie viết: \"Tôi thấy điện thoại gây mất tập trung trong giờ học. Học sinh không chú ý.\" Jonas cho rằng: \"Tôi thấy khác. Có thể tìm thông tin nhanh bằng điện thoại. Một ưu điểm nữa là cha mẹ liên lạc được với con.\" Cô Stein, một giáo viên, viết: \"Theo tôi, chúng ta cần quy định rõ ràng. Trong giờ ra chơi thì dùng điện thoại được, nhưng trong giờ học thì không.\"",
    "questions":[
      {"id":"rq49_01","type":"FILL_BLANK","question_vi":"Theo cô Stein, khi nào được dùng điện thoại?","answer":"in der Pause","accept_also":["Pause","die Pause"]},
      {"id":"rq49_02","type":"MULTIPLE_CHOICE","question_vi":"Ai cho rằng điện thoại gây mất tập trung trong giờ học?","options":["Marie","Jonas","die Eltern","niemand"],"correct":0}
    ]
  },
  "writing_prompt":{"task_de":"Sollen Kinder ein eigenes Handy haben? Schreiben Sie Ihre Meinung mit einem Vorteil und einem Nachteil.","task_vi":"Trẻ em có nên có điện thoại riêng không? Viết ý kiến của bạn với một ưu điểm và một nhược điểm.","min_sentences":5,"example_answer":"Meiner Meinung nach sollen Kinder erst mit zwölf Jahren ein Handy haben.\nEin Vorteil ist, dass die Eltern sie erreichen können.\nEin Nachteil ist, dass sie zu viel Zeit damit verbringen.\nIch finde, dass klare Regeln wichtig sind.\nDeshalb sollen Eltern und Kinder zusammen sprechen."},
  "audio_content":{
    "listen_words":[
      {"text":"Das sehe ich anders.","meaning":"Tôi thấy khác."},
      {"text":"Da hast du recht.","meaning":"Bạn nói đúng."},
      {"text":"Meiner Meinung nach ist das richtig.","meaning":"Theo tôi điều đó đúng."}
    ],
    "listen_dialogue":"Was meinst du: Sollen wir mehr mit dem Bus fahren? — Ich finde, dass das eine gute Idee ist. — Aber der Bus ist oft zu voll. — Das stimmt. Ein Nachteil ist auch, dass er selten kommt. — Trotzdem bin ich dafür."
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 49 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;

-- ─── Ngày 50: A2 Abschlusstest ───
UPDATE skill_tree_nodes SET content_json = '{
  "title":{"de":"A2 Abschlusstest","vi":"Bài thi tổng kết A2"},
  "overview":{"de":"Probeprüfung: Wiederholen Sie die wichtigsten Themen aus A2.","vi":"Ôn tập và kiểm tra toàn bộ ngữ pháp, từ vựng A2 bằng một bài mô phỏng soạn gốc, không liên kết với Goethe-Institut."},
  "session_type":"EXAM",
  "theory_cards":[
    {"type":"EXAMPLE","title":{"vi":"Bài thi A2 gồm những gì"},"content":{"vi":"Các kỳ thi trình độ A2 thường kiểm tra bốn kỹ năng:\nLesen: đọc thông báo, email, quảng cáo ngắn\nHören: nghe thông báo, hội thoại ngắn\nSchreiben: viết tin nhắn, email ngắn\nSprechen: giới thiệu bản thân, hỏi đáp, lên kế hoạch\n\nBài tổng kết này là bài mô phỏng do DeutschFlow soạn để ôn tập, không phải đề thi thật."},"tags":["#Abschlusstest","#A2"]},
    {"type":"RULE","title":{"vi":"Ngữ pháp cần nắm chắc"},"content":{"vi":"Dativ và giới từ: mit dem Bus, bei meiner Schwester\nGiới từ hai hướng: auf dem Tisch, auf den Tisch\nĐuôi tính từ: ein großer Balkon\nSo sánh: schneller als, am schnellsten\nCâu phụ: weil, dass, wenn, ob\nKonjunktiv II: ich würde, ich hätte, ich könnte\nPassiv Präsens: Das Auto wird repariert.\nMệnh đề quan hệ: der Mann, der hier wohnt\nGenitiv: wegen des Regens"},"tags":["#Grammatik","#Wiederholung"]},
    {"type":"RULE","title":{"vi":"Mẹo làm bài"},"content":{"vi":"Đọc câu hỏi trước, rồi mới đọc bài.\nGạch chân thời gian, địa điểm, con số.\nKhông dừng lâu ở một câu khó.\nKhi viết: trả lời đủ mọi ý của đề, rồi kiểm tra động từ ở vị trí 2 và cuối câu phụ.\nKhi nói: chưa nghe rõ thì hỏi lại: Können Sie das bitte wiederholen?"},"tags":["#Pruefung","#Tipps"]}
  ],
  "vocabulary":[
    {"id":"v50_01","german":"die Prüfung","meaning":"kỳ thi","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Die Prüfung beginnt um neun Uhr.","example_vi":"Kỳ thi bắt đầu lúc chín giờ.","speak_de":"Die Prüfung beginnt um neun Uhr.","tags":[]},
    {"id":"v50_02","german":"die Aufgabe","meaning":"bài tập, nhiệm vụ","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Lesen Sie die Aufgabe genau.","example_vi":"Hãy đọc kỹ đề bài.","speak_de":"Lesen Sie die Aufgabe genau.","tags":[]},
    {"id":"v50_03","german":"ankreuzen","meaning":"đánh dấu chéo","gender":null,"color_code":null,"gender_label":null,"example_de":"Kreuzen Sie die richtige Antwort an.","example_vi":"Hãy đánh dấu vào câu trả lời đúng.","speak_de":"Kreuzen Sie die richtige Antwort an.","tags":[]},
    {"id":"v50_04","german":"die Lösung","meaning":"lời giải","gender":"DIE","color_code":null,"gender_label":"die","example_de":"Schreiben Sie die Lösung auf den Antwortbogen.","example_vi":"Hãy viết đáp án lên phiếu trả lời.","speak_de":"Schreiben Sie die Lösung auf den Antwortbogen.","tags":[]}
  ],
  "phrases":[
    {"german":"Können Sie das bitte wiederholen?","meaning":"Bạn có thể nhắc lại không?","speak_de":"Können Sie das bitte wiederholen?"},
    {"german":"Ich habe die Aufgabe nicht verstanden.","meaning":"Tôi chưa hiểu đề bài.","speak_de":"Ich habe die Aufgabe nicht verstanden."},
    {"german":"Ich drücke dir die Daumen!","meaning":"Chúc bạn may mắn!","speak_de":"Ich drücke dir die Daumen!"}
  ],
  "examples":[
    {"german":"— Bist du nervös?\n— Ein bisschen. Morgen ist die Prüfung.\n— Du hast so viel gelernt. Du schaffst das!\n— Danke. Wenn ich bestehe, lade ich dich zum Essen ein.\n— Super! Ich drücke dir die Daumen.","translation":"— Bạn có hồi hộp không?\n— Một chút. Ngày mai là thi rồi.\n— Bạn đã học nhiều thế. Bạn làm được mà!\n— Cảm ơn. Nếu đỗ, mình sẽ mời bạn đi ăn.\n— Tuyệt! Chúc bạn may mắn.","note":"wenn + động từ cuối, rồi động từ đứng đầu mệnh đề chính","speak_de":"Du schaffst das!"}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg50_01","type":"FILL_BLANK","sentence_de":"Ich fahre mit ___ Bus zur Arbeit.","hint_vi":"Dativ, der Bus","answer":"dem","accept_also":["dem"]},
      {"id":"tg50_02","type":"FILL_BLANK","sentence_de":"Ich stelle die Blumen auf ___ Tisch.","hint_vi":"Wohin? der Tisch","answer":"den","accept_also":["den"]},
      {"id":"tg50_03","type":"FILL_BLANK","sentence_de":"Das ist ein ___ Balkon. (groß)","hint_vi":"Nominativ giống đực sau ein","answer":"großer","accept_also":["grosser"]},
      {"id":"tg50_04","type":"MULTIPLE_CHOICE","question_vi":"Chọn câu đúng.","options":["Ich lerne Deutsch, weil ich will in Köln arbeiten.","Ich lerne Deutsch, weil ich in Köln arbeiten will.","Ich lerne Deutsch, weil in Köln ich arbeiten will.","Ich lerne Deutsch, weil will ich in Köln arbeiten."],"correct":1},
      {"id":"tg50_05","type":"FILL_BLANK","sentence_de":"Berlin ist größer ___ Bonn.","hint_vi":"So sánh hơn","answer":"als","accept_also":["als"]},
      {"id":"tg50_06","type":"MULTIPLE_CHOICE","question_vi":"Nói lịch sự nhất:","options":["Gib mir das Salz!","Ich will das Salz.","Könnten Sie mir bitte das Salz geben?","Salz, bitte jetzt."],"correct":2},
      {"id":"tg50_07","type":"FILL_BLANK","sentence_de":"Das Auto ___ in der Werkstatt repariert.","hint_vi":"Passiv Präsens, ngôi er/es","answer":"wird","accept_also":["wird"]},
      {"id":"tg50_08","type":"FILL_BLANK","sentence_de":"Das ist der Mann, ___ neben uns wohnt.","hint_vi":"Đại từ quan hệ, der Mann","answer":"der","accept_also":["der"]}
    ],
    "practice":[
      {"id":"p50_01","type":"FILL_BLANK","sentence_de":"Wegen ___ Sturms fährt der Zug nicht.","hint_vi":"Genitiv, der Sturm","answer":"des","accept_also":["des"]},
      {"id":"p50_02","type":"MULTIPLE_CHOICE","question_vi":"\"Hast du Zeit?\" → Sie fragt, ...","options":["dass ich Zeit habe","ob ich Zeit habe","ob habe ich Zeit","wann ich Zeit habe"],"correct":1},
      {"id":"p50_03","type":"FILL_BLANK","sentence_de":"Früher ___ ich nicht gut Deutsch sprechen.","hint_vi":"können, Präteritum, ngôi ich","answer":"konnte","accept_also":["konnte"]},
      {"id":"p50_04","type":"FILL_BLANK","sentence_de":"Meiner Meinung ___ brauchen wir mehr Zeit.","hint_vi":"theo ý tôi","answer":"nach","accept_also":["nach"]},
      {"id":"p50_05","type":"TRANSLATE","from":"vi","sentence":"Tôi muốn đổi đôi giày này vì nó quá nhỏ.","answer":"Ich möchte diese Schuhe umtauschen, weil sie zu klein sind.","accept_also":[]},
      {"id":"p50_06","type":"REORDER","words":["bitte","Sie","mir","beim","Können","Ausfüllen","helfen?"],"correct_order":["Können","Sie","mir","bitte","beim","Ausfüllen","helfen?"],"translation":"Bạn có thể giúp tôi điền đơn không?"}
    ]
  },
  "reading_passage":{
    "text_de":"Eine E-Mail von Sara\n\nLiebe Mai,\n\nam Samstag feiern wir meinen Geburtstag bei mir zu Hause. Wir fangen um 18 Uhr an. Mein Freund kocht, deshalb musst du nichts mitbringen. Wenn das Wetter schön ist, sitzen wir im Garten. Kannst du bitte deine Gitarre mitbringen? Du spielst am besten von allen! Sag mir bitte bis Donnerstag, ob du kommen kannst.\n\nLiebe Grüße\nSara",
    "text_vi":"Email của Sara\n\nMai thân mến,\n\nThứ Bảy chúng mình mừng sinh nhật mình ở nhà mình. Chúng mình bắt đầu lúc 18 giờ. Bạn trai mình nấu ăn, nên bạn không cần mang gì cả. Nếu thời tiết đẹp, chúng mình sẽ ngồi ngoài vườn. Bạn có thể mang đàn ghi-ta theo không? Bạn chơi hay nhất trong số mọi người! Trước thứ Năm hãy cho mình biết bạn có đến được không nhé.\n\nThân mến\nSara",
    "questions":[
      {"id":"rq50_01","type":"FILL_BLANK","question_vi":"Bữa tiệc bắt đầu lúc mấy giờ?","answer":"um 18 Uhr","accept_also":["18 Uhr","18"]},
      {"id":"rq50_02","type":"MULTIPLE_CHOICE","question_vi":"Mai nên mang gì?","options":["Essen","Getränke","ihre Gitarre","einen Kuchen"],"correct":2},
      {"id":"rq50_03","type":"FILL_BLANK","question_vi":"Sara cần câu trả lời trước ngày nào?","answer":"bis Donnerstag","accept_also":["Donnerstag","am Donnerstag"]}
    ]
  },
  "writing_prompt":{"task_de":"Antworten Sie Sara: Sie können kommen, aber erst um 19 Uhr. Fragen Sie auch, was Sie noch mitbringen sollen.","task_vi":"Trả lời Sara: bạn đến được nhưng phải 19 giờ mới tới. Hỏi thêm bạn nên mang gì.","min_sentences":5,"example_answer":"Liebe Sara,\nvielen Dank für die Einladung.\nIch komme gern, aber ich muss bis 18 Uhr arbeiten.\nDeshalb bin ich erst um 19 Uhr bei dir.\nIch bringe meine Gitarre mit.\nSoll ich noch etwas mitbringen?\nLiebe Grüße\nMai"},
  "audio_content":{
    "listen_words":[
      {"text":"Der Zug nach Hamburg hat heute zwanzig Minuten Verspätung.","meaning":"Chuyến tàu đi Hamburg hôm nay trễ hai mươi phút."},
      {"text":"Ich würde gern am Samstag kommen.","meaning":"Tôi muốn đến vào thứ Bảy."},
      {"text":"Das Büro wird um acht Uhr geöffnet.","meaning":"Văn phòng mở cửa lúc tám giờ."}
    ],
    "listen_dialogue":"Guten Tag, ich möchte einen Termin vereinbaren. — Gern. Passt Ihnen Dienstag um zehn Uhr? — Leider nicht, da muss ich arbeiten. Wäre auch Mittwoch möglich? — Ja, am Mittwoch um elf Uhr. — Das passt mir sehr gut. Vielen Dank und auf Wiederhören!"
  }
}'::jsonb
WHERE node_type = 'CORE_TRUNK' AND day_number = 50 AND cefr_level = 'A2' AND is_active = TRUE
  AND node_family IS NULL
  AND jsonb_array_length(content_json -> 'theory_cards') = 0;
