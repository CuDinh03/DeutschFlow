-- V70: Skeleton nodes 11-35 (content_json = NULL → LLM sẽ sinh khi user mở)

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags
) VALUES
-- ═══ Module 3: Chào hỏi & Giới thiệu (Node 11-14) ═══
('CORE_TRUNK','Begrüßung & Verabschiedung','Chào hỏi & Tạm biệt','Cách chào hỏi trang trọng (Sie) và thân mật (du).','👋','KOMMUNIKATION',11,2,11,'A1',2,120,1,3,'Chào hỏi & Giới thiệu','Begrüßung & Vorstellen','LESSON',ARRAY['#Begrüßung','#Kommunikation','#A1']),
('CORE_TRUNK','Sich vorstellen','Giới thiệu bản thân','Giới thiệu tên, tuổi, quê quán, nơi ở, ngôn ngữ.','🙋','KOMMUNIKATION',12,2,12,'A1',2,130,1,3,'Chào hỏi & Giới thiệu','Begrüßung & Vorstellen','LESSON',ARRAY['#Vorstellen','#Kommunikation','#A1']),
('CORE_TRUNK','Berufe & Sprachen','Nghề nghiệp & Ngôn ngữ','Nói về nghề nghiệp và ngôn ngữ sử dụng.','💼','KOMMUNIKATION',13,3,13,'A1',2,120,1,3,'Chào hỏi & Giới thiệu','Begrüßung & Vorstellen','LESSON',ARRAY['#Beruf','#Sprache','#A1']),
('CORE_TRUNK','Review: Module 3','Ôn tập Module 3','Ôn tập chào hỏi, giới thiệu, nghề nghiệp.','📝','KOMMUNIKATION',14,3,14,'A1',2,100,1,3,'Chào hỏi & Giới thiệu','Begrüßung & Vorstellen','REVIEW',ARRAY['#Review','#Modul3']),

-- ═══ Module 4: Gia đình (Node 15-17) ═══
('CORE_TRUNK','Familienmitglieder','Các thành viên gia đình','Cha, mẹ, anh chị em, ông bà. Possessivpronomen.','👨‍👩‍👧‍👦','FAMILIE',15,3,15,'A1',2,130,1,4,'Gia đình & Bạn bè','Familie & Freunde','LESSON',ARRAY['#Familie','#Possessivpronomen','#A1']),
('CORE_TRUNK','Personen beschreiben','Miêu tả người','Adjektive + sein: groß, klein, jung, alt, nett.','🖼️','FAMILIE',16,3,16,'A1',2,120,1,4,'Gia đình & Bạn bè','Familie & Freunde','LESSON',ARRAY['#Adjektiv','#Beschreibung','#A1']),
('CORE_TRUNK','Review: Module 4','Ôn tập Module 4','Ôn tập gia đình, miêu tả.','📝','FAMILIE',17,3,17,'A1',2,100,1,4,'Gia đình & Bạn bè','Familie & Freunde','REVIEW',ARRAY['#Review','#Modul4']),

-- ═══ Module 5: Mua sắm & Đồ ăn (Node 18-21) ═══
('CORE_TRUNK','Lebensmittel & Mahlzeiten','Thực phẩm & Bữa ăn','Từ vựng thức ăn, đồ uống cơ bản.','🍞','EINKAUFEN',18,4,18,'A1',2,130,1,5,'Mua sắm & Đồ ăn','Einkaufen & Essen','LESSON',ARRAY['#Essen','#Lebensmittel','#A1']),
('CORE_TRUNK','Einkaufen & Preise','Mua sắm & Giá cả','Hỏi giá, trả tiền, đơn vị Euro/Cent.','🛒','EINKAUFEN',19,4,19,'A1',3,140,1,5,'Mua sắm & Đồ ăn','Einkaufen & Essen','LESSON',ARRAY['#Einkaufen','#Zahlen','#A1']),
('CORE_TRUNK','Essen bestellen','Gọi đồ ăn','Möchten + bitte, kein/keine (Negation).','🍽️','EINKAUFEN',20,4,20,'A1',3,140,1,5,'Mua sắm & Đồ ăn','Einkaufen & Essen','LESSON',ARRAY['#Bestellen','#Modalverben','#Negation','#A1']),
('CORE_TRUNK','Review: Module 5','Ôn tập Module 5','Ôn tập mua sắm, đồ ăn, giá cả.','📝','EINKAUFEN',21,4,21,'A1',2,100,1,5,'Mua sắm & Đồ ăn','Einkaufen & Essen','REVIEW',ARRAY['#Review','#Modul5']),

-- ═══ Module 6: Nhà cửa (Node 22-24) ═══
('CORE_TRUNK','Zimmer & Möbel','Phòng & Đồ đạc','Các phòng trong nhà, đồ nội thất cơ bản.','🏠','WOHNEN',22,5,22,'A1',2,130,1,6,'Nhà cửa & Đồ đạc','Wohnen & Möbel','LESSON',ARRAY['#Wohnen','#Möbel','#A1']),
('CORE_TRUNK','Wohnungsanzeigen & es gibt','Tìm nhà & es gibt','Đọc hiểu tin cho thuê nhà. Haben + es gibt + Akkusativ.','📰','WOHNEN',23,5,23,'A1',3,140,1,6,'Nhà cửa & Đồ đạc','Wohnen & Möbel','LESSON',ARRAY['#Wohnen','#esGibt','#Akkusativ','#A1']),
('CORE_TRUNK','Review: Module 6','Ôn tập Module 6','Ôn tập nhà cửa, đồ đạc.','📝','WOHNEN',24,5,24,'A1',2,100,1,6,'Nhà cửa & Đồ đạc','Wohnen & Möbel','REVIEW',ARRAY['#Review','#Modul6']),

