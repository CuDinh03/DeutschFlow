-- V96: Day 33 — Arztbesuch & Apotheke

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Arztbesuch & Apotheke", "vi": "Khám bệnh & Nhà thuốc"},
  "overview": {"de": "Beim Arzt und in der Apotheke: Modalverben müssen/sollen/dürfen.", "vi": "Học cách nói chuyện tại phòng khám và nhà thuốc. Thêm Modalverben: müssen (phải), sollen (được bảo), dürfen (được phép/không được). Rất thực tế cho cuộc sống ở Đức."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Modalverben: müssen, sollen, dürfen"},"content":{"vi":"müssen = phải (bắt buộc từ hoàn cảnh)\nIch muss viel Wasser trinken. (Tôi phải uống nhiều nước.)\n\nsollen = nên / được bảo (bởi người khác)\nSie sollen dreimal täglich Tabletten nehmen. (Bạn nên uống thuốc 3 lần.)\n\ndürfen = được phép\nDarf ich aufstehen? (Tôi có thể đứng dậy không?)\nSie dürfen nicht rauchen. (Bạn không được hút thuốc.)\n\nCấu trúc: Modalverb (vị trí 2) + Infinitiv (cuối)"},"tags":["#Modalverben","#müssen","#dürfen"]},
    {"type":"RULE","title":{"vi":"Tại nhà thuốc — Từ vựng cần thiết"},"content":{"vi":"das Medikament / das Arzneimittel — thuốc\ndas Aspirin / das Paracetamol — thuốc giảm đau\ndas Antibiotikum — kháng sinh\nder Hustensaft — xi-rô ho\ndas Pflaster — băng cá nhân\ndie Salbe — thuốc mỡ\ndie Verschreibungspflicht — cần đơn thuốc\nrezeptfrei — không cần đơn (OTC)"},"tags":["#Apotheke","#Medizin"]},
    {"type":"EXAMPLE","title":{"vi":"Dialog tại nhà thuốc"},"content":{"vi":"Ich: Guten Tag. Ich habe ein Rezept vom Arzt.\nApotheker: Einen Moment. Hier sind Ihre Antibiotika. Sie sollen dreimal täglich eine Tablette nehmen, immer nach dem Essen.\nIch: Darf ich Alkohol trinken?\nApotheker: Nein, das dürfen Sie auf keinen Fall! Und Sie müssen die ganzen 7 Tage nehmen, auch wenn Sie sich besser fühlen.\nIch: Verstanden. Haben Sie auch Hustensaft?\nApotheker: Ja, hier ist ein guter. Der ist rezeptfrei — 8,50 Euro."},"tags":["#Apotheke","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_apo_01","german":"die Apotheke","meaning":"nhà thuốc","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"In Deutschland darf man Medikamente nur in der Apotheke kaufen.","example_vi":"Ở Đức chỉ được mua thuốc ở nhà thuốc.","speak_de":"die Apotheke","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/apoˈteːkə/"],"common_errors_vi":["Apo-THE-ke: Nhấn THE"],"ipa_target":"diː apoˈteːkə"}},
    {"id":"v_apo_02","german":"das Medikament","meaning":"thuốc (y khoa)","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Dieses Medikament ist verschreibungspflichtig.","example_vi":"Thuốc này cần đơn của bác sĩ.","speak_de":"das Medikament","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/medɪkaˈmɛnt/"],"common_errors_vi":["Medi-ka-MENT: nhấn MENT"],"ipa_target":"das medɪkaˈmɛnt"}},
    {"id":"v_apo_03","german":"rauchen","meaning":"hút thuốc lá","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie dürfen hier nicht rauchen.","example_vi":"Ở đây không được hút thuốc.","speak_de":"Rauchen verboten!","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʁaʊ̯xən/"],"common_errors_vi":["rau-chen: au=/ao/, ch=/x/"],"ipa_target":"ˈʁaʊ̯xən"}},
    {"id":"v_apo_04","german":"sich fühlen","meaning":"cảm thấy (sức khỏe)","gender":null,"color_code":null,"gender_label":null,"example_de":"Wie fühlen Sie sich? — Ich fühle mich nicht gut.","example_vi":"Ông/bà cảm thấy thế nào? — Tôi không thấy khỏe.","speak_de":"Wie fühlen Sie sich?","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfyːlən/"],"common_errors_vi":["fühlen: ü tròn môi"],"ipa_target":"zɪç ˈfyːlən"}},
    {"id":"v_apo_05","german":"allergisch gegen","meaning":"dị ứng với","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bin allergisch gegen Penicillin.","example_vi":"Tôi dị ứng với Penicillin.","speak_de":"Ich bin allergisch gegen...","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/aˈlɛʁɡɪʃ/"],"common_errors_vi":["al-LER-gisch: sch=/ʃ/"],"ipa_target":"aˈlɛʁɡɪʃ ˈɡeːɡən"}},
    {"id":"v_apo_06","german":"die Krankenversicherung","meaning":"bảo hiểm y tế","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Haben Sie eine Krankenversicherung? — Ja, ich bin bei der AOK.","example_vi":"Bạn có bảo hiểm y tế không? — Có, tôi thuộc AOK.","speak_de":"die Krankenversicherung","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈkʁaŋkənfɛɐ̯ˌzɪçəʁʊŋ/"],"common_errors_vi":["Kran-ken-ver-sich-er-ung: rất dài!"],"ipa_target":"diː ˈkʁaŋkənfɛɐ̯ˌzɪçəʁʊŋ"}}
  ],
  "phrases": [
    {"german":"Ich bin allergisch gegen Penicillin.","meaning":"Tôi dị ứng với Penicillin.","speak_de":"Ich bin allergisch gegen Penicillin."},
    {"german":"Darf ich das Medikament mit Alkohol nehmen?","meaning":"Tôi có uống thuốc với rượu được không?","speak_de":"Darf ich Alkohol trinken?"},
    {"german":"Haben Sie etwas gegen Kopfschmerzen?","meaning":"Bạn có gì trị đau đầu không?","speak_de":"Haben Sie etwas gegen Kopfschmerzen?"}
  ],
  "examples": [
    {"german":"Apotheker: Sie müssen das Antibiotikum 7 Tage nehmen. Sie dürfen keinen Alkohol trinken. Und Sie sollen viel schlafen und Wasser trinken.","translation":"Dược sĩ: Bạn phải uống kháng sinh đủ 7 ngày. Không được uống rượu. Và bạn nên ngủ nhiều và uống nước.","note":"müssen=phải, dürfen=được phép (phủ định=cấm), sollen=nên","speak_de":"Sie müssen 7 Tage nehmen."},
    {"german":"— Haben Sie etwas rezeptfreies gegen Kopfschmerzen? — Ja, Paracetamol oder Ibuprofen — beide rezeptfrei. Nehmen Sie maximal 3 Tabletten pro Tag.","translation":"— Có gì không cần đơn trị đau đầu không? — Có, Paracetamol hoặc Ibuprofen — cả hai không cần đơn. Uống tối đa 3 viên một ngày.","note":"rezeptfrei = OTC, không cần đơn","speak_de":"Ich brauche etwas gegen Kopfschmerzen."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg33_01","type":"FILL_BLANK","sentence_de":"Sie ___ dreimal täglich eine Tablette nehmen. (sollen)","hint_vi":"Bạn nên (được bảo bởi bác sĩ)","answer":"sollen","accept_also":["sollen"]},
      {"id":"tg33_02","type":"MULTIPLE_CHOICE","question_vi":"''Sie dürfen nicht rauchen'' = ?","options":["Bạn không muốn hút thuốc","Bạn không nên hút thuốc","Bạn không được phép hút thuốc","Bạn không thể hút thuốc"],"correct":2},
      {"id":"tg33_03","type":"FILL_BLANK","sentence_de":"Ich bin ___ gegen Penicillin.","hint_vi":"dị ứng","answer":"allergisch","accept_also":["allergisch"]},
      {"id":"tg33_04","type":"MULTIPLE_CHOICE","question_vi":"''rezeptfrei'' nghĩa là gì?","options":["Đắt tiền","Cần đơn thuốc","Không cần đơn thuốc","Không hiệu quả"],"correct":2},
      {"id":"tg33_05","type":"FILL_BLANK","sentence_de":"___ ___ Sie sich? — Ich ___ mich nicht gut.","hint_vi":"Cảm thấy thế nào ... tôi cảm","answer":"Wie fühlen, fühle","accept_also":["Wie fühlen / fühle"]}
    ],
    "practice": [
      {"id":"p33_01","type":"TRANSLATE","from":"vi","sentence":"Tôi cần gì đó trị đau đầu. Tôi dị ứng với Aspirin.","answer":"Ich brauche etwas gegen Kopfschmerzen. Ich bin allergisch gegen Aspirin.","accept_also":["Haben Sie etwas gegen Kopfschmerzen? Ich bin allergisch gegen Aspirin."]},
      {"id":"p33_02","type":"REORDER","words":["Alkohol","Sie","dürfen","nicht","trinken."],"correct_order":["Sie","dürfen","nicht","Alkohol","trinken."],"translation":"Bạn không được uống rượu."},
      {"id":"p33_03","type":"FILL_BLANK","sentence_de":"Sie ___ die Tabletten 5 Tage nehmen und ___ keinen Sport machen.","hint_vi":"phải (müssen) ... không được (dürfen nicht)","answer":"müssen, dürfen","accept_also":["müssen / dürfen"]}
    ]
  },
  "reading_passage": {
    "text_de": "Die Krankenversicherung in Deutschland\n\nIn Deutschland muss jeder Mensch eine Krankenversicherung haben. Es gibt zwei Arten: die gesetzliche (GKV) und die private (PKV). Die meisten Menschen sind in einer GKV, zum Beispiel der AOK oder der TK. Als Arbeitnehmer zahlt man ca. 7-8% des Gehalts, der Arbeitgeber zahlt den gleichen Anteil. Mit der Versicherungskarte kann man zum Arzt und bezahlt meistens nichts direkt. In der Apotheke bezahlt man eine kleine Zuzahlung von ca. 5-10 Euro pro Medikament.",
    "text_vi": "Bảo hiểm y tế ở Đức\n\nỞ Đức mọi người phải có bảo hiểm y tế. Có hai loại: bảo hiểm công (GKV) và tư (PKV). Hầu hết mọi người tham gia GKV, ví dụ AOK hoặc TK. Người đi làm đóng khoảng 7-8% lương, công ty đóng phần bằng nhau. Với thẻ bảo hiểm có thể đến bác sĩ và thường không phải trả tiền trực tiếp. Ở nhà thuốc đóng thêm khoảng 5-10 Euro mỗi loại thuốc.",
    "questions": [
      {"id":"rq33_01","type":"MULTIPLE_CHOICE","question_vi":"Người đi làm đóng bao nhiêu % lương cho bảo hiểm?","options":["5%","7-8%","10%","15%"],"correct":1},
      {"id":"rq33_02","type":"FILL_BLANK","question_vi":"Tại nhà thuốc phải đóng thêm khoảng bao nhiêu?","answer":"5-10 Euro","accept_also":["fünf bis zehn Euro","ca. 5-10 Euro"]}
    ]
  },
  "writing_prompt": {
    "task_de": "Sie sind krank beim Arzt. Beschreiben Sie Ihre Symptome und fragen Sie, was Sie tun sollen. (Dialog, 6-8 Zeilen)",
    "task_vi": "Bạn bệnh đến bác sĩ. Mô tả triệu chứng và hỏi bác sĩ cần làm gì. (Hội thoại, 6-8 dòng)",
    "min_sentences": 6,
    "example_answer": "Arzt: Guten Tag! Was haben Sie?\nIch: Mir tut der Kopf weh und ich habe Fieber — 38 Grad.\nArzt: Seit wann?\nIch: Seit vorgestern. Ich habe auch Husten.\nArzt: Sind Sie gegen etwas allergisch?\nIch: Nein.\nArzt: Ich verschreibe Ihnen Medikamente. Sie sollen viel trinken und dürfen nicht arbeiten.\nIch: Bekomme ich eine Krankmeldung?"
  },
  "audio_content": {
    "listen_words": [
      {"text":"Ich bin allergisch gegen...","meaning":"Tôi dị ứng với..."},
      {"text":"Sie dürfen nicht rauchen.","meaning":"Không được hút thuốc."},
      {"text":"Wie fühlen Sie sich?","meaning":"Ông/bà cảm thấy thế nào?"},
      {"text":"rezeptfrei","meaning":"không cần đơn thuốc"},
      {"text":"die Krankenversicherung","meaning":"bảo hiểm y tế"}
    ],
    "listen_dialogue": "Haben Sie etwas gegen Halsschmerzen? — Ja, wir haben Lutschtabletten — die sind rezeptfrei. — Gut. Und haben Sie Hustensaft? — Natürlich. Haben Sie eine Krankenversicherung? — Ja, hier ist meine Karte."
  }
}'::jsonb
WHERE day_number = 33 AND is_active = TRUE;
