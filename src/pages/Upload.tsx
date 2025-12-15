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
import { Save, Edit, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  full_name: string | null;
  roll_number: string | null;
  branch: string | null;
  email: string;
}

const Upload = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [internalScore, setInternalScore] = useState<string>("");
  const [paidFees, setPaidFees] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [criteria, setCriteria] = useState<{ max_internal_marks: number; total_fees: number } | null>(null);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  useEffect(() => {
    fetchCriteria();
    fetchStudents();
  }, []);

  const fetchCriteria = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("dropout_criteria")
        .select("max_internal_marks, total_fees")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setCriteria(data);
      }
    } catch (error) {
      console.error("Error fetching criteria:", error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get assigned branches for staff
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

      // Fetch students from assigned branches
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

  const handleEditStudent = async (student: Student) => {
    setSelectedStudent(student);
    
    // Fetch current values from students table if exists
    if (student.roll_number) {
      const { data } = await supabase
        .from("students")
        .select("internal_marks, paid_fees")
        .eq("roll_number", student.roll_number)
        .maybeSingle();
      
      if (data) {
        setInternalScore(data.internal_marks?.toString() || "0");
        setPaidFees(data.paid_fees?.toString() || "0");
      } else {
        setInternalScore("0");
        setPaidFees("0");
      }
    } else {
      setInternalScore("0");
      setPaidFees("0");
    }
    
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedStudent) return;

    const internalScoreNum = parseFloat(internalScore);
    const paidFeesNum = parseFloat(paidFees);

    // Validation
    if (isNaN(internalScoreNum) || isNaN(paidFeesNum)) {
      toast.error("Please enter valid numbers");
      return;
    }

    if (internalScoreNum < 0) {
      toast.error("Internal score cannot be negative");
      return;
    }

    if (paidFeesNum < 0) {
      toast.error("Fees paid cannot be negative");
      return;
    }

    if (criteria) {
      if (internalScoreNum > criteria.max_internal_marks) {
        toast.error(`Internal score cannot exceed ${criteria.max_internal_marks}`);
        return;
      }

      if (paidFeesNum > criteria.total_fees) {
        toast.error(`Fees paid cannot exceed ₹${criteria.total_fees}`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if student record exists in students table
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", selectedStudent.roll_number)
        .maybeSingle();


      if (existingStudent) {
        // Update existing record (fee_paid_percentage and pending_fees are auto-calculated by DB)
        const { error } = await supabase
          .from("students")
          .update({
            internal_marks: internalScoreNum,
            paid_fees: paidFeesNum,
            total_fees: criteria?.total_fees || 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingStudent.id);

        if (error) throw error;
      } else {
        // Create new record in students table (fee_paid_percentage and pending_fees are auto-calculated by DB)
        const { error } = await supabase
          .from("students")
          .insert({
            user_id: user.id,
            student_name: selectedStudent.full_name || selectedStudent.email,
            roll_number: selectedStudent.roll_number,
            email: selectedStudent.email,
            department: selectedStudent.branch,
            internal_marks: internalScoreNum,
            paid_fees: paidFeesNum,
            total_fees: criteria?.total_fees || 0
          });

        if (error) throw error;
      }

      toast.success("Student details updated successfully!");
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update student details");
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
            Update internal scores and fees for students
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
                    Click Update to edit student details
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

        {/* Update Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Update Student Details</DialogTitle>
              <DialogDescription>
                Update details for {selectedStudent?.full_name || selectedStudent?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="dialog-internal-score">
                  Internal Score {criteria && `(Max: ${criteria.max_internal_marks})`}
                </Label>
                <Input
                  id="dialog-internal-score"
                  type="number"
                  placeholder="Enter internal score"
                  value={internalScore}
                  onChange={(e) => setInternalScore(e.target.value)}
                  min="0"
                  max={criteria?.max_internal_marks}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dialog-paid-fees">
                  Fees Paid (₹) {criteria && `(Max: ₹${criteria.total_fees})`}
                </Label>
                <Input
                  id="dialog-paid-fees"
                  type="number"
                  placeholder="Enter fees paid"
                  value={paidFees}
                  onChange={(e) => setPaidFees(e.target.value)}
                  min="0"
                  max={criteria?.total_fees}
                />
              </div>

              <Button 
                onClick={handleUpdate} 
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Upload;