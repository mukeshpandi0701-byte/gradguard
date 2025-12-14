import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Building2, GraduationCap, Users } from "lucide-react";
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

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHOD, setIsHOD] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    college: "",
    department: "",
    branch: "",
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
          branch: data.branch || "",
        });
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
          branch: formData.branch,
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

              {!isHOD && (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    placeholder="Enter your branch"
                  />
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
