-- tag_translations: stores localized labels for tags (canonical name stored in tags.name is German)
CREATE TABLE tag_translations  (
    id     BIGSERIAL PRIMARY KEY,
    tag_id BIGINT      NOT NULL,
    locale VARCHAR(5)  NOT NULL,
    label  VARCHAR(200) NOT NULL,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    CONSTRAINT uq_tag_locale UNIQUE (tag_id, locale)
);
