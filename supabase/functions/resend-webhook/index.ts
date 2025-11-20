import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ResendWebhookEvent {
  type: string; // email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.delivery_delayed
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const event: ResendWebhookEvent = await req.json();

    console.log("Received Resend webhook event:", event.type, "for email:", event.data.email_id);

    // Map event type to status and timestamp field
    let status: string | null = null;
    let timestampField: string | null = null;

    switch (event.type) {
      case "email.sent":
        status = "sent";
        timestampField = "sent_at";
        break;
      case "email.delivered":
        status = "delivered";
        timestampField = "delivered_at";
        break;
      case "email.opened":
        status = "opened";
        timestampField = "opened_at";
        break;
      case "email.clicked":
        status = "clicked";
        timestampField = "clicked_at";
        break;
      case "email.bounced":
        status = "bounced";
        timestampField = "bounced_at";
        break;
      case "email.delivery_delayed":
      case "email.complained":
        status = "failed";
        timestampField = "failed_at";
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Update notification log
    if (status && timestampField) {
      const updateData: any = {
        status,
        [timestampField]: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("notification_logs")
        .update(updateData)
        .eq("resend_email_id", event.data.email_id);

      if (error) {
        console.error("Error updating notification log:", error);
        throw error;
      }

      console.log(`✓ Updated notification log for email ${event.data.email_id} to status: ${status}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in resend-webhook function:", error);
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
