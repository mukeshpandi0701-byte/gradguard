-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Staff can view their own branch assignments" ON staff_branch_assignments;

CREATE POLICY "Staff can view their own branch assignments" 
ON staff_branch_assignments 
FOR SELECT 
TO authenticated
USING (auth.uid() = staff_user_id);