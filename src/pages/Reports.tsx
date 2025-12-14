import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, BarChart3, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";

interface PredictionData {
  final_risk_level: string;
  student_id: string;
}

interface StudentProfile {
  id: string;
  branch: string | null;
  full_name: string | null;
  roll_number: string | null;
  email: string;
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
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [showPreview, setShowPreview] = useState(false);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const chartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [selectedBranch, students]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get assigned branches for staff
      const { data: branchData } = await supabase
        .from("staff_branch_assignments")
        .select("branch")
        .eq("staff_user_id", user.id);

      const branches = (branchData || []).map(b => b.branch);
      setAssignedBranches(branches);

      if (branches.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Fetch students from assigned branches
      const { data: studentProfiles, error } = await supabase
        .from("student_profiles")
        .select("id, branch, full_name, roll_number, email")
        .in("branch", branches);

      if (error) throw error;
      setStudents(studentProfiles || []);
    } catch (error) {
      toast.error("Failed to fetch data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Filter students by branch
      const filteredStudents = selectedBranch === "all" 
        ? students 
        : students.filter(s => s.branch === selectedBranch);

      const studentIds = filteredStudents.map(s => s.id);

      if (studentIds.length === 0) {
        setStats({ totalStudents: 0, lowRisk: 0, mediumRisk: 0, highRisk: 0 });
        return;
      }

      const { data: predictions } = await supabase
        .from("predictions")
        .select("final_risk_level, student_id")
        .eq("user_id", user.id)
        .in("student_id", studentIds);

      const lowRisk = (predictions as PredictionData[])?.filter(p => p.final_risk_level === "low").length || 0;
      const mediumRisk = (predictions as PredictionData[])?.filter(p => p.final_risk_level === "medium").length || 0;
      const highRisk = (predictions as PredictionData[])?.filter(p => p.final_risk_level === "high").length || 0;

      setStats({
        totalStudents: filteredStudents.length,
        lowRisk,
        mediumRisk,
        highRisk,
      });
    } catch (error) {
      console.error("Error calculating stats:", error);
    }
  };

  const handleExportClick = () => {
    if (!chartsRef.current) {
      toast.error("Charts not ready");
      return;
    }
    setShowPreview(true);
  };

  const handleExportPDF = async () => {
    if (!chartsRef.current) return;

    setExporting(true);
    toast.loading("Generating analytics PDF...");

    try {
      const { generateAnalyticsReportPDF } = await import("@/lib/pdfExport");
      await generateAnalyticsReportPDF(selectedBranch === "all" ? "All Branches" : selectedBranch, stats, chartsRef.current);
      
      toast.dismiss();
      toast.success("Analytics PDF exported successfully!");
      setShowPreview(false);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const renderPreviewContent = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">
          {selectedBranch === "all" ? "All Branches" : selectedBranch} - Analytics Report
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generated on: {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">Low Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.lowRisk}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">Medium Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.mediumRisk}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.highRisk}</div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 rounded-lg bg-muted/30">
        <h3 className="font-semibold mb-2">Key Insights</h3>
        <ul className="space-y-2 text-sm">
          {stats.totalStudents > 0 && (
            <>
              <li>• {((stats.lowRisk / stats.totalStudents) * 100).toFixed(1)}% of students are at low risk</li>
              {stats.mediumRisk > 0 && (
                <li>• {stats.mediumRisk} students require moderate intervention</li>
              )}
              {stats.highRisk > 0 && (
                <li className="text-red-600 font-medium">• {stats.highRisk} students are at critical risk and need immediate attention</li>
              )}
            </>
          )}
        </ul>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>The exported PDF will include all charts and detailed analytics.</p>
      </div>
    </div>
  );

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

  if (assignedBranches.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Reports & Analytics</h2>
            <p className="text-muted-foreground">Comprehensive dropout risk analysis</p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Branches Assigned</h3>
              <p className="text-muted-foreground text-center">
                Contact your HOD to get branch assignments
              </p>
            </CardContent>
          </Card>
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
          <Button onClick={handleExportClick} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>

        <PDFPreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          title="Preview Analytics Report PDF"
          description="Review the content before exporting your analytics report"
          previewContent={renderPreviewContent()}
          onConfirmExport={handleExportPDF}
          isExporting={exporting}
        />

        <Tabs value={selectedBranch} onValueChange={setSelectedBranch} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Branches ({students.length})</TabsTrigger>
            {assignedBranches.map((branch) => (
              <TabsTrigger key={branch} value={branch}>
                {branch} ({students.filter(s => s.branch === branch).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedBranch} className="space-y-6">

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>
          <Card className="shadow-[0_0_20px_rgba(34,197,94,0.25)] border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.lowRisk}</div>
            </CardContent>
          </Card>
          <Card className="shadow-[0_0_20px_rgba(234,179,8,0.25)] border-yellow-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.mediumRisk}</div>
            </CardContent>
          </Card>
          <Card className="shadow-[0_0_20px_rgba(239,68,68,0.25)] border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.highRisk}</div>
            </CardContent>
          </Card>
        </div>

        {/* Key Insights */}
        <Card className="shadow-elevated border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.totalStudents > 0 && (
              <>
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-sm font-medium">
                    {((stats.lowRisk / stats.totalStudents) * 100).toFixed(1)}% of students are at low risk
                  </p>
                </div>
                {stats.mediumRisk > 0 && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <p className="text-sm font-medium">
                      {stats.mediumRisk} student{stats.mediumRisk !== 1 ? 's' : ''} need attention to prevent escalation
                    </p>
                  </div>
                )}
                {stats.highRisk > 0 && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium">
                      {stats.highRisk} student{stats.highRisk !== 1 ? 's' : ''} require immediate intervention
                    </p>
                  </div>
                )}
              </>
            )}
            {stats.totalStudents === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No student data available. Run predictions to see insights.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div ref={chartsRef} className="space-y-6 bg-card p-6 rounded-lg border">
          {/* Pie Chart - Risk Distribution */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Current distribution of students by risk level</CardDescription>
            </CardHeader>
            <CardContent className="select-none">
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
                    style={{ outline: 'none' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} students`, "Count"]}
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      color: 'var(--foreground)'
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart - Risk Counts */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Student Count by Risk Category</CardTitle>
              <CardDescription>Number of students in each risk category</CardDescription>
            </CardHeader>
            <CardContent className="select-none">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
                  <XAxis dataKey="category" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      color: 'var(--foreground)'
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Legend />
                  <Bar dataKey="lowRisk" name="Low Risk" fill="hsl(var(--chart-1))" barSize={40} style={{ outline: 'none' }} />
                  <Bar dataKey="mediumRisk" name="Medium Risk" fill="hsl(var(--chart-2))" barSize={40} style={{ outline: 'none' }} />
                  <Bar dataKey="highRisk" name="High Risk" fill="hsl(var(--chart-3))" barSize={40} style={{ outline: 'none' }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart - Trends */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Risk Trends Over Time</CardTitle>
              <CardDescription>Monthly trends of risk levels (simulated data)</CardDescription>
            </CardHeader>
            <CardContent className="select-none">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
                  <XAxis dataKey="month" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      color: 'var(--foreground)'
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="low" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Low Risk" style={{ outline: 'none' }} />
                  <Line type="monotone" dataKey="medium" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Medium Risk" style={{ outline: 'none' }} />
                  <Line type="monotone" dataKey="high" stroke="hsl(var(--chart-3))" strokeWidth={2} name="High Risk" style={{ outline: 'none' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;