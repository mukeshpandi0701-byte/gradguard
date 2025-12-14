import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Crown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

const AuthSelector = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center mb-8">
          <div className="p-4 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg">
            <img src={logo} alt="GradGuard" className="w-12 h-12 object-contain" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Welcome to GradGuard</h1>
        <p className="text-center text-muted-foreground mb-8">Select your login type to continue</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
            onClick={() => navigate("/auth/hod")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-primary/10 rounded-full mb-4">
                <Crown className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-xl">HOD Panel</CardTitle>
              <CardDescription>
                For Heads of Department
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Manage students, classes, and department analytics
              </p>
              <Button variant="outline" className="w-full">
                Continue as HOD
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg hover:border-secondary/50 transition-all duration-300 hover:-translate-y-1"
            onClick={() => navigate("/auth/staff")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-secondary/10 rounded-full mb-4">
                <Users className="w-10 h-10 text-secondary" />
              </div>
              <CardTitle className="text-xl">Staff Panel</CardTitle>
              <CardDescription>
                For faculty and tutors
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                View student analytics, reports, and send notifications
              </p>
              <Button variant="outline" className="w-full">
                Continue as Staff
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg hover:border-accent/50 transition-all duration-300 hover:-translate-y-1"
            onClick={() => navigate("/auth/student")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-accent/10 rounded-full mb-4">
                <GraduationCap className="w-10 h-10 text-accent-foreground" />
              </div>
              <CardTitle className="text-xl">Student Panel</CardTitle>
              <CardDescription>
                For students to view their progress
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                View your attendance, marks, and risk assessment
              </p>
              <Button variant="outline" className="w-full">
                Continue as Student
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuthSelector;