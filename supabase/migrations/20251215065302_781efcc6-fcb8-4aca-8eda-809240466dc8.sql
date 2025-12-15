-- Add RLS policy to allow HODs to view all students data
CREATE POLICY "HODs can view all students data" 
ON public.students 
FOR SELECT 
USING (has_role(auth.uid(), 'hod'::app_role));