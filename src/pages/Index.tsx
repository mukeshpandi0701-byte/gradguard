import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, BarChart3, Users, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-gradient-to-br from-primary to-secondary rounded-3xl shadow-elevated">
              <GraduationCap className="w-20 h-20 text-white" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Student Dropout Prediction System
          </h1>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            AI-powered early intervention system to identify at-risk students and improve retention rates through data-driven insights
          </p>

          <div className="flex justify-center mb-16">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="p-6 rounded-xl bg-card border shadow-card hover:shadow-elevated transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">ML-Powered Analytics</h3>
              <p className="text-muted-foreground">
                Advanced machine learning models predict dropout risk with high accuracy
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border shadow-card hover:shadow-elevated transition-all">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Student Tracking</h3>
              <p className="text-muted-foreground">
                Monitor attendance, performance, and fees in one unified dashboard
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border shadow-card hover:shadow-elevated transition-all">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Customizable Criteria</h3>
              <p className="text-muted-foreground">
                Configure thresholds and weightages to match your institution's needs
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
