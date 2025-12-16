-- Add number of internal exams field to dropout_criteria
ALTER TABLE public.dropout_criteria 
ADD COLUMN IF NOT EXISTS num_internal_exams integer NOT NULL DEFAULT 3;

-- Add exam_number field to student_subject_marks for CIA tracking
ALTER TABLE public.student_subject_marks 
ADD COLUMN IF NOT EXISTS exam_number text DEFAULT NULL;

-- Drop the unique constraint if it exists and create a new one including exam_number
ALTER TABLE public.student_subject_marks 
DROP CONSTRAINT IF EXISTS student_subject_marks_student_id_subject_id_key;

-- Create new unique constraint
ALTER TABLE public.student_subject_marks 
ADD CONSTRAINT student_subject_marks_unique_exam 
UNIQUE (student_id, subject_id, exam_number);

-- Add comment for clarity
COMMENT ON COLUMN public.dropout_criteria.num_internal_exams IS 'Number of internal exams (CIA) configured by HOD, e.g., 3 for CIA-I, CIA-II, CIA-III';
COMMENT ON COLUMN public.student_subject_marks.exam_number IS 'CIA exam number like CIA-I, CIA-II, CIA-III or NULL for general marks';