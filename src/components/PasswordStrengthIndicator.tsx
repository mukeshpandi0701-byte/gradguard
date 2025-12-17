import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const checks = useMemo(() => {
    return {
      length: password.length >= 6,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    };
  }, [password]);

  const strength = useMemo(() => {
    const passed = Object.values(checks).filter(Boolean).length;
    if (passed === 0) return { label: "", color: "", width: "0%" };
    if (passed === 1) return { label: "Weak", color: "bg-destructive", width: "25%" };
    if (passed === 2) return { label: "Fair", color: "bg-orange-500", width: "50%" };
    if (passed === 3) return { label: "Good", color: "bg-yellow-500", width: "75%" };
    return { label: "Strong", color: "bg-green-500", width: "100%" };
  }, [checks]);

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: strength.width }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground min-w-[50px]">
          {strength.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className={`flex items-center gap-1 ${checks.length ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          6+ characters
        </div>
        <div className={`flex items-center gap-1 ${checks.uppercase ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.uppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          Uppercase
        </div>
        <div className={`flex items-center gap-1 ${checks.lowercase ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.lowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          Lowercase
        </div>
        <div className={`flex items-center gap-1 ${checks.number ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.number ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          Number
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;
