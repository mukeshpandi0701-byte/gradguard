-- Create attendance_records table to persist daily attendance
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  sessions_attended INTEGER NOT NULL DEFAULT 0,
  max_sessions INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, attendance_date, user_id)
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own attendance records"
ON public.attendance_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attendance records"
ON public.attendance_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance records"
ON public.attendance_records FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attendance records"
ON public.attendance_records FOR DELETE
USING (auth.uid() = user_id);

-- Staff can manage attendance for assigned branch students
CREATE POLICY "Staff can view attendance for assigned branch students"
ON public.attendance_records FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students s
  JOIN staff_branch_assignments sba ON sba.branch = s.department
  WHERE s.id = attendance_records.student_id AND sba.staff_user_id = auth.uid()
));

CREATE POLICY "Staff can insert attendance for assigned branch students"
ON public.attendance_records FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM students s
  JOIN staff_branch_assignments sba ON sba.branch = s.department
  WHERE s.id = attendance_records.student_id AND sba.staff_user_id = auth.uid()
));

CREATE POLICY "Staff can update attendance for assigned branch students"
ON public.attendance_records FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM students s
  JOIN staff_branch_assignments sba ON sba.branch = s.department
  WHERE s.id = attendance_records.student_id AND sba.staff_user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing criteria records to set max_sessions_per_day to 7
UPDATE public.dropout_criteria SET max_sessions_per_day = 7 WHERE max_sessions_per_day != 7;