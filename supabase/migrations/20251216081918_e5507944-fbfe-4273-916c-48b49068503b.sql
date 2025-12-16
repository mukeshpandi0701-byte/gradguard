-- Allow staff to view HOD profiles in the same department
CREATE POLICY "Staff can view HOD profiles in their department"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  AND panel_type = 'hod'
  AND department = (
    SELECT p.department FROM public.profiles p WHERE p.id = auth.uid()
  )
);