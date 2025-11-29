import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, TrendingDown, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

interface Student {
  id: string;
  student_name: string;
  roll_number: string | null;
  department: string | null;
  attended_hours: number;
  total_hours: number;
  attendance_percentage: number | null;
}

const AttendanceReports = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

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
        .select("id, student_name, roll_number, department, attended_hours, total_hours, attendance_percentage")
        .eq("user_id", user.id)
        .eq("department", selectedDepartment)
        .order("attendance_percentage", { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalStudents = students.length;
  const averageAttendance = totalStudents > 0
    ? (students.reduce((sum, s) => sum + (s.attendance_percentage || 0), 0) / totalStudents).toFixed(2)
    : "0";

  const below75 = students.filter(s => (s.attendance_percentage || 0) < 75).length;
  const mostAbsentStudents = students.slice(0, 5);

  // Prepare chart data
  const attendanceDistribution = [
    { range: "0-25%", count: students.filter(s => (s.attendance_percentage || 0) < 25).length },
    { range: "25-50%", count: students.filter(s => (s.attendance_percentage || 0) >= 25 && (s.attendance_percentage || 0) < 50).length },
    { range: "50-75%", count: students.filter(s => (s.attendance_percentage || 0) >= 50 && (s.attendance_percentage || 0) < 75).length },
    { range: "75-100%", count: students.filter(s => (s.attendance_percentage || 0) >= 75).length },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold">Attendance Reports</h2>
          <p className="text-muted-foreground mt-2">
            View attendance trends and statistics
          </p>
        </div>

        {/* Department Selection */}
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Select Department
            </CardTitle>
            <CardDescription>
              Choose a department to view attendance reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="department-select">Department/Class</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger id="department-select" className="bg-background">
                  <SelectValue placeholder="Select a department..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {departments.length === 0 ? (
                    <SelectItem value="empty" disabled>No departments found</SelectItem>
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

        {selectedDepartment && !loading && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalStudents}</div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Average Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{averageAttendance}%</div>
                </CardContent>
              </Card>

              <Card className="shadow-card border-l-4 border-l-warning">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Below 75%</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-warning">{below75}</div>
                </CardContent>
              </Card>

              <Card className="shadow-card border-l-4 border-l-success">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Above 75%</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{totalStudents - below75}</div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Distribution Chart */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Attendance Distribution
                </CardTitle>
                <CardDescription>
                  Number of students in each attendance range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Most Absent Students */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  Most Absent Students
                </CardTitle>
                <CardDescription>
                  Top 5 students with lowest attendance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mostAbsentStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Attended</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mostAbsentStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{student.roll_number || "—"}</TableCell>
                          <TableCell>{student.student_name}</TableCell>
                          <TableCell>{student.attended_hours}</TableCell>
                          <TableCell>{student.total_hours}</TableCell>
                          <TableCell>
                            <span className={
                              (student.attendance_percentage || 0) < 50 ? "text-destructive font-bold" :
                              (student.attendance_percentage || 0) < 75 ? "text-warning font-bold" :
                              "text-success"
                            }>
                              {(student.attendance_percentage || 0).toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AttendanceReports;
