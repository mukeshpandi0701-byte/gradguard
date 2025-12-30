import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, BookOpen, CreditCard, TrendingUp, LogOut, AlertTriangle, CheckCircle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  roll_number: string;
  college: string;
  year: string;
  department: string;
  branch: string;
}

interface StudentData {
  id: string;
  student_name: string;
  roll_number: string;
  attendance_percentage: number | null;
  internal_marks: number;
  fee_paid_percentage: number | null;
  pending_fees: number | null;
  department: string | null;
}

interface Prediction {
  final_risk_level: "low" | "medium" | "high";
  ml_probability: number;
  insights: string | null;
  suggestions: string | null;
}

interface TutorInfo {
  full_name: string;
  email: string;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [tutor, setTutor] = useState<TutorInfo | null>(null);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth/student");
        return;
      }

      // Verify user role from database (server-side verification)
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (roleError) {
        console.error("Error verifying user role:", roleError);
      }

      // Check if user is a student using database role (primary) or metadata (fallback)
      const isStudent = roleData?.role === "student" || 
        (!roleData && session.user.user_metadata?.panel_type === "student");
      
      if (!isStudent) {
        toast.error("Access denied. This dashboard is for students only.");
        navigate("/dashboard");
        return;
      }

      // Fetch student profile
      const { data: profileData, error: profileError } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      }

      if (profileData) {
        setProfile(profileData);

        // Try multiple ways to fetch attendance records
        // 1. By student_profiles.id
        let { data: attendanceRecords } = await supabase
          .from("attendance_records")
          .select("sessions_attended, max_sessions")
          .eq("student_id", profileData.id);

        // 2. If no records found, try by user_id
        if (!attendanceRecords || attendanceRecords.length === 0) {
          const { data: recordsByUser } = await supabase
            .from("attendance_records")
            .select("sessions_attended, max_sessions")
            .eq("user_id", session.user.id);
          attendanceRecords = recordsByUser;
        }

        let computedAttendance: number | null = null;
        if (attendanceRecords && attendanceRecords.length > 0) {
          const totalAttended = attendanceRecords.reduce((sum, r) => sum + (r.sessions_attended || 0), 0);
          const totalMax = attendanceRecords.reduce((sum, r) => sum + (r.max_sessions || 0), 0);
          if (totalMax > 0) {
            computedAttendance = Math.min(100, (totalAttended / totalMax) * 100);
          } else {
            computedAttendance = 0;
          }
        }

        // Try to find matching student data by roll number
        const { data: studentDataResult, error: studentError } = await supabase
          .from("students")
          .select("*")
          .eq("roll_number", profileData.roll_number)
          .maybeSingle();

        if (studentError) {
          console.error("Error fetching student data:", studentError);
        }

        if (studentDataResult) {
          // Use computed attendance if attendance records exist; otherwise fall back to students table
          const finalAttendance = computedAttendance !== null
            ? computedAttendance
            : (studentDataResult.attendance_percentage ?? 0);

          setStudentData({
            ...studentDataResult,
            attendance_percentage: finalAttendance,
          });

          // Fetch prediction for this student
          const { data: predictionData, error: predictionError } = await supabase
            .from("predictions")
            .select("final_risk_level, ml_probability, insights, suggestions")
            .eq("student_id", studentDataResult.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (predictionError) {
            console.error("Error fetching prediction:", predictionError);
          }

          if (predictionData) {
            setPrediction(predictionData);
          }

          // Fetch tutor info - find staff assigned to this student's branch
          await fetchTutorInfo(profileData.branch);
        } else {
          // Create a minimal student data from attendance records if students table has no entry
          setStudentData({
            id: profileData.id,
            student_name: profileData.full_name || profileData.email,
            roll_number: profileData.roll_number || "",
            attendance_percentage: computedAttendance,
            internal_marks: 0,
            fee_paid_percentage: 0,
            pending_fees: 0,
            department: profileData.branch
          });
          await fetchTutorInfo(profileData.branch);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchTutorInfo = async (branch: string | null) => {
    if (!branch) return;

    try {
      // Find staff assigned to this branch
      const { data: assignment, error: assignmentError } = await supabase
        .from("staff_branch_assignments")
        .select("staff_user_id")
        .eq("branch", branch)
        .limit(1)
        .maybeSingle();

      if (assignmentError) {
        console.error("Error fetching tutor assignment:", assignmentError);
        return;
      }

      if (assignment) {
        // Fetch staff profile
        const { data: staffProfile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", assignment.staff_user_id)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching tutor profile:", profileError);
          return;
        }

        if (staffProfile) {
          setTutor(staffProfile);
        }
      }
    } catch (error) {
      console.error("Error fetching tutor:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth/student");
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-success/20 text-success border-success/30";
      case "medium":
        return "bg-warning/20 text-warning border-warning/30";
      case "high":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "low":
        return <CheckCircle className="w-5 h-5" />;
      case "medium":
      case "high":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary p-2">
              <img src={logo} alt="GradGuard" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                GradGuard
              </span>
              <p className="text-xs text-muted-foreground">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/student-calendar")} className="hidden sm:flex">
              <CalendarDays className="w-4 h-4 mr-2" />
              Calendar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/student-calendar")} className="sm:hidden">
              <CalendarDays className="w-5 h-5" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Welcome, {profile?.full_name || "Student"}!
          </h1>
          <p className="text-muted-foreground">
            View your academic progress and risk assessment
          </p>
        </div>

        {/* Profile Card */}
        <Card className="mb-6 bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Roll Number</p>
                <p className="font-medium">{profile?.roll_number || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">College</p>
                <p className="font-medium">{profile?.college || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium">{profile?.department || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="font-medium">{profile?.branch || "N/A"}</p>
              </div>
            </div>
            {tutor && (
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Your Tutor</p>
                <p className="font-medium text-primary">{tutor.full_name}</p>
                <p className="text-sm text-muted-foreground">{tutor.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {studentData ? (
          <>
            {/* Risk Status Card */}
            {prediction && (
              <Card className={`mb-6 ${getRiskColor(prediction.final_risk_level)} border`}>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getRiskIcon(prediction.final_risk_level)}
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <Badge className={`${getRiskColor(prediction.final_risk_level)} text-sm px-3 py-1`}>
                      {prediction.final_risk_level.toUpperCase()} RISK
                    </Badge>
                    <span className="text-sm">
                      ML Probability: {(prediction.ml_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  {prediction.insights && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-1">Insights</p>
                      <p className="text-sm opacity-80">{prediction.insights}</p>
                    </div>
                  )}
                  {prediction.suggestions && (
                    <div>
                      <p className="text-sm font-medium mb-1">Suggestions</p>
                      <p className="text-sm opacity-80">{prediction.suggestions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4" />
                    Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {(studentData.attendance_percentage ?? 0).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    Internal Marks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{studentData.internal_marks}</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    Fee Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {studentData.fee_paid_percentage?.toFixed(1) || 0}%
                  </p>
                  {studentData.pending_fees && studentData.pending_fees > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Pending: ₹{studentData.pending_fees.toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Your academic data has not been uploaded yet. Please contact your tutor.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;