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

    console.log(`Fetching LinkedIn activity for: ${linkedinUrl}`);

    // IMPORTANT: LinkedIn's API requires OAuth 2.0 and approved API access
    // Without proper OAuth setup and LinkedIn API credentials, we cannot fetch real data
    // This returns estimated activity data for demonstration purposes
    
    // To enable real LinkedIn data fetching, you would need to:
    // 1. Create a LinkedIn Developer App at https://www.linkedin.com/developers/
    // 2. Get OAuth 2.0 credentials
    // 3. Implement OAuth flow for user authorization
    // 4. Use LinkedIn's official API endpoints
    
    console.warn("LinkedIn API not configured - returning mock activity data");
    
    // Generate consistent mock data based on URL to simulate activity
    const urlHash = linkedinUrl.split("").reduce((a: number, b: string) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const seed = Math.abs(urlHash);
    const mockActivity = {
      connectionCount: 50 + (seed % 450),
      recentPosts: seed % 10,
      lastActivity: new Date(Date.now() - (seed % 30) * 24 * 60 * 60 * 1000).toISOString(),
      profileViews: 10 + (seed % 90),
    };

    console.log("Mock LinkedIn activity:", mockActivity);

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
