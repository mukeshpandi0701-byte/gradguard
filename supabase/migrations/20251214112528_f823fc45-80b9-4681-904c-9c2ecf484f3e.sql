
-- Drop the policy that allows HODs to approve other HODs
DROP POLICY IF EXISTS "Approved HODs can approve other HODs" ON public.user_approvals;

-- Update the policy so HODs can only update staff approvals, not HOD approvals
DROP POLICY IF EXISTS "HODs can update approvals for staff" ON public.user_approvals;

CREATE POLICY "HODs can only update staff approvals"
ON public.user_approvals
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'hod') 
  AND public.is_user_approved(auth.uid())
  AND role = 'staff'
);
