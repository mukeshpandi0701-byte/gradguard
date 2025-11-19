import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Send, Mail, MessageSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StudentWithPrediction {
  id: string;
  student_name: string;
  roll_number: string | null;
  email?: string | null;
  phone_number?: string | null;
  predictions?: Array<{
    final_risk_level: string;
  }>;
}

const Notifications = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithPrediction[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sendSMS, setSendSMS] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_name, roll_number, email, phone_number, predictions(final_risk_level)");

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
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

  const selectByRiskLevel = (level: string) => {
    const filtered = students.filter(
      s => s.predictions?.[0]?.final_risk_level === level
    );
    setSelectedStudents(new Set(filtered.map(s => s.id)));
    toast.success(`Selected ${filtered.length} ${level} risk students`);
  };

  const handleSendNotifications = async () => {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }

    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!sendSMS && !sendEmail) {
      toast.error("Please select at least one notification method");
      return;
    }

    setSending(true);
    const loadingToast = toast.loading("Sending notifications...");

    try {
      const { data, error } = await supabase.functions.invoke("send-notifications", {
        body: {
          studentIds: Array.from(selectedStudents),
          message: message.trim(),
          sendSMS,
          sendEmail,
        },
      });

      if (error) throw error;

      toast.dismiss(loadingToast);
      
      if (data.results) {
        const { sms, email } = data.results;
        let successMsg = [];
        
        if (sendSMS) {
          successMsg.push(`${sms.success} SMS sent${sms.failed > 0 ? `, ${sms.failed} failed` : ""}`);
        }
        if (sendEmail) {
          successMsg.push(`${email.success} emails sent${email.failed > 0 ? `, ${email.failed} failed` : ""}`);
        }

        toast.success(successMsg.join(" | "));

        if (sms.errors.length > 0 || email.errors.length > 0) {
          console.error("Notification errors:", { sms: sms.errors, email: email.errors });
        }
      } else {
        toast.success("Notifications sent successfully!");
      }

      // Reset form
      setMessage("");
      setSelectedStudents(new Set());
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to send notifications");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const getRiskBadge = (level?: string) => {
    if (!level) return <Badge variant="outline">Unknown</Badge>;
    
    const variants = {
      low: "bg-success text-success-foreground",
      medium: "bg-warning text-warning-foreground",
      high: "bg-destructive text-destructive-foreground",
    };
    
    return (
      <Badge className={variants[level as keyof typeof variants]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Send Notifications</h1>
          <p className="text-muted-foreground">
            Send SMS and email notifications to students about their academic progress
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notification Form */}
          <div className="lg:col-span-1">
            <Card className="shadow-card sticky top-4">
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
                <CardDescription>
                  {selectedStudents.size} student{selectedStudents.size !== 1 ? "s" : ""} selected
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={6}
                    className="mt-2"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Notification Methods</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sms"
                      checked={sendSMS}
                      onCheckedChange={(checked) => setSendSMS(checked as boolean)}
                    />
                    <Label htmlFor="sms" className="flex items-center cursor-pointer">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send SMS
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email"
                      checked={sendEmail}
                      onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                    />
                    <Label htmlFor="email" className="flex items-center cursor-pointer">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quick Select</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectByRiskLevel("high")}
                      className="text-destructive"
                    >
                      High Risk
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectByRiskLevel("medium")}
                      className="text-warning"
                    >
                      Medium Risk
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectByRiskLevel("low")}
                      className="text-success"
                    >
                      Low Risk
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleSendNotifications}
                  disabled={sending || selectedStudents.size === 0 || !message.trim()}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Sending..." : "Send Notifications"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Student Selection Table */}
          <div className="lg:col-span-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Select Students</CardTitle>
                <CardDescription>
                  Choose which students should receive the notification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedStudents.size === students.length && students.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.has(student.id)}
                              onCheckedChange={() => toggleStudentSelection(student.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{student.student_name}</TableCell>
                          <TableCell>{student.roll_number || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {student.email || <span className="text-muted-foreground">No email</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {student.phone_number || <span className="text-muted-foreground">No phone</span>}
                          </TableCell>
                          <TableCell>
                            {getRiskBadge(student.predictions?.[0]?.final_risk_level)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Notifications;
