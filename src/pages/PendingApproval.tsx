import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const PendingApproval = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Error during sign out:", error);
      localStorage.clear();
      navigate("/auth");
    }
  };

  const handleCheckStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: approval } = await supabase
        .from("user_approvals")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (approval?.status === "approved") {
        toast.success("Your account has been approved!");
        navigate("/dashboard");
      } else if (approval?.status === "rejected") {
        toast.error("Your account request was rejected. Please contact the administrator.");
      } else {
        toast.info("Your account is still pending approval.");
      }
    } catch (error) {
      console.error("Error checking approval status:", error);
      toast.error("Failed to check approval status");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <img src={logo} alt="GradGuard" className="w-10 h-10 object-contain" />
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-yellow-500/10 rounded-full">
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
          <CardDescription>
            Your account is awaiting approval from an administrator.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            You will be able to access the dashboard once your account has been approved.
            This usually takes 1-2 business days.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>An HOD will review your registration</li>
              <li>You'll receive access once approved</li>
              <li>Check back here to verify your status</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button onClick={handleCheckStatus} className="w-full">
            Check Approval Status
          </Button>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PendingApproval;
