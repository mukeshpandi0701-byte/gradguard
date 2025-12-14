
-- Add delete policy for profiles table (HODs can delete staff profiles)
CREATE POLICY "HODs can delete staff profiles"
ON public.profiles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'hod') 
  AND panel_type = 'staff'
);

-- Add delete policy for student_profiles table (HODs can delete)
CREATE POLICY "HODs can delete student profiles"
ON public.student_profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'hod'));

-- HODs should be able to view all profiles for management
CREATE POLICY "HODs can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'hod'));
