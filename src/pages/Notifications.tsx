import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Send, Mail, MessageSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StudentWithPrediction {
  id: string;
  student_name: string;
  roll_number: string | null;
  email: string | null;
  phone_number: string | null;
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
    } catch (error) {
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
      
      if (data?.results) {
        const { sms, email } = data.results;
        let successMsg = [];
        
        if (sendSMS) {
          successMsg.push(`${sms.success} SMS sent${sms.failed > 0 ? `, ${sms.failed} failed` : ""}`);
        }
        if (sendEmail) {
          successMsg.push(`${email.success} emails sent${email.failed > 0 ? `, ${email.failed} failed` : ""}`);
        }
        
        toast.success(successMsg.join(" | "));
        setMessage("");
        setSelectedStudents(new Set());
      } else {
        toast.success("Notifications sent successfully!");
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to send notifications");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const getRiskBadge = (student: StudentWithPrediction) => {
    const riskLevel = student.predictions?.[0]?.final_risk_level;
    if (!riskLevel) return null;

    const colors = {
      low: "bg-green-100 text-green-800 border-green-300",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      high: "bg-red-100 text-red-800 border-red-300",
    };

    return (
      <Badge variant="outline" className={colors[riskLevel as keyof typeof colors]}>
        {riskLevel.toUpperCase()}
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Send Notifications</h1>
            <p className="text-muted-foreground">Send SMS and email alerts to students</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message Composer */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
                <CardDescription>Write your notification message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Enter your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {message.length} characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notification Methods</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sms"
                        checked={sendSMS}
                        onCheckedChange={(checked) => setSendSMS(checked as boolean)}
                      />
                      <Label htmlFor="sms" className="cursor-pointer flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        SMS
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="email"
                        checked={sendEmail}
                        onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                      />
                      <Label htmlFor="email" className="cursor-pointer flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Quick Select:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectByRiskLevel("high")}
                      className="border-red-300 hover:bg-red-50"
                    >
                      High Risk
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectByRiskLevel("medium")}
                      className="border-yellow-300 hover:bg-yellow-50"
                    >
                      Medium Risk
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectByRiskLevel("low")}
                      className="border-green-300 hover:bg-green-50"
                    >
                      Low Risk
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleSelectAll}
                    >
                      {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleSendNotifications}
                  disabled={sending}
                  className="w-full"
                  size="lg"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Sending..." : `Send to ${selectedStudents.size} Student${selectedStudents.size !== 1 ? 's' : ''}`}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Student Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Students ({selectedStudents.size} selected)</CardTitle>
                <CardDescription>Choose which students will receive the notification</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Roll Number</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Contact</TableHead>
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
                          <TableCell>{student.roll_number || "N/A"}</TableCell>
                          <TableCell>{getRiskBadge(student)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {student.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{student.email}</div>}
                            {student.phone_number && <div className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{student.phone_number}</div>}
                            {!student.email && !student.phone_number && "No contact info"}
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
      </div>
    </div>
  );
};

export default Notifications;
