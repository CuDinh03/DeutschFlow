-- V104__satellite_it_1_hardware.sql
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi,
  xp_reward, is_active, content_json, industry
) VALUES (
  'SATELLITE_LEAF',
  'IT-Arbeitsplatz & Hardware',
  'Máy tính & Phần cứng',
  'IT Support Grundbegriffe',
  150,
  TRUE,
  '{
    "title": {"de": "IT-Arbeitsplatz & Hardware", "vi": "Máy tính & Phần cứng"},
    "overview": {"de": "Grundbegriffe der IT: Hardware, Software, typische IT-Support-Situationen.", "vi": "Thuật ngữ IT cơ bản: phần cứng, phần mềm, và các tình huống hỗ trợ kỹ thuật thường gặp."},
    "session_type": "SATELLITE",
    "industry": "IT",
    "theory_cards": [
      {"type":"RULE","title":{"vi":"Hardware — Phần cứng"},"content":{"vi":"der Computer / der PC — máy tính\nder Laptop / das Notebook\ndas Tablet\nder Bildschirm / der Monitor — màn hình\ndie Tastatur — bàn phím\ndie Maus — chuột\ndas Kabel — dây cáp\nder Drucker — máy in\nder Scanner\nder Router — bộ định tuyến\ndie Festplatte — ổ cứng\nder USB-Stick — USB"},"tags":["#Hardware","#IT"]},
      {"type":"RULE","title":{"vi":"IT-Support Sätze — Câu hỗ trợ kỹ thuật"},"content":{"vi":"Haben Sie das Gerät neu gestartet? — Bạn đã khởi động lại chưa?\nHaben Sie Ihre Zugangsdaten? — Bạn có thông tin đăng nhập không?\nIch muss das System aktualisieren. — Tôi phải cập nhật hệ thống.\nDer Rechner läuft sehr langsam. — Máy chạy rất chậm.\nBitte schicken Sie mir einen Screenshot. — Gửi cho tôi ảnh chụp màn hình.\nIch verbinde mich remote. — Tôi kết nối từ xa.\nDas Passwort zurücksetzen. — Đặt lại mật khẩu."},"tags":["#ITSupport","#Kommunikation"]}
    ],
    "vocabulary": [
      {"id":"it01_01","german":"aktualisieren / updaten","meaning":"cập nhật","gender":null,"example_de":"Bitte das System aktualisieren — es gibt ein neues Update.","example_vi":"Cập nhật hệ thống — có bản cập nhật mới.","tags":["#Software"]},
      {"id":"it01_02","german":"die Zugangsdaten (Pl.)","meaning":"thông tin đăng nhập","gender":null,"example_de":"Ihre Zugangsdaten: Benutzername und Passwort.","example_vi":"Thông tin đăng nhập: tên người dùng và mật khẩu.","tags":["#Sicherheit"]},
      {"id":"it01_03","german":"abstürzen","meaning":"bị treo/crash","gender":null,"example_de":"Das Programm ist abgestürzt — ich muss es neu starten.","example_vi":"Chương trình bị treo — phải khởi động lại.","tags":["#Software"]},
      {"id":"it01_04","german":"die Fehlermeldung","meaning":"thông báo lỗi","gender":"DIE","example_de":"Eine Fehlermeldung erscheint: ''Keine Verbindung''.","example_vi":"Xuất hiện thông báo lỗi: ''Không có kết nối''.","tags":["#IT"]},
      {"id":"it01_05","german":"installieren","meaning":"cài đặt","gender":null,"example_de":"Ich muss die Software neu installieren.","example_vi":"Phải cài đặt lại phần mềm.","tags":["#Software"]},
      {"id":"it01_06","german":"das Netzwerk","meaning":"mạng","gender":"DAS","example_de":"Das Netzwerk ist ausgefallen — kein Internet.","example_vi":"Mạng bị đứt — không có internet.","tags":["#Netzwerk"]},
      {"id":"it01_07","german":"sichern / backup","meaning":"sao lưu","gender":null,"example_de":"Bitte täglich Ihre Daten sichern!","example_vi":"Nhớ sao lưu dữ liệu mỗi ngày!","tags":["#Sicherheit"]}
    ],
    "phrases": [
      {"german":"Haben Sie schon versucht, den Computer neu zu starten?","meaning":"Bạn đã thử khởi động lại máy chưa?","speak_de":"Bitte neu starten."},
      {"german":"Ich schicke Ihnen den Link per E-Mail.","meaning":"Tôi sẽ gửi link qua email.","speak_de":"Ich schicke den Link."},
      {"german":"Das Problem ist gelöst!","meaning":"Vấn đề đã được giải quyết!","speak_de":"Das Problem ist gelöst!"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_it1_01","type":"MULTIPLE_CHOICE","question_vi":"Khi máy tính bị treo, bước đầu tiên cần làm là?","options":["Mua máy mới","Neu starten","Festplatte formatieren","IT anrufen"],"correct":1},
        {"id":"sat_it1_02","type":"FILL_BLANK","sentence_de":"Das Programm ist ___gestürzt — ich starte es neu.","hint_vi":"bị crash","answer":"ab","accept_also":["ab"]},
        {"id":"sat_it1_03","type":"MULTIPLE_CHOICE","question_vi":"''die Festplatte'' là gì?","options":["Bàn phím","Ổ cứng","Màn hình","Chuột"],"correct":1},
        {"id":"sat_it1_04","type":"FILL_BLANK","sentence_de":"Bitte täglich Ihre Daten ___!","hint_vi":"sao lưu","answer":"sichern","accept_also":["sichern"]},
        {"id":"sat_it1_05","type":"MULTIPLE_CHOICE","question_vi":"''Zugangsdaten'' là gì?","options":["Địa chỉ văn phòng","Tên người dùng và mật khẩu","Dữ liệu khách hàng","Hóa đơn phần mềm"],"correct":1}
      ],
      "practice": [
        {"id":"sat_it1_p01","type":"TRANSLATE","from":"vi","sentence":"Máy tính của tôi bị treo. Có thể cài đặt lại phần mềm không?","answer":"Mein Computer ist abgestürzt. Können Sie die Software neu installieren?","accept_also":["Mein PC ist abgestürzt. Kann man die Software neu installieren?"]},
        {"id":"sat_it1_p02","type":"FILL_BLANK","sentence_de":"Eine ___ erscheint: Bitte ___ Sie das System neu.","hint_vi":"thông báo lỗi ... khởi động","answer":"Fehlermeldung, starten","accept_also":["Fehlermeldung / starten"]}
      ]
    },
    "reading_passage": {
      "text_de": "IT-Support im Büro\n\nMinh arbeitet als IT-Supporter in einem deutschen Unternehmen. Heute hat eine Kollegin ein Problem: ''Mein Computer startet nicht und ich bekomme eine Fehlermeldung.'' Minh fragt: ''Haben Sie das Gerät schon neu gestartet?'' — ''Ja, zweimal.'' Minh geht zu ihrem Arbeitsplatz. Er sieht das Problem: Das Kabel zur Festplatte ist locker. Er steckt es wieder ein. Der Computer startet sofort. ''Danke! Das war schnell!''. Minh notiert das Problem im Ticket-System.",
      "text_vi": "Hỗ trợ IT trong văn phòng\n\nMinh làm nhân viên hỗ trợ IT tại một công ty Đức. Hôm nay một đồng nghiệp gặp sự cố: ''Máy tôi không khởi động và có thông báo lỗi.'' Minh hỏi: ''Chị đã khởi động lại chưa?'' — ''Rồi, hai lần.'' Minh đến chỗ làm của cô. Anh thấy vấn đề: Cáp ổ cứng bị lỏng. Anh cắm lại. Máy khởi động ngay. ''Cảm ơn! Nhanh quá!'' Minh ghi lại sự cố trong hệ thống ticket.",
      "questions": [
        {"id":"rq_it1_01","type":"FILL_BLANK","question_vi":"Vấn đề là gì?","answer":"Das Kabel zur Festplatte ist locker","accept_also":["Das Kabel ist locker","locker Kabel"]},
        {"id":"rq_it1_02","type":"MULTIPLE_CHOICE","question_vi":"Sau khi giải quyết Minh làm gì?","options":["Er geht nach Hause","Er notiert das Problem im Ticket-System","Er installiert neue Software","Er kauft einen neuen Computer"],"correct":1}
      ]
    },
    "writing_prompt": {
      "task_de": "Schreiben Sie eine IT-Support-E-Mail: Problem beschreiben, was Sie schon versucht haben und worum Sie bitten.",
      "task_vi": "Viết email hỗ trợ IT: mô tả vấn đề, đã thử gì và cần gì.",
      "min_sentences": 5
    },
    "audio_content": {
      "listen_words": [
        {"text":"Haben Sie es neu gestartet?","meaning":"Đã khởi động lại chưa?"},
        {"text":"Eine Fehlermeldung erscheint.","meaning":"Xuất hiện thông báo lỗi."},
        {"text":"Das Problem ist gelöst!","meaning":"Vấn đề đã giải quyết!"}
      ]
    }
  }'::jsonb,
  'IT'
) ON CONFLICT DO NOTHING;
