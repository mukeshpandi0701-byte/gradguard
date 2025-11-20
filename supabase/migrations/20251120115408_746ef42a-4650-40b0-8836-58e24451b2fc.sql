-- Add new columns to dropout_criteria for maximum values
ALTER TABLE dropout_criteria 
ADD COLUMN max_internal_marks numeric NOT NULL DEFAULT 100,
ADD COLUMN total_fees numeric NOT NULL DEFAULT 100000,
ADD COLUMN total_hours numeric NOT NULL DEFAULT 100;

-- Update the comment to reflect the new structure
COMMENT ON COLUMN dropout_criteria.max_internal_marks IS 'Maximum internal marks (out of which students are scored)';
COMMENT ON COLUMN dropout_criteria.total_fees IS 'Total fees for the course';
COMMENT ON COLUMN dropout_criteria.total_hours IS 'Total hours of classes in the course';