import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Trash2, Calendar, Filter, Search, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DownloadRecord {
  id: string;
  report_type: string;
  report_name: string;
  file_size: number | null;
  download_date: string;
  metadata: any;
  storage_path: string | null;
}

const History = () => {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, searchQuery, typeFilter, dateFrom, dateTo]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view history");
        return;
      }

      const { data, error } = await supabase
        .from("download_history")
        .select("*")
        .order("download_date", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load download history");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...records];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.report_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(record => record.report_type === typeFilter);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(record =>
        new Date(record.download_date) >= dateFrom
      );
    }
    if (dateTo) {
      filtered = filtered.filter(record =>
        new Date(record.download_date) <= dateTo
      );
    }

    setFilteredRecords(filtered);
  };

  const handleDownload = async (record: DownloadRecord) => {
    if (!record.storage_path) {
      toast.info("This report was generated before storage was enabled. Please regenerate from the original page.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(record.storage_path);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.report_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("Failed to download report");
    }
  };

  const handleDelete = async (record: DownloadRecord) => {
    try {
      // Delete from storage if exists
      if (record.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('reports')
          .remove([record.storage_path]);
        
        if (storageError) {
          console.error("Error deleting from storage:", storageError);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("download_history")
        .delete()
        .eq("id", record.id);

      if (error) throw error;
      
      toast.success("Record deleted");
      fetchHistory();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Failed to delete record");
    }
  };

  const handleExportClick = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export");
      return;
    }
    setShowPreview(true);
  };

  const exportToPDF = () => {
    setIsExporting(true);
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(124, 58, 237);
    doc.text("Download History Report", 14, 20);
    
    // Add date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}`, 14, 28);
    
    // Add summary
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Records: ${filteredRecords.length}`, 14, 36);
    
    // Prepare table data
    const tableData = filteredRecords.map(record => [
      record.report_type.replace(/_/g, " ").toUpperCase(),
      record.report_name,
      format(new Date(record.download_date), "MMM dd, yyyy HH:mm"),
      formatFileSize(record.file_size)
    ]);

    // Add table
    autoTable(doc, {
      startY: 42,
      head: [["Report Type", "Report Name", "Date", "Size"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 70 },
        2: { cellWidth: 45 },
        3: { cellWidth: 25 }
      }
    });

    doc.save(`download-history-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("History exported to PDF");
    setIsExporting(false);
    setShowPreview(false);
  };

  const renderPreviewContent = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-primary">Download History Report</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generated on: {format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}
        </p>
        <p className="text-sm font-medium mt-2">Total Records: {filteredRecords.length}</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="p-2 text-left font-semibold">Report Type</th>
              <th className="p-2 text-left font-semibold">Report Name</th>
              <th className="p-2 text-left font-semibold">Date</th>
              <th className="p-2 text-left font-semibold">Size</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.slice(0, 10).map((record, idx) => (
              <tr key={record.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                <td className="p-2">
                  <Badge variant="outline" className={getReportTypeColor(record.report_type)}>
                    {record.report_type.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </td>
                <td className="p-2">{record.report_name}</td>
                <td className="p-2">{format(new Date(record.download_date), "MMM dd, yyyy HH:mm")}</td>
                <td className="p-2">{formatFileSize(record.file_size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecords.length > 10 && (
          <div className="p-2 bg-muted/50 text-center text-sm text-muted-foreground">
            ... and {filteredRecords.length - 10} more records
          </div>
        )}
      </div>
    </div>
  );

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const getReportTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "student_pdf":
        return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "analytics_pdf":
        return "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400";
      case "class_report":
        return "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400";
      case "social_activity_report":
        return "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400";
      default:
        return "border-border bg-muted text-foreground";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Download History
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage your previously downloaded reports and PDFs
            </p>
          </div>
          <Button onClick={handleExportClick} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="student_pdf">Student PDF</SelectItem>
                  <SelectItem value="analytics_pdf">Analytics PDF</SelectItem>
                  <SelectItem value="class_report">Class Report</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM dd, yyyy") : "To Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {(searchQuery || typeFilter !== "all" || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report History
            </CardTitle>
            <CardDescription>
              {filteredRecords.length} {filteredRecords.length === 1 ? "record" : "records"} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No records found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {records.length > 0 ? "Try adjusting your filters" : "Your downloaded reports will appear here"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Type</TableHead>
                    <TableHead>Report Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Badge variant="outline" className={getReportTypeColor(record.report_type)}>
                          {record.report_type.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.report_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(record.download_date), "MMM dd, yyyy 'at' HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(record.file_size)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(record)}
                            className="hover:bg-primary/10 hover:text-primary"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(record)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <PDFPreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          title="Preview Download History PDF"
          description="Review the content before exporting your download history report"
          previewContent={renderPreviewContent()}
          onConfirmExport={exportToPDF}
          isExporting={isExporting}
        />
      </div>
    </DashboardLayout>
  );
};

export default History;
