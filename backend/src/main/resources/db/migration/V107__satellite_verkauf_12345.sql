-- V107: SATELLITE_LEAF — Verkauf/Einzelhandel (5 nodes)

INSERT INTO skill_tree_nodes (node_type, title_de, title_vi, xp_reward, is_active, content_json, industry)
VALUES
(
  'SATELLITE_LEAF', 'Kundenberatung im Laden', 'Kunden beraten, Produkte empfehlen, Verkaufsgespräch führen',
  150, TRUE,
  '{
    "title": {"de": "Kundenberatung", "vi": "Tư vấn khách hàng"},
    "session_type": "SATELLITE", "industry": "VERKAUF",
    "vocabulary": [
      {"id":"vk01_01","german":"beraten","meaning":"tư vấn","gender":null,"example_de":"Ich berate Sie gerne!","example_vi":"Tôi rất vui được tư vấn!","tags":["#Verkauf"]},
      {"id":"vk01_02","german":"der Artikel / die Ware","meaning":"mặt hàng","gender":"DER","example_de":"Dieser Artikel ist gerade im Angebot.","example_vi":"Mặt hàng này đang giảm giá.","tags":["#Handel"]},
      {"id":"vk01_03","german":"umtauschen","meaning":"đổi hàng","gender":null,"example_de":"Sie können die Ware innerhalb von 14 Tagen umtauschen.","example_vi":"Có thể đổi hàng trong 14 ngày.","tags":["#Service"]},
      {"id":"vk01_04","german":"die Garantie","meaning":"bảo hành","gender":"DIE","example_de":"Das Gerät hat 2 Jahre Garantie.","example_vi":"Thiết bị bảo hành 2 năm.","tags":["#Handel"]},
      {"id":"vk01_05","german":"der Kassenbon","meaning":"hóa đơn mua hàng","gender":"DER","example_de":"Bitte den Kassenbon aufbewahren!","example_vi":"Giữ lại hóa đơn nhé!","tags":["#Kasse"]}
    ],
    "phrases": [
      {"german":"Kann ich Ihnen helfen?","meaning":"Tôi có thể giúp gì không?","speak_de":"Kann ich helfen?"},
      {"german":"Das empfehle ich Ihnen besonders.","meaning":"Tôi đặc biệt gợi ý cái này.","speak_de":"Das empfehle ich sehr."},
      {"german":"Möchten Sie das anprobieren?","meaning":"Bạn muốn thử không?","speak_de":"Möchten Sie anprobieren?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_vk1_01","type":"MULTIPLE_CHOICE","question_vi":"''umtauschen'' nghĩa là?","options":["Trả hàng","Đổi hàng","Giảm giá","Bảo hành"],"correct":1},
        {"id":"sat_vk1_02","type":"FILL_BLANK","sentence_de":"Das Gerät hat 2 Jahre ___.","hint_vi":"bảo hành","answer":"Garantie","accept_also":["garantie"]},
        {"id":"sat_vk1_03","type":"MULTIPLE_CHOICE","question_vi":"''der Kassenbon'' cần giữ để làm gì?","options":["Làm đẹp ví","Đổi/trả hàng","Tặng người khác","Không cần giữ"],"correct":1}
      ],
      "practice": [{"id":"sat_vk1_p01","type":"TRANSLATE","from":"vi","sentence":"Tôi có thể giúp gì? Mặt hàng này đang giảm giá và có bảo hành 1 năm.","answer":"Kann ich Ihnen helfen? Dieser Artikel ist im Angebot und hat 1 Jahr Garantie."}]
    }
  }'::jsonb,
  'VERKAUF'
),
(
  'SATELLITE_LEAF', 'Reklamation & Rückgabe', 'Beschwerden bearbeiten, Rückgabe und Erstattung',
  150, TRUE,
  '{
    "title": {"de": "Reklamation & Rückgabe", "vi": "Khiếu nại & Trả hàng"},
    "session_type": "SATELLITE", "industry": "VERKAUF",
    "vocabulary": [
      {"id":"vk02_01","german":"reklamieren","meaning":"khiếu nại hàng lỗi","gender":null,"example_de":"Ich möchte diesen Artikel reklamieren — er ist kaputt.","example_vi":"Tôi muốn khiếu nại món hàng này — bị hỏng.","tags":["#Service"]},
      {"id":"vk02_02","german":"die Rückerstattung","meaning":"hoàn tiền","gender":"DIE","example_de":"Sie bekommen eine vollständige Rückerstattung.","example_vi":"Bạn sẽ được hoàn tiền đầy đủ.","tags":["#Handel"]},
      {"id":"vk02_03","german":"defekt / kaputt","meaning":"bị hỏng","gender":null,"example_de":"Das Gerät ist nach 3 Tagen defekt.","example_vi":"Thiết bị hỏng sau 3 ngày.","tags":["#Qualität"]},
      {"id":"vk02_04","german":"kulant","meaning":"linh hoạt/thiện chí","gender":null,"example_de":"Wir sind kulant und tauschen das Gerät aus.","example_vi":"Chúng tôi thiện chí và đổi thiết bị.","tags":["#Service"]},
      {"id":"vk02_05","german":"die Quittung","meaning":"biên lai","gender":"DIE","example_de":"Haben Sie noch die Quittung?","example_vi":"Bạn còn biên lai không?","tags":["#Handel"]}
    ],
    "phrases": [
      {"german":"Das tut mir leid. Haben Sie noch den Kassenbon?","meaning":"Tôi xin lỗi. Bạn còn hóa đơn không?","speak_de":"Haben Sie den Bon?"},
      {"german":"Wir tauschen das natürlich sofort um.","meaning":"Chúng tôi đổi ngay cho bạn.","speak_de":"Wir tauschen sofort um."},
      {"german":"Sie können wählen: Umtausch oder Rückerstattung.","meaning":"Bạn chọn: đổi hàng hoặc hoàn tiền.","speak_de":"Umtausch oder Rückerstattung?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_vk2_01","type":"MULTIPLE_CHOICE","question_vi":"Khách mang hàng lỗi lại, bạn hỏi gì đầu tiên?","options":["Wie lange haben Sie?","Haben Sie noch den Kassenbon?","Was wollen Sie?","Gehen Sie bitte!"],"correct":1},
        {"id":"sat_vk2_02","type":"FILL_BLANK","sentence_de":"Das Gerät ist ___ — wir tauschen es sofort ___.","hint_vi":"bị hỏng ... đổi","answer":"defekt, um","accept_also":["defekt / um","kaputt, um"]},
        {"id":"sat_vk2_03","type":"MULTIPLE_CHOICE","question_vi":"''kulant'' trong dịch vụ khách hàng nghĩa là?","options":["Nghiêm khắc","Thiện chí/linh hoạt","Chậm chạp","Đắt tiền"],"correct":1}
      ],
      "practice": [{"id":"sat_vk2_p01","type":"TRANSLATE","from":"vi","sentence":"Xin lỗi về sự cố. Bạn muốn đổi hàng hay hoàn tiền? Cần biên lai nhé.","answer":"Das tut mir leid. Möchten Sie Umtausch oder Rückerstattung? Wir brauchen die Quittung."}]
    }
  }'::jsonb,
  'VERKAUF'
),
(
  'SATELLITE_LEAF', 'Kassenarbeit & Zahlung', 'Kassenführung, Zahlungsarten, Wechselgeld',
  150, TRUE,
  '{
    "title": {"de": "Kassenarbeit & Zahlung", "vi": "Thu ngân & Thanh toán"},
    "session_type": "SATELLITE", "industry": "VERKAUF",
    "vocabulary": [
      {"id":"vk03_01","german":"das Wechselgeld","meaning":"tiền trả lại","gender":"DAS","example_de":"Hier ist Ihr Wechselgeld: 3,50 Euro.","example_vi":"Đây là tiền trả lại: 3,50 Euro.","tags":["#Kasse"]},
      {"id":"vk03_02","german":"kontaktlos bezahlen","meaning":"thanh toán không tiếp xúc","gender":null,"example_de":"Sie können kontaktlos mit der Karte bezahlen.","example_vi":"Bạn có thể thanh toán không tiếp xúc bằng thẻ.","tags":["#Zahlung"]},
      {"id":"vk03_03","german":"der PIN","meaning":"mã PIN","gender":"DER","example_de":"Bitte geben Sie Ihren PIN ein.","example_vi":"Nhập mã PIN.","tags":["#Zahlung"]},
      {"id":"vk03_04","german":"der Beleg","meaning":"biên lai","gender":"DER","example_de":"Möchten Sie einen Beleg?","example_vi":"Bạn muốn biên lai không?","tags":["#Kasse"]},
      {"id":"vk03_05","german":"der Gesamtbetrag","meaning":"tổng số tiền","gender":"DER","example_de":"Der Gesamtbetrag beträgt 47,80 Euro.","example_vi":"Tổng cộng 47,80 Euro.","tags":["#Kasse"]}
    ],
    "phrases": [
      {"german":"Das macht zusammen 23,50 Euro.","meaning":"Tổng cộng 23,50 Euro.","speak_de":"Das macht dreiundzwanzig Euro fünfzig."},
      {"german":"Möchten Sie bar oder mit Karte zahlen?","meaning":"Trả tiền mặt hay thẻ?","speak_de":"Bar oder Karte?"},
      {"german":"Hier ist Ihr Wechselgeld und der Kassenbon.","meaning":"Đây là tiền thừa và hóa đơn.","speak_de":"Ihr Wechselgeld."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_vk3_01","type":"FILL_BLANK","sentence_de":"Der ___ beträgt 35,90 Euro.","hint_vi":"tổng tiền","answer":"Gesamtbetrag","accept_also":["gesamtbetrag"]},
        {"id":"sat_vk3_02","type":"MULTIPLE_CHOICE","question_vi":"Khách trả 50€, tổng 23,50€ — trả lại bao nhiêu?","options":["26,50 Euro","27,50 Euro","24,50 Euro","25,50 Euro"],"correct":0},
        {"id":"sat_vk3_03","type":"MULTIPLE_CHOICE","question_vi":"''kontaktlos'' thanh toán nghĩa là?","options":["Trả tiền mặt","Chạm thẻ/điện thoại không cần PIN","Chuyển khoản","Trả góp"],"correct":1}
      ],
      "practice": [{"id":"sat_vk3_p01","type":"TRANSLATE","from":"vi","sentence":"Tổng cộng 18,90 Euro. Trả tiền mặt hay thẻ? Đây là tiền thừa và hóa đơn.","answer":"Das macht zusammen 18,90 Euro. Bar oder Karte? Hier ist Ihr Wechselgeld und der Kassenbon."}]
    }
  }'::jsonb,
  'VERKAUF'
),
(
  'SATELLITE_LEAF', 'Lager & Warenwirtschaft', 'Lagerauffüllung, Inventur und Bestellwesen',
  150, TRUE,
  '{
    "title": {"de": "Lager & Warenwirtschaft", "vi": "Kho hàng & Quản lý hàng hóa"},
    "session_type": "SATELLITE", "industry": "VERKAUF",
    "vocabulary": [
      {"id":"vk04_01","german":"das Lager","meaning":"kho hàng","gender":"DAS","example_de":"Das Lager muss täglich kontrolliert werden.","example_vi":"Kho phải được kiểm tra hàng ngày.","tags":["#Lager"]},
      {"id":"vk04_02","german":"nachbestellen","meaning":"đặt hàng thêm","gender":null,"example_de":"Wir müssen Milch nachbestellen — nur noch 5 Stück.","example_vi":"Phải đặt thêm sữa — chỉ còn 5 cái.","tags":["#Handel"]},
      {"id":"vk04_03","german":"die Inventur","meaning":"kiểm kê hàng","gender":"DIE","example_de":"Inventur findet jeden Monat statt.","example_vi":"Kiểm kê hàng mỗi tháng.","tags":["#Lager"]},
      {"id":"vk04_04","german":"der Mindestbestand","meaning":"tồn kho tối thiểu","gender":"DER","example_de":"Bei 10 Stück Mindestbestand sofort nachbestellen.","example_vi":"Khi còn 10 cái phải đặt hàng ngay.","tags":["#Lager"]},
      {"id":"vk04_05","german":"auffüllen","meaning":"bổ sung hàng","gender":null,"example_de":"Bitte die Regale auffüllen!","example_vi":"Bổ sung hàng vào kệ đi!","tags":["#Handel"]}
    ],
    "phrases": [
      {"german":"Wir sind ausverkauft — ich bestelle sofort nach.","meaning":"Hết hàng rồi — tôi đặt ngay.","speak_de":"Wir sind ausverkauft."},
      {"german":"Bitte Regal 3 auffüllen!","meaning":"Bổ sung kệ 3 đi!","speak_de":"Regal drei auffüllen!"},
      {"german":"Die Inventur zeigt: 3 Artikel fehlen.","meaning":"Kiểm kê cho thấy: thiếu 3 mặt hàng.","speak_de":"Drei Artikel fehlen."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_vk4_01","type":"MULTIPLE_CHOICE","question_vi":"''Inventur'' trong bán lẻ là?","options":["Đặt hàng","Kiểm kê hàng tồn kho","Giảm giá hàng","Vệ sinh kho"],"correct":1},
        {"id":"sat_vk4_02","type":"FILL_BLANK","sentence_de":"Wir müssen Wasser ___! Nur noch 8 Flaschen.","hint_vi":"đặt thêm","answer":"nachbestellen","accept_also":["nachbestellen"]},
        {"id":"sat_vk4_03","type":"MULTIPLE_CHOICE","question_vi":"''ausverkauft'' nghĩa là?","options":["Bán được nhiều","Hết hàng","Giảm giá","Nhập hàng mới"],"correct":1}
      ],
      "practice": [{"id":"sat_vk4_p01","type":"TRANSLATE","from":"vi","sentence":"Hết hàng rồi. Phải đặt thêm ngay. Kiểm kê tuần trước thiếu 5 mặt hàng.","answer":"Wir sind ausverkauft. Wir müssen sofort nachbestellen. Die letzte Inventur zeigt 5 fehlende Artikel."}]
    }
  }'::jsonb,
  'VERKAUF'
),
(
  'SATELLITE_LEAF', 'Verkaufsgespräch & Abschluss', 'Beratungsgespräch führen und zum Abschluss bringen',
  150, TRUE,
  '{
    "title": {"de": "Verkaufsgespräch & Abschluss", "vi": "Chốt sale & Kết thúc bán hàng"},
    "session_type": "SATELLITE", "industry": "VERKAUF",
    "vocabulary": [
      {"id":"vk05_01","german":"der Bedarf","meaning":"nhu cầu","gender":"DER","example_de":"Was ist Ihr genauer Bedarf?","example_vi":"Nhu cầu cụ thể của bạn là gì?","tags":["#Verkauf"]},
      {"id":"vk05_02","german":"überzeugen","meaning":"thuyết phục","gender":null,"example_de":"Ich bin überzeugt — ich nehme das!","example_vi":"Tôi bị thuyết phục — tôi lấy cái này!","tags":["#Verkauf"]},
      {"id":"vk05_03","german":"das Angebot","meaning":"ưu đãi/đề nghị","gender":"DAS","example_de":"Wir haben ein Sonderangebot diese Woche.","example_vi":"Tuần này chúng tôi có ưu đãi đặc biệt.","tags":["#Handel"]},
      {"id":"vk05_04","german":"sich entscheiden","meaning":"quyết định","gender":null,"example_de":"Haben Sie sich entschieden?","example_vi":"Bạn đã quyết định chưa?","tags":["#Verkauf"]},
      {"id":"vk05_05","german":"liefern","meaning":"giao hàng","gender":null,"example_de":"Wir liefern innerhalb von 3 Werktagen.","example_vi":"Chúng tôi giao trong 3 ngày làm việc.","tags":["#Handel"]}
    ],
    "phrases": [
      {"german":"Haben Sie sich schon entschieden?","meaning":"Bạn đã quyết định chưa?","speak_de":"Haben Sie sich entschieden?"},
      {"german":"Das ist unser bestes Angebot!","meaning":"Đây là ưu đãi tốt nhất của chúng tôi!","speak_de":"Das ist unser bestes Angebot!"},
      {"german":"Wir liefern kostenlos innerhalb von 48 Stunden.","meaning":"Giao hàng miễn phí trong 48 giờ.","speak_de":"Kostenlose Lieferung in 48 Stunden."}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_vk5_01","type":"MULTIPLE_CHOICE","question_vi":"''Was ist Ihr Bedarf?'' nghĩa là?","options":["Bạn cần gì?","Bạn có tiền không?","Bạn thích màu gì?","Bạn ở đâu?"],"correct":0},
        {"id":"sat_vk5_02","type":"FILL_BLANK","sentence_de":"Wir ___ innerhalb von 3 ___ tagen.","hint_vi":"giao hàng ... ngày làm việc","answer":"liefern, Werk","accept_also":["liefern / Werk"]},
        {"id":"sat_vk5_03","type":"MULTIPLE_CHOICE","question_vi":"''Ich bin überzeugt'' nghĩa là?","options":["Tôi không chắc","Tôi bị thuyết phục rồi","Tôi cần suy nghĩ","Tôi sẽ quay lại"],"correct":1}
      ],
      "practice": [{"id":"sat_vk5_p01","type":"TRANSLATE","from":"vi","sentence":"Bạn đã quyết định chưa? Đây là ưu đãi tốt nhất. Chúng tôi giao hàng miễn phí.","answer":"Haben Sie sich entschieden? Das ist unser bestes Angebot. Wir liefern kostenlos."}]
    }
  }'::jsonb,
  'VERKAUF'
);
