-- tag_translations: stores localized labels for tags (canonical name stored in tags.name is German)
CREATE TABLE tag_translations (
    id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    tag_id BIGINT      NOT NULL,
    locale VARCHAR(5)  NOT NULL,
    label  VARCHAR(200) NOT NULL,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tag_locale (tag_id, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
