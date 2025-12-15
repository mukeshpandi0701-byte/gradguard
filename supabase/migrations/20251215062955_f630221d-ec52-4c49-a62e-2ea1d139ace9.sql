-- Drop the foreign key constraint on predictions that references students table
ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_student_id_fkey;