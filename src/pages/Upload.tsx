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
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const csvFiles = selectedFiles.filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) {
      toast.error("Please upload CSV files only");
      return;
    }

    setFiles(csvFiles);
    toast.loading(`Parsing ${csvFiles.length} CSV file(s)...`);

    try {
      let allData: ParsedStudent[] = [];
      let allPreview: any[] = [];

      for (const file of csvFiles) {
        const { data, preview } = await parseCSV(file);
        const department = file.name.replace('.csv', '');
        
        // Add department to each student record
        const dataWithDept = data.map(student => ({
          ...student,
          department
        }));
        
        allData = [...allData, ...dataWithDept];
        allPreview = [...allPreview, ...preview];
      }

      setParsedData(allData);
      setPreview(allPreview);
      toast.dismiss();
      toast.success(`Successfully parsed ${allData.length} student records from ${csvFiles.length} file(s)!`);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to parse CSV files");
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
        department: (student as any).department || 'Unknown',
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Upload Student Data</h2>
          <p className="text-muted-foreground mt-2">
            Upload CSV files with student information. You can upload multiple files at once.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Upload section */}
          <div className="space-y-6">
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Upload CSV Files</CardTitle>
                <CardDescription>
                  Select one or multiple CSV files to upload
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    multiple
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
                          {files.length > 0 ? `${files.length} file(s) selected` : "Click to upload CSV files"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or drag and drop your files here
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Selected files:</p>
                    {files.map((file, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        {file.name}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {preview.length > 0 && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Preview ({parsedData.length} students detected)</CardTitle>
                <CardDescription>All uploaded student data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
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
                      {parsedData.map((student, idx) => (
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
                      setFiles([]);
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

          {/* Right side - Format guide */}
          <div>

            <Card className="shadow-elevated h-fit sticky top-6">
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
                        <TableHead className="w-20">Column</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Column Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">1</TableCell>
                        <TableCell>Roll Number</TableCell>
                        <TableCell className="font-mono text-primary text-xs">Roll No</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">2</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell className="font-mono text-primary text-xs">Name</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">3</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell className="font-mono text-primary text-xs">Email</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">4</TableCell>
                        <TableCell>Attended hours</TableCell>
                        <TableCell className="font-mono text-primary text-xs">Attended hours</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">5</TableCell>
                        <TableCell>Internal Score</TableCell>
                        <TableCell className="font-mono text-primary text-xs">Internal Score</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">6</TableCell>
                        <TableCell>Fees Paid</TableCell>
                        <TableCell className="font-mono text-primary text-xs">Fees Paid</TableCell>
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Upload;
