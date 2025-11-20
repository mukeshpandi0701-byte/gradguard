-- Create notification logs table for tracking email delivery and engagement
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, opened, clicked, bounced, failed
  resend_email_id TEXT, -- ID from Resend for tracking
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification logs"
  ON public.notification_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification logs"
  ON public.notification_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update notification logs"
  ON public.notification_logs
  FOR UPDATE
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX idx_notification_logs_student_id ON public.notification_logs(student_id);
CREATE INDEX idx_notification_logs_resend_email_id ON public.notification_logs(resend_email_id);
CREATE INDEX idx_notification_logs_status ON public.notification_logs(status);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_logs_updated_at
  BEFORE UPDATE ON public.notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();