-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Users can view their own students" ON public.students;
DROP POLICY IF EXISTS "Users can update their own students" ON public.students;

-- Create new policies that allow staff to view ALL students from their assigned branches
-- (not just students they created themselves)
CREATE POLICY "Staff can view all students from assigned branches" 
ON public.students 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid() AND sba.branch = students.department
  )
  OR auth.uid() = user_id
);

-- Staff can update students in their assigned branches
CREATE POLICY "Staff can update all students from assigned branches" 
ON public.students 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid() AND sba.branch = students.department
  )
  OR auth.uid() = user_id
);