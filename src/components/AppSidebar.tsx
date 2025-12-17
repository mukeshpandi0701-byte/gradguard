import { Home, Upload, Users, FileText, Settings, BarChart3, Bell, LogOut, FileDown, Search, History as HistoryIcon, ClipboardCheck, Shield, BookOpen, CalendarDays } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Academic Updates", url: "/upload", icon: Upload },
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Attendance Reports", url: "/attendance-reports", icon: BarChart3 },
  { title: "Assignment Scores", url: "/assignment-scores", icon: BookOpen },
  { title: "Students", url: "/students", icon: Users },
  { title: "Export Student PDFs", url: "/students-export", icon: FileDown },
  { title: "Reports & Analytics", url: "/reports", icon: BarChart3 },
];

const settingsItems = [
  { title: "Profile", url: "/profile", icon: Settings },
  { title: "Download History", url: "/history", icon: HistoryIcon },
];

const hodSettingsItems = [
  { title: "Dropout Criteria", url: "/criteria", icon: FileText },
  { title: "Profile", url: "/profile", icon: Settings },
];

const hodItems = [
  { title: "User Management", url: "/hod/user-management", icon: Shield },
  { title: "Subject Management", url: "/hod/subjects", icon: BookOpen },
  { title: "Academic Calendar", url: "/hod/calendar", icon: CalendarDays },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Array<{ id: string; student_name: string; roll_number: string | null }>>([]);
  const [filteredStudents, setFilteredStudents] = useState<Array<{ id: string; student_name: string; roll_number: string | null }>>([]);
  
  // Initialize from sessionStorage to prevent blank during refresh
  const [isHOD, setIsHOD] = useState<boolean | null>(() => {
    const stored = sessionStorage.getItem('user_role_is_hod');
    return stored !== null ? stored === 'true' : null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    // If we have a stored role, don't show loading initially
    return sessionStorage.getItem('user_role_is_hod') === null;
  });

  useEffect(() => {
    const init = async () => {
      // Only show loading if we don't have a cached role
      if (sessionStorage.getItem('user_role_is_hod') === null) {
        setIsLoading(true);
      }
      await checkHODStatus();
      await fetchStudents();
      setIsLoading(false);
    };
    void init();
  }, []);

  const checkHODStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Primary check: user_roles table for HOD role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "hod")
          .maybeSingle();
        
        if (roleData) {
          setIsHOD(true);
          sessionStorage.setItem('user_role_is_hod', 'true');
          return;
        }
        
        // Fallback: check profiles table panel_type
        const { data: profile } = await supabase
          .from("profiles")
          .select("panel_type")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.panel_type === "hod") {
          setIsHOD(true);
          sessionStorage.setItem('user_role_is_hod', 'true');
          return;
        }

        // Final fallback: email domain pattern for HOD accounts
        if (user.email?.endsWith("@cietcbe.hod.edu.in")) {
          setIsHOD(true);
          sessionStorage.setItem('user_role_is_hod', 'true');
          return;
        }

        setIsHOD(false);
        sessionStorage.setItem('user_role_is_hod', 'false');
      } else {
        setIsHOD(false);
        sessionStorage.removeItem('user_role_is_hod');
      }
    } catch (error) {
      console.error("Error checking HOD status:", error);
      // Don't clear cached role on error
      if (isHOD === null) {
        setIsHOD(false);
      }
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStudents([]);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = students.filter(
        (student) =>
          student.student_name.toLowerCase().includes(query) ||
          (student.roll_number && student.roll_number.toLowerCase().includes(query))
      );
      setFilteredStudents(filtered.slice(0, 5)); // Show max 5 results
    }
  }, [searchQuery, students]);

  const fetchStudents = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const currentUser = sessionData.user;

      // If we can't determine user, skip fetching students
      if (!currentUser) return;

      // Check if HOD
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .eq("role", "hod")
        .maybeSingle();

      const userIsHOD = !!roleData;

      if (userIsHOD) {
        // HOD: Fetch students filtered by department
        const { data: hodProfile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", currentUser.id)
          .maybeSingle();

        let query = supabase
          .from("student_profiles")
          .select("id, full_name, roll_number, department, branch")
          .order("roll_number", { ascending: true, nullsFirst: false });

        if (hodProfile?.department) {
          query = query.eq("department", hodProfile.department);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        setStudents((data || []).map(s => ({
          id: s.id,
          student_name: s.full_name || "Unknown",
          roll_number: s.roll_number,
        })));
      } else {
        // Staff: Fetch students filtered by assigned branches
        const { data: branchData } = await supabase
          .from("staff_branch_assignments")
          .select("branch")
          .eq("staff_user_id", currentUser.id);

        const branches = (branchData || []).map(b => b.branch);

        if (branches.length === 0) {
          setStudents([]);
          return;
        }

        const { data, error } = await supabase
          .from("student_profiles")
          .select("id, full_name, roll_number, branch")
          .in("branch", branches)
          .order("roll_number", { ascending: true, nullsFirst: false });

        if (error) throw error;
        
        setStudents((data || []).map(s => ({
          id: s.id,
          student_name: s.full_name || "Unknown",
          roll_number: s.roll_number,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
    }
  };

  const handleStudentClick = (studentId: string) => {
    navigate(`/students/${studentId}`);
    setSearchQuery("");
  };

  const handleLogout = async () => {
    try {
      // Clear cached role
      sessionStorage.removeItem('user_role_is_hod');
      // Always clear local session first
      await supabase.auth.signOut({ scope: 'local' });
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      // Even if there's an error, clear local storage and navigate
      console.error("Error during sign out:", error);
      sessionStorage.removeItem('user_role_is_hod');
      localStorage.clear();
      toast.success("Signed out");
      navigate("/auth");
    }
  };

  // Don't render until HOD status is determined
  const showAsHOD = isHOD === true;

  // Show loading skeleton while determining role
  if (isLoading || isHOD === null) {
    return (
      <Sidebar collapsible="offcanvas" className="border-r border-border/50 backdrop-blur-sm" style={{ width: '220px' }}>
        <SidebarHeader className="border-b border-border/50 p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="flex items-center justify-center">
            <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/50 backdrop-blur-sm" style={{ width: '220px' }}>
      <SidebarHeader className="border-b border-border/50 p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="flex items-center justify-center">
          <img 
            src={logo} 
            alt="GradGuard Logo" 
            className={`transition-all duration-300 ${open ? 'h-12 w-12' : 'h-8 w-8'} object-contain`}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {filteredStudents.length > 0 && (
            <div className="mt-2 rounded-md border border-border bg-card p-2 space-y-1">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentClick(student.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                >
                  <div className="font-medium">{student.student_name}</div>
                  {student.roll_number && (
                    <div className="text-xs text-muted-foreground">{student.roll_number}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter((item) => {
                  // Hide specific modules for HOD users
                  if (showAsHOD) {
                    const hiddenForHOD = [
                      "/upload",
                      "/attendance",
                      "/attendance-reports",
                      "/assignment-scores",
                      "/students-export",
                      "/reports",
                      "/notifications",
                    ];
                    return !hiddenForHOD.includes(item.url);
                  }
                  return true;
                })
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-accent hover:text-accent-foreground"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAsHOD && (
          <SidebarGroup>
            <SidebarGroupLabel>HOD Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hodItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-accent hover:text-accent-foreground"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(showAsHOD ? hodSettingsItems : settingsItems).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-accent hover:text-accent-foreground"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="w-full hover:bg-destructive hover:text-destructive-foreground">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
