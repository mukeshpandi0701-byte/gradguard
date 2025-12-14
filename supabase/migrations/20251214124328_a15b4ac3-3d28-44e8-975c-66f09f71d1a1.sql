-- Add RLS policy for staff to view students from their assigned branches
CREATE POLICY "Staff can view students from assigned branches" 
ON public.students 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid()
      AND sba.branch = students.department
  )
);

-- Add RLS policy for staff to update students from their assigned branches
CREATE POLICY "Staff can update students from assigned branches" 
ON public.students 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid()
      AND sba.branch = students.department
  )
);

-- Add RLS policy for staff to insert students into their assigned branches
CREATE POLICY "Staff can insert students into assigned branches" 
ON public.students 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid()
      AND sba.branch = department
  )
);

-- Add RLS policy for staff to delete students from their assigned branches
CREATE POLICY "Staff can delete students from assigned branches" 
ON public.students 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid()
      AND sba.branch = students.department
  )
);

-- Similarly for predictions table - staff should see predictions for students in their branches
CREATE POLICY "Staff can view predictions for assigned branch students" 
ON public.predictions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.students s
    JOIN public.staff_branch_assignments sba ON sba.branch = s.department
    WHERE s.id = predictions.student_id
      AND sba.staff_user_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert predictions for assigned branch students" 
ON public.predictions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.students s
    JOIN public.staff_branch_assignments sba ON sba.branch = s.department
    WHERE s.id = student_id
      AND sba.staff_user_id = auth.uid()
  )
);

CREATE POLICY "Staff can delete predictions for assigned branch students" 
ON public.predictions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.students s
    JOIN public.staff_branch_assignments sba ON sba.branch = s.department
    WHERE s.id = predictions.student_id
      AND sba.staff_user_id = auth.uid()
  )
);