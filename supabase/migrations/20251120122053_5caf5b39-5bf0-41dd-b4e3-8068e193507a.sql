-- Add GitHub and LinkedIn URLs to students table
ALTER TABLE public.students
ADD COLUMN github_url text,
ADD COLUMN linkedin_url text;