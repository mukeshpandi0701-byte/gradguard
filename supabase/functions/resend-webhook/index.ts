import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Webhook } from "https://esm.sh/svix@1.61.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

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
    // Verify webhook signature
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("Missing svix headers for webhook verification");
      return new Response(
        JSON.stringify({ error: "Missing webhook signature headers" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for replay attacks - reject requests older than 5 minutes
    const timestampSeconds = parseInt(svixTimestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(currentSeconds - timestampSeconds) > 300) {
      console.error("Webhook timestamp is too old, possible replay attack");
      return new Response(
        JSON.stringify({ error: "Webhook timestamp is too old" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the raw body for signature verification
    const payload = await req.text();

    // Verify the webhook signature using Svix
    const wh = new Webhook(webhookSecret);
    let event: ResendWebhookEvent;
    
    try {
      event = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ResendWebhookEvent;
    } catch (verifyError) {
      console.error("Webhook signature verification failed:", verifyError);
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Verified Resend webhook event:", event.type, "for email:", event.data.email_id);

    const supabase = createClient(supabaseUrl, supabaseKey);

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
      const updateData: Record<string, string> = {
        status,
        [timestampField]: new Date().toISOString(),
      };

      const { error } = await supabase
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in resend-webhook function:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
