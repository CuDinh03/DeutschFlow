-- V101__satellite_gastronomie_3_getraenke.sql
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi,
  xp_reward, is_active, content_json, industry
) VALUES (
  'SATELLITE_LEAF',
  'Getränke & Bar',
  'Đồ uống & Quầy bar',
  'Weinkunde und Bierkultur',
  150,
  TRUE,
  '{
    "title": {"de": "Getränke & Bar", "vi": "Đồ uống & Quầy bar"},
    "overview": {"de": "Fachsprache für die Bar: Weinkunde, Cocktails, Bierkultur.", "vi": "Tiếng Đức chuyên ngành bar: kiến thức về rượu vang, cocktail, văn hóa bia Đức."},
    "session_type": "SATELLITE",
    "industry": "GASTRONOMIE",
    "theory_cards": [
      {"type":"RULE","title":{"vi":"Weinberatung — Tư vấn rượu vang"},"content":{"vi":"Zu Fisch empfehle ich einen Weißwein. — Với cá tôi gợi ý vang trắng.\nZu Fleisch passt ein kräftiger Rotwein. — Với thịt hợp vang đỏ đậm.\nTrocken / Halbtrocken / Süß — Khô / Nửa khô / Ngọt\nDürfte ich Ihnen eine Weinprobe anbieten? — Tôi có thể cho quý khách thử rượu không?\nDer Wein hat einen fruchtigen Geschmack. — Rượu này có vị trái cây."},"tags":["#Wein","#Beratung"]},
      {"type":"RULE","title":{"vi":"Bierkultur in Deutschland"},"content":{"vi":"Deutsches Reinheitsgebot (1516): chỉ được có Wasser, Malz, Hopfen, Hefe\nBiertypen:\nPils — bia nhạt phổ biến\nWeizen/Weißbier — bia lúa mì\nDunkles — bia đen/tối\nExport — bia mạnh nhẹ\nRadler — bia trộn nước chanh\nVom Fass — bia tươi (từ thùng)\nEin großes Bier = 0,5L | Ein kleines = 0,3L"},"tags":["#Bier","#Kultur"]}
    ],
    "vocabulary": [
      {"id":"sg03_01","german":"der Rotwein / der Weißwein","meaning":"vang đỏ / vang trắng","gender":"DER","example_de":"Zum Steak passt ein Rotwein aus der Region.","example_vi":"Với bít tết hợp vang đỏ vùng này.","tags":["#Getränke"]},
      {"id":"sg03_02","german":"vom Fass","meaning":"bia/rượu tươi từ thùng","gender":null,"example_de":"Unser Pils vom Fass ist sehr beliebt.","example_vi":"Bia Pils tươi của chúng tôi rất được ưa chuộng.","tags":["#Bier"]},
      {"id":"sg03_03","german":"der Aperitif / der Digestif","meaning":"khai vị / tráng miệng (đồ uống)","gender":"DER","example_de":"Als Aperitif empfehle ich einen Prosecco.","example_vi":"Khai vị tôi gợi ý Prosecco.","tags":["#Getränke"]},
      {"id":"sg03_04","german":"alkoholfrei","meaning":"không cồn","gender":null,"example_de":"Haben Sie alkoholfreie Cocktails?","example_vi":"Có cocktail không cồn không?","tags":["#Getränke"]},
      {"id":"sg03_05","german":"der Geschmack","meaning":"hương vị / khẩu vị","gender":"DER","example_de":"Der Wein hat einen fruchtigen Geschmack.","example_vi":"Rượu có vị trái cây.","tags":["#Wein"]},
      {"id":"sg03_06","german":"die Zapfanlage","meaning":"máy rót bia","gender":"DIE","example_de":"Die Zapfanlage wird täglich gereinigt.","example_vi":"Máy rót bia được vệ sinh mỗi ngày.","tags":["#Bar","#Hygiene"]}
    ],
    "phrases": [
      {"german":"Zu diesem Gericht empfehle ich einen leichten Rotwein.","meaning":"Với món này tôi gợi ý vang đỏ nhẹ.","speak_de":"Ich empfehle einen Rotwein."},
      {"german":"Darf ich Ihnen etwas zu trinken anbieten?","meaning":"Tôi có thể mời quý khách đồ uống không?","speak_de":"Darf ich etwas anbieten?"},
      {"german":"Ein Pils vom Fass, bitte!","meaning":"Một bia Pils tươi, làm ơn!","speak_de":"Ein Pils vom Fass!"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_g3_01","type":"MULTIPLE_CHOICE","question_vi":"Reinheitsgebot cho phép nguyên liệu nào trong bia?","options":["Wasser, Malz, Zucker, Hefe","Wasser, Malz, Hopfen, Hefe","Wasser, Gerste, Hopfen, Aroma","Wasser, Malz, Hopfen, Alkohol"],"correct":1},
        {"id":"sat_g3_02","type":"FILL_BLANK","sentence_de":"Zu Fisch ___ ich einen ___ empfehlen.","hint_vi":"gợi ý ... vang trắng","answer":"würde, Weißwein","accept_also":["kann, Weißwein"]},
        {"id":"sat_g3_03","type":"MULTIPLE_CHOICE","question_vi":"''trocken'' khi nói về rượu nghĩa là gì?","options":["Không có nước","Không ngọt (khô)","Đắng","Nhẹ"],"correct":1},
        {"id":"sat_g3_04","type":"MULTIPLE_CHOICE","question_vi":"''ein großes Bier'' = bao nhiêu ml?","options":["300ml","400ml","500ml","1000ml"],"correct":2},
        {"id":"sat_g3_05","type":"FILL_BLANK","sentence_de":"Haben Sie ___freie Cocktails?","hint_vi":"không cồn","answer":"alkohol","accept_also":["Alkohol"]}
      ],
      "practice": [
        {"id":"sat_g3_p01","type":"TRANSLATE","from":"vi","sentence":"Tôi gợi ý vang trắng với cá. Nó có vị trái cây và nhẹ.","answer":"Ich empfehle einen Weißwein zum Fisch. Er hat einen fruchtigen und leichten Geschmack.","accept_also":["Zum Fisch empfehle ich Weißwein. Er schmeckt fruchtig und leicht."]},
        {"id":"sat_g3_p02","type":"FILL_BLANK","sentence_de":"___ ___ empfehle ich einen leichten ___wein.","hint_vi":"Với cá ... vang trắng","answer":"Zum Fisch, Weiß","accept_also":["Zu Fisch / Weiß"]}
      ]
    },
    "reading_passage": {
      "text_de": "Deutsche Bierkultur\n\nDeutschland ist für seine Bierkultur weltberühmt. Das Reinheitsgebot von 1516 schreibt vor, dass deutsches Bier nur aus Wasser, Malz, Hopfen und Hefe gebraut werden darf. Es gibt über 1.300 Brauereien in Deutschland mit mehr als 5.000 verschiedenen Biersorten. Das Oktoberfest in München ist das größte Bierfest der Welt. Dort werden jedes Jahr ca. 7 Millionen Liter Bier getrunken.",
      "text_vi": "Văn hóa bia Đức\n\nĐức nổi tiếng thế giới về văn hóa bia. Reinheitsgebot năm 1516 quy định bia Đức chỉ được ủ từ nước, mạch nha, hops và men. Có hơn 1.300 nhà máy bia ở Đức với hơn 5.000 loại bia khác nhau. Oktoberfest ở Munich là lễ hội bia lớn nhất thế giới. Mỗi năm khoảng 7 triệu lít bia được uống.",
      "questions": [
        {"id":"rq_sg3_01","type":"FILL_BLANK","question_vi":"Reinheitsgebot ra đời năm nào?","answer":"1516","accept_also":["fünfzehnhundert sechzehn"]},
        {"id":"rq_sg3_02","type":"MULTIPLE_CHOICE","question_vi":"Ở Đức có bao nhiêu nhà máy bia?","options":["über 500","über 1.000","über 1.300","über 2.000"],"correct":2}
      ]
    },
    "writing_prompt": {
      "task_de": "Ein Gast fragt nach einer Weinempfehlung. Schreiben Sie eine Antwort mit Begründung.",
      "task_vi": "Khách hỏi gợi ý rượu. Viết câu trả lời với lý do.",
      "min_sentences": 4
    },
    "audio_content": {
      "listen_words": [
        {"text":"Zu Fleisch empfehle ich Rotwein.","meaning":"Với thịt tôi gợi ý vang đỏ."},
        {"text":"Ein Pils vom Fass, bitte!","meaning":"Một bia tươi!"},
        {"text":"alkoholfrei","meaning":"không cồn"}
      ]
    }
  }'::jsonb,
  'GASTRONOMIE'
) ON CONFLICT DO NOTHING;
