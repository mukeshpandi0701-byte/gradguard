import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import logo from "@/assets/logo.png";

const COLLEGES = [
  { value: "CIET", label: "Coimbatore Institute of Engineering and Technology (CIET)" },
  { value: "SRIT", label: "Sri Ramakrishna Institute of Technology (SRIT)" },
  { value: "KPRIET", label: "KPR Institute of Engineering and Technology (KPRIET)" },
];

const YEARS = [
  { value: "I", label: "I Year" },
  { value: "II", label: "II Year" },
  { value: "III", label: "III Year" },
  { value: "IV", label: "IV Year" },
];

const DEPARTMENTS = [
  { value: "CSE", label: "Computer Science and Engineering (CSE)" },
  { value: "AIDS", label: "Artificial Intelligence and Data Science (AIDS)" },
  { value: "IT", label: "Information Technology (IT)" },
];

const BRANCHES: Record<string, { value: string; label: string }[]> = {
  CSE: [
    { value: "CSE-A", label: "CSE-A" },
    { value: "CSE-B", label: "CSE-B" },
    { value: "CSE(CY)", label: "CSE(CY)" },
    { value: "CSE(AIML)", label: "CSE(AIML)" },
  ],
  AIDS: [
    { value: "AIDS-A", label: "AIDS-A" },
    { value: "AIDS-B", label: "AIDS-B" },
  ],
  IT: [
    { value: "IT", label: "IT" },
  ],
};

const StudentAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [college, setCollege] = useState("");
  const [year, setYear] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");

  const validateEmail = (email: string) => {
    // Student email format: rollnumber@ciet.in
    const studentEmailPattern = /^\d+@ciet\.in$/;
    return studentEmailPattern.test(email);
  };

  const extractRollNumber = (email: string) => {
    const match = email.match(/^(\d+)@ciet\.in$/);
    return match ? match[1] : null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast.error("Invalid email format. Student email should be rollnumber@ciet.in");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Login successful!");
      navigate("/student-dashboard");
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
      toast.error("Invalid email format. Student email should be rollnumber@ciet.in");
      setLoading(false);
      return;
    }

    if (!fullName || !college || !year || !department || !branch) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      return;
    }

    const rollNumber = extractRollNumber(email);
    const branchWithYear = `${year} ${branch}`;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            panel_type: "student",
            roll_number: rollNumber,
            college,
            year,
            department,
            branch: branchWithYear,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast.success("Account created successfully! Redirecting...");
      navigate("/student-dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (value: string) => {
    setDepartment(value);
    setBranch(""); // Reset branch when department changes
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg">
            <img src={logo} alt="GradGuard" className="w-10 h-10 object-contain" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">Student Panel</h1>
        <p className="text-center text-muted-foreground mb-6">Login with your student email</p>
        
        <Card className="shadow-elevated">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="login-email">Email</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p>Use your student email in the format: <strong>rollnumber@ciet.in</strong></p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="rollnumber@collegename.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Format: rollnumber@ciet.in</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
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
                  <Link to="/auth/staff" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Are you a staff member? Login here
                  </Link>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="signup-email">Email *</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p>Use your student email in the format: <strong>rollnumber@ciet.in</strong></p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="rollnumber@collegename.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Format: rollnumber@ciet.in</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <PasswordStrengthIndicator password={password} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="college">College *</Label>
                    <Select value={college} onValueChange={setCollege}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select college" />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year *</Label>
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((y) => (
                            <SelectItem key={y.value} value={y.value}>
                              {y.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department *</Label>
                      <Select value={department} onValueChange={handleDepartmentChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dept" />
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
                  </div>
                  {department && (
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch *</Label>
                      <Select value={branch} onValueChange={setBranch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRANCHES[department]?.map((b) => (
                            <SelectItem key={b.value} value={b.value}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                  <Link to="/auth/staff" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Are you a staff member? Sign up here
                  </Link>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default StudentAuth;