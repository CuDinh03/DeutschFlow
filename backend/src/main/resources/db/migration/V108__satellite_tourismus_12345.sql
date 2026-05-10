-- V108: SATELLITE_LEAF — Tourismus/Hotel (5 nodes)

INSERT INTO skill_tree_nodes (node_type, title_de, title_vi, xp_reward, is_active, content_json, industry)
VALUES
(
  'SATELLITE_LEAF', 'Rezeption & Check-in', 'Gäste empfangen, einchecken und informieren',
  150, TRUE,
  '{
    "title": {"de": "Rezeption & Check-in", "vi": "Lễ tân & Nhận phòng"},
    "session_type": "SATELLITE", "industry": "TOURISMUS",
    "vocabulary": [
      {"id":"tu01_01","german":"einchecken","meaning":"nhận phòng","gender":null,"example_de":"Ich möchte einchecken — auf den Namen Nguyen.","example_vi":"Tôi muốn nhận phòng — tên Nguyen.","tags":["#Hotel"]},
      {"id":"tu01_02","german":"auschecken","meaning":"trả phòng","gender":null,"example_de":"Checkout ist bis 11 Uhr.","example_vi":"Trả phòng trước 11 giờ.","tags":["#Hotel"]},
      {"id":"tu01_03","german":"das Einzelzimmer / Doppelzimmer","meaning":"phòng đơn / đôi","gender":"DAS","example_de":"Sie haben ein Doppelzimmer für 3 Nächte gebucht.","example_vi":"Bạn đã đặt phòng đôi 3 đêm.","tags":["#Hotel"]},
      {"id":"tu01_04","german":"der Zimmerschlüssel","meaning":"chìa khóa phòng","gender":"DER","example_de":"Hier ist Ihr Zimmerschlüssel — Zimmer 204.","example_vi":"Đây là chìa khóa — phòng 204.","tags":["#Hotel"]},
      {"id":"tu01_05","german":"das Frühstücksbuffet","meaning":"bữa sáng buffet","gender":"DAS","example_de":"Das Frühstücksbuffet ist von 7 bis 10 Uhr.","example_vi":"Buffet sáng từ 7-10 giờ.","tags":["#Hotel"]}
    ],
    "phrases": [
      {"german":"Willkommen im Hotel! Darf ich Ihren Namen?","meaning":"Chào mừng đến khách sạn! Tên quý khách?","speak_de":"Willkommen! Darf ich Ihren Namen?"},
      {"german":"Sie haben Zimmer 305 im dritten Stock.","meaning":"Phòng 305 tầng 3 ạ.","speak_de":"Zimmer dreihundertfünf."},
      {"german":"Frühstück ist inklusive — von 7 bis 10 Uhr.","meaning":"Bữa sáng đã bao gồm — từ 7-10 giờ.","speak_de":"Frühstück ist inklusive."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_tu1_01","type":"FILL_BLANK","sentence_de":"Checkout ist bis ___ Uhr.","hint_vi":"11 giờ","answer":"11","accept_also":["elf"]},
        {"id":"sat_tu1_02","type":"MULTIPLE_CHOICE","question_vi":"''Einzelzimmer'' là loại phòng gì?","options":["Phòng gia đình","Phòng đơn","Phòng đôi","Phòng suite"],"correct":1},
        {"id":"sat_tu1_03","type":"FILL_BLANK","sentence_de":"Hier ist Ihr ___ — Zimmer 204.","hint_vi":"chìa khóa","answer":"Zimmerschlüssel","accept_also":["schlüssel"]}
      ],
      "practice": [{"id":"sat_tu1_p01","type":"TRANSLATE","from":"vi","sentence":"Chào mừng! Tên quý khách? Bạn đã đặt phòng đôi 2 đêm. Đây là chìa khóa phòng 312.","answer":"Willkommen! Darf ich Ihren Namen? Sie haben ein Doppelzimmer für 2 Nächte gebucht. Hier ist Ihr Schlüssel — Zimmer 312."}]
    }
  }'::jsonb,
  'TOURISMUS'
),
(
  'SATELLITE_LEAF', 'Touristeninfos & Ausflüge', 'Sehenswürdigkeiten beschreiben und Ausflüge empfehlen',
  150, TRUE,
  '{
    "title": {"de": "Touristeninfos & Ausflüge", "vi": "Thông tin du lịch & Tham quan"},
    "session_type": "SATELLITE", "industry": "TOURISMUS",
    "vocabulary": [
      {"id":"tu02_01","german":"die Sehenswürdigkeit","meaning":"điểm tham quan","gender":"DIE","example_de":"Die wichtigsten Sehenswürdigkeiten sind...","example_vi":"Các điểm tham quan chính là...","tags":["#Tourismus"]},
      {"id":"tu02_02","german":"der Stadtplan","meaning":"bản đồ thành phố","gender":"DER","example_de":"Hier ist ein Stadtplan — kostenlos!","example_vi":"Đây là bản đồ thành phố — miễn phí!","tags":["#Tourismus"]},
      {"id":"tu02_03","german":"besichtigen","meaning":"tham quan","gender":null,"example_de":"Möchten Sie das Schloss besichtigen?","example_vi":"Bạn muốn tham quan lâu đài không?","tags":["#Tourismus"]},
      {"id":"tu02_04","german":"der Eintritt","meaning":"vé vào cửa","gender":"DER","example_de":"Der Eintritt kostet 12 Euro, für Kinder 6 Euro.","example_vi":"Vé vào cửa 12 Euro, trẻ em 6 Euro.","tags":["#Museum"]},
      {"id":"tu02_05","german":"die Führung","meaning":"tour có hướng dẫn","gender":"DIE","example_de":"Eine Stadtführung dauert 2 Stunden.","example_vi":"Tour thành phố kéo dài 2 tiếng.","tags":["#Tourismus"]}
    ],
    "phrases": [
      {"german":"Was kann man in der Stadt besichtigen?","meaning":"Có thể tham quan gì ở thành phố?","speak_de":"Was kann man besichtigen?"},
      {"german":"Ich empfehle eine Bootsfahrt auf dem Rhein.","meaning":"Tôi gợi ý đi thuyền trên sông Rhine.","speak_de":"Ich empfehle eine Bootsfahrt."},
      {"german":"Die Führung beginnt um 10 Uhr am Rathaus.","meaning":"Tour bắt đầu lúc 10 giờ ở tòa thị chính.","speak_de":"Die Führung beginnt um zehn."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_tu2_01","type":"MULTIPLE_CHOICE","question_vi":"''der Eintritt'' là?","options":["Lối vào","Vé vào cửa","Hướng dẫn viên","Bản đồ"],"correct":1},
        {"id":"sat_tu2_02","type":"FILL_BLANK","sentence_de":"Eine Stadt___ dauert ca. 2 Stunden.","hint_vi":"tour thành phố","answer":"führung","accept_also":["Führung"]},
        {"id":"sat_tu2_03","type":"MULTIPLE_CHOICE","question_vi":"''besichtigen'' nghĩa là?","options":["Mua vé","Tham quan","Chụp ảnh","Ăn uống"],"correct":1}
      ],
      "practice": [{"id":"sat_tu2_p01","type":"TRANSLATE","from":"vi","sentence":"Bạn muốn tham quan gì? Tôi gợi ý bảo tàng và tour thành phố lúc 10 giờ.","answer":"Was möchten Sie besichtigen? Ich empfehle das Museum und eine Stadtführung um 10 Uhr."}]
    }
  }'::jsonb,
  'TOURISMUS'
),
(
  'SATELLITE_LEAF', 'Beschwerden im Hotel', 'Gastbeschwerden lösen: Zimmerprobleme, Lärm, Service',
  150, TRUE,
  '{
    "title": {"de": "Beschwerden im Hotel", "vi": "Xử lý phàn nàn khách sạn"},
    "session_type": "SATELLITE", "industry": "TOURISMUS",
    "vocabulary": [
      {"id":"tu03_01","german":"der Lärm","meaning":"tiếng ồn","gender":"DER","example_de":"Es ist zu laut — der Lärm stört mich.","example_vi":"Ồn quá — tiếng ồn làm tôi khó chịu.","tags":["#Hotel"]},
      {"id":"tu03_02","german":"verstopft","meaning":"tắc nghẽn","gender":null,"example_de":"Das WC ist verstopft.","example_vi":"Toilet bị tắc.","tags":["#Hotel"]},
      {"id":"tu03_03","german":"umziehen (Zimmer)","meaning":"đổi phòng","gender":null,"example_de":"Kann ich in ein ruhigeres Zimmer umziehen?","example_vi":"Tôi có thể đổi sang phòng yên tĩnh hơn không?","tags":["#Hotel"]},
      {"id":"tu03_04","german":"der Techniker","meaning":"kỹ thuật viên","gender":"DER","example_de":"Ich schicke sofort einen Techniker.","example_vi":"Tôi gửi kỹ thuật viên ngay.","tags":["#Hotel"]},
      {"id":"tu03_05","german":"entschädigen","meaning":"bồi thường","gender":null,"example_de":"Wir entschädigen Sie mit einem Freigetränk.","example_vi":"Chúng tôi bồi thường bằng một đồ uống miễn phí.","tags":["#Service"]}
    ],
    "phrases": [
      {"german":"Es tut mir sehr leid! Ich kümmere mich sofort darum.","meaning":"Tôi rất xin lỗi! Tôi xử lý ngay.","speak_de":"Ich kümmere mich darum!"},
      {"german":"Kann ich Ihnen ein anderes Zimmer anbieten?","meaning":"Tôi có thể đổi phòng cho bạn không?","speak_de":"Möchten Sie ein anderes Zimmer?"},
      {"german":"Als Entschuldigung bieten wir Ihnen das Frühstück an.","meaning":"Xin lỗi, chúng tôi mời bữa sáng.","speak_de":"Das Frühstück ist auf uns."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_tu3_01","type":"MULTIPLE_CHOICE","question_vi":"Khách than phòng ồn, bạn làm gì đầu tiên?","options":["Nichts tun","Entschuldigen und Lösung anbieten","Sagen: das ist normal","Den Preis senken"],"correct":1},
        {"id":"sat_tu3_02","type":"FILL_BLANK","sentence_de":"Das WC ist ___. Ich schicke sofort einen ___.","hint_vi":"tắc ... kỹ thuật viên","answer":"verstopft, Techniker","accept_also":["verstopft / Techniker"]},
        {"id":"sat_tu3_03","type":"MULTIPLE_CHOICE","question_vi":"''entschädigen'' nghĩa là?","options":["Xin lỗi","Bồi thường","Giải thích","Chuyển phòng"],"correct":1}
      ],
      "practice": [{"id":"sat_tu3_p01","type":"TRANSLATE","from":"vi","sentence":"Xin lỗi vì tiếng ồn. Tôi có thể đổi phòng yên tĩnh hơn cho bạn. Chúng tôi mời bữa sáng.","answer":"Es tut mir leid wegen des Lärms. Ich kann Ihnen ein ruhigeres Zimmer anbieten. Das Frühstück geht auf uns."}]
    }
  }'::jsonb,
  'TOURISMUS'
),
(
  'SATELLITE_LEAF', 'Reisebüro & Buchungen', 'Reisen buchen, beraten und Stornierungen bearbeiten',
  150, TRUE,
  '{
    "title": {"de": "Reisebüro & Buchungen", "vi": "Đặt tour & Hủy đặt chỗ"},
    "session_type": "SATELLITE", "industry": "TOURISMUS",
    "vocabulary": [
      {"id":"tu04_01","german":"stornieren","meaning":"hủy đặt chỗ","gender":null,"example_de":"Ich möchte meine Buchung stornieren.","example_vi":"Tôi muốn hủy đặt chỗ.","tags":["#Reise"]},
      {"id":"tu04_02","german":"die Stornierungsgebühr","meaning":"phí hủy","gender":"DIE","example_de":"Bei Stornierung unter 24h fällt eine Gebühr an.","example_vi":"Hủy trước 24h có phí.","tags":["#Reise"]},
      {"id":"tu04_03","german":"inklusive","meaning":"bao gồm","gender":null,"example_de":"All-inclusive: Flug, Hotel und Mahlzeiten inklusive.","example_vi":"All-inclusive: bao gồm vé máy bay, khách sạn và bữa ăn.","tags":["#Reise"]},
      {"id":"tu04_04","german":"der Reisepass","meaning":"hộ chiếu","gender":"DER","example_de":"Bitte Reisepass und Buchungsbestätigung mitbringen.","example_vi":"Mang theo hộ chiếu và xác nhận đặt chỗ.","tags":["#Reise"]},
      {"id":"tu04_05","german":"die Reiserücktrittsversicherung","meaning":"bảo hiểm hủy chuyến","gender":"DIE","example_de":"Empfehlenswert: eine Reiserücktrittsversicherung abschließen.","example_vi":"Nên mua bảo hiểm hủy chuyến.","tags":["#Versicherung"]}
    ],
    "phrases": [
      {"german":"Ich möchte eine Reise nach Österreich buchen.","meaning":"Tôi muốn đặt tour Áo.","speak_de":"Ich möchte eine Reise buchen."},
      {"german":"Kann ich kostenlos stornieren?","meaning":"Tôi có thể hủy miễn phí không?","speak_de":"Kann ich kostenlos stornieren?"},
      {"german":"Ich empfehle eine Reiserücktrittsversicherung.","meaning":"Tôi gợi ý mua bảo hiểm hủy chuyến.","speak_de":"Ich empfehle eine Versicherung."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_tu4_01","type":"MULTIPLE_CHOICE","question_vi":"''All-inclusive'' bao gồm gì?","options":["Chỉ khách sạn","Khách sạn và bữa ăn","Máy bay, khách sạn và bữa ăn","Tất cả trừ vé máy bay"],"correct":2},
        {"id":"sat_tu4_02","type":"FILL_BLANK","sentence_de":"Ich möchte meine Buchung ___.","hint_vi":"hủy đặt chỗ","answer":"stornieren","accept_also":["stornieren"]},
        {"id":"sat_tu4_03","type":"MULTIPLE_CHOICE","question_vi":"Tài liệu cần mang khi check-in sân bay?","options":["Personalausweis und Kreditkarte","Reisepass und Buchungsbestätigung","Nur Reisepass","Nur Buchungsbestätigung"],"correct":1}
      ],
      "practice": [{"id":"sat_tu4_p01","type":"TRANSLATE","from":"vi","sentence":"Tôi muốn hủy đặt chỗ. Có phí hủy không? Tôi cần bảo hiểm hủy chuyến không?","answer":"Ich möchte meine Buchung stornieren. Gibt es eine Stornierungsgebühr? Brauche ich eine Reiserücktrittsversicherung?"}]
    }
  }'::jsonb,
  'TOURISMUS'
),
(
  'SATELLITE_LEAF', 'Housekeeping & Zimmerservice', 'Zimmerpflege, Wäsche und Roomservice koordinieren',
  150, TRUE,
  '{
    "title": {"de": "Housekeeping & Zimmerservice", "vi": "Dọn phòng & Room Service"},
    "session_type": "SATELLITE", "industry": "TOURISMUS",
    "vocabulary": [
      {"id":"tu05_01","german":"das Housekeeping","meaning":"bộ phận buồng phòng","gender":"DAS","example_de":"Housekeeping reinigt die Zimmer täglich.","example_vi":"Bộ phận buồng phòng dọn mỗi ngày.","tags":["#Hotel"]},
      {"id":"tu05_02","german":"die Bettwäsche wechseln","meaning":"thay ga giường","gender":null,"example_de":"Soll ich die Bettwäsche wechseln?","example_vi":"Tôi có nên thay ga không?","tags":["#Hotel"]},
      {"id":"tu05_03","german":"der Zimmerservice","meaning":"room service","gender":"DER","example_de":"Zimmerservice ist bis 23 Uhr verfügbar.","example_vi":"Room service có đến 23 giờ.","tags":["#Hotel"]},
      {"id":"tu05_04","german":"bitte nicht stören","meaning":"xin đừng làm phiền","gender":null,"example_de":"Das Schild ''Bitte nicht stören'' hängt an der Tür.","example_vi":"Biển ''Xin đừng làm phiền'' treo ở cửa.","tags":["#Hotel"]},
      {"id":"tu05_05","german":"nachfüllen","meaning":"bổ sung (đồ dùng)","gender":null,"example_de":"Bitte Handtücher und Seife nachfüllen.","example_vi":"Bổ sung khăn tắm và xà phòng.","tags":["#Hotel"]}
    ],
    "phrases": [
      {"german":"Wann darf ich Ihr Zimmer reinigen?","meaning":"Tôi dọn phòng lúc nào được?","speak_de":"Wann darf ich reinigen?"},
      {"german":"Möchten Sie frische Handtücher?","meaning":"Bạn muốn khăn sạch không?","speak_de":"Frische Handtücher?"},
      {"german":"Ihr Zimmer ist fertig gereinigt.","meaning":"Phòng đã được dọn xong.","speak_de":"Das Zimmer ist fertig."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_tu5_01","type":"MULTIPLE_CHOICE","question_vi":"''Bitte nicht stören'' trên cửa phòng nghĩa là?","options":["Vui lòng vào dọn phòng","Xin đừng làm phiền","Room service","Hãy gọi cho tôi"],"correct":1},
        {"id":"sat_tu5_02","type":"FILL_BLANK","sentence_de":"Bitte Handtücher ___!","hint_vi":"bổ sung","answer":"nachfüllen","accept_also":["nachfüllen"]},
        {"id":"sat_tu5_03","type":"MULTIPLE_CHOICE","question_vi":"Zimmerservice có đến mấy giờ?","options":["20 Uhr","22 Uhr","23 Uhr","Mitternacht"],"correct":2}
      ],
      "practice": [{"id":"sat_tu5_p01","type":"TRANSLATE","from":"vi","sentence":"Tôi dọn phòng lúc nào được? Bạn muốn thay ga và khăn sạch không?","answer":"Wann darf ich Ihr Zimmer reinigen? Möchten Sie frische Bettwäsche und Handtücher?"}]
    }
  }'::jsonb,
  'TOURISMUS'
);