-- ═══ Module 7: Thời gian (Node 25-28) ═══
('CORE_TRUNK','Uhrzeit: offiziell & inoffiziell','Giờ: Chính thức & Thông thường','Cách đọc giờ chính thức (14:30) và đời thường (halb drei).','🕐','ZEIT',25,5,25,'A1',3,140,1,7,'Thời gian & Thói quen','Uhrzeit & Tagesablauf','LESSON',ARRAY['#Uhrzeit','#Zeit','#A1']),
('CORE_TRUNK','Tagesablauf & Trennbare Verben','Thói quen hàng ngày & Động từ tách','Mô tả ngày thường: aufstehen, einkaufen, fernsehen.','☀️','ZEIT',26,6,26,'A1',3,150,1,7,'Thời gian & Thói quen','Uhrzeit & Tagesablauf','LESSON',ARRAY['#TrennbareVerben','#Tagesablauf','#A1']),
('CORE_TRUNK','Wochentage, Monate, Jahreszeiten','Thứ, Tháng, Mùa','Giới từ thời gian: am, um, im, von...bis.','📅','ZEIT',27,6,27,'A1',2,130,1,7,'Thời gian & Thói quen','Uhrzeit & Tagesablauf','LESSON',ARRAY['#Zeitpräpositionen','#Kalender','#A1']),
('CORE_TRUNK','Review: Module 7','Ôn tập Module 7','Ôn tập thời gian, thói quen.','📝','ZEIT',28,6,28,'A1',2,100,1,7,'Thời gian & Thói quen','Uhrzeit & Tagesablauf','REVIEW',ARRAY['#Review','#Modul7']),

-- ═══ Module 8: Đi lại (Node 29-31) ═══
('CORE_TRUNK','Verkehrsmittel & Wegbeschreibung','Phương tiện & Chỉ đường','Các phương tiện giao thông, Dativ cơ bản (mit, nach, zu).','🚌','VERKEHR',29,6,29,'A1',3,150,1,8,'Đi lại & Du lịch','Verkehr & Reisen','LESSON',ARRAY['#Verkehr','#Dativ','#Präpositionen','#A1']),
('CORE_TRUNK','Fahrkarten & Reisepläne','Vé & Kế hoạch du lịch','Mua vé, hỏi đường. Perfekt: Partizip II + haben/sein.','✈️','VERKEHR',30,7,30,'A1',4,160,1,8,'Đi lại & Du lịch','Verkehr & Reisen','LESSON',ARRAY['#Reisen','#Perfekt','#A1']),
('CORE_TRUNK','Review: Module 8','Ôn tập Module 8','Ôn tập phương tiện, Perfekt.','📝','VERKEHR',31,7,31,'A1',2,100,1,8,'Đi lại & Du lịch','Verkehr & Reisen','REVIEW',ARRAY['#Review','#Modul8']),

-- ═══ Module 9: Sức khỏe (Node 32-34) ═══
('CORE_TRUNK','Körperteile & Krankheiten','Bộ phận cơ thể & Bệnh tật','Từ vựng cơ thể, triệu chứng. Dativ erweitert (aus, bei, seit).','🏥','GESUNDHEIT',32,7,32,'A1',3,140,1,9,'Sức khỏe','Gesundheit','LESSON',ARRAY['#Gesundheit','#Körper','#Dativ','#A1']),
('CORE_TRUNK','Beim Arzt & Imperativ','Khám bệnh & Mệnh lệnh thức','Tại phòng khám: Imperativ (Nehmen Sie..., Trinken Sie...).','💊','GESUNDHEIT',33,7,33,'A1',3,150,1,9,'Sức khỏe','Gesundheit','LESSON',ARRAY['#Arzt','#Imperativ','#A1']),
('CORE_TRUNK','Review: Module 9','Ôn tập Module 9','Ôn tập sức khỏe, Imperativ.','📝','GESUNDHEIT',34,8,34,'A1',2,100,1,9,'Sức khỏe','Gesundheit','REVIEW',ARRAY['#Review','#Modul9']),

-- ═══ Module 10: A1 Checkpoint (Node 35) ═══
('CORE_TRUNK','A1 Abschlusstest','Kiểm tra cuối A1','Bài kiểm tra tổng hợp toàn bộ A1. Vượt qua = mở khóa A2.','🏆','CHECKPOINT',35,8,35,'A1',5,500,2,10,'A1 Checkpoint','A1 Abschluss','CHECKPOINT',ARRAY['#Checkpoint','#A1','#Test']);

-- ═══ DAG Dependencies: Linear chain 11→10, 12→11, ..., 35→34 ═══
DO $$
BEGIN
  FOR i IN 11..35 LOOP
    INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
    SELECT curr.id, prev.id, 'HARD', 60
    FROM skill_tree_nodes curr, skill_tree_nodes prev
    WHERE curr.day_number = i AND prev.day_number = i - 1
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
