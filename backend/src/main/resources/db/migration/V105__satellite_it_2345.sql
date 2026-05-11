-- V105: SATELLITE_LEAF — IT Node 2: Meetings & Präsentationen
-- V106: SATELLITE_LEAF — IT Node 3: Softwareentwicklung
-- V107: SATELLITE_LEAF — IT Node 4: Datenschutz & Sicherheit
-- V108: SATELLITE_LEAF — IT Node 5: Projektmanagement

INSERT INTO skill_tree_nodes (node_type, title_de, title_vi, xp_reward, is_active, content_json, industry)
VALUES
(
  'SATELLITE_LEAF', 'Meetings & Präsentationen', 'Besprechungen leiten, Präsentationen halten, Fragen stellen',
  150, TRUE,
  '{
    "title": {"de": "Meetings & Präsentationen", "vi": "Họp & Thuyết trình"},
    "overview": {"de": "Deutsch in Meetings: moderieren, präsentieren, diskutieren.", "vi": "Tiếng Đức trong cuộc họp: điều phối, thuyết trình, thảo luận."},
    "session_type": "SATELLITE", "industry": "IT",
    "vocabulary": [
      {"id":"it02_01","german":"die Besprechung / das Meeting","meaning":"cuộc họp","gender":"DIE","example_de":"Das Meeting beginnt um 10 Uhr. Bitte pünktlich sein!","example_vi":"Họp lúc 10 giờ. Đúng giờ nhé!","tags":["#Meeting"]},
      {"id":"it02_02","german":"die Tagesordnung","meaning":"chương trình nghị sự","gender":"DIE","example_de":"Hier ist die Tagesordnung für heute.","example_vi":"Đây là chương trình họp hôm nay.","tags":["#Meeting"]},
      {"id":"it02_03","german":"das Protokoll","meaning":"biên bản họp","gender":"DAS","example_de":"Wer schreibt heute das Protokoll?","example_vi":"Hôm nay ai viết biên bản?","tags":["#Meeting"]},
      {"id":"it02_04","german":"die Folie / die Präsentation","meaning":"slide / thuyết trình","gender":"DIE","example_de":"Ich habe 15 Folien vorbereitet.","example_vi":"Tôi đã chuẩn bị 15 slide.","tags":["#Präsentation"]},
      {"id":"it02_05","german":"zusammenfassen","meaning":"tóm tắt","gender":null,"example_de":"Ich fasse kurz zusammen: wir haben drei Optionen.","example_vi":"Tôi tóm tắt ngắn: chúng ta có 3 lựa chọn.","tags":["#Kommunikation"]}
    ],
    "phrases": [
      {"german":"Ich würde gerne einen Punkt hinzufügen.","meaning":"Tôi muốn thêm một điểm.","speak_de":"Ich möchte etwas hinzufügen."},
      {"german":"Haben Sie dazu Fragen?","meaning":"Bạn có câu hỏi không?","speak_de":"Haben Sie Fragen?"},
      {"german":"Wir kommen auf das nächste Thema.","meaning":"Chúng ta chuyển sang chủ đề tiếp theo.","speak_de":"Weiter zum nächsten Punkt."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_it2_01","type":"MULTIPLE_CHOICE","question_vi":"''das Protokoll'' trong cuộc họp là gì?","options":["Chương trình nghị sự","Biên bản họp","Slide thuyết trình","Danh sách người tham dự"],"correct":1},
        {"id":"sat_it2_02","type":"FILL_BLANK","sentence_de":"Ich ___ kurz ___: wir haben drei Optionen. (zusammenfassen)","hint_vi":"tóm tắt","answer":"fasse, zusammen","accept_also":["fasse / zusammen"]},
        {"id":"sat_it2_03","type":"MULTIPLE_CHOICE","question_vi":"''die Tagesordnung'' là?","options":["Danh sách công việc","Chương trình nghị sự","Lịch họp tuần","Biên bản"],"correct":1}
      ],
      "practice": [
        {"id":"sat_it2_p01","type":"TRANSLATE","from":"vi","sentence":"Cuộc họp bắt đầu lúc 9 giờ. Ai viết biên bản hôm nay?","answer":"Das Meeting beginnt um 9 Uhr. Wer schreibt heute das Protokoll?","accept_also":["Die Besprechung fängt um 9 an. Wer schreibt das Protokoll?"]}
      ]
    },
    "reading_passage": {
      "text_de": "Ein typisches Meeting\n\nDas wöchentliche Team-Meeting beginnt montags um 10 Uhr. Der Projektleiter begrüßt alle: ''Willkommen! Hier ist unsere Tagesordnung für heute.'' Er geht durch alle Punkte. Am Ende fasst er zusammen: ''Minh zeigt nächste Woche die neue Funktion.'' Das Protokoll wird danach per E-Mail an alle geschickt.",
      "text_vi": "Một cuộc họp điển hình\n\nHọp nhóm hàng tuần vào thứ Hai lúc 10 giờ. Quản lý dự án chào: ''Chào mừng! Đây là chương trình họp hôm nay.'' Anh đi qua tất cả các điểm. Cuối cùng tóm tắt: ''Minh sẽ demo tính năng mới tuần tới.'' Biên bản sau đó được gửi email cho tất cả.",
      "questions": [
        {"id":"rq_it2_01","type":"FILL_BLANK","question_vi":"Họp nhóm vào thứ mấy?","answer":"Montag","accept_also":["montags","am Montag"]},
        {"id":"rq_it2_02","type":"MULTIPLE_CHOICE","question_vi":"Biên bản được gửi thế nào?","options":["Per Post","Per E-Mail","Im Meeting","Per Fax"],"correct":1}
      ]
    },
    "audio_content": {"listen_words": [{"text":"Das Meeting beginnt jetzt.","meaning":"Họp bắt đầu rồi."},{"text":"Haben Sie Fragen?","meaning":"Bạn có câu hỏi không?"}]}
  }'::jsonb,
  'IT'
),
(
  'SATELLITE_LEAF', 'Softwareentwicklung Grundbegriffe', 'Agile, Scrum, Code Review und Entwicklungsprozesse',
  150, TRUE,
  '{
    "title": {"de": "Softwareentwicklung", "vi": "Phát triển phần mềm"},
    "overview": {"de": "Agile Methoden, Scrum-Begriffe und typische Entwicklersprache.", "vi": "Phương pháp Agile, thuật ngữ Scrum và ngôn ngữ lập trình viên hàng ngày."},
    "session_type": "SATELLITE", "industry": "IT",
    "vocabulary": [
      {"id":"it03_01","german":"der Sprint","meaning":"sprint (1-2 tuần làm việc)","gender":"DER","example_de":"Im nächsten Sprint implementieren wir das Login.","example_vi":"Sprint tới chúng ta làm tính năng đăng nhập.","tags":["#Agile"]},
      {"id":"it03_02","german":"der Bug / der Fehler","meaning":"lỗi phần mềm","gender":"DER","example_de":"Ich habe einen kritischen Bug gefunden.","example_vi":"Tôi tìm thấy lỗi nghiêm trọng.","tags":["#Entwicklung"]},
      {"id":"it03_03","german":"testen","meaning":"kiểm thử","gender":null,"example_de":"Vor dem Release muss die Software gründlich getestet werden.","example_vi":"Trước khi phát hành phải kiểm thử kỹ phần mềm.","tags":["#QA"]},
      {"id":"it03_04","german":"deployen / bereitstellen","meaning":"triển khai","gender":null,"example_de":"Wir deployen morgen auf das Produktivsystem.","example_vi":"Ngày mai chúng ta triển khai lên hệ thống production.","tags":["#DevOps"]},
      {"id":"it03_05","german":"das Ticket","meaning":"ticket/phiếu công việc","gender":"DAS","example_de":"Ich erstelle ein Ticket für diesen Bug.","example_vi":"Tôi tạo ticket cho lỗi này.","tags":["#Projektmanagement"]}
    ],
    "phrases": [
      {"german":"Der Bug ist reproduzierbar.","meaning":"Lỗi có thể tái hiện được.","speak_de":"Der Bug ist reproduzierbar."},
      {"german":"Das Feature ist fertig implementiert.","meaning":"Tính năng đã được lập trình xong.","speak_de":"Das Feature ist fertig."},
      {"german":"Ich brauche einen Code Review.","meaning":"Tôi cần review code.","speak_de":"Ich brauche ein Review."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_it3_01","type":"MULTIPLE_CHOICE","question_vi":"''der Sprint'' trong Scrum là gì?","options":["Chạy nhanh đến deadline","Chu kỳ làm việc 1-4 tuần","Họp hàng ngày","Tài liệu dự án"],"correct":1},
        {"id":"sat_it3_02","type":"FILL_BLANK","sentence_de":"Ich habe einen kritischen ___ gefunden.","hint_vi":"lỗi phần mềm","answer":"Bug","accept_also":["Fehler"]},
        {"id":"sat_it3_03","type":"MULTIPLE_CHOICE","question_vi":"Trước khi ''deployen'' phải làm gì?","options":["Meeting","Testen","Dokumentieren","Präsentieren"],"correct":1}
      ],
      "practice": [
        {"id":"sat_it3_p01","type":"TRANSLATE","from":"vi","sentence":"Sprint này tôi sẽ sửa 3 bugs và tạo tính năng mới.","answer":"In diesem Sprint werde ich 3 Bugs beheben und ein neues Feature implementieren.","accept_also":["Ich fixe 3 Bugs und baue ein neues Feature diesen Sprint."]}
      ]
    },
    "reading_passage": {
      "text_de": "Agile Entwicklung\n\nUnser Team arbeitet nach der Scrum-Methode. Jeder Sprint dauert zwei Wochen. Am Montagmorgen gibt es das Sprint-Planning. Jeden Tag um 9:30 Uhr findet das Daily Standup statt: Jeder sagt, was er gestern gemacht hat, was er heute macht und ob er Probleme hat. Am Ende des Sprints gibt es das Sprint Review und die Retrospektive.",
      "text_vi": "Phát triển Agile\n\nNhóm chúng tôi làm việc theo phương pháp Scrum. Mỗi sprint kéo dài hai tuần. Sáng thứ Hai có Sprint Planning. Mỗi ngày lúc 9:30 có Daily Standup: Mỗi người nói hôm qua làm gì, hôm nay làm gì và có vấn đề gì không. Cuối sprint có Sprint Review và Retrospektive.",
      "questions": [
        {"id":"rq_it3_01","type":"FILL_BLANK","question_vi":"Sprint kéo dài bao lâu?","answer":"zwei Wochen","accept_also":["2 Wochen"]},
        {"id":"rq_it3_02","type":"MULTIPLE_CHOICE","question_vi":"Daily Standup là gì?","options":["Họp hàng tuần","Họp hàng ngày ngắn","Thuyết trình dự án","Kiểm tra code"],"correct":1}
      ]
    },
    "audio_content": {"listen_words": [{"text":"Der Bug ist kritisch.","meaning":"Lỗi nghiêm trọng."},{"text":"Das Feature ist implementiert.","meaning":"Tính năng đã hoàn thành."}]}
  }'::jsonb,
  'IT'
),
(
  'SATELLITE_LEAF', 'Datenschutz & IT-Sicherheit', 'DSGVO, Datenschutz, Passwörter und sichere Kommunikation',
  150, TRUE,
  '{
    "title": {"de": "Datenschutz & IT-Sicherheit", "vi": "Bảo mật dữ liệu & An toàn thông tin"},
    "overview": {"de": "DSGVO-Grundlagen, sichere Passwörter und Phishing-Erkennung.", "vi": "Cơ bản GDPR (DSGVO), mật khẩu an toàn và nhận biết lừa đảo phishing."},
    "session_type": "SATELLITE", "industry": "IT",
    "vocabulary": [
      {"id":"it04_01","german":"die DSGVO","meaning":"GDPR — Luật bảo vệ dữ liệu","gender":"DIE","example_de":"Die DSGVO regelt den Umgang mit personenbezogenen Daten.","example_vi":"DSGVO quy định việc xử lý dữ liệu cá nhân.","tags":["#Datenschutz"]},
      {"id":"it04_02","german":"personenbezogene Daten","meaning":"dữ liệu cá nhân","gender":null,"example_de":"Name, Adresse und E-Mail sind personenbezogene Daten.","example_vi":"Tên, địa chỉ và email là dữ liệu cá nhân.","tags":["#DSGVO"]},
      {"id":"it04_03","german":"das Phishing","meaning":"lừa đảo (email giả mạo)","gender":"DAS","example_de":"Vorsicht! Diese E-Mail ist ein Phishing-Versuch.","example_vi":"Cẩn thận! Email này là lừa đảo phishing.","tags":["#Sicherheit"]},
      {"id":"it04_04","german":"verschlüsseln","meaning":"mã hóa","gender":null,"example_de":"Alle Daten müssen verschlüsselt übertragen werden.","example_vi":"Tất cả dữ liệu phải được truyền tải mã hóa.","tags":["#Sicherheit"]},
      {"id":"it04_05","german":"die Einwilligung","meaning":"sự đồng ý","gender":"DIE","example_de":"Wir brauchen Ihre Einwilligung zur Datenverarbeitung.","example_vi":"Chúng tôi cần sự đồng ý của bạn để xử lý dữ liệu.","tags":["#DSGVO"]}
    ],
    "phrases": [
      {"german":"Bitte nicht auf verdächtige Links klicken!","meaning":"Đừng click vào link đáng ngờ!","speak_de":"Nicht auf Links klicken!"},
      {"german":"Das ist ein Phishing-Versuch — bitte löschen!","meaning":"Đây là lừa đảo phishing — xóa đi!","speak_de":"Bitte die E-Mail löschen!"},
      {"german":"Wir verarbeiten Ihre Daten nur mit Einwilligung.","meaning":"Chúng tôi chỉ xử lý dữ liệu khi có sự đồng ý.","speak_de":"Nur mit Ihrer Einwilligung."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_it4_01","type":"MULTIPLE_CHOICE","question_vi":"DSGVO là gì?","options":["Phần mềm bảo mật","Luật bảo vệ dữ liệu EU","Công cụ mã hóa","Tiêu chuẩn mạng"],"correct":1},
        {"id":"sat_it4_02","type":"FILL_BLANK","sentence_de":"Alle Daten müssen ___ übertragen werden.","hint_vi":"mã hóa","answer":"verschlüsselt","accept_also":["verschlüsselt"]},
        {"id":"sat_it4_03","type":"MULTIPLE_CHOICE","question_vi":"''Phishing'' là?","options":["Kỹ thuật lập trình","Email lừa đảo giả mạo","Công cụ bảo mật","Loại firewall"],"correct":1}
      ],
      "practice": [
        {"id":"sat_it4_p01","type":"TRANSLATE","from":"vi","sentence":"Cẩn thận với email đáng ngờ — không click link, xóa ngay đi!","answer":"Vorsicht bei verdächtigen E-Mails — nicht auf Links klicken und sofort löschen!","accept_also":["Achtung: verdächtige E-Mails nicht öffnen und löschen!"]}
      ]
    },
    "reading_passage": {
      "text_de": "Datenschutz im Unternehmen\n\nSeit 2018 gilt die DSGVO in ganz Europa. Unternehmen müssen personenbezogene Daten (Name, E-Mail, Adresse) schützen. Ohne Einwilligung dürfen keine Daten verarbeitet werden. Bei einem Datenleck muss das Unternehmen die Behörden innerhalb von 72 Stunden informieren. Mitarbeiter werden regelmäßig über Datenschutz und Phishing-Attacken geschult.",
      "text_vi": "Bảo vệ dữ liệu trong doanh nghiệp\n\nTừ 2018 DSGVO có hiệu lực toàn châu Âu. Doanh nghiệp phải bảo vệ dữ liệu cá nhân (tên, email, địa chỉ). Không được xử lý dữ liệu nếu chưa có sự đồng ý. Nếu rò rỉ dữ liệu, doanh nghiệp phải thông báo cơ quan chức năng trong 72 giờ. Nhân viên được đào tạo thường xuyên về bảo mật và phishing.",
      "questions": [
        {"id":"rq_it4_01","type":"FILL_BLANK","question_vi":"DSGVO áp dụng từ năm nào?","answer":"2018","accept_also":["seit 2018"]},
        {"id":"rq_it4_02","type":"MULTIPLE_CHOICE","question_vi":"Phải báo cáo rò rỉ dữ liệu trong bao lâu?","options":["24 Stunden","48 Stunden","72 Stunden","1 Woche"],"correct":2}
      ]
    },
    "audio_content": {"listen_words": [{"text":"Datenschutz ist wichtig!","meaning":"Bảo mật dữ liệu quan trọng!"},{"text":"Vorsicht vor Phishing!","meaning":"Cẩn thận phishing!"}]}
  }'::jsonb,
  'IT'
),
(
  'SATELLITE_LEAF', 'Projektmanagement & Dokumentation', 'Projekte planen, dokumentieren und Berichte schreiben',
  150, TRUE,
  '{
    "title": {"de": "Projektmanagement & Dokumentation", "vi": "Quản lý dự án & Tài liệu"},
    "overview": {"de": "Projekte planen, Meilensteine setzen, Berichte schreiben.", "vi": "Lên kế hoạch dự án, đặt mốc quan trọng và viết báo cáo bằng tiếng Đức."},
    "session_type": "SATELLITE", "industry": "IT",
    "vocabulary": [
      {"id":"it05_01","german":"der Meilenstein","meaning":"mốc quan trọng","gender":"DER","example_de":"Der erste Meilenstein ist die Fertigstellung des Designs.","example_vi":"Mốc đầu tiên là hoàn thành thiết kế.","tags":["#Projekt"]},
      {"id":"it05_02","german":"die Deadline / der Abgabetermin","meaning":"hạn chót","gender":"DIE","example_de":"Die Deadline ist Freitag um 17 Uhr.","example_vi":"Hạn chót là thứ Sáu lúc 17 giờ.","tags":["#Projekt"]},
      {"id":"it05_03","german":"das Lastenheft","meaning":"tài liệu yêu cầu khách hàng","gender":"DAS","example_de":"Zuerst erstellen wir das Lastenheft mit dem Kunden.","example_vi":"Đầu tiên lập tài liệu yêu cầu với khách hàng.","tags":["#Dokumentation"]},
      {"id":"it05_04","german":"der Fortschritt","meaning":"tiến độ","gender":"DER","example_de":"Der Projektfortschritt beträgt 75%.","example_vi":"Tiến độ dự án đạt 75%.","tags":["#Projekt"]},
      {"id":"it05_05","german":"der Auftraggeber","meaning":"bên đặt hàng / khách hàng dự án","gender":"DER","example_de":"Der Auftraggeber möchte wöchentlich einen Statusbericht.","example_vi":"Khách hàng muốn báo cáo tình trạng hàng tuần.","tags":["#Projekt"]}
    ],
    "phrases": [
      {"german":"Wir liegen im Zeitplan.","meaning":"Chúng ta đang đúng tiến độ.","speak_de":"Wir liegen im Zeitplan."},
      {"german":"Das Projekt ist leider in Verzug.","meaning":"Dự án tiếc là bị trễ tiến độ.","speak_de":"Wir sind in Verzug."},
      {"german":"Der Fortschritt beträgt 60%.","meaning":"Tiến độ đạt 60%.","speak_de":"Wir sind bei 60%."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_it5_01","type":"MULTIPLE_CHOICE","question_vi":"''der Meilenstein'' trong dự án là?","options":["Vấn đề quan trọng","Mốc hoàn thành quan trọng","Ngân sách dự án","Họp hàng tuần"],"correct":1},
        {"id":"sat_it5_02","type":"FILL_BLANK","sentence_de":"Wir ___ leider im ___. (trễ tiến độ)","hint_vi":"sind ... Verzug","answer":"sind, Verzug","accept_also":["sind / Verzug"]},
        {"id":"sat_it5_03","type":"MULTIPLE_CHOICE","question_vi":"''Wir liegen im Zeitplan'' nghĩa là?","options":["Chúng ta bị trễ","Chúng ta đúng tiến độ","Dự án kết thúc","Ngân sách vượt"],"correct":1}
      ],
      "practice": [
        {"id":"sat_it5_p01","type":"TRANSLATE","from":"vi","sentence":"Tiến độ dự án đạt 80%. Hạn chót là thứ Sáu tuần tới.","answer":"Der Projektfortschritt beträgt 80%. Die Deadline ist nächsten Freitag.","accept_also":["Wir sind bei 80%. Abgabe ist nächsten Freitag."]}
      ]
    },
    "reading_passage": {
      "text_de": "Wochenbericht an den Auftraggeber\n\nBetreff: Projektstatus KW 20\n\nSehr geehrter Herr Schmidt,\n\nder aktuelle Projektfortschritt beträgt 65%. Meilenstein 1 (Design) wurde erfolgreich abgeschlossen. Meilenstein 2 (Backend) ist in Arbeit — wir liegen im Zeitplan. Für Meilenstein 3 (Frontend) starten wir nächste Woche. Die Deadline 30. Juni ist realistisch.",
      "text_vi": "Báo cáo tuần cho khách hàng\n\nChủ đề: Tình trạng dự án tuần 20\n\nKính gửi ông Schmidt,\n\nTiến độ dự án hiện tại 65%. Mốc 1 (Thiết kế) đã hoàn thành thành công. Mốc 2 (Backend) đang thực hiện — đúng tiến độ. Mốc 3 (Frontend) bắt đầu tuần tới. Hạn chót 30/6 là khả thi.",
      "questions": [
        {"id":"rq_it5_01","type":"FILL_BLANK","question_vi":"Tiến độ dự án hiện tại?","answer":"65%","accept_also":["fünfundsechzig Prozent"]},
        {"id":"rq_it5_02","type":"MULTIPLE_CHOICE","question_vi":"Mốc nào đã hoàn thành?","options":["Frontend","Backend","Design","Testing"],"correct":2}
      ]
    },
    "audio_content": {"listen_words": [{"text":"Wir liegen im Zeitplan.","meaning":"Đúng tiến độ."},{"text":"Die Deadline ist Freitag.","meaning":"Hạn chót là thứ Sáu."}]}
  }'::jsonb,
  'IT'
);
