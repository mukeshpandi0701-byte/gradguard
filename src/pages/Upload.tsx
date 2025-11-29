import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, Users, Edit } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
  department: string | null;
  internal_marks: number;
  attended_hours: number;
  paid_fees: number;
}

const Upload = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [internalScore, setInternalScore] = useState<string>("");
  const [attendedHours, setAttendedHours] = useState<string>("");
  const [paidFees, setPaidFees] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchStudentsByDepartment();
    }
  }, [selectedDepartment]);

  const fetchDepartments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("students")
        .select("department")
        .eq("user_id", user.id)
        .not("department", "is", null);

      if (error) throw error;

      const uniqueDepartments = Array.from(new Set(data.map(s => s.department).filter(Boolean))) as string[];
      setDepartments(uniqueDepartments);
    } catch (error: any) {
      toast.error("Failed to load departments");
      console.error(error);
    }
  };

  const fetchStudentsByDepartment = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, roll_number, department, internal_marks, attended_hours, paid_fees")
        .eq("user_id", user.id)
        .eq("department", selectedDepartment)
        .order("roll_number");

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setInternalScore(student.internal_marks.toString());
    setAttendedHours(student.attended_hours.toString());
    setPaidFees(student.paid_fees.toString());
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedStudent) return;

    const internalScoreNum = parseFloat(internalScore);
    const attendedHoursNum = parseFloat(attendedHours);
    const paidFeesNum = parseFloat(paidFees);

    if (isNaN(internalScoreNum) || isNaN(attendedHoursNum) || isNaN(paidFeesNum)) {
      toast.error("Please enter valid numbers");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          internal_marks: internalScoreNum,
          attended_hours: attendedHoursNum,
          paid_fees: paidFeesNum,
        })
        .eq("id", selectedStudent.id);

      if (error) throw error;

      toast.success("Student details updated successfully!");
      setDialogOpen(false);
      fetchStudentsByDepartment();
    } catch (error: any) {
      toast.error(error.message || "Failed to update student details");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold">Update Student Details</h2>
          <p className="text-muted-foreground mt-2">
            Select a class and update student information
          </p>
        </div>

        {/* Department Selection */}
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Select Class
            </CardTitle>
            <CardDescription>
              Choose the class you want to update
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="department-select">Department/Class</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger id="department-select" className="bg-background">
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {departments.length === 0 ? (
                    <SelectItem value="empty" disabled>No classes found</SelectItem>
                  ) : (
                    departments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        {selectedDepartment && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Students in {selectedDepartment}</CardTitle>
              <CardDescription>
                Click on a student to update their details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No students found in this class</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Internal Score</TableHead>
                        <TableHead>Attended Hours</TableHead>
                        <TableHead>Fees Paid</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{student.roll_number || "—"}</TableCell>
                          <TableCell>{student.student_name}</TableCell>
                          <TableCell>{student.internal_marks}</TableCell>
                          <TableCell>{student.attended_hours}</TableCell>
                          <TableCell>₹{student.paid_fees}</TableCell>
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
        )}

        {/* Update Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Update Student Details</DialogTitle>
              <DialogDescription>
                Update details for {selectedStudent?.student_name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="dialog-internal-score">Internal Score</Label>
                <Input
                  id="dialog-internal-score"
                  type="number"
                  placeholder="Enter internal score"
                  value={internalScore}
                  onChange={(e) => setInternalScore(e.target.value)}
                  min="0"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dialog-attended-hours">Attended Hours</Label>
                <Input
                  id="dialog-attended-hours"
                  type="number"
                  placeholder="Enter attended hours"
                  value={attendedHours}
                  onChange={(e) => setAttendedHours(e.target.value)}
                  min="0"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dialog-paid-fees">Fees Paid (₹)</Label>
                <Input
                  id="dialog-paid-fees"
                  type="number"
                  placeholder="Enter fees paid"
                  value={paidFees}
                  onChange={(e) => setPaidFees(e.target.value)}
                  min="0"
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
