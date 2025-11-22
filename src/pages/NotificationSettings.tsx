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
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          resendSenderEmail: data.resend_sender_email || "",
          resendSenderName: data.resend_sender_name || "",
        });
      }
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

      // Check if settings exist
      const { data: existing } = await supabase
        .from("notification_settings")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const settingsData = {
        user_id: session.user.id,
        resend_sender_email: settings.resendSenderEmail,
        resend_sender_name: settings.resendSenderName || null,
      };

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from("notification_settings")
          .update(settingsData)
          .eq("user_id", session.user.id);

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from("notification_settings")
          .insert(settingsData);

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
            <CardTitle>Email Configuration (Resend)</CardTitle>
            <CardDescription>
              Configure email sending settings. You need to verify your domain in Resend dashboard first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resendSenderName">Sender Name</Label>
              <Input
                id="resendSenderName"
                placeholder="e.g., College Alerts"
                value={settings.resendSenderName}
                onChange={(e) => setSettings({ ...settings, resendSenderName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resendSenderEmail">Sender Email *</Label>
              <Input
                id="resendSenderEmail"
                type="email"
                placeholder="e.g., alerts@yourcollege.edu"
                value={settings.resendSenderEmail}
                onChange={(e) => setSettings({ ...settings, resendSenderEmail: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be from a verified domain in your Resend account
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
