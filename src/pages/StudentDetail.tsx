import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AIInsights } from "@/components/AIInsights";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";

interface StudentData {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  department: string | null;
  phone_number: string | null;
  attendance_percentage: number;
  fee_paid_percentage: number;
  pending_fees: number;
  internal_marks: number;
  attended_hours: number;
  total_hours: number;
  paid_fees: number;
  total_fees: number;
}

interface PredictionData {
  final_risk_level: string;
  ml_probability: number;
  insights: string | null;
  suggestions: string | null;
  created_at: string;
}

interface HistoryEntry {
  recorded_at: string;
  attendance_percentage: number;
  internal_marks: number;
  fee_paid_percentage: number;
  pending_fees: number;
}

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState<StudentData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (id) {
      fetchStudentData();
    }
  }, [id]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Try to fetch from student_profiles first (for HOD/Staff viewing logged-in students)
      const { data: profileData } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      let studentData: StudentData | null = null;

      if (profileData) {
        // Fetch academic data from students table using roll_number
        const { data: academicData } = await supabase
          .from("students")
          .select("*")
          .eq("roll_number", profileData.roll_number)
          .maybeSingle();

        // Fetch attendance from attendance_records
        const { data: attendanceRecords } = await supabase
          .from("attendance_records")
          .select("sessions_attended, max_sessions")
          .eq("student_id", id);

        let attendancePercentage = academicData?.attendance_percentage ?? 0;
        if (attendanceRecords && attendanceRecords.length > 0) {
          const totalAttended = attendanceRecords.reduce((sum, r) => sum + r.sessions_attended, 0);
          const totalMax = attendanceRecords.reduce((sum, r) => sum + r.max_sessions, 0);
          if (totalMax > 0) {
            attendancePercentage = Math.min(100, (totalAttended / totalMax) * 100);
          }
        }

        studentData = {
          id: profileData.id,
          student_name: profileData.full_name || profileData.email,
          roll_number: profileData.roll_number,
          email: profileData.email,
          department: profileData.branch || profileData.department,
          phone_number: profileData.phone_number,
          attendance_percentage: attendancePercentage,
          fee_paid_percentage: academicData?.fee_paid_percentage ?? 0,
          pending_fees: academicData?.pending_fees ?? 0,
          internal_marks: academicData?.internal_marks ?? 0,
          attended_hours: academicData?.attended_hours ?? 0,
          total_hours: academicData?.total_hours ?? 0,
          paid_fees: academicData?.paid_fees ?? 0,
          total_fees: academicData?.total_fees ?? 0,
        };
      } else {
        // Fallback: try students table directly
        const { data: directStudentData, error: studentError } = await supabase
          .from("students")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (studentError || !directStudentData) {
          throw new Error("Student not found");
        }

        // Fetch attendance from attendance_records using roll_number to find profile
        const { data: profileByRoll } = await supabase
          .from("student_profiles")
          .select("id")
          .eq("roll_number", directStudentData.roll_number)
          .maybeSingle();

        let attendancePercentage = directStudentData.attendance_percentage ?? 0;
        if (profileByRoll) {
          const { data: attendanceRecords } = await supabase
            .from("attendance_records")
            .select("sessions_attended, max_sessions")
            .eq("student_id", profileByRoll.id);

          if (attendanceRecords && attendanceRecords.length > 0) {
            const totalAttended = attendanceRecords.reduce((sum, r) => sum + r.sessions_attended, 0);
            const totalMax = attendanceRecords.reduce((sum, r) => sum + r.max_sessions, 0);
            if (totalMax > 0) {
              attendancePercentage = Math.min(100, (totalAttended / totalMax) * 100);
            }
          }
        }

        studentData = {
          ...directStudentData,
          attendance_percentage: attendancePercentage,
        };
      }

      setStudent(studentData);

      // Fetch prediction (try without user_id filter first for HOD viewing)
      const { data: predictionData } = await supabase
        .from("predictions")
        .select("*")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPrediction(predictionData);

      // Fetch history
      const { data: historyData } = await supabase
        .from("student_history")
        .select("*")
        .eq("student_id", id)
        .order("recorded_at", { ascending: true });

      setHistory(historyData || []);
    } catch (error) {
      toast.error("Failed to fetch student data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "medium": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "high": return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      default: return "bg-slate-500/10 text-slate-700 border-slate-500/20";
    }
  };

  const getTrendIcon = (current: number, threshold: number, reverse: boolean = false) => {
    if (reverse) {
      if (current < threshold) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
      if (current > threshold) return <TrendingDown className="h-4 w-4 text-rose-600" />;
    } else {
      if (current >= threshold) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
      if (current < threshold) return <TrendingDown className="h-4 w-4 text-rose-600" />;
    }
    return <Minus className="h-4 w-4 text-slate-600" />;
  };

  const [aiInsightsRef, setAiInsightsRef] = useState<{
    trendAnalysis: any;
    recommendations: any;
  }>({ trendAnalysis: null, recommendations: null });

  const handleExportClick = () => {
    if (!student) return;
    setShowPreview(true);
  };

  const handleExportPDF = async () => {
    if (!student) return;
    
    setExporting(true);
    toast.loading("Generating comprehensive PDF report...");

    try {
      const { generateAIStudentReportPDF } = await import("@/lib/pdfExport");
      
      // Get the chart element if available
      const chartElement = document.querySelector('.recharts-wrapper')?.parentElement as HTMLElement || null;
      
      await generateAIStudentReportPDF(
        student,
        prediction,
        aiInsightsRef.trendAnalysis,
        aiInsightsRef.recommendations,
        chartElement
      );
      
      toast.dismiss();
      toast.success("PDF report exported successfully!");
      setShowPreview(false);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const renderPreviewContent = () => {
    if (!student || !prediction) return null;
    
    const getRiskColor = (level: string) => {
      switch (level?.toLowerCase()) {
        case "low": return "text-green-600";
        case "medium": return "text-yellow-600";
        case "high": return "text-red-600";
        default: return "";
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">{student.student_name}</h2>
          <p className="text-sm text-muted-foreground">
            Roll Number: {student.roll_number || "N/A"} | Department: {student.department || "N/A"}
          </p>
        </div>

        <div>
          <Badge className={`${getRiskColor(prediction.final_risk_level)} text-lg px-4 py-1`}>
            {prediction.final_risk_level?.toUpperCase()} RISK
          </Badge>
          <p className="text-sm mt-2">
            Dropout Probability: <span className="font-semibold">{(prediction.ml_probability * 100).toFixed(1)}%</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{student.attendance_percentage?.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Internal Marks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{student.internal_marks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fees Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{student.fee_paid_percentage?.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">₹{student.pending_fees}</div>
            </CardContent>
          </Card>
        </div>

        {prediction.insights && (
          <div className="p-4 rounded-lg bg-muted/30">
            <h3 className="font-semibold mb-2">Key Insights</h3>
            <p className="text-sm whitespace-pre-wrap">{prediction.insights}</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>The exported PDF will include all student details, charts, and AI-powered recommendations.</p>
        </div>
      </div>
    );
  };

  const chartData = history.map((entry) => ({
    date: new Date(entry.recorded_at).toLocaleDateString(),
    attendance: entry.attendance_percentage || 0,
    marks: entry.internal_marks || 0,
    feesPaid: entry.fee_paid_percentage || 0,
  }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Student not found</p>
          <Button onClick={() => navigate("/students")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{student.student_name}</h1>
              <p className="text-muted-foreground">
                Roll Number: {student.roll_number || "N/A"}
              </p>
            </div>
          </div>
          <Button onClick={handleExportClick} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Generating..." : "Export PDF"}
          </Button>
        </div>

        <PDFPreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          title="Preview Student Report PDF"
          description="Review the content before exporting the student report"
          previewContent={renderPreviewContent()}
          onConfirmExport={handleExportPDF}
          isExporting={exporting}
        />

        <div className="space-y-6">
          {/* Risk Status Card */}
          {prediction && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Current Risk Status</span>
                  <Badge className={getRiskColor(prediction.final_risk_level)}>
                    {prediction.final_risk_level.toUpperCase()} RISK
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">ML Prediction Probability</p>
                    <p className="text-2xl font-bold">{(prediction.ml_probability * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-2xl font-bold">
                      {new Date(prediction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {prediction.insights && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Insights</p>
                    <p className="text-sm">{prediction.insights}</p>
                  </div>
                )}
                {prediction.suggestions && (
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                    <p className="text-sm font-medium mb-2 text-primary">Suggestions</p>
                    <p className="text-sm">{prediction.suggestions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  Attendance
                  {getTrendIcon(student.attendance_percentage, 75)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Number((student as any).attendance_percentage ?? 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {student.attended_hours} / {student.total_hours} hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  Internal Marks
                  {getTrendIcon(student.internal_marks, 40)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{student.internal_marks}</div>
                <p className="text-xs text-muted-foreground mt-1">out of 100</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  Fees Paid
                  {getTrendIcon(student.fee_paid_percentage, 75)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Number((student as any).fee_paid_percentage ?? 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{student.paid_fees.toLocaleString()} / ₹{student.total_fees.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  Pending Fees
                  {getTrendIcon(student.pending_fees, 10000, true)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">₹{student.pending_fees.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">outstanding</p>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="font-medium">{student.email || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Roll Number</p>
                  <p className="font-medium font-mono text-sm">{student.roll_number || "Not provided"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historical Trend */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trend Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      name="Attendance %"
                      dot={{ fill: 'hsl(var(--chart-1))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="marks" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      name="Internal Marks"
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="feesPaid" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      name="Fees Paid %"
                      dot={{ fill: 'hsl(var(--chart-3))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {chartData.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trend Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  No historical data available yet. Data will appear here as the student's performance is tracked over time.
                </p>
              </CardContent>
            </Card>
          )}

          {/* AI-Powered Insights */}
          <AIInsights 
            studentId={student.id} 
            studentName={student.student_name}
            onDataUpdate={(data) => setAiInsightsRef(data)}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDetail;
