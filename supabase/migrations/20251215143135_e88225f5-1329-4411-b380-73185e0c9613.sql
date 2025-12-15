-- Create assignments table for staff to create assignments per subject
CREATE TABLE public.assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_user_id UUID NOT NULL,
    subject_id UUID NOT NULL REFERENCES public.branch_subjects(id) ON DELETE CASCADE,
    assignment_name TEXT NOT NULL,
    description TEXT,
    max_marks NUMERIC NOT NULL DEFAULT 100,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student assignment scores table
CREATE TABLE public.student_assignment_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    marks_obtained NUMERIC,
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, assignment_id)
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assignment_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignments
CREATE POLICY "Staff can manage their own assignments"
ON public.assignments
FOR ALL
USING (auth.uid() = staff_user_id)
WITH CHECK (auth.uid() = staff_user_id);

CREATE POLICY "HODs can view all assignments in their department"
ON public.assignments
FOR SELECT
USING (
    has_role(auth.uid(), 'hod'::app_role) AND
    EXISTS (
        SELECT 1 FROM branch_subjects bs
        JOIN profiles p ON p.department = bs.department
        WHERE bs.id = assignments.subject_id AND p.id = auth.uid()
    )
);

CREATE POLICY "Students can view assignments for their branch subjects"
ON public.assignments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM branch_subjects bs
        JOIN student_profiles sp ON sp.branch = bs.branch
        WHERE bs.id = assignments.subject_id AND sp.user_id = auth.uid()
    )
);

-- RLS policies for student_assignment_scores
CREATE POLICY "Staff can manage scores for their assignments"
ON public.student_assignment_scores
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.id = student_assignment_scores.assignment_id AND a.staff_user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.id = student_assignment_scores.assignment_id AND a.staff_user_id = auth.uid()
    )
);

CREATE POLICY "HODs can view all scores in their department"
ON public.student_assignment_scores
FOR SELECT
USING (
    has_role(auth.uid(), 'hod'::app_role) AND
    EXISTS (
        SELECT 1 FROM assignments a
        JOIN branch_subjects bs ON bs.id = a.subject_id
        JOIN profiles p ON p.department = bs.department
        WHERE a.id = student_assignment_scores.assignment_id AND p.id = auth.uid()
    )
);

CREATE POLICY "Students can view their own scores"
ON public.student_assignment_scores
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM students s
        JOIN student_profiles sp ON sp.roll_number = s.roll_number
        WHERE s.id = student_assignment_scores.student_id AND sp.user_id = auth.uid()
    )
);

-- Triggers for updated_at
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_assignment_scores_updated_at
BEFORE UPDATE ON public.student_assignment_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();