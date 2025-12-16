-- Add assignment_weightage to dropout_criteria for including assignments in risk calculation
ALTER TABLE public.dropout_criteria
ADD COLUMN assignment_weightage numeric NOT NULL DEFAULT 0;