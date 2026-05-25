-- V103__satellite_gastronomie_5_kasse.sql
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi,
  xp_reward, is_active, content_json, industry
) VALUES (
  'SATELLITE_LEAF',
  'Kassenabrechnung',
  'Quyết toán ca',
  'Tagesabschluss und Buchhaltung',
  150,
  TRUE,
  '{
    "title": {"de": "Kassenabrechnung & Abrechnung", "vi": "Quyết toán ca & Kế toán cơ bản"},
    "overview": {"de": "Tagesabschluss, Umsatzzählen, Kassensturz und einfache Rechnungen.", "vi": "Kết thúc ngày làm việc: đếm doanh thu, kiểm kê két tiền và các thuật ngữ kế toán cơ bản trong nhà hàng."},
    "session_type": "SATELLITE",
    "industry": "GASTRONOMIE",
    "theory_cards": [
      {"type":"RULE","title":{"vi":"Kassenabschluss — Kết thúc ca"},"content":{"vi":"der Tagesumsatz — doanh thu ngày\ndie Kassenlade — ngăn két tiền\nder Kassensturz — kiểm kê két\ndie Differenz — chênh lệch\nder Bon / der Kassenbon — hóa đơn/phiếu thu\nEC-Karte / Kreditkarte — thẻ ngân hàng / thẻ tín dụng\nbar bezahlt — trả tiền mặt\ndie Quittung — biên lai\n\nFormel: Sollbestand − Istbestand = Differenz\n(Số tiền phải có − Số tiền thực có = Chênh lệch)"},"tags":["#Kasse","#Abrechnung"]},
      {"type":"RULE","title":{"vi":"Steuer & Umsatzsteuer"},"content":{"vi":"Die Mehrwertsteuer (MwSt.) in Deutschland:\n19% — Normalsatz (Restaurants, Shops)\n7% — Ermäßigter Satz (Lebensmittel zum Mitnehmen)\n\nAuf der Rechnung: ''inkl. 19% MwSt.''\nNetto = ohne Steuer\nBrutto = mit Steuer\nTipp: In Deutschland ist die MwSt. immer im Preis enthalten!"},"tags":["#Steuer","#Rechnung"]}
    ],
    "vocabulary": [
      {"id":"sg05_01","german":"der Umsatz","meaning":"doanh thu","gender":"DER","example_de":"Der Tagesumsatz beträgt heute 1.850 Euro.","example_vi":"Doanh thu ngày hôm nay là 1.850 Euro.","tags":["#Finanzen"]},
      {"id":"sg05_02","german":"die Rechnung","meaning":"hóa đơn / tính toán","gender":"DIE","example_de":"Bitte die Rechnung nochmal prüfen — hier stimmt etwas nicht.","example_vi":"Kiểm tra lại hóa đơn — có gì đó không đúng.","tags":["#Finanzen"]},
      {"id":"sg05_03","german":"der Kassensturz","meaning":"kiểm kê két tiền","gender":"DER","example_de":"Am Abend machen wir immer Kassensturz.","example_vi":"Buổi tối luôn kiểm kê két tiền.","tags":["#Kasse"]},
      {"id":"sg05_04","german":"die Mehrwertsteuer (MwSt.)","meaning":"thuế giá trị gia tăng (VAT)","gender":"DIE","example_de":"Alle Preise sind inklusive Mehrwertsteuer.","example_vi":"Tất cả giá đã bao gồm thuế VAT.","tags":["#Steuer"]},
      {"id":"sg05_05","german":"die Differenz","meaning":"chênh lệch","gender":"DIE","example_de":"Es gibt eine Differenz von 3 Euro — bitte nochmal zählen.","example_vi":"Chênh lệch 3 Euro — đếm lại đi.","tags":["#Kasse"]},
      {"id":"sg05_06","german":"bar / unbar","meaning":"tiền mặt / không dùng tiền mặt","gender":null,"example_de":"Immer mehr Kunden zahlen unbar mit Karte.","example_vi":"Ngày càng nhiều khách trả thẻ.","tags":["#Zahlung"]}
    ],
    "phrases": [
      {"german":"Der Tagesumsatz beträgt heute 2.300 Euro.","meaning":"Doanh thu ngày hôm nay là 2.300 Euro.","speak_de":"Der Tagesumsatz beträgt..."},
      {"german":"Bitte den Kassensturz machen und dokumentieren.","meaning":"Làm ơn kiểm kê két và ghi lại.","speak_de":"Bitte Kassensturz machen!"},
      {"german":"Alle Preise inklusive 19% Mehrwertsteuer.","meaning":"Tất cả giá bao gồm 19% VAT.","speak_de":"Inklusive Mehrwertsteuer."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_g5_01","type":"MULTIPLE_CHOICE","question_vi":"MwSt. tiêu chuẩn ở Đức là bao nhiêu?","options":["7%","10%","15%","19%"],"correct":3},
        {"id":"sat_g5_02","type":"FILL_BLANK","sentence_de":"Sollbestand 500€ − Istbestand 497€ = ___ von 3€.","hint_vi":"chênh lệch","answer":"Differenz","accept_also":["eine Differenz"]},
        {"id":"sat_g5_03","type":"MULTIPLE_CHOICE","question_vi":"''Brutto'' trong kế toán nghĩa là?","options":["Chưa có thuế","Đã bao gồm thuế","Chỉ thuế","Giảm giá"],"correct":1},
        {"id":"sat_g5_04","type":"FILL_BLANK","sentence_de":"Der Tages___ beträgt heute 1.850 Euro.","hint_vi":"doanh thu","answer":"umsatz","accept_also":["Umsatz"]},
        {"id":"sat_g5_05","type":"MULTIPLE_CHOICE","question_vi":"Đồ ăn mang về ở Đức tính MwSt. bao nhiêu?","options":["7%","10%","15%","19%"],"correct":0}
      ],
      "practice": [
        {"id":"sat_g5_p01","type":"TRANSLATE","from":"vi","sentence":"Doanh thu hôm nay 2.500 Euro. Tiền mặt 800 Euro, còn lại trả thẻ.","answer":"Der Tagesumsatz beträgt heute 2.500 Euro. 800 Euro wurden bar bezahlt, der Rest unbar mit Karte.","accept_also":["Heute haben wir 2.500 Euro Umsatz. 800 bar, Rest mit Karte."]},
        {"id":"sat_g5_p02","type":"FILL_BLANK","sentence_de":"Alle Preise sind ___ 19% ___.","hint_vi":"bao gồm ... thuế","answer":"inklusive, Mehrwertsteuer","accept_also":["inkl. / MwSt."]}
      ]
    },
    "reading_passage": {
      "text_de": "Tagesabschluss im Restaurant\n\nUm 23 Uhr schließt das Restaurant. Der Chef macht den Tagesabschluss: Er addiert alle Bons — heute 127 Tische. Der Gesamtumsatz: 3.847 Euro. Davon 1.200 Euro bar und 2.647 Euro mit Karte. Er macht Kassensturz: Im Kassenlade sind 1.218 Euro — das ist 18 Euro mehr als erwartet. Er notiert alles im Kassenbuch. Die Mehrwertsteuer (19%) wird später vom Steuerberater berechnet.",
      "text_vi": "Kết thúc ngày tại nhà hàng\n\n23 giờ nhà hàng đóng cửa. Quản lý làm kết ca: Cộng tất cả hóa đơn — hôm nay 127 bàn. Tổng doanh thu: 3.847 Euro. Trong đó 1.200 Euro tiền mặt và 2.647 Euro thẻ. Kiểm kê két: Trong két có 1.218 Euro — nhiều hơn 18 Euro so với dự kiến. Ghi hết vào sổ thu chi. Thuế VAT 19% sẽ được kế toán tính sau.",
      "questions": [
        {"id":"rq_sg5_01","type":"FILL_BLANK","question_vi":"Tổng doanh thu ngày là bao nhiêu?","answer":"3.847 Euro","accept_also":["dreitausend achthundert siebenundvierzig Euro"]},
        {"id":"rq_sg5_02","type":"MULTIPLE_CHOICE","question_vi":"Két tiền có chênh lệch thế nào?","options":["18 Euro zu wenig","Genau richtig","18 Euro zu viel","3 Euro zu wenig"],"correct":2}
      ]
    },
    "writing_prompt": {
      "task_de": "Schreiben Sie einen kurzen Tagesabschlussbericht: Umsatz, Zahlungsarten, Kassensturz.",
      "task_vi": "Viết báo cáo kết ca ngắn: doanh thu, hình thức thanh toán, kiểm kê két.",
      "min_sentences": 5
    },
    "audio_content": {
      "listen_words": [
        {"text":"Der Tagesumsatz beträgt 2.300 Euro.","meaning":"Doanh thu ngày là 2.300 Euro."},
        {"text":"Kassensturz bitte!","meaning":"Kiểm kê két đi!"},
        {"text":"inklusive Mehrwertsteuer","meaning":"bao gồm thuế VAT"}
      ]
    }
  }'::jsonb,
  'GASTRONOMIE'
) ON CONFLICT DO NOTHING;
