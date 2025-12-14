import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight, BarChart3, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

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
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary p-2">
              <img src={logo} alt="GradGuard" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              GradGuard
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center pt-20 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Student Success Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight">
              <span className="block mb-2">Protecting Student Success,</span>
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                One Prediction at a Time
              </span>
            </h1>

            {/* Sub-heading */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Identify at-risk students early with AI-powered analytics and improve retention rates through data-driven interventions
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-lg px-8 py-6 shadow-glow hover:shadow-glow-strong transition-all group"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-8 pt-12 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-success" />
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span>Proven Results</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary p-1.5">
                <img src={logo} alt="GradGuard" className="w-full h-full object-contain" />
              </div>
              <span className="font-display font-semibold text-foreground">GradGuard</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              © 2025 GradGuard. Protecting Student Success.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
