import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    // Fetch institution's email settings
    const { data: emailSettings, error: settingsError } = await supabase
      .from("institution_email_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (settingsError || !emailSettings) {
      throw new Error("Email settings not configured. Please configure SMTP settings in Notification Settings.");
    }

    // Fetch student details with risk levels
    const { data: students, error: fetchError } = await supabase
      .from("students")
      .select(`
        id,
        student_name, 
        email,
        attendance_percentage,
        internal_marks,
        fee_paid_percentage,
        pending_fees,
        predictions(
          final_risk_level,
          ml_probability,
          insights,
          suggestions
        )
      `)
      .in("id", studentIds)
      .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    console.log(`Found ${students?.length || 0} students to notify`);

    const results = {
      email: { success: 0, failed: 0, errors: [] as string[] },
    };

    // Fetch user's profile for sender info
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Send email notifications using institution's SMTP settings
    const client = new SMTPClient({
      connection: {
        hostname: emailSettings.smtp_host,
        port: emailSettings.smtp_port,
        tls: emailSettings.smtp_port === 465,
        auth: {
          username: emailSettings.smtp_user,
          password: emailSettings.smtp_password,
        },
      },
    });

    const senderName = emailSettings.sender_name || "Academic Team";
    const tutorEmail = profile?.email || "";
    
    console.log(`Sending emails from ${senderName} (${emailSettings.sender_email}), CC to tutor: ${tutorEmail || 'none'}`);

    for (const student of students || []) {
      if (!student.email) {
        results.email.failed++;
        results.email.errors.push(`${student.student_name}: No email address`);
        continue;
      }

      const riskLevel = (student as any).predictions?.[0]?.final_risk_level || "unknown";
      const riskColor = riskLevel === "high" ? "#dc2626" : riskLevel === "medium" ? "#f59e0b" : "#10b981";
      const riskBg = riskLevel === "high" ? "#fee2e2" : riskLevel === "medium" ? "#fef3c7" : "#d1fae5";

      // Get detailed student data
      const studentData = (student as any);
      const attendancePercentage = studentData.attendance_percentage?.toFixed(1) || "N/A";
      const internalMarks = studentData.internal_marks || "N/A";
      const feePaidPercentage = studentData.fee_paid_percentage?.toFixed(1) || "N/A";
      const pendingFees = studentData.pending_fees || 0;
      const mlProbability = studentData.predictions?.[0]?.ml_probability?.toFixed(1) || "N/A";
      const insights = studentData.predictions?.[0]?.insights || "";
      const suggestions = studentData.predictions?.[0]?.suggestions || "";

      // Add call-to-action for Medium and High Risk students
      const needsTutorMeeting = riskLevel === "medium" || riskLevel === "high";
      const tutorMeetingMessage = needsTutorMeeting 
        ? `
<div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; text-align: center;">
  <h3 style="color: #92400e; margin-top: 0;">📅 Action Required</h3>
  <p style="color: #78350f; margin: 10px 0; font-size: 16px; font-weight: 600;">Meet Your Tutor</p>
  <p style="color: #78350f; margin: 10px 0;">Please schedule a meeting with your tutor to discuss your progress and receive personalized guidance.</p>
</div>`
        : "";

      const emailHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${riskColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; }
    .stats { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid ${riskColor}; }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .badge { display: inline-block; padding: 8px 16px; background: ${riskBg}; color: ${riskColor}; border-radius: 20px; font-weight: bold; }
    .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 Academic Performance Update</h1>
      <p style="margin: 0">Student Progress Report</p>
    </div>
    <div class="content">
      <h2>Hello ${student.student_name},</h2>
      <p>${message}</p>
      <div style="margin: 20px 0">
        <strong>Current Risk Level:</strong> <span class="badge">${riskLevel.toUpperCase()} RISK</span>
      </div>
      <div class="stats">
        <h3 style="margin-top: 0; color: ${riskColor}">📊 Your Performance Metrics</h3>
        <div class="stat-row">
          <span><strong>Attendance:</strong></span>
          <span>${attendancePercentage}%</span>
        </div>
        <div class="stat-row">
          <span><strong>Internal Marks:</strong></span>
          <span>${internalMarks}</span>
        </div>
        <div class="stat-row">
          <span><strong>Fee Payment:</strong></span>
          <span>${feePaidPercentage}%</span>
        </div>
        <div class="stat-row">
          <span><strong>Pending Fees:</strong></span>
          <span>₹${pendingFees}</span>
        </div>
        <div class="stat-row" style="border-bottom: none">
          <span><strong>Risk Probability:</strong></span>
          <span>${mlProbability}%</span>
        </div>
      </div>
      ${insights ? `
      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0">
        <h3 style="color: #1976d2; margin-top: 0">💡 Insights</h3>
        <p style="margin: 0">${insights}</p>
      </div>` : ''}
      ${suggestions ? `
      <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0">
        <h3 style="color: #7b1fa2; margin-top: 0">📝 Suggestions for Improvement</h3>
        <p style="margin: 0">${suggestions}</p>
      </div>` : ''}
      ${tutorMeetingMessage}
    </div>
    <div class="footer">
      <p style="margin: 0">This is an automated message from ${senderName}</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8">Please do not reply to this email</p>
    </div>
  </div>
</body>
</html>`;

      try {
        await client.send({
          from: `${senderName} <${emailSettings.sender_email}>`,
          to: student.email,
          cc: tutorEmail || undefined,
          subject: `Academic Update - ${riskLevel.toUpperCase()} Risk Alert`,
          content: "text/html",
          html: emailHTML,
        });
        
        // Log notification to database
        const { error: logError } = await supabase
          .from("notification_logs")
          .insert({
            user_id: user.id,
            student_id: (student as any).id,
            student_email: student.email,
            subject: `Academic Update - ${riskLevel.toUpperCase()} Risk Alert`,
            message: message,
            status: "sent",
            resend_email_id: null,
          });
        
        if (logError) {
          console.error(`Failed to log notification for ${student.student_name}:`, logError);
        }
        
        results.email.success++;
        console.log(`✓ Email sent to ${student.student_name} (${student.email}), Risk: ${riskLevel}`);
      } catch (error: any) {
        results.email.failed++;
        results.email.errors.push(`${student.student_name}: ${error.message}`);
        console.error(`Failed to send email to ${student.student_name}:`, error);
      }
    }
    
    await client.close();

    return new Response(
      JSON.stringify({
        results,
        message: `Successfully sent ${results.email.success} emails${results.email.failed > 0 ? `, ${results.email.failed} failed` : ''}`,
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