-- Create table for branch subjects (configured by HOD)
CREATE TABLE public.branch_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL,
  subject_code text NOT NULL,
  subject_name text,
  department text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(branch, subject_code)
);

-- Enable RLS
ALTER TABLE public.branch_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies for branch_subjects
CREATE POLICY "HODs can manage branch subjects"
ON public.branch_subjects
FOR ALL
USING (has_role(auth.uid(), 'hod'::app_role))
WITH CHECK (has_role(auth.uid(), 'hod'::app_role));

CREATE POLICY "Staff can view subjects for assigned branches"
ON public.branch_subjects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_branch_assignments sba
    WHERE sba.branch = branch_subjects.branch
      AND sba.staff_user_id = auth.uid()
  )
);

CREATE POLICY "Students can view subjects for their branch"
ON public.branch_subjects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM student_profiles sp
    WHERE sp.branch = branch_subjects.branch
      AND sp.user_id = auth.uid()
  )
);

-- Create table for student subject marks
CREATE TABLE public.student_subject_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.branch_subjects(id) ON DELETE CASCADE,
  internal_marks numeric NOT NULL DEFAULT 0,
  updated_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.student_subject_marks ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_subject_marks
CREATE POLICY "HODs can view all subject marks"
ON public.student_subject_marks
FOR SELECT
USING (has_role(auth.uid(), 'hod'::app_role));

CREATE POLICY "Staff can manage subject marks for assigned branch students"
ON public.student_subject_marks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN staff_branch_assignments sba ON sba.branch = s.department
    WHERE s.id = student_subject_marks.student_id
      AND sba.staff_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM students s
    JOIN staff_branch_assignments sba ON sba.branch = s.department
    WHERE s.id = student_subject_marks.student_id
      AND sba.staff_user_id = auth.uid()
  )
);

CREATE POLICY "Students can view their own subject marks"
ON public.student_subject_marks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN student_profiles sp ON sp.roll_number = s.roll_number
    WHERE s.id = student_subject_marks.student_id
      AND sp.user_id = auth.uid()
  )
);

-- Create trigger to update updated_at
CREATE TRIGGER update_branch_subjects_updated_at
BEFORE UPDATE ON public.branch_subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_subject_marks_updated_at
BEFORE UPDATE ON public.student_subject_marks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();