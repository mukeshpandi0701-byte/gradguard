import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateStudentReportPDF, StudentReportData } from "@/lib/pdfExport";
import { DashboardLayout } from "@/components/DashboardLayout";

const StudentsWithSelection = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          predictions(final_risk_level, ml_probability, suggestions, insights)
        `);

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }

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
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to generate PDF");
      console.error(error);
    } finally {
      setExporting(false);
    }
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
          <Button onClick={handleExportSelected} disabled={exporting || selectedStudents.size === 0} size="sm">
            <FileDown className="w-4 h-4 mr-2" />
            Export Selected ({selectedStudents.size})
          </Button>
        </div>

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
