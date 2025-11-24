import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    resendSenderEmail: "",
    resendSenderName: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    await fetchSettings(session.user.id);
  };

  const fetchSettings = async (userId: string) => {
    try {
      // Fetch notification settings
      const { data: notifData, error: notifError } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (notifError && notifError.code !== "PGRST116") {
        throw notifError;
      }

      // Fetch email SMTP settings
      const { data: emailData, error: emailError } = await supabase
        .from("institution_email_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (emailError && emailError.code !== "PGRST116") {
        throw emailError;
      }

      setSettings({
        resendSenderEmail: notifData?.resend_sender_email || "",
        resendSenderName: notifData?.resend_sender_name || "",
        smtpHost: emailData?.smtp_host || "smtp.gmail.com",
        smtpPort: String(emailData?.smtp_port || "587"),
        smtpUser: emailData?.smtp_user || "",
        smtpPassword: emailData?.smtp_password || "",
      });
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      if (!settings.resendSenderEmail) {
        toast.error("Sender email is required");
        setSaving(false);
        return;
      }

      if (!settings.smtpUser || !settings.smtpPassword) {
        toast.error("SMTP credentials are required");
        setSaving(false);
        return;
      }

      // Check if notification settings exist
      const { data: existingNotif } = await supabase
        .from("notification_settings")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const notifData = {
        user_id: session.user.id,
        resend_sender_email: settings.resendSenderEmail,
        resend_sender_name: settings.resendSenderName || null,
      };

      if (existingNotif) {
        const { error } = await supabase
          .from("notification_settings")
          .update(notifData)
          .eq("user_id", session.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_settings")
          .insert(notifData);
        if (error) throw error;
      }

      // Check if email settings exist
      const { data: existingEmail } = await supabase
        .from("institution_email_settings")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const emailData = {
        user_id: session.user.id,
        smtp_host: settings.smtpHost,
        smtp_port: parseInt(settings.smtpPort),
        smtp_user: settings.smtpUser,
        smtp_password: settings.smtpPassword,
        sender_name: settings.resendSenderName || "Academic Team",
        sender_email: settings.resendSenderEmail,
        is_active: true,
      };

      if (existingEmail) {
        const { error } = await supabase
          .from("institution_email_settings")
          .update(emailData)
          .eq("user_id", session.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("institution_email_settings")
          .insert(emailData);
        if (error) throw error;
      }

      toast.success("Settings saved successfully");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h1 className="text-3xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your email notification settings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SMTP Email Configuration</CardTitle>
            <CardDescription>
              Configure your institution's email server settings. These credentials are stored securely and used only for sending notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP Host *</Label>
                <Input
                  id="smtpHost"
                  placeholder="e.g., smtp.gmail.com"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">SMTP Port *</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  placeholder="e.g., 587"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpUser">SMTP Username/Email *</Label>
              <Input
                id="smtpUser"
                type="email"
                placeholder="e.g., notifications@yourcollege.edu"
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">SMTP Password/App Password *</Label>
              <Input
                id="smtpPassword"
                type="password"
                placeholder="Your SMTP password or app-specific password"
                value={settings.smtpPassword}
                onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                For Gmail: Use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">App Password</a> instead of your regular password
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resendSenderName">Sender Display Name</Label>
              <Input
                id="resendSenderName"
                placeholder="e.g., College Academic Team"
                value={settings.resendSenderName}
                onChange={(e) => setSettings({ ...settings, resendSenderName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resendSenderEmail">Sender Email Address *</Label>
              <Input
                id="resendSenderEmail"
                type="email"
                placeholder="e.g., alerts@yourcollege.edu"
                value={settings.resendSenderEmail}
                onChange={(e) => setSettings({ ...settings, resendSenderEmail: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                This email will appear in the "From" field of notifications
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
