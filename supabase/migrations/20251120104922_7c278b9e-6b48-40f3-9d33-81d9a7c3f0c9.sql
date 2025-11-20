-- Drop the old unique constraint with COALESCE
DROP INDEX IF EXISTS idx_students_unique_by_user_name_roll;

-- Create a simpler unique constraint (treating NULL roll_numbers as non-unique)
CREATE UNIQUE INDEX idx_students_unique_user_name_roll 
ON public.students(user_id, student_name, roll_number)
WHERE roll_number IS NOT NULL;

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- Add index on roll_number for sorting
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON public.students(roll_number);

-- Add index on predictions for faster analytics
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_risk_level ON public.predictions(final_risk_level);
CREATE INDEX IF NOT EXISTS idx_predictions_student_id ON public.predictions(student_id);

-- Create table for storing historical student data
CREATE TABLE IF NOT EXISTS public.student_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  attendance_percentage NUMERIC,
  internal_marks NUMERIC,
  fee_paid_percentage NUMERIC,
  pending_fees NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

-- Enable RLS on student_history
ALTER TABLE public.student_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_history
CREATE POLICY "Users can view their own student history" 
ON public.student_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own student history" 
ON public.student_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to automatically record student history when data changes
CREATE OR REPLACE FUNCTION record_student_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.student_history (
    student_id,
    user_id,
    attendance_percentage,
    internal_marks,
    fee_paid_percentage,
    pending_fees
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.attendance_percentage,
    NEW.internal_marks,
    NEW.fee_paid_percentage,
    NEW.pending_fees
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to record history on student updates
DROP TRIGGER IF EXISTS trigger_record_student_history ON public.students;
CREATE TRIGGER trigger_record_student_history
AFTER INSERT OR UPDATE OF attendance_percentage, internal_marks, fee_paid_percentage, pending_fees
ON public.students
FOR EACH ROW
EXECUTE FUNCTION record_student_history();