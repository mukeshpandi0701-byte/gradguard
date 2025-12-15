-- Normalize branch naming across tables to use dashes (e.g., "II-CSE-A")
-- This fixes mismatches where staff assignments used dashes but student records used spaces.

-- 1) Normalize existing data
UPDATE public.staff_branch_assignments
SET branch = regexp_replace(replace(trim(branch), ' ', '-'), '-+', '-', 'g')
WHERE branch IS NOT NULL;

UPDATE public.student_profiles
SET branch = regexp_replace(replace(trim(branch), ' ', '-'), '-+', '-', 'g')
WHERE branch IS NOT NULL;

UPDATE public.students
SET department = regexp_replace(replace(trim(department), ' ', '-'), '-+', '-', 'g')
WHERE department IS NOT NULL;

UPDATE public.branch_subjects
SET branch = regexp_replace(replace(trim(branch), ' ', '-'), '-+', '-', 'g')
WHERE branch IS NOT NULL;

-- 2) Ensure future student signups write normalized branch into both tables
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_branch text;
BEGIN
  IF NEW.raw_user_meta_data->>'panel_type' = 'student' THEN
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

    -- Create a corresponding entry in students table; skip generated columns
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
$function$;