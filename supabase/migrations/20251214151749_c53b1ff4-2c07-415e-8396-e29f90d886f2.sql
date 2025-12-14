-- Add max_sessions_per_day to dropout_criteria table
ALTER TABLE public.dropout_criteria 
ADD COLUMN max_sessions_per_day numeric NOT NULL DEFAULT 2;