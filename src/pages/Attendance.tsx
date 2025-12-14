import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Save, Calendar as CalendarIcon, CheckCheck, XCircle } from "lucide-react";
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

type SessionKey = `${string}_${string}_${"morning" | "afternoon"}`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Attendance = () => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<SessionKey, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const weekDates = DAYS.map((_, index) => addDays(weekStart, index));

  useEffect(() => {
    fetchStudents();
  }, []);

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
      
      // Initialize all sessions as present by default
      initializeAttendance(studentProfiles || []);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const initializeAttendance = (studentList: Student[]) => {
    const initialAttendance = new Map<SessionKey, boolean>();
    studentList.forEach(student => {
      weekDates.forEach(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        initialAttendance.set(`${student.id}_${dateStr}_morning` as SessionKey, true);
        initialAttendance.set(`${student.id}_${dateStr}_afternoon` as SessionKey, true);
      });
    });
    setAttendance(initialAttendance);
  };

  useEffect(() => {
    if (students.length > 0) {
      initializeAttendance(students);
    }
  }, [weekStart]);

  const toggleSession = (studentId: string, date: Date, session: "morning" | "afternoon") => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key: SessionKey = `${studentId}_${dateStr}_${session}`;
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(key, !prev.get(key));
      return newMap;
    });
  };

  const getSessionStatus = (studentId: string, date: Date, session: "morning" | "afternoon"): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key: SessionKey = `${studentId}_${dateStr}_${session}`;
    return attendance.get(key) ?? true;
  };

  const markAllPresent = () => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      filteredStudents.forEach(student => {
        weekDates.forEach(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          newMap.set(`${student.id}_${dateStr}_morning` as SessionKey, true);
          newMap.set(`${student.id}_${dateStr}_afternoon` as SessionKey, true);
        });
      });
      return newMap;
    });
    toast.success("All sessions marked present");
  };

  const markAllAbsent = () => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      filteredStudents.forEach(student => {
        weekDates.forEach(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          newMap.set(`${student.id}_${dateStr}_morning` as SessionKey, false);
          newMap.set(`${student.id}_${dateStr}_afternoon` as SessionKey, false);
        });
      });
      return newMap;
    });
    toast.success("All sessions marked absent");
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
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
  const totalSessions = filteredStudents.length * DAYS.length * 2;
  const presentSessions = filteredStudents.reduce((count, student) => {
    return count + weekDates.reduce((dayCount, date) => {
      const morningPresent = getSessionStatus(student.id, date, "morning") ? 1 : 0;
      const afternoonPresent = getSessionStatus(student.id, date, "afternoon") ? 1 : 0;
      return dayCount + morningPresent + afternoonPresent;
    }, 0);
  }, 0);

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
            Mark attendance for morning and afternoon sessions
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
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold">{totalSessions}</div>
                        <div className="text-xs text-muted-foreground">Total Sessions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-success">{presentSessions}</div>
                        <div className="text-xs text-muted-foreground">Present</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-destructive">{totalSessions - presentSessions}</div>
                        <div className="text-xs text-muted-foreground">Absent</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 rounded-full bg-success/80 border-2 border-success" />
                <span className="text-muted-foreground">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 rounded-full bg-destructive/20 border-2 border-destructive/50" />
                <span className="text-muted-foreground">Absent</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground">M = Morning, A = Afternoon</span>
              </div>
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
                    <CardTitle>Mark Attendance</CardTitle>
                    <CardDescription>
                      Click on ovals to toggle attendance for each session
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No students found</div>
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
                                <TableHead className="sticky left-0 bg-background z-10 min-w-[80px]">Roll No</TableHead>
                                <TableHead className="sticky left-[80px] bg-background z-10 min-w-[120px]">Name</TableHead>
                                {weekDates.map((date, index) => (
                                  <TableHead key={index} className="text-center min-w-[90px]">
                                    <div className="flex flex-col items-center">
                                      <span className="font-semibold">{DAYS[index]}</span>
                                      <span className="text-xs text-muted-foreground">{format(date, "d MMM")}</span>
                                    </div>
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents.map((student) => (
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
                                    const morningPresent = getSessionStatus(student.id, date, "morning");
                                    const afternoonPresent = getSessionStatus(student.id, date, "afternoon");
                                    return (
                                      <TableCell key={index} className="text-center">
                                        <div className="flex flex-col items-center gap-1">
                                          {/* Morning Session */}
                                          <button
                                            onClick={() => toggleSession(student.id, date, "morning")}
                                            className={cn(
                                              "w-10 h-5 rounded-full transition-all duration-200 flex items-center justify-center text-[10px] font-medium",
                                              morningPresent 
                                                ? "bg-success/80 border-2 border-success text-success-foreground hover:bg-success" 
                                                : "bg-destructive/20 border-2 border-destructive/50 text-destructive hover:bg-destructive/30"
                                            )}
                                            title={`Morning - ${morningPresent ? "Present" : "Absent"}`}
                                          >
                                            M
                                          </button>
                                          {/* Afternoon Session */}
                                          <button
                                            onClick={() => toggleSession(student.id, date, "afternoon")}
                                            className={cn(
                                              "w-10 h-5 rounded-full transition-all duration-200 flex items-center justify-center text-[10px] font-medium",
                                              afternoonPresent 
                                                ? "bg-success/80 border-2 border-success text-success-foreground hover:bg-success" 
                                                : "bg-destructive/20 border-2 border-destructive/50 text-destructive hover:bg-destructive/30"
                                            )}
                                            title={`Afternoon - ${afternoonPresent ? "Present" : "Absent"}`}
                                          >
                                            A
                                          </button>
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
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
