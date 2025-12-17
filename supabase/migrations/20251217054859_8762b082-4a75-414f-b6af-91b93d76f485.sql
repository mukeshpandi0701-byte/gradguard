-- Drop existing staff view policy
DROP POLICY IF EXISTS "Staff can view their department calendar" ON public.academic_calendar;

-- Create improved staff view policy that checks both department and assigned branches
CREATE POLICY "Staff can view calendar for their department or assigned branches"
ON public.academic_calendar
FOR SELECT
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  AND (
    -- Check direct department match
    department = get_user_department(auth.uid())
    OR
    -- Check if staff has any branch assignment in this department
    EXISTS (
      SELECT 1 FROM staff_branch_assignments sba
      JOIN student_profiles sp ON sp.branch = sba.branch
      WHERE sba.staff_user_id = auth.uid()
        AND sp.department = academic_calendar.department
    )
  )
);