-- Create a secure function to get HOD criteria for the current user's department
CREATE OR REPLACE FUNCTION public.get_department_hod_criteria()
RETURNS TABLE (
  min_attendance_percentage numeric,
  min_internal_marks numeric,
  max_pending_fees numeric,
  max_internal_marks numeric,
  total_fees numeric,
  total_hours numeric,
  max_sessions_per_day numeric,
  num_internal_exams integer,
  attendance_weightage numeric,
  internal_weightage numeric,
  fees_weightage numeric,
  assignment_weightage numeric,
  hod_name text,
  hod_found boolean,
  criteria_found boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_department text;
  v_hod_id uuid;
  v_hod_name text;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      75::numeric, 40::numeric, 10000::numeric, 100::numeric, 100000::numeric, 100::numeric, 7::numeric, 3::integer,
      0.3::numeric, 0.25::numeric, 0.25::numeric, 0.2::numeric, NULL::text, false, false;
    RETURN;
  END IF;

  -- Get user's department from profiles
  SELECT department INTO v_department
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_department IS NULL THEN
    RETURN QUERY SELECT 
      75::numeric, 40::numeric, 10000::numeric, 100::numeric, 100000::numeric, 100::numeric, 7::numeric, 3::integer,
      0.3::numeric, 0.25::numeric, 0.25::numeric, 0.2::numeric, NULL::text, false, false;
    RETURN;
  END IF;

  -- Find HOD for this department using user_roles table (source of truth)
  SELECT ur.user_id, p.full_name INTO v_hod_id, v_hod_name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'hod'
    AND LOWER(TRIM(p.department)) = LOWER(TRIM(v_department))
  LIMIT 1;

  IF v_hod_id IS NULL THEN
    RETURN QUERY SELECT 
      75::numeric, 40::numeric, 10000::numeric, 100::numeric, 100000::numeric, 100::numeric, 7::numeric, 3::integer,
      0.3::numeric, 0.25::numeric, 0.25::numeric, 0.2::numeric, NULL::text, false, false;
    RETURN;
  END IF;

  -- Get HOD's criteria
  RETURN QUERY
  SELECT 
    COALESCE(dc.min_attendance_percentage, 75::numeric),
    COALESCE(dc.min_internal_marks, 40::numeric),
    COALESCE(dc.max_pending_fees, 10000::numeric),
    COALESCE(dc.max_internal_marks, 100::numeric),
    COALESCE(dc.total_fees, 100000::numeric),
    COALESCE(dc.total_hours, 100::numeric),
    COALESCE(dc.max_sessions_per_day, 7::numeric),
    COALESCE(dc.num_internal_exams, 3),
    COALESCE(dc.attendance_weightage, 0.3::numeric),
    COALESCE(dc.internal_weightage, 0.25::numeric),
    COALESCE(dc.fees_weightage, 0.25::numeric),
    COALESCE(dc.assignment_weightage, 0.2::numeric),
    v_hod_name,
    true,
    dc.id IS NOT NULL
  FROM public.dropout_criteria dc
  WHERE dc.user_id = v_hod_id;

  -- If no criteria found for HOD, return defaults with HOD info
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      75::numeric, 40::numeric, 10000::numeric, 100::numeric, 100000::numeric, 100::numeric, 7::numeric, 3::integer,
      0.3::numeric, 0.25::numeric, 0.25::numeric, 0.2::numeric, v_hod_name, true, false;
  END IF;
END;
$$;