-- Create branch_assignments table for storing assignment metadata
CREATE TABLE public.branch_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch TEXT NOT NULL,
  assignment_number TEXT NOT NULL,
  assignment_title TEXT NOT NULL,
  staff_user_id UUID NOT NULL,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch, assignment_number)
);

-- Create student_branch_assignment_marks table for storing marks per student per subject per assignment
CREATE TABLE public.student_branch_assignment_marks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.branch_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.branch_subjects(id) ON DELETE CASCADE,
  marks_obtained NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_branch_assignment_marks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branch_assignments
CREATE POLICY "Staff can manage assignments for assigned branches"
ON public.branch_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid()
    AND sba.branch = branch_assignments.branch
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_branch_assignments sba
    WHERE sba.staff_user_id = auth.uid()
    AND sba.branch = branch_assignments.branch
  )
);

CREATE POLICY "HODs can view all assignments in their department"
ON public.branch_assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'hod'::app_role)
);

CREATE POLICY "Students can view assignments for their branch"
ON public.branch_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
    AND sp.branch = branch_assignments.branch
  )
);

-- RLS Policies for student_branch_assignment_marks
CREATE POLICY "Staff can manage assignment marks for assigned branch students"
ON public.student_branch_assignment_marks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.branch_assignments ba
    JOIN public.staff_branch_assignments sba ON sba.branch = ba.branch
    WHERE ba.id = student_branch_assignment_marks.assignment_id
    AND sba.staff_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.branch_assignments ba
    JOIN public.staff_branch_assignments sba ON sba.branch = ba.branch
    WHERE ba.id = student_branch_assignment_marks.assignment_id
    AND sba.staff_user_id = auth.uid()
  )
);

CREATE POLICY "HODs can view all assignment marks"
ON public.student_branch_assignment_marks
FOR SELECT
USING (
  has_role(auth.uid(), 'hod'::app_role)
);

CREATE POLICY "Students can view their own assignment marks"
ON public.student_branch_assignment_marks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.student_profiles sp ON sp.roll_number = s.roll_number
    WHERE s.id = student_branch_assignment_marks.student_id
    AND sp.user_id = auth.uid()
  )
);

-- Add indexes for performance
CREATE INDEX idx_branch_assignments_branch ON public.branch_assignments(branch);
CREATE INDEX idx_branch_assignments_staff ON public.branch_assignments(staff_user_id);
CREATE INDEX idx_student_assignment_marks_assignment ON public.student_branch_assignment_marks(assignment_id);
CREATE INDEX idx_student_assignment_marks_student ON public.student_branch_assignment_marks(student_id);