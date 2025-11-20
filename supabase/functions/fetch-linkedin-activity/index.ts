import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { linkedinUrl } = await req.json();

    if (!linkedinUrl) {
      throw new Error("LinkedIn URL is required");
    }

    // Note: LinkedIn's API requires OAuth and has strict rate limits
    // For now, we'll return mock data as a placeholder
    // In production, you would need to:
    // 1. Set up LinkedIn OAuth app
    // 2. Get user authorization
    // 3. Use LinkedIn's API with proper tokens
    
    // Mock data for demonstration
    const mockActivity = {
      connectionCount: Math.floor(Math.random() * 500) + 50,
      recentPosts: Math.floor(Math.random() * 10),
      lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      profileViews: Math.floor(Math.random() * 100) + 10,
    };

    return new Response(
      JSON.stringify(mockActivity),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching LinkedIn activity:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
