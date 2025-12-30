-- Fix: Restrict predictions access to only authorized personnel
-- Staff should only see predictions they created (assigned tutor relationship)
-- HODs can view all predictions in their department

-- Drop existing overly permissive staff policies
DROP POLICY IF EXISTS "Staff can view predictions for assigned branch students" ON public.predictions;
DROP POLICY IF EXISTS "Staff can insert predictions for assigned branch students" ON public.predictions;
DROP POLICY IF EXISTS "Staff can delete predictions for assigned branch students" ON public.predictions;

-- Create more restrictive policies for staff
-- Staff can only view predictions they created (their own assessments)
CREATE POLICY "Staff can view predictions they created"
ON public.predictions
FOR SELECT
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  AND user_id = auth.uid()
);

-- Staff can only insert predictions for students in their assigned branch
-- AND the prediction is associated with their user_id
CREATE POLICY "Staff can insert predictions for their students"
ON public.predictions
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'staff'::app_role)
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM students s
    JOIN staff_branch_assignments sba ON sba.branch = s.department
    WHERE s.id = predictions.student_id
    AND sba.staff_user_id = auth.uid()
  )
);

-- Staff can only delete their own predictions
CREATE POLICY "Staff can delete predictions they created"
ON public.predictions
FOR DELETE
USING (
  has_role(auth.uid(), 'staff'::app_role)
  AND user_id = auth.uid()
);