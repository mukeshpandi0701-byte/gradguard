-- Add RLS policy for HOD to view all attendance records
CREATE POLICY "HODs can view all attendance records"
ON public.attendance_records
FOR SELECT
USING (has_role(auth.uid(), 'hod'::app_role));

-- Add RLS policy for staff to view attendance based on student_profiles branch
CREATE POLICY "Staff can view attendance for students in assigned branches via profiles"
ON public.attendance_records
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM student_profiles sp
    JOIN staff_branch_assignments sba ON sba.branch = sp.branch
    WHERE sp.id = attendance_records.student_id
      AND sba.staff_user_id = auth.uid()
  )
);