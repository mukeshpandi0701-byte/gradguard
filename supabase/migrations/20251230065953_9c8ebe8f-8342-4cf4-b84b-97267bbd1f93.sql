-- Fix student access to attendance_records: attendance_records.student_id references students.id,
-- so student access must be derived via roll_number mapping from student_profiles -> students.

DROP POLICY IF EXISTS "Students can view their own attendance records" ON public.attendance_records;

CREATE POLICY "Students can view their own attendance records"
ON public.attendance_records
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.student_profiles sp
    JOIN public.students s ON s.roll_number = sp.roll_number
    WHERE sp.user_id = auth.uid()
      AND s.id = attendance_records.student_id
  )
);
