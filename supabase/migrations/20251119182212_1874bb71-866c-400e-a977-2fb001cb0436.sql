-- Create notification_settings table to store Twilio and Resend configuration
CREATE TABLE public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  twilio_sender_name TEXT,
  resend_sender_email TEXT NOT NULL,
  resend_sender_name TEXT,
  sms_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own notification settings" 
ON public.notification_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification settings" 
ON public.notification_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings" 
ON public.notification_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification settings" 
ON public.notification_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();