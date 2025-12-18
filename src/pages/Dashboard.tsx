import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle, CheckCircle2, AlertTriangle, Loader2, Upload, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ParallaxWrapper } from "@/components/ParallaxWrapper";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    await fetchStats();
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is HOD
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "hod")
        .maybeSingle();

      const isHOD = !!roleData;

      let students: { id: string; branch: string | null }[] = [];

      if (isHOD) {
        // HOD: Fetch all students from their department
        const { data: profile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.department) {
          const { data: studentProfiles } = await supabase
            .from("student_profiles")
            .select("id, branch, department")
            .eq("department", profile.department);
          
          students = studentProfiles || [];
        }
      } else {
        // Staff: Fetch students from assigned branches
        const { data: branchData } = await supabase
          .from("staff_branch_assignments")
          .select("branch")
          .eq("staff_user_id", user.id);

        const branches = (branchData || []).map(b => b.branch);

        if (branches.length > 0) {
          const { data: studentProfiles } = await supabase
            .from("student_profiles")
            .select("id, branch")
            .in("branch", branches);
          
          students = studentProfiles || [];
        }
      }

      const studentIds = students.map(s => s.id);

      // Fetch predictions only for filtered students
      let predictions: { student_id: string; final_risk_level: string }[] = [];
      if (studentIds.length > 0) {
        const { data: predictionsData } = await supabase
          .from("predictions")
          .select("student_id, final_risk_level")
          .in("student_id", studentIds);
        predictions = predictionsData || [];
      }

      setStats({
        totalStudents: students.length,
        lowRisk: predictions.filter(p => p.final_risk_level === "low").length,
        mediumRisk: predictions.filter(p => p.final_risk_level === "medium").length,
        highRisk: predictions.filter(p => p.final_risk_level === "high").length,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 w-full max-w-7xl">
        <ParallaxWrapper speed={-0.05}>
          <div>
            <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground mt-2">
              Overview of student dropout risk analysis
            </p>
          </div>
        </ParallaxWrapper>

        {/* Stats Cards */}
        <ParallaxWrapper speed={0.05}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Students</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats.totalStudents}</div>
                <Users className="w-6 h-6 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-success">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Low Risk</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-success">{stats.lowRisk}</div>
                <CheckCircle2 className="w-6 h-6 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-warning">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Medium Risk</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-warning">{stats.mediumRisk}</div>
                <AlertTriangle className="w-6 h-6 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">High Risk</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-destructive">{stats.highRisk}</div>
                <AlertCircle className="w-6 h-6 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
        </ParallaxWrapper>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
