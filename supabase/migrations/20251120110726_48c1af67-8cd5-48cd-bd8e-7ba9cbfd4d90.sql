-- Drop the existing conditional unique index
DROP INDEX IF EXISTS public.idx_students_unique_user_name_roll;

-- Drop the coalesce-based index as well since we'll replace it
DROP INDEX IF EXISTS public.idx_students_unique_name_roll;

-- Create a simple unique constraint that works with upsert
-- This allows duplicate (user_id, student_name) pairs only if roll_number differs
ALTER TABLE public.students 
ADD CONSTRAINT students_user_name_roll_unique 
UNIQUE (user_id, student_name, roll_number);

-- Create a separate unique constraint for students without roll numbers
-- Using a partial unique index on just user_id and student_name where roll_number IS NULL
CREATE UNIQUE INDEX idx_students_no_roll_unique 
ON public.students (user_id, student_name) 
WHERE roll_number IS NULL;