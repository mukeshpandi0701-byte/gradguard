-- Add unique constraint to prevent duplicate students
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_name_roll ON public.students(user_id, student_name, COALESCE(roll_number, ''));