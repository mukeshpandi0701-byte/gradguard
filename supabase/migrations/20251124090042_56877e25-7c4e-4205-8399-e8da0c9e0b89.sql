-- Create download history table
CREATE TABLE public.download_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  report_name TEXT NOT NULL,
  file_size BIGINT,
  download_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own download history" 
ON public.download_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own download history" 
ON public.download_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own download history" 
ON public.download_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_download_history_user_id ON public.download_history(user_id);
CREATE INDEX idx_download_history_download_date ON public.download_history(download_date DESC);