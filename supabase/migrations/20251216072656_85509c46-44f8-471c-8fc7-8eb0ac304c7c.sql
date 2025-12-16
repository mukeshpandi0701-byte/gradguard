-- Add exam_date to student_subject_marks for tracking when internal exams were conducted
ALTER TABLE public.student_subject_marks
ADD COLUMN exam_date date;

-- Add submission_date and assignment_title to student_branch_assignment_marks for per-subject tracking
ALTER TABLE public.student_branch_assignment_marks
ADD COLUMN submission_date date,
ADD COLUMN assignment_title text;