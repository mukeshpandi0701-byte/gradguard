import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Building2, GraduationCap, Users, GitBranch } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  college: string | null;
  department: string | null;
  branch: string | null;
  panel_type: string | null;
}

interface BranchWithCount {
  branch: string;
  studentCount: number;
}

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHOD, setIsHOD] = useState(false);
  const [assignedBranches, setAssignedBranches] = useState<BranchWithCount[]>([]);
  const [totalStudentCount, setTotalStudentCount] = useState(0);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    college: "",
    department: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user is HOD
      const isHodByEmail = user.email?.includes("@cietcbe.hod.edu.in") || false;
      
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "hod")
        .maybeSingle();
      
      setIsHOD(!!roleData || isHodByEmail);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          email: data.email || "",
          phone_number: data.phone_number || "",
          college: data.college || "",
          department: data.department || "",
        });

        // Fetch assigned branches for staff with student counts
        if (!isHodByEmail && !roleData) {
          const { data: branchData } = await supabase
            .from("staff_branch_assignments")
            .select("branch")
            .eq("staff_user_id", user.id);
          
          if (branchData && branchData.length > 0) {
            const branchesWithCounts: BranchWithCount[] = await Promise.all(
              branchData.map(async (b) => {
                const { count } = await supabase
                  .from("student_profiles")
                  .select("*", { count: "exact", head: true })
                  .eq("branch", b.branch);
                return { branch: b.branch, studentCount: count || 0 };
              })
            );
            setAssignedBranches(branchesWithCounts);
          }
        }

        // Fetch total student count for HOD
        if (isHodByEmail || roleData) {
          const { count } = await supabase
            .from("student_profiles")
            .select("*", { count: "exact", head: true })
            .eq("department", data.department);
          setTotalStudentCount(count || 0);
        }
      } else {
        // Profile might not exist yet, set email from auth
        setFormData(prev => ({
          ...prev,
          email: user.email || "",
        }));
      }
    } catch (error: any) {
      toast.error("Failed to fetch profile");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          college: formData.college,
          department: formData.department,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      fetchProfile();
    } catch (error: any) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold">{isHOD ? "HOD Profile" : "Tutor Profile"}</h2>
          <p className="text-muted-foreground mt-2">
            Manage your personal and institutional details
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your profile details. Email is used for notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Institutional Details
            </CardTitle>
            <CardDescription>
              Your college and department information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="college" className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  College
                </Label>
                <Input
                  id="college"
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  placeholder="Enter your college"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Department
                </Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Enter your department"
                />
              </div>

              {isHOD && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Department Statistics
                  </Label>
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{totalStudentCount}</p>
                        <p className="text-sm text-muted-foreground">Total Students in Department</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isHOD && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="branch" className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    Assigned Branches
                  </Label>
                  {assignedBranches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {assignedBranches.map((item) => (
                        <div key={item.branch} className="p-3 bg-muted rounded-md flex items-center justify-between">
                          <Badge variant="secondary">{item.branch}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {item.studentCount} student{item.studentCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      No branches assigned yet. Contact your HOD for branch assignment.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
