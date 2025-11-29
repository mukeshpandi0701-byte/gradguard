import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, User } from "lucide-react";
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
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [internalScore, setInternalScore] = useState<string>("");
  const [attendedHours, setAttendedHours] = useState<string>("");
  const [paidFees, setPaidFees] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, roll_number, department, internal_marks, attended_hours, paid_fees")
        .eq("user_id", user.id)
        .order("student_name");

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    if (student) {
      setInternalScore(student.internal_marks.toString());
      setAttendedHours(student.attended_hours.toString());
      setPaidFees(student.paid_fees.toString());
    }
  };

  const handleUpdate = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student");
      return;
    }

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
        .eq("id", selectedStudentId);

      if (error) throw error;

      toast.success("Student details updated successfully!");
      
      // Refresh students list
      await fetchStudents();
      
      // Keep the same student selected with updated values
      handleStudentSelect(selectedStudentId);
    } catch (error: any) {
      toast.error(error.message || "Failed to update student details");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-4xl mx-auto">
        <div>
          <h2 className="text-3xl font-bold">Update Student Details</h2>
          <p className="text-muted-foreground mt-2">
            Manually update individual student information
          </p>
        </div>

        <div className="grid gap-6">
          {/* Student Selection Card */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Select Student
              </CardTitle>
              <CardDescription>
                Choose a student to update their details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="student-select">Student</Label>
                <Select value={selectedStudentId} onValueChange={handleStudentSelect}>
                  <SelectTrigger id="student-select">
                    <SelectValue placeholder="Select a student..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="loading" disabled>Loading students...</SelectItem>
                    ) : students.length === 0 ? (
                      <SelectItem value="empty" disabled>No students found</SelectItem>
                    ) : (
                      students.map(student => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.student_name} 
                          {student.roll_number && ` (${student.roll_number})`}
                          {student.department && ` - ${student.department}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Update Form Card */}
          {selectedStudent && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Update Details for {selectedStudent.student_name}</CardTitle>
                <CardDescription>
                  Enter the new values for this student
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="internal-score">Internal Score</Label>
                    <Input
                      id="internal-score"
                      type="number"
                      placeholder="Enter internal score"
                      value={internalScore}
                      onChange={(e) => setInternalScore(e.target.value)}
                      min="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="attended-hours">Attended Hours</Label>
                    <Input
                      id="attended-hours"
                      type="number"
                      placeholder="Enter attended hours"
                      value={attendedHours}
                      onChange={(e) => setAttendedHours(e.target.value)}
                      min="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="paid-fees">Fees Paid (₹)</Label>
                    <Input
                      id="paid-fees"
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Upload;
