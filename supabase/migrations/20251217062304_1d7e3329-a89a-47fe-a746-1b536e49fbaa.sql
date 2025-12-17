-- Add RLS policy for students to view academic calendar for their department
CREATE POLICY "Students can view calendar for their department" 
ON public.academic_calendar 
FOR SELECT 
USING (
  has_role(auth.uid(), 'student'::app_role) 
  AND department = (
    SELECT sp.department 
    FROM student_profiles sp 
    WHERE sp.user_id = auth.uid() 
    LIMIT 1
  )
);