import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  studentIds: string[];
  message: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { studentIds, message }: NotificationRequest = await req.json();

    if (!studentIds || studentIds.length === 0) {
      throw new Error("No students selected");
    }

    // Get user from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Fetch student details
    const { data: students, error: fetchError } = await supabase
      .from("students")
      .select("student_name, email")
      .in("id", studentIds)
      .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    const results = {
      email: { success: 0, failed: 0, errors: [] as string[] },
    };

    // Fetch user's notification settings
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("resend_sender_email, resend_sender_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Send email notifications
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const senderEmail = settings?.resend_sender_email || "onboarding@resend.dev";
      const senderName = settings?.resend_sender_name || "Student Alert System";

      for (const student of students || []) {
        if (!student.email) {
          results.email.failed++;
          results.email.errors.push(`${student.student_name}: No email address`);
          continue;
        }

        try {
          await resend.emails.send({
            from: `${senderName} <${senderEmail}>`,
            to: [student.email],
            subject: "Important Update About Your Academic Progress",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Hi ${student.student_name},</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #555;">${message}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 14px; color: #888;">
                  Please contact your tutor if you have any questions.
                </p>
                <p style="font-size: 14px; color: #888;">Best regards,<br/>Academic Team</p>
              </div>
            `,
          });
          results.email.success++;
          console.log(`Email sent to ${student.student_name}`);
        } catch (error: any) {
          results.email.failed++;
          results.email.errors.push(`${student.student_name}: ${error.message}`);
          console.error(`Failed to send email to ${student.student_name}:`, error);
        }
      }
    } else {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    return new Response(
      JSON.stringify({
        results,
        message: `Sent ${results.email.success} emails`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
