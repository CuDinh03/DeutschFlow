-- V141: Add attachment URL to assignments and create scenario table

ALTER TABLE class_assignments 
ADD COLUMN attachment_url VARCHAR(1000);

CREATE TABLE class_assignment_scenarios (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    topic VARCHAR(255) NOT NULL,
    level VARCHAR(20) NOT NULL,
    scenario_description TEXT,
    follow_up_questions TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scenario_assignment FOREIGN KEY (assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE
);

CREATE INDEX idx_assignment_scenarios_assignment_id ON class_assignment_scenarios(assignment_id);
