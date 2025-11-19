import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initializeModel, predictDropout } from "@/lib/mlModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
  attendance_percentage: number;
  fee_paid_percentage: number;
  pending_fees: number;
  internal_marks: number;
  riskLevel?: "low" | "medium" | "high";
  mlProbability?: number;
}

interface StudentWithPrediction extends Student {
  riskLevel: "low" | "medium" | "high";
  mlProbability: number;
}

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);

  useEffect(() => {
    initializeModel().then(() => {
      fetchStudents();
    });
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*");

      if (error) throw error;

      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const runPredictions = async () => {
    if (students.length === 0) {
      toast.error("No students to predict");
      return;
    }

    setPredicting(true);
    const loadingToast = toast.loading("Running predictions...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch criteria
      let { data: criteria } = await supabase
        .from("dropout_criteria")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Create default criteria if none exist
      if (!criteria) {
        const { data: newCriteria, error } = await supabase
          .from("dropout_criteria")
          .insert({
            user_id: user.id,
            min_attendance_percentage: 75,
            min_internal_marks: 40,
            max_pending_fees: 10000,
            attendance_weightage: 0.4,
            internal_weightage: 0.3,
            fees_weightage: 0.3,
          })
          .select()
          .single();

        if (error) throw error;
        criteria = newCriteria;
      }

      // Run predictions for all students
      const predictionsToInsert = [];
      const studentsWithPredictions = students.map(student => {
        const prediction = predictDropout(
          {
            attendancePercentage: student.attendance_percentage || 0,
            feePaidPercentage: student.fee_paid_percentage || 0,
            pendingFees: student.pending_fees || 0,
            internalMarks: student.internal_marks || 0,
          },
          {
            minAttendance: criteria!.min_attendance_percentage,
            minMarks: criteria!.min_internal_marks,
            maxPendingFees: criteria!.max_pending_fees,
            attendanceWeight: criteria!.attendance_weightage,
            internalWeight: criteria!.internal_weightage,
            feesWeight: criteria!.fees_weightage,
          }
        );

        predictionsToInsert.push({
          student_id: student.id,
          user_id: user.id,
          ml_probability: prediction.mlProbability,
          rule_based_score: prediction.ruleBasedScore,
          final_risk_level: prediction.finalRiskLevel,
          insights: prediction.insights,
          suggestions: prediction.suggestions.join("; "),
        });

        return {
          ...student,
          riskLevel: prediction.finalRiskLevel,
          mlProbability: prediction.mlProbability,
        };
      });

      // Delete old predictions and insert new ones
      await supabase
        .from("predictions")
        .delete()
        .eq("user_id", user.id);

      const { error } = await supabase
        .from("predictions")
        .insert(predictionsToInsert);

      if (error) throw error;

      setStudents(studentsWithPredictions);
      toast.dismiss(loadingToast);
      toast.success("Predictions completed successfully!");
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to run predictions");
      console.error(error);
    } finally {
      setPredicting(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

      if (error) throw error;

      setStudents(students.filter(s => s.id !== studentId));
      toast.success("Student deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete student");
      console.error(error);
    }
  };

  const getRiskBadge = (level: "low" | "medium" | "high") => {
    const variants = {
      low: "default",
      medium: "secondary",
      high: "destructive",
    };
    const colors = {
      low: "bg-success text-success-foreground",
      medium: "bg-warning text-warning-foreground",
      high: "bg-destructive text-destructive-foreground",
    };
    
    return (
      <Badge className={colors[level]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button onClick={runPredictions} disabled={predicting || students.length === 0}>
            <RefreshCw className={`w-4 h-4 mr-2 ${predicting ? "animate-spin" : ""}`} />
            {predicting ? "Predicting..." : "Run Predictions"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Student Analysis</h1>
          <p className="text-muted-foreground">
            View detailed analysis and dropout risk predictions for all students
          </p>
        </div>

        {students.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No students found</p>
              <p className="text-muted-foreground mb-4">Upload a CSV file to get started</p>
              <Button onClick={() => navigate("/upload")}>
                Upload CSV
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Students ({students.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Internal Marks</TableHead>
                      <TableHead>Fees Paid</TableHead>
                      <TableHead>Pending Fees</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>ML Probability</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.student_name}</TableCell>
                        <TableCell>{student.roll_number || "—"}</TableCell>
                        <TableCell>{student.attendance_percentage?.toFixed(1)}%</TableCell>
                        <TableCell>{student.internal_marks}</TableCell>
                        <TableCell>{student.fee_paid_percentage?.toFixed(1)}%</TableCell>
                        <TableCell>₹{student.pending_fees}</TableCell>
                        <TableCell>
                          {student.riskLevel ? getRiskBadge(student.riskLevel) : "—"}
                        </TableCell>
                        <TableCell>
                          {student.mlProbability ? `${(student.mlProbability * 100).toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Student</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {student.student_name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteStudent(student.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Students;
