-- V181: B1 Curriculum — Goethe-Zertifikat B1
-- 10 core nodes covering key B1 grammar and communication skills
-- Prerequisite: A2 final node must be completed

-- Fresh-replay safety: skill_tree_edges has no CREATE migration (referenced only by the seed
-- below, not by application code). Create it so a from-scratch Flyway run succeeds; no-op elsewhere.
CREATE TABLE IF NOT EXISTS skill_tree_edges (
    id             BIGSERIAL    PRIMARY KEY,
    source_node_id BIGINT       NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
    target_node_id BIGINT       NOT NULL REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (source_node_id, target_node_id)
);

-- Drift reconciliation: some environments (prod RDS) have node_code set NOT NULL out-of-band,
-- but no migration ever added that constraint (V144 introduced node_code as nullable, and every
-- skill_tree_nodes seed omits it — node_code is roadmap metadata, unused by application code).
-- Drop the constraint if present so the seed below inserts everywhere. No-op on fresh DBs where
-- the column is already nullable (Postgres DROP NOT NULL on a nullable column is a safe no-op).
ALTER TABLE skill_tree_nodes ALTER COLUMN node_code DROP NOT NULL;

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ═══════════════ B1: Grammatik Basis ═══════════════

('CORE_TRUNK',
 'Indirekte Rede (Konjunktiv I)',
 'Lời dẫn gián tiếp (Konjunktiv I)',
 'Kể lại lời nói của người khác: Er sagt, er komme. / Er sagt, dass er kommt.',
 '💬', 'CORE_B1', 51, 13, 51, 'B1', 7, 320, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#IndirekteRede','#KonjunktivI','#B1'],
 '{
  "title":{"de":"Indirekte Rede — Konjunktiv I","vi":"Lời dẫn gián tiếp"},
  "overview":{"de":"Er sagt, er komme morgen. / Sie meint, dass das stimme.","vi":"Dùng để kể lại lời nói người khác mà không trực tiếp trích dẫn. Hay dùng trong báo chí và văn viết."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Hai cách viết lời dẫn gián tiếp"},"content":{"vi":"CÁCH 1: Konjunktiv I trực tiếp (báo chí):\nEr sagt, er komme morgen.\nSie meint, das sei richtig.\n\nCÁCH 2: dass + Indikativ (thông dụng hơn):\nEr sagt, dass er morgen kommt.\nSie meint, dass das richtig ist.\n\n→ Cách 2 phổ biến hơn trong giao tiếp hàng ngày!"},"tags":["#IndirekteRede","#B1"]},
    {"type":"RULE","title":{"vi":"Chia Konjunktiv I — sein quan trọng nhất"},"content":{"vi":"sein (quan trọng nhất!):\nik sei / du seist / er sei / wir seien / sie seien\n\nhaben: ich habe / du habest / er habe\nkommen: ich komme / du kommest / er komme\narbeiten: ich arbeite / er arbeite\n\n💡 Khi KI trùng với Indikativ (ich komme = ich komme), dùng KII hoặc dass+Indikativ"},"tags":["#KonjunktivI","#Konjugation"]},
    {"type":"EXAMPLE","title":{"vi":"Ví dụ tin tức"},"content":{"vi":"Báo đưa tin:\nDer Minister sagte, er wolle mehr Schulen bauen.\nDie Expertin betonte, dass die Situation ernst sei.\nLaut dem Bericht seien die Preise gestiegen.\n\nTin tức dùng KI vì báo chí không xác nhận là sự thật!"},"tags":["#IndirekteRede","#Presse"]}
  ],
  "vocabulary":[
    {"id":"v_ind_01","german":"laut + Dativ","meaning":"theo (nguồn tin)","gender":null,"color_code":null,"gender_label":null,"example_de":"Laut dem Bericht seien die Preise gestiegen.","example_vi":"Theo báo cáo, giá cả đã tăng.","speak_de":"Laut der Zeitung...","tags":["#IndirekteRede","#B1"],"ai_speech_hints":{"focus_phonemes":["/laʊ̯t/"],"common_errors_vi":["laut: au=/aʊ/"],"ipa_target":"laʊ̯t"}},
    {"id":"v_ind_02","german":"behaupten","meaning":"khẳng định / cho rằng","gender":null,"color_code":null,"gender_label":null,"example_de":"Er behauptet, dass er die Wahrheit sagt.","example_vi":"Anh ấy khẳng định rằng anh ấy nói thật.","speak_de":"Er behauptet, dass...","tags":["#IndirekteRede","#B1"],"ai_speech_hints":{"focus_phonemes":["/bəˈhaʊ̯ptən/"],"common_errors_vi":["be-HAUPT-en: nhấn HAUPT"],"ipa_target":"bəˈhaʊ̯ptən"}},
    {"id":"v_ind_03","german":"betonen","meaning":"nhấn mạnh","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie betonte, dass Sicherheit wichtig sei.","example_vi":"Cô ấy nhấn mạnh rằng an toàn là quan trọng.","speak_de":"Sie betonte, dass...","tags":["#IndirekteRede","#B1"],"ai_speech_hints":{"focus_phonemes":["/bəˈtoːnən/"],"common_errors_vi":["be-TO-nen: nhấn TO"],"ipa_target":"bəˈtoːnən"}}
  ],
  "phrases":[
    {"german":"Er sagt, er komme morgen.","meaning":"Anh ấy nói anh ấy đến ngày mai.","speak_de":"Er sagt, dass er morgen kommt."},
    {"german":"Laut der Zeitung sei das wahr.","meaning":"Theo báo, điều đó là thật.","speak_de":"Laut der Zeitung..."},
    {"german":"Sie behauptet, das nicht gewusst zu haben.","meaning":"Cô ấy cho rằng cô không biết điều đó.","speak_de":"Sie behauptet, das nicht gewusst zu haben."}
  ],
  "examples":[
    {"german":"Nachrichtenagentur DPA:\n''Der Bundeskanzler erklärte, die Wirtschaft wachse wieder. Er betonte, dass neue Arbeitsplätze entstünden. Laut dem Minister seien die Maßnahmen erfolgreich.''\n\nAlltagsgespräch:\n— Was hat Maria gesagt?\n— Sie hat gesagt, dass sie heute nicht kommen kann.\n— Und warum? — Sie meinte, sie sei krank.","translation":"Thông tấn xã DPA:\n''Thủ tướng tuyên bố nền kinh tế đang tăng trưởng trở lại. Ông nhấn mạnh rằng các việc làm mới đang được tạo ra. Theo bộ trưởng, các biện pháp đã thành công.''\n\nHội thoại hàng ngày:\n— Maria nói gì?\n— Cô ấy nói cô ấy hôm nay không đến được.\n— Sao thế? — Cô ấy nói cô bị ốm.","note":"KI trong báo chí; dass+Indikativ trong hội thoại","speak_de":"Sie sagt, dass sie krank sei."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg51_01","type":"FILL_BLANK","sentence_de":"Er sagt, er ___ krank. (sein = KI)","hint_vi":"KI của sein, 3. Person: sei","answer":"sei","accept_also":["sei"]},
      {"id":"tg51_02","type":"MULTIPLE_CHOICE","question_vi":"Lời dẫn gián tiếp là gì?","options":["Direkt zitieren","Sagen was jemand gesagt hat","Fragen stellen","Befehl geben"],"correct":1},
      {"id":"tg51_03","type":"FILL_BLANK","sentence_de":"Laut dem Bericht ___ die Preise gestiegen. (sein KI)","hint_vi":"seien","answer":"seien","accept_also":["seien"]},
      {"id":"tg51_04","type":"MULTIPLE_CHOICE","question_vi":"Câu nào đúng?","options":["Er sagt, dass er komme.","Er sagt, dass er kommt.","Er sagt, er kommt.","Er sagt, kommt er."],"correct":1}
    ],
    "practice":[
      {"id":"p51_01","type":"TRANSLATE","from":"vi","sentence":"Cô ấy nói rằng cô ấy không có thời gian.","answer":"Sie sagt, dass sie keine Zeit hat.","accept_also":["Sie sagt, sie habe keine Zeit."]},
      {"id":"p51_02","type":"REORDER","words":["komme.","er","sagt,","morgen","Er"],"correct_order":["Er","sagt,","er","komme","morgen."],"translation":"Anh ấy nói anh ấy đến ngày mai."},
      {"id":"p51_03","type":"FILL_BLANK","sentence_de":"Der Arzt sagte, ich ___ mehr schlafen. (sollen KI = solle)","hint_vi":"solle","answer":"solle","accept_also":["solle","soll"]}
    ]
  },
  "reading_passage":{
    "text_de":"Die Nachrichten heute\n\nLaut dem Wetterbericht werde es morgen regnen. Der Meteorologe sagte, die Temperaturen fielen auf 8 Grad. Ein Sprecher der Bahn erklärte, dass viele Züge wegen des Sturms verspätet seien. Er betonte, man arbeite daran, den Betrieb zu normalisieren. Laut Experten könnte der Sturm bis Mittwoch anhalten.",
    "text_vi":"Tin tức hôm nay\n\nTheo dự báo thời tiết, ngày mai sẽ có mưa. Nhà khí tượng học nói rằng nhiệt độ sẽ giảm xuống 8 độ. Người phát ngôn của đường sắt giải thích rằng nhiều chuyến tàu bị chậm do bão. Ông nhấn mạnh rằng người ta đang cố gắng bình thường hóa hoạt động. Theo các chuyên gia, cơn bão có thể kéo dài đến thứ Tư.",
    "questions":[
      {"id":"rq51_01","type":"FILL_BLANK","question_vi":"Nhiệt độ sẽ giảm xuống bao nhiêu?","answer":"8 Grad","accept_also":["acht Grad"]},
      {"id":"rq51_02","type":"MULTIPLE_CHOICE","question_vi":"Tại sao tàu bị chậm?","options":["wegen des Regens","wegen des Sturms","wegen der Kälte","wegen einer Panne"],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Schreiben Sie 4 Sätze mit indirekter Rede (''jemand sagte, dass...'').","task_vi":"Viết 4 câu dùng lời dẫn gián tiếp (ai đó nói rằng...).","min_sentences":4,"example_answer":"Mein Lehrer sagte, dass ich gute Fortschritte mache.\nMeine Mutter meinte, ich solle mehr essen.\nLaut dem Arzt sei mein Blutdruck normal.\nDer Chef erklärte, dass wir mehr Zeit bekommen."},
  "audio_content":{
    "listen_words":[
      {"text":"Er sagt, er komme morgen.","meaning":"Anh ấy nói anh ấy đến ngày mai."},
      {"text":"Laut der Zeitung ist das wahr.","meaning":"Theo báo, điều đó là thật."},
      {"text":"Sie betonte, dass das wichtig sei.","meaning":"Cô ấy nhấn mạnh điều đó quan trọng."}
    ],
    "listen_dialogue":"Was hat der Chef gesagt? — Er sagte, wir sollten pünktlich sein. — Und was noch? — Er betonte, dass die Präsentation wichtig sei. — Hat er gesagt, wann sie stattfindet? — Er meinte, sie finde am Freitag statt."
  }
}'::jsonb),

('CORE_TRUNK',
 'Plusquamperfekt',
 'Quá khứ hoàn thành (Plusquamperfekt)',
 'Hành động xảy ra TRƯỚC một hành động khác trong quá khứ: hatte/war + Partizip II.',
 '⏪', 'CORE_B1', 52, 13, 52, 'B1', 7, 310, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#Plusquamperfekt','#Vergangenheit','#B1'],
 '{
  "title":{"de":"Plusquamperfekt — Vorvergangenheit","vi":"Quá khứ hoàn thành — hành động trước trong quá khứ"},
  "overview":{"de":"Als ich ankam, hatte er schon gegessen. Als sie anrief, war ich schon eingeschlafen.","vi":"Plusquamperfekt mô tả hành động xảy ra TRƯỚC một hành động quá khứ khác."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Cấu trúc Plusquamperfekt"},"content":{"vi":"hatte/war (Imperfekt) + Partizip II\n\nhaben-Verben:\nIch hatte gegessen.\nDu hattest geschlafen.\nEr/sie hatte gearbeitet.\n\nsein-Verben (chuyển động & Zustandsänderung):\nIch war gegangen.\nSie war angekommen.\nEr war eingeschlafen.\n\n→ Quy tắc chọn haben/sein GIỐNG Perfekt!"},"tags":["#Plusquamperfekt","#B1"]},
    {"type":"RULE","title":{"vi":"Plusquamperfekt trong ngữ cảnh"},"content":{"vi":"Thường xuất hiện sau als/nachdem:\n\nAls ich ankam, hatte er schon gegessen.\n(Khi tôi đến, anh ấy đã ăn rồi)\n\nNachdem sie die Prüfung bestanden hatte, feierte sie.\n(Sau khi cô ấy đậu thi, cô ấy ăn mừng)\n\n→ PQK = hành động thứ nhất (trước)\n→ Perfekt/Präteritum = hành động thứ hai (sau)"},"tags":["#Plusquamperfekt","#Zeitstrahl"]},
    {"type":"EXAMPLE","title":{"vi":"So sánh thứ tự thời gian"},"content":{"vi":"Chronologie:\n1. Er lernte viel. (trước)\n2. Er bestand die Prüfung. (sau)\n\nMột câu: Weil er viel gelernt hatte, bestand er die Prüfung.\n\n1. Sie aß zu Mittag. (trước)\n2. Ich rief an. (sau)\n\nMột câu: Als ich anrief, hatte sie schon gegessen."},"tags":["#Plusquamperfekt","#Chronologie"]}
  ],
  "vocabulary":[
    {"id":"v_ppq_01","german":"nachdem","meaning":"sau khi","gender":null,"color_code":null,"gender_label":null,"example_de":"Nachdem er gegessen hatte, schlief er ein.","example_vi":"Sau khi ăn xong, anh ấy ngủ thiếp đi.","speak_de":"Nachdem er gegessen hatte,...","tags":["#Plusquamperfekt","#B1"],"ai_speech_hints":{"focus_phonemes":["/ˈnaːxdeːm/"],"common_errors_vi":["nach-DEM: nhấn DEM"],"ipa_target":"ˈnaːxdeːm"}},
    {"id":"v_ppq_02","german":"bereits / schon","meaning":"đã / rồi","gender":null,"color_code":null,"gender_label":null,"example_de":"Als sie ankam, hatte er bereits gefrühstückt.","example_vi":"Khi cô ấy đến, anh ấy đã ăn sáng rồi.","speak_de":"Er hatte bereits gegessen.","tags":["#Plusquamperfekt","#B1"],"ai_speech_hints":{"focus_phonemes":["/bəˈʁaɪ̯ts/"],"common_errors_vi":["bereits: be-REITS"],"ipa_target":"bəˈʁaɪ̯ts"}}
  ],
  "phrases":[
    {"german":"Als ich ankam, hatte er schon gegessen.","meaning":"Khi tôi đến, anh ấy đã ăn rồi.","speak_de":"Als ich ankam, hatte er schon gegessen."},
    {"german":"Nachdem sie den Film gesehen hatte, schlief sie ein.","meaning":"Sau khi xem phim, cô ấy ngủ thiếp đi.","speak_de":"Nachdem sie den Film gesehen hatte, schlief sie ein."}
  ],
  "examples":[
    {"german":"Eine Geschichte:\nVorhin war die Situation noch schlimmer. Bevor der Arzt ankam, hatte der Patient schon lange gewartet. Nachdem er untersucht worden war, bekam er Medikamente. Als die Familie anrief, war er bereits besser.","translation":"Một câu chuyện:\nTrước đó tình hình còn tệ hơn. Trước khi bác sĩ đến, bệnh nhân đã chờ đợi lâu rồi. Sau khi được khám, anh ấy nhận thuốc. Khi gia đình gọi điện, anh ấy đã khỏe hơn rồi.","note":"PQK = hành động xảy ra trước trong quá khứ","speak_de":"Als der Arzt ankam, hatte er schon gewartet."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg52_01","type":"FILL_BLANK","sentence_de":"Als ich ankam, ___ er schon ___. (essen - Plusquamperfekt)","hint_vi":"hatte gegessen","answer":"hatte, gegessen","accept_also":["hatte / gegessen"]},
      {"id":"tg52_02","type":"MULTIPLE_CHOICE","question_vi":"Plusquamperfekt dùng khi nào?","options":["Hành động trong tương lai","Hành động xảy ra trước trong quá khứ","Hành động hiện tại","Hành động lặp lại"],"correct":1},
      {"id":"tg52_03","type":"FILL_BLANK","sentence_de":"Nachdem sie ___ ___, feierte sie. (bestehen - Perf. mit haben)","hint_vi":"hatte bestanden","answer":"hatte, bestanden","accept_also":["hatte / bestanden"]},
      {"id":"tg52_04","type":"FILL_BLANK","sentence_de":"Als ich aufwachte, ___ sie schon ___ ___. (abfahren - sein)","hint_vi":"war abgefahren","answer":"war, abgefahren","accept_also":["war / abgefahren"]}
    ],
    "practice":[
      {"id":"p52_01","type":"TRANSLATE","from":"vi","sentence":"Khi tôi đến nơi, buổi hòa nhạc đã kết thúc rồi.","answer":"Als ich ankam, hatte das Konzert schon geendet.","accept_also":["Als ich ankam, war das Konzert schon zu Ende."]},
      {"id":"p52_02","type":"REORDER","words":["hatte","schon","Wir","Als","er","ankam,","gegessen."],"correct_order":["Als","er","ankam,","hatten","wir","schon","gegessen."],"translation":"Khi anh ấy đến, chúng tôi đã ăn rồi."},
      {"id":"p52_03","type":"FILL_BLANK","sentence_de":"Nachdem ich den Brief ___ ___, schickte ich ihn ab. (schreiben - Perf.)","hint_vi":"hatte geschrieben","answer":"hatte, geschrieben","accept_also":["hatte / geschrieben"]}
    ]
  },
  "reading_passage":{
    "text_de":"Ein langer Tag\n\nAls Maria endlich nach Hause kam, war sie erschöpft. Sie hatte den ganzen Tag gearbeitet und hatte kaum gegessen. Ihr Freund hatte schon gekocht, als sie ankam. Nachdem sie geduscht hatte, aß sie mit ihm zusammen. Dann sahen sie zusammen einen Film, den Maria schon längst hatte sehen wollen. Als der Film zu Ende war, waren beide eingeschlafen.",
    "text_vi":"Một ngày dài\n\nKhi Maria cuối cùng về đến nhà, cô kiệt sức. Cô đã làm việc cả ngày và hầu như không ăn gì. Bạn trai cô đã nấu ăn xong khi cô về. Sau khi tắm xong, cô ăn cùng anh ấy. Sau đó họ cùng xem một bộ phim mà Maria từ lâu đã muốn xem. Khi phim kết thúc, cả hai đã ngủ thiếp đi.",
    "questions":[
      {"id":"rq52_01","type":"FILL_BLANK","question_vi":"Bạn trai đã làm gì trước khi Maria về?","answer":"gekocht","accept_also":["Er hatte gekocht","er hatte Essen gekocht"]},
      {"id":"rq52_02","type":"MULTIPLE_CHOICE","question_vi":"Điều gì xảy ra cuối cùng?","options":["Sie gingen aus.","Beide schliefen ein.","Sie stritten sich.","Sie aßen noch einmal."],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Erzählen Sie von einem Erlebnis. Benutzen Sie Plusquamperfekt für eine Vorgeschichte.","task_vi":"Kể về một trải nghiệm. Dùng Plusquamperfekt cho phần đã xảy ra trước.","min_sentences":5,"example_answer":"Letzten Sommer fuhr ich nach Berlin. Bevor ich abfuhr, hatte ich viel geplant. Als ich ankam, hatte es bereits geregnet. Nachdem ich eingecheckt hatte, erkundete ich die Stadt. Am nächsten Tag war ich froh, denn das Wetter hatte sich verbessert."},
  "audio_content":{
    "listen_words":[
      {"text":"Als ich ankam, hatte er schon gegessen.","meaning":"Khi tôi đến, anh ấy đã ăn rồi."},
      {"text":"Nachdem sie angerufen hatte, kam er sofort.","meaning":"Sau khi cô ấy gọi điện, anh ấy đến ngay."}
    ],
    "listen_dialogue":"Warum bist du so spät? — Als ich losfuhr, hatte mein Auto eine Panne. — Oh nein! Was machtest du dann? — Nachdem ich jemanden angerufen hatte, kam ein Pannendienst. — Wie lange hast du gewartet? — Ich hatte schon zwei Stunden gewartet, als der Helfer ankam."
  }
}'::jsonb),

('CORE_TRUNK',
 'Modalverben: Bedeutungsnuancen B1',
 'Sắc thái nghĩa Modalverben mức B1',
 'dürfen/müssen/sollen/wollen/mögen — phân biệt nghĩa suy diễn và nghĩa tình thái.',
 '🎯', 'CORE_B1', 53, 13, 53, 'B1', 7, 300, 1,
 11, 'Ngữ pháp B1', 'Grammatik B1', 'LESSON',
 ARRAY['#Modalverben','#B1','#Nuancen'],
 '{
  "title":{"de":"Modalverben — Bedeutungsnuancen B1","vi":"Modalverben — sắc thái nghĩa B1"},
  "overview":{"de":"müssen/nicht dürfen vs. nicht müssen. sollen/wollen Unterschied. mögen/möchten.","vi":"B1 cần hiểu sắc thái tinh tế: müssen ≠ sollen, nicht müssen ≠ nicht dürfen."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"müssen vs. nicht dürfen"},"content":{"vi":"müssen = BẮT BUỘC phải làm\nIch muss die Prüfung machen. (Tôi phải thi.)\n\nnicht dürfen = KHÔNG ĐƯỢC PHÉP\nDu darfst hier nicht rauchen. (Cậu không được hút thuốc ở đây.)\n\nnicht müssen = KHÔNG CẦN THIẾT (không bắt buộc)\nDu musst heute nicht kommen. (Cậu không cần đến hôm nay.)\n\n⚠️ nicht müssen ≠ nicht dürfen!\nDu musst nicht kommen. (không cần) ≠ Du darfst nicht kommen. (cấm đến!)"},"tags":["#Modalverben","#B1"]},
    {"type":"RULE","title":{"vi":"sollen vs. wollen"},"content":{"vi":"sollen = được yêu cầu (bởi người khác)\nIch soll um 9 Uhr da sein. (Sếp bảo tôi phải đến lúc 9h.)\nWas soll ich tun? (Tôi phải làm gì?)\n\nwollen = muốn (bản thân mình)\nIch will nach Deutschland reisen. (Tôi muốn đi Đức.)\nSie will Ärztin werden. (Cô ấy muốn làm bác sĩ.)\n\n→ sollen = ý muốn người khác\n→ wollen = ý muốn bản thân"},"tags":["#sollen","#wollen","#B1"]},
    {"type":"RULE","title":{"vi":"mögen vs. möchten"},"content":{"vi":"mögen (hiện tại) = thích (something always true)\nIch mag Kaffee. (Tôi thích cà phê nói chung.)\nEr mag keine laute Musik. (Anh ấy không thích nhạc ồn.)\n\nmöchten = muốn (cụ thể, ngay bây giờ)\nIch möchte einen Kaffee. (Tôi muốn một tách cà phê lúc này.)\nMöchten Sie noch Wein? (Ông/bà còn muốn rượu không?)\n\n→ mögen = sở thích chung\n→ möchten = mong muốn cụ thể"},"tags":["#mögen","#möchten","#B1"]}
  ],
  "vocabulary":[
    {"id":"v_mod_01","german":"sollen","meaning":"phải / được yêu cầu (bởi người khác)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich soll um 8 Uhr aufstehen.","example_vi":"Tôi được yêu cầu dậy lúc 8 giờ.","speak_de":"Was soll ich tun?","tags":["#Modalverben","#B1"],"ai_speech_hints":{"focus_phonemes":["/zɔlən/"],"common_errors_vi":["sollen: s=/z/ ở đầu"],"ipa_target":"zɔlən"}},
    {"id":"v_mod_02","german":"dürfen (nicht dürfen)","meaning":"được phép (không được phép)","gender":null,"color_code":null,"gender_label":null,"example_de":"Hier darf man nicht parken.","example_vi":"Không được đỗ xe ở đây.","speak_de":"Darf ich hier parken?","tags":["#Modalverben","#B1"],"ai_speech_hints":{"focus_phonemes":["/ˈdʏʁfən/"],"common_errors_vi":["dürfen: ü=/ʏ/ tròn môi"],"ipa_target":"ˈdʏʁfən"}}
  ],
  "phrases":[
    {"german":"Du musst das nicht machen.","meaning":"Bạn không cần làm điều đó.","speak_de":"Du musst das nicht machen."},
    {"german":"Du darfst hier nicht rauchen.","meaning":"Bạn không được hút thuốc ở đây.","speak_de":"Du darfst hier nicht rauchen."},
    {"german":"Was soll ich jetzt tun?","meaning":"Bây giờ tôi phải làm gì?","speak_de":"Was soll ich tun?"}
  ],
  "examples":[
    {"german":"Im Büro:\nChef: ''Sie sollen den Bericht bis Freitag fertigstellen.''\nMitarbeiter: ''Ich muss dann Überstunden machen.''\nChef: ''Nein, das müssen Sie nicht. Aber Sie dürfen nicht die Deadline verpassen!''\nMitarbeiter: ''Ich verstehe. Ich will das unbedingt rechtzeitig fertig haben.''","translation":"Tại văn phòng:\nSếp: ''Anh phải hoàn thành báo cáo trước thứ Sáu.''\nNhân viên: ''Vậy tôi phải làm thêm giờ.''\nSếp: ''Không, anh không cần đâu. Nhưng anh không được trễ deadline!''\nNhân viên: ''Tôi hiểu rồi. Tôi nhất định muốn hoàn thành đúng hạn.''","note":"sollen=bị yêu cầu; nicht müssen=không bắt buộc; nicht dürfen=cấm; wollen=muốn","speak_de":"Sie sollen den Bericht fertigstellen."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg53_01","type":"MULTIPLE_CHOICE","question_vi":"''Du ___ hier nicht rauchen'' — điền gì? (cấm)","options":["musst nicht","darfst nicht","sollst nicht","willst nicht"],"correct":1},
      {"id":"tg53_02","type":"MULTIPLE_CHOICE","question_vi":"''Du ___ nicht kommen'' = không cần đến","options":["darfst","musst","sollst","möchtest"],"correct":1},
      {"id":"tg53_03","type":"FILL_BLANK","sentence_de":"Ich ___ nach Deutschland — das ist mein Traum! (wollen)","hint_vi":"will","answer":"will","accept_also":["will"]},
      {"id":"tg53_04","type":"MULTIPLE_CHOICE","question_vi":"''Ich mag Kaffee'' nghĩa là gì?","options":["Tôi muốn cà phê ngay bây giờ","Tôi thích cà phê nói chung","Tôi có cà phê","Tôi không có cà phê"],"correct":1}
    ],
    "practice":[
      {"id":"p53_01","type":"TRANSLATE","from":"vi","sentence":"Anh ấy không cần đến sớm — cuộc họp bắt đầu lúc 10 giờ.","answer":"Er muss nicht früh kommen — das Meeting beginnt um 10 Uhr.","accept_also":["Er muss nicht früh kommen, das Meeting fängt um 10 Uhr an."]},
      {"id":"p53_02","type":"FILL_BLANK","sentence_de":"Mein Arzt sagt, ich ___ mehr schlafen.","hint_vi":"soll (bác sĩ bảo)","answer":"soll","accept_also":["soll"]},
      {"id":"p53_03","type":"FILL_BLANK","sentence_de":"Ich ___ Schokolade, aber jetzt ___ ich sie nicht essen — ich mache eine Diät.","hint_vi":"mag ... darf","answer":"mag, darf","accept_also":["mag / darf"]}
    ]
  },
  "reading_passage":{
    "text_de":"Hausordnung im Studentenwohnheim\n\nDie Bewohner müssen die Ruhezeiten einhalten. Von 22:00 bis 7:00 Uhr darf man keine laute Musik spielen. Gäste dürfen nur bis 23:00 Uhr bleiben. Haustiere sind nicht erlaubt — das heißt, man darf keine Tiere halten. Jeder Bewohner soll den Gemeinschaftsraum sauber hinterlassen. Das müssen wir nicht extra betonen, aber es ist wichtig.",
    "text_vi":"Nội quy ký túc xá sinh viên\n\nCư dân phải tuân thủ giờ yên tĩnh. Từ 22:00 đến 7:00 không được bật nhạc to. Khách chỉ được ở lại đến 23:00. Vật nuôi không được phép — tức là không được nuôi thú. Mỗi cư dân nên để phòng sinh hoạt chung sạch sẽ. Chúng tôi không cần nhắc thêm, nhưng điều này quan trọng.",
    "questions":[
      {"id":"rq53_01","type":"FILL_BLANK","question_vi":"Khách được ở lại đến mấy giờ?","answer":"23:00","accept_also":["23 Uhr","bis 23 Uhr"]},
      {"id":"rq53_02","type":"MULTIPLE_CHOICE","question_vi":"Vật nuôi thì sao?","options":["Erlaubt","Nicht erlaubt","Nur kleine Tiere","Nur Katzen"],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Schreiben Sie 5 Regeln für Ihre Wohnung/Ihr Büro mit Modalverben.","task_vi":"Viết 5 quy tắc cho nhà/văn phòng của bạn dùng modalverben.","min_sentences":5,"example_answer":"Man darf hier nicht rauchen.\nDie Fenster müssen abends geschlossen werden.\nGäste sollen sich anmelden.\nMan muss den Müll trennen.\nMan darf keine laute Musik nach 22 Uhr spielen."},
  "audio_content":{
    "listen_words":[
      {"text":"Du darfst hier nicht parken.","meaning":"Bạn không được đỗ xe ở đây."},
      {"text":"Du musst das nicht machen.","meaning":"Bạn không cần làm điều đó."},
      {"text":"Was soll ich tun?","meaning":"Tôi phải làm gì?"}
    ],
    "listen_dialogue":"Darf ich hier fotografieren? — Nein, das ist leider nicht erlaubt. — Und darf ich zumindest eine Skizze machen? — Ja, das dürfen Sie. Aber Sie müssen leise sein — andere Besucher wollen die Stille genießen."
  }
}'::jsonb),

('CORE_TRUNK',
 'Schreiben B1 — Formelle Briefe',
 'Viết thư trang trọng B1',
 'Anschreiben, Bewerbung, Beschwerde — viết thư trang trọng đúng chuẩn Goethe B1.',
 '✉️', 'CORE_B1', 54, 14, 54, 'B1', 6, 290, 1,
 12, 'Kỹ năng B1', 'Fertigkeiten B1', 'LESSON',
 ARRAY['#Schreiben','#Brief','#B1'],
 '{
  "title":{"de":"Formeller Brief — Schreiben B1","vi":"Viết thư trang trọng B1"},
  "overview":{"de":"Sehr geehrte Damen und Herren, ... Mit freundlichen Grüßen","vi":"Cấu trúc thư trang trọng: địa chỉ, ngày tháng, lời mở đầu, nội dung, lời kết."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Cấu trúc thư trang trọng"},"content":{"vi":"[Absender — Người gửi]\nVorname Nachname\nStraße Nr.\nPLZ Stadt\n\n[Empfänger — Người nhận]\nFirmenname / Person\nAbteilung\nStraße Nr.\nPLZ Stadt\n\n[Datum — Ngày tháng: rechtsbündig]\nStadt, den TT.MM.JJJJ\n\n[Betreff — Tiêu đề: fett, nach Datum]\nBetreff: Bewerbung als... / Beschwerde über...\n\n[Anrede — Lời mở đầu]\nSehr geehrte Damen und Herren, (không biết tên)\nSehr geehrter Herr Müller, (biết họ)\nSehr geehrte Frau Schmidt, (biết họ)\n\n[Text]\n[Schlussformel]\nMit freundlichen Grüßen,\n[Unterschrift]"},"tags":["#Brief","#Format","#B1"]},
    {"type":"RULE","title":{"vi":"Ngôn ngữ thư trang trọng"},"content":{"vi":"Dùng Sie-Form (trang trọng)\nTránh từ viết tắt\n\nMở thư:\n• Hiermit bewerbe ich mich um...\n• Bezüglich Ihrer Anzeige...\n• Ich schreibe Ihnen wegen...\n• Ich möchte mich beschweren über...\n\nKết thư:\n• Für Rückfragen stehe ich gern zur Verfügung.\n• Ich freue mich auf Ihre Antwort.\n• Bitte nehmen Sie mich in Betracht.\n• Vielen Dank für Ihre Zeit und Mühe."},"tags":["#Brief","#Formulierungen"]},
    {"type":"EXAMPLE","title":{"vi":"Thư khiếu nại mẫu"},"content":{"vi":"Sehr geehrte Damen und Herren,\n\nichm schreibe Ihnen wegen eines Problems mit meiner Bestellung Nr. 12345. Ich habe das Paket am 15. Mai erhalten, aber der Inhalt war beschädigt.\n\nIch bitte Sie, mir entweder ein Ersatzprodukt zu schicken oder den Kaufpreis zu erstatten.\n\nFür Rückfragen stehe ich Ihnen gern zur Verfügung.\n\nMit freundlichen Grüßen,\n[Name]"},"tags":["#Beschwerde","#Brief"]}
  ],
  "vocabulary":[
    {"id":"v_bri_01","german":"hiermit","meaning":"bằng thư này / theo đây","gender":null,"color_code":null,"gender_label":null,"example_de":"Hiermit bestätige ich den Termin.","example_vi":"Tôi xác nhận cuộc hẹn qua thư này.","speak_de":"Hiermit bewerbe ich mich um...","tags":["#Brief","#B1"],"ai_speech_hints":{"focus_phonemes":["/ˈhiːɐ̯mɪt/"],"common_errors_vi":["hier-mit: ie=/iː/"],"ipa_target":"ˈhiːɐ̯mɪt"}},
    {"id":"v_bri_02","german":"bezüglich (+ Genitiv)","meaning":"liên quan đến / về","gender":null,"color_code":null,"gender_label":null,"example_de":"Bezüglich Ihrer Anfrage möchte ich Ihnen mitteilen...","example_vi":"Liên quan đến yêu cầu của quý vị, tôi muốn thông báo...","speak_de":"Bezüglich Ihrer Anfrage...","tags":["#Brief","#B1"],"ai_speech_hints":{"focus_phonemes":["/bəˈtsyːklɪç/"],"common_errors_vi":["be-ZÜG-lich: ü tròn môi"],"ipa_target":"bəˈtsyːklɪç"}},
    {"id":"v_bri_03","german":"zur Verfügung stehen","meaning":"sẵn sàng hỗ trợ","gender":null,"color_code":null,"gender_label":null,"example_de":"Für Fragen stehe ich Ihnen gern zur Verfügung.","example_vi":"Tôi sẵn sàng trả lời câu hỏi của quý vị.","speak_de":"Ich stehe Ihnen zur Verfügung.","tags":["#Brief","#Formulierungen"],"ai_speech_hints":{"focus_phonemes":["/fɛɐ̯ˈfyːɡʊŋ/"],"common_errors_vi":["Ver-FÜ-gung: ü tròn môi"],"ipa_target":"fɛɐ̯ˈfyːɡʊŋ"}}
  ],
  "phrases":[
    {"german":"Mit freundlichen Grüßen","meaning":"Trân trọng","speak_de":"Mit freundlichen Grüßen"},
    {"german":"Sehr geehrte Damen und Herren,","meaning":"Kính gửi,","speak_de":"Sehr geehrte Damen und Herren"},
    {"german":"Ich freue mich auf Ihre Antwort.","meaning":"Tôi mong nhận được phản hồi của quý vị.","speak_de":"Ich freue mich auf Ihre Antwort."}
  ],
  "examples":[
    {"german":"Sehr geehrter Herr Müller,\n\nhiermit bewerbe ich mich um die Stelle als Pflegekraft in Ihrer Einrichtung.\n\nIch habe eine abgeschlossene Ausbildung als Krankenpfleger und drei Jahre Berufserfahrung. Ich spreche Deutsch auf dem Niveau B2 und lerne täglich weiter.\n\nAnlagen: Lebenslauf, Zeugnisse, Sprachzertifikat.\n\nIch freue mich auf ein persönliches Gespräch und stehe für Rückfragen gerne zur Verfügung.\n\nMit freundlichen Grüßen,\nNguyen Van A","translation":"Kính gửi ông Müller,\n\nTôi xin ứng tuyển vào vị trí điều dưỡng tại cơ sở của quý vị.\n\nTôi đã hoàn thành đào tạo y tá và có 3 năm kinh nghiệm làm việc. Tôi nói tiếng Đức ở trình độ B2 và học thêm mỗi ngày.\n\nTài liệu đính kèm: CV, bằng cấp, chứng chỉ ngoại ngữ.\n\nTôi mong được gặp mặt trực tiếp và sẵn sàng trả lời câu hỏi.\n\nTrân trọng,\nNguyen Van A","note":"Cấu trúc Bewerbungsschreiben hoàn chỉnh","speak_de":"Hiermit bewerbe ich mich um die Stelle."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg54_01","type":"MULTIPLE_CHOICE","question_vi":"Khi không biết tên người nhận, dùng lời mở đầu nào?","options":["Liebe Kollegen","Hallo zusammen","Sehr geehrte Damen und Herren","Guten Morgen"],"correct":2},
      {"id":"tg54_02","type":"FILL_BLANK","sentence_de":"___ Ihrer Anfrage möchte ich Ihnen mitteilen...","hint_vi":"Bezüglich","answer":"Bezüglich","accept_also":["Bezüglich"]},
      {"id":"tg54_03","type":"MULTIPLE_CHOICE","question_vi":"Lời kết thông dụng nhất là gì?","options":["Tschüss","Liebe Grüße","Mit freundlichen Grüßen","Auf Wiedersehen"],"correct":2},
      {"id":"tg54_04","type":"FILL_BLANK","sentence_de":"___ bewerbe ich mich um die Stelle als Ingenieur.","hint_vi":"Hiermit","answer":"Hiermit","accept_also":["Hiermit"]}
    ],
    "practice":[
      {"id":"p54_01","type":"TRANSLATE","from":"vi","sentence":"Tôi muốn khiếu nại về sản phẩm bị lỗi của quý vị.","answer":"Ich möchte mich über Ihr defektes Produkt beschweren.","accept_also":["Ich möchte eine Beschwerde über Ihr defektes Produkt einreichen."]},
      {"id":"p54_02","type":"FILL_BLANK","sentence_de":"Für Rückfragen stehe ich Ihnen gern zur ___.","hint_vi":"Verfügung","answer":"Verfügung","accept_also":["Verfügung"]},
      {"id":"p54_03","type":"TRANSLATE","from":"vi","sentence":"Tôi mong được nhận được phản hồi sớm.","answer":"Ich freue mich auf eine baldige Antwort.","accept_also":["Ich würde mich über eine schnelle Antwort freuen."]}
    ]
  },
  "reading_passage":{
    "text_de":"Beschwerde über einen Kurs\n\nSehr geehrte Damen und Herren,\n\nIch schreibe Ihnen bezüglich des Deutschkurses B1, den ich vom 1. bis 31. März besucht habe. Leider war ich mit dem Unterricht nicht zufrieden.\n\nDer Kursleiter kam häufig zu spät und verwendete veraltetes Material. Außerdem war die Klasse mit 25 Teilnehmern zu groß für einen B1-Kurs.\n\nIch bitte Sie daher um eine teilweise Rückerstattung des Kursgeldes oder um einen kostenlosen Ersatzkurs.\n\nFür Rückfragen stehe ich Ihnen gern zur Verfügung.\n\nMit freundlichen Grüßen,\nMax Mustermann",
    "text_vi":"Khiếu nại về khóa học\n\nKính gửi quý vị,\n\nTôi viết thư liên quan đến khóa học tiếng Đức B1 mà tôi theo học từ ngày 1 đến 31 tháng 3. Tiếc rằng tôi không hài lòng với việc giảng dạy.\n\nGiáo viên thường đến muộn và sử dụng tài liệu lỗi thời. Ngoài ra, lớp học có 25 học viên, quá đông cho một khóa B1.\n\nVì vậy tôi đề nghị hoàn trả một phần học phí hoặc một khóa học thay thế miễn phí.\n\nTôi sẵn sàng trả lời câu hỏi.\n\nTrân trọng,\nMax Mustermann",
    "questions":[
      {"id":"rq54_01","type":"FILL_BLANK","question_vi":"Người viết muốn gì?","answer":"Rückerstattung oder Ersatzkurs","accept_also":["Geld zurück","Ersatzkurs"]},
      {"id":"rq54_02","type":"MULTIPLE_CHOICE","question_vi":"Điều gì sai trong khóa học?","options":["Zu wenig Teilnehmer","Kursleiter zu spät + altes Material","Zu teuer","Falsches Niveau"],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Schreiben Sie einen Beschwerdebrief (150-200 Wörter). Sie haben ein kaputtes Produkt erhalten.","task_vi":"Viết một thư khiếu nại (150-200 từ). Bạn nhận được sản phẩm bị hỏng.","min_sentences":8,"example_answer":"Sehr geehrte Damen und Herren,\n\nhiermit schreibe ich Ihnen bezüglich meiner Bestellung vom 15. April. Ich habe gestern ein Paket erhalten, leider war das Produkt beschädigt.\n\nDer Bildschirm des Laptops hat einen Riss und funktioniert nicht mehr. Das ist sehr ärgerlich, denn ich brauche das Gerät für meine Arbeit.\n\nIch bitte Sie daher, mir so schnell wie möglich ein Ersatzprodukt zu schicken oder den vollen Kaufpreis zu erstatten.\n\nFür Rückfragen stehe ich Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen,\n[Name]"},
  "audio_content":{
    "listen_words":[
      {"text":"Mit freundlichen Grüßen","meaning":"Trân trọng"},
      {"text":"Sehr geehrte Damen und Herren","meaning":"Kính gửi quý vị"},
      {"text":"Ich stehe Ihnen zur Verfügung.","meaning":"Tôi sẵn sàng hỗ trợ quý vị."}
    ],
    "listen_dialogue":"Haben Sie den Brief schon geschrieben? — Ja, ich habe ihn gestern abgeschickt. — Wie haben Sie ihn begonnen? — Mit ''Sehr geehrte Damen und Herren''. — Und wie haben Sie ihn beendet? — Mit ''Mit freundlichen Grüßen'', natürlich."
  }
}'::jsonb),

('CORE_TRUNK',
 'Mündlicher Ausdruck B1 — Diskutieren',
 'Nói & Thảo luận B1',
 'Meinungen äußern, zustimmen, ablehnen, Kompromisse finden — Diskussionsphrasen B1.',
 '🗣️', 'CORE_B1', 55, 14, 55, 'B1', 6, 280, 1,
 12, 'Kỹ năng B1', 'Fertigkeiten B1', 'LESSON',
 ARRAY['#Sprechen','#Diskussion','#B1'],
 '{
  "title":{"de":"Diskutieren und Argumentieren B1","vi":"Thảo luận và Lập luận B1"},
  "overview":{"de":"Meiner Meinung nach... / Ich bin der Meinung, dass... / Einerseits... andererseits...","vi":"Cụm từ để trình bày ý kiến, đồng ý, phản đối và đạt thỏa thuận trong thảo luận."},
  "session_type":"LESSON",
  "theory_cards":[
    {"type":"RULE","title":{"vi":"Trình bày ý kiến"},"content":{"vi":"Meiner Meinung nach ist das wichtig. (Theo tôi điều đó quan trọng.)\nIch bin der Meinung/Ansicht, dass... (Tôi có quan điểm rằng...)\nIch finde, dass... (Tôi thấy rằng...)\nIch glaube/denke, dass... (Tôi nghĩ rằng...)\nAus meiner Sicht... (Từ góc nhìn của tôi...)\n\n→ Sau meiner Meinung nach: KHÔNG dùng dass!"},"tags":["#Meinung","#B1"]},
    {"type":"RULE","title":{"vi":"Đồng ý và phản đối"},"content":{"vi":"ĐỒNG Ý:\nDa haben Sie Recht. (Bạn đúng.)\nIch stimme Ihnen zu. (Tôi đồng ý.)\nGenau! / Absolut! / Natürlich!\nDas sehe ich genauso. (Tôi cũng thấy vậy.)\n\nPHẢN ĐỐI:\nIch sehe das anders. (Tôi thấy khác.)\nIch bin anderer Meinung. (Tôi có ý kiến khác.)\nDas stimmt nicht ganz. (Điều đó không hoàn toàn đúng.)\nAber man muss bedenken, dass... (Nhưng cần xem xét rằng...)"},"tags":["#Diskussion","#B1"]},
    {"type":"RULE","title":{"vi":"Cấu trúc lập luận"},"content":{"vi":"Einerseits... andererseits... (Một mặt... mặt khác...)\nZunächst... dann... schließlich... (Trước hết... sau đó... cuối cùng...)\nDafür spricht, dass... (Ủng hộ điều này vì...)\nDagegen spricht, dass... (Phản đối điều này vì...)\nZusammenfassend möchte ich sagen... (Tóm lại tôi muốn nói...)"},"tags":["#Argumentation","#B1"]}
  ],
  "vocabulary":[
    {"id":"v_dis_01","german":"einerseits... andererseits...","meaning":"một mặt... mặt khác...","gender":null,"color_code":null,"gender_label":null,"example_de":"Einerseits ist es günstig, andererseits ist die Qualität schlecht.","example_vi":"Một mặt nó rẻ, mặt khác chất lượng kém.","speak_de":"Einerseits... andererseits...","tags":["#Diskussion","#B1"],"ai_speech_hints":{"focus_phonemes":["/ˈaɪ̯nɐzaɪ̯ts/"],"common_errors_vi":["ei=/ai/ cả hai lần"],"ipa_target":"ˈaɪ̯nɐzaɪ̯ts"}},
    {"id":"v_dis_02","german":"zustimmen","meaning":"đồng ý","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich stimme Ihnen vollständig zu.","example_vi":"Tôi hoàn toàn đồng ý với quý vị.","speak_de":"Ich stimme Ihnen zu.","tags":["#Diskussion","#B1"],"ai_speech_hints":{"focus_phonemes":["/ˈtsuːˌʃtɪmən/"],"common_errors_vi":["zu-STIM-men: trennbar"],"ipa_target":"ˈtsuːʃtɪmən"}},
    {"id":"v_dis_03","german":"meiner Meinung nach","meaning":"theo ý kiến của tôi","gender":null,"color_code":null,"gender_label":null,"example_de":"Meiner Meinung nach sollten wir mehr investieren.","example_vi":"Theo ý kiến của tôi chúng ta nên đầu tư nhiều hơn.","speak_de":"Meiner Meinung nach...","tags":["#Diskussion","#B1"],"ai_speech_hints":{"focus_phonemes":["/ˈmaɪ̯nɐ ˈmaɪ̯nʊŋ naːx/"],"common_errors_vi":["Mei-nung: ei=/ai/"],"ipa_target":"ˈmaɪ̯nɐ ˈmaɪ̯nʊŋ naːx"}}
  ],
  "phrases":[
    {"german":"Meiner Meinung nach ist das eine gute Idee.","meaning":"Theo tôi đó là một ý hay.","speak_de":"Meiner Meinung nach ist das eine gute Idee."},
    {"german":"Da haben Sie absolut Recht.","meaning":"Bạn hoàn toàn đúng.","speak_de":"Da haben Sie absolut Recht."},
    {"german":"Ich sehe das etwas anders.","meaning":"Tôi thấy hơi khác một chút.","speak_de":"Ich sehe das etwas anders."},
    {"german":"Einerseits stimme ich zu, andererseits...","meaning":"Một mặt tôi đồng ý, mặt khác...","speak_de":"Einerseits stimme ich zu, andererseits..."}
  ],
  "examples":[
    {"german":"Diskussion: Homeoffice — gut oder schlecht?\n\nA: Meiner Meinung nach ist Homeoffice sehr positiv. Man spart Zeit und ist flexibler.\nB: Da haben Sie Recht. Aber ich sehe das auch anders: Einerseits ist es praktisch, andererseits fehlt der persönliche Kontakt.\nA: Das stimmt. Aber man muss bedenken, dass viele Menschen produktiver zu Hause sind.\nB: Ich stimme Ihnen teilweise zu. Zusammenfassend glaube ich, dass ein Mix am besten wäre.","translation":"Thảo luận: Làm việc từ xa — tốt hay xấu?\n\nA: Theo tôi làm việc từ xa rất tích cực. Tiết kiệm thời gian và linh hoạt hơn.\nB: Bạn đúng. Nhưng tôi cũng thấy khác: Một mặt tiện lợi, mặt khác thiếu tiếp xúc trực tiếp.\nA: Đúng vậy. Nhưng cần xem xét rằng nhiều người làm việc hiệu quả hơn ở nhà.\nB: Tôi phần nào đồng ý. Tóm lại tôi nghĩ một sự kết hợp là tốt nhất.","note":"Cấu trúc thảo luận đầy đủ B1","speak_de":"Meiner Meinung nach ist Homeoffice positiv."}
  ],
  "exercises":{
    "theory_gate":[
      {"id":"tg55_01","type":"FILL_BLANK","sentence_de":"___ Meinung ___ ist das eine schlechte Idee.","hint_vi":"Meiner...nach","answer":"Meiner, nach","accept_also":["Meiner / nach"]},
      {"id":"tg55_02","type":"MULTIPLE_CHOICE","question_vi":"Câu nào thể hiện sự phản đối lịch sự?","options":["Das ist falsch!","Ich sehe das etwas anders.","Nein, niemals!","Das stimmt überhaupt nicht!"],"correct":1},
      {"id":"tg55_03","type":"FILL_BLANK","sentence_de":"___ ist es teuer, ___ ist die Qualität gut.","hint_vi":"Einerseits...andererseits","answer":"Einerseits, andererseits","accept_also":["einerseits / andererseits"]},
      {"id":"tg55_04","type":"MULTIPLE_CHOICE","question_vi":"''Ich stimme Ihnen zu'' nghĩa là?","options":["Ich widerspreche","Ich bin einverstanden","Ich frage nach","Ich zweifle"],"correct":1}
    ],
    "practice":[
      {"id":"p55_01","type":"TRANSLATE","from":"vi","sentence":"Theo tôi, chúng ta nên sử dụng nhiều năng lượng tái tạo hơn.","answer":"Meiner Meinung nach sollten wir mehr erneuerbare Energien nutzen.","accept_also":["Ich bin der Meinung, dass wir mehr erneuerbare Energien nutzen sollten."]},
      {"id":"p55_02","type":"FILL_BLANK","sentence_de":"Da ___ Sie völlig Recht — das ist wirklich wichtig.","hint_vi":"haben","answer":"haben","accept_also":["haben"]},
      {"id":"p55_03","type":"TRANSLATE","from":"vi","sentence":"Một mặt điều đó đúng, mặt khác có nhiều vấn đề.","answer":"Einerseits stimmt das, andererseits gibt es viele Probleme.","accept_also":["Einerseits ist das richtig, andererseits gibt es Probleme."]}
    ]
  },
  "reading_passage":{
    "text_de":"Soziale Medien — Fluch oder Segen?\n\nIn einer Diskussion äußerten Schüler verschiedene Meinungen. Lena sagte, ihrer Meinung nach seien soziale Medien vor allem positiv, weil man leicht Kontakt halten könne. Tim sah das anders: Er war der Meinung, dass viele Menschen zu viel Zeit damit verbringen. Einerseits bieten Plattformen Informationen und Verbindungen, andererseits entstehen Sucht und Mobbing. Zusammenfassend waren sich alle einig: Ein bewusster Umgang sei wichtig.",
    "text_vi":"Mạng xã hội — Tai họa hay phước lành?\n\nTrong một buổi thảo luận, học sinh bày tỏ nhiều ý kiến khác nhau. Lena nói rằng theo cô, mạng xã hội chủ yếu tích cực vì có thể dễ dàng giữ liên lạc. Tim thấy khác: Anh cho rằng nhiều người dành quá nhiều thời gian cho nó. Một mặt các nền tảng cung cấp thông tin và kết nối, mặt khác gây nghiện và bắt nạt. Tóm lại tất cả đồng ý: Cần sử dụng có ý thức.",
    "questions":[
      {"id":"rq55_01","type":"FILL_BLANK","question_vi":"Lena thấy mạng xã hội như thế nào?","answer":"positiv","accept_also":["gut","vor allem positiv"]},
      {"id":"rq55_02","type":"MULTIPLE_CHOICE","question_vi":"Họ đều đồng ý điều gì?","options":["Soziale Medien verbieten","Bewusster Umgang ist wichtig","Mehr Zeit damit verbringen","Alle Plattformen löschen"],"correct":1}
    ]
  },
  "writing_prompt":{"task_de":"Schreiben Sie Ihre Meinung zu einem aktuellen Thema (150-200 Wörter). Benutzen Sie Diskussionsphrasen.","task_vi":"Viết ý kiến về một chủ đề thời sự (150-200 từ). Dùng các cụm từ thảo luận.","min_sentences":8,"example_answer":"Meiner Meinung nach ist der Klimawandel das wichtigste Problem unserer Zeit.\n\nEinerseits haben wir in den letzten Jahren Fortschritte gemacht: Erneuerbare Energien werden mehr genutzt und viele Menschen fahren Elektroauto. Andererseits ist das nicht genug — die CO2-Emissionen steigen weiter.\n\nIch bin der Meinung, dass jeder Einzelne Verantwortung tragen muss. Dafür spricht, dass kleine Änderungen im Alltag große Wirkung haben können. Dagegen spricht, dass die Politik größere Maßnahmen ergreifen muss.\n\nZusammenfassend glaube ich: Wir brauchen sowohl individuelle Verantwortung als auch politisches Handeln."},
  "audio_content":{
    "listen_words":[
      {"text":"Meiner Meinung nach ist das wichtig.","meaning":"Theo tôi điều đó quan trọng."},
      {"text":"Da haben Sie Recht.","meaning":"Bạn đúng."},
      {"text":"Ich sehe das etwas anders.","meaning":"Tôi thấy hơi khác."},
      {"text":"Einerseits... andererseits...","meaning":"Một mặt... mặt khác..."}
    ],
    "listen_dialogue":"Was denken Sie über das Thema Homeoffice? — Meiner Meinung nach ist es sehr gut. Man spart Zeit. — Da stimme ich Ihnen zu. Aber ich sehe es auch anders — einerseits praktisch, andererseits fehlt der Teamgeist. — Das ist ein guter Punkt. Ich bin der Meinung, ein Mix wäre ideal."
  }
}'::jsonb);

-- Link B1 nodes in prerequisite chain
DO $$
DECLARE
  prev_id BIGINT;
  curr_id BIGINT;
  d INT;
BEGIN
  -- Link 51→52→53→54→55
  FOR d IN 52..55 LOOP
    SELECT id INTO prev_id FROM skill_tree_nodes WHERE day_number = d - 1 AND cefr_level = 'B1' LIMIT 1;
    SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = d AND cefr_level = 'B1' LIMIT 1;
    IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
      INSERT INTO skill_tree_edges(source_node_id, target_node_id)
      VALUES (prev_id, curr_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Link last A2 node → first B1 node
  SELECT id INTO prev_id FROM skill_tree_nodes WHERE cefr_level = 'A2' ORDER BY day_number DESC LIMIT 1;
  SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = 51 AND cefr_level = 'B1' LIMIT 1;
  IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
    INSERT INTO skill_tree_edges(source_node_id, target_node_id)
    VALUES (prev_id, curr_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
