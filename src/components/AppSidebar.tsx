import { Home, Upload, Users, FileText, Settings, BarChart3, Bell, LogOut, FileDown, Search, History as HistoryIcon, ClipboardCheck } from "lucide-react";
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
  { title: "Students", url: "/students", icon: Users },
  { title: "Export Student PDFs", url: "/students-export", icon: FileDown },
  { title: "Reports & Analytics", url: "/reports", icon: BarChart3 },
  { title: "Send Notifications", url: "/notifications", icon: Bell },
];

const settingsItems = [
  { title: "Dropout Criteria", url: "/criteria", icon: FileText },
  { title: "Profile", url: "/profile", icon: Settings },
  { title: "Notification Settings", url: "/notification-settings", icon: Bell },
  { title: "Download History", url: "/history", icon: HistoryIcon },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Array<{ id: string; student_name: string; roll_number: string | null }>>([]);
  const [filteredStudents, setFilteredStudents] = useState<Array<{ id: string; student_name: string; roll_number: string | null }>>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

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
      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, roll_number")
        .order("roll_number", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setStudents(data || []);
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
      // Always clear local session first
      await supabase.auth.signOut({ scope: 'local' });
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      // Even if there's an error, clear local storage and navigate
      console.error("Error during sign out:", error);
      localStorage.clear();
      toast.success("Signed out");
      navigate("/auth");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 backdrop-blur-sm" style={{ width: open ? '200px' : undefined }}>
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
              {mainItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
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
