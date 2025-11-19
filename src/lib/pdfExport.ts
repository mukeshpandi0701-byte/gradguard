import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface StudentReportData {
  student_name: string;
  roll_number: string | null;
  attendance_percentage: number;
  internal_marks: number;
  fee_paid_percentage: number;
  pending_fees: number;
  riskLevel?: string;
  mlProbability?: number;
  email?: string;
  phone_number?: string;
}

export const generatePDF = async (
  students: StudentReportData[],
  chartElement?: HTMLElement | null,
  title: string = "Student Dropout Risk Report"
) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Title
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text(title, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Date
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Add chart if provided
  if (chartElement) {
    try {
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (yPosition + imgHeight > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.addImage(imgData, "PNG", 20, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 15;
    } catch (error) {
      console.error("Failed to add chart to PDF:", error);
    }
  }

  // Add student table
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = 20;
  }

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Student Risk Analysis", 20, yPosition);
  yPosition += 10;

  // Table headers
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  const headers = ["Name", "Roll No", "Attend%", "Marks", "Risk", "Prob%"];
  const colWidths = [45, 25, 20, 20, 25, 25];
  let xPosition = 20;

  headers.forEach((header, i) => {
    pdf.text(header, xPosition, yPosition);
    xPosition += colWidths[i];
  });
  yPosition += 7;

  // Table rows
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  students.forEach((student) => {
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
      
      // Repeat headers on new page
      pdf.setFont("helvetica", "bold");
      xPosition = 20;
      headers.forEach((header, i) => {
        pdf.text(header, xPosition, yPosition);
        xPosition += colWidths[i];
      });
      yPosition += 7;
      pdf.setFont("helvetica", "normal");
    }

    xPosition = 20;
    const rowData = [
      student.student_name.substring(0, 20),
      student.roll_number || "—",
      `${student.attendance_percentage.toFixed(1)}%`,
      student.internal_marks.toString(),
      student.riskLevel?.toUpperCase() || "—",
      student.mlProbability ? `${(student.mlProbability * 100).toFixed(1)}%` : "—",
    ];

    rowData.forEach((data, i) => {
      pdf.text(data, xPosition, yPosition);
      xPosition += colWidths[i];
    });
    yPosition += 6;
  });

  // Save PDF
  const filename = `dropout-risk-report-${new Date().toISOString().split("T")[0]}.pdf`;
  pdf.save(filename);
};
