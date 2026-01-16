import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PING_INTERVAL = 4 * 60 * 1000; // Ping every 4 minutes to keep backend alive

export function useKeepAlive() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        // Simple health check - just get session to keep connection alive
        await supabase.auth.getSession();
      } catch {
        // Silently ignore errors - this is just a keep-alive
      }
    };

    // Initial ping
    ping();

    // Set up interval
    intervalRef.current = setInterval(ping, PING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
