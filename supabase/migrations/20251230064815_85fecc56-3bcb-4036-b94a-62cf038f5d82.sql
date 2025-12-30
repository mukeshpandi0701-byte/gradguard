-- Allow students to read their own attendance_records by matching their student_profiles.id
-- This fixes student dashboard attendance showing 0 when attendance is recorded by staff.

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

-- Helpful index for faster lookups (safe and non-breaking)
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id
ON public.attendance_records (student_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id
ON public.student_profiles (user_id);