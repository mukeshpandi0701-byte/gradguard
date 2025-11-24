import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background/95 to-primary/5 relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col relative z-10">
          <header className="h-14 border-b border-white/10 backdrop-blur-xl bg-card/50 flex items-center justify-between px-4 sticky top-0 z-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.1)]">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <img 
                src={logo} 
                alt="GradGuard Logo" 
                className="h-8 w-8 object-contain"
              />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 overflow-auto">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
