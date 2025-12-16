import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, Lock, AlertTriangle, Target, BarChart3, Scale } from "lucide-react";

interface Criteria {
  min_attendance_percentage: number;
  min_internal_marks: number;
  max_pending_fees: number;
  max_internal_marks: number;
  total_fees: number;
  total_hours: number;
  max_sessions_per_day: number;
  num_internal_exams: number;
  attendance_weightage: number;
  internal_weightage: number;
  fees_weightage: number;
  assignment_weightage: number;
}

const Criteria = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHOD, setIsHOD] = useState(false);
  const [hodName, setHodName] = useState<string | null>(null);
  const [hodCriteriaExists, setHodCriteriaExists] = useState(true);
  const [activeTab, setActiveTab] = useState("thresholds");
  const [criteria, setCriteria] = useState<Criteria>({
    min_attendance_percentage: 75,
    min_internal_marks: 40,
    max_pending_fees: 10000,
    max_internal_marks: 100,
    total_fees: 100000,
    total_hours: 100,
    max_sessions_per_day: 7,
    num_internal_exams: 3,
    attendance_weightage: 0.3,
    internal_weightage: 0.25,
    fees_weightage: 0.25,
    assignment_weightage: 0.2,
  });

  useEffect(() => {
    checkRoleAndFetchCriteria();
  }, []);

  const checkRoleAndFetchCriteria = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const userIsHOD = roleData?.role === "hod";
      setIsHOD(userIsHOD);

      if (userIsHOD) {
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
            num_internal_exams: (data as any).num_internal_exams ?? 3,
            attendance_weightage: data.attendance_weightage,
            internal_weightage: data.internal_weightage,
            fees_weightage: data.fees_weightage,
            assignment_weightage: (data as any).assignment_weightage ?? 0,
          });
        }
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("department")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.department) {
          const staffDept = profile.department.trim();
          
          // Use user_roles table to find actual HODs (source of truth)
          const { data: hodRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "hod");

          const hodUserIds = (hodRoles || []).map(r => r.user_id);

          if (hodUserIds.length > 0) {
            const { data: hodProfiles } = await supabase
              .from("profiles")
              .select("id, full_name, email, department")
              .in("id", hodUserIds);

            const matchingHod = hodProfiles?.find(
              hod => hod.department?.trim().toLowerCase() === staffDept.toLowerCase()
            );

            if (matchingHod) {
              setHodName(matchingHod.full_name || matchingHod.email || "HOD");
              
              const { data: hodCriteria } = await supabase
                .from("dropout_criteria")
                .select("*")
                .eq("user_id", matchingHod.id)
                .maybeSingle();

              if (hodCriteria) {
                setHodCriteriaExists(true);
                setCriteria({
                  min_attendance_percentage: hodCriteria.min_attendance_percentage,
                  min_internal_marks: hodCriteria.min_internal_marks,
                  max_pending_fees: hodCriteria.max_pending_fees,
                  max_internal_marks: hodCriteria.max_internal_marks,
                  total_fees: hodCriteria.total_fees,
                  total_hours: hodCriteria.total_hours,
                  max_sessions_per_day: (hodCriteria as any).max_sessions_per_day ?? 7,
                  num_internal_exams: (hodCriteria as any).num_internal_exams ?? 3,
                  attendance_weightage: hodCriteria.attendance_weightage,
                  internal_weightage: hodCriteria.internal_weightage,
                  fees_weightage: hodCriteria.fees_weightage,
                  assignment_weightage: (hodCriteria as any).assignment_weightage ?? 0,
                });
              } else {
                setHodCriteriaExists(false);
              }
            } else {
              setHodCriteriaExists(false);
            }
          } else {
            setHodCriteriaExists(false);
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
      const total = criteria.attendance_weightage + criteria.internal_weightage + criteria.fees_weightage + criteria.assignment_weightage;
      const normalized = {
        ...criteria,
        attendance_weightage: total > 0 ? criteria.attendance_weightage / total : 0.25,
        internal_weightage: total > 0 ? criteria.internal_weightage / total : 0.25,
        fees_weightage: total > 0 ? criteria.fees_weightage / total : 0.25,
        assignment_weightage: total > 0 ? criteria.assignment_weightage / total : 0.25,
      };

      const { data, error } = await supabase
        .from("dropout_criteria")
        .upsert({
          user_id: user.id,
          ...normalized,
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Failed to save criteria - no data returned");
      }

      toast.success("Criteria saved successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to save criteria");
      console.error("Save criteria error:", error);
    } finally {
      setSaving(false);
    }
  };

  const totalWeightage = criteria.attendance_weightage + criteria.internal_weightage + criteria.fees_weightage + criteria.assignment_weightage;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderThresholds = () => (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Minimum Thresholds
          {!isHOD && <Lock className="w-4 h-4 text-muted-foreground" />}
        </CardTitle>
        <CardDescription>
          {isHOD ? "Set the minimum acceptable values for each metric" : "Minimum acceptable values set by HOD"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="attendance">Min Attendance %</Label>
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
            <p className="text-xs text-muted-foreground">Students below will be flagged</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marks">Min Internal Marks</Label>
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
            <p className="text-xs text-muted-foreground">Pass threshold</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fees">Max Pending Fees (₹)</Label>
            <Input
              id="fees"
              type="number"
              value={criteria.max_pending_fees}
              onChange={(e) => setCriteria({ ...criteria, max_pending_fees: Number(e.target.value) })}
              min={0}
              disabled={!isHOD}
              className={!isHOD ? "bg-muted" : ""}
            />
            <p className="text-xs text-muted-foreground">Higher = flagged</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderMaximums = () => (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Course Maximums
          {!isHOD && <Lock className="w-4 h-4 text-muted-foreground" />}
        </CardTitle>
        <CardDescription>
          {isHOD ? "Set the maximum values for calculating percentages" : "Maximum values set by HOD"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxMarks">Max Internal Marks</Label>
            <Input
              id="maxMarks"
              type="number"
              value={criteria.max_internal_marks}
              onChange={(e) => setCriteria({ ...criteria, max_internal_marks: Number(e.target.value) })}
              min={1}
              disabled={!isHOD}
              className={!isHOD ? "bg-muted" : ""}
            />
            <p className="text-xs text-muted-foreground">Total marks out of which internals are scored</p>
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
            <p className="text-xs text-muted-foreground">Total fees for the entire course</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSessionsPerDay">Max Sessions Per Day</Label>
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
            <p className="text-xs text-muted-foreground">1-10 sessions for attendance calculation</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numInternalExams">Number of CIA Exams</Label>
            <Input
              id="numInternalExams"
              type="number"
              value={criteria.num_internal_exams}
              onChange={(e) => setCriteria({ ...criteria, num_internal_exams: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
              min={1}
              max={5}
              disabled={!isHOD}
              className={!isHOD ? "bg-muted" : ""}
            />
            <p className="text-xs text-muted-foreground">
              CIA-I through CIA-{['I', 'II', 'III', 'IV', 'V'][criteria.num_internal_exams - 1]}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderWeightages = () => (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          Risk Calculation Weightages
          {!isHOD && <Lock className="w-4 h-4 text-muted-foreground" />}
        </CardTitle>
        <CardDescription>
          {isHOD ? "Set importance of each factor (auto-normalized to 100%)" : "Weightages set by HOD"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Attendance Weightage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(criteria.attendance_weightage * 100)}
                onChange={(e) => setCriteria({ ...criteria, attendance_weightage: Number(e.target.value) / 100 })}
                min={0}
                max={100}
                disabled={!isHOD}
                className={!isHOD ? "bg-muted" : ""}
              />
              <span className="text-sm font-medium w-12">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Internal Marks Weightage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(criteria.internal_weightage * 100)}
                onChange={(e) => setCriteria({ ...criteria, internal_weightage: Number(e.target.value) / 100 })}
                min={0}
                max={100}
                disabled={!isHOD}
                className={!isHOD ? "bg-muted" : ""}
              />
              <span className="text-sm font-medium w-12">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fees Weightage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(criteria.fees_weightage * 100)}
                onChange={(e) => setCriteria({ ...criteria, fees_weightage: Number(e.target.value) / 100 })}
                min={0}
                max={100}
                disabled={!isHOD}
                className={!isHOD ? "bg-muted" : ""}
              />
              <span className="text-sm font-medium w-12">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assignment Weightage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(criteria.assignment_weightage * 100)}
                onChange={(e) => setCriteria({ ...criteria, assignment_weightage: Number(e.target.value) / 100 })}
                min={0}
                max={100}
                disabled={!isHOD}
                className={!isHOD ? "bg-muted" : ""}
              />
              <span className="text-sm font-medium w-12">%</span>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total (will normalize to 100%)</span>
            <span className={`text-lg font-bold ${totalWeightage > 0 ? 'text-primary' : 'text-destructive'}`}>
              {Math.round(totalWeightage * 100)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Dropout Criteria Settings</h1>
          <p className="text-muted-foreground">
            {isHOD 
              ? "Configure dropout criteria for your department"
              : "View the criteria settings configured by your HOD"}
          </p>
          {!isHOD && hodCriteriaExists && hodName && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
              <Lock className="w-4 h-4" />
              <span>These settings are configured by <strong>{hodName}</strong> and are read-only</span>
            </div>
          )}
          {!isHOD && !hodCriteriaExists && (
            <div className="mt-2 flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="w-4 h-4" />
              <span>Your HOD has not configured the dropout criteria yet. Prediction features will be unavailable until criteria are set.</span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="thresholds" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Thresholds</span>
            </TabsTrigger>
            <TabsTrigger value="maximums" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Maximums</span>
            </TabsTrigger>
            <TabsTrigger value="weightages" className="flex items-center gap-2">
              <Scale className="w-4 h-4" />
              <span className="hidden sm:inline">Weightages</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="thresholds">
            {renderThresholds()}
          </TabsContent>

          <TabsContent value="maximums">
            {renderMaximums()}
          </TabsContent>

          <TabsContent value="weightages">
            {renderWeightages()}
          </TabsContent>
        </Tabs>

        {isHOD && (
          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Criteria"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Criteria;
