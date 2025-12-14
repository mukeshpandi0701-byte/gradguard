
-- Update the handle_new_user function to properly handle panel_type for profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create profile for staff and hod panel types
  IF NEW.raw_user_meta_data->>'panel_type' IN ('staff', 'hod') THEN
    INSERT INTO public.profiles (id, email, full_name, role, college, year, department, branch, panel_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tutor'),
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
