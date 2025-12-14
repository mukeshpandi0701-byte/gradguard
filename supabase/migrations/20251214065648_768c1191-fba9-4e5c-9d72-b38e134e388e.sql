-- Create student_profiles table for student-specific data
CREATE TABLE public.student_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  roll_number TEXT,
  college TEXT,
  year TEXT,
  department TEXT,
  branch TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_profiles
CREATE POLICY "Students can view their own profile"
ON public.student_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Students can update their own profile"
ON public.student_profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Students can insert their own profile"
ON public.student_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Staff can view all student profiles
CREATE POLICY "Staff can view all student profiles"
ON public.student_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.panel_type = 'staff'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_student_profiles_updated_at
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new student user signup
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only create student profile if panel_type is 'student'
  IF NEW.raw_user_meta_data->>'panel_type' = 'student' THEN
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
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new student signup
CREATE TRIGGER on_auth_student_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_student();