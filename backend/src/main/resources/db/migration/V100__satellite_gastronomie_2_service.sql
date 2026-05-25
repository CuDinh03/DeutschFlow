-- V100__satellite_gastronomie_2_service.sql
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi,
  xp_reward, is_active, content_json, industry
) VALUES (
  'SATELLITE_LEAF',
  'Service & Gästebetreuung',
  'Phục vụ & Chăm sóc khách',
  'Kommunikation im Restaurant',
  150,
  TRUE,
  '{
    "title": {"de": "Service & Gästebetreuung", "vi": "Phục vụ & Chăm sóc khách"},
    "overview": {"de": "Sprache für den Restaurantservice: von der Begrüßung bis zur Verabschiedung.", "vi": "Ngôn ngữ trong dịch vụ nhà hàng: từ chào đón đến tiễn khách, bao gồm xử lý phàn nàn."},
    "session_type": "SATELLITE",
    "industry": "GASTRONOMIE",
    "theory_cards": [
      {"type":"RULE","title":{"vi":"Begrüßung und Platzierung — Đón khách"},"content":{"vi":"Herzlich willkommen! — Chào mừng quý khách!\nHaben Sie reserviert? — Quý khách có đặt bàn chưa?\nFür wie viele Personen? — Cho bao nhiêu người?\nBitte folgen Sie mir! — Xin mời theo tôi!\nHier ist Ihr Tisch. — Đây là bàn của quý khách.\nDarf ich Ihnen die Jacke abnehmen? — Tôi có thể lấy áo khoác không?"},"tags":["#Service","#Begrüßung"]},
      {"type":"RULE","title":{"vi":"Bestellung aufnehmen — Gọi món"},"content":{"vi":"Sind Sie fertig zum Bestellen? — Quý khách sẵn sàng gọi món chưa?\nWas darf ich Ihnen bringen? — Tôi mang gì cho quý khách?\nHaben Sie Allergien? — Quý khách có dị ứng gì không?\nDas empfehle ich Ihnen besonders. — Tôi đặc biệt gợi ý món này.\nDas dauert ca. 20 Minuten. — Sẽ mất khoảng 20 phút.\nAlles zusammen oder getrennt? — Thanh toán chung hay riêng?"},"tags":["#Service","#Bestellung"]}
    ],
    "vocabulary": [
      {"id":"sg02_01","german":"die Reservierung","meaning":"đặt bàn","gender":"DIE","example_de":"Ich habe eine Reservierung auf den Namen Müller.","example_vi":"Tôi có đặt bàn tên Müller.","tags":["#Service"]},
      {"id":"sg02_02","german":"die Allergie","meaning":"dị ứng","gender":"DIE","example_de":"Haben Sie eine Allergie gegen Nüsse?","example_vi":"Quý khách có dị ứng với hạt không?","tags":["#Service","#Gesundheit"]},
      {"id":"sg02_03","german":"die Beschwerde","meaning":"phàn nàn","gender":"DIE","example_de":"Ich möchte eine Beschwerde machen — das Essen ist kalt.","example_vi":"Tôi muốn phàn nàn — đồ ăn bị nguội.","tags":["#Service","#Konflikt"]},
      {"id":"sg02_04","german":"nachbestellen","meaning":"gọi thêm","gender":null,"example_de":"Möchten Sie noch etwas nachbestellen?","example_vi":"Quý khách có muốn gọi thêm gì không?","tags":["#Service"]},
      {"id":"sg02_05","german":"das Trinkgeld","meaning":"tiền tip","gender":"DAS","example_de":"Das Trinkgeld ist in Deutschland freiwillig — ca. 10%.","example_vi":"Tiền tip ở Đức tự nguyện — khoảng 10%.","tags":["#Service","#Geld"]},
      {"id":"sg02_06","german":"reklamieren","meaning":"khiếu nại / đổi hàng","gender":null,"example_de":"Der Gast reklamiert — das Steak ist zu durch.","example_vi":"Khách phàn nàn — bít tết quá chín.","tags":["#Service"]},
      {"id":"sg02_07","german":"vegetarisch / vegan","meaning":"chay sữa trứng / thuần chay","gender":null,"example_de":"Haben Sie vegetarische Gerichte?","example_vi":"Có món ăn chay không?","tags":["#Ernährung"]}
    ],
    "phrases": [
      {"german":"Herzlich willkommen! Haben Sie reserviert?","meaning":"Chào mừng! Quý khách có đặt bàn không?","speak_de":"Herzlich willkommen!"},
      {"german":"Das tut mir sehr leid! Ich bringe Ihnen sofort ein neues Gericht.","meaning":"Tôi rất xin lỗi! Tôi sẽ mang ngay món mới cho quý khách.","speak_de":"Das tut mir leid!"},
      {"german":"Kann ich Ihnen noch etwas bringen?","meaning":"Tôi có thể mang gì thêm không?","speak_de":"Kann ich noch etwas bringen?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_g2_01","type":"MULTIPLE_CHOICE","question_vi":"Khách phàn nàn đồ ăn nguội. Bạn nói gì?","options":["Das ist normal.","Das tut mir leid! Ich bringe sofort ein neues Gericht.","Sie haben bestellt, was Sie bekommen.","Warten Sie bitte."],"correct":1},
        {"id":"sat_g2_02","type":"FILL_BLANK","sentence_de":"Haben Sie eine ___ gegen Nüsse oder Gluten?","hint_vi":"dị ứng","answer":"Allergie","accept_also":["allergie"]},
        {"id":"sat_g2_03","type":"MULTIPLE_CHOICE","question_vi":"Tiền tip ở Đức thường là bao nhiêu?","options":["5%","10%","15%","20%"],"correct":1},
        {"id":"sat_g2_04","type":"FILL_BLANK","sentence_de":"Alles ___ oder ___?","hint_vi":"chung hay riêng","answer":"zusammen, getrennt","accept_also":["zusammen / getrennt"]},
        {"id":"sat_g2_05","type":"MULTIPLE_CHOICE","question_vi":"''reklamieren'' nghĩa là gì?","options":["Quảng cáo","Khiếu nại/đổi hàng","Gọi món","Đặt bàn"],"correct":1}
      ],
      "practice": [
        {"id":"sat_g2_p01","type":"TRANSLATE","from":"vi","sentence":"Xin chào! Quý khách có đặt bàn không? Cho bao nhiêu người?","answer":"Guten Abend! Haben Sie reserviert? Für wie viele Personen?","accept_also":["Herzlich willkommen! Haben Sie reserviert? Für wie viele Gäste?"]},
        {"id":"sat_g2_p02","type":"FILL_BLANK","sentence_de":"Das ___ mir leid. Ich ___ Ihnen sofort ein ___ Gericht.","hint_vi":"xin lỗi ... mang ... mới","answer":"tut, bringe, neues","accept_also":["tut / bringe / neues"]}
      ]
    },
    "reading_passage": {
      "text_de": "Umgang mit Beschwerden\n\nEin Gast beschwert sich: ''Das Fleisch ist kalt und das Gemüse ist überkocht!''. Als guter Kellner antwortest du: ''Das tut mir sehr leid! Das ist natürlich nicht akzeptabel. Ich nehme das Gericht zurück und bringe Ihnen sofort ein frisches. Darf ich Ihnen in der Zwischenzeit etwas zu trinken anbieten? Auf Kosten des Hauses natürlich.'' Der Gast ist beruhigt und gibt später sogar Trinkgeld.",
      "text_vi": "Xử lý phàn nàn\n\nMột khách phàn nàn: ''Thịt nguội và rau nấu nát!''. Là nhân viên phục vụ giỏi, bạn trả lời: ''Tôi rất xin lỗi! Điều này đương nhiên không thể chấp nhận được. Tôi sẽ đổi món và mang ngay đồ tươi. Trong thời gian chờ tôi mang đồ uống nhé? Dĩ nhiên nhà hàng mời.'' Khách nguôi giận và sau đó còn để lại tiền tip.",
      "questions": [
        {"id":"rq_sg2_01","type":"FILL_BLANK","question_vi":"Nhân viên phục vụ xử lý thế nào khi khách phàn nàn?","answer":"Er entschuldigt sich und bringt ein neues Gericht","accept_also":["entschuldigen und neues Gericht bringen"]},
        {"id":"rq_sg2_02","type":"MULTIPLE_CHOICE","question_vi":"''Auf Kosten des Hauses'' nghĩa là gì?","options":["Khách tự trả","Nhà hàng mời miễn phí","Chia đôi tiền","Trả theo hóa đơn"],"correct":1}
      ]
    },
    "writing_prompt": {
      "task_de": "Ein Gast hat ein Problem. Schreiben Sie einen Dialog: Beschwerde und Lösung. (6 Zeilen)",
      "task_vi": "Một khách có vấn đề. Viết hội thoại: phàn nàn và giải quyết. (6 dòng)",
      "min_sentences": 6
    },
    "audio_content": {
      "listen_words": [
        {"text":"Herzlich willkommen!","meaning":"Chào mừng!"},
        {"text":"Das tut mir leid.","meaning":"Tôi xin lỗi."},
        {"text":"Haben Sie eine Allergie?","meaning":"Quý khách có dị ứng không?"}
      ]
    }
  }'::jsonb,
  'GASTRONOMIE'
) ON CONFLICT DO NOTHING;
