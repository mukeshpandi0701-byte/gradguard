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
import { Check, X, Trash2, Clock, UserCheck, UserX, Users, Shield } from "lucide-react";
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
}

const HODUserManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [studentUsers, setStudentUsers] = useState<StudentUser[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkHODAccess();
    fetchData();
  }, []);

  const checkHODAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("panel_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.panel_type !== "hod") {
        toast.error("Access denied. HOD privileges required.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error checking HOD access:", error);
      navigate("/dashboard");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPendingApprovals(),
      fetchStaffUsers(),
      fetchStudentUsers(),
    ]);
    setLoading(false);
  };

  const fetchPendingApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from("user_approvals")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for pending approvals
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

      setPendingApprovals(approvalsWithProfiles);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("panel_type", "staff")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStaffUsers(data || []);
    } catch (error) {
      console.error("Error fetching staff users:", error);
    }
  };

  const fetchStudentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStudentUsers(data || []);
    } catch (error) {
      console.error("Error fetching student users:", error);
    }
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
      fetchPendingApprovals();
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
      fetchPendingApprovals();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    setActionLoading(userId);
    try {
      // Delete from user_roles (cascades will handle the rest)
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      // Also delete from profiles
      await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      toast.success("Staff member removed successfully!");
      fetchStaffUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove staff member");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveStudent = async (userId: string) => {
    setActionLoading(userId);
    try {
      // Delete from user_roles
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      // Also delete from student_profiles
      await supabase
        .from("student_profiles")
        .delete()
        .eq("user_id", userId);

      toast.success("Student removed successfully!");
      fetchStudentUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove student");
    } finally {
      setActionLoading(null);
    }
  };

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
            <p className="text-muted-foreground">Approve, manage, and remove users</p>
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
                <Users className="w-4 h-4" />
                Students ({studentUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Pending Approval Requests</CardTitle>
                  <CardDescription>Review and approve staff and HOD registration requests</CardDescription>
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
                  <CardDescription>Manage registered staff accounts</CardDescription>
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
                          <TableHead>College</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffUsers.map((staff) => (
                          <TableRow key={staff.id}>
                            <TableCell className="font-medium">{staff.full_name}</TableCell>
                            <TableCell>{staff.email}</TableCell>
                            <TableCell>{staff.department}</TableCell>
                            <TableCell>{staff.college}</TableCell>
                            <TableCell>
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Students</CardTitle>
                  <CardDescription>Manage registered student accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : studentUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No students registered</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Roll Number</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>College</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentUsers.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.roll_number}</TableCell>
                            <TableCell>{student.full_name}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>{student.department}</TableCell>
                            <TableCell>{student.college}</TableCell>
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ParallaxWrapper>
    </DashboardLayout>
  );
};

export default HODUserManagement;
