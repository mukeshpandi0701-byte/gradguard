import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "hod" | "staff" | "student";

interface UseUserRoleResult {
  role: AppRole | null;
  isLoading: boolean;
  error: Error | null;
  hasRole: (targetRole: AppRole) => boolean;
}

/**
 * Hook to fetch and verify user role from the database (user_roles table)
 * This provides server-side role verification instead of relying on user_metadata
 */
export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        // Fetch role from user_roles table (server-side verification)
        const { data, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (roleError) {
          throw new Error(`Failed to fetch user role: ${roleError.message}`);
        }

        if (data) {
          setRole(data.role as AppRole);
        } else {
          // No role found in database
          setRole(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (targetRole: AppRole): boolean => {
    return role === targetRole;
  };

  return { role, isLoading, error, hasRole };
}
