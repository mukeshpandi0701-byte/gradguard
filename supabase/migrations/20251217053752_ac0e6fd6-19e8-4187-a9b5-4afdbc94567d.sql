-- Create academic calendar table for holidays and custom session hours
CREATE TABLE public.academic_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'custom_sessions')),
  description TEXT,
  custom_sessions INTEGER CHECK (custom_sessions IS NULL OR (custom_sessions >= 0 AND custom_sessions <= 10)),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department, event_date)
);

-- Enable RLS
ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;

-- HODs can manage calendar events for their department
CREATE POLICY "HODs can manage their department calendar"
ON public.academic_calendar
FOR ALL
USING (
  has_role(auth.uid(), 'hod'::app_role) 
  AND department = get_user_department(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'hod'::app_role) 
  AND department = get_user_department(auth.uid())
);

-- Staff can view calendar events for their department
CREATE POLICY "Staff can view their department calendar"
ON public.academic_calendar
FOR SELECT
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  AND department = get_user_department(auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_academic_calendar_updated_at
BEFORE UPDATE ON public.academic_calendar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();