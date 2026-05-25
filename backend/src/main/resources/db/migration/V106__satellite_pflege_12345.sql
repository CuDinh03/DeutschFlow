-- V106: SATELLITE_LEAF — Medizin/Pflege (5 nodes batch)

INSERT INTO skill_tree_nodes (node_type, title_de, title_vi, xp_reward, is_active, content_json, industry)
VALUES
(
  'SATELLITE_LEAF', 'Patientenkommunikation', 'Deutsch mit Patienten: Anamnese, Untersuchung, Aufklärung',
  150, TRUE,
  '{
    "title": {"de": "Patientenkommunikation", "vi": "Giao tiếp với bệnh nhân"},
    "session_type": "SATELLITE", "industry": "PFLEGE",
    "vocabulary": [
      {"id":"pf01_01","german":"die Anamnese","meaning":"hỏi bệnh sử","gender":"DIE","example_de":"Ich mache jetzt eine Anamnese. Seit wann haben Sie Beschwerden?","example_vi":"Tôi hỏi bệnh sử nhé. Từ khi nào có triệu chứng?","tags":["#Pflege"]},
      {"id":"pf01_02","german":"nüchtern","meaning":"nhịn ăn","gender":null,"example_de":"Sie müssen für die OP nüchtern sein — nichts essen ab Mitternacht.","example_vi":"Trước mổ phải nhịn ăn — không ăn từ nửa đêm.","tags":["#Medizin"]},
      {"id":"pf01_03","german":"die Einwilligung","meaning":"sự đồng ý (bệnh nhân)","gender":"DIE","example_de":"Bitte unterschreiben Sie die Einwilligungserklärung.","example_vi":"Ký vào giấy đồng ý điều trị.","tags":["#Medizin"]},
      {"id":"pf01_04","german":"allergisch gegen","meaning":"dị ứng với","gender":null,"example_de":"Sind Sie gegen Penicillin allergisch?","example_vi":"Dị ứng Penicillin không?","tags":["#Anamnese"]},
      {"id":"pf01_05","german":"der Blutdruck","meaning":"huyết áp","gender":"DER","example_de":"Ihr Blutdruck ist etwas erhöht: 140/90.","example_vi":"Huyết áp hơi cao: 140/90.","tags":["#Vitalzeichen"]}
    ],
    "phrases": [
      {"german":"Wo genau tut es weh?","meaning":"Đau ở đâu chính xác?","speak_de":"Wo tut es weh?"},
      {"german":"Können Sie tief einatmen?","meaning":"Hít thở sâu được không?","speak_de":"Bitte einatmen!"},
      {"german":"Ich messe jetzt Ihren Blutdruck.","meaning":"Tôi đo huyết áp nhé.","speak_de":"Ich messe den Blutdruck."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_pf1_01","type":"MULTIPLE_CHOICE","question_vi":"''nüchtern'' trước mổ nghĩa là?","options":["Uống nhiều nước","Nhịn ăn uống","Ăn nhẹ","Uống thuốc"],"correct":1},
        {"id":"sat_pf1_02","type":"FILL_BLANK","sentence_de":"Wo ___ es ___?","hint_vi":"đau ở đâu","answer":"tut, weh","accept_also":["tut / weh"]},
        {"id":"sat_pf1_03","type":"MULTIPLE_CHOICE","question_vi":"''die Anamnese'' là?","options":["Phẫu thuật","Hỏi bệnh sử","Đơn thuốc","Xét nghiệm"],"correct":1}
      ],
      "practice": [{"id":"sat_pf1_p01","type":"TRANSLATE","from":"vi","sentence":"Bạn dị ứng với thuốc gì không? Huyết áp của bạn hơi cao.","answer":"Sind Sie gegen irgendwelche Medikamente allergisch? Ihr Blutdruck ist etwas erhöht."}]
    }
  }'::jsonb,
  'PFLEGE'
),
(
  'SATELLITE_LEAF', 'Pflegealltag & Körperpflege', 'Körperpflege, Mobilisation und Pflegedokumentation',
  150, TRUE,
  '{
    "title": {"de": "Pflegealltag & Körperpflege", "vi": "Chăm sóc điều dưỡng hàng ngày"},
    "session_type": "SATELLITE", "industry": "PFLEGE",
    "vocabulary": [
      {"id":"pf02_01","german":"die Körperpflege","meaning":"vệ sinh cá nhân","gender":"DIE","example_de":"Ich helfe Ihnen bei der Körperpflege.","example_vi":"Tôi giúp bạn vệ sinh cá nhân.","tags":["#Pflege"]},
      {"id":"pf02_02","german":"betten / umbetten","meaning":"thay ga trải giường / đổi giường","gender":null,"example_de":"Ich bette Sie jetzt um.","example_vi":"Tôi đổi ga giường cho bạn nhé.","tags":["#Pflege"]},
      {"id":"pf02_03","german":"mobilisieren","meaning":"vận động/tập đi","gender":null,"example_de":"Wir müssen den Patienten früh mobilisieren.","example_vi":"Phải cho bệnh nhân vận động sớm.","tags":["#Pflege"]},
      {"id":"pf02_04","german":"der Dekubitus","meaning":"loét tỳ đè (vết thương nằm lâu)","gender":"DER","example_de":"Zur Dekubitus-Prophylaxe muss der Patient alle 2 Stunden umgelagert werden.","example_vi":"Phòng loét tỳ đè phải trở người 2 tiếng một lần.","tags":["#Pflege"]},
      {"id":"pf02_05","german":"dokumentieren","meaning":"ghi chép/lập hồ sơ","gender":null,"example_de":"Alles muss genau dokumentiert werden.","example_vi":"Tất cả phải được ghi chép chính xác.","tags":["#Dokumentation"]}
    ],
    "phrases": [
      {"german":"Darf ich Ihnen beim Waschen helfen?","meaning":"Tôi giúp bạn rửa mặt được không?","speak_de":"Darf ich helfen?"},
      {"german":"Ich lagere Sie jetzt um — das verhindert Wundliegen.","meaning":"Tôi trở người — ngăn ngừa loét tỳ đè.","speak_de":"Ich lagere Sie um."},
      {"german":"Haben Sie gut geschlafen?","meaning":"Bạn ngủ ngon không?","speak_de":"Haben Sie gut geschlafen?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_pf2_01","type":"MULTIPLE_CHOICE","question_vi":"Phòng Dekubitus cần trở người bao lâu một lần?","options":["Jede Stunde","Alle 2 Stunden","Alle 4 Stunden","Einmal täglich"],"correct":1},
        {"id":"sat_pf2_02","type":"FILL_BLANK","sentence_de":"Wir müssen den Patienten früh ___.","hint_vi":"vận động","answer":"mobilisieren","accept_also":["mobilisieren"]},
        {"id":"sat_pf2_03","type":"MULTIPLE_CHOICE","question_vi":"''dokumentieren'' trong điều dưỡng nghĩa là?","options":["Chụp ảnh bệnh nhân","Ghi chép hồ sơ bệnh án","Kê đơn thuốc","Thông báo gia đình"],"correct":1}
      ],
      "practice": [{"id":"sat_pf2_p01","type":"TRANSLATE","from":"vi","sentence":"Tôi giúp bạn vệ sinh cá nhân nhé. Sau đó tôi sẽ ghi vào hồ sơ.","answer":"Ich helfe Ihnen bei der Körperpflege. Danach dokumentiere ich alles."}]
    }
  }'::jsonb,
  'PFLEGE'
),
(
  'SATELLITE_LEAF', 'Medikamentengabe & Dokumentation', 'Medikamente verwalten, richten und korrekt dokumentieren',
  150, TRUE,
  '{
    "title": {"de": "Medikamentengabe", "vi": "Cho uống thuốc & Hồ sơ"},
    "session_type": "SATELLITE", "industry": "PFLEGE",
    "vocabulary": [
      {"id":"pf03_01","german":"die Medikamentengabe","meaning":"cho uống thuốc","gender":"DIE","example_de":"Die Medikamentengabe erfolgt dreimal täglich.","example_vi":"Cho uống thuốc 3 lần mỗi ngày.","tags":["#Medizin"]},
      {"id":"pf03_02","german":"richten","meaning":"chuẩn bị thuốc","gender":null,"example_de":"Ich richte jetzt die Medikamente für heute Abend.","example_vi":"Tôi chuẩn bị thuốc tối nay.","tags":["#Pflege"]},
      {"id":"pf03_03","german":"die Unverträglichkeit","meaning":"dị ứng/không dung nạp","gender":"DIE","example_de":"Bitte auf Unverträglichkeiten achten!","example_vi":"Lưu ý các phản ứng không dung nạp!","tags":["#Medizin"]},
      {"id":"pf03_04","german":"intravenös (i.v.)","meaning":"tiêm tĩnh mạch","gender":null,"example_de":"Das Antibiotikum wird intravenös gegeben.","example_vi":"Kháng sinh được tiêm tĩnh mạch.","tags":["#Medizin"]},
      {"id":"pf03_05","german":"die Pflegekurve","meaning":"biểu đồ theo dõi bệnh nhân","gender":"DIE","example_de":"Bitte alle Werte in die Pflegekurve eintragen.","example_vi":"Nhập tất cả chỉ số vào biểu đồ theo dõi.","tags":["#Dokumentation"]}
    ],
    "phrases": [
      {"german":"Hier sind Ihre Tabletten für heute Morgen.","meaning":"Đây là thuốc buổi sáng của bạn.","speak_de":"Hier sind Ihre Tabletten."},
      {"german":"Bitte die Tabletten mit Wasser nehmen.","meaning":"Uống thuốc với nước nhé.","speak_de":"Mit Wasser nehmen."},
      {"german":"Haben Sie Unverträglichkeiten?","meaning":"Bạn có dị ứng thuốc gì không?","speak_de":"Haben Sie Unverträglichkeiten?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_pf3_01","type":"MULTIPLE_CHOICE","question_vi":"''i.v.'' trong y tế nghĩa là?","options":["Uống","Tiêm bắp","Tiêm tĩnh mạch","Nhỏ mắt"],"correct":2},
        {"id":"sat_pf3_02","type":"FILL_BLANK","sentence_de":"Ich ___ jetzt die Medikamente für heute Abend.","hint_vi":"chuẩn bị thuốc","answer":"richte","accept_also":["richte"]},
        {"id":"sat_pf3_03","type":"MULTIPLE_CHOICE","question_vi":"''die Pflegekurve'' là gì?","options":["Lịch làm việc","Biểu đồ theo dõi bệnh nhân","Đơn thuốc","Kế hoạch phẫu thuật"],"correct":1}
      ],
      "practice": [{"id":"sat_pf3_p01","type":"TRANSLATE","from":"vi","sentence":"Đây là thuốc buổi sáng. Uống với nước. Có dị ứng gì không?","answer":"Hier sind Ihre Tabletten für heute Morgen. Bitte mit Wasser nehmen. Haben Sie Unverträglichkeiten?"}]
    }
  }'::jsonb,
  'PFLEGE'
),
(
  'SATELLITE_LEAF', 'Notfallsituationen in der Pflege', 'Erste Hilfe kommunizieren, Notfälle melden und handeln',
  150, TRUE,
  '{
    "title": {"de": "Notfallsituationen", "vi": "Tình huống khẩn cấp"},
    "session_type": "SATELLITE", "industry": "PFLEGE",
    "vocabulary": [
      {"id":"pf04_01","german":"der Notfall","meaning":"tình huống khẩn cấp","gender":"DER","example_de":"Das ist ein Notfall! Rufen Sie sofort den Arzt!","example_vi":"Đây là trường hợp khẩn! Gọi bác sĩ ngay!","tags":["#Notfall"]},
      {"id":"pf04_02","german":"bewusstlos","meaning":"bất tỉnh","gender":null,"example_de":"Der Patient ist bewusstlos — sofort Notarzt!","example_vi":"Bệnh nhân bất tỉnh — gọi cấp cứu ngay!","tags":["#Notfall"]},
      {"id":"pf04_03","german":"reanimieren","meaning":"hồi sức cấp cứu","gender":null,"example_de":"Wir müssen den Patienten reanimieren!","example_vi":"Chúng ta phải hồi sức bệnh nhân!","tags":["#Notfall"]},
      {"id":"pf04_04","german":"stürzen","meaning":"ngã","gender":null,"example_de":"Der Patient ist gestürzt und liegt auf dem Boden.","example_vi":"Bệnh nhân đã ngã và nằm trên sàn.","tags":["#Pflege"]},
      {"id":"pf04_05","german":"die Schmerzen (Pl.)","meaning":"cơn đau","gender":null,"example_de":"Auf einer Skala von 1-10: Wie stark sind Ihre Schmerzen?","example_vi":"Thang 1-10: Đau bao nhiêu?","tags":["#Schmerzen"]}
    ],
    "phrases": [
      {"german":"Notfall! Bitte kommen Sie sofort zu Zimmer 12!","meaning":"Khẩn cấp! Đến phòng 12 ngay!","speak_de":"Notfall, Zimmer zwölf!"},
      {"german":"Der Patient ist gestürzt — kein Bewusstsein!","meaning":"Bệnh nhân ngã — không tỉnh!","speak_de":"Patient gestürzt, bewusstlos!"},
      {"german":"Wie stark sind Ihre Schmerzen von 1 bis 10?","meaning":"Đau mức mấy từ 1 đến 10?","speak_de":"Schmerzen von 1 bis 10?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_pf4_01","type":"MULTIPLE_CHOICE","question_vi":"Bệnh nhân bất tỉnh — làm gì đầu tiên?","options":["Wasser geben","Sofort Notruf betätigen","Warten","Tablette geben"],"correct":1},
        {"id":"sat_pf4_02","type":"FILL_BLANK","sentence_de":"Der Patient ist ___los — sofort Notarzt!","hint_vi":"bất tỉnh","answer":"bewusst","accept_also":["bewusst"]},
        {"id":"sat_pf4_03","type":"MULTIPLE_CHOICE","question_vi":"Thang điểm đau dùng trong y tế từ?","options":["0-5","1-10","0-100","1-5"],"correct":1}
      ],
      "practice": [{"id":"sat_pf4_p01","type":"TRANSLATE","from":"vi","sentence":"Khẩn cấp! Bệnh nhân ngã, không tỉnh. Gọi bác sĩ ngay!","answer":"Notfall! Der Patient ist gestürzt und bewusstlos. Rufen Sie sofort den Arzt!"}]
    }
  }'::jsonb,
  'PFLEGE'
),
(
  'SATELLITE_LEAF', 'Kommunikation mit Angehörigen', 'Gespräche mit Patientenfamilien führen',
  150, TRUE,
  '{
    "title": {"de": "Kommunikation mit Angehörigen", "vi": "Giao tiếp với gia đình bệnh nhân"},
    "session_type": "SATELLITE", "industry": "PFLEGE",
    "vocabulary": [
      {"id":"pf05_01","german":"die Angehörigen (Pl.)","meaning":"người thân","gender":null,"example_de":"Die Angehörigen dürfen von 14-20 Uhr besuchen.","example_vi":"Người thân được thăm từ 14-20 giờ.","tags":["#Pflege"]},
      {"id":"pf05_02","german":"aufklären","meaning":"giải thích/thông báo","gender":null,"example_de":"Ich muss die Angehörigen über den Zustand aufklären.","example_vi":"Tôi phải thông báo cho gia đình về tình trạng bệnh.","tags":["#Kommunikation"]},
      {"id":"pf05_03","german":"der Zustand","meaning":"tình trạng sức khỏe","gender":"DER","example_de":"Der Zustand des Patienten hat sich verbessert.","example_vi":"Tình trạng bệnh nhân đã cải thiện.","tags":["#Medizin"]},
      {"id":"pf05_04","german":"einfühlsam","meaning":"đồng cảm","gender":null,"example_de":"Mit Angehörigen immer einfühlsam sprechen.","example_vi":"Luôn nói chuyện đồng cảm với gia đình bệnh nhân.","tags":["#Kommunikation"]},
      {"id":"pf05_05","german":"die Besuchszeit","meaning":"giờ thăm bệnh","gender":"DIE","example_de":"Die Besuchszeit ist von 15 bis 19 Uhr.","example_vi":"Giờ thăm từ 15-19 giờ.","tags":["#Pflege"]}
    ],
    "phrases": [
      {"german":"Ihr Angehöriger hat gut geschlafen und gegessen.","meaning":"Người thân của bạn ngủ và ăn tốt.","speak_de":"Er hat gut geschlafen."},
      {"german":"Der Zustand hat sich stabilisiert.","meaning":"Tình trạng đã ổn định.","speak_de":"Der Zustand ist stabil."},
      {"german":"Haben Sie noch Fragen?","meaning":"Bạn còn câu hỏi nào không?","speak_de":"Haben Sie Fragen?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_pf5_01","type":"MULTIPLE_CHOICE","question_vi":"Khi nói chuyện với gia đình bệnh nhân cần thái độ gì?","options":["Schnell und kurz","Einfühlsam und geduldig","Streng","Distanziert"],"correct":1},
        {"id":"sat_pf5_02","type":"FILL_BLANK","sentence_de":"Der ___ des Patienten hat sich verbessert.","hint_vi":"tình trạng","answer":"Zustand","accept_also":["zustand"]},
        {"id":"sat_pf5_03","type":"FILL_BLANK","sentence_de":"Die ___ ist von 15 bis 19 Uhr.","hint_vi":"giờ thăm bệnh","answer":"Besuchszeit","accept_also":["besuchszeit"]}
      ],
      "practice": [{"id":"sat_pf5_p01","type":"TRANSLATE","from":"vi","sentence":"Tình trạng bệnh nhân ổn định. Ngủ và ăn tốt. Bạn còn câu hỏi gì không?","answer":"Der Zustand des Patienten ist stabil. Er hat gut geschlafen und gegessen. Haben Sie noch Fragen?"}]
    }
  }'::jsonb,
  'PFLEGE'
);
