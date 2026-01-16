import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HealthState {
  isWakingUp: boolean;
  isHealthy: boolean;
  retryCount: number;
}

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000;

export function useSupabaseHealth() {
  const [state, setState] = useState<HealthState>({
    isWakingUp: false,
    isHealthy: true,
    retryCount: 0,
  });

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      // Simple health check - try to get current session
      const { error } = await supabase.auth.getSession();
      if (error) {
        // Check if it's a network/timeout error (cold start)
        if (error.message?.includes('fetch') || 
            error.message?.includes('network') ||
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('timeout')) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const wakeUp = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isWakingUp: true, retryCount: 0 }));
    
    for (let i = 0; i < MAX_RETRIES; i++) {
      setState(prev => ({ ...prev, retryCount: i + 1 }));
      
      const isHealthy = await checkHealth();
      if (isHealthy) {
        setState({ isWakingUp: false, isHealthy: true, retryCount: 0 });
        return true;
      }
      
      // Exponential backoff
      const delay = INITIAL_DELAY * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    setState(prev => ({ ...prev, isWakingUp: false, isHealthy: false }));
    return false;
  }, [checkHealth]);

  // Initial health check on mount
  useEffect(() => {
    let mounted = true;

    const initialCheck = async () => {
      const isHealthy = await checkHealth();
      if (!mounted) return;
      
      if (!isHealthy) {
        // Backend might be cold, try to wake it up
        await wakeUp();
      }
    };

    initialCheck();

    return () => {
      mounted = false;
    };
  }, [checkHealth, wakeUp]);

  return {
    ...state,
    wakeUp,
    checkHealth,
  };
}
