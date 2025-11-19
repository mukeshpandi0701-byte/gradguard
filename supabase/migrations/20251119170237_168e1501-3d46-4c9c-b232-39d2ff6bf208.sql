-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'tutor');

-- Create enum for risk levels
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'tutor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tutor')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  roll_number TEXT,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  attended_hours NUMERIC NOT NULL DEFAULT 0,
  attendance_percentage NUMERIC GENERATED ALWAYS AS ((attended_hours / NULLIF(total_hours, 0)) * 100) STORED,
  total_fees NUMERIC NOT NULL DEFAULT 0,
  paid_fees NUMERIC NOT NULL DEFAULT 0,
  pending_fees NUMERIC GENERATED ALWAYS AS (total_fees - paid_fees) STORED,
  fee_paid_percentage NUMERIC GENERATED ALWAYS AS ((paid_fees / NULLIF(total_fees, 0)) * 100) STORED,
  internal_marks NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Students policies
CREATE POLICY "Users can view their own students"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own students"
  ON public.students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own students"
  ON public.students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own students"
  ON public.students FOR DELETE
  USING (auth.uid() = user_id);

-- Create dropout criteria table
CREATE TABLE public.dropout_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_attendance_percentage NUMERIC NOT NULL DEFAULT 75,
  min_internal_marks NUMERIC NOT NULL DEFAULT 40,
  max_pending_fees NUMERIC NOT NULL DEFAULT 10000,
  attendance_weightage NUMERIC NOT NULL DEFAULT 0.4,
  internal_weightage NUMERIC NOT NULL DEFAULT 0.3,
  fees_weightage NUMERIC NOT NULL DEFAULT 0.3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on dropout_criteria
ALTER TABLE public.dropout_criteria ENABLE ROW LEVEL SECURITY;

-- Dropout criteria policies
CREATE POLICY "Users can view their own criteria"
  ON public.dropout_criteria FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own criteria"
  ON public.dropout_criteria FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own criteria"
  ON public.dropout_criteria FOR UPDATE
  USING (auth.uid() = user_id);

-- Create predictions table
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml_probability NUMERIC NOT NULL,
  rule_based_score NUMERIC NOT NULL,
  final_risk_level risk_level NOT NULL,
  insights TEXT,
  suggestions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on predictions
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Predictions policies
CREATE POLICY "Users can view their own predictions"
  ON public.predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
  ON public.predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_predictions_student_id ON public.predictions(student_id);
CREATE INDEX idx_predictions_user_id ON public.predictions(user_id);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_criteria_updated_at
  BEFORE UPDATE ON public.dropout_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();