import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingDown, Download, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  full_name: string | null;
  roll_number: string | null;
  branch: string | null;
  email: string;
  attendancePercentage: number;
  totalSessions: number;
  attendedSessions: number;
}

const AttendanceReports = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  useEffect(() => {
    fetchStudents();
  }, []);

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

      // Fetch attendance records for all students
      const studentIds = (studentProfiles || []).map(s => s.id);
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select("student_id, sessions_attended, max_sessions")
        .in("student_id", studentIds);

      // Calculate attendance metrics per student
      const attendanceMap = new Map<string, { totalSessions: number; attendedSessions: number }>();
      (attendanceRecords || []).forEach(record => {
        const current = attendanceMap.get(record.student_id) || { totalSessions: 0, attendedSessions: 0 };
        current.totalSessions += record.max_sessions;
        current.attendedSessions += record.sessions_attended;
        attendanceMap.set(record.student_id, current);
      });

      const studentsWithAttendance: Student[] = (studentProfiles || []).map(sp => {
        const attendance = attendanceMap.get(sp.id) || { totalSessions: 0, attendedSessions: 0 };
        const percentage = attendance.totalSessions > 0 
          ? Math.min((attendance.attendedSessions / attendance.totalSessions) * 100, 100)
          : 0;
        return {
          ...sp,
          attendancePercentage: percentage,
          totalSessions: attendance.totalSessions,
          attendedSessions: attendance.attendedSessions,
        };
      });

      setStudents(studentsWithAttendance);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = selectedBranch === "all" 
    ? students 
    : students.filter(s => s.branch === selectedBranch);

  const totalStudents = filteredStudents.length;
  const avgAttendance = totalStudents > 0 
    ? filteredStudents.reduce((sum, s) => sum + s.attendancePercentage, 0) / totalStudents 
    : 0;
  const lowAttendanceCount = filteredStudents.filter(s => s.attendancePercentage < 75).length;

  const downloadAttendanceReport = () => {
    const csvContent = [
      ["Roll No.", "Name", "Branch", "Email"],
      ...filteredStudents.map(student => [
        student.roll_number || "—",
        student.full_name || student.email,
        student.branch || "—",
        student.email
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedBranch === "all" ? "All_Branches" : selectedBranch}_Students_${new Date().toLocaleDateString()}.csv`;
    link.click();
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Attendance Reports</h2>
            <p className="text-muted-foreground mt-2">
              View attendance trends and statistics
            </p>
          </div>
          <Button 
            onClick={downloadAttendanceReport}
            disabled={filteredStudents.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download Report
          </Button>
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
          <>
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
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card className="shadow-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Total Students</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="text-2xl font-bold">{totalStudents}</div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Average Attendance</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="text-2xl font-bold text-primary">
                        {avgAttendance.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card border-l-4 border-l-destructive">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Low Attendance (&lt;75%)</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="text-2xl font-bold text-destructive">{lowAttendanceCount}</div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card border-l-4 border-l-success">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Good Attendance (≥75%)</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="text-2xl font-bold text-success">{totalStudents - lowAttendanceCount}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Students List */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5" />
                      Student List
                    </CardTitle>
                    <CardDescription>
                      Students in your assigned branches
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No students found</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Roll No</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Sessions Attended</TableHead>
                            <TableHead>Total Sessions</TableHead>
                            <TableHead>Attendance %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.map((student, index) => (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>{student.roll_number || "—"}</TableCell>
                              <TableCell>{student.full_name || student.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{student.branch}</Badge>
                              </TableCell>
                              <TableCell>{student.attendedSessions}</TableCell>
                              <TableCell>{student.totalSessions}</TableCell>
                              <TableCell>
                                <Badge variant={student.attendancePercentage >= 75 ? "default" : "destructive"}>
                                  {student.attendancePercentage.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AttendanceReports;