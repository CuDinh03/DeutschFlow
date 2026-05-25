-- V127: Add full alphabet to "Das Alphabet" node
UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de":"Das Alphabet","vi":"Bảng chữ cái tiếng Đức"},
  "overview": {"de":"Das Alphabet hat 26 Buchstaben.","vi":"Học bảng chữ cái A-Z và các ký tự đặc trưng."},
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "GRAMMAR",
      "title": {"de": "Die Buchstaben", "vi": "Các chữ cái"},
      "content": {"de": "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", "vi": "Bảng chữ cái tiếng Đức có 26 chữ cái cơ bản tương tự tiếng Anh, nhưng cách đọc khác nhau. Hãy nghe phát âm từng chữ cái ở phần từ vựng bên dưới."},
      "tags": ["#Alphabet"]
    },
    {
      "type": "GRAMMAR",
      "title": {"de": "Umlaute und Eszett", "vi": "Ký tự đặc biệt"},
      "content": {"de": "Ä ä, Ö ö, Ü ü, ß", "vi": "Tiếng Đức có thêm 3 biến âm (Umlaut) và 1 chữ s kép (Eszett/scharfes S)."},
      "tags": ["#Sonderzeichen"]
    }
  ],
  "vocabulary": [
    {
      "id": "alpha_a",
      "german": "A, a",
      "meaning": "Chữ A (Ví dụ: der Apfel - quả táo)",
      "example_de": "A wie Apfel",
      "example_vi": "A như Apfel",
      "speak_de": "A",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_b",
      "german": "B, b",
      "meaning": "Chữ B (Ví dụ: das Buch - quyển sách)",
      "example_de": "B wie Buch",
      "example_vi": "B như Buch",
      "speak_de": "B",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_c",
      "german": "C, c",
      "meaning": "Chữ C (Ví dụ: der Computer - máy tính)",
      "example_de": "C wie Computer",
      "example_vi": "C như Computer",
      "speak_de": "C",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_d",
      "german": "D, d",
      "meaning": "Chữ D (Ví dụ: das Dach - mái nhà)",
      "example_de": "D wie Dach",
      "example_vi": "D như Dach",
      "speak_de": "D",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_e",
      "german": "E, e",
      "meaning": "Chữ E (Ví dụ: der Elefant - con voi)",
      "example_de": "E wie Elefant",
      "example_vi": "E như Elefant",
      "speak_de": "E",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_f",
      "german": "F, f",
      "meaning": "Chữ F (Ví dụ: der Fisch - con cá)",
      "example_de": "F wie Fisch",
      "example_vi": "F như Fisch",
      "speak_de": "F",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_g",
      "german": "G, g",
      "meaning": "Chữ G (Ví dụ: das Geld - tiền)",
      "example_de": "G wie Geld",
      "example_vi": "G như Geld",
      "speak_de": "G",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_h",
      "german": "H, h",
      "meaning": "Chữ H (Ví dụ: der Hund - con chó)",
      "example_de": "H wie Hund",
      "example_vi": "H như Hund",
      "speak_de": "H",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_i",
      "german": "I, i",
      "meaning": "Chữ I (Ví dụ: der Igel - con nhím)",
      "example_de": "I wie Igel",
      "example_vi": "I như Igel",
      "speak_de": "I",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_j",
      "german": "J, j",
      "meaning": "Chữ J (Ví dụ: die Jacke - áo khoác)",
      "example_de": "J wie Jacke",
      "example_vi": "J như Jacke",
      "speak_de": "J",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_k",
      "german": "K, k",
      "meaning": "Chữ K (Ví dụ: die Katze - con mèo)",
      "example_de": "K wie Katze",
      "example_vi": "K như Katze",
      "speak_de": "K",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_l",
      "german": "L, l",
      "meaning": "Chữ L (Ví dụ: die Lampe - cái đèn)",
      "example_de": "L wie Lampe",
      "example_vi": "L như Lampe",
      "speak_de": "L",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_m",
      "german": "M, m",
      "meaning": "Chữ M (Ví dụ: die Maus - con chuột)",
      "example_de": "M wie Maus",
      "example_vi": "M như Maus",
      "speak_de": "M",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_n",
      "german": "N, n",
      "meaning": "Chữ N (Ví dụ: die Nase - cái mũi)",
      "example_de": "N wie Nase",
      "example_vi": "N như Nase",
      "speak_de": "N",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_o",
      "german": "O, o",
      "meaning": "Chữ O (Ví dụ: die Oma - người bà)",
      "example_de": "O wie Oma",
      "example_vi": "O như Oma",
      "speak_de": "O",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_p",
      "german": "P, p",
      "meaning": "Chữ P (Ví dụ: die Pizza - bánh pizza)",
      "example_de": "P wie Pizza",
      "example_vi": "P như Pizza",
      "speak_de": "P",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_q",
      "german": "Q, q",
      "meaning": "Chữ Q (Ví dụ: die Qualle - con sứa)",
      "example_de": "Q wie Qualle",
      "example_vi": "Q như Qualle",
      "speak_de": "Q",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_r",
      "german": "R, r",
      "meaning": "Chữ R (Ví dụ: der Regen - cơn mưa)",
      "example_de": "R wie Regen",
      "example_vi": "R như Regen",
      "speak_de": "R",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_s",
      "german": "S, s",
      "meaning": "Chữ S (Ví dụ: die Sonne - mặt trời)",
      "example_de": "S wie Sonne",
      "example_vi": "S như Sonne",
      "speak_de": "S",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_t",
      "german": "T, t",
      "meaning": "Chữ T (Ví dụ: der Tisch - cái bàn)",
      "example_de": "T wie Tisch",
      "example_vi": "T như Tisch",
      "speak_de": "T",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_u",
      "german": "U, u",
      "meaning": "Chữ U (Ví dụ: die Uhr - đồng hồ)",
      "example_de": "U wie Uhr",
      "example_vi": "U như Uhr",
      "speak_de": "U",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_v",
      "german": "V, v",
      "meaning": "Chữ V (Ví dụ: der Vogel - con chim)",
      "example_de": "V wie Vogel",
      "example_vi": "V như Vogel",
      "speak_de": "V",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_w",
      "german": "W, w",
      "meaning": "Chữ W (Ví dụ: das Wasser - nước)",
      "example_de": "W wie Wasser",
      "example_vi": "W như Wasser",
      "speak_de": "W",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_x",
      "german": "X, x",
      "meaning": "Chữ X (Ví dụ: das Xylofon - đàn mộc cầm)",
      "example_de": "X wie Xylofon",
      "example_vi": "X như Xylofon",
      "speak_de": "X",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_y",
      "german": "Y, y",
      "meaning": "Chữ Y (Ví dụ: das Yoga - môn yoga)",
      "example_de": "Y wie Yoga",
      "example_vi": "Y như Yoga",
      "speak_de": "Ypsilon",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_z",
      "german": "Z, z",
      "meaning": "Chữ Z (Ví dụ: das Zebra - con ngựa vằn)",
      "example_de": "Z wie Zebra",
      "example_vi": "Z như Zebra",
      "speak_de": "Z",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_ae",
      "german": "Ä, ä",
      "meaning": "Chữ Ä (Ví dụ: der Ärger - sự tức giận)",
      "example_de": "Ä wie Ärger",
      "example_vi": "Ä như Ärger",
      "speak_de": "Ä",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_oe",
      "german": "Ö, ö",
      "meaning": "Chữ Ö (Ví dụ: das Öl - dầu)",
      "example_de": "Ö wie Öl",
      "example_vi": "Ö như Öl",
      "speak_de": "Ö",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_ue",
      "german": "Ü, ü",
      "meaning": "Chữ Ü (Ví dụ: die Übung - bài tập)",
      "example_de": "Ü wie Übung",
      "example_vi": "Ü như Übung",
      "speak_de": "Ü",
      "tags": ["#Alphabet"]
    },
    {
      "id": "alpha_ss",
      "german": "ß (Eszett)",
      "meaning": "Chữ s kép (Ví dụ: der Fuß - bàn chân)",
      "example_de": "ß wie in Fuß",
      "example_vi": "ß như trong chữ Fuß",
      "speak_de": "Eszett",
      "tags": ["#Alphabet"]
    }
  ],
  "phrases": [
    {
      "german": "Wie buchstabiert man das?",
      "meaning": "Đánh vần cái đó như thế nào?",
      "speak_de": "Wie buchstabiert man das?"
    }
  ],
  "examples": [],
  "exercises":{"theory_gate":[],"practice":[]}
}'::jsonb
WHERE title_de = 'Das Alphabet';
