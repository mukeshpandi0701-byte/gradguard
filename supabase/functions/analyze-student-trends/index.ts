import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrendAnalysisRequest {
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

    const { studentId }: TrendAnalysisRequest = await req.json();

    if (!studentId) {
      throw new Error("Student ID is required");
    }

    console.log("Analyzing trends for studentId:", studentId);

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
        student_name: profileData.full_name || profileData.email,
        roll_number: profileData.roll_number,
        attendance_percentage: 0,
        internal_marks: 0,
        fee_paid_percentage: 0,
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

    // Get student's historical data using studentRecordId (students.id)
    const { data: history, error: historyError } = await supabase
      .from("student_history")
      .select("*")
      .eq("student_id", studentRecordId)
      .order("recorded_at", { ascending: true });

    if (historyError) {
      console.error("History fetch error:", historyError);
    }

    console.log("Found history records:", history?.length ?? 0);

    // Get current prediction
    const { data: prediction } = await supabase
      .from("predictions")
      .select("*")
      .eq("student_id", studentRecordId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Prepare data for AI analysis
    const analysisPrompt = `You are an educational data analyst AI. Analyze the following student data and provide insights about trends and future risk predictions.

Student Name: ${student.student_name}
Current Status:
- Attendance: ${student.attendance_percentage ?? 0}%
- Internal Marks: ${student.internal_marks ?? 0}
- Fee Paid: ${student.fee_paid_percentage ?? 0}%
- Current Risk Level: ${prediction?.final_risk_level || "unknown"}

Historical Data (${history?.length || 0} records):
${history?.map((h, i) => `
Record ${i + 1} (${new Date(h.recorded_at).toLocaleDateString()}):
- Attendance: ${h.attendance_percentage ?? 0}%
- Internal Marks: ${h.internal_marks ?? 0}
- Fee Paid: ${h.fee_paid_percentage ?? 0}%
`).join('\n') || 'No historical data available'}

Task:
1. Analyze the trends in attendance, marks, and fee payment over time
2. Identify patterns (improving, declining, or stable)
3. Predict the likely risk level in 1 month and 3 months if current trends continue
4. Provide specific warning signs or positive indicators
5. Rate the urgency of intervention (Low, Medium, High, Critical)`;

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
            content: "You are an expert educational data analyst. Use the provided tool to return structured analysis."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_trend_analysis",
              description: "Return the structured trend analysis for a student",
              parameters: {
                type: "object",
                properties: {
                  trendAnalysis: {
                    type: "object",
                    properties: {
                      attendance: { type: "string", description: "Trend description for attendance (improving/declining/stable with details)" },
                      academicPerformance: { type: "string", description: "Trend description for academic performance" },
                      financialStatus: { type: "string", description: "Trend description for financial status" }
                    },
                    required: ["attendance", "academicPerformance", "financialStatus"]
                  },
                  predictions: {
                    type: "object",
                    properties: {
                      oneMonth: {
                        type: "object",
                        properties: {
                          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
                          confidence: { type: "string" },
                          reasoning: { type: "string" }
                        },
                        required: ["riskLevel", "confidence", "reasoning"]
                      },
                      threeMonths: {
                        type: "object",
                        properties: {
                          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
                          confidence: { type: "string" },
                          reasoning: { type: "string" }
                        },
                        required: ["riskLevel", "confidence", "reasoning"]
                      }
                    },
                    required: ["oneMonth", "threeMonths"]
                  },
                  warningSignals: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of concerning patterns"
                  },
                  positiveIndicators: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of positive patterns"
                  },
                  interventionUrgency: {
                    type: "string",
                    enum: ["Low", "Medium", "High", "Critical"]
                  },
                  summary: {
                    type: "string",
                    description: "2-3 sentence overall assessment"
                  }
                },
                required: ["trendAnalysis", "predictions", "warningSignals", "positiveIndicators", "interventionUrgency", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_trend_analysis" } },
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
    let analysis;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
        console.log("Successfully parsed tool call arguments");
      } catch (parseError) {
        console.error("Failed to parse tool call arguments:", parseError);
        throw new Error("Failed to parse AI analysis from tool call");
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
          analysis = JSON.parse(cleanedText);
        } catch {
          throw new Error("Failed to parse AI analysis");
        }
      } else {
        throw new Error("No analysis received from AI");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        studentName: student.student_name,
        analysis,
        dataPoints: {
          currentData: {
            attendance: student.attendance_percentage,
            internalMarks: student.internal_marks,
            feePaid: student.fee_paid_percentage,
            currentRisk: prediction?.final_risk_level
          },
          historicalRecords: history?.length || 0
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in analyze-student-trends:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to analyze trends",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
