BEGIN;

ALTER TABLE tlo_other_courses DROP CONSTRAINT IF EXISTS chk_tlo_course_dates;
ALTER TABLE tlo_other_courses ADD CONSTRAINT chk_tlo_course_dates CHECK (
    date_to IS NULL OR date_from IS NULL OR date_to >= date_from
);

ALTER TABLE tlo_training_records DROP CONSTRAINT IF EXISTS chk_tlo_train_dates;
ALTER TABLE tlo_training_records ADD CONSTRAINT chk_tlo_train_dates CHECK (
    inclusive_date_end IS NULL OR inclusive_date_start IS NULL OR inclusive_date_end >= inclusive_date_start
);

ALTER TABLE tlo_position_history DROP CONSTRAINT IF EXISTS chk_tlo_pos_dates;
ALTER TABLE tlo_position_history ADD CONSTRAINT chk_tlo_pos_dates CHECK (
    inclusive_date_end IS NULL OR inclusive_date_start IS NULL OR inclusive_date_end >= inclusive_date_start
);

COMMIT;
