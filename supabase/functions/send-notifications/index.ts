import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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

    // Send email notifications
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const senderName = profile?.full_name || "Academic Team";
      const tutorEmail = profile?.email || "";
      
      console.log(`Sending emails from ${senderName}, CC to tutor: ${tutorEmail || 'none'}`);

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

        // Generate PDF report
        const pdf = new jsPDF();
        pdf.setFontSize(20);
        pdf.text("Student Progress Report", 20, 20);
        
        pdf.setFontSize(12);
        pdf.text(`Student Name: ${student.student_name}`, 20, 40);
        pdf.text(`Risk Level: ${riskLevel.toUpperCase()}`, 20, 50);
        pdf.text(`Dropout Probability: ${mlProbability}%`, 20, 60);
        
        pdf.setFontSize(14);
        pdf.text("Performance Metrics:", 20, 80);
        pdf.setFontSize(11);
        pdf.text(`Attendance: ${attendancePercentage}%`, 30, 90);
        pdf.text(`Internal Marks: ${internalMarks}`, 30, 100);
        pdf.text(`Fee Paid: ${feePaidPercentage}%`, 30, 110);
        pdf.text(`Pending Fees: ₹${pendingFees}`, 30, 120);
        
        if (insights) {
          pdf.setFontSize(14);
          pdf.text("Insights:", 20, 140);
          pdf.setFontSize(10);
          const insightLines = pdf.splitTextToSize(insights, 170);
          pdf.text(insightLines, 30, 150);
        }
        
        if (suggestions) {
          pdf.setFontSize(14);
          pdf.text("Recommendations:", 20, 180);
          pdf.setFontSize(10);
          const suggestionLines = pdf.splitTextToSize(suggestions, 170);
          pdf.text(suggestionLines, 30, 190);
        }
        
        const pdfBuffer = pdf.output("arraybuffer");
        const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

        try {
          // Prepare email recipients - CC tutor if email exists
          const emailTo = [student.email];
          const emailCc = tutorEmail ? [tutorEmail] : undefined;

          const emailResponse = await resend.emails.send({
            from: `${senderName} <onboarding@resend.dev>`,
            to: emailTo,
            cc: emailCc,
            subject: `Academic Update - ${riskLevel.toUpperCase()} Risk Alert`,
            attachments: [
              {
                filename: `${student.student_name.replace(/\s+/g, '_')}_report.pdf`,
                content: pdfBase64,
              },
            ],
            html: `
              <!DOCTYPE html>
              <html>
...
              </html>
            `,
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
              resend_email_id: emailResponse?.data?.id || null,
            });
          
          if (logError) {
            console.error(`Failed to log notification for ${student.student_name}:`, logError);
          }
          
          results.email.success++;
          console.log(`✓ Email sent to ${student.student_name} (${student.email}), Risk: ${riskLevel}, Email ID: ${emailResponse?.data?.id}`);
        } catch (error: any) {
          results.email.failed++;
          results.email.errors.push(`${student.student_name}: ${error.message}`);
          console.error(`Failed to send email to ${student.student_name}:`, error);
        }
      }
    } else {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured - RESEND_API_KEY missing");
    }

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
