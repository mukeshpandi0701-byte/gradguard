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
import { Loader2, Plus, Pencil, Trash2, BookOpen } from "lucide-react";
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
  subject_id: string;
  created_at: string;
  subject?: Subject;
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
  const [formData, setFormData] = useState({
    subject_id: "",
    assignment_name: "",
    description: "",
    max_marks: "100",
    due_date: ""
  });

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

      // Get staff's assigned branches
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

      // Fetch subjects for assigned branches
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

      // Get subject IDs for selected branch
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

      // Map subjects to assignments
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

  const handleSubmit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!formData.subject_id || !formData.assignment_name) {
        toast.error("Please fill in required fields");
        return;
      }

      const assignmentData = {
        staff_user_id: user.id,
        subject_id: formData.subject_id,
        assignment_name: formData.assignment_name,
        description: formData.description || null,
        max_marks: parseFloat(formData.max_marks) || 100,
        due_date: formData.due_date || null
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from("assignments")
          .update(assignmentData)
          .eq("id", editingAssignment.id);

        if (error) throw error;
        toast.success("Assignment updated successfully");
      } else {
        const { error } = await supabase
          .from("assignments")
          .insert(assignmentData);

        if (error) throw error;
        toast.success("Assignment created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAssignments();
    } catch (error) {
      console.error("Error saving assignment:", error);
      toast.error("Failed to save assignment");
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      subject_id: assignment.subject_id,
      assignment_name: assignment.assignment_name,
      description: assignment.description || "",
      max_marks: assignment.max_marks.toString(),
      due_date: assignment.due_date || ""
    });
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
    setFormData({
      subject_id: "",
      assignment_name: "",
      description: "",
      max_marks: "100",
      due_date: ""
    });
  };

  const branchSubjects = subjects.filter(s => s.branch === selectedBranch);

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
            <h1 className="text-2xl font-bold">Assignment Management</h1>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAssignment ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
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
                <div className="space-y-2">
                  <Label>Assignment Name *</Label>
                  <Input
                    value={formData.assignment_name}
                    onChange={(e) => setFormData({ ...formData, assignment_name: e.target.value })}
                    placeholder="Enter assignment name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Marks</Label>
                    <Input
                      type="number"
                      value={formData.max_marks}
                      onChange={(e) => setFormData({ ...formData, max_marks: e.target.value })}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingAssignment ? "Update Assignment" : "Create Assignment"}
                </Button>
              </div>
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
                    <TableHead>Assignment Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Max Marks</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
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
                      <TableCell>{assignment.max_marks}</TableCell>
                      <TableCell>
                        {assignment.due_date ? format(new Date(assignment.due_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell>{format(new Date(assignment.created_at), "dd MMM yyyy")}</TableCell>
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
