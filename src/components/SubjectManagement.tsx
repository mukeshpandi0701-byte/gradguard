import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen, Loader2 } from "lucide-react";

interface Subject {
  id: string;
  branch: string;
  subject_code: string;
  subject_name: string | null;
  department: string;
}

interface SubjectManagementProps {
  userDepartment: string;
}

const SubjectManagement = ({ userDepartment }: SubjectManagementProps) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  
  // New subject form state
  const [newSubject, setNewSubject] = useState({
    branch: "",
    subject_code: "",
    subject_name: "",
  });

  useEffect(() => {
    fetchSubjectsAndBranches();
  }, [userDepartment]);

  const fetchSubjectsAndBranches = async () => {
    setLoading(true);
    try {
      // Fetch all subjects for this department
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("branch_subjects")
        .select("*")
        .eq("department", userDepartment)
        .order("branch")
        .order("subject_code");

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Get unique branches from student_profiles
      const { data: branchData, error: branchError } = await supabase
        .from("student_profiles")
        .select("branch")
        .eq("department", userDepartment);

      if (branchError) throw branchError;
      
      const uniqueBranches = Array.from(new Set((branchData || []).map(b => b.branch).filter(Boolean))) as string[];
      setBranches(uniqueBranches);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject.branch || !newSubject.subject_code) {
      toast.error("Branch and Subject Code are required");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("branch_subjects")
        .insert({
          branch: newSubject.branch,
          subject_code: newSubject.subject_code.toUpperCase(),
          subject_name: newSubject.subject_name || null,
          department: userDepartment,
          created_by: user.id,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("This subject code already exists for this branch");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Subject added successfully");
      setNewSubject({ branch: "", subject_code: "", subject_name: "" });
      setDialogOpen(false);
      fetchSubjectsAndBranches();
    } catch (error: any) {
      toast.error(error.message || "Failed to add subject");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm("Are you sure you want to delete this subject? This will also delete all associated marks.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("branch_subjects")
        .delete()
        .eq("id", subjectId);

      if (error) throw error;

      toast.success("Subject deleted successfully");
      fetchSubjectsAndBranches();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete subject");
      console.error(error);
    }
  };

  const filteredSubjects = selectedBranch === "all"
    ? subjects
    : subjects.filter(s => s.branch === selectedBranch);

  // Group subjects by branch for display
  const subjectsByBranch = filteredSubjects.reduce((acc, subject) => {
    if (!acc[subject.branch]) {
      acc[subject.branch] = [];
    }
    acc[subject.branch].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Subject Configuration
            </CardTitle>
            <CardDescription>
              Configure subjects for each branch. Staff will use these to enter marks.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Add New Subject</DialogTitle>
                <DialogDescription>
                  Add a subject for a specific branch
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select
                    value={newSubject.branch}
                    onValueChange={(value) => setNewSubject({ ...newSubject, branch: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(branch => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject Code *</Label>
                  <Input
                    placeholder="e.g., CS101, MA201"
                    value={newSubject.subject_code}
                    onChange={(e) => setNewSubject({ ...newSubject, subject_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject Name (Optional)</Label>
                  <Input
                    placeholder="e.g., Data Structures"
                    value={newSubject.subject_name}
                    onChange={(e) => setNewSubject({ ...newSubject, subject_name: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddSubject} disabled={saving} className="w-full">
                  {saving ? "Adding..." : "Add Subject"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No branches found. Students need to sign up first.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {Object.keys(subjectsByBranch).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No subjects configured yet. Click "Add Subject" to get started.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(subjectsByBranch).map(([branch, branchSubjects]) => (
                  <div key={branch}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{branch}</Badge>
                      <span className="text-sm text-muted-foreground">
                        ({branchSubjects.length} subjects)
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject Code</TableHead>
                          <TableHead>Subject Name</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {branchSubjects.map(subject => (
                          <TableRow key={subject.id}>
                            <TableCell className="font-mono font-medium">
                              {subject.subject_code}
                            </TableCell>
                            <TableCell>
                              {subject.subject_name || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSubject(subject.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SubjectManagement;
