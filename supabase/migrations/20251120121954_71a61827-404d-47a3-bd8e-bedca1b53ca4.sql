-- Add GitHub and LinkedIn URLs to profiles table
ALTER TABLE public.profiles
ADD COLUMN github_url text,
ADD COLUMN linkedin_url text;