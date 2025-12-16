import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Edit, AlertCircle, BookOpen, DollarSign, ClipboardList, BarChart3, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Student {
  id: string;
  full_name: string | null;
  roll_number: string | null;
  branch: string | null;
  email: string;
}

interface Subject {
  id: string;
  subject_code: string;
  subject_name: string | null;
}

interface AssignmentData {
  number: string;
  titles: Record<string, string>;  // per-subject titles
  marks: Record<string, string>;
  submissionDates: Record<string, string>;  // per-subject submission dates
}

interface Criteria {
  max_internal_marks: number;
  total_fees: number;
  num_internal_exams: number;
}

interface CIAMarksData {
  student_id: string;
  subject_id: string;
  exam_number: string;
  internal_marks: number;
}

type MarksKey = `${string}_${string}`;

const Upload = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paidFees, setPaidFees] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [criteriaFromHOD, setCriteriaFromHOD] = useState<boolean>(false);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("internal-marks");
  const [mainTab, setMainTab] = useState<string>("individual");
  
  // Multi-subject state
  const [branchSubjects, setBranchSubjects] = useState<Subject[]>([]);
  const [subjectMarks, setSubjectMarks] = useState<Record<string, string>>({});
  const [subjectExamDates, setSubjectExamDates] = useState<Record<string, string>>({});
  const [selectedCIA, setSelectedCIA] = useState<string>("CIA-I");
  
  // Assignment state
  const [assignmentData, setAssignmentData] = useState<AssignmentData>({
    number: "",
    titles: {},
    marks: {},
    submissionDates: {}
  });

  // Bulk update state (attendance-style)
  const [bulkMarks, setBulkMarks] = useState<Map<MarksKey, string>>(new Map());
  const [bulkExamDates, setBulkExamDates] = useState<Map<string, string>>(new Map()); // per subject exam date
  const [bulkCIA, setBulkCIA] = useState<string>("CIA-I");
  const [bulkFees, setBulkFees] = useState<Map<string, string>>(new Map());
  const [bulkAssignment, setBulkAssignment] = useState<{ number: string }>({ number: "" });
  const [bulkAssignmentMarks, setBulkAssignmentMarks] = useState<Map<MarksKey, string>>(new Map());
  const [bulkAssignmentTitles, setBulkAssignmentTitles] = useState<Map<string, string>>(new Map());
  const [bulkAssignmentDates, setBulkAssignmentDates] = useState<Map<string, string>>(new Map());

  // CIA Comparison state
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparisonStudent, setComparisonStudent] = useState<Student | null>(null);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  useEffect(() => {
    fetchCriteria();
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedBranch !== "all" && students.length > 0) {
      fetchSubjectsForBranch(selectedBranch);
    } else if (assignedBranches.length > 0) {
      fetchSubjectsForBranch(assignedBranches[0]);
    }
  }, [selectedBranch, assignedBranches]);

  const fetchCriteria = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.department) {
        const { data: hodProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("department", profile.department)
          .eq("panel_type", "hod");

        if (hodProfiles && hodProfiles.length > 0) {
          const hodId = hodProfiles[0].id;
          const { data: hodCriteria } = await supabase
            .from("dropout_criteria")
            .select("max_internal_marks, total_fees, num_internal_exams")
            .eq("user_id", hodId)
            .maybeSingle();

          if (hodCriteria) {
            setCriteria({
              max_internal_marks: hodCriteria.max_internal_marks,
              total_fees: hodCriteria.total_fees,
              num_internal_exams: (hodCriteria as any).num_internal_exams ?? 3
            });
            setCriteriaFromHOD(true);
            return;
          }
        }
      }

      setCriteria({ max_internal_marks: 100, total_fees: 100000, num_internal_exams: 3 });
      setCriteriaFromHOD(false);
    } catch (error) {
      console.error("Error fetching criteria:", error);
      setCriteria({ max_internal_marks: 100, total_fees: 100000, num_internal_exams: 3 });
      setCriteriaFromHOD(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: branchData } = await supabase
        .from("staff_branch_assignments")
        .select("branch")
        .eq("staff_user_id", user.id);

      const branches = (branchData || []).map(b => b.branch);
      setAssignedBranches(branches);

      if (branches.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: studentProfiles, error } = await supabase
        .from("student_profiles")
        .select("id, full_name, roll_number, branch, email")
        .in("branch", branches)
        .order("roll_number");

      if (error) throw error;
      setStudents(studentProfiles || []);
    } catch (error: any) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectsForBranch = async (branch: string) => {
    try {
      const { data, error } = await supabase
        .from("branch_subjects")
        .select("id, subject_code, subject_name")
        .eq("branch", branch)
        .order("subject_code");

      if (error) throw error;
      setBranchSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      setBranchSubjects([]);
    }
  };

  const loadBulkMarks = async (cia: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const studentRollNumbers = filteredStudents.map(s => s.roll_number).filter(Boolean);
      if (studentRollNumbers.length === 0) return;

      // Get student records
      const { data: studentRecords } = await supabase
        .from("students")
        .select("id, roll_number")
        .in("roll_number", studentRollNumbers);

      if (!studentRecords || studentRecords.length === 0) {
        setBulkMarks(new Map());
        return;
      }

      const studentIdMap = new Map(studentRecords.map(s => [s.roll_number, s.id]));
      const studentIds = studentRecords.map(s => s.id);

      // Fetch existing marks for the CIA
      const { data: marks } = await supabase
        .from("student_subject_marks")
        .select("student_id, subject_id, internal_marks")
        .in("student_id", studentIds)
        .eq("exam_number", cia);

      const marksMap = new Map<MarksKey, string>();
      
      // Initialize with empty values
      filteredStudents.forEach(student => {
        const studentId = studentIdMap.get(student.roll_number || "");
        if (studentId) {
          branchSubjects.forEach(subject => {
            marksMap.set(`${student.id}_${subject.id}`, "");
          });
        }
      });

      // Fill in existing marks
      (marks || []).forEach((m: any) => {
        const studentProfile = filteredStudents.find(s => {
          const recordId = studentIdMap.get(s.roll_number || "");
          return recordId === m.student_id;
        });
        if (studentProfile) {
          marksMap.set(`${studentProfile.id}_${m.subject_id}`, m.internal_marks?.toString() || "");
        }
      });

      setBulkMarks(marksMap);
    } catch (error) {
      console.error("Error loading bulk marks:", error);
    }
  };

  const loadBulkFees = async () => {
    try {
      const studentRollNumbers = filteredStudents.map(s => s.roll_number).filter(Boolean);
      if (studentRollNumbers.length === 0) return;

      const { data: studentRecords } = await supabase
        .from("students")
        .select("roll_number, paid_fees")
        .in("roll_number", studentRollNumbers);

      const feesMap = new Map<string, string>();
      filteredStudents.forEach(s => feesMap.set(s.id, ""));
      
      (studentRecords || []).forEach((r: any) => {
        const student = filteredStudents.find(s => s.roll_number === r.roll_number);
        if (student) {
          feesMap.set(student.id, r.paid_fees?.toString() || "");
        }
      });

      setBulkFees(feesMap);
    } catch (error) {
      console.error("Error loading bulk fees:", error);
    }
  };

  useEffect(() => {
    if (mainTab === "bulk-marks" && branchSubjects.length > 0 && filteredStudents.length > 0) {
      loadBulkMarks(bulkCIA);
    } else if (mainTab === "bulk-fees" && filteredStudents.length > 0) {
      loadBulkFees();
    } else if (mainTab === "bulk-assignment" && branchSubjects.length > 0) {
      // Initialize empty assignment marks
      const marksMap = new Map<MarksKey, string>();
      filteredStudents.forEach(student => {
        branchSubjects.forEach(subject => {
          marksMap.set(`${student.id}_${subject.id}`, "");
        });
      });
      setBulkAssignmentMarks(marksMap);
    }
  }, [mainTab, bulkCIA, branchSubjects, selectedBranch]);

  const fetchExistingMarks = async (studentId: string, studentRollNumber: string | null, ciaNumber: string) => {
    try {
      if (!studentRollNumber) return;

      const { data: studentRecord } = await supabase
        .from("students")
        .select("id, paid_fees")
        .eq("roll_number", studentRollNumber)
        .maybeSingle();

      if (studentRecord) {
        setPaidFees(studentRecord.paid_fees?.toString() || "0");

        const { data: marks } = await supabase
          .from("student_subject_marks")
          .select("subject_id, internal_marks")
          .eq("student_id", studentRecord.id)
          .eq("exam_number", ciaNumber);

        const marksMap: Record<string, string> = {};
        (marks || []).forEach(m => {
          marksMap[m.subject_id] = m.internal_marks?.toString() || "0";
        });
        setSubjectMarks(marksMap);
      } else {
        setPaidFees("0");
        setSubjectMarks({});
      }
    } catch (error) {
      console.error("Error fetching existing marks:", error);
      setPaidFees("0");
      setSubjectMarks({});
    }
  };

  const fetchCIAComparison = async (student: Student) => {
    try {
      if (!student.roll_number) return;

      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", student.roll_number)
        .maybeSingle();

      if (!studentRecord) {
        setComparisonData([]);
        return;
      }

      const { data: marks } = await supabase
        .from("student_subject_marks")
        .select("subject_id, internal_marks, exam_number")
        .eq("student_id", studentRecord.id);

      // Transform data for chart
      const chartData = branchSubjects.map(subject => {
        const subjectMarks: any = { subject: subject.subject_code };
        const ciaOptions = getCIAOptions();
        
        ciaOptions.forEach(cia => {
          const mark = (marks || []).find(m => m.subject_id === subject.id && m.exam_number === cia);
          subjectMarks[cia] = mark?.internal_marks || 0;
        });
        
        return subjectMarks;
      });

      setComparisonData(chartData);
    } catch (error) {
      console.error("Error fetching CIA comparison:", error);
      setComparisonData([]);
    }
  };

  const handleViewComparison = async (student: Student) => {
    setComparisonStudent(student);
    if (student.branch) {
      await fetchSubjectsForBranch(student.branch);
    }
    await fetchCIAComparison(student);
    setComparisonDialogOpen(true);
  };

  const handleEditStudent = async (student: Student) => {
    setSelectedStudent(student);
    setSubjectMarks({});
    setSubjectExamDates({});
    setAssignmentData({ number: "", titles: {}, marks: {}, submissionDates: {} });
    setActiveTab("internal-marks");
    setSelectedCIA("CIA-I");
    
    if (student.branch) {
      await fetchSubjectsForBranch(student.branch);
    }
    
    await fetchExistingMarks(student.id, student.roll_number, "CIA-I");
    
    setDialogOpen(true);
  };

  const handleCIAChange = async (cia: string) => {
    setSelectedCIA(cia);
    if (selectedStudent) {
      await fetchExistingMarks(selectedStudent.id, selectedStudent.roll_number, cia);
    }
  };

  const handleSubjectMarkChange = (subjectId: string, value: string) => {
    setSubjectMarks(prev => ({ ...prev, [subjectId]: value }));
  };

  const handleSubjectExamDateChange = (subjectId: string, value: string) => {
    setSubjectExamDates(prev => ({ ...prev, [subjectId]: value }));
  };

  const handleAssignmentMarkChange = (subjectId: string, value: string) => {
    setAssignmentData(prev => ({
      ...prev,
      marks: { ...prev.marks, [subjectId]: value }
    }));
  };

  const calculateAverageMarks = (): number => {
    if (branchSubjects.length === 0) return 0;
    let total = 0;
    let count = 0;
    branchSubjects.forEach(subject => {
      const mark = parseFloat(subjectMarks[subject.id] || "0");
      if (!isNaN(mark)) {
        total += mark;
        count++;
      }
    });
    return count > 0 ? total / count : 0;
  };

  const getOrCreateStudentRecord = async (student: Student, userId: string): Promise<string | null> => {
    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("roll_number", student.roll_number)
      .maybeSingle();

    if (existingStudent) return existingStudent.id;

    const { data: newStudent, error } = await supabase
      .from("students")
      .insert({
        user_id: userId,
        student_name: student.full_name || student.email,
        roll_number: student.roll_number,
        email: student.email,
        department: student.branch,
        total_fees: criteria?.total_fees || 0
      })
      .select("id")
      .single();

    if (error) throw error;
    return newStudent.id;
  };

  const handleSaveInternalMarks = async () => {
    if (!selectedStudent) return;

    for (const subject of branchSubjects) {
      const mark = parseFloat(subjectMarks[subject.id] || "0");
      if (isNaN(mark) || mark < 0) {
        toast.error(`Invalid marks for ${subject.subject_code}`);
        return;
      }
      if (criteria && mark > criteria.max_internal_marks) {
        toast.error(`Marks for ${subject.subject_code} cannot exceed ${criteria.max_internal_marks}`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const studentRecordId = await getOrCreateStudentRecord(selectedStudent, user.id);
      if (!studentRecordId) throw new Error("Failed to get student record");

      const averageMarks = calculateAverageMarks();

      await supabase
        .from("students")
        .update({ internal_marks: averageMarks, updated_at: new Date().toISOString() })
        .eq("id", studentRecordId);

      if (branchSubjects.length > 0) {
        const marksToUpsert = branchSubjects.map(subject => ({
          student_id: studentRecordId,
          subject_id: subject.id,
          internal_marks: parseFloat(subjectMarks[subject.id] || "0"),
          exam_number: selectedCIA,
          exam_date: subjectExamDates[subject.id] || null,
          updated_by: user.id
        }));

        const { error: marksError } = await supabase
          .from("student_subject_marks")
          .upsert(marksToUpsert, { onConflict: "student_id,subject_id,exam_number" });

        if (marksError) throw marksError;
      }

      toast.success(`${selectedCIA} marks saved successfully!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save internal marks");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedStudent) return;

    if (!assignmentData.number.trim()) {
      toast.error("Please enter assignment number");
      return;
    }

    // Check if at least one subject has a title
    const hasTitles = branchSubjects.some(s => assignmentData.titles[s.id]?.trim());
    if (!hasTitles) {
      toast.error("Please enter at least one subject assignment title");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let assignmentId: string;
      const { data: existingAssignment } = await supabase
        .from("branch_assignments")
        .select("id")
        .eq("branch", selectedStudent.branch)
        .eq("assignment_number", assignmentData.number)
        .maybeSingle();

      if (existingAssignment) {
        assignmentId = existingAssignment.id;
      } else {
        const { data: newAssignment, error } = await supabase
          .from("branch_assignments")
          .insert({
            branch: selectedStudent.branch,
            assignment_number: assignmentData.number,
            assignment_title: "Multiple Subjects", // Generic title since per-subject
            staff_user_id: user.id,
            max_marks: criteria?.max_internal_marks || 100
          })
          .select("id")
          .single();

        if (error) throw error;
        assignmentId = newAssignment.id;
      }

      const { data: studentRecord } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", selectedStudent.roll_number)
        .maybeSingle();

      if (!studentRecord) {
        toast.error("Student record not found. Please save internal marks first.");
        setSaving(false);
        return;
      }

      const marksToUpsert = branchSubjects.map(subject => ({
        assignment_id: assignmentId,
        student_id: studentRecord.id,
        subject_id: subject.id,
        marks_obtained: parseFloat(assignmentData.marks[subject.id] || "0"),
        assignment_title: assignmentData.titles[subject.id] || null,
        submission_date: assignmentData.submissionDates[subject.id] || null
      }));

      const { error: marksError } = await supabase
        .from("student_branch_assignment_marks")
        .upsert(marksToUpsert, { onConflict: "assignment_id,student_id,subject_id" });

      if (marksError) throw marksError;

      toast.success(`Assignment saved successfully!`);
      setAssignmentData({ number: "", titles: {}, marks: {}, submissionDates: {} });
    } catch (error: any) {
      toast.error(error.message || "Failed to save assignment");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFees = async () => {
    if (!selectedStudent) return;

    const paidFeesNum = parseFloat(paidFees);
    if (isNaN(paidFeesNum) || paidFeesNum < 0) {
      toast.error("Please enter valid fees amount");
      return;
    }

    if (criteria && paidFeesNum > criteria.total_fees) {
      toast.error(`Fees paid cannot exceed ₹${criteria.total_fees}`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const studentRecordId = await getOrCreateStudentRecord(selectedStudent, user.id);
      if (!studentRecordId) throw new Error("Failed to get student record");

      await supabase
        .from("students")
        .update({
          paid_fees: paidFeesNum,
          total_fees: criteria?.total_fees || 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", studentRecordId);

      toast.success("Fees updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update fees");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // Bulk save functions (attendance-style)
  const handleSaveBulkMarks = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let successCount = 0;
      for (const student of filteredStudents) {
        try {
          const studentRecordId = await getOrCreateStudentRecord(student, user.id);
          if (!studentRecordId) continue;

          // Calculate average for this student
          let total = 0, count = 0;
          branchSubjects.forEach(subject => {
            const key: MarksKey = `${student.id}_${subject.id}`;
            const mark = parseFloat(bulkMarks.get(key) || "0");
            if (!isNaN(mark) && mark >= 0) {
              total += mark;
              count++;
            }
          });
          const avgMarks = count > 0 ? total / count : 0;

          await supabase
            .from("students")
            .update({ internal_marks: avgMarks, updated_at: new Date().toISOString() })
            .eq("id", studentRecordId);

          const marksToUpsert = branchSubjects.map(subject => {
            const key: MarksKey = `${student.id}_${subject.id}`;
            return {
              student_id: studentRecordId,
              subject_id: subject.id,
              internal_marks: parseFloat(bulkMarks.get(key) || "0"),
              exam_number: bulkCIA,
              exam_date: bulkExamDates.get(subject.id) || null,
              updated_by: user.id
            };
          });

          await supabase
            .from("student_subject_marks")
            .upsert(marksToUpsert, { onConflict: "student_id,subject_id,exam_number" });

          successCount++;
        } catch (err) {
          console.error(`Failed for ${student.roll_number}:`, err);
        }
      }

      toast.success(`${bulkCIA} marks saved for ${successCount} students!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save marks");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkFees = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let successCount = 0;
      for (const student of filteredStudents) {
        try {
          const paidFeesNum = parseFloat(bulkFees.get(student.id) || "0");
          if (isNaN(paidFeesNum) || paidFeesNum < 0) continue;

          const studentRecordId = await getOrCreateStudentRecord(student, user.id);
          if (!studentRecordId) continue;

          await supabase
            .from("students")
            .update({
              paid_fees: paidFeesNum,
              total_fees: criteria?.total_fees || 0,
              updated_at: new Date().toISOString()
            })
            .eq("id", studentRecordId);

          successCount++;
        } catch (err) {
          console.error(`Failed for ${student.roll_number}:`, err);
        }
      }

      toast.success(`Fees updated for ${successCount} students!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update fees");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkAssignment = async () => {
    if (!bulkAssignment.number.trim()) {
      toast.error("Please enter assignment number");
      return;
    }

    // Check if at least one subject has a title
    const hasTitles = branchSubjects.some(s => bulkAssignmentTitles.get(s.id)?.trim());
    if (!hasTitles) {
      toast.error("Please enter at least one subject assignment title");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const branch = selectedBranch !== "all" ? selectedBranch : filteredStudents[0]?.branch;

      let assignmentId: string;
      const { data: existingAssignment } = await supabase
        .from("branch_assignments")
        .select("id")
        .eq("branch", branch)
        .eq("assignment_number", bulkAssignment.number)
        .maybeSingle();

      if (existingAssignment) {
        assignmentId = existingAssignment.id;
      } else {
        const { data: newAssignment, error } = await supabase
          .from("branch_assignments")
          .insert({
            branch: branch,
            assignment_number: bulkAssignment.number,
            assignment_title: "Multiple Subjects",
            staff_user_id: user.id,
            max_marks: criteria?.max_internal_marks || 100
          })
          .select("id")
          .single();

        if (error) throw error;
        assignmentId = newAssignment.id;
      }

      let successCount = 0;
      for (const student of filteredStudents) {
        try {
          const { data: studentRecord } = await supabase
            .from("students")
            .select("id")
            .eq("roll_number", student.roll_number)
            .maybeSingle();

          if (!studentRecord) continue;

          const marksToUpsert = branchSubjects.map(subject => {
            const key: MarksKey = `${student.id}_${subject.id}`;
            return {
              assignment_id: assignmentId,
              student_id: studentRecord.id,
              subject_id: subject.id,
              marks_obtained: parseFloat(bulkAssignmentMarks.get(key) || "0"),
              assignment_title: bulkAssignmentTitles.get(subject.id) || null,
              submission_date: bulkAssignmentDates.get(subject.id) || null
            };
          });

          await supabase
            .from("student_branch_assignment_marks")
            .upsert(marksToUpsert, { onConflict: "assignment_id,student_id,subject_id" });

          successCount++;
        } catch (err) {
          console.error(`Failed for ${student.roll_number}:`, err);
        }
      }

      toast.success(`Assignment saved for ${successCount} students!`);
      setBulkAssignment({ number: "" });
      setBulkAssignmentTitles(new Map());
      setBulkAssignmentDates(new Map());
    } catch (error: any) {
      toast.error(error.message || "Failed to save assignment");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getCIAOptions = () => {
    const count = criteria?.num_internal_exams || 3;
    return Array.from({ length: count }, (_, i) => `CIA-${['I', 'II', 'III', 'IV', 'V'][i]}`);
  };

  const CIA_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  const filteredStudents = selectedBranch === "all" 
    ? students 
    : students.filter(s => s.branch === selectedBranch);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-3xl font-bold">Academic Updates</h2>
          <p className="text-muted-foreground mt-2">
            Update internal marks, assignments, and fees for students
          </p>
        </div>

        {assignedBranches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Branches Assigned</h3>
              <p className="text-muted-foreground text-center">Contact your HOD to get branch assignments</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Branch Selection */}
            <Tabs value={selectedBranch} onValueChange={setSelectedBranch}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({students.length})</TabsTrigger>
                {assignedBranches.map(branch => (
                  <TabsTrigger key={branch} value={branch}>
                    {branch} ({students.filter(s => s.branch === branch).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Main Tabs: Individual / Bulk Internal Marks / Bulk Fees / Bulk Assignment */}
            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="individual">Individual Update</TabsTrigger>
                <TabsTrigger value="bulk-marks">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Bulk Internal Marks
                </TabsTrigger>
                <TabsTrigger value="bulk-fees">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Bulk Fees
                </TabsTrigger>
                <TabsTrigger value="bulk-assignment">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Bulk Assignment
                </TabsTrigger>
              </TabsList>

              {/* Individual Update Tab */}
              <TabsContent value="individual">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Students</CardTitle>
                    <CardDescription>Click Update to edit individual student data, or Compare to view CIA marks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No students found</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Roll No</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Branch</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((student) => (
                              <TableRow key={student.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">{student.roll_number || "—"}</TableCell>
                                <TableCell>{student.full_name || student.email}</TableCell>
                                <TableCell><Badge variant="outline">{student.branch}</Badge></TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => handleViewComparison(student)}>
                                    <BarChart3 className="w-4 h-4 mr-1" />
                                    Compare
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditStudent(student)}>
                                    <Edit className="w-4 h-4 mr-1" />
                                    Update
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bulk Internal Marks Tab */}
              <TabsContent value="bulk-marks">
                {!criteriaFromHOD && (
                  <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Using default criteria. Your HOD has not configured the criteria for this department yet.
                  </div>
                )}
                <Card className="shadow-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Bulk Internal Marks Entry</CardTitle>
                        <CardDescription>Enter marks for all students at once (max: {criteria?.max_internal_marks})</CardDescription>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label>Select CIA:</Label>
                          <Select value={bulkCIA} onValueChange={(v) => { setBulkCIA(v); loadBulkMarks(v); }}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getCIAOptions().map(cia => (
                                <SelectItem key={cia} value={cia}>{cia}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleSaveBulkMarks} disabled={saving}>
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : `Save ${bulkCIA} Marks`}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {branchSubjects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No subjects configured for this branch</div>
                    ) : (
                      <div className="space-y-6">
                        {/* Per-Subject Exam Date Inputs */}
                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {branchSubjects.map(subject => (
                            <div key={subject.id} className="border rounded-lg p-2 space-y-1">
                              <Label className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{subject.subject_code}</Label>
                              <Input
                                type="date"
                                className="h-8 text-sm"
                                placeholder="Exam Date"
                                value={bulkExamDates.get(subject.id) || ""}
                                onChange={(e) => {
                                  const newMap = new Map(bulkExamDates);
                                  newMap.set(subject.id, e.target.value);
                                  setBulkExamDates(newMap);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        
                        {/* Student Marks Table */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="sticky left-0 bg-card z-10">Roll No</TableHead>
                                <TableHead className="sticky left-20 bg-card z-10">Name</TableHead>
                                {branchSubjects.map(subject => (
                                  <TableHead key={subject.id} className="text-center min-w-[100px]">
                                    {subject.subject_code}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents.map((student) => (
                                <TableRow key={student.id}>
                                  <TableCell className="sticky left-0 bg-card font-medium">{student.roll_number}</TableCell>
                                  <TableCell className="sticky left-20 bg-card">{student.full_name || student.email}</TableCell>
                                  {branchSubjects.map(subject => {
                                    const key: MarksKey = `${student.id}_${subject.id}`;
                                    return (
                                      <TableCell key={subject.id} className="p-1">
                                        <Input
                                          type="number"
                                          className="w-20 h-8 text-center"
                                          value={bulkMarks.get(key) || ""}
                                          onChange={(e) => {
                                            const newMap = new Map(bulkMarks);
                                            newMap.set(key, e.target.value);
                                            setBulkMarks(newMap);
                                          }}
                                          min="0"
                                          max={criteria?.max_internal_marks}
                                        />
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bulk Fees Tab */}
              <TabsContent value="bulk-fees">
                {!criteriaFromHOD && (
                  <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Using default criteria. Your HOD has not configured the criteria for this department yet.
                  </div>
                )}
                <Card className="shadow-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Bulk Fees Entry</CardTitle>
                        <CardDescription>Enter paid fees for all students (Total: ₹{criteria?.total_fees?.toLocaleString()})</CardDescription>
                      </div>
                      <Button onClick={handleSaveBulkFees} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save All Fees"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Roll No</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Paid Fees (₹)</TableHead>
                            <TableHead>Fee %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.map((student) => {
                            const paid = parseFloat(bulkFees.get(student.id) || "0");
                            const pct = criteria?.total_fees ? ((paid / criteria.total_fees) * 100).toFixed(1) : "0";
                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.roll_number}</TableCell>
                                <TableCell>{student.full_name || student.email}</TableCell>
                                <TableCell className="p-1">
                                  <Input
                                    type="number"
                                    className="w-32 h-8"
                                    value={bulkFees.get(student.id) || ""}
                                    onChange={(e) => {
                                      const newMap = new Map(bulkFees);
                                      newMap.set(student.id, e.target.value);
                                      setBulkFees(newMap);
                                    }}
                                    min="0"
                                    max={criteria?.total_fees}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant={parseFloat(pct) >= 75 ? "default" : "destructive"}>{pct}%</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bulk Assignment Tab */}
              <TabsContent value="bulk-assignment">
                <Card className="shadow-card">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <CardTitle>Bulk Assignment Entry</CardTitle>
                        <CardDescription>Enter assignment marks for all students with per-subject titles and dates</CardDescription>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Label>Assignment No:</Label>
                          <Input
                            className="w-20"
                            placeholder="1"
                            value={bulkAssignment.number}
                            onChange={(e) => setBulkAssignment(prev => ({ ...prev, number: e.target.value }))}
                          />
                        </div>
                        <Button onClick={handleSaveBulkAssignment} disabled={saving}>
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : "Save Assignment"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {branchSubjects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No subjects configured</div>
                    ) : (
                      <div className="space-y-6">
                        {/* Per-Subject Title and Date Inputs */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {branchSubjects.map(subject => (
                            <div key={subject.id} className="border rounded-lg p-3 space-y-2">
                              <Label className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{subject.subject_code}</Label>
                              <Input
                                placeholder="Assignment Title"
                                value={bulkAssignmentTitles.get(subject.id) || ""}
                                onChange={(e) => {
                                  const newMap = new Map(bulkAssignmentTitles);
                                  newMap.set(subject.id, e.target.value);
                                  setBulkAssignmentTitles(newMap);
                                }}
                              />
                              <Input
                                type="date"
                                value={bulkAssignmentDates.get(subject.id) || ""}
                                onChange={(e) => {
                                  const newMap = new Map(bulkAssignmentDates);
                                  newMap.set(subject.id, e.target.value);
                                  setBulkAssignmentDates(newMap);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        
                        {/* Student Marks Table */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="sticky left-0 bg-card z-10">Roll No</TableHead>
                                <TableHead className="sticky left-20 bg-card z-10">Name</TableHead>
                                {branchSubjects.map(subject => (
                                  <TableHead key={subject.id} className="text-center min-w-[100px]">
                                    {subject.subject_code}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents.map((student) => (
                                <TableRow key={student.id}>
                                  <TableCell className="sticky left-0 bg-card font-medium">{student.roll_number}</TableCell>
                                  <TableCell className="sticky left-20 bg-card">{student.full_name || student.email}</TableCell>
                                  {branchSubjects.map(subject => {
                                    const key: MarksKey = `${student.id}_${subject.id}`;
                                    return (
                                      <TableCell key={subject.id} className="p-1">
                                        <Input
                                          type="number"
                                          className="w-20 h-8 text-center"
                                          value={bulkAssignmentMarks.get(key) || ""}
                                          onChange={(e) => {
                                            const newMap = new Map(bulkAssignmentMarks);
                                            newMap.set(key, e.target.value);
                                            setBulkAssignmentMarks(newMap);
                                          }}
                                          min="0"
                                          max={criteria?.max_internal_marks}
                                        />
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Individual Update Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Student Details</DialogTitle>
              <DialogDescription>
                {selectedStudent?.full_name || selectedStudent?.email} ({selectedStudent?.roll_number})
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="internal-marks"><BookOpen className="w-4 h-4 mr-1" />Marks</TabsTrigger>
                <TabsTrigger value="assignments"><ClipboardList className="w-4 h-4 mr-1" />Assign</TabsTrigger>
                <TabsTrigger value="fees"><DollarSign className="w-4 h-4 mr-1" />Fees</TabsTrigger>
              </TabsList>

              <TabsContent value="internal-marks">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Subject-wise Internal Marks</CardTitle>
                    <CardDescription>Max: {criteria?.max_internal_marks || 100}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Internal Exam</Label>
                      <Select value={selectedCIA} onValueChange={handleCIAChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {getCIAOptions().map(cia => (
                            <SelectItem key={cia} value={cia}>{cia}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {branchSubjects.length > 0 ? (
                      <>
                        {branchSubjects.map(subject => (
                          <div key={subject.id} className="border rounded-lg p-3 space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{subject.subject_code}</span>
                              {subject.subject_name && <span className="text-muted-foreground text-sm">{subject.subject_name}</span>}
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Marks</Label>
                                <Input
                                  type="number"
                                  value={subjectMarks[subject.id] || ""}
                                  onChange={(e) => handleSubjectMarkChange(subject.id, e.target.value)}
                                  min="0"
                                  max={criteria?.max_internal_marks}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Exam Date</Label>
                                <Input
                                  type="date"
                                  value={subjectExamDates[subject.id] || ""}
                                  onChange={(e) => handleSubjectExamDateChange(subject.id, e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="bg-muted/50 p-3 rounded-lg flex justify-between">
                          <span className="text-sm font-medium">Average:</span>
                          <span className="text-lg font-bold text-primary">{calculateAverageMarks().toFixed(2)}</span>
                        </div>
                        <Button onClick={handleSaveInternalMarks} disabled={saving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : `Save ${selectedCIA} Marks`}
                        </Button>
                      </>
                    ) : (
                      <div className="bg-warning/10 p-4 rounded-lg text-warning text-sm">No subjects configured</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="assignments">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Assignment Details</CardTitle>
                    <CardDescription>Enter per-subject assignment titles, dates, and marks</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Assignment Number</Label>
                      <Input
                        value={assignmentData.number}
                        onChange={(e) => setAssignmentData(prev => ({ ...prev, number: e.target.value }))}
                        placeholder="e.g., 1, 2, 3..."
                      />
                    </div>

                    {branchSubjects.length > 0 && (
                      <>
                        <div className="border-t pt-4 space-y-4">
                          {branchSubjects.map(subject => (
                            <div key={subject.id} className="border rounded-lg p-3 space-y-3">
                              <Label className="flex items-center gap-2">
                                <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{subject.subject_code}</span>
                                {subject.subject_name && <span className="text-muted-foreground text-sm">{subject.subject_name}</span>}
                              </Label>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Title</Label>
                                  <Input
                                    placeholder="Assignment title"
                                    value={assignmentData.titles[subject.id] || ""}
                                    onChange={(e) => setAssignmentData(prev => ({
                                      ...prev,
                                      titles: { ...prev.titles, [subject.id]: e.target.value }
                                    }))}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Submission Date</Label>
                                  <Input
                                    type="date"
                                    value={assignmentData.submissionDates[subject.id] || ""}
                                    onChange={(e) => setAssignmentData(prev => ({
                                      ...prev,
                                      submissionDates: { ...prev.submissionDates, [subject.id]: e.target.value }
                                    }))}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Marks</Label>
                                  <Input
                                    type="number"
                                    value={assignmentData.marks[subject.id] || ""}
                                    onChange={(e) => handleAssignmentMarkChange(subject.id, e.target.value)}
                                    min="0"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button onClick={handleSaveAssignment} disabled={saving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Saving..." : "Save Assignment"}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fees">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Fees Details</CardTitle>
                    <CardDescription>Total: ₹{criteria?.total_fees?.toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Paid Fees (₹)</Label>
                      <Input
                        type="number"
                        value={paidFees}
                        onChange={(e) => setPaidFees(e.target.value)}
                        min="0"
                        max={criteria?.total_fees}
                      />
                    </div>
                    {paidFees && criteria && (
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Paid:</span>
                          <span className="font-medium text-green-600">₹{parseFloat(paidFees || "0").toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Pending:</span>
                          <span className="font-medium text-red-600">₹{Math.max(0, criteria.total_fees - parseFloat(paidFees || "0")).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Fee %:</span>
                          <span className="font-bold text-primary">{((parseFloat(paidFees || "0") / criteria.total_fees) * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    )}
                    <Button onClick={handleSaveFees} disabled={saving} className="w-full">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? "Saving..." : "Save Fees"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* CIA Comparison Dialog */}
        <Dialog open={comparisonDialogOpen} onOpenChange={setComparisonDialogOpen}>
          <DialogContent className="bg-card max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                CIA Marks Comparison
              </DialogTitle>
              <DialogDescription>
                {comparisonStudent?.full_name || comparisonStudent?.email} ({comparisonStudent?.roll_number})
              </DialogDescription>
            </DialogHeader>

            {comparisonData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, criteria?.max_internal_marks || 100]} />
                    <Tooltip />
                    <Legend />
                    {getCIAOptions().map((cia, index) => (
                      <Bar key={cia} dataKey={cia} fill={CIA_COLORS[index]} name={cia} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No marks data available for comparison</p>
              </div>
            )}

            {comparisonData.length > 0 && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      {getCIAOptions().map(cia => (
                        <TableHead key={cia} className="text-center">{cia}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.subject}</TableCell>
                        {getCIAOptions().map(cia => (
                          <TableCell key={cia} className="text-center">
                            <Badge variant={row[cia] >= (criteria?.max_internal_marks || 100) * 0.4 ? "default" : "destructive"}>
                              {row[cia]}
                            </Badge>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Upload;
