import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface StudentData {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
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
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [student, setStudent] = useState<StudentData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

      // Fetch student
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // Fetch prediction
      const { data: predictionData } = await supabase
        .from("predictions")
        .select("*")
        .eq("student_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPrediction(predictionData);

      // Fetch history
      const { data: historyData } = await supabase
        .from("student_history")
        .select("*")
        .eq("student_id", id)
        .eq("user_id", user.id)
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

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setExporting(true);
    toast.loading("Generating PDF...");

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Student Report: ${student?.student_name || ""}`, pageWidth / 2, 20, { align: "center" });
      
      // Date
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: "center" });
      
      // Add report image
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (imgHeight <= pageHeight - 40) {
        pdf.addImage(imgData, "PNG", 10, 35, imgWidth, imgHeight);
      } else {
        let yOffset = 35;
        let remainingHeight = imgHeight;
        
        while (remainingHeight > 0) {
          const chunkHeight = Math.min(pageHeight - 45, remainingHeight);
          pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, chunkHeight, undefined, "FAST");
          remainingHeight -= chunkHeight;
          
          if (remainingHeight > 0) {
            pdf.addPage();
            yOffset = 10;
          }
        }
      }
      
      pdf.save(`student-report-${student?.roll_number || id}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.dismiss();
      toast.success("PDF exported successfully!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
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
          <Button onClick={handleExportPDF} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Generating..." : "Export PDF"}
          </Button>
        </div>

        <div ref={reportRef} className="space-y-6">
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
                <div className="text-3xl font-bold">{student.attendance_percentage.toFixed(1)}%</div>
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
                <div className="text-3xl font-bold">{student.fee_paid_percentage.toFixed(1)}%</div>
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
                  <p className="text-sm text-muted-foreground mb-1">Student ID</p>
                  <p className="font-medium font-mono text-sm">{student.id}</p>
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDetail;
