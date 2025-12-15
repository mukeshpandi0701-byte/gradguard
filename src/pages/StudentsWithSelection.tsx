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

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id);

      if (studentsError) throw studentsError;

      // Fetch predictions separately
      const studentIds = (studentsData || []).map(s => s.id);
      const { data: predictionsData } = await supabase
        .from("predictions")
        .select("student_id, final_risk_level, ml_probability, suggestions, insights")
        .in("student_id", studentIds);

      // Merge predictions with students
      const studentsWithPredictions = (studentsData || []).map(student => ({
        ...student,
        predictions: (predictionsData || [])
          .filter(p => p.student_id === student.id)
          .map(p => ({
            final_risk_level: p.final_risk_level,
            ml_probability: p.ml_probability,
            suggestions: p.suggestions,
            insights: p.insights
          }))
      }));

      setStudents(studentsWithPredictions);
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
