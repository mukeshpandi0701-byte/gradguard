-- Create a security definer function to get user's department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- Drop and recreate the policy using the function
DROP POLICY IF EXISTS "Staff can view HOD profiles in their department" ON public.profiles;

CREATE POLICY "Staff can view HOD profiles in their department"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  AND panel_type = 'hod'
  AND department = get_user_department(auth.uid())
);