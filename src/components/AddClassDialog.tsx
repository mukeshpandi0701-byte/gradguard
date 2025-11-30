import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

interface AddClassDialogProps {
  departments: string[];
  onClassAdded: (newClass: string) => void;
}

export const AddClassDialog = ({ departments, onClassAdded }: AddClassDialogProps) => {
  const [open, setOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmedName = className.trim();
      
      if (!trimmedName) {
        toast.error("Class name cannot be empty");
        setLoading(false);
        return;
      }

      if (departments.includes(trimmedName)) {
        toast.error("This class already exists");
        setLoading(false);
        return;
      }

      toast.success("Class created successfully");
      onClassAdded(trimmedName);
      setOpen(false);
      setClassName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to create class");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FolderPlus className="w-4 h-4" />
          Add Class
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class_name">Class/Department Name *</Label>
            <Input
              id="class_name"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g., Computer Science, CSE-A"
            />
            <p className="text-xs text-muted-foreground">
              This will create a new department/class that you can assign students to.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
