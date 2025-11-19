import Papa from "papaparse";

export interface ParsedStudent {
  studentName: string;
  rollNumber?: string;
  totalHours: number;
  attendedHours: number;
  totalFees: number;
  paidFees: number;
  internalMarks: number;
  email?: string;
  phoneNumber?: string;
}

// Fuzzy matching for column names
const fuzzyMatch = (columnName: string, keywords: string[]): boolean => {
  const normalized = columnName.toLowerCase().trim();
  return keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
};

const detectColumn = (headers: string[], keywords: string[]): number => {
  return headers.findIndex(header => fuzzyMatch(header, keywords));
};

// Clean and convert values
const cleanNumeric = (value: any): number => {
  if (typeof value === "number") return value;
  if (!value || value === "" || value === "NA" || value === "null") return 0;
  
  // Remove currency symbols, commas, percentage signs
  const cleaned = String(value)
    .replace(/[₹$,\s%]/g, "")
    .trim();
  
  // Handle fraction format like "40/50"
  if (cleaned.includes("/")) {
    const [numerator, denominator] = cleaned.split("/").map(Number);
    return denominator > 0 ? (numerator / denominator) * 100 : 0;
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const parseCSV = (file: File): Promise<{ data: ParsedStudent[]; preview: any[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const headers = results.meta.fields || [];
          
          // Detect columns using fuzzy matching
          const nameIdx = detectColumn(headers, ["name", "student", "nombre"]);
          const rollIdx = detectColumn(headers, ["roll", "id", "number", "enrollment"]);
          const totalHoursIdx = detectColumn(headers, ["total hours", "total_hours", "hours total"]);
          const attendedIdx = detectColumn(headers, ["attended", "present", "attendance hours"]);
          const totalFeesIdx = detectColumn(headers, ["total fees", "total_fees", "fees total", "fee total"]);
          const paidFeesIdx = detectColumn(headers, ["paid fees", "paid_fees", "fees paid", "amount paid"]);
          const marksIdx = detectColumn(headers, ["marks", "internal", "score", "grade"]);
          const emailIdx = detectColumn(headers, ["email", "e-mail", "mail", "email id"]);
          const phoneIdx = detectColumn(headers, ["phone", "mobile", "contact", "phone number", "mobile number"]);
          
          const parsedData: ParsedStudent[] = results.data.map((row: any) => ({
            studentName: row[headers[nameIdx]] || "Unknown",
            rollNumber: row[headers[rollIdx]] || undefined,
            totalHours: cleanNumeric(row[headers[totalHoursIdx]]),
            attendedHours: cleanNumeric(row[headers[attendedIdx]]),
            totalFees: cleanNumeric(row[headers[totalFeesIdx]]),
            paidFees: cleanNumeric(row[headers[paidFeesIdx]]),
            internalMarks: cleanNumeric(row[headers[marksIdx]]),
            email: emailIdx >= 0 ? row[headers[emailIdx]] : undefined,
            phoneNumber: phoneIdx >= 0 ? row[headers[phoneIdx]] : undefined,
          }));
          
          // Filter out rows with all zeros (likely invalid data)
          const validData = parsedData.filter(student => 
            student.totalHours > 0 || student.totalFees > 0 || student.internalMarks > 0
          );
          
          resolve({
            data: validData,
            preview: results.data.slice(0, 5), // First 5 rows for preview
          });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};
