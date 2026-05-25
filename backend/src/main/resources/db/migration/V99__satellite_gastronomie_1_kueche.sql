-- V99__satellite_gastronomie_1_kueche.sql
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi,
  xp_reward, is_active, content_json, industry
) VALUES (
  'SATELLITE_LEAF',
  'Küche & Kochvokabular',
  'Từ vựng bếp chuyên nghiệp',
  'Fachsprache Koch/Köchin',
  150,
  TRUE,
  '{
    "title": {"de": "Küche & Kochvokabular", "vi": "Từ vựng bếp chuyên nghiệp"},
    "overview": {"de": "Fachsprache für Koch/Köchin: Zubereitung, Küchengeräte, HACCP-Grundlagen.", "vi": "Từ vựng chuyên ngành cho đầu bếp: kỹ thuật chế biến, dụng cụ bếp, vệ sinh an toàn thực phẩm HACCP."},
    "session_type": "SATELLITE",
    "industry": "GASTRONOMIE",
    "theory_cards": [
      {"type":"RULE","title":{"vi":"Kỹ thuật chế biến — Zubereitungsarten"},"content":{"vi":"kochen — luộc/nấu\nbraten — chiên/rán (chảo)\nbacken — nướng (lò)\ngrillen — nướng (vỉ)\ndämpfen — hấp\nfrittieren — chiên ngập dầu\ndünsten — xào/rim nhẹ\nschmoren — hầm\nmarinieren — ướp\nwürzen — nêm gia vị"},"tags":["#Kochen","#Gastronomie"]},
      {"type":"RULE","title":{"vi":"HACCP Grundlagen — Vệ sinh ATTP"},"content":{"vi":"HACCP = Hazard Analysis Critical Control Points\nDie 7 HACCP-Grundsätze:\n1. Gefahrenanalyse\n2. Kritische Kontrollpunkte bestimmen\n3. Grenzwerte festlegen\n4. Überwachung\n5. Korrekturmaßnahmen\n6. Dokumentation\n7. Überprüfung\n\nKritische Temperaturen:\n< 4°C: Kühlbereich (Kühlschrank)\n> 65°C: Warmhaltung\n> 75°C: Durchgaren (Mindesttemperatur)"},"tags":["#HACCP","#Hygiene"]}
    ],
    "vocabulary": [
      {"id":"sg01_01","german":"das Schneidebrett","meaning":"thớt","gender":"DAS","example_de":"Fleisch und Gemüse immer auf getrennten Schneidebretter schneiden!","example_vi":"Thịt và rau luôn cắt trên thớt riêng!","tags":["#Küche","#Hygiene"]},
      {"id":"sg01_02","german":"der Herd","meaning":"bếp nấu","gender":"DER","example_de":"Den Herd vor Schichtende immer ausschalten.","example_vi":"Luôn tắt bếp trước khi kết thúc ca.","tags":["#Küche"]},
      {"id":"sg01_03","german":"die Fritteuse","meaning":"nồi chiên ngập dầu","gender":"DIE","example_de":"Das Öl in der Fritteuse täglich wechseln.","example_vi":"Thay dầu chiên mỗi ngày.","tags":["#Küche"]},
      {"id":"sg01_04","german":"die Kühlkette","meaning":"chuỗi lạnh","gender":"DIE","example_de":"Die Kühlkette darf nicht unterbrochen werden!","example_vi":"Không được để đứt chuỗi lạnh!","tags":["#HACCP","#Hygiene"]},
      {"id":"sg01_05","german":"ablaufen","meaning":"hết hạn sử dụng","gender":null,"example_de":"Das Mindesthaltbarkeitsdatum ist abgelaufen — wegwerfen!","example_vi":"Đã hết hạn — vứt đi!","tags":["#Lebensmittel"]},
      {"id":"sg01_06","german":"die Portion","meaning":"khẩu phần","gender":"DIE","example_de":"Eine Portion Suppe: 250 ml.","example_vi":"Một khẩu phần súp: 250ml.","tags":["#Service"]},
      {"id":"sg01_07","german":"das Rezept","meaning":"công thức nấu ăn","gender":"DAS","example_de":"Folgen Sie genau dem Rezept!","example_vi":"Làm theo đúng công thức!","tags":["#Küche"]}
    ],
    "phrases": [
      {"german":"Die Kerntemperatur muss mindestens 75°C betragen.","meaning":"Nhiệt độ lõi phải đạt ít nhất 75°C.","speak_de":"Kerntemperatur 75 Grad."},
      {"german":"Bitte alle Oberflächen desinfizieren!","meaning":"Làm ơn khử trùng tất cả bề mặt!","speak_de":"Bitte desinfizieren!"},
      {"german":"Was ist das Tagesgericht?","meaning":"Món trong ngày là gì?","speak_de":"Was ist das Tagesgericht?"}
    ],
    "exercises": {
      "theory_gate": [
        {"id":"sat_g1_01","type":"MULTIPLE_CHOICE","question_vi":"Nhiệt độ tối thiểu để đảm bảo thực phẩm chín theo HACCP?","options":["60°C","65°C","75°C","90°C"],"correct":2},
        {"id":"sat_g1_02","type":"FILL_BLANK","sentence_de":"Fleisch immer auf ___ Schneidebretter schneiden.","hint_vi":"riêng biệt (getrennt)","answer":"getrennten","accept_also":["getrennten"]},
        {"id":"sat_g1_03","type":"MULTIPLE_CHOICE","question_vi":"''dämpfen'' là phương pháp nấu gì?","options":["Chiên ngập dầu","Hấp","Nướng vỉ","Hầm"],"correct":1},
        {"id":"sat_g1_04","type":"FILL_BLANK","sentence_de":"Die ___ darf nicht unterbrochen werden.","hint_vi":"chuỗi lạnh","answer":"Kühlkette","accept_also":["kühlkette"]},
        {"id":"sat_g1_05","type":"MULTIPLE_CHOICE","question_vi":"HACCP viết tắt của gì?","options":["Hot And Cold Control Points","Hazard Analysis Critical Control Points","Health And Catering Control Procedures","Hygiene And Cleaning Check Points"],"correct":1}
      ],
      "practice": [
        {"id":"sat_g1_p01","type":"TRANSLATE","from":"vi","sentence":"Kiểm tra hạn sử dụng trước khi sử dụng nguyên liệu!","answer":"Überprüfen Sie das Mindesthaltbarkeitsdatum vor der Verwendung!","accept_also":["MHD vor Verwendung prüfen!"]},
        {"id":"sat_g1_p02","type":"FILL_BLANK","sentence_de":"Das Fleisch muss bei mindestens ___ Grad ___temperatur gegart werden.","hint_vi":"75 ... lõi (Kern)","answer":"75, Kern","accept_also":["75 / Kern"]}
      ]
    },
    "reading_passage": {
      "text_de": "Hygiene in der Profiküche\n\nIn einer professionellen Küche ist Hygiene das Wichtigste. Jeder Koch muss die HACCP-Regeln kennen. Rohes Fleisch und Gemüse müssen immer getrennt gelagert und verarbeitet werden. Die Kühltemperatur für Fleisch beträgt maximal 4°C. Warme Speisen müssen auf mindestens 65°C gehalten werden. Alle Oberflächen müssen regelmäßig gereinigt und desinfiziert werden.",
      "text_vi": "Vệ sinh trong bếp chuyên nghiệp\n\nTrong bếp chuyên nghiệp, vệ sinh là quan trọng nhất. Mỗi đầu bếp phải biết quy tắc HACCP. Thịt sống và rau phải luôn được bảo quản và chế biến riêng. Nhiệt độ bảo quản thịt tối đa 4°C. Thức ăn nóng phải giữ ít nhất 65°C. Tất cả bề mặt phải được vệ sinh và khử trùng thường xuyên.",
      "questions": [
        {"id":"rq_sg1_01","type":"FILL_BLANK","question_vi":"Nhiệt độ bảo quản thịt tối đa?","answer":"4°C","accept_also":["vier Grad","maximal 4 Grad"]},
        {"id":"rq_sg1_02","type":"MULTIPLE_CHOICE","question_vi":"Thức ăn nóng phải giữ ít nhất bao nhiêu độ?","options":["55°C","60°C","65°C","75°C"],"correct":2}
      ]
    },
    "writing_prompt": {
      "task_de": "Beschreiben Sie 3 wichtige HACCP-Regeln für die Küche auf Deutsch.",
      "task_vi": "Mô tả 3 quy tắc HACCP quan trọng trong bếp bằng tiếng Đức.",
      "min_sentences": 3
    },
    "audio_content": {
      "listen_words": [
        {"text":"Die Kerntemperatur beträgt 75°C.","meaning":"Nhiệt độ lõi là 75°C."},
        {"text":"Kühlkette einhalten!","meaning":"Giữ chuỗi lạnh!"},
        {"text":"Hände waschen!","meaning":"Rửa tay!"}
      ]
    }
  }'::jsonb,
  'GASTRONOMIE'
) ON CONFLICT DO NOTHING;
