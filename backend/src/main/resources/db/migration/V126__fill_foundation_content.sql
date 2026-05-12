-- V126: Fill Content for Foundation Nodes
-- Replaces empty content_json with actual content for the first few nodes so users can test

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de":"Das Alphabet","vi":"Bảng chữ cái tiếng Đức"},
  "overview": {"de":"Das Alphabet hat 26 Buchstaben.","vi":"Học bảng chữ cái A-Z và các ký tự đặc trưng."},
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "GRAMMAR",
      "title": {"de": "Die Buchstaben", "vi": "Các chữ cái"},
      "content": {"de": "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", "vi": "Bảng chữ cái tiếng Đức có 26 chữ cái cơ bản tương tự tiếng Anh, nhưng cách đọc khác nhau."},
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
      "id": "voc_a",
      "german": "der Apfel",
      "meaning": "Quả táo (A như Apfel)",
      "gender": "M",
      "color_code": "#2D9CDB",
      "gender_label": "der",
      "example_de": "A wie Apfel",
      "example_vi": "A như Apfel",
      "speak_de": "der Apfel",
      "tags": ["#Alphabet"]
    },
    {
      "id": "voc_b",
      "german": "das Buch",
      "meaning": "Quyển sách (B như Buch)",
      "gender": "N",
      "color_code": "#27AE60",
      "gender_label": "das",
      "example_de": "B wie Buch",
      "example_vi": "B như Buch",
      "speak_de": "das Buch",
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

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de":"Phonetik und Aussprache","vi":"Phát âm và Ghép vần"},
  "overview": {"de":"Wichtige Laute: ä, ö, ü, ei, ie, eu, sch, ch.","vi":"Các quy tắc phát âm quan trọng nhất."},
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "PRONUNCIATION",
      "title": {"de": "Vokale und Diphthonge", "vi": "Nguyên âm và nguyên âm kép"},
      "content": {"de": "ei = ai, ie = i dài, eu = oi", "vi": "ei đọc là 'ai', ie đọc là 'i' kéo dài, eu/äu đọc là 'oi'."},
      "tags": ["#Phonetik"]
    }
  ],
  "vocabulary": [
    {
      "id": "voc_ei",
      "german": "eins",
      "meaning": "Số 1",
      "gender": null,
      "color_code": null,
      "gender_label": null,
      "example_de": "eins, zwei, drei",
      "example_vi": "1, 2, 3",
      "speak_de": "eins",
      "tags": ["#Phonetik"]
    }
  ],
  "phrases": [],
  "examples": [],
  "exercises":{"theory_gate":[],"practice":[]}
}'::jsonb
WHERE title_de = 'Phonetik und Aussprache';

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de":"Zahlen 0 - 1000","vi":"Số đếm từ 0 đến 1000"},
  "overview": {"de":"eins, zwei, drei...","vi":"Học đếm số cơ bản."},
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "GRAMMAR",
      "title": {"de": "Zahlen 0-10", "vi": "Số đếm 0-10"},
      "content": {"de": "0 null, 1 eins, 2 zwei, 3 drei, 4 vier, 5 fünf, 6 sechs, 7 sieben, 8 acht, 9 neun, 10 zehn", "vi": "Các số cơ bản từ 0 đến 10."},
      "tags": ["#Zahlen"]
    }
  ],
  "vocabulary": [
    {
      "id": "num_1",
      "german": "eins",
      "meaning": "một",
      "gender": null,
      "color_code": null,
      "gender_label": null,
      "example_de": "Ich habe ein Auto.",
      "example_vi": "Tôi có một chiếc xe.",
      "speak_de": "eins",
      "tags": ["#Zahlen"]
    }
  ],
  "phrases": [],
  "examples": [],
  "exercises":{"theory_gate":[],"practice":[]}
}'::jsonb
WHERE title_de = 'Zahlen 0 - 1000';
