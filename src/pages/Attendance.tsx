import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Calendar as CalendarIcon, CheckCheck } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  full_name: string | null;
  roll_number: string | null;
  branch: string | null;
  email: string;
}

type AttendanceKey = `${string}_${string}`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Attendance = () => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<AttendanceKey, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState<number>(7);

  const weekDates = DAYS.map((_, index) => addDays(weekStart, index));

  useEffect(() => {
    fetchStudents();
    fetchCriteria();
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      loadAttendanceRecords();
    }
  }, [weekStart, students]);

  const fetchCriteria = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("dropout_criteria")
        .select("max_sessions_per_day")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && (data as any).max_sessions_per_day) {
        setMaxSessionsPerDay((data as any).max_sessions_per_day);
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

  const loadAttendanceRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(addDays(weekStart, 5), "yyyy-MM-dd");

      // First initialize with default values
      const initialAttendance = new Map<AttendanceKey, number>();
      students.forEach(student => {
        weekDates.forEach(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          initialAttendance.set(`${student.id}_${dateStr}` as AttendanceKey, maxSessionsPerDay);
        });
      });

      // Fetch saved attendance records using any type to bypass type checking
      const { data: records, error } = await (supabase as any)
        .from("attendance_records")
        .select("student_id, attendance_date, sessions_attended")
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (error) {
        console.error("Error loading attendance records:", error);
      } else if (records) {
        // Override with saved values
        records.forEach((record: any) => {
          const key: AttendanceKey = `${record.student_id}_${record.attendance_date}`;
          initialAttendance.set(key, record.sessions_attended);
        });
      }

      setAttendance(initialAttendance);
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  useEffect(() => {
    if (students.length > 0) {
      loadAttendanceRecords();
    }
  }, [maxSessionsPerDay]);

  const updateSessionCount = (studentId: string, date: Date, value: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key: AttendanceKey = `${studentId}_${dateStr}`;
    const numValue = Math.max(0, Math.min(maxSessionsPerDay, parseInt(value) || 0));
    
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(key, numValue);
      return newMap;
    });
  };

  const getSessionCount = (studentId: string, date: Date): number => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key: AttendanceKey = `${studentId}_${dateStr}`;
    const value = attendance.get(key) ?? maxSessionsPerDay;
    // Cap at maxSessionsPerDay to prevent exceeding 100%
    return Math.min(value, maxSessionsPerDay);
  };

  const markAllFull = () => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      filteredStudents.forEach(student => {
        weekDates.forEach(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          newMap.set(`${student.id}_${dateStr}` as AttendanceKey, maxSessionsPerDay);
        });
      });
      return newMap;
    });
    toast.success("All students marked with full attendance");
  };

  const syncAttendanceToStudents = async (userId: string) => {
    try {
      if (students.length === 0) return;

      const profileIds = students.map((s) => s.id);

      const { data: attendanceRecords, error } = await supabase
        .from("attendance_records")
        .select("student_id, sessions_attended, max_sessions")
        .in("student_id", profileIds);

      if (error) {
        console.error("Error fetching attendance for sync:", error);
        return;
      }

      const totals = new Map<string, { attended: number; total: number }>();

      (attendanceRecords || []).forEach((record: any) => {
        const current = totals.get(record.student_id) || { attended: 0, total: 0 };
        current.attended += record.sessions_attended;
        current.total += record.max_sessions;
        totals.set(record.student_id, current);
      });

      const updates = students.map(async (student) => {
        const totalData = totals.get(student.id) || { attended: 0, total: 0 };
        const percentage = totalData.total > 0
          ? Math.min(100, (totalData.attended / totalData.total) * 100)
          : 0;

        if (!student.roll_number) return;

        const { error: updateError } = await supabase
          .from("students")
          .update({ attendance_percentage: percentage })
          .eq("user_id", userId)
          .eq("roll_number", student.roll_number);

        if (updateError) {
          console.error("Error updating student attendance:", updateError);
        }
      });

      await Promise.all(updates);
    } catch (err) {
      console.error("Unexpected error syncing attendance to students:", err);
    }
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Prepare records for upsert
      const records: any[] = [];
      filteredStudents.forEach(student => {
        weekDates.forEach(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          const key: AttendanceKey = `${student.id}_${dateStr}`;
          const sessions = attendance.get(key) ?? maxSessionsPerDay;
          
          records.push({
            student_id: student.id,
            user_id: user.id,
            attendance_date: dateStr,
            sessions_attended: Math.min(sessions, maxSessionsPerDay),
            max_sessions: maxSessionsPerDay
          });
        });
      });

      // Upsert records using any type to bypass type checking
      const { error } = await (supabase as any)
        .from("attendance_records")
        .upsert(records, { 
          onConflict: 'student_id,attendance_date,user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Sync aggregated attendance percentage to students table
      await syncAttendanceToStudents(user.id);

      const weekEndDate = addDays(weekStart, 5);
      toast.success(`Attendance saved for week ${format(weekStart, "MMM d")} - ${format(weekEndDate, "MMM d, yyyy")}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save attendance");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };
  const filteredStudents = selectedBranch === "all" 
    ? students 
    : students.filter(s => s.branch === selectedBranch);

  // Calculate summary
  const calculateStudentAttendance = (student: Student) => {
    let totalSessions = 0;
    let attendedSessions = 0;
    let daysWithInput = 0;

    weekDates.forEach(date => {
      const sessions = getSessionCount(student.id, date);
      if (sessions >= 0) {
        daysWithInput++;
        // Cap sessions at maxSessionsPerDay
        attendedSessions += Math.min(sessions, maxSessionsPerDay);
        totalSessions += maxSessionsPerDay;
      }
    });

    // Cap percentage at 100%
    const percentage = totalSessions > 0 ? Math.min(100, (attendedSessions / totalSessions) * 100) : 0;
    return { attendedSessions, totalSessions, percentage, daysWithInput };
  };

  // Calculate weekly total sessions (days × max sessions per day)
  const weeklyTotalSessions = DAYS.length * maxSessionsPerDay;

  // Calculate average attendance percentage across all students
  const averageAttendance = filteredStudents.length > 0
    ? filteredStudents.reduce((sum, student) => {
        const stats = calculateStudentAttendance(student);
        return sum + stats.percentage;
      }, 0) / filteredStudents.length
    : 0;

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
          <h2 className="text-3xl font-bold">Weekly Attendance</h2>
          <p className="text-muted-foreground mt-2">
            Enter the number of sessions attended per day (max: {maxSessionsPerDay} per day)
          </p>
        </div>

        {assignedBranches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">No Branches Assigned</h3>
              <p className="text-muted-foreground text-center">
                Contact your HOD to get branch assignments
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Week Selection & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    Select Week
                  </CardTitle>
                  <CardDescription>
                    Choose starting date of the week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(weekStart, "MMM d")} - {format(addDays(weekStart, 5), "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={weekStart}
                        onSelect={(date) => date && setWeekStart(startOfWeek(date, { weekStartsOn: 1 }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>

              {filteredStudents.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Weekly Summary</CardTitle>
                    <CardDescription className="text-xs">
                      Overview for selected week
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold">{weeklyTotalSessions}</div>
                        <div className="text-xs text-muted-foreground">Total Sessions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-primary">{Math.min(100, averageAttendance).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Avg. Attendance</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Attendance Grid with Branch Tabs */}
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
                    <CardTitle>Enter Attendance</CardTitle>
                    <CardDescription>
                      Enter number of sessions attended for each day (0 to {maxSessionsPerDay})
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No students found</div>
                    ) : (
                      <>
                        {/* Bulk Action */}
                        <div className="flex gap-2 mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={markAllFull}
                            className="flex-1"
                          >
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Mark All Full Attendance
                          </Button>
                        </div>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="sticky left-0 bg-background z-10 min-w-[80px]">Roll No</TableHead>
                                <TableHead className="sticky left-[80px] bg-background z-10 min-w-[120px]">Name</TableHead>
                                {weekDates.map((date, index) => (
                                  <TableHead key={index} className="text-center min-w-[70px]">
                                    <div className="flex flex-col items-center">
                                      <span className="font-semibold">{DAYS[index]}</span>
                                      <span className="text-xs text-muted-foreground">{format(date, "d MMM")}</span>
                                    </div>
                                  </TableHead>
                                ))}
                                <TableHead className="text-center min-w-[80px]">Weekly %</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents.map((student) => {
                                const stats = calculateStudentAttendance(student);
                                return (
                                  <TableRow key={student.id} className="hover:bg-muted/50">
                                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                      {student.roll_number || "—"}
                                    </TableCell>
                                    <TableCell className="sticky left-[80px] bg-background z-10">
                                      <div className="flex flex-col">
                                        <span className="truncate max-w-[100px]">{student.full_name || student.email}</span>
                                        <Badge variant="outline" className="w-fit text-xs mt-1">{student.branch}</Badge>
                                      </div>
                                    </TableCell>
                                    {weekDates.map((date, index) => {
                                      const sessionCount = getSessionCount(student.id, date);
                                      const isFullAttendance = sessionCount === maxSessionsPerDay;
                                      const isZero = sessionCount === 0;
                                      return (
                                        <TableCell key={index} className="text-center p-1">
                                          <Input
                                            type="number"
                                            min={0}
                                            max={maxSessionsPerDay}
                                            value={sessionCount}
                                            onChange={(e) => updateSessionCount(student.id, date, e.target.value)}
                                            className={cn(
                                              "w-14 h-9 text-center mx-auto text-sm font-medium",
                                              isFullAttendance && "border-success bg-success/10 text-success",
                                              isZero && "border-destructive bg-destructive/10 text-destructive"
                                            )}
                                          />
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className="text-center">
                                      <Badge 
                                        variant={stats.percentage >= 75 ? "default" : "destructive"}
                                        className={cn(
                                          stats.percentage >= 75 && "bg-success hover:bg-success/80"
                                        )}
                                      >
                                        {stats.percentage.toFixed(0)}%
                                      </Badge>
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
                                Save Weekly Attendance
                              </>
                            )}
                          </Button>
                        </div>
                      </>
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

export default Attendance;
