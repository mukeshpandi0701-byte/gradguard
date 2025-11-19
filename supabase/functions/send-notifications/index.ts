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
  sendSMS: boolean;
  sendEmail: boolean;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
const resendApiKey = Deno.env.get("RESEND_API_KEY");

// Normalize phone numbers to E.164 format (Indian numbers by default)
const normalizePhoneNumber = (rawPhone: string | null): string | null => {
  if (!rawPhone) return null;

  // Remove spaces, parentheses, hyphens
  let digits = rawPhone.replace(/[\s()-]/g, "");

  // If it starts with '+', assume it's already in E.164 format
  if (digits.startsWith("+")) {
    return digits;
  }

  // Remove leading country code patterns like '91' or leading '0'
  if (digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // At this point we expect a 10-digit Indian mobile number
  if (digits.length !== 10) {
    console.error("Invalid phone number after normalization:", rawPhone, "->", digits);
    return null;
  }

  return `+91${digits}`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { studentIds, message, sendSMS, sendEmail }: NotificationRequest = await req.json();

    if (!studentIds || studentIds.length === 0) {
      throw new Error("No students selected");
    }

    // Fetch student details
    const { data: students, error: fetchError } = await supabase
      .from("students")
      .select("student_name, email, phone_number")
      .in("id", studentIds);

    if (fetchError) throw fetchError;

    const results = {
      sms: { success: 0, failed: 0, errors: [] as string[] },
      email: { success: 0, failed: 0, errors: [] as string[] },
    };

    // Send SMS notifications
    if (sendSMS && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      for (const student of students || []) {
        if (!student.phone_number) {
          results.sms.failed++;
          results.sms.errors.push(`${student.student_name}: No phone number`);
          continue;
        }

        try {
          // Normalize phone number to international format
          const formattedPhone = normalizePhoneNumber(student.phone_number);

          if (!formattedPhone) {
            results.sms.failed++;
            results.sms.errors.push(`${student.student_name}: Invalid phone number format (${student.phone_number || "missing"})`);
            continue;
          }

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const formData = new URLSearchParams({
            To: formattedPhone,
            From: twilioPhoneNumber,
            Body: `Hi ${student.student_name}, ${message}`,
          });

          const twilioResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
          });

          if (twilioResponse.ok) {
            results.sms.success++;
            console.log(`SMS sent to ${student.student_name}`);
          } else {
            const error = await twilioResponse.text();
            results.sms.failed++;
            results.sms.errors.push(`${student.student_name}: ${error}`);
            console.error(`Failed to send SMS to ${student.student_name}:`, error);
          }
        } catch (error: any) {
          results.sms.failed++;
          results.sms.errors.push(`${student.student_name}: ${error.message}`);
          console.error(`Error sending SMS to ${student.student_name}:`, error);
        }
      }
    }

    // Send email notifications
    if (sendEmail && resendApiKey) {
      const resend = new Resend(resendApiKey);

      for (const student of students || []) {
        if (!student.email) {
          results.email.failed++;
          results.email.errors.push(`${student.student_name}: No email address`);
          continue;
        }

        try {
          await resend.emails.send({
            from: "Student Alerts <onboarding@resend.dev>",
            to: [student.email],
            subject: "Important Update About Your Academic Progress",
            html: `
              <h2>Hi ${student.student_name},</h2>
              <p>${message}</p>
              <br/>
              <p>Please contact your tutor if you have any questions.</p>
              <p>Best regards,<br/>Academic Team</p>
            `,
          });

          results.email.success++;
          console.log(`Email sent to ${student.student_name}`);
        } catch (error: any) {
          results.email.failed++;
          results.email.errors.push(`${student.student_name}: ${error.message}`);
          console.error(`Error sending email to ${student.student_name}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Sent ${results.sms.success} SMS and ${results.email.success} emails`,
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
