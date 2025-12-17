import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from "jspdf";

const isSunday = (date: Date): boolean => getDay(date) === 0;

const glossyStyles = {
  sunday: "bg-indigo-500/20 text-indigo-400 backdrop-blur-sm border border-indigo-400/30 shadow-sm",
  holiday: "bg-rose-500/20 text-rose-400 backdrop-blur-sm border border-rose-400/30 shadow-sm",
  customSession: "bg-emerald-500/20 text-emerald-400 backdrop-blur-sm border border-emerald-400/30 shadow-sm",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarEvent {
  id: string;
  department: string;
  event_date: string;
  event_type: "holiday" | "custom_sessions";
  description: string | null;
  custom_sessions: number | null;
}

const StudentCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<string>("");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedDownloadMonths, setSelectedDownloadMonths] = useState<number[]>([]);
  const [downloadYear, setDownloadYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get student profile to find department
      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("department")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!studentProfile?.department) {
        toast.error("Department not found in your profile");
        setLoading(false);
        return;
      }

      setDepartment(studentProfile.department);

      const { data: calendarEvents, error } = await supabase
        .from("academic_calendar")
        .select("*")
        .eq("department", studentProfile.department)
        .order("event_date", { ascending: false });

      if (error) throw error;
      setEvents((calendarEvents || []) as CalendarEvent[]);
    } catch (error: any) {
      console.error("Error fetching calendar:", error);
      toast.error("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  };

  const getEventForDate = (date: Date): CalendarEvent | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.find(e => e.event_date === dateStr) || null;
  };

  const generateMonthGrid = (month: Date) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const paddingStart = Array(startDay).fill(null);
    return [...paddingStart, ...days];
  };

  const toggleMonthSelection = (month: number) => {
    setSelectedDownloadMonths(prev => {
      if (prev.includes(month)) return prev.filter(m => m !== month);
      return [...prev, month].sort((a, b) => a - b);
    });
  };

  const downloadCalendarPDF = () => {
    if (selectedDownloadMonths.length === 0) {
      toast.error("Please select at least one month");
      return;
    }

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const cellWidth = (pageWidth - margin * 2) / 7;
    const cellHeight = 18;

    selectedDownloadMonths.forEach((month, pageIndex) => {
      if (pageIndex > 0) pdf.addPage();

      const monthDate = new Date(downloadYear, month, 1);
      const monthName = MONTH_NAMES[month];
      
      pdf.setFillColor(245, 245, 245);
      pdf.rect(0, 0, pageWidth, 35, "F");
      pdf.setFontSize(24);
      pdf.setTextColor(30, 30, 30);
      pdf.text(`${monthName} ${downloadYear}`, pageWidth / 2, 20, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(department, pageWidth / 2, 28, { align: "center" });

      let yPos = 45;
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      DAY_NAMES.forEach((day, i) => {
        const xPos = margin + i * cellWidth + cellWidth / 2;
        pdf.text(day, xPos, yPos, { align: "center" });
      });

      yPos = 52;
      const grid = generateMonthGrid(monthDate);
      let row = 0;
      let col = 0;

      grid.forEach((day) => {
        const xPos = margin + col * cellWidth;
        const currentY = yPos + row * cellHeight;

        pdf.setDrawColor(220, 220, 220);
        pdf.rect(xPos, currentY, cellWidth, cellHeight);

        if (day) {
          const event = getEventForDate(day);
          const sunday = isSunday(day);

          if (sunday || (event && event.event_type === "holiday")) {
            pdf.setFillColor(254, 226, 226);
            pdf.rect(xPos + 0.5, currentY + 0.5, cellWidth - 1, cellHeight - 1, "F");
          } else if (event && event.event_type === "custom_sessions") {
            pdf.setFillColor(254, 249, 195);
            pdf.rect(xPos + 0.5, currentY + 0.5, cellWidth - 1, cellHeight - 1, "F");
          }

          pdf.setFontSize(11);
          pdf.setTextColor(sunday ? 200 : 50, sunday ? 50 : 50, sunday ? 50 : 50);
          pdf.text(format(day, "d"), xPos + 3, currentY + 6);

          if (sunday) {
            pdf.setFontSize(6);
            pdf.setTextColor(180, 50, 50);
            pdf.text("Sunday", xPos + 3, currentY + 11);
          } else if (event) {
            pdf.setFontSize(6);
            if (event.event_type === "holiday") {
              pdf.setTextColor(180, 50, 50);
              pdf.text(event.description || "Holiday", xPos + 3, currentY + 11, { maxWidth: cellWidth - 4 });
            } else {
              pdf.setTextColor(150, 120, 0);
              pdf.text(`${event.custom_sessions} sessions`, xPos + 3, currentY + 11);
            }
          }
        }

        col++;
        if (col === 7) { col = 0; row++; }
      });

      const legendY = pageHeight - 25;
      pdf.setFontSize(8);
      pdf.setFillColor(254, 226, 226);
      pdf.rect(margin, legendY, 8, 5, "F");
      pdf.setTextColor(80, 80, 80);
      pdf.text("Holiday / Sunday", margin + 10, legendY + 4);
      pdf.setFillColor(254, 249, 195);
      pdf.rect(margin + 50, legendY, 8, 5, "F");
      pdf.text("Custom Sessions", margin + 60, legendY + 4);

      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated on ${format(new Date(), "PPP")}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    });

    pdf.save(`Academic_Calendar_${downloadYear}_${department}.pdf`);
    toast.success("Calendar downloaded successfully");
    setDownloadDialogOpen(false);
    setSelectedDownloadMonths([]);
  };

  const renderMonthCalendar = (monthDate: Date, size: "small" | "large" = "large") => {
    const grid = generateMonthGrid(monthDate);
    const cellSize = size === "large" ? "h-14 w-full" : "h-8 w-8";
    const fontSize = size === "large" ? "text-sm" : "text-xs";
    
    return (
      <div className={size === "large" ? "w-full" : ""}>
        <div className="text-center font-semibold mb-2 text-sm">
          {format(monthDate, "MMMM yyyy")}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {DAY_NAMES.map(day => (
            <div key={day} className={`text-center ${fontSize} font-medium text-muted-foreground p-1`}>
              {size === "large" ? day : day.charAt(0)}
            </div>
          ))}
          {grid.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className={cellSize} />;
            
            const event = getEventForDate(day);
            const sunday = isSunday(day);
            const isCustomSession = event && event.event_type === "custom_sessions";
            
            let cellClass = "bg-background border-border";
            if (sunday) cellClass = glossyStyles.sunday;
            else if (event && event.event_type === "holiday") cellClass = glossyStyles.holiday;
            else if (isCustomSession) cellClass = glossyStyles.customSession;
            
            return (
              <div key={day.toISOString()} className={`${cellSize} rounded-md p-1 ${fontSize} ${cellClass} transition-all duration-200`}>
                <div className="font-medium">{format(day, "d")}</div>
                {size === "large" && (
                  <div className="text-[9px] truncate opacity-80">
                    {sunday && "Sunday"}
                    {!sunday && event?.description}
                    {!sunday && isCustomSession && !event?.description && `${event.custom_sessions}s`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-7 w-7" />
              Academic Calendar
            </h2>
            <p className="text-muted-foreground mt-1">
              {department}
            </p>
          </div>
          <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Download Calendar</DialogTitle>
                <DialogDescription>Select months to download as PDF</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={downloadYear.toString()} onValueChange={(v) => setDownloadYear(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[downloadYear - 1, downloadYear, downloadYear + 1].map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Months</Label>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDownloadMonths(selectedDownloadMonths.length === 12 ? [] : [0,1,2,3,4,5,6,7,8,9,10,11])} className="h-7 text-xs">
                      {selectedDownloadMonths.length === 12 ? "Clear All" : "Select All"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MONTH_NAMES.map((month, index) => (
                      <div key={month} onClick={() => toggleMonthSelection(index)} className={`p-2 text-sm text-center rounded-md cursor-pointer border transition-colors ${selectedDownloadMonths.includes(index) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}>
                        {month.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>Cancel</Button>
                <Button onClick={downloadCalendarPDF} disabled={selectedDownloadMonths.length === 0}>
                  <Download className="w-4 h-4 mr-2" />Download ({selectedDownloadMonths.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
            <TabsTrigger value="yearly">Yearly View</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderMonthCalendar(currentMonth, "large")}
                <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-400/30" />
                    <span className="text-muted-foreground">Sunday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-400/30" />
                    <span className="text-muted-foreground">Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400/30" />
                    <span className="text-muted-foreground">Custom Sessions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="yearly">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{currentYear}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentYear(new Date().getFullYear())}>This Year</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentYear(currentYear + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {MONTH_NAMES.map((_, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      {renderMonthCalendar(new Date(currentYear, index, 1), "small")}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-6 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-400/30" />
                    <span className="text-muted-foreground">Sunday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-rose-500/20 border border-rose-400/30" />
                    <span className="text-muted-foreground">Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400/30" />
                    <span className="text-muted-foreground">Custom Sessions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentCalendar;
