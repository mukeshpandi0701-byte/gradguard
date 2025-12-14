-- Create staff_branch_assignments table for HOD to assign branches to staff
CREATE TABLE public.staff_branch_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id uuid NOT NULL,
  branch text NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(staff_user_id, branch)
);

-- Enable RLS
ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;

-- HODs can view all assignments
CREATE POLICY "HODs can view all branch assignments"
ON public.staff_branch_assignments
FOR SELECT
USING (public.has_role(auth.uid(), 'hod'));

-- HODs can insert assignments
CREATE POLICY "HODs can create branch assignments"
ON public.staff_branch_assignments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'hod') AND public.is_user_approved(auth.uid()));

-- HODs can delete assignments
CREATE POLICY "HODs can delete branch assignments"
ON public.staff_branch_assignments
FOR DELETE
USING (public.has_role(auth.uid(), 'hod') AND public.is_user_approved(auth.uid()));

-- Staff can view their own assignments
CREATE POLICY "Staff can view their own branch assignments"
ON public.staff_branch_assignments
FOR SELECT
USING (auth.uid() = staff_user_id);