import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload as UploadIcon, FileUp, Check, Info } from "lucide-react";
import { parseCSV, ParsedStudent } from "@/lib/csvParser";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/DashboardLayout";

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);
    toast.loading("Parsing CSV file...");

    try {
      const { data, preview } = await parseCSV(selectedFile);
      setParsedData(data);
      setPreview(preview);
      toast.dismiss();
      toast.success(`Successfully parsed ${data.length} student records!`);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to parse CSV file");
      console.error(error);
    }
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast.error("No data to upload");
      return;
    }

    setUploading(true);
    toast.loading("Uploading student data...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Extract department from filename (e.g., "II-CSE-B.csv" -> "II-CSE-B")
      const department = file?.name.replace('.csv', '') || 'Unknown';

      // Fetch criteria to get maximum values for calculations
      const { data: criteria, error: criteriaError } = await supabase
        .from("dropout_criteria")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (criteriaError && criteriaError.code !== "PGRST116") {
        throw new Error("Please set up your criteria first in the Criteria Settings page");
      }

      // Use defaults if criteria doesn't exist
      const maxInternalMarks = criteria?.max_internal_marks || 100;
      const totalFees = criteria?.total_fees || 100000;
      const totalHours = criteria?.total_hours || 100;

      // Upsert students (update if exists, insert if new)
      const studentsToUpsert = parsedData.map(student => ({
        user_id: user.id,
        student_name: student.studentName,
        roll_number: student.rollNumber,
        department: department,
        total_hours: totalHours,
        attended_hours: student.attendedHours,
        total_fees: totalFees,
        paid_fees: student.paidFees,
        internal_marks: student.internalMarks,
        email: student.email,
      }));

      // For students with roll_number, upsert; for those without, just insert
      const studentsWithRoll = studentsToUpsert.filter(s => s.roll_number);
      const studentsWithoutRoll = studentsToUpsert.filter(s => !s.roll_number);

      let error = null;

      // Upsert students with roll numbers
      if (studentsWithRoll.length > 0) {
        const { error: upsertError } = await supabase
          .from("students")
          .upsert(studentsWithRoll, {
            onConflict: 'user_id,student_name,roll_number',
            ignoreDuplicates: false
          });
        error = upsertError;
      }

      // Insert students without roll numbers
      if (studentsWithoutRoll.length > 0 && !error) {
        const { error: insertError } = await supabase
          .from("students")
          .insert(studentsWithoutRoll);
        error = insertError;
      }

      if (error) throw error;

      toast.dismiss();
      toast.success(`Successfully uploaded ${parsedData.length} students!`);
      navigate("/students");
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to upload data");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Upload Student Data</h2>
          <p className="text-muted-foreground mt-2">
            Upload a CSV file with student information. The system will automatically detect columns.
          </p>
        </div>

        <Card className="shadow-elevated mb-6">
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload your formatted CSV file following the guide below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileUp className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {file ? file.name : "Click to upload CSV file"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or drag and drop your file here
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elevated mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              CSV Format Guide
            </CardTitle>
            <CardDescription>
              Follow this format to ensure successful data upload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Required CSV Columns:</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Create CSV template
                    const headers = ['Roll No', 'Name', 'Email', 'Attended hours', 'Internal Score', 'Fees Paid'];
                    const sampleRow = ['21CS001', 'John Doe', 'john@example.com', '75', '85', '50000'];
                    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
                    
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'II-CSE-B.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    toast.success("Template downloaded!");
                  }}
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Column</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Column Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">1</TableCell>
                    <TableCell>Roll Number</TableCell>
                    <TableCell className="font-mono text-primary">Roll No</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">2</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell className="font-mono text-primary">Name</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">3</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell className="font-mono text-primary">Email</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">4</TableCell>
                    <TableCell>Attended hours</TableCell>
                    <TableCell className="font-mono text-primary">Attended hours</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">5</TableCell>
                    <TableCell>Internal Score</TableCell>
                    <TableCell className="font-mono text-primary">Internal Score</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">6</TableCell>
                    <TableCell>Fees Paid</TableCell>
                    <TableCell className="font-mono text-primary">Fees Paid</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">File Naming Convention:</h4>
              <p className="text-sm text-muted-foreground mb-2">Name your CSV file with the department name</p>
              <p className="font-mono text-primary">Example: II-CSE-B.csv</p>
            </div>
          </CardContent>
        </Card>

        {preview.length > 0 && (
          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle>Preview ({parsedData.length} students detected)</CardTitle>
              <CardDescription>First 5 rows of your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Attended Hours</TableHead>
                      <TableHead>Paid Fees</TableHead>
                      <TableHead>Internal Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 5).map((student, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{student.studentName}</TableCell>
                        <TableCell>{student.rollNumber || "—"}</TableCell>
                        <TableCell>{student.email || "—"}</TableCell>
                        <TableCell>{student.attendedHours}</TableCell>
                        <TableCell>₹{student.paidFees}</TableCell>
                        <TableCell>{student.internalMarks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setParsedData([]);
                }}>
                  Clear
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    "Uploading..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Upload {parsedData.length} Students
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Upload;
