import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ClipboardList, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Assignment {
  id: string;
  assignment_name: string;
  max_marks: number;
  subject_id: string;
  subject?: {
    subject_code: string;
    subject_name: string | null;
    branch: string;
  };
}

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
}

interface Score {
  student_id: string;
  marks_obtained: number | null;
}

const AssignmentScores = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [existingScores, setExistingScores] = useState<Score[]>([]);

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchAssignmentsForBranch();
      fetchStudentsForBranch();
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedAssignment) {
      fetchScoresForAssignment();
    }
  }, [selectedAssignment]);

  const checkAccessAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: branchAssignments } = await supabase
        .from("staff_branch_assignments")
        .select("branch")
        .eq("staff_user_id", user.id);

      if (!branchAssignments || branchAssignments.length === 0) {
        toast.error("No branches assigned to you");
        setLoading(false);
        return;
      }

      const branchList = branchAssignments.map(b => b.branch);
      setBranches(branchList);
      setSelectedBranch(branchList[0]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentsForBranch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get subjects for branch
      const { data: subjectsData } = await supabase
        .from("branch_subjects")
        .select("id, subject_code, subject_name, branch")
        .eq("branch", selectedBranch);

      if (!subjectsData || subjectsData.length === 0) {
        setAssignments([]);
        return;
      }

      const subjectIds = subjectsData.map(s => s.id);

      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*")
        .eq("staff_user_id", user.id)
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false });

      const assignmentsWithSubjects = (assignmentsData || []).map(a => ({
        ...a,
        subject: subjectsData.find(s => s.id === a.subject_id)
      }));

      setAssignments(assignmentsWithSubjects);
      if (assignmentsWithSubjects.length > 0) {
        setSelectedAssignment(assignmentsWithSubjects[0].id);
      } else {
        setSelectedAssignment("");
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const fetchStudentsForBranch = async () => {
    try {
      const { data: studentProfiles } = await supabase
        .from("student_profiles")
        .select("roll_number")
        .eq("branch", selectedBranch);

      if (!studentProfiles || studentProfiles.length === 0) {
        setStudents([]);
        return;
      }

      const rollNumbers = studentProfiles.map(sp => sp.roll_number).filter(Boolean);

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, student_name, roll_number")
        .in("roll_number", rollNumbers)
        .order("roll_number");

      setStudents(studentsData || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchScoresForAssignment = async () => {
    try {
      const { data: scoresData } = await supabase
        .from("student_assignment_scores")
        .select("student_id, marks_obtained")
        .eq("assignment_id", selectedAssignment);

      setExistingScores(scoresData || []);

      // Initialize scores state
      const scoresMap: Record<string, string> = {};
      students.forEach(student => {
        const existingScore = (scoresData || []).find(s => s.student_id === student.id);
        scoresMap[student.id] = existingScore?.marks_obtained?.toString() || "";
      });
      setScores(scoresMap);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  };

  const handleScoreChange = (studentId: string, value: string) => {
    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    const numValue = parseFloat(value);
    if (value !== "" && (isNaN(numValue) || numValue < 0 || numValue > assignment.max_marks)) {
      return;
    }

    setScores(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSaveScores = async () => {
    if (!selectedAssignment) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const upsertData = Object.entries(scores)
        .filter(([_, value]) => value !== "")
        .map(([studentId, marks]) => ({
          student_id: studentId,
          assignment_id: selectedAssignment,
          marks_obtained: parseFloat(marks),
          graded_by: user.id,
          graded_at: new Date().toISOString()
        }));

      if (upsertData.length === 0) {
        toast.info("No scores to save");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("student_assignment_scores")
        .upsert(upsertData, { onConflict: "student_id,assignment_id" });

      if (error) throw error;

      toast.success("Scores saved successfully");
      fetchScoresForAssignment();
    } catch (error) {
      console.error("Error saving scores:", error);
      toast.error("Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  const currentAssignment = assignments.find(a => a.id === selectedAssignment);
  const gradedCount = Object.values(scores).filter(s => s !== "").length;
  const averageScore = gradedCount > 0
    ? Object.values(scores)
        .filter(s => s !== "")
        .reduce((sum, s) => sum + parseFloat(s), 0) / gradedCount
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assignment Scores</h1>
          <p className="text-muted-foreground text-sm">View and grade student assignment submissions</p>
        </div>

        {/* Branch Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {branches.map((branch) => (
            <Button
              key={branch}
              variant={selectedBranch === branch ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBranch(branch)}
            >
              {branch}
            </Button>
          ))}
        </div>

        {/* Assignment Selector */}
        {assignments.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Select Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger className="w-full md:w-[400px]">
                  <SelectValue placeholder="Select an assignment" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.assignment_name} ({assignment.subject?.subject_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No assignments found. Create assignments in the Assignment Management page.
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {currentAssignment && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                    <p className="text-xl font-bold">{students.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Graded</p>
                    <p className="text-xl font-bold">{gradedCount} / {students.length}</p>
                  </div>
                </div>
                <Progress value={(gradedCount / students.length) * 100} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    Avg: {averageScore.toFixed(1)} / {currentAssignment.max_marks}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scores Table */}
        {currentAssignment && students.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                {currentAssignment.assignment_name}
                <Badge variant="outline">{currentAssignment.subject?.subject_code}</Badge>
              </CardTitle>
              <Button onClick={handleSaveScores} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Scores
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-[150px]">Marks (out of {currentAssignment.max_marks})</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const score = scores[student.id] || "";
                    const percentage = score ? (parseFloat(score) / currentAssignment.max_marks) * 100 : 0;
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.roll_number || "-"}</TableCell>
                        <TableCell>{student.student_name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={score}
                            onChange={(e) => handleScoreChange(student.id, e.target.value)}
                            placeholder="Enter marks"
                            min="0"
                            max={currentAssignment.max_marks}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          {score ? (
                            <Badge variant={percentage >= 50 ? "default" : "destructive"}>
                              {percentage.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {currentAssignment && students.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No students found in this branch.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssignmentScores;
