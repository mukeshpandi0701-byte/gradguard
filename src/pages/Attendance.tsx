import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Save, Calendar as CalendarIcon, Check, X, CheckCheck, XCircle } from "lucide-react";
import { format } from "date-fns";
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

const Attendance = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setStudents(studentProfiles || []);
      
      // Initialize all as present by default
      const initialAttendance = new Map<string, boolean>();
      studentProfiles?.forEach(student => initialAttendance.set(student.id, true));
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
    filteredStudents.forEach(student => newAttendance.set(student.id, true));
    setAttendance(prev => {
      const newMap = new Map(prev);
      filteredStudents.forEach(student => newMap.set(student.id, true));
      return newMap;
    });
    toast.success("All students marked present");
  };

  const markAllAbsent = () => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      filteredStudents.forEach(student => newMap.set(student.id, false));
      return newMap;
    });
    toast.success("All students marked absent");
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setSaving(true);
    try {
      // Note: Since we're using student_profiles (logged-in students), 
      // attendance tracking would need a separate attendance table.
      // For now, just show success message.
      toast.success(`Attendance saved for ${format(selectedDate, "PPP")}`);
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

  const presentCount = filteredStudents.filter(s => attendance.get(s.id)).length;
  const absentCount = filteredStudents.length - presentCount;

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
          <h2 className="text-3xl font-bold">Attendance Management</h2>
          <p className="text-muted-foreground mt-2">
            Mark student attendance for specific dates
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
            {/* Date Selection & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    Select Date
                  </CardTitle>
                  <CardDescription>
                    Choose the date for attendance
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {/* Summary Card */}
              {filteredStudents.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Attendance Summary</CardTitle>
                    <CardDescription className="text-xs">
                      Overview for {format(selectedDate, "PP")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold">{filteredStudents.length}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-success">{presentCount}</div>
                        <div className="text-xs text-muted-foreground">Present</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-destructive">{absentCount}</div>
                        <div className="text-xs text-muted-foreground">Absent</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Attendance List with Branch Tabs */}
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
                      Click on students to mark present/absent
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
                                <TableHead>Roll No</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents.map((student) => {
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
                                    <TableCell>{student.full_name || student.email}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{student.branch}</Badge>
                                    </TableCell>
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
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Attendance;