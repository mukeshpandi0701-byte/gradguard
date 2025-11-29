import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Save, Users, Calendar as CalendarIcon, Check, X, CheckCheck, XCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
  attended_hours: number;
  total_hours: number;
}

interface AttendanceRecord {
  student_id: string;
  present: boolean;
}

const Attendance = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
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
        .select("id, student_name, roll_number, attended_hours, total_hours")
        .eq("user_id", user.id)
        .eq("department", selectedDepartment)
        .order("roll_number");

      if (error) throw error;
      setStudents(data || []);
      
      // Initialize all as present by default
      const initialAttendance = new Map<string, boolean>();
      data?.forEach(student => initialAttendance.set(student.id, true));
      setAttendance(initialAttendance);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (studentId: string) => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(studentId, !prev.get(studentId));
      return newMap;
    });
  };

  const markAllPresent = () => {
    const newAttendance = new Map<string, boolean>();
    students.forEach(student => newAttendance.set(student.id, true));
    setAttendance(newAttendance);
    toast.success("All students marked present");
  };

  const markAllAbsent = () => {
    const newAttendance = new Map<string, boolean>();
    students.forEach(student => newAttendance.set(student.id, false));
    setAttendance(newAttendance);
    toast.success("All students marked absent");
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get criteria for total hours
      const { data: criteria } = await supabase
        .from("dropout_criteria")
        .select("total_hours")
        .eq("user_id", user.id)
        .single();

      const totalHours = criteria?.total_hours || 100;

      // Update attended hours for each student
      const updates = Array.from(attendance.entries()).map(([studentId, isPresent]) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return null;

        const newAttendedHours = isPresent 
          ? student.attended_hours + 1 
          : student.attended_hours;

        return supabase
          .from("students")
          .update({ 
            attended_hours: newAttendedHours,
            total_hours: totalHours,
          })
          .eq("id", studentId);
      }).filter(Boolean);

      await Promise.all(updates);

      toast.success(`Attendance saved for ${format(selectedDate, "PPP")}`);
      fetchStudentsByDepartment(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to save attendance");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Array.from(attendance.values()).filter(v => v).length;
  const absentCount = students.length - presentCount;

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold">Attendance Management</h2>
          <p className="text-muted-foreground mt-2">
            Mark student attendance for specific dates
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date & Class Selection */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Select Date & Class
              </CardTitle>
              <CardDescription>
                Choose the date and class for attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

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

          {/* Summary Card */}
          {selectedDepartment && students.length > 0 && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Attendance Summary</CardTitle>
                <CardDescription>
                  Overview for {selectedDepartment} on {format(selectedDate, "PP")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{students.length}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{presentCount}</div>
                    <div className="text-sm text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">{absentCount}</div>
                    <div className="text-sm text-muted-foreground">Absent</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Attendance List */}
        {selectedDepartment && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Mark Attendance</CardTitle>
              <CardDescription>
                Click on students to mark present/absent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No students found in this class</div>
              ) : (
                <>
                  {/* Bulk Actions */}
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllPresent}
                      className="flex-1"
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      Mark All Present
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAbsent}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Mark All Absent
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Roll No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Current Hours</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => {
                          const isPresent = attendance.get(student.id) ?? true;
                          return (
                            <TableRow 
                              key={student.id} 
                              className={cn(
                                "cursor-pointer transition-colors",
                                isPresent ? "bg-success/10 hover:bg-success/20" : "bg-destructive/10 hover:bg-destructive/20"
                              )}
                              onClick={() => toggleAttendance(student.id)}
                            >
                              <TableCell className="font-medium">{student.roll_number || "—"}</TableCell>
                              <TableCell>{student.student_name}</TableCell>
                              <TableCell>{student.attended_hours} / {student.total_hours}</TableCell>
                              <TableCell className="text-center">
                                {isPresent ? (
                                  <div className="flex items-center justify-center gap-2 text-success">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Present</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2 text-destructive">
                                    <X className="w-5 h-5" />
                                    <span className="font-medium">Absent</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button 
                      onClick={handleSaveAttendance} 
                      disabled={saving}
                      size="lg"
                    >
                      {saving ? (
                        "Saving..."
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Attendance
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
