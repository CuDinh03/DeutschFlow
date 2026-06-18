-- V219 — Learning Tree (Cây học tập) curriculum model. Additive: does NOT touch the existing
-- week/day skill_tree_nodes (V61) roadmap. Models the manifest tree: level → branch[skill] →
-- shoot[topic] → node[lesson]. Render geometry/colors live in the FE (tree-gen/tree-draw), so
-- only semantics are stored here. See docs/UI_2.0_LEARNING_TREE_DESIGN.md.

-- ── Fixed dimensions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tree_levels (
  code            VARCHAR(4) PRIMARY KEY,
  order_index     INT NOT NULL,
  label_vi        VARCHAR(80) NOT NULL,
  milestone_title VARCHAR(160) NOT NULL,
  unlock_rule     VARCHAR(120) NOT NULL DEFAULT '4 nhánh matured'
);

CREATE TABLE IF NOT EXISTS tree_skills (
  code        VARCHAR(16) PRIMARY KEY,
  label_vi    VARCHAR(40) NOT NULL,
  order_index INT NOT NULL
);

CREATE TABLE IF NOT EXISTS tree_topic_groups (
  code    VARCHAR(16) PRIMARY KEY,
  name_vi VARCHAR(60) NOT NULL
);

-- ── Curriculum content (level × skill × topic × node) ─────────────────────
CREATE TABLE IF NOT EXISTS tree_topics (
  id           BIGSERIAL PRIMARY KEY,
  level_code   VARCHAR(4)  NOT NULL REFERENCES tree_levels(code),
  skill_code   VARCHAR(16) NOT NULL REFERENCES tree_skills(code),
  topic_id     VARCHAR(64) NOT NULL,
  topic_label  VARCHAR(160) NOT NULL,
  group_code   VARCHAR(16) NOT NULL REFERENCES tree_topic_groups(code),
  unlock_order INT NOT NULL DEFAULT 1,
  track        VARCHAR(40),
  CONSTRAINT uq_tree_topics UNIQUE (level_code, skill_code, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_tree_topics_level_skill ON tree_topics (level_code, skill_code, unlock_order);

CREATE TABLE IF NOT EXISTS tree_nodes (
  id          VARCHAR(64) PRIMARY KEY,
  topic_pk    BIGINT NOT NULL REFERENCES tree_topics(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  title_de    VARCHAR(160) NOT NULL,
  content_key VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS idx_tree_nodes_topic ON tree_nodes (topic_pk, order_index);

-- ── Per-user progress (only touched nodes are stored; available/locked derived at read) ──
CREATE TABLE IF NOT EXISTS tree_node_progress (
  user_id      BIGINT NOT NULL,
  node_id      VARCHAR(64) NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,
  state        VARCHAR(16) NOT NULL,
  score        INT,
  started_at   TIMESTAMP,
  completed_at TIMESTAMP,
  PRIMARY KEY (user_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_tree_progress_user ON tree_node_progress (user_id);

CREATE TABLE IF NOT EXISTS tree_milestone_progress (
  user_id    BIGINT NOT NULL,
  level_code VARCHAR(4) NOT NULL REFERENCES tree_levels(code),
  state      VARCHAR(16) NOT NULL,
  passed_at  TIMESTAMP,
  PRIMARY KEY (user_id, level_code)
);

-- ── Seed fixed dimensions (idempotent) ────────────────────────────────────
INSERT INTO tree_levels (code, order_index, label_vi, milestone_title, unlock_rule) VALUES
  ('A0', 0, 'Khởi đầu',            'Gieo mầm đầu tiên',     'Bắt đầu học'),
  ('A1', 1, 'Sơ cấp 1',            'Vượt cấp A1',           '4 nhánh matured'),
  ('A2', 2, 'Sơ cấp 2',            'Vượt cấp A2',           '4 nhánh matured'),
  ('B1', 3, 'Trung cấp 1',         'Vượt cấp B1 (telc)',    '4 nhánh matured'),
  ('B2', 4, 'Trung cấp 2',         'Vượt cấp B2',           '4 nhánh matured'),
  ('C1', 5, 'Cao cấp 1',           'Vượt cấp C1 (Goethe)',  '4 nhánh matured'),
  ('C2', 6, 'Cao cấp 2',           'Vượt cấp C2',           '4 nhánh matured')
ON CONFLICT (code) DO NOTHING;

INSERT INTO tree_skills (code, label_vi, order_index) VALUES
  ('hoeren',    'Nghe', 0),
  ('sprechen',  'Nói',  1),
  ('lesen',     'Đọc',  2),
  ('schreiben', 'Viết', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO tree_topic_groups (code, name_vi) VALUES
  ('daily',   'Đời sống'),
  ('work',    'Công việc'),
  ('travel',  'Du lịch'),
  ('medical', 'Y tế'),
  ('culture', 'Văn hóa'),
  ('exam',    'Luyện thi')
ON CONFLICT (code) DO NOTHING;
