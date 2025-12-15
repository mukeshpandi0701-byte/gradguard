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
import { Plus, Trash2, BookOpen, Loader2, Copy } from "lucide-react";

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
  const [allDepartments, setAllDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [copying, setCopying] = useState(false);
  
  // New subjects form state
  const [addStep, setAddStep] = useState<"count" | "details">("count");
  const [subjectCount, setSubjectCount] = useState<number>(1);
  const [selectedAddBranch, setSelectedAddBranch] = useState("");
  const [newSubjects, setNewSubjects] = useState<{ subject_code: string; subject_name: string }[]>([]);
  
  // Copy subjects form state
  const [copyFrom, setCopyFrom] = useState({ department: "", branch: "" });
  const [copyTo, setCopyTo] = useState("");
  const [sourceBranches, setSourceBranches] = useState<string[]>([]);
  const [sourceSubjects, setSourceSubjects] = useState<Subject[]>([]);

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

      // Fetch all departments for copy functionality
      const { data: allDepts } = await supabase
        .from("student_profiles")
        .select("department");
      
      const uniqueDepts = Array.from(new Set((allDepts || []).map(d => d.department).filter(Boolean))) as string[];
      setAllDepartments(uniqueDepts);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const fetchSourceBranches = async (department: string) => {
    if (!department) {
      setSourceBranches([]);
      setSourceSubjects([]);
      return;
    }
    
    try {
      const { data: branchData } = await supabase
        .from("student_profiles")
        .select("branch")
        .eq("department", department);
      
      const uniqueBranches = Array.from(new Set((branchData || []).map(b => b.branch).filter(Boolean))) as string[];
      setSourceBranches(uniqueBranches);
      
      // Fetch subjects for the department
      const { data: subjectsData } = await supabase
        .from("branch_subjects")
        .select("*")
        .eq("department", department);
      
      setSourceSubjects(subjectsData || []);
    } catch (error) {
      console.error("Error fetching source branches:", error);
    }
  };

  const handleCopySubjects = async () => {
    if (!copyFrom.branch || !copyTo) {
      toast.error("Please select source and target branches");
      return;
    }

    const subjectsToCopy = sourceSubjects.filter(s => s.branch === copyFrom.branch);
    if (subjectsToCopy.length === 0) {
      toast.error("No subjects found in the source branch");
      return;
    }

    setCopying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newSubjects = subjectsToCopy.map(s => ({
        branch: copyTo,
        subject_code: s.subject_code,
        subject_name: s.subject_name,
        department: userDepartment,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from("branch_subjects")
        .insert(newSubjects);

      if (error) {
        if (error.code === "23505") {
          toast.error("Some subjects already exist in the target branch");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Copied ${subjectsToCopy.length} subjects successfully`);
      setCopyDialogOpen(false);
      setCopyFrom({ department: "", branch: "" });
      setCopyTo("");
      fetchSubjectsAndBranches();
    } catch (error: any) {
      toast.error(error.message || "Failed to copy subjects");
      console.error(error);
    } finally {
      setCopying(false);
    }
  };

  const handleProceedToDetails = () => {
    if (!selectedAddBranch) {
      toast.error("Please select a branch");
      return;
    }
    if (subjectCount < 1 || subjectCount > 20) {
      toast.error("Number of subjects must be between 1 and 20");
      return;
    }
    // Initialize empty subject entries
    setNewSubjects(Array(subjectCount).fill(null).map(() => ({ subject_code: "", subject_name: "" })));
    setAddStep("details");
  };

  const updateSubjectField = (index: number, field: "subject_code" | "subject_name", value: string) => {
    setNewSubjects(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddSubjects = async () => {
    // Validate all subjects have codes
    const invalidSubjects = newSubjects.filter(s => !s.subject_code.trim());
    if (invalidSubjects.length > 0) {
      toast.error("All subjects must have a subject code");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const subjectsToInsert = newSubjects.map(s => ({
        branch: selectedAddBranch,
        subject_code: s.subject_code.toUpperCase().trim(),
        subject_name: s.subject_name.trim() || null,
        department: userDepartment,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from("branch_subjects")
        .insert(subjectsToInsert);

      if (error) {
        if (error.code === "23505") {
          toast.error("Some subject codes already exist for this branch");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`${newSubjects.length} subject(s) added successfully`);
      resetAddDialog();
      fetchSubjectsAndBranches();
    } catch (error: any) {
      toast.error(error.message || "Failed to add subjects");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const resetAddDialog = () => {
    setDialogOpen(false);
    setAddStep("count");
    setSubjectCount(1);
    setSelectedAddBranch("");
    setNewSubjects([]);
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
          <div className="flex gap-2">
            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy From
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card">
                <DialogHeader>
                  <DialogTitle>Copy Subjects from Another Branch</DialogTitle>
                  <DialogDescription>
                    Copy all subjects from one branch to another
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Source Department</Label>
                    <Select
                      value={copyFrom.department}
                      onValueChange={(value) => {
                        setCopyFrom({ department: value, branch: "" });
                        fetchSourceBranches(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {allDepartments.map(dept => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source Branch</Label>
                    <Select
                      value={copyFrom.branch}
                      onValueChange={(value) => setCopyFrom({ ...copyFrom, branch: value })}
                      disabled={!copyFrom.department}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceBranches.map(branch => {
                          const count = sourceSubjects.filter(s => s.branch === branch).length;
                          return (
                            <SelectItem key={branch} value={branch}>
                              {branch} ({count} subjects)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Branch (in {userDepartment})</Label>
                    <Select value={copyTo} onValueChange={setCopyTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target branch" />
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
                  {copyFrom.branch && (
                    <div className="text-sm text-muted-foreground">
                      {sourceSubjects.filter(s => s.branch === copyFrom.branch).length} subjects will be copied
                    </div>
                  )}
                  <Button onClick={handleCopySubjects} disabled={copying} className="w-full">
                    {copying ? "Copying..." : "Copy Subjects"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              if (!open) resetAddDialog();
              else setDialogOpen(true);
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subjects
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {addStep === "count" ? "Add New Subjects" : `Enter Subject Details (${newSubjects.length})`}
                  </DialogTitle>
                  <DialogDescription>
                    {addStep === "count" 
                      ? "Select branch and specify how many subjects to add"
                      : `Enter details for ${newSubjects.length} subject(s) in ${selectedAddBranch}`
                    }
                  </DialogDescription>
                </DialogHeader>
                
                {addStep === "count" ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Branch *</Label>
                      <Select
                        value={selectedAddBranch}
                        onValueChange={setSelectedAddBranch}
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
                      <Label>Number of Subjects *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={subjectCount}
                        onChange={(e) => setSubjectCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      />
                      <p className="text-xs text-muted-foreground">Enter between 1 and 20 subjects</p>
                    </div>
                    <Button onClick={handleProceedToDetails} className="w-full">
                      Next
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="space-y-3">
                      {newSubjects.map((subject, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                          <div className="text-xs font-medium text-muted-foreground">Subject {index + 1}</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Code *</Label>
                              <Input
                                placeholder="e.g., CS101"
                                value={subject.subject_code}
                                onChange={(e) => updateSubjectField(index, "subject_code", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input
                                placeholder="e.g., Data Structures"
                                value={subject.subject_name}
                                onChange={(e) => updateSubjectField(index, "subject_name", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setAddStep("count")} className="flex-1">
                        Back
                      </Button>
                      <Button onClick={handleAddSubjects} disabled={saving} className="flex-1">
                        {saving ? "Adding..." : `Add ${newSubjects.length} Subject(s)`}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
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
