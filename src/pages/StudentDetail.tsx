import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  attendance_percentage: number;
  fee_paid_percentage: number;
  pending_fees: number;
  internal_marks: number;
}

interface Prediction {
  final_risk_level: string;
  ml_probability: number;
  suggestions: string | null;
  insights: string | null;
}

interface HistoryRecord {
  recorded_at: string;
  attendance_percentage: number;
  internal_marks: number;
  fee_paid_percentage: number;
  pending_fees: number;
}

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentDetail();
  }, [id]);

  const fetchStudentDetail = async () => {
    if (!id) return;

    setLoading(true);
    try {
      // Fetch student data
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // Fetch prediction
      const { data: predictionData } = await supabase
        .from("predictions")
        .select("*")
        .eq("student_id", id)
        .maybeSingle();

      setPrediction(predictionData);

      // Fetch historical data
      const { data: historyData } = await supabase
        .from("student_history")
        .select("*")
        .eq("student_id", id)
        .order("recorded_at", { ascending: true });

      setHistory(historyData || []);
    } catch (error: any) {
      toast.error("Failed to fetch student details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level?: string) => {
    if (!level) return <Badge variant="secondary">No Data</Badge>;
    
    const variants = {
      low: "default",
      medium: "secondary",
      high: "destructive",
    } as const;

    return (
      <Badge variant={variants[level as keyof typeof variants]} className="text-lg px-4 py-1">
        {level.toUpperCase()} RISK
      </Badge>
    );
  };

  const chartData = history.map(record => ({
    date: new Date(record.recorded_at).toLocaleDateString(),
    attendance: record.attendance_percentage,
    marks: record.internal_marks,
    feesPaid: record.fee_paid_percentage,
  }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Student Not Found</h2>
          <Button onClick={() => navigate("/students")}>Back to Students</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/students")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold">{student.student_name}</h2>
            <p className="text-muted-foreground mt-2">
              Roll Number: {student.roll_number || "N/A"}
            </p>
            {student.email && (
              <p className="text-muted-foreground">Email: {student.email}</p>
            )}
          </div>
          {prediction && getRiskBadge(prediction.final_risk_level)}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{student.attendance_percentage?.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Internal Marks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{student.internal_marks}/100</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Fees Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{student.fee_paid_percentage?.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{student.pending_fees?.toFixed(0)}</div>
            </CardContent>
          </Card>
        </div>

        {prediction && (
          <>
            {prediction.insights && (
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{prediction.insights}</p>
                </CardContent>
              </Card>
            )}

            {prediction.suggestions && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{prediction.suggestions}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>ML Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Dropout Probability: <span className="font-bold">{(prediction.ml_probability * 100).toFixed(1)}%</span>
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Progress Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attendance" stroke="#10b981" name="Attendance %" />
                  <Line type="monotone" dataKey="marks" stroke="#3b82f6" name="Internal Marks" />
                  <Line type="monotone" dataKey="feesPaid" stroke="#f59e0b" name="Fees Paid %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentDetail;
