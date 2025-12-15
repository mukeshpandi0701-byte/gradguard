import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initializeModel, predictDropout } from "@/lib/mlModel";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Student = {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  department: string | null;
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
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [isHOD, setIsHOD] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    if (!roleChecked) return;
    
    if (!isHOD) {
      // Initialize model in background only for staff (non-blocking)
      initializeModel().catch(console.error);
    }
    fetchStudents();
  }, [roleChecked, isHOD]);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "hod")
          .maybeSingle();
        
        if (roleData) {
          setIsHOD(true);
          setRoleChecked(true);
          return;
        }
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("panel_type")
          .eq("id", user.id)
          .maybeSingle();
        setIsHOD(profile?.panel_type === "hod");
      }
      setRoleChecked(true);
    } catch (error) {
      console.error("Error checking user role:", error);
      setRoleChecked(true);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if HOD - if so, fetch from student_profiles (logged-in students)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "hod")
        .maybeSingle();
      
      const userIsHOD = !!roleData;

      if (userIsHOD) {
        // HOD: Fetch all logged-in students from student_profiles
        const { data: studentProfiles, error: profilesError } = await supabase
          .from("student_profiles")
          .select("*")
          .order('roll_number', { ascending: true, nullsFirst: false });

        if (profilesError) throw profilesError;

        // Fetch attendance records aggregated by student_id
        const profileIds = (studentProfiles || []).map(sp => sp.id);
        const { data: attendanceRecords } = await supabase
          .from("attendance_records")
          .select("student_id, sessions_attended, max_sessions")
          .in("student_id", profileIds);

        // Aggregate attendance per student
        const attendanceMap = new Map<string, { attended: number; total: number }>();
        (attendanceRecords || []).forEach((record: any) => {
          const current = attendanceMap.get(record.student_id) || { attended: 0, total: 0 };
          current.attended += record.sessions_attended;
          current.total += record.max_sessions;
          attendanceMap.set(record.student_id, current);
        });

        // Map student_profiles to Student type for display
        const studentsFromProfiles = (studentProfiles || []).map(sp => {
          const attendanceData = attendanceMap.get(sp.id);
          const attendancePercentage = attendanceData && attendanceData.total > 0
            ? Math.min(100, (attendanceData.attended / attendanceData.total) * 100)
            : 0;

          return {
            id: sp.id,
            student_name: sp.full_name || sp.email,
            roll_number: sp.roll_number,
            email: sp.email,
            department: sp.branch || sp.department,
            attendance_percentage: attendancePercentage,
            fee_paid_percentage: 0,
            pending_fees: 0,
            internal_marks: 0,
            riskLevel: undefined,
            mlProbability: undefined,
          };
        });

        setStudents(studentsFromProfiles);
        
        // Extract unique departments/branches
        const uniqueDepts = Array.from(new Set(studentsFromProfiles.map(s => s.department).filter(Boolean))) as string[];
        setDepartments(uniqueDepts);
      } else {
        // Staff: Fetch from student_profiles, filtered by assigned branches
        const { data: branchData } = await supabase
          .from("staff_branch_assignments")
          .select("branch")
          .eq("staff_user_id", user.id);

        const branches = (branchData || []).map(b => b.branch);
        setAssignedBranches(branches);

        if (branches.length === 0) {
          setStudents([]);
          setDepartments([]);
          return;
        }

        // Fetch student profiles from assigned branches
        const { data: studentProfiles, error: profilesError } = await supabase
          .from("student_profiles")
          .select("*")
          .in("branch", branches)
          .order('roll_number', { ascending: true, nullsFirst: false });

        if (profilesError) throw profilesError;

        // Fetch student academic data from students table
        const rollNumbers = (studentProfiles || []).map(sp => sp.roll_number).filter(Boolean);
        const { data: studentsData } = await supabase
          .from("students")
          .select("roll_number, attendance_percentage, fee_paid_percentage, pending_fees, internal_marks")
          .in("roll_number", rollNumbers);

        // Create a map of student data by roll_number
        const studentsDataMap = new Map(
          (studentsData || []).map(s => [s.roll_number, s])
        );

        // Fetch attendance records aggregated by student_id (student_profiles.id)
        const profileIds = (studentProfiles || []).map(sp => sp.id);
        const { data: attendanceRecords } = await supabase
          .from("attendance_records")
          .select("student_id, sessions_attended, max_sessions")
          .in("student_id", profileIds);

        // Aggregate attendance per student
        const attendanceMap = new Map<string, { attended: number; total: number }>();
        (attendanceRecords || []).forEach((record: any) => {
          const current = attendanceMap.get(record.student_id) || { attended: 0, total: 0 };
          current.attended += record.sessions_attended;
          current.total += record.max_sessions;
          attendanceMap.set(record.student_id, current);
        });

        // Fetch all predictions for this user
        const { data: predictionsData, error: predictionsError } = await supabase
          .from("predictions")
          .select("student_id, ml_probability, final_risk_level")
          .eq("user_id", user.id);

        if (predictionsError) throw predictionsError;

        // Create a map of predictions by student_id
        const predictionsMap = new Map(
          (predictionsData || []).map(p => [p.student_id, p])
        );

        // Map student_profiles to Student type with predictions and academic data
        const studentsFromProfiles = (studentProfiles || []).map(sp => {
          const academicData = studentsDataMap.get(sp.roll_number);
          const attendanceData = attendanceMap.get(sp.id);
          
          // Calculate attendance percentage from attendance_records
          const attendancePercentage = attendanceData && attendanceData.total > 0
            ? Math.min(100, (attendanceData.attended / attendanceData.total) * 100)
            : (academicData?.attendance_percentage || 0);

          return {
            id: sp.id,
            student_name: sp.full_name || sp.email,
            roll_number: sp.roll_number,
            email: sp.email,
            department: sp.branch || sp.department,
            attendance_percentage: attendancePercentage,
            fee_paid_percentage: academicData?.fee_paid_percentage || 0,
            pending_fees: academicData?.pending_fees || 0,
            internal_marks: academicData?.internal_marks || 0,
            riskLevel: predictionsMap.get(sp.id)?.final_risk_level,
            mlProbability: predictionsMap.get(sp.id)?.ml_probability,
          };
        });

        setStudents(studentsFromProfiles);
        
        // Extract unique departments/branches
        const uniqueDepts = Array.from(new Set(studentsFromProfiles.map(s => s.department).filter(Boolean))) as string[];
        setDepartments(uniqueDepts);
      }
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

  const filteredStudents = selectedDepartment === "all" 
    ? students 
    : students.filter(s => s.department === selectedDepartment);

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
      <div className="space-y-4 w-full">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">{isHOD ? "Student Monitoring" : "Student Analysis"}</h2>
            <p className="text-muted-foreground mt-2">
              {isHOD 
                ? "View logged-in students from your department" 
                : "View and analyze student dropout risk predictions"
              }
            </p>
          </div>
          {!isHOD && (
            <Button
              onClick={runPredictions}
              disabled={predicting || students.length === 0}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${predicting ? 'animate-spin' : ''}`} />
              {predicting ? "Running..." : "Run Predictions"}
            </Button>
          )}
        </div>

        {students.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {isHOD 
                  ? "No students have logged in to the system yet"
                  : "Upload student data to get started with dropout predictions"
                }
              </p>
              {!isHOD && (
                <Button onClick={() => navigate("/upload")}>
                  Upload Student Data
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <div className="mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All Departments ({students.length})
                </TabsTrigger>
                {departments.map(dept => (
                  <TabsTrigger key={dept} value={dept}>
                    {dept} ({students.filter(s => s.department === dept).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <TabsContent value={selectedDepartment}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    Students ({filteredStudents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Attendance</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead>Fees Paid</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            {student.roll_number || "—"}
                          </TableCell>
                          <TableCell>{student.student_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{student.department || "—"}</Badge>
                          </TableCell>
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
                            <Link to={`/students/${student.id}/profile`}>
                              <Button variant="outline" size="sm" title="View Profile">
                                <User className="w-4 h-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Students;
