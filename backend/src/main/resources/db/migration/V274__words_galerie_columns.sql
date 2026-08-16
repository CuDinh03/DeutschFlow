-- DeutschFlow Galerie (plans/2026-08-16-deutschflow-galerie-plan.md, mục 8):
-- 3 cột lifecycle cho pipeline artwork từ vựng. Cột ảnh cũ (image_url/image_style/
-- image_prompt/image_source) từ V148/V150 giữ nguyên vai trò.
--   image_family : OBJEKT | LEBEN | HANDLUNG | ORT | GEFUEHL_IDEE
--   image_concept: visualConcept tiếng Anh do LLM sinh (đầu vào cho image prompt)
--   image_status : PENDING | CONCEPT_READY | GENERATING | QA_PENDING | REVIEW_REQUIRED | APPROVED | FAILED
--                  NULL = chưa vào pipeline Galerie.
ALTER TABLE words
    ADD COLUMN IF NOT EXISTS image_family VARCHAR(20),
    ADD COLUMN IF NOT EXISTS image_concept TEXT,
    ADD COLUMN IF NOT EXISTS image_status VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_words_image_status ON words(image_status);
