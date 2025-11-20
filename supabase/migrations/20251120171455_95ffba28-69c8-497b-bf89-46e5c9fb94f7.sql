-- Add department column to students table
ALTER TABLE public.students ADD COLUMN department TEXT;

-- Add index for faster department filtering
CREATE INDEX idx_students_department ON public.students(department, user_id);