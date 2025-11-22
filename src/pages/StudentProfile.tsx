import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StudentProfile {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  phone_number: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  attendance_percentage: number | null;
  internal_marks: number;
  fee_paid_percentage: number | null;
  predictions?: Array<{
    final_risk_level: string;
    ml_probability: number;
    insights: string | null;
    suggestions: string | null;
  }>;
}

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentProfile();
  }, [id]);

  const fetchStudentProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          predictions(
            final_risk_level,
            ml_probability,
            insights,
            suggestions
          )
        `)
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setStudent(data as StudentProfile);
    } catch (error: any) {
      toast.error("Failed to fetch student profile");
      console.error(error);
      navigate("/students");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low": return "bg-green-100 text-green-800 border-green-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "high": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Student Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/students")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const prediction = student.predictions?.[0];
  const riskLevel = prediction?.final_risk_level || "unknown";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/students")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Students
          </Button>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <span className="font-semibold">Student Profile</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Header Card */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{student.student_name}</CardTitle>
                <CardDescription className="mt-2">
                  {student.roll_number && `Roll No: ${student.roll_number}`}
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`${getRiskColor(riskLevel)} px-4 py-2 text-sm font-semibold`}
              >
                {riskLevel.toUpperCase()} RISK
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {student.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{student.email}</p>
                  </div>
                </div>
              )}
              {student.phone_number && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{student.phone_number}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Performance */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Academic Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Attendance</p>
                <p className="font-semibold text-lg">
                  {student.attendance_percentage?.toFixed(1) || 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Internal Marks</p>
                <p className="font-semibold text-lg">{student.internal_marks}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fees Paid</p>
                <p className="font-semibold text-lg">
                  {student.fee_paid_percentage?.toFixed(1) || 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        {prediction && (
          <>
            {prediction.insights && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">AI Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{prediction.insights}</p>
                </CardContent>
              </Card>
            )}

            {prediction.suggestions && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">Suggestions for Improvement</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{prediction.suggestions}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default StudentProfile;
