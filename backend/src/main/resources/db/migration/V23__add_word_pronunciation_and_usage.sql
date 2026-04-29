ALTER TABLE words
    ADD COLUMN phonetic VARCHAR(120) NULL AFTER base_form,
    ADD COLUMN usage_note TEXT NULL AFTER phonetic;
