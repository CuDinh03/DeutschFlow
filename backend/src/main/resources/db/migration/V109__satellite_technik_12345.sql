-- V109: SATELLITE_LEAF — Technik/Maschinenbau (5 nodes)

INSERT INTO skill_tree_nodes (node_type, title_de, title_vi, xp_reward, is_active, content_json, industry)
VALUES
(
  'SATELLITE_LEAF', 'Werkzeuge & Maschinen', 'Werkzeugkunde, Maschinenbedienung und Sicherheit',
  150, TRUE,
  '{
    "title": {"de": "Werkzeuge & Maschinen", "vi": "Dụng cụ & Máy móc"},
    "session_type": "SATELLITE", "industry": "TECHNIK",
    "vocabulary": [
      {"id":"te01_01","german":"der Schraubenzieher","meaning":"tua vít","gender":"DER","example_de":"Ich brauche einen Schraubenzieher — Kreuzschlitz.","example_vi":"Tôi cần tua vít đầu chữ thập.","tags":["#Werkzeug"]},
      {"id":"te01_02","german":"der Schraubenschlüssel","meaning":"cờ lê","gender":"DER","example_de":"Bitte den 13er Schraubenschlüssel!","example_vi":"Cờ lê 13 nhé!","tags":["#Werkzeug"]},
      {"id":"te01_03","german":"die Bohrmaschine","meaning":"máy khoan","gender":"DIE","example_de":"Schutzbrille beim Bohren tragen!","example_vi":"Đeo kính bảo hộ khi khoan!","tags":["#Maschinen"]},
      {"id":"te01_04","german":"die Sicherheitsvorschriften","meaning":"quy định an toàn","gender":null,"example_de":"Die Sicherheitsvorschriften müssen eingehalten werden!","example_vi":"Phải tuân thủ quy định an toàn!","tags":["#Sicherheit"]},
      {"id":"te01_05","german":"die Schutzausrüstung","meaning":"trang bị bảo hộ","gender":"DIE","example_de":"PSA: Helm, Handschuhe, Sicherheitsschuhe.","example_vi":"BHLĐ: mũ bảo hộ, găng tay, giày an toàn.","tags":["#Sicherheit"]}
    ],
    "phrases": [
      {"german":"Bitte Schutzbrille und Handschuhe tragen!","meaning":"Đeo kính và găng tay!","speak_de":"Schutzbrille tragen!"},
      {"german":"Die Maschine ist außer Betrieb.","meaning":"Máy đang hỏng/ngừng hoạt động.","speak_de":"Außer Betrieb!"},
      {"german":"Welches Werkzeug brauchen Sie?","meaning":"Bạn cần dụng cụ gì?","speak_de":"Welches Werkzeug?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_te1_01","type":"MULTIPLE_CHOICE","question_vi":"PSA là gì trong ngành kỹ thuật?","options":["Phần mềm thiết kế","Trang bị bảo hộ cá nhân","Tiêu chuẩn kỹ thuật","Quy trình sản xuất"],"correct":1},
        {"id":"sat_te1_02","type":"FILL_BLANK","sentence_de":"Die ___ müssen eingehalten werden!","hint_vi":"quy định an toàn","answer":"Sicherheitsvorschriften","accept_also":["sicherheitsvorschriften"]},
        {"id":"sat_te1_03","type":"MULTIPLE_CHOICE","question_vi":"''außer Betrieb'' nghĩa là?","options":["Đang hoạt động","Đang bảo trì","Ngừng hoạt động/hỏng","Được nâng cấp"],"correct":2}
      ],
      "practice": [{"id":"sat_te1_p01","type":"TRANSLATE","from":"vi","sentence":"Đeo kính và mũ bảo hộ! Máy khoan đang hỏng hôm nay.","answer":"Bitte Schutzbrille und Helm tragen! Die Bohrmaschine ist heute außer Betrieb."}]
    }
  }'::jsonb,
  'TECHNIK'
),
(
  'SATELLITE_LEAF', 'Technische Zeichnungen lesen', 'Maßangaben, Toleranzen und Zeichnungsbegriffe',
  150, TRUE,
  '{
    "title": {"de": "Technische Zeichnungen", "vi": "Đọc bản vẽ kỹ thuật"},
    "session_type": "SATELLITE", "industry": "TECHNIK",
    "vocabulary": [
      {"id":"te02_01","german":"der Maßstab","meaning":"tỷ lệ bản vẽ","gender":"DER","example_de":"Maßstab 1:100 bedeutet: 1 cm = 1 m.","example_vi":"Tỷ lệ 1:100 nghĩa là: 1cm = 1m.","tags":["#Zeichnung"]},
      {"id":"te02_02","german":"die Toleranz","meaning":"dung sai","gender":"DIE","example_de":"Toleranz: ±0,1 mm.","example_vi":"Dung sai: ±0,1mm.","tags":["#Technik"]},
      {"id":"te02_03","german":"der Durchmesser","meaning":"đường kính","gender":"DER","example_de":"Durchmesser 50 mm — Symbol: Ø 50.","example_vi":"Đường kính 50mm — ký hiệu: Ø 50.","tags":["#Maße"]},
      {"id":"te02_04","german":"die Ansicht","meaning":"hình chiếu","gender":"DIE","example_de":"Vorderansicht, Seitenansicht, Draufsicht.","example_vi":"Hình chiếu đứng, cạnh, bằng.","tags":["#Zeichnung"]},
      {"id":"te02_05","german":"das Bauteil","meaning":"chi tiết/linh kiện","gender":"DAS","example_de":"Das Bauteil muss aus Edelstahl gefertigt werden.","example_vi":"Chi tiết phải làm từ thép không gỉ.","tags":["#Technik"]}
    ],
    "phrases": [
      {"german":"Was ist die Toleranz für diese Bohrung?","meaning":"Dung sai cho lỗ khoan này là bao nhiêu?","speak_de":"Was ist die Toleranz?"},
      {"german":"Der Maßstab ist 1 zu 50.","meaning":"Tỷ lệ là 1:50.","speak_de":"Maßstab eins zu fünfzig."},
      {"german":"Das Bauteil ist aus Aluminium.","meaning":"Chi tiết làm từ nhôm.","speak_de":"Aus Aluminium."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_te2_01","type":"MULTIPLE_CHOICE","question_vi":"Maßstab 1:100 nghĩa là gì?","options":["1m = 100cm trên bản vẽ","1cm trên bản vẽ = 1m thực tế","100cm = 1m","Không liên quan"],"correct":1},
        {"id":"sat_te2_02","type":"FILL_BLANK","sentence_de":"Ø 30 mm bedeutet: ___ 30 mm.","hint_vi":"đường kính","answer":"Durchmesser","accept_also":["durchmesser"]},
        {"id":"sat_te2_03","type":"MULTIPLE_CHOICE","question_vi":"''die Toleranz'' trong kỹ thuật là?","options":["Kích thước chính xác","Giới hạn sai số cho phép","Vật liệu chế tạo","Phương pháp gia công"],"correct":1}
      ],
      "practice": [{"id":"sat_te2_p01","type":"TRANSLATE","from":"vi","sentence":"Chi tiết này có đường kính 25mm và dung sai ±0,05mm. Vật liệu là thép không gỉ.","answer":"Dieses Bauteil hat einen Durchmesser von 25 mm und eine Toleranz von ±0,05 mm. Das Material ist Edelstahl."}]
    }
  }'::jsonb,
  'TECHNIK'
),
(
  'SATELLITE_LEAF', 'Produktionsprozesse & Qualität', 'Fertigung, Qualitätskontrolle und Fehleranalyse',
  150, TRUE,
  '{
    "title": {"de": "Produktion & Qualitätskontrolle", "vi": "Sản xuất & Kiểm tra chất lượng"},
    "session_type": "SATELLITE", "industry": "TECHNIK",
    "vocabulary": [
      {"id":"te03_01","german":"die Qualitätskontrolle (QK)","meaning":"kiểm tra chất lượng","gender":"DIE","example_de":"Jedes Produkt muss durch die QK.","example_vi":"Mỗi sản phẩm phải qua kiểm tra chất lượng.","tags":["#Qualität"]},
      {"id":"te03_02","german":"der Ausschuss","meaning":"phế phẩm","gender":"DER","example_de":"Ausschussrate: unter 1% ist akzeptabel.","example_vi":"Tỷ lệ phế phẩm: dưới 1% chấp nhận được.","tags":["#Produktion"]},
      {"id":"te03_03","german":"nacharbeiten","meaning":"gia công lại","gender":null,"example_de":"Das Bauteil muss nachgearbeitet werden.","example_vi":"Chi tiết phải được gia công lại.","tags":["#Produktion"]},
      {"id":"te03_04","german":"der Stückzahl","meaning":"số lượng sản phẩm","gender":"DER","example_de":"Tagesstückzahl: 500 Teile.","example_vi":"Sản lượng ngày: 500 chi tiết.","tags":["#Produktion"]},
      {"id":"te03_05","german":"Lean Production","meaning":"sản xuất tinh gọn","gender":null,"example_de":"Wir arbeiten nach dem Lean-Prinzip.","example_vi":"Chúng tôi làm theo nguyên tắc Lean.","tags":["#Produktion"]}
    ],
    "phrases": [
      {"german":"Die Ausschussrate ist zu hoch — Ursache suchen!","meaning":"Tỷ lệ phế phẩm quá cao — tìm nguyên nhân!","speak_de":"Ausschussrate zu hoch!"},
      {"german":"Dieses Teil ist nicht in Ordnung — Nacharbeit!","meaning":"Chi tiết này không đạt — gia công lại!","speak_de":"Nicht in Ordnung, Nacharbeit!"},
      {"german":"Tagesproduktion: 480 Teile — Ziel erreicht!","meaning":"Sản xuất ngày: 480 chi tiết — đạt mục tiêu!","speak_de":"Ziel erreicht!"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_te3_01","type":"MULTIPLE_CHOICE","question_vi":"''der Ausschuss'' trong sản xuất là?","options":["Sản phẩm tốt","Phế phẩm không đạt tiêu chuẩn","Bộ phận kiểm soát","Nguyên liệu thô"],"correct":1},
        {"id":"sat_te3_02","type":"FILL_BLANK","sentence_de":"Das Bauteil muss ___ werden.","hint_vi":"gia công lại","answer":"nachgearbeitet","accept_also":["nachgearbeitet"]},
        {"id":"sat_te3_03","type":"MULTIPLE_CHOICE","question_vi":"Lean Production là gì?","options":["Sản xuất chậm","Sản xuất tinh gọn giảm lãng phí","Sản xuất lớn","Sản xuất thủ công"],"correct":1}
      ],
      "practice": [{"id":"sat_te3_p01","type":"TRANSLATE","from":"vi","sentence":"Hôm nay tỷ lệ phế phẩm 2% — quá cao. 5 chi tiết phải gia công lại.","answer":"Heute beträgt die Ausschussrate 2% — zu hoch. 5 Bauteile müssen nachgearbeitet werden."}]
    }
  }'::jsonb,
  'TECHNIK'
),
(
  'SATELLITE_LEAF', 'Wartung & Instandhaltung', 'Wartungsarbeiten planen, durchführen und protokollieren',
  150, TRUE,
  '{
    "title": {"de": "Wartung & Instandhaltung", "vi": "Bảo trì & Sửa chữa"},
    "session_type": "SATELLITE", "industry": "TECHNIK",
    "vocabulary": [
      {"id":"te04_01","german":"die Wartung","meaning":"bảo dưỡng định kỳ","gender":"DIE","example_de":"Die Maschine braucht alle 500 Stunden Wartung.","example_vi":"Máy cần bảo dưỡng mỗi 500 giờ.","tags":["#Wartung"]},
      {"id":"te04_02","german":"defekt / ausgefallen","meaning":"hỏng / ngừng hoạt động","gender":null,"example_de":"Die Pumpe ist ausgefallen — sofort Ersatz!","example_vi":"Bơm bị hỏng — cần thay thế ngay!","tags":["#Technik"]},
      {"id":"te04_03","german":"das Ersatzteil","meaning":"phụ tùng thay thế","gender":"DAS","example_de":"Wir brauchen ein Ersatzteil — Lieferzeit 3 Tage.","example_vi":"Cần phụ tùng thay thế — giao 3 ngày.","tags":["#Wartung"]},
      {"id":"te04_04","german":"schmieren","meaning":"bôi trơn","gender":null,"example_de":"Lager regelmäßig schmieren!","example_vi":"Bôi trơn ổ trục thường xuyên!","tags":["#Wartung"]},
      {"id":"te04_05","german":"das Wartungsprotokoll","meaning":"biên bản bảo dưỡng","gender":"DAS","example_de":"Nach jeder Wartung Protokoll ausfüllen.","example_vi":"Điền biên bản sau mỗi lần bảo dưỡng.","tags":["#Dokumentation"]}
    ],
    "phrases": [
      {"german":"Die Maschine braucht dringend Wartung!","meaning":"Máy cần bảo dưỡng gấp!","speak_de":"Dringend Wartung nötig!"},
      {"german":"Wir warten auf das Ersatzteil.","meaning":"Chúng tôi đang chờ phụ tùng.","speak_de":"Wir warten auf Ersatzteile."},
      {"german":"Alles im Wartungsprotokoll dokumentiert.","meaning":"Tất cả đã ghi vào biên bản.","speak_de":"Im Protokoll dokumentiert."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_te4_01","type":"MULTIPLE_CHOICE","question_vi":"''das Ersatzteil'' là?","options":["Dụng cụ bảo dưỡng","Phụ tùng thay thế","Kế hoạch bảo trì","Biên bản lỗi"],"correct":1},
        {"id":"sat_te4_02","type":"FILL_BLANK","sentence_de":"Lager regelmäßig ___!","hint_vi":"bôi trơn","answer":"schmieren","accept_also":["schmieren"]},
        {"id":"sat_te4_03","type":"MULTIPLE_CHOICE","question_vi":"Sau mỗi lần bảo dưỡng cần làm gì?","options":["Maschine starten","Wartungsprotokoll ausfüllen","Ersatzteile bestellen","Chef informieren"],"correct":1}
      ],
      "practice": [{"id":"sat_te4_p01","type":"TRANSLATE","from":"vi","sentence":"Máy bị hỏng. Chúng tôi cần phụ tùng thay thế. Thời gian giao 2 ngày.","answer":"Die Maschine ist defekt. Wir brauchen ein Ersatzteil. Die Lieferzeit beträgt 2 Tage."}]
    }
  }'::jsonb,
  'TECHNIK'
),
(
  'SATELLITE_LEAF', 'Arbeitsschutz & Unfallverhütung', 'Sicherheitsregeln, Unfallmeldung und Erste Hilfe am Arbeitsplatz',
  150, TRUE,
  '{
    "title": {"de": "Arbeitsschutz & Unfallverhütung", "vi": "An toàn lao động & Phòng ngừa tai nạn"},
    "session_type": "SATELLITE", "industry": "TECHNIK",
    "vocabulary": [
      {"id":"te05_01","german":"der Arbeitsschutz","meaning":"an toàn lao động","gender":"DER","example_de":"Arbeitsschutz ist Pflicht — keine Ausnahmen!","example_vi":"An toàn lao động là bắt buộc — không ngoại lệ!","tags":["#Sicherheit"]},
      {"id":"te05_02","german":"der Unfall","meaning":"tai nạn","gender":"DER","example_de":"Jeder Unfall muss sofort gemeldet werden.","example_vi":"Mọi tai nạn phải báo cáo ngay.","tags":["#Sicherheit"]},
      {"id":"te05_03","german":"der Verbandskasten","meaning":"hộp sơ cứu","gender":"DER","example_de":"Der Verbandskasten hängt neben dem Ausgang.","example_vi":"Hộp sơ cứu treo bên cạnh lối ra.","tags":["#ErsteHilfe"]},
      {"id":"te05_04","german":"die Gefährdungsbeurteilung","meaning":"đánh giá rủi ro","gender":"DIE","example_de":"Vor jedem Projekt: Gefährdungsbeurteilung erstellen.","example_vi":"Trước mỗi dự án: lập đánh giá rủi ro.","tags":["#Sicherheit"]},
      {"id":"te05_05","german":"sperren / absperren","meaning":"cách ly/chặn","gender":null,"example_de":"Gefahrenbereich absperren!","example_vi":"Cách ly khu vực nguy hiểm!","tags":["#Sicherheit"]}
    ],
    "phrases": [
      {"german":"Achtung — Lebensgefahr! Bereich sofort verlassen!","meaning":"Cảnh báo — nguy hiểm tính mạng! Rời khu vực ngay!","speak_de":"Lebensgefahr! Sofort weg!"},
      {"german":"Es gab einen Unfall — sofort Notruf 112!","meaning":"Có tai nạn — gọi 112 ngay!","speak_de":"Unfall! Notruf 112!"},
      {"german":"Bitte den Bereich absperren und sichern.","meaning":"Cách ly và bảo đảm an toàn khu vực.","speak_de":"Bereich absperren!"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_te5_01","type":"MULTIPLE_CHOICE","question_vi":"Số điện thoại cấp cứu ở Đức?","options":["110","112","115","118"],"correct":1},
        {"id":"sat_te5_02","type":"FILL_BLANK","sentence_de":"Gefahrenbereich sofort ___!","hint_vi":"cách ly","answer":"absperren","accept_also":["absperren"]},
        {"id":"sat_te5_03","type":"MULTIPLE_CHOICE","question_vi":"Khi có tai nạn, bước đầu tiên là?","options":["Fotos machen","Notruf 112 anrufen","Chef informieren","Protokoll schreiben"],"correct":1}
      ],
      "practice": [{"id":"sat_te5_p01","type":"TRANSLATE","from":"vi","sentence":"Có tai nạn ở xưởng! Gọi 112 ngay! Cách ly khu vực và mang hộp sơ cứu!","answer":"Es gibt einen Unfall in der Werkstatt! Sofort 112 anrufen! Bereich absperren und Verbandskasten holen!"}]
    }
  }'::jsonb,
  'TECHNIK'
);
