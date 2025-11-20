import Papa from "papaparse";

export interface ParsedStudent {
  studentName: string;
  rollNumber?: string;
  attendedHours: number;
  paidFees: number;
  internalMarks: number;
  email?: string;
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
          const attendedIdx = detectColumn(headers, ["attended", "attended hours", "present", "attendance hours"]);
          const paidFeesIdx = detectColumn(headers, ["paid fees", "paid_fees", "fees paid", "amount paid", "fees"]);
          const marksIdx = detectColumn(headers, ["marks", "internal", "score", "grade", "internal score"]);
          const emailIdx = detectColumn(headers, ["email", "e-mail", "mail", "email id"]);
          
          const parsedData: ParsedStudent[] = results.data.map((row: any) => ({
            studentName: row[headers[nameIdx]] || "Unknown",
            rollNumber: row[headers[rollIdx]] || undefined,
            attendedHours: cleanNumeric(row[headers[attendedIdx]]),
            paidFees: cleanNumeric(row[headers[paidFeesIdx]]),
            internalMarks: cleanNumeric(row[headers[marksIdx]]),
            email: emailIdx >= 0 ? row[headers[emailIdx]] : undefined,
          }));
          
          // Filter out rows with all zeros (likely invalid data)
          const validData = parsedData.filter(student => 
            student.attendedHours > 0 || student.paidFees > 0 || student.internalMarks > 0
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
