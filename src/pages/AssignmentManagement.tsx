import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, BookOpen, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Subject {
  id: string;
  subject_code: string;
  subject_name: string | null;
  branch: string;
}

interface Assignment {
  id: string;
  assignment_name: string;
  description: string | null;
  max_marks: number;
  due_date: string | null;
  platform: string | null;
  subject_id: string;
  created_at: string;
  subject?: Subject;
}

interface AssignmentFormData {
  assignment_name: string;
  description: string;
  platform: string;
  due_date: string;
  max_marks: string;
}

const AssignmentManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  
  // Multi-step form state
  const [step, setStep] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [numberOfAssignments, setNumberOfAssignments] = useState(1);
  const [assignmentForms, setAssignmentForms] = useState<AssignmentFormData[]>([]);
  const [currentAssignmentIndex, setCurrentAssignmentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchAssignments();
    }
  }, [selectedBranch]);

  const checkAccessAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: branchAssignments } = await supabase
        .from("staff_branch_assignments")
        .select("branch")
        .eq("staff_user_id", user.id);

      if (!branchAssignments || branchAssignments.length === 0) {
        toast.error("No branches assigned to you");
        setLoading(false);
        return;
      }

      const branchList = branchAssignments.map(b => b.branch);
      setBranches(branchList);
      setSelectedBranch(branchList[0]);

      const { data: subjectsData } = await supabase
        .from("branch_subjects")
        .select("*")
        .in("branch", branchList);

      if (subjectsData) {
        setSubjects(subjectsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const branchSubjects = subjects.filter(s => s.branch === selectedBranch);
      const subjectIds = branchSubjects.map(s => s.id);

      if (subjectIds.length === 0) {
        setAssignments([]);
        return;
      }

      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("staff_user_id", user.id)
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const assignmentsWithSubjects = (data || []).map(a => ({
        ...a,
        subject: branchSubjects.find(s => s.id === a.subject_id)
      }));

      setAssignments(assignmentsWithSubjects);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to load assignments");
    }
  };

  const initializeAssignmentForms = () => {
    const forms: AssignmentFormData[] = [];
    for (let i = 0; i < numberOfAssignments; i++) {
      forms.push({
        assignment_name: "",
        description: "",
        platform: "",
        due_date: "",
        max_marks: "100"
      });
    }
    setAssignmentForms(forms);
    setCurrentAssignmentIndex(0);
    setStep(3);
  };

  const updateCurrentAssignment = (field: keyof AssignmentFormData, value: string) => {
    setAssignmentForms(prev => {
      const updated = [...prev];
      updated[currentAssignmentIndex] = {
        ...updated[currentAssignmentIndex],
        [field]: value
      };
      return updated;
    });
  };

  const handleSubmitAll = async () => {
    // Validate all assignments
    for (let i = 0; i < assignmentForms.length; i++) {
      if (!assignmentForms[i].assignment_name.trim()) {
        toast.error(`Please enter a title for Assignment ${i + 1}`);
        setCurrentAssignmentIndex(i);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const assignmentsToInsert = assignmentForms.map(form => ({
        staff_user_id: user.id,
        subject_id: selectedSubjectId,
        assignment_name: form.assignment_name,
        description: form.description || null,
        platform: form.platform || null,
        max_marks: parseFloat(form.max_marks) || 100,
        due_date: form.due_date || null
      }));

      const { error } = await supabase
        .from("assignments")
        .insert(assignmentsToInsert);

      if (error) throw error;

      toast.success(`${assignmentForms.length} assignment(s) created successfully`);
      setIsDialogOpen(false);
      resetForm();
      fetchAssignments();
    } catch (error) {
      console.error("Error saving assignments:", error);
      toast.error("Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingAssignment) return;

    const form = assignmentForms[0];
    if (!form.assignment_name.trim()) {
      toast.error("Please enter an assignment title");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("assignments")
        .update({
          assignment_name: form.assignment_name,
          description: form.description || null,
          platform: form.platform || null,
          max_marks: parseFloat(form.max_marks) || 100,
          due_date: form.due_date || null
        })
        .eq("id", editingAssignment.id);

      if (error) throw error;

      toast.success("Assignment updated successfully");
      setIsDialogOpen(false);
      resetForm();
      fetchAssignments();
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setSelectedSubjectId(assignment.subject_id);
    setAssignmentForms([{
      assignment_name: assignment.assignment_name,
      description: assignment.description || "",
      platform: assignment.platform || "",
      max_marks: assignment.max_marks.toString(),
      due_date: assignment.due_date || ""
    }]);
    setCurrentAssignmentIndex(0);
    setStep(3);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;

    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Assignment deleted successfully");
      fetchAssignments();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
    }
  };

  const resetForm = () => {
    setEditingAssignment(null);
    setStep(1);
    setSelectedSubjectId("");
    setNumberOfAssignments(1);
    setAssignmentForms([]);
    setCurrentAssignmentIndex(0);
  };

  const branchSubjects = subjects.filter(s => s.branch === selectedBranch);
  const currentForm = assignmentForms[currentAssignmentIndex] || {
    assignment_name: "",
    description: "",
    platform: "",
    due_date: "",
    max_marks: "100"
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">Assignment Management</h1>
              <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                SkillSyncX Exclusive
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">Create and manage assignments for your subjects</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingAssignment ? "Edit Assignment" : "Create Assignments"}
                </DialogTitle>
              </DialogHeader>
              
              {/* Step 1: Select Subject */}
              {step === 1 && !editingAssignment && (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Subject *</Label>
                    <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchSubjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.subject_code} - {subject.subject_name || "N/A"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => setStep(2)} 
                    disabled={!selectedSubjectId}
                    className="w-full"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* Step 2: Number of Assignments */}
              {step === 2 && !editingAssignment && (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Number of Assignments</Label>
                    <Input
                      type="number"
                      value={numberOfAssignments}
                      onChange={(e) => setNumberOfAssignments(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      min="1"
                      max="10"
                    />
                    <p className="text-xs text-muted-foreground">You can create up to 10 assignments at once</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button onClick={initializeAssignmentForms} className="flex-1">
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Assignment Details */}
              {step === 3 && (
                <div className="space-y-4 mt-4">
                  {!editingAssignment && assignmentForms.length > 1 && (
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        Assignment {currentAssignmentIndex + 1} of {assignmentForms.length}
                      </Badge>
                      <div className="flex gap-1">
                        {assignmentForms.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentAssignmentIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              idx === currentAssignmentIndex ? "bg-primary" : "bg-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={currentForm.assignment_name}
                      onChange={(e) => updateCurrentAssignment("assignment_name", e.target.value)}
                      placeholder="Enter assignment title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Brief Description</Label>
                    <Textarea
                      value={currentForm.description}
                      onChange={(e) => updateCurrentAssignment("description", e.target.value)}
                      placeholder="Enter a brief description"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Platform to Complete</Label>
                    <Input
                      value={currentForm.platform}
                      onChange={(e) => updateCurrentAssignment("platform", e.target.value)}
                      placeholder="e.g., HackerRank, LeetCode, GitHub"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={currentForm.due_date}
                        onChange={(e) => updateCurrentAssignment("due_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Marks</Label>
                      <Input
                        type="number"
                        value={currentForm.max_marks}
                        onChange={(e) => updateCurrentAssignment("max_marks", e.target.value)}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {!editingAssignment && (
                      <>
                        {currentAssignmentIndex > 0 && (
                          <Button 
                            variant="outline" 
                            onClick={() => setCurrentAssignmentIndex(prev => prev - 1)}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Previous
                          </Button>
                        )}
                        {currentAssignmentIndex === 0 && (
                          <Button variant="outline" onClick={() => setStep(2)}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                          </Button>
                        )}
                        {currentAssignmentIndex < assignmentForms.length - 1 ? (
                          <Button 
                            onClick={() => setCurrentAssignmentIndex(prev => prev + 1)}
                            className="flex-1"
                          >
                            Next Assignment
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleSubmitAll} 
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Create {assignmentForms.length} Assignment{assignmentForms.length > 1 ? "s" : ""}
                          </Button>
                        )}
                      </>
                    )}
                    {editingAssignment && (
                      <Button 
                        onClick={handleEditSubmit} 
                        disabled={saving}
                        className="w-full"
                      >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Update Assignment
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Branch Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {branches.map((branch) => (
            <Button
              key={branch}
              variant={selectedBranch === branch ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBranch(branch)}
            >
              {branch}
            </Button>
          ))}
        </div>

        {/* Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Assignments for {selectedBranch}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No assignments created yet. Click "Add Assignment" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Max Marks</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.assignment_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {assignment.subject?.subject_code || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{assignment.platform || "-"}</TableCell>
                      <TableCell>{assignment.max_marks}</TableCell>
                      <TableCell>
                        {assignment.due_date ? format(new Date(assignment.due_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(assignment)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(assignment.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssignmentManagement;
