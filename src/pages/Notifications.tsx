import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Student {
  id: string;
  student_name: string;
  email: string | null;
  department: string | null;
}

interface StudentWithPrediction extends Student {
  predictions?: Array<{
    final_risk_level: string;
  }>;
}

const Notifications = () => {
  const [students, setStudents] = useState<StudentWithPrediction[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<"all" | "low" | "medium" | "high">("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          student_name,
          email,
          department,
          predictions(final_risk_level)
        `)
        .order('student_name');

      if (error) throw error;
      setStudents(data as StudentWithPrediction[] || []);
      
      // Extract unique departments
      const uniqueDepts = Array.from(new Set((data as StudentWithPrediction[])?.map(s => s.department).filter(Boolean))) as string[];
      setDepartments(uniqueDepts);
    } catch (error: any) {
      toast.error("Failed to fetch students");
      console.error(error);
    }
  };

  const getDefaultMessage = (riskLevel: string) => {
    const templates = {
      low: `Dear Student,

We're pleased to see your consistent performance. Keep up the good work!

Your current status shows excellent attendance and academic progress. Continue maintaining this standard.

Best regards,
Academic Team`,
      medium: `Dear Student,

We've noticed some areas that need attention in your academic progress.

Please focus on:
- Improving attendance
- Keeping up with coursework
- Clearing pending fees if applicable

We're here to support you. Please reach out if you need assistance.

Best regards,
Academic Team`,
      high: `Dear Student,

This is an important alert regarding your academic standing.

We've identified significant concerns in:
- Attendance levels
- Academic performance
- Fee payment status

Please schedule a meeting with your tutor immediately to discuss an improvement plan.

Best regards,
Academic Team`
    };

    return templates[riskLevel as keyof typeof templates] || "";
  };

  const handleSendNotifications = async (useTemplate: boolean = false) => {
    const studentsToNotify = students.filter(s => selectedStudents.has(s.id));
    
    if (studentsToNotify.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    const studentsWithoutEmail = studentsToNotify.filter(s => !s.email);
    if (studentsWithoutEmail.length > 0) {
      toast.error(`${studentsWithoutEmail.length} students don't have email addresses`);
      return;
    }

    if (!useTemplate && !customMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    toast.loading("Sending notifications...");

    try {
      if (useTemplate) {
        // Group students by risk level and send templated messages
        const lowRisk = studentsToNotify.filter(s => s.predictions?.[0]?.final_risk_level === "low");
        const mediumRisk = studentsToNotify.filter(s => s.predictions?.[0]?.final_risk_level === "medium");
        const highRisk = studentsToNotify.filter(s => s.predictions?.[0]?.final_risk_level === "high");

        const sendBatch = async (batch: StudentWithPrediction[], message: string) => {
          if (batch.length === 0) return;
          
          const { error } = await supabase.functions.invoke("send-notifications", {
            body: {
              studentIds: batch.map(s => s.id),
              message,
            },
          });

          if (error) throw error;
        };

        await Promise.all([
          sendBatch(lowRisk, getDefaultMessage("low")),
          sendBatch(mediumRisk, getDefaultMessage("medium")),
          sendBatch(highRisk, getDefaultMessage("high")),
        ]);
      } else {
        // Send custom message to all selected students
        const { error } = await supabase.functions.invoke("send-notifications", {
          body: {
            studentIds: studentsToNotify.map(s => s.id),
            message: customMessage,
          },
        });

        if (error) throw error;
      }

      toast.dismiss();
      toast.success(`Notifications sent to ${studentsToNotify.length} students!`);
      setCustomMessage("");
      setSelectedStudents(new Set());
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to send notifications");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const toggleStudent = (id: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStudents(newSelection);
  };

  const selectByRiskLevel = (level: "all" | "low" | "medium" | "high") => {
    setSelectedRiskLevel(level);
    
    if (level === "all") {
      setSelectedStudents(new Set(students.map(s => s.id)));
    } else {
      const filtered = students.filter(s => 
        s.predictions?.[0]?.final_risk_level === level
      );
      setSelectedStudents(new Set(filtered.map(s => s.id)));
    }
  };

  let filteredStudents = selectedRiskLevel === "all" 
    ? students 
    : students.filter(s => s.predictions?.[0]?.final_risk_level === selectedRiskLevel);

  if (selectedDepartment !== "all") {
    filteredStudents = filteredStudents.filter(s => s.department === selectedDepartment);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold">Send Notifications</h2>
          <p className="text-muted-foreground mt-2">
            Send email notifications to students
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Students</CardTitle>
              <CardDescription>
                Choose students to send notifications to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={selectedDepartment} onValueChange={setSelectedDepartment} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Departments</TabsTrigger>
                  {departments.map((dept) => (
                    <TabsTrigger key={dept} value={dept}>
                      {dept}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedRiskLevel === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectByRiskLevel("all")}
                >
                  All Students
                </Button>
                <Button
                  variant={selectedRiskLevel === "low" ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectByRiskLevel("low")}
                >
                  Low Risk
                </Button>
                <Button
                  variant={selectedRiskLevel === "medium" ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectByRiskLevel("medium")}
                >
                  Medium Risk
                </Button>
                <Button
                  variant={selectedRiskLevel === "high" ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectByRiskLevel("high")}
                >
                  High Risk
                </Button>
              </div>

              <div className="border rounded-md max-h-96 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={student.id}
                        checked={selectedStudents.has(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <Label
                        htmlFor={student.id}
                        className="flex-1 cursor-pointer flex justify-between items-center"
                      >
                        <span>{student.student_name}</span>
                        {!student.email && (
                          <span className="text-xs text-destructive">No email</span>
                        )}
                        {student.predictions?.[0] && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            student.predictions[0].final_risk_level === 'high' 
                              ? 'bg-destructive/10 text-destructive' 
                              : student.predictions[0].final_risk_level === 'medium'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-success/10 text-success'
                          }`}>
                            {student.predictions[0].final_risk_level}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Selected: {selectedStudents.size} students
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
              <CardDescription>
                Choose between custom message or automated templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="custom" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="custom">Custom Message</TabsTrigger>
                  <TabsTrigger value="template">Risk-Based Templates</TabsTrigger>
                </TabsList>
                
                <TabsContent value="custom" className="space-y-4">
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={12}
                  />
                  <Button
                    onClick={() => handleSendNotifications(false)}
                    disabled={sending || selectedStudents.size === 0}
                    className="w-full gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Send Custom Message
                  </Button>
                </TabsContent>
                
                <TabsContent value="template" className="space-y-4">
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      Automatically sends customized messages based on each student's risk level:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Low Risk:</strong> Encouragement message</li>
                      <li><strong>Medium Risk:</strong> Alert with suggestions</li>
                      <li><strong>High Risk:</strong> Urgent action required</li>
                    </ul>
                  </div>
                  <Button
                    onClick={() => handleSendNotifications(true)}
                    disabled={sending || selectedStudents.size === 0}
                    className="w-full gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Templated Messages
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
