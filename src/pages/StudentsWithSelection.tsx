import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateStudentReportPDF, StudentReportData } from "@/lib/pdfExport";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { Badge } from "@/components/ui/badge";

const StudentsWithSelection = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch assigned branches for staff
      const { data: branchData } = await supabase
        .from("staff_branch_assignments")
        .select("branch")
        .eq("staff_user_id", user.id);

      const branches = (branchData || []).map(b => b.branch);

      if (branches.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch student profiles from assigned branches
      const { data: studentProfiles, error: profilesError } = await supabase
        .from("student_profiles")
        .select("*")
        .in("branch", branches)
        .order('roll_number', { ascending: true, nullsFirst: false });

      if (profilesError) throw profilesError;

      // Fetch student academic data from students table
      const rollNumbers = (studentProfiles || []).map(sp => sp.roll_number).filter(Boolean);
      const { data: studentsData } = await supabase
        .from("students")
        .select("roll_number, attendance_percentage, fee_paid_percentage, pending_fees, internal_marks")
        .in("roll_number", rollNumbers);

      // Create a map of student data by roll_number
      const studentsDataMap = new Map(
        (studentsData || []).map(s => [s.roll_number, s])
      );

      // Fetch attendance records aggregated by student_id
      const profileIds = (studentProfiles || []).map(sp => sp.id);
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select("student_id, sessions_attended, max_sessions")
        .in("student_id", profileIds);

      // Aggregate attendance per student
      const attendanceMap = new Map<string, { attended: number; total: number }>();
      (attendanceRecords || []).forEach((record: any) => {
        const current = attendanceMap.get(record.student_id) || { attended: 0, total: 0 };
        current.attended += record.sessions_attended;
        current.total += record.max_sessions;
        attendanceMap.set(record.student_id, current);
      });

      // Fetch predictions
      const { data: predictionsData } = await supabase
        .from("predictions")
        .select("student_id, final_risk_level, ml_probability, suggestions, insights")
        .eq("user_id", user.id);

      const predictionsMap = new Map(
        (predictionsData || []).map(p => [p.student_id, p])
      );

      // Map student_profiles with all data
      const studentsWithData = (studentProfiles || []).map(sp => {
        const academicData = studentsDataMap.get(sp.roll_number);
        const attendanceData = attendanceMap.get(sp.id);
        const prediction = predictionsMap.get(sp.id);

        // Calculate attendance from records, fallback to students table
        let attendancePercentage = 0;
        if (attendanceData && attendanceData.total > 0) {
          attendancePercentage = Math.min(100, (attendanceData.attended / attendanceData.total) * 100);
        } else if (academicData?.attendance_percentage != null) {
          attendancePercentage = Number(academicData.attendance_percentage);
        }

        return {
          id: sp.id,
          student_name: sp.full_name || sp.email,
          roll_number: sp.roll_number,
          email: sp.email,
          department: sp.branch || sp.department,
          attendance_percentage: attendancePercentage,
          fee_paid_percentage: academicData?.fee_paid_percentage ?? 0,
          pending_fees: academicData?.pending_fees ?? 0,
          internal_marks: academicData?.internal_marks ?? 0,
          predictions: prediction ? [{
            final_risk_level: prediction.final_risk_level,
            ml_probability: prediction.ml_probability,
            suggestions: prediction.suggestions,
            insights: prediction.insights
          }] : []
        };
      });

      setStudents(studentsWithData);
    } catch (error: any) {
      toast.error("Failed to fetch students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportClick = () => {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }
    setShowPreview(true);
  };

  const handleExportSelected = async () => {
    if (selectedStudents.size === 0) return;

    setExporting(true);
    toast.loading("Generating PDF reports...");

    try {
      const selectedData: StudentReportData[] = students
        .filter(s => selectedStudents.has(s.id))
        .map(s => ({
          student_name: s.student_name,
          roll_number: s.roll_number,
          attendance_percentage: s.attendance_percentage || 0,
          internal_marks: s.internal_marks || 0,
          fee_paid_percentage: s.fee_paid_percentage || 0,
          pending_fees: s.pending_fees || 0,
          riskLevel: s.predictions?.[0]?.final_risk_level || "medium",
          mlProbability: s.predictions?.[0]?.ml_probability || 0,
          email: s.email,
          suggestions: s.predictions?.[0]?.suggestions,
          insights: s.predictions?.[0]?.insights,
        }));

      await generateStudentReportPDF(selectedData);
      toast.dismiss();
      toast.success(`Generated PDF reports for ${selectedData.length} students!`);
      setShowPreview(false);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to generate PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const renderPreviewContent = () => {
    const selectedData = students.filter(s => selectedStudents.has(s.id));
    
    const getRiskColor = (level: string) => {
      switch (level?.toLowerCase()) {
        case "low": return "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400";
        case "medium": return "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
        case "high": return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
        default: return "border-border bg-muted text-foreground";
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-primary">Student Reports Preview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedData.length} student{selectedData.length !== 1 ? 's' : ''} selected for export
          </p>
        </div>

        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground sticky top-0">
              <tr>
                <th className="p-2 text-left font-semibold">Name</th>
                <th className="p-2 text-left font-semibold">Roll No</th>
                <th className="p-2 text-left font-semibold">Risk Level</th>
                <th className="p-2 text-left font-semibold">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {selectedData.map((student, idx) => (
                <tr key={student.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="p-2 font-medium">{student.student_name}</td>
                  <td className="p-2">{student.roll_number || "N/A"}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={getRiskColor(student.predictions?.[0]?.final_risk_level)}>
                      {student.predictions?.[0]?.final_risk_level?.toUpperCase() || "UNKNOWN"}
                    </Badge>
                  </td>
                  <td className="p-2">{student.attendance_percentage?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Each student will get a comprehensive PDF report with all their details, insights, and recommendations.</p>
        </div>
      </div>
    );
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStudents(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Students with Predictions</h2>
          <Button onClick={handleExportClick} disabled={exporting || selectedStudents.size === 0} size="sm">
            <FileDown className="w-4 h-4 mr-2" />
            Export Selected ({selectedStudents.size})
          </Button>
        </div>

        <PDFPreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          title="Preview Student Reports PDF"
          description="Review the selected students before generating their reports"
          previewContent={renderPreviewContent()}
          onConfirmExport={handleExportSelected}
          isExporting={exporting}
        />

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedStudents.size === students.length && students.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-sm">Name</TableHead>
                <TableHead className="text-sm">Roll No</TableHead>
                <TableHead className="text-sm">Attendance</TableHead>
                <TableHead className="text-sm">Marks</TableHead>
                <TableHead className="text-sm">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={() => toggleSelection(student.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">{student.student_name}</TableCell>
                  <TableCell className="text-sm">{student.roll_number || "—"}</TableCell>
                  <TableCell className="text-sm">{student.attendance_percentage?.toFixed(1)}%</TableCell>
                  <TableCell className="text-sm">{student.internal_marks}</TableCell>
                  <TableCell className="text-sm">{student.predictions?.[0]?.final_risk_level?.toUpperCase() || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentsWithSelection;
