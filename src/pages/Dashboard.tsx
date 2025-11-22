import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle, CheckCircle2, AlertTriangle, Loader2, Upload, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

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
      const { data: students } = await supabase
        .from("students")
        .select("id");

      const { data: predictions } = await supabase
        .from("predictions")
        .select("final_risk_level");

      setStats({
        totalStudents: students?.length || 0,
        lowRisk: predictions?.filter(p => p.final_risk_level === "low").length || 0,
        mediumRisk: predictions?.filter(p => p.final_risk_level === "medium").length || 0,
        highRisk: predictions?.filter(p => p.final_risk_level === "high").length || 0,
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
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-2">
            Overview of student dropout risk analysis
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.totalStudents}</div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-success">{stats.lowRisk}</div>
                <CheckCircle2 className="w-8 h-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-warning">{stats.mediumRisk}</div>
                <AlertTriangle className="w-8 h-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow border-l-4 border-l-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-destructive">{stats.highRisk}</div>
                <AlertCircle className="w-8 h-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => navigate("/upload")}
                className="p-6 rounded-lg border-2 border-primary/20 hover:border-primary/40 hover:bg-accent/5 transition-all group"
              >
                <Upload className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold mb-1">Upload CSV</h3>
                <p className="text-sm text-muted-foreground">Import student data</p>
              </button>
              
              <button
                onClick={() => navigate("/students")}
                className="p-6 rounded-lg border-2 border-secondary/20 hover:border-secondary/40 hover:bg-accent/5 transition-all group"
              >
                <Users className="w-8 h-8 text-secondary mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold mb-1">View Students</h3>
                <p className="text-sm text-muted-foreground">Analyze student profiles</p>
              </button>
              
              <button
                onClick={() => navigate("/reports")}
                className="p-6 rounded-lg border-2 border-accent/20 hover:border-accent/40 hover:bg-accent/5 transition-all group"
              >
                <BarChart3 className="w-8 h-8 text-accent mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold mb-1">View Reports</h3>
                <p className="text-sm text-muted-foreground">Generate analytics</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
