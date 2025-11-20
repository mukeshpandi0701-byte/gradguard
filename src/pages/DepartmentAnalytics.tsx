import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, TrendingUp } from "lucide-react";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateStudentReportPDF } from "@/lib/pdfExport";

interface DepartmentStats {
  department: string;
  totalStudents: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
}

const DepartmentAnalytics = () => {
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchDepartmentData();
  }, []);

  const fetchDepartmentData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: students } = await supabase
        .from("students")
        .select("id, department")
        .eq("user_id", user.id);

      const { data: predictions } = await supabase
        .from("predictions")
        .select("student_id, final_risk_level")
        .eq("user_id", user.id);

      // Group by department
      const deptMap = new Map<string, DepartmentStats>();
      
      students?.forEach(student => {
        const dept = student.department || "Unknown";
        if (!deptMap.has(dept)) {
          deptMap.set(dept, {
            department: dept,
            totalStudents: 0,
            lowRisk: 0,
            mediumRisk: 0,
            highRisk: 0,
          });
        }
        const stats = deptMap.get(dept)!;
        stats.totalStudents++;

        const prediction = predictions?.find(p => p.student_id === student.id);
        if (prediction) {
          if (prediction.final_risk_level === "low") stats.lowRisk++;
          else if (prediction.final_risk_level === "medium") stats.mediumRisk++;
          else if (prediction.final_risk_level === "high") stats.highRisk++;
        }
      });

      setDepartmentStats(Array.from(deptMap.values()));
    } catch (error) {
      toast.error("Failed to fetch department data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDepartmentPDF = async (department: string) => {
    setExporting(true);
    toast.loading("Generating department report...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: students } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .eq("department", department);

      if (!students || students.length === 0) {
        toast.dismiss();
        toast.error("No students found in this department");
        return;
      }

      const studentIds = students.map(s => s.id);
      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")
        .in("student_id", studentIds)
        .eq("user_id", user.id);

      const reportData = students.map(student => {
        const prediction = predictions?.find(p => p.student_id === student.id);
        return {
          student_name: student.student_name,
          roll_number: student.roll_number,
          attendance_percentage: student.attendance_percentage || 0,
          internal_marks: student.internal_marks || 0,
          fee_paid_percentage: student.fee_paid_percentage || 0,
          pending_fees: student.pending_fees || 0,
          email: student.email,
          riskLevel: prediction?.final_risk_level || "unknown",
          mlProbability: prediction?.ml_probability || 0,
          suggestions: prediction?.suggestions,
          insights: prediction?.insights,
        };
      });

      await generateStudentReportPDF(reportData, `${department} - Dropout Risk Report`);
      toast.dismiss();
      toast.success("Department report exported successfully!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export department report");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const getChartData = (dept: DepartmentStats) => [
    { name: "Low Risk", value: dept.lowRisk, color: "hsl(var(--chart-1))" },
    { name: "Medium Risk", value: dept.mediumRisk, color: "hsl(var(--chart-2))" },
    { name: "High Risk", value: dept.highRisk, color: "hsl(var(--chart-3))" },
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

  const allDepartmentsData = {
    department: "All Departments",
    totalStudents: departmentStats.reduce((sum, d) => sum + d.totalStudents, 0),
    lowRisk: departmentStats.reduce((sum, d) => sum + d.lowRisk, 0),
    mediumRisk: departmentStats.reduce((sum, d) => sum + d.mediumRisk, 0),
    highRisk: departmentStats.reduce((sum, d) => sum + d.highRisk, 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Department Analytics</h2>
            <p className="text-muted-foreground mt-2">
              Risk distribution and trends across departments
            </p>
          </div>
        </div>

        <Tabs value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Departments</TabsTrigger>
            {departmentStats.map(dept => (
              <TabsTrigger key={dept.department} value={dept.department}>
                {dept.department}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* All Departments View */}
          <TabsContent value="all">
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{allDepartmentsData.totalStudents}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{allDepartmentsData.lowRisk}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600">{allDepartmentsData.mediumRisk}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">{allDepartmentsData.highRisk}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Department Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Department-wise Risk Comparison</CardTitle>
                  <CardDescription>Risk distribution across all departments</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={departmentStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="lowRisk" name="Low Risk" fill="hsl(var(--chart-1))" />
                      <Bar dataKey="mediumRisk" name="Medium Risk" fill="hsl(var(--chart-2))" />
                      <Bar dataKey="highRisk" name="High Risk" fill="hsl(var(--chart-3))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Individual Department Views */}
          {departmentStats.map(dept => (
            <TabsContent key={dept.department} value={dept.department}>
              <div className="space-y-6">
                {/* Department Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{dept.totalStudents}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{dept.lowRisk}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-yellow-600">{dept.mediumRisk}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">{dept.highRisk}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Department Risk Distribution */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{dept.department} - Risk Distribution</CardTitle>
                        <CardDescription>Breakdown of student risk levels</CardDescription>
                      </div>
                      <Button
                        onClick={() => handleExportDepartmentPDF(dept.department)}
                        disabled={exporting}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={getChartData(dept)}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getChartData(dept).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value} students`, "Count"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Department Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-900">
                        {((dept.lowRisk / dept.totalStudents) * 100).toFixed(1)}% of students in {dept.department} are at low risk
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-yellow-900">
                        {dept.mediumRisk} students need attention to prevent escalation
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-900">
                        {dept.highRisk} students require immediate intervention
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentAnalytics;
