import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl } = await req.json();

    if (!githubUrl) {
      throw new Error("GitHub URL is required");
    }

    // Extract username from GitHub URL
    const username = githubUrl.split("github.com/")[1]?.split("/")[0];
    if (!username) {
      throw new Error("Invalid GitHub URL");
    }

    // Fetch user data from GitHub API
    const userResponse = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Lovable-Student-Tracker",
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch GitHub user data");
    }

    const userData = await userResponse.json();

    // Fetch user's events (activity)
    const eventsResponse = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Lovable-Student-Tracker",
      },
    });

    if (!eventsResponse.ok) {
      throw new Error("Failed to fetch GitHub events");
    }

    const events = await eventsResponse.json();

    // Calculate activity metrics
    const pushEvents = events.filter((e: any) => e.type === "PushEvent");
    const totalCommits = pushEvents.reduce((sum: number, event: any) => {
      return sum + (event.payload?.commits?.length || 0);
    }, 0);

    const recentRepos = [...new Set(
      events
        .filter((e: any) => e.type === "PushEvent")
        .map((e: any) => e.repo.name)
        .slice(0, 5)
    )];

    const lastActivity = events.length > 0 ? events[0].created_at : userData.updated_at;

    return new Response(
      JSON.stringify({
        totalCommits,
        recentRepos,
        lastActivity,
        publicRepos: userData.public_repos || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching GitHub activity:", error);
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
