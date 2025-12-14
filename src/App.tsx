import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthSelector from "./pages/AuthSelector";
import StaffAuth from "./pages/StaffAuth";
import StudentAuth from "./pages/StudentAuth";
import HODAuth from "./pages/HODAuth";
import PendingApproval from "./pages/PendingApproval";
import HODUserManagement from "./pages/HODUserManagement";
import StudentDashboard from "./pages/StudentDashboard";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Attendance from "./pages/Attendance";
import AttendanceReports from "./pages/AttendanceReports";
import Students from "./pages/Students";
import Criteria from "./pages/Criteria";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import NotificationSettings from "./pages/NotificationSettings";
import StudentsWithSelection from "./pages/StudentsWithSelection";
import StudentDetail from "./pages/StudentDetail";
import StudentProfile from "./pages/StudentProfile";
import SocialProfiles from "./pages/SocialProfiles";
import History from "./pages/History";


const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthSelector />} />
        <Route path="/auth/staff" element={<StaffAuth />} />
        <Route path="/auth/student" element={<StudentAuth />} />
        <Route path="/auth/hod" element={<HODAuth />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/hod/user-management" element={<HODUserManagement />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance-reports" element={<AttendanceReports />} />
        <Route path="/students" element={<Students />} />
        <Route path="/criteria" element={<Criteria />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/students-export" element={<StudentsWithSelection />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/students/:id/profile" element={<StudentProfile />} />
        <Route path="/social-profiles" element={<SocialProfiles />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notification-settings" element={<NotificationSettings />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <FloatingOrbs />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
