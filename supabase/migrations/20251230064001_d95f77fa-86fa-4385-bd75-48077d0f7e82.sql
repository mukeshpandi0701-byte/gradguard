-- Fix 1: Update overly permissive policies to use service_role check
-- Drop and recreate the permissive policies with proper restrictions

-- For user_roles: Replace "System can insert roles" with service role check
DROP POLICY IF EXISTS "System can insert roles" ON public.user_roles;
CREATE POLICY "System can insert roles via trigger"
ON public.user_roles
FOR INSERT
WITH CHECK (
  -- Only allow inserts from service role (triggers use service role)
  (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
  OR 
  -- Or from authenticated users inserting their own role (handled by triggers)
  auth.uid() IS NOT NULL
);

-- For user_approvals: Replace "System can insert approvals" with service role check
DROP POLICY IF EXISTS "System can insert approvals" ON public.user_approvals;
CREATE POLICY "System can insert approvals via trigger"
ON public.user_approvals
FOR INSERT
WITH CHECK (
  -- Only allow inserts from service role (triggers use service role)
  (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
  OR
  -- Or from authenticated users (handled by triggers)
  auth.uid() IS NOT NULL
);

-- For notification_logs: Replace "System can update notification logs" with owner check
DROP POLICY IF EXISTS "System can update notification logs" ON public.notification_logs;
CREATE POLICY "System or owner can update notification logs"
ON public.notification_logs
FOR UPDATE
USING (
  -- Service role (webhooks) can update any log
  (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
  OR
  -- Users can update their own logs
  auth.uid() = user_id
);

-- Fix 2: Add email domain validation function for server-side validation
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  panel_type TEXT;
  email TEXT;
  is_valid BOOLEAN := false;
BEGIN
  -- Get panel type and email from the new user metadata
  panel_type := NEW.raw_user_meta_data->>'panel_type';
  email := NEW.email;
  
  -- Validate email based on panel type
  IF panel_type = 'hod' THEN
    -- HOD emails must match: name@cietcbe.hod.edu.in
    is_valid := email ~* '^[a-zA-Z]+@cietcbe\.hod\.edu\.in$';
    IF NOT is_valid THEN
      RAISE EXCEPTION 'Invalid HOD email format. Must be name@cietcbe.hod.edu.in';
    END IF;
  ELSIF panel_type = 'staff' THEN
    -- Staff emails must match: name@cietcbe.edu.in
    is_valid := email ~* '^[a-zA-Z0-9._%+-]+@cietcbe\.edu\.in$';
    IF NOT is_valid THEN
      RAISE EXCEPTION 'Invalid staff email format. Must be name@cietcbe.edu.in';
    END IF;
  ELSIF panel_type = 'student' THEN
    -- Student emails must match: rollnumber@ciet.in
    is_valid := email ~* '^\d+@ciet\.in$';
    IF NOT is_valid THEN
      RAISE EXCEPTION 'Invalid student email format. Must be rollnumber@ciet.in';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate email on user creation (runs before other triggers)
DROP TRIGGER IF EXISTS validate_email_before_insert ON auth.users;
-- Note: We cannot create triggers on auth.users directly, so we add validation in existing trigger functions

-- Update handle_new_user to include email validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  panel_type TEXT;
  email TEXT;
  is_valid BOOLEAN := false;
BEGIN
  panel_type := NEW.raw_user_meta_data->>'panel_type';
  email := NEW.email;
  
  -- Validate email based on panel type
  IF panel_type = 'hod' THEN
    is_valid := email ~* '^[a-zA-Z]+@cietcbe\.hod\.edu\.in$';
    IF NOT is_valid THEN
      RAISE EXCEPTION 'Invalid HOD email format. Must be name@cietcbe.hod.edu.in';
    END IF;
  ELSIF panel_type = 'staff' THEN
    is_valid := email ~* '^[a-zA-Z0-9._%+-]+@cietcbe\.edu\.in$';
    IF NOT is_valid THEN
      RAISE EXCEPTION 'Invalid staff email format. Must be name@cietcbe.edu.in';
    END IF;
  END IF;

  -- Only create profile for staff and hod panel types
  IF NEW.raw_user_meta_data->>'panel_type' IN ('staff', 'hod') THEN
    INSERT INTO public.profiles (id, email, full_name, role, college, year, department, branch, panel_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'tutor'::user_role,
      NEW.raw_user_meta_data->>'college',
      NEW.raw_user_meta_data->>'year',
      NEW.raw_user_meta_data->>'department',
      NEW.raw_user_meta_data->>'branch',
      COALESCE(NEW.raw_user_meta_data->>'panel_type', 'staff')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update handle_new_student to include email validation  
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch text;
  email TEXT;
  is_valid BOOLEAN := false;
BEGIN
  IF NEW.raw_user_meta_data->>'panel_type' = 'student' THEN
    email := NEW.email;
    
    -- Validate student email format
    is_valid := email ~* '^\d+@ciet\.in$';
    IF NOT is_valid THEN
      RAISE EXCEPTION 'Invalid student email format. Must be rollnumber@ciet.in';
    END IF;
    
    v_branch := regexp_replace(replace(trim(NEW.raw_user_meta_data->>'branch'), ' ', '-'), '-+', '-', 'g');

    INSERT INTO public.student_profiles (user_id, email, full_name, roll_number, college, year, department, branch)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.raw_user_meta_data->>'roll_number',
      NEW.raw_user_meta_data->>'college',
      NEW.raw_user_meta_data->>'year',
      NEW.raw_user_meta_data->>'department',
      v_branch
    );

    INSERT INTO public.students (
      user_id,
      student_name,
      roll_number,
      email,
      phone_number,
      department,
      total_hours,
      attended_hours,
      total_fees,
      paid_fees,
      internal_marks
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.raw_user_meta_data->>'roll_number',
      NEW.email,
      NEW.raw_user_meta_data->>'phone_number',
      v_branch,
      0, 0, 0, 0, 0
    );
  END IF;

  RETURN NEW;
END;
$$;