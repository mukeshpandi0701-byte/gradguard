import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Edit, AlertCircle, BookOpen, DollarSign, ClipboardList } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  full_name: string | null;
  roll_number: string | null;
  branch: string | null;
  email: string;
}

interface Subject {
  id: string;
  subject_code: string;
  subject_name: string | null;
}

interface AssignmentData {
  number: string;
  title: string;
  marks: Record<string, string>; // subject_id -> marks
}

const Upload = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paidFees, setPaidFees] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [criteria, setCriteria] = useState<{ max_internal_marks: number; total_fees: number } | null>(null);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("internal-marks");
  
  // Multi-subject state
  const [branchSubjects, setBranchSubjects] = useState<Subject[]>([]);
  const [subjectMarks, setSubjectMarks] = useState<Record<string, string>>({});
  
  // Assignment state
  const [assignmentData, setAssignmentData] = useState<AssignmentData>({
    number: "",
    title: "",
    marks: {}
  });

  useEffect(() => {
    fetchCriteria();
    fetchStudents();
  }, []);

  const fetchCriteria = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.department) {
        const { data: hodProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("department", profile.department)
          .eq("panel_type", "hod");

        if (hodProfiles && hodProfiles.length > 0) {
          const hodId = hodProfiles[0].id;
          const { data: hodCriteria } = await supabase
            .from("dropout_criteria")
            .select("max_internal_marks, total_fees")
            .eq("user_id", hodId)
            .maybeSingle();

          if (hodCriteria) {
            setCriteria(hodCriteria);
            return;
          }
        }
      }

      setCriteria({ max_internal_marks: 100, total_fees: 100000 });
    } catch (error) {
      console.error("Error fetching criteria:", error);
      setCriteria({ max_internal_marks: 100, total_fees: 100000 });
    }
  };

  const fetchStudents = async () => {
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
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: studentProfiles, error } = await supabase
        .from("student_profiles")
        .select("id, full_name, roll_number, branch, email")
        .in("branch", branches)
        .order("roll_number");

      if (error) throw error;
      setStudents(studentProfiles || []);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectsForBranch = async (branch: string) => {
    try {
      const { data, error } = await supabase
        .from("branch_subjects")
        .select("id, subject_code, subject_name")
        .eq("branch", branch)
        .order("subject_code");

      if (error) throw error;
      setBranchSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      setBranchSubjects([]);
    }
  };

  const fetchExistingMarks = async (studentId: string, studentRollNumber: string | null) => {
    try {
      if (!studentRollNumber) return;

      const { data: studentRecord } = await supabase
        .from("students")
        .select("id, paid_fees")
        .eq("roll_number", studentRollNumber)
        .maybeSingle();

      if (studentRecord) {
        setPaidFees(studentRecord.paid_fees?.toString() || "0");

        const { data: marks } = await supabase
          .from("student_subject_marks")
          .select("subject_id, internal_marks")
          .eq("student_id", studentRecord.id);

        const marksMap: Record<string, string> = {};
        (marks || []).forEach(m => {
          marksMap[m.subject_id] = m.internal_marks?.toString() || "0";
        });
        setSubjectMarks(marksMap);
      } else {
        setPaidFees("0");
        setSubjectMarks({});
      }
    } catch (error) {
      console.error("Error fetching existing marks:", error);
      setPaidFees("0");
      setSubjectMarks({});
    }
  };

  const handleEditStudent = async (student: Student) => {
    setSelectedStudent(student);
    setSubjectMarks({});
    setAssignmentData({ number: "", title: "", marks: {} });
    setActiveTab("internal-marks");
    
    if (student.branch) {
      await fetchSubjectsForBranch(student.branch);
    }
    
    await fetchExistingMarks(student.id, student.roll_number);
    
    setDialogOpen(true);
  };

  const handleSubjectMarkChange = (subjectId: string, value: string) => {
    setSubjectMarks(prev => ({
      ...prev,
      [subjectId]: value
    }));
  };

  const handleAssignmentMarkChange = (subjectId: string, value: string) => {
    setAssignmentData(prev => ({
      ...prev,
      marks: {
        ...prev.marks,
        [subjectId]: value
      }
    }));
  };

  const calculateAverageMarks = (): number => {
    if (branchSubjects.length === 0) return 0;
    
    let total = 0;
    let count = 0;
    
    branchSubjects.forEach(subject => {
      const mark = parseFloat(subjectMarks[subject.id] || "0");
      if (!isNaN(mark)) {
        total += mark;
        count++;
      }
    });
    
    return count > 0 ? total / count : 0;
  };

  const handleSaveInternalMarks = async () => {
    if (!selectedStudent) return;

    // Validate subject marks
    for (const subject of branchSubjects) {
      const mark = parseFloat(subjectMarks[subject.id] || "0");
      if (isNaN(mark) || mark < 0) {
        toast.error(`Invalid marks for ${subject.subject_code}`);
        return;
      }
      if (criteria && mark > criteria.max_internal_marks) {
        toast.error(`Marks for ${subject.subject_code} cannot exceed ${criteria.max_internal_marks}`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const averageMarks = calculateAverageMarks();

      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", selectedStudent.roll_number)
        .maybeSingle();

      let studentRecordId: string;

      if (existingStudent) {
        const { error } = await supabase
          .from("students")
          .update({
            internal_marks: averageMarks,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingStudent.id);

        if (error) throw error;
        studentRecordId = existingStudent.id;
      } else {
        const { data: newStudent, error } = await supabase
          .from("students")
          .insert({
            user_id: user.id,
            student_name: selectedStudent.full_name || selectedStudent.email,
            roll_number: selectedStudent.roll_number,
            email: selectedStudent.email,
            department: selectedStudent.branch,
            internal_marks: averageMarks,
            total_fees: criteria?.total_fees || 0
          })
          .select("id")
          .single();

        if (error) throw error;
        studentRecordId = newStudent.id;
      }

      if (branchSubjects.length > 0) {
        const marksToUpsert = branchSubjects.map(subject => ({
          student_id: studentRecordId,
          subject_id: subject.id,
          internal_marks: parseFloat(subjectMarks[subject.id] || "0"),
          updated_by: user.id
        }));

        const { error: marksError } = await supabase
          .from("student_subject_marks")
          .upsert(marksToUpsert, { onConflict: "student_id,subject_id" });

        if (marksError) throw marksError;
      }

      toast.success("Internal marks saved successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save internal marks");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedStudent) return;

    if (!assignmentData.number.trim()) {
      toast.error("Please enter assignment number");
      return;
    }

    if (!assignmentData.title.trim()) {
      toast.error("Please enter assignment title");
      return;
    }

    // Validate assignment marks
    for (const subject of branchSubjects) {
      const mark = parseFloat(assignmentData.marks[subject.id] || "0");
      if (isNaN(mark) || mark < 0) {
        toast.error(`Invalid marks for ${subject.subject_code}`);
        return;
      }
      if (criteria && mark > criteria.max_internal_marks) {
        toast.error(`Marks for ${subject.subject_code} cannot exceed ${criteria.max_internal_marks}`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get or create the assignment record
      let assignmentId: string;

      const { data: existingAssignment } = await supabase
        .from("branch_assignments")
        .select("id")
        .eq("branch", selectedStudent.branch)
        .eq("assignment_number", assignmentData.number)
        .maybeSingle();

      if (existingAssignment) {
        assignmentId = existingAssignment.id;
      } else {
        const { data: newAssignment, error: assignmentError } = await supabase
          .from("branch_assignments")
          .insert({
            branch: selectedStudent.branch,
            assignment_number: assignmentData.number,
            assignment_title: assignmentData.title,
            staff_user_id: user.id,
            max_marks: criteria?.max_internal_marks || 100
          })
          .select("id")
          .single();

        if (assignmentError) throw assignmentError;
        assignmentId = newAssignment.id;
      }

      // Get student record ID
      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", selectedStudent.roll_number)
        .maybeSingle();

      if (!studentRecord) {
        toast.error("Student record not found. Please save internal marks first.");
        setSaving(false);
        return;
      }

      // Upsert assignment marks for each subject
      const marksToUpsert = branchSubjects.map(subject => ({
        assignment_id: assignmentId,
        student_id: studentRecord.id,
        subject_id: subject.id,
        marks_obtained: parseFloat(assignmentData.marks[subject.id] || "0")
      }));

      const { error: marksError } = await supabase
        .from("student_branch_assignment_marks")
        .upsert(marksToUpsert, { onConflict: "assignment_id,student_id,subject_id" });

      if (marksError) throw marksError;

      toast.success(`Assignment "${assignmentData.title}" (No. ${assignmentData.number}) saved successfully!`);
      setAssignmentData({ number: "", title: "", marks: {} });
    } catch (error: any) {
      toast.error(error.message || "Failed to save assignment");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFees = async () => {
    if (!selectedStudent) return;

    const paidFeesNum = parseFloat(paidFees);

    if (isNaN(paidFeesNum)) {
      toast.error("Please enter valid fees amount");
      return;
    }

    if (paidFeesNum < 0) {
      toast.error("Fees paid cannot be negative");
      return;
    }

    if (criteria && paidFeesNum > criteria.total_fees) {
      toast.error(`Fees paid cannot exceed ₹${criteria.total_fees}`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", selectedStudent.roll_number)
        .maybeSingle();

      if (existingStudent) {
        const { error } = await supabase
          .from("students")
          .update({
            paid_fees: paidFeesNum,
            total_fees: criteria?.total_fees || 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingStudent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("students")
          .insert({
            user_id: user.id,
            student_name: selectedStudent.full_name || selectedStudent.email,
            roll_number: selectedStudent.roll_number,
            email: selectedStudent.email,
            department: selectedStudent.branch,
            paid_fees: paidFeesNum,
            total_fees: criteria?.total_fees || 0
          });

        if (error) throw error;
      }

      toast.success("Fees updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update fees");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = selectedBranch === "all" 
    ? students 
    : students.filter(s => s.branch === selectedBranch);

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
          <h2 className="text-3xl font-bold">Academic Updates</h2>
          <p className="text-muted-foreground mt-2">
            Update internal marks, assignments, and fees for students
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
                All ({students.length})
              </TabsTrigger>
              {assignedBranches.map(branch => (
                <TabsTrigger key={branch} value={branch}>
                  {branch} ({students.filter(s => s.branch === branch).length})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedBranch}>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Students</CardTitle>
                  <CardDescription>
                    Click Update to edit student marks, assignments, and fees
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No students found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Roll No</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.map((student) => (
                            <TableRow key={student.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">{student.roll_number || "—"}</TableCell>
                              <TableCell>{student.full_name || student.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{student.branch}</Badge>
                              </TableCell>
                              <TableCell>{student.email}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStudent(student)}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Update
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

        {/* Update Dialog with Three Cards */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Student Details</DialogTitle>
              <DialogDescription>
                {selectedStudent?.full_name || selectedStudent?.email} ({selectedStudent?.roll_number})
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="internal-marks" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">Internal Marks</span>
                  <span className="sm:hidden">Marks</span>
                </TabsTrigger>
                <TabsTrigger value="assignments" className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline">Assignments</span>
                  <span className="sm:hidden">Assign</span>
                </TabsTrigger>
                <TabsTrigger value="fees" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Fees</span>
                </TabsTrigger>
              </TabsList>

              {/* Internal Marks Card */}
              <TabsContent value="internal-marks">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      Subject-wise Internal Marks
                    </CardTitle>
                    <CardDescription>
                      Max marks per subject: {criteria?.max_internal_marks || 100}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {branchSubjects.length > 0 ? (
                      <>
                        {branchSubjects.map(subject => (
                          <div key={subject.id} className="grid gap-2">
                            <Label htmlFor={`subject-${subject.id}`} className="flex items-center gap-2">
                              <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                                {subject.subject_code}
                              </span>
                              {subject.subject_name && (
                                <span className="text-muted-foreground text-sm">
                                  {subject.subject_name}
                                </span>
                              )}
                            </Label>
                            <Input
                              id={`subject-${subject.id}`}
                              type="number"
                              placeholder="Enter marks"
                              value={subjectMarks[subject.id] || ""}
                              onChange={(e) => handleSubjectMarkChange(subject.id, e.target.value)}
                              min="0"
                              max={criteria?.max_internal_marks}
                            />
                          </div>
                        ))}
                        
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Average Internal Marks:</span>
                            <span className="text-lg font-bold text-primary">
                              {calculateAverageMarks().toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <Button onClick={handleSaveInternalMarks} disabled={saving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : "Save Internal Marks"}
                        </Button>
                      </>
                    ) : (
                      <div className="bg-warning/10 border border-warning/30 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-warning">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">No subjects configured</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ask your HOD to configure subjects for this branch.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Assignments Card */}
              <TabsContent value="assignments">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-primary" />
                      Assignment Details
                    </CardTitle>
                    <CardDescription>
                      Enter assignment number, title, and marks for all subjects
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assignment-number">Assignment Number</Label>
                        <Input
                          id="assignment-number"
                          type="text"
                          placeholder="e.g., 1, 2, 3..."
                          value={assignmentData.number}
                          onChange={(e) => setAssignmentData(prev => ({ ...prev, number: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assignment-title">Assignment Title</Label>
                        <Input
                          id="assignment-title"
                          type="text"
                          placeholder="e.g., Lab Assignment 1"
                          value={assignmentData.title}
                          onChange={(e) => setAssignmentData(prev => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                    </div>

                    {branchSubjects.length > 0 ? (
                      <>
                        <div className="border-t pt-4">
                          <Label className="text-sm font-medium mb-3 block">Marks for Each Subject</Label>
                          {branchSubjects.map(subject => (
                            <div key={subject.id} className="grid gap-2 mb-3">
                              <Label htmlFor={`assign-${subject.id}`} className="flex items-center gap-2">
                                <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                                  {subject.subject_code}
                                </span>
                                {subject.subject_name && (
                                  <span className="text-muted-foreground text-sm">
                                    {subject.subject_name}
                                  </span>
                                )}
                              </Label>
                              <Input
                                id={`assign-${subject.id}`}
                                type="number"
                                placeholder="Enter assignment marks"
                                value={assignmentData.marks[subject.id] || ""}
                                onChange={(e) => handleAssignmentMarkChange(subject.id, e.target.value)}
                                min="0"
                                max={criteria?.max_internal_marks}
                              />
                            </div>
                          ))}
                        </div>

                        <Button onClick={handleSaveAssignment} disabled={saving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : "Save Assignment"}
                        </Button>
                      </>
                    ) : (
                      <div className="bg-warning/10 border border-warning/30 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-warning">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">No subjects configured</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ask your HOD to configure subjects for this branch.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Fees Card */}
              <TabsContent value="fees">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      Fees Details
                    </CardTitle>
                    <CardDescription>
                      Total fees: ₹{criteria?.total_fees?.toLocaleString() || "100,000"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="paid-fees">Paid Fees (₹)</Label>
                      <Input
                        id="paid-fees"
                        type="number"
                        placeholder="Enter paid fees amount"
                        value={paidFees}
                        onChange={(e) => setPaidFees(e.target.value)}
                        min="0"
                        max={criteria?.total_fees}
                      />
                    </div>

                    {paidFees && criteria && (
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Paid:</span>
                          <span className="font-medium text-green-600">
                            ₹{parseFloat(paidFees || "0").toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Pending:</span>
                          <span className="font-medium text-red-600">
                            ₹{Math.max(0, criteria.total_fees - parseFloat(paidFees || "0")).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Fee Paid %:</span>
                          <span className="font-bold text-primary">
                            {((parseFloat(paidFees || "0") / criteria.total_fees) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}

                    <Button onClick={handleSaveFees} disabled={saving} className="w-full">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? "Saving..." : "Save Fees"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Upload;
