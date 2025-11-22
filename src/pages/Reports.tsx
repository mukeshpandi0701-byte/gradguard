import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";

interface PredictionData {
  final_risk_level: string;
}

interface Student {
  id: string;
  department: string | null;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  attendance_percentage: number | null;
  internal_marks: number;
  fee_paid_percentage: number | null;
  pending_fees: number | null;
}

const Reports = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const chartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReportData();
  }, [selectedDepartment]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: students } = await supabase
        .from("students")
        .select("id, department, student_name, roll_number, email, attendance_percentage, internal_marks, fee_paid_percentage, pending_fees")
        .eq("user_id", user.id);

      // Extract unique departments
      const uniqueDepts = Array.from(new Set((students as Student[])?.map(s => s.department).filter(Boolean))) as string[];
      setDepartments(uniqueDepts);

      // Filter students by department if selected
      const filteredStudentIds = selectedDepartment === "all" 
        ? (students as Student[])?.map(s => s.id)
        : (students as Student[])?.filter(s => s.department === selectedDepartment).map(s => s.id);

      const { data: predictions } = await supabase
        .from("predictions")
        .select("final_risk_level, student_id")
        .eq("user_id", user.id)
        .in("student_id", filteredStudentIds || []);

      const lowRisk = (predictions as PredictionData[])?.filter(p => p.final_risk_level === "low").length || 0;
      const mediumRisk = (predictions as PredictionData[])?.filter(p => p.final_risk_level === "medium").length || 0;
      const highRisk = (predictions as PredictionData[])?.filter(p => p.final_risk_level === "high").length || 0;

      setStats({
        totalStudents: filteredStudentIds?.length || 0,
        lowRisk,
        mediumRisk,
        highRisk,
      });
    } catch (error) {
      toast.error("Failed to fetch report data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!chartsRef.current) {
      toast.error("Charts not ready");
      return;
    }

    setExporting(true);
    toast.loading("Generating analytics PDF...");

    try {
      const { generateAnalyticsReportPDF } = await import("@/lib/pdfExport");
      await generateAnalyticsReportPDF(selectedDepartment, stats, chartsRef.current);
      
      toast.dismiss();
      toast.success("Analytics PDF exported successfully!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const pieData = [
    { name: "Low Risk", value: stats.lowRisk, color: "hsl(var(--chart-1))" },
    { name: "Medium Risk", value: stats.mediumRisk, color: "hsl(var(--chart-2))" },
    { name: "High Risk", value: stats.highRisk, color: "hsl(var(--chart-3))" },
  ];

  const barData = [
    { category: "Risk Categories", lowRisk: stats.lowRisk, mediumRisk: stats.mediumRisk, highRisk: stats.highRisk },
  ];

  const trendData = [
    { month: "Jan", low: 12, medium: 8, high: 3 },
    { month: "Feb", low: 15, medium: 7, high: 2 },
    { month: "Mar", low: 18, medium: 6, high: 4 },
    { month: "Apr", low: 14, medium: 9, high: 5 },
    { month: "May", low: stats.lowRisk, medium: stats.mediumRisk, high: stats.highRisk },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Reports & Analytics</h2>
            <p className="text-muted-foreground">Comprehensive dropout risk analysis</p>
          </div>
          <Button onClick={handleExportPDF} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>

        <Tabs value={selectedDepartment} onValueChange={setSelectedDepartment} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Departments</TabsTrigger>
            {departments.map((dept) => (
              <TabsTrigger key={dept} value={dept}>
                {dept}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedDepartment} className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.lowRisk}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.mediumRisk}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.highRisk}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div ref={chartsRef} className="space-y-6 bg-card p-6 rounded-lg border">
          {/* Pie Chart - Risk Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Current distribution of students by risk level</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} students`, "Count"]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart - Risk Counts */}
          <Card>
            <CardHeader>
              <CardTitle>Student Count by Risk Category</CardTitle>
              <CardDescription>Number of students in each risk category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
                  <XAxis dataKey="category" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="lowRisk" name="Low Risk" fill="hsl(var(--chart-1))" barSize={40} />
                  <Bar dataKey="mediumRisk" name="Medium Risk" fill="hsl(var(--chart-2))" barSize={40} />
                  <Bar dataKey="highRisk" name="High Risk" fill="hsl(var(--chart-3))" barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart - Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Trends Over Time</CardTitle>
              <CardDescription>Monthly trends of risk levels (simulated data)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
                  <XAxis dataKey="month" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Line type="monotone" dataKey="low" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Low Risk" />
                  <Line type="monotone" dataKey="medium" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Medium Risk" />
                  <Line type="monotone" dataKey="high" stroke="hsl(var(--chart-3))" strokeWidth={2} name="High Risk" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900">
                {((stats.lowRisk / stats.totalStudents) * 100).toFixed(1)}% of students are at low risk
              </p>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-900">
                {stats.mediumRisk} students need attention to prevent escalation
              </p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900">
                {stats.highRisk} students require immediate intervention
              </p>
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
