import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface RiskStats {
  low: number;
  medium: number;
  high: number;
}

const Reports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [riskStats, setRiskStats] = useState<RiskStats>({ low: 0, medium: 0, high: 0 });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: predictions } = await supabase
        .from("predictions")
        .select("final_risk_level");

      const stats: RiskStats = {
        low: predictions?.filter(p => p.final_risk_level === "low").length || 0,
        medium: predictions?.filter(p => p.final_risk_level === "medium").length || 0,
        high: predictions?.filter(p => p.final_risk_level === "high").length || 0,
      };

      setRiskStats(stats);
    } catch (error: any) {
      toast.error("Failed to fetch reports");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: "Low Risk", value: riskStats.low, color: "hsl(var(--success))" },
    { name: "Medium Risk", value: riskStats.medium, color: "hsl(var(--warning))" },
    { name: "High Risk", value: riskStats.high, color: "hsl(var(--destructive))" },
  ];

  const barData = [
    { name: "Low Risk", students: riskStats.low, fill: "hsl(var(--success))" },
    { name: "Medium Risk", students: riskStats.medium, fill: "hsl(var(--warning))" },
    { name: "High Risk", students: riskStats.high, fill: "hsl(var(--destructive))" },
  ];

  const handleExportCSV = async () => {
    try {
      const { data: students } = await supabase
        .from("students")
        .select("*, predictions(*)");

      if (!students || students.length === 0) {
        toast.error("No data to export");
        return;
      }

      const csv = [
        ["Name", "Roll No", "Attendance %", "Internal Marks", "Fees Paid %", "Pending Fees", "Risk Level", "ML Probability"].join(","),
        ...students.map(s => [
          s.student_name,
          s.roll_number || "",
          s.attendance_percentage,
          s.internal_marks,
          s.fee_paid_percentage,
          s.pending_fees,
          s.predictions?.[0]?.final_risk_level || "",
          s.predictions?.[0]?.ml_probability || "",
        ].join(","))
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `student-dropout-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      
      toast.success("CSV exported successfully!");
    } catch (error: any) {
      toast.error("Failed to export CSV");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const total = riskStats.low + riskStats.medium + riskStats.high;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis and visualization of dropout risk predictions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Risk Distribution (Pie Chart)</CardTitle>
              <CardDescription>Breakdown of students by risk level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No predictions available. Run predictions first.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Risk Distribution (Bar Chart)</CardTitle>
              <CardDescription>Number of students in each risk category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="students" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No predictions available. Run predictions first.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Total Students</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
              <div className="p-4 rounded-lg bg-success/10">
                <p className="text-sm text-muted-foreground mb-1">Low Risk</p>
                <p className="text-2xl font-bold text-success">
                  {riskStats.low} ({total > 0 ? ((riskStats.low / total) * 100).toFixed(1) : 0}%)
                </p>
              </div>
              <div className="p-4 rounded-lg bg-warning/10">
                <p className="text-sm text-muted-foreground mb-1">Medium Risk</p>
                <p className="text-2xl font-bold text-warning">
                  {riskStats.medium} ({total > 0 ? ((riskStats.medium / total) * 100).toFixed(1) : 0}%)
                </p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <p className="text-sm text-muted-foreground mb-1">High Risk</p>
                <p className="text-2xl font-bold text-destructive">
                  {riskStats.high} ({total > 0 ? ((riskStats.high / total) * 100).toFixed(1) : 0}%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;
