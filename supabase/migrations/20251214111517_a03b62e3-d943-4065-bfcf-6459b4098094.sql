
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('hod', 'staff', 'student');

-- Create enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create user_approvals table for HOD and Staff approval workflow
CREATE TABLE public.user_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role app_role NOT NULL,
    status approval_status NOT NULL DEFAULT 'pending',
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_approvals
    WHERE user_id = _user_id
      AND status = 'approved'
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'student'
  )
$$;

-- Function to get user's approval status
CREATE OR REPLACE FUNCTION public.get_approval_status(_user_id uuid)
RETURNS approval_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status
  FROM public.user_approvals
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "HODs can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'hod'));

CREATE POLICY "System can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "HODs can delete staff and student roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'hod') AND role IN ('staff', 'student'));

-- RLS Policies for user_approvals
CREATE POLICY "Users can view their own approval"
ON public.user_approvals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "HODs can view all approvals"
ON public.user_approvals
FOR SELECT
USING (public.has_role(auth.uid(), 'hod'));

CREATE POLICY "System can insert approvals"
ON public.user_approvals
FOR INSERT
WITH CHECK (true);

CREATE POLICY "HODs can update approvals for staff"
ON public.user_approvals
FOR UPDATE
USING (public.has_role(auth.uid(), 'hod') AND role = 'staff');

-- Super admin can approve HODs (for initial HOD setup, you'll need to manually approve first HOD)
CREATE POLICY "Approved HODs can approve other HODs"
ON public.user_approvals
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'hod') 
  AND public.is_user_approved(auth.uid())
  AND role = 'hod'
);

-- Trigger to create approval record on signup for HOD/Staff
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  panel_type TEXT;
  user_role app_role;
BEGIN
  panel_type := NEW.raw_user_meta_data->>'panel_type';
  
  IF panel_type = 'hod' THEN
    user_role := 'hod';
    -- Insert role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, user_role);
    -- Insert approval record (pending)
    INSERT INTO public.user_approvals (user_id, role, status) VALUES (NEW.id, user_role, 'pending');
  ELSIF panel_type = 'staff' THEN
    user_role := 'staff';
    -- Insert role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, user_role);
    -- Insert approval record (pending)
    INSERT INTO public.user_approvals (user_id, role, status) VALUES (NEW.id, user_role, 'pending');
  ELSIF panel_type = 'student' THEN
    user_role := 'student';
    -- Insert role (no approval needed for students)
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, user_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created_approval
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

-- Update timestamp trigger
CREATE TRIGGER update_user_approvals_updated_at
  BEFORE UPDATE ON public.user_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
