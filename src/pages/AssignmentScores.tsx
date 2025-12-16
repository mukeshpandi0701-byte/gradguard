import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, AlertCircle, Eye, Trash2, Calendar } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Assignment {
  id: string;
  branch: string;
  assignment_number: string;
  assignment_title: string;
  max_marks: number;
  created_at: string;
}

interface AssignmentMark {
  id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  assignment_title: string | null;
  submission_date: string | null;
  student_name: string;
  roll_number: string;
  subject_code: string;
  subject_name: string | null;
}

interface Subject {
  id: string;
  subject_code: string;
  subject_name: string | null;
}

interface SubjectInfo {
  title: string | null;
  date: string | null;
}

const AssignmentScores = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentMarks, setAssignmentMarks] = useState<AssignmentMark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectInfoMap, setSubjectInfoMap] = useState<Map<string, SubjectInfo>>(new Map());
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: branchData } = await supabase
        .from("staff_branch_assignments")
        .select("branch")
        .eq("staff_user_id", user.id);

      const branches = (branchData || []).map(b => b.branch);
      setAssignedBranches(branches);

      if (branches.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const { data: assignmentsData, error } = await supabase
        .from("branch_assignments")
        .select("*")
        .in("branch", branches)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments(assignmentsData || []);
    } catch (error: any) {
      toast.error("Failed to load assignments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentDetails = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setLoadingDetails(true);
    setDetailsOpen(true);

    try {
      const { data: subjectsData } = await supabase
        .from("branch_subjects")
        .select("id, subject_code, subject_name")
        .eq("branch", assignment.branch)
        .order("subject_code");

      setSubjects(subjectsData || []);

      const { data: marksData, error } = await supabase
        .from("student_branch_assignment_marks")
        .select(`
          id,
          student_id,
          subject_id,
          marks_obtained,
          assignment_title,
          submission_date,
          students!inner(student_name, roll_number),
          branch_subjects!inner(subject_code, subject_name)
        `)
        .eq("assignment_id", assignment.id);

      if (error) throw error;

      const formattedMarks: AssignmentMark[] = (marksData || []).map((m: any) => ({
        id: m.id,
        student_id: m.student_id,
        subject_id: m.subject_id,
        marks_obtained: m.marks_obtained,
        assignment_title: m.assignment_title,
        submission_date: m.submission_date,
        student_name: m.students?.student_name || "Unknown",
        roll_number: m.students?.roll_number || "—",
        subject_code: m.branch_subjects?.subject_code || "",
        subject_name: m.branch_subjects?.subject_name
      }));

      setAssignmentMarks(formattedMarks);

      // Build subject info map (title and date per subject)
      const infoMap = new Map<string, SubjectInfo>();
      formattedMarks.forEach(m => {
        if (!infoMap.has(m.subject_id)) {
          infoMap.set(m.subject_id, {
            title: m.assignment_title,
            date: m.submission_date
          });
        }
      });
      setSubjectInfoMap(infoMap);
    } catch (error: any) {
      toast.error("Failed to load assignment details");
      console.error(error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment? All marks will be lost.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("branch_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("Assignment deleted successfully");
      fetchData();
      setDetailsOpen(false);
    } catch (error: any) {
      toast.error("Failed to delete assignment");
      console.error(error);
    }
  };

  const filteredAssignments = selectedBranch === "all"
    ? assignments
    : assignments.filter(a => a.branch === selectedBranch);

  const getStudentMarksMap = () => {
    const studentMap = new Map<string, { name: string; roll: string; marks: Map<string, number> }>();
    
    assignmentMarks.forEach(mark => {
      if (!studentMap.has(mark.student_id)) {
        studentMap.set(mark.student_id, {
          name: mark.student_name,
          roll: mark.roll_number,
          marks: new Map()
        });
      }
      studentMap.get(mark.student_id)!.marks.set(mark.subject_id, mark.marks_obtained);
    });
    
    return studentMap;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
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
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-primary" />
            Assignment Scores
          </h2>
          <p className="text-muted-foreground mt-2">
            View and manage assignment scores for students
          </p>
        </div>

        {assignedBranches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Branches Assigned</h3>
              <p className="text-muted-foreground text-center">
                Contact your HOD to get branch assignments
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={selectedBranch} onValueChange={setSelectedBranch}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All ({assignments.length})
              </TabsTrigger>
              {assignedBranches.map(branch => (
                <TabsTrigger key={branch} value={branch}>
                  {branch} ({assignments.filter(a => a.branch === branch).length})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedBranch}>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Saved Assignments</CardTitle>
                  <CardDescription>
                    Click View to see student scores, titles, and submission dates for each assignment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredAssignments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No assignments saved yet. Create assignments in Academic Updates.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Max Marks</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAssignments.map((assignment) => (
                            <TableRow key={assignment.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">{assignment.assignment_number}</TableCell>
                              <TableCell>{assignment.assignment_title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{assignment.branch}</Badge>
                              </TableCell>
                              <TableCell>{assignment.max_marks}</TableCell>
                              <TableCell>
                                {new Date(assignment.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => fetchAssignmentDetails(assignment)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteAssignment(assignment.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Assignment Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="bg-card max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Assignment #{selectedAssignment?.assignment_number}
              </DialogTitle>
              <DialogDescription>
                Branch: {selectedAssignment?.branch} | Max Marks: {selectedAssignment?.max_marks}
              </DialogDescription>
            </DialogHeader>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : assignmentMarks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No marks recorded for this assignment yet.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Subject-wise Titles and Dates */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Per-Subject Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {subjects.map(subject => {
                        const info = subjectInfoMap.get(subject.id);
                        return (
                          <div key={subject.id} className="border rounded-lg p-3 space-y-1">
                            <div className="font-mono text-sm font-medium">{subject.subject_code}</div>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Title:</span> {info?.title || "—"}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span className="font-medium">Due:</span> {formatDate(info?.date)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Student Marks Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Student Name</TableHead>
                        {subjects.map(subject => (
                          <TableHead key={subject.id} className="text-center">
                            <span className="font-mono text-xs">{subject.subject_code}</span>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Average</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(getStudentMarksMap().entries()).map(([studentId, data]) => {
                        const marksArray = Array.from(data.marks.values());
                        const avg = marksArray.length > 0 
                          ? marksArray.reduce((a, b) => a + b, 0) / marksArray.length 
                          : 0;
                        
                        return (
                          <TableRow key={studentId}>
                            <TableCell className="font-medium">{data.roll}</TableCell>
                            <TableCell>{data.name}</TableCell>
                            {subjects.map(subject => (
                              <TableCell key={subject.id} className="text-center">
                                {data.marks.get(subject.id) ?? "—"}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold text-primary">
                              {avg.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AssignmentScores;
