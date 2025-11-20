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

    // Fetch student details with risk levels and historical data
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

    // Fetch historical data for all students at once
    const { data: allHistory, error: historyError } = await supabase
      .from("student_history")
      .select("*")
      .in("student_id", studentIds)
      .order("recorded_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching student history:", historyError);
    }

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

        // Get historical data for this student
        const studentHistory = (allHistory || []).filter(h => h.student_id === (student as any).id);
        
        // Helper function to draw line chart
        const drawLineChart = (
          pdf: any,
          x: number,
          y: number,
          width: number,
          height: number,
          data: number[],
          title: string,
          color: string,
          maxValue: number
        ) => {
          // Draw chart background
          pdf.setFillColor(249, 250, 251);
          pdf.rect(x, y, width, height, 'F');
          
          // Draw border
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(x, y, width, height);
          
          // Draw title
          pdf.setFontSize(10);
          pdf.setTextColor(55, 65, 81);
          pdf.text(title, x + 5, y - 3);
          
          if (data.length < 2) {
            pdf.setFontSize(8);
            pdf.setTextColor(156, 163, 175);
            pdf.text("Insufficient data", x + width / 2, y + height / 2, { align: 'center' });
            return;
          }
          
          // Draw grid lines
          pdf.setDrawColor(229, 231, 235);
          pdf.setLineWidth(0.1);
          for (let i = 0; i <= 4; i++) {
            const gridY = y + (height * i / 4);
            pdf.line(x, gridY, x + width, gridY);
          }
          
          // Calculate points
          const points = data.map((value, index) => ({
            x: x + (width * index / (data.length - 1)),
            y: y + height - (height * (value / maxValue))
          }));
          
          // Draw line
          pdf.setDrawColor(color);
          pdf.setLineWidth(1);
          for (let i = 0; i < points.length - 1; i++) {
            pdf.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
          }
          
          // Draw points
          pdf.setFillColor(color);
          points.forEach(point => {
            pdf.circle(point.x, point.y, 1.5, 'F');
          });
          
          // Draw max value label
          pdf.setFontSize(7);
          pdf.setTextColor(107, 114, 128);
          pdf.text(`${maxValue}`, x - 8, y + 2);
          pdf.text('0', x - 5, y + height + 2);
        };

        // Generate PDF report
        const pdf = new jsPDF();
        
        // Header
        pdf.setFillColor(102, 126, 234);
        pdf.rect(0, 0, 210, 35, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(22);
        pdf.text("Student Progress Report", 105, 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 25, { align: 'center' });
        
        // Student Info Section
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(16);
        pdf.text(`${student.student_name}`, 20, 45);
        
        // Risk Badge
        const riskColors: { [key: string]: [number, number, number] } = {
          high: [220, 38, 38],
          medium: [245, 158, 11],
          low: [16, 185, 129]
        };
        const [r, g, b] = riskColors[riskLevel] || [156, 163, 175];
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(20, 50, 35, 8, 2, 2, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.text(`${riskLevel.toUpperCase()} RISK`, 37.5, 55.5, { align: 'center' });
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.text(`Dropout Probability: ${mlProbability}%`, 60, 55);
        
        // Current Performance Metrics
        pdf.setFontSize(14);
        pdf.setTextColor(102, 126, 234);
        pdf.text("Current Performance", 20, 70);
        
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        const metrics = [
          [`Attendance:`, `${attendancePercentage}%`],
          [`Internal Marks:`, `${internalMarks}`],
          [`Fee Paid:`, `${feePaidPercentage}%`],
          [`Pending Fees:`, `₹${pendingFees}`]
        ];
        
        let yPos = 80;
        metrics.forEach(([label, value]) => {
          pdf.setTextColor(75, 85, 99);
          pdf.text(label, 25, yPos);
          pdf.setTextColor(0, 0, 0);
          pdf.text(value, 100, yPos);
          yPos += 7;
        });
        
        // Performance Trends Section
        if (studentHistory.length >= 2) {
          pdf.setFontSize(14);
          pdf.setTextColor(102, 126, 234);
          pdf.text("Performance Trends Over Time", 20, 115);
          
          const attendanceData = studentHistory.map(h => h.attendance_percentage || 0);
          const marksData = studentHistory.map(h => h.internal_marks || 0);
          const feesData = studentHistory.map(h => h.fee_paid_percentage || 0);
          
          // Draw three charts in a row
          drawLineChart(pdf, 15, 125, 60, 35, attendanceData, "Attendance %", "59, 130, 246", 100);
          drawLineChart(pdf, 80, 125, 60, 35, marksData, "Internal Marks", "168, 85, 247", 100);
          drawLineChart(pdf, 145, 125, 60, 35, feesData, "Fee Paid %", "34, 197, 94", 100);
          
          yPos = 170;
        } else {
          yPos = 115;
        }
        
        // Insights Section
        if (insights) {
          pdf.setFillColor(240, 249, 255);
          pdf.roundedRect(15, yPos, 180, 25, 2, 2, 'F');
          pdf.setDrawColor(59, 130, 246);
          pdf.setLineWidth(0.5);
          pdf.line(15, yPos, 15, yPos + 25);
          
          pdf.setFontSize(12);
          pdf.setTextColor(30, 64, 175);
          pdf.text("📊 Insights", 20, yPos + 7);
          pdf.setFontSize(9);
          pdf.setTextColor(30, 58, 138);
          const insightLines = pdf.splitTextToSize(insights, 170);
          pdf.text(insightLines, 20, yPos + 14);
          yPos += 30;
        }
        
        // Recommendations Section
        if (suggestions) {
          pdf.setFillColor(240, 253, 244);
          pdf.roundedRect(15, yPos, 180, 25, 2, 2, 'F');
          pdf.setDrawColor(16, 185, 129);
          pdf.setLineWidth(0.5);
          pdf.line(15, yPos, 15, yPos + 25);
          
          pdf.setFontSize(12);
          pdf.setTextColor(4, 120, 87);
          pdf.text("💡 Recommendations", 20, yPos + 7);
          pdf.setFontSize(9);
          pdf.setTextColor(6, 95, 70);
          const suggestionLines = pdf.splitTextToSize(suggestions, 170);
          pdf.text(suggestionLines, 20, yPos + 14);
          yPos += 30;
        }
        
        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text("Student Dropout Prevention System", 105, 285, { align: 'center' });
        pdf.text(`Contact: ${profile?.email || "your tutor"}`, 105, 290, { align: 'center' });
        
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
