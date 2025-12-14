-- Add RLS policy for HODs to view all student profiles
CREATE POLICY "HODs can view all student profiles" 
ON public.student_profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'hod'::app_role));