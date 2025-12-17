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
import { format, startOfWeek, addDays, getDay } from "date-fns";
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

interface CalendarEvent {
  event_date: string;
  event_type: "holiday" | "custom_sessions";
  description: string | null;
  custom_sessions: number | null;
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
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [userDepartment, setUserDepartment] = useState<string>("");

  const weekDates = DAYS.map((_, index) => addDays(weekStart, index));

  useEffect(() => {
    fetchStudents();
    fetchCriteria();
    fetchCalendarEvents();
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

      // Use secure RPC to get HOD criteria for department
      const { data: criteriaData, error } = await supabase.rpc('get_department_hod_criteria');

      if (error) {
        console.error("Error fetching criteria via RPC:", error);
        setMaxSessionsPerDay(7);
        return;
      }

      if (criteriaData && criteriaData.length > 0) {
        const c = criteriaData[0];
        if (c.criteria_found && c.max_sessions_per_day) {
          setMaxSessionsPerDay(c.max_sessions_per_day);
          return;
        }
      }

      setMaxSessionsPerDay(7);
    } catch (error) {
      console.error("Error fetching criteria:", error);
      setMaxSessionsPerDay(7);
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's department
      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.department) return;
      setUserDepartment(profile.department);

      // Fetch calendar events for this department
      const { data: events, error } = await supabase
        .from("academic_calendar")
        .select("event_date, event_type, description, custom_sessions")
        .eq("department", profile.department);

      if (error) {
        console.error("Error fetching calendar events:", error);
        return;
      }

      setCalendarEvents((events || []) as CalendarEvent[]);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    }
  };

  // Helper to check if a date is a Sunday
  const isSunday = (date: Date): boolean => getDay(date) === 0;

  // Helper to check if a date is a holiday (including Sundays as default holidays)
  const isHoliday = (date: Date): { isHoliday: boolean; description: string | null } => {
    // Sundays are always holidays
    if (isSunday(date)) {
      return { isHoliday: true, description: "Sunday (Default Holiday)" };
    }
    
    const dateStr = format(date, "yyyy-MM-dd");
    const event = calendarEvents.find(e => e.event_date === dateStr && e.event_type === "holiday");
    if (event) {
      return { isHoliday: true, description: event.description };
    }
    return { isHoliday: false, description: null };
  };

  // Helper to get custom sessions for a date
  const getCustomSessions = (date: Date): number | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const event = calendarEvents.find(e => e.event_date === dateStr && e.event_type === "custom_sessions");
    return event?.custom_sessions ?? null;
  };

  // Get effective max sessions for a date (considering custom sessions)
  const getEffectiveMaxSessions = (date: Date): number => {
    const customSessions = getCustomSessions(date);
    return customSessions !== null ? customSessions : maxSessionsPerDay;
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
    // Don't allow updates on holidays (including Sundays)
    if (isHoliday(date).isHoliday) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const key: AttendanceKey = `${studentId}_${dateStr}`;
    const effectiveMax = getEffectiveMaxSessions(date);
    const numValue = Math.max(0, Math.min(effectiveMax, parseInt(value) || 0));
    
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(key, numValue);
      return newMap;
    });
  };

  const getSessionCount = (studentId: string, date: Date): number => {
    // Holidays (including Sundays) always return 0
    if (isHoliday(date).isHoliday) return 0;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const key: AttendanceKey = `${studentId}_${dateStr}`;
    const effectiveMax = getEffectiveMaxSessions(date);
    const value = attendance.get(key) ?? effectiveMax;
    // Cap at effective max to prevent exceeding 100%
    return Math.min(value, effectiveMax);
  };

  const markAllFull = () => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      filteredStudents.forEach(student => {
        weekDates.forEach(date => {
          // Skip holidays (including Sundays)
          if (isHoliday(date).isHoliday) return;
          
          const dateStr = format(date, "yyyy-MM-dd");
          const effectiveMax = getEffectiveMaxSessions(date);
          newMap.set(`${student.id}_${dateStr}` as AttendanceKey, effectiveMax);
        });
      });
      return newMap;
    });
    toast.success("All students marked with full attendance (holidays excluded)");
  };

  const syncAttendanceToStudents = async () => {
    try {
      if (students.length === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileIds = students.map((s) => s.id);

      const { data: attendanceRecords, error } = await supabase
        .from("attendance_records")
        .select("student_id, sessions_attended, max_sessions")
        .in("student_id", profileIds);

      if (error) {
        console.error("Error fetching attendance for sync:", error);
        return;
      }

      // Get HOD criteria for total_hours
      const { data: criteriaData } = await supabase.rpc('get_department_hod_criteria');
      const hodTotalHours = criteriaData?.[0]?.total_hours ?? 100;

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

        // Calculate attended_hours based on sessions ratio applied to hodTotalHours
        const attendedHours = totalData.total > 0
          ? Math.round((totalData.attended / totalData.total) * hodTotalHours * 10) / 10
          : 0;

        const { data: existingStudent, error: fetchError } = await supabase
          .from("students")
          .select("id, internal_marks, fee_paid_percentage, pending_fees")
          .eq("roll_number", student.roll_number)
          .maybeSingle();

        if (fetchError || !existingStudent) {
          console.error("Could not find student record:", student.roll_number);
          return;
        }

        // Update students table with attendance data
        const { error: updateError } = await supabase
          .from("students")
          .update({
            attendance_percentage: percentage,
            attended_hours: attendedHours,
            total_hours: hodTotalHours,
          })
          .eq("id", existingStudent.id);

        if (updateError) {
          console.error("Error updating student attendance:", updateError);
          return;
        }

        // Insert a student_history snapshot
        const { error: historyError } = await supabase
          .from("student_history")
          .insert({
            student_id: existingStudent.id,
            user_id: user.id,
            attendance_percentage: percentage,
            internal_marks: existingStudent.internal_marks ?? 0,
            fee_paid_percentage: existingStudent.fee_paid_percentage ?? 0,
            pending_fees: existingStudent.pending_fees ?? 0,
          });

        if (historyError) {
          console.error("Error inserting student history:", historyError);
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

      // Prepare records for upsert (skip holidays)
      const records: any[] = [];
      filteredStudents.forEach(student => {
        weekDates.forEach(date => {
          // Skip holidays (including Sundays) - don't save attendance records for holidays
          if (isHoliday(date).isHoliday) return;
          
          const dateStr = format(date, "yyyy-MM-dd");
          const key: AttendanceKey = `${student.id}_${dateStr}`;
          const effectiveMax = getEffectiveMaxSessions(date);
          const sessions = attendance.get(key) ?? effectiveMax;
          
          records.push({
            student_id: student.id,
            user_id: user.id,
            attendance_date: dateStr,
            sessions_attended: Math.min(sessions, effectiveMax),
            max_sessions: effectiveMax
          });
        });
      });

      if (records.length === 0) {
        toast.info("No attendance to save (all selected days are holidays)");
        setSaving(false);
        return;
      }

      // Upsert records using any type to bypass type checking
      const { error } = await (supabase as any)
        .from("attendance_records")
        .upsert(records, { 
          onConflict: 'student_id,attendance_date,user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Sync aggregated attendance percentage to students table
      await syncAttendanceToStudents();

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
      // Skip holidays (including Sundays) in calculations
      if (isHoliday(date).isHoliday) return;
      
      const sessions = getSessionCount(student.id, date);
      const effectiveMax = getEffectiveMaxSessions(date);
      if (sessions >= 0) {
        daysWithInput++;
        // Cap sessions at effective max
        attendedSessions += Math.min(sessions, effectiveMax);
        totalSessions += effectiveMax;
      }
    });

    // Cap percentage at 100%
    const percentage = totalSessions > 0 ? Math.min(100, (attendedSessions / totalSessions) * 100) : 0;
    return { attendedSessions, totalSessions, percentage, daysWithInput };
  };

  // Calculate weekly total sessions (excluding holidays and Sundays)
  const weeklyTotalSessions = weekDates.reduce((sum, date) => {
    if (isHoliday(date).isHoliday) return sum;
    return sum + getEffectiveMaxSessions(date);
  }, 0);

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
                        modifiers={{
                          sunday: (date) => getDay(date) === 0,
                          holiday: (date) => {
                            const dateStr = format(date, "yyyy-MM-dd");
                            return calendarEvents.some(e => e.event_date === dateStr && e.event_type === "holiday");
                          },
                          customSession: (date) => {
                            const dateStr = format(date, "yyyy-MM-dd");
                            return calendarEvents.some(e => e.event_date === dateStr && e.event_type === "custom_sessions");
                          },
                        }}
                        modifiersStyles={{
                          sunday: { 
                            background: "rgba(99, 102, 241, 0.15)",
                            color: "rgb(129, 140, 248)",
                            borderRadius: "6px",
                            border: "1px solid rgba(99, 102, 241, 0.3)"
                          },
                          holiday: { 
                            background: "rgba(244, 63, 94, 0.15)",
                            color: "rgb(251, 113, 133)",
                            borderRadius: "6px",
                            border: "1px solid rgba(244, 63, 94, 0.3)"
                          },
                          customSession: { 
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "rgb(52, 211, 153)",
                            borderRadius: "6px",
                            border: "1px solid rgba(16, 185, 129, 0.3)"
                          },
                        }}
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
                                {weekDates.map((date, index) => {
                                  const holidayInfo = isHoliday(date);
                                  const customSess = getCustomSessions(date);
                                  return (
                                    <TableHead key={index} className={cn(
                                      "text-center min-w-[70px]",
                                      holidayInfo.isHoliday && "bg-destructive/10"
                                    )}>
                                      <div className="flex flex-col items-center">
                                        <span className="font-semibold">{DAYS[index]}</span>
                                        <span className="text-xs text-muted-foreground">{format(date, "d MMM")}</span>
                                        {holidayInfo.isHoliday && (
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0 mt-1">
                                            {isSunday(date) ? "Sunday" : "Holiday"}
                                          </Badge>
                                        )}
                                        {customSess !== null && !holidayInfo.isHoliday && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20">
                                            {customSess} sess
                                          </Badge>
                                        )}
                                      </div>
                                    </TableHead>
                                  );
                                })}
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
                                      const holidayInfo = isHoliday(date);
                                      const sessionCount = getSessionCount(student.id, date);
                                      const effectiveMax = getEffectiveMaxSessions(date);
                                      const isFullAttendance = sessionCount === effectiveMax;
                                      const isZero = sessionCount === 0;
                                      
                                      if (holidayInfo.isHoliday) {
                                        return (
                                          <TableCell key={index} className="text-center p-1 bg-destructive/10">
                                            <div className="w-14 h-9 flex items-center justify-center mx-auto text-xs text-muted-foreground">
                                              —
                                            </div>
                                          </TableCell>
                                        );
                                      }
                                      
                                      return (
                                        <TableCell key={index} className="text-center p-1">
                                          <Input
                                            type="number"
                                            min={0}
                                            max={effectiveMax}
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
