import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddStudentDialogProps {
  departments: string[];
  onStudentAdded: () => void;
}

export const AddStudentDialog = ({ departments, onStudentAdded }: AddStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_name: "",
    roll_number: "",
    email: "",
    phone_number: "",
    department: "",
    attended_hours: "",
    total_hours: "",
    internal_marks: "",
    paid_fees: "",
    total_fees: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get criteria for total_hours and total_fees defaults
      const { data: criteria } = await supabase
        .from("dropout_criteria")
        .select("total_hours, total_fees")
        .eq("user_id", user.id)
        .single();

      const attendedHours = parseFloat(formData.attended_hours) || 0;
      const totalHours = parseFloat(formData.total_hours) || criteria?.total_hours || 100;
      const paidFees = parseFloat(formData.paid_fees) || 0;
      const totalFees = parseFloat(formData.total_fees) || criteria?.total_fees || 100000;

      const attendancePercentage = (attendedHours / totalHours) * 100;
      const feePaidPercentage = (paidFees / totalFees) * 100;
      const pendingFees = totalFees - paidFees;

      const { error } = await supabase.from("students").insert({
        user_id: user.id,
        student_name: formData.student_name,
        roll_number: formData.roll_number || null,
        email: formData.email || null,
        phone_number: formData.phone_number || null,
        department: formData.department || null,
        attended_hours: attendedHours,
        total_hours: totalHours,
        internal_marks: parseFloat(formData.internal_marks) || 0,
        paid_fees: paidFees,
        total_fees: totalFees,
        attendance_percentage: attendancePercentage,
        fee_paid_percentage: feePaidPercentage,
        pending_fees: pendingFees,
      });

      if (error) throw error;

      toast.success("Student added successfully");
      setOpen(false);
      setFormData({
        student_name: "",
        roll_number: "",
        email: "",
        phone_number: "",
        department: "",
        attended_hours: "",
        total_hours: "",
        internal_marks: "",
        paid_fees: "",
        total_fees: "",
      });
      onStudentAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to add student");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student_name">Student Name *</Label>
              <Input
                id="student_name"
                required
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                placeholder="Enter student name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll_number">Roll Number</Label>
              <Input
                id="roll_number"
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                placeholder="Enter roll number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="student@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => setFormData({ ...formData, department: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="attended_hours">Attended Hours</Label>
              <Input
                id="attended_hours"
                type="number"
                min="0"
                step="0.1"
                value={formData.attended_hours}
                onChange={(e) => setFormData({ ...formData, attended_hours: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_hours">Total Hours</Label>
              <Input
                id="total_hours"
                type="number"
                min="0"
                step="0.1"
                value={formData.total_hours}
                onChange={(e) => setFormData({ ...formData, total_hours: e.target.value })}
                placeholder="From criteria settings"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_marks">Internal Marks</Label>
            <Input
              id="internal_marks"
              type="number"
              min="0"
              step="0.1"
              value={formData.internal_marks}
              onChange={(e) => setFormData({ ...formData, internal_marks: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paid_fees">Paid Fees</Label>
              <Input
                id="paid_fees"
                type="number"
                min="0"
                step="0.01"
                value={formData.paid_fees}
                onChange={(e) => setFormData({ ...formData, paid_fees: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_fees">Total Fees</Label>
              <Input
                id="total_fees"
                type="number"
                min="0"
                step="0.01"
                value={formData.total_fees}
                onChange={(e) => setFormData({ ...formData, total_fees: e.target.value })}
                placeholder="From criteria settings"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
