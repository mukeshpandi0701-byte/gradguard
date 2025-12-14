import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ParallaxWrapper } from "@/components/ParallaxWrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, X, Trash2, Clock, UserCheck, UserX, Users, Shield, GitBranch, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PendingApproval {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
    department: string;
    college: string;
  };
}

interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  department: string;
  college: string;
  panel_type: string;
}

interface StudentUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  department: string;
  college: string;
  roll_number: string;
  branch: string;
}

interface BranchAssignment {
  id: string;
  staff_user_id: string;
  branch: string;
  assigned_at: string;
}

// Available branches grouped by department (supporting both short and full department names)
const BRANCHES_BY_DEPARTMENT: Record<string, string[]> = {
  "Computer Science and Engineering(CSE)": [
    "I-CSE-A", "I-CSE-B", "I-CY", "I-AIML",
    "II-CSE-A", "II-CSE-B", "II-CY", "II-AIML",
    "III-CSE-A", "III-CSE-B", "III-CY", "III-AIML",
    "IV-CSE-A", "IV-CSE-B", "IV-CY", "IV-AIML",
  ],
  "CSE": [
    "I-CSE-A", "I-CSE-B", "I-CY", "I-AIML",
    "II-CSE-A", "II-CSE-B", "II-CY", "II-AIML",
    "III-CSE-A", "III-CSE-B", "III-CY", "III-AIML",
    "IV-CSE-A", "IV-CSE-B", "IV-CY", "IV-AIML",
  ],
  "Artificial Intelligence and Data Science(AIDS)": [
    "I-AIDS-A", "I-AIDS-B",
    "II-AIDS-A", "II-AIDS-B",
    "III-AIDS-A", "III-AIDS-B",
    "IV-AIDS-A", "IV-AIDS-B",
  ],
  "AIDS": [
    "I-AIDS-A", "I-AIDS-B",
    "II-AIDS-A", "II-AIDS-B",
    "III-AIDS-A", "III-AIDS-B",
    "IV-AIDS-A", "IV-AIDS-B",
  ],
  "Information Technology(IT)": [
    "I-IT", "II-IT", "III-IT", "IV-IT",
  ],
  "IT": [
    "I-IT", "II-IT", "III-IT", "IV-IT",
  ],
};

const HODUserManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [studentUsers, setStudentUsers] = useState<StudentUser[]>([]);
  const [branchAssignments, setBranchAssignments] = useState<BranchAssignment[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [hodDepartment, setHodDepartment] = useState<string | null>(null);

  // Get available branches based on HOD's department
  const availableBranches = hodDepartment ? (BRANCHES_BY_DEPARTMENT[hodDepartment] || []) : [];

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    setLoading(true);
    const dept = await checkHODAccess();
    if (dept !== null) {
      await fetchAllData(dept);
    }
    setLoading(false);
  };

  const checkHODAccess = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return null;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("panel_type, department")
        .eq("id", user.id)
        .maybeSingle();

      const isHodByProfile = profile?.panel_type === "hod";
      const isHodByEmail = user.email?.endsWith("@cietcbe.hod.edu.in") ?? false;

      if (!isHodByProfile && !isHodByEmail) {
        toast.error("Access denied. HOD privileges required.");
        navigate("/dashboard");
        return null;
      }

      const department = profile?.department || null;
      setHodDepartment(department);
      return department;
    } catch (error) {
      console.error("Error checking HOD access:", error);
      navigate("/dashboard");
      return null;
    }
  };

  const fetchAllData = async (department: string | null) => {
    await Promise.all([
      fetchPendingApprovals(department),
      fetchStaffUsers(department),
      fetchStudentUsers(department),
      fetchBranchAssignments(),
    ]);
  };

  const fetchPendingApprovals = async (department: string | null) => {
    try {
      const { data, error } = await supabase
        .from("user_approvals")
        .select("*")
        .eq("status", "pending")
        .eq("role", "staff")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const approvalsWithProfiles = await Promise.all(
        (data || []).map(async (approval) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, department, college")
            .eq("id", approval.user_id)
            .maybeSingle();

          return { ...approval, profile: profile || undefined };
        })
      );

      // Filter by HOD's department if set
      const filtered = department
        ? approvalsWithProfiles.filter((a) => a.profile?.department === department)
        : approvalsWithProfiles;

      setPendingApprovals(filtered);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
    }
  };

  const fetchStaffUsers = async (department: string | null) => {
    try {
      let query = supabase
        .from("profiles")
        .select("*")
        .eq("panel_type", "staff")
        .order("full_name", { ascending: true });

      // Filter by HOD's department if set
      if (department) {
        query = query.eq("department", department);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStaffUsers(data || []);
    } catch (error) {
      console.error("Error fetching staff users:", error);
    }
  };

  const fetchStudentUsers = async (department: string | null) => {
    try {
      let query = supabase
        .from("student_profiles")
        .select("*")
        .order("branch", { ascending: true });

      // Filter by HOD's department if set
      if (department) {
        query = query.eq("department", department);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStudentUsers(data || []);
    } catch (error) {
      console.error("Error fetching student users:", error);
    }
  };

  const fetchBranchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("staff_branch_assignments")
        .select("*");

      if (error) throw error;
      setBranchAssignments(data || []);
    } catch (error) {
      console.error("Error fetching branch assignments:", error);
    }
  };

  const getStaffBranches = (staffId: string): string[] => {
    return branchAssignments
      .filter((a) => a.staff_user_id === staffId)
      .map((a) => a.branch);
  };

  const handleApprove = async (approvalId: string, userId: string) => {
    setActionLoading(approvalId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("user_approvals")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", approvalId);

      if (error) throw error;

      toast.success("User approved successfully!");
      fetchPendingApprovals(hodDepartment);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    setActionLoading(approvalId);
    try {
      const { error } = await supabase
        .from("user_approvals")
        .update({
          status: "rejected",
          rejected_reason: "Rejected by HOD",
        })
        .eq("id", approvalId);

      if (error) throw error;

      toast.success("User rejected");
      fetchPendingApprovals(hodDepartment);
    } catch (error: any) {
      toast.error(error.message || "Failed to reject user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      // Also remove branch assignments
      await supabase
        .from("staff_branch_assignments")
        .delete()
        .eq("staff_user_id", userId);

      toast.success("Staff member removed successfully!");
      fetchStaffUsers(hodDepartment);
      fetchBranchAssignments();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove staff member");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveStudent = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      await supabase
        .from("student_profiles")
        .delete()
        .eq("user_id", userId);

      toast.success("Student removed successfully!");
      fetchStudentUsers(hodDepartment);
    } catch (error: any) {
      toast.error(error.message || "Failed to remove student");
    } finally {
      setActionLoading(null);
    }
  };

  const openAssignDialog = (staff: StaffUser) => {
    setSelectedStaff(staff);
    setSelectedBranches(getStaffBranches(staff.id));
    setAssignDialogOpen(true);
  };

  const handleBranchToggle = (branch: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branch)
        ? prev.filter((b) => b !== branch)
        : [...prev, branch]
    );
  };

  const handleSaveBranchAssignments = async () => {
    if (!selectedStaff) return;

    setActionLoading(selectedStaff.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentBranches = getStaffBranches(selectedStaff.id);

      // Branches to remove
      const toRemove = currentBranches.filter((b) => !selectedBranches.includes(b));
      // Branches to add
      const toAdd = selectedBranches.filter((b) => !currentBranches.includes(b));

      // Remove unselected branches
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("staff_branch_assignments")
          .delete()
          .eq("staff_user_id", selectedStaff.id)
          .in("branch", toRemove);

        if (error) throw error;
      }

      // Add new branches
      if (toAdd.length > 0) {
        const insertData = toAdd.map((branch) => ({
          staff_user_id: selectedStaff.id,
          branch,
          assigned_by: user?.id,
        }));

        const { error } = await supabase
          .from("staff_branch_assignments")
          .insert(insertData);

        if (error) throw error;
      }

      toast.success("Branch assignments updated successfully!");
      setAssignDialogOpen(false);
      fetchBranchAssignments();
    } catch (error: any) {
      toast.error(error.message || "Failed to update branch assignments");
    } finally {
      setActionLoading(null);
    }
  };

  // Group students by branch
  const studentsByBranch = studentUsers.reduce((acc, student) => {
    const branch = student.branch || "Unassigned";
    if (!acc[branch]) acc[branch] = [];
    acc[branch].push(student);
    return acc;
  }, {} as Record<string, StudentUser[]>);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><UserCheck className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><UserX className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "hod":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30"><Shield className="w-3 h-3 mr-1" />HOD</Badge>;
      case "staff":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Users className="w-3 h-3 mr-1" />Staff</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <ParallaxWrapper>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Approve, manage, and assign branches to staff</p>
          </div>

          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Approvals
                {pendingApprovals.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingApprovals.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Staff ({staffUsers.length})
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Students by Branch
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Pending Approval Requests</CardTitle>
                  <CardDescription>Review and approve staff registration requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : pendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No pending approval requests</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingApprovals.map((approval) => (
                          <TableRow key={approval.id}>
                            <TableCell className="font-medium">
                              {approval.profile?.full_name || "Unknown"}
                            </TableCell>
                            <TableCell>{approval.profile?.email || "N/A"}</TableCell>
                            <TableCell>{getRoleBadge(approval.role)}</TableCell>
                            <TableCell>{approval.profile?.department || "N/A"}</TableCell>
                            <TableCell>
                              {new Date(approval.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(approval.id, approval.user_id)}
                                  disabled={actionLoading === approval.id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(approval.id)}
                                  disabled={actionLoading === approval.id}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staff">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Staff Members</CardTitle>
                  <CardDescription>Manage staff accounts and assign branches</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : staffUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No staff members registered</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Assigned Branches</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffUsers.map((staff) => {
                          const staffBranches = getStaffBranches(staff.id);
                          return (
                            <TableRow key={staff.id}>
                              <TableCell className="font-medium">{staff.full_name}</TableCell>
                              <TableCell>{staff.email}</TableCell>
                              <TableCell>{staff.department}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {staffBranches.length > 0 ? (
                                    staffBranches.map((branch) => (
                                      <Badge key={branch} variant="secondary" className="text-xs">
                                        {branch}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground text-sm">No branches assigned</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openAssignDialog(staff)}
                                  >
                                    <GitBranch className="w-4 h-4 mr-1" />
                                    Assign Branches
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={actionLoading === staff.id}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Remove
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove {staff.full_name}? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRemoveStaff(staff.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Students by Branch</CardTitle>
                  <CardDescription>View and manage students organized by their branch</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : Object.keys(studentsByBranch).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No students registered</p>
                    </div>
                  ) : (
                    <Tabs defaultValue={Object.keys(studentsByBranch).sort()[0]} className="space-y-4">
                      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                        {Object.entries(studentsByBranch)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([branch, students]) => (
                            <TabsTrigger
                              key={branch}
                              value={branch}
                              className="flex items-center gap-2 data-[state=active]:bg-background"
                            >
                              <GitBranch className="w-3 h-3" />
                              {branch}
                              <Badge variant="secondary" className="ml-1 text-xs">
                                {students.length}
                              </Badge>
                            </TabsTrigger>
                          ))}
                      </TabsList>

                      {Object.entries(studentsByBranch)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([branch, students]) => (
                          <TabsContent key={branch} value={branch}>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Roll Number</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Department</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {students.map((student) => (
                                  <TableRow key={student.id}>
                                    <TableCell className="font-medium">{student.roll_number}</TableCell>
                                    <TableCell>{student.full_name}</TableCell>
                                    <TableCell>{student.email}</TableCell>
                                    <TableCell>{student.department}</TableCell>
                                    <TableCell>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={actionLoading === student.user_id}
                                          >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Remove
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to remove {student.full_name}? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleRemoveStudent(student.user_id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Remove
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TabsContent>
                        ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ParallaxWrapper>

      {/* Branch Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Branches</DialogTitle>
            <DialogDescription>
              Select branches to assign to {selectedStaff?.full_name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {availableBranches.map((branch) => (
                <div key={branch} className="flex items-center space-x-2">
                  <Checkbox
                    id={branch}
                    checked={selectedBranches.includes(branch)}
                    onCheckedChange={() => handleBranchToggle(branch)}
                  />
                  <Label htmlFor={branch} className="cursor-pointer">{branch}</Label>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveBranchAssignments}
              disabled={actionLoading === selectedStaff?.id}
            >
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HODUserManagement;
