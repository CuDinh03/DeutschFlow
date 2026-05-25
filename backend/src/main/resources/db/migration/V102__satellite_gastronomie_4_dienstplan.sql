-- V102__satellite_gastronomie_4_dienstplan.sql
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi,
  xp_reward, is_active, content_json, industry
) VALUES (
  'SATELLITE_LEAF',
  'Dienstplan & Teamkommunikation',
  'Lịch làm việc & Giao tiếp nhóm',
  'Schichtarbeit im Team',
  150,
  TRUE,
  '{
    "title": {"de": "Dienstplan & Teamkommunikation", "vi": "Lịch làm việc & Giao tiếp nhóm"},
    "overview": {"de": "Schichtarbeit verstehen, Übergabe machen und im Team kommunizieren.", "vi": "Hiểu lịch ca, bàn giao ca và giao tiếp trong đội nhóm bếp/nhà hàng."},
    "session_type": "SATELLITE",
    "industry": "GASTRONOMIE",
    "theory_cards": [
      {"type":"RULE","title":{"vi":"Schichtarbeit — Làm ca"},"content":{"vi":"die Frühschicht — ca sáng (6-14h)\ndie Spätschicht — ca chiều (14-22h)\ndie Nachtschicht — ca đêm (22-6h)\ndie Doppelschicht — ca kép (12h)\nÜberstunden machen — làm thêm giờ\ndie Übergabe — bàn giao ca\nder freie Tag — ngày nghỉ\nder Dienstplan — lịch làm việc\nder Urlaub — nghỉ phép\nkrank melden — báo ốm"},"tags":["#Dienstplan","#Arbeit"]},
      {"type":"RULE","title":{"vi":"Küchen-Kommunikation — Lệnh trong bếp"},"content":{"vi":"Achtung! — Cẩn thận!\nHeiß! — Nóng! (khi bê nồi/chảo)\nAbgeholt! — Đã lấy! (khi lấy món)\nBereit! / Ready! — Sẵn sàng!\nBitte wiederholen! — Nhắc lại!\nGut so! — Tốt lắm!\nMit mehr Zug! — Nhanh lên!\nService bitte! — Phục vụ ơi!"},"tags":["#Küche","#Kommunikation"]}
    ],
    "vocabulary": [
      {"id":"sg04_01","german":"der Dienstplan","meaning":"lịch làm việc/ca","gender":"DER","example_de":"Der Dienstplan für nächste Woche hängt am Brett.","example_vi":"Lịch ca tuần tới treo ở bảng tin.","tags":["#Arbeit"]},
      {"id":"sg04_02","german":"die Übergabe","meaning":"bàn giao (ca)","gender":"DIE","example_de":"Bei der Übergabe erkläre ich alles, was noch zu tun ist.","example_vi":"Khi bàn giao ca tôi giải thích những gì còn phải làm.","tags":["#Arbeit"]},
      {"id":"sg04_03","german":"Überstunden (Pl.)","meaning":"giờ làm thêm","gender":null,"example_de":"Heute muss ich Überstunden machen — wir haben viele Reservierungen.","example_vi":"Hôm nay phải làm thêm giờ — có nhiều đặt bàn.","tags":["#Arbeit"]},
      {"id":"sg04_04","german":"krankschreiben","meaning":"được/bị cấp giấy nghỉ ốm","gender":null,"example_de":"Ich bin krankgeschrieben für 3 Tage.","example_vi":"Tôi được cấp giấy nghỉ ốm 3 ngày.","tags":["#Gesundheit","#Arbeit"]},
      {"id":"sg04_05","german":"der Sous-Chef","meaning":"bếp phó","gender":"DER","example_de":"Der Sous-Chef koordiniert die Zubereitung.","example_vi":"Bếp phó điều phối việc chế biến.","tags":["#Hierarchie"]},
      {"id":"sg04_06","german":"die Reinigungsliste","meaning":"danh sách vệ sinh","gender":"DIE","example_de":"Bitte die Reinigungsliste am Ende der Schicht ausfüllen.","example_vi":"Điền danh sách vệ sinh cuối ca.","tags":["#Hygiene"]}
    ],
    "phrases": [
      {"german":"Ich übernehme jetzt die Schicht.","meaning":"Tôi nhận ca bây giờ.","speak_de":"Ich übernehme die Schicht."},
      {"german":"Was ist noch zu erledigen?","meaning":"Còn việc gì cần làm?","speak_de":"Was ist noch zu erledigen?"},
      {"german":"Ich melde mich krank — ich kann heute nicht kommen.","meaning":"Tôi báo ốm — hôm nay không đến được.","speak_de":"Ich melde mich krank."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_g4_01","type":"MULTIPLE_CHOICE","question_vi":"''Frühschicht'' là ca nào?","options":["Ca đêm","Ca chiều","Ca sáng","Ca kép"],"correct":2},
        {"id":"sat_g4_02","type":"FILL_BLANK","sentence_de":"Der ___ für nächste Woche ist fertig.","hint_vi":"lịch làm việc","answer":"Dienstplan","accept_also":["dienstplan"]},
        {"id":"sat_g4_03","type":"MULTIPLE_CHOICE","question_vi":"''Heiß!'' trong bếp nghĩa là?","options":["Nhanh lên","Cẩn thận/Nóng","Xong rồi","Lấy đi"],"correct":1},
        {"id":"sat_g4_04","type":"FILL_BLANK","sentence_de":"Bei der ___ erkläre ich alles, was noch zu tun ist.","hint_vi":"bàn giao ca","answer":"Übergabe","accept_also":["übergabe"]},
        {"id":"sat_g4_05","type":"MULTIPLE_CHOICE","question_vi":"''krankschreiben'' nghĩa là?","options":["Viết tên bệnh nhân","Được cấp giấy nghỉ ốm","Chẩn đoán bệnh","Đăng ký khám bệnh"],"correct":1}
      ],
      "practice": [
        {"id":"sat_g4_p01","type":"TRANSLATE","from":"vi","sentence":"Tôi có ca sáng tuần tới. Tuần này tôi làm thêm 5 giờ.","answer":"Ich habe nächste Woche die Frühschicht. Diese Woche mache ich 5 Überstunden.","accept_also":["Nächste Woche habe ich Frühschicht. Diese Woche habe ich 5 Überstunden gemacht."]},
        {"id":"sat_g4_p02","type":"FILL_BLANK","sentence_de":"Ich ___ mich krank — ich ___ heute leider nicht ___.","hint_vi":"báo ... không ... đến được","answer":"melde, kann, kommen","accept_also":["melde / kann / kommen"]}
      ]
    },
    "reading_passage": {
      "text_de": "Die Übergabe in der Küche\n\nAm Ende jeder Schicht findet die Übergabe statt. Der Koch der Frühschicht erklärt dem Koch der Spätschicht: ''Im Kühlraum ist noch Rindfleisch von heute — muss bis morgen verbraucht werden. Die Fritteuse wurde gereinigt. Wir haben noch 12 Reservierungen für heute Abend. Das Tagesgericht ist Gulasch. Bitte die Reinigungsliste ausfüllen!'' Die Übergabe dauert ca. 10-15 Minuten.",
      "text_vi": "Bàn giao ca trong bếp\n\nCuối mỗi ca diễn ra bàn giao. Đầu bếp ca sáng giải thích cho đầu bếp ca chiều: ''Trong kho lạnh còn thịt bò hôm nay — phải dùng hết trước ngày mai. Nồi chiên đã vệ sinh. Tối nay còn 12 đặt bàn. Món trong ngày là goulash. Điền danh sách vệ sinh!'' Bàn giao mất khoảng 10-15 phút.",
      "questions": [
        {"id":"rq_sg4_01","type":"FILL_BLANK","question_vi":"Thịt bò phải dùng hết khi nào?","answer":"bis morgen","accept_also":["morgen","bis zum nächsten Tag"]},
        {"id":"rq_sg4_02","type":"MULTIPLE_CHOICE","question_vi":"Bàn giao ca mất bao lâu?","options":["5 Minuten","10-15 Minuten","30 Minuten","1 Stunde"],"correct":1}
      ]
    },
    "writing_prompt": {
      "task_de": "Schreiben Sie eine kurze Übergabe-Nachricht für Ihren Kollegen (5 Punkte).",
      "task_vi": "Viết tin nhắn bàn giao ca ngắn cho đồng nghiệp (5 điểm).",
      "min_sentences": 5
    },
    "audio_content": {
      "listen_words": [
        {"text":"Ich übernehme jetzt!","meaning":"Tôi nhận ca!"},
        {"text":"Heiß! Vorsicht!","meaning":"Nóng! Cẩn thận!"},
        {"text":"Was ist noch zu tun?","meaning":"Còn việc gì cần làm?"}
      ]
    }
  }'::jsonb,
  'GASTRONOMIE'
) ON CONFLICT DO NOTHING;
