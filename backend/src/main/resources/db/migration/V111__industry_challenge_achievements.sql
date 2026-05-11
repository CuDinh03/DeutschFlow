-- V111: Industry Challenge Achievements (Ngày 8-9)
-- Seed achievements cho người dùng hoàn thành bài chuyên ngành (SATELLITE nodes)
-- trigger_type = SATELLITE_COMPLETE: số satellite nodes đã hoàn thành

-- Thêm trigger_type mới SATELLITE_COMPLETE vào checkAchievements (handled in XpService)

INSERT INTO achievements (code, name_vi, description_vi, icon_emoji, xp_reward, trigger_type, trigger_threshold, rarity)
VALUES
  -- ── First satellite ──
  ('SATELLITE_FIRST',
   'Bước vào chuyên ngành 🚀',
   'Hoàn thành bài học chuyên ngành đầu tiên',
   '🚀', 200, 'SATELLITE_COMPLETE', 1, 'RARE'),

  -- ── IT industry ──
  ('INDUSTRY_IT_STARTER',
   'Junior IT 💻',
   'Hoàn thành 1 bài học ngành IT',
   '💻', 150, 'SATELLITE_IT_COMPLETE', 1, 'COMMON'),

  ('INDUSTRY_IT_PRO',
   'IT Professional 🖥️',
   'Hoàn thành 3 bài học ngành IT',
   '🖥️', 400, 'SATELLITE_IT_COMPLETE', 3, 'RARE'),

  -- ── Healthcare ──
  ('INDUSTRY_ARZT_STARTER',
   'Medizinstudent 🏥',
   'Hoàn thành 1 bài học ngành Y tế',
   '🏥', 150, 'SATELLITE_ARZT_COMPLETE', 1, 'COMMON'),

  ('INDUSTRY_ARZT_PRO',
   'Doktor 🩺',
   'Hoàn thành 3 bài học ngành Y tế',
   '🩺', 400, 'SATELLITE_ARZT_COMPLETE', 3, 'RARE'),

  -- ── Gastronomy ──
  ('INDUSTRY_GASTRO_STARTER',
   'Küchenlehrling 🍽️',
   'Hoàn thành 1 bài học ngành Ẩm thực',
   '🍽️', 150, 'SATELLITE_GASTRO_COMPLETE', 1, 'COMMON'),

  ('INDUSTRY_GASTRO_PRO',
   'Chefkoch 👨‍🍳',
   'Hoàn thành 3 bài học ngành Ẩm thực',
   '👨‍🍳', 400, 'SATELLITE_GASTRO_COMPLETE', 3, 'RARE'),

  -- ── Pflege (Nursing) ──
  ('INDUSTRY_PFLEGE_STARTER',
   'Pflegehelfer 🤝',
   'Hoàn thành 1 bài học ngành Điều dưỡng',
   '🤝', 150, 'SATELLITE_PFLEGE_COMPLETE', 1, 'COMMON'),

  ('INDUSTRY_PFLEGE_PRO',
   'Pflegefachkraft ❤️‍🩹',
   'Hoàn thành 3 bài học ngành Điều dưỡng',
   '❤️‍🩹', 400, 'SATELLITE_PFLEGE_COMPLETE', 3, 'RARE'),

  -- ── All industries unlocked ──
  ('INDUSTRY_MASTER',
   'Industry Master 🌟',
   'Hoàn thành ít nhất 1 bài của mọi ngành chuyên môn',
   '🌟', 1000, 'SATELLITE_ALL_INDUSTRIES', 4, 'LEGENDARY'),

  -- ── SRS milestones ──
  ('SRS_FIRST_REVIEW',
   'Người ôn tập 📚',
   'Ôn tập lần đầu tiên bằng Spaced Repetition',
   '📚', 50, 'SRS_REVIEW_COUNT', 1, 'COMMON'),

  ('SRS_HUNDRED',
   'Trí nhớ thép 🧠',
   'Hoàn thành 100 lần ôn tập từ vựng',
   '🧠', 300, 'SRS_REVIEW_COUNT', 100, 'RARE')

ON CONFLICT (code) DO NOTHING;
