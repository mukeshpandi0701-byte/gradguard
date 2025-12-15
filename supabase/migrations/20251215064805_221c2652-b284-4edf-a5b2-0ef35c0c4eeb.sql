-- Add RLS policy to allow HODs to view all predictions
CREATE POLICY "HODs can view all predictions" 
ON public.predictions 
FOR SELECT 
USING (has_role(auth.uid(), 'hod'::app_role));