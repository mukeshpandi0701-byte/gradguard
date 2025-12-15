-- Drop the foreign key constraint that references students table
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_student_id_fkey;

-- The attendance_records table now stores student_profiles.id as student_id
-- No foreign key needed since student_profiles.id is used