import { Loader2, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BackendWakingUpProps {
  isWakingUp: boolean;
  isHealthy: boolean;
  retryCount: number;
  maxRetries?: number;
  onRetry: () => void;
}

export function BackendWakingUp({
  isWakingUp,
  isHealthy,
  retryCount,
  maxRetries = 5,
  onRetry,
}: BackendWakingUpProps) {
  if (isHealthy && !isWakingUp) return null;

  const progress = (retryCount / maxRetries) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-[90%] max-w-md">
        <CardContent className="pt-6">
          {isWakingUp ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Waking up the backend...</h3>
                <p className="text-sm text-muted-foreground">
                  The server was sleeping due to inactivity. This usually takes 10-30 seconds.
                </p>
              </div>
              <div className="w-full space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Attempt {retryCount} of {maxRetries}
                </p>
              </div>
            </div>
          ) : !isHealthy ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CloudOff className="h-12 w-12 text-destructive" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Connection Failed</h3>
                <p className="text-sm text-muted-foreground">
                  Unable to connect to the backend. Please check your internet connection and try again.
                </p>
              </div>
              <Button onClick={onRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
