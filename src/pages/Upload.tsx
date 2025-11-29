import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Users, X, Check } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
  department: string | null;
  internal_marks: number;
  paid_fees: number;
}

interface EditingStudent {
  id: string;
  internal_marks: string;
  paid_fees: string;
}

const Upload = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<EditingStudent | null>(null);
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
        .select("id, student_name, roll_number, department, internal_marks, paid_fees")
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

  const handleEditClick = (student: Student) => {
    setEditingStudent({
      id: student.id,
      internal_marks: student.internal_marks.toString(),
      paid_fees: student.paid_fees.toString(),
    });
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;

    const internalMarksNum = parseFloat(editingStudent.internal_marks);
    const paidFeesNum = parseFloat(editingStudent.paid_fees);

    if (isNaN(internalMarksNum) || isNaN(paidFeesNum)) {
      toast.error("Please enter valid numbers");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          internal_marks: internalMarksNum,
          paid_fees: paidFeesNum,
        })
        .eq("id", editingStudent.id);

      if (error) throw error;

      toast.success("Student details updated successfully!");
      setEditingStudent(null);
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
          <h2 className="text-3xl font-bold">Academic Updates</h2>
          <p className="text-muted-foreground mt-2">
            Update internal scores and fees for students
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
                Click Edit to update, or click the check mark to save changes
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
                        <TableHead>Fees Paid (₹)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => {
                        const isEditing = editingStudent?.id === student.id;
                        return (
                          <TableRow key={student.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{student.roll_number || "—"}</TableCell>
                            <TableCell>{student.student_name}</TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={editingStudent.internal_marks}
                                  onChange={(e) =>
                                    setEditingStudent({
                                      ...editingStudent,
                                      internal_marks: e.target.value,
                                    })
                                  }
                                  min="0"
                                  className="w-24"
                                />
                              ) : (
                                student.internal_marks
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="number"
                                  value={editingStudent.paid_fees}
                                  onChange={(e) =>
                                    setEditingStudent({
                                      ...editingStudent,
                                      paid_fees: e.target.value,
                                    })
                                  }
                                  min="0"
                                  className="w-32"
                                />
                              ) : (
                                `₹${student.paid_fees}`
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    disabled={saving}
                                  >
                                    <X className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditClick(student)}
                                >
                                  Edit
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Upload;
