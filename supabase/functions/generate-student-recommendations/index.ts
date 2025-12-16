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

    console.log("Generating recommendations for studentId:", studentId);

    // First try to get student from student_profiles (the ID might be from student_profiles)
    const { data: profileData } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();

    let student;
    let studentRecordId = studentId;
    
    if (profileData) {
      console.log("Found profile data for:", profileData.roll_number);
      // Get student data from students table using roll_number
      const { data: studentData } = await supabase
        .from("students")
        .select("*")
        .eq("roll_number", profileData.roll_number)
        .maybeSingle();

      if (studentData?.id) {
        studentRecordId = studentData.id;
        console.log("Using students.id:", studentRecordId);
      }
      
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
      if (directStudent?.id) studentRecordId = directStudent.id;
    }

    if (!student) {
      throw new Error("Student not found");
    }

    // Get current prediction with insights
    const { data: prediction } = await supabase
      .from("predictions")
      .select("*")
      .eq("student_id", studentRecordId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get dropout criteria for context
    const { data: criteria } = await supabase
      .from("dropout_criteria")
      .select("*")
      .eq("user_id", student.user_id)
      .maybeSingle();

    const recommendationPrompt = `You are an expert educational counselor AI. Generate personalized, actionable improvement recommendations for the following student.

Student Profile:
- Name: ${student.student_name}
- Attendance: ${student.attendance_percentage ?? 0}% (Target: ${criteria?.min_attendance_percentage || 75}%)
- Internal Marks: ${student.internal_marks ?? 0} (Min Required: ${criteria?.min_internal_marks || 40})
- Fee Paid: ${student.fee_paid_percentage ?? 0}%
- Pending Fees: Rs. ${student.pending_fees ?? 0}
- Current Risk Level: ${prediction?.final_risk_level || "unknown"}
- ML Dropout Probability: ${((prediction?.ml_probability || 0) * 100).toFixed(1)}%

Current AI Insights: ${prediction?.insights || "No insights available"}

Task:
Generate specific, actionable recommendations tailored to this student's situation. Focus on:
1. Immediate actions (next 1-2 weeks)
2. Short-term goals (1 month)
3. Long-term strategies (3 months)
4. Specific resources or support they might need`;

    console.log("Calling AI with tool calling for structured output");

    // Call Lovable AI with tool calling for structured output
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
            content: "You are an expert educational counselor specialized in student success and dropout prevention. Use the provided tool to return structured recommendations."
          },
          {
            role: "user",
            content: recommendationPrompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_recommendations",
              description: "Return structured improvement recommendations for the student",
              parameters: {
                type: "object",
                properties: {
                  immediateActions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["High", "Medium", "Low"] },
                        action: { type: "string" },
                        reason: { type: "string" },
                        expectedImpact: { type: "string" }
                      },
                      required: ["priority", "action", "reason", "expectedImpact"]
                    }
                  },
                  shortTermGoals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        goal: { type: "string" },
                        timeframe: { type: "string" },
                        steps: { type: "array", items: { type: "string" } },
                        successMetric: { type: "string" }
                      },
                      required: ["goal", "timeframe", "steps", "successMetric"]
                    }
                  },
                  longTermStrategies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        strategy: { type: "string" },
                        description: { type: "string" },
                        milestones: { type: "array", items: { type: "string" } }
                      },
                      required: ["strategy", "description", "milestones"]
                    }
                  },
                  supportNeeded: {
                    type: "object",
                    properties: {
                      academic: { type: "array", items: { type: "string" } },
                      financial: { type: "array", items: { type: "string" } },
                      personal: { type: "array", items: { type: "string" } }
                    },
                    required: ["academic", "financial", "personal"]
                  },
                  motivationalMessage: { type: "string" },
                  keyFocusAreas: { type: "array", items: { type: "string" } }
                },
                required: ["immediateActions", "shortTermGoals", "longTermStrategies", "supportNeeded", "motivationalMessage", "keyFocusAreas"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_recommendations" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Extract structured output from tool call
    let recommendations;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        recommendations = JSON.parse(toolCall.function.arguments);
        console.log("Successfully parsed tool call arguments");
      } catch (parseError) {
        console.error("Failed to parse tool call arguments:", parseError);
        throw new Error("Failed to parse AI recommendations from tool call");
      }
    } else {
      // Fallback: try to parse from content if tool call failed
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          let cleanedText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const start = cleanedText.indexOf("{");
          const end = cleanedText.lastIndexOf("}");
          if (start !== -1 && end !== -1 && end > start) {
            cleanedText = cleanedText.slice(start, end + 1);
          }
          recommendations = JSON.parse(cleanedText);
        } catch {
          throw new Error("Failed to parse AI recommendations");
        }
      } else {
        throw new Error("No recommendations received from AI");
      }
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
