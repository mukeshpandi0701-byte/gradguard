import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, Trash2, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initializeModel, predictDropout } from "@/lib/mlModel";
import { DashboardLayout } from "@/components/DashboardLayout";
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

type Student = {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  attendance_percentage: number;
  fee_paid_percentage: number;
  pending_fees: number;
  internal_marks: number;
  riskLevel?: "low" | "medium" | "high";
  mlProbability?: number;
};

type StudentWithPrediction = Student & {
  riskLevel: "low" | "medium" | "high";
  mlProbability: number;
};

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
        .select("*")
        .order('roll_number', { ascending: true, nullsFirst: false });

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

      let { data: criteria } = await supabase
        .from("dropout_criteria")
        .select("*")
        .eq("user_id", user.id)
        .single();

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

      await supabase
        .from("predictions")
        .delete()
        .eq("user_id", user.id);

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
          user_id: user.id,
          student_id: student.id,
          ml_probability: prediction.mlProbability,
          rule_based_score: prediction.ruleBasedScore,
          final_risk_level: prediction.finalRiskLevel,
          suggestions: prediction.suggestions,
          insights: prediction.insights,
        });

        return {
          ...student,
          riskLevel: prediction.finalRiskLevel,
          mlProbability: prediction.mlProbability,
        } as StudentWithPrediction;
      });

      const { error: insertError } = await supabase
        .from("predictions")
        .insert(predictionsToInsert);

      if (insertError) throw insertError;

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

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setStudents(students.filter(s => s.id !== id));
      toast.success("Student deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete student");
      console.error(error);
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
      <Badge variant={variants[level as keyof typeof variants]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Student Analysis</h2>
            <p className="text-muted-foreground mt-2">
              View and analyze student dropout risk predictions
            </p>
          </div>
          <Button
            onClick={runPredictions}
            disabled={predicting || students.length === 0}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${predicting ? 'animate-spin' : ''}`} />
            {predicting ? "Running..." : "Run Predictions"}
          </Button>
        </div>

        {students.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                Upload student data to get started with dropout predictions
              </p>
              <Button onClick={() => navigate("/upload")}>
                Upload Student Data
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Students ({students.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Fees Paid</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.roll_number || "—"}
                      </TableCell>
                      <TableCell>{student.student_name}</TableCell>
                      <TableCell>{student.email || "—"}</TableCell>
                      <TableCell>
                        {student.attendance_percentage?.toFixed(1)}%
                      </TableCell>
                      <TableCell>{student.internal_marks}</TableCell>
                      <TableCell>
                        {student.fee_paid_percentage?.toFixed(1)}%
                      </TableCell>
                      <TableCell>{getRiskBadge(student.riskLevel)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link to={`/students/${student.id}/profile`}>
                            <Button variant="outline" size="sm" title="View Profile">
                              <User className="w-4 h-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" title="Delete Student">
                                <Trash2 className="w-4 h-4" />
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
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Students;
