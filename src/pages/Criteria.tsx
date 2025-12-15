import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Save, Lock } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Criteria {
  min_attendance_percentage: number;
  min_internal_marks: number;
  max_pending_fees: number;
  max_internal_marks: number;
  total_fees: number;
  total_hours: number;
  max_sessions_per_day: number;
  attendance_weightage: number;
  internal_weightage: number;
  fees_weightage: number;
}

const Criteria = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHOD, setIsHOD] = useState(false);
  const [criteria, setCriteria] = useState<Criteria>({
    min_attendance_percentage: 75,
    min_internal_marks: 40,
    max_pending_fees: 10000,
    max_internal_marks: 100,
    total_fees: 100000,
    total_hours: 100,
    max_sessions_per_day: 7,
    attendance_weightage: 0.4,
    internal_weightage: 0.3,
    fees_weightage: 0.3,
  });

  useEffect(() => {
    checkRoleAndFetchCriteria();
  }, []);

  const checkRoleAndFetchCriteria = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user is HOD
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const userIsHOD = roleData?.role === "hod";
      setIsHOD(userIsHOD);

      if (userIsHOD) {
        // HOD fetches their own criteria
        const { data, error } = await supabase
          .from("dropout_criteria")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setCriteria({
            min_attendance_percentage: data.min_attendance_percentage,
            min_internal_marks: data.min_internal_marks,
            max_pending_fees: data.max_pending_fees,
            max_internal_marks: data.max_internal_marks,
            total_fees: data.total_fees,
            total_hours: data.total_hours,
            max_sessions_per_day: (data as any).max_sessions_per_day ?? 7,
            attendance_weightage: data.attendance_weightage,
            internal_weightage: data.internal_weightage,
            fees_weightage: data.fees_weightage,
          });
        }
      } else {
        // Staff fetches HOD's criteria from their department
        const { data: profile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .single();

        if (profile?.department) {
          // Find HOD from the same department
          const { data: hodProfiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("department", profile.department)
            .eq("panel_type", "hod");

          if (hodProfiles && hodProfiles.length > 0) {
            const hodId = hodProfiles[0].id;
            const { data: hodCriteria } = await supabase
              .from("dropout_criteria")
              .select("*")
              .eq("user_id", hodId)
              .single();

            if (hodCriteria) {
              setCriteria({
                min_attendance_percentage: hodCriteria.min_attendance_percentage,
                min_internal_marks: hodCriteria.min_internal_marks,
                max_pending_fees: hodCriteria.max_pending_fees,
                max_internal_marks: hodCriteria.max_internal_marks,
                total_fees: hodCriteria.total_fees,
                total_hours: hodCriteria.total_hours,
                max_sessions_per_day: (hodCriteria as any).max_sessions_per_day ?? 7,
                attendance_weightage: hodCriteria.attendance_weightage,
                internal_weightage: hodCriteria.internal_weightage,
                fees_weightage: hodCriteria.fees_weightage,
              });
            }
          }
        }
      }
    } catch (error: any) {
      if (error.code !== "PGRST116") {
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isHOD) {
      toast.error("Only HODs can modify criteria settings");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Normalize weightages to sum to 1
      const total = criteria.attendance_weightage + criteria.internal_weightage + criteria.fees_weightage;
      const normalized = {
        ...criteria,
        attendance_weightage: criteria.attendance_weightage / total,
        internal_weightage: criteria.internal_weightage / total,
        fees_weightage: criteria.fees_weightage / total,
      };

      const { error } = await supabase
        .from("dropout_criteria")
        .upsert({
          user_id: user.id,
          ...normalized,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success("Criteria saved successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to save criteria");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Dropout Criteria Settings</h1>
          <p className="text-muted-foreground">
            {isHOD 
              ? "Configure the thresholds and weightages for dropout risk prediction"
              : "View the criteria settings configured by your HOD"}
          </p>
          {!isHOD && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
              <Lock className="w-4 h-4" />
              <span>These settings are managed by your HOD and are read-only</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Minimum Thresholds
                {!isHOD && <Lock className="w-4 h-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {isHOD ? "Set the minimum acceptable values for each metric" : "Minimum acceptable values set by HOD"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="attendance">Minimum Attendance Percentage</Label>
                <Input
                  id="attendance"
                  type="number"
                  value={criteria.min_attendance_percentage}
                  onChange={(e) => setCriteria({ ...criteria, min_attendance_percentage: Number(e.target.value) })}
                  min={0}
                  max={100}
                  disabled={!isHOD}
                  className={!isHOD ? "bg-muted" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Students below this attendance % will be flagged
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marks">Minimum Internal Marks (Pass Threshold)</Label>
                <Input
                  id="marks"
                  type="number"
                  value={criteria.min_internal_marks}
                  onChange={(e) => setCriteria({ ...criteria, min_internal_marks: Number(e.target.value) })}
                  min={0}
                  max={criteria.max_internal_marks}
                  disabled={!isHOD}
                  className={!isHOD ? "bg-muted" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Students scoring below this will be flagged
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fees">Maximum Allowed Pending Fees (₹)</Label>
                <Input
                  id="fees"
                  type="number"
                  value={criteria.max_pending_fees}
                  onChange={(e) => setCriteria({ ...criteria, max_pending_fees: Number(e.target.value) })}
                  min={0}
                  disabled={!isHOD}
                  className={!isHOD ? "bg-muted" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Students with higher pending fees will be flagged
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Course Maximums
                {!isHOD && <Lock className="w-4 h-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {isHOD ? "Set the maximum values for calculating percentages from CSV data" : "Maximum values set by HOD"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="maxMarks">Maximum Internal Marks</Label>
                <Input
                  id="maxMarks"
                  type="number"
                  value={criteria.max_internal_marks}
                  onChange={(e) => setCriteria({ ...criteria, max_internal_marks: Number(e.target.value) })}
                  min={1}
                  disabled={!isHOD}
                  className={!isHOD ? "bg-muted" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Total marks out of which internal marks are scored
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalFees">Total Course Fees (₹)</Label>
                <Input
                  id="totalFees"
                  type="number"
                  value={criteria.total_fees}
                  onChange={(e) => setCriteria({ ...criteria, total_fees: Number(e.target.value) })}
                  min={0}
                  disabled={!isHOD}
                  className={!isHOD ? "bg-muted" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Total fees for the entire course
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxSessionsPerDay">Maximum Sessions Per Day</Label>
                <Input
                  id="maxSessionsPerDay"
                  type="number"
                  value={criteria.max_sessions_per_day}
                  onChange={(e) => setCriteria({ ...criteria, max_sessions_per_day: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                  min={1}
                  max={10}
                  disabled={!isHOD}
                  className={!isHOD ? "bg-muted" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum number of class sessions per day (1-10). Attendance % is calculated as attended/total sessions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Risk Calculation Weightages
                {!isHOD && <Lock className="w-4 h-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {isHOD ? "Adjust the importance of each factor (will be automatically normalized)" : "Weightages set by HOD"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Attendance Weightage</Label>
                    <span className="text-sm font-medium">{(criteria.attendance_weightage * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[criteria.attendance_weightage * 100]}
                    onValueChange={(value) => setCriteria({ ...criteria, attendance_weightage: value[0] / 100 })}
                    max={100}
                    step={5}
                    disabled={!isHOD}
                    className={!isHOD ? "opacity-60" : ""}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Internal Marks Weightage</Label>
                    <span className="text-sm font-medium">{(criteria.internal_weightage * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[criteria.internal_weightage * 100]}
                    onValueChange={(value) => setCriteria({ ...criteria, internal_weightage: value[0] / 100 })}
                    max={100}
                    step={5}
                    disabled={!isHOD}
                    className={!isHOD ? "opacity-60" : ""}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Fees Weightage</Label>
                    <span className="text-sm font-medium">{(criteria.fees_weightage * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[criteria.fees_weightage * 100]}
                    onValueChange={(value) => setCriteria({ ...criteria, fees_weightage: value[0] / 100 })}
                    max={100}
                    step={5}
                    disabled={!isHOD}
                    className={!isHOD ? "opacity-60" : ""}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {isHOD && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="lg">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Criteria"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Criteria;
