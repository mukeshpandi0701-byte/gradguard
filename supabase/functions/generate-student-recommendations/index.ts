import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecommendationRequest {
  studentId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { studentId }: RecommendationRequest = await req.json();

    if (!studentId) {
      throw new Error("Student ID is required");
    }

    // First try to get student from student_profiles (the ID might be from student_profiles)
    const { data: profileData } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();

    let student;
    
    if (profileData) {
      // Get student data from students table using roll_number
      const { data: studentData } = await supabase
        .from("students")
        .select("*")
        .eq("roll_number", profileData.roll_number)
        .maybeSingle();
      
      student = studentData ? {
        ...studentData,
        student_name: profileData.full_name || studentData.student_name,
      } : {
        id: profileData.id,
        user_id: profileData.user_id,
        student_name: profileData.full_name || profileData.email,
        roll_number: profileData.roll_number,
        attendance_percentage: 0,
        internal_marks: 0,
        fee_paid_percentage: 0,
        pending_fees: 0,
      };
    } else {
      // Fallback: try direct lookup in students table
      const { data: directStudent, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();

      if (studentError) throw studentError;
      student = directStudent;
    }

    if (!student) {
      throw new Error("Student not found");
    }

    // Get current prediction with insights (use maybeSingle to avoid error when no prediction exists)
    const { data: prediction } = await supabase
      .from("predictions")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get dropout criteria for context (use maybeSingle as criteria might not exist)
    const { data: criteria } = await supabase
      .from("dropout_criteria")
      .select("*")
      .eq("user_id", student.user_id)
      .maybeSingle();

    const recommendationPrompt = `You are an expert educational counselor AI. Generate personalized, actionable improvement recommendations for the following student.

Student Profile:
- Name: ${student.student_name}
- Attendance: ${student.attendance_percentage}% (Target: ${criteria?.min_attendance_percentage || 75}%)
- Internal Marks: ${student.internal_marks} (Min Required: ${criteria?.min_internal_marks || 40})
- Fee Paid: ${student.fee_paid_percentage}%
- Pending Fees: Rs. ${student.pending_fees}
- Current Risk Level: ${prediction?.final_risk_level || "unknown"}
- ML Dropout Probability: ${((prediction?.ml_probability || 0) * 100).toFixed(1)}%

Current AI Insights: ${prediction?.insights || "No insights available"}

Task:
Generate specific, actionable recommendations tailored to this student's situation. Focus on:
1. Immediate actions (next 1-2 weeks)
2. Short-term goals (1 month)
3. Long-term strategies (3 months)
4. Specific resources or support they might need

Format your response as JSON with this structure:
{
  "immediateActions": [
    {
      "priority": "High/Medium/Low",
      "action": "specific action",
      "reason": "why this matters",
      "expectedImpact": "what will improve"
    }
  ],
  "shortTermGoals": [
    {
      "goal": "specific measurable goal",
      "timeframe": "deadline",
      "steps": ["step 1", "step 2", "..."],
      "successMetric": "how to measure success"
    }
  ],
  "longTermStrategies": [
    {
      "strategy": "broader strategy",
      "description": "detailed explanation",
      "milestones": ["milestone 1", "milestone 2"]
    }
  ],
  "supportNeeded": {
    "academic": ["list of academic support needed"],
    "financial": ["list of financial support options"],
    "personal": ["list of personal/counseling support"]
  },
  "motivationalMessage": "2-3 sentences of encouragement",
  "keyFocusAreas": ["area 1", "area 2", "area 3"]
}`;

    console.log("Sending request to AI for recommendations");

    // Call Lovable AI for recommendations
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert educational counselor specialized in student success and dropout prevention. Always respond with valid JSON only, no markdown formatting or code blocks."
          },
          {
            role: "user",
            content: recommendationPrompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const recommendationsText = aiData.choices?.[0]?.message?.content;

    if (!recommendationsText) {
      throw new Error("No recommendations received from AI");
    }

    console.log("AI Recommendations received:", recommendationsText);

    // Parse JSON response, removing markdown code blocks if present
    let recommendations;
    try {
      const cleanedText = recommendationsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      recommendations = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", recommendationsText);
      throw new Error("Failed to parse AI recommendations");
    }

    // Update the prediction with new AI-generated suggestions
    if (prediction) {
      const suggestionsText = JSON.stringify(recommendations, null, 2);
      await supabase
        .from("predictions")
        .update({ suggestions: suggestionsText })
        .eq("id", prediction.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        studentName: student.student_name,
        recommendations,
        riskLevel: prediction?.final_risk_level,
        generatedAt: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in generate-student-recommendations:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate recommendations",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
