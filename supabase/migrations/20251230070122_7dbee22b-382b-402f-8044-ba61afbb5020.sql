-- Fix student access to attendance_records: attendance_records.student_id matches student_profiles.id (not students.id).

DROP POLICY IF EXISTS "Students can view their own attendance records" ON public.attendance_records;

CREATE POLICY "Students can view their own attendance records"
ON public.attendance_records
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
      AND sp.id = attendance_records.student_id
  )
);
