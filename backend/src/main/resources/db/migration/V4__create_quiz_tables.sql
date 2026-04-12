-- ============================================================
-- V4: MODULE QUIZ
-- ============================================================

CREATE TABLE classrooms (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id BIGINT       NOT NULL,
    name       VARCHAR(100) NOT NULL,
    created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classroom_students (
    classroom_id BIGINT NOT NULL,
    student_id   BIGINT NOT NULL,
    joined_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (classroom_id, student_id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id)   REFERENCES users(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quizzes (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id   BIGINT       NOT NULL,
    classroom_id BIGINT,
    title        VARCHAR(200) NOT NULL,
    quiz_type    ENUM('COLOR_RACE','SENTENCE_BATTLE') NOT NULL,
    pin_code     VARCHAR(10)  NOT NULL UNIQUE,
    status       ENUM('DRAFT','WAITING','ACTIVE','FINISHED') NOT NULL DEFAULT 'DRAFT',
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (teacher_id)   REFERENCES users(id)      ON DELETE RESTRICT,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_questions (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    quiz_id    BIGINT NOT NULL,
    word_id    BIGINT,
    question   TEXT   NOT NULL,
    time_limit INT    NOT NULL DEFAULT 20,
    position   INT    NOT NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id)   ON DELETE SET NULL,
    INDEX idx_questions_order (quiz_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_choices (
    id          BIGINT  AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT  NOT NULL,
    content     TEXT    NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_sessions (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    quiz_id     BIGINT       NOT NULL,
    participant VARCHAR(100) NOT NULL,
    user_id     BIGINT,
    total_score INT          NOT NULL DEFAULT 0,
    joined_at   DATETIME(6)  NOT NULL,
    finished_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
