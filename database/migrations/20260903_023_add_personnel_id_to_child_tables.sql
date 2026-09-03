-- Migration: 20260903_023_add_personnel_id_to_child_tables.sql
-- Description: Link person-owned credentials directly to tlo_personnel.id

BEGIN;

ALTER TABLE tlo_education_records ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES tlo_personnel(id);
ALTER TABLE tlo_eligibility_records ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES tlo_personnel(id);
ALTER TABLE tlo_training_records ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES tlo_personnel(id);
ALTER TABLE tlo_accomplishment_records ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES tlo_personnel(id);
ALTER TABLE tlo_other_courses ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES tlo_personnel(id);

UPDATE tlo_education_records c SET personnel_id = p.id FROM tlo_personnel p WHERE p.legacy_tlo_id = c.tlo_id AND c.personnel_id IS NULL;
UPDATE tlo_eligibility_records c SET personnel_id = p.id FROM tlo_personnel p WHERE p.legacy_tlo_id = c.tlo_id AND c.personnel_id IS NULL;
UPDATE tlo_training_records c SET personnel_id = p.id FROM tlo_personnel p WHERE p.legacy_tlo_id = c.tlo_id AND c.personnel_id IS NULL;
UPDATE tlo_accomplishment_records c SET personnel_id = p.id FROM tlo_personnel p WHERE p.legacy_tlo_id = c.tlo_id AND c.personnel_id IS NULL;
UPDATE tlo_other_courses c SET personnel_id = p.id FROM tlo_personnel p WHERE p.legacy_tlo_id = c.tlo_id AND c.personnel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tlo_edu_personnel ON tlo_education_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_tlo_elig_personnel ON tlo_eligibility_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_tlo_train_personnel ON tlo_training_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_tlo_accomp_personnel ON tlo_accomplishment_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_tlo_other_personnel ON tlo_other_courses(personnel_id);


COMMIT;
