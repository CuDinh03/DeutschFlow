-- Phase 1: 4-skill tagging on class_assignments (Hören/Lesen/Schreiben/Sprechen/General)
ALTER TABLE class_assignments
    ADD COLUMN IF NOT EXISTS skill VARCHAR(20) DEFAULT 'GENERAL';

COMMENT ON COLUMN class_assignments.skill IS 'German-skill mapping: HOREN | LESEN | SCHREIBEN | SPRECHEN | GENERAL';
