import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { logDownloadHistory } from "./downloadHistory";
import { supabase } from "@/integrations/supabase/client";

// Helper function to upload PDF to storage
const uploadPDFToStorage = async (pdf: jsPDF, filename: string): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const pdfBlob = pdf.output('blob');
    const storagePath = `${user.id}/${filename}`;

    const { error } = await supabase.storage
      .from('reports')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Error uploading PDF to storage:', error);
      return null;
    }

    return storagePath;
  } catch (error) {
    console.error('Failed to upload PDF:', error);
    return null;
  }
};

export interface StudentReportData {
  student_name: string;
  roll_number: string | null;
  department?: string | null;
  attendance_percentage: number;
  internal_marks: number;
  fee_paid_percentage: number;
  pending_fees: number;
  riskLevel: string;
  mlProbability: number;
  email?: string;
  suggestions?: string;
  insights?: string;
}

export interface SocialActivityData {
  student_name: string;
  roll_number: string | null;
  github_activity: string;
  github_status: string;
  linkedin_activity: string;
  linkedin_status: string;
  status: "active" | "moderate" | "inactive";
}

export const generateSocialActivityReportPDF = async (
  students: SocialActivityData[],
  statusCounts: { active: number; moderate: number; inactive: number }
) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  let yPosition = margin;

  // Header
  pdf.setFillColor(59, 130, 246);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("Social Media Activity Report", pageWidth / 2, 20, { align: "center" });
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: "center" });
  
  yPosition = 50;
  pdf.setTextColor(0, 0, 0);

  // Activity Status Chart
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Activity Status Distribution", margin, yPosition);
  yPosition += 15;

  const maxCount = Math.max(statusCounts.active, statusCounts.moderate, statusCounts.inactive, 1);
  const barHeight = 15;
  const maxBarWidth = contentWidth - 50;
  const chartStartY = yPosition;

  // Active bar
  const activeWidth = (statusCounts.active / maxCount) * maxBarWidth;
  pdf.setFillColor(34, 197, 94); // Green
  pdf.roundedRect(margin + 45, yPosition, activeWidth, barHeight, 2, 2, 'F');
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Active", margin, yPosition + 10);
  pdf.setFont("helvetica", "normal");
  pdf.text(statusCounts.active.toString(), margin + 45 + activeWidth + 3, yPosition + 10);
  yPosition += barHeight + 5;

  // Moderate bar
  const moderateWidth = (statusCounts.moderate / maxCount) * maxBarWidth;
  pdf.setFillColor(251, 191, 36); // Yellow
  pdf.roundedRect(margin + 45, yPosition, moderateWidth, barHeight, 2, 2, 'F');
  pdf.setFont("helvetica", "bold");
  pdf.text("Moderate", margin, yPosition + 10);
  pdf.setFont("helvetica", "normal");
  pdf.text(statusCounts.moderate.toString(), margin + 45 + moderateWidth + 3, yPosition + 10);
  yPosition += barHeight + 5;

  // Inactive bar
  const inactiveWidth = (statusCounts.inactive / maxCount) * maxBarWidth;
  pdf.setFillColor(239, 68, 68); // Red
  pdf.roundedRect(margin + 45, yPosition, inactiveWidth, barHeight, 2, 2, 'F');
  pdf.setFont("helvetica", "bold");
  pdf.text("Inactive", margin, yPosition + 10);
  pdf.setFont("helvetica", "normal");
  pdf.text(statusCounts.inactive.toString(), margin + 45 + inactiveWidth + 3, yPosition + 10);
  yPosition += barHeight + 15;

  // Student Activity Table
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Student Activity Details", margin, yPosition);
  yPosition += 10;

  // Table header
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPosition, contentWidth, 10, 'F');
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  
  const col1X = margin + 2;
  const col2X = margin + 40;
  const col3X = margin + 80;
  const col4X = margin + 120;
  const col5X = margin + 155;
  
  pdf.text("Name", col1X, yPosition + 7);
  pdf.text("GitHub Activity", col2X, yPosition + 7);
  pdf.text("GitHub Status", col3X, yPosition + 7);
  pdf.text("LinkedIn Activity", col4X, yPosition + 7);
  pdf.text("LinkedIn Status", col5X, yPosition + 7);
  yPosition += 10;

  // Table rows
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  students.forEach((student, index) => {
    if (yPosition > pageHeight - 30) {
      pdf.addPage();
      yPosition = margin;
      
      // Repeat header on new page
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, contentWidth, 10, 'F');
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Name", col1X, yPosition + 7);
      pdf.text("GitHub Activity", col2X, yPosition + 7);
      pdf.text("GitHub Status", col3X, yPosition + 7);
      pdf.text("LinkedIn Activity", col4X, yPosition + 7);
      pdf.text("LinkedIn Status", col5X, yPosition + 7);
      yPosition += 10;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
    }

    // Alternating row colors
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPosition, contentWidth, 8, 'F');
    }

    const name = student.roll_number 
      ? `${student.student_name} (${student.roll_number})`
      : student.student_name;
    
    pdf.text(pdf.splitTextToSize(name, 36)[0], col1X, yPosition + 5.5);
    pdf.text(pdf.splitTextToSize(student.github_activity, 38)[0], col2X, yPosition + 5.5);
    
    // GitHub status with color
    const githubStatusColor = student.github_status === "Active" 
      ? [34, 197, 94] 
      : student.github_status === "Moderate" 
      ? [251, 191, 36] 
      : [239, 68, 68];
    pdf.setTextColor(githubStatusColor[0], githubStatusColor[1], githubStatusColor[2]);
    pdf.text(student.github_status, col3X, yPosition + 5.5);
    pdf.setTextColor(0, 0, 0);
    
    pdf.text(pdf.splitTextToSize(student.linkedin_activity, 33)[0], col4X, yPosition + 5.5);
    
    // LinkedIn status with color
    const linkedinStatusColor = student.linkedin_status === "Active" 
      ? [34, 197, 94] 
      : student.linkedin_status === "Moderate" 
      ? [251, 191, 36] 
      : [239, 68, 68];
    pdf.setTextColor(linkedinStatusColor[0], linkedinStatusColor[1], linkedinStatusColor[2]);
    pdf.text(student.linkedin_status, col5X, yPosition + 5.5);
    pdf.setTextColor(0, 0, 0);
    
    yPosition += 8;
  });

  // Footer
  yPosition = pageHeight - 10;
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Total Students: ${students.length} | Generated by Student Dropout Prediction System`,
    pageWidth / 2,
    yPosition,
    { align: "center" }
  );

  // Save PDF
  const filename = `social-activity-report-${new Date().toISOString().split("T")[0]}.pdf`;
  
  // Upload to storage
  const storagePath = await uploadPDFToStorage(pdf, filename);
  
  pdf.save(filename);
  
  // Log download history
  await logDownloadHistory({
    reportType: "social_activity_report",
    reportName: filename,
    storagePath,
    metadata: {
      totalStudents: students.length,
      activeCount: statusCounts.active,
      moderateCount: statusCounts.moderate,
      inactiveCount: statusCounts.inactive,
    },
  });
};

export const generateAnalyticsReportPDF = async (
  department: string,
  stats: { totalStudents: number; lowRisk: number; mediumRisk: number; highRisk: number },
  chartsElement: HTMLElement
) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  let yPosition = margin;

  // Department name in bold
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text(department === "all" ? "All Departments" : department, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Generated date
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Statistics summary
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Statistics Summary", margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Total Students: ${stats.totalStudents}`, margin + 5, yPosition);
  yPosition += 7;
  pdf.setTextColor(34, 197, 94);
  pdf.text(`Low Risk: ${stats.lowRisk}`, margin + 5, yPosition);
  yPosition += 7;
  pdf.setTextColor(251, 191, 36);
  pdf.text(`Medium Risk: ${stats.mediumRisk}`, margin + 5, yPosition);
  yPosition += 7;
  pdf.setTextColor(239, 68, 68);
  pdf.text(`High Risk: ${stats.highRisk}`, margin + 5, yPosition);
  yPosition += 12;
  pdf.setTextColor(0, 0, 0);

  // Capture charts as image
  try {
    const canvas = await html2canvas(chartsElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Check if we need a new page
    if (yPosition + imgHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
  } catch (error) {
    console.error("Error capturing charts:", error);
    pdf.setTextColor(128, 128, 128);
    pdf.setFontSize(11);
    pdf.text("Charts could not be captured", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
  }

  // Save PDF
  const filename = `analytics-report-${department}-${new Date().toISOString().split("T")[0]}.pdf`;
  
  // Upload to storage
  const storagePath = await uploadPDFToStorage(pdf, filename);
  
  pdf.save(filename);
  
  // Log download history
  await logDownloadHistory({
    reportType: "analytics_pdf",
    reportName: filename,
    storagePath,
    metadata: {
      department,
      totalStudents: stats.totalStudents,
      lowRisk: stats.lowRisk,
      mediumRisk: stats.mediumRisk,
      highRisk: stats.highRisk,
    },
  });
};

export const generateAIStudentReportPDF = async (
  studentData: {
    student_name: string;
    roll_number: string | null;
    department: string | null;
    email: string | null;
    phone_number: string | null;
    attendance_percentage: number;
    internal_marks: number;
    fee_paid_percentage: number;
    pending_fees: number;
  },
  prediction: {
    final_risk_level: string;
    ml_probability: number;
    insights: string | null;
    suggestions: string | null;
  } | null,
  trendAnalysis: any | null,
  recommendations: any | null,
  historyChart: HTMLElement | null
) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  let yPosition = margin;

  // Header with blue background
  pdf.setFillColor(59, 130, 246);
  pdf.rect(0, 0, pageWidth, 45, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Student Report: ${studentData.student_name}`, pageWidth / 2, 20, { align: "center" });
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: "center" });
  
  yPosition = 55;
  pdf.setTextColor(0, 0, 0);

  // Performance Overview Section
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Performance Overview", margin, yPosition);
  yPosition += 10;

  const metrics = [
    { label: "Overall Performance", value: `${studentData.attendance_percentage.toFixed(1)}%`, color: studentData.attendance_percentage >= 75 ? [34, 197, 94] : [239, 68, 68] },
    { label: "Internal Marks", value: `${studentData.internal_marks}/100`, color: studentData.internal_marks >= 40 ? [34, 197, 94] : [239, 68, 68] },
    { label: "Fees Paid", value: `${studentData.fee_paid_percentage.toFixed(1)}%`, color: studentData.fee_paid_percentage >= 80 ? [34, 197, 94] : [239, 68, 68] },
    { label: "Fees Due", value: `Rs. ${studentData.pending_fees.toFixed(0)}`, color: studentData.pending_fees <= 5000 ? [34, 197, 94] : [239, 68, 68] }
  ];

  pdf.setFontSize(11);
  metrics.forEach(metric => {
    pdf.setFont("helvetica", "bold");
    pdf.text(metric.label + ":", margin, yPosition);
    pdf.setTextColor(metric.color[0], metric.color[1], metric.color[2]);
    pdf.text(metric.value, margin + 60, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 7;
  });
  
  yPosition += 8;

  // Contact Information
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Contact Information", margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  if (studentData.email) {
    pdf.text(`Email: ${studentData.email}`, margin, yPosition);
    yPosition += 7;
  }
  if (studentData.phone_number) {
    pdf.text(`Phone: ${studentData.phone_number}`, margin, yPosition);
    yPosition += 7;
  }
  if (studentData.department) {
    pdf.text(`Department: ${studentData.department}`, margin, yPosition);
    yPosition += 7;
  }
  if (!studentData.email && !studentData.phone_number && !studentData.department) {
    pdf.setTextColor(128, 128, 128);
    pdf.text("Contact details not available", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 7;
  }
  
  yPosition += 8;

  // Performance Trend Chart
  if (historyChart && yPosition + 60 < pageHeight - margin) {
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Performance Trend Over Time", margin, yPosition);
    yPosition += 10;

    try {
      const canvas = await html2canvas(historyChart, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = contentWidth;
      const imgHeight = 60;
      
      pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    } catch (error) {
      console.error("Error capturing chart:", error);
      pdf.setTextColor(128, 128, 128);
      pdf.setFontSize(11);
      pdf.text("Chart could not be captured", margin, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 10;
    }
  } else {
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Performance Trend Over Time", margin, yPosition);
    yPosition += 10;
    pdf.setTextColor(128, 128, 128);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text("No historical data available yet", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Check if we need a new page
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = margin;
  }

  // AI-Powered Insights
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("AI-Powered Insights", margin, yPosition);
  yPosition += 10;

  if (trendAnalysis) {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    
    if (trendAnalysis.summary) {
      const summaryLines = pdf.splitTextToSize(trendAnalysis.summary, contentWidth);
      pdf.text(summaryLines, margin, yPosition);
      yPosition += summaryLines.length * 5 + 8;
    }

    if (trendAnalysis.warningSignals && trendAnalysis.warningSignals.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Warning Signals:", margin, yPosition);
      yPosition += 6;
      pdf.setFont("helvetica", "normal");
      trendAnalysis.warningSignals.forEach((signal: string) => {
        const lines = pdf.splitTextToSize(`• ${signal}`, contentWidth - 5);
        pdf.text(lines, margin + 3, yPosition);
        yPosition += lines.length * 5;
      });
      yPosition += 5;
    }
  } else {
    pdf.setTextColor(128, 128, 128);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "italic");
    pdf.text("AI insights not generated yet. Click 'Analyze Trends' on the student page.", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Check if we need a new page
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = margin;
  }

  // Short-Term Goals
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Short-Term Goals (1 Month)", margin, yPosition);
  yPosition += 10;

  if (recommendations?.shortTermGoals && recommendations.shortTermGoals.length > 0) {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    
    recommendations.shortTermGoals.forEach((goal: any, index: number) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFont("helvetica", "bold");
      pdf.text(`${index + 1}. ${goal.goal}`, margin, yPosition);
      yPosition += 6;
      
      pdf.setFont("helvetica", "normal");
      if (goal.steps && goal.steps.length > 0) {
        goal.steps.forEach((step: string) => {
          const lines = pdf.splitTextToSize(`  • ${step}`, contentWidth - 5);
          pdf.text(lines, margin + 3, yPosition);
          yPosition += lines.length * 5;
        });
      }
      yPosition += 5;
    });
  } else {
    pdf.setTextColor(128, 128, 128);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "italic");
    pdf.text("Goals not generated yet. Click 'Generate Recommendations' on the student page.", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Check if we need a new page
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = margin;
  }

  // Long-Term Strategies
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Long-Term Strategies (3 Months)", margin, yPosition);
  yPosition += 10;

  if (recommendations?.longTermStrategies && recommendations.longTermStrategies.length > 0) {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    
    recommendations.longTermStrategies.forEach((strategy: any, index: number) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFont("helvetica", "bold");
      pdf.text(`${index + 1}. ${strategy.strategy}`, margin, yPosition);
      yPosition += 6;
      
      pdf.setFont("helvetica", "normal");
      if (strategy.description) {
        const lines = pdf.splitTextToSize(strategy.description, contentWidth);
        pdf.text(lines, margin + 3, yPosition);
        yPosition += lines.length * 5;
      }
      
      if (strategy.milestones && strategy.milestones.length > 0) {
        strategy.milestones.forEach((milestone: string) => {
          const lines = pdf.splitTextToSize(`  • ${milestone}`, contentWidth - 5);
          pdf.text(lines, margin + 3, yPosition);
          yPosition += lines.length * 5;
        });
      }
      yPosition += 5;
    });
  } else {
    pdf.setTextColor(128, 128, 128);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "italic");
    pdf.text("Strategies not generated yet. Click 'Generate Recommendations' on the student page.", margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text("End of Report", pageWidth / 2, pageHeight - 10, { align: "center" });

  // Save PDF
  const filename = `student-report-${studentData.roll_number || 'unknown'}-${new Date().toISOString().split("T")[0]}.pdf`;
  
  // Upload to storage
  const storagePath = await uploadPDFToStorage(pdf, filename);
  
  pdf.save(filename);
  
  // Log download history
  await logDownloadHistory({
    reportType: "student_pdf",
    reportName: filename,
    storagePath,
    metadata: {
      studentName: studentData.student_name,
      rollNumber: studentData.roll_number,
      department: studentData.department,
      riskLevel: prediction?.final_risk_level || 'Unknown',
    },
  });
};

export const generateStudentReportPDF = async (
  students: StudentReportData[],
  title: string = "Student Dropout Risk Report"
) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  students.forEach((student, index) => {
    if (index > 0) {
      pdf.addPage();
    }

    let yPosition = margin;

    // Header
    pdf.setFillColor(59, 130, 246); // Blue background
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("Student Dropout Risk Report", pageWidth / 2, 20, { align: "center" });
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: "center" });
    
    yPosition = 50;
    pdf.setTextColor(0, 0, 0);

    // Student Information Section
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Student Information", margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    
    // Name and Roll Number
    pdf.setFont("helvetica", "bold");
    pdf.text("Name:", margin, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(student.student_name, margin + 25, yPosition);
    yPosition += 7;

    if (student.roll_number) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Roll Number:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(student.roll_number, margin + 35, yPosition);
      yPosition += 7;
    }

    if (student.department) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Department:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(student.department, margin + 35, yPosition);
      yPosition += 7;
    }

    if (student.email) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Email:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(student.email, margin + 20, yPosition);
      yPosition += 10;
    } else {
      yPosition += 3;
    }

    // Performance Metrics Section
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Performance Metrics", margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");

    // Draw metrics boxes
    const boxHeight = 20;
    const boxWidth = (contentWidth - 10) / 2;

    // Attendance box
    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin, yPosition, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.text("Attendance", margin + 5, yPosition + 7);
    pdf.setFontSize(16);
    const attendanceColor = student.attendance_percentage >= 75 ? [34, 197, 94] : student.attendance_percentage >= 60 ? [251, 191, 36] : [239, 68, 68];
    pdf.setTextColor(attendanceColor[0], attendanceColor[1], attendanceColor[2]);
    pdf.text(student.attendance_percentage.toFixed(1) + "%", margin + 5, yPosition + 16);
    pdf.setTextColor(0, 0, 0);

    // Internal Marks box
    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin + boxWidth + 10, yPosition, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Internal Marks", margin + boxWidth + 15, yPosition + 7);
    pdf.setFontSize(16);
    const marksColor = student.internal_marks >= 40 ? [34, 197, 94] : student.internal_marks >= 25 ? [251, 191, 36] : [239, 68, 68];
    pdf.setTextColor(marksColor[0], marksColor[1], marksColor[2]);
    pdf.text(`${student.internal_marks.toFixed(0)}/100`, margin + boxWidth + 15, yPosition + 16);
    pdf.setTextColor(0, 0, 0);

    yPosition += boxHeight + 8;

    // Fees Paid box
    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin, yPosition, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Fees Paid", margin + 5, yPosition + 7);
    pdf.setFontSize(16);
    const feesColor = student.fee_paid_percentage >= 80 ? [34, 197, 94] : student.fee_paid_percentage >= 50 ? [251, 191, 36] : [239, 68, 68];
    pdf.setTextColor(feesColor[0], feesColor[1], feesColor[2]);
    pdf.text(student.fee_paid_percentage.toFixed(1) + "%", margin + 5, yPosition + 16);
    pdf.setTextColor(0, 0, 0);

    // Pending Fees box
    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin + boxWidth + 10, yPosition, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Pending Fees", margin + boxWidth + 15, yPosition + 7);
    pdf.setFontSize(16);
    const pendingColor = student.pending_fees <= 5000 ? [34, 197, 94] : student.pending_fees <= 10000 ? [251, 191, 36] : [239, 68, 68];
    pdf.setTextColor(pendingColor[0], pendingColor[1], pendingColor[2]);
    pdf.text(`Rs. ${student.pending_fees.toFixed(0)}`, margin + boxWidth + 15, yPosition + 16);
    pdf.setTextColor(0, 0, 0);

    yPosition += boxHeight + 12;

    // Risk Assessment Section
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Risk Assessment", margin, yPosition);
    yPosition += 10;

    // Risk Level
    const riskColors = {
      low: { bg: [220, 252, 231], text: [22, 101, 52], label: "LOW RISK" },
      medium: { bg: [254, 249, 195], text: [161, 98, 7], label: "MEDIUM RISK" },
      high: { bg: [254, 226, 226], text: [153, 27, 27], label: "HIGH RISK" }
    };
    
    const riskLevel = student.riskLevel.toLowerCase() as keyof typeof riskColors;
    const risk = riskColors[riskLevel] || riskColors.medium;

    pdf.setFillColor(risk.bg[0], risk.bg[1], risk.bg[2]);
    pdf.roundedRect(margin, yPosition, 50, 12, 2, 2, 'F');
    pdf.setTextColor(risk.text[0], risk.text[1], risk.text[2]);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(risk.label, margin + 25, yPosition + 8, { align: "center" });
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.text("ML Probability: " + (student.mlProbability * 100).toFixed(1) + "%", margin + 60, yPosition + 8);

    yPosition += 20;

    // Insights Section
    if (student.insights) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Key Insights", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      // Clean the insights text to ensure proper encoding
      const cleanedInsights = student.insights.replace(/₹/g, 'Rs. ').replace(/\s+/g, ' ').trim();
      const insights = pdf.splitTextToSize(cleanedInsights, contentWidth);
      pdf.text(insights, margin, yPosition);
      yPosition += insights.length * 5 + 5;
    }

    // Suggestions Section
    if (student.suggestions) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Recommendations", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      // Clean the suggestions text to ensure proper encoding
      const cleanedSuggestions = student.suggestions.replace(/₹/g, 'Rs. ').replace(/\s+/g, ' ').trim();
      const suggestions = pdf.splitTextToSize(cleanedSuggestions, contentWidth);
      pdf.text(suggestions, margin, yPosition);
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Page ${index + 1} of ${students.length} | Confidential Student Report`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    pdf.setTextColor(0, 0, 0);
  });

  // Save PDF
  const filename = `student-reports-${new Date().toISOString().split("T")[0]}.pdf`;
  
  // Upload to storage
  const storagePath = await uploadPDFToStorage(pdf, filename);
  
  pdf.save(filename);
  
  // Log download history
  await logDownloadHistory({
    reportType: "class_report",
    reportName: filename,
    storagePath,
    metadata: {
      totalStudents: students.length,
      reportTitle: title,
    },
  });
};
