import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Download, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseCSV } from "@/lib/csvParser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BulkUploadDialogProps {
  onUploadComplete: () => void;
}

export const BulkUploadDialog = ({ onUploadComplete }: BulkUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);

    try {
      const { preview } = await parseCSV(selectedFile);
      setPreviewData(preview);
    } catch (error) {
      toast.error("Failed to parse CSV file");
      console.error(error);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading("Uploading students...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get criteria for defaults
      const { data: criteria } = await supabase
        .from("dropout_criteria")
        .select("total_hours, total_fees, max_internal_marks")
        .eq("user_id", user.id)
        .single();

      const { data: parsedStudents } = await parseCSV(file);

      const studentsToInsert = parsedStudents.map((student) => {
        const totalHours = criteria?.total_hours || 100;
        const totalFees = criteria?.total_fees || 100000;

        const attendancePercentage = (student.attendedHours / totalHours) * 100;
        const feePaidPercentage = (student.paidFees / totalFees) * 100;
        const pendingFees = totalFees - student.paidFees;

        return {
          user_id: user.id,
          student_name: student.studentName,
          roll_number: student.rollNumber || null,
          email: student.email || null,
          attended_hours: student.attendedHours,
          total_hours: totalHours,
          internal_marks: student.internalMarks,
          paid_fees: student.paidFees,
          total_fees: totalFees,
          attendance_percentage: attendancePercentage,
          fee_paid_percentage: feePaidPercentage,
          pending_fees: pendingFees,
          department: null, // Can be set manually later
        };
      });

      const { error } = await supabase.from("students").insert(studentsToInsert);

      if (error) throw error;

      toast.dismiss(loadingToast);
      toast.success(`Successfully uploaded ${studentsToInsert.length} students`);
      setOpen(false);
      setFile(null);
      setPreviewData([]);
      onUploadComplete();
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to upload students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `Student Name,Roll Number,Email,Attended Hours,Paid Fees,Internal Marks
John Doe,CS001,john@example.com,80,45000,85
Jane Smith,CS002,jane@example.com,75,50000,78
Mike Johnson,CS003,mike@example.com,90,40000,92`;

    const blob = new Blob([sampleData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_upload_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Sample CSV downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Students</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload CSV</TabsTrigger>
            <TabsTrigger value="guide">Format Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload a CSV file with student data. Make sure it follows the format shown in the Format Guide tab.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </div>

              {previewData.length > 0 && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-2">Preview (First 5 rows)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key} className="text-left p-2">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, idx) => (
                          <tr key={idx} className="border-b">
                            {Object.values(row).map((val: any, i) => (
                              <td key={i} className="p-2">
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!file || loading}>
                  {loading ? "Uploading..." : "Upload Students"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">CSV Format Requirements</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your CSV file should contain the following columns. Column names are flexible and will be auto-detected.
                </p>
              </div>

              <Card className="p-4">
                <h4 className="font-semibold mb-3">Required Columns</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <strong>Student Name</strong> - Full name of the student
                      <br />
                      <span className="text-muted-foreground text-xs">Variations: "Name", "Student", "Nombre"</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <strong>Roll Number</strong> (Optional) - Student ID or registration number
                      <br />
                      <span className="text-muted-foreground text-xs">Variations: "Roll", "ID", "Number", "Enrollment"</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <strong>Email</strong> (Optional) - Student email address
                      <br />
                      <span className="text-muted-foreground text-xs">Variations: "E-mail", "Mail", "Email ID"</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <strong>Attended Hours</strong> - Hours attended by student
                      <br />
                      <span className="text-muted-foreground text-xs">Variations: "Attended", "Present", "Attendance Hours"</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <strong>Paid Fees</strong> - Amount of fees paid
                      <br />
                      <span className="text-muted-foreground text-xs">Variations: "Paid Fees", "Fees Paid", "Amount Paid", "Fees"</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <strong>Internal Marks</strong> - Internal assessment marks
                      <br />
                      <span className="text-muted-foreground text-xs">Variations: "Marks", "Internal", "Score", "Grade", "Internal Score"</span>
                    </div>
                  </li>
                </ul>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold mb-3">Supported Formats</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Numbers can include currency symbols (₹, $) and commas</li>
                  <li>• Percentages can be written with % symbol</li>
                  <li>• Fractions like "40/50" will be converted to percentages</li>
                  <li>• Empty values, "NA", or "null" will be treated as 0</li>
                </ul>
              </Card>

              <div className="flex justify-center pt-2">
                <Button onClick={downloadSampleCSV} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
