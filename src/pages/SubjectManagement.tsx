import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import SubjectManagement from "@/components/SubjectManagement";

const SubjectManagementPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isHOD, setIsHOD] = useState(false);
  const [userDepartment, setUserDepartment] = useState<string>("");

  useEffect(() => {
    checkAccessAndFetchDepartment();
  }, []);

  const checkAccessAndFetchDepartment = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user is HOD
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role !== "hod") {
        navigate("/dashboard");
        return;
      }

      setIsHOD(true);

      // Fetch HOD's department
      const { data: hodProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();
      
      if (hodProfile?.department) {
        setUserDepartment(hodProfile.department);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isHOD) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Subject Management</h1>
          <p className="text-muted-foreground">
            Configure subjects for each branch in your department. Staff will use these to enter marks.
          </p>
        </div>

        {userDepartment && <SubjectManagement userDepartment={userDepartment} />}
      </main>
    </div>
  );
};

export default SubjectManagementPage;
