-- Drop existing restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "HODs can view all student profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Staff can view all student profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "HODs can delete student profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can insert their own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can update their own profile" ON public.student_profiles;

-- Recreate as PERMISSIVE policies (default, uses OR logic)
CREATE POLICY "HODs can view all student profiles"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'hod'::app_role));

CREATE POLICY "Staff can view all student profiles"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Students can view their own profile"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Students can insert their own profile"
ON public.student_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update their own profile"
ON public.student_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "HODs can delete student profiles"
ON public.student_profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'hod'::app_role));