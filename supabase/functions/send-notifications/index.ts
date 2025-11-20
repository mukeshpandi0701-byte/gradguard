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

    // Fetch student details with risk levels
    const { data: students, error: fetchError } = await supabase
      .from("students")
      .select(`
        student_name, 
        email,
        predictions(final_risk_level)
      `)
      .in("id", studentIds)
      .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    const results = {
      email: { success: 0, failed: 0, errors: [] as string[] },
    };

    // Fetch user's profile for sender info
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Send email notifications
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const senderName = profile?.full_name || "Academic Team";

      for (const student of students || []) {
        if (!student.email) {
          results.email.failed++;
          results.email.errors.push(`${student.student_name}: No email address`);
          continue;
        }

        const riskLevel = (student as any).predictions?.[0]?.final_risk_level || "unknown";
        const riskColor = riskLevel === "high" ? "#dc2626" : riskLevel === "medium" ? "#f59e0b" : "#10b981";
        const riskBg = riskLevel === "high" ? "#fee2e2" : riskLevel === "medium" ? "#fef3c7" : "#d1fae5";

        try {
          await resend.emails.send({
            from: `${senderName} <onboarding@resend.dev>`,
            to: [student.email],
            subject: `Academic Update - ${riskLevel.toUpperCase()} Risk Alert`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .content { background: #f9f9f9; padding: 30px; }
                    .risk-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 15px 0; background: ${riskBg}; color: ${riskColor}; }
                    .message { white-space: pre-wrap; margin: 20px 0; padding: 20px; background: white; border-left: 4px solid #667eea; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f0f0f0; }
                    h1 { margin: 0; font-size: 24px; }
                    h2 { color: #333; margin-top: 0; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>Student Dropout Prevention System</h1>
                      <p style="margin: 5px 0 0 0;">Academic Update Notification</p>
                    </div>
                    <div class="content">
                      <h2>Dear ${student.student_name},</h2>
                      <p>Your current academic risk level: 
                        <span class="risk-badge">${riskLevel.toUpperCase()} RISK</span>
                      </p>
                      <div class="message">${message}</div>
                      <p style="margin-top: 20px;">If you have any questions or need support, please don't hesitate to reach out to your tutor.</p>
                      <p>Best regards,<br/><strong>${senderName}</strong></p>
                    </div>
                    <div class="footer">
                      <p style="margin: 5px 0;">This is an automated message from the Student Dropout Prevention System</p>
                      <p style="margin: 5px 0;">Reply to: ${profile?.email || "your tutor"}</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
          });
          results.email.success++;
          console.log(`Email sent to ${student.student_name} (${riskLevel} risk)`);
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
