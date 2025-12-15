-- Fix: some approved staff accounts are missing the corresponding row in public.user_roles,
-- which breaks role-based access (RLS) and makes branch sync appear to work only for some tutors.

-- 1) Backfill missing roles for already-approved users
INSERT INTO public.user_roles (user_id, role)
SELECT ua.user_id, ua.role
FROM public.user_approvals ua
WHERE ua.status = 'approved'
  AND ua.role IN ('hod'::public.app_role, 'staff'::public.app_role)
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = ua.user_id
      AND ur.role = ua.role
  );

-- 2) Keep roles consistent going forward: when an approval is set to approved,
-- ensure the matching role exists in public.user_roles.
CREATE OR REPLACE FUNCTION public.ensure_user_role_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'approved'
       AND (OLD.status IS DISTINCT FROM NEW.status)
       AND NEW.role IN ('hod'::app_role, 'staff'::app_role) THEN

      INSERT INTO public.user_roles (user_id, role)
      SELECT NEW.user_id, NEW.role
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = NEW.user_id
          AND ur.role = NEW.role
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_user_role_on_approval ON public.user_approvals;
CREATE TRIGGER trg_ensure_user_role_on_approval
AFTER UPDATE OF status ON public.user_approvals
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_role_on_approval();
