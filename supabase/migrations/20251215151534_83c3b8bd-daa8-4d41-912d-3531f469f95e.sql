-- Update the handle_new_student trigger to also create a students table entry
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create student profile if panel_type is 'student'
  IF NEW.raw_user_meta_data->>'panel_type' = 'student' THEN
    -- Insert into student_profiles
    INSERT INTO public.student_profiles (user_id, email, full_name, roll_number, college, year, department, branch)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.raw_user_meta_data->>'roll_number',
      NEW.raw_user_meta_data->>'college',
      NEW.raw_user_meta_data->>'year',
      NEW.raw_user_meta_data->>'department',
      NEW.raw_user_meta_data->>'branch'
    );
    
    -- Also create a corresponding entry in students table with default values
    -- Skip generated columns (attendance_percentage, pending_fees, fee_paid_percentage)
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
      NEW.raw_user_meta_data->>'branch',
      0, 0, 0, 0, 0
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create students records for existing student_profiles that don't have one
-- Skip generated columns
INSERT INTO public.students (
  user_id,
  student_name,
  roll_number,
  email,
  department,
  total_hours,
  attended_hours,
  total_fees,
  paid_fees,
  internal_marks
)
SELECT 
  sp.user_id,
  COALESCE(sp.full_name, sp.email),
  sp.roll_number,
  sp.email,
  sp.branch,
  0, 0, 0, 0, 0
FROM student_profiles sp
WHERE NOT EXISTS (
  SELECT 1 FROM students s WHERE s.roll_number = sp.roll_number
)
AND sp.roll_number IS NOT NULL;