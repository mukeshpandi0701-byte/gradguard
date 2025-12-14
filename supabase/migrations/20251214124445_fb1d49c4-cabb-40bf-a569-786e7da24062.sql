-- Allow students to view staff_branch_assignments to find their tutor
CREATE POLICY "Students can view branch assignments for their branch" 
ON public.staff_branch_assignments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.branch = staff_branch_assignments.branch
  )
);

-- Allow students to view their tutor's profile
CREATE POLICY "Students can view their assigned tutor profile" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.staff_branch_assignments sba
    JOIN public.student_profiles sp ON sp.branch = sba.branch
    WHERE sp.user_id = auth.uid()
      AND sba.staff_user_id = profiles.id
  )
);

-- Allow students to view their own student data from students table
CREATE POLICY "Students can view their own student data" 
ON public.students 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.roll_number = students.roll_number
  )
);

-- Allow students to view predictions for their own student record
CREATE POLICY "Students can view their own predictions" 
ON public.predictions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.students s
    JOIN public.student_profiles sp ON sp.roll_number = s.roll_number
    WHERE sp.user_id = auth.uid()
      AND s.id = predictions.student_id
  )
);