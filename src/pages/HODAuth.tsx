import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

const COLLEGES = [
  { value: "CIET", label: "Coimbatore Institute of Engineering and Technology (CIET)" },
  { value: "SRIT", label: "Sri Ramakrishna Institute of Technology (SRIT)" },
  { value: "KPRIET", label: "KPR Institute of Engineering and Technology (KPRIET)" },
];

const DEPARTMENTS = [
  { value: "CSE", label: "Computer Science and Engineering (CSE)" },
  { value: "AIDS", label: "Artificial Intelligence and Data Science (AIDS)" },
  { value: "IT", label: "Information Technology (IT)" },
];

const HODAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");

  const validateEmail = (email: string) => {
    const hodEmailPattern = /^[a-zA-Z]+@cietcbe\.hod\.edu\.in$/;
    return hodEmailPattern.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast.error("Please use your HOD email (format: name@cietcbe.hod.edu.in)");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast.error("Please use your HOD email (format: name@cietcbe.hod.edu.in)");
      setLoading(false);
      return;
    }

    if (!fullName || !college || !department) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            panel_type: "hod",
            college,
            department,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast.success("Account created! Your account is pending approval. Please wait for an administrator to approve your access.");
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <img src={logo} alt="GradGuard" className="w-10 h-10 object-contain" />
            </div>
          </div>
          <CardTitle className="text-2xl">HOD Panel</CardTitle>
          <CardDescription>
            Sign in with your HOD email (name@cietcbe.hod.edu.in)
          </CardDescription>
        </CardHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mx-4" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">HOD Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@collegenameplace.hod.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate("/auth")}
                  className="text-sm"
                >
                  ← Back to panel selection
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupEmail">HOD Email *</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    placeholder="name@collegenameplace.hod.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPassword">Password *</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="college">College *</Label>
                  <Select value={college} onValueChange={setCollege}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your college" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLLEGES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate("/auth")}
                  className="text-sm"
                >
                  ← Back to panel selection
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default HODAuth;
